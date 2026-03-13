import React, { useEffect, useRef, useCallback } from 'react'
import * as PIXI from 'pixi.js'
import { FlowBandRenderer } from '../renderers/FlowBandRenderer'
import { CongestionRenderer } from '../renderers/CongestionRenderer'
import { FilamentRenderer } from '../renderers/FilamentRenderer'
import { PulseRenderer } from '../renderers/PulseRenderer'
import { MarginRenderer } from '../renderers/MarginRenderer'
import { SplitFutureRenderer } from '../renderers/SplitFutureRenderer'
import { MorphController } from '../../scenes/cascade/MorphController'
import type { LensId, SceneId } from '../../state/machine/worldContext'

/**
 * PixiStage — the 2D living world.
 *
 * All cascade visuals render here. The stage is the world.
 * Layered on top of MapLibre after the fly-to transition.
 */

interface PixiStageProps {
  scene: SceneId
  lens: LensId
  compareMode: boolean
  supplyLevel: number
  erosionPct: number
  visible: boolean
}

// Screen-space positions for Kenya map features
const KENYA_POSITIONS = {
  hormuz: { x: 750, y: 180 },
  babElMandeb: { x: 600, y: 280 },
  mombasa: { x: 520, y: 400 },
  nairobi: { x: 480, y: 370 },
  capeTown: { x: 350, y: 650 },
  suez: { x: 580, y: 150 },
  hospital: { x: 460, y: 360 },
}

export default function PixiStage({ scene, lens, compareMode, supplyLevel, erosionPct, visible }: PixiStageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<PIXI.Application | null>(null)
  const morphRef = useRef<MorphController | null>(null)
  const splitRef = useRef<SplitFutureRenderer | null>(null)
  const renderersRef = useRef<{
    flowBands: FlowBandRenderer
    congestion: CongestionRenderer
    filaments: FilamentRenderer
    pulses: PulseRenderer
    margins: MarginRenderer
  } | null>(null)

  const initPixi = useCallback(async () => {
    if (!containerRef.current || appRef.current) return

    const app = new PIXI.Application({
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio, 2),
      autoDensity: true,
    })
    containerRef.current.appendChild(app.view as HTMLCanvasElement)
    appRef.current = app

    const w = app.screen.width
    const h = app.screen.height

    // Create renderer layers
    const flowBands = new FlowBandRenderer(app.stage)
    const congestion = new CongestionRenderer(app.stage)
    const filaments = new FilamentRenderer(app.stage)
    const pulses = new PulseRenderer(app.stage)
    const margins = new MarginRenderer(app.stage)
    const split = new SplitFutureRenderer(app.stage, w, h)

    renderersRef.current = { flowBands, congestion, filaments, pulses, margins }
    splitRef.current = split

    // Initialize flow bands — shipping routes as screen paths
    const hormuzToMombasa = [
      KENYA_POSITIONS.hormuz,
      { x: 700, y: 220 },
      KENYA_POSITIONS.babElMandeb,
      { x: 560, y: 330 },
      KENYA_POSITIONS.mombasa,
    ]
    const capeRoute = [
      KENYA_POSITIONS.capeTown,
      { x: 380, y: 580 },
      { x: 420, y: 500 },
      { x: 480, y: 440 },
      KENYA_POSITIONS.mombasa,
    ]
    const suezRoute = [
      KENYA_POSITIONS.suez,
      KENYA_POSITIONS.babElMandeb,
    ]
    const mombasaToNairobi = [
      KENYA_POSITIONS.mombasa,
      { x: 500, y: 385 },
      KENYA_POSITIONS.nairobi,
    ]

    flowBands.addBand(hormuzToMombasa, 30, '#88CCFF', 3)
    flowBands.addBand(capeRoute, 15, '#D4763C', 2)
    flowBands.addBand(suezRoute, 20, '#5BA3CF', 2)
    flowBands.addBand(mombasaToNairobi, 12, '#C8A96E', 2)

    // Initialize congestion — at Mombasa port
    congestion.setAttractor(KENYA_POSITIONS.mombasa)
    for (let i = 0; i < 30; i++) {
      congestion.spawn(
        KENYA_POSITIONS.mombasa.x + (Math.random() - 0.5) * 100,
        KENYA_POSITIONS.mombasa.y + (Math.random() - 0.5) * 80,
      )
    }

    // Initialize filaments — inland supply lines
    filaments.addFilament(KENYA_POSITIONS.mombasa, KENYA_POSITIONS.nairobi, 10)
    filaments.addFilament(KENYA_POSITIONS.mombasa, KENYA_POSITIONS.hospital, 8)

    // Initialize pulses — hospital and supply points
    pulses.addPulsePoint(KENYA_POSITIONS.hospital.x, KENYA_POSITIONS.hospital.y)
    pulses.addPulsePoint(KENYA_POSITIONS.nairobi.x + 20, KENYA_POSITIONS.nairobi.y - 10)

    // Initialize margin bands
    margins.addBand(KENYA_POSITIONS.nairobi, { x: KENYA_POSITIONS.nairobi.x + 60, y: KENYA_POSITIONS.nairobi.y + 40 })
    margins.addBand(KENYA_POSITIONS.hospital, { x: KENYA_POSITIONS.hospital.x - 40, y: KENYA_POSITIONS.hospital.y + 30 })

    // Morph controller
    const morph = new MorphController({ flowBands, congestion, filaments, pulses, margins })
    morph.showOnly('shipping')
    morphRef.current = morph

    // Animation loop
    app.ticker.add((delta) => {
      const dt = delta / 60
      flowBands.update(dt)
      congestion.update(dt)
      filaments.update(dt)
      pulses.update(dt)
      margins.update(dt)
      split.update()
    })
  }, [])

  useEffect(() => {
    initPixi()
    return () => {
      if (appRef.current) {
        appRef.current.destroy(true, { children: true })
        appRef.current = null
      }
    }
  }, [initPixi])

  // React to lens changes
  useEffect(() => {
    if (morphRef.current && scene === 'cascade') {
      morphRef.current.morphTo(lens)
    } else if (morphRef.current) {
      // For non-cascade scenes, show appropriate renderer
      if (scene === 'baseline' || scene === 'rupture' || scene === 'detour') {
        morphRef.current.showOnly('shipping')
      } else if (scene === 'yourMonth') {
        morphRef.current.showOnly('household')
      }
    }
  }, [lens, scene])

  // React to supply level
  useEffect(() => {
    if (renderersRef.current) {
      renderersRef.current.pulses.setSupplyLevel(supplyLevel)
    }
  }, [supplyLevel])

  // React to erosion
  useEffect(() => {
    if (renderersRef.current) {
      renderersRef.current.margins.setErosion(erosionPct)
    }
  }, [erosionPct])

  // React to compare mode
  useEffect(() => {
    if (splitRef.current) {
      splitRef.current.setVisible(compareMode)
      splitRef.current.setSplit(compareMode ? 1 : 0)
    }
  }, [compareMode])

  // React to rupture
  useEffect(() => {
    if (scene === 'rupture' && renderersRef.current) {
      renderersRef.current.flowBands.setConstricted(true)
    }
  }, [scene])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 3,
        pointerEvents: 'none',
        opacity: visible ? 1 : 0,
        transition: 'opacity 1s ease',
      }}
    />
  )
}
