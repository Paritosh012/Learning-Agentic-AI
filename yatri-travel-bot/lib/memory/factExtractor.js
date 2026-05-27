/**
 * Fact Extractor — uses the LLM to extract user facts from messages.
 *
 * Why use the LLM for this instead of regex?
 *   - "I'm veg" / "I don't eat meat" / "no chicken for me" / "vegetarian since 2019"
 *     all mean the same thing. Regex would miss most of these.
 *   - LLMs handle natural language paraphrase naturally.
 *
 * This runs as a background task — doesn't block the user's main chat response.
 */

import Groq from "groq-sdk";
import "dotenv/config";

const client = new Groq();

const EXTRACTION_PROMPT = `You are a fact extractor for a travel assistant.

Given the user's message and their current profile, extract any NEW facts.
Output a JSON object with ONLY the fields that should be updated.
If nothing new is revealed, output {}.

Valid fields you can update:
- name (string) — ONLY extract if user explicitly says "My name is X",
  "I'm X", or "Call me X". Never extract names from greetings like
  "Hi", "Hello", "Hey". Never infer names from context.
- preferences.diet (string) — "vegetarian", "vegan", "non-vegetarian", "jain", etc.
- preferences.travel_style (string) — "nature", "adventure", "cultural", "relaxation", "mixed"
- preferences.pace (string) — "fast-paced", "relaxed", "moderate"
- preferences.budget_tier (string) — "budget", "mid-range", "luxury"
- constraints.fears (array) — append items like "heights", "water", "crowds"
- constraints.allergies (array) — append items like "peanuts", "lactose"
- constraints.accessibility_needs (array) — append mobility/medical needs
- constraints.family_context (string) — "8-month-old baby", "elderly parents", etc.
- history.places_discussed (array) — append any city/country mentioned in conversation
- history.places_visited (array) — append if user says they've been somewhere
- history.places_wishlist (array) — append if user says they want to go somewhere

RULES:
- Output ONLY valid JSON, no markdown, no commentary.
- Only include fields that have NEW info. Don't repeat what's already in the profile.
- For arrays, output items to APPEND (don't include existing items).
- If the message is just chitchat with no facts, output {}.
- NEVER extract command prefixes like "/grumpy", "/plan", "/agent" as facts.
- Only extract facts from the actual question content.
- NEVER extract abstract words like "nowhere", "somewhere", 
  "anywhere", "everywhere" as places.
- Only extract real, named geographic locations.
- NEVER extract casual address words like "man", "bro", "yaar", 
  "dude", "sir" as names.
- A name must follow explicit patterns: "I'm X", "My name is X", 
  "Call me X".
`;

/**
 * Extract facts from a user message in the context of their profile.
 * @param {string} userMessage
 * @param {Object} currentProfile - the user's existing profile (for context)
 * @returns {Promise<Object>} - partial profile object with only new fields
 */
export async function extractFacts(userMessage, currentProfile) {
  const SKIP_PATTERNS = [
    /^(hi|hello|hey|ok|okay|thanks|bye|yes|no|sure|great)[\s!?.]*$/i,
  ];

  if (SKIP_PATTERNS.some((p) => p.test(userMessage.trim()))) {
    return {}; // Skip LLM call entirely for simple greetings
  }
  try {
    const response = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile", // Cheap model for extraction
      messages: [
        { role: "system", content: EXTRACTION_PROMPT },
        {
          role: "user",
          content: `Current profile:\n${JSON.stringify(currentProfile, null, 2)}\n\nUser message: "${userMessage}"\n\nExtract new facts:`,
        },
      ],
      max_tokens: 512,
      temperature: 0.1, // Very low — we want consistent extraction
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0].message.content;
    return JSON.parse(raw);
  } catch (err) {
    console.error("⚠️  Fact extraction failed:", err.message);
    return {}; // Fail safe — return empty so we don't corrupt the profile
  }
}

/**
 * Merge extracted facts into the existing profile.
 * Handles nested objects and array appending correctly.
 * @param {Object} profile - existing profile (mutated in place)
 * @param {Object} facts - extracted facts (partial profile shape)
 * @returns {Object} - the updated profile
 */
export function mergeFacts(profile, facts) {
  for (const [key, value] of Object.entries(facts)) {
    if (Array.isArray(value)) {
      // For top-level arrays (unlikely in our schema, but safe)
      profile[key] = [...new Set([...(profile[key] || []), ...value])];
    } else if (typeof value === "object" && value !== null) {
      // Nested object — recurse
      if (!profile[key]) profile[key] = {};

      mergeFacts(profile[key], value);
    } else {
      // Top-level scalar
      profile[key] = value;
    }
  }
  return profile;
}
