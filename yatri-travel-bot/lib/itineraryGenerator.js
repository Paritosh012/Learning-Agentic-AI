/**
 * Itinerary Generator — specialized LLM caller for structured JSON output.
 *
 * Differences from chat() in llm.js:
 *  - Uses `response_format: { type: "json_object" }` for guaranteed JSON
 *  - No personality system prompt — uses ITINERARY_SYSTEM_PROMPT instead
 *  - Returns a parsed object, not a string
 *  - Uses temperature 0.3 (lower = more reliable JSON)
 */

import Groq from "groq-sdk";
import "dotenv/config";
import { ITINERARY_SYSTEM_PROMPT } from "../config/itinerarySchema.js";

const client = new Groq();

/**
 * Generate a structured itinerary from a natural-language request.
 *
 * @param {string} userRequest - e.g., "4 days in Manali, veg, scared of heights"
 * @returns {Promise<object>} - parsed itinerary JSON object
 * @throws {Error} - if the LLM returns invalid JSON or wrong shape
 */
export async function generateItinerary(userRequest) {
  const response = await client.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: ITINERARY_SYSTEM_PROMPT },
      { role: "user", content: userRequest },
    ],
    max_tokens: 8192,
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  // 🚨 Detect truncation BEFORE parsing
  const finishReason = response.choices[0].finish_reason;
  if (finishReason === "length") {
    throw new Error(
      `Itinerary too long for current token budget (max_tokens hit). ` +
        `Try a shorter trip duration or increase max_tokens. ` +
        `Used: ${response.usage.completion_tokens} tokens.`,
    );
  }

  const rawJson = response.choices[0].message.content;

  let itinerary;
  try {
    itinerary = JSON.parse(rawJson);
  } catch (parseErr) {
    throw new Error(
      `Invalid JSON. Raw output:\n${rawJson}\n\nParse error: ${parseErr.message}`,
    );
  }

  // Validate critical fields exist
  if (!itinerary.trip_summary || !Array.isArray(itinerary.daily_plan)) {
    throw new Error(
      `Wrong JSON shape. Got:\n${JSON.stringify(itinerary, null, 2)}`,
    );
  }

  return itinerary;
}
