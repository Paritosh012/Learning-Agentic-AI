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
import { generateItinerary } from "./lib/itineraryGenerator.js";

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

function printItinerary(itinerary) {
  const {
    trip_summary = {},
    accommodation = {},
    cost_breakdown = {},
    daily_plan = [],
    tips = [],
  } = itinerary;

  console.log("─".repeat(60));
  console.log(
    `📍 ${trip_summary.destination.toUpperCase()} — ${trip_summary.duration_days} days`,
  );
  console.log(`🎨 Vibe: ${trip_summary.vibe_preference}`);
  console.log(
    `💰 Total: ₹${trip_summary.estimated_total_cost_inr.toLocaleString("en-IN")}`,
  );

  if (trip_summary.user_constraints.length > 0) {
    console.log(`⚠️  Constraints: ${trip_summary.user_constraints.join(", ")}`);
  }

  console.log(
    `\n🏨 Stay: ${accommodation.type} in ${accommodation.neighborhood_suggestion}`,
  );
  console.log(
    `   ₹${accommodation.estimated_cost_per_night_inr.toLocaleString("en-IN")}/night`,
  );

  console.log(`\n💸 Cost breakdown:`);
  console.log(
    `   🏨 Accommodation: ₹${cost_breakdown.accommodation_total_inr.toLocaleString("en-IN")}`,
  );
  console.log(
    `   🎯 Activities:    ₹${cost_breakdown.activities_total_inr.toLocaleString("en-IN")}`,
  );
  console.log(
    `   🍽️  Food:          ₹${cost_breakdown.food_total_inr.toLocaleString("en-IN")}`,
  );
  console.log(
    `   🚗 Transport:     ₹${cost_breakdown.transport_total_inr.toLocaleString("en-IN")}`,
  );
  console.log(
    `   🛟 Buffer:        ₹${cost_breakdown.buffer_inr.toLocaleString("en-IN")}`,
  );

  console.log("─".repeat(60));

  for (const day of daily_plan) {
    console.log(`\n📅 Day ${day.day} — ${day.theme}`);
    for (const activity of day.activities) {
      const time = activity.time.padEnd(10);
      const cost = `₹${activity.estimated_cost_inr.toLocaleString("en-IN")}`;
      const flag = activity.respects_constraints ? "✓" : "⚠️";
      const cat = `[${activity.category}]`.padEnd(12);
      console.log(`   ${time} ${cat} ${flag} ${activity.activity} (${cost})`);
    }
  }

  console.log("\n💡 Tips:");
  for (const tip of tips) {
    console.log(`   • ${tip}`);
  }

  console.log("─".repeat(60) + "\n");
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

    if (userInput.startsWith("/plan ")) {
      const tripRequest = userInput.slice(6).trim(); // remove "/plan " prefix

      if (!tripRequest) {
        console.log(
          "Usage: /plan <description>\nExample: /plan 4 days in Manali, veg, budget 25k\n",
        );
        continue;
      }

      console.log("\n✈️  Generating itinerary...\n");

      try {
        const itinerary = await generateItinerary(tripRequest);
        printItinerary(itinerary);
      } catch (err) {
        console.error("❌ Couldn't generate itinerary:", err.message);
      }

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
