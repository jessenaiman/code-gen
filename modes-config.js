import { generateCode, explainCode, reviewCode, commentCode, convertCode, optimizeCode, debugCode, roastCode } from './codegen.js';

export const MODE_TABS = {
  code: {
    name: 'Code Tools',
    icon: 'fa-code',
    modes: ['generator', 'commenter', 'converter', 'optimizer']
  },
  'code-analyzers': {
    name: 'Code Analyzers',
    icon: 'fa-chart-line',
    modes: ['explainer', 'reviewer', 'debugger']
  },
  'suggestion-added': {
    name: 'Suggestions',
    icon: 'fa-comment-dots',
    modes: ['roaster']
  }
};

// Helper function to get colors from an existing mode
function getExistingModeColors(existingMode) {
  if (!MODES[existingMode]) {
    console.error(`Mode "${existingMode}" not found for color inheritance.`);
    return null;
  }
  return { mainColors: MODES[existingMode].colors, buttonColors: MODES[existingMode].buttonColors };
}

export const MODES = {
  generator: {
    title: "Generator",
    executeName: "Generate",
    loadingText: "Generating code",
    icon: "fa-wand-magic-sparkles",
    handler: generateCode,
    options: ['mode', 'includeExplanation'],
    tab: 'code', 
    parameters: (elements) => ([
      elements.language.value,
      elements.description.value,
      (elements.resolvedTone || (elements.tone && elements.tone.value) || 'professional'),
      document.getElementById('mode').value,
      elements.includeExplanation.checked,
      elements.pollinationsModel ? elements.pollinationsModel.value : "openai"
    ]),
    descriptionLabel: "Description of Code to Generate/Modify:",
    placeholder: "Describe what you want the code to do...",
    colors: {
      primary: '#60a5fa',
      modeButtonBg: 'rgba(96, 165, 250, 0.2)',
      subtitle: '#60a5fa',
      label: '#a7bde9',
      formBg: '#0f172a',
      formBorder: '#334155',
      formFocusBorder: '#60a5fa',
      formFocusShadow: 'rgba(96, 165, 250, 0.2)',
      bodyBg: '#0f172a',
      containerBg: '#1e293b',
      sidebarBg: '#1a2234',
      reasoning: {
        bg: '#0f172a',
        border: '#334155'
      },
      output: {
        bg: '#0f172a',
        border: '#334155',
        h2h3: '#60a5fa'
      }
    },
    buttonColors: {
      backgroundColor: '#60a5fa',
      hoverBackgroundColor: '#3b82f6',
    }
  },
  explainer: {
    title: "Explainer",
    executeName: "Analyze", 
    loadingText: "Analyzing code",
    icon: "fa-book",
    handler: explainCode,
    tab: 'code-analyzers', // Moved to new tab
    parameters: (elements) => ([
      elements.language.value,
      elements.description.value,
      (elements.resolvedTone || (elements.tone && elements.tone.value) || 'professional'),
      elements.pollinationsModel ? elements.pollinationsModel.value : "openai"
    ]),
    descriptionLabel: "Code to explain:",
    placeholder: "Paste the code you want to explain...",
    colors: {
      primary: '#54d179',
      modeButtonBg: 'rgba(84, 209, 121, 0.2)',
      subtitle: '#54d179',
      label: '#a7e9bd',
      formBg: '#0a1a10',
      formBorder: '#2e4f3b',
      formFocusBorder: '#54d179',
      formFocusShadow: 'rgba(84, 209, 121, 0.2)',
      bodyBg: '#0a1a10',
      containerBg: '#152f20',
      sidebarBg: '#152f20',
      reasoning: {
        bg: '#0a1a10',
        border: '#2e4f3b'
      },
      output: {
        bg: '#0a1a10',
        border: '#2e4f3b',
        h2h3: '#54d179'
      }
    },
    buttonColors: {
      backgroundColor: '#54d179',
      hoverBackgroundColor: '#3bb061',
    }
  },
  reviewer: {
    title: "Reviewer",
    executeName: "Review",
    loadingText: "Reviewing code",
    icon: "fa-magnifying-glass",
    handler: reviewCode,
    tab: 'code-analyzers', // Moved to new tab
    parameters: (elements) => ([
      elements.language.value,
      elements.description.value,
      (elements.resolvedTone || (elements.tone && elements.tone.value) || 'professional'),
      elements.pollinationsModel ? elements.pollinationsModel.value : "openai"
    ]),
    descriptionLabel: "Code to review:",
    placeholder: "Paste the code you want to review...",
    colors: {
      primary: '#e254e2',
      modeButtonBg: 'rgba(226, 84, 226, 0.2)',
      subtitle: '#e254e2',
      label: '#e9a7e9',
      formBg: '#1a0f1a',
      formBorder: '#4f2e4f',
      formFocusBorder: '#e254e2',
      formFocusShadow: 'rgba(226, 84, 226, 0.2)',
      bodyBg: '#1a0f1a',
      containerBg: '#2f152f',
      sidebarBg: '#2f152f',
      reasoning: {
        bg: '#1a0f1a',
        border: '#4f2e4f'
      },
      output: {
        bg: '#1a0f1a',
        border: '#4f2e4f',
        h2h3: '#e254e2'
      }
    },
    buttonColors: {
      backgroundColor: '#e254e2',
      hoverBackgroundColor: '#c23bc2',
    }
  },
  commenter: {
    title: "Commenter",
    executeName: "Comment",
    loadingText: "Adding comments",
    icon: "fa-comment",
    handler: commentCode,
    options: ['commentMode', 'commentSpecificity'],
    tab: 'code',
    parameters: (elements) => ([
      elements.language.value,
      elements.description.value,
      elements.commentMode.value,
      elements.commentSpecificity.value,
      (elements.resolvedTone || (elements.tone && elements.tone.value) || 'professional'),
      elements.pollinationsModel ? elements.pollinationsModel.value : "openai"
    ]),
    descriptionLabel: "Code to comment:",
    placeholder: "Paste the code you want to comment...",
    colors: {
      primary: '#e25454',
      modeButtonBg: 'rgba(226, 84, 84, 0.2)',
      subtitle: '#e25454',
      label: '#e9a7a7',
      formBg: '#1a0f0f',
      formBorder: '#4f2e2e',
      formFocusBorder: '#e25454',
      formFocusShadow: 'rgba(226, 84, 84, 0.2)',
      bodyBg: '#1a0f0f',
      containerBg: '#2f1515',
      sidebarBg: '#2f1515',
      reasoning: {
        bg: '#1a0f0f',
        border: '#4f2e2e'
      },
      output: {
        bg: '#1a0f0f',
        border: '#4f2e2e',
        h2h3: '#e25454'
      }
    },
    buttonColors: {
      backgroundColor: '#e25454',
      hoverBackgroundColor: '#c23b3b',
    }
  },
  converter: {
    title: "Converter",
    executeName: "Convert",
    loadingText: "Converting code",
    icon: "fa-exchange",
    handler: convertCode,
    options: ['targetLanguage', 'includeExplanation'],
    tab: 'code',
    parameters: (elements) => ([
      elements.language.value,
      elements.targetLanguage.value,
      elements.description.value,
      elements.includeExplanation.checked,
      (elements.resolvedTone || (elements.tone && elements.tone.value) || 'professional'),
      elements.pollinationsModel ? elements.pollinationsModel.value : "openai"
    ]),
    descriptionLabel: "Code to convert:",
    placeholder: "Paste the code you want to convert...",
    colors: {
      primary: '#e2a254',
      modeButtonBg: 'rgba(226, 162, 84, 0.2)',
      subtitle: '#e2a254',
      label: '#e9bda7',
      formBg: '#1a0f0a',
      formBorder: '#4f2e2e',
      formFocusBorder: '#e2a254',
      formFocusShadow: 'rgba(226, 162, 84, 0.2)',
      bodyBg: '#1a0f0a',
      containerBg: '#2f1515',
      sidebarBg: '#2f1515',
      reasoning: {
        bg: '#1a0f0a',
        border: '#4f2e2e'
      },
      output: {
        bg: '#1a0f0a',
        border: '#4f2e2e',
        h2h3: '#e2a254'
      }
    },
    buttonColors: {
      backgroundColor: '#e2a254',
      hoverBackgroundColor: '#c28b3b',
    }
  },
  optimizer: {
    title: "Optimizer",
    executeName: "Optimize",
    loadingText: "Optimizing code",
    icon: "fa-rocket",
    handler: optimizeCode,
    options: ['optimizerMode'],
    tab: 'code',
    parameters: (elements) => ([
      elements.language.value,
      elements.description.value,
      elements.optimizerMode.value,
      (elements.resolvedTone || (elements.tone && elements.tone.value) || 'professional'),
      elements.pollinationsModel ? elements.pollinationsModel.value : "openai"
    ]),
    descriptionLabel: "Code to optimize:",
    placeholder: "Paste the code you want to optimize...",
    colors: {
      primary: '#5487e2',
      modeButtonBg: 'rgba(84, 135, 226, 0.2)',
      subtitle: '#5487e2',
      label: '#a7bde9',
      formBg: '#0a0f1a',
      formBorder: '#2e3b4f',
      formFocusBorder: '#5487e2',
      formFocusShadow: 'rgba(84, 135, 226, 0.2)',
      bodyBg: '#0a0f1a',
      containerBg: '#15202f',
      sidebarBg: '#15202f',
      reasoning: {
        bg: '#0a0f1a',
        border: '#2e3b4f'
      },
      output: {
        bg: '#0a0f1a',
        border: '#2e3b4f',
        h2h3: '#5487e2'
      }
    },
    buttonColors: {
      backgroundColor: '#5487e2',
      hoverBackgroundColor: '#3b6ac2',
    }
  },
  debugger: {
    title: "Debugger",
    executeName: "Debug",
    loadingText: "Analyzing code for issues",
    icon: "fa-bug",
    handler: debugCode,
    tab: 'code-analyzers', // Moved to new tab
    parameters: (elements) => ([
      elements.language.value,
      elements.description.value,
      (elements.resolvedTone || (elements.tone && elements.tone.value) || 'professional'),
      elements.pollinationsModel ? elements.pollinationsModel.value : "openai"
    ]),
    descriptionLabel: "Code to debug:",
    placeholder: "Paste the code you want to analyze for potential bugs...",
    colors: {
      primary: '#f0c14b', 
      modeButtonBg: 'rgba(240, 193, 75, 0.2)', 
      subtitle: '#f0c14b',
      label: '#e9d1a7', 
      formBg: '#1a1a0f', 
      formBorder: '#4f4f2e', 
      formFocusBorder: '#f0c14b',
      formFocusShadow: 'rgba(240, 193, 75, 0.2)',
      bodyBg: '#1a1a0f',
      containerBg: '#2f2f15', 
      sidebarBg: '#2f2f15',
      reasoning: {
        bg: '#1a1a0f',
        border: '#4f4f2e'
      },
      output: {
        bg: '#1a1a0f',
        border: '#4f4f2e',
        h2h3: '#f0c14b'
      }
    },
    buttonColors: {
      backgroundColor: '#f0c14b',
      hoverBackgroundColor: '#d4a940',
    }
  },

  // -- Suggestion-Added Modes -- //
  roaster: {
    title: "Roaster",
    executeName: "Roast",
    loadingText: "Analyzing code for roasting",
    icon: "fa-fire",
    handler: roastCode,
    options: ['roastLevel'],
    tab: 'suggestion-added',
    parameters: (elements) => ([
      elements.language.value,
      elements.description.value,
      document.getElementById('roastLevel').value,
      (elements.resolvedTone || (elements.tone && elements.tone.value) || 'professional'),
      elements.pollinationsModel ? elements.pollinationsModel.value : "openai"
    ]),
    descriptionLabel: "Code to Roast:",
    placeholder: "Paste the code you want brutally roasted...",
    
    // Reuse colors from commenter mode (red)
    existing: 'commenter',
  }
};

// Modify the code that accesses colors to handle the 'existing' property
Object.entries(MODES).forEach(([modeName, modeConfig]) => {
  if (modeConfig.existing && !modeConfig.colors) {
    const existingColors = getExistingModeColors(modeConfig.existing);
    if (existingColors) {
      MODES[modeName].colors = existingColors.mainColors;
      MODES[modeName].buttonColors = existingColors.buttonColors;
    }
  }
  // Ensure 'model', 'reasoning' and 'tone' options is always included
  if (!MODES[modeName].options) {
    MODES[modeName].options = ['tone', 'model'];
  }
  if (!MODES[modeName].options.includes('tone')) {
    MODES[modeName].options.push('tone');
  }
  if (!MODES[modeName].options.includes('model')) {
    MODES[modeName].options.push('model');
  }
  if (!MODES[modeName].options.includes('reasoning')) {
    MODES[modeName].options.push('reasoning');
  }
});

export const MODE_OPTIONS = Object.keys(MODES);