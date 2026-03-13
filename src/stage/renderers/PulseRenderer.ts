import * as PIXI from 'pixi.js'
import { COLORS } from '../../app/config/constants'

/**
 * PulseRenderer — Medicine lens.
 *
 * Human question: Why is the clinic running short?
 *
 * Shows: pulse-based supply rhythm, fragile timed arrivals, missed beats,
 * shelf depletion. Medicine cross-packets travel from port to clinic.
 * Heartbeat cadence drives timing. Pressure breaks the cadence.
 */

interface PulsePoint {
  graphic: PIXI.Graphics
  x: number
  y: number
  phase: number
  baseRadius: number
  strength: number
}

interface MedicinePulse {
  graphic: PIXI.Graphics
  progress: number
  speed: number
  alive: boolean
}

interface ShelfCell {
  graphic: PIXI.Graphics
  x: number
  y: number
  fillLevel: number
  targetFill: number
}

export class PulseRenderer {
  private container: PIXI.Container
  private pulses: PulsePoint[] = []
  private supplyLevel = 1.0

  // Medicine packets along supply path
  private supplyPath: { x: number; y: number }[] = []
  private medicinePulses: MedicinePulse[] = []
  private cadenceTimer = 0
  private cadenceInterval = 2.0

  // Shelf depletion
  private shelfContainer: PIXI.Container
  private shelfCells: ShelfCell[] = []
  private shelfPos = { x: 0, y: 0 }

  // Heartbeat
  private heartbeatLine: PIXI.Graphics
  private heartbeatHistory: number[] = []

  private pressure = 0.5
  private perspective: 'nurse' | 'driver' | null = null

  constructor(parent: PIXI.Container) {
    this.container = new PIXI.Container()
    parent.addChild(this.container)
    this.container.visible = false

    this.shelfContainer = new PIXI.Container()
    this.container.addChild(this.shelfContainer)

    this.heartbeatLine = new PIXI.Graphics()
    this.container.addChild(this.heartbeatLine)
  }

  setSupplyLevel(pct: number) {
    this.supplyLevel = Math.max(0, Math.min(1, pct / 100))
  }

  setSupplyPath(path: { x: number; y: number }[]) {
    this.supplyPath = path
  }

  setShelfPosition(pos: { x: number; y: number }) {
    this.shelfPos = pos
    this.initShelf()
  }

  private initShelf() {
    this.shelfCells.forEach(c => c.graphic.destroy())
    this.shelfCells = []
    const cellW = 6, cellH = 8, gap = 2, cols = 4, rows = 2
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const g = new PIXI.Graphics()
        const x = this.shelfPos.x + (c - cols / 2) * (cellW + gap)
        const y = this.shelfPos.y + (r - rows / 2) * (cellH + gap) - 15
        this.shelfContainer.addChild(g)
        this.shelfCells.push({ graphic: g, x, y, fillLevel: 1, targetFill: 1 })
      }
    }
  }

  addPulsePoint(x: number, y: number) {
    const g = new PIXI.Graphics()
    this.container.addChild(g)
    this.pulses.push({
      graphic: g, x, y,
      phase: Math.random() * Math.PI * 2,
      baseRadius: 8 + Math.random() * 6,
      strength: 1,
    })
  }

  setPressure(p: number) {
    this.pressure = Math.max(0, Math.min(1.5, p))
  }

  setPerspective(role: 'nurse' | 'driver' | null) {
    this.perspective = role
  }

  update(delta: number) {
    const time = Date.now() * 0.001
    const dt = delta / 60

    // ── Cadence system ──
    this.cadenceTimer += dt
    const adjustedInterval = this.cadenceInterval * (1 + this.pressure * 0.8)
    const skipBeat = this.pressure > 0.6 && Math.random() < this.pressure * 0.3

    if (this.cadenceTimer >= adjustedInterval) {
      this.cadenceTimer = 0
      if (!skipBeat && this.supplyPath.length > 1) this.spawnMedicinePulse()
      this.heartbeatHistory.push(skipBeat ? 0 : 1)
      if (this.heartbeatHistory.length > 30) this.heartbeatHistory.shift()
    }

    // ── Medicine pulse packets ──
    const speedMod = 0.6 + (1 - this.pressure) * 0.4
    for (const mp of this.medicinePulses) {
      if (!mp.alive) continue
      mp.progress += mp.speed * speedMod * delta * 60
      if (mp.progress >= 1) {
        mp.alive = false
        mp.graphic.visible = false
        this.refillShelfCell()
        continue
      }
      const totalSegs = this.supplyPath.length - 1
      const seg = Math.min(Math.floor(mp.progress * totalSegs), totalSegs - 1)
      const lt = (mp.progress * totalSegs) - seg
      mp.graphic.x = this.supplyPath[seg].x + (this.supplyPath[seg + 1].x - this.supplyPath[seg].x) * lt
      mp.graphic.y = this.supplyPath[seg].y + (this.supplyPath[seg + 1].y - this.supplyPath[seg].y) * lt
      mp.graphic.alpha = 0.8
    }
    this.medicinePulses = this.medicinePulses.filter(mp => {
      if (!mp.alive) { mp.graphic.destroy(); return false }
      return true
    })

    // ── Shelf depletion ──
    for (const cell of this.shelfCells) {
      cell.targetFill = Math.max(0, cell.targetFill - dt * 0.02 * this.pressure)
      cell.fillLevel += (cell.targetFill - cell.fillLevel) * 0.05
      cell.graphic.clear()
      const cW = 6, cH = 8
      cell.graphic.lineStyle(0.5, PIXI.utils.string2hex(COLORS.medicine), 0.3)
      cell.graphic.drawRect(cell.x, cell.y, cW, cH)
      if (cell.fillLevel > 0.05) {
        const fH = cH * cell.fillLevel
        const fColor = cell.fillLevel > 0.5 ? PIXI.utils.string2hex(COLORS.medicine) : 0xCC3366
        cell.graphic.beginFill(fColor, 0.5 + cell.fillLevel * 0.3)
        cell.graphic.drawRect(cell.x, cell.y + cH - fH, cW, fH)
        cell.graphic.endFill()
      }
    }

    // ── Heartbeat line ──
    this.heartbeatLine.clear()
    if (this.heartbeatHistory.length > 2 && this.shelfPos.x > 0) {
      const lx = this.shelfPos.x - 30, ly = this.shelfPos.y + 10, lw = 60
      const step = lw / 30
      this.heartbeatLine.lineStyle(1, PIXI.utils.string2hex(COLORS.medicine), 0.5)
      for (let i = 0; i < this.heartbeatHistory.length; i++) {
        const x = lx + i * step
        const beat = this.heartbeatHistory[i]
        const y = ly - (beat ? 6 * Math.sin((i / this.heartbeatHistory.length) * Math.PI) : 0)
        if (i === 0) this.heartbeatLine.moveTo(x, y)
        else this.heartbeatLine.lineTo(x, y)
        if (beat === 0) {
          this.heartbeatLine.lineStyle(1, 0xCC3366, 0.6)
          this.heartbeatLine.drawCircle(x, ly, 2)
          this.heartbeatLine.lineStyle(1, PIXI.utils.string2hex(COLORS.medicine), 0.5)
        }
      }
    }

    // ── Pulse points ──
    for (const pulse of this.pulses) {
      pulse.graphic.clear()
      pulse.strength = this.supplyLevel
      const radius = pulse.baseRadius * (0.5 + 0.5 * Math.sin(time * 1.5 + pulse.phase))
      const opacity = 0.2 + 0.5 * pulse.strength * Math.abs(Math.sin(time * 1.5 + pulse.phase))

      pulse.graphic.beginFill(PIXI.utils.string2hex(COLORS.medicine), opacity * 0.3)
      pulse.graphic.drawCircle(pulse.x, pulse.y, radius * 1.5)
      pulse.graphic.endFill()
      pulse.graphic.lineStyle(2 * pulse.strength, PIXI.utils.string2hex(COLORS.medicine), opacity)
      pulse.graphic.drawCircle(pulse.x, pulse.y, radius)

      // Clinic cross
      if (pulse.strength > 0.1) {
        pulse.graphic.lineStyle(1.5, PIXI.utils.string2hex(COLORS.medicine), opacity * 0.6)
        pulse.graphic.moveTo(pulse.x - 4, pulse.y)
        pulse.graphic.lineTo(pulse.x + 4, pulse.y)
        pulse.graphic.moveTo(pulse.x, pulse.y - 4)
        pulse.graphic.lineTo(pulse.x, pulse.y + 4)
      }

      if (this.supplyLevel < 0.7) {
        pulse.graphic.lineStyle(1, 0xCC3366, (1 - this.supplyLevel) * 0.4)
        pulse.graphic.drawCircle(pulse.x, pulse.y, radius * 2)
      }
    }

    // Amara sees medicine vividly
    this.container.alpha = this.perspective === 'nurse' ? 1.0 : 0.7
  }

  private spawnMedicinePulse() {
    if (this.supplyPath.length < 2) return
    const g = new PIXI.Graphics()
    const color = PIXI.utils.string2hex(COLORS.medicine)
    g.beginFill(color, 0.9)
    g.drawRect(-1.5, -3, 3, 6)
    g.drawRect(-3, -1.5, 6, 3)
    g.endFill()
    this.container.addChild(g)
    this.medicinePulses.push({ graphic: g, progress: 0, speed: 0.0015 + Math.random() * 0.001, alive: true })
  }

  private refillShelfCell() {
    let lowest = 1
    let target: ShelfCell | null = null
    for (const cell of this.shelfCells) {
      if (cell.targetFill < lowest) { lowest = cell.targetFill; target = cell }
    }
    if (target) target.targetFill = Math.min(1, target.targetFill + 0.4)
  }

  setVisible(visible: boolean) {
    this.container.visible = visible
  }

  clear() {
    this.pulses.forEach(p => p.graphic.destroy())
    this.pulses = []
    this.medicinePulses.forEach(mp => mp.graphic.destroy())
    this.medicinePulses = []
    this.shelfCells.forEach(c => c.graphic.destroy())
    this.shelfCells = []
  }

  dispose() {
    this.clear()
    this.container.destroy({ children: true })
  }
}
