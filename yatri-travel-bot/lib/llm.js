/**
 * Thin LLM wrapper — hides Groq SDK details from the rest of the app.
 * 
 * Why a wrapper?
 * - If we switch from Groq to Gemini/Claude/Ollama later, ONLY THIS FILE changes.
 * - Single place to add retries, logging, cost tracking.
 * - The rest of the codebase just calls chat() and doesn't care how it works.
 */

import Groq from "groq-sdk";
import "dotenv/config";

const client = new Groq(); // auto-reads GROQ_API_KEY from .env

// Track total tokens used in this session (for the /tokens command)
let sessionTokens = { input: 0, output: 0 };

/**
 * Send a conversation to the LLM and get a reply.
 * 
 * @param {Array<{role: string, content: string}>} messages - full conversation history
 * @returns {Promise<string>} - the LLM's reply text
 */
export async function chat(messages) {
  const response = await client.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages,
    max_tokens: 1024,
    temperature: 0.7  // 0 = robotic, 1 = creative. 0.7 = friendly sweet spot.
  });

  // Track token usage across the session
  sessionTokens.input += response.usage.prompt_tokens;
  sessionTokens.output += response.usage.completion_tokens;

  return response.choices[0].message.content;
}

/** Get total tokens used so far in this session. */
export function getSessionTokens() {
  return { ...sessionTokens };
}

/** Reset token counter (useful when /reset is called). */
export function resetSessionTokens() {
  sessionTokens = { input: 0, output: 0 };
}