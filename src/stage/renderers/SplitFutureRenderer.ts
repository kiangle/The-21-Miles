import * as PIXI from 'pixi.js'
import { COLORS } from '../../app/config/constants'

/**
 * SplitFutureRenderer — the screen literally bifurcates.
 * Left: how things stand now. Right: if this happens.
 */

export class SplitFutureRenderer {
  private container: PIXI.Container
  private divider: PIXI.Graphics
  private leftLabel: PIXI.Text
  private rightLabel: PIXI.Text
  private leftMask: PIXI.Graphics
  private rightMask: PIXI.Graphics
  private width: number
  private height: number
  private splitProgress = 0 // 0 = no split, 1 = full split

  constructor(parent: PIXI.Container, width: number, height: number) {
    this.width = width
    this.height = height
    this.container = new PIXI.Container()
    parent.addChild(this.container)
    this.container.visible = false

    // Divider line
    this.divider = new PIXI.Graphics()
    this.container.addChild(this.divider)

    // Labels — NO JARGON
    const style = new PIXI.TextStyle({
      fontFamily: "'Instrument Sans', system-ui, sans-serif",
      fontSize: 14,
      fill: COLORS.textPrimary,
      letterSpacing: 1,
    })
    this.leftLabel = new PIXI.Text('How things stand now', style)
    this.leftLabel.anchor.set(0.5, 0)
    this.leftLabel.position.set(width * 0.25, 20)
    this.container.addChild(this.leftLabel)

    this.rightLabel = new PIXI.Text('If this happens...', style)
    this.rightLabel.anchor.set(0.5, 0)
    this.rightLabel.position.set(width * 0.75, 20)
    this.container.addChild(this.rightLabel)

    // Masks for clipping left/right halves
    this.leftMask = new PIXI.Graphics()
    this.rightMask = new PIXI.Graphics()
  }

  setSplit(progress: number) {
    this.splitProgress = Math.max(0, Math.min(1, progress))
  }

  update() {
    this.divider.clear()

    if (this.splitProgress <= 0) return

    const midX = this.width / 2

    // Divider line
    this.divider.lineStyle(2, PIXI.utils.string2hex(COLORS.textSecondary), this.splitProgress * 0.6)
    this.divider.moveTo(midX, 0)
    this.divider.lineTo(midX, this.height)

    // Labels
    this.leftLabel.alpha = this.splitProgress
    this.rightLabel.alpha = this.splitProgress
  }

  getLeftMask(): PIXI.Graphics {
    this.leftMask.clear()
    this.leftMask.beginFill(0xffffff)
    this.leftMask.drawRect(0, 0, this.width / 2, this.height)
    this.leftMask.endFill()
    return this.leftMask
  }

  getRightMask(): PIXI.Graphics {
    this.rightMask.clear()
    this.rightMask.beginFill(0xffffff)
    this.rightMask.drawRect(this.width / 2, 0, this.width / 2, this.height)
    this.rightMask.endFill()
    return this.rightMask
  }

  setVisible(visible: boolean) {
    this.container.visible = visible
  }

  dispose() {
    this.container.destroy({ children: true })
  }
}
