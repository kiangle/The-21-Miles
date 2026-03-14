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
import { SceneRecipeController } from './SceneRecipeController'
import { getAnchorProjector } from '../map/AnchorProjector'
import { resolveRecipe } from './SceneRecipe'
import type { SceneRecipe } from './SceneRecipe'
import { COLORS } from '../../app/config/constants'
import type { LensId, SceneId, TimeId, FutureId } from '../../state/machine/worldContext'

/**
 * PixiStage — the 2D living world.
 *
 * Reads projected anchors from the AnchorProjector (fed by MapLibre).
 * Only the layers required by the active SceneRecipe are alive and ticking.
 * Hard reset on every meaningful transition.
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

/**
 * Get positions from the AnchorProjector.
 * Falls back to screen-percentage positions if projector has no data yet.
 */
function getPositions(w: number, h: number): Record<string, { x: number; y: number }> {
  const projector = getAnchorProjector()
  const projected = projector.getAll()

  // If the projector has valid positions (non-zero), use them
  const mombasa = projected.mombasa
  if (mombasa && (mombasa.x !== 0 || mombasa.y !== 0)) {
    return projected
  }

  // Fallback: screen-percentage positions (temporary until map is ready)
  return {
    hormuz:     { x: w * 0.78, y: h * 0.17 },
    babElMandeb:{ x: w * 0.62, y: h * 0.27 },
    mombasa:    { x: w * 0.54, y: h * 0.48 },
    nairobi:    { x: w * 0.50, y: h * 0.43 },
    capeTown:   { x: w * 0.36, y: h * 0.72 },
    suez:       { x: w * 0.60, y: h * 0.14 },
    hospital:   { x: w * 0.47, y: h * 0.41 },
    market:     { x: w * 0.52, y: h * 0.52 },
    household1: { x: w * 0.48, y: h * 0.56 },
    household2: { x: w * 0.55, y: h * 0.55 },
    household3: { x: w * 0.45, y: h * 0.60 },
    corridorMid:{ x: w * 0.52, y: h * 0.45 },
    corridorQ1: { x: w * 0.53, y: h * 0.46 },
    corridorQ3: { x: w * 0.51, y: h * 0.44 },
  }
}

export default function PixiStage({
  scene, lens, time, future, roleId, compareMode,
  supplyLevel, erosionPct, visible,
}: PixiStageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<PIXI.Application | null>(null)
  const controllerRef = useRef<SceneRecipeController | null>(null)
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
  const prevRecipeRef = useRef<string>('')
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
    const POS = getPositions(w, h)

    // ── ONE shared Matter.js engine ──
    const engine = Matter.Engine.create({
      gravity: { x: 0, y: 0 },
      enableSleeping: true,
      positionIterations: 8,
      constraintIterations: 4,
    })
    engineRef.current = engine

    // ── Renderers ──
    const flowBands = new FlowBandRenderer(app.stage, engine)
    const congestion = new CongestionRenderer(app.stage, engine)
    const filaments = new FilamentRenderer(app.stage)
    const pulses = new PulseRenderer(app.stage, engine)
    const margins = new MarginRenderer(app.stage, engine)
    const split = new SplitFutureRenderer(app.stage, w, h)

    renderersRef.current = { flowBands, congestion, filaments, pulses, margins }
    splitRef.current = split

    // ── Set up renderer geometry using projected anchors ──
    setupRendererGeometry(flowBands, congestion, filaments, pulses, margins, POS, w, h)

    // ── SceneRecipeController — the single authority ──
    const controller = new SceneRecipeController(engine)
    controller.register('flowBands', {
      layerId: 'flowBands',
      setVisible: (v) => flowBands.setVisible(v),
      setAlpha: (a) => flowBands.setAlpha(a),
      setPressure: (p) => flowBands.setPressure(p),
      setPerspective: (pr) => flowBands.setPerspective(pr),
      reset: () => flowBands.reset(),
      update: (dt) => flowBands.update(dt),
    })
    controller.register('routes', {
      layerId: 'routes',
      setVisible: (v) => flowBands.setVisible(v),
      setAlpha: (a) => flowBands.setAlpha(a),
      setPressure: (p) => flowBands.setPressure(p),
      setPerspective: (pr) => flowBands.setPerspective(pr),
      reset: () => flowBands.reset(),
      update: (dt) => flowBands.update(dt),
    })
    controller.register('congestion', {
      layerId: 'congestion',
      setVisible: (v) => congestion.setVisible(v),
      setAlpha: (a) => congestion.setAlpha(a),
      setPressure: (p) => congestion.setPressure(p),
      setPerspective: (pr) => congestion.setPerspective(pr),
      reset: () => congestion.reset(),
      update: (dt) => congestion.update(dt),
    })
    controller.register('corridor', {
      layerId: 'corridor',
      setVisible: (v) => { congestion.setVisible(v); filaments.setVisible(v) },
      setAlpha: (a) => { congestion.setAlpha(a); filaments.setAlpha(a * 0.5) },
      setPressure: (p) => congestion.setPressure(p),
      setPerspective: (pr) => congestion.setPerspective(pr),
      reset: () => { congestion.reset(); filaments.reset() },
      update: (dt) => { congestion.update(dt); filaments.update(dt) },
    })
    controller.register('pulses', {
      layerId: 'pulses',
      setVisible: (v) => pulses.setVisible(v),
      setAlpha: (a) => pulses.setAlpha(a),
      setPressure: (p) => pulses.setPressure(p),
      setPerspective: (pr) => pulses.setPerspective(pr),
      reset: () => pulses.reset(),
      update: (dt) => pulses.update(dt),
    })
    controller.register('margins', {
      layerId: 'margins',
      setVisible: (v) => margins.setVisible(v),
      setAlpha: (a) => margins.setAlpha(a),
      setPressure: (p) => margins.setPressure(p),
      setPerspective: (pr) => margins.setPerspective(pr),
      reset: () => margins.reset(),
      update: (dt) => margins.update(dt),
    })
    controller.register('chokepoints', {
      layerId: 'chokepoints',
      setVisible: () => {},
      setAlpha: () => {},
      setPressure: () => {},
      setPerspective: () => {},
      reset: () => {},
      update: () => {},
    })
    controller.register('kenya_border', {
      layerId: 'kenya_border',
      setVisible: () => {},
      setAlpha: () => {},
      setPressure: () => {},
      setPerspective: () => {},
      reset: () => {},
      update: () => {},
    })
    // Chamber is handled separately by CompressionChamber overlay
    controller.register('chamber', {
      layerId: 'chamber',
      setVisible: () => {},
      setAlpha: () => {},
      setPressure: () => {},
      setPerspective: () => {},
      reset: () => {},
      update: () => {},
    })

    controllerRef.current = controller

    // Start with everything hidden — recipe will activate the right layers
    flowBands.setVisible(false)
    congestion.setVisible(false)
    filaments.setVisible(false)
    pulses.setVisible(false)
    margins.setVisible(false)

    // ── Atmospheric filters ──
    const noiseFilter = new NoiseFilter(0.04)
    const colorMatrix = new ColorMatrixFilter()
    app.stage.filters = [noiseFilter, colorMatrix]

    const vignetteGfx = new PIXI.Graphics()
    app.stage.addChild(vignetteGfx)
    drawVignette(vignetteGfx, w, h, 0.3)

    atmosphereRef.current = { noise: noiseFilter, colorMatrix, vignetteGfx }

    // ── Ticker — only active recipe layers tick ──
    app.ticker.add((delta) => {
      const dt = delta / 60
      if (controllerRef.current) {
        controllerRef.current.update(dt)
      }
      split.update()
      noiseFilter.seed = Math.random()
    })

    // ── Listen for anchor projection updates ──
    const projector = getAnchorProjector()
    const unsubscribe = projector.onUpdate(() => {
      if (!appRef.current || !renderersRef.current) return
      const newPOS = getPositions(appRef.current.screen.width, appRef.current.screen.height)
      // Re-setup renderer geometry with new projected positions
      setupRendererGeometry(
        renderersRef.current.flowBands,
        renderersRef.current.congestion,
        renderersRef.current.filaments,
        renderersRef.current.pulses,
        renderersRef.current.margins,
        newPOS,
        appRef.current.screen.width,
        appRef.current.screen.height,
      )
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    let cleanup: (() => void) | undefined
    initPixi().then(unsub => { cleanup = unsub })
    return () => {
      cleanup?.()
      if (appRef.current) {
        appRef.current.destroy(true, { children: true })
        appRef.current = null
      }
      if (engineRef.current) {
        Matter.Engine.clear(engineRef.current)
        engineRef.current = null
      }
      if (controllerRef.current) {
        controllerRef.current.dispose()
        controllerRef.current = null
      }
    }
  }, [initPixi])

  // ── Recipe resolution: scene + role + time → recipe → apply ──
  useEffect(() => {
    if (!controllerRef.current) return
    const landedScenes = ['baseline', 'rupture', 'detour', 'cascade', 'yourMonth', 'whatNext', 'split']
    if (!landedScenes.includes(scene)) return

    const recipe = resolveRecipe(scene, roleId, time as any)

    // Only apply if this is a meaningful change
    if (recipe.id === prevRecipeRef.current) return
    prevRecipeRef.current = recipe.id

    controllerRef.current.applyRecipe(recipe)

    // Scene choreography
    applySceneChoreography(scene, appRef.current, atmosphereRef.current)
  }, [scene, roleId, time, lens])

  // ── Pressure from time + future ──
  useEffect(() => {
    if (!controllerRef.current) return

    const targetPressure = TIME_PRESSURE[time] * FUTURE_PRESSURE[future]

    if (pressureTweenRef.current) {
      pressureTweenRef.current.kill()
    }

    pressureTweenRef.current = gsap.to(pressureRef.current, {
      value: targetPressure,
      duration: 1.5,
      ease: 'power2.inOut',
      onUpdate: () => {
        controllerRef.current?.setPressure(pressureRef.current.value)

        // Set constriction on flowBands if they're active
        if (renderersRef.current && pressureRef.current.value > 0.3 && future !== 'closureEnds') {
          renderersRef.current.flowBands.setConstricted(true)
        }
      },
    })

    // Atmospheric shift
    if (atmosphereRef.current) {
      const atm = atmosphereRef.current
      gsap.to(atm.noise, {
        noise: 0.03 + targetPressure * 0.06,
        duration: 1.5,
        ease: 'power2.inOut',
      })
      const redShift = targetPressure * 0.15
      atm.colorMatrix.reset()
      if (redShift > 0.02) {
        atm.colorMatrix.matrix[0] = 1 + redShift
        atm.colorMatrix.matrix[6] = 1 - redShift * 0.3
        atm.colorMatrix.matrix[12] = 1 - redShift * 0.5
      }
    }
  }, [time, future])

  // ── Supply level + erosion ──
  useEffect(() => { renderersRef.current?.pulses.setSupplyLevel(supplyLevel) }, [supplyLevel])
  useEffect(() => { renderersRef.current?.margins.setErosion(erosionPct) }, [erosionPct])

  // ── Split world for compare mode ──
  useEffect(() => {
    if (splitRef.current) {
      if (compareMode) {
        splitRef.current.setVisible(true)
        gsap.to({ split: 0 }, {
          split: 1, duration: 1.2, ease: 'power2.inOut',
          onUpdate: function () { splitRef.current?.setSplit(this.targets()[0].split) },
        })
      } else {
        gsap.to({ split: 1 }, {
          split: 0, duration: 0.8, ease: 'power2.inOut',
          onUpdate: function () { splitRef.current?.setSplit(this.targets()[0].split) },
          onComplete: () => { splitRef.current?.setVisible(false) },
        })
      }
    }
  }, [compareMode])

  return (
    <div ref={containerRef} style={{
      position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
      zIndex: 3, pointerEvents: 'none',
      opacity: visible ? 1 : 0, transition: 'opacity 1s ease',
    }} />
  )
}

/** Set up all renderer geometry from anchor positions. */
function setupRendererGeometry(
  flowBands: FlowBandRenderer,
  congestion: CongestionRenderer,
  filaments: FilamentRenderer,
  pulses: PulseRenderer,
  margins: MarginRenderer,
  POS: Record<string, { x: number; y: number }>,
  w: number,
  _h: number,
) {
  // Clear existing geometry before re-setup
  flowBands.clear()
  congestion.clear()
  filaments.clear()
  pulses.clear()
  margins.clear()

  // ── SHIPPING: flow lanes ──
  if (POS.hormuz && POS.babElMandeb && POS.mombasa && POS.capeTown && POS.suez && POS.nairobi) {
    flowBands.addBand(
      [POS.hormuz, { x: (POS.hormuz.x + POS.babElMandeb.x) / 2, y: (POS.hormuz.y + POS.babElMandeb.y) / 2 }, POS.babElMandeb, { x: (POS.babElMandeb.x + POS.mombasa.x) / 2, y: (POS.babElMandeb.y + POS.mombasa.y) / 2 }, POS.mombasa],
      0, COLORS.shipping, 4, false,
    )
    flowBands.addBand(
      [POS.capeTown, { x: (POS.capeTown.x + POS.mombasa.x) * 0.4, y: (POS.capeTown.y + POS.mombasa.y) * 0.5 }, { x: (POS.capeTown.x + POS.mombasa.x) * 0.47, y: (POS.capeTown.y + POS.mombasa.y) * 0.48 }, POS.mombasa],
      0, '#D4763C', 3, true,
    )
    flowBands.addBand([POS.suez, POS.babElMandeb], 0, '#5BA3CF', 3, false)
    flowBands.addBand(
      [POS.mombasa, { x: (POS.mombasa.x + POS.nairobi.x) / 2, y: (POS.mombasa.y + POS.nairobi.y) / 2 }, POS.nairobi],
      0, COLORS.household, 2.5, false,
    )
    flowBands.setAnchors(POS.hormuz, POS.mombasa)
    flowBands.initPhysics()
  }

  // ── FREIGHT: corridor ──
  if (POS.mombasa && POS.nairobi) {
    const mid = POS.corridorMid || { x: (POS.mombasa.x + POS.nairobi.x) / 2, y: (POS.mombasa.y + POS.nairobi.y) / 2 }
    congestion.setCorridor([POS.mombasa, mid, POS.nairobi])
  }

  // ── MEDICINE: supply path ──
  if (POS.mombasa && POS.nairobi && POS.hospital) {
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
  }

  // ── FOOD: distribution ──
  if (POS.mombasa && POS.market && POS.nairobi && POS.hospital && POS.household1 && POS.household2 && POS.household3) {
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
  }
}

/** Apply GSAP choreography for scene transitions. */
function applySceneChoreography(
  scene: SceneId,
  app: PIXI.Application | null,
  atmosphere: { noise: NoiseFilter; colorMatrix: ColorMatrixFilter; vignetteGfx: PIXI.Graphics } | null,
) {
  if (!app) return
  const stage = app.stage

  switch (scene) {
    case 'rupture': {
      const original = { x: stage.position.x, y: stage.position.y }
      gsap.timeline()
        .to(stage.position, { x: original.x + 6, y: original.y - 3, duration: 0.05 })
        .to(stage.position, { x: original.x - 5, y: original.y + 4, duration: 0.05 })
        .to(stage.position, { x: original.x + 3, y: original.y - 2, duration: 0.05 })
        .to(stage.position, { x: original.x - 4, y: original.y + 3, duration: 0.05 })
        .to(stage.position, { x: original.x + 2, y: original.y - 1, duration: 0.05 })
        .to(stage.position, { x: original.x, y: original.y, duration: 0.15, ease: 'power2.out' })

      if (atmosphere) {
        const cm = atmosphere.colorMatrix
        gsap.fromTo(
          { brightness: 2 }, { brightness: 2 },
          {
            brightness: 1, duration: 0.6, ease: 'power3.out',
            onUpdate: function () {
              cm.reset()
              cm.brightness(this.targets()[0].brightness, false)
            },
          },
        )
      }
      break
    }

    case 'detour': {
      gsap.fromTo(stage, { alpha: 0.6 }, { alpha: 1, duration: 1.2, ease: 'power2.out' })
      break
    }

    case 'yourMonth': {
      if (atmosphere) {
        const vigGfx = atmosphere.vignetteGfx
        const w = app.screen.width
        const h = app.screen.height
        gsap.to({ intensity: 0.3 }, {
          intensity: 0.7, duration: 2, ease: 'power2.in',
          onUpdate: function () {
            drawVignette(vigGfx, w, h, this.targets()[0].intensity)
          },
        })
      }
      break
    }
  }
}

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
