import hljs from 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/es/highlight.min.js';
import { getHighlightJsLang, escapeHtml } from './output-utils.js';
import { addCopyButton, addRunButtonForCodeBlock, addReasoningButton } from './output-ui.js';

// Main function to display results, modified to use imported helpers
export function displayResult(result, language, modeKey, elements, includeExplanation = false) {
  // Clear previous output
  elements.output.innerHTML = '';

  // Extract reasoning content: PRIORITIZE result.reasoning first if it's part of the JSON output.
  // Otherwise, fall back to window.outputResult's reasoning_content (for native reasoning models).
  let reasoningContent = result.reasoning || window.outputResult?.choices?.[0]?.message?.reasoning_content;

  if (modeKey === 'roaster') {
    if (typeof result === 'object' && result.roast) {
      elements.output.innerHTML = result.roast;
    } else {
      elements.output.innerHTML = `<p style="color: #ef4444;">Error: Invalid response from AI roaster.</p>`;
      console.error("Invalid roast result:", result);
    }
    // Add reasoning button for roaster mode if content exists
    if (reasoningContent) {
      addReasoningButton(elements.output, reasoningContent);
    }
    return;
  }

  if (modeKey === 'generator') {
    // Expecting result to be the JSON object { code: "...", explanation?: "..." }
    if (typeof result === 'object' && (result.code || result.codes)) {
      let codeBlocksToDisplay = [];

      if (result.codes && Array.isArray(result.codes)) { // Handle multiple codes mode
        codeBlocksToDisplay = result.codes.map((code, index) => ({
          heading: `Solution ${index + 1}:`,
          code: code,
          language: language.includes("html_css_javascript") ? "html" : language, // Assume language is consistent
          rawCode: language.includes("html_css_javascript") ? code : null // Store raw for HTML run button
        }));
      } else if (result.code) { // Handle single code modes
         codeBlocksToDisplay = [{
           heading: null, // No separate heading for single code unless needed
           code: result.code,
           language: language.includes("html_css_javascript") ? "html" : language,
           rawCode: language.includes("html_css_javascript") ? result.code : null
         }];
      } else {
         // Should not happen based on codegen logic, but as a fallback
          elements.output.innerHTML = `<p style="color: #ef4444;">Error: AI returned empty code/codes in generator mode.</p>`;
          console.error("AI returned empty code/codes:", result);
          return;
      }

      codeBlocksToDisplay.forEach(block => {
          if (block.heading) {
              const headingEl = document.createElement('h3');
              headingEl.textContent = block.heading;
              elements.output.appendChild(headingEl);
          }

          const preEl = document.createElement('pre');
          const codeEl = document.createElement('code');
          codeEl.className = `language-${block.language}`;
          // Use textContent to avoid rendering HTML within the code block
          codeEl.textContent = block.code;

          preEl.appendChild(codeEl);
          elements.output.appendChild(preEl);

          // Add raw code attribute for HTML run button if applicable
          if (block.rawCode !== null) {
            preEl.setAttribute('data-raw-code', encodeURIComponent(block.rawCode));
          }

          hljs.highlightElement(codeEl);
          addCopyButton(preEl, block.code);

          // Check if the code *itself* is HTML for the run button
          if (block.language === "html" || (block.language === "html_css_javascript" && block.rawCode !== null) || block.language === "python") {
            addRunButtonForCodeBlock(preEl, block.rawCode || block.code, block.language); // Use rawCode if available, otherwise code
          }
      });


      // Display explanation if included and available
      if (includeExplanation && result.explanation && typeof result.explanation === 'string') {
        const explanationDiv = document.createElement('div');
        explanationDiv.innerHTML = `<h2>Explanation</h2>${result.explanation}`;
        elements.output.appendChild(explanationDiv);
      }

    } else {
      // Fallback for unexpected result format
      elements.output.innerHTML = `<p style="color: #ef4444;">Error: Unexpected response format from AI.</p><pre>${escapeHtml(JSON.stringify(result, null, 2))}</pre>`;

    }
  } else if (modeKey === 'converter') {
    // Properly handle converter mode output
    const codeContent = result.code || '';
    const targetLang = language; // 'language' parameter now contains the target language
    // Escape HTML only if the target language is HTML
    const escapedCode = targetLang.includes("html") ? escapeHtml(codeContent) : codeContent;

    let codeHtml = `<pre><code class="language-${targetLang}">${escapedCode}</code></pre>`;

    let finalHtml = '';

    // Add the code block HTML
    finalHtml += `<h3>Converted Code</h3>${codeHtml}`; // Add a heading for the code

    // Add explanation if requested and available (placed after the code)
    if (includeExplanation && result.explanation) {
      finalHtml += `
        <h3>Explanation</h3>
        ${result.explanation}
      `;
    }

    elements.output.innerHTML = finalHtml; // Set the entire content at once

    // Add data-raw-code and run button *after* setting innerHTML so elements exist
    const codePreEl = elements.output.querySelector(`pre code.language-${targetLang}`)?.parentElement;

    if (codePreEl) {
        // Add data-raw-code for the run button if target is HTML
        if (targetLang.includes("html")) {
            codePreEl.setAttribute('data-raw-code', encodeURIComponent(codeContent));
        }

        // Highlight the code block
        // hljs.highlightElement(codePreEl.querySelector('code')); // highlightAll is called next anyway

        // Add copy button to the code block
        addCopyButton(codePreEl, codeContent);

        // Add run button for HTML code blocks
        if (targetLang.includes("html") || targetLang.includes("python")) {
            addRunButtonForCodeBlock(codePreEl, codeContent, targetLang); // Use the function that puts the button inside the pre
        }
    } else {
        console.error("Could not find converted code <pre> element for highlighting/copy/run.");
        // Fallback: just show the raw result if we can't find the code block
         elements.output.innerHTML += `<p style="color: #ef4444;">Could not process code block for highlighting/copy/run. Raw result:</p><pre>${escapeHtml(JSON.stringify(result, null, 2))}</pre>`;
    }

    // Highlight the code block(s) that were just added
    hljs.highlightAll();


  } else { // Handles Explainer, Reviewer, Commenter, Optimizer, Debugger
    elements.output.innerHTML = ''; // Clear output

    let summaryHtml = '';
    let codeContent = '';
    let codeHeading = '';
    const blockLanguage = getHighlightJsLang(language);

    // Unify getting the data from different mode results
    if (modeKey === 'explainer') {
      summaryHtml = result.explanation; // This is supposed to be HTML
    } else if (modeKey === 'reviewer') {
      summaryHtml = result.review; // HTML
      codeContent = result.improved_code;
      codeHeading = 'Improved Version';
    } else if (modeKey === 'commenter') {
      summaryHtml = result.summary; // HTML
      codeContent = result.commentedCode;
      codeHeading = 'Commented Code';
    } else if (modeKey === 'optimizer') {
      summaryHtml = result.summary; // HTML
      codeContent = result.optimizedCode;
      codeHeading = 'Optimized Code';
    } else if (modeKey === 'debugger') {
      summaryHtml = result.debugReport; // HTML
      codeContent = result.fixedCode;
      codeHeading = 'Fixed Code';
    }

    // Append summary HTML (AI is prompted to provide HTML, so this is expected)
    if (summaryHtml) {
        const summaryDiv = document.createElement('div');
        summaryDiv.innerHTML = summaryHtml; 
        elements.output.appendChild(summaryDiv);
    }

    // Append the main code block if it exists
    if (codeContent) {
        const headingEl = document.createElement('h3');
        headingEl.textContent = codeHeading;
        elements.output.appendChild(headingEl);

        const preEl = document.createElement('pre');
        const codeEl = document.createElement('code');
        
        codeEl.className = `language-${blockLanguage}`;
        
        // Use textContent to safely insert code, prevent XSS, and allow hljs to work correctly.
        codeEl.textContent = codeContent;

        preEl.appendChild(codeEl);
        elements.output.appendChild(preEl);

        hljs.highlightElement(codeEl);
        addCopyButton(preEl, codeContent);

        if (blockLanguage.includes("html") || blockLanguage.includes("python")) {
            addRunButtonForCodeBlock(preEl, codeContent, blockLanguage);
        }
    }
    
    // Special handling for reviewer score
    if (modeKey === 'reviewer' && typeof result.score === 'number') {
        const scoreClass = result.score >= 7 ? 'high' : result.score >= 4 ? 'medium' : 'low';
        const scoreDiv = document.createElement('div');
        scoreDiv.className = `score ${scoreClass}`;
        scoreDiv.textContent = `Score: ${result.score}/10`;
        elements.output.appendChild(scoreDiv);
    }
    
    // The summaryHTML might ALSO contain <pre><code> blocks from the AI.
    // Find any code blocks that were not the primary one we just added and process them.
    const otherCodeBlocks = elements.output.querySelectorAll('pre code');
    otherCodeBlocks.forEach((codeBlock) => {
        // If the code block's parent <pre> is a direct child of .output, we already processed it.
        if (codeBlock.parentElement.parentElement === elements.output) {
            return;
        }
        hljs.highlightElement(codeBlock);
        const preBlock = codeBlock.parentElement;
        const rawCode = codeBlock.textContent;
        addCopyButton(preBlock, rawCode);
        
        const blockLanguageClass = Array.from(codeBlock.classList).find(cls => cls.startsWith('language-'));
        const foundLang = blockLanguageClass ? blockLanguageClass.replace('language-', '') : '';
        if (foundLang.includes("html") || foundLang.includes("python")) {
            addRunButtonForCodeBlock(preBlock, rawCode, foundLang);
        }
    });
  }

  // Add reasoning button if reasoning content exists (applies to all modes)
  if (reasoningContent) {
    addReasoningButton(elements.output, reasoningContent);
  }
}