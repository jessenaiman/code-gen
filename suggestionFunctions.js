import { pollinationsRequest } from './pollinations-helper.js';
import { getSeed } from './seed.js';
import { generateVariedPrompt, reasoningInstructions } from './promptUtils.js';
import { extractLargestJson } from './jsonExtractor.js';
import { fixJsonWithAI } from './json-fixer.js';

async function roastCode(language, code, roastLevel, tone = "direct", aiModel = "openai", includeReasoning = false) {
  let newSeed = getSeed();
  let responseSchemaFields = [];

  let rules = [
    `Deliver a roast that matches the specified "Roast Level".`,
    `Make the roast lengthy and detailed, over ~150 words, scaled with code size.`,
    `If the code is genuinely good, you can acknowledge that, but still find something to nitpick humorously.`,
    `Format the entire roast using HTML tags (e.g., <h2>, <h3>, <ul>, <li>). Do NOT use markdown or backticks.`
  ];

  // Add reasoning field first to ensure it's generated first
  if (includeReasoning) {
    responseSchemaFields.push(`"reasoning": "string"`);
    rules.unshift(reasoningInstructions);
  }

  responseSchemaFields.push(
    `"roast": "string"`
  );

  const baseSystemPrompt = `You are a brutally honest code roaster. Your task is to provide a scathing, humorous, and critical review of the user's code.

**Parameters:**
- Language: ${language}
- Roast Level: ${roastLevel}
- Tone: ${tone}
- Include Reasoning: ${includeReasoning}

**Roast Intensity Rules:**
- **"minimal"**: A professional critique. Point out serious issues with constructive feedback.
- **"necessary"**: Targeted criticism. Use sharp, direct language to call out bad practices.
- **"extreme"**: Full savage mode. Mercilessly mock the code with sarcastic and cutting humor. NO-HOLDS-BARRED.

**Instructions & Rules:**
${rules.map((rule, i) => `${i + 1}. ${rule}`).join('\n')}

**Output Format:**
- **ABSOLUTELY CRITICAL**: You MUST respond with a single, raw JSON object.
- Do NOT wrap your JSON output in markdown code blocks (e.g., \`\`\`json\`\`\`).
- Do NOT include any comments or other text outside of the JSON structure.
- Adhere strictly to the following JSON schema. Do not add any other fields.
- NO PREAMBLE. NO POSTAMBLE. Your response must be ONLY the JSON object.

\`\`\`json
{
  ${responseSchemaFields.join(',\n  ')}
}
\`\`\`
`;

  const variedSystemPrompt = generateVariedPrompt(baseSystemPrompt, code, 'roastCode', aiModel);
  
  const messages = [
    { role: "system", content: variedSystemPrompt },
    { role: "user", content: code }
  ];

  try {
    const result = await pollinationsRequest({
      messages,
      model: aiModel,
      seed: newSeed,
      private: true,
      response_format: { type: "json_object" },
    });
    const rawContent = (result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content) || "";
    let data;
    try {
      data = extractLargestJson(rawContent);
    } catch(e) {
      const error = new Error('AI response did not contain a valid JSON object.');
      error.rawResponse = rawContent;
      throw error;
    }
    
    if (!data || typeof data.roast !== 'string') {
      const error = new Error('Invalid response format from AI for roaster mode: Missing or invalid "roast" field.');
      error.rawResponse = rawContent;
      throw error;
    }
    
    // Return only the roast text
    return data; // Return full data, output-handler will pick 'roast' and 'reasoning'
  } catch (error) {
    if (error.rawResponse) {
      console.warn("Initial request failed validation. Attempting to fix JSON.", error.message);
      window.lastAttemptError = new Error("Fixing malformed JSON..."); // Update UI
      try {
        const fixedData = await fixJsonWithAI(error.rawResponse, `{ ${responseSchemaFields.join(',\n  ')} }`, code, aiModel);
        if (!fixedData || typeof fixedData.roast !== 'string') {
          throw new Error('Fixed JSON is still invalid.');
        }
        console.log("Successfully fixed and validated JSON.");
        return fixedData;
      } catch (fixError) {
        console.error("Failed to fix JSON.", fixError);
        throw new Error(`Failed to roast code: ${error.message}\n\nRaw AI Response:\n${error.rawResponse}`);
      }
    }
    throw error;
  }
}

export { roastCode };