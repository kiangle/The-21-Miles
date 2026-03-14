/**
 * AnchorProjector — the ONLY source of screen coordinates for Pixi.
 *
 * Projects geographic lng/lat to screen x/y using the live MapLibre camera.
 * No fallback to fake screen percentages. If anchors aren't ready,
 * the recipe scene must wait.
 */

import type { Map as MapLibreMap, LngLatLike } from 'maplibre-gl'

export interface ProjectedAnchor {
  id: string
  lngLat: [number, number]
  x: number
  y: number
}

const DEFAULT_ANCHORS: Array<{ id: string; lngLat: [number, number] }> = [
  // Chokepoints
  { id: 'hormuz',         lngLat: [56.3, 26.5] },
  { id: 'babElMandeb',    lngLat: [43.3, 12.6] },
  // Shipping route waypoints (Hormuz → Mombasa)
  { id: 'route_gulf',     lngLat: [54, 24] },
  { id: 'route_arabian',  lngLat: [51, 18] },
  { id: 'route_socotra',  lngLat: [48, 12] },
  { id: 'route_indian1',  lngLat: [45, 5] },
  { id: 'route_indian2',  lngLat: [43, 0] },
  { id: 'route_approach', lngLat: [41, -2] },
  // Cape reroute waypoints
  { id: 'cape_aden',      lngLat: [48, 10] },
  { id: 'cape_somali',    lngLat: [50, 2] },
  { id: 'cape_equator',   lngLat: [48, -5] },
  { id: 'cape_mozambique', lngLat: [42, -15] },
  { id: 'cape_south',     lngLat: [30, -34] },
  { id: 'cape_west',      lngLat: [18, -35] },
  // Kenya
  { id: 'mombasa',        lngLat: [39.67, -4.05] },
  { id: 'nairobi',        lngLat: [36.82, -1.29] },
  { id: 'hospital',       lngLat: [36.78, -1.30] },
  { id: 'corridorQ1',     lngLat: [39.0, -3.3] },
  { id: 'corridorMid',    lngLat: [38.2, -2.5] },
  { id: 'corridorQ3',     lngLat: [37.5, -1.8] },
]

export class AnchorProjector {
  private map: MapLibreMap | null = null
  private anchors = new Map<string, ProjectedAnchor>()
  private subs = new Set<() => void>()
  private _ready = false

  constructor() {
    for (const a of DEFAULT_ANCHORS) {
      this.anchors.set(a.id, { ...a, x: 0, y: 0 })
    }
  }

  /** Whether the projector has been attached and has valid positions. */
  get ready(): boolean { return this._ready }

  attach(map: MapLibreMap) {
    this.detach()
    this.map = map
    this.reprojectAll()
    map.on('move', this.reprojectAll)
    map.on('resize', this.reprojectAll)
    map.on('zoom', this.reprojectAll)
    map.on('rotate', this.reprojectAll)
    map.on('pitch', this.reprojectAll)
  }

  detach = () => {
    if (!this.map) return
    this.map.off('move', this.reprojectAll)
    this.map.off('resize', this.reprojectAll)
    this.map.off('zoom', this.reprojectAll)
    this.map.off('rotate', this.reprojectAll)
    this.map.off('pitch', this.reprojectAll)
    this.map = null
    this._ready = false
  }

  reprojectAll = () => {
    if (!this.map) return
    for (const anchor of this.anchors.values()) {
      const p = this.map.project(anchor.lngLat as LngLatLike)
      anchor.x = p.x
      anchor.y = p.y
    }
    this._ready = true
    this.subs.forEach(fn => fn())
  }

  get(id: string) {
    return this.anchors.get(id)
  }

  getAll() {
    const out: Record<string, { x: number; y: number }> = {}
    for (const [id, a] of this.anchors) out[id] = { x: a.x, y: a.y }
    return out
  }

  onUpdate(fn: () => void) {
    this.subs.add(fn)
    return () => { this.subs.delete(fn) }
  }

  dispose() {
    this.detach()
    this.subs.clear()
    this.anchors.clear()
  }
}

let singleton: AnchorProjector | null = null
export function getAnchorProjector() {
  if (!singleton) singleton = new AnchorProjector()
  return singleton
}
