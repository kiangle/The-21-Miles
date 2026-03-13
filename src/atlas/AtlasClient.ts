import type {
  BootstrapResponse,
  CascadePathResponse,
  HouseholdImpactResponse,
  ConnectionCheckResponse,
  WhatIfResponse,
  LiveParameters,
} from './types'

/**
 * Atlas API client — talks to the real Atlas backend.
 * Activated when VITE_USE_MOCK !== 'true'.
 */
export class AtlasClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`)
    if (!res.ok) throw new Error(`Atlas ${path}: ${res.status}`)
    return res.json()
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`Atlas ${path}: ${res.status}`)
    return res.json()
  }

  async bootstrap(worldId: string, profileId?: string): Promise<BootstrapResponse> {
    const qs = profileId ? `?profile_id=${profileId}` : ''
    return this.get(`/explorer-bootstrap/${encodeURIComponent(worldId)}${qs}`)
  }

  async cascadePath(fromNodeId: string, worldId: string): Promise<CascadePathResponse> {
    return this.post('/cascade-path', { from_node_id: fromNodeId, world_id: worldId })
  }

  async householdImpact(
    profileId: string,
    worldId: string,
    stockLevels?: Record<string, number>,
  ): Promise<HouseholdImpactResponse> {
    return this.post('/household-impact', { profile_id: profileId, world_id: worldId, stock_levels: stockLevels })
  }

  async checkConnections(
    worldId: string,
    visitedNodeIds: string[],
    newNodeId: string,
  ): Promise<ConnectionCheckResponse> {
    return this.post('/check-connections', {
      world_id: worldId,
      visited_node_ids: visitedNodeIds,
      new_node_id: newNodeId,
    })
  }

  async whatIf(
    worldId: string,
    scenarioId: string,
    profileId?: string,
  ): Promise<WhatIfResponse> {
    return this.post('/what-if', {
      world_id: worldId,
      scenario_id: scenarioId,
      profile_id: profileId,
    })
  }

  async liveParameters(worldId: string): Promise<LiveParameters> {
    return this.get(`/live-parameters/${encodeURIComponent(worldId)}`)
  }
}
