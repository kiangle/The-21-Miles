import * as PIXI from 'pixi.js'
import gsap from 'gsap'
import { TextureAtlas } from './primitives/TextureAtlas'

/**
 * UnifiedFlowSystem — the same 40-60 particles transform color, speed,
 * spacing, and behavior as the narrative progresses.
 *
 * Oil becomes freight becomes medicine. The user SEES the transformation,
 * not just reads about it.
 *
 * Uses TextureAtlas wake_particle as the base sprite. Domains change
 * tint, scale, speed, spacing, cluster, pulse, trail alpha via GSAP.
 */

export interface DomainConfig {
  color: number
  speed: number
  particleSize: number
  spacing: number
  clusterStrength: number
  pulseRate: number
  trailAlpha: number
  glowColor: number
  glowIntensity: number
}

export const DOMAINS: Record<string, DomainConfig> = {
  shipping: {
    color: 0x72b7ff, speed: 2.5, particleSize: 3, spacing: 8,
    clusterStrength: 0.0, pulseRate: 0, trailAlpha: 0.3,
    glowColor: 0x72b7ff, glowIntensity: 0.4,
  },
  freight: {
    color: 0xE8B94A, speed: 1.0, particleSize: 4, spacing: 5,
    clusterStrength: 0.7, pulseRate: 0, trailAlpha: 0.2,
    glowColor: 0xE8B94A, glowIntensity: 0.3,
  },
  import_stress: {
    color: 0xD4763C, speed: 0.6, particleSize: 3.5, spacing: 18,
    clusterStrength: 0.3, pulseRate: 0, trailAlpha: 0.15,
    glowColor: 0xD4763C, glowIntensity: 0.35,
  },
  medicine: {
    color: 0xd97a86, speed: 0.3, particleSize: 5, spacing: 30,
    clusterStrength: 0.0, pulseRate: 1.2, trailAlpha: 0.05,
    glowColor: 0xd97a86, glowIntensity: 0.5,
  },
  household: {
    color: 0xC8A96E, speed: 0.1, particleSize: 3, spacing: 3,
    clusterStrength: 1.0, pulseRate: 0, trailAlpha: 0,
    glowColor: 0xC44B3F, glowIntensity: 0.6,
  },
  fertilizer: {
    color: 0x7BBC6F, speed: 0.8, particleSize: 3.5, spacing: 12,
    clusterStrength: 0.4, pulseRate: 0, trailAlpha: 0.15,
    glowColor: 0x7BBC6F, glowIntensity: 0.3,
  },
  food: {
    color: 0xd4a15d, speed: 0.2, particleSize: 4, spacing: 4,
    clusterStrength: 0.8, pulseRate: 0, trailAlpha: 0.05,
    glowColor: 0xC44B3F, glowIntensity: 0.5,
  },
}

interface FlowParticle {
  sprite: PIXI.Sprite
  glowSprite: PIXI.Sprite
  x: number
  y: number
  vx: number
  vy: number
  pathProgress: number
  age: number
  alive: boolean
}

/** Interpolable state that GSAP tweens between domains */
interface AnimState {
  colorR: number
  colorG: number
  colorB: number
  speed: number
  particleSize: number
  spacing: number
  clusterStrength: number
  pulseRate: number
  trailAlpha: number
  glowR: number
  glowG: number
  glowB: number
  glowIntensity: number
}

function hexToRGB(hex: number): [number, number, number] {
  return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff]
}

function rgbToHex(r: number, g: number, b: number): number {
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)
}

function domainToAnimState(d: DomainConfig): AnimState {
  const [cr, cg, cb] = hexToRGB(d.color)
  const [gr, gg, gb] = hexToRGB(d.glowColor)
  return {
    colorR: cr, colorG: cg, colorB: cb,
    speed: d.speed, particleSize: d.particleSize,
    spacing: d.spacing, clusterStrength: d.clusterStrength,
    pulseRate: d.pulseRate, trailAlpha: d.trailAlpha,
    glowR: gr, glowG: gg, glowB: gb, glowIntensity: d.glowIntensity,
  }
}

const PARTICLE_COUNT = 50

export class UnifiedFlowSystem {
  private container: PIXI.Container
  private glowContainer: PIXI.Container
  private trailGfx: PIXI.Graphics
  private particles: FlowParticle[] = []
  private path: { x: number; y: number }[] = []
  private pathLengths: number[] = []
  private totalPathLength = 0
  private state: AnimState
  private currentDomain = 'shipping'
  private frozen = false
  private elapsed = 0
  private activeTween: gsap.core.Tween | null = null

  constructor(parent: PIXI.Container, renderer: PIXI.IRenderer) {
    this.container = new PIXI.Container()
    parent.addChild(this.container)

    this.trailGfx = new PIXI.Graphics()
    this.container.addChild(this.trailGfx)

    this.glowContainer = new PIXI.Container()
    this.container.addChild(this.glowContainer)

    const atlas = TextureAtlas.get(renderer)
    const tex = atlas.tex('wake_particle')

    this.state = domainToAnimState(DOMAINS.shipping)

    // Pre-allocate particles
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const glowSprite = new PIXI.Sprite(tex)
      glowSprite.anchor.set(0.5, 0.5)
      glowSprite.blendMode = PIXI.BLEND_MODES.ADD
      glowSprite.alpha = 0.3
      glowSprite.visible = false
      this.glowContainer.addChild(glowSprite)

      const sprite = new PIXI.Sprite(tex)
      sprite.anchor.set(0.5, 0.5)
      sprite.visible = false
      this.container.addChild(sprite)

      this.particles.push({
        sprite, glowSprite,
        x: 0, y: 0, vx: 0, vy: 0,
        pathProgress: i / PARTICLE_COUNT,
        age: 0, alive: false,
      })
    }

    console.log('[UnifiedFlowSystem] Initialized with', PARTICLE_COUNT, 'particles')
  }

  /** Define the flow route. Particles follow this path. */
  setPath(points: { x: number; y: number }[]) {
    this.path = points
    this.pathLengths = []
    this.totalPathLength = 0
    for (let i = 0; i < points.length - 1; i++) {
      const dx = points[i + 1].x - points[i].x
      const dy = points[i + 1].y - points[i].y
      const len = Math.sqrt(dx * dx + dy * dy)
      this.pathLengths.push(len)
      this.totalPathLength += len
    }

    // Distribute particles evenly along path
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i]
      p.pathProgress = i / this.particles.length
      p.alive = true
      p.sprite.visible = true
      p.glowSprite.visible = true
      const pos = this.getPointAtT(p.pathProgress)
      if (pos) { p.x = pos.x; p.y = pos.y }
    }
  }

  /** GSAP-animate all particles to new domain configuration */
  morphTo(domain: string, duration = 1.5) {
    const config = DOMAINS[domain]
    if (!config) {
      console.warn('[UnifiedFlowSystem] Unknown domain:', domain)
      return
    }

    this.currentDomain = domain
    const target = domainToAnimState(config)

    if (this.activeTween) {
      this.activeTween.kill()
      this.activeTween = null
    }

    console.log('[UnifiedFlowSystem] morphTo', domain, 'over', duration, 's')

    this.activeTween = gsap.to(this.state, {
      ...target,
      duration,
      ease: 'power2.inOut',
      onComplete: () => { this.activeTween = null },
    })
  }

  /** Stop all particle movement (rupture scene) */
  freeze() {
    this.frozen = true
    console.log('[UnifiedFlowSystem] Frozen')
  }

  /** Restart particle flow after freeze */
  resume() {
    this.frozen = false
    console.log('[UnifiedFlowSystem] Resumed')
  }

  getCurrentDomain(): string { return this.currentDomain }

  /** Call once per frame from PixiStage ticker */
  update(dt: number) {
    if (this.path.length < 2) return

    this.elapsed += dt

    const {
      colorR, colorG, colorB, speed, particleSize, spacing,
      clusterStrength, pulseRate, trailAlpha,
      glowR, glowG, glowB, glowIntensity,
    } = this.state

    const tint = rgbToHex(colorR, colorG, colorB)
    const glowTint = rgbToHex(glowR, glowG, glowB)

    // Pulse modulation (medicine heartbeat)
    const pulseScale = pulseRate > 0
      ? 1.0 + 0.3 * Math.sin(this.elapsed * pulseRate * Math.PI * 2)
      : 1.0

    // Trail drawing
    this.trailGfx.clear()
    if (trailAlpha > 0.01) {
      this.trailGfx.lineStyle(particleSize * 0.5, tint, trailAlpha * 0.5)
      let started = false
      for (const p of this.particles) {
        if (!p.alive) continue
        if (!started) {
          this.trailGfx.moveTo(p.x, p.y)
          started = true
        } else {
          this.trailGfx.lineTo(p.x, p.y)
        }
      }
    }

    // Update each particle
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i]
      if (!p.alive) continue

      // Advance along path
      if (!this.frozen) {
        const progressStep = (speed * dt) / Math.max(1, this.totalPathLength)

        // Cluster effect: particles bunch up toward the one ahead
        let clusterOffset = 0
        if (clusterStrength > 0 && i > 0) {
          const ahead = this.particles[i - 1]
          const gap = ahead.pathProgress - p.pathProgress
          if (gap > 0 && gap < 0.1) {
            clusterOffset = clusterStrength * gap * 0.5
          }
        }

        // Spacing: larger spacing = slower advancement for trailing particles
        const spacingFactor = 1.0 - (spacing / 100) * 0.3
        p.pathProgress += progressStep * spacingFactor + clusterOffset

        // Wrap around
        if (p.pathProgress > 1) p.pathProgress -= 1
        if (p.pathProgress < 0) p.pathProgress += 1
      }

      p.age += dt

      // Position on path
      const pos = this.getPointAtT(p.pathProgress)
      if (pos) { p.x = pos.x; p.y = pos.y }

      // Apply visual state
      const scale = (particleSize / 3) * pulseScale
      p.sprite.position.set(p.x, p.y)
      p.sprite.tint = tint
      p.sprite.scale.set(scale * 0.4)
      p.sprite.alpha = 0.8

      p.glowSprite.position.set(p.x, p.y)
      p.glowSprite.tint = glowTint
      p.glowSprite.scale.set(scale * 0.8)
      p.glowSprite.alpha = glowIntensity * pulseScale * 0.5
    }
  }

  private getPointAtT(t: number): { x: number; y: number } | null {
    if (this.path.length < 2 || this.totalPathLength < 1) return null
    const targetDist = t * this.totalPathLength
    let acc = 0
    for (let i = 0; i < this.path.length - 1; i++) {
      const segLen = this.pathLengths[i]
      if (acc + segLen >= targetDist) {
        const localT = segLen > 0 ? (targetDist - acc) / segLen : 0
        return {
          x: this.path[i].x + (this.path[i + 1].x - this.path[i].x) * localT,
          y: this.path[i].y + (this.path[i + 1].y - this.path[i].y) * localT,
        }
      }
      acc += segLen
    }
    return this.path[this.path.length - 1]
  }

  setVisible(visible: boolean) { this.container.visible = visible }

  dispose() {
    if (this.activeTween) { this.activeTween.kill(); this.activeTween = null }
    this.container.destroy({ children: true })
  }
}
