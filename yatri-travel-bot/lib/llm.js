/**
 * lib/llm.js — Thin LLM wrapper for general chat.
 *
 * DAY 4 CHANGE:
 *   chat() now accepts an optional `profile` parameter.
 *   If provided, the user's remembered facts are injected into
 *   the system prompt by replacing the {{PROFILE_CONTEXT}} placeholder.
 *   If no profile, the placeholder is removed silently.
 *
 * WHY A WRAPPER?
 *   - Single place to swap providers (Groq → Gemini → Ollama)
 *   - Single place for token tracking, retries, logging
 *   - Rest of the app just calls chat() and doesn't care how it works
 */

import Groq from "groq-sdk";
import "dotenv/config";
import { formatProfileForPrompt } from "./memory/memoryFormatter.js";

const client = new Groq();

// Tracks total tokens used in this session
let sessionTokens = { input: 0, output: 0 };

/**
 * Send a conversation to the LLM and get a reply.
 *
 * @param {Array<{role: string, content: string}>} messages
 *   Full conversation history. System prompt must be at index 0.
 * @param {Object|null} profile
 *   Optional user profile for personalization. If provided, facts
 *   are injected into the system prompt automatically.
 * @returns {Promise<string>} The LLM's reply text.
 */
export async function chat(messages, profile = null) {
  // Inject profile into the system prompt (replaces {{PROFILE_CONTEXT}})
  const processedMessages = messages.map(m => {
    if (m.role !== "system") return m;
    const profileContext = profile ? formatProfileForPrompt(profile) : "";
    return { ...m, content: m.content.replace("{{PROFILE_CONTEXT}}", profileContext) };
  });

  const response = await client.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: processedMessages,
    max_tokens: 1024,
    temperature: 0.7   // 0 = robotic, 1 = creative, 0.7 = friendly sweet spot
  });

  sessionTokens.input  += response.usage.prompt_tokens;
  sessionTokens.output += response.usage.completion_tokens;

  return response.choices[0].message.content;
}

/** Get total tokens used this session. Returns a copy (defensive). */
export function getSessionTokens() {
  return { ...sessionTokens };
}

/** Reset token counter (called on /reset). */
export function resetSessionTokens() {
  sessionTokens = { input: 0, output: 0 };
}