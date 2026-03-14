import { Story } from 'inkjs'

/**
 * InkEngine — loads and runs ink narratives.
 *
 * Each world+country has its own .ink.json.
 * The engine injects live variables from Atlas.
 *
 * Emits typed events when ink tags contain directives:
 * SCENE, MORPH, SOUND, DISCOVERY, SPLIT_SCREEN, FUTURE, RECIPE, GENERATE_CLIP
 */

export interface InkChoice {
  text: string
  index: number
}

export interface InkBeat {
  text: string
  tags: string[]
  choices: InkChoice[]
}

/** Events emitted from ink tag directives. */
export type InkTagEvent =
  | { type: 'SCENE'; value: string }
  | { type: 'MORPH'; value: string }
  | { type: 'SOUND'; value: string }
  | { type: 'DISCOVERY'; value: string }
  | { type: 'SPLIT_SCREEN'; value: string }
  | { type: 'FUTURE'; value: string }
  | { type: 'RECIPE'; value: string }
  | { type: 'GENERATE_CLIP'; value: string }

export type InkTagListener = (event: InkTagEvent) => void

export class InkEngine {
  private story: Story | null = null
  private loaded = false
  private listeners: InkTagListener[] = []

  async load(narrativePack: string): Promise<void> {
    try {
      const res = await fetch(`/ink/${narrativePack}.ink.json`)
      if (!res.ok) {
        console.warn(`Ink narrative not found: ${narrativePack}. Using fallback.`)
        this.loaded = false
        return
      }
      const json = await res.json()
      this.story = new Story(json)
      this.loaded = true
    } catch {
      console.warn(`Failed to load ink narrative: ${narrativePack}`)
      this.loaded = false
    }
  }

  isLoaded(): boolean {
    return this.loaded && this.story !== null
  }

  setVariable(name: string, value: string | number | boolean): void {
    if (!this.story) return
    try {
      this.story.variablesState.$(name, value)
    } catch {
      // Variable may not exist in this ink file
    }
  }

  injectAtlasVariables(vars: Record<string, string | number | boolean>): void {
    Object.entries(vars).forEach(([k, v]) => this.setVariable(k, v))
  }

  goToKnot(knot: string): void {
    if (!this.story) return
    try {
      this.story.ChoosePathString(knot)
    } catch {
      console.warn(`Ink knot not found: ${knot}`)
    }
  }

  /** Register a listener for ink tag events. Returns an unsubscribe function. */
  onTagEvent(listener: InkTagListener): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  private emitTagEvents(tags: string[]) {
    const directives = ['SCENE', 'MORPH', 'SOUND', 'DISCOVERY', 'SPLIT_SCREEN', 'FUTURE', 'RECIPE', 'GENERATE_CLIP']
    for (const tag of tags) {
      for (const directive of directives) {
        if (tag.startsWith(`${directive}:`)) {
          const value = tag.slice(directive.length + 1).trim()
          const event: InkTagEvent = { type: directive as InkTagEvent['type'], value }
          for (const listener of this.listeners) {
            listener(event)
          }
          break
        }
      }
    }
  }

  continue(): InkBeat | null {
    if (!this.story) return null

    let text = ''
    const tags: string[] = []

    while (this.story.canContinue) {
      text += this.story.Continue() ?? ''
      if (this.story.currentTags) {
        tags.push(...this.story.currentTags)
      }
    }

    // Emit tag events to listeners
    if (tags.length > 0) {
      this.emitTagEvents(tags)
    }

    const choices = this.story.currentChoices.map((c, i) => ({
      text: c.text,
      index: i,
    }))

    return { text: text.trim(), tags, choices }
  }

  choose(index: number): void {
    if (!this.story) return
    this.story.ChooseChoiceIndex(index)
  }

  getVariable(name: string): unknown {
    if (!this.story) return null
    try {
      return this.story.variablesState.$(name)
    } catch {
      return null
    }
  }

  reset(): void {
    if (this.story) {
      this.story.ResetState()
    }
  }
}

// Parse ink tags for scene directives
export function parseInkTags(tags: string[]): Record<string, string> {
  const result: Record<string, string> = {}
  for (const tag of tags) {
    const parts = tag.split(':').map(s => s.trim())
    if (parts.length === 2) {
      result[parts[0]] = parts[1]
    } else {
      result[tag.trim()] = 'true'
    }
  }
  return result
}
