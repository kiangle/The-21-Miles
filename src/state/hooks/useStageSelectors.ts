import { useSelector } from '@xstate/react'
import type { ActorRefFrom } from 'xstate'
import type { worldMachine } from '../machine/worldMachine'
import * as sel from '../machine/selectors'

type WorldActor = ActorRefFrom<typeof worldMachine>

export function useScene(actor: WorldActor) {
  return useSelector(actor, (snap) => sel.selectScene(snap.context))
}
export function useLens(actor: WorldActor) {
  return useSelector(actor, (snap) => sel.selectLens(snap.context))
}
export function useCountry(actor: WorldActor) {
  return useSelector(actor, (snap) => sel.selectCountry(snap.context))
}
export function useRole(actor: WorldActor) {
  return useSelector(actor, (snap) => sel.selectRole(snap.context))
}
export function useFuture(actor: WorldActor) {
  return useSelector(actor, (snap) => sel.selectFuture(snap.context))
}
export function useCompareMode(actor: WorldActor) {
  return useSelector(actor, (snap) => sel.selectCompareMode(snap.context))
}
export function useMetrics(actor: WorldActor) {
  return useSelector(actor, (snap) => sel.selectMetrics(snap.context))
}
export function useLiveParams(actor: WorldActor) {
  return useSelector(actor, (snap) => sel.selectLiveParams(snap.context))
}
export function useBootstrap(actor: WorldActor) {
  return useSelector(actor, (snap) => sel.selectBootstrap(snap.context))
}
export function useHouseholdImpact(actor: WorldActor) {
  return useSelector(actor, (snap) => sel.selectHouseholdImpact(snap.context))
}
export function useWhatIfResult(actor: WorldActor) {
  return useSelector(actor, (snap) => sel.selectWhatIfResult(snap.context))
}
export function useDiscoveredConnections(actor: WorldActor) {
  return useSelector(actor, (snap) => sel.selectDiscoveredConnections(snap.context))
}
export function useInkKnot(actor: WorldActor) {
  return useSelector(actor, (snap) => sel.selectInkKnot(snap.context))
}
export function usePlaying(actor: WorldActor) {
  return useSelector(actor, (snap) => sel.selectPlaying(snap.context))
}
