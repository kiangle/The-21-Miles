import React, { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { MapboxOverlay } from '@deck.gl/mapbox'
import { PathLayer, ScatterplotLayer } from '@deck.gl/layers'
import { getAnchorProjector } from './AnchorProjector'
import type { MapFocus } from '../scene/SceneRecipe'
import { MAP_FOCUS_PRESETS } from '../scene/SceneRecipe'
import type { BootstrapResponse } from '../../atlas/types'
import type { LensId } from '../../state/machine/worldContext'

/**
 * MapRoot — the single spatial backbone.
 *
 * MapLibre owns the camera and projection (globe).
 * deck.gl follows the live camera automatically via MapboxOverlay.
 * No detached Deck instance. No hidden projection switching.
 * One projection backbone throughout.
 *
 * Layer scoping:
 * - globe phase: shipping routes, chokepoints, country markers. NO city markers.
 * - landed phase: corridor route, small restrained city dots. NO giant scatter circles.
 */

type Props = {
  bootstrap: BootstrapResponse | null
  lens: LensId
  mapFocus: MapFocus
  globePhase: boolean
  ruptured: boolean
  onSelectKenya?: () => void
  onMapReady?: (map: maplibregl.Map) => void
  onFlyToComplete?: () => void
}

// ── Map style: Carto Dark raster tiles + GeoJSON overlays ──
const STYLE: maplibregl.StyleSpecification = {
  version: 8,
  projection: { type: 'globe' },
  sources: {
    'carto-dark': {
      type: 'raster',
      tiles: ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'],
      tileSize: 256,
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    },
    'kenya': {
      type: 'geojson',
      data: '/geo/kenya.geojson',
    },
    'corridor': {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [
              [39.67, -4.05],
              [38.8, -3.2],
              [37.5, -2.0],
              [36.82, -1.29],
            ],
          },
        }],
      },
    },
  },
  layers: [
    {
      id: 'carto-dark-tiles',
      type: 'raster',
      source: 'carto-dark',
      paint: { 'raster-opacity': 0.7 },
    },
    {
      id: 'kenya-fill',
      type: 'fill',
      source: 'kenya',
      paint: { 'fill-color': '#1a2640', 'fill-opacity': 0.5 },
    },
    {
      id: 'kenya-border',
      type: 'line',
      source: 'kenya',
      paint: { 'line-color': '#3a5580', 'line-width': 2.0, 'line-opacity': 0.95 },
    },
    {
      id: 'corridor-line',
      type: 'line',
      source: 'corridor',
      paint: {
        'line-color': '#b88b4a',
        'line-width': 3.5,
        'line-opacity': 0.45,
        'line-dasharray': [6, 3],
      },
    },
  ],
  sky: {
    'sky-color': '#0a1628',
    'horizon-color': '#1a3458',
    'fog-color': '#060e1a',
    'sky-horizon-blend': 0.6,
  },
} as any

/**
 * Build deck.gl layers scoped by phase:
 * - globe: global shipping routes + chokepoint pips. NO local ports.
 * - landed: corridor route + restrained local dots. NO giant scatter circles.
 */
function buildDeckLayers(lens: LensId, ruptured: boolean, globePhase: boolean) {
  if (globePhase) {
    // Globe phase: global shipping routes + chokepoint pips only
    const routeColor: [number, number, number, number] = lens === 'shipping'
      ? [114, 183, 255, 210]
      : [80, 120, 180, 90]

    return [
      new PathLayer({
        id: 'shipping-routes',
        data: [
          { path: [[56.3, 26.5], [54.0, 24.0], [48.0, 20.0], [43.3, 12.6], [44.0, 2.0], [39.67, -4.05]] },
          { path: [[39.67, -4.05], [40.0, -10.0], [32.0, -30.0], [18.5, -34.4], [-5, -20]] },
          { path: [[43.3, 12.6], [38.0, 20.0], [33.5, 28.0], [32.3, 30.0]] },
        ],
        getPath: (d: any) => d.path,
        getColor: routeColor,
        widthUnits: 'pixels' as const,
        getWidth: ruptured ? 4 : 2,
        opacity: 0.55,
      }),
      new ScatterplotLayer({
        id: 'chokepoints',
        data: [
          { position: [56.3, 26.5], status: 'closed' },
          { position: [43.3, 12.6], status: 'open' },
          { position: [32.3, 30.0], status: 'open' },
          { position: [18.5, -34.4], status: 'congested' },
        ],
        getPosition: (d: any) => d.position,
        getRadius: (d: any) => d.status === 'closed' ? 80000 : 50000,
        radiusUnits: 'meters' as const,
        getFillColor: (d: any) =>
          d.status === 'closed' ? [255, 92, 64, 220]
            : d.status === 'congested' ? [230, 180, 60, 180]
              : [120, 200, 140, 180],
        opacity: 0.45,
        updateTriggers: { getFillColor: [lens] },
      }),
      // NO ports layer in globe phase — city markers don't exist at this zoom
    ]
  }

  // Landed phase: layers depend on active lens
  const corridorColor: [number, number, number, number] = lens === 'freight'
    ? [212, 168, 102, 220]
    : [184, 139, 74, 80]
  const routeColor: [number, number, number, number] = [114, 183, 255, 210]

  const layers: any[] = [
    new PathLayer({
      id: 'corridor-route',
      data: [
        { path: [[39.67, -4.05], [38.8, -3.2], [37.5, -2.0], [36.82, -1.29]] },
      ],
      getPath: (d: any) => d.path,
      getColor: corridorColor,
      widthUnits: 'pixels' as const,
      getWidth: 5,
      opacity: 0.6,
    }),
    new ScatterplotLayer({
      id: 'ports',
      data: [
        { position: [39.67, -4.05] },
        { position: [36.82, -1.29] },
      ],
      getPosition: (d: any) => d.position,
      getRadius: 4000,
      radiusUnits: 'meters' as const,
      getFillColor: [220, 200, 158, 120],
    }),
  ]

  // Show shipping routes + chokepoints in landed phase when shipping lens active
  if (lens === 'shipping') {
    layers.push(
      new PathLayer({
        id: 'shipping-routes',
        data: [
          { path: [[56.3, 26.5], [54.0, 24.0], [48.0, 20.0], [43.3, 12.6], [44.0, 2.0], [39.67, -4.05]] },
          { path: [[39.67, -4.05], [40.0, -10.0], [32.0, -30.0], [18.5, -34.4], [-5, -20]] },
          { path: [[43.3, 12.6], [38.0, 20.0], [33.5, 28.0], [32.3, 30.0]] },
        ],
        getPath: (d: any) => d.path,
        getColor: routeColor,
        widthUnits: 'pixels' as const,
        getWidth: ruptured ? 4 : 2,
        opacity: 0.55,
      }),
      new ScatterplotLayer({
        id: 'chokepoints',
        data: [
          { position: [56.3, 26.5], status: 'closed' },
          { position: [43.3, 12.6], status: 'open' },
          { position: [32.3, 30.0], status: 'open' },
          { position: [18.5, -34.4], status: 'congested' },
        ],
        getPosition: (d: any) => d.position,
        getRadius: (d: any) => d.status === 'closed' ? 80000 : 50000,
        radiusUnits: 'meters' as const,
        getFillColor: (d: any) =>
          d.status === 'closed' ? [255, 92, 64, 220]
            : d.status === 'congested' ? [230, 180, 60, 180]
              : [120, 200, 140, 180],
        opacity: 0.45,
      }),
    )
  }

  return layers
}

export default function MapRoot(props: Props) {
  const { lens, ruptured, mapFocus, globePhase, onSelectKenya, onMapReady, onFlyToComplete } = props
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const deckOverlayRef = useRef<MapboxOverlay | null>(null)
  const projectorRef = useRef(getAnchorProjector())
  const prevFocusRef = useRef<MapFocus>('world')
  const cityMarkersRef = useRef<maplibregl.Marker[]>([])

  // ── Initialize MapLibre + deck overlay ──
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE as maplibregl.StyleSpecification,
      center: MAP_FOCUS_PRESETS.world.center,
      zoom: MAP_FOCUS_PRESETS.world.zoom,
      pitch: MAP_FOCUS_PRESETS.world.pitch,
      bearing: MAP_FOCUS_PRESETS.world.bearing,
      attributionControl: false,
      dragRotate: true,
      scrollZoom: false,
      touchZoomRotate: true,
      doubleClickZoom: false,
    })

    mapRef.current = map

    map.on('load', () => {
      projectorRef.current.attach(map)

      // MapboxOverlay: deck follows MapLibre camera automatically
      const deckOverlay = new MapboxOverlay({
        interleaved: false,
        layers: buildDeckLayers(lens, ruptured, true),
      })
      map.addControl(deckOverlay as any)
      deckOverlayRef.current = deckOverlay

      // Kenya click handler
      map.on('click', (e: maplibregl.MapMouseEvent) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['kenya-fill'] })
        if (features.length) onSelectKenya?.()
      })

      // Hover cursor on Kenya
      map.on('mousemove', (e: maplibregl.MapMouseEvent) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['kenya-fill'] })
        map.getCanvas().style.cursor = features.length > 0 ? 'pointer' : ''
      })

      // City markers — created hidden, shown only in landed phase
      const cities = [
        { name: 'Mombasa', coords: [39.67, -4.05] as [number, number], sub: 'port' },
        { name: 'Nairobi', coords: [36.82, -1.29] as [number, number], sub: 'capital' },
      ]
      for (const city of cities) {
        const el = document.createElement('div')
        el.style.cssText = 'display:none;flex-direction:column;align-items:center;pointer-events:none;'
        const dot = document.createElement('div')
        dot.style.cssText = 'width:6px;height:6px;border-radius:999px;background:#c8a96e;box-shadow:0 0 6px rgba(200,169,110,0.4);'
        el.appendChild(dot)
        const label = document.createElement('div')
        label.textContent = city.name
        label.style.cssText = "color:#b89860;font-size:11px;margin-top:4px;font-family:'Instrument Sans',system-ui,sans-serif;letter-spacing:0.04em;white-space:nowrap;font-weight:500;text-shadow:0 1px 6px rgba(0,0,0,0.9);"
        el.appendChild(label)
        if (city.sub) {
          const sub = document.createElement('div')
          sub.textContent = city.sub
          sub.style.cssText = "color:rgba(184,152,96,0.4);font-size:9px;font-family:'Instrument Sans',system-ui,sans-serif;letter-spacing:0.3px;margin-top:1px;"
          el.appendChild(sub)
        }
        const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat(city.coords)
          .addTo(map)
        cityMarkersRef.current.push(marker)
      }

      onMapReady?.(map)
    })

    return () => {
      deckOverlayRef.current?.finalize()
      deckOverlayRef.current = null
      projectorRef.current.detach()
      cityMarkersRef.current = []
      map.remove()
      mapRef.current = null
    }
  }, [])

  // ── Update deck layers when lens/ruptured/globePhase changes ──
  useEffect(() => {
    if (!deckOverlayRef.current) return
    deckOverlayRef.current.setProps({ layers: buildDeckLayers(lens, ruptured, globePhase) })
  }, [lens, ruptured, globePhase])

  // ── Lens changes drive camera to appropriate geographic view ──
  useEffect(() => {
    if (!mapRef.current || globePhase) return
    const map = mapRef.current

    const focusMap: Record<string, MapFocus> = {
      shipping: 'shipping',
      freight: 'corridor',
      medicine: 'kenya',
      household: 'nairobi',
    }

    const targetFocus = focusMap[lens] || 'kenya'
    const preset = MAP_FOCUS_PRESETS[targetFocus]
    map.flyTo({
      center: preset.center,
      zoom: preset.zoom,
      pitch: preset.pitch,
      bearing: preset.bearing,
      duration: 2000,
      essential: true,
    })

    // Update anchor projections after camera move
    map.once('moveend', () => {
      projectorRef.current.reprojectAll()
    })
  }, [lens, globePhase])

  // ── Toggle city marker visibility based on phase ──
  useEffect(() => {
    for (const marker of cityMarkersRef.current) {
      const el = marker.getElement()
      el.style.display = globePhase ? 'none' : 'flex'
    }
  }, [globePhase])

  // ── Camera focus transitions ──
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (mapFocus === prevFocusRef.current) return
    prevFocusRef.current = mapFocus

    const preset = MAP_FOCUS_PRESETS[mapFocus]
    map.flyTo({
      center: preset.center,
      zoom: preset.zoom,
      pitch: preset.pitch,
      bearing: preset.bearing,
      duration: 1800,
      essential: true,
    })
    const onMoveEnd = () => onFlyToComplete?.()
    map.once('moveend', onMoveEnd)
    return () => { map.off('moveend', onMoveEnd) }
  }, [mapFocus, onFlyToComplete])

  // ── Interactivity toggle ──
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (globePhase) {
      map.dragRotate.enable()
      map.getCanvas().style.pointerEvents = 'auto'
    } else {
      map.dragRotate.disable()
      map.getCanvas().style.pointerEvents = 'none'
    }
  }, [globePhase])

  return <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
}
