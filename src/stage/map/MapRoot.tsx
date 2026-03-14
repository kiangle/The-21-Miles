import React, { useEffect, useRef, useState, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Deck } from '@deck.gl/core'
import { PathLayer, ScatterplotLayer } from '@deck.gl/layers'
import { getAnchorProjector } from './AnchorProjector'
import type { BootstrapResponse } from '../../atlas/types'
import type { LensId } from '../../state/machine/worldContext'
import type { MapFocus } from '../scene/SceneRecipe'
import { MAP_FOCUS_PRESETS } from '../scene/SceneRecipe'

/**
 * MapRoot — the single spatial backbone.
 *
 * Globe projection for world context.
 * Flat/mercator for landed Kenya.
 * Camera transitions between focus presets.
 * Exposes map instance for AnchorProjector.
 */

interface MapRootProps {
  visible: boolean
  bootstrap: BootstrapResponse | null
  countryId: string | null
  ruptured: boolean
  lens: LensId
  /** Current map focus — drives camera position */
  mapFocus: MapFocus
  /** Whether globe mode is active (interactive rotation) */
  globePhase: boolean
  /** Callback when user clicks Kenya in globe mode */
  onSelectKenya?: () => void
  /** Callback when map is ready */
  onMapReady?: (map: maplibregl.Map) => void
  /** Callback when fly-to camera transition completes */
  onFlyToComplete?: () => void
}

// ── GeoJSON data (unchanged) ──
const KENYA_GEOJSON: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [34.0, -1.05], [33.9, 0.1], [34.5, 1.0], [34.8, 1.7],
        [34.4, 3.1], [35.9, 4.6], [36.5, 5.0], [38.0, 4.0],
        [40.0, 4.0], [41.9, 3.9], [41.5, 2.0], [41.0, 0.0],
        [40.1, -1.7], [40.0, -2.5], [39.67, -4.05], [39.2, -4.7],
        [37.8, -4.7], [34.0, -1.05],
      ]],
    },
  }],
}

const LAND_GEOJSON: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [28.0, 12.0], [33.0, 12.0], [36.0, 12.0], [42.0, 12.0],
        [43.0, 11.5], [46.0, 11.5], [51.5, 11.0], [51.0, 5.0],
        [47.0, 1.5], [44.0, -1.0], [41.5, 2.0], [41.0, 0.0],
        [40.1, -1.7], [40.0, -2.5], [39.67, -4.05], [39.2, -4.7],
        [40.5, -10.5], [39.3, -11.2], [35.0, -11.7],
        [30.5, -11.5], [28.0, -8.0], [28.0, -4.0], [28.0, 0.0],
        [28.0, 12.0],
      ]],
    },
  }],
}

const COASTLINE_GEOJSON: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: [
        [41.5, 2.0], [41.0, 0.0], [40.5, -0.8], [40.1, -1.7],
        [40.0, -2.5], [39.8, -3.2], [39.67, -4.05], [39.2, -4.7],
      ],
    },
  }],
}

const CORRIDOR_GEOJSON: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: [
        [39.67, -4.05], [38.8, -3.2], [37.8, -2.3],
        [37.1, -1.8], [36.82, -1.29],
      ],
    },
  }],
}

// ── Map style ──
const DARK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  name: 'twenty-one-miles',
  // Globe projection for the entry phase
  projection: { type: 'globe' },
  sky: {
    'sky-color': '#0A0A12',
    'horizon-color': '#0d1220',
    'fog-color': '#070b18',
    'sky-horizon-blend': 0.5,
    'horizon-fog-blend': 0.8,
    'fog-ground-blend': 1.0,
  },
  sources: {
    'land': { type: 'geojson', data: LAND_GEOJSON as any },
    'kenya': { type: 'geojson', data: KENYA_GEOJSON as any },
    'coastline': { type: 'geojson', data: COASTLINE_GEOJSON as any },
    'corridor': { type: 'geojson', data: CORRIDOR_GEOJSON as any },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#070b18' } },
    { id: 'land-fill', type: 'fill', source: 'land', paint: { 'fill-color': '#0d1220' } },
    { id: 'kenya-fill', type: 'fill', source: 'kenya', paint: { 'fill-color': '#151d30' } },
    { id: 'kenya-border', type: 'line', source: 'kenya', paint: { 'line-color': '#2e3a58', 'line-width': 2.2 } },
    { id: 'coastline', type: 'line', source: 'coastline', paint: { 'line-color': '#2a3860', 'line-width': 2.5 } },
    {
      id: 'corridor', type: 'line', source: 'corridor',
      paint: { 'line-color': '#c89850', 'line-width': 3.5, 'line-opacity': 0.45, 'line-dasharray': [6, 3] },
    },
  ],
}

// ── Route + chokepoint data for deck.gl ──
const ROUTE_PATHS = [
  {
    id: 'hormuz_africa',
    coordinates: [[56.3, 26.5], [54.0, 24.0], [48.0, 20.0], [44.0, 15.0], [43.3, 12.6], [44.0, 8.0], [44.0, 2.0], [39.7, -4.0]],
    blocked: true, layer: 'shipping' as LensId,
  },
  {
    id: 'red_sea_suez',
    coordinates: [[43.3, 12.6], [42.0, 15.0], [38.0, 20.0], [35.0, 25.0], [33.5, 28.0], [32.3, 30.0]],
    blocked: false, layer: 'shipping' as LensId,
  },
  {
    id: 'cape_route',
    coordinates: [[39.7, -4.0], [40.0, -10.0], [37.0, -20.0], [32.0, -30.0], [18.5, -34.4], [5.0, -30.0], [-5.0, -20.0]],
    blocked: false, stressed: true, layer: 'shipping' as LensId,
  },
  {
    id: 'mombasa_nairobi',
    coordinates: [[39.67, -4.05], [38.5, -3.0], [37.5, -2.0], [36.82, -1.29]],
    blocked: false, layer: 'freight' as LensId,
  },
  {
    id: 'indian_ocean',
    coordinates: [[56.3, 26.5], [60.0, 20.0], [65.0, 15.0], [72.0, 5.0], [80.0, -2.0], [95.0, 0.0], [103.8, 1.4]],
    blocked: true, layer: 'shipping' as LensId,
  },
]

const CHOKEPOINT_DATA = [
  { id: 'hormuz', coordinates: [56.3, 26.5], status: 'closed' },
  { id: 'bab_mandeb', coordinates: [43.3, 12.6], status: 'open' },
  { id: 'suez', coordinates: [32.3, 30.0], status: 'open' },
  { id: 'cape', coordinates: [18.5, -34.4], status: 'congested' },
]

const PORT_DATA = [
  { id: 'mombasa', coordinates: [39.67, -4.05], label: 'Mombasa' },
  { id: 'jebel_ali', coordinates: [55.06, 25.01], label: 'Jebel Ali' },
  { id: 'singapore', coordinates: [103.84, 1.26], label: 'Singapore' },
]

export default function MapRoot({
  visible, bootstrap, countryId, ruptured, lens,
  mapFocus, globePhase, onSelectKenya, onMapReady, onFlyToComplete,
}: MapRootProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const deckRef = useRef<Deck | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])
  const [mapReady, setMapReady] = useState(false)
  const prevFocusRef = useRef<MapFocus>('world')

  // ── Initialize MapLibre with globe projection ──
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: DARK_STYLE,
      center: MAP_FOCUS_PRESETS.world.center,
      zoom: MAP_FOCUS_PRESETS.world.zoom,
      attributionControl: false,
      interactive: true,
      dragRotate: true,
      scrollZoom: false,
      touchZoomRotate: false,
      doubleClickZoom: false,
      keyboard: false,
    })

    map.on('load', () => {
      setMapReady(true)

      // Attach AnchorProjector
      const projector = getAnchorProjector()
      projector.attach(map)

      // City markers
      const cities = [
        { name: 'Mombasa', coords: [39.67, -4.05] as [number, number], sub: 'port' },
        { name: 'Nairobi', coords: [36.82, -1.29] as [number, number], sub: 'capital' },
      ]

      for (const city of cities) {
        const el = document.createElement('div')
        el.style.cssText = 'display:flex;flex-direction:column;align-items:center;pointer-events:none;'
        const dot = document.createElement('div')
        dot.style.cssText = 'width:10px;height:10px;border-radius:999px;background:#dcc89e;box-shadow:0 0 12px rgba(220,200,158,0.5),0 0 28px rgba(220,200,158,0.2);'
        el.appendChild(dot)
        const label = document.createElement('div')
        label.textContent = city.name
        label.style.cssText = "color:#d4b87d;font-size:13px;margin-top:6px;font-family:'Instrument Sans',system-ui,sans-serif;letter-spacing:0.04em;white-space:nowrap;font-weight:600;text-shadow:0 1px 8px rgba(0,0,0,0.95),0 0 18px rgba(0,0,0,0.7);"
        el.appendChild(label)
        if (city.sub) {
          const sub = document.createElement('div')
          sub.textContent = city.sub
          sub.style.cssText = "color:rgba(212,184,125,0.5);font-size:10px;font-family:'Instrument Sans',system-ui,sans-serif;letter-spacing:0.4px;margin-top:2px;"
          el.appendChild(sub)
        }
        const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat(city.coords)
          .addTo(map)
        markersRef.current.push(marker)
      }

      onMapReady?.(map)
    })

    mapRef.current = map

    return () => {
      getAnchorProjector().detach()
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []
      map.remove()
      mapRef.current = null
      setMapReady(false)
    }
  }, [onMapReady])

  // ── Kenya click handler for globe phase ──
  useEffect(() => {
    if (!mapRef.current || !mapReady || !globePhase) return
    const map = mapRef.current

    const handleClick = (e: maplibregl.MapMouseEvent) => {
      // Check if click is on Kenya polygon
      const features = map.queryRenderedFeatures(e.point, { layers: ['kenya-fill'] })
      if (features.length > 0) {
        onSelectKenya?.()
      }
    }

    // Hover cursor on Kenya
    const handleMouseMove = (e: maplibregl.MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ['kenya-fill'] })
      map.getCanvas().style.cursor = features.length > 0 ? 'pointer' : ''
    }

    map.on('click', handleClick)
    map.on('mousemove', handleMouseMove)
    return () => {
      map.off('click', handleClick)
      map.off('mousemove', handleMouseMove)
      map.getCanvas().style.cursor = ''
    }
  }, [mapReady, globePhase, onSelectKenya])

  // ── Camera focus transitions ──
  useEffect(() => {
    if (!mapRef.current || !mapReady) return
    if (mapFocus === prevFocusRef.current) return
    prevFocusRef.current = mapFocus

    const map = mapRef.current
    const preset = MAP_FOCUS_PRESETS[mapFocus]

    // When transitioning from globe to landed, switch to mercator
    if (mapFocus !== 'world') {
      try {
        (map as any).setProjection?.({ type: 'mercator' })
      } catch (_) { /* projection API may differ */ }
    }

    map.flyTo({
      center: preset.center,
      zoom: preset.zoom,
      pitch: preset.pitch,
      bearing: preset.bearing,
      duration: mapFocus === 'world' ? 0 : 3000,
      essential: true,
    })

    // Listen for fly-to completion
    if (mapFocus !== 'world') {
      const onMoveEnd = () => {
        map.off('moveend', onMoveEnd)
        onFlyToComplete?.()
      }
      map.on('moveend', onMoveEnd)
    }
  }, [mapFocus, mapReady, onFlyToComplete])

  // ── Toggle interactivity based on phase ──
  useEffect(() => {
    if (!mapRef.current || !mapReady) return
    const map = mapRef.current

    if (globePhase) {
      map.dragRotate.enable()
      map.getCanvas().style.pointerEvents = 'auto'
    } else {
      map.dragRotate.disable()
      map.getCanvas().style.pointerEvents = 'none'
    }
  }, [globePhase, mapReady])

  // ── deck.gl overlay ──
  useEffect(() => {
    if (!mapReady || !mapContainerRef.current) return
    if (deckRef.current) return

    const deck = new Deck({
      parent: mapContainerRef.current,
      viewState: {
        longitude: MAP_FOCUS_PRESETS.world.center[0],
        latitude: MAP_FOCUS_PRESETS.world.center[1],
        zoom: MAP_FOCUS_PRESETS.world.zoom,
        pitch: 0, bearing: 0,
      },
      controller: false,
      style: { position: 'absolute' as const, top: '0', left: '0', zIndex: '2' },
      layers: createDeckLayers(ruptured, lens),
    })
    deckRef.current = deck

    return () => {
      deck.finalize()
      deckRef.current = null
    }
  }, [mapReady])

  // ── Update deck layers ──
  useEffect(() => {
    if (deckRef.current) {
      deckRef.current.setProps({ layers: createDeckLayers(ruptured, lens) })
    }
  }, [ruptured, lens])

  // ── Corridor lens adjustment ──
  useEffect(() => {
    if (!mapRef.current || !mapReady) return
    const map = mapRef.current
    const corridorOpacity = lens === 'freight' ? 0.6 : lens === 'medicine' ? 0.4 : lens === 'household' ? 0.35 : 0.3
    try {
      map.setPaintProperty('corridor', 'line-opacity', corridorOpacity)
      map.setPaintProperty('corridor', 'line-width', lens === 'freight' ? 3.5 : 2.5)
    } catch (_) { /* layer may not exist yet */ }
  }, [lens, mapReady])

  // ── Kenya highlight on hover in globe phase ──
  useEffect(() => {
    if (!mapRef.current || !mapReady) return
    const map = mapRef.current
    try {
      map.setPaintProperty('kenya-fill', 'fill-color', globePhase ? '#1a2540' : '#151d30')
    } catch (_) {}
  }, [globePhase, mapReady])

  return (
    <div
      ref={mapContainerRef}
      style={{
        position: 'absolute',
        top: 0, left: 0,
        width: '100%', height: '100%',
        zIndex: 2,
        opacity: visible ? 1 : 0,
        transition: 'opacity 1s ease',
        pointerEvents: globePhase ? 'auto' : 'none',
      }}
    />
  )
}

function createDeckLayers(ruptured: boolean, lens: LensId) {
  const shippingAlpha = lens === 'shipping' ? 1.0 : 0.25
  const freightAlpha = lens === 'freight' ? 1.0 : 0.2

  return [
    new PathLayer({
      id: 'shipping-routes',
      data: ROUTE_PATHS,
      getPath: (d: any) => d.coordinates,
      getColor: (d: any) => {
        const lensA = d.layer === 'freight' ? freightAlpha : shippingAlpha
        if (d.blocked) return [170, 90, 90, Math.round((ruptured ? 80 : 200) * lensA)]
        if (d.stressed) return [212, 118, 60, Math.round(200 * lensA)]
        if (d.layer === 'freight') return [200, 169, 110, Math.round(200 * freightAlpha)]
        return [140, 200, 255, Math.round(160 * shippingAlpha)]
      },
      getWidth: (d: any) => {
        const lensW = d.layer === lens ? 1.5 : 0.8
        if (d.blocked) return (ruptured ? 1 : 4) * lensW
        if (d.stressed) return 5 * lensW
        return 3 * lensW
      },
      widthUnits: 'pixels' as const,
      widthMinPixels: 1,
      rounded: true,
      updateTriggers: { getColor: [ruptured, lens], getWidth: [ruptured, lens] },
    }),
    new ScatterplotLayer({
      id: 'chokepoints',
      data: CHOKEPOINT_DATA,
      getPosition: (d: any) => d.coordinates,
      getRadius: (d: any) => d.status === 'closed' ? 40000 : 25000,
      radiusUnits: 'meters' as const,
      getFillColor: (d: any) => {
        const a = Math.round(lens === 'shipping' ? 200 : 60)
        return d.status === 'closed' ? [255, 50, 50, a]
          : d.status === 'congested' ? [230, 180, 60, Math.round(a * 0.8)]
            : [100, 200, 140, Math.round(a * 0.6)]
      },
      radiusMinPixels: 4,
      updateTriggers: { getFillColor: [lens] },
    }),
    new ScatterplotLayer({
      id: 'ports',
      data: PORT_DATA,
      getPosition: (d: any) => d.coordinates,
      getRadius: 18000,
      radiusUnits: 'meters' as const,
      getFillColor: [200, 169, 110, Math.round(lens === 'shipping' ? 160 : 60)],
      radiusMinPixels: 3,
      updateTriggers: { getFillColor: [lens] },
    }),
  ]
}
