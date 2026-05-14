/**
 * The Agent Loop — implements ReAct (Reason + Act).
 *
 * THE PATTERN:
 *   1. Send conversation + tools to LLM
 *   2. If LLM responds with text → return it (done)
 *   3. If LLM responds with tool_call → execute tool, append result
 *   4. Loop back to step 1
 *
 * SAFETY FEATURES:
 *   - Max 10 iterations (prevents infinite loops)
 *   - Auto-retry on tool_use_failed (LLM format slip)
 *   - Errors returned as data, not thrown (graceful degradation)
 *
 * BUGS FIXED:
 *   v1 → v2: Added TOOL FORMAT instruction to system prompt
 *             (prevents XML-style tool call format slips)
 *   v1 → v2: Added retry wrapper with exponential backoff
 *             (recovers from tool_use_failed errors automatically)
 */

import Groq from "groq-sdk";
import "dotenv/config";
import { TOOL_SCHEMAS, TOOL_REGISTRY } from "../config/tools.js";

const client = new Groq();
const MAX_ITERATIONS = 10;
const MAX_RETRIES = 2;

// ============================================================
// SYSTEM PROMPT — v2 (added TOOL FORMAT section)
// ============================================================

const AGENT_SYSTEM_PROMPT = `You are Yatri, an AI travel agent with access to real tools.

You have access to three tools:
- getWeather: current weather for any city
- calculator: math evaluator (use for ALL arithmetic)
- currentTime: real current date and time

CRITICAL RULES:
- When the user mentions 'today', 'tomorrow', 'this weekend', 'next month' — call currentTime FIRST.
- When the user asks about weather, season, packing, or visit timing — call getWeather.
- For ANY arithmetic (costs, totals, distances, days) — call calculator. Never do math in your head.
- After using tools, give a friendly, concise answer based on the tool results.
- If a tool returns an error, acknowledge it politely and try a different approach.
- Keep final answers under 5 sentences. Use bullet points for lists.

TOOL FORMAT (critical — never violate):
Always use the structured tool_call JSON format provided by the API.
NEVER use XML-style tags like <function=getWeather{...}></function>.
NEVER use plain text to describe a tool call.
Only call tools using the proper structured format.


TIPS:
-Always show details about the famous places first if user asks about any city's wheather or anything else.For example :- 
  User: /agent what is the weather in manali
  Yatri should first search for the famous city manali(or whatever city user asks) which is located in himachal pradesh, then reply
`;

// ============================================================
// PUBLIC ENTRY POINT — with retry wrapper
// ============================================================

/**
 * Run the agent loop. Automatically retries on tool format errors.
 *
 * @param {string} userMessage   — the user's question
 * @param {Function} [onStep]    — callback for each step (tool calls, results, etc.)
 * @param {number} [retries]     — internal: retry counter (don't pass manually)
 * @returns {Promise<string>}    — final answer text
 */
export async function runAgent(
  userMessage,
  onStep = () => {},
  retries = MAX_RETRIES,
) {
  try {
    return await _runAgentLoop(userMessage, onStep);
  } catch (err) {
    // ─────────────────────────────────────────────────────────
    // Detect tool_use_failed: LLM generated wrong tool format.
    // Common with open-source models on short/vague prompts.
    // Fix: retry — the model almost always gets it right second time.
    // ─────────────────────────────────────────────────────────
    const isToolFormatError =
      err.message?.includes("tool_use_failed") ||
      err.message?.includes("Failed to call a function");

    if (isToolFormatError && retries > 0) {
      onStep({
        type: "retry",
        retriesLeft: retries - 1,
        reason: "Tool format error — model used wrong syntax. Retrying...",
      });

      // Brief pause before retry — helps model "reset"
      // Exponential backoff: 500ms, 1000ms, 2000ms...
      const delay = 500 * (MAX_RETRIES - retries + 1);
      await new Promise((r) => setTimeout(r, delay));

      return await runAgent(userMessage, onStep, retries - 1);
    }

    // Non-retryable error — bubble up to index.js
    throw err;
  }
}

// ============================================================
// INTERNAL LOOP — the actual ReAct engine
// ============================================================

/**
 * Internal agent loop. Not exported — always call runAgent() instead.
 * runAgent() wraps this with retry logic.
 */
async function _runAgentLoop(userMessage, onStep) {
  const messages = [
    { role: "system", content: AGENT_SYSTEM_PROMPT },
    { role: "user", content: userMessage },
  ];

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    onStep({ type: "iteration", number: iteration + 1 });

    // ─────────────────────────────────────────────────────────
    // Call the LLM with conversation + tool definitions
    // ─────────────────────────────────────────────────────────
    const response = await client.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages,
      tools: TOOL_SCHEMAS,
      tool_choice: "auto",
      temperature: 0.3,
      max_tokens: 1024,
    });

    const choice = response.choices[0];
    const assistantMessage = choice.message;

    // ─────────────────────────────────────────────────────────
    // CASE 1: LLM wants to call tools
    // ─────────────────────────────────────────────────────────
    if (choice.finish_reason === "tool_calls" && assistantMessage.tool_calls) {
      messages.push(assistantMessage);

      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;

        // Safely parse arguments — malformed JSON shouldn't crash the loop
        let toolArgs;
        try {
          toolArgs = JSON.parse(toolCall.function.arguments);
        } catch {
          toolArgs = {};
        }

        onStep({ type: "tool_call", name: toolName, args: toolArgs });

        const tool = TOOL_REGISTRY[toolName];

        let toolResult;
        if (!tool) {
          toolResult = {
            error: `Unknown tool: "${toolName}". Available: ${Object.keys(TOOL_REGISTRY).join(", ")}`,
          };
        } else {
          try {
            toolResult = await tool(toolArgs);
          } catch (err) {
            toolResult = {
              error: `Tool "${toolName}" crashed: ${err.message}`,
            };
          }
        }

        onStep({ type: "tool_result", name: toolName, result: toolResult });

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult),
        });
      }

      continue; // loop again with tool results in context
    }

    // ─────────────────────────────────────────────────────────
    // CASE 2: LLM responded with final text — done
    // ─────────────────────────────────────────────────────────
    if (assistantMessage.content) {
      onStep({ type: "final_answer", content: assistantMessage.content });
      return assistantMessage.content;
    }

    // ─────────────────────────────────────────────────────────
    // CASE 3: Neither tool_calls nor text — unexpected
    // ─────────────────────────────────────────────────────────
    throw new Error(
      `Unexpected agent response at iteration ${iteration + 1}: ${JSON.stringify(choice)}`,
    );
  }

  throw new Error(
    `Agent exceeded max iterations (${MAX_ITERATIONS}). The query may be too complex.`,
  );
}
