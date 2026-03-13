import React, { useCallback } from 'react'
import { useWorldMachine } from '../state/hooks/useWorldMachine'
import { StageProvider } from './providers/StageProvider'
import Shell from './Shell'
import type { LiveParameters } from '../atlas/types'

/**
 * App — root component.
 *
 * Wires XState machine → StageProvider → Shell.
 * The machine is the truth. The Shell renders the world.
 */

export default function App() {
  const [snapshot, send] = useWorldMachine()
  const ctx = snapshot.context

  const handleLiveParams = useCallback((params: LiveParameters) => {
    send({ type: 'LIVE_PARAMS_UPDATE', params })
  }, [send])

  return (
    <StageProvider onLiveParams={handleLiveParams}>
      <Shell
        send={send}
        scene={ctx.scene}
        lens={ctx.lens}
        time={ctx.time}
        future={ctx.future}
        roleId={ctx.roleId}
        compareMode={ctx.compareMode}
        bootstrap={ctx.bootstrap}
        householdImpact={ctx.householdImpact}
        whatIfResult={ctx.whatIfResult}
        liveParams={ctx.liveParams}
        discoveredConnections={ctx.discoveredConnections}
        worldMetrics={ctx.worldMetrics}
      />
    </StageProvider>
  )
}
