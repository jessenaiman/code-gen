import { extractLargestJson } from './jsonExtractor.js';
import { stopUpdates } from './execution-handler.js'; 

/**
 * Calculates the Levenshtein distance between two strings.
 * Used for fuzzy matching of keys in malformed JSON.
 * @param {string} s1 - First string.
 * @param {string} s2 - Second string.
 * @returns {number} The Levenshtein distance.
 */
function levenshteinDistance(s1, s2) {
  s1 = s1.toLowerCase();
  s2 = s2.toLowerCase();
  const costs = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(newValue, lastValue, costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

/**
 * Attempts to fix a malformed JSON string using client-side parsing and schema adherence.
 * It extracts values from the malformed string and constructs a valid JSON object
 * based on the provided schema, including fuzzy matching for misspelled keys.
 * @param {string} malformedJsonString - The raw, potentially malformed JSON string from the first AI.
 * @param {string} expectedSchemaString - A string representing the expected JSON schema (e.g., '{ "code": "string", "explanation": "string" }').
 * @returns {Promise<object>} - A promise that resolves to the fixed and parsed JSON object.
 */
export async function fixJsonWithAI(malformedJsonString, expectedSchemaString) {
    console.warn("Attempting to fix malformed JSON using client-side logic...");

    let parsedSchema = {};
    try {
        // Trim and remove any non-printable characters that might interfere
        const cleanedSchemaString = expectedSchemaString.trim().replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
        // console.log("Schema string received for parsing:", cleanedSchemaString); // Debugging
        const tempSchema = JSON.parse(cleanedSchemaString);
        for (const key in tempSchema) {
            let typeHint = tempSchema[key];
            if (typeof typeHint === 'string' && typeHint.startsWith('[') && typeHint.endsWith(']')) {
                // Example: '["string"]' -> { type: 'array', itemType: 'string' }
                parsedSchema[key] = { type: 'array', itemType: typeHint.substring(2, typeHint.length - 2) };
            } else {
                // Example: 'string' -> { type: 'string' }
                parsedSchema[key] = { type: typeHint };
            }
        }
    } catch (e) {
        console.error("Failed to parse expected schema string:", e, "\nProblematic string:", expectedSchemaString);
        throw new Error("Internal error: Could not parse expected JSON schema for fixing.");
    }

    let initialParseAttempt = {};
    try {
        // Attempt to extract the largest valid JSON-like structure from the malformed string.
        // This is the primary source of values. It might still be incomplete or have wrong types,
        // but it's the best guess at the AI's intended JSON.
        initialParseAttempt = extractLargestJson(malformedJsonString);
    } catch (e) {
        // If extractLargestJson completely fails, it means the string is not even vaguely JSON-like.
        // We will proceed with an empty object for `initialParseAttempt` and rely more on regex fallback.
        console.warn("extractLargestJson failed on malformed string, proceeding with regex extraction as fallback if needed.", e);
    }

    const fixedData = {};
    const stringifiedMalformedJson = String(malformedJsonString); // Ensure it's a string for regex matching

    for (const expectedKey in parsedSchema) {
        const expectedTypeInfo = parsedSchema[expectedKey];
        const expectedType = expectedTypeInfo.type;
        const itemType = expectedTypeInfo.itemType; // Relevant for 'array' type

        let value = undefined;
        let actualKeyFound = expectedKey; // Assume direct match initially for regex if no fuzzy match

        // 1. Try direct lookup first
        if (initialParseAttempt.hasOwnProperty(expectedKey)) {
            value = initialParseAttempt[expectedKey];
        } else {
            // 2. If direct lookup fails, try fuzzy matching existing keys
            let bestMatchKey = null;
            let minDistance = Infinity;
            const keysInInitialParse = Object.keys(initialParseAttempt);

            for (const currentActualKey of keysInInitialParse) {
                const distance = levenshteinDistance(expectedKey, currentActualKey);
                // Consider keys of similar length for more reliable fuzzy matching
                const lengthDiff = Math.abs(expectedKey.length - currentActualKey.length);

                // Typo threshold: max 2 edits for keys up to 10 chars, 3 for longer ones. Length diff max 2.
                const typoThreshold = expectedKey.length <= 10 ? 2 : 3;

                if (distance <= typoThreshold && distance < minDistance && lengthDiff <= 2) {
                    minDistance = distance;
                    bestMatchKey = currentActualKey;
                }
            }

            if (bestMatchKey !== null) { // If a fuzzy match was found
                console.log(`Fuzzy matched "${bestMatchKey}" to expected key "${expectedKey}" (distance: ${minDistance})`);
                value = initialParseAttempt[bestMatchKey];
                actualKeyFound = bestMatchKey; // Use the fuzzy matched key for subsequent regex extraction
            }
        }
        
        // 3. If value is still problematic, attempt robust regex extraction using actualKeyFound
        let needsRegexExtraction = false;
        
        // Check if the current 'value' from initial parse is problematic for the 'expectedType'
        if (expectedType === 'string') {
            if (typeof value !== 'string' || value.trim() === '') needsRegexExtraction = true;
        } else if (expectedType === 'number') {
            if (typeof value !== 'number') needsRegexExtraction = true;
        } else if (expectedType === 'boolean') {
            if (typeof value !== 'boolean') needsRegexExtraction = true;
        } else if (expectedType === 'array') {
            // If it's not an array, OR if it's an object that's empty (e.g., {}) but should be an array
            if (!Array.isArray(value) || (typeof value === 'object' && Object.keys(value).length === 0 && !Array.isArray(value))) {
                needsRegexExtraction = true;
            }
        }

        // Additionally, if the string content itself looks malformed (e.g., contains unescaped quotes)
        // This is a heuristic. We assume if the value contains quotes but the original raw string
        // doesn't have it properly JSON-quoted, it's malformed.
        if (expectedType === 'string' && typeof value === 'string' && (value.includes('"') || value.includes('\''))) {
            const correctlyQuotedValue = JSON.stringify(value); // Get how it *should* look if properly JSON escaped
            // Check if the actualKeyFound is properly quoted with its value in the malformed string
            const searchPattern = `"${actualKeyFound}":${correctlyQuotedValue}`;
            if (!stringifiedMalformedJson.includes(searchPattern)) {
                needsRegexExtraction = true; // Trigger regex if string content seems problematic for JSON
            }
        }

        if (needsRegexExtraction && actualKeyFound) { // Ensure actualKeyFound is not null/empty
            let regexToUse;
            if (expectedType === 'array') {
                // Robust regex for arrays: captures content between '[' and ']'
                regexToUse = new RegExp(`"${actualKeyFound}"\\s*:\\s*(\\[[\\s\\S]*?\\])`, 'i');
            } else if (expectedType === 'string') {
                // Robust regex for strings: captures content between double quotes, then single quotes, then unquoted content
                regexToUse = new RegExp(`"${actualKeyFound}"\\s*:\\s*(?:"([^"]*)"|'([^']*)'|([\\s\\S]*?)(?=(?:\\s*"(?:\\w+|\\s*\\w+)"\\s*:)|[,\\]}]|$))`, 'i');
            } else {
                // For numbers, booleans, or other simple types: capture non-quoted value until comma/bracket or end.
                regexToUse = new RegExp(`"${actualKeyFound}"\\s*:\\s*([\\s\\S]*?)(?:,|\\}|\\]|$)`, 'i');
            }

            const match = stringifiedMalformedJson.match(regexToUse);
            if (match) {
                // Prioritize content within double quotes (match[1]), then single quotes (match[2]), then unquoted (match[3])
                let extractedValue = match[1] !== undefined ? match[1] : (match[2] !== undefined ? match[2] : match[3]?.trim());
                
                // For non-string types, try to parse the extracted string as JSON literal
                if (extractedValue && expectedType !== 'string' && expectedType !== 'array') {
                    try {
                        extractedValue = JSON.parse(extractedValue);
                    } catch (e) {
                        // If it fails to parse (e.g., malformed number), keep it as string
                        console.warn(`Could not parse extracted value "${extractedValue}" as ${expectedType}. Keeping as string.`);
                    }
                }
                value = extractedValue; // Update value with extracted data
                console.log(`Regex extracted for "${expectedKey}" using key "${actualKeyFound}":`, value);
            } else {
                console.warn(`Regex extraction failed for "${expectedKey}" using key "${actualKeyFound}".`);
            }
        }

        // Apply type conversion and assign default values based on expected type
        switch (expectedType) {
            case 'string':
                // Ensure the final value is a string. If original is null/undefined, use empty string.
                fixedData[expectedKey] = typeof value === 'string' ? value : String(value || "");
                break;
            case 'number':
                // Convert to number. If NaN, default to 0.
                const numVal = Number(value);
                fixedData[expectedKey] = isNaN(numVal) ? 0 : numVal;
                break;
            case 'boolean':
                // Convert to boolean. Handles 'true'/'false' strings, actual booleans, or defaults to false.
                fixedData[expectedKey] = typeof value === 'boolean' ? value : (String(value).toLowerCase() === 'true');
                break;
            case 'array':
                // Handle arrays. If `value` is an array, map its items to the expected type.
                // If `value` is a string (e.g., `"[item1, item2]"`) try to parse it as an array.
                // If it's a single string that *should* be an array element (e.g., `"code content"` for a `codes` array),
                // wrap it in an array.
                if (Array.isArray(value)) {
                    fixedData[expectedKey] = value.map(item => {
                        if (itemType === 'string') return String(item || "");
                        if (itemType === 'number') return Number(item || 0);
                        if (itemType === 'boolean') return typeof item === 'boolean' ? item : (String(item).toLowerCase() === 'true');
                        return item; // Fallback for complex item types
                    });
                } else if (typeof value === 'string') {
                    try {
                        const parsedArray = JSON.parse(value); // Try parsing string as an array
                        if (Array.isArray(parsedArray)) {
                            fixedData[expectedKey] = parsedArray.map(item => {
                                if (itemType === 'string') return String(item || "");
                                return item;
                            });
                        } else {
                            // If it's a string but not an array after parsing, treat it as a single element.
                            fixedData[expectedKey] = [String(value)];
                        }
                    } catch {
                        // If JSON.parse fails, treat the string as a single element in the array.
                        fixedData[expectedKey] = [String(value)];
                    }
                } else {
                    // Default to an empty array if no valid value is found, or if it was an empty object {}.
                    fixedData[expectedKey] = [];
                }
                break;
            default:
                // For unknown types or objects, just assign the value or an empty object.
                fixedData[expectedKey] = value !== undefined ? value : {};
                break;
        }
    }

    // Clear any lingering error messages or retry counts from the failed API call.
    if (window.lastAttemptError) {
        window.lastAttemptError = null;
    }
    if (window.responseRetries) {
        window.responseRetries = 0;
    }
    stopUpdates(); // Stop the loading spinner interval

    console.log("JSON successfully fixed client-side:", fixedData);
    return fixedData;
}