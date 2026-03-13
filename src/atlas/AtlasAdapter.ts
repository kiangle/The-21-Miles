import type {
  BootstrapResponse,
  CascadePathResponse,
  HouseholdImpactResponse,
  ConnectionCheckResponse,
  WhatIfResponse,
  LiveParameters,
} from './types'
import { AtlasClient } from './AtlasClient'
import { handleRequest } from './mock/kenyaMock'

/**
 * AtlasAdapter — the ONLY data gateway.
 *
 * Every piece of world truth flows through here.
 * Mock adapter returns the same shapes as the live API.
 * The app never knows which one is active.
 */
export class AtlasAdapter {
  private client: AtlasClient | null
  private useMock: boolean

  constructor() {
    this.useMock = import.meta.env.VITE_USE_MOCK !== 'false'
    this.client = this.useMock
      ? null
      : new AtlasClient(import.meta.env.VITE_ATLAS_URL || 'https://atlas.kiangle.com/api')
  }

  async bootstrap(worldId: string, profileId?: string): Promise<BootstrapResponse> {
    if (this.useMock) {
      const qs = profileId ? `?profile_id=${profileId}` : ''
      return handleRequest('GET', `/explorer-bootstrap/${worldId}${qs}`, null) as Promise<BootstrapResponse>
    }
    return this.client!.bootstrap(worldId, profileId)
  }

  async cascadePath(fromNodeId: string, worldId: string): Promise<CascadePathResponse> {
    if (this.useMock) {
      return handleRequest('POST', '/cascade-path', { from_node_id: fromNodeId, world_id: worldId }) as Promise<CascadePathResponse>
    }
    return this.client!.cascadePath(fromNodeId, worldId)
  }

  async householdImpact(
    profileId: string,
    worldId: string,
    stockLevels?: Record<string, number>,
  ): Promise<HouseholdImpactResponse> {
    if (this.useMock) {
      return handleRequest('POST', '/household-impact', {
        profile_id: profileId,
        world_id: worldId,
        stock_levels: stockLevels,
      }) as Promise<HouseholdImpactResponse>
    }
    return this.client!.householdImpact(profileId, worldId, stockLevels)
  }

  async checkConnections(
    worldId: string,
    visitedNodeIds: string[],
    newNodeId: string,
  ): Promise<ConnectionCheckResponse> {
    if (this.useMock) {
      return handleRequest('POST', '/check-connections', {
        world_id: worldId,
        visited_node_ids: visitedNodeIds,
        new_node_id: newNodeId,
      }) as Promise<ConnectionCheckResponse>
    }
    return this.client!.checkConnections(worldId, visitedNodeIds, newNodeId)
  }

  async whatIf(
    worldId: string,
    scenarioId: string,
    profileId?: string,
  ): Promise<WhatIfResponse> {
    if (this.useMock) {
      return handleRequest('POST', '/what-if', {
        world_id: worldId,
        scenario_id: scenarioId,
        profile_id: profileId,
      }) as Promise<WhatIfResponse>
    }
    return this.client!.whatIf(worldId, scenarioId, profileId)
  }

  async liveParameters(worldId: string): Promise<LiveParameters> {
    if (this.useMock) {
      return handleRequest('GET', `/live-parameters/${worldId}`, null) as Promise<LiveParameters>
    }
    return this.client!.liveParameters(worldId)
  }
}

// Singleton
let _adapter: AtlasAdapter | null = null
export function getAtlas(): AtlasAdapter {
  if (!_adapter) _adapter = new AtlasAdapter()
  return _adapter
}
