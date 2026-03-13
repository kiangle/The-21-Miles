

This one is tactical and assumes it should work against the existing repo rather than freehand a new architecture.

````text
This is the tactical patch plan.

Do NOT restart the app from scratch.
Patch the existing repo surgically, but thoroughly.

Your job is to inspect what is already implemented, identify where the live render path is failing, and then upgrade the current code so the shipped experience finally matches the spec.

==================================================
A. FIRST: AUDIT THE LIVE RENDER PATH
==================================================

Before making large changes, inspect the current mount path and identify:

1. Which component renders first on app load?
2. Which scene/component currently owns the opening globe?
3. Which components exist in the repo but are not actually mounted?
4. Whether shipping particles are:
   - not created
   - created but too dim/small
   - inside the globe
   - culled
   - hidden by camera/framing
   - blocked by wrong render order
5. Whether the country markers and rupture pulse are:
   - created but too subtle
   - on the back side of the sphere
   - delayed too late
   - hidden by material/opacity issues
6. Whether MapLibre/deck.gl code exists in partial form and is just disconnected

Then proceed with the patch plan below.

At the end, tell me the exact current live render path before and after your patch.

==================================================
B. ENTRY SCENE PATCHES
==================================================

PATCH 1 — Fix the Earth material fallback
-----------------------------------------

Current problem:
- if `/textures/*.jpg` are missing, the globe falls back to a plain blue material
- this is why the opening reads as a blue sphere

Do this:
1. Keep texture loading if texture files later get added
2. But replace the fallback with a proper procedural Earth mode

Implementation approach:
- in the globe/Earth component, detect failed texture load
- switch to `proceduralEarthMode = true`
- render:
  - dark ocean sphere
  - atmosphere shell
  - simplified landmass overlays from geo polygons or reduced continent outlines

If existing `GlobeScene.ts` or similar already creates the Earth mesh, patch there rather than duplicating scene ownership.

Minimum implementation:
- ocean mesh
- atmosphere glow shell
- land silhouette layer

Use:
- ocean #0a1628
- land #1a2a3a / #24364a
- soft rim glow

Do NOT accept plain `MeshPhongMaterial(color: blue)` as final fallback.

PATCH 2 — Strengthen starfield
------------------------------

If stars already exist, improve them rather than replacing blindly.

Requirements:
- enough stars to be visible on first glance
- subtle depth and size variation
- no distracting giant points

Implementation:
- use `THREE.BufferGeometry`
- 2000–6000 stars
- random spherical distribution or large cube cloud
- opacity variation
- slightly larger density behind the hero globe framing

Verify stars remain visible after all lighting changes.

PATCH 3 — Make shipping routes readable immediately
---------------------------------------------------

Current likely problem:
- particles exist but are too small / too close in color / too near sphere surface

Patch existing shipping particle file, not a duplicate.

Do all of this:
1. Increase particle size significantly
2. Move particles slightly farther above the globe radius
3. Brighten color to off-white / warm gold
4. Ensure additive blending and no depth write
5. Confirm animation tick runs from first frame
6. Confirm routes are actually sampled into enough segments
7. Increase particle count per route based on importance/volume

Target:
- 1500–3000 visible particles
- first glance should clearly show moving maritime corridors

Use a route state structure like:
```ts
type RouteVisualState = {
  id: string
  blocked: boolean
  blockSeverity: number
  density: number
  speedMultiplier: number
}
````

If current implementation uses one global particle pool, keep it if workable.  
If not, split per-route for easier blocking and tuning.

## PATCH 4 — Ensure lat/lng projection is correct

Check the existing conversion function.

It must map lat/lng to the same handedness/orientation as the globe camera.

Use and standardize on one conversion only:

```ts
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

Then audit every use site:

- particles
    
- markers
    
- Hormuz hotspot
    
- fly-to targets
    

Make sure all of them use the same function and same radius logic.

## PATCH 5 — Hormuz rupture must be staged strongly

Current code may already include a rupture effect.  
Patch it to become visually undeniable.

Requirements:

- visible from opening camera
    
- red/orange pulsing hotspot
    
- expanding ring / glow pulse
    
- after ~3 seconds affected flows visibly thin/stop
    

Implementation direction:

- create a marker group at Hormuz
    
- attach:
    
    - core glow sprite
        
    - one or two ring meshes or billboards
        
    - animated opacity/scale
        
- wire rupture timing through XState or central scene timing, not ad hoc `setTimeout` in multiple places
    

Affected routes:

- define route metadata that says whether a route depends on Hormuz
    
- after rupture, set `blocked` or `blockSeverity`
    
- reduce speed and opacity, or fully stop particles on those routes
    

If reroute logic exists:

- increase density on Cape detour route after a delay
    
- otherwise at least reduce blocked route flow clearly
    

## PATCH 6 — Country markers must be front-staged

Current markers may exist but be too subtle.

Patch marker logic to:

1. render from Atlas bootstrap countries
    
2. emphasize markers currently on the front-facing hemisphere
    
3. boost selected marker
    
4. make pulse readable
    
5. ensure Kenya is visible in the opening composition
    

Implementation pattern:

- compute each marker normal
    
- compute view alignment:
    

```ts
const facing = markerNormal.dot(cameraDirectionToMarkerOrCameraForwardEquivalent)
```

- opacity/scale = stronger when facing > threshold
    

Use either:

- sprite markers with glow  
    or
    
- small emissive spheres + sprite halo
    

The opening should not require the user to hunt for markers.

## PATCH 7 — Camera framing and composition

The current camera framing makes the globe dominant but lifeless.

Patch:

- slightly angle the globe so Africa / Middle East / Indian Ocean trade context reads
    
- ensure Kenya and Hormuz are compositionally meaningful
    
- add slow rotation/drift
    
- adjust camera FOV and distance until:
    
    - Earth reads as Earth
        
    - trade currents are visible
        
    - the rupture is legible
        
    - country markers are not lost
        

Do not optimize for mathematical purity.  
Optimize for what the user sees.

## PATCH 8 — Entry text and font compliance

Patch `index.html` with:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
```

Then patch text styles so:

- “21 miles” uses Instrument Serif
    
- “Where do you live?” uses Instrument Sans
    
- spacing, size, line-height feel premium and calm
    
- no generic browser/system fallback feel
    

# ==================================================  
C. MAPLIBRE + DECK.GL PATCHES

## PATCH 9 — Actually mount MapLibre after country selection

Current issue:

- dependency may exist but not be wired
    

You must create or patch the actual post-selection flow so that:

1. user clicks Kenya
    
2. fly-to starts
    
3. globe scene crossfades
    
4. MapLibre mounts
    
5. map centers on Nairobi/Kenya region
    
6. deck.gl overlays routes/ports/chokepoints
    
7. Pixi overlays continue the living-world effect
    

Do not leave MapLibre as a dead dependency.

Create or patch:

- `src/stage/map/MapRoot.tsx`
    
- `src/stage/map/DeckRouteLayer.ts`
    
- any style/viewport helper needed
    

## PATCH 10 — Use a dark map style that supports the visual tone

If remote styles are unreliable, provide a local/minimal style or graceful fallback.

Requirements:

- dark restrained geography
    
- not cluttered
    
- labels minimal
    
- map acts as geographic grounding, not noisy UI
    

## PATCH 11 — deck.gl overlays must show real consequence geography

At minimum, render:

- shipping paths
    
- chokepoints
    
- ports
    
- selected country anchor
    

Use:

- `PathLayer` for routes
    
- `ScatterplotLayer` for ports/chokepoints
    

Example direction:

```ts
const layers = [
  new PathLayer({
    id: 'shipping-paths',
    data: routes,
    getPath: d => d.coordinates,
    getColor: d => d.blocked ? [170, 90, 90, 220] : [190, 220, 255, 220],
    getWidth: d => d.stressed ? 5 : 3,
    widthUnits: 'pixels',
    rounded: true
  }),
  new ScatterplotLayer({
    id: 'chokepoints',
    data: chokepoints,
    getPosition: d => [d.lng, d.lat],
    getRadius: d => d.id === 'hormuz' ? 12000 : 8000,
    radiusUnits: 'meters',
    getFillColor: d => d.id === 'hormuz' ? [255, 90, 60, 210] : [255, 210, 150, 180]
  })
]
```

The point is not just to “use deck.gl.”  
The point is to show geographic truth after the cinematic descent.

# ==================================================  
D. PIXI + MATTER PATCHES

## PATCH 12 — Keep Pixi as the living layer over the map

Do NOT let the landed stage become just MapLibre + deck.gl.

Patch the stage layering so:

- base = MapLibre
    
- overlay = deck.gl
    
- hero meaning layer = Pixi
    
- physical pressure layer = Matter where needed
    

If current Pixi stage exists, ensure it is mounted on top of the landed stage, not trapped in a disconnected screen.

## PATCH 13 — Matter must produce visible chokepoint/congestion behavior

If Matter already exists, make sure it is not just technically instantiated.

Use it where it teaches pressure:

- route compression
    
- vessel bunching near chokepoint
    
- accumulation before rerouting
    
- wall narrowing for compression visual
    

The user should be able to feel:

- blockage
    
- pressure buildup
    
- constraint
    

# ==================================================  
E. XSTATE / ORCHESTRATION PATCHES

## PATCH 14 — Move timing logic into the machine where possible

If current code uses scattered `setTimeout`s in components for:

- text reveal
    
- rupture timing
    
- marker reveal
    
- fly-to start
    
- compare reveal
    

Consolidate important scene timing into XState or one orchestration controller.

At minimum, scene progression should be explicit:

- boot
    
- entry_idle
    
- rupture_started
    
- entry_selectable
    
- country_selected
    
- flying
    
- landed
    
- role_selected
    
- rupture_consequence
    
- future_compare
    

## PATCH 15 — Make bootstrap data drive UI lists

Patch any places where UI still hardcodes:

- Kenya
    
- Nurse
    
- Truck Driver
    
- future paths
    

Render from bootstrap data instead.

Specifically inspect:

- country markers
    
- country selector logic
    
- role chips/buttons
    
- “What happens next?” options
    
- narrative pack loading
    

# ==================================================  
F. NARRATIVE / LIVE PARAMS PATCHES

## PATCH 16 — Narrative pack must be loaded from bootstrap

Do not hardcode `kenya.ink` if bootstrap already specifies narrative pack.

Patch:

```ts
const narrativePath = `/ink/${bootstrap.narrative_pack}.ink.json`
```

Inject runtime variables from selected role and live params.

## PATCH 17 — Live params must actually move visuals

If live params currently only update text, patch them so they also affect at least:

- route density
    
- pulse intensity
    
- compression number
    
- “updated recently” indicator
    

A live world must not feel static after first load.

# ==================================================  
G. SCROLLTRIGGER PATCHES

## PATCH 18 — Register and use ScrollTrigger meaningfully

The spec required GSAP + ScrollTrigger.

You must not leave ScrollTrigger absent.

At minimum:

- register plugin
    
- create one pinned progression segment in the landed story flow
    
- use it to synchronize a visual shift, such as:
    
    - from route detour view
        
    - to medicine cadence
        
    - to household compression
        

Even if the app remains mostly click-driven, ScrollTrigger must be real and visible in use.

Example:

```ts
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
gsap.registerPlugin(ScrollTrigger)

ScrollTrigger.create({
  trigger: '.story-stage',
  start: 'top top',
  end: '+=2000',
  pin: true,
  scrub: true,
  onUpdate: self => {
    const p = self.progress
    // drive lens/morph/value transitions
  }
})
```

# ==================================================  
H. DATA FILE PATCHES

## PATCH 19 — Add missing public/geo data files

Create:

- `public/geo/shipping_routes.json`
    
- `public/geo/chokepoints.json`
    
- `public/geo/countries.json`
    
- `public/geo/ports.json`
    

These do not need to be globally exhaustive for MVP, but they must be real and useful.

Minimum expected content:

`countries.json`

- Kenya
    
- Japan
    
- Germany
    
- India
    
- USA
    
- UK
    

`chokepoints.json`

- Hormuz
    
- Suez
    
- Bab el-Mandeb
    
- Malacca
    
- Panama
    

`ports.json`

- Mombasa
    
- Dubai/Jebel Ali
    
- Rotterdam
    
- Singapore
    
- Yokohama/Tokyo equivalent
    
- key US comparator if needed
    

`shipping_routes.json`

- at least 8 routes
    
- include Hormuz path, Suez path, Cape reroute, Malacca, Panama, and Mombasa-relevant routes
    

## PATCH 20 — Add local fallback asset policy

If no real textures/audio assets are present:

- provide procedural/rendered fallbacks
    
- do not let the experience collapse into placeholders
    

# ==================================================  
I. PERFORMANCE / CLEANUP PATCHES

## PATCH 21 — Dispose scenes and loops properly

Inspect and patch cleanup for:

- Three.js renderer, materials, geometry, textures
    
- Pixi app/ticker
    
- Matter engine/world
    
- Tone transport/synth cleanup if needed
    
- map destroy/unmount
    

## PATCH 22 — Remove dead or misleading placeholder code

If there are files that exist only to satisfy folder count but are not wired:

- either wire them properly
    
- or delete them
    

Prefer a smaller truthful repo over a bloated shallow one.

# ==================================================  
J. REQUIRED OUTPUT AFTER PATCHING

When finished, report in this format:

1. Live render path before patch
    
2. Live render path after patch
    
3. Root cause of the blue-ball opening
    
4. Root cause of weak/missing visible shipping flows
    
5. Root cause of missing/dead stack elements
    
6. Files added
    
7. Files changed
    
8. Which required libraries are now truly used in mounted code:
    
    - Three.js
        
    - MapLibre
        
    - deck.gl
        
    - PixiJS
        
    - Matter.js
        
    - XState
        
    - inkjs
        
    - GSAP
        
    - ScrollTrigger
        
    - D3
        
    - Tone.js
        
9. Which spec acceptance checks were visually verified
    
10. Which items are still deferred, if any
    

Do NOT stop at “build passes.”  
The patch is only done when the opening visibly feels like a living Earth from space and the landing stage genuinely uses MapLibre + deck.gl + Pixi.

````

Then I would send Claude one short final note right after:

```text
Prioritize in this order:
1. Fix the entry globe so it is unmistakably Earth with visible trade flow
2. Wire MapLibre + deck.gl into the actual landed stage
3. Make Atlas bootstrap drive countries/roles/futures/narrative
4. Then clean timing/orchestration/polish

I care more about mounted, visible truth than architecture theater.
````

