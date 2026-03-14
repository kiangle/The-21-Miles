import * as PIXI from 'pixi.js'

/**
 * WakeTrailSystem — GPU-accelerated particle effects for wake/trail animation.
 *
 * Uses PIXI.ParticleContainer for high particle count at minimal draw-call cost.
 * Pre-allocates sprite pool; reuses particles via visibility toggle.
 * Additive blending for soft glow accumulation.
 */

interface Particle {
  sprite: PIXI.Sprite
  vx: number
  vy: number
  life: number
  maxLife: number
  startScale: number
  startAlpha: number
}

export class WakeTrailSystem {
  private particleContainer: PIXI.ParticleContainer
  private particles: Particle[] = []
  private pool: Particle[] = []
  private texture: PIXI.Texture
  private capacity: number

  constructor(parent: PIXI.Container, texture: PIXI.Texture, capacity = 500) {
    this.texture = texture
    this.capacity = capacity

    this.particleContainer = new PIXI.ParticleContainer(capacity, {
      position: true,
      scale: true,
      alpha: true,
      tint: true,
    })
    this.particleContainer.blendMode = PIXI.BLEND_MODES.ADD
    parent.addChild(this.particleContainer)

    // Pre-allocate all sprites
    for (let i = 0; i < capacity; i++) {
      const sprite = new PIXI.Sprite(texture)
      sprite.anchor.set(0.5, 0.5)
      sprite.visible = false
      this.particleContainer.addChild(sprite)
      this.pool.push({
        sprite,
        vx: 0, vy: 0,
        life: 0, maxLife: 1,
        startScale: 1, startAlpha: 1,
      })
    }
  }

  /**
   * Emit continuous trail particles behind a moving actor.
   * Call once per frame for each moving actor.
   */
  emit(x: number, y: number, vx: number, vy: number, color: number, count = 2) {
    const speed = Math.sqrt(vx * vx + vy * vy)

    for (let i = 0; i < count; i++) {
      const p = this.acquireParticle()
      if (!p) return

      // Spawn offset behind actor
      p.sprite.position.set(
        x - vx * 3 + (Math.random() - 0.5) * 4,
        y - vy * 3 + (Math.random() - 0.5) * 4,
      )
      p.vx = -vx * 0.1 + (Math.random() - 0.5) * 0.5
      p.vy = -vy * 0.1 + (Math.random() - 0.5) * 0.5
      p.life = 0
      p.maxLife = 0.8 + Math.random() * 0.4
      p.startScale = 0.3 + speed * 0.1
      p.startAlpha = 0.6
      p.sprite.tint = color
      p.sprite.scale.set(p.startScale)
      p.sprite.alpha = p.startAlpha
      p.sprite.visible = true
    }
  }

  /**
   * Radial burst effect (e.g. arrival, stress indicator).
   */
  burst(x: number, y: number, color: number, count = 12) {
    for (let i = 0; i < count; i++) {
      const p = this.acquireParticle()
      if (!p) return

      const angle = (i / count) * Math.PI * 2
      const speed = 1 + Math.random() * 2

      p.sprite.position.set(x, y)
      p.vx = Math.cos(angle) * speed
      p.vy = Math.sin(angle) * speed
      p.life = 0
      p.maxLife = 0.6 + Math.random() * 0.5
      p.startScale = 0.4 + Math.random() * 0.3
      p.startAlpha = 0.8
      p.sprite.tint = color
      p.sprite.scale.set(p.startScale)
      p.sprite.alpha = p.startAlpha
      p.sprite.visible = true
    }
  }

  /**
   * Update all active particles. Call once per frame.
   */
  update(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.life += dt

      if (p.life >= p.maxLife) {
        // Return to pool
        p.sprite.visible = false
        this.pool.push(p)
        this.particles.splice(i, 1)
        continue
      }

      const t = p.life / p.maxLife // 0→1 over lifetime

      // Decelerate
      p.vx *= 0.97
      p.vy *= 0.97

      // Move
      p.sprite.position.x += p.vx
      p.sprite.position.y += p.vy

      // Fade and shrink linearly
      p.sprite.alpha = p.startAlpha * (1 - t)
      p.sprite.scale.set(p.startScale * (1 - t * 0.6))
    }
  }

  private acquireParticle(): Particle | null {
    if (this.pool.length > 0) {
      const p = this.pool.pop()!
      this.particles.push(p)
      return p
    }
    // Pool exhausted — skip emission rather than allocate
    return null
  }

  getActiveCount(): number {
    return this.particles.length
  }

  clear() {
    for (const p of this.particles) {
      p.sprite.visible = false
      this.pool.push(p)
    }
    this.particles = []
  }

  dispose() {
    this.clear()
    this.particleContainer.destroy({ children: true })
  }
}
