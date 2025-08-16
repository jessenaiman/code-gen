import { MODES } from './modes-config.js';
import { fixJsonWithAI } from './json-fixer.js';
import { displayResult } from './output-display.js';

// Utility to resize ancestor .output to fit a child element's actual width if it overflows
function ensureOutputFitsChild(preBlock) {
  // Find the output wrapper
  let outputEl = preBlock;
  while (outputEl && !outputEl.classList.contains('output')) {
    outputEl = outputEl.parentElement;
  }
  if (!outputEl) return;

  // Compute the widest child width (in px)
  let maxChildWidth = 0;
  for (let child of outputEl.children) {
    if (child.offsetWidth > maxChildWidth) {
      maxChildWidth = child.offsetWidth;
    }
  }
  // If the output is not wide enough, set min-width so it scrolls
  if (maxChildWidth > outputEl.offsetWidth) {
    // Set min-width to the largest child width + some spacing
    outputEl.style.minWidth = (maxChildWidth + 32) + 'px';
    outputEl.style.overflowX = 'auto';
  }
}

// Global promise to hold the Pyodide instance
let pyodidePromise = null;

// Replace initializePyodide with worker-based initializer that creates a dedicated worker for running Python code.
// The worker will load Pyodide and respond to messages. The main page will manage SharedArrayBuffer coordination
// for synchronous-like input() behavior and show a custom input UI when the worker requests input.
function createPyodideWorker() {
  // Create a worker from a file (added below as pyodide-worker.js)
  const worker = new Worker('pyodide-worker.js');
  const state = {
    worker,
    ready: false,
    waitingInputRequest: null, // Will hold current input request info
    sab: null, // SharedArrayBuffer for synchronization
  };

  worker.addEventListener('message', (e) => {
    const msg = e.data;
    if (!msg) return;
    if (msg.type === 'ready') {
      state.ready = true;
      // Optionally expose ready status
      worker.postMessage({ type: 'ping' });
    } else if (msg.type === 'log') {
      console.log('[pyodide-worker]', msg.msg);
    } else if (msg.type === 'input_request') {
      // Message contains prompt and requestId
      const { prompt, requestId } = msg;
      // Create or reuse an input UI below the corresponding python output console
      // We dispatch a custom event so the run-button handler can show the UI in the right place.
      const ev = new CustomEvent('pyodide-input-request', { detail: { prompt, requestId, workerState: state } });
      window.dispatchEvent(ev);
    } else if (msg.type === 'run_result') {
      // run_result will contain { requestId, success, outputText, error }
      const ev = new CustomEvent('pyodide-run-result', { detail: msg });
      window.dispatchEvent(ev);
    }
  });

  worker.addEventListener('error', (err) => {
    console.error('Pyodide worker error:', err);
  });

  return state;
}

// Add a copy button to code blocks
export function addCopyButton(container, textToCopy) {
  const copyButton = document.createElement('button');
  copyButton.className = 'copy-button';
  copyButton.innerHTML = '<i class="fas fa-copy"></i>'; // Use icon
  copyButton.title = 'Copy to clipboard'; // Add title for hover text
  
  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      copyButton.innerHTML = '<i class="fas fa-check"></i>'; // Change to checkmark icon
      copyButton.classList.add('copied');
      copyButton.title = 'Copied!'; // Change title on copy

      setTimeout(() => {
        copyButton.innerHTML = '<i class="fas fa-copy"></i>'; // Change back to copy icon
        copyButton.classList.remove('copied');
        copyButton.title = 'Copy to clipboard'; // Restore title
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
      copyButton.innerHTML = '<i class="fas fa-times"></i>'; // Optional: error icon
      copyButton.classList.add('error'); // Optional: add error class
      copyButton.title = 'Failed to copy'; // Change title on error

      setTimeout(() => {
        copyButton.innerHTML = '<i class="fas fa-copy"></i>';
        copyButton.classList.remove('error');
        copyButton.title = 'Copy to clipboard'; // Restore title
      }, 2000);
    }
  });

  container.style.position = 'relative';
  copyButton.style.position = 'absolute';
  copyButton.style.top = '10px'; // Changed from -15px to be inside the pre
  copyButton.style.right = '10px'; // Changed from 0px for better padding
  container.appendChild(copyButton);
}

// Add a run button for HTML or Python code blocks (puts the button *inside* the pre)
export function addRunButtonForCodeBlock(preBlock, codeContent, language) {
  const isHtml = language && language.toLowerCase().includes('html');
  const isPython = language && language.toLowerCase().includes('python');

  if (!isHtml && !isPython) {
    return; // Don't add a button for other languages
  }

  let runButton = document.createElement('button');
  runButton.className = 'run-code-button';

  if (isHtml) {
    runButton.textContent = 'Run Code';
    runButton.addEventListener('click', () => {
      // The iframe container is always inserted right after the pre block.
      const existingContainer = preBlock.nextSibling;

      // Check if the next sibling is our container.
      if (existingContainer && existingContainer.classList && existingContainer.classList.contains('resizable-iframe-container')) {
        existingContainer.remove();
        runButton.textContent = 'Run Code';
        // Restore the output box min-width if possible
        let outputEl = preBlock;
        while (outputEl && !outputEl.classList.contains('output')) {
          outputEl = outputEl.parentElement;
        }
        if (outputEl) {
          outputEl.style.minWidth = '';
        }
        return;
      }

      // Create a container for the iframe to make it resizable
      const iframeContainer = document.createElement('div');
      iframeContainer.className = 'resizable-iframe-container';

      let iframe = document.createElement('iframe');
      iframe.srcdoc = codeContent;
      iframe.className = 'run-iframe';

      iframeContainer.appendChild(iframe);

      // Once appended, ensure the output fits its (potentially wide) child
      iframeContainer.addEventListener('mousedown', () => {
        setTimeout(() => ensureOutputFitsChild(preBlock), 250);
      });

      // Handle container resize using ResizeObserver
      let resizeObserver = new ResizeObserver(() => {
        ensureOutputFitsChild(preBlock);
      });
      resizeObserver.observe(iframeContainer);

      // Insert the new container after the preBlock
      preBlock.after(iframeContainer);
      runButton.textContent = 'Close Preview';

      // Ensure output expands immediately to initial size
      ensureOutputFitsChild(preBlock);
    });
  } else if (isPython) {
    runButton.textContent = 'Run Python Code (Experimental)';
    runButton.title = 'Note: Some Python features may not work in the browser environment';

    // Each Python run gets its own worker state and UI so multiple runs can coexist.
    let workerState = null;
    let currentRequestId = 0;
    let outputConsole = null;

    // Handler to show custom input box when worker asks for input
    function handleInputRequest(e) {
      const { prompt, requestId, workerState: evState } = e.detail;
      if (evState !== workerState) return; // Only handle for this run's worker

      // Ensure the console exists
      if (!outputConsole) {
        outputConsole = preBlock.nextElementSibling;
        if (!outputConsole || !outputConsole.classList.contains('python-output-console')) {
          // Create console if missing
          outputConsole = document.createElement('pre');
          outputConsole.className = 'python-output-console';
          preBlock.after(outputConsole);
        }
      }

      // Create input UI area
      let inputContainer = document.createElement('div');
      inputContainer.className = 'py-input-container';
      inputContainer.style.display = 'flex';
      inputContainer.style.gap = '8px';
      inputContainer.style.marginTop = '8px';

      const inputField = document.createElement('input');
      inputField.type = 'text';
      inputField.style.flex = '1';
      inputField.placeholder = prompt || '';
      inputField.className = 'py-input-field';

      const submitBtn = document.createElement('button');
      submitBtn.textContent = 'Enter';
      submitBtn.className = 'py-input-submit run-code-button';
      submitBtn.style.width = 'auto';
      submitBtn.style.padding = '6px 10px';

      inputContainer.appendChild(inputField);
      inputContainer.appendChild(submitBtn);
      outputConsole.appendChild(inputContainer);
      inputField.focus();

      const cleanup = () => {
        try { inputContainer.remove(); } catch (err) {}
      };

      // When user submits, write to the SharedArrayBuffer flag and post the response to worker
      submitBtn.addEventListener('click', () => {
        const value = inputField.value ?? '';
        // Write response to worker via postMessage (worker will process after wake)
        workerState.worker.postMessage({ type: 'input_response', requestId, value });
        // Set SAB flag so worker's Atomics.wait can unblock
        if (workerState.sab) {
          const flag = new Int32Array(workerState.sab);
          Atomics.store(flag, 0, 1);
          Atomics.notify(flag, 0, 1);
        }
        cleanup();
      });

      inputField.addEventListener('keypress', (ev) => {
        if (ev.key === 'Enter') {
          submitBtn.click();
        }
      });
    }

    // Listen for global event for input requests
    window.addEventListener('pyodide-input-request', handleInputRequest);

    // Listen for run results to display
    function handleRunResult(e) {
      const msg = e.detail;
      if (!workerState || msg.requestId !== currentRequestId) return;
      if (!outputConsole) {
        outputConsole = preBlock.nextElementSibling;
        if (!outputConsole || !outputConsole.classList.contains('python-output-console')) {
          outputConsole = document.createElement('pre');
          outputConsole.className = 'python-output-console';
          preBlock.after(outputConsole);
        }
      }
      if (msg.success) {
        outputConsole.textContent = msg.outputText || '(No output)';
      } else {
        outputConsole.textContent = `Error: ${msg.error || 'Unknown error'}`;
      }
    }
    window.addEventListener('pyodide-run-result', handleRunResult);

    runButton.addEventListener('click', async () => {
      // Toggle preview close if container exists
      let existingConsole = preBlock.nextSibling;
      if (existingConsole && existingConsole.classList && existingConsole.classList.contains('resizable-iframe-container')) {
        // If an iframe preview exists (from HTML runs), remove it
        existingConsole.remove();
      }

      // If a python console already exists and workerState is running, remove it to re-run
      let oldConsole = preBlock.parentElement.querySelector('.python-output-console');
      if (oldConsole) oldConsole.remove();

      // Create console
      outputConsole = document.createElement('pre');
      outputConsole.className = 'python-output-console';
      outputConsole.textContent = 'Initializing Python environment...';
      preBlock.after(outputConsole);

      // Create worker state if not exists
      if (!workerState) {
        workerState = createPyodideWorker();
      }

      // Only create SharedArrayBuffer if the environment supports it.
      if (typeof SharedArrayBuffer !== 'undefined' && typeof Atomics !== 'undefined' && typeof Atomics.wait === 'function') {
        try {
          workerState.sab = new SharedArrayBuffer(4);
          const flag = new Int32Array(workerState.sab);
          Atomics.store(flag, 0, 0); // reset
        } catch (e) {
          // If creation fails for any reason, fallback to null and continue (non-blocking input behavior).
          console.warn('Could not create SharedArrayBuffer for Python input synchronization, falling back:', e);
          workerState.sab = null;
        }
      } else {
        // Browser doesn't support cross-origin isolated SharedArrayBuffer.
        workerState.sab = null;
      }

      // If SAB is not available, inform the user that input() will not pause the script (it will return empty string)
      if (!workerState.sab) {
        const note = document.createElement('div');
        note.style.marginTop = '8px';
        note.style.fontSize = '0.95em';
        note.style.color = '#f59e0b';
        note.textContent = 'Note: Your browser does not support cross-origin-isolated SharedArrayBuffer — Python input() calls will not pause execution and will return an empty string automatically. To enable blocking input(), enable cross-origin isolation for this page.';
        outputConsole.appendChild(note);
      }

      currentRequestId = (currentRequestId || 0) + 1;

      // Send run command to worker with code, requestId and sab (SAB transferred)
      workerState.worker.postMessage({
        type: 'run',
        code: codeContent,
        requestId: currentRequestId,
        sab: workerState.sab // may be null if SAB unsupported; worker will fall back to non-blocking behavior
      });

      outputConsole.textContent = 'Running code...';

      // Note: actual outputs and input requests will be handled via the events wired above.
    });
  }
  
  preBlock.appendChild(runButton); // Appends button inside the pre
}

// New function to add reasoning button and its content
export function addReasoningButton(outputElement, reasoningContent) {
  const reasoningButton = document.createElement('button');
  reasoningButton.className = 'reasoning-button';
  reasoningButton.textContent = 'Model uses reasoning - click to show reasoning process';

  const reasoningDisplay = document.createElement('div');
  reasoningDisplay.className = 'reasoning-content hidden'; // Overall container for reasoning steps, initially hidden

  // Regex to parse the custom XML-like structure: <Tag_Name>content</Tag_Name>
  const stepRegex = /<([a-zA-Z0-9_]+)>([\s\S]*?)<\/\1>/g;
  let match;
  let hasParsedSteps = false;

  while ((match = stepRegex.exec(reasoningContent)) !== null) {
    hasParsedSteps = true;
    const tagName = match[1];
    let content = match[2].trim();

    // Just in case the AI still includes HTML tags, strip them out.
    content = content.replace(/<[^>]*>/g, '');

    // Recreate the original HTML structure for display
    const stepDiv = document.createElement('div');
    stepDiv.className = 'reasoning-step';

    const titleEl = document.createElement('h3');
    titleEl.className = 'step-title';
    titleEl.textContent = tagName.replace(/_/g, ' '); // Replace underscores with spaces for the title

    const contentDiv = document.createElement('div');
    contentDiv.className = 'step-content';
    // Use textContent to safely insert the reasoning prose
    contentDiv.textContent = content;

    stepDiv.appendChild(titleEl);
    stepDiv.appendChild(contentDiv);
    reasoningDisplay.appendChild(stepDiv);
  }

  // Fallback for plain text or if parsing fails
  if (!hasParsedSteps) {
    const preEl = document.createElement('pre');
    const codeEl = document.createElement('code');
    codeEl.textContent = reasoningContent;
    preEl.appendChild(codeEl);
    reasoningDisplay.appendChild(preEl);
  }

  reasoningButton.addEventListener('click', () => {
    reasoningDisplay.classList.toggle('hidden');
    reasoningButton.textContent = reasoningDisplay.classList.contains('hidden')
      ? 'Model uses reasoning - click to show reasoning process'
      : 'Hide reasoning process';
  });

  outputElement.appendChild(reasoningButton);
  outputElement.appendChild(reasoningDisplay);

  // Add collapse/expand functionality for individual steps
  // This part only applies if we successfully parsed steps
  if (hasParsedSteps) {
    const steps = reasoningDisplay.querySelectorAll('.reasoning-step');
    steps.forEach(step => {
      const title = step.querySelector('.step-title');
      const content = step.querySelector('.step-content');

      if (title && content) {
        // Initially hide content of each step
        content.classList.add('hidden');
        title.style.cursor = 'pointer'; // Make title clickable

        // Add toggle icon
        const toggleIcon = document.createElement('span');
        toggleIcon.className = 'toggle-icon fas fa-chevron-down'; // Initially pointing down (collapsed)
        title.appendChild(toggleIcon);

        title.addEventListener('click', (event) => {
          // Prevent event from bubbling up if there are nested clickable elements
          if (event.target === title || event.target === toggleIcon || title.contains(event.target)) {
            content.classList.toggle('hidden');
            toggleIcon.classList.toggle('fa-chevron-down');
            toggleIcon.classList.toggle('fa-chevron-up');
          }
        });
      }
    });
  }
}

export function addFixJsonButton(container, rawResponse, elements, executeCallback) {
  const fixButton = document.createElement('button');
  fixButton.textContent = 'Attempt to Fix JSON';
  fixButton.style.backgroundColor = '#ef4444';
  fixButton.style.marginTop = '10px';
  
  fixButton.addEventListener('click', async () => {
    fixButton.textContent = 'Fixing...';
    fixButton.disabled = true;
    
    const modeKey = elements.currentModeKey;
    const modeConfig = MODES[modeKey];
    const includeExplanation = elements.includeExplanation ? elements.includeExplanation.checked : false;
    const includeReasoning = elements.includeReasoning ? elements.includeReasoning.checked : false;

    let schemaObj = {};

    // Build the expected schema object based on the current mode and options
    if (modeKey === 'generator') {
        if (elements.mode.value === 'multiple') {
            schemaObj.codes = '["string"]'; // Array of strings
        } else {
            schemaObj.code = 'string';
        }
        if (includeExplanation) {
            schemaObj.explanation = 'string';
        }
    } else if (modeKey === 'explainer') {
        schemaObj.explanation = 'string';
    } else if (modeKey === 'reviewer') {
        schemaObj.review = 'string';
        schemaObj.score = 'number';
        schemaObj.improved_code = 'string';
    } else if (modeKey === 'commenter') {
        schemaObj.commentedCode = 'string';
        schemaObj.summary = 'string';
    } else if (modeKey === 'converter') {
        schemaObj.code = 'string';
        if (includeExplanation) { // Converter also has includeExplanation
            schemaObj.explanation = 'string';
        }
    } else if (modeKey === 'optimizer') {
        schemaObj.optimizedCode = 'string';
        schemaObj.summary = 'string';
    } else if (modeKey === 'debugger') {
        schemaObj.debugReport = 'string';
        schemaObj.fixedCode = 'string';
    } else if (modeKey === 'roaster') {
        schemaObj.roast = 'string';
    }

    // Add reasoning field to schema if it was enabled for the original request
    // This assumes the `includeReasoning` checkbox was checked during the original failed request
    if (includeReasoning) {
        schemaObj.reasoning = 'string';
    }

    const schemaString = JSON.stringify(schemaObj);
    
    try {
      // Call fixJsonWithAI without userQuery and aiModel, as it's now client-side
      const fixedData = await fixJsonWithAI(rawResponse, schemaString); 
      
      // Determine the language for display/highlighting based on the mode
      let displayLanguage = elements.language.value;
      if (modeKey === 'converter') {
          displayLanguage = elements.targetLanguage.value;
      }
      
      // Use the existing displayResult function to show the fixed data
      displayResult(fixedData, displayLanguage, modeKey, elements, includeExplanation);

    } catch (fixError) {
      console.error("Failed to fix JSON:", fixError);
      container.innerHTML += `<p style="color: #ef4444;">Failed to fix the JSON. The malformed response was unrecoverable by the client-side fixer. Please try again.</p>`;
      fixButton.textContent = 'Fix Failed';
      setTimeout(() => {
        fixButton.textContent = 'Attempt to Fix JSON';
        fixButton.disabled = false;
      }, 2000);
    }
  });
  
  container.appendChild(fixButton);
}