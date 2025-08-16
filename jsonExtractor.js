// Helper function: Filter ONLY the largest JSON object/array in a string (for crazy outputs)
export function extractLargestJson(rawContent) {
  // First, try a basic valid parse
  try {
    return JSON.parse(rawContent);
  } catch {}
  // If not, try to find the largest {...} or [...] block
  let open = 0, start = -1, best = '', bestLen = 0;
  for (let i = 0; i < rawContent.length; ++i) {
    if (rawContent[i] === '{' || rawContent[i] === '[') {
      if (open === 0) start = i;
      open++;
    }
    if ((rawContent[i] === '}' || rawContent[i] === ']') && open > 0) {
      open--;
      if (open === 0 && start !== -1) {
        const fragment = rawContent.substring(start, i + 1);
        if (fragment.length > bestLen) {
          best = fragment;
          bestLen = fragment.length;
        }
      }
    }
  }
  if (bestLen > 0) {
    try {
      return JSON.parse(best);
    } catch {}
  }
  // Fallback: try to find a ```json ... ``` codeblock
  const jsonMatch = rawContent.match(/```json\s*([\s\S]+?)\s*```/i);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch {}
  }
  throw new Error("AI response did not contain a valid JSON object.\n\nRaw AI Response:\n\n" + rawContent);
}