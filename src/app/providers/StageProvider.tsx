import React, { createContext, useContext, useRef, useCallback, useEffect, useState } from 'react'
import { createGlobeScene, type GlobeSceneAPI } from '../../globe/GlobeScene'
import { InkEngine } from '../../narrative/InkEngine'
import { AudioEngine } from '../../audio/AudioEngine'
import { AtlasAdapter, getAtlas } from '../../atlas/AtlasAdapter'
import { LiveDataPoller } from '../../atlas/LiveDataPoller'
import { WORLD_ID } from '../config/constants'
import type { LiveParameters } from '../../atlas/types'

interface StageContextValue {
  globe: GlobeSceneAPI | null
  ink: InkEngine
  audio: AudioEngine
  atlas: AtlasAdapter
  initGlobe: (container: HTMLElement) => GlobeSceneAPI
  disposeGlobe: () => void
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
  const globeRef = useRef<GlobeSceneAPI | null>(null)
  const inkRef = useRef(new InkEngine())
  const audioRef = useRef(new AudioEngine())
  const pollerRef = useRef<LiveDataPoller | null>(null)
  const atlas = getAtlas()

  const initGlobe = useCallback((container: HTMLElement) => {
    if (globeRef.current) return globeRef.current
    const globe = createGlobeScene()
    globe.mount(container)
    globeRef.current = globe
    return globe
  }, [])

  const disposeGlobe = useCallback(() => {
    if (globeRef.current) {
      globeRef.current.dispose()
      globeRef.current = null
    }
  }, [])

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
      globeRef.current?.dispose()
      audioRef.current.dispose()
      pollerRef.current?.stop()
    }
  }, [])

  const value: StageContextValue = {
    globe: globeRef.current,
    ink: inkRef.current,
    audio: audioRef.current,
    atlas,
    initGlobe,
    disposeGlobe,
  }

  return <StageContext.Provider value={value}>{children}</StageContext.Provider>
}
