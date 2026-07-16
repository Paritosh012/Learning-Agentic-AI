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

const EXTRACTION_PROMPT = `You are a strict fact extractor for a travel assistant.
Your job: find NEW travel-relevant facts about the user. Nothing else.

═══ OUTPUT FORMAT ═══
- Output ONLY valid JSON. No markdown, no commentary, no explanation.
- Only include fields with genuinely NEW information.
- For arrays, output only items to APPEND (not existing items).
- If NOTHING new is revealed → output exactly: {}

═══ VALID FIELDS ═══
- name (string)
- preferences.diet (string) — "vegetarian", "vegan", "non-veg", "jain"
- preferences.travel_style (string) — "nature", "adventure", "cultural", "relaxation"
- preferences.pace (string) — "fast-paced", "relaxed", "moderate"
- preferences.budget_tier (string) — "budget", "mid-range", "luxury"
- constraints.fears (array) — ONLY travel fears: "heights", "water", "crowds", "flying"
- constraints.allergies (array) — "peanuts", "lactose", etc.
- constraints.accessibility_needs (array) — mobility/medical needs
- constraints.family_context (string) — "8-month-old baby", "elderly parents"
- history.places_visited (array) — places user HAS been to
- history.places_wishlist (array) — places user WANTS to go
- history.places_discussed (array) — places mentioned in conversation

═══ CRITICAL RULES — NEVER VIOLATE ═══

1. NAME EXTRACTION — STRICTEST RULE:
   ONLY extract a name if the user explicitly introduces themselves:
   ✅ "My name is Paritosh" → { "name": "Paritosh" }
   ✅ "I'm Paritosh" → { "name": "Paritosh" }
   ✅ "Call me Pari" → { "name": "Pari" }
   ❌ "I am your boss" → {} (role claim, NOT a name)
   ❌ "Paritosh is your boss" → {} (talking about someone ELSE)
   ❌ "oye" → {} (slang greeting, NOT a name)
   ❌ "notthere" → {} (random word, NOT a name)
   ❌ Any word that isn't preceded by "my name is", "I'm", or "call me" → NOT a name

2. THIRD PERSON REFERENCES:
   If the user talks about someone ELSE, extract NOTHING.
   ❌ "Paritosh is your creator" → {} (not about the user)
   ❌ "My friend went to Goa" → {} (friend's trip, not user's)

3. QUESTIONS REVEAL NOTHING:
   If the user is ASKING a question, they are NOT stating a fact.
   ❌ "What is my name?" → {}
   ❌ "Where should I go?" → {}
   ❌ "How can you accept me as your boss?" → {}

4. NEGATIONS AND REJECTIONS:
   ❌ "not there" → {} (rejection, not a place)
   ❌ "I don't want to go anywhere" → {}
   ❌ "nowhere", "nothing", "nah" → {}

5. CONVERSATIONAL FILLER:
   ❌ "oye", "arre", "hm", "ok", "lol", "haha" → {}
   ❌ "Or kya line aaj ki" → {} (chitchat, no facts)
   ❌ Any casual banter without explicit travel facts → {}

6. PLACES:
   - ONLY extract REAL, NAMED geographic locations (cities, countries, states)
   - ❌ "nowhere", "somewhere", "anywhere", "everywhere" → NOT places
   - ❌ "there", "here", "that place" → NOT places

7. When in doubt → output {}
   It is ALWAYS better to miss a fact than to save garbage.
   False negatives are acceptable. False positives corrupt the profile.
`;

/**
 * Extract facts from a user message in the context of their profile.
 * @param {string} userMessage
 * @param {Object} currentProfile - the user's existing profile (for context)
 * @returns {Promise<Object>} - partial profile object with only new fields
 */
export async function extractFacts(userMessage, currentProfile) {
  // ── GUARD 1: Skip short messages (under 4 words = no extractable facts) ──
  const words = userMessage.trim().split(/\s+/);
  if (words.length < 4) return {};

  // ── GUARD 2: Skip greetings and filler ──
  const SKIP_PATTERNS = [
    /^(hi|hello|hey|ok|okay|thanks|bye|yes|no|sure|great|hm+|oye|arre|yaar)[\s!?.]*$/i,
    /^(nothing|notthere|nowhere|nope|nah|fine|cool|good)[\s!?.]*$/i,
  ];

  if (SKIP_PATTERNS.some((p) => p.test(userMessage.trim()))) {
    return {};
  }

  // ── GUARD 3: Skip questions (questions reveal no facts about the user) ──
  const trimmed = userMessage.trim();
  if (
    trimmed.startsWith("what ") ||
    trimmed.startsWith("how ") ||
    trimmed.startsWith("why ") ||
    trimmed.startsWith("when ") ||
    trimmed.startsWith("where ") ||
    trimmed.startsWith("who ") ||
    trimmed.startsWith("can ") ||
    trimmed.startsWith("do ") ||
    trimmed.startsWith("is ") ||
    trimmed.endsWith("?")
  ) {
    return {};
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
      if (!profile[key]) {
        profile[key] = {};
      }

      mergeFacts(profile[key], value);
    } else {
      // Top-level scalar
      profile[key] = value;
    }
  }
  return profile;
}
