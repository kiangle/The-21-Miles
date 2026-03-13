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
 * Matter.js = hidden physical logic (blockage, queue, squeeze, competition).
 * Pixi = visible systemic theatre (flow, trails, glow, rhythm, depletion).
 *
 * Every tray control (lens, time, future, perspective) creates a visible
 * change in this stage.
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

// Time pressure: how far the crisis has progressed
const TIME_PRESSURE: Record<TimeId, number> = {
  day1: 0.2,
  day3: 0.45,
  week1: 0.7,
  month1: 1.0,
}

// Future pressure multiplier
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
  const matterRef = useRef<{ engine: Matter.Engine; bodies: Matter.Body[] } | null>(null)

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

    // ── Matter.js physics — chokepoint bunching ──
    const engine = Matter.Engine.create({
      gravity: { x: 0, y: 0 },
      enableSleeping: true,
      positionIterations: 8,
    })

    const hormuzX = POS.hormuz.x
    const hormuzY = POS.hormuz.y

    const wallTop = Matter.Bodies.rectangle(hormuzX, hormuzY - 35, 80, 10, { isStatic: true })
    const wallBot = Matter.Bodies.rectangle(hormuzX, hormuzY + 35, 80, 10, { isStatic: true })
    Matter.Composite.add(engine.world, [wallTop, wallBot])

    const matterBodies: Matter.Body[] = []
    for (let i = 0; i < 40; i++) {
      const body = Matter.Bodies.circle(
        hormuzX + (Math.random() - 0.5) * 60,
        hormuzY + (Math.random() - 0.5) * 50,
        2 + Math.random() * 2,
        { density: 0.0005, frictionAir: 0.04, restitution: 0.3, label: 'vessel' },
      )
      Matter.Composite.add(engine.world, body)
      matterBodies.push(body)
    }
    matterRef.current = { engine, bodies: matterBodies }

    // ── Pixi renderers ──
    const flowBands = new FlowBandRenderer(app.stage)
    const congestion = new CongestionRenderer(app.stage)
    const filaments = new FilamentRenderer(app.stage)
    const pulses = new PulseRenderer(app.stage)
    const margins = new MarginRenderer(app.stage)
    const split = new SplitFutureRenderer(app.stage, w, h)

    renderersRef.current = { flowBands, congestion, filaments, pulses, margins }
    splitRef.current = split

    // ── SHIPPING: flow lanes with container packets ──
    flowBands.addBand(
      [POS.hormuz, { x: w * 0.72, y: h * 0.22 }, POS.babElMandeb, { x: w * 0.58, y: h * 0.35 }, POS.mombasa],
      30, COLORS.shipping, 3, false,
    )
    flowBands.addBand(
      [POS.capeTown, { x: w * 0.39, y: h * 0.60 }, { x: w * 0.44, y: h * 0.52 }, POS.mombasa],
      15, '#D4763C', 2, true,
    )
    flowBands.addBand([POS.suez, POS.babElMandeb], 20, '#5BA3CF', 2, false)
    flowBands.addBand(
      [POS.mombasa, { x: w * 0.52, y: h * 0.46 }, POS.nairobi],
      12, COLORS.household, 2, false,
    )
    flowBands.setAnchors(POS.hormuz, POS.mombasa)

    // ── FREIGHT: corridor + convoy beads ──
    congestion.setCorridor([
      POS.mombasa,
      { x: (POS.mombasa.x + POS.nairobi.x) / 2, y: (POS.mombasa.y + POS.nairobi.y) / 2 },
      POS.nairobi,
    ])
    congestion.setAttractor(POS.mombasa)
    for (let i = 0; i < 20; i++) {
      congestion.spawn(
        POS.mombasa.x + (Math.random() - 0.5) * 80,
        POS.mombasa.y + (Math.random() - 0.5) * 60,
      )
    }

    // ── MEDICINE: supply path + shelf + pulse points ──
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

    // ── FOOD: distribution flows + market/household nodes ──
    margins.addDistributionFlow(
      [POS.mombasa, { x: (POS.mombasa.x + POS.market.x) / 2, y: (POS.mombasa.y + POS.market.y) / 2 + 10 }, POS.market],
      12, false,
    )
    margins.addDistributionFlow([POS.market, POS.household1], 6, true)
    margins.addDistributionFlow([POS.market, POS.household2], 6, true)
    margins.addDistributionFlow([POS.market, POS.household3], 5, true)
    margins.addDistributionFlow(
      [POS.nairobi, { x: (POS.nairobi.x + POS.market.x) / 2, y: (POS.nairobi.y + POS.market.y) / 2 }, POS.market],
      8, false,
    )
    margins.addMarketNode(POS.market.x, POS.market.y, 'market')
    margins.addMarketNode(POS.household1.x, POS.household1.y, 'home')
    margins.addMarketNode(POS.household2.x, POS.household2.y, 'home')
    margins.addMarketNode(POS.household3.x, POS.household3.y, 'home')
    margins.addBand(POS.nairobi, { x: POS.nairobi.x + 60, y: POS.nairobi.y + 40 })
    margins.addBand(POS.hospital, { x: POS.hospital.x - 40, y: POS.hospital.y + 30 })

    // ── Morph controller ──
    const morph = new MorphController({ flowBands, congestion, filaments, pulses, margins })
    morph.showOnly('shipping')
    morphRef.current = morph

    // ── Matter-driven graphics overlay ──
    const matterGfx = new PIXI.Graphics()
    app.stage.addChild(matterGfx)

    app.ticker.add((delta) => {
      const dt = delta / 60

      Matter.Engine.update(engine, dt * 1000)

      for (const body of matterBodies) {
        const dx = hormuzX - body.position.x
        const dy = hormuzY - body.position.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > 5) {
          const strength = 0.000002 * dist
          Matter.Body.applyForce(body, body.position, {
            x: (dx / dist) * strength,
            y: (dy / dist) * strength,
          })
        }
      }

      matterGfx.clear()
      for (const body of matterBodies) {
        const bx = body.position.x
        const by = body.position.y
        const bunching = Math.min(1, 30 / Math.max(1, Math.sqrt((bx - hormuzX) ** 2 + (by - hormuzY) ** 2)))
        const r = Math.round(200 + 55 * bunching)
        const g = Math.round(169 - 80 * bunching)
        const b = Math.round(110 - 60 * bunching)
        const alpha = 0.5 + bunching * 0.4
        matterGfx.beginFill((r << 16) | (g << 8) | b, alpha)
        const rad = (body as any).circleRadius || 3
        matterGfx.drawRect(bx - rad, by - rad * 0.6, rad * 2, rad * 1.2)
        matterGfx.endFill()
      }

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
      if (matterRef.current) {
        Matter.Engine.clear(matterRef.current.engine)
        matterRef.current = null
      }
    }
  }, [initPixi])

  // ── Lens morphing — every "Follow the..." click must visibly change the world ──
  useEffect(() => {
    if (!morphRef.current) return
    // Allow lens switching from ALL landed scenes — tray must always work
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

  // ── Perspective: roleId → visible emphasis change ──
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
