import React, { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Deck } from '@deck.gl/core'
import { PathLayer, ScatterplotLayer } from '@deck.gl/layers'
import type { BootstrapResponse } from '../../atlas/types'

/**
 * MapRoot — MapLibre + deck.gl landing stage.
 *
 * After fly-to: real geographic truth. Dark basemap with
 * deck.gl route overlays, chokepoints, and ports.
 * Layered UNDER the Pixi living world stage.
 */

interface MapRootProps {
  visible: boolean
  bootstrap: BootstrapResponse | null
  countryId: string | null
  ruptured: boolean
}

// Dark basemap style — minimal labels, dark restrained geography
const DARK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  name: 'dark-minimal',
  sources: {
    'background': {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    },
  },
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#0a0a12' },
    },
  ],
}

// Route data for deck.gl overlays
const ROUTE_PATHS = [
  {
    id: 'hormuz_africa',
    coordinates: [[56.3, 26.5], [54.0, 24.0], [48.0, 20.0], [44.0, 15.0], [43.3, 12.6], [44.0, 8.0], [44.0, 2.0], [39.7, -4.0]],
    blocked: true,
  },
  {
    id: 'red_sea_suez',
    coordinates: [[43.3, 12.6], [42.0, 15.0], [38.0, 20.0], [35.0, 25.0], [33.5, 28.0], [32.3, 30.0]],
    blocked: false,
  },
  {
    id: 'cape_route',
    coordinates: [[39.7, -4.0], [40.0, -10.0], [37.0, -20.0], [32.0, -30.0], [18.5, -34.4], [5.0, -30.0], [-5.0, -20.0]],
    blocked: false,
    stressed: true,
  },
  {
    id: 'mombasa_nairobi',
    coordinates: [[39.67, -4.05], [38.5, -3.0], [37.5, -2.0], [36.82, -1.29]],
    blocked: false,
  },
  {
    id: 'indian_ocean',
    coordinates: [[56.3, 26.5], [60.0, 20.0], [65.0, 15.0], [72.0, 5.0], [80.0, -2.0], [95.0, 0.0], [103.8, 1.4]],
    blocked: true,
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

export default function MapRoot({ visible, bootstrap, countryId, ruptured }: MapRootProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const deckRef = useRef<Deck | null>(null)
  const [mapReady, setMapReady] = useState(false)

  // Initialize MapLibre
  useEffect(() => {
    if (!visible || !mapContainerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: DARK_STYLE,
      center: [36.82, -1.29], // Nairobi
      zoom: 3,
      attributionControl: false,
      interactive: false, // not user-interactive — it's a cinematic backdrop
    })

    map.on('load', () => {
      setMapReady(true)
    })

    mapRef.current = map

    return () => {
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
      layers: createDeckLayers(ruptured),
    })

    deckRef.current = deck

    return () => {
      deck.finalize()
      deckRef.current = null
    }
  }, [visible, mapReady, ruptured])

  // Update deck layers when rupture state changes
  useEffect(() => {
    if (deckRef.current) {
      deckRef.current.setProps({ layers: createDeckLayers(ruptured) })
    }
  }, [ruptured])

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
      }}
    />
  )
}

function createDeckLayers(ruptured: boolean) {
  return [
    new PathLayer({
      id: 'shipping-routes',
      data: ROUTE_PATHS,
      getPath: (d: any) => d.coordinates,
      getColor: (d: any) => d.blocked
        ? [170, 90, 90, ruptured ? 100 : 220]
        : d.stressed
          ? [212, 118, 60, 220]
          : [140, 200, 255, 180],
      getWidth: (d: any) => d.blocked ? (ruptured ? 1 : 4) : d.stressed ? 5 : 3,
      widthUnits: 'pixels',
      widthMinPixels: 1,
      rounded: true,
    }),
    new ScatterplotLayer({
      id: 'chokepoints',
      data: CHOKEPOINT_DATA,
      getPosition: (d: any) => d.coordinates,
      getRadius: (d: any) => d.status === 'closed' ? 40000 : 25000,
      radiusUnits: 'meters',
      getFillColor: (d: any) =>
        d.status === 'closed' ? [255, 50, 50, 200]
          : d.status === 'congested' ? [230, 180, 60, 180]
            : [100, 200, 140, 150],
      radiusMinPixels: 4,
    }),
    new ScatterplotLayer({
      id: 'ports',
      data: PORT_DATA,
      getPosition: (d: any) => d.coordinates,
      getRadius: 18000,
      radiusUnits: 'meters',
      getFillColor: [200, 169, 110, 160],
      radiusMinPixels: 3,
    }),
  ]
}
