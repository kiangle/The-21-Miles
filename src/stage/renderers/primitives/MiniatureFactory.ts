import * as PIXI from 'pixi.js'

/**
 * MiniatureFactory — shared vector miniature drawing for all renderers.
 *
 * VISUAL RULES:
 * - Miniatures are MEDIUM scale (16–32px drawn) — clearly readable
 * - Soft underglow, not harsh outline
 * - Shape-first with subtle accent details
 * - Work at any rotation/angle
 * - Premium, restrained, not playful
 *
 * System patterns (lanes, queues, bottleneck) are PRIMARY.
 * Miniatures make the system concrete. They are not the main visual idea.
 *
 * Uses PIXI v7 legacy API (beginFill/endFill/lineStyle).
 */

// ── Transform helpers ───────────────────────────────────────────────

function tx(
  pts: [number, number][],
  cx: number, cy: number, angle: number, scale: number,
): [number, number][] {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return pts.map(([px, py]) => {
    const sx = px * scale
    const sy = py * scale
    return [sx * cos - sy * sin + cx, sx * sin + sy * cos + cy] as [number, number]
  })
}

function poly(g: PIXI.Graphics, pts: [number, number][], color: number, alpha: number) {
  if (pts.length < 3) return
  g.beginFill(color, alpha)
  g.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1])
  g.closePath()
  g.endFill()
}

// ── Ship miniature (top-down ~24px at scale 1.0) ─────────────────────
// Bigger hull, visible bridge, readable at medium zoom

const SHIP_HULL: [number, number][] = [
  [-10, 0], [-7, -4.5], [8, -4.5], [13, 0], [8, 4.5], [-7, 4.5],
]
const SHIP_BRIDGE: [number, number][] = [
  [-3, -2.5], [5, -2.5], [5, 2.5], [-3, 2.5],
]
const SHIP_BOW: [number, number][] = [
  [8, -3], [14, 0], [8, 3],
]

export function drawShipMiniature(
  g: PIXI.Graphics, x: number, y: number, angle: number,
  scale = 1, alpha = 1,
) {
  // Soft underglow — larger, more visible
  g.beginFill(0xb9d7ff, 0.08 * alpha)
  g.drawEllipse(x, y, 14 * scale, 7 * scale)
  g.endFill()

  // Hull
  poly(g, tx(SHIP_HULL, x, y, angle, scale), 0xd9ecff, 0.9 * alpha)

  // Bridge superstructure
  poly(g, tx(SHIP_BRIDGE, x, y, angle, scale), 0x8fb8df, 0.7 * alpha)

  // Bow highlight
  poly(g, tx(SHIP_BOW, x, y, angle, scale), 0xeaf4ff, 0.5 * alpha)
}

// ── Truck miniature (top-down ~22px at scale 1.0) ────────────────────
// Bigger cargo bed, visible cab, readable convoy spacing

const TRUCK_CARGO: [number, number][] = [
  [-9, -4], [3, -4], [3, 4], [-9, 4],
]
const TRUCK_CAB: [number, number][] = [
  [3, -3.5], [9, -3.5], [9, 3.5], [3, 3.5],
]
const TRUCK_WINDSHIELD: [number, number][] = [
  [5, -2.5], [8, -2.5], [8, 2.5], [5, 2.5],
]
const TRUCK_WHEEL_OFFSETS: [number, number][] = [
  [-6, -4.8], [-6, 4.8], [7, -4.8], [7, 4.8],
]

export function drawTruckMiniature(
  g: PIXI.Graphics, x: number, y: number, angle: number,
  scale = 1, alpha = 1,
) {
  // Soft underglow
  g.beginFill(0xe3b06b, 0.07 * alpha)
  g.drawEllipse(x, y, 12 * scale, 6 * scale)
  g.endFill()

  // Cargo body — warm gold
  poly(g, tx(TRUCK_CARGO, x, y, angle, scale), 0xe3b06b, 0.85 * alpha)

  // Cab — darker warm
  poly(g, tx(TRUCK_CAB, x, y, angle, scale), 0xc88f4e, 0.8 * alpha)

  // Windshield accent
  poly(g, tx(TRUCK_WINDSHIELD, x, y, angle, scale), 0xf5d7a0, 0.35 * alpha)

  // Wheel dots — larger
  const wheels = tx(TRUCK_WHEEL_OFFSETS, x, y, angle, scale)
  for (const [wx, wy] of wheels) {
    g.beginFill(0x2e2416, 0.75 * alpha)
    g.drawCircle(wx, wy, 1.4 * scale)
    g.endFill()
  }
}

// ── Medicine packet miniature (top-down ~16px at scale 1.0) ──────────
// Bigger cross, bolder color, clearly a medical supply

const MED_BODY: [number, number][] = [
  [-7, -5], [7, -5], [7, 5], [-7, 5],
]
const MED_CROSS_H: [number, number][] = [
  [-4, -1.5], [4, -1.5], [4, 1.5], [-4, 1.5],
]
const MED_CROSS_V: [number, number][] = [
  [-1.5, -4], [1.5, -4], [1.5, 4], [-1.5, 4],
]

export function drawMedicineMiniature(
  g: PIXI.Graphics, x: number, y: number, angle: number,
  scale = 1, alpha = 1,
) {
  // Soft underglow — visible halo
  g.beginFill(0xd97a86, 0.1 * alpha)
  g.drawCircle(x, y, 10 * scale)
  g.endFill()

  // Body — bold rose
  poly(g, tx(MED_BODY, x, y, angle, scale), 0xd97a86, 0.9 * alpha)

  // Cross marking — white-pink, strong
  poly(g, tx(MED_CROSS_H, x, y, angle, scale), 0xf6d9de, 0.8 * alpha)
  poly(g, tx(MED_CROSS_V, x, y, angle, scale), 0xf6d9de, 0.8 * alpha)
}

// ── Food crate miniature (top-down ~16px at scale 1.0) ───────────────
// Bigger crate, visible slats, warm earth tones

const FOOD_BODY: [number, number][] = [
  [-7, -5], [7, -5], [7, 5], [-7, 5],
]
const FOOD_SLAT1: [number, number][] = [
  [-5, -3.5], [-3.2, -3.5], [-3.2, 3.5], [-5, 3.5],
]
const FOOD_SLAT2: [number, number][] = [
  [-0.9, -3.5], [0.9, -3.5], [0.9, 3.5], [-0.9, 3.5],
]
const FOOD_SLAT3: [number, number][] = [
  [3.2, -3.5], [5, -3.5], [5, 3.5], [3.2, 3.5],
]

export function drawFoodMiniature(
  g: PIXI.Graphics, x: number, y: number, angle: number,
  scale = 1, alpha = 1,
) {
  // Soft underglow
  g.beginFill(0xd4a15d, 0.07 * alpha)
  g.drawEllipse(x, y, 10 * scale, 6 * scale)
  g.endFill()

  // Crate body — warm earth
  poly(g, tx(FOOD_BODY, x, y, angle, scale), 0xd4a15d, 0.85 * alpha)

  // Slat markings — lighter, readable
  poly(g, tx(FOOD_SLAT1, x, y, angle, scale), 0xf0c17b, 0.5 * alpha)
  poly(g, tx(FOOD_SLAT2, x, y, angle, scale), 0xf0c17b, 0.5 * alpha)
  poly(g, tx(FOOD_SLAT3, x, y, angle, scale), 0xf0c17b, 0.5 * alpha)
}

// ── Wake trail (behind ships) ───────────────────────────────────────

export function drawWake(
  g: PIXI.Graphics, points: { x: number; y: number }[],
  color: number, alpha: number, width: number,
) {
  if (points.length < 2) return
  // Outer dim wake
  g.lineStyle(width * 2.5, color, alpha * 0.12)
  g.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y)
  // Inner wake
  g.lineStyle(width, color, alpha)
  g.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y)
  g.lineStyle(0)
}

// ── Motion trail (general) ──────────────────────────────────────────

export function drawTrail(
  g: PIXI.Graphics, points: { x: number; y: number }[],
  color: number, alpha: number, width: number,
) {
  if (points.length < 2) return
  for (let i = 0; i < points.length - 1; i++) {
    const t = (i + 1) / points.length
    g.lineStyle(width * t, color, alpha * t)
    g.moveTo(points[i].x, points[i].y)
    g.lineTo(points[i + 1].x, points[i + 1].y)
  }
  g.lineStyle(0)
}

// ── Node glow (ports, depots, clinics, markets, households) ─────────
// Bigger, more visible — 4-layer concentric glow

export function drawNodeGlow(
  g: PIXI.Graphics, x: number, y: number,
  outerR: number, color: number, intensity: number,
) {
  g.beginFill(color, 0.03 * intensity)
  g.drawCircle(x, y, outerR * 1.2)
  g.endFill()
  g.beginFill(color, 0.07 * intensity)
  g.drawCircle(x, y, outerR * 0.8)
  g.endFill()
  g.beginFill(color, 0.15 * intensity)
  g.drawCircle(x, y, outerR * 0.45)
  g.endFill()
  g.beginFill(color, 0.35 * intensity)
  g.drawCircle(x, y, outerR * 0.2)
  g.endFill()
}

// ── Queue bloom (chokepoint / bottleneck) ───────────────────────────
// Bigger, more dramatic bloom

export function drawQueueBloom(
  g: PIXI.Graphics, x: number, y: number,
  pressure: number, color: number,
) {
  const layers = 8
  for (let i = layers; i >= 0; i--) {
    const r = (8 + i * 6) * pressure
    const a = 0.02 * (layers - i + 1) * pressure
    g.beginFill(color, Math.min(0.15, a))
    g.drawCircle(x, y, r)
    g.endFill()
  }
}

// ── Lane field (dim glow beneath actors along a path) ───────────────
// Stronger core, wider glow — the lane IS the system

export function drawLaneField(
  g: PIXI.Graphics, path: { x: number; y: number }[],
  color: number, alpha: number, width: number,
) {
  if (path.length < 2) return
  // Outer wide dim — the "field"
  g.lineStyle(width * 4, color, alpha * 0.12)
  g.moveTo(path[0].x, path[0].y)
  for (let i = 1; i < path.length; i++) g.lineTo(path[i].x, path[i].y)
  // Mid band
  g.lineStyle(width * 2, color, alpha * 0.3)
  g.moveTo(path[0].x, path[0].y)
  for (let i = 1; i < path.length; i++) g.lineTo(path[i].x, path[i].y)
  // Core line — visible, not dim
  g.lineStyle(width * 0.8, color, alpha * 0.6)
  g.moveTo(path[0].x, path[0].y)
  for (let i = 1; i < path.length; i++) g.lineTo(path[i].x, path[i].y)
  g.lineStyle(0)
}

// ── Density bloom (where bodies cluster) ────────────────────────────
// Stronger bloom, bigger cells

export function drawDensityBloom(
  g: PIXI.Graphics,
  positions: { x: number; y: number }[],
  cellSize: number,
  color: number,
  threshold = 2,
) {
  const density: Map<string, { count: number; x: number; y: number }> = new Map()
  for (const p of positions) {
    const cx = Math.floor(p.x / cellSize)
    const cy = Math.floor(p.y / cellSize)
    const key = `${cx},${cy}`
    const existing = density.get(key)
    if (existing) {
      existing.count++
    } else {
      density.set(key, { count: 1, x: (cx + 0.5) * cellSize, y: (cy + 0.5) * cellSize })
    }
  }

  for (const [, cell] of density) {
    if (cell.count < threshold) continue
    const intensity = Math.min(1, cell.count / 6)
    g.beginFill(color, intensity * 0.08)
    g.drawCircle(cell.x, cell.y, cellSize * 1.3)
    g.endFill()
    g.beginFill(color, intensity * 0.14)
    g.drawCircle(cell.x, cell.y, cellSize * 0.6)
    g.endFill()
  }
}

// ── Corridor edge glow (wall pressure visualization) ─────────────────

export function drawCorridorPressureGlow(
  g: PIXI.Graphics, x: number, y: number,
  width: number, height: number,
  pressure: number, color: number,
) {
  if (pressure < 0.2) return
  const intensity = (pressure - 0.2) * 1.25
  for (let i = 3; i >= 0; i--) {
    const spread = i * 3
    g.lineStyle(2 + i, color, intensity * 0.04 * (4 - i))
    g.drawRect(x - spread, y - spread, width + spread * 2, height + spread * 2)
  }
  g.lineStyle(0)
}
