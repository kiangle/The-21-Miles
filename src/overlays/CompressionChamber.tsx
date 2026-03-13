import React, { useEffect, useRef } from 'react'
import * as PIXI from 'pixi.js'
import Matter from 'matter-js'
import { COLORS } from '../app/config/constants'
import type { HouseholdImpactResponse } from '../atlas/types'
import type { FutureId } from '../state/machine/worldContext'

/**
 * CompressionChamber — "Your month"
 *
 * Budget is a physical space. Walls close in as costs arrive.
 * Token bodies (food, fuel, medicine, rent) compete for room.
 * What's left at the end is what you have to live on.
 *
 * Matter.js drives the physical squeeze.
 * Pixi.js renders the visible compression.
 * Serious. Physical. Not playful.
 */

interface Props {
  impact: HouseholdImpactResponse | null
  visible: boolean
  currency: string
  future: FutureId
}

// Token categories with colors
const TOKEN_DEFS = [
  { id: 'food', label: 'food', color: 0xD4763C, count: 5 },
  { id: 'fuel', label: 'fuel', color: 0xE8B94A, count: 4 },
  { id: 'medicine', label: 'medicine', color: 0xC44B3F, count: 3 },
  { id: 'rent', label: 'rent', color: 0x8A8680, count: 4 },
] as const

const FUTURE_CHAMBER_MOD: Record<FutureId, number> = {
  baseline: 1.0,
  redSea: 1.3,
  reserves: 0.7,
  closureEnds: 0.5,
}

export default function CompressionChamber({ impact, visible, currency, future }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<PIXI.Application | null>(null)
  const matterRef = useRef<{
    engine: Matter.Engine
    walls: { top: Matter.Body; right: Matter.Body; bottom: Matter.Body; left: Matter.Body }
    tokens: { body: Matter.Body; cat: string; color: number }[]
  } | null>(null)
  const animRef = useRef<boolean>(false)

  useEffect(() => {
    if (!visible || !impact || !containerRef.current) return
    if (appRef.current) return // already mounted

    const size = 280
    const padding = 30

    // ── Pixi application ──
    const app = new PIXI.Application({
      width: size,
      height: size,
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio, 2),
      autoDensity: true,
    })
    containerRef.current.appendChild(app.view as HTMLCanvasElement)
    appRef.current = app

    // ── Matter engine ──
    const engine = Matter.Engine.create({
      gravity: { x: 0, y: 0.3 },
      enableSleeping: false,
    })

    const chamberSize = size - padding * 2
    const wallThickness = 8

    // Chamber walls (static bodies) — will animate inward
    const top = Matter.Bodies.rectangle(size / 2, padding - wallThickness / 2, chamberSize + wallThickness * 2, wallThickness, { isStatic: true })
    const right = Matter.Bodies.rectangle(size - padding + wallThickness / 2, size / 2, wallThickness, chamberSize + wallThickness * 2, { isStatic: true })
    const bottom = Matter.Bodies.rectangle(size / 2, size - padding + wallThickness / 2, chamberSize + wallThickness * 2, wallThickness, { isStatic: true })
    const left = Matter.Bodies.rectangle(padding - wallThickness / 2, size / 2, wallThickness, chamberSize + wallThickness * 2, { isStatic: true })

    Matter.Composite.add(engine.world, [top, right, bottom, left])

    // ── Token bodies ──
    const tokens: { body: Matter.Body; cat: string; color: number }[] = []
    const cx = size / 2
    const cy = size / 2

    for (const def of TOKEN_DEFS) {
      for (let i = 0; i < def.count; i++) {
        const radius = 6 + Math.random() * 4
        const body = Matter.Bodies.circle(
          cx + (Math.random() - 0.5) * chamberSize * 0.5,
          cy + (Math.random() - 0.5) * chamberSize * 0.5,
          radius,
          {
            density: 0.002,
            frictionAir: 0.02,
            restitution: 0.4,
            friction: 0.1,
            label: def.id,
          },
        )
        Matter.Composite.add(engine.world, body)
        tokens.push({ body, cat: def.id, color: def.color })
      }
    }

    matterRef.current = { engine, walls: { top, right, bottom, left }, tokens }

    // ── Calculate insets from impact ──
    const cats = ['fuel', 'heating', 'food', 'transport'] as const
    let totalHit = 0
    const insets: Record<string, number> = {}
    for (const cat of cats) {
      const imp = impact.impacts[cat]
      if (imp) {
        const increase = imp.post_base - imp.pre
        const pct = increase / impact.baseline_income
        insets[cat] = pct
        totalHit += increase
      }
    }
    const totalPct = totalHit / impact.baseline_income
    const futureMod = FUTURE_CHAMBER_MOD[future]

    // ── Pixi rendering layers ──
    const chamberOutline = new PIXI.Graphics()
    const tokenGfx = new PIXI.Graphics()
    const wallGfx = new PIXI.Graphics()
    const textLayer = new PIXI.Container()
    app.stage.addChild(chamberOutline)
    app.stage.addChild(wallGfx)
    app.stage.addChild(tokenGfx)
    app.stage.addChild(textLayer)

    // Initial chamber outline (dashed feel)
    chamberOutline.lineStyle(0.5, PIXI.utils.string2hex(COLORS.textSecondary), 0.3)
    chamberOutline.drawRect(padding, padding, chamberSize, chamberSize)

    // ── Animate walls inward over time ──
    let elapsed = 0
    const wallTargets = {
      top: (insets.fuel || 0) * chamberSize * futureMod,
      right: (insets.food || 0) * chamberSize * futureMod,
      bottom: (insets.heating || 0) * chamberSize * futureMod,
      left: (insets.transport || 0) * chamberSize * futureMod,
    }

    // Text elements — added after walls animate
    let textAdded = false

    animRef.current = true

    app.ticker.add(() => {
      elapsed += app.ticker.deltaMS / 1000
      Matter.Engine.update(engine, 16)

      // Animate walls closing (staggered, over 3 seconds)
      const wallProgress = Math.min(1, Math.max(0, (elapsed - 0.5) / 2.5))
      const ease = wallProgress * (2 - wallProgress) // ease out

      const topInset = wallTargets.top * ease
      const rightInset = wallTargets.right * ease
      const bottomInset = wallTargets.bottom * ease
      const leftInset = wallTargets.left * ease

      // Move Matter walls
      Matter.Body.setPosition(top, { x: size / 2, y: padding + topInset / 2 })
      Matter.Body.setPosition(right, { x: size - padding - rightInset / 2, y: size / 2 })
      Matter.Body.setPosition(bottom, { x: size / 2, y: size - padding - bottomInset / 2 })
      Matter.Body.setPosition(left, { x: padding + leftInset / 2, y: size / 2 })

      // ── Render walls ──
      wallGfx.clear()
      // Top wall (fuel)
      wallGfx.beginFill(0xE8B94A, 0.6)
      wallGfx.drawRect(padding, padding, chamberSize, wallThickness + topInset)
      wallGfx.endFill()
      // Right wall (food)
      wallGfx.beginFill(0xD4763C, 0.6)
      wallGfx.drawRect(size - padding - wallThickness - rightInset, padding, wallThickness + rightInset, chamberSize)
      wallGfx.endFill()
      // Bottom wall (heating)
      wallGfx.beginFill(0xC44B3F, 0.6)
      wallGfx.drawRect(padding, size - padding - wallThickness - bottomInset, chamberSize, wallThickness + bottomInset)
      wallGfx.endFill()
      // Left wall (transport)
      wallGfx.beginFill(0xC8A96E, 0.6)
      wallGfx.drawRect(padding, padding, wallThickness + leftInset, chamberSize)
      wallGfx.endFill()

      // Pressure glow on walls
      if (wallProgress > 0.5) {
        const glowAlpha = (wallProgress - 0.5) * 0.3
        wallGfx.lineStyle(2, 0xFF3333, glowAlpha)
        wallGfx.drawRect(
          padding + leftInset + wallThickness,
          padding + topInset + wallThickness,
          chamberSize - leftInset - rightInset - wallThickness * 2,
          chamberSize - topInset - bottomInset - wallThickness * 2,
        )
      }

      // ── Render tokens ──
      tokenGfx.clear()
      for (const token of tokens) {
        const bx = token.body.position.x
        const by = token.body.position.y
        const rad = (token.body as any).circleRadius || 8

        // Token circle
        tokenGfx.beginFill(token.color, 0.7)
        tokenGfx.drawCircle(bx, by, rad)
        tokenGfx.endFill()

        // Pressure indicator: squeezed tokens get brighter border
        const speed = Math.sqrt(token.body.velocity.x ** 2 + token.body.velocity.y ** 2)
        if (speed > 1) {
          tokenGfx.lineStyle(1, 0xFFFFFF, Math.min(0.5, speed * 0.1))
          tokenGfx.drawCircle(bx, by, rad + 1)
          tokenGfx.lineStyle(0)
        }
      }

      // ── Add central text after animation ──
      if (!textAdded && elapsed > 3.5) {
        textAdded = true

        const hitText = new PIXI.Text(`${currency} ${totalHit.toLocaleString()}`, {
          fontFamily: "'Instrument Serif', Georgia, serif",
          fontSize: 26,
          fontWeight: 'bold',
          fill: COLORS.textPrimary,
        })
        hitText.anchor.set(0.5, 0.5)
        hitText.position.set(size / 2, size / 2 - 12)
        hitText.alpha = 0
        textLayer.addChild(hitText)

        const subText = new PIXI.Text('extra this month', {
          fontFamily: "'Instrument Sans', system-ui, sans-serif",
          fontSize: 12,
          fill: COLORS.textSecondary,
        })
        subText.anchor.set(0.5, 0.5)
        subText.position.set(size / 2, size / 2 + 10)
        subText.alpha = 0
        textLayer.addChild(subText)

        const pctText = new PIXI.Text(`${Math.round(totalPct * 100)}% of income`, {
          fontFamily: "'Instrument Sans', system-ui, sans-serif",
          fontSize: 13,
          fill: COLORS.danger,
        })
        pctText.anchor.set(0.5, 0.5)
        pctText.position.set(size / 2, size / 2 + 30)
        pctText.alpha = 0
        textLayer.addChild(pctText)

        // Fade in
        const fadeIn = () => {
          for (const child of textLayer.children) {
            if (child.alpha < 1) (child as PIXI.Text).alpha += 0.02
          }
        }
        app.ticker.add(fadeIn)
      }
    })

    return () => {
      animRef.current = false
      app.destroy(true, { children: true })
      appRef.current = null
      Matter.Engine.clear(engine)
      matterRef.current = null
    }
  }, [visible, impact, currency, future])

  if (!visible || !impact) return null

  return (
    <div style={{
      position: 'absolute',
      bottom: 100,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 20,
    }}>
      <div ref={containerRef} />
      <div style={{
        textAlign: 'center',
        marginTop: 8,
        color: COLORS.textSecondary,
        fontSize: 11,
        fontFamily: "'Instrument Sans', system-ui, sans-serif",
      }}>
        Updated {getTimeSince(impact.as_of_date)}
      </div>
    </div>
  )
}

function getTimeSince(dateStr: string): string {
  const then = new Date(dateStr).getTime()
  const now = Date.now()
  const hours = Math.floor((now - then) / (1000 * 60 * 60))
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours} hours ago`
  return `${Math.floor(hours / 24)} days ago`
}
