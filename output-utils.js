// Helper function to map language names to highlight.js-compatible names
export function getHighlightJsLang(lang) {
  const langMap = {
    'c++': 'cpp',
    'c#': 'csharp',
    'html_css_javascript_all_in_one_file': 'html'
  };
  const lowerLang = lang.toLowerCase();
  return langMap[lowerLang] || lowerLang;
}

// Escape HTML for safe rendering
export function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}