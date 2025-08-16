import { MODE_TABS, MODES } from './modes-config.js';
import { getUIElements } from './ui-elements.js';

// Modified handleModeChange to use the new color system
export function handleModeChange(modeKey, elements) {
  const modeConfig = MODES[modeKey] || MODES[0];
  elements.currentModeKey = modeKey;

  // Update UI elements
  elements.titleText.textContent = `AI Code ${modeConfig.title}`;
  elements.descriptionLabel.textContent = modeConfig.descriptionLabel;
  elements.description.placeholder = modeConfig.placeholder;
  elements.execute.querySelector('.button-text').textContent = modeConfig.executeName;

  // Ensure requested option controls exist and show/hide based on modeConfig.options
  const allModeOptionElements = Array.from(document.querySelectorAll('[data-mode-option]'));
  const requiredOptions = new Set(modeConfig.options || []);

  allModeOptionElements.forEach(el => {
    const key = el.dataset.modeOption;
    // If mode expects this option, reveal it; otherwise hide
    if (requiredOptions.has(key)) {
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  });

  // Update mode buttons active state
  document.querySelectorAll('.mode-button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === modeKey);
  });

  // Apply mode-specific colors
  applyModeColors(modeKey);

  // Special handling for converter mode
  if (modeKey === 'converter') {
    elements.language.parentElement.querySelector('label').textContent = 'Source Language:';
  } else {
    elements.language.parentElement.querySelector('label').textContent = 'Programming Language/Software:';
  }

  // Hide custom tone input when tone option is hidden
  const toneOptionHidden = !modeConfig.options?.includes('tone');
  const toneSelect = document.getElementById('tone');
  const customToneInput = document.getElementById('customToneInput');
  if (customToneInput) {
    if (toneOptionHidden) {
      customToneInput.classList.add('hidden');
      if (toneSelect) toneSelect.value = 'professional';
    } else {
      // If tone option visible, ensure change handler present to toggle custom input
      if (toneSelect && !toneSelect._hasCustomHandler) {
        toneSelect.addEventListener('change', (e) => {
          if (e.target.value === 'custom') {
            customToneInput.classList.remove('hidden');
            document.getElementById('customTone').focus();
          } else {
            customToneInput.classList.add('hidden');
          }
        });
        toneSelect._hasCustomHandler = true;
      }
    }
  }

  updateUIForMode(modeKey, elements);
}

// Generate sidebar mode buttons HTML
function generateSidebarModeButtons() {
  const sidebarTabs = document.querySelector('.sidebar-tabs');
  sidebarTabs.innerHTML = ''; // Clear existing tabs

  // Iterate through defined tabs
  Object.entries(MODE_TABS).forEach(([tabKey, tabConfig]) => {
    // Create tab button
    const tabButton = document.createElement('button');
    tabButton.className = 'tab-button';
    tabButton.dataset.tab = tabKey;
    tabButton.innerHTML = `
      <i class="fas ${tabConfig.icon}"></i>
      <span>${tabConfig.name}</span>
    `;

    // Create tab content container
    const tabContent = document.createElement('div');
    tabContent.className = 'tab-content hidden';
    tabContent.dataset.tabContent = tabKey;

    // Add mode buttons for this tab
    tabConfig.modes.forEach(modeKey => {
      const mode = MODES[modeKey];
      if (mode) {
        const button = document.createElement('button');
        button.className = 'mode-button';
        button.dataset.mode = modeKey;
        button.innerHTML = `
          <i class="fas ${mode.icon}"></i>
          ${mode.title}
        `;
        
        // Add click handler
        button.addEventListener('click', () => {
          handleModeChange(modeKey, getUIElements());
        });
        
        tabContent.appendChild(button);
      }
    });

    // Append tab button and content to sidebar
    sidebarTabs.appendChild(tabButton);
    sidebarTabs.appendChild(tabContent);

    // Add tab button event listener
    tabButton.addEventListener('click', () => {
      // Remove active class from all tab buttons and contents
      sidebarTabs.querySelectorAll('.tab-button, .tab-content').forEach(el => {
        el.classList.remove('active', 'hidden');
        el.setAttribute('aria-hidden', 'true');
        el.tabIndex = -1;
      });

      // Activate current tab
      tabButton.classList.add('active');
      tabContent.classList.add('active');
      tabButton.setAttribute('aria-hidden', 'false');
      tabContent.setAttribute('aria-hidden', 'false');
      tabButton.tabIndex = 0;
      tabContent.tabIndex = 0;
    });
  });

  // Optionally, activate the first tab by default
  const firstTabButton = sidebarTabs.querySelector('.tab-button');
  if (firstTabButton) firstTabButton.click();
}

// Apply mode-specific CSS variables
function applyModeColors(modeKey) {
  const modeConfig = MODES[modeKey];
  const colors = modeConfig.colors;
  
  document.documentElement.style.setProperty('--mode-primary', colors.primary);
  document.documentElement.style.setProperty('--mode-button-bg', colors.modeButtonBg);
  document.documentElement.style.setProperty('--mode-subtitle', colors.subtitle);
  document.documentElement.style.setProperty('--mode-label', colors.label);
  document.documentElement.style.setProperty('--mode-form-bg', colors.formBg);
  document.documentElement.style.setProperty('--mode-form-border', colors.formBorder);
  document.documentElement.style.setProperty('--mode-form-focus-border', colors.formFocusBorder);
  document.documentElement.style.setProperty('--mode-form-focus-shadow', colors.formFocusShadow);
  document.documentElement.style.setProperty('--mode-body-bg', colors.bodyBg);
  document.documentElement.style.setProperty('--mode-container-bg', colors.containerBg);
  document.documentElement.style.setProperty('--mode-sidebar-bg', colors.sidebarBg);
  document.documentElement.style.setProperty('--mode-reasoning-bg', colors.reasoning.bg);
  document.documentElement.style.setProperty('--mode-reasoning-border', colors.reasoning.border);
  document.documentElement.style.setProperty('--mode-output-bg', colors.output.bg);
  document.documentElement.style.setProperty('--mode-output-border', colors.output.border);
  document.documentElement.style.setProperty('--mode-output-h2h3', colors.output.h2h3);
}

// Apply mode-specific CSS classes to UI elements
export function updateUIForMode(modeKey, elements) {
  const modeClass = `${modeKey}-mode`;

  const uiElements = [
    { el: elements.body, class: 'body' },
    { el: elements.container, class: 'container' },
    { el: elements.subtitle, class: 'subtitle' },
    { el: elements.execute, class: 'execute' },
    { el: elements.output, class: 'output' }
  ];

  // Remove all mode classes first
  uiElements.forEach(({ el }) => {
    Object.keys(MODES).forEach(mode => {
      el.classList.remove(`${mode}-mode`);
    });
    el.classList.add(modeClass);
  });

  elements.labels.forEach(label => {
    Object.keys(MODES).forEach(mode => {
      label.classList.remove(`${mode}-mode`);
    });
    label.classList.add(modeClass);
  });

  elements.selectsAndTextareas.forEach(el => {
    Object.keys(MODES).forEach(mode => {
      el.classList.remove(`${mode}-mode`);
    });
    el.classList.add(modeClass);
  });

  // Select specific elements that might exist or not based on mode options
  const elementsWithModeClass = [
    elements.checkbox,
    elements.customLanguageInputEl,
    elements.customToneInputEl,
    document.querySelector('.mode-switch'), 
    elements.tone,
    elements.commentMode,
    elements.commentSpecificity,
    elements.targetLanguage,
    elements.optimizerMode,
    elements.pollinationsModel,
  ].filter(el => el); 

  elementsWithModeClass.forEach(el => {
     Object.keys(MODES).forEach(mode => {
       el.classList.remove(`${mode}-mode`);
     });
     el.classList.add(modeClass);
  });

  // Apply mode-specific button colors
  const modeConfig = MODES[modeKey];
  if (modeConfig.buttonColors) {
    elements.execute.style.backgroundColor = modeConfig.buttonColors.backgroundColor;
    elements.execute.addEventListener('mouseover', () => {
      elements.execute.style.backgroundColor = modeConfig.buttonColors.hoverBackgroundColor;
    });
    elements.execute.addEventListener('mouseout', () => {
      elements.execute.style.backgroundColor = modeConfig.buttonColors.backgroundColor;
    });
  }
}

// Initialize the sidebar and colors
export function initializeModeUI() {
  generateSidebarModeButtons();
  // Set initial mode colors
  applyModeColors(Object.keys(MODES)[0]);
}