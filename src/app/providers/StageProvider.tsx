import React, { createContext, useContext, useRef, useEffect } from 'react'
import { InkEngine } from '../../narrative/InkEngine'
import { AudioEngine } from '../../audio/AudioEngine'
import { AtlasAdapter, getAtlas } from '../../atlas/AtlasAdapter'
import { LiveDataPoller } from '../../atlas/LiveDataPoller'
import { WORLD_ID } from '../config/constants'
import type { LiveParameters } from '../../atlas/types'

/**
 * StageProvider — shared services for the world.
 *
 * No longer manages a Three.js globe.
 * MapLibre globe is now managed directly by MapRoot.
 * This provider gives: Ink, Audio, Atlas.
 */

interface StageContextValue {
  ink: InkEngine
  audio: AudioEngine
  atlas: AtlasAdapter
}

const StageContext = createContext<StageContextValue | null>(null)

export function useStage(): StageContextValue {
  const ctx = useContext(StageContext)
  if (!ctx) throw new Error('useStage must be inside StageProvider')
  return ctx
}

interface Props {
  children: React.ReactNode
  onLiveParams?: (params: LiveParameters) => void
}

export function StageProvider({ children, onLiveParams }: Props) {
  const inkRef = useRef(new InkEngine())
  const audioRef = useRef(new AudioEngine())
  const pollerRef = useRef<LiveDataPoller | null>(null)
  const atlas = getAtlas()

  // Start live data poller
  useEffect(() => {
    if (onLiveParams) {
      const poller = new LiveDataPoller(WORLD_ID, onLiveParams)
      poller.start()
      pollerRef.current = poller
      return () => poller.stop()
    }
  }, [onLiveParams])

  // Cleanup
  useEffect(() => {
    return () => {
      audioRef.current.dispose()
      pollerRef.current?.stop()
    }
  }, [])

  const value: StageContextValue = {
    ink: inkRef.current,
    audio: audioRef.current,
    atlas,
  }

  return <StageContext.Provider value={value}>{children}</StageContext.Provider>
}
