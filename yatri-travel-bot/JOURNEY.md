# 🧳 Yatri — Agentic AI Bootcamp Journey

> **Developer:** Sir (Paritosh)
> **Stack:** Node.js · Groq API · Llama 3.3 / GPT-OSS · Open-Meteo
> **Goal:** Learn agentic AI in 2 weeks, integrate into a real travel SaaS
> **Started:** May 9, 2026
> **Interview deadline:** May 18, 2026 (compressed to 5-day core bootcamp)

---

## 🗺️ What Is This Project?

**Yatri** is an AI travel companion built progressively over 14 days.
It started as a 50-line CLI chatbot and is evolving into a
production-grade agentic AI feature ready to integrate into a
real multi-tenant MERN travel SaaS platform.

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

**Prompt engineering learned:**
- Zero-shot, few-shot, chain-of-thought patterns
- XML/section headers improve LLM instruction-following
- `NEVER` rules are as important as positive instructions
- Dynamic context injection via template literals (`${new Date()}`)

**Bugs caught & fixed:**
- 🐛 **Token truncation** — 15-day itinerary hit `max_tokens: 2048` limit
  → Fixed: increased to `max_tokens: 8192`
  → Learned: check `finish_reason === "length"` before trusting output
- 🐛 **LLM math drift** — total cost said ₹60,000 but activities summed to ₹17,000
  → Added `cost_breakdown` schema — forced LLM to itemize
  → Learned: LLMs predict tokens, they don't compute. Never trust their math.
- 🐛 **Schema v1 missed constraints** — "nature lover" preference dropped
  → Added `vibe_preference` enum, richer `user_constraints[]` array
  → Learned: if you didn't schema it, you don't get it

**Real output achieved:**
```
/plan a 15 days manali trip — vegetarian, loves natural places
→ 15-day JSON itinerary with daily themes, time-slotted activities,
  cost breakdown, accommodation block, and constraint-aware planning
```

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

**Key concepts internalized:**
- Tools don't "call themselves" — LLM outputs structured JSON, code executes it
- `finish_reason: "tool_calls"` — the signal that a tool call is needed
- `role: "tool"` — the 4th message role (system/user/assistant/tool)
- `tool_call_id` — links tool results to their requests (critical for multi-tool turns)
- `MAX_ITERATIONS = 10` — every agent loop MUST have an escape hatch
- **Tool descriptions ARE prompt engineering** — vague descriptions = LLM forgets to use them
- **Tools should return errors as data, not throw** — agent recovers gracefully
- **Self-verification by the same LLM ≠ real verification** (Day 2 skiing bug lesson)

**Bugs caught & fixed (4 in one day):**

**Bug 1: Tool format slip** 🔧
```
LLM generated: <function=getWeather{"city":"Bhopal"}</function>
Expected:      structured tool_call JSON
```
→ Root cause: Llama 3.3 occasionally slips to XML format on vague prompts
→ Fix 1: Added `TOOL FORMAT` section to system prompt
→ Fix 2: Added retry wrapper with exponential backoff (500ms, 1000ms)
→ Fix 3: Switched model to `openai/gpt-oss-120b` (eliminates the issue)
→ Learned: Open-source models have tool-calling quirks. Model selection = engineering skill.

**Bug 2: Geocoder ambiguity (The Manali Saga)** 🗺️
```
"Manali" → Manali, Tamil Nadu (near Chennai, 35°C, suburb)
Expected → Manali, Himachal Pradesh (Himalayan, 12°C, hill station)
```
→ Attempts made:
  - ❌ Population sort: TN Manali pop (35,248) > HP Manali pop (8,096)
  - ❌ Feature code sort: Both are `PPL` (identical code, no differentiation)
  - ❌ Full name query: Geocoder returns `undefined` for comma-separated names
  - ✅ Hardcoded lat/lon: Bypass geocoder entirely for known ambiguous cities

→ Key debug discovery: The LLM autonomously tried "Kullu" as a proxy when
  "Manali" kept failing — **emergent agent reasoning nobody programmed**.
  This told us the bug was in the geocoder layer, not agent logic.

→ Final fix: `KNOWN_CITIES` map with verified coordinates:
```js
const KNOWN_CITIES = {
  "manali": { lat: 32.2396, lon: 77.1887, label: "Manali, Himachal Pradesh, India" },
  // ...
};
```

**Bug 3: Regular chat hallucination** 💬
```
User: "What's the weather in Manali?"  (no /agent prefix)
Yatri: "Manali in May is 20-25°C..." (invented, no tool call)
```
→ Root cause: `/agent` prefix required for tools — regular chat has no tool access
→ Fix: Added to `personality.js` RULES section:
  "NEVER claim real-time data. For weather → redirect to /agent"
→ Learned: Tools don't solve hallucination unless architecture forces their use

**Bug 4: Prompt layer ≠ data layer mismatch** 🎭
```
Tool returned:  "Manali, Tamil Nadu, India" (wrong data)
Yatri said:     "Manali, Himachal Pradesh is..." (right narrative)
```
→ The LLM knew the right answer but reported wrong data
→ Learned: LLMs can describe the right place while fetching the wrong coordinates
→ Fix: Same as Bug 2 (hardcoded coordinates)

**Most complex test run successfully:**
```
/agent What's the weather in Manali? If cool, plan 12 days for family,
we're vegetarians with an 8-month-old baby girl.

→ Agent checked weather (19.6°C, clear) ✓
→ Conditional: "is this cool? yes" → proceeded to plan ✓
→ 12-day itinerary: all vegetarian, baby-safe activities, HP-accurate ✓
→ Packing list: warm layers, baby carrier, portable humidifier ✓
→ One iteration, first try, right city, real data ✓
```

**The "aha" moment:**
> *"The LLM is a stateless function. Tools are just functions YOUR code runs
> when the LLM outputs a structured request. Every agent — ChatGPT plugins,
> Cursor, GitHub Copilot — is just a while loop around this pattern."*

---

## 🛠️ Current Project Structure

```
yatri-travel-bot/
├── package.json
├── .env                           ← Groq API key (never commit!)
├── .env.example
├── .gitignore
│
├── config/
│   ├── personality.js             ← Yatri's system prompt (v2 — upgraded)
│   ├── itinerarySchema.js         ← JSON schema + few-shot examples (Day 2)
│   └── tools.js                   ← Tool registry: schemas + implementations (Day 3)
│
├── lib/
│   ├── llm.js                     ← General chat wrapper (Day 1)
│   ├── itineraryGenerator.js      ← Structured JSON output (Day 2)
│   ├── agent.js                   ← ReAct loop with retry (Day 3)
│   └── tools/
│       ├── getWeather.js          ← Open-Meteo weather + disambiguation (Day 3)
│       ├── calculator.js          ← Safe math evaluator (Day 3)
│       └── currentTime.js         ← Real-time grounding (Day 3)
│
└── index.js                       ← CLI: /chat /plan /agent /exit /reset /tokens
```

---

## 🧠 Mental Models Built So Far

### The Goldfish Model (Day 1)
> LLMs have zero memory between calls. "Memory" is a JavaScript array
> that you resend every turn. The goldfish only remembers because YOU
> keep showing it the same photo album.

### The Contractor Model (Day 2)
> Prompts are blueprints. Vague blueprint → vague building.
> Specific schema → specific output. You get EXACTLY what you define.
> Whatever you don't define, the LLM makes up.

### The Hands Model (Day 3)
> The LLM is a brain in a jar. Tools are its hands.
> It can't call APIs — it can only OUTPUT a request.
> YOUR code reads the request, runs the function, hands back the result.
> The LLM is always text in → text out. The "tool call" is just structured text.

---

## 📊 Stats So Far

| Metric | Count |
|---|---|
| Days completed | 3 |
| Files created | 12 |
| Bugs caught by ME | 6 |
| Bugs fixed | 6 |
| Models tested | 2 (Llama 3.3, GPT-OSS) |
| Tool call iterations debugged | 4+ |
| Most complex test passed | 12-day family trip (veg + baby) |
| Emergent agent behaviors observed | 1 (Kullu proxy) |

---

## 🔜 Remaining Bootcamp (Compressed Plan)

| Day | Date | Theme |
|---|---|---|
| ✅ Day 1 | May 9 | Foundations |
| ✅ Day 2 | May 10 | Structured Output |
| ✅ Day 3 | May 13-14 | Tool Calling |
| 🔜 Day 4 | May 14 | Memory Strategies |
| 🔜 Day 5 | May 15 | ReAct Loop from Scratch |
| 🔜 Day 6 | May 16 | LangChain.js |
| 🔜 Day 7 | May 17 | Multi-Tool Capstone |
| 🎤 Demo Day | May 17 | Polish + Interview Prep |

---

## ⏭️ Post-Bootcamp Backlog

Things deferred so we could stay focused:
- Day 8-9: RAG + MongoDB Vector Search
- Day 10: Multi-agent systems
- Day 11-13: Express API + React UI + Production hardening
- Day 14: Integration into real travel SaaS
- Days 15-17: Jarvis sprint (voice-controlled laptop agent)
- Days 18-21: Next.js migration + portfolio site with AI agent

---

## 💡 Interview Talking Points (Growing List)

**"Tell me about a hard bug you debugged."**
> The Manali geocoder bug: Open-Meteo returned Tamil Nadu (35°C, suburb of Chennai)
> instead of the famous Himalayan hill station (12°C). Population sort failed because
> TN Manali is part of Chennai metro (35k pop vs 8k). Feature codes were identical (PPL).
> Full-name queries returned undefined. Solution: bypass geocoder with hardcoded lat/lon
> for known ambiguous tourist destinations. During debugging, observed the LLM autonomously
> switch to "Kullu" (Manali's district city) as a proxy — emergent agent reasoning.

**"How do AI agents actually work?"**
> An agent is a while loop around an LLM call. The LLM gets a list of tools it can use.
> When it needs real-world data, it outputs a structured JSON "tool call request" instead
> of text. Your code reads it, runs the actual function, and feeds the result back as a
> "tool" role message. The LLM reads the result and either calls another tool or gives
> a final answer. That's the entire ReAct pattern — Reason, Act, Observe, repeat.

**"What's the difference between a chatbot and an agent?"**
> A chatbot is a brain in a jar. It can talk, but it can't DO anything. An agent is
> the same brain, but with hands — tools that connect it to real APIs, databases,
> and code execution. The mental model: tools don't call themselves, the LLM outputs
> a request, your code runs it. The LLM is always stateless text-in, text-out.

**"What's your experience with prompt engineering?"**
> Built a structured itinerary generator where the schema design IS the feature design.
> Learned that few-shot examples outperform rules, that `NEVER` constraints are as
> important as positive instructions, and that the prompt layer and data layer can
> disagree — the LLM can describe the right place while fetching wrong coordinates.

---

## 🔧 Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (ESM) |
| LLM Provider | Groq (free tier) |
| Primary Model | `openai/gpt-oss-120b` (tool calling) |
| Fallback Model | `llama-3.3-70b-versatile` (chat) |
| Weather API | Open-Meteo (free, no key needed) |
| Package manager | npm |
| Dev tool | nodemon |
| Future: Vector DB | MongoDB Atlas Vector Search |
| Future: Framework | LangChain.js |
| Future: Frontend | React + Vite (existing travel SaaS) |

---

---

### ✅ Day 4 — Memory Strategies (May 15, 2026)

**Theme:** Give Yatri a notebook that survives restarts.

**What was built:**
- `data/user-profile.json` — the persistent memory notebook
- `lib/memory/profileStore.js` — reads/writes the JSON file
- `lib/memory/factExtractor.js` — LLM extracts facts from natural language
- `lib/memory/memoryFormatter.js` — formats profile into prompt context
- Updated `config/personality.js` — v3 with {{PROFILE_CONTEXT}} placeholder
- Updated `lib/llm.js` — accepts profile, injects into system prompt
- Updated `index.js` — loads profile at startup, /profile and /forget commands

**Key concepts internalized:**
- Two types of memory: session (messages array) vs persistent (JSON file)
- LLM-based extraction — understands "I'm veg" AND "I don't eat meat"
- Fire-and-forget — background updates don't slow user response
- Profile-as-context injection — user facts silently shape every response
- Swap-ready storage — profileStore.js will swap to MongoDB on Day 9

**All 8 tests passed:**
  ✅ First run greeting (empty profile detected)
  ✅ Fact extraction (one sentence → 3 categories)
  ✅ Cross-session memory ("Welcome back, Paritosh!" after full restart)
  ✅ Profile check (/profile shows structured data)
  ✅ Incremental memory (heights fear + peanut allergy added)
  ✅ Memory shapes responses (no-heights destination suggested unprompted)
  ✅ Memory + agent together (weather + calculator + profile constraints)
  ✅ Forget works (clean slate after /forget + restart)

**The "aha" moment:**
> After a full restart, Yatri said "Welcome back, Paritosh!" without
> being told anything. Then suggested a trip avoiding heights — without
> being reminded. The product finally feels ALIVE. Not a chatbot.
> A travel assistant that actually knows me.

**Subtle observation:**
> Yatri still recommended Mussoorie (a hill station) despite knowing
> about heights fear. Memory was read correctly — LLM rationalized anyway.
> Day 5's reflection/audit step will catch this class of bug.

**The engineering insight:**
> AI memory is a JSON file + an LLM that listens + a prompt placeholder.
> Three pieces. No magic. The "intelligence" is in the architecture,
> not the model.