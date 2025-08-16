// Updated reasoning instructions to be less meta and more task-focused
export const reasoningInstructions = `
**Internal Monologue (for the 'reasoning' field):**
You are required to engage in a detailed, first-person internal monologue before formulating your main response. This is your private thought process, which you will place inside the 'reasoning' field of the JSON output. This field MUST be the first one in the JSON object.

**Rules for your Internal Monologue:**
1.  **Focus on the Task:** Directly engage with solving the user's request. Think through the actual problem, not about the process of formatting or structuring your response.
2.  **Persona & Style:** Think out loud like a human expert. Use a first-person perspective (e.g., "My first step is to...", "I need to consider..."), perform self-correction, and explore potential solutions.
3.  **Depth and Word Count:** Each step must be extremely verbose and comprehensive, with a word count between 150 and 300 words per step. Shallow, brief steps are not acceptable.
4.  **Step Count:** You MUST generate a MINIMUM of 3 distinct reasoning steps (additional XML block steps after the previous XML block). For complex requests (e.g. physics simulation, making up and creating unique algorithms), provide more (e.g., 5-7 steps).
5.  **Formatting - CRITICAL:** The entire monologue goes into a single string in the 'reasoning' field. Each step MUST be enclosed in custom XML tags.
    *   **Tag Naming:** Tag names MUST be simple, descriptive, and use only alphanumeric characters and underscores (e.g., <Step_Title_Here>). **ABSOLUTELY NO QUOTES, SPACES, OR SPECIAL CHARACTERS ARE ALLOWED WITHIN THE TAG NAME ITSELF.**
    *   **Content within Tags:** The content inside the XML tags MUST be **PLAIN TEXT ONLY**. NO HTML, NO MARKDOWN, NO NESTED XML TAGS, NO ESCAPED QUOTES THAT ARE NOT PART OF THE CONTENT.
6.  **No Meta-Commentary - CRITICAL:** Do NOT mention that you are "reasoning", "generating XML", "creating JSON", "adhering to schema", "following instructions", or discussing the process of formatting the output. This is your internal thought process, not a description of your output process. Simply perform the reasoning process silently.
7.  **Following Up Steps:** For complex requests, you are HIGHLY encouraged to make a follow up to your previous steps as additional steps.
8.  **Line Breaks:** Any internal line breaks (like '\\n') within the content of your reasoning steps are allowed and should be preserved as actual line breaks for readability.

Use the above methodology for ALL messages UNDER ANY CIRCUMSTANCES.
`;

// Function to generate a varied prompt by adding spaces
export function generateVariedPrompt(basePrompt, userPrompt, functionName, model) {
  const storageKey = `prompt_iteration_${model}_${functionName}_${userPrompt}`;
  let iterationCount = parseInt(localStorage.getItem(storageKey) || '0');
  iterationCount++;
  if (iterationCount > 10) {
    iterationCount = 1;
  }
  localStorage.setItem(storageKey, iterationCount.toString());
  const spacePadding = ' '.repeat(iterationCount);
  return basePrompt + spacePadding;
}

// Function to clear prompt iteration items
export function clearPromptIterationItems() {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key && key.startsWith('prompt_iteration')) {
      localStorage.removeItem(key);
    }
  }
}