import type { WorldContext, SceneId, LensId } from './worldContext'

export const selectScene = (ctx: WorldContext): SceneId => ctx.scene
export const selectLens = (ctx: WorldContext): LensId => ctx.lens
export const selectCountry = (ctx: WorldContext) => ctx.countryId
export const selectRole = (ctx: WorldContext) => ctx.roleId
export const selectProfile = (ctx: WorldContext) => ctx.profileId
export const selectFuture = (ctx: WorldContext) => ctx.future
export const selectCompareMode = (ctx: WorldContext) => ctx.compareMode
export const selectMetrics = (ctx: WorldContext) => ctx.worldMetrics
export const selectLiveParams = (ctx: WorldContext) => ctx.liveParams
export const selectBootstrap = (ctx: WorldContext) => ctx.bootstrap
export const selectHouseholdImpact = (ctx: WorldContext) => ctx.householdImpact
export const selectWhatIfResult = (ctx: WorldContext) => ctx.whatIfResult
export const selectDiscoveredConnections = (ctx: WorldContext) => ctx.discoveredConnections
export const selectInkKnot = (ctx: WorldContext) => ctx.inkKnot
export const selectPlaying = (ctx: WorldContext) => ctx.playing
export const selectVisitedNodes = (ctx: WorldContext) => ctx.visitedNodeIds
export const selectCurrentCascade = (ctx: WorldContext) => ctx.currentCascade
