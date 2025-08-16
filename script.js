import { setupUIHandlers } from './ui.js';
import { setupCustomLanguageHandlers } from './language-handlers.js';
import { handleModeChange, initializeModeUI } from './mode-handler.js';
import { getUIElements } from './ui-elements.js';
import { clearPromptIterationItems } from './promptUtils.js';
import './json-fixer.js'; // Import for side effects if any, or just to have it loaded.

window.outputResult = {};
window.responseRetries = 0;
window.lastAttemptError = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize mode UI first
  initializeModeUI();
  
  await setupUIHandlers();
  await setupCustomLanguageHandlers();

  // Clear all saved prompt iterations to save space
  clearPromptIterationItems();
});