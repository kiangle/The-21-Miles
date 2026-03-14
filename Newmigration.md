I can’t honestly promise zero debugging, because that would be fake confidence. But this is the lowest-risk, most deterministic implementation brief I can give you, and it fixes the actual foundation first so Claude stops patching symptoms.
 

The key is:
 

Do not do more art fixes until the spatial backbone and scene contract are correct.
 

Also, this stack choice is sound: [deck.gl](http://deck.gl) ’s docs say @[deck.gl/mapbox](http://deck.gl/mapbox)  integrates with the Mapbox/MapLibre API-compatible ecosystem, and [deck.gl](http://deck.gl) ’s newer notes say MapLibre v5 globe works seamlessly with MapboxOverlay; MapLibre’s docs also have official globe and atmosphere examples.
 

Use this exact brief with Claude Code.
 
This is the next implementation brief.
 
Do not do another renderer-only patch.
 
Do not do another visual tweak pass first.
 
Do not push to main.
 

I need the spatial backbone and scene orchestration fixed first.
 

\==================================================
 
GOAL
 
\==================================================
 

Build one coherent 21 Miles runtime with:
 

\- MapLibre + [deck.gl](http://deck.gl)  as the single spatial backbone
 
\- one globe-context phase
 
\- one landed-Kenya story phase
 
\- projected anchors from the live map camera
 
\- one active SceneRecipe at a time
 
\- Ink beat -> SceneRecipe mapping
 
\- hard resets on all transitions
 

Only after that is stable:
 
\- improve actor art
 
\- improve trails
 
\- improve food / medicine / freight visuals
 

\==================================================
 
PHASE ORDER (MANDATORY)
 
\==================================================
 

PHASE 1 — SPATIAL BACKBONE
 
PHASE 2 — SCENE ORCHESTRATION
 
PHASE 3 — ONE CORRECT BEAT
 
PHASE 4 — ONLY THEN VISUAL BEAUTIFICATION
 

If Phase 1–3 are not correct, stop. Do not continue to polish.
 

\==================================================
 
PHASE 1 — SPATIAL BACKBONE
 
\==================================================
 

\--------------------------------------------------
 
1\. PACKAGE UPDATES
 
\--------------------------------------------------
 

Update package versions so the globe/deck integration uses the current supported path.
 

package.json dependencies should be:
 

\`\`\`json
 
{
 
  "maplibre-gl": "^5.20.1",
 
  "@[deck.gl/core](http://deck.gl/core) ": "^9.2.0",
 
  "@[deck.gl/layers](http://deck.gl/layers) ": "^9.2.0",
 
  "@[deck.gl/mapbox](http://deck.gl/mapbox) ": "^9.2.0"
 
}
 
Keep Pixi and Matter.
 
Do not remove them.
 
Do not use Mapbox.
 

Then run:
 

*   npm install
     
*   npm run build
     

2.  REMOVE THE OLD EARTH AS THE PRIMARY PATH
     

The old custom Three globe must no longer be the active Earth path.
 

Do this:
 

*   remove or bypass any remaining createGlobeScene() / custom Three globe path from Shell
     
*   keep Three only if a tiny intro flourish remains absolutely necessary
     
*   StageProvider must not own Earth rendering anymore
     

The Earth/context phase must now come from MapLibre.
 

3.  ADD REAL WORLD BASEMAP ASSETS
     

Current problem:
 
the globe feels empty because the style only contains East Africa/Kenya local geometry.
 

Add these static assets into public/geo/:
 

*   world\_land\_110m.geojson
     
*   world\_coastline\_110m.geojson
     

Use a simplified Natural Earth-style dataset.
 
Do not rely on a tokened third-party basemap for this stage.
 
I want deterministic local assets.
 

Also keep:
 

*   countries.json
     
*   chokepoints.json
     
*   ports.json
     
*   shipping\_routes.json
     

4.  REWRITE MapRoot.tsx AS THE REAL SPATIAL BACKBONE
     

Current problems to fix:
 

*   no true world basemap
     
*   deck is not camera-synced properly
     
*   hidden projection switching
     
*   map is visually too passive
     

Replace the current detached Deck instance with a real MapLibre + deck overlay integration.
 

Use MapboxOverlay from @[deck.gl/mapbox](http://deck.gl/mapbox) .
 

Target behavior:
 

*   MapLibre owns the camera
     
*   [deck.gl](http://deck.gl)  follows the live camera automatically
     
*   globe projection is enabled
     
*   deck layers remain aligned during camera moves
     

Code direction for src/stage/map/MapRoot.tsx:
 
import React, { useEffect, useRef } from 'react'
 
import maplibregl from 'maplibre-gl'
 
import 'maplibre-gl/dist/maplibre-gl.css'
 
import { MapboxOverlay } from '@[deck.gl/mapbox](http://deck.gl/mapbox) '
 
import { PathLayer, ScatterplotLayer, GeoJsonLayer } from '@[deck.gl/layers](http://deck.gl/layers) '
 
import { getAnchorProjector } from './AnchorProjector'
 
import type { MapFocus } from '../scene/SceneRecipe'
 
import type { BootstrapResponse } from '../../atlas/types'
 
import type { LensId } from '../../state/machine/worldContext'
 

type Props = {
 
  bootstrap: BootstrapResponse | null
 
  lens: LensId
 
  mapFocus: MapFocus
 
  globePhase: boolean
 
  ruptured: boolean
 
  onSelectKenya?: () => void
 
  onMapReady?: (map: [maplibregl.Map](http://maplibregl.Map) ) => void
 
  onFlyToComplete?: () => void
 
}
 

const STYLE: maplibregl.StyleSpecification = {
 
  version: 8,
 
  projection: { type: 'globe' },
 
  sources: {
 
    'world-land': {
 
      type: 'geojson',
 
      data: '/geo/world\_land\_110m.geojson'
 
    },
 
    'world-coast': {
 
      type: 'geojson',
 
      data: '/geo/world\_coastline\_110m.geojson'
 
    },
 
    'kenya': {
 
      type: 'geojson',
 
      data: '/geo/kenya.geojson'
 
    },
 
    'corridor': {
 
      type: 'geojson',
 
      data: {
 
        type: 'FeatureCollection',
 
        features: \[{
 
          type: 'Feature',
 
          properties: {},
 
          geometry: {
 
            type: 'LineString',
 
            coordinates: \[
 
              \[39.67, -4.05\],
 
              \[38.8, -3.2\],
 
              \[37.5, -2.0\],
 
              \[36.82, -1.29\]
 
            \]
 
          }
 
        }\]
 
      }
 
    }
 
  },
 
  layers: \[
 
    {
 
      id: 'bg',
 
      type: 'background',
 
      paint: { 'background-color': '#050814' }
 
    },
 
    {
 
      id: 'world-land-fill',
 
      type: 'fill',
 
      source: 'world-land',
 
      paint: { 'fill-color': '#0d1220', 'fill-opacity': 1 }
 
    },
 
    {
 
      id: 'world-coast-line',
 
      type: 'line',
 
      source: 'world-coast',
 
      paint: { 'line-color': '#1c2741', 'line-width': 1.2, 'line-opacity': 0.8 }
 
    },
 
    {
 
      id: 'kenya-fill',
 
      type: 'fill',
 
      source: 'kenya',
 
      paint: { 'fill-color': '#131a2b', 'fill-opacity': 0.8 }
 
    },
 
    {
 
      id: 'kenya-border',
 
      type: 'line',
 
      source: 'kenya',
 
      paint: { 'line-color': '#2f4067', 'line-width': 2.0, 'line-opacity': 0.95 }
 
    },
 
    {
 
      id: 'corridor-line',
 
      type: 'line',
 
      source: 'corridor',
 
      paint: {
 
        'line-color': '#b88b4a',
 
        'line-width': 3.5,
 
        'line-opacity': 0.45,
 
        'line-dasharray': \[6, 3\]
 
      }
 
    }
 
  \],
 
  sky: {
 
    'sky-color': '#081223',
 
    'horizon-color': '#152844',
 
    'fog-color': '#07111d',
 
    'sky-horizon-blend': 0.5
 
  }
 
}
 

const MAP\_FOCUS\_PRESETS = {
 
  world:    { center: \[42, 15\] as \[number, number\], zoom: 1.8, pitch: 0,  bearing: 0 },
 
  kenya:    { center: \[37.6, -1.4\] as \[number, number\], zoom: 4.8, pitch: 10, bearing: 0 },
 
  corridor: { center: \[38.2, -2.5\] as \[number, number\], zoom: 6.6, pitch: 20, bearing: -12 },
 
  mombasa:  { center: \[39.67, -4.05\] as \[number, number\], zoom: 8.5, pitch: 30, bearing: -10 },
 
  nairobi:  { center: \[36.82, -1.29\] as \[number, number\], zoom: 8.7, pitch: 30, bearing: 10 }
 
}
 

function buildDeckLayers(lens: LensId, ruptured: boolean) {
 
  const routeColor = lens === 'shipping' ? \[114, 183, 255, 210\] : \[80, 120, 180, 90\]
 
  const corridorColor = lens === 'freight' ? \[212, 168, 102, 220\] : \[184, 139, 74, 80\]
 

  return \[
 
    new PathLayer({
 
      id: 'shipping-routes',
 
      data: \[
 
        { path: \[\[56.3, 26.5\], \[43.3, 12.6\], \[39.67, -4.05\]\] },
 
        { path: \[\[39.67, -4.05\], \[18.5, -34.4\], \[-5, -20\]\] }
 
      \],
 
      getPath: d => d.path,
 
      getColor: routeColor,
 
      widthUnits: 'pixels',
 
      getWidth: ruptured ? 4 : 2,
 
      opacity: 0.55
 
    }),
 
    new PathLayer({
 
      id: 'corridor-route',
 
      data: \[
 
        { path: \[\[39.67, -4.05\], \[38.8, -3.2\], \[37.5, -2.0\], \[36.82, -1.29\]\] }
 
      \],
 
      getPath: d => d.path,
 
      getColor: corridorColor,
 
      widthUnits: 'pixels',
 
      getWidth: 5,
 
      opacity: 0.6
 
    }),
 
    new ScatterplotLayer({
 
      id: 'chokepoints',
 
      data: \[
 
        { position: \[56.3, 26.5\], status: 'closed' },
 
        { position: \[43.3, 12.6\], status: 'open' }
 
      \],
 
      getPosition: d => d.position,
 
      getRadius: d => d.status === 'closed' ? 80000 : 50000,
 
      radiusUnits: 'meters',
 
      getFillColor: d => d.status === 'closed' ? \[255, 92, 64, 220\] : \[120, 200, 140, 180\],
 
      opacity: 0.45
 
    }),
 
    new ScatterplotLayer({
 
      id: 'ports',
 
      data: \[
 
        { position: \[39.67, -4.05\] },
 
        { position: \[36.82, -1.29\] }
 
      \],
 
      getPosition: d => d.position,
 
      getRadius: 50000,
 
      radiusUnits: 'meters',
 
      getFillColor: \[220, 200, 158, 200\]
 
    })
 
  \]
 
}
 

export default function MapRoot(props: Props) {
 
  const { lens, ruptured, mapFocus, onSelectKenya, onMapReady, onFlyToComplete } = props
 
  const containerRef = useRef<HTMLDivElement | null>(null)
 
  const mapRef = useRef<[maplibregl.Map](http://maplibregl.Map)  | null>(null)
 
  const deckOverlayRef = useRef<MapboxOverlay | null>(null)
 
  const projectorRef = useRef(getAnchorProjector())
 

  useEffect(() => {
 
    if (!containerRef.current || mapRef.current) return
 

    const map = new [maplibregl.Map](http://maplibregl.Map) ({
 
      container: containerRef.current,
 
      style: STYLE,
 
      center: MAP\_FOCUS\_[PRESETS.world.center](http://PRESETS.world.center) ,
 
      zoom: MAP\_FOCUS\_[PRESETS.world](http://PRESETS.world) .zoom,
 
      pitch: MAP\_FOCUS\_[PRESETS.world](http://PRESETS.world) .pitch,
 
      bearing: MAP\_FOCUS\_[PRESETS.world](http://PRESETS.world) .bearing,
 
      attributionControl: false,
 
      dragRotate: true,
 
      scrollZoom: false,
 
      touchZoomRotate: true,
 
      doubleClickZoom: false
 
    })
 

    mapRef.current = map
 

    map.on('load', () => {
 
      projectorRef.current.attach(map)
 

      const deckOverlay = new MapboxOverlay({
 
        interleaved: false,
 
        layers: buildDeckLayers(lens, ruptured)
 
      })
 
      map.addControl(deckOverlay)
 
      deckOverlayRef.current = deckOverlay
 

      map.on('click', e => {
 
        const features = map.queryRenderedFeatures(e.point, { layers: \['kenya-fill'\] })
 
        if (features.length) onSelectKenya?.()
 
      })
 

      onMapReady?.(map)
 
    })
 

    return () => {
 
      deckOverlayRef.current?.finalize()
 
      deckOverlayRef.current = null
 
      projectorRef.current.detach()
 
      map.remove()
 
      mapRef.current = null
 
    }
 
  }, \[\])
 

  useEffect(() => {
 
    if (!deckOverlayRef.current) return
 
    deckOverlayRef.current.setProps({ layers: buildDeckLayers(lens, ruptured) })
 
  }, \[lens, ruptured\])
 

  useEffect(() => {
 
    const map = mapRef.current
 
    if (!map) return
 
    const preset = MAP\_FOCUS\_PRESETS\[mapFocus\]
 
    map.flyTo({
 
      center: [preset.center](http://preset.center) ,
 
      zoom: preset.zoom,
 
      pitch: preset.pitch,
 
      bearing: preset.bearing,
 
      duration: 1800,
 
      essential: true
 
    })
 
    const onMoveEnd = () => onFlyToComplete?.()
 
    map.once('moveend', onMoveEnd)
 
    return () => map.off('moveend', onMoveEnd)
 
  }, \[mapFocus\])
 

  return <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
 
}
 
Important notes:
 

*   no hidden setProjection('mercator')
     
*   one projection backbone
     
*   deck overlay follows map camera
     
*   globe still reads as Earth because world land/coast exist
     

5.  ANCHORPROJECTOR MUST BECOME THE ONLY SOURCE OF TRUTH
     

Current bug:
 
Pixi still has fallback to fake w \* 0.54 screen positions.
 

Remove that fallback for landed recipes.
 
If projected anchors are not ready, do not render active recipe yet.
 

Patch src/stage/map/AnchorProjector.ts so it is robust and recipe-safe:
 
import type { Map as MapLibreMap, LngLatLike, PointLike } from 'maplibre-gl'
 

export interface ProjectedAnchor {
 
  id: string
 
  lngLat: \[number, number\]
 
  x: number
 
  y: number
 
}
 

const DEFAULT\_ANCHORS: Array<{id: string; lngLat: \[number, number\]}> = \[
 
  { id: 'hormuz', lngLat: \[56.3, 26.5\] },
 
  { id: 'babElMandeb', lngLat: \[43.3, 12.6\] },
 
  { id: 'mombasa', lngLat: \[39.67, -4.05\] },
 
  { id: 'nairobi', lngLat: \[36.82, -1.29\] },
 
  { id: 'hospital', lngLat: \[36.78, -1.30\] },
 
  { id: 'corridorQ1', lngLat: \[39.0, -3.3\] },
 
  { id: 'corridorMid', lngLat: \[38.2, -2.5\] },
 
  { id: 'corridorQ3', lngLat: \[37.5, -1.8\] }
 
\]
 

export class AnchorProjector {
 
  private map: MapLibreMap | null = null
 
  private anchors = new Map<string, ProjectedAnchor>()
 
  private subs = new Set<() => void>()
 

  constructor() {
 
    for (const a of DEFAULT\_ANCHORS) {
 
      this.anchors.set([a.id](http://a.id) , { ...a, x: 0, y: 0 })
 
    }
 
  }
 

  attach(map: MapLibreMap) {
 
    this.detach()
 
    [this.map](http://this.map)  = map
 
    this.reprojectAll()
 
    map.on('move', this.reprojectAll)
 
    map.on('resize', this.reprojectAll)
 
    map.on('zoom', this.reprojectAll)
 
    map.on('rotate', this.reprojectAll)
 
    map.on('pitch', this.reprojectAll)
 
  }
 

  detach = () => {
 
    if (![this.map](http://this.map) ) return
 
    [this.map](http://this.map) .off('move', this.reprojectAll)
 
    [this.map](http://this.map) .off('resize', this.reprojectAll)
 
    [this.map](http://this.map) .off('zoom', this.reprojectAll)
 
    [this.map](http://this.map) .off('rotate', this.reprojectAll)
 
    [this.map](http://this.map) .off('pitch', this.reprojectAll)
 
    [this.map](http://this.map)  = null
 
  }
 

  reprojectAll = () => {
 
    if (![this.map](http://this.map) ) return
 
    for (const anchor of this.anchors.values()) {
 
      const p = [this.map](http://this.map) .project(anchor.lngLat as LngLatLike)
 
      anchor.x = p.x
 
      anchor.y = p.y
 
    }
 
    this.subs.forEach(fn => fn())
 
  }
 

  get(id: string) {
 
    return this.anchors.get(id)
 
  }
 

  getAll() {
 
    const out: Record<string, {x: number; y: number}> = {}
 
    for (const \[id, a\] of this.anchors) out\[id\] = { x: a.x, y: a.y }
 
    return out
 
  }
 

  onUpdate(fn: () => void) {
 
    this.subs.add(fn)
 
    return () => this.subs.delete(fn)
 
  }
 
}
 

let singleton: AnchorProjector | null = null
 
export function getAnchorProjector() {
 
  if (!singleton) singleton = new AnchorProjector()
 
  return singleton
 
}
 
Rule:
 
No recipe scene should render until required projected anchors are available.
 

**\==================================================**
 

**PHASE 2 — SCENE ORCHESTRATION**
 

6.  ADD A REAL SceneRecipe TYPE
     

Create src/stage/scene/SceneRecipe.ts
 
export type MapFocus = 'world' | 'kenya' | 'corridor' | 'mombasa' | 'nairobi'
 
export type LensType = 'shipping' | 'freight' | 'medicine' | 'month'
 
export type Perspective = 'amara' | 'joseph' | null
 
export type TimeSlice = 'day1' | 'day3' | 'week1' | 'month1'
 
export type ActorMode = 'none' | 'ships' | 'convoys' | 'medicine' | 'chamber'
 
export type EmitterMode = 'off' | 'steady' | 'bursts' | 'sparse'
 
export type ConstraintMode = 'none' | 'lane' | 'corridor' | 'pulse' | 'chamber'
 

export interface SceneRecipe {
 
  id: string
 
  phase: 'globe' | 'landed'
 
  mapFocus: MapFocus
 
  lens: LensType
 
  perspective: Perspective
 
  time: TimeSlice
 
  narrativeBeatId: string
 
  visibleLayers: string\[\]
 
  actorMode: ActorMode
 
  emitterMode: EmitterMode
 
  constraintMode: ConstraintMode
 
  shelfLevel?: number
 
  chamberPressure?: number
 
  pressure: number
 
}
 

export const RECIPES: Record<string, SceneRecipe> = {
 
  globe\_context: {
 
    id: 'globe\_context',
 
    phase: 'globe',
 
    mapFocus: 'world',
 
    lens: 'shipping',
 
    perspective: null,
 
    time: 'day1',
 
    narrativeBeatId: '',
 
    visibleLayers: \['earth', 'routes', 'chokepoints', 'countryMarkers'\],
 
    actorMode: 'none',
 
    emitterMode: 'off',
 
    constraintMode: 'none',
 
    pressure: 0
 
  },
 

  kenya\_focus: {
 
    id: 'kenya\_focus',
 
    phase: 'globe',
 
    mapFocus: 'kenya',
 
    lens: 'shipping',
 
    perspective: null,
 
    time: 'day1',
 
    narrativeBeatId: '',
 
    visibleLayers: \['earth', 'routes', 'chokepoints', 'countryMarkers', 'kenyaBorder'\],
 
    actorMode: 'none',
 
    emitterMode: 'off',
 
    constraintMode: 'none',
 
    pressure: 0.1
 
  },
 

  amara\_medicine\_day1: {
 
    id: 'amara\_medicine\_day1',
 
    phase: 'landed',
 
    mapFocus: 'nairobi',
 
    lens: 'medicine',
 
    perspective: 'amara',
 
    time: 'day1',
 
    narrativeBeatId: 'nurse\_intro',
 
    visibleLayers: \['basemap', 'corridorGhost', 'medicineLine', 'shelf'\],
 
    actorMode: 'medicine',
 
    emitterMode: 'steady',
 
    constraintMode: 'pulse',
 
    shelfLevel: 1,
 
    pressure: 0.12
 
  },
 

  joseph\_freight\_week1: {
 
    id: 'joseph\_freight\_week1',
 
    phase: 'landed',
 
    mapFocus: 'corridor',
 
    lens: 'freight',
 
    perspective: 'joseph',
 
    time: 'week1',
 
    narrativeBeatId: 'detour',
 
    visibleLayers: \['basemap', 'corridor', 'depot', 'convoys'\],
 
    actorMode: 'convoys',
 
    emitterMode: 'bursts',
 
    constraintMode: 'corridor',
 
    pressure: 0.68
 
  },
 

  month\_squeeze\_month1: {
 
    id: 'month\_squeeze\_month1',
 
    phase: 'landed',
 
    mapFocus: 'nairobi',
 
    lens: 'month',
 
    perspective: null,
 
    time: 'month1',
 
    narrativeBeatId: 'your\_month',
 
    visibleLayers: \['basemap', 'chamber'\],
 
    actorMode: 'chamber',
 
    emitterMode: 'off',
 
    constraintMode: 'chamber',
 
    chamberPressure: 1,
 
    pressure: 1
 
  }
 
}
 

7.  ADD AN EXPLICIT SceneRecipeController
     

Create src/stage/scene/SceneRecipeController.ts
 

This is the missing contract.
 
import \* as PIXI from 'pixi.js'
 
import Matter from 'matter-js'
 
import type { SceneRecipe } from './SceneRecipe'
 
import { FreightScene } from './recipes/FreightScene'
 
import { MedicineScene } from './recipes/MedicineScene'
 
import { MonthScene } from './recipes/MonthScene'
 

type ActiveScene = {
 
  id: string
 
  update(dt: number): void
 
  resize(): void
 
  dispose(): void
 
}
 

type Ctx = {
 
  app: PIXI.Application
 
  matterEngine: Matter.Engine
 
  anchors: Record<string, {x: number; y: number}>
 
}
 

export class SceneRecipeController {
 
  private active: ActiveScene | null = null
 

  apply(recipe: SceneRecipe, ctx: Ctx) {
 
    if (this.active?.id === [recipe.id](http://recipe.id) ) return
 
    this.reset()
 

    switch ([recipe.id](http://recipe.id) ) {
 
      case 'amara\_medicine\_day1':
 
        this.active = new MedicineScene(recipe, ctx)
 
        break
 
      case 'joseph\_freight\_week1':
 
        this.active = new FreightScene(recipe, ctx)
 
        break
 
      case 'month\_squeeze\_month1':
 
        this.active = new MonthScene(recipe, ctx)
 
        break
 
      default:
 
        this.active = null
 
    }
 
  }
 

  update(dt: number) {
 
    this.active?.update(dt)
 
  }
 

  resize() {
 
    this.active?.resize()
 
  }
 

  reset() {
 
    this.active?.dispose()
 
    this.active = null
 
  }
 

  dispose() {
 
    this.reset()
 
  }
 
}
 
Rule:
 
Only one recipe scene is alive at a time.
 

8.  INK BEAT -> RECIPE MAPPING
     

Patch InkEngine usage in Shell.tsx.
 

Do not let text and scene drift apart.
 

Add recipe tags in Ink, for example:
 

*   RECIPE: amara\_medicine\_day1
     
*   \`RECIPE
     

Continuing from the cutoff:
 

This is the most reliable next-step brief because it fixes the foundation before the visuals.
 

Two additional pieces Claude should not miss:
 

**14\. Remove the old path completely**
 

Claude should explicitly delete or bypass these patterns, not leave them half-alive:
 

*   old createGlobeScene() / Three globe mount path
     
*   any computePositions(w, h) geography fallback in landed recipes
     
*   any always-on renderer loop that updates all lenses together
     
*   any hidden projection switch buried inside MapRoot
     
*   any deck overlay with its own independent static viewState
     

A good explicit cleanup checklist for Claude:
 
REMOVE / BYPASS CHECKLIST
 
\- old custom Three globe is no longer mounted in the main user path
 
\- PixiStage no longer uses computePositions for geography
 
\- MorphController no longer acts as a visibility switchboard for always-live renderers
 
\- deck overlay no longer uses a detached fixed camera assumption
 
\- no hidden mercator switch unless explicitly justified in architecture
 

**15\. State transition contract**
 

Claude should wire the major transitions in one place, not scatter them.
 

A clean runtime contract should look like this:
 
type AppSpatialState =
 
  | 'globe\_context'
 
  | 'country\_focus'
 
  | 'transition\_to\_kenya'
 
  | 'landed\_recipe'
 
And transitions should be:
 
function onAppStart() {
 
  send({ type: 'SET\_MAP\_PHASE', phase: 'globe' })
 
  send({ type: 'SET\_RECIPE', recipeId: 'globe\_context' })
 
}
 

function onKenyaSelected() {
 
  send({ type: 'SET\_RECIPE', recipeId: 'kenya\_focus' })
 
}
 

function onKenyaFlyComplete(roleId: string) {
 
  send({ type: 'SET\_MAP\_PHASE', phase: 'landed' })
 
  send({
 
    type: 'SET\_RECIPE',
 
    recipeId: roleId === 'nurse'
 
      ? 'amara\_medicine\_day1'
 
      : 'joseph\_freight\_week1'
 
  })
 
}
 
That way the app always knows:
 

*   what spatial phase it is in
     
*   what scene recipe is active
     
*   what the map should focus on
     
*   what Pixi/Matter should render
     

**16\. What success should look like right away**
 

For the next build, the minimum bar is not “prettier.”
 

The minimum bar is:
 

**Globe phase**
 

*   Earth clearly visible
     
*   routes/chokepoints clearly aligned to the globe
     
*   Kenya selection feels spatially real
     

**Landed phase**
 

*   Nairobi/Mombasa/corridor clearly anchored
     
*   one calm scene for Amara / Medicine / Day 1
     
*   no ghost motion
     
*   no unrelated active layers
     
*   text and world say the same thing
     

**17\. What to judge before any more art iteration**
 

Do not judge the next build on:
 

*   ship beauty
     
*   trail beauty
     
*   food style
     
*   fancy glows
     

Judge it on only these four questions:
 

1.  Does the Earth feel like Earth again?
     
2.  Does the map backbone feel spatially coherent?
     
3.  Does only one scene exist at a time?
     
4.  Does Amara / Medicine / Day 1 visually match the text?
     

If the answer to any of those is no, Claude should not move on to beautification.
 

**18\. Final short instruction to append**
 

Send this after the big brief:
 
The next build is successful only if the app stops feeling like overlapping systems and starts feeling like one coherent staged world.
 

Do not optimize for prettier effects yet.
 
Optimize for:
 
\- one spatial backbone
 
\- one active scene recipe
 
\- one projected coordinate system
 
\- one text/world truth at a time
 

**19\. My blunt recommendation**
 

treat the next task as a migration and orchestration task, not a design task.
 

Because right now the app is failing more from:
 

*   architectural overlap
     
*   state leakage
     
*   fake coordinates
     
*   weak phase separation
     

than from pure visual style.
 

And that is why every art patch keeps underperforming.
 

Once you have done that foundation pass, the next review should be against exactly:
 

*   one globe screenshot
     
*   one landed calm Amara scene screenshot
     
*   one list of removed old-path systems
     
*   one list of files changed
     

That is the cleanest way forward.