import React, { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Deck } from '@deck.gl/core'
import { PathLayer, ScatterplotLayer } from '@deck.gl/layers'
import type { BootstrapResponse } from '../../atlas/types'
import type { LensId } from '../../state/machine/worldContext'

/**
 * MapRoot — geographic truth beneath the world stage.
 *
 * Minimal, dark, restrained. The user must know where they are:
 * Kenya, Mombasa port, Nairobi inland, corridor between them,
 * Indian Ocean to the east.
 */

interface MapRootProps {
  visible: boolean
  bootstrap: BootstrapResponse | null
  countryId: string | null
  ruptured: boolean
  lens: LensId
}

// ── GeoJSON: Simplified Kenya outline ──
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

// ── GeoJSON: East African landmass context ──
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

// ── GeoJSON: Kenya coastline ──
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

// ── GeoJSON: Mombasa–Nairobi corridor ──
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

// ── Map style: dark, legible, restrained ──
const DARK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  name: 'twenty-one-miles',
  sources: {
    'land': { type: 'geojson', data: LAND_GEOJSON as any },
    'kenya': { type: 'geojson', data: KENYA_GEOJSON as any },
    'coastline': { type: 'geojson', data: COASTLINE_GEOJSON as any },
    'corridor': { type: 'geojson', data: CORRIDOR_GEOJSON as any },
  },
  layers: [
    // Deep ocean background
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#070710' },
    },
    // East Africa landmass — slightly more visible for context
    {
      id: 'land-fill',
      type: 'fill',
      source: 'land',
      paint: { 'fill-color': '#0e0e18' },
    },
    // Kenya — raised fill, clearly distinguishable
    {
      id: 'kenya-fill',
      type: 'fill',
      source: 'kenya',
      paint: { 'fill-color': '#161624' },
    },
    // Kenya border — more visible
    {
      id: 'kenya-border',
      type: 'line',
      source: 'kenya',
      paint: {
        'line-color': '#2a2a42',
        'line-width': 1.8,
      },
    },
    // Coastline — more readable
    {
      id: 'coastline',
      type: 'line',
      source: 'coastline',
      paint: {
        'line-color': '#1e2850',
        'line-width': 1.5,
      },
    },
    // Mombasa–Nairobi corridor — gold, dashed, cleaner
    {
      id: 'corridor',
      type: 'line',
      source: 'corridor',
      paint: {
        'line-color': '#C8A96E',
        'line-width': 2.5,
        'line-opacity': 0.3,
        'line-dasharray': [5, 3],
      },
    },
  ],
}

// Route data for deck.gl overlays
const ROUTE_PATHS = [
  {
    id: 'hormuz_africa',
    coordinates: [[56.3, 26.5], [54.0, 24.0], [48.0, 20.0], [44.0, 15.0], [43.3, 12.6], [44.0, 8.0], [44.0, 2.0], [39.7, -4.0]],
    blocked: true,
    layer: 'shipping' as LensId,
  },
  {
    id: 'red_sea_suez',
    coordinates: [[43.3, 12.6], [42.0, 15.0], [38.0, 20.0], [35.0, 25.0], [33.5, 28.0], [32.3, 30.0]],
    blocked: false,
    layer: 'shipping' as LensId,
  },
  {
    id: 'cape_route',
    coordinates: [[39.7, -4.0], [40.0, -10.0], [37.0, -20.0], [32.0, -30.0], [18.5, -34.4], [5.0, -30.0], [-5.0, -20.0]],
    blocked: false,
    stressed: true,
    layer: 'shipping' as LensId,
  },
  {
    id: 'mombasa_nairobi',
    coordinates: [[39.67, -4.05], [38.5, -3.0], [37.5, -2.0], [36.82, -1.29]],
    blocked: false,
    layer: 'freight' as LensId,
  },
  {
    id: 'indian_ocean',
    coordinates: [[56.3, 26.5], [60.0, 20.0], [65.0, 15.0], [72.0, 5.0], [80.0, -2.0], [95.0, 0.0], [103.8, 1.4]],
    blocked: true,
    layer: 'shipping' as LensId,
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

export default function MapRoot({ visible, bootstrap, countryId, ruptured, lens }: MapRootProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const deckRef = useRef<Deck | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])
  const [mapReady, setMapReady] = useState(false)

  // Initialize MapLibre
  useEffect(() => {
    if (!visible || !mapContainerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: DARK_STYLE,
      center: [36.82, -1.29],
      zoom: 3,
      attributionControl: false,
      interactive: false,
    })

    map.on('load', () => {
      setMapReady(true)

      // Add city markers — stronger labels
      const cities = [
        { name: 'Mombasa', coords: [39.67, -4.05] as [number, number], sub: 'port' },
        { name: 'Nairobi', coords: [36.82, -1.29] as [number, number], sub: 'capital' },
      ]

      for (const city of cities) {
        const el = document.createElement('div')
        el.style.cssText = `
          display: flex; flex-direction: column; align-items: center;
          pointer-events: none;
        `
        // Dot — brighter, with stronger glow
        const dot = document.createElement('div')
        dot.style.cssText = `
          width: 7px; height: 7px; border-radius: 50%;
          background: #C8A96E; box-shadow: 0 0 10px rgba(200,169,110,0.5), 0 0 20px rgba(200,169,110,0.2);
        `
        el.appendChild(dot)
        // Label — larger, more visible
        const label = document.createElement('div')
        label.textContent = city.name
        label.style.cssText = `
          color: rgba(200,169,110,0.85); font-size: 11px; margin-top: 4px;
          font-family: 'Instrument Sans', system-ui, sans-serif;
          letter-spacing: 0.6px; white-space: nowrap; font-weight: 500;
          text-shadow: 0 1px 6px rgba(0,0,0,0.9), 0 0 12px rgba(0,0,0,0.5);
        `
        el.appendChild(label)
        // Sub label — slightly more visible
        if (city.sub) {
          const sub = document.createElement('div')
          sub.textContent = city.sub
          sub.style.cssText = `
            color: rgba(138,134,128,0.6); font-size: 9px;
            font-family: 'Instrument Sans', system-ui, sans-serif;
            letter-spacing: 0.3px;
          `
          el.appendChild(sub)
        }

        const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat(city.coords)
          .addTo(map)

        markersRef.current.push(marker)
      }
    })

    mapRef.current = map

    return () => {
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []
      map.remove()
      mapRef.current = null
      setMapReady(false)
    }
  }, [visible])

  // Initialize deck.gl overlay
  useEffect(() => {
    if (!visible || !mapReady || !mapContainerRef.current) return
    if (deckRef.current) return

    const deck = new Deck({
      parent: mapContainerRef.current,
      viewState: {
        longitude: 36.82,
        latitude: -1.29,
        zoom: 3,
        pitch: 0,
        bearing: 0,
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
  }, [visible, mapReady])

  // Update deck layers when rupture state or lens changes
  useEffect(() => {
    if (deckRef.current) {
      deckRef.current.setProps({ layers: createDeckLayers(ruptured, lens) })
    }
  }, [ruptured, lens])

  // Update corridor brightness based on lens
  useEffect(() => {
    if (!mapRef.current || !mapReady) return
    const map = mapRef.current

    const corridorOpacity =
      lens === 'freight' ? 0.6 :
      lens === 'medicine' ? 0.4 :
      lens === 'household' ? 0.35 :
      0.3

    const corridorWidth =
      lens === 'freight' ? 3.5 :
      lens === 'medicine' ? 2.5 :
      2.5

    try {
      map.setPaintProperty('corridor', 'line-opacity', corridorOpacity)
      map.setPaintProperty('corridor', 'line-width', corridorWidth)
    } catch (_) { /* layer may not exist yet */ }
  }, [lens, mapReady])

  if (!visible) return null

  return (
    <div
      ref={mapContainerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 2,
        opacity: visible ? 1 : 0,
        transition: 'opacity 1s ease',
        pointerEvents: 'none',
      }}
    />
  )
}

function createDeckLayers(ruptured: boolean, lens: LensId) {
  // Lens-aware opacity: routes dim when not relevant, bright when active
  const shippingAlpha = lens === 'shipping' ? 1.0 : 0.25
  const freightAlpha = lens === 'freight' ? 1.0 : 0.2

  return [
    new PathLayer({
      id: 'shipping-routes',
      data: ROUTE_PATHS,
      getPath: (d: any) => d.coordinates,
      getColor: (d: any) => {
        const lensA = d.layer === 'freight' ? freightAlpha : shippingAlpha
        if (d.blocked) {
          return [170, 90, 90, Math.round((ruptured ? 80 : 200) * lensA)]
        }
        if (d.stressed) {
          return [212, 118, 60, Math.round(200 * lensA)]
        }
        if (d.layer === 'freight') {
          return [200, 169, 110, Math.round(200 * freightAlpha)]
        }
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
      updateTriggers: {
        getColor: [ruptured, lens],
        getWidth: [ruptured, lens],
      },
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
