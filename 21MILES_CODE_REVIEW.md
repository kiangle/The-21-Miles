# 21 MILES — CODE REVIEW: COMPLETE FINDINGS

## For Claude Code: Read this entire document, then fix every issue.

I did a first-principles code review of every file in the codebase. 
Below is every broken connection, missing piece, and architectural gap.

---

## CRITICAL FINDING 1: No shipping scene exists

`createScene()` in PixiStage.tsx handles three actor modes:
- `'medicine'` → MedicineScene
- `'convoys'` → FreightScene  
- `'chamber'` → MonthScene

**There is no `'ships'` case.** When the user taps "Follow the... Shipping", 
the recipe resolves to `actorMode: 'ships'` but `createScene()` returns `null`.
The Pixi canvas shows NOTHING for shipping.

`FlowBandRenderer.ts` (320 lines) exists but is **dead code** — never imported 
by the recipe system. Same for `SplitFutureRenderer`, `FilamentRenderer`, 
`CongestionRenderer`, `MarginRenderer`. They were replaced by the recipe system 
but only 3 of 4 needed scenes were implemented.

**FIX:** Create `src/stage/scene/recipes/ShippingScene.ts` — a recipe-based 
shipping scene that shows vessel bodies flowing along projected routes from 
Hormuz through the Indian Ocean to Mombasa. Add `case 'ships'` to `createScene()`.

The shipping scene must show:
- 15-20 vessel bodies flowing along a route path from hormuz → babElMandeb → Mombasa
- Chokepoint walls at hormuz position (from AnchorProjector)
- Cape reroute path activating based on pressure (constricted state)
- Queue bloom at the chokepoint when constricted
- Ship miniatures with wake trails (use drawShipMiniature from MiniatureFactory)

Use the same pattern as FreightScene: read positions from `this.ctx.anchors`, 
create Matter bodies, draw with PIXI.Graphics each frame.

---

## CRITICAL FINDING 2: No real basemap

MapRoot.tsx loads GeoJSON from `/geo/world_land_110m.geojson` (9KB, 8 features).
That's roughly 8 crude continent outlines. It looks like a black void with 
faint gray scratches because:
- Land color: `#0d1220` (nearly invisible on `#070b18` background)
- No coastline detail
- No ocean features
- No labels

**FIX:** Replace the map style with real vector tiles. Use one of these free 
dark basemap styles:

Option A (preferred): MapTiler Dark Matter
```typescript
const STYLE = 'https://api.maptiler.com/maps/dataviz-dark/style.json?key=YOUR_KEY'
```

Option B (no key needed): Carto Dark Matter
```typescript  
const STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    'carto': {
      type: 'raster',
      tiles: ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'],
      tileSize: 256,
      attribution: '© CARTO © OpenStreetMap'
    }
  },
  layers: [{
    id: 'carto-tiles',
    type: 'raster',
    source: 'carto',
    paint: { 'raster-opacity': 0.7 }
  }]
}
```

Option C (free, no API key): Stadia Dark
```typescript
const STYLE = 'https://tiles.stadiamaps.com/styles/alidade_smooth_dark.json'
```

Keep the corridor GeoJSON overlay on top of the real tiles. The deck.gl layers 
for shipping routes and chokepoints remain unchanged.

If none of these work due to network restrictions, at minimum dramatically 
increase the contrast of the current GeoJSON style: land should be `#1a2840` 
(visible navy), Kenya should be `#223352` (clearly distinct), coastline should 
be `#3a5580` at width 3.0.

---

## CRITICAL FINDING 3: Map too zoomed in, no shipping route visible

When landed, the map centers on Kenya at zoom 4.8. At this zoom level, you 
CANNOT see the Hormuz-to-Mombasa shipping route. The Indian Ocean barely fits.

**FIX:** Map focus must change with lens:

```typescript
// Update MAP_FOCUS_PRESETS to include a shipping-zoom level
export const MAP_FOCUS_PRESETS = {
  world:    { center: [42, 15],      zoom: 1.8, pitch: 0,  bearing: 0 },
  shipping: { center: [50, 5],       zoom: 3.0, pitch: 10, bearing: -15 }, // NEW: Indian Ocean overview showing Hormuz → Mombasa
  kenya:    { center: [37.6, -1.4],  zoom: 4.8, pitch: 10, bearing: 0 },
  corridor: { center: [38.2, -2.5],  zoom: 6.6, pitch: 20, bearing: -12 },
  mombasa:  { center: [39.67, -4.05],zoom: 8.5, pitch: 30, bearing: -10 },
  nairobi:  { center: [36.82, -1.29],zoom: 8.7, pitch: 30, bearing: 10 },
}
```

When lens changes, animate the map to the appropriate focus:
- "Shipping" → zoom to `shipping` preset (shows Hormuz, Arabian Sea, Indian Ocean, Mombasa)
- "Freight" → zoom to `corridor` preset  
- "Medicine" → zoom to `kenya` preset
- "Food/Household" → zoom to `nairobi` preset

Use MapLibre's `map.flyTo()` for smooth GSAP-like transitions:
```typescript
map.flyTo({ 
  center: preset.center, 
  zoom: preset.zoom, 
  pitch: preset.pitch,
  bearing: preset.bearing,
  duration: 2000,
  essential: true 
})
```

---

## CRITICAL FINDING 4: Shipping routes vanish in landed phase

MapRoot.tsx line 200: `// NO shipping routes in landed phase — we're inside Kenya now`

This is wrong. When the user taps "Follow the... Shipping", they need to SEE 
shipping routes. The deck.gl PathLayer for shipping routes must be visible 
when `lens === 'shipping'`, even in landed phase.

**FIX:** In `buildDeckLayers()`, show shipping routes in landed phase when lens 
is shipping:

```typescript
if (globePhase) {
  // Globe phase: show all routes
  return [shippingPathLayer, chokepointLayer]
} else {
  // Landed phase: show based on lens
  const layers = [corridorPathLayer, portDotsLayer]
  if (lens === 'shipping') {
    layers.push(shippingPathLayer) // ADD THIS
    layers.push(chokepointLayer)   // ADD THIS
  }
  return layers
}
```

---

## CRITICAL FINDING 5: AnchorProjector missing shipping route anchors

The AnchorProjector only has 8 anchor points:
```
hormuz, babElMandeb, mombasa, nairobi, hospital, corridorQ1, corridorMid, corridorQ3
```

For the shipping scene, we need intermediate points along the Hormuz→Mombasa 
route so vessels can flow along a realistic path.

**FIX:** Add route waypoints to DEFAULT_ANCHORS:
```typescript
const DEFAULT_ANCHORS = [
  // Existing anchors
  { id: 'hormuz',      lngLat: [56.3, 26.5] },
  { id: 'babElMandeb', lngLat: [43.3, 12.6] },
  { id: 'mombasa',     lngLat: [39.67, -4.05] },
  { id: 'nairobi',     lngLat: [36.82, -1.29] },
  { id: 'hospital',    lngLat: [36.78, -1.30] },
  { id: 'corridorQ1',  lngLat: [39.0, -3.3] },
  { id: 'corridorMid', lngLat: [38.2, -2.5] },
  { id: 'corridorQ3',  lngLat: [37.5, -1.8] },
  
  // NEW: Shipping route waypoints
  { id: 'route_gulf',     lngLat: [54.0, 24.0] },   // Persian Gulf exit
  { id: 'route_arabian',  lngLat: [51.0, 18.0] },   // Arabian Sea
  { id: 'route_socotra',  lngLat: [48.0, 12.0] },   // Off Socotra
  { id: 'route_indian1',  lngLat: [45.0, 5.0] },    // Indian Ocean
  { id: 'route_indian2',  lngLat: [43.0, 0.0] },    // Equatorial
  { id: 'route_approach', lngLat: [41.0, -2.0] },   // Kenya approach
  
  // NEW: Cape reroute waypoints
  { id: 'cape_start',    lngLat: [43.0, 12.0] },    // Bab el-Mandeb exit
  { id: 'cape_south1',   lngLat: [42.0, 0.0] },     // Down East Africa
  { id: 'cape_south2',   lngLat: [38.0, -15.0] },   // Mozambique Channel
  { id: 'cape_tip',      lngLat: [18.5, -34.4] },   // Cape of Good Hope
  { id: 'cape_north1',   lngLat: [25.0, -25.0] },   // Up West Africa
  { id: 'cape_north2',   lngLat: [35.0, -15.0] },   // Back to Indian Ocean
  { id: 'cape_approach', lngLat: [40.0, -5.0] },    // Approaching Mombasa
]
```

---

## CRITICAL FINDING 6: Lens switching doesn't change map focus

Shell.tsx dispatches `SET_LENS` events. The XState machine updates `context.lens`.
But MapRoot receives `lens` as a prop and ONLY uses it to color the corridor line.
It never calls `map.flyTo()` to change the camera.

**FIX:** In MapRoot, add a useEffect that responds to lens changes:

```typescript
useEffect(() => {
  if (!mapRef.current || globePhase) return
  const map = mapRef.current
  
  const focusMap: Record<LensId, MapFocus> = {
    shipping: 'shipping',  // zooms out to show Hormuz → Mombasa
    freight: 'corridor',
    medicine: 'kenya',
    household: 'nairobi',
  }
  
  const focus = MAP_FOCUS_PRESETS[focusMap[lens] || 'kenya']
  map.flyTo({
    center: focus.center,
    zoom: focus.zoom,
    pitch: focus.pitch,
    bearing: focus.bearing,
    duration: 2000,
    essential: true,
  })
  
  // Update anchor projections after camera move
  map.once('moveend', () => {
    projectorRef.current.reproject()
  })
}, [lens, globePhase])
```

---

## CRITICAL FINDING 7: Recipe system prevents multi-layer rendering

The `SceneRecipeController` disposes the previous scene when a new one applies.
This means you can NEVER see residual effects from previous lenses. When you 
switch from Shipping to Freight, ships completely vanish — there's no cross-fade 
or ghosted residual.

**FIX:** Instead of hard-disposing, allow the old scene to fade out over 1 second:

```typescript
apply(recipe: SceneRecipe, ctx: SceneCtx) {
  if (this.active?.id === recipe.id) return
  
  // Fade out the old scene instead of instant dispose
  if (this.active) {
    const dying = this.active
    const container = (dying as any).container as PIXI.Container
    if (container) {
      gsap.to(container, {
        alpha: 0,
        duration: 1.0,
        ease: 'power2.in',
        onComplete: () => {
          dying.dispose()
        },
      })
    } else {
      dying.dispose()
    }
  }
  
  this.active = this.factory(recipe, ctx)
  
  // Fade in the new scene
  if (this.active) {
    const container = (this.active as any).container as PIXI.Container
    if (container) {
      container.alpha = 0
      gsap.to(container, {
        alpha: 1,
        duration: 0.8,
        ease: 'power2.out',
        delay: 0.3,
      })
    }
  }
}
```

---

## CRITICAL FINDING 8: Narrative tags never parsed

The ink file contains scene directives like:
```
# SCENE: rupture
# MORPH: shipping -> freight -> import_stress -> medicine
# SOUND: discovery_chord
# DISCOVERY: refinery_medical
```

But `InkEngine.ts` doesn't parse these tags. It reads text and choices but 
ignores the `#` tag lines.

**FIX:** In InkEngine, parse tags from ink and emit them as events:

```typescript
// After advancing the story and reading text:
const tags = this.story.currentTags || []
for (const tag of tags) {
  const [key, ...valueParts] = tag.split(':')
  const value = valueParts.join(':').trim()
  switch (key.trim()) {
    case 'SCENE':
      this.emit('scene_change', value)
      break
    case 'MORPH':
      this.emit('morph', value.split('->').map(s => s.trim()))
      break  
    case 'SOUND':
      this.emit('sound', value)
      break
    case 'DISCOVERY':
      this.emit('discovery', value)
      break
    case 'SPLIT_SCREEN':
      this.emit('split_screen', value === 'true')
      break
    case 'FUTURE':
      this.emit('future_change', value)
      break
  }
}
```

Then in Shell.tsx, listen for these events and dispatch to XState/audio.

---

## FINDING 9: Time/future only changes atmospheric filters

When you scrub time from Day 1 to Month 1, the only visible change is:
- Noise filter intensity: 0.03 → 0.09
- Color matrix: slight red shift
- Vignette: no change

The actual physics bodies don't change. Chokepoint walls don't move. Congestion 
doesn't increase. Supply gates don't constrict.

**FIX:** The recipe must re-resolve when time changes. Currently `resolveRecipe()` 
returns different recipes for different times (e.g. `amara_medicine_day1` vs 
`amara_medicine_week1`), but the pressure values in those recipes need to 
actually affect the scene's physics. Each scene should read `recipe.pressure` 
and configure its bodies accordingly.

In each scene constructor, use `recipe.pressure` to set:
- Chokepoint gap width: `30 * (1 - pressure)`
- Congestion attractor strength: `0.00003 * (0.5 + pressure)`
- Supply gate opening: `40 * (1 - pressure * 0.6)` 
- Number of reroute vessels: `Math.floor(pressure * 12)`
- Compression wall insets: proportional to `pressure`

---

## FINDING 10: "What happens next?" doesn't trigger split screen

`SplitFutureRenderer` exists but is never instantiated by the recipe system.
When the user taps a future path, the XState machine updates `context.future`,
but the visual stage doesn't split.

**FIX:** The split screen should be a special overlay that lives OUTSIDE the 
recipe system (since it needs to show two worlds simultaneously). When 
`compareMode === true`:

1. Keep the current recipe scene alive (left half)
2. Create a SECOND instance of the same scene with modified pressure (right half)
3. Apply Pixi masks to clip each half
4. Show labels: "How things stand now" / "If this happens..."

This requires the SplitFutureRenderer to become a SceneRecipeController-level 
concern, not a renderer.

---

## SUMMARY: Fix priority order

1. **Add real basemap tiles** (Carto Dark raster — no API key needed)
2. **Create ShippingScene.ts** (ship bodies on Hormuz→Mombasa route)
3. **Add shipping route anchors** to AnchorProjector
4. **Show shipping routes in landed phase** (deck.gl PathLayer when lens=shipping)
5. **Lens changes map focus** (flyTo different zoom levels per lens)
6. **Cross-fade recipe transitions** (don't instant-dispose)
7. **Parse ink narrative tags** (drive scene/sound/morph from ink)
8. **Pressure affects physics** (recipe.pressure → body configuration)
9. **Wire split screen** for "What happens next?"
10. **Show shipping routes in landed phase deck.gl**

If you fix items 1-6, the app will look and feel dramatically better.
Items 7-10 are important but can follow.
