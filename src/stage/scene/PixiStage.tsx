import React, { useEffect, useRef, useCallback } from 'react'
import * as PIXI from 'pixi.js'
import { NoiseFilter } from '@pixi/filter-noise'
import { ColorMatrixFilter } from '@pixi/filter-color-matrix'
import Matter from 'matter-js'
import gsap from 'gsap'
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
 *
 * Every toggle, every scrub, every tap produces IMMEDIATE, DRAMATIC,
 * PHYSICAL change in the world.
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
  const pressureTweenRef = useRef<gsap.core.Tween | null>(null)
  const pressureRef = useRef({ value: 0.2 })
  const prevSceneRef = useRef<SceneId>('entry')
  const atmosphereRef = useRef<{
    noise: NoiseFilter
    colorMatrix: ColorMatrixFilter
    vignetteGfx: PIXI.Graphics
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

    // ── Issue #8: Atmospheric filters ──
    const noiseFilter = new NoiseFilter(0.04)
    const colorMatrix = new ColorMatrixFilter()
    app.stage.filters = [noiseFilter, colorMatrix]

    // Vignette overlay
    const vignetteGfx = new PIXI.Graphics()
    app.stage.addChild(vignetteGfx)
    drawVignette(vignetteGfx, w, h, 0.3)

    atmosphereRef.current = { noise: noiseFilter, colorMatrix, vignetteGfx }

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

      // Apply morph controller alpha values each frame for smooth transitions
      if (morphRef.current) {
        morphRef.current.applyAlphas()
      }

      // Animate noise grain
      noiseFilter.seed = Math.random()
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

  // ── Issue #2: Lens morphing with GSAP cross-fade ──
  useEffect(() => {
    if (!morphRef.current) return
    const landedScenes = ['baseline', 'rupture', 'detour', 'cascade', 'yourMonth', 'whatNext', 'split']
    if (landedScenes.includes(scene)) {
      morphRef.current.morphTo(lens)
    }
  }, [lens, scene])

  // ── Issue #4: Time scrubbing → GSAP-animated pressure transitions ──
  useEffect(() => {
    if (!morphRef.current || !renderersRef.current) return

    const targetPressure = TIME_PRESSURE[time] * FUTURE_PRESSURE[future]

    // Kill any running pressure tween
    if (pressureTweenRef.current) {
      pressureTweenRef.current.kill()
    }

    // GSAP-animate pressure so Day1→Month1 transition is dramatic and visible
    pressureTweenRef.current = gsap.to(pressureRef.current, {
      value: targetPressure,
      duration: 1.5,
      ease: 'power2.inOut',
      onUpdate: () => {
        const p = pressureRef.current.value
        morphRef.current?.setPressure(p)
        renderersRef.current?.flowBands.setConstricted(
          p > 0.3 && future !== 'closureEnds',
        )
      },
    })

    // Issue #8: Atmospheric shift with pressure
    if (atmosphereRef.current) {
      const atm = atmosphereRef.current
      gsap.to(atm.noise, {
        noise: 0.03 + targetPressure * 0.06,
        duration: 1.5,
        ease: 'power2.inOut',
      })

      // Red tint intensifies with pressure
      const redShift = targetPressure * 0.15
      atm.colorMatrix.reset()
      if (redShift > 0.02) {
        // Subtle warm shift toward stress
        atm.colorMatrix.matrix[0] = 1 + redShift    // R
        atm.colorMatrix.matrix[6] = 1 - redShift * 0.3 // G
        atm.colorMatrix.matrix[12] = 1 - redShift * 0.5 // B
      }
    }
  }, [time, future])

  // ── Issue #6: Scene transition GSAP choreography ──
  useEffect(() => {
    if (!appRef.current || !renderersRef.current || !morphRef.current) return
    const prev = prevSceneRef.current
    prevSceneRef.current = scene

    const stage = appRef.current.stage

    switch (scene) {
      case 'rupture': {
        // Shake effect — screen tremor
        const original = { x: stage.position.x, y: stage.position.y }
        gsap.timeline()
          .to(stage.position, { x: original.x + 6, y: original.y - 3, duration: 0.05 })
          .to(stage.position, { x: original.x - 5, y: original.y + 4, duration: 0.05 })
          .to(stage.position, { x: original.x + 3, y: original.y - 2, duration: 0.05 })
          .to(stage.position, { x: original.x - 4, y: original.y + 3, duration: 0.05 })
          .to(stage.position, { x: original.x + 2, y: original.y - 1, duration: 0.05 })
          .to(stage.position, { x: original.x, y: original.y, duration: 0.15, ease: 'power2.out' })

        // Flash white then fade
        if (atmosphereRef.current) {
          const cm = atmosphereRef.current.colorMatrix
          gsap.fromTo(
            { brightness: 2 },
            { brightness: 2 },
            {
              brightness: 1,
              duration: 0.6,
              ease: 'power3.out',
              onUpdate: function () {
                cm.reset()
                cm.brightness(this.targets()[0].brightness, false)
              },
            },
          )
        }

        // Constrict chokepoint
        renderersRef.current.flowBands.setConstricted(true)
        break
      }

      case 'detour': {
        // Fade in from dark
        gsap.fromTo(stage, { alpha: 0.6 }, { alpha: 1, duration: 1.2, ease: 'power2.out' })
        break
      }

      case 'cascade': {
        // Auto-morph through lenses: shipping → freight → medicine → household
        if (prev !== 'cascade') {
          morphRef.current.autoMorph(1.5)
        }
        break
      }

      case 'yourMonth': {
        // Darken atmosphere — walls closing feeling
        if (atmosphereRef.current) {
          const vigGfx = atmosphereRef.current.vignetteGfx
          const w = appRef.current!.screen.width
          const h = appRef.current!.screen.height
          gsap.to({ intensity: 0.3 }, {
            intensity: 0.7,
            duration: 2,
            ease: 'power2.in',
            onUpdate: function () {
              drawVignette(vigGfx, w, h, this.targets()[0].intensity)
            },
          })
        }
        break
      }

      case 'split': {
        // Split transition handled by compareMode effect
        break
      }
    }
  }, [scene])

  // ── Perspective ──
  useEffect(() => {
    if (!morphRef.current) return
    morphRef.current.setPerspective(roleId)
  }, [roleId])

  useEffect(() => { renderersRef.current?.pulses.setSupplyLevel(supplyLevel) }, [supplyLevel])
  useEffect(() => { renderersRef.current?.margins.setErosion(erosionPct) }, [erosionPct])

  // ── Issue #5: Split world for what-if futures ──
  useEffect(() => {
    if (splitRef.current) {
      if (compareMode) {
        splitRef.current.setVisible(true)
        gsap.to({ split: 0 }, {
          split: 1,
          duration: 1.2,
          ease: 'power2.inOut',
          onUpdate: function () {
            splitRef.current?.setSplit(this.targets()[0].split)
          },
        })
      } else {
        gsap.to({ split: 1 }, {
          split: 0,
          duration: 0.8,
          ease: 'power2.inOut',
          onUpdate: function () {
            splitRef.current?.setSplit(this.targets()[0].split)
          },
          onComplete: () => {
            splitRef.current?.setVisible(false)
          },
        })
      }
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

/** Draw a radial vignette darkening the edges */
function drawVignette(gfx: PIXI.Graphics, w: number, h: number, intensity: number) {
  gfx.clear()
  const cx = w / 2
  const cy = h / 2
  const radius = Math.max(w, h) * 0.7
  const steps = 8
  for (let i = steps; i >= 0; i--) {
    const t = i / steps
    const r = radius * (0.5 + t * 0.5)
    const alpha = intensity * t * t * 0.4
    gfx.beginFill(0x000000, alpha)
    gfx.drawEllipse(cx, cy, r * (w / Math.max(w, h)), r * (h / Math.max(w, h)))
    gfx.endFill()
  }
}
