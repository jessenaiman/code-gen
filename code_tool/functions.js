import { pollinationsRequest } from '../pollinations-helper.js';
import { getSeed } from '../seed.js';
import { generateVariedPrompt, reasoningInstructions } from '../promptUtils.js';
import { extractLargestJson } from '../jsonExtractor.js';
import { fixJsonWithAI } from '../json-fixer.js';

async function generateCode(language, description, tone, mode, includeExplanation, aiModel = "openai", includeReasoning = false) {
  let newSeed = getSeed();

  let responseSchemaFields = [];
  let modeSpecificInstructions = [];
  let rules = [
    "Return working, complete code that fulfills the description without any typos or grammar issues.",
    `Use the specified programming language: ${language}.`,
    `You must speak in a tone of "${tone}".`,
  ];

  // Add reasoning field first to ensure it's generated first
  if (includeReasoning) {
    responseSchemaFields.push(`"reasoning": "string"`);
    rules.unshift(reasoningInstructions); // Add reasoning instructions at the beginning of rules
  }

  if (mode === 'multiple') {
    responseSchemaFields.push(`"codes": ["string"]`);
    modeSpecificInstructions.push(`2. **Mode: Multiple**: You are in "multiple" mode. Provide 3 distinct implementations in the 'codes' array. The 'code' field MUST NOT be present in your response.`);
  } else {
    // This covers 'single', 'shortest', 'complete', 'fullyimplemented'
    responseSchemaFields.push(`"code": "string"`);
    modeSpecificInstructions.push(`2. **Mode: ${mode}**: You are in "${mode}" mode. Provide a single implementation in the 'code' field. The 'codes' array MUST NOT be present in your response.`);
    if (mode === 'shortest') {
      modeSpecificInstructions.push(`3. **Detail**: The code should be the most concise implementation possible.`);
    } else if (mode === 'complete') {
      modeSpecificInstructions.push(`3. **Detail**: The code must be fully documented with all edge cases handled.`);
    } else if (mode === 'fullyimplemented') {
      modeSpecificInstructions.push(`3. **Detail**: The code MUST be implemented completely, with NO placeholders or omitted sections.`);
    } else { // 'single' mode
      modeSpecificInstructions.push(`3. **Detail**: Provide a standard, well-written implementation of the requested code.`);
    }
  }

  if (includeExplanation) {
    responseSchemaFields.push(`"explanation": "string"`);
    rules.splice(2, 0, "Include a detailed code explanation in the 'explanation' field. Format the explanation using HTML tags (e.g., <p>, <ul>, <li>, <code>). Do NOT use markdown.");
  }

  const baseSystemPrompt = `You are an expert code generator. Your task is to generate code based on a user's description and the provided parameters.

**Parameters:**
- Language: ${language}
- Mode: ${mode}
- Tone: ${tone}
- Include Explanation: ${includeExplanation}
- Include Reasoning: ${includeReasoning}

**Instructions & Rules:**
${rules.concat(modeSpecificInstructions).map((rule, i) => `${i + 1}. ${rule}`).join('\n')}

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

  const variedSystemPrompt = generateVariedPrompt(baseSystemPrompt, description, 'generateCode', aiModel);

  const messages = [
    { role: "system", content: variedSystemPrompt },
    { role: "user", content: description }
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

    if (!data || (mode !== 'multiple' && typeof data.code !== 'string') || (mode === 'multiple' && (!Array.isArray(data.codes) || data.codes.length === 0))) {
      const error = new Error(`Invalid response format from AI for mode "${mode}": Missing "${mode === 'multiple' ? 'codes (array)' : 'code'}" field or array is empty.`);
      error.rawResponse = rawContent;
      throw error;
    }
    return data;
  } catch (error) {
    if (error.rawResponse) {
       console.warn("Initial request failed validation. Attempting to fix JSON.", error.message);
       window.lastAttemptError = new Error("Fixing malformed JSON..."); // Update UI
       try {
         const fixedData = await fixJsonWithAI(error.rawResponse, `{ ${responseSchemaFields.join(',\n  ')} }`);
         // Re-validate the fixed data
         if (!fixedData || (mode !== 'multiple' && typeof fixedData.code !== 'string') || (mode === 'multiple' && (!Array.isArray(fixedData.codes) || fixedData.codes.length === 0))) {
            throw new Error('Fixed JSON is still invalid.');
         }
         console.log("Successfully fixed and validated JSON.");
         return fixedData;
       } catch (fixError) {
         console.error("Failed to fix JSON.", fixError);
         throw new Error(`Failed to generate code: ${error.message}\n\nRaw AI Response:\n${error.rawResponse}`);
       }
    }
    throw error;
  }
}

async function commentCode(language, code, mode, specificity, tone = "professional", aiModel="openai", includeReasoning = false) {
  let newSeed = getSeed();
  let responseSchemaFields = [];

  let rules = [
    `Add comments according to the specified "Comment Mode".`,
    `Follow language-specific documentation standards (e.g., JSDoc for JS, docstrings for Python).`,
    `Enhance existing comments/docstrings if they are incomplete. Do not duplicate existing comments.`,
    `Return the complete, commented code as a raw string in the 'commentedCode' field.`,
    `Provide a summary of the changes you made, formatted using HTML tags (e.g., <h2>, <ul>, <li>). Do NOT use markdown or backticks.`
  ];

  if (includeReasoning) {
    responseSchemaFields.push(`"reasoning": "string"`);
    rules.unshift(reasoningInstructions);
  }

  responseSchemaFields.push(
    `"commentedCode": "string"`,
    `"summary": "string"`
  );

  const baseSystemPrompt = `You are an expert code commenter. Your task is to add clear and helpful comments to the user's code based on the provided parameters.

**Parameters:**
- Language: ${language}
- Comment Mode: ${mode} (${mode === 'everywhere' ? 'Add comments to every meaningful block' : mode === 'necessary' ? 'Add comments only where clarity is needed' : 'Focus on documenting classes, methods, and functions'})
- Specificity: ${specificity}
- Tone: ${tone}
- Include Reasoning: ${includeReasoning}

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

  const variedSystemPrompt = generateVariedPrompt(baseSystemPrompt, code, 'commentCode', aiModel);

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
    if (!data || typeof data.commentedCode !== 'string' || typeof data.summary !== 'string') {
      const error = new Error('Invalid response format from AI for commenter mode: Missing or invalid "commentedCode" (expected string) or "summary" (expected string) field.');
      error.rawResponse = rawContent;
      throw error;
    }
    return data;
  } catch (error) {
    if (error.rawResponse) {
      console.warn("Initial request failed validation. Attempting to fix JSON.", error.message);
      window.lastAttemptError = new Error("Fixing malformed JSON..."); // Update UI
      try {
        const fixedData = await fixJsonWithAI(error.rawResponse, `{ ${responseSchemaFields.join(',\n  ')} }`);
        if (!fixedData || typeof fixedData.commentedCode !== 'string' || typeof fixedData.summary !== 'string') {
          throw new Error('Fixed JSON is still invalid.');
        }
        console.log("Successfully fixed and validated JSON.");
        return fixedData;
      } catch (fixError) {
        console.error("Failed to fix JSON.", fixError);
        throw new Error(`Failed to add comments to code: ${error.message}\n\nRaw AI Response:\n${error.rawResponse}`);
      }
    }
    throw error;
  }
}

async function convertCode(sourceLanguage, targetLanguage, code, includeExplanation, tone = "professional", aiModel="openai", includeReasoning = false) {
  let newSeed = getSeed();
  let responseSchemaFields = [];

  let rules = [
    "Preserve the functionality and logic of the original code.",
    `Use idiomatic patterns and best practices of the target language (${targetLanguage}).`,
    "Maintain or improve code readability.",
    "Add necessary imports, includes, or dependencies for the target language."
  ];

  if (includeReasoning) {
    responseSchemaFields.push(`"reasoning": "string"`);
    rules.unshift(reasoningInstructions);
  }

  responseSchemaFields.push(`"code": "string"`);

  if (includeExplanation) {
    responseSchemaFields.push(`"explanation": "string"`);
    rules.push("Provide a concise explanation of the conversion and any major changes in the 'explanation' field. Format the explanation using HTML tags (e.g., <p>, <ul>, <li>, <code>). Do NOT use markdown.");
  }
  rules.push(`Use a ${tone} language and tone.`);
  rules.push(`Do NOT use markdown or backticks.`);

  const baseSystemPrompt = `You are an expert code converter. Your task is to convert code from a source language to a target language.

**Parameters:**
- Source Language: ${sourceLanguage}
- Target Language: ${targetLanguage}
- Include Explanation: ${includeExplanation}
- Tone: ${tone}
- Include Reasoning: ${includeReasoning}

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

  const variedSystemPrompt = generateVariedPrompt(baseSystemPrompt, code, 'convertCode', aiModel);

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
    if (!data || typeof data.code !== 'string') {
      const error = new Error('Invalid response format from AI for converter mode: Missing or invalid "code" field (expected string).');
      error.rawResponse = rawContent;
      throw error;
    }
    return data;
  } catch (error) {
    if (error.rawResponse) {
      console.warn("Initial request failed validation. Attempting to fix JSON.", error.message);
      window.lastAttemptError = new Error("Fixing malformed JSON..."); // Update UI
      try {
        const fixedData = await fixJsonWithAI(error.rawResponse, `{ ${responseSchemaFields.join(',\n  ')} }`);
        if (!fixedData || typeof fixedData.code !== 'string') {
          throw new Error('Fixed JSON is still invalid.');
        }
        console.log("Successfully fixed and validated JSON.");
        return fixedData;
      } catch (fixError) {
        console.error("Failed to fix JSON.", fixError);
        throw new Error(`Failed to convert code: ${error.message}\n\nRaw AI Response:\n${error.rawResponse}`);
      }
    }
    throw error;
  }
}

async function optimizeCode(language, code, optimizerMode, tone = "professional", aiModel="openai", includeReasoning = false) {
  let newSeed = getSeed();
  let responseSchemaFields = [];

  let rules = [
    `Optimize the code according to the specified "Optimizer Mode".`,
    `The optimized code MUST be fully implemented and complete. NO placeholders or omitted code sections are allowed. You are responsible for any errors due to missing implementations.`,
    `Return the optimized code as a raw string in the 'optimizedCode' field.`,
    `Maintain the original functionality of the code.`,
    `Provide a summary explaining what optimizations were made and why, formatted using HTML tags (e.g., <h2>, <ul>, <li>). Do NOT use markdown or backticks.`
  ];

  if (includeReasoning) {
    responseSchemaFields.push(`"reasoning": "string"`);
    rules.unshift(reasoningInstructions);
  }

  responseSchemaFields.push(
    `"optimizedCode": "string"`,
    `"summary": "string"`
  );

  const baseSystemPrompt = `You are an expert code optimizer. Your task is to optimize the user's code based on the specified mode.

**Parameters:**
- Language: ${language}
- Optimizer Mode: ${optimizerMode} (${optimizerMode === 'optimize' ? 'Focus strictly on performance' : optimizerMode === 'readability' ? 'Balance performance with readability' : 'Apply extensive optimizations to every line'})
- Tone: ${tone}
- Include Reasoning: ${includeReasoning}

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

  const variedSystemPrompt = generateVariedPrompt(baseSystemPrompt, code, 'optimizeCode', aiModel);

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
    if (!data || typeof data.optimizedCode !== 'string' || typeof data.summary !== 'string') {
      const error = new Error('Invalid response format from AI for optimizer mode: Missing or invalid "optimizedCode" (expected string) or "summary" (expected string) field.');
      error.rawResponse = rawContent;
      throw error;
    }
    return data;
  } catch (error) {
    if (error.rawResponse) {
      console.warn("Initial request failed validation. Attempting to fix JSON.", error.message);
      window.lastAttemptError = new Error("Fixing malformed JSON..."); // Update UI
      try {
        const fixedData = await fixJsonWithAI(error.rawResponse, `{ ${responseSchemaFields.join(',\n  ')} }`);
        if (!fixedData || typeof fixedData.optimizedCode !== 'string' || typeof fixedData.summary !== 'string') {
          throw new Error('Fixed JSON is still invalid.');
        }
        console.log("Successfully fixed and validated JSON.");
        return fixedData;
      } catch (fixError) {
        console.error("Failed to fix JSON.", fixError);
        throw new Error(`Failed to optimize code: ${error.message}\n\nRaw AI Response:\n${error.rawResponse}`);
      }
    }
    throw error;
  }
}

export { generateCode, commentCode, convertCode, optimizeCode };