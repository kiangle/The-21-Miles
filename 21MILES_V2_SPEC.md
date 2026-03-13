# 21 MILES v2 — PLAYABLE BRANCHING SIMULATION NARRATIVE

## Complete Implementation Spec for Claude Code

**Date:** 2026-03-12  
**Version:** 2.0.0  
**Status:** New architecture — replaces card-based v0.5  
**Deploy target:** 21miles.kiangle.com

---

## 1. WHAT THIS IS

21 Miles is not a dashboard. Not a scrollytelling article. Not a card-based explainer.

It is a **playable strategic narrative instrument**.

The user enters a living 3D world. They see Earth from space — shipping lanes as luminous arteries, thousands of particles flowing. A red pulse at Hormuz. The flow stops. The arteries go dark. Then: "21 miles. Pick where you stand."

They choose Kenya. They choose Nurse. The camera flies from space to Nairobi. They watch the cascade arrive — not as text, but as flow bands morphing across domains, pressure building, their monthly budget physically compressing. They fork the world: what if Houthis resume? What if reserves release? Two futures side by side, same geography, different pressure.

The experience should feel like:
- A Reuters-grade visual narrative
- A simulation game
- An Atlas-powered branching story

The user does not just read. They **inspect**, **switch lenses**, **scrub time**, **choose cascades**, **trigger what-ifs**, and **compare futures**.

---

## 2. MVP SCOPE

Build ONE polished vertical slice first.

### MVP slice

- Country: **Kenya**
- Roles: **Nurse** + **Truck Driver**
- Shock: **Hormuz closure**
- Hidden law: **fuel/freight → medicine pressure** (nurse), **diesel → route economics** (driver)
- Consequence: **monthly compression**
- What-ifs: **Red Sea closes too** (worsens), **Reserves released** (eases), **Closure ends early** (recovery)

Do not build all 6 countries in v1. The goal is to prove the format.

---

## 3. CORE DESIGN PRINCIPLES

### A. One persistent world
The stage remains visible at all times. The world is the UI.

### B. Cascades are SEEN, not explained
No icon-first logic. No card-first logic. A cascade changes **visual species** as it moves: flow bands → congestion particles → import stress filaments → medicine cadence pulses → household margin erosion.

### C. The user is a player
The experience supports: lens changes, time scrubbing, branch choice, forked futures, perspective switching.

### D. Story and simulation stay separate but synchronized
Atlas provides truth. XState orchestrates. inkjs scripts narrative. Three.js renders the globe. Pixi/Matter renders the 2D living systems. GSAP directs transitions.

### E. No dashboard DNA
No stacked cards. No panel-driven UX. No icon clutter. If a scene depends on badges or cards to explain what changed, the implementation is wrong.

### F. Sound is a first-class channel
As shipping bands congest, a low-frequency hum builds. Domain crossings (energy → food) produce tonal shifts. Connection discoveries create resonant harmonics. The compression chamber shrinks audibly. No one shares a silent experience.

### G. Live data makes it real
The world updates daily with real market data. Today's oil price. Today's shipping rates. Today's currency moves. The compression chamber shows a different number tomorrow because the crisis evolved overnight. "Updated 14 hours ago" with a live pulse.

---

## 4. TECH STACK

### 3D Globe
- **Three.js** — Earth from space, satellite zoom, shipping lane particles on sphere surface, camera fly-to-country transition

### Geospatial truth (2D)
- **MapLibre GL JS** + **deck.gl** — real marine routes, chokepoints, ports, country positions, accurate geography once camera lands

### Living 2D world stage
- **PixiJS** — flow bands, vessel ecologies, cascade morphing, pressure fields, congestion swarms, split-future overlays

### Physical behavior
- **Matter.js** — vessel bunching, chokepoint jam, reroute strain, pressure wave separation (only where physicality teaches meaning)

### State orchestration
- **XState** — scene progression, mode switching, lens/time/fork/perspective state, pause/resume

### Branching narrative
- **inkjs** — authored beats, hidden-law reveals, role voice, choice prompts, what-if framing

### Reveal timing
- **GSAP** + **ScrollTrigger** — entry transitions, pinned scenes, stage freezes, camera shifts, what-if entry

### Analytical overlays
- **D3** — compression chamber, exposure signature, compare delta (not the whole app — compact overlays only)

### Audio
- **Tone.js** — spatial audio, cascade hum, domain-crossing tonal shifts, compression pressure sounds, connection harmonics

### Shell
- **React** + **TypeScript** + **Vite**

### Data
- **Atlas API** — world truth, cascades, what-if simulation, household impact, connection discovery, live parameter updates

---

## 5. THE OPENING: EARTH FROM SPACE

### 5.1 Three.js Globe

The app opens on a slowly rotating Earth. Dark background. The globe is not a cartoon — it's photorealistic or at minimum uses NASA Blue Marble textures with night lights.

**Shipping lanes** are rendered as luminous particle streams on the globe surface. Thousands of particles flowing along major maritime routes — Hormuz, Suez, Malacca, Cape, Panama. They pulse with life. This is global trade, visible.

**The rupture:** A red pulse emanates from Hormuz (26.5°N, 56.3°E). The particles flowing through the Strait stop. The lanes go dark. Particles upstream bunch and stall. The downstream lanes thin. In 3 seconds, without a word, the user sees: something critical just broke.

**Text appears:** "21 miles." Then: "Pick where you stand." Country markers pulse on the globe — Kenya, Japan, Germany, India, USA, UK.

### 5.2 Camera fly-to

User taps Kenya. The camera flies from space to Nairobi — a smooth 3-second GSAP-driven zoom. As the camera descends, Three.js fades out and MapLibre/Pixi fades in seamlessly. The 3D globe becomes the 2D living stage. The shipping lanes that were luminous arcs on the sphere become the deck.gl route layers on the map.

### 5.3 Technical notes

- Three.js scene renders in a full-screen canvas behind everything
- Globe uses `SphereGeometry` with Earth texture + specular map for ocean reflection
- Shipping lanes: `THREE.Points` or `THREE.Line` with particle positions from real route GeoJSON, projected onto sphere surface
- Night lights texture for dramatic contrast
- Camera transition: `GSAP.to(camera.position, { ... })` with easing
- Crossfade: Three.js canvas opacity → 0 while MapLibre container opacity → 1
- After transition, Three.js scene is disposed to free GPU memory
- The globe can be revisited via a "zoom out" gesture — but this is post-MVP

---

## 6. ATLAS INTEGRATION — LIVE DATA

### 6.1 Atlas as truth engine

Atlas owns everything the app displays as fact. The app never generates, estimates, or invents world knowledge.

**Endpoints used:**

| Endpoint | Purpose |
|----------|---------|
| `GET /explorer-bootstrap/{world_id}` | World + profiles + entry shock + routes + what-if scenarios |
| `POST /cascade-path` | Single-hop traversal with UI metadata + path labels |
| `POST /household-impact` | Personalized cost math (low/base/high) |
| `POST /check-connections` | Hidden connection discovery evaluation |
| `POST /what-if` | Comparative simulation for forked futures |
| `GET /world-summary/{world_id}` | Public-safe evidence summary |
| `GET /live-parameters/{world_id}` | **NEW: Real-time parameter snapshot** |

### 6.2 Live data pipeline

The SD engine's `SdParameter` system supports live calibration updates. Parameters have `provenance` and `source_ref` fields. A calibration update changes the oil price from $92.69 to $105 without touching graph topology.

**Data feeds (Atlas-side, not in this repo):**

| Feed | Provider | Updates | What it feeds |
|------|----------|---------|---------------|
| Vessel tracking | Kpler / MarineTraffic | Hourly | AIS transit count, route volumes, reroute status |
| Commodity prices | Bloomberg / Reuters | Every 15 min | Brent crude, EU gas (TTF), fertilizer index |
| Oil storage & trade | Vortexa | Daily | SPR levels, China import volumes, floating storage |
| Shipping rates | Drewry / Freightos | Daily | Container rates, tanker rates, surcharges |
| Conflict events | ACLED | Daily | Vessel attacks, Houthi activity, escalation signals |
| Currency rates | ECB / Fed | Daily | Rupee, shilling, sterling, euro vs USD |

**Live parameter endpoint** (`GET /live-parameters/{world_id}`):

```json
{
  "world_id": "scenario:world_hormuz_energy",
  "updated_at": "2026-03-12T06:00:00Z",
  "parameters": {
    "brent_crude_usd": { "value": 105.20, "source": "bloomberg", "updated": "2026-03-12T05:45:00Z" },
    "ais_hormuz_transits": { "value": 0, "source": "kpler", "updated": "2026-03-12T04:00:00Z" },
    "eu_gas_ttf_mwh": { "value": 64.30, "source": "bloomberg", "updated": "2026-03-12T05:45:00Z" },
    "us_spr_million_bbl": { "value": 392, "source": "eia", "updated": "2026-03-11T00:00:00Z" },
    "cape_route_extra_days": { "value": 14, "source": "drewry", "updated": "2026-03-11T00:00:00Z" },
    "kenya_shilling_usd": { "value": 0.0071, "source": "ecb", "updated": "2026-03-12T00:00:00Z" },
    "fleet_capacity_pct": { "value": 82, "source": "kpler", "updated": "2026-03-12T04:00:00Z" },
    "houthi_active": { "value": false, "source": "acled", "updated": "2026-03-11T00:00:00Z" }
  },
  "crisis_day": 12,
  "last_topology_change": null
}
```

The app fetches this on load and every 15 minutes. When parameters change:
- Flow band density/color adjusts
- Compression chamber numbers update
- "Updated X hours ago" pulse refreshes
- If `houthi_active` flips to true, the what-if becomes reality — the fork collapses

### 6.3 Atlas-powered cascades

The cascade path the user sees is NOT hardcoded in the app. It comes from Atlas's graph traversal. When the user follows the medicine cascade:

1. App calls `POST /cascade-path` from the current node
2. Atlas returns: next node with UI metadata, connections with **path_labels** (curiosity hooks), cross-domain edges
3. The app renders the cascade as morphing flow species on the stage
4. The ink narrative beat fires based on the node type
5. The compression chamber updates with the new household math from `POST /household-impact`

### 6.4 Atlas-powered what-ifs

When the user forks the world:

1. App calls `POST /what-if` with scenario_id + profile_id
2. Atlas runs comparative simulation (baseline vs intervention)
3. Returns: route delay change, medicine pressure change, freight stress change, monthly hit change, narrative
4. The stage splits: left = baseline, right = altered future
5. Both timelines run simultaneously with different flow patterns
6. Compression chamber shows both numbers side by side

---

## 7. XSTATE MACHINE

### 7.1 Parallel state domains

```
A. scene: entry → selected → baseline → rupture → detour → cascade → compression → fork → compare
B. lens: shipping | freight | medicine | household
C. time: day1 | day3 | week1 | month1
D. perspective: nurse | driver
E. future: baseline | redSea | reserves | closureEnds
F. playback: playing | paused
```

### 7.2 Context

```typescript
type WorldContext = {
  countryId: 'kenya'
  roleId: 'nurse' | 'driver'
  selectedCascade: 'medicine' | 'food'
  lens: 'shipping' | 'freight' | 'medicine' | 'household'
  time: 'day1' | 'day3' | 'week1' | 'month1'
  future: 'baseline' | 'redSea' | 'reserves' | 'closureEnds'
  compareMode: boolean
  discoveredLaws: string[]
  worldMetrics: {
    routeDelayDays: number
    medicinePressure: number
    freightStress: number
    monthlyHitKsh: number
    oilPriceUsd: number
    crisisDay: number
  }
  liveParams: LiveParameters | null
  atlasSessionToken: string
}
```

### 7.3 Events

```typescript
type WorldEvent =
  | { type: 'ENTER_WORLD' }
  | { type: 'SELECT_COUNTRY'; countryId: string }
  | { type: 'SELECT_ROLE'; roleId: string }
  | { type: 'ADVANCE_STORY' }
  | { type: 'SET_LENS'; lens: string }
  | { type: 'SET_TIME'; time: string }
  | { type: 'SET_CASCADE'; cascade: string }
  | { type: 'SET_FUTURE'; future: string }
  | { type: 'TOGGLE_COMPARE' }
  | { type: 'SWITCH_PERSPECTIVE' }
  | { type: 'LIVE_PARAMS_UPDATE'; params: LiveParameters }
  | { type: 'CASCADE_NODE_RECEIVED'; node: CascadeNode }
  | { type: 'CONNECTION_DISCOVERED'; connection: Connection }
  | { type: 'WHAT_IF_RESULT'; result: WhatIfResult }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'RESET' }
```

---

## 8. SCENE GRAMMAR

### 8.1 Entry — Earth from space

**Goal:** Awe. Then rupture. Then choice.

**Visual:** Three.js globe with luminous shipping lanes. Red pulse at Hormuz. Flow stops. "21 miles. Pick where you stand." Country markers pulse.

**Sound:** Low ambient hum of global trade. Sudden silence at rupture. Single sustained tone.

**Interaction:** Tap a country marker.

### 8.2 Fly-to — Space to ground

**Goal:** Transition from global to personal.

**Visual:** Camera flies from space to Nairobi. Three.js crossfades to MapLibre + Pixi. Globe arteries become 2D route layers.

**Sound:** Wind of descent. New ambient — local sounds (city, port, traffic depending on role).

**Interaction:** Choose role (Nurse / Truck Driver).

### 8.3 Baseline — The world before

**Goal:** Establish the living system working normally.

**Visual:** Flow bands moving smoothly. Vessels transiting Hormuz. Mombasa port receiving ships on schedule. Supply rhythm visible as cadence pulses.

**Sound:** Steady rhythm. Calm.

**Duration:** 5-8 seconds. Don't linger. The user should feel "this works" before it breaks.

### 8.4 Rupture — The strait closes

**Goal:** Feel the chokepoint stress physically.

**Visual:** Vessels bunch at Hormuz (Matter.js). Flow bands constrict, redden, stop. Pressure field radiates outward. Downstream lanes thin rapidly.

**Sound:** Low-frequency buildup → sudden thud → silence in the flow → tension hum.

**ink beat:** "The flow narrows before the world calls it crisis."

### 8.5 Detour — The Cape reroute

**Goal:** Show reroute and delay visually.

**Visual:** Long Cape route activates. Flow bands stretch around Africa — visibly longer, thicker, stressed. Delay is visible as spacing between pulses increasing. Fleet capacity shrinks (fewer particles per lane).

**Sound:** Stretched tones. Slower cadence.

**ink beat:** "Distance becomes cost before it becomes shortage."

### 8.6 Cascade — The hidden law

**Goal:** Reveal that fuel becomes medicine. This is the core novelty.

**Visual species morphing:**
1. **Shipping stage:** thick flow bands, convoy particles
2. **Freight stage:** congestion clouds, bunching nodes, pulsing cost tension
3. **Import stress stage:** stretched filaments, discontinuous feed lines
4. **Medicine stage:** cadence pulses weakening, hospital-side pressure building
5. **Household stage:** margin erosion bands, breathing-room collapse

The user SEES the oil flow band split — one strand morphs into a different visual species heading toward medicine. The eye discovers the connection before the mind reads it.

**Sound:** Tonal shift at each domain crossing. When the medicine connection reveals, two tones that were separate suddenly harmonize — a resonant discovery chord.

**ink beat:** "The gas that heats your home grows your food. The oil that moves your ships makes your syringes."

**Atlas integration:** Each cascade step calls `POST /cascade-path`. The path_labels drive the ink prompts. The connection check fires at each step.

### 8.7 Compression — The payoff

**Goal:** Translate system shock into lived consequence. Make it physical.

**Visual:** Your monthly budget is a physical space (D3). As each cascade arrives — fuel, heating, food, transport — the walls close in. Categories are physical forces pressing inward. The space left at the end is what you have to live on. For Kenya at 29%: terrifyingly small. 

**Nurse perspective:** sees medicine supply pulse weakening + personal budget compressing
**Driver perspective:** sees diesel cost eating route margin + personal budget compressing

**Sound:** Pressure building. Low rumble. Space getting tighter. Final number lands with weight.

**Live data:** The compression chamber number is computed from Atlas household-impact with today's live parameters. "KSh 14,400 extra this month. Updated 6 hours ago."

### 8.8 Fork — Split the world

**Goal:** Let the user break the future in two.

**Visual:** The stage literally bifurcates. Left half = baseline. Right half = altered future. Same geography. Same timeline. Different flow patterns, pressure, compression. The user scrubs time and watches both evolve.

**Sound:** At fork point — a splitting tone. Then two parallel soundscapes, slightly different.

**Interaction:** Select which future (Red Sea closes / Reserves released / Closure ends). Toggle compare mode. Switch perspectives within the fork.

**Atlas integration:** `POST /what-if` returns both timelines. The stage renders them simultaneously.

### 8.9 Share — The 6-second clip

**Goal:** Viral moment.

**Visual:** The app generates a short video: the cascade arriving at Kenya, the compression chamber closing, the final number. Autoplay format for Twitter/Instagram.

**Text overlay:** "21 miles of water just took 29% of this family's income."

**Interaction:** "Share this cascade" → generates clip + text + link. Copy to clipboard. Open Twitter intent.

---

## 9. FIELD CONSOLE

Floating, minimal, always available. Never blocks the stage. Feels like a field instrument, not admin controls.

### Four controls

**Lens:** Shipping → Freight → Medicine → Household
**Time:** Day 1 → Day 3 → Week 1 → Month 1
**Fork:** Baseline → Red Sea → Reserves → Closure ends
**Perspective:** Nurse ↔ Driver

### Design rules
- Floating at bottom of screen, semi-transparent
- Each control causes IMMEDIATE visible world change
- Currently active state highlighted in gold
- Lens change = cascade visual species changes
- Time change = flow density/pressure changes
- Fork change = future timeline switches
- Perspective change = camera moves, ink voice changes, compression recalculates

---

## 10. CASCADES AS MORPHING FLOW SPECIES

This is the main visual innovation. A cascade MUST change visual form as it crosses domains.

### Shipping / oil / LNG stage
- Thick moving flow bands
- Convoy particles
- Color: blue-white

### Friction / freight stage
- Congestion clouds
- Bunching nodes
- Pulsing cost tension
- Color: yellow-orange

### Import stress stage
- Stretched filaments
- Discontinuous feed lines
- Longer replenishment intervals
- Color: orange-red

### Medicine stage
- Cadence pulses (weakening)
- Narrowing supply rhythm
- Hospital-side pressure glow
- Color: red-purple

### Household stage
- Margin erosion bands
- Breathing-room collapse
- Residual instability shimmer
- Color: red → gold (the compression color)

### NEVER
- Icon badges as cascade language
- Node-link graphs as the main grammar
- Cards or panels to explain what should be visible
- Text where visuals should carry meaning

---

## 11. TWO PERSPECTIVES — NURSE + DRIVER

### Nurse (Amara)
**Sees:** medicine supply cadence weakening at the hospital. IV bags arriving less frequently. Pharmacy shelves thinning.
**Compression:** personal budget + professional anxiety. The cascade arrives at BOTH her household and her workplace.
**ink voice:** clinical precision mixed with human worry. "The shipment that should arrive Tuesday won't. The one after that — uncertain."

### Truck Driver (Joseph)
**Sees:** diesel cost eating route margin. The Mombasa-Nairobi run becoming uneconomic. Freight delay at port — containers sitting.
**Compression:** route economics + personal budget. He IS the supply chain the nurse depends on.
**ink voice:** practical, ground-level. "Diesel up 35%. The margin on a Mombasa run is gone. I can drive or I can eat."

### The connection between them
When the user has explored both perspectives, a discovery fires: "The nurse wonders why medicine is late. The driver knows — but they'll never meet. The cascade connects them through 6 intermediaries, 3 currencies, and 21 miles of water."

---

## 12. SOUND DESIGN

### Ambient layers (Tone.js)

| Scene | Sound |
|-------|-------|
| Globe entry | Deep space hum + faint shipping rhythm |
| Rupture | Building pressure → thud → silence → tension drone |
| Detour | Stretched tones, slower cadence, distance feeling |
| Cascade crossing | Tonal shift at each domain boundary |
| Connection discovery | Two separate tones harmonize — resonant chord |
| Compression | Pressure building, low rumble, walls closing |
| Fork | Splitting tone → two parallel soundscapes |

### Rules
- Sound is optional (respect mute)
- But the default is ON with low volume
- Sound enhances emotional timing — it's not decoration
- Each domain has a tonal signature; crossings create harmonic tension

---

## 13. INK NARRATIVE

### kenya_nurse.ink

```ink
=== start ===
A distant channel is already inside your month.
+ [Enter as Amara — a nurse in Nairobi] -> kenya_nurse_intro
+ [Enter as Joseph — a truck driver on the Mombasa road] -> kenya_driver_intro

=== kenya_nurse_intro ===
You begin before the rupture. The supply room is full. The route still moves.
+ [Watch the chokepoint] -> rupture

=== kenya_driver_intro ===
You begin before the rupture. Diesel is KSh 180. The Mombasa run pays. Barely.
+ [Watch the chokepoint] -> rupture

=== rupture ===
The flow narrows before the world calls it crisis.
+ [Follow the reroute] -> detour
+ [See who is exposed] -> exposure

=== detour ===
Distance becomes cost before it becomes shortage.
+ [Follow the medicine path] -> cascade_medicine
+ [Follow the food path] -> cascade_food

=== cascade_medicine ===
The shock arrives wearing another mask.
Fuel becomes freight. Freight becomes delay. Delay becomes shortage.
{perspective == "nurse": The IV bag count drops. Nobody announces it. It just happens.}
{perspective == "driver": The container sits at Mombasa for three extra days. Nobody pays the storage.}
+ [See what it does to your month] -> compression
+ [What if the Red Sea closes too?] -> fork_redsea

=== compression ===
{monthlyHitKsh} shillings.
That is what 21 miles of water costs your family this month.
{monthlyHitPct}% of income. Gone. Not to better food. To the same life, priced by a strait.
+ [Fork the future] -> fork_choice
+ [Share this] -> share

=== fork_redsea ===
The Cape route was the only alternative. Now that's contested too.
There is no safe corridor left.
+ [See the comparison] -> compare_view
```

### Rules
- ink lines are SHORT. Sharp. Reveal-oriented.
- The visual system does most of the work.
- ink NAMES the hidden law after the visual shows it.
- ink uses `{perspective}` to switch voice between nurse and driver.
- ink uses `{monthlyHitKsh}` to inject live Atlas numbers.

---

## 14. REPO STRUCTURE

```
21-miles/
  CLAUDE.md
  21MILES_V2_SPEC.md
  package.json
  vite.config.ts
  tsconfig.json
  public/
    textures/
      earth_day.jpg
      earth_night.jpg
      earth_specular.jpg
    ink/
      kenya_nurse.ink.json
    geo/
      shipping_routes.json
      chokepoints.json
      countries.json
      ports.json
    audio/
      ambient/
      transitions/
  src/
    main.tsx
    app/
      App.tsx
      Shell.tsx
      providers/
        StageProvider.tsx
        AudioProvider.tsx
      config/
        constants.ts
        theme.ts
    atlas/
      AtlasClient.ts
      AtlasAdapter.ts
      LiveDataPoller.ts
      types.ts
      mock/
        kenyaMock.ts
    state/
      machine/
        worldMachine.ts
        worldContext.ts
        worldEvents.ts
        selectors.ts
      hooks/
        useWorldMachine.ts
        useStageSelectors.ts
        useLiveData.ts
    narrative/
      InkEngine.ts
      beats/
        storyBeats.ts
      prompts/
        lawPhrases.ts
        roleVoices.ts
    globe/
      GlobeScene.ts
      GlobeRenderer.ts
      ShippingParticles.ts
      RuptureEffect.ts
      FlyToTransition.ts
    stage/
      StageRoot.tsx
      camera/
        StageCamera.ts
      scene/
        PixiStage.tsx
        PixiWorld.ts
        PixiLayers.ts
      physics/
        MatterWorld.ts
        bodies/
          vesselBodies.ts
          congestionBodies.ts
      map/
        MapRoot.tsx
        MapViewport.ts
        DeckRouteLayer.ts
      renderers/
        FlowBandRenderer.ts
        CongestionRenderer.ts
        FilamentRenderer.ts
        PulseRenderer.ts
        MarginRenderer.ts
        SplitFutureRenderer.ts
        ResidueRenderer.ts
    audio/
      AudioEngine.ts
      layers/
        AmbientLayer.ts
        TransitionLayer.ts
        DiscoveryChord.ts
        CompressionPressure.ts
    gameplay/
      console/
        FieldConsole.tsx
        LensSelector.tsx
        TimeScrubber.tsx
        ForkConsole.tsx
        PerspectiveSwitch.tsx
      interactions/
        CompareToggle.tsx
        ShareGenerator.tsx
    overlays/
      NarrativeCaption.tsx
      LiveDataPulse.tsx
      CompressionChamber.tsx
      ComparePanel.tsx
      ConnectionReveal.tsx
    scenes/
      entry/
        EntryScene.ts
      rupture/
        RuptureScene.ts
      detour/
        DetourScene.ts
      cascade/
        CascadeScene.ts
        MorphController.ts
      compression/
        CompressionScene.ts
      fork/
        ForkScene.ts
      share/
        ShareScene.ts
    models/
      world/
        nodes.ts
        routes.ts
        cascades.ts
        roles.ts
      visual/
        flowSpecies.ts
        lensModes.ts
```

---

## 15. BUILD ORDER

### Phase 1: Scaffold
1. Vite + React + TypeScript
2. Three.js globe with Earth textures + shipping lane particles
3. GSAP fly-to transition skeleton
4. MapLibre + Pixi canvas layered behind/on-top

### Phase 2: State backbone
5. XState machine with all parallel domains
6. Atlas adapter (mock first, live-ready shape)
7. Live data poller skeleton

### Phase 3: Globe entry
8. Shipping particles flowing on globe
9. Rupture effect (Hormuz pulse, lanes darken)
10. Country markers + tap interaction
11. Fly-to-Kenya camera transition with crossfade

### Phase 4: Kenya baseline + rupture
12. MapLibre routes (Hormuz, Cape, Mombasa)
13. PixiJS flow bands (baseline state)
14. Rupture: bands constrict, particles bunch (Matter.js)
15. Detour: Cape route activates, bands stretch

### Phase 5: Cascade morphing
16. FlowBandRenderer → CongestionRenderer → FilamentRenderer → PulseRenderer
17. MorphController transitions between visual species
18. Atlas cascade-path integration (real traversal)
19. Connection discovery visual event

### Phase 6: Compression chamber
20. D3 compression visualization
21. Atlas household-impact integration
22. Live parameter injection (today's numbers)
23. "Updated X hours ago" pulse

### Phase 7: Fork + compare
24. Stage bifurcation renderer
25. Atlas what-if integration
26. Side-by-side future timelines
27. Compare toggle

### Phase 8: Narrative + audio
28. inkjs integration with XState
29. Role switching (nurse ↔ driver)
30. Tone.js ambient layers + transitions
31. Discovery chord

### Phase 9: Share
32. 6-second clip generator (Canvas recording or server-side)
33. Share text + Twitter intent
34. Share overlay

### Phase 10: Polish
35. Field console styling
36. Mobile responsiveness
37. Accessibility (keyboard, screen reader for narrative text)
38. Performance optimization (dispose Three.js after transition, LOD for Pixi)

---

## 16. ATLAS ADAPTER CONTRACT

```typescript
interface AtlasAdapter {
  bootstrap(worldId: string, profileId?: string): Promise<BootstrapResponse>
  cascadePath(fromNodeId: string, worldId: string): Promise<CascadePathResponse>
  householdImpact(profileId: string, worldId: string, stockLevels?: Record<string, number>): Promise<HouseholdImpactResponse>
  checkConnections(worldId: string, visitedNodeIds: string[], newNodeId: string): Promise<ConnectionCheckResponse>
  whatIf(worldId: string, scenarioId: string, profileId?: string): Promise<WhatIfResponse>
  liveParameters(worldId: string): Promise<LiveParametersResponse>
}
```

Mock adapter returns the same shapes. Live adapter calls Atlas API. The app never knows which one is active.

---

## 17. ACCEPTANCE CRITERIA

The MVP is successful ONLY if:

1. The globe feels real — Earth from space with living shipping lanes
2. The rupture is FELT — physical, audible, visible flow death
3. The fly-to is seamless — space to ground without a loading screen
4. Flow bands are alive before rupture — the user sees "this works" before it breaks
5. The cascade MORPHS — you see oil become medicine without anyone explaining it
6. The compression chamber is physical — walls closing, space shrinking, number landing with weight
7. The fork splits the SCREEN — two futures side by side, running simultaneously
8. The user can switch perspective mid-experience — nurse to driver, same cascade, different view
9. Live numbers are visible — "Updated 6 hours ago" with today's actual price
10. The share clip is a 6-second visceral moment, not a text card
11. **ZERO jargon anywhere** — no LeadsTo, no Causes, no edge_type, no node_type, no "General"
12. If any scene needs a label or card to explain what's happening, **the visual failed and must be redesigned**
