# 21 MILES — NARRATIVE-VISUAL SYNC

## The problem

The narrative text and the visual stage are two separate apps sharing a screen.
When ink says "Fuel becomes freight. Freight becomes delay. Delay becomes shortage."
the screen shows the same static blobs. Nothing transforms. Nothing syncs.

This document fixes that by defining:
1. What the user SEES at every narrative beat
2. How each domain looks visually distinct
3. How ink tags drive visual transformations in real-time

---

## PART 1: DOMAIN VISUAL LANGUAGE

Each domain must be INSTANTLY recognizable without labels. The user should 
know they're looking at "shipping" vs "medicine" vs "food" from color and 
motion alone — the way you know fire from water without being told.

### SHIPPING — Blue-white, fast, flowing
- **Color:** `#72b7ff` (ocean blue-white)
- **Motion:** Fast-moving dots flowing along route lines. Smooth, steady rhythm.
- **Particles:** Small bright dots (3-4px), closely spaced, flowing in ONE direction along routes
- **Glow:** Blue additive glow on route lines
- **Sound:** Steady low hum
- **Feeling:** Arteries of global trade. Alive. Working.

### FREIGHT — Orange-amber, bunching, pulsing
- **Color:** `#E8B94A` → `#D4763C` (gold-to-orange)
- **Motion:** Slower dots that BUNCH at bottleneck points. Irregular pulse rhythm.
- **Particles:** Medium dots (4-5px) that cluster and push apart. Visible congestion.
- **Glow:** Warm amber glow at congestion points
- **Sound:** Deeper, irregular thudding
- **Feeling:** Pressure building. Things backing up.

### MEDICINE — Red-purple, weak pulse, gaps
- **Color:** `#d97a86` → `#8B6FC0` (rose-to-purple)
- **Motion:** Slow pulsing dots with GAPS between them. Cadence is visibly weakening.
- **Particles:** Cross-shaped dots (or circles with + overlay), 5-6px, spaced far apart
- **Glow:** Faint purple pulse at hospital position. Red flash when supply drops.
- **Sound:** Heartbeat monitor. Steady → slowing → gaps
- **Feeling:** Life-sustaining rhythm breaking down.

### HOUSEHOLD/FOOD — Gold-to-red, contracting, compressing
- **Color:** `#C8A96E` → `#C44B3F` (gold-to-crisis-red)
- **Motion:** Particles being SQUEEZED inward. Walls closing.
- **Particles:** Gold dots trapped between closing walls. Jittering more as space shrinks.
- **Glow:** Gold center darkening to red at edges
- **Sound:** Pressure hiss. Tightening.
- **Feeling:** Your budget. The space you have left to live. Shrinking.

---

## PART 2: MORPH TRANSITIONS

When ink emits `# MORPH: shipping > freight > import_stress > medicine`, 
the visual system must transform in STAGES, synchronized with the narrative text.

### How MORPH works

The ink text in the cascade knot reads:
```
Fuel becomes freight.
Freight becomes delay.
Delay becomes shortage.
```

Each SENTENCE should trigger the NEXT stage of the morph:

| Sentence displayed | Visual morph stage | What happens on screen |
|---|---|---|
| "Fuel becomes freight." | shipping → freight | Blue dots slow down, color shifts to amber, dots start bunching |
| "Freight becomes delay." | freight → import_stress | Amber dots stretch into filaments, gaps appear, color shifts to orange-red |
| "Delay becomes shortage." | import_stress → medicine | Filaments break into pulse dots, color shifts to rose-purple, heartbeat rhythm |

### Implementation

In `handleInkChoice` in Shell.tsx, when a MORPH tag is found:

```typescript
if (tag.startsWith('MORPH:')) {
  const stages = tag.replace('MORPH:', '').trim().split('>').map(s => s.trim())
  // stages = ['shipping', 'freight', 'import_stress', 'medicine']
  
  // Store the morph sequence
  setMorphSequence(stages)
  setMorphIndex(0)
}
```

Then, each time the user advances the narrative (clicks "continue" or a choice 
fires ink.continue()), advance the morph by one stage:

```typescript
// In the ink continue/choice handler, after setting inkBeat:
if (morphSequence.length > 0 && morphIndex < morphSequence.length - 1) {
  const nextStage = morphSequence[morphIndex + 1]
  setMorphIndex(prev => prev + 1)
  
  // Drive the visual transformation
  morphToStage(nextStage)
}
```

`morphToStage()` does:
1. GSAP-animates the particle colors from current domain to next domain (1.5s)
2. Changes particle motion behavior (speed, bunching, gaps)
3. Changes the glow color
4. Triggers the domain-crossing sound

### What morphToStage changes on the Pixi stage

The Pixi stage should have ONE particle system that transforms — not separate 
renderers that show/hide. The particles are ALWAYS there. Their properties change:

```typescript
interface ParticleState {
  color: number        // interpolated during morph
  speed: number        // how fast particles move
  spacing: number      // gap between particles (medicine = large gaps)
  clusterStrength: number  // how much particles bunch (freight = high)
  pulseRate: number    // heartbeat rhythm (medicine = slow with gaps)
  size: number         // particle size
  trailLength: number  // wake trail (shipping = long, medicine = short)
}

const DOMAIN_STATES: Record<string, ParticleState> = {
  shipping:      { color: 0x72b7ff, speed: 2.0, spacing: 8,  clusterStrength: 0.0, pulseRate: 0, size: 3, trailLength: 12 },
  freight:       { color: 0xE8B94A, speed: 0.8, spacing: 4,  clusterStrength: 0.8, pulseRate: 0, size: 4, trailLength: 6 },
  import_stress: { color: 0xD4763C, speed: 0.5, spacing: 15, clusterStrength: 0.3, pulseRate: 0, size: 3, trailLength: 4 },
  medicine:      { color: 0xd97a86, speed: 0.3, spacing: 25, clusterStrength: 0.0, pulseRate: 1.5, size: 5, trailLength: 2 },
  household:     { color: 0xC8A96E, speed: 0.1, spacing: 3,  clusterStrength: 1.0, pulseRate: 0, size: 3, trailLength: 0 },
}
```

During a morph, GSAP tweens each property from current state to target state:

```typescript
function morphToStage(targetDomain: string) {
  const target = DOMAIN_STATES[targetDomain]
  const current = getCurrentParticleState()
  
  gsap.to(current, {
    color: target.color,         // color interpolation
    speed: target.speed,
    spacing: target.spacing,
    clusterStrength: target.clusterStrength,
    pulseRate: target.pulseRate,
    size: target.size,
    trailLength: target.trailLength,
    duration: 1.5,
    ease: 'power2.inOut',
    onUpdate: () => applyParticleState(current),
  })
}
```

---

## PART 3: NARRATIVE BEAT → VISUAL MAP

Every ink knot must produce a SPECIFIC visual change. This is the full map:

### start → nurse_intro / driver_intro
- **Visual:** Calm baseline. Blue-white dots flowing smoothly along routes. 
  Steady rhythm. No congestion. Everything works.
- **Map:** Kenya + corridor visible. Mombasa port glowing gold.
- **Mood:** Normal. Calm. "This is how things work."

### rupture
- **Visual SEQUENCE (timed with text):**
  - "The flow stops before the news arrives." → Dots at Hormuz FREEZE. 
    Red pulse at chokepoint. Downstream dots thin rapidly over 2 seconds.
  - Camera shakes briefly (GSAP translateX ±3px, 0.1s, 3 repeats)
- **Map:** Red glow at Hormuz position (even if off-screen, show the glow at map edge)
- **Sound:** `pressure_buildup` → building drone → thud → silence in flow → tension hum
- **Mood:** Something just broke. Silence where there was rhythm.

### exposure  
- **Visual:** Kenya highlighted. Pulsing vulnerability halo around the country.
  Numbers fade in near Kenya: "85% imported", "dollar debt", "food dependent"
- **No particles change** — this is an overlay moment, not a flow moment.

### detour
- **Visual SEQUENCE:**
  - "Every ship now goes around Africa." → A SECOND route line fades in — 
    the Cape route. Orange-amber. Visibly longer. Dots start flowing on it, 
    but SLOWER (14 extra days = visibly slower cadence).
  - "14 extra days. $1.2 million more per trip." → Number "14" fades in 
    along the Cape route, then fades out.
  - Original Hormuz route stays dark/blocked. Red glow at chokepoint persists.
- **Sound:** `stretched_tones` — slower cadence audio, distance feeling

### cascade: medicine path
- **Visual MORPH SEQUENCE (synced sentence by sentence):**
  1. Start: Blue-white shipping dots still visible but thin
  2. "Fuel becomes freight." → Dots shift blue→amber. Speed halves. 
     Dots start BUNCHING at Mombasa port position.
  3. "Freight becomes delay." → Amber dots stretch into orange filaments 
     along the Mombasa→Nairobi corridor. Gaps appear between groups.
  4. "Delay becomes shortage." → Filaments break into rose-purple PULSE dots. 
     Each dot appears, holds, fades — a heartbeat rhythm. The heartbeat 
     is visibly SLOWER than a healthy one. Gaps between pulses.
  5. Hospital position gets a purple glow that pulses with the medicine rhythm.
- **Sound:** `domain_crossing` at each transition. Tonal shift. 
  Final state: heartbeat monitor audio.

### cascade: food path  
- **Visual MORPH SEQUENCE:**
  1. "Transport cost: ships rerouting" → Blue shipping dots visible
  2. "Fertilizer: natural gas doubled" → CH₄ molecule icon briefly appears 
     and splits — one strand goes toward heating (left), one toward agriculture (right)
  3. "Fleet competition" → Dots competing for the same route, visibly jostling
  4. "Currency: the shilling dropped" → All dots briefly flash red (the invisible tax)
  5. Final state: Gold-orange food dots flowing into household position

### hidden law: refinery → medical
- **Visual:** A bright ARC draws from the refinery/fuel position to the 
  hospital position. Gold line that animates from source to destination 
  over 1 second. BURST of gold particles at the midpoint.
  Both endpoints flash brighter for 2 seconds.
- **Sound:** `discovery_chord` — two tones that were separate harmonize

### hidden law: CH₄ molecule
- **Visual:** Same arc animation. From the gas/heating position to the 
  fertilizer/food position. A molecule icon (CH₄) appears at the source, 
  then splits into two streams — one to heating, one to food.
- **Sound:** `discovery_chord`

### your_month (compression)
- **Visual:**
  - All flow dots converge toward a central point (the household)
  - The point becomes a RECTANGLE — your budget space
  - From four sides, colored bars PUSH INWARD:
    - Top (blue): fuel cost
    - Right (orange): food cost  
    - Bottom (amber): heating cost
    - Left (gold): transport cost
  - Gold dots trapped inside get compressed. Jitter increases.
  - The space left = what you have to live on.
  - FINAL: A large number fades in at center: "KSh 14,400"
- **Sound:** `walls_closing` — pressure building, tightening
- **Map:** Zooms to Nairobi. Everything focuses on one household.

### what_next (future paths)
- **Visual:** The compression chamber holds. Three glowing paths appear:
  - Red path: "gets worse" (pulsing red)
  - Green path: "could ease" (pulsing green)  
  - Blue path: "recovery" (pulsing blue-white)
- User taps one → screen splits.

### split (comparison)
- **Visual:** Left half: current compression chamber. Right half: 
  modified compression chamber (walls closer or further apart depending 
  on the future path). Both animate simultaneously.
- Label left: "How things stand now"
- Label right: "If this happens..."

---

## PART 4: IMPLEMENTATION — THE UNIFIED PARTICLE SYSTEM

Instead of separate renderers per domain, create ONE particle system that 
transforms. This is the key simplification.

### File: `src/stage/renderers/UnifiedFlowSystem.ts`

```typescript
import * as PIXI from 'pixi.js'

/**
 * UnifiedFlowSystem — ONE particle system that morphs across all domains.
 *
 * The same 40-60 particles transform their color, speed, spacing, and 
 * behavior as the narrative progresses. This creates visual continuity —
 * the user SEES oil become medicine, not just reads about it.
 */

interface FlowParticle {
  sprite: PIXI.Sprite
  x: number
  y: number
  vx: number
  vy: number
  pathProgress: number  // 0-1 along the active route
  age: number
  alive: boolean
}

interface DomainConfig {
  color: number
  speed: number
  particleSize: number
  spacing: number           // gap between particles
  clusterStrength: number   // 0 = even spacing, 1 = bunching
  pulseRate: number         // 0 = no pulse, >0 = heartbeat with gaps
  trailAlpha: number        // 0 = no trail, 0.5 = visible trail
  glowColor: number
  glowIntensity: number
}

const DOMAINS: Record<string, DomainConfig> = {
  shipping: {
    color: 0x72b7ff, speed: 2.5, particleSize: 3, spacing: 8,
    clusterStrength: 0, pulseRate: 0, trailAlpha: 0.3,
    glowColor: 0x72b7ff, glowIntensity: 0.4,
  },
  freight: {
    color: 0xE8B94A, speed: 1.0, particleSize: 4, spacing: 5,
    clusterStrength: 0.7, pulseRate: 0, trailAlpha: 0.2,
    glowColor: 0xE8B94A, glowIntensity: 0.5,
  },
  import_stress: {
    color: 0xD4763C, speed: 0.6, particleSize: 3.5, spacing: 18,
    clusterStrength: 0.3, pulseRate: 0, trailAlpha: 0.15,
    glowColor: 0xD4763C, glowIntensity: 0.3,
  },
  medicine: {
    color: 0xd97a86, speed: 0.3, particleSize: 5, spacing: 30,
    clusterStrength: 0, pulseRate: 1.2, trailAlpha: 0.05,
    glowColor: 0xd97a86, glowIntensity: 0.6,
  },
  household: {
    color: 0xC8A96E, speed: 0.1, particleSize: 3, spacing: 3,
    clusterStrength: 1.0, pulseRate: 0, trailAlpha: 0,
    glowColor: 0xC44B3F, glowIntensity: 0.7,
  },
}
```

The UnifiedFlowSystem has ONE method that matters:

```typescript
/** 
 * Morph all particles to a new domain over duration seconds.
 * Called when ink emits a MORPH stage transition.
 * GSAP tweens every property smoothly.
 */
morphTo(domain: string, duration: number = 1.5): void

/**
 * Set the path particles flow along.
 * Called when the map camera moves or the route changes.
 */
setPath(points: {x: number, y: number}[]): void

/**
 * Freeze all particles (rupture effect).
 */
freeze(): void

/**
 * Resume flow (after freeze).
 */
resume(): void
```

---

## PART 5: HOW TO WIRE INK → VISUALS IN SHELL.TSX

### Add MORPH handling to handleInkChoice:

```typescript
// In the tag processing loop inside handleInkChoice:

if (tag.startsWith('MORPH:')) {
  const stages = tag.replace('MORPH:', '').trim().split('>').map(s => s.trim())
  // e.g. ['shipping', 'freight', 'import_stress', 'medicine']
  
  // Morph to the FIRST new stage immediately
  if (stages.length >= 2) {
    // The first stage is where we ARE. Morph to the second.
    const nextDomain = stages[1]
    send({ type: 'SET_VISUAL_DOMAIN', domain: nextDomain })
    
    // Store remaining stages for sentence-by-sentence advancement
    send({ type: 'SET_MORPH_QUEUE', stages: stages.slice(2) })
  }
}

// ALSO: when the user taps a choice and ink.continue() returns the 
// next text, check if there's a morph queue and advance it:
if (morphQueue.length > 0) {
  const nextDomain = morphQueue[0]
  send({ type: 'SET_VISUAL_DOMAIN', domain: nextDomain })
  setMorphQueue(prev => prev.slice(1))
}
```

### Add SCENE → lens mapping:

```typescript
if (tag.startsWith('SCENE:')) {
  const scene = tag.replace('SCENE:', '').trim()
  
  // SCENE changes drive the visual domain automatically
  const sceneDefaultDomain: Record<string, string> = {
    'baseline': 'shipping',
    'rupture': 'shipping',     // but frozen
    'detour': 'shipping',      // with Cape route added
    'cascade': 'shipping',     // will morph via MORPH tags
    'exposure': 'shipping',    // overlay only
    'your_month': 'household',
    'what_next': 'household',
    'split': 'household',
  }
  
  const domain = sceneDefaultDomain[scene] || 'shipping'
  send({ type: 'SET_VISUAL_DOMAIN', domain })
  send({ type: 'ADVANCE_SCENE', scene: scene as SceneId })
  
  // Special behaviors per scene
  if (scene === 'rupture') {
    // Tell the particle system to FREEZE
    send({ type: 'FREEZE_FLOW' })
  }
  if (scene === 'detour') {
    // Add the Cape reroute path
    send({ type: 'ADD_REROUTE' })
  }
}
```

---

## PART 6: WHAT THE USER EXPERIENCES

### Nurse path, sentence by sentence:

**[nurse_intro]** Screen shows: calm blue-white dots flowing along the 
Hormuz → Mombasa route. Steady rhythm. "The supply room is full."

**[tap "Watch the strait"]**

**[rupture]** Screen: dots at Hormuz FREEZE. Red pulse. Downstream thins. 
Camera shakes. "The flow stops before the news arrives."

**[tap "Where did the ships go?"]**

**[detour]** Screen: Cape route fades in (orange line). Dots start flowing 
on it — visibly slower. "Every ship now goes around Africa. 14 extra days."

**[tap "Follow the medicine"]**

**[cascade: medicine]** Screen MORPHS in 3 stages as text appears:
1. "Fuel becomes freight." → Blue dots shift to amber, start bunching at Mombasa
2. "Freight becomes delay." → Amber stretches to orange filaments, gaps appear
3. "Delay becomes shortage." → Filaments break into rose-purple heartbeat pulses

Each transition takes 1.5s. The user WATCHES oil become medicine.

**[tap "How does this reach your family?"]**

**[your_month]** Screen: all particles converge to center. Budget rectangle 
appears. Walls push inward. Gold dots compress. Number lands: "KSh 14,400"

This is ONE continuous visual transformation from start to finish.
Not separate scenes. Not show/hide. A living flow that MORPHS.

---

## SUMMARY FOR CLAUDE CODE

1. **Create UnifiedFlowSystem.ts** — one particle system, 40-60 particles, 
   morphs between domain configs via GSAP property tweens

2. **Add MORPH tag handling** to Shell.tsx handleInkChoice — parse stages, 
   advance one stage per narrative beat

3. **Add SCENE → domain mapping** — each scene change sets the appropriate 
   visual domain automatically

4. **Each domain has distinct color + motion** — shipping is blue/fast, 
   freight is amber/bunching, medicine is purple/heartbeat, household is gold/compressing

5. **The user never needs labels** — they can TELL what domain they're in 
   from the color and motion alone. The text confirms what the eyes already see.

6. **Sound syncs with visuals** — domain crossing = tonal shift, 
   rupture = thud + silence, medicine = heartbeat, compression = pressure hiss
