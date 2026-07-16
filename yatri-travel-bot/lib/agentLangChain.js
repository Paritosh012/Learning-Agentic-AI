/**
 * agentLangChain.js — LangChain version of the ReAct agent
 *
 * COMPARE WITH agent.js:
 *
 *   agent.js (manual):
 *     - 150 lines
 *     - Manual message building
 *     - Manual tool execution loop
 *     - Manual finish_reason checking
 *     - Manual retry logic
 *
 *   agentLangChain.js (framework):
 *     - ~50 lines
 *     - createReactAgent handles the loop
 *     - Tool execution handled internally
 *     - Retry built in
 *
 *   SAME BEHAVIOR. Less code. More magic hidden.
 *   You understand the magic because you built it manually first.
 */

import { ChatGroq } from "@langchain/groq";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { tools } from "../config/toolsLangChain.js";
import "dotenv/config";

// ─────────────────────────────────────────────────────────────────
// The LLM — same model as your manual agent
// ─────────────────────────────────────────────────────────────────
const llm = new ChatGroq({
  model: "openai/gpt-oss-120b",
  temperature: 0.3,
});

// ─────────────────────────────────────────────────────────────────
// The agent — createReactAgent IS your entire agent.js loop
// It internally does: build messages → call LLM → check tool_calls
// → execute tools → loop again → return final answer
// ─────────────────────────────────────────────────────────────────
const agent = createReactAgent({
  llm,
  tools,
});

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

// ─────────────────────────────────────────────────────────────────
// PUBLIC FUNCTION — same signature as your manual runAgent()
// Drop-in replacement — index.js doesn't need to change
// ─────────────────────────────────────────────────────────────────
export async function runAgentLangChain(userMessage, onStep = () => {}) {
  try {
    onStep({ type: "iteration", number: 1 });

    const result = await agent.invoke({
      messages: [
        new SystemMessage(AGENT_SYSTEM_PROMPT),
        new HumanMessage(userMessage),
      ],
    });

    // LangChain returns all messages — final answer is the last one
    const messages = result.messages;
    const finalMessage = messages[messages.length - 1];
    const finalAnswer = finalMessage.content;

    // Emit tool calls for visibility (same as your manual onStep)
    for (const msg of messages) {
      if (msg.constructor.name === "AIMessage" && msg.tool_calls?.length) {
        for (const toolCall of msg.tool_calls) {
          onStep({
            type: "tool_call",
            name: toolCall.name,
            args: toolCall.args,
          });
        }
      }
      if (msg.constructor.name === "ToolMessage") {
        onStep({ type: "tool_result", name: msg.name, result: msg.content });
      }
    }

    onStep({ type: "final_answer", content: finalAnswer });
    return finalAnswer;
  } catch (err) {
    // Rate limit — wait and retry once
    if (err.message?.includes("429") && !this._rateLimitRetried) {
      this._rateLimitRetried = true;
      console.log("   ⏳ Rate limited. Waiting 10 seconds...");
      await new Promise((r) => setTimeout(r, 10000));
      return runAgentLangChain(userMessage, onStep);
    }
    throw new Error(`LangChain agent failed: ${err.message}`);
  }
}
