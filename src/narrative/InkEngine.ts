import { Story } from 'inkjs'

/**
 * InkEngine — loads and runs ink narratives.
 *
 * Each world+country has its own .ink.json.
 * The engine injects live variables from Atlas.
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

export class InkEngine {
  private story: Story | null = null
  private loaded = false

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
