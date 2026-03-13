import { useMachine } from '@xstate/react'
import { worldMachine } from '../machine/worldMachine'

export function useWorldMachine() {
  return useMachine(worldMachine)
}
