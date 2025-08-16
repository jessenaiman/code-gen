import { MODES } from './modes-config.js';
import { updateUIForMode } from './ui.js';
import { displayResult } from './output-display.js';
import { addFixJsonButton } from './output-ui.js';

let intervalId;
let stopFlag = false;

function updateOutput(output, modeConfig, model) {
  const errorExists = window.lastAttemptError !== null;
  const attemptNumber = window.responseRetries < 1 ? 1 : window.responseRetries;
  const retryText = model !== "websim" ? ` (Attempt ${attemptNumber}/5)` : '';

  const errorMsg = errorExists && window.lastAttemptError?.message && typeof window.lastAttemptError.message === "string" ? (window.lastAttemptError.message.length > 65 ? window.lastAttemptError.message.substring(0, 65) + '...' : window.lastAttemptError.message) : undefined;
  
  let errorText = errorExists ? ` (Last attempt error: <err>${errorMsg}</err>)` : '';
  let fallbackText = '';

  if (attemptNumber >= 5) {
    fallbackText = ' (Using websim as fallback)';
  }

  output.innerHTML = `<p>${modeConfig.loadingText}...${retryText}${errorText}${fallbackText}</p>`;
}

function startUpdates(output, modeConfig, model) {
  stopFlag = false;

  if (model === "websim")
      return;
  
  intervalId = setInterval(() => {
    if (stopFlag) {
      clearInterval(intervalId);
      console.log("Stopped.");
      return;
    }
    updateOutput(output, modeConfig, model);
  }, 100);
}

export function stopUpdates() {
  stopFlag = true;
}


// Handle execute button click
export async function handleExecute(elements) {
  // Get the current mode key from the elements object, where it's stored by handleModeChange
  const modeKey = elements.currentModeKey;
  const modeConfig = MODES[modeKey];
  const description = elements.description.value;
  const includeExplanation = elements.includeExplanation ? elements.includeExplanation.checked : false;
  const includeReasoning = elements.includeReasoning ? elements.includeReasoning.checked : false;
  let toneValue = elements.tone ? elements.tone.value : 'professional';
  const customToneField = document.getElementById('customTone');

  if (elements.output.classList.contains('hidden')) {
      elements.output.classList.remove('hidden');
  }

  if (toneValue === 'custom' && customToneField) {
    toneValue = customToneField.value.trim();
    if (!toneValue) {
      elements.output.textContent = `Please provide a custom tone.`;
      return;
    }
  }

  // Ensure the resolved tone (including custom) is made available to mode parameter builders and handlers
  // store the resolved tone on the shared elements object so parameter functions use it
  elements.resolvedTone = toneValue;
  // Keep the select's displayed value consistent if it contains an option, otherwise leave select untouched
  try {
    if (elements.tone && Array.from(elements.tone.options).some(opt => opt.value === toneValue)) {
      elements.tone.value = toneValue;
    }
  } catch (e) {
    /* ignore */
  }
  
  if (!description.trim() && modeKey !== 'explainer' && modeKey !== 'reviewer' && modeKey !== 'commenter' && modeKey !== 'converter' && modeKey !== 'optimizer') {
     // For generator mode, description is required. For others, description is the code itself.
     // We refine this: If the description/code textarea is empty, show an error regardless of mode.
       if (!description.trim()) {
            elements.output.textContent = `Please provide ${modeConfig.descriptionLabel.toLowerCase()}`;
            return;
        }
  }

  elements.execute.classList.add('loading');

  let aiModel = elements.pollinationsModel.value || "openai";

  updateOutput(elements.output, modeConfig, aiModel); // Immediately update
  startUpdates(elements.output, modeConfig, aiModel);
  
  try {
    const parameters = modeConfig.parameters(elements);
    // Add includeReasoning to the parameters list for all function calls
    if (modeKey === 'generator') {
      parameters.push(includeReasoning);
    } else if (modeKey === 'explainer' || modeKey === 'reviewer' || modeKey === 'debugger') {
       parameters.push(includeReasoning);
    } else if (modeKey === 'commenter') {
       parameters.push(includeReasoning);
    } else if (modeKey === 'converter') {
       parameters.push(includeReasoning);
    } else if (modeKey === 'optimizer') {
       parameters.push(includeReasoning);
    } else if (modeKey === 'roaster') {
       parameters.push(includeReasoning);
    }

    const result = await modeConfig.handler(...parameters);

    // Determine the language for display/highlighting based on the mode
    let displayLanguage = elements.language.value; // Default to source language
    if (modeKey === 'converter') {
        displayLanguage = elements.targetLanguage.value; // Use target language for converter
    }
    displayResult(result, displayLanguage, modeKey, elements, includeExplanation);

  } catch (error) {
    console.error("Error:", error);
    let errorMessage = error.message || 'Unknown error.';
    elements.output.innerHTML = `<p style="color: #ef4444;">Error processing request: ${errorMessage}</p>`; // Display error message in output
    if (error.rawResponse) {
      addFixJsonButton(elements.output, error.rawResponse, elements, handleExecute);
    }
  } finally {
    elements.execute.classList.remove('loading');
  }
}