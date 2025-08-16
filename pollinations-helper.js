// Helper for interacting with pollinations.ai openai API
import { stopUpdates } from './execution-handler.js';

const url = "https://text.pollinations.ai/openai";
const referrer = "AdvancedCodeGen";

export async function pollinationsRequest(reqBody, maxRetries = 4, useWebsimFallback = true) {
  // Input validation
  if (!reqBody || typeof reqBody !== 'object') {
    throw new Error('reqBody must be a valid object');
  }

  // Defensive: Use default model if not set
  if (!reqBody.model) reqBody.model = "openai";

  const forceWebsimFallback = reqBody.model === "websim";

  if (!("private" in reqBody)) reqBody.private = true;
  
  // Remove undefined values for cleaner payloads  
  const payload = {
    referrer: referrer
  };
  for (const k in reqBody) {
    if (reqBody[k] !== undefined) payload[k] = reqBody[k];
  }
  window.lastAttemptError = null;
  
  if (!forceWebsimFallback) {
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      // Update attempt counter BEFORE making the request
      window.responseRetries = attempt;
      
      try {
        if (attempt === maxRetries + 1) throw new Error("");
        
        console.log(`Attempt ${attempt}/${maxRetries} using Pollinations AI model: ${reqBody.model}`);
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Referer": referrer,
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify(payload)
        });

        if (!resp.ok) {
          const errorText = await resp.text();
          let errorObj = {};
          try {
            errorObj = JSON.parse(errorText);
          } catch (e) {
            errorObj = { details: { error: { message: errorText || `HTTP error ${resp.status}` } } };
          }

          window.lastAttemptError = new Error(`Pollinations.ai request failed: HTTP ${resp.status} ${errorObj.details?.error?.message || errorText || 'Unknown error'}`);
          console.error(window.lastAttemptError.message);
          if (attempt === maxRetries && useWebsimFallback) {
             console.warn("Max retries reached for Pollinations AI. Attempting fallback to websim.chat.completions.create...");
          } else if (attempt === maxRetries) {
             throw window.lastAttemptError; // Re-throw if it's the last attempt and no fallback
          }
          // Continue to next attempt
          continue;
        }

        const result = await resp.json();
        console.log(`AI Response (Pollinations): ${JSON.stringify(result)}`);

        // Extract reasoning content
        let reasoningContent = result.choices?.[0]?.message?.reasoning_content;
        const content = result.choices?.[0]?.message?.content;
        if (!reasoningContent) {
          if (content) {
            const thinkMatches = content.match(/<think>([\s\S]*?)<\/think>/);
            if (thinkMatches) {
              reasoningContent = thinkMatches[1].trim();
            }
          }
        }
        window.outputResult = result;
        if (reasoningContent) {
          window.outputResult.choices[0].message.reasoning_content = reasoningContent;
        }

        // if FOR SOME REASON the content is empty but reasoning_content has actual content, fill content from reasoning_content.
        if (reasoningContent) {
          if (typeof content !== "string") {
            result.choices[0].message.content = reasoningContent;
            window.outputResult.choices[0].message.reasoning_content = null;
          }
        } 

        window.responseRetries = 0;
        window.lastAttemptError = null;
        stopUpdates();
        return result; // Success!
      } catch (error) {
        if (error.message) {
        window.lastAttemptError = error;
          console.error(`Pollinations Request Error (Attempt ${attempt}):`, error);
        }
        if (attempt === maxRetries && useWebsimFallback) {
           console.warn("Max retries reached for Pollinations AI. Attempting fallback to websim.chat.completions.create...");
        } else if (attempt === maxRetries) {
           throw error; // Re-throw if it's the last attempt and no fallback
        }
      }
    }
  }

  // If all Pollinations attempts fail and fallback is enabled, or if model "websim" is selected
  if (useWebsimFallback || forceWebsimFallback) {
    try {
      console.log("Using websim.chat.completions.create...");

      const websimChatPayload = {
        messages: payload.messages,
        json: payload.response_format?.type === "json_object",
      };

      const completion = await websim.chat.completions.create(websimChatPayload);

      const websimResultContent = completion.content;
      console.log(`AI Response (Websim): ${websimResultContent}`);

      // Mimic Pollinations.ai response structure for displayResult function
      const simulatedPollinationsResult = {
        choices: [
          {
            message: {
              content: websimResultContent, 
              reasoning_content: null 
            }
          }
        ]
      };

      // Extract reasoning content from websimResultContent if applicable (AI might still embed it)
      let reasoningContent = null;
      if (websimResultContent) {
        const thinkMatches = websimResultContent.match(/<think>([\s\S]*?)<\/think>/);
        if (thinkMatches) {
          reasoningContent = thinkMatches[1].trim();
        }
      }
      if (reasoningContent) {
        simulatedPollinationsResult.choices[0].message.reasoning_content = reasoningContent;
      }
      window.outputResult = simulatedPollinationsResult; 
      window.responseRetries = 0;
      window.lastAttemptError = null;
      stopUpdates();
      return simulatedPollinationsResult;
    } catch (websimError) {
      console.error("Websim Request Error:", websimError);
      throw new Error(`All AI attempts failed, including websim: ${websimError.message}`);
    }
  }
  window.responseRetries = 0;
  window.lastAttemptError = null;
  stopUpdates();
  
  // If no fallback and all retries failed
  throw window.lastAttemptError || new Error("All AI attempts failed without specific error message.");
}