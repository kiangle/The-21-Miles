import React, { useEffect, useRef, useCallback } from 'react'
import * as PIXI from 'pixi.js'
import Matter from 'matter-js'
import { FlowBandRenderer } from '../renderers/FlowBandRenderer'
import { CongestionRenderer } from '../renderers/CongestionRenderer'
import { FilamentRenderer } from '../renderers/FilamentRenderer'
import { PulseRenderer } from '../renderers/PulseRenderer'
import { MarginRenderer } from '../renderers/MarginRenderer'
import { SplitFutureRenderer } from '../renderers/SplitFutureRenderer'
import { MorphController } from '../../scenes/cascade/MorphController'
import { COLORS } from '../../app/config/constants'
import type { LensId, SceneId, TimeId, FutureId } from '../../state/machine/worldContext'

/**
 * PixiStage — the 2D living world.
 *
 * ONE shared Matter.js engine drives ALL renderers.
 * Each renderer owns its own bodies in the shared world.
 * The engine ticks once per frame; renderers read body positions.
 *
 * Matter.js = physical behavior (queueing, bunching, bottleneck, competition).
 * Pixi = visual clarity (density bloom, trail, glow, color shift).
 */

interface PixiStageProps {
  scene: SceneId
  lens: LensId
  time: TimeId
  future: FutureId
  roleId: 'nurse' | 'driver' | null
  compareMode: boolean
  supplyLevel: number
  erosionPct: number
  visible: boolean
}

const TIME_PRESSURE: Record<TimeId, number> = {
  day1: 0.2,
  day3: 0.45,
  week1: 0.7,
  month1: 1.0,
}

const FUTURE_PRESSURE: Record<FutureId, number> = {
  baseline: 1.0,
  redSea: 1.5,
  reserves: 0.6,
  closureEnds: 0.3,
}

function computePositions(w: number, h: number) {
  return {
    hormuz: { x: w * 0.78, y: h * 0.17 },
    babElMandeb: { x: w * 0.62, y: h * 0.27 },
    mombasa: { x: w * 0.54, y: h * 0.48 },
    nairobi: { x: w * 0.50, y: h * 0.43 },
    capeTown: { x: w * 0.36, y: h * 0.72 },
    suez: { x: w * 0.60, y: h * 0.14 },
    hospital: { x: w * 0.47, y: h * 0.41 },
    market: { x: w * 0.52, y: h * 0.52 },
    household1: { x: w * 0.48, y: h * 0.56 },
    household2: { x: w * 0.55, y: h * 0.55 },
    household3: { x: w * 0.45, y: h * 0.60 },
  }
}

export default function PixiStage({
  scene, lens, time, future, roleId, compareMode,
  supplyLevel, erosionPct, visible,
}: PixiStageProps) {
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
  const engineRef = useRef<Matter.Engine | null>(null)

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
    const POS = computePositions(w, h)

    // ── ONE shared Matter.js engine for all renderers ──
    const engine = Matter.Engine.create({
      gravity: { x: 0, y: 0 },
      enableSleeping: true,
      positionIterations: 8,
      constraintIterations: 4,
    })
    engineRef.current = engine

    // ── Pixi renderers — each receives the shared engine ──
    const flowBands = new FlowBandRenderer(app.stage, engine)
    const congestion = new CongestionRenderer(app.stage, engine)
    const filaments = new FilamentRenderer(app.stage)
    const pulses = new PulseRenderer(app.stage, engine)
    const margins = new MarginRenderer(app.stage, engine)
    const split = new SplitFutureRenderer(app.stage, w, h)

    renderersRef.current = { flowBands, congestion, filaments, pulses, margins }
    splitRef.current = split

    // ── SHIPPING: flow lanes → physics-driven vessels ──
    flowBands.addBand(
      [POS.hormuz, { x: w * 0.72, y: h * 0.22 }, POS.babElMandeb, { x: w * 0.58, y: h * 0.35 }, POS.mombasa],
      0, COLORS.shipping, 4, false,
    )
    flowBands.addBand(
      [POS.capeTown, { x: w * 0.39, y: h * 0.60 }, { x: w * 0.44, y: h * 0.52 }, POS.mombasa],
      0, '#D4763C', 3, true,
    )
    flowBands.addBand([POS.suez, POS.babElMandeb], 0, '#5BA3CF', 3, false)
    flowBands.addBand(
      [POS.mombasa, { x: w * 0.52, y: h * 0.46 }, POS.nairobi],
      0, COLORS.household, 2.5, false,
    )
    flowBands.setAnchors(POS.hormuz, POS.mombasa)
    flowBands.initPhysics()

    // ── FREIGHT: corridor → physics-driven bodies in walled channel ──
    congestion.setCorridor([
      POS.mombasa,
      { x: (POS.mombasa.x + POS.nairobi.x) / 2, y: (POS.mombasa.y + POS.nairobi.y) / 2 },
      POS.nairobi,
    ])

    // ── MEDICINE: supply path → physics-driven cadence bodies ──
    filaments.addFilament(POS.mombasa, POS.nairobi, 10)
    filaments.addFilament(POS.mombasa, POS.hospital, 8)
    pulses.setSupplyPath([
      POS.mombasa,
      { x: (POS.mombasa.x + POS.hospital.x) / 2, y: (POS.mombasa.y + POS.hospital.y) / 2 },
      POS.hospital,
    ])
    pulses.setShelfPosition(POS.hospital)
    pulses.addPulsePoint(POS.hospital.x, POS.hospital.y)
    pulses.addPulsePoint(POS.nairobi.x + 20, POS.nairobi.y - 10)

    // ── FOOD: distribution → physics-driven bodies with sink competition ──
    margins.addDistributionFlow(
      [POS.mombasa, { x: (POS.mombasa.x + POS.market.x) / 2, y: (POS.mombasa.y + POS.market.y) / 2 + 10 }, POS.market],
      0, false,
    )
    margins.addDistributionFlow([POS.market, POS.household1], 0, true)
    margins.addDistributionFlow([POS.market, POS.household2], 0, true)
    margins.addDistributionFlow([POS.market, POS.household3], 0, true)
    margins.addDistributionFlow(
      [POS.nairobi, { x: (POS.nairobi.x + POS.market.x) / 2, y: (POS.nairobi.y + POS.market.y) / 2 }, POS.market],
      0, false,
    )
    margins.addMarketNode(POS.market.x, POS.market.y, 'market')
    margins.addMarketNode(POS.household1.x, POS.household1.y, 'home')
    margins.addMarketNode(POS.household2.x, POS.household2.y, 'home')
    margins.addMarketNode(POS.household3.x, POS.household3.y, 'home')
    margins.addBand(POS.nairobi, { x: POS.nairobi.x + 60, y: POS.nairobi.y + 40 })
    margins.addBand(POS.hospital, { x: POS.hospital.x - 40, y: POS.hospital.y + 30 })
    margins.initPhysics()

    // ── Morph controller ──
    const morph = new MorphController({ flowBands, congestion, filaments, pulses, margins })
    morph.showOnly('shipping')
    morphRef.current = morph

    // ── Single ticker: engine ticks once, all renderers read body state ──
    app.ticker.add((delta) => {
      const dt = delta / 60

      // One physics step for the shared engine
      Matter.Engine.update(engine, dt * 1000)

      // Each renderer reads its bodies' positions and draws
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
      if (engineRef.current) {
        Matter.Engine.clear(engineRef.current)
        engineRef.current = null
      }
    }
  }, [initPixi])

  // ── Lens morphing ──
  useEffect(() => {
    if (!morphRef.current) return
    const landedScenes = ['baseline', 'rupture', 'detour', 'cascade', 'yourMonth', 'whatNext', 'split']
    if (landedScenes.includes(scene)) {
      morphRef.current.morphTo(lens)
    }
  }, [lens, scene])

  // ── Pressure: time × future → visible world change ──
  useEffect(() => {
    if (!morphRef.current) return
    const pressure = TIME_PRESSURE[time] * FUTURE_PRESSURE[future]
    morphRef.current.setPressure(pressure)

    if (renderersRef.current) {
      renderersRef.current.flowBands.setConstricted(
        pressure > 0.3 && future !== 'closureEnds',
      )
    }
  }, [time, future])

  // ── Perspective ──
  useEffect(() => {
    if (!morphRef.current) return
    morphRef.current.setPerspective(roleId)
  }, [roleId])

  useEffect(() => { renderersRef.current?.pulses.setSupplyLevel(supplyLevel) }, [supplyLevel])
  useEffect(() => { renderersRef.current?.margins.setErosion(erosionPct) }, [erosionPct])

  useEffect(() => {
    if (splitRef.current) {
      splitRef.current.setVisible(compareMode)
      splitRef.current.setSplit(compareMode ? 1 : 0)
    }
  }, [compareMode])

  useEffect(() => {
    if (scene === 'rupture' && renderersRef.current) {
      renderersRef.current.flowBands.setConstricted(true)
    }
  }, [scene])

  return (
    <div ref={containerRef} style={{
      position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
      zIndex: 3, pointerEvents: 'none',
      opacity: visible ? 1 : 0, transition: 'opacity 1s ease',
    }} />
  )
}
