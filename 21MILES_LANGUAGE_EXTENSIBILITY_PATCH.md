# 21 MILES — LANGUAGE + EXTENSIBILITY PATCH

## Apply to 21MILES_V2_SPEC.md

---

## A. LANGUAGE RULES — NO JARGON, NO EXCEPTIONS

These words are BANNED from every user-facing surface — UI, ink narrative, share text, overlays, buttons, labels, and prompts:

### Banned → Replacement

| Banned term | What the user sees instead |
|---|---|
| Fork / fork the future | "What happens next?" / "Change the story" |
| What-if scenario | Just the question: "What if Houthis resume Red Sea attacks?" |
| Baseline | "Current path" or "How things stand now" |
| Altered future | "If this happens..." |
| Compare mode | "Side by side" |
| Cascade | Never named. Just shown. |
| Compression chamber | "Your month" — just the visual of budget walls closing |
| Exposure signature | Never named. Just the visual. |
| Hidden law / hidden connection | "You found something" / the text itself with no label |
| Discovery | "You traced a link" — or just show it |
| Node / edge / graph | Never. These are internal. |
| LeadsTo / Causes / Triggers / Amplifies | Never. Path labels only. |
| Shock / Consequence / Impact / Stock | Never. |
| Profile / ExposureProfile | "Your country" / "Your role" |
| Lens | "See through..." — e.g., "See through shipping" / "See through medicine" |
| Perspective switch | "See through Amara's eyes" / "See through Joseph's eyes" |
| Simulation / simulate | Never. The user is exploring a living world, not running a model. |
| Parameter / calibration | Never. |
| Confidence / estimated | Show as "Updated 6 hours ago" — not "confidence: estimated" |

### The test

Read every piece of user-facing text aloud to someone who has never heard of Atlas, simulations, or graph databases. If they furrow their brow at ANY word, that word is banned.

### Button labels — examples

| Instead of | Use |
|---|---|
| "Fork the future" | "What happens next?" |
| "Toggle compare" | "See both paths" |
| "Switch perspective" | "See through Joseph's eyes" |
| "Set lens: medicine" | "Follow the medicine" |
| "Set time: week1" | scrub to "Week 1" (no label needed, just a timeline) |
| "Reset" | "Start over" |
| "Share your cascade" | "Show someone" |

---

## B. THE "WHAT HAPPENS NEXT?" MECHANIC

Replace all references to "fork" and "what-if" in the spec with this:

### How it works for the user

At certain moments in the story, a quiet prompt appears:

> **What happens next?**
>
> The world isn't set. Here are paths it could take.
>
> ⚡ What if Houthis resume Red Sea attacks? *could get worse*
>
> 🛡 What if reserves are released? *could ease the pressure*
>
> 🕊 What if a ceasefire opens? *recovery — but slow*

The user taps one. The world splits — left shows "how things stand now," right shows "if this happens." Same map. Same timeline. Different flow. Different numbers. The prompt never says "scenario," "fork," "what-if simulation," or "compare mode."

### The XState event names stay technical internally

`SET_FUTURE`, `TOGGLE_COMPARE`, etc. are fine as code. They never appear in UI.

---

## C. EXTENSIBILITY — ATLAS DRIVES EVERYTHING

### The Kenya slice is ONE INSTANCE of a general system

The spec must make clear: every piece of content — profiles, roles, scenarios, cascade nodes, connections, what-happens-next options, narrative beats — comes from Atlas and can change without touching the app code.

### What Atlas provides per world:

```typescript
// Atlas bootstrap tells the app EVERYTHING it needs
interface WorldBootstrap {
  world: {
    id: string
    label: string                    // "Hormuz Energy Shock"
    description: string
    globe_focus: { lat: number, lng: number }  // where to pulse on globe
    entry_prompt: string             // "21 miles. Pick where you stand."
  }
  
  // Any number of countries
  countries: Array<{
    id: string
    label: string                    // "Kenya"
    flag: string
    lat: number, lng: number         // for globe marker + camera target
    context: string                  // "85% of petroleum imported"
  }>
  
  // Any number of roles PER COUNTRY
  roles: Array<{
    id: string
    country_id: string
    label: string                    // "Amara — Nurse, Nairobi"
    short_label: string              // "Nurse" (for the toggle)
    intro_line: string               // "The supply room is full. Rhythm normal."
    voice_style: string              // "clinical precision mixed with worry"
    icon: string                     // emoji or small image ref
  }>
  
  // Exposure profiles (household economics)
  profiles: Array<ExposureProfile>   // linked to role_id
  
  // Entry shock — the starting node
  entry_shock: { id: string, label: string }
  
  // Routes for the map + globe
  routes: Array<RouteData>
  chokepoints: Array<ChokepointData>
  
  // "What happens next?" options
  future_paths: Array<{
    id: string
    label: string                    // "What if Houthis resume?"
    hint: string                     // "The only alternative route becomes contested"
    direction: 'worse' | 'better'    // drives color: red or green
    probability: number              // shown as "45% likelihood"
    icon: string                     // ⚡ or 🛡 or 🕊
    trigger_node_ids: string[]       // which cascade nodes surface this option
  }>
  
  // Hidden connections count
  hidden_connection_count: number
  
  // Narrative pack ID (which ink file to load)
  narrative_pack: string             // "kenya" → loads kenya.ink.json
  
  // Live data snapshot
  live_params: LiveParameters
  
  // Evidence summary for footer
  evidence_summary: string
}
```

### What this means for the app:

**The globe shows markers for EVERY country Atlas provides.** Not hardcoded to 6.

**The role selector shows EVERY role Atlas provides for that country.** Kenya might have nurse + driver. Japan might have refinery worker + shipping clerk. Germany might have factory worker + pensioner. The app doesn't know or care — it renders whatever Atlas sends.

**"What happens next?" options appear based on `trigger_node_ids`.** When the user reaches a node that's in a future_path's trigger list, the prompt appears. The app doesn't know which nodes trigger which options — Atlas does.

**The ink narrative is loaded by `narrative_pack` ID.** Each world+country has its own compiled .ink.json. The app loads it dynamically. To add a new country, you author a new ink file and add it to Atlas — zero app code changes.

**Cascade nodes, connections, household math, and future-path results all come from Atlas API calls.** The app renders them. Adding a new cascade thread, a new connection, a new future-path option — all happen in Atlas, never in the app.

### Mock data is ONE example

The mock (`kenyaMock.ts`) shows how responses look for Kenya nurse + driver. When the app goes live, Atlas returns the same shapes for ANY world, ANY country, ANY role. The mock exists to prove the format works. It is not the product.

---

## D. INK NARRATIVE — TEMPLATE PATTERN

### How ink scales to hundreds of scenarios

Each world+country gets its own ink file. But they all follow the same STRUCTURE:

```
start → role_intro → rupture → detour → cascade_[domain] → hidden_law_[type] → your_month → what_happens_next → [future_path] → compare → share
```

The variable injection system means numbers are always live:

```ink
VAR monthlyHitLocal = 14400        // injected from Atlas household-impact
VAR currencySymbol = "KSh"         // from profile
VAR fuelPrice = 279                // from live parameters
VAR fuelPricePre = 180             // from profile baseline
VAR crisisDay = 12                 // from live parameters
```

### To add Japan + refinery worker:

1. Author `japan_refinery.ink` following the same knot structure
2. Add role profile to Atlas seed (ExposureProfile)
3. Add `narrative_pack: "japan_refinery"` to the Atlas bootstrap for Japan
4. Deploy the .ink.json to `public/ink/`
5. Zero app code changes

### Shared ink modules (future optimization)

Common knots like rupture, detour, and fleet can be extracted into shared ink files that country-specific files INCLUDE. But for v1, each country gets its own complete file. Optimize later.

---

## E. UPDATED USER-FACING TEXT

### Entry screen

Before: "Pick where you stand."
After: "Where do you live?"

### Role selection

Before: "Select role: Nurse / Truck Driver"
After: "See through Amara's eyes" / "See through Joseph's eyes" (with short description)

### During cascade

Before: "Follow the medicine path" 
After: "Follow the medicine" (or better: the path_label from Atlas, which is already a curiosity hook)

### At "what happens next?"

Before: "Fork the future" / "Fork choice"
After:
> **What happens next?**
> The world isn't set. Here are paths it could take.

### At the split screen

Before: "Compare baseline vs altered future"
After:
Left label: "How things stand now"
Right label: "If this happens..."

### At compression / "your month"

Before: "Compression chamber" / "Monthly budget compression"
After: No label. Just the visual of walls closing + the number landing:
> KSh 14,400
> extra this month
> Updated 6 hours ago

### Connection discovery

Before: "🔗 CONNECTION DISCOVERED"
After: Just the text, with a subtle visual pulse. No header label needed. The text IS the discovery:
> "The gas that heats a home in Hamburg grows food outside Nakuru. One molecule. Two crises."

If a label is absolutely needed: "You traced a link" — not "connection discovered."

### Share

Before: "Share your cascade →"
After: "Show someone →"

### Thread end

Before: "No further direct cascade from this node"
After: "This thread reaches its end. Go back to explore another path."
Or better: no text. Just fade the path options. The absence IS the end.

---

## F. UPDATED SECTION REFERENCES

These changes apply to the V2 spec sections:

- **Section 8 (Scene Grammar):** Replace all "fork" with "what happens next?" / "split screen." Replace "compression" with "your month."
- **Section 9 (Field Console):** Replace "Fork" selector with "What happens next?" Remove "Lens" label — use "See through..." Replace "Perspective" with role names.
- **Section 13 (ink):** Replace "fork_choice" knot header text. Replace all "Fork the future" prompts. Update variable names to user-friendly fallbacks in the ink output.
- **Section 8.9 (Share):** Replace "Share your cascade" with "Show someone."

---

## G. FIELD CONSOLE — UPDATED

Four controls. No jargon.

| Control | User sees | Options |
|---|---|---|
| **Follow** | "Follow the..." | Shipping · Freight · Medicine · Food |
| **Time** | Timeline scrubber | Day 1 · Day 3 · Week 1 · Month 1 |
| **What next?** | "What happens next?" | [dynamic from Atlas future_paths] |
| **Eyes** | "See through..." | Amara · Joseph (or whatever roles Atlas provides) |

No labels like "Lens," "Fork," "Perspective." The controls are self-explanatory through their options.
