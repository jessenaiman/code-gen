// pyodide-worker.js
// Worker that loads Pyodide and runs code, implementing blocking input() via postMessage + SharedArrayBuffer synchronization.

self.importScripts('https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.js');

let pyodide = null;
let initialized = false;
let pendingInputResponse = null; // Will be set when main posts input_response
let pendingResponseResolvers = {}; // mapping requestId => resolver for post-run results

async function initPyodide() {
  if (!pyodide) {
    self.postMessage({ type: 'log', msg: 'Loading Pyodide...' });
    pyodide = await loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.1/full/' });
    initialized = true;
    self.postMessage({ type: 'ready' });
  }
}

function createInputShim(sab, requestId) {
  // sab is a SharedArrayBuffer passed in by main; we will Atomics.wait on it until main sets flag to 1.
  // If SharedArrayBuffer is not provided (or not supported by the browser), fall back to a non-blocking behavior:
  // post an input_request and return an empty string immediately (so Python input() won't block).
  const flag = sab ? new Int32Array(sab) : null;
  const supportsSAB = !!flag && typeof Atomics !== 'undefined' && typeof Atomics.wait === 'function';

  if (!supportsSAB) {
    // Fallback shim: notify main thread that input was requested but do NOT block.
    return function(promptStr = '') {
      self.postMessage({ type: 'input_request', prompt: promptStr, requestId });
      // If main already provided a response (racy), return it; otherwise return empty string.
      const valObj = pendingInputResponse && pendingInputResponse[requestId] !== undefined ? pendingInputResponse[requestId] : '';
      return String(valObj || '');
    };
  }

  return function(promptStr = '') {
    // Notify main thread to show prompt
    self.postMessage({ type: 'input_request', prompt: promptStr, requestId });
    // Ensure flag is 0 before waiting
    Atomics.store(flag, 0, 0);
    // Block here until main sets flag to 1 and notifies
    Atomics.wait(flag, 0, 0);
    // After wake, there should be a queued message from main containing the input_response
    // But messages are only processed after this synchronous block returns; queued onmessage will run now.
    // We'll return the latest available response that was provided for this requestId.
    const valObj = pendingInputResponse && pendingInputResponse[requestId] !== undefined ? pendingInputResponse[requestId] : '';
    return String(valObj || '');
  };
}

self.addEventListener('message', async (e) => {
  const msg = e.data;
  if (!msg) return;

  if (msg.type === 'ping') {
    self.postMessage({ type: 'log', msg: 'pong' });
    return;
  }

  if (msg.type === 'run') {
    // ensure pyodide loaded
    await initPyodide();
    const { code, requestId, sab } = msg;
    try {
      // Create a shim for input()
      // Provide a Python snippet to set builtins.input to call our JS function via pyodide.runPython
      // We will expose a JS function named "__js_input" that calls the createInputShim(sab, requestId).
      const inputShim = createInputShim(sab, requestId);
      self.__js_input = inputShim;

      // Install a print capture that forwards to main as part of the run result
      let outputText = '';
      function js_print(...args) {
        outputText += args.map(a => String(a)).join(' ') + '\n';
      }
      self.__js_print = js_print;

      // Set up the Python environment to call our JS functions for input and print
      await pyodide.runPythonAsync(`
import builtins
from js import __js_input, __js_print
def __capture_input(prompt=''):
    # Call the JS shim to block and wait
    return __js_input(prompt)
builtins.input = __capture_input

def __capture_print(*args, **kwargs):
    __js_print(' '.join(str(a) for a in args))
import sys
`);

      // Run user code asynchronously
      try {
        await pyodide.runPythonAsync(code);
        // After execution, send back success with the accumulated output
        self.postMessage({ type: 'run_result', requestId, success: true, outputText });
      } catch (err) {
        // Send back an error
        const errMsg = err && err.message ? err.message : String(err);
        self.postMessage({ type: 'run_result', requestId, success: false, error: errMsg });
      }
    } catch (e) {
      const em = e && e.message ? e.message : String(e);
      self.postMessage({ type: 'run_result', requestId, success: false, error: em });
    }
    return;
  }

  if (msg.type === 'input_response') {
    // main thread provided an input for a requestId
    const { requestId, value } = msg;
    if (!pendingInputResponse) pendingInputResponse = {};
    pendingInputResponse[requestId] = value;
    // Do not attempt to notify Atomics here — main thread will set the SAB and notify.
    // Messages sent while Atomics.wait is in progress will be queued and processed after wake.
    return;
  }
});