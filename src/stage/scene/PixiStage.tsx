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
import type { LensId, SceneId } from '../../state/machine/worldContext'

/**
 * PixiStage — the 2D living world.
 *
 * All cascade visuals render here. Matter.js drives chokepoint
 * congestion bunching and pressure physics. Pixi renders the result.
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

    // ── Matter.js physics — chokepoint bunching ──
    const engine = Matter.Engine.create({ gravity: { x: 0, y: 0 }, enableSleeping: true })

    const hormuzX = KENYA_POSITIONS.hormuz.x
    const hormuzY = KENYA_POSITIONS.hormuz.y

    // Chokepoint walls
    const wallTop = Matter.Bodies.rectangle(hormuzX, hormuzY - 35, 80, 10, { isStatic: true })
    const wallBot = Matter.Bodies.rectangle(hormuzX, hormuzY + 35, 80, 10, { isStatic: true })
    Matter.Composite.add(engine.world, [wallTop, wallBot])

    // Vessel bodies
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

    // Flow bands
    flowBands.addBand([KENYA_POSITIONS.hormuz, { x: 700, y: 220 }, KENYA_POSITIONS.babElMandeb, { x: 560, y: 330 }, KENYA_POSITIONS.mombasa], 30, '#88CCFF', 3)
    flowBands.addBand([KENYA_POSITIONS.capeTown, { x: 380, y: 580 }, { x: 420, y: 500 }, { x: 480, y: 440 }, KENYA_POSITIONS.mombasa], 15, '#D4763C', 2)
    flowBands.addBand([KENYA_POSITIONS.suez, KENYA_POSITIONS.babElMandeb], 20, '#5BA3CF', 2)
    flowBands.addBand([KENYA_POSITIONS.mombasa, { x: 500, y: 385 }, KENYA_POSITIONS.nairobi], 12, '#C8A96E', 2)

    congestion.setAttractor(KENYA_POSITIONS.mombasa)
    for (let i = 0; i < 30; i++) {
      congestion.spawn(KENYA_POSITIONS.mombasa.x + (Math.random() - 0.5) * 100, KENYA_POSITIONS.mombasa.y + (Math.random() - 0.5) * 80)
    }

    filaments.addFilament(KENYA_POSITIONS.mombasa, KENYA_POSITIONS.nairobi, 10)
    filaments.addFilament(KENYA_POSITIONS.mombasa, KENYA_POSITIONS.hospital, 8)

    pulses.addPulsePoint(KENYA_POSITIONS.hospital.x, KENYA_POSITIONS.hospital.y)
    pulses.addPulsePoint(KENYA_POSITIONS.nairobi.x + 20, KENYA_POSITIONS.nairobi.y - 10)

    margins.addBand(KENYA_POSITIONS.nairobi, { x: KENYA_POSITIONS.nairobi.x + 60, y: KENYA_POSITIONS.nairobi.y + 40 })
    margins.addBand(KENYA_POSITIONS.hospital, { x: KENYA_POSITIONS.hospital.x - 40, y: KENYA_POSITIONS.hospital.y + 30 })

    const morph = new MorphController({ flowBands, congestion, filaments, pulses, margins })
    morph.showOnly('shipping')
    morphRef.current = morph

    // Matter-driven congestion graphics overlay
    const matterGfx = new PIXI.Graphics()
    app.stage.addChild(matterGfx)

    app.ticker.add((delta) => {
      const dt = delta / 60

      // Step Matter physics
      Matter.Engine.update(engine, dt * 1000)

      // Attractor force — bunching at chokepoint
      for (const body of matterBodies) {
        const dx = hormuzX - body.position.x
        const dy = hormuzY - body.position.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > 5) {
          const strength = 0.000002 * dist
          Matter.Body.applyForce(body, body.position, { x: (dx / dist) * strength, y: (dy / dist) * strength })
        }
      }

      // Render Matter bodies
      matterGfx.clear()
      for (const body of matterBodies) {
        const bunching = Math.min(1, 30 / Math.max(1, Math.sqrt((body.position.x - hormuzX) ** 2 + (body.position.y - hormuzY) ** 2)))
        const r = Math.round(200 + 55 * bunching)
        const g = Math.round(169 - 80 * bunching)
        const b = Math.round(110 - 60 * bunching)
        matterGfx.beginFill((r << 16) | (g << 8) | b, 0.6 + bunching * 0.3)
        matterGfx.drawCircle(body.position.x, body.position.y, (body as any).circleRadius || 3)
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

  useEffect(() => {
    if (morphRef.current && scene === 'cascade') {
      morphRef.current.morphTo(lens)
    } else if (morphRef.current) {
      if (['baseline', 'rupture', 'detour'].includes(scene)) morphRef.current.showOnly('shipping')
      else if (scene === 'yourMonth') morphRef.current.showOnly('household')
    }
  }, [lens, scene])

  useEffect(() => { renderersRef.current?.pulses.setSupplyLevel(supplyLevel) }, [supplyLevel])
  useEffect(() => { renderersRef.current?.margins.setErosion(erosionPct) }, [erosionPct])
  useEffect(() => {
    if (splitRef.current) {
      splitRef.current.setVisible(compareMode)
      splitRef.current.setSplit(compareMode ? 1 : 0)
    }
  }, [compareMode])
  useEffect(() => {
    if (scene === 'rupture' && renderersRef.current) renderersRef.current.flowBands.setConstricted(true)
  }, [scene])

  return (
    <div ref={containerRef} style={{
      position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
      zIndex: 3, pointerEvents: 'none',
      opacity: visible ? 1 : 0, transition: 'opacity 1s ease',
    }} />
  )
}
