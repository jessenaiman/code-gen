// Centralizes UI element references
// New: ensureOptionExists will create common option controls on demand inside #modeOptionsContainer
export function ensureOptionExists(optionName) {
  const container = document.getElementById('modeOptionsContainer');
  if (!container) return null;

  // If element already exists, return it
  let existing = container.querySelector(`[data-mode-option="${optionName}"]`);
  if (existing) return existing;

  // Templates for known option controls
  const templates = {
    tone: () => {
      const wrapper = document.createElement('div');
      wrapper.dataset.modeOption = 'tone';
      wrapper.className = 'input-group hidden';
      wrapper.innerHTML = `
        <label for="tone">Select Tone:</label>
        <select id="tone">
          <option value="professional">Default (Professional)</option>
          <option value="helpful">Helpful</option>
          <option value="direct">Direct</option>
          <option value="formal">Formal</option>
          <option value="technical">Technical</option>
          <option value="custom">+ Custom Tone</option>
        </select>
        <div id="customToneInput" class="custom-language-input hidden">
          <input type="text" id="customTone" placeholder="Enter custom tone">
        </div>
      `;
      return wrapper;
    },
    model: () => {
      const wrapper = document.createElement('div');
      wrapper.dataset.modeOption = 'model';
      wrapper.className = 'input-group hidden';
      wrapper.id = 'modelSelectorContainer';
      wrapper.innerHTML = `
        <label for="pollinationsModel">AI Model:</label>
        <select id="pollinationsModel"></select>
      `;
      return wrapper;
    },
    reasoning: () => {
      const wrapper = document.createElement('div');
      wrapper.dataset.modeOption = 'reasoning';
      wrapper.className = 'checkbox-group hidden';
      wrapper.innerHTML = `
        <input type="checkbox" id="includeReasoning">
        <label for="includeReasoning" title="Enable a detailed, step-by-step reasoning process in the AI's response for better results (beta feature).">Beta Feature: Enable detailed reasoning (for non-reasoning models)</label>
      `;
      return wrapper;
    },
    mode: () => {
      const wrapper = document.createElement('div');
      wrapper.dataset.modeOption = 'mode';
      wrapper.className = 'input-group hidden';
      wrapper.innerHTML = `
        <label for="mode">Generator Mode:</label>
        <select id="mode">
          <option value="single">Generate Code</option>
          <option value="multiple">Generate 3 Distinct Codes</option>
          <option value="fullyimplemented">Generate Code (No example implementations, not lazy)</option>
          <option value="shortest">Generate Code (Shortest possible)</option>
          <option value="complete">Generate Code (Nothing omitted, recommended for copy-pasting)</option>
        </select>
      `;
      return wrapper;
    },
    includeExplanation: () => {
      const wrapper = document.createElement('div');
      wrapper.dataset.modeOption = 'includeExplanation';
      wrapper.className = 'checkbox-group hidden';
      wrapper.innerHTML = `
        <input type="checkbox" id="includeExplanation">
        <label for="includeExplanation">Include explanation with generated code</label>
      `;
      return wrapper;
    },
    commentMode: () => {
      const wrapper = document.createElement('div');
      wrapper.dataset.modeOption = 'commentMode';
      wrapper.className = 'input-group hidden';
      wrapper.innerHTML = `
        <label for="commentMode">Comment Mode:</label>
        <select id="commentMode">
          <option value="everywhere">Add comments everywhere</option>
          <option value="necessary">Add comments where necessary</option>
          <option value="definitions">Add comments at definition of classes/methods</option>
        </select>
      `;
      return wrapper;
    },
    commentSpecificity: () => {
      const wrapper = document.createElement('div');
      wrapper.dataset.modeOption = 'commentSpecificity';
      wrapper.className = 'input-group hidden';
      wrapper.innerHTML = `
        <label for="commentSpecificity">Comment Specificity:</label>
        <select id="commentSpecificity">
          <option value="concise">Concise</option>
          <option value="brief">Brief</option>
          <option value="somewhat">Somewhat specific</option>
          <option value="very">Very Specific</option>
        </select>
      `;
      return wrapper;
    },
    optimizerMode: () => {
      const wrapper = document.createElement('div');
      wrapper.dataset.modeOption = 'optimizerMode';
      wrapper.className = 'input-group hidden';
      wrapper.innerHTML = `
        <label for="optimizerMode">Optimization Mode:</label>
        <select id="optimizerMode">
          <option value="optimize">Optimize Code</option>
          <option value="readability">Optimize Code and Improve readability</option>
          <option value="comprehensive">Optimize all lines of code</option>
        </select>
      `;
      return wrapper;
    },
    roastLevel: () => {
      const wrapper = document.createElement('div');
      wrapper.dataset.modeOption = 'roastLevel';
      wrapper.className = 'input-group hidden';
      wrapper.innerHTML = `
        <label for="roastLevel">Roast Level:</label>
        <select id="roastLevel">
          <option value="minimal">Minimal (Professional)</option>
          <option value="necessary">Necessary (Targeted)</option>
          <option value="extreme">Extreme (Savage Mode)</option>
        </select>
      `;
      return wrapper;
    }
  };

  if (templates[optionName]) {
    const node = templates[optionName]();
    container.appendChild(node);
    return node;
  }

  // Fallback: create a text input wrapper if unknown option requested
  const fallback = document.createElement('div');
  fallback.dataset.modeOption = optionName;
  fallback.className = 'input-group hidden';
  fallback.innerHTML = `
    <label for="${optionName}">${optionName}:</label>
    <input type="text" id="${optionName}" placeholder="${optionName}">
  `;
  container.appendChild(fallback);
  return fallback;
}

// Modified getUIElements to call ensureOptionExists for common options and return references
export function getUIElements() {
  // Ensure primary option elements exist (created lazily if missing)
  ensureOptionExists('tone');
  ensureOptionExists('model');
  ensureOptionExists('reasoning');
  ensureOptionExists('mode');
  ensureOptionExists('includeExplanation');
  ensureOptionExists('commentMode');
  ensureOptionExists('commentSpecificity');
  ensureOptionExists('optimizerMode');
  ensureOptionExists('roastLevel');

  return {
    execute: document.getElementById('execute'),
    output: document.getElementById('output'),
    language: document.getElementById('language'),
    description: document.getElementById('description'),
    tone: document.getElementById('tone'),
    mode: document.getElementById('mode'), 
    includeExplanation: document.getElementById('includeExplanation'),
    includeReasoning: document.getElementById('includeReasoning'),
    titleText: document.getElementById('titleText'),
    descriptionLabel: document.getElementById('descriptionLabel'),
    commentMode: document.getElementById('commentMode'),
    commentSpecificity: document.getElementById('commentSpecificity'),
    body: document.body,
    container: document.querySelector('.container'),
    subtitle: document.querySelector('.subtitle'),
    labels: document.querySelectorAll('label'),
    selectsAndTextareas: document.querySelectorAll('select, textarea'),
    checkbox: document.querySelector('.checkbox-group input[type="checkbox"]'),
    customLanguageInputEl: document.querySelector('.custom-language-input input'),
    copyButton: document.querySelector('.copy-button'),
    customToneInputEl: document.querySelector('#customToneInput input'),
    targetLanguage: document.getElementById('targetLanguage'),
    optimizerMode: document.getElementById('optimizerMode'),
    pollinationsModel: document.getElementById('pollinationsModel'),
    currentModeKey: null,
    resolvedTone: null,
  };
}

// Handles custom tone input logic
export function setupToneHandlers(elements) {
  const toneSelect = elements.tone;
  const customToneInput = document.getElementById('customToneInput');
  const customToneField = document.getElementById('customTone');

  if (toneSelect) { 
    toneSelect.addEventListener('change', (e) => {
      if (e.target.value === 'custom') {
        customToneInput.classList.remove('hidden');
        customToneField.focus();
      } else {
        customToneInput.classList.add('hidden');
      }
    });
  }
}