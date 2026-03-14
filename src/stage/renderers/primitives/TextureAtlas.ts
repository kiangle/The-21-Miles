import * as PIXI from 'pixi.js'

/**
 * TextureAtlas — pre-rendered miniature textures cached as RenderTextures.
 *
 * Replaces per-frame Graphics.beginFill/endFill drawing with GPU-cached sprites.
 * Renders at 2× for retina. Each actor type drawn once, reused via Sprite references.
 *
 * Kept as a singleton: call TextureAtlas.get(app) to obtain the shared instance.
 * Falls back gracefully — if texture generation fails, returns a 1×1 white texture.
 */

const ATLAS_SCALE = 2

/** All available texture keys */
export type TextureKey =
  | 'ship' | 'ship_glow'
  | 'truck' | 'truck_glow'
  | 'medicine' | 'medicine_glow'
  | 'wake_particle'
  | 'trail_particle'
  | 'dust_particle'

let _instance: TextureAtlas | null = null

export class TextureAtlas {
  private textures: Map<TextureKey, PIXI.Texture> = new Map()
  private renderer: PIXI.IRenderer

  private constructor(renderer: PIXI.IRenderer) {
    this.renderer = renderer
    this.build()
    console.log('[TextureAtlas] Generated', this.textures.size, 'textures')
  }

  /** Singleton accessor. Pass app.renderer from any scene that has it. */
  static get(renderer: PIXI.IRenderer): TextureAtlas {
    if (!_instance || (_instance as any).renderer !== renderer) {
      _instance = new TextureAtlas(renderer)
    }
    return _instance
  }

  /** Reset singleton (for hot-reload / tests) */
  static reset() {
    if (_instance) {
      _instance.dispose()
      _instance = null
    }
  }

  /** Get a cached texture by key. Returns fallback if missing. */
  tex(key: TextureKey): PIXI.Texture {
    return this.textures.get(key) ?? PIXI.Texture.WHITE
  }

  // ── Build all textures ──────────────────────────────────────────────

  private build() {
    this.buildShip()
    this.buildTruck()
    this.buildMedicine()
    this.buildParticles()
  }

  // ── Ship (top-down ~28px drawn at 2×) ───────────────────────────────

  private buildShip() {
    const s = ATLAS_SCALE
    const g = new PIXI.Graphics()

    // Hull — smooth bow via bezier curves
    g.beginFill(0xd9ecff, 0.92)
    g.moveTo(-10 * s, 0)
    g.lineTo(-7 * s, -4.5 * s)
    g.lineTo(8 * s, -4.5 * s)
    g.bezierCurveTo(11 * s, -4 * s, 14 * s, -1 * s, 14 * s, 0)
    g.bezierCurveTo(14 * s, 1 * s, 11 * s, 4 * s, 8 * s, 4.5 * s)
    g.lineTo(-7 * s, 4.5 * s)
    g.closePath()
    g.endFill()

    // Bridge superstructure
    g.beginFill(0x8fb8df, 0.7)
    g.drawRoundedRect(-3 * s, -2.5 * s, 8 * s, 5 * s, 1 * s)
    g.endFill()

    // Bow highlight
    g.beginFill(0xeaf4ff, 0.45)
    g.moveTo(8 * s, -3 * s)
    g.bezierCurveTo(12 * s, -1.5 * s, 12 * s, 1.5 * s, 8 * s, 3 * s)
    g.closePath()
    g.endFill()

    // Navigation lights — red port, green starboard
    g.beginFill(0xff4444, 0.7)
    g.drawCircle(9 * s, -3.5 * s, 0.8 * s)
    g.endFill()
    g.beginFill(0x44ff44, 0.7)
    g.drawCircle(9 * s, 3.5 * s, 0.8 * s)
    g.endFill()

    // Container stacks (colored rectangles on deck)
    const deckColors = [0x5588cc, 0x6699dd, 0x4477bb]
    for (let i = 0; i < 3; i++) {
      g.beginFill(deckColors[i], 0.35)
      g.drawRect((-6 + i * 3) * s, -2 * s, 2.5 * s, 4 * s)
      g.endFill()
    }

    this.rasterize(g, 'ship', 36, 14)

    // Glow texture — soft underglow ellipse
    const gg = new PIXI.Graphics()
    gg.beginFill(0xb9d7ff, 0.12)
    gg.drawEllipse(0, 0, 16 * s, 8 * s)
    gg.endFill()
    gg.beginFill(0xb9d7ff, 0.06)
    gg.drawEllipse(0, 0, 20 * s, 10 * s)
    gg.endFill()
    this.rasterize(gg, 'ship_glow', 44, 24)
  }

  // ── Truck (top-down ~24px drawn at 2×) ──────────────────────────────

  private buildTruck() {
    const s = ATLAS_SCALE
    const g = new PIXI.Graphics()

    // Cargo body
    g.beginFill(0xe3b06b, 0.88)
    g.drawRoundedRect(-9 * s, -4 * s, 12 * s, 8 * s, 0.8 * s)
    g.endFill()

    // Cab
    g.beginFill(0xc88f4e, 0.82)
    g.drawRoundedRect(3 * s, -3.5 * s, 6 * s, 7 * s, 0.6 * s)
    g.endFill()

    // Windshield
    g.beginFill(0xf5d7a0, 0.4)
    g.drawRoundedRect(5 * s, -2.5 * s, 3 * s, 5 * s, 0.4 * s)
    g.endFill()

    // Headlights
    g.beginFill(0xffeeaa, 0.6)
    g.drawCircle(9 * s, -2.5 * s, 0.7 * s)
    g.drawCircle(9 * s, 2.5 * s, 0.7 * s)
    g.endFill()

    // Wheels
    const wheels: [number, number][] = [[-6, -4.8], [-6, 4.8], [7, -4.8], [7, 4.8]]
    for (const [wx, wy] of wheels) {
      g.beginFill(0x2e2416, 0.8)
      g.drawCircle(wx * s, wy * s, 1.5 * s)
      g.endFill()
    }

    this.rasterize(g, 'truck', 24, 14)

    // Glow
    const gg = new PIXI.Graphics()
    gg.beginFill(0xe3b06b, 0.1)
    gg.drawEllipse(0, 0, 14 * s, 8 * s)
    gg.endFill()
    this.rasterize(gg, 'truck_glow', 32, 20)
  }

  // ── Medicine packet (top-down ~18px) ────────────────────────────────

  private buildMedicine() {
    const s = ATLAS_SCALE
    const g = new PIXI.Graphics()

    // Body — bold rose with rounded corners
    g.beginFill(0xd97a86, 0.92)
    g.drawRoundedRect(-7 * s, -5 * s, 14 * s, 10 * s, 1.5 * s)
    g.endFill()

    // Cross marking — white-pink
    g.beginFill(0xf6d9de, 0.82)
    g.drawRect(-4 * s, -1.5 * s, 8 * s, 3 * s)
    g.endFill()
    g.beginFill(0xf6d9de, 0.82)
    g.drawRect(-1.5 * s, -4 * s, 3 * s, 8 * s)
    g.endFill()

    this.rasterize(g, 'medicine', 18, 14)

    // Glow
    const gg = new PIXI.Graphics()
    gg.beginFill(0xd97a86, 0.12)
    gg.drawCircle(0, 0, 12 * s)
    gg.endFill()
    this.rasterize(gg, 'medicine_glow', 28, 28)
  }

  // ── Particles ───────────────────────────────────────────────────────

  private buildParticles() {
    const s = ATLAS_SCALE

    // Wake particle — soft white dot
    const wg = new PIXI.Graphics()
    wg.beginFill(0xffffff, 0.8)
    wg.drawCircle(0, 0, 3 * s)
    wg.endFill()
    wg.beginFill(0xffffff, 0.3)
    wg.drawCircle(0, 0, 5 * s)
    wg.endFill()
    this.rasterize(wg, 'wake_particle', 12, 12)

    // Trail particle — smaller, dimmer
    const tg = new PIXI.Graphics()
    tg.beginFill(0xffffff, 0.6)
    tg.drawCircle(0, 0, 2 * s)
    tg.endFill()
    tg.beginFill(0xffffff, 0.2)
    tg.drawCircle(0, 0, 3.5 * s)
    tg.endFill()
    this.rasterize(tg, 'trail_particle', 8, 8)

    // Dust particle — warm tone base
    const dg = new PIXI.Graphics()
    dg.beginFill(0xd4a15d, 0.5)
    dg.drawCircle(0, 0, 2.5 * s)
    dg.endFill()
    dg.beginFill(0xd4a15d, 0.15)
    dg.drawCircle(0, 0, 4 * s)
    dg.endFill()
    this.rasterize(dg, 'dust_particle', 10, 10)
  }

  // ── Rasterize helper ────────────────────────────────────────────────

  private rasterize(g: PIXI.Graphics, key: TextureKey, w: number, h: number) {
    const s = ATLAS_SCALE
    // Center the graphic in the render texture
    g.position.set(w * s / 2, h * s / 2)

    const rt = PIXI.RenderTexture.create({ width: w * s, height: h * s })
    this.renderer.render(g, { renderTexture: rt })
    g.destroy()
    this.textures.set(key, rt)
  }

  dispose() {
    for (const [, t] of this.textures) {
      if (t !== PIXI.Texture.WHITE) t.destroy(true)
    }
    this.textures.clear()
  }
}
