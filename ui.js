// --- ui-setup.js ---
import { getUIElements, setupToneHandlers } from './ui-elements.js';
import { handleModeChange, updateUIForMode } from './mode-handler.js';
import { handleExecute } from './execution-handler.js';
import { displayResult } from './output-display.js';

export let elements;

export {
  displayResult,
  updateUIForMode,
  handleModeChange
};

/**
 * Show or hide all sidebar tab buttons and content based on visibility
 */
function toggleSidebar(btns, contents, expanded) {
  btns.forEach(b => {
    b.classList.toggle('hidden', !expanded);
    b.disabled = !expanded;
    b.setAttribute('aria-hidden', !expanded);
    b.tabIndex = expanded ? 0 : -1;
  });
  contents.forEach(c => {
    c.classList.toggle('hidden', !expanded);
    c.setAttribute('aria-hidden', !expanded);
    c.tabIndex = expanded ? 0 : -1;
    // Only let previously-active remain active if expanded
    if (!expanded) c.classList.remove('active');
  });
}

/**
 * Activates the given tab and shows only its content
 */
function toggleTab(selectedButton, btns, contents) {
  btns.forEach(b => {
    b.classList.remove('active');
  });
  contents.forEach(c => {
    c.classList.remove('active');
  });
  selectedButton.classList.add('active');
  const tabName = selectedButton.dataset.tab;
  const tabContent = document.querySelector(`[data-tab-content="${tabName}"]`);
  if (tabContent) {
    tabContent.classList.add('active');
    tabContent.classList.remove('hidden');
    tabContent.setAttribute('aria-hidden', 'false');
  }
}

function getActiveTabButton(btns) {
  return Array.from(btns).find(b => b.classList.contains('active')) || btns[0];
}

function toggleOffAllSidebarContents(btns, contents) {
  btns.forEach(b => {
    b.classList.remove('active');
    b.classList.add('hidden');
    b.setAttribute('aria-hidden', 'true');
    b.tabIndex = -1;
    b.disabled = true;
  });
  contents.forEach(c => {
    c.classList.remove('active');
    c.classList.add('hidden');
    c.setAttribute('aria-hidden', 'true');
    c.tabIndex = -1;
  });
}

class ModelManager {
  constructor() {
    this.models = [];
  }

  addModel(name, text, options = {}) {
    this.models.push({ name, text, ...options });
    return this; // Allow method chaining
  }

  getModels() {
    return this.models;
  }

  getModelByName(name) {
    return this.models.find(m => m.name === name);
  }

  populateSelect(selectElement) {
    selectElement.innerHTML = "";
    this.models.forEach(mdl => {
      const opt = document.createElement("option");
      opt.value = mdl.name;
      opt.textContent = mdl.text;
      selectElement.appendChild(opt);
    });
  }
}

// Create the model manager with builder pattern
const modelManager = new ModelManager()
  .addModel("websim", "Websim Default (Recommended for even less rate limits and slightly faster generation!)")
  .addModel("gpt-5-nano", "OpenAI GPT-5 Nano (may use reasoning)", { reasoning: true })
  .addModel("openai-fast", "OpenAI GPT-4.1 Nano")
  .addModel("openai-large", "OpenAI GPT-4.1")
  .addModel("openai-roblox", "OpenAI GPT-4.1 Nano (Roblox)")
  .addModel("qwen-coder", "Qwen 2.5 Coder 32B")
  .addModel("mistral", "Mistral Small 3.1 24B")
  .addModel("mistral-roblox", "Mistral Small 3.1 24B (Roblox)")
  .addModel("deepseek-reasoning", "DeepSeek R1 0528 (reasoning)", { reasoning: true })
  .addModel("gemini", "Google Gemini 2.5 Flash Lite")
  .addModel("claude", "Anthopic Claude 3.5 Haiku");

export async function setupUIHandlers() {
  // Get UI Elements
  elements = getUIElements();
  setupToneHandlers(elements);

  // === Model selection UI handling ===
  const modelSelectorContainer = document.getElementById('modelSelectorContainer');
  const pollinationsModelSelect = document.getElementById('pollinationsModel');
  const reasoningCheckbox = document.getElementById('includeReasoning');

  const POLLINATIONS_MODELS = modelManager.getModels();
  
  // Update populateSelect call
  if (pollinationsModelSelect) {
    modelManager.populateSelect(pollinationsModelSelect);
    pollinationsModelSelect.value = "websim";
  }

  pollinationsModelSelect.addEventListener('change', () => {
    const selectedModelName = pollinationsModelSelect.value;
    const selectedModel = modelManager.getModelByName(selectedModelName);
    const reasoningLabel = reasoningCheckbox.labels[0];
  
    if (selectedModel && selectedModel.reasoning) {
      reasoningCheckbox.checked = false;
      reasoningCheckbox.disabled = true;
      reasoningCheckbox.parentElement.classList.add('disabled-option');
      reasoningCheckbox.title = "This model has built-in reasoning capabilities, so this option is not applicable.";
      if (reasoningLabel) {
        reasoningLabel.title = reasoningCheckbox.title;
      }
    } else {
      reasoningCheckbox.disabled = false;
      reasoningCheckbox.parentElement.classList.remove('disabled-option');
      reasoningCheckbox.title = "Enable a detailed, step-by-step reasoning process in the AI's response (beta feature).";
      if (reasoningLabel) {
        reasoningLabel.title = reasoningCheckbox.title;
      }
    }
  });

  // Event listener for the checkbox itself, to inform users
  reasoningCheckbox.addEventListener('change', (event) => {
    if (event.target.checked && event.target.disabled) {
      event.target.checked = false; // Prevent checking if disabled
      alert("Selected AI model includes reasoning by default. This option is not needed.");
    }
  });

  // Trigger initial change to set correct state on load
  pollinationsModelSelect.dispatchEvent(new Event('change'));

  // The model selector should always be visible now if present.
  if (modelSelectorContainer) {
    modelSelectorContainer.classList.remove('hidden');
  }
  elements.pollinationsModel = pollinationsModelSelect;
  elements.POLLINATIONS_MODELS = POLLINATIONS_MODELS;

  // Sidebar handler setup
  const sidebar = document.querySelector('.sidebar');
  const sidebarToggle = document.querySelector('.sidebar-toggle');
  const container = document.querySelector('.container');
  const btns = document.querySelectorAll('.tab-button');
  const contents = document.querySelectorAll('.tab-content');

  toggleOffAllSidebarContents(btns, contents);
  let lastActiveTabIndex = 0;
  function updateLastActiveTab() {
    const arr = Array.from(btns);
    lastActiveTabIndex = arr.findIndex(b => b.classList.contains('active')) || btns[0];
    if (lastActiveTabIndex === -1) lastActiveTabIndex = 0;
  }

  sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('expanded');
    container.classList.toggle('sidebar-expanded');
    const expanded = sidebar.classList.contains('expanded');
    toggleSidebar(btns, contents, expanded);
    if (expanded) {
      // Restore last active tab
      const arr = Array.from(btns);
      const buttonToClick = arr[lastActiveTabIndex] || arr[0];
      if (buttonToClick) buttonToClick.click();
    }
  });

  // Suggestion Modal Logic with localStorage
  const suggestionModal = document.getElementById('suggestion-modal');
  const suggestionModalCloseBtn = document.getElementById('suggestion-modal-close');
  const SUGGESTION_MODAL_KEY = 'suggestion_modal_dismissed';

  // Initialize modal visibility from localStorage
  let isModalDismissed = localStorage.getItem(SUGGESTION_MODAL_KEY) === 'true';
  
  if (isModalDismissed) {
    suggestionModal.classList.add('hidden');
  }

  // Handle closing the modal
  if (suggestionModalCloseBtn) {
    suggestionModalCloseBtn.addEventListener('click', async () => {
      // Set dismissed flag in localStorage
      localStorage.setItem(SUGGESTION_MODAL_KEY, 'true');
      isModalDismissed = true;
      
      // Hide the modal
      suggestionModal.classList.add('hidden');
    });
  }

  // Setup tab handlers
  btns.forEach((button, idx) => {
    button.addEventListener('click', async () => {
      toggleTab(button, btns, contents);
      lastActiveTabIndex = idx;

      // Check if we should show the modal
      if (button.dataset.tab === 'suggestion-added') {
        // Only show if user hasn't dismissed before
        if (!isModalDismissed) {
          suggestionModal.classList.remove('hidden');
        }
      }
    });
  });

  // Mode button handlers
  document.querySelectorAll('.mode-button').forEach(button => {
    button.addEventListener('click', () => {
      handleModeChange(button.dataset.mode, elements);
    });
  });

  // Execute button handler
  elements.execute.addEventListener('click', () => handleExecute(elements));

  // Keyboard shortcut (Ctrl+Enter)
  elements.description.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      elements.execute.click();
    }
  });

  // Initial mode setup
  handleModeChange('generator', elements);

  // Set initial active tab
  const arrBtns = Array.from(btns);
  const initTab = arrBtns.find(b => b.classList.contains('active')) || arrBtns[0];
  if (initTab) initTab.click();
  updateLastActiveTab();
}