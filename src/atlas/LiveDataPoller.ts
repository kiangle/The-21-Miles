import type { LiveParameters } from './types'
import { getAtlas } from './AtlasAdapter'

const POLL_INTERVAL = 15 * 60 * 1000 // 15 minutes

export class LiveDataPoller {
  private worldId: string
  private timer: ReturnType<typeof setInterval> | null = null
  private onUpdate: (params: LiveParameters) => void

  constructor(worldId: string, onUpdate: (params: LiveParameters) => void) {
    this.worldId = worldId
    this.onUpdate = onUpdate
  }

  async fetchOnce(): Promise<LiveParameters> {
    const params = await getAtlas().liveParameters(this.worldId)
    this.onUpdate(params)
    return params
  }

  start() {
    this.fetchOnce()
    this.timer = setInterval(() => this.fetchOnce(), POLL_INTERVAL)
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }
}
