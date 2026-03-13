Yes. Here is the spec I would give Claude Code now.

This is designed to stop shallow “feature exists” implementation and force a **spec-faithful rebuild of the missing layers**, especially the opening Earth scene, MapLibre/deck.gl landing stage, Atlas-driven extensibility, and the visual acceptance criteria your current build missed. The required stack, opening behavior, repo structure, Atlas contract, scene grammar, and acceptance criteria all come directly from your spec and patch.

Paste the following to Claude Code.

````text
You are not doing incremental cleanup.

You are bringing the shipped repo into compliance with the 21 Miles v2 spec and language patch.

The current app compiles, but it still fails the product in the most important ways:
- the opening does not read as Earth from space
- the shipping arteries are not visually undeniable
- the rupture is not felt strongly enough
- MapLibre/deck.gl landing is missing or shallow
- Atlas-driven extensibility is not fully respected
- typography / assets / repo structure are incomplete
- some required libraries are installed but not actually used

This is now a SPEC COMPLIANCE + PERCEPTUAL QA task.

You must implement missing pieces properly, not just leave placeholder files or nominal imports.

==================================================
0. SOURCE OF TRUTH
==================================================

Follow these in priority order:

1. 21MILES_V2_SPEC.md
2. 21MILES_LANGUAGE_EXTENSIBILITY_PATCH.md
3. CLAUDE.md

The language patch overrides the spec for user-facing text.
The user-facing language MUST use:
- “Where do you live?”
- “What happens next?”
- “How things stand now”
- “If this happens...”
- “Show someone”
and must avoid the banned jargon list.

The app is a playable world, not a dashboard. The world is the UI. The MVP is Kenya with Nurse + Truck Driver, Hormuz closure, route detour, medicine / household consequence, and three future paths. The spec explicitly requires Three.js for globe, MapLibre + deck.gl for landing geography, PixiJS for living 2D world, Matter.js for chokepoint physicality, XState for orchestration, inkjs for narrative, GSAP + ScrollTrigger for reveal timing, D3 for budget compression, Tone.js for sound, and Atlas API as truth. 

==================================================
1. WHAT IS CURRENTLY WRONG
==================================================

Treat these as confirmed fail points to fix:

A. Globe entry
- Current globe fallback reads as a blue sphere, not Earth from space.
- Missing public/textures assets means the existing material fallback is insufficient.
- Country markers and rupture may exist in code but are not staged strongly enough.

B. Shipping lanes
- Particles may exist but are not visually legible at opening glance.
- They must read as global trade arteries immediately.

C. Required stack usage
- package.json includes MapLibre and deck.gl, but these are not meaningfully wired.
- GSAP is present, but ScrollTrigger is not properly implemented.
- repo structure is missing key spec files / folders such as textures and geo assets.

D. Extensibility
- The app must render countries / roles / future paths / narrative pack from Atlas bootstrap, not from hardcoded assumptions.
- Kenya is just one world instance, not the whole architecture. 

E. Opening experience
- The spec acceptance criterion says the MVP is only successful if the globe feels real, the rupture is felt, the fly-to is seamless, the morphing is visible, the split future is simultaneous, live numbers are visible, and there is zero jargon anywhere. The current build does not meet that bar. :contentReference[oaicite:3]{index=3}

==================================================
2. REQUIRED DELIVERABLES
==================================================

You must deliver ALL of these:

1. Fix the globe entry so it feels like Earth from space and not a blue ball.
2. Make shipping particles / flows immediately visible and cinematic.
3. Implement a real MapLibre + deck.gl landing stage after country selection.
4. Preserve and improve PixiJS + Matter.js world stage after landing.
5. Implement ScrollTrigger meaningfully where the spec called for reveal timing / pinned scene progression.
6. Make Atlas bootstrap drive countries, roles, future paths, narrative pack, and labels.
7. Add missing static asset/data structure under public/.
8. Make fonts match the intended tone.
9. Keep all user-facing text compliant with the language patch.
10. Return a final report listing:
   - files added
   - files changed
   - stack elements now truly implemented
   - spec items still deferred
   - exact acceptance checks passed

==================================================
3. DO NOT DO THESE THINGS
==================================================

- Do NOT leave MapLibre/deck.gl as dead dependencies.
- Do NOT add placeholder files without wiring them into the experience.
- Do NOT claim success based on build status alone.
- Do NOT rely on external downloads at runtime.
- Do NOT hardcode countries or future paths in UI components if Atlas bootstrap already provides them.
- Do NOT use dashboard cards to explain missing visuals.
- Do NOT use banned jargon in the UI.

==================================================
4. IMPLEMENTATION PLAN
==================================================

PHASE A — REPO SHAPE + ASSET COMPLETENESS
-----------------------------------------

Bring the repo closer to the intended structure from the spec:

public/
  textures/
  geo/
  ink/
  audio/

Minimum assets/data to add now:
- public/geo/shipping_routes.json
- public/geo/chokepoints.json
- public/geo/countries.json
- public/geo/ports.json

Because external texture downloads are not reliable here:
- DO NOT block on real NASA image files.
- Instead implement a procedural Earth material fallback that is strong enough to satisfy the opening.
- The fallback must still look like Earth from space.

Also:
- add Google Fonts in index.html:
  - Instrument Serif
  - Instrument Sans

Use:
- title “21 miles” in Instrument Serif
- supporting lines in Instrument Sans

PHASE B — GLOBE ENTRY REBUILD
-----------------------------

Create or refactor an EntryScene that clearly owns:
- starfield
- Earth globe
- shipping particles
- Hormuz rupture pulse
- country markers
- opening copy
- country selection
- fly-to initiation

The opening must satisfy the spec:
- slowly rotating Earth
- dark space background
- luminous shipping routes
- red pulse at Hormuz
- flow stops there after rupture
- country markers pulse
- “21 miles” then “Where do you live?” appears
- selecting Kenya initiates fly-to toward Nairobi
- Three.js crossfades into MapLibre + Pixi stage 

Recommended file ownership:

src/scenes/entry/EntryScene.tsx
- orchestration shell for entry
- holds visual timing state
- mounts GlobeScene and overlay text
- handles SELECT_COUNTRY dispatch

src/globe/GlobeScene.ts
- owns Three.js scene / camera / renderer / cleanup
- composes Earth mesh, stars, shipping particles, markers, pulse

src/globe/ShippingParticles.ts
- route sampling and particle animation

src/globe/RuptureEffect.ts
- animated Hormuz hotspot and route-flow suppression

src/globe/FlyToTransition.ts
- camera path tween + scene crossfade coordination

PHASE C — REAL EARTH LOOK, WITHOUT EXTERNAL TEXTURE DEPENDENCY
--------------------------------------------------------------

You must implement a convincing procedural Earth fallback.

Option A preferred:
- use simplified continent polygons from GeoJSON
- project them to sphere surface slightly above ocean shell
- dark ocean base + slightly lighter land + atmosphere rim

Option B:
- shader-based procedural landmask using low-frequency noise warped by latitude bands and masked into major continental shapes

Use these colors:
- ocean: #0a1628
- land dark: #1a2a3a
- land light variation: #24364a
- atmosphere rim: soft blue/cyan, low opacity
- subtle night-side glow

Implementation guidance:

1. Earth ocean mesh
```ts
const earthGeo = new THREE.SphereGeometry(RADIUS, 128, 128)
const earthMat = new THREE.MeshPhongMaterial({
  color: 0x0a1628,
  shininess: 12,
  specular: new THREE.Color(0x20344a)
})
````

2. Atmosphere shell
    

```ts
const atmosphereGeo = new THREE.SphereGeometry(RADIUS * 1.02, 128, 128)
const atmosphereMat = new THREE.ShaderMaterial({
  transparent: true,
  side: THREE.BackSide,
  uniforms: {
    glowColor: { value: new THREE.Color('#78a6ff') },
    intensity: { value: 0.55 }
  },
  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vViewDir;
    void main() {
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vNormal = normalize(normalMatrix * normal);
      vViewDir = normalize(-mvPosition.xyz);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    varying vec3 vNormal;
    varying vec3 vViewDir;
    uniform vec3 glowColor;
    uniform float intensity;
    void main() {
      float fresnel = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 2.4);
      gl_FragColor = vec4(glowColor, fresnel * intensity);
    }
  `
})
```

3. Landmasses
    

- read `public/geo/countries.json` or a reduced landmass outline file
    
- convert lat/lng polygon points to 3D
    
- draw as thin projected line loops and/or triangulated patches
    
- position them at `RADIUS * 1.002`
    
- use darker/lighter land tones with slight opacity variation
    

If triangulating full polygons is too heavy, use:

- thick line silhouettes for coasts
    
- plus semi-transparent large land patches for Africa / Eurasia / Americas / Australia  
    This is acceptable if the result still clearly reads as Earth.
    

## PHASE D — SHIPPING PARTICLES THAT ARE ACTUALLY LEGIBLE

Current issue: route particles may exist, but visually they disappear.

Rebuild with these constraints:

- 1500–3000 visible moving particles minimum
    
- white-to-gold color range
    
- larger than current tiny points
    
- clearly above globe surface
    
- visible from initial camera framing
    

Use route sampling from route polylines.

Required behavior:

- particles move along route direction
    
- different route volumes can produce different densities
    
- Hormuz-linked routes must thin or stop after rupture
    
- upstream bunching should become visible if possible
    

Implementation guidance:

1. Route sampling
    

```ts
type RoutePoint = { lat: number; lng: number }
type Route = { id: string; points: RoutePoint[]; volume?: number; blockedBy?: string[] }

function latLngToVec3(lat: number, lng: number, r: number): THREE.Vector3 {
  const phi = (90 - lat) * Math.PI / 180
  const theta = (lng + 180) * Math.PI / 180
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta)
  )
}
```

2. Particle placement
    

- particles sit at `RADIUS * 1.01` or slightly more
    
- pre-sample route curves into many positions
    
- each particle stores:
    
    - routeId
        
    - t
        
    - speed
        
    - opacity
        
    - blocked flag
        

3. Rendering  
    Prefer `THREE.BufferGeometry + THREE.PointsMaterial` first for speed.
    

Example direction:

```ts
const material = new THREE.PointsMaterial({
  color: new THREE.Color('#f4e8c1'),
  size: 0.08,
  sizeAttenuation: true,
  transparent: true,
  opacity: 0.95,
  blending: THREE.AdditiveBlending,
  depthWrite: false
})
```

If points still feel weak, switch to instanced quads or tiny sprites.

4. Debug requirements  
    You must verify:
    

- positions are not inside the sphere
    
- render order is above Earth
    
- particle sizes are readable from camera distance
    
- colors are not too blue / too dim
    
- animation tick is active from first frame
    

## PHASE E — HORMUZ RUPTURE THAT FEELS LIKE AN EVENT

At coordinates:

- lat 26.5
    
- lng 56.3
    

Render a pulsing hotspot that is clearly visible in the opening frame range.

Required sequence:

- opening world alive
    
- rupture pulse grows
    
- nearby route particles dim / stop
    
- downstream flow visibly thins
    
- optional: upstream density bunches slightly
    

Visual:

- red/orange pulse
    
- bloom-like aura effect
    
- low-frequency expanding rings or sprite pulse
    

Implementation direction:

- create a sprite or ring mesh at the chokepoint tangent to sphere surface
    
- animate scale + opacity via GSAP or requestAnimationFrame
    
- signal affected routes through a route-state map:
    

```ts
blockedRoutes: Record<string, number> // routeId -> block severity 0..1
```

Then reduce particle speed and opacity on those routes.

## PHASE F — COUNTRY MARKERS DRIVEN BY ATLAS

Do not hardcode the six countries in rendering logic.

Use Atlas bootstrap countries array. The patch explicitly says the globe should show markers for every country Atlas provides, not a fixed list.

Current MVP data can still contain:

- Kenya
    
- Japan
    
- Germany
    
- India
    
- USA
    
- UK
    

But the renderer must iterate:

```ts
bootstrap.countries.map(country => ...)
```

Marker requirements:

- glowing dots on globe surface
    
- pulse gently
    
- front-facing markers emphasized
    
- clickable / tappable
    
- selected country marker becomes brighter
    

Implementation guidance:

- use sprites or small emissive spheres
    
- compute front-facing visibility by dot product between marker normal and camera direction
    
- boost opacity for visible markers, reduce for far-side markers
    
- ideally orient opening globe so Kenya + several comparators are visible
    

## PHASE G — MAPLIBRE + DECK.GL LANDING STAGE

This is a mandatory missing layer from the stack.

After country selection and fly-to:

- Three.js fades down
    
- MapLibre appears
    
- deck.gl route overlays appear on real geography
    
- Pixi world stage overlays above map
    
- the transition must feel seamless and continuous, as required by the spec.
    

Required new files:

- src/stage/map/MapRoot.tsx
    
- src/stage/map/MapViewport.ts
    
- src/stage/map/DeckRouteLayer.ts
    

Minimum MapLibre implementation:

- use a dark basemap style
    
- center on Kenya/Nairobi after selection
    
- animate zoom from regional to local
    
- hide verbose labels if they clutter
    

If you cannot rely on external tile styles, provide a local minimal style JSON or a custom dark background container with deck.gl overlays and geographic transforms.  
But the package must be meaningfully used.

Minimum deck.gl implementation:

- route arcs / path layers for shipping detour
    
- chokepoint markers
    
- ports
    
- country anchor
    
- color / width changes across phases
    

Recommended deck.gl layers:

- PathLayer for shipping routes
    
- ScatterplotLayer for chokepoints / ports
    
- ArcLayer only if it improves readability
    

Example:

```ts
import { DeckGL } from '@deck.gl/react'
import { PathLayer, ScatterplotLayer } from '@deck.gl/layers'

const routeLayer = new PathLayer({
  id: 'routes',
  data: routes,
  getPath: d => d.coordinates,
  getColor: d => d.active ? [180, 220, 255, 220] : [120, 80, 80, 180],
  getWidth: d => d.stressed ? 6 : 3,
  widthUnits: 'pixels',
  rounded: true
})
```

## PHASE H — PIXI + MATTER STAGE MUST STAY THE HERO AFTER LANDING

Do not replace the living world stage with map-only visuals.

MapLibre/deck.gl provide geospatial truth.  
PixiJS + Matter.js provide the living pressure language.

After landing:

- Map gives location / route geography
    
- Pixi paints flow bands, congestion species, filaments, pulses, household pressure
    
- Matter drives chokepoint bunching and pressure separation where physicality teaches meaning
    

Keep and improve:

- FlowBandRenderer
    
- CongestionRenderer
    
- FilamentRenderer
    
- PulseRenderer
    
- MarginRenderer
    
- SplitFutureRenderer
    
- MatterWorld
    

But ensure they are visually wired to scene state and not just isolated components.

## PHASE I — SCROLLTRIGGER MUST BE REAL

The spec explicitly called for GSAP + ScrollTrigger for entry transitions, pinned scenes, stage freezes, camera shifts, and what-if entry.

Even if the app is mostly interaction-led rather than scroll-led, ScrollTrigger must be meaningfully present where it belongs.

Implement one of these valid patterns:

Option 1:

- narrative beats in a pinned storytelling container
    
- scrolling advances visual states through rupture -> detour -> medicine -> household
    

Option 2:

- minimal scroll-driven stage sequencing for desktop while still preserving click/tap control
    

If you choose not to make the whole app scroll-first, then at minimum:

- use ScrollTrigger for one pinned cinematic reveal section after landing
    
- register the plugin properly
    
- use it to synchronize a visible stage change
    
- document exactly where it is used
    

Required:

```ts
import { ScrollTrigger } from 'gsap/ScrollTrigger'
gsap.registerPlugin(ScrollTrigger)
```

## PHASE J — ATLAS DRIVES CONTENT, NOT HARDCODED UI

Atlas bootstrap must drive:

- countries
    
- roles
    
- future_paths
    
- narrative_pack
    
- globe focus / entry prompt
    
- routes / chokepoints
    
- live params
    
- evidence summary
    

Your patch makes this explicit. The app must render whatever Atlas sends for a world, with Kenya only as the current mock slice.

Do these refactors:

1. bootstrap once at app load
    
2. store bootstrap in XState context
    
3. derive visible countries from bootstrap
    
4. derive role options from bootstrap.roles filtered by country_id
    
5. derive narrative pack file from bootstrap.narrative_pack
    
6. derive “What happens next?” options from bootstrap.future_paths
    
7. never hardcode `Kenya`, `Nurse`, or `Truck Driver` in core rendering code
    

## PHASE K — XSTATE ORCHESTRATION CLEANUP

The spec already defines technical events like:

- SELECT_COUNTRY
    
- SELECT_ROLE
    
- SET_FUTURE
    
- TOGGLE_COMPARE
    
- SWITCH_PERSPECTIVE
    
- LIVE_PARAMS_UPDATE  
    These can stay technical internally, while UI remains human-readable.
    

Refine world machine so that it owns:

- entry lifecycle
    
- country selection
    
- fly-to transition
    
- role selection
    
- landed stage
    
- rupture
    
- detour
    
- cascade species
    
- compression
    
- future compare
    
- perspective switching
    
- live parameter refresh
    

Recommended parallel regions:

- scene
    
- lens
    
- time
    
- future
    
- perspective
    
- audio
    

## PHASE L — NARRATIVE + INK LOADING MUST BE DATA-DRIVEN

The patch says the narrative is loaded by narrative_pack ID and can scale to many world/country files without app code changes.

Implement:

```ts
const inkPath = `/ink/${bootstrap.narrative_pack}.ink.json`
```

Variables must be injected from:

- selected role/profile
    
- household impact
    
- live params
    
- current perspective
    

This means:

- monthlyHitLocal
    
- currencySymbol
    
- fuelPrice
    
- fuelPricePre
    
- crisisDay  
    must be runtime-injected, not static constants
    

## PHASE M — LIVE PARAMETERS MUST AFFECT THE WORLD

The spec requires live parameter polling and visible “Updated X hours ago” signals.

Polling behavior:

- fetch on load
    
- refresh every 15 minutes
    
- dispatch LIVE_PARAMS_UPDATE
    
- update visible world metrics
    

At minimum, live params must visibly influence:

- shipping flow density
    
- rupture severity or route stress
    
- compression number
    
- “Updated X hours ago” pulse
    

## PHASE N — FIELD CONSOLE MUST CHANGE THE WORLD IMMEDIATELY

The field console exists to let the player inspect the world, not to show admin controls. The spec requires immediate visible change for lens/time/future/perspective.

Keep these controls:

- Follow the shipping / freight / medicine / household
    
- timeline scrubber
    
- What happens next?
    
- See through Amara’s eyes / Joseph’s eyes
    

But every control must trigger a real visual change:

- lens => renderer emphasis changes
    
- time => densities / delays / spacing shift
    
- future => bifurcated future updates
    
- perspective => camera / copy / compression recalculation shifts
    

## PHASE O — TYPOGRAPHY + UI TONE

Add in index.html:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
```

Theme rules:

- background: near-black / deep navy
    
- text: warm off-white
    
- highlight: restrained gold
    
- keep chrome minimal
    
- no card stacks
    
- no generic SaaS panel look
    

## PHASE P — PERFORMANCE / CLEANUP

Required:

- dispose Three.js scene after landing if not in use
    
- reuse geometries/materials where possible
    
- remove dead placeholder components
    
- ensure Pixi ticker and Matter engine are stopped on unmount
    
- keep mobile fallbacks reasonable
    

# ==================================================  
5. FILE-BY-FILE WORKLIST

Add / change these files at minimum:

index.html

- add font imports
    

public/geo/shipping_routes.json

- include MVP routes:
    
    - Hormuz
        
    - Suez / Red Sea
        
    - Cape detour
        
    - Malacca
        
    - Panama
        
    - Mombasa relevant segments
        

public/geo/chokepoints.json

- include Hormuz, Suez, Bab el-Mandeb, Malacca, Panama
    

public/geo/countries.json

- include at least Kenya, Japan, Germany, India, USA, UK with lat/lng
    

public/geo/ports.json

- include Mombasa and a small set of world comparator ports
    

src/scenes/entry/EntryScene.tsx

- new entry orchestrator
    

src/globe/GlobeScene.ts

- strengthen Earth, stars, markers, pulse integration
    

src/globe/ShippingParticles.ts

- rebuild particle sizing, visibility, route blocking
    

src/globe/RuptureEffect.ts

- stronger chokepoint event
    

src/globe/FlyToTransition.ts

- smooth camera + crossfade into landed world
    

src/stage/map/MapRoot.tsx

- MapLibre mount
    

src/stage/map/MapViewport.ts

- viewport transitions
    

src/stage/map/DeckRouteLayer.ts

- deck.gl layers
    

src/stage/scene/PixiStage.tsx

- ensure map + pixi coexist cleanly
    

src/app/App.tsx

- route entry scene -> landed stage correctly
    

src/state/machine/worldMachine.ts

- ensure lifecycle is explicit and extensible
    

src/atlas/types.ts

- align bootstrap / future_paths / narrative_pack / live params shape with patch
    

src/atlas/mock/kenyaMock.ts

- include countries / roles / future_paths / routes / chokepoints / narrative_pack fully
    

src/narrative/InkEngine.ts

- dynamic pack loading + runtime variable injection
    

src/audio/AudioEngine.ts

- ensure scene-based audio cues correspond to spec scenes
    

# ==================================================  
6. MINIMUM DATA SHAPES

Use these shapes, aligned with the patch:

```ts
export interface WorldBootstrap {
  world: {
    id: string
    label: string
    description: string
    globe_focus: { lat: number; lng: number }
    entry_prompt: string
  }
  countries: Array<{
    id: string
    label: string
    flag?: string
    lat: number
    lng: number
    context?: string
  }>
  roles: Array<{
    id: string
    country_id: string
    label: string
    short_label: string
    intro_line: string
    voice_style: string
    icon?: string
  }>
  profiles: ExposureProfile[]
  entry_shock: { id: string; label: string }
  routes: RouteData[]
  chokepoints: ChokepointData[]
  future_paths: Array<{
    id: string
    label: string
    hint: string
    direction: 'worse' | 'better'
    probability: number
    icon: string
    trigger_node_ids: string[]
  }>
  hidden_connection_count: number
  narrative_pack: string
  live_params: LiveParameters
  evidence_summary: string
}
```

# ==================================================  
7. VISUAL ACCEPTANCE TESTS

The task is NOT complete until all of these are visibly true in the running app:

A. Entry

- I see a starfield immediately.
    
- I see a globe that reads as Earth, not a plain sphere.
    
- I see bright shipping motion immediately.
    
- I see a red rupture hotspot at Hormuz.
    
- I see country markers pulsing.
    
- I see “21 miles” and “Where do you live?” with correct typography.
    

B. Transition

- Clicking Kenya starts a smooth fly-to.
    
- Three.js fades into MapLibre + deck.gl + Pixi without a dead gap.
    
- The landing feels continuous.
    

C. Ground stage

- I can see actual route geography after landing.
    
- I can see the world still alive, not just a static map.
    
- Pixi / Matter contribute visible motion and physicality.
    

D. Story / systems

- The medicine consequence is shown visually, not only described.
    
- The monthly compression visual lands with weight.
    
- “What happens next?” shows Atlas-driven options.
    
- “How things stand now” vs “If this happens...” split can run side-by-side.
    

E. Extensibility

- Countries are rendered from bootstrap data.
    
- Roles are rendered from bootstrap data.
    
- Narrative pack is loaded from bootstrap data.
    
- Future paths are rendered from bootstrap data.
    

F. Stack compliance

- Three.js is active for globe.
    
- MapLibre and deck.gl are actually mounted and used.
    
- PixiJS is actually mounted and visible.
    
- Matter.js visibly affects stage behavior.
    
- XState orchestrates scenes.
    
- inkjs drives narrative.
    
- GSAP is used for transition timing.
    
- ScrollTrigger is meaningfully registered and used.
    
- D3 drives the compression visual.
    
- Tone.js produces scene-aware sound.
    

# ==================================================  
8. DEBUGGING INSTRUCTIONS

Before coding blindly, inspect the current app path and answer these internally:

- which component actually renders first on load?
    
- which components exist but are not mounted?
    
- are particles invisible because of size/color/radius/camera, or because animation is broken?
    
- are markers on the far side of the globe or hidden by weak styling?
    
- is there already a landing stage shell that just lacks map/deck integration?
    
- what is the minimum change path that yields maximum perceptual improvement without replacing working architecture?
    

Then implement.

# ==================================================  
9. FINAL RESPONSE FORMAT

When done, do not say “build passes” and stop.

Return:

1. Summary of what was missing
    
2. Files added
    
3. Files changed
    
4. Which stack elements are now truly implemented
    
5. Which acceptance tests you verified visually
    
6. Anything still deferred
    
7. Why the new entry scene now satisfies the spec
    

