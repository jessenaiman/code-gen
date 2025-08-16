import { pollinationsRequest } from '../pollinations-helper.js';
import { getSeed } from '../seed.js';
import { generateVariedPrompt, reasoningInstructions } from '../promptUtils.js';
import { extractLargestJson } from '../jsonExtractor.js';
import { fixJsonWithAI } from '../json-fixer.js';

async function explainCode(language, code, tone = "professional", aiModel="openai", includeReasoning = false) {
  let newSeed = getSeed();
  let responseSchemaFields = [];

  let rules = [
    "Explain the purpose and functionality of the code clearly and comprehensively.",
    "Break down complex parts into understandable segments.",
    "Focus on explaining what the code does, how it works, and its structure.",
    "When the code involves user input/interaction or console outputting, provide 1 (or more, if applicable) detailed example user flow/s showing typical usage patterns (or testing edge cases and 'throwing' possible errors which you'll provide in the flow). markdown header should be EXPLICITLY named (if user input is involved): 'Example User Interactions' or (if no user input is involved, but console output exists): 'Example Outputs'",
    `Use clear, ${tone} language for the explanation.`,
    "Format your explanation nicely using HTML tags (e.g., <h2>, <h3>, <p>, <ul>, <ol>, <pre>, <code>). Do NOT use markdown or backticks."
  ];

  if (includeReasoning) {
    responseSchemaFields.push(`"reasoning": "string"`);
    rules.unshift(reasoningInstructions);
  }

  responseSchemaFields.push(
    `"explanation": "string"`,
  );

  const baseSystemPrompt = `You are an expert code explainer. Your task is to thoroughly explain the user's code without suggesting improvements or pointing out issues.

**Parameters:**
- Language: ${language}
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

  const variedSystemPrompt = generateVariedPrompt(baseSystemPrompt, code, 'explainCode', aiModel);

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
    if (!data || typeof data.explanation !== 'string') {
      const error = new Error('Invalid response format from AI for explainer mode: Missing or invalid "explanation" field.');
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
         if (!fixedData || typeof fixedData.explanation !== 'string') {
            throw new Error('Fixed JSON is still invalid.');
         }
         console.log("Successfully fixed and validated JSON.");
         return fixedData;
       } catch (fixError) {
         console.error("Failed to fix JSON.", fixError);
         throw new Error(`Failed to explain code: ${error.message}\n\nRaw AI Response:\n${error.rawResponse}`);
       }
    }
    throw error;
  }
}

async function reviewCode(language, code, tone = "professional", aiModel="openai", includeReasoning = false) {
  let newSeed = getSeed();
  let responseSchemaFields = [];

  let rules = [
    "Analyze the code based on: Bugs, readability, scalability, performance, error handling, code style, security, and testing.",
    "Provide a numeric score from 0 to 10 based on your analysis (0-3: Poor, 4-6: Acceptable, 7-8: Good, 9-10: Excellent).",
    "Provide an \"Improved Version\" of the code in the 'improved_code' field. This should be a raw string of the code.",
    "Format the review text using HTML tags (e.g., <h2>, <h3>, <p>, <ul>, <li>). Do NOT use markdown or backticks.",
    `Use a ${tone} language and tone.`,
    "The score should ONLY be in the 'score' field of the JSON, not in the 'review' text."
  ];

  if (includeReasoning) {
    responseSchemaFields.push(`"reasoning": "string"`);
    rules.unshift(reasoningInstructions);
  }

  responseSchemaFields.push(
    `"review": "string"`,
    `"score": "number"`, // FIX: Changed 'number' to '"number"' to make it a string literal
    `"improved_code": "string"`
  );

  const baseSystemPrompt = `You are an expert code reviewer. Your task is to provide a detailed analysis of the user's code.

**Parameters:**
- Language: ${language}
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

  const variedSystemPrompt = generateVariedPrompt(baseSystemPrompt, code, 'reviewCode', aiModel);

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
    if (!data || typeof data.review !== 'string' || typeof data.score !== 'number' || typeof data.improved_code !== 'string') {
      const error = new Error('Invalid response format from AI for reviewer mode: Missing or invalid "review", "score", or "improved_code" field.');
      error.rawResponse = rawContent;
      throw error;
    }
    // Clean up score from review text just in case AI adds it.
    data.review = data.review
      .replace(`Score: ${data.score}/10`, '')
      .replace(`Score: ${data.score}`, '');
    return data;
  } catch (error) {
    if (error.rawResponse) {
       console.warn("Initial request failed validation. Attempting to fix JSON.", error.message);
       window.lastAttemptError = new Error("Fixing malformed JSON..."); // Update UI
       try {
         const fixedData = await fixJsonWithAI(error.rawResponse, `{ ${responseSchemaFields.join(',\n  ')} }`);
         if (!fixedData || typeof fixedData.review !== 'string' || typeof fixedData.score !== 'number' || typeof fixedData.improved_code !== 'string') {
            throw new Error('Fixed JSON is still invalid.');
         }
         console.log("Successfully fixed and validated JSON.");
         fixedData.review = fixedData.review.replace(`Score: ${fixedData.score}/10`, '').replace(`Score: ${fixedData.score}`, '');
         return fixedData;
       } catch (fixError) {
         console.error("Failed to fix JSON.", fixError);
         throw new Error(`Failed to review code: ${error.message}\n\nRaw AI Response:\n${error.rawResponse}`);
       }
    }
    throw error;
  }
}

async function debugCode(language, code, tone = "professional", aiModel="openai", includeReasoning = false) {
  let newSeed = getSeed();
  let responseSchemaFields = [];

  let rules = [
    "Thoroughly examine the code for syntax errors, logical errors, performance issues, security vulnerabilities, and violations of best practices.",
    "Provide a comprehensive debugging report that clearly explains each issue and its root cause, formatted using HTML.",
    "**You MUST ALWAYS provide a complete, fixed version of the code as a raw string in the 'fixedCode' field.** Even if no major issues are found, provide a slightly improved version.",
    `Use a ${tone} language and tone.`,
    "Format the report using HTML tags (e.g., <h2>, <h3>, <p>, <ul>, <li>). Do NOT use markdown or backticks."
  ];

  if (includeReasoning) {
    responseSchemaFields.push(`"reasoning": "string"`);
    rules.unshift(reasoningInstructions);
  }

  responseSchemaFields.push(
    `"debugReport": "string"`,
    `"fixedCode": "string"`
  );

  const baseSystemPrompt = `You are an expert code debugger. Your task is to analyze user's code, identify all issues, and provide a fixed version.

**Parameters:**
- Language: ${language}
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

  const variedSystemPrompt = generateVariedPrompt(baseSystemPrompt, code, 'debugCode', aiModel);

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
    if (!data || typeof data.debugReport !== 'string' || typeof data.fixedCode !== 'string') {
      const error = new Error('Invalid response format from AI for debugger mode: Missing or invalid "debugReport" or "fixedCode" fields.');
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
         if (!fixedData || typeof fixedData.debugReport !== 'string' || typeof fixedData.fixedCode !== 'string') {
            throw new Error('Fixed JSON is still invalid.');
         }
         console.log("Successfully fixed and validated JSON.");
         return fixedData;
       } catch (fixError) {
         console.error("Failed to fix JSON.", fixError);
         throw new Error(`Failed to debug code: ${error.message}\n\nRaw AI Response:\n${error.rawResponse}`);
       }
    }
    throw error;
  }
}

export { explainCode, reviewCode, debugCode };