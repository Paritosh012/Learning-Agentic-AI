/**
 * Yatri Travel Bot — Day 1 mini-project
 *
 * A CLI bot that demonstrates:
 *  - Stateless LLM API calls
 *  - Client-side memory via the messages array
 *  - System prompts as personality
 *  - Token cost awareness
 *
 * Special commands:
 *   /exit    — quit
 *   /reset   — clear conversation memory
 *   /tokens  — show session token usage
 */

import readline from "readline";
import { chat, getSessionTokens, resetSessionTokens } from "./lib/llm.js";
import { YATRI_SYSTEM_PROMPT } from "./config/personality.js";

// 🧠 The conversation history — OUR memory, not the LLM's.
// Starts with just the system prompt; grows as the chat continues.
let history = [{ role: "system", content: YATRI_SYSTEM_PROMPT }];

// Setup CLI input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

function printBanner() {
  console.log("\n╔════════════════════════════════════════════╗");
  console.log("║   🧳  YATRI — Your AI Travel Companion    ║");
  console.log("╚════════════════════════════════════════════╝");
  console.log("Commands:  /exit  /reset  /tokens\n");
}

function printTokenUsage() {
  const t = getSessionTokens();
  const total = t.input + t.output;
  console.log(
    `\n📊 Session tokens — input: ${t.input}, output: ${t.output}, total: ${total}`,
  );
  console.log(`   History size: ${history.length} messages\n`);
}

async function main() {
  printBanner();

  while (true) {
    const userInput = (await ask("You: ")).trim();

    // Skip empty inputs
    if (!userInput) continue;

    // Handle special commands
    if (userInput === "/exit") {
      console.log("\n👋 Safe travels, yaar!");
      printTokenUsage();
      break;
    }

    if (userInput === "/reset") {
      history = [{ role: "system", content: YATRI_SYSTEM_PROMPT }];
      resetSessionTokens();
      console.log("🧹 Memory cleared. Fresh start!\n");
      continue;
    }

    if (userInput === "/tokens") {
      printTokenUsage();
      continue;
    }

    // Normal chat turn
    history.push({ role: "user", content: userInput });

    try {
      const reply = await chat(history);
      history.push({ role: "assistant", content: reply });
      console.log(`\n🧳 Yatri: ${reply}\n`);
    } catch (err) {
      console.error("\n❌ Yatri stumbled:", err.message);
      // Remove the failed user message so history stays clean
      history.pop();
      console.error("   (Try again, or /reset if it keeps failing)\n");
    }
  }

  rl.close();
}

main();
