/**
 * Yatri Travel Bot — Main Entry Point
 *
 * DAYS IMPLEMENTED:
 *   Day 1 — Chat loop, system prompt, session memory (messages array)
 *   Day 2 — /plan command with structured JSON itinerary output
 *   Day 3 — /agent command with tool calling (weather, calculator, time)
 *   Day 4 — Persistent memory: profile loads on start, updates as you chat
 *
 * COMMANDS:
 *   /exit    — quit
 *   /reset   — clear conversation history (keeps personality + profile)
 *   /tokens  — show token usage this session
 *   /plan    — generate a structured trip itinerary
 *   /agent   — use the AI agent with real tools (weather, math, time)
 *   /profile — show what Yatri remembers about you
 *   /forget  — clear all memory (wipe the profile)
 */

import readline from "readline";

// Day 1 — chat
import { chat, getSessionTokens, resetSessionTokens } from "./lib/llm.js";
import { YATRI_SYSTEM_PROMPT } from "./config/personality.js";

// Day 2 — itinerary
import { generateItinerary } from "./lib/itineraryGenerator.js";

// Day 3 — agent
import { runAgent } from "./lib/agent.js";

// Day 4 — memory
import { loadProfile, saveProfile, resetProfile } from "./lib/memory/profileStore.js";
import { extractFacts, mergeFacts } from "./lib/memory/factExtractor.js";

// ─────────────────────────────────────────────────────────────────
// STARTUP — load the user's memory notebook before anything else
// ─────────────────────────────────────────────────────────────────
let profile = await loadProfile();

// Conversation history — fresh each session (session memory, not persistent)
let history = [{ role: "system", content: YATRI_SYSTEM_PROMPT }];

// CLI setup
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

// ─────────────────────────────────────────────────────────────────
// BANNER
// ─────────────────────────────────────────────────────────────────
function printBanner() {
  console.log("\n╔════════════════════════════════════════════╗");
  console.log("║   🧳  YATRI — Your AI Travel Companion    ║");
  console.log("╚════════════════════════════════════════════╝");

  // Personalized greeting if we know the user's name
  if (profile.name) {
    console.log(`   👋 Welcome back, ${profile.name}!\n`);
  } else {
    console.log("   👋 Hello! Tell me your name and I'll remember you.\n");
  }

  console.log("Commands: /exit  /reset  /tokens  /plan  /agent  /profile  /forget\n");
}

// ─────────────────────────────────────────────────────────────────
// TOKEN USAGE
// ─────────────────────────────────────────────────────────────────
function printTokenUsage() {
  const t = getSessionTokens();
  const total = t.input + t.output;
  console.log(`\n📊 Session tokens — input: ${t.input}, output: ${t.output}, total: ${total}`);
  console.log(`   History size: ${history.length} messages\n`);
}

// ─────────────────────────────────────────────────────────────────
// ITINERARY PRINTER (Day 2)
// ─────────────────────────────────────────────────────────────────
function printItinerary(itinerary) {
  const {
    trip_summary    = {},
    accommodation   = {},
    cost_breakdown  = {},
    daily_plan      = [],
    tips            = []
  } = itinerary;

  console.log("\n" + "─".repeat(60));
  console.log(`📍 ${(trip_summary.destination || "?").toUpperCase()} — ${trip_summary.duration_days || "?"} days`);

  if (trip_summary.vibe_preference) {
    console.log(`🎨 Vibe: ${trip_summary.vibe_preference}`);
  }

  console.log(`💰 Total: ₹${(trip_summary.estimated_total_cost_inr || 0).toLocaleString("en-IN")}`);

  if (trip_summary.user_constraints?.length) {
    console.log(`⚠️  Constraints: ${trip_summary.user_constraints.join(", ")}`);
  }

  if (accommodation.type) {
    console.log(`\n🏨 Stay: ${accommodation.type}${accommodation.neighborhood_suggestion ? " in " + accommodation.neighborhood_suggestion : ""}`);
    if (accommodation.estimated_cost_per_night_inr) {
      console.log(`   ₹${accommodation.estimated_cost_per_night_inr.toLocaleString("en-IN")}/night`);
    }
  }

  if (cost_breakdown.accommodation_total_inr !== undefined) {
    console.log(`\n💸 Cost breakdown:`);
    console.log(`   🏨 Accommodation: ₹${(cost_breakdown.accommodation_total_inr || 0).toLocaleString("en-IN")}`);
    console.log(`   🎯 Activities:    ₹${(cost_breakdown.activities_total_inr || 0).toLocaleString("en-IN")}`);
    console.log(`   🍽️  Food:          ₹${(cost_breakdown.food_total_inr || 0).toLocaleString("en-IN")}`);
    console.log(`   🚗 Transport:     ₹${(cost_breakdown.transport_total_inr || 0).toLocaleString("en-IN")}`);
    console.log(`   🛟 Buffer:        ₹${(cost_breakdown.buffer_inr || 0).toLocaleString("en-IN")}`);
  }

  console.log("─".repeat(60));

  for (const day of daily_plan) {
    console.log(`\n📅 Day ${day.day} — ${day.theme || ""}`);
    for (const activity of day.activities || []) {
      const time     = (activity.time || "").padEnd(10);
      const cat      = activity.category ? `[${activity.category}]`.padEnd(12) : "";
      const check    = activity.respects_constraints === false ? "⚠️ " : "✓ ";
      const cost     = `₹${(activity.estimated_cost_inr || 0).toLocaleString("en-IN")}`;
      console.log(`   ${time} ${cat} ${check}${activity.activity} (${cost})`);
    }
  }

  if (tips.length > 0) {
    console.log("\n💡 Tips:");
    for (const tip of tips) {
      console.log(`   • ${tip}`);
    }
  }

  console.log("─".repeat(60) + "\n");
}

// ─────────────────────────────────────────────────────────────────
// MAIN LOOP
// ─────────────────────────────────────────────────────────────────
async function main() {
  printBanner();

  while (true) {
    const userInput = (await ask("You: ")).trim();
    if (!userInput) continue;

    // ── /exit ──────────────────────────────────────────────────
    if (userInput === "/exit") {
      console.log("\n👋 Safe travels, yaar!");
      printTokenUsage();
      break;
    }

    // ── /reset ─────────────────────────────────────────────────
    // Clears conversation history but KEEPS the profile (persistent memory)
    if (userInput === "/reset") {
      history = [{ role: "system", content: YATRI_SYSTEM_PROMPT }];
      resetSessionTokens();
      console.log("🧹 Conversation cleared. (Your profile memory is still saved.)\n");
      continue;
    }

    // ── /tokens ────────────────────────────────────────────────
    if (userInput === "/tokens") {
      printTokenUsage();
      continue;
    }

    // ── /profile ───────────────────────────────────────────────
    // Show what Yatri remembers about the user
    if (userInput === "/profile") {
      const { metadata, ...displayProfile } = profile;
      console.log("\n📒 What Yatri remembers about you:\n");
      console.log(JSON.stringify(displayProfile, null, 2));
      if (metadata?.last_updated) {
        console.log(`\n   Last updated: ${new Date(metadata.last_updated).toLocaleString()}`);
      }
      console.log("");
      continue;
    }

    // ── /forget ────────────────────────────────────────────────
    // Wipe the persistent memory (the profile notebook)
    if (userInput === "/forget") {
      profile = await resetProfile();
      console.log("\n🧹 Memory wiped. Yatri has forgotten everything about you.\n");
      continue;
    }

    // ── /plan ──────────────────────────────────────────────────
    if (userInput.startsWith("/plan ")) {
      const tripRequest = userInput.slice(6).trim();

      if (!tripRequest) {
        console.log("Usage: /plan <description>\nExample: /plan 4 days in Manali, veg, budget 25k\n");
        continue;
      }

      // Enrich the request with profile if we know relevant facts
      let enrichedRequest = tripRequest;
      if (profile.preferences?.diet) {
        enrichedRequest += `. User is ${profile.preferences.diet}.`;
      }
      if (profile.constraints?.family_context) {
        enrichedRequest += ` Family context: ${profile.constraints.family_context}.`;
      }
      if (profile.constraints?.fears?.length) {
        enrichedRequest += ` Fears: ${profile.constraints.fears.join(", ")}.`;
      }

      console.log("\n✈️  Generating itinerary...\n");

      try {
        const itinerary = await generateItinerary(enrichedRequest);
        printItinerary(itinerary);
      } catch (err) {
        console.error("❌ Couldn't generate itinerary:", err.message, "\n");
      }

      continue;
    }

    // ── /agent ─────────────────────────────────────────────────
    if (userInput.startsWith("/agent ")) {
      const question = userInput.slice(7).trim();

      if (!question) {
        console.log("Usage: /agent <your question>\nExample: /agent Should I visit Manali this weekend?\n");
        continue;
      }

      console.log("\n🤖 Agent working...\n");

      try {
        await runAgent(question, (step) => {
          if (step.type === "iteration" && step.number > 1) {
            console.log(`   ─── iteration ${step.number} ───`);
          } else if (step.type === "tool_call") {
            console.log(`   🔧 ${step.name}(${JSON.stringify(step.args)})`);
          } else if (step.type === "tool_result") {
            const preview = JSON.stringify(step.result);
            const truncated = preview.length > 120 ? preview.slice(0, 120) + "..." : preview;
            console.log(`   📊 → ${truncated}`);
          } else if (step.type === "retry") {
            console.log(`   ⚠️  ${step.reason} (${step.retriesLeft} retries left)`);
          } else if (step.type === "final_answer") {
            console.log(`\n🧳 Yatri:\n${step.content}\n`);
          }
        });
      } catch (err) {
        console.error(`\n❌ Agent failed: ${err.message}\n`);
      }

      continue;
    }

    // ── Normal chat turn ───────────────────────────────────────
    history.push({ role: "user", content: userInput });

    try {
      // Pass profile so Yatri can personalize the response
      const reply = await chat(history, profile);
      history.push({ role: "assistant", content: reply });
      console.log(`\n🧳 Yatri: ${reply}\n`);

      // ── Background fact extraction (Day 4) ──────────────────
      // Don't await — runs in background so user isn't waiting
      extractFacts(userInput, profile).then(facts => {
        if (Object.keys(facts).length > 0) {
          mergeFacts(profile, facts);
          saveProfile(profile);
          console.log(`   💭 [Remembered: ${Object.keys(facts).join(", ")}]\n`);
        }
      }).catch(() => {
        // Fact extraction failure is non-fatal — silently ignore
      });

    } catch (err) {
      console.error("\n❌ Yatri stumbled:", err.message);
      history.pop();  // Remove failed user message to keep history clean
      console.error("   (Try again, or /reset if it keeps failing)\n");
    }
  }

  rl.close();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});