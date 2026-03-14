import React, { useEffect, useRef } from 'react'
import * as PIXI from 'pixi.js'
import Matter from 'matter-js'
import { COLORS } from '../app/config/constants'
import type { HouseholdImpactResponse } from '../atlas/types'
import type { FutureId } from '../state/machine/worldContext'

/**
 * CompressionChamber — "Your month" — HERO PAYOFF SCENE.
 *
 * Human question: What did this do to a family's month?
 *
 * Budget is a physical space. Walls close in as costs arrive.
 * Token bodies (food, fuel, medicine, rent, transport) compete for room.
 * What's left at the end is what you have to live on.
 *
 * This must be one of the STRONGEST moments in the app.
 * - Larger (480px), centered, dominant
 * - Bigger tokens — clearly readable categories
 * - Wall squeeze is physically dramatic
 * - Monthly hit number appears as climax
 * - Serious, physical, NOT playful
 *
 * Matter.js drives the physical squeeze.
 * Pixi.js renders the visible compression.
 */

interface Props {
  impact: HouseholdImpactResponse | null
  visible: boolean
  currency: string
  future: FutureId
}

// Bigger tokens — heavier categories get bigger bodies. Restrained, serious palette.
const TOKEN_DEFS = [
  { id: 'food', label: 'food', color: 0xd5a061, count: 5, radius: 18 },
  { id: 'fuel', label: 'fuel', color: 0xb8894d, count: 4, radius: 14 },
  { id: 'medicine', label: 'medicine', color: 0xc06b77, count: 3, radius: 10 },
  { id: 'rent', label: 'rent', color: 0x6b687a, count: 4, radius: 16 },
  { id: 'transport', label: 'transport', color: 0x8c7259, count: 3, radius: 12 },
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
  const animRef = useRef<boolean>(false)

  useEffect(() => {
    if (!visible || !impact || !containerRef.current) return
    if (appRef.current) return

    const isMobile = window.innerWidth < 640
    const size = isMobile ? Math.min(320, window.innerWidth - 32) : 480
    const padding = isMobile ? 24 : 40

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
      gravity: { x: 0, y: 0.5 },
      enableSleeping: false,
    })

    const chamberSize = size - padding * 2
    const wallThickness = 12

    // Chamber walls
    const top = Matter.Bodies.rectangle(size / 2, padding - wallThickness / 2, chamberSize + wallThickness * 2, wallThickness, { isStatic: true })
    const right = Matter.Bodies.rectangle(size - padding + wallThickness / 2, size / 2, wallThickness, chamberSize + wallThickness * 2, { isStatic: true })
    const bottom = Matter.Bodies.rectangle(size / 2, size - padding + wallThickness / 2, chamberSize + wallThickness * 2, wallThickness, { isStatic: true })
    const left = Matter.Bodies.rectangle(padding - wallThickness / 2, size / 2, wallThickness, chamberSize + wallThickness * 2, { isStatic: true })

    Matter.Composite.add(engine.world, [top, right, bottom, left])

    // ── Token bodies — BIGGER, category-weighted ──
    const tokens: { body: Matter.Body; cat: string; color: number; label: string }[] = []
    const cx = size / 2
    const cy = size / 2

    for (const def of TOKEN_DEFS) {
      for (let i = 0; i < def.count; i++) {
        const radius = def.radius + (Math.random() - 0.5) * 5
        const body = Matter.Bodies.circle(
          cx + (Math.random() - 0.5) * chamberSize * 0.4,
          cy + (Math.random() - 0.5) * chamberSize * 0.4,
          radius,
          {
            density: 0.004,
            frictionAir: 0.012,
            restitution: 0.4,
            friction: 0.12,
            label: def.id,
          },
        )
        Matter.Composite.add(engine.world, body)
        tokens.push({ body, cat: def.id, color: def.color, label: def.label })
      }
    }

    // ── Calculate wall insets from Atlas impact data ──
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
    const wallGfx = new PIXI.Graphics()
    const shadowGfx = new PIXI.Graphics()
    const tokenGfx = new PIXI.Graphics()
    const labelGfx = new PIXI.Graphics()
    const textLayer = new PIXI.Container()
    app.stage.addChild(chamberOutline)
    app.stage.addChild(shadowGfx)
    app.stage.addChild(wallGfx)
    app.stage.addChild(tokenGfx)
    app.stage.addChild(labelGfx)
    app.stage.addChild(textLayer)

    // Initial chamber outline
    chamberOutline.lineStyle(0.6, PIXI.utils.string2hex(COLORS.textSecondary), 0.25)
    chamberOutline.drawRoundedRect(padding, padding, chamberSize, chamberSize, 4)

    // ── Wall targets — driven by Atlas impact categories ──
    const wallTargets = {
      top: Math.min(0.35, (insets.fuel || 0)) * chamberSize * futureMod,
      right: Math.min(0.35, (insets.food || 0)) * chamberSize * futureMod,
      bottom: Math.min(0.35, (insets.heating || 0)) * chamberSize * futureMod,
      left: Math.min(0.35, (insets.transport || 0)) * chamberSize * futureMod,
    }

    // Wall colors — muted, serious, category-coded
    const wallColors = {
      top: 0x9A7D50,    // fuel
      right: 0x8B5A3A,  // food
      bottom: 0x6B3535,  // heating
      left: 0x7A7060,   // transport
    }

    let elapsed = 0
    let textAdded = false
    animRef.current = true

    app.ticker.add(() => {
      elapsed += app.ticker.deltaMS / 1000
      Matter.Engine.update(engine, 16)

      // ── Animate walls closing — staggered over 3.5 seconds ──
      const wallProgress = Math.min(1, Math.max(0, (elapsed - 0.5) / 3.0))
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

      // Inner chamber bounds
      const innerX = padding + leftInset + wallThickness
      const innerY = padding + topInset + wallThickness
      const innerW = chamberSize - leftInset - rightInset - wallThickness * 2
      const innerH = chamberSize - topInset - bottomInset - wallThickness * 2

      // ── Inner shadow / pressure darkness ──
      shadowGfx.clear()
      if (wallProgress > 0.15) {
        const shadowAlpha = (wallProgress - 0.15) * 0.15
        for (let layer = 0; layer < 5; layer++) {
          const spread = (5 - layer) * 7
          const a = shadowAlpha * (layer + 1) * 0.2
          shadowGfx.beginFill(0x000000, a)
          shadowGfx.drawRect(
            innerX - spread, innerY - spread,
            innerW + spread * 2, innerH + spread * 2,
          )
          shadowGfx.endFill()
        }
      }

      // ── Render walls — category-colored bands showing costs ──
      wallGfx.clear()
      // Top wall (fuel)
      wallGfx.beginFill(wallColors.top, 0.55)
      wallGfx.drawRect(padding, padding, chamberSize, wallThickness + topInset)
      wallGfx.endFill()
      // Right wall (food)
      wallGfx.beginFill(wallColors.right, 0.55)
      wallGfx.drawRect(size - padding - wallThickness - rightInset, padding, wallThickness + rightInset, chamberSize)
      wallGfx.endFill()
      // Bottom wall (heating)
      wallGfx.beginFill(wallColors.bottom, 0.55)
      wallGfx.drawRect(padding, size - padding - wallThickness - bottomInset, chamberSize, wallThickness + bottomInset)
      wallGfx.endFill()
      // Left wall (transport)
      wallGfx.beginFill(wallColors.left, 0.55)
      wallGfx.drawRect(padding, padding, wallThickness + leftInset, chamberSize)
      wallGfx.endFill()

      // Pressure bloom at walls — red inner glow when squeezed
      if (wallProgress > 0.4) {
        const bloomAlpha = (wallProgress - 0.4) * 0.2
        for (let i = 4; i >= 0; i--) {
          const spread = i * 4
          wallGfx.lineStyle(2.5 + i, 0xCC4444, bloomAlpha * (5 - i) * 0.2)
          wallGfx.drawRoundedRect(
            innerX - spread, innerY - spread,
            innerW + spread * 2, innerH + spread * 2, 2,
          )
        }
        wallGfx.lineStyle(0)
      }

      // ── Render tokens — physics-driven competition for space ──
      tokenGfx.clear()
      labelGfx.clear()

      // First pass: inter-token collision stress lines
      for (let a = 0; a < tokens.length; a++) {
        const ta = tokens[a]
        const ax = ta.body.position.x
        const ay = ta.body.position.y
        const ar = (ta.body as any).circleRadius || 12
        for (let b = a + 1; b < tokens.length; b++) {
          const tb = tokens[b]
          const bxx = tb.body.position.x
          const byy = tb.body.position.y
          const br = (tb.body as any).circleRadius || 12
          const dx = bxx - ax
          const dy = byy - ay
          const dist = Math.sqrt(dx * dx + dy * dy)
          const overlap = (ar + br) - dist
          if (overlap > -3 && dist > 0) {
            const contactAlpha = Math.min(0.22, Math.max(0, overlap + 3) * 0.04)
            if (contactAlpha > 0.02) {
              tokenGfx.lineStyle(1, 0xFFFFFF, contactAlpha)
              tokenGfx.moveTo(ax, ay)
              tokenGfx.lineTo(bxx, byy)
              tokenGfx.lineStyle(0)
            }
          }
        }
      }

      // Second pass: token bodies with squeeze effects
      for (const token of tokens) {
        const bx = token.body.position.x
        const by = token.body.position.y
        const rad = (token.body as any).circleRadius || 12
        const speed = Math.sqrt(token.body.velocity.x ** 2 + token.body.velocity.y ** 2)

        // Wall proximity
        const wallDist = Math.min(bx - innerX, innerX + innerW - bx, by - innerY, innerY + innerH - by)
        const wallProximity = Math.max(0, 1 - wallDist / 35)

        // Collision bloom — bigger when near walls or moving fast
        const bloomA = Math.min(0.28, speed * 0.04 + wallProximity * 0.14)
        if (bloomA > 0.02) {
          tokenGfx.beginFill(token.color, bloomA)
          tokenGfx.drawCircle(bx, by, rad * 1.7)
          tokenGfx.endFill()
        }

        // Main token body — solid, readable
        const mainAlpha = 0.65 + wallProximity * 0.25
        tokenGfx.beginFill(token.color, mainAlpha)
        tokenGfx.drawCircle(bx, by, rad)
        tokenGfx.endFill()

        // Inner highlight — gives depth
        tokenGfx.beginFill(0xFFFFFF, 0.06)
        tokenGfx.drawCircle(bx - rad * 0.2, by - rad * 0.2, rad * 0.5)
        tokenGfx.endFill()

        // Wall contact glow — red stress ring
        if (wallProximity > 0.5) {
          const contactA = (wallProximity - 0.5) * 0.45
          tokenGfx.lineStyle(2, 0xCC4444, contactA)
          tokenGfx.drawCircle(bx, by, rad + 2)
          tokenGfx.lineStyle(0)
        }

        // Speed ring — visible collision energy
        if (speed > 2.0) {
          tokenGfx.lineStyle(1, 0xFFFFFF, Math.min(0.3, speed * 0.05))
          tokenGfx.drawCircle(bx, by, rad + 3)
          tokenGfx.lineStyle(0)
        }
      }

      // ── Central text — monthly hit number as CLIMAX ──
      if (!textAdded && elapsed > 4.0) {
        textAdded = true

        // Main hit number — LARGE, serif
        const hitText = new PIXI.Text(`${currency} ${totalHit.toLocaleString()}`, {
          fontFamily: "'Instrument Serif', Georgia, serif",
          fontSize: isMobile ? 26 : 36,
          fontWeight: 'bold',
          fill: COLORS.textPrimary,
        })
        hitText.anchor.set(0.5, 0.5)
        hitText.position.set(size / 2, size / 2 - 18)
        hitText.alpha = 0
        textLayer.addChild(hitText)

        // Subtitle
        const subText = new PIXI.Text('extra this month', {
          fontFamily: "'Instrument Sans', system-ui, sans-serif",
          fontSize: 14,
          fill: COLORS.textSecondary,
        })
        subText.anchor.set(0.5, 0.5)
        subText.position.set(size / 2, size / 2 + 10)
        subText.alpha = 0
        textLayer.addChild(subText)

        // Percentage — danger red
        const pctText = new PIXI.Text(`${Math.round(totalPct * 100)}% of income`, {
          fontFamily: "'Instrument Sans', system-ui, sans-serif",
          fontSize: 16,
          fill: COLORS.danger,
        })
        pctText.anchor.set(0.5, 0.5)
        pctText.position.set(size / 2, size / 2 + 38)
        pctText.alpha = 0
        textLayer.addChild(pctText)

        // Fade in text
        const fadeIn = () => {
          for (const child of textLayer.children) {
            if (child.alpha < 1) (child as PIXI.Text).alpha += 0.025
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
    }
  }, [visible, impact, currency, future])

  if (!visible || !impact) return null

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 25,
      pointerEvents: 'none',
    }}>
      {/* Dim background — darker for drama */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'rgba(7,7,16,0.65)',
        pointerEvents: 'none',
      }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div ref={containerRef} />
        <div style={{
          textAlign: 'center',
          marginTop: 12,
          color: COLORS.textSecondary,
          fontSize: 11,
          fontFamily: "'Instrument Sans', system-ui, sans-serif",
        }}>
          Updated {getTimeSince(impact.as_of_date)}
        </div>
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
