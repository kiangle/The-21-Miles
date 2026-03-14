import React, { useEffect, useRef, useCallback } from 'react'
import * as PIXI from 'pixi.js'
import { NoiseFilter } from '@pixi/filter-noise'
import { ColorMatrixFilter } from '@pixi/filter-color-matrix'
import Matter from 'matter-js'
import gsap from 'gsap'
import { SceneRecipeController } from './SceneRecipeController'
import type { SceneCtx } from './SceneRecipeController'
import { getAnchorProjector } from '../map/AnchorProjector'
import { resolveRecipe } from './SceneRecipe'
import type { SceneRecipe } from './SceneRecipe'
import { MedicineScene } from './recipes/MedicineScene'
import { FreightScene } from './recipes/FreightScene'
import { MonthScene } from './recipes/MonthScene'
import { ShippingScene } from './recipes/ShippingScene'
import type { SceneId, TimeId, FutureId } from '../../state/machine/worldContext'

/**
 * PixiStage — the 2D living world.
 *
 * Reads projected anchors from AnchorProjector (fed by MapLibre).
 * Only the scene required by the active recipe is alive and ticking.
 * No computePositions. No screen-percentage geography.
 * No always-on renderer soup.
 */

interface PixiStageProps {
  scene: SceneId
  lens: string
  time: TimeId
  future: FutureId
  roleId: 'nurse' | 'driver' | null
  compareMode: boolean
  supplyLevel: number
  erosionPct: number
  visible: boolean
  activeRecipe?: SceneRecipe | null
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

/** Scene factory: recipe → ActiveScene. */
function createScene(recipe: SceneRecipe, ctx: SceneCtx) {
  // Only create scenes for landed recipes that need Pixi/Matter
  if (recipe.phase !== 'landed') return null

  switch (recipe.actorMode) {
    case 'ships':
      return new ShippingScene(recipe, ctx)
    case 'medicine':
      return new MedicineScene(recipe, ctx)
    case 'convoys':
      return new FreightScene(recipe, ctx)
    case 'chamber':
      return new MonthScene(recipe, ctx)
    default:
      return null
  }
}

export default function PixiStage({
  scene, lens, time, future, roleId,
  visible, activeRecipe: activeRecipeProp,
}: PixiStageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<PIXI.Application | null>(null)
  const controllerRef = useRef<SceneRecipeController | null>(null)
  const engineRef = useRef<Matter.Engine | null>(null)
  const prevRecipeRef = useRef<string>('')
  const atmosphereRef = useRef<{
    noise: NoiseFilter
    colorMatrix: ColorMatrixFilter
    vignetteGfx: PIXI.Graphics
  } | null>(null)

  const initPixi = useCallback(() => {
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

    // ── Shared Matter engine ──
    const engine = Matter.Engine.create({
      gravity: { x: 0, y: 0 },
      enableSleeping: true,
      positionIterations: 8,
      constraintIterations: 4,
    })
    engineRef.current = engine

    // ── Recipe controller ──
    const controller = new SceneRecipeController(createScene)
    controllerRef.current = controller

    // ── Atmospheric filters ──
    const noiseFilter = new NoiseFilter(0.04)
    const colorMatrix = new ColorMatrixFilter()
    app.stage.filters = [noiseFilter, colorMatrix]

    const vignetteGfx = new PIXI.Graphics()
    app.stage.addChild(vignetteGfx)
    drawVignette(vignetteGfx, app.screen.width, app.screen.height, 0.3)

    atmosphereRef.current = { noise: noiseFilter, colorMatrix, vignetteGfx }

    // ── Ticker: only active recipe ticks ──
    app.ticker.add((delta) => {
      const dt = delta / 60
      controller.update(dt)
      noiseFilter.seed = Math.random()
    })
  }, [])

  useEffect(() => {
    initPixi()
    return () => {
      controllerRef.current?.dispose()
      controllerRef.current = null
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

  // ── Recipe resolution: scene + role + time → recipe → apply ──
  useEffect(() => {
    if (!controllerRef.current || !appRef.current || !engineRef.current) return

    const projector = getAnchorProjector()

    // Use activeRecipe from Shell when available, otherwise resolve
    const recipe = activeRecipeProp ?? resolveRecipe(scene, roleId, time as any)
    if (recipe.phase === 'landed' && !projector.ready) return
    if (recipe.id === prevRecipeRef.current) return
    prevRecipeRef.current = recipe.id

    const ctx: SceneCtx = {
      app: appRef.current,
      matterEngine: engineRef.current,
      anchors: projector.getAll(),
    }

    controllerRef.current.apply(recipe, ctx)

    // Scene choreography
    applySceneChoreography(scene, appRef.current, atmosphereRef.current)
  }, [scene, roleId, time, lens, activeRecipeProp])

  // ── Re-apply recipe when anchors update (map camera moves) ──
  useEffect(() => {
    const projector = getAnchorProjector()
    const unsub = projector.onUpdate(() => {
      if (!controllerRef.current || !appRef.current || !engineRef.current) return
      const recipe = activeRecipeProp ?? resolveRecipe(scene, roleId, time as any)
      if (recipe.phase !== 'landed') return
      // Always rebuild with fresh anchors — even if recipe ID is the same,
      // the projected positions have changed and the scene must update.
      prevRecipeRef.current = recipe.id
      const ctx: SceneCtx = {
        app: appRef.current,
        matterEngine: engineRef.current,
        anchors: projector.getAll(),
      }
      controllerRef.current.forceApply(recipe, ctx)
    })
    return unsub
  }, [scene, roleId, time, activeRecipeProp])

  // ── Pressure from time + future ──
  useEffect(() => {
    if (!atmosphereRef.current) return
    const targetPressure = TIME_PRESSURE[time] * FUTURE_PRESSURE[future]
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
  }, [time, future])

  return (
    <div ref={containerRef} style={{
      position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
      zIndex: 3, pointerEvents: 'none',
      opacity: visible ? 1 : 0, transition: 'opacity 1s ease',
    }} />
  )
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
