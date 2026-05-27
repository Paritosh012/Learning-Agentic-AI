/**
 * Yatri Travel Bot — Main Entry Point
 *
 * DAYS IMPLEMENTED:
 *   Day 1 — Chat loop, system prompt, session memory (messages array)
 *   Day 2 — /plan command with structured JSON itinerary output
 *   Day 3 — /agent command with tool calling (weather, calculator, time)
 *   Day 4 — Persistent memory: profile loads on start, updates as you chat
 *   PT    — /grumpy mode toggle (practice test PT-1.1)
 *
 * COMMANDS:
 *   /exit        — quit
 *   /reset       — clear conversation history (keeps profile)
 *   /tokens      — show token usage this session
 *   /plan <req>  — generate a structured trip itinerary
 *   /agent <q>   — use the AI agent with real tools
 *   /profile     — show what Yatri remembers about you
 *   /forget      — wipe all persistent memory
 *   /grumpy      — switch to grumpy mode (stays grumpy until /yatri)
 *   /yatri       — switch back to friendly Yatri mode
 
 */

import readline from "readline";

// Day 1
import { chat, getSessionTokens, resetSessionTokens } from "./lib/llm.js";
import { YATRI_SYSTEM_PROMPT } from "./config/personality.js";
import { GRUMPY_SYSTEM_PROMPT } from "./config/grumpy.js";

// Day 2
import { generateItinerary } from "./lib/itineraryGenerator.js";

// Day 3
import { runAgent } from "./lib/agent.js";

// Day 4
import {
  loadProfile,
  saveProfile,
  resetProfile,
} from "./lib/memory/profileStore.js";
import { extractFacts, mergeFacts } from "./lib/memory/factExtractor.js";

// ─────────────────────────────────────────────────────────────────
// STARTUP
// ─────────────────────────────────────────────────────────────────
let profile = await loadProfile();

// "yatri" = friendly default | "grumpy" = grumpy overworked agent
let currentMode = "yatri";

// Conversation history — fresh each session
let history = [{ role: "system", content: YATRI_SYSTEM_PROMPT }];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

function printBanner() {
  console.log("\n╔════════════════════════════════════════════╗");
  console.log("║   🧳  YATRI — Your AI Travel Companion    ║");
  console.log("╚════════════════════════════════════════════╝");

  if (profile.name) {
    console.log(`   👋 Welcome back, ${profile.name}!\n`);
  } else {
    console.log("   👋 Hello! Tell me your name and I'll remember you.\n");
  }

  console.log(
    "Commands: /exit /reset /tokens /plan /agent /profile /forget /grumpy /yatri\n",
  );
}

function printTokenUsage() {
  const t = getSessionTokens();
  console.log(
    `\n📊 Tokens — input: ${t.input}, output: ${t.output}, total: ${t.input + t.output}`,
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

  console.log("\n" + "─".repeat(60));
  console.log(
    `📍 ${(trip_summary.destination || "?").toUpperCase()} — ${trip_summary.duration_days || "?"} days`,
  );

  if (trip_summary.vibe_preference)
    console.log(`🎨 Vibe: ${trip_summary.vibe_preference}`);

  console.log(
    `💰 Total: ₹${(trip_summary.estimated_total_cost_inr || 0).toLocaleString("en-IN")}`,
  );

  if (trip_summary.user_constraints?.length) {
    console.log(`⚠️  Constraints: ${trip_summary.user_constraints.join(", ")}`);
  }

  if (accommodation.type) {
    console.log(
      `\n🏨 Stay: ${accommodation.type}${accommodation.neighborhood_suggestion ? " in " + accommodation.neighborhood_suggestion : ""}`,
    );
    if (accommodation.estimated_cost_per_night_inr) {
      console.log(
        `   ₹${accommodation.estimated_cost_per_night_inr.toLocaleString("en-IN")}/night`,
      );
    }
  }

  if (cost_breakdown.accommodation_total_inr !== undefined) {
    console.log(`\n💸 Cost breakdown:`);
    console.log(
      `   🏨 Accommodation: ₹${(cost_breakdown.accommodation_total_inr || 0).toLocaleString("en-IN")}`,
    );
    console.log(
      `   🎯 Activities:    ₹${(cost_breakdown.activities_total_inr || 0).toLocaleString("en-IN")}`,
    );
    console.log(
      `   🍽️  Food:          ₹${(cost_breakdown.food_total_inr || 0).toLocaleString("en-IN")}`,
    );
    console.log(
      `   🚗 Transport:     ₹${(cost_breakdown.transport_total_inr || 0).toLocaleString("en-IN")}`,
    );
    console.log(
      `   🛟 Buffer:        ₹${(cost_breakdown.buffer_inr || 0).toLocaleString("en-IN")}`,
    );
  }

  console.log("─".repeat(60));

  for (const day of daily_plan) {
    console.log(`\n📅 Day ${day.day} — ${day.theme || ""}`);
    for (const activity of day.activities || []) {
      const time = (activity.time || "").padEnd(10);
      const cat = activity.category ? `[${activity.category}]`.padEnd(12) : "";
      const check = activity.respects_constraints === false ? "⚠️ " : "✓ ";
      const cost = `₹${(activity.estimated_cost_inr || 0).toLocaleString("en-IN")}`;
      console.log(`   ${time} ${cat} ${check}${activity.activity} (${cost})`);
    }
  }

  if (tips.length > 0) {
    console.log("\n💡 Tips:");
    for (const tip of tips) console.log(`   • ${tip}`);
  }

  console.log("─".repeat(60) + "\n");
}

// Fire-and-forget fact extraction — doesn't block user response
function extractAndSave(userMessage) {
  extractFacts(userMessage, profile)
    .then((facts) => {
      if (Object.keys(facts).length > 0) {
        mergeFacts(profile, facts);
        saveProfile(profile).then(() => {
          console.log(`💭 [Saved: ${Object.keys(facts).join(", ")}]\n`);
        });
      }
    })
    .catch(() => {}); // Non-fatal — silently ignore
}

// ─────────────────────────────────────────────────────────────────
// MAIN LOOP
// ─────────────────────────────────────────────────────────────────
async function main() {
  printBanner();

  while (true) {
    // Prompt changes based on mode so user always knows where they are
    const prompt = currentMode === "grumpy" ? "You 😤: " : "You: ";
    const userInput = (await ask(prompt)).trim();
    if (!userInput) continue;

    // ── /exit ──────────────────────────────────────────────────
    if (userInput === "/exit") {
      console.log("\n👋 Safe travels, yaar!");
      printTokenUsage();
      break;
    }

    // ── /reset ─────────────────────────────────────────────────
    if (userInput === "/reset") {
      const prompt =
        currentMode === "grumpy" ? GRUMPY_SYSTEM_PROMPT : YATRI_SYSTEM_PROMPT;
      history = [{ role: "system", content: prompt }];
      resetSessionTokens();
      console.log("🧹 Conversation cleared. Profile memory is still saved.\n");
      continue;
    }

    // ── /tokens ────────────────────────────────────────────────
    if (userInput === "/tokens") {
      printTokenUsage();
      continue;
    }

    // ── /profile ───────────────────────────────────────────────
    if (userInput === "/profile") {
      const { metadata, ...displayProfile } = profile;
      console.log("\n📒 What Yatri remembers about you:\n");
      console.log(JSON.stringify(displayProfile, null, 2));
      if (metadata?.last_updated) {
        console.log(
          `\n   Last updated: ${new Date(metadata.last_updated).toLocaleString()}`,
        );
      }
      console.log("");
      continue;
    }

    // ── /forget ────────────────────────────────────────────────
    if (userInput === "/forget") {
      profile = await resetProfile();
      console.log("\n🧹 Memory wiped. Yatri has forgotten everything.\n");
      continue;
    }

    // ── /grumpy ────────────────────────────────────────────────
    // Persistent grumpy mode — whole conversation becomes grumpy
    // Replaces system prompt, keeps conversation going in grumpy tone
    // ── /grumpy ────────────────────────────────────────────────
    if (userInput === "/grumpy" || userInput.startsWith("/grumpy ")) {
      if (userInput === "/grumpy") {
        // Mode toggle — switch permanently to grumpy
        currentMode = "grumpy";
        history = [{ role: "system", content: GRUMPY_SYSTEM_PROMPT }];
        console.log("\n😤 Grumpy mode ON. Type /yatri to switch back.\n");
        continue;
      }

      // One-shot grumpy — reply grumpily but don't change mode
      const question = userInput.slice(8).trim();
      const grumpyMessages = [
        { role: "system", content: GRUMPY_SYSTEM_PROMPT },
        { role: "user", content: question },
      ];

      try {
        const reply = await chat(grumpyMessages, profile);
        console.log(`\n😤 Grumpy Yatri: ${reply}\n`);
        extractAndSave(question);
      } catch (err) {
        console.error("\n❌ Grumpy stumbled:", err.message, "\n");
      }

      continue;
    }

    // ── /yatri ─────────────────────────────────────────────────
    // Switch back to friendly Yatri
    if (userInput === "/yatri") {
      currentMode = "yatri";
      history = [{ role: "system", content: YATRI_SYSTEM_PROMPT }];
      console.log("\n🧳 Back to friendly Yatri mode, yaar!\n");
      continue;
    }

    // ── /plan ──────────────────────────────────────────────────
    if (userInput.startsWith("/plan ")) {
      const tripRequest = userInput.slice(6).trim();

      if (!tripRequest) {
        console.log(
          "Usage: /plan <description>\nExample: /plan 4 days in Manali, veg, budget 25k\n",
        );
        continue;
      }

      // Silently enrich with profile constraints
      let enrichedRequest = tripRequest;
      if (profile.preferences?.diet)
        enrichedRequest += `. User is ${profile.preferences.diet}.`;
      if (profile.constraints?.family_context)
        enrichedRequest += ` Family context: ${profile.constraints.family_context}.`;
      if (profile.constraints?.fears?.length)
        enrichedRequest += ` Fears: ${profile.constraints.fears.join(", ")}.`;
      if (profile.constraints?.allergies?.length)
        enrichedRequest += ` Allergies: ${profile.constraints.allergies.join(", ")}.`;

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
        console.log(
          "Usage: /agent <your question>\nExample: /agent Should I visit Manali this weekend?\n",
        );
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
            const truncated =
              preview.length > 120 ? preview.slice(0, 120) + "..." : preview;
            console.log(`   📊 → ${truncated}`);
          } else if (step.type === "retry") {
            console.log(
              `   ⚠️  ${step.reason} (${step.retriesLeft} retries left)`,
            );
          } else if (step.type === "final_answer") {
            console.log(`\n🧳 Yatri:\n${step.content}\n`);
          }
        });
      } catch (err) {
        console.error(`\n❌ Agent failed: ${err.message}\n`);
      }

      continue;
    }

    // ── Normal chat (works in both yatri and grumpy mode) ──────
    history.push({ role: "user", content: userInput });

    try {
      const reply = await chat(history, profile);
      history.push({ role: "assistant", content: reply });

      // Display prefix changes based on current mode
      const prefix = currentMode === "grumpy" ? "😤 Grumpy Yatri" : "🧳 Yatri";
      console.log(`\n${prefix}: ${reply}\n`);

      // Extract and save facts from user's message (background)
      extractAndSave(userInput);
    } catch (err) {
      console.error("\n❌ Yatri stumbled:", err.message);
      history.pop();
      console.error("   (Try again, or /reset if it keeps failing)\n");
    }
  }

  rl.close();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
