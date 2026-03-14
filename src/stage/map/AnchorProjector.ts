/**
 * AnchorProjector — projects geographic coordinates to screen coordinates
 * using the live MapLibre camera/projection.
 *
 * Pixi renderers read these projected anchors instead of using
 * screen-percentage positions. When the map camera moves,
 * the anchors update automatically.
 */

import type { Map as MaplibreMap } from 'maplibre-gl'

export interface ProjectedAnchor {
  id: string
  lngLat: [number, number]
  x: number
  y: number
}

/** Geographic anchor definitions for the Kenya corridor story. */
const ANCHOR_DEFS: { id: string; lngLat: [number, number] }[] = [
  { id: 'hormuz',       lngLat: [56.3, 26.5] },
  { id: 'babElMandeb',  lngLat: [43.3, 12.6] },
  { id: 'suez',         lngLat: [32.3, 30.0] },
  { id: 'capeTown',     lngLat: [18.5, -34.4] },
  { id: 'mombasa',      lngLat: [39.67, -4.05] },
  { id: 'nairobi',      lngLat: [36.82, -1.29] },
  { id: 'hospital',     lngLat: [36.78, -1.30] },  // Kenyatta National Hospital area
  { id: 'market',       lngLat: [36.83, -1.28] },  // Wakulima Market area
  { id: 'household1',   lngLat: [36.88, -1.26] },  // Eastlands
  { id: 'household2',   lngLat: [36.90, -1.31] },  // Embakasi
  { id: 'household3',   lngLat: [36.75, -1.32] },  // Kibera
  // Corridor midpoints
  { id: 'corridorMid',  lngLat: [38.2, -2.5] },
  { id: 'corridorQ1',   lngLat: [39.0, -3.3] },    // Quarter from Mombasa
  { id: 'corridorQ3',   lngLat: [37.5, -1.8] },    // Quarter from Nairobi
]

export class AnchorProjector {
  private map: MaplibreMap | null = null
  private anchors: Map<string, ProjectedAnchor> = new Map()
  private listeners: Array<() => void> = []

  constructor() {
    // Initialize anchors with zero positions
    for (const def of ANCHOR_DEFS) {
      this.anchors.set(def.id, { id: def.id, lngLat: def.lngLat, x: 0, y: 0 })
    }
  }

  /** Attach to a MapLibre map instance. Starts listening for camera changes. */
  attach(map: MaplibreMap) {
    this.map = map
    this.updateAll()
    map.on('move', this.handleMove)
    map.on('resize', this.handleMove)
  }

  /** Detach from the map. */
  detach() {
    if (this.map) {
      this.map.off('move', this.handleMove)
      this.map.off('resize', this.handleMove)
      this.map = null
    }
  }

  private handleMove = () => {
    this.updateAll()
    for (const fn of this.listeners) fn()
  }

  /** Re-project all anchors from the current map state. */
  updateAll() {
    if (!this.map) return
    for (const [id, anchor] of this.anchors) {
      const point = this.map.project(anchor.lngLat as [number, number])
      anchor.x = point.x
      anchor.y = point.y
    }
  }

  /** Get a projected anchor by id. */
  get(id: string): ProjectedAnchor | undefined {
    return this.anchors.get(id)
  }

  /** Get all projected anchors as a plain object (for Pixi renderer consumption). */
  getAll(): Record<string, { x: number; y: number }> {
    const result: Record<string, { x: number; y: number }> = {}
    for (const [id, anchor] of this.anchors) {
      result[id] = { x: anchor.x, y: anchor.y }
    }
    return result
  }

  /** Subscribe to projection updates (e.g., for Pixi to re-anchor). */
  onUpdate(fn: () => void) {
    this.listeners.push(fn)
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn)
    }
  }

  /** Add a custom anchor at runtime. */
  addAnchor(id: string, lngLat: [number, number]) {
    const anchor: ProjectedAnchor = { id, lngLat, x: 0, y: 0 }
    if (this.map) {
      const point = this.map.project(lngLat)
      anchor.x = point.x
      anchor.y = point.y
    }
    this.anchors.set(id, anchor)
  }

  dispose() {
    this.detach()
    this.listeners = []
    this.anchors.clear()
  }
}

/** Singleton instance shared across components. */
let instance: AnchorProjector | null = null

export function getAnchorProjector(): AnchorProjector {
  if (!instance) {
    instance = new AnchorProjector()
  }
  return instance
}
