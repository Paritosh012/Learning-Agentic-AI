/**
 * Tool Registry — the "menu" given to the LLM.
 *
 * Two parts to this file:
 *   1. TOOL_SCHEMAS  → descriptions sent to the LLM (the menu)
 *   2. TOOL_REGISTRY → actual implementations (the kitchen)
 *
 * The LLM only sees TOOL_SCHEMAS. When it picks a tool, our agent
 * loop looks up the implementation in TOOL_REGISTRY and runs it.
 *
 * KEY INSIGHT: The descriptions ARE the prompt engineering.
 * Lazy descriptions = LLM forgets to use the tool.
 * Sharp descriptions = LLM uses them confidently and appropriately.
 */

import { getWeather } from "../lib/tools/getWeather.js";
import { calculator } from "../lib/tools/calculator.js";
import { currentTime } from "../lib/tools/currentTime.js";

// ============================================================
// 1. SCHEMAS — what the LLM sees (sent in every API call)
// ============================================================

export const TOOL_SCHEMAS = [
  {
    type: "function",
    function: {
      name: "getWeather",
      description:
        "Get current weather conditions for a city. Use this whenever the user mentions weather, season, " +
        "what to pack, or asks 'is X a good time to visit Y'. ALWAYS call this before answering " +
        "season-sensitive or weather-dependent questions.",
      parameters: {
        type: "object",
        properties: {
          city: {
            type: "string",
            description:
              "City name in English (e.g., 'Manali', 'Goa', 'Paris')",
          },
        },
        required: ["city"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calculator",
      description:
        "Evaluate a math expression. ALWAYS use this for any arithmetic — totals, sums, multiplications, " +
        "budget calculations. You (the LLM) are bad at math and will make errors. Never compute numbers " +
        "in your head. Pass the full expression as a string.",
      parameters: {
        type: "object",
        properties: {
          expression: {
            type: "string",
            description:
              "A math expression using digits and + - * / ( ) . Example: '2500 * 15 + 800'",
          },
        },
        required: ["expression"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "currentTime",
      description:
        "Get the current date, day of week, and time. Use this WHENEVER the user mentions 'today', " +
        "'tomorrow', 'this weekend', 'next month', or any time-relative phrase. Your training data " +
        "is months/years old — always check the real current time before reasoning about dates.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
];
 
// ============================================================
// 2. REGISTRY — the actual implementations
// ============================================================

export const TOOL_REGISTRY = {
  getWeather,
  calculator,
  currentTime,
};
