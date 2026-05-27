# 🧳 Yatri — Agentic AI Bootcamp Journey

> **Developer:** Sir (Paritosh)
> **Stack:** Node.js · Groq API · Llama 3.3 / GPT-OSS · Open-Meteo
> **Goal:** Learn agentic AI in 2 weeks, integrate into a real travel SaaS
> **Started:** May 9, 2026
> **Interview deadline:** May 18, 2026 (compressed to 5-day core bootcamp)

---

## 🗺️ What Is This Project?

**Yatri** is an AI travel companion built progressively over 5 days.
It started as a 50-line CLI chatbot and evolved into a production-grade
agentic AI feature with real tools, persistent memory, and multiple personalities.

Every day adds a new capability. Every bug is documented. Every lesson is real.

This README is a living document — updated at the end of each day.

---

## 📅 Day-by-Day Journey

---

### ✅ Day 1 — Foundations (May 9, 2026)

**Theme:** Talk to an LLM for the first time. Understand the basics.

**What was built:**
- `lib/llm.js` — thin Groq SDK wrapper with token tracking
- `config/personality.js` — Yatri's system prompt (job description)
- `index.js` — CLI loop with `/exit`, `/reset`, `/tokens` commands
- Working chatbot that remembers conversation within a session

**Key concepts internalized:**
- LLMs are **stateless** — they have zero memory between calls
- WE provide memory by resending the full `messages` array each turn
- The **system prompt** controls 80% of an agent's behavior
- Same model + different system prompt = completely different "employee"
- **Tokens** = money. Input tokens grow every turn (resending history)
- The **wrapper pattern** (`lib/llm.js`) — hides SDK from the rest of the app

**Experiments run:**
- 🏴‍☠️ **Personality swap** — changed Yatri to Captain Salty the pirate
  → Same model, totally different behavior. System prompt power = felt.
- 🧠 **Memory test** — told Yatri "I'm Max, vegetarian, afraid of heights"
  → Asked for Manali itinerary without repeating constraints
  → Yatri remembered. Because of the `history` array. Not magic — JavaScript.

**The "aha" moment:**
> *"The illusion of AI memory is just a JavaScript array."*
> Every `history.push()` is what makes Yatri seem intelligent.

---

### ✅ Day 2 — Structured Output & Prompt Engineering (May 10, 2026)

**Theme:** Make the LLM output reliable JSON. Turn chatbot into a data source.

**What was built:**
- `config/itinerarySchema.js` — JSON schema + few-shot examples
- `lib/itineraryGenerator.js` — specialized JSON output caller
- Updated `index.js` — new `/plan` command + pretty printer
- `printItinerary()` — renders structured data beautifully in terminal

**Key concepts internalized:**
- `response_format: { type: "json_object" }` — forces valid JSON output
- **Few-shot prompting** — showing 1-2 examples is worth 100 rules
- **Temperature 0.3** for structured output vs **0.7** for conversational
- **Schema design = feature design** — you get exactly what you define
- `finish_reason: "length"` — detecting truncation before it corrupts data
- **Defensive destructuring** — always default optional fields to `[]` or `{}`

**Bugs caught & fixed:**
- 🐛 **Token truncation** — 15-day itinerary hit `max_tokens: 2048` limit
  → Fixed: increased to `max_tokens: 8192`
- 🐛 **LLM math drift** — total cost said ₹60,000 but activities summed to ₹17,000
  → Added `cost_breakdown` schema — forced LLM to itemize
- 🐛 **Schema v1 missed constraints** — "nature lover" preference dropped
  → Added `vibe_preference` enum, richer `user_constraints[]` array

**The "aha" moment:**
> *"Schema design IS feature design. The LLM fills what you define.
> Whatever you leave out, it ignores."*

---

### ✅ Day 3 — Tool Calling (The Agent Awakens) (May 13-14, 2026)

**Theme:** Give Yatri hands. Connect the LLM brain to the real world.

**What was built:**
- `lib/tools/getWeather.js` — real-time weather via Open-Meteo (free, no key)
- `lib/tools/calculator.js` — safe math evaluator (fixes LLM math problem)
- `lib/tools/currentTime.js` — grounds LLM in real time
- `config/tools.js` — tool registry (schemas for LLM + implementations for code)
- `lib/agent.js` — the ReAct loop (Reason → Act → Observe → repeat)
- Updated `index.js` — new `/agent` command

**The 4-step agent loop (how every AI agent works):**
```
1. Send conversation + tool definitions to LLM
2. LLM responds: "I want to call getWeather({city: 'Manali'})"
3. YOUR CODE executes getWeather, gets real data
4. Feed result back → LLM reads it → forms final answer
```

**Bugs caught & fixed (4 in one day):**

**Bug 1: Tool format slip** 🔧
- LLM generated XML-style tags instead of structured JSON
- Fix: Switched model to `openai/gpt-oss-120b` + retry wrapper with backoff

**Bug 2: Geocoder ambiguity — The Manali Saga** 🗺️
- "Manali" returned Tamil Nadu suburb (35°C) instead of HP hill station (12°C)
- 4 fix iterations: population sort ❌ → feature code sort ❌ → full name query ❌ → hardcoded lat/lon ✅
- Key discovery: LLM autonomously tried "Kullu" as proxy — emergent agent reasoning

**Bug 3: Regular chat hallucination** 💬
- Yatri invented weather data when `/agent` prefix wasn't used
- Fix: Added RULES to personality.js — redirect weather queries to `/agent`

**Bug 4: Prompt layer ≠ data layer mismatch** 🎭
- LLM described Himachal Pradesh while fetching Tamil Nadu coordinates
- Fix: Same geocoder fix (hardcoded coordinates)

**Most complex test passed:**
```
/agent What's the weather in Manali? If cool, plan 12 days for family,
vegetarians with an 8-month-old baby girl.
→ Real weather ✓ → conditional logic ✓ → baby-safe veg itinerary ✓
```

**The "aha" moment:**
> *"An agent is a while loop. The LLM outputs a request. Your code runs
> the function. Feed the result back. Repeat. That's ALL of it."*

---

### ✅ Day 4 — Memory Strategies (May 15, 2026)

**Theme:** Give Yatri a notebook that survives restarts.

**What was built:**
- `data/user-profile.json` — the persistent memory notebook
- `lib/memory/profileStore.js` — reads/writes the JSON file
- `lib/memory/factExtractor.js` — LLM extracts facts from natural language
- `lib/memory/memoryFormatter.js` — formats profile into prompt context
- Updated `config/personality.js` — v3 with `{{PROFILE_CONTEXT}}` placeholder
- Updated `lib/llm.js` — accepts profile, injects into system prompt
- Updated `index.js` — loads profile at startup, `/profile` and `/forget` commands

**Key concepts internalized:**
- Two types of memory: session (messages array) vs persistent (JSON file)
- LLM-based extraction — understands "I'm veg" AND "I don't eat meat"
- Fire-and-forget — background updates don't slow user response
- Profile-as-context injection — user facts silently shape every response
- Swap-ready storage — `profileStore.js` swaps to MongoDB on Day 9 (one file)

**All 8 tests passed:**
- ✅ First run greeting (empty profile detected)
- ✅ Fact extraction (one sentence → 3 categories)
- ✅ Cross-session memory ("Welcome back, Paritosh!" after full restart)
- ✅ Profile check (`/profile` shows structured data)
- ✅ Incremental memory (heights fear + peanut allergy added)
- ✅ Memory shapes responses (no-heights destination suggested unprompted)
- ✅ Memory + agent together (weather + calculator + profile constraints)
- ✅ Forget works (clean slate after `/forget` + restart)

**The "aha" moment:**
> After a full restart, Yatri said "Welcome back, Paritosh!" without
> being told anything. The product finally feels ALIVE. Not a chatbot.
> A travel assistant that actually knows me.

**The engineering insight:**
> AI memory is a JSON file + an LLM that listens + a prompt placeholder.
> Three pieces. No magic.

---

### ✅ Practice Tests — Building Muscle Memory (May 16-17, 2026)

**Theme:** Reinforce all 4 days through independent building and debugging.

**PT-1.1: Grumpy Agent 🏴‍☠️ — COMPLETED**

Built `config/grumpy.js` — a completely new personality:
- Grumpy, overworked frustrated travel guide
- "sighs", "huh", "arrrghhh" — Hinglish frustration
- Still helpful, still follows all safety rules
- Persona anchor: "frustrated bank employee with low salary"

Added `/grumpy` mode toggle and `/yatri` to switch back:
- `/grumpy` alone → persistent mode (prompt changes to `You 😤:`)
- `/grumpy <question>` → one-shot grumpy reply
- `/yatri` → back to friendly mode

**Bugs caught and fixed independently:**
- `messages.map is not a function` → was passing string instead of message array to `chat()`
- Double response → missing `continue` after command handler
- "Grumpy" saved as name → fact extractor too eager, extracted command name
- `/grumpy hi` not triggering mode → handler only matched exact string
- Nodemon restarting on every chat → `saveProfile()` wrote to `.json` file which nodemon watched

**Nodemon fix — created `nodemon.json`:**
```json
{
  "ignore": ["data/*"],
  "watch": ["*.js", "lib/**/*.js", "config/**/*.js"],
  "ext": "js,mjs"
}
```

**New bugs discovered (known, not yet fixed):**
- 🐛 "nowhere" saved as a place — extractor too literal, takes any location-sounding word
- 🐛 "man" saved as a name — extracted from casual address ("in your profile man")
- 🐛 LLM claimed to remove profile entry but couldn't — hallucination, no edit tool exists
- Root cause for all three: **fact extractor is too eager** — grabs pattern-matching words without context
- Fix (post-interviews): confidence threshold + stricter extraction rules + `/remove` command

**Key insight from PT-1.1:**
> *"The fact extractor is too eager — it grabs any word that pattern-matches
> a category, without understanding context. The LLM lies when asked to do
> things it has no tools for. Both are known, fixable production problems."*

---

## 🛠️ Current Project Structure

```
yatri-travel-bot/
├── package.json
├── nodemon.json                   ← stops restarts from profile.json saves
├── .env                           ← Groq API key (never commit!)
├── .env.example
├── .gitignore
│
├── config/
│   ├── personality.js             ← Yatri's system prompt (v3)
│   ├── grumpy.js                  ← Grumpy mode personality (PT-1.1)
│   ├── itinerarySchema.js         ← JSON schema + few-shot examples (Day 2)
│   └── tools.js                   ← Tool registry (Day 3)
│
├── data/
│   └── user-profile.json          ← Persistent memory notebook (Day 4)
│
├── lib/
│   ├── llm.js                     ← General chat wrapper (Day 1, updated Day 4)
│   ├── itineraryGenerator.js      ← Structured JSON output (Day 2)
│   ├── agent.js                   ← ReAct loop with retry (Day 3)
│   ├── tools/
│   │   ├── getWeather.js          ← Weather + geocoder disambiguation (Day 3)
│   │   ├── calculator.js          ← Safe math evaluator (Day 3)
│   │   └── currentTime.js         ← Real-time grounding (Day 3)
│   └── memory/
│       ├── profileStore.js        ← Read/write profile JSON (Day 4)
│       ├── factExtractor.js       ← LLM-based fact extraction (Day 4)
│       └── memoryFormatter.js     ← Profile → prompt context (Day 4)
│
└── index.js                       ← CLI orchestrator (all commands)
```

---

## 🎮 All Commands

| Command | What it does |
|---|---|
| `/exit` | Quit with token summary |
| `/reset` | Clear conversation history (keeps profile) |
| `/tokens` | Show session token usage |
| `/plan <req>` | Generate structured JSON itinerary |
| `/agent <q>` | Agent with real tools (weather, math, time) |
| `/profile` | Show persistent memory notebook |
| `/forget` | Wipe all persistent memory |
| `/grumpy` | Switch to grumpy mode permanently |
| `/grumpy <q>` | One-shot grumpy reply |
| `/yatri` | Switch back to friendly mode |

---

## 🧠 Mental Models Built

### The Goldfish Model (Day 1)
> LLMs have zero memory between calls. "Memory" is a JavaScript array
> that you resend every turn. The goldfish only "remembers" because YOU
> keep showing it the same photo album.

### The Contractor Model (Day 2)
> Prompts are blueprints. Vague blueprint → vague building.
> Specific schema → specific output. You get EXACTLY what you define.
> Whatever you don't define, the LLM makes up.

### The Hands Model (Day 3)
> The LLM is a brain in a jar. Tools are its hands.
> It can't call APIs — it can only OUTPUT a request.
> YOUR code reads the request, runs the function, hands back the result.

### The Notebook Model (Day 4)
> Persistent AI memory is a JSON file. LLM listens and extracts facts.
> Profile gets injected into the prompt at runtime.
> Three pieces. No mystery.

### The Eager Extractor Problem (Practice Tests)
> LLM-based fact extraction is powerful but over-eager.
> It pattern-matches without understanding context.
> "nowhere" → place. "man" → name. Production fix: validation layer.

---

## 📊 Final Stats

| Metric | Count |
|---|---|
| Days completed | 4 + practice tests |
| Files created | 18+ |
| Bugs caught by ME | 12+ |
| Bugs fixed | 10 |
| Known bugs deferred | 3 (post-interview) |
| Models tested | 2 (Llama 3.3, GPT-OSS) |
| Geocoder fix attempts | 4 iterations |
| Practice tests completed | PT-1.1 (Grumpy Agent) |
| Personalities built | 2 (Yatri + Grumpy) |
| Commands implemented | 10 |
| Emergent agent behaviors observed | 1 (Kullu proxy) |

---

## 💡 Interview Talking Points

**"Tell me about a hard bug you debugged."**
> The Manali geocoder bug: Open-Meteo returned Tamil Nadu suburb (35°C, pop 35k)
> instead of Himachal Pradesh hill station (12°C, pop 8k). Population sort failed.
> Feature codes identical (both PPL). Full-name queries returned undefined.
> Solution: bypass geocoder with hardcoded lat/lon for known ambiguous cities.
> During debugging, watched the LLM autonomously switch to "Kullu" as a proxy —
> emergent agent reasoning that told us the bug was geocoder-layer, not agent logic.

**"How do AI agents actually work?"**
> An agent is a while loop around an LLM call. The LLM gets a list of tools.
> When it needs real-world data, it outputs a structured JSON tool call request.
> Your code reads it, runs the actual function, feeds the result back as a
> "tool" role message. LLM reads the result → calls another tool or gives
> final answer. That's the entire ReAct pattern: Reason, Act, Observe, repeat.

**"What's the difference between a chatbot and an agent?"**
> A chatbot is a brain in a jar — it can talk but can't DO anything.
> An agent is the same brain with hands — tools that connect to real APIs,
> databases, and code execution. Tools don't call themselves; the LLM outputs
> a request, your code runs it. The LLM is always stateless text-in, text-out.

**"What's your experience with prompt engineering?"**
> Built a structured itinerary generator where schema design IS feature design.
> Learned few-shot examples outperform rules, NEVER constraints are as important
> as positive instructions, and the prompt layer and data layer can disagree —
> the LLM can describe the right place while fetching wrong coordinates.

**"Tell me about a failure and what you learned."**
> Built a fact extractor using an LLM to capture user preferences from natural
> language. It worked well for real facts but was too eager — saved "nowhere"
> as a place name and "man" as a user's name from casual conversation. Root cause:
> LLMs pattern-match without understanding context. Fix requires a validation layer
> or confidence threshold before writing to persistent storage. Haven't shipped the
> fix yet — conscious decision to ship and iterate rather than perfect and delay.

---

## 🔧 Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (ESM) |
| LLM Provider | Groq (free tier) |
| Primary Model | `openai/gpt-oss-120b` (tool calling) |
| Chat Model | `llama-3.3-70b-versatile` (conversation + extraction) |
| Weather API | Open-Meteo (free, no key needed) |
| Memory Storage | JSON file (swaps to MongoDB Day 9) |
| Dev tool | nodemon + nodemon.json config |
| Future: Vector DB | MongoDB Atlas Vector Search |
| Future: Framework | LangChain.js |
| Future: Frontend | React + Vite (existing travel SaaS) |
| Future: Voice | Whisper (STT) + Piper (TTS) — Jarvis sprint |

---

## ⏭️ Post-Bootcamp Backlog

| Priority | Item |
|---|---|
| 🔴 High | Fix fact extractor false positives (nowhere, man) |
| 🔴 High | Add `/remove <field>` command for profile editing |
| 🟡 Medium | RAG + MongoDB Vector Search (Days 8-9) |
| 🟡 Medium | Multi-agent systems (Day 10) |
| 🟡 Medium | Express API + React UI (Days 11-12) |
| 🟢 Low | LangChain.js refactor (Day 6) |
| 🟢 Low | Integration into real travel SaaS (Day 14) |
| 🟢 Low | Jarvis sprint — voice control (Days 15-17) |
| 🟢 Low | Next.js migration + portfolio AI agent (Days 18-21) |

---

*Last updated: Day 4 + Practice Tests — May 17, 2026*
*Next update: After interviews + post-bootcamp work begins*

---

### ✅ Day 5 — ReAct Loop Deep Dive + JS Foundations (May 20-27, 2026)

**Theme:** Understand the agent loop so deeply you could build it from scratch. Fix JS foundation gaps.

**What was understood (no new files — deepening existing code):**
- `lib/agent.js` — read every line, understood every decision
- `lib/memory/factExtractor.js` — upgraded `mergeFacts` to recursive version
- `config/factExtractor.js` — added travel-relevant fear filter

**The ReAct Loop — fully internalized:**
```
runAgent()                    ← public entry point with retry wrapper
  └── _runAgentLoop()         ← internal ReAct engine
        └── for loop (max 10 iterations)
              ├── Call LLM with tools
              ├── finish_reason === "tool_calls" → execute tool → loop again
              ├── finish_reason === "stop"       → return answer
              └── neither                        → throw error
```

**`onStep` callback — understood completely:**
- Not hardcoded `console.log` — a function passed IN by the caller
- Agent sends update objects: `{ type: "tool_call", name, args }`
- Caller decides what to do: print, send to UI, ignore, log to file
- Why function not object: one entry point, no crashes on unknown types, clean default

**JS concepts drilled (were blocking code understanding):**
- `profile[key]` — variable key access on objects
- `|| []` — default fallback when value is null/undefined
- Spread operator `...` — pour out array contents
- `new Set()` — remove duplicates, spread back to array
- `Object.entries()` — convert object to loopable array of `[key, value]` pairs
- Recursion — function calling itself for infinite depth handling

**`mergeFacts` — upgraded from nested loop to recursive:**
```js
// BEFORE — 8 lines, only 2 levels deep
for (const [subKey, subValue] of Object.entries(value)) {
  if (Array.isArray(subValue)) { ... }
  else { profile[key][subKey] = subValue; }
}

// AFTER — 1 line, infinite depth
mergeFacts(profile[key], value);
```

**Bugs fixed in `factExtractor.js`:**
- 🐛 "mother-in-law" saved as fear → added travel-relevant fear rule to prompt
- 🐛 "nowhere" saved as place → added abstract word exclusion rule
- 🐛 "man/bro/yaar" saved as name → added casual address exclusion rule
- All fixed with prompt engineering — no code change needed

**Live session test results:**
- ✅ Hindi input understood: `"mai goa jana chahta hu"` → `places_wishlist: ["Goa"]`
- ✅ Indirect language: `"I do not prefer high places"` → `fears: ["heights"]`
- ✅ Past tense: `"I have visited Bhopal"` → `places_visited: ["Bhopal"]`
- ✅ Grumpy mode: clean switch in/out, no cross-contamination
- ✅ Recursion: nested profile updates working correctly
- 😂 "I fear my mother-in-law" → correctly rejected after fix

**Yatri vs Jarvis — key differences spotted:**
| Feature | Yatri | Jarvis |
|---|---|---|
| Streaming | ❌ Full reply at once | ✅ Token by token |
| History | Fresh per agent call | Last 12 turns from MongoDB |
| Memory | JSON file | Semantic embeddings |
| Max iterations | 10 | 5 (maxToolHops) |

**The "aha" moment:**
> *"An agent loop is just a while loop with three cases: tool call, final answer, or error.
> onStep is just a callback — a function passed in so the caller controls what gets shown.
> Once you see these as simple patterns, the complexity disappears."*

**JS foundation insight:**
> *"I couldn't understand my own code because the JS underneath was fuzzy.
> After drilling Object.entries, spread, Set, and recursion —
> the same code now reads like plain English."*

**New plan established:**
- 14-day bootcamp (Days 1-14) with AI Portfolio running parallel
- React hard drill (Days 8-10) before building portfolio frontend
- DevOps roadmap after bootcamp
- Jarvis after DevOps

---

*Last updated: Day 5 — May 27, 2026*
*Next: Day 6 — LangChain.js + Portfolio shell created*