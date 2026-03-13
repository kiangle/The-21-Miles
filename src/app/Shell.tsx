import React, { useRef, useEffect, useCallback, useState } from 'react'
import { useStage } from './providers/StageProvider'
import PixiStage from '../stage/scene/PixiStage'
import NarrativeCaption from '../overlays/NarrativeCaption'
import LiveDataPulse from '../overlays/LiveDataPulse'
import CompressionChamber from '../overlays/CompressionChamber'
import ComparePanel from '../overlays/ComparePanel'
import ConnectionReveal from '../overlays/ConnectionReveal'
import FieldConsole from '../gameplay/console/FieldConsole'
import ShareGenerator from '../gameplay/interactions/ShareGenerator'
import { flyToCountry } from '../globe/FlyToTransition'
import { WORLD_ID, NAIROBI, COLORS } from './config/constants'
import type { SceneId, LensId, TimeId, FutureId } from '../state/machine/worldContext'
import type { BootstrapResponse, HouseholdImpactResponse, WhatIfResponse, LiveParameters, ConnectionDiscovery, WhatIfSummary } from '../atlas/types'
import type { WorldEvent } from '../state/machine/worldEvents'
import type { GlobeSceneAPI } from '../globe/GlobeScene'
import type { InkBeat } from '../narrative/InkEngine'

/**
 * Shell — the single persistent world.
 *
 * No page transitions. No route changes. The world IS the UI.
 * Three.js globe → fly-to → MapLibre + Pixi stage → cascade → your month.
 */

interface Props {
  send: (event: WorldEvent) => void
  scene: SceneId
  lens: LensId
  time: TimeId
  future: FutureId
  roleId: 'nurse' | 'driver' | null
  compareMode: boolean
  bootstrap: BootstrapResponse | null
  householdImpact: HouseholdImpactResponse | null
  whatIfResult: WhatIfResponse | null
  liveParams: LiveParameters | null
  discoveredConnections: ConnectionDiscovery[]
  worldMetrics: { monthlyHitKsh: number; crisisDay: number; medicinePressure: number; oilPriceUsd: number }
}

export default function Shell({
  send, scene, lens, time, future, roleId, compareMode,
  bootstrap, householdImpact, whatIfResult, liveParams,
  discoveredConnections, worldMetrics,
}: Props) {
  const { initGlobe, disposeGlobe, ink, audio, atlas } = useStage()
  const globeContainerRef = useRef<HTMLDivElement>(null)
  const globeRef = useRef<GlobeSceneAPI | null>(null)
  const animFrameRef = useRef<number>(0)
  const lastTimeRef = useRef(0)
  const [stageVisible, setStageVisible] = useState(false)
  const [inkBeat, setInkBeat] = useState<InkBeat | null>(null)
  const [entryText, setEntryText] = useState('')
  const [showRoleSelect, setShowRoleSelect] = useState(false)

  // ── Globe Init ──
  useEffect(() => {
    if (!globeContainerRef.current) return
    const globe = initGlobe(globeContainerRef.current)
    globeRef.current = globe

    // Start render loop
    lastTimeRef.current = performance.now()
    const animate = (now: number) => {
      const delta = (now - lastTimeRef.current) / 1000
      lastTimeRef.current = now
      globe.update(Math.min(delta, 0.05))
      animFrameRef.current = requestAnimationFrame(animate)
    }
    animFrameRef.current = requestAnimationFrame(animate)

    // Handle resize
    const onResize = () => globe.resize(window.innerWidth, window.innerHeight)
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      window.removeEventListener('resize', onResize)
    }
  }, [initGlobe])

  // ── Bootstrap ──
  useEffect(() => {
    atlas.bootstrap(WORLD_ID, 'exposure_kenya_nurse').then(data => {
      send({ type: 'BOOTSTRAP_LOADED', data })
    })
  }, [atlas, send])

  // ── Entry scene: rupture then markers ──
  useEffect(() => {
    if (scene !== 'entry' || !globeRef.current || !bootstrap) return

    const globe = globeRef.current

    // After 3 seconds, trigger rupture
    const ruptureTimer = setTimeout(() => {
      globe.triggerRupture()
      audio.init().then(() => audio.playRupture())
    }, 3000)

    // After 6 seconds, show text and markers
    const textTimer = setTimeout(() => {
      setEntryText('21 miles. Where do you live?')
      globe.showMarkers()
    }, 6000)

    return () => {
      clearTimeout(ruptureTimer)
      clearTimeout(textTimer)
    }
  }, [scene, bootstrap, audio])

  // ── Country selection via globe click ──
  useEffect(() => {
    if (scene !== 'entry' || !globeRef.current) return

    const globe = globeRef.current
    const onClick = (e: MouseEvent) => {
      const marker = globe.getMarkerAtScreen(e.clientX, e.clientY)
      if (marker && marker.id === 'kenya') {
        send({ type: 'SELECT_COUNTRY', countryId: 'kenya' })
      }
    }
    globe.renderer.domElement.addEventListener('click', onClick)
    return () => globe.renderer.domElement.removeEventListener('click', onClick)
  }, [scene, send])

  // ── Fly-to transition ──
  useEffect(() => {
    if (scene !== 'flyTo' || !globeRef.current) return
    const globe = globeRef.current
    setEntryText('')
    globe.hideMarkers()

    flyToCountry(
      globe,
      NAIROBI.lat,
      NAIROBI.lng,
      () => {
        setStageVisible(true)
        setShowRoleSelect(true)
        disposeGlobe()
      },
      () => {
        setStageVisible(true)
      },
    )
  }, [scene, disposeGlobe])

  // ── Role selection ──
  const handleSelectRole = useCallback((role: 'nurse' | 'driver') => {
    const profileId = role === 'nurse' ? 'exposure_kenya_nurse' : 'exposure_kenya_driver'
    send({ type: 'SELECT_ROLE', roleId: role, profileId })
    setShowRoleSelect(false)

    // Load ink narrative
    ink.load('kenya').then(() => {
      if (ink.isLoaded()) {
        ink.goToKnot(role === 'nurse' ? 'nurse_intro' : 'driver_intro')
        const beat = ink.continue()
        if (beat) setInkBeat(beat)
      }
    })

    // Fetch household impact
    atlas.householdImpact(profileId, WORLD_ID).then(data => {
      send({ type: 'HOUSEHOLD_IMPACT_RECEIVED', data })
    })

    audio.init().then(() => audio.playAmbient())
  }, [send, ink, atlas, audio])

  // ── Ink choices ──
  const handleInkChoice = useCallback((choiceIndex: number) => {
    ink.choose(choiceIndex)
    const beat = ink.continue()
    if (beat) {
      setInkBeat(beat)

      // Parse tags for scene directives
      for (const tag of beat.tags) {
        if (tag.startsWith('SCENE:')) {
          const targetScene = tag.replace('SCENE:', '').trim()
          send({ type: 'ADVANCE_SCENE', scene: targetScene as SceneId })
        }
        if (tag.startsWith('SOUND:')) {
          const sound = tag.replace('SOUND:', '').trim()
          if (sound === 'pressure_buildup') audio.playRupture()
          if (sound === 'domain_crossing') audio.playDomainCrossing(lens)
          if (sound === 'discovery_chord') audio.playDiscoveryChord()
          if (sound === 'walls_closing') audio.playCompression()
          if (sound === 'splitting_tone') audio.playForkSplit()
        }
        if (tag.startsWith('MORPH:')) {
          // Cascade morph hint — handled by lens change
        }
        if (tag.startsWith('DISCOVERY:')) {
          // Check for connections
          atlas.checkConnections(WORLD_ID, [], '').then(result => {
            if (result.newly_discovered.length > 0) {
              send({ type: 'CONNECTION_DISCOVERED', connections: result.newly_discovered })
            }
          })
        }
        if (tag.startsWith('FUTURE:')) {
          const futureId = tag.replace('FUTURE:', '').trim()
          const futureMap: Record<string, FutureId> = {
            'redSea': 'redSea',
            'reserves': 'reserves',
            'ceasefire': 'closureEnds',
          }
          const fid = futureMap[futureId]
          if (fid) {
            send({ type: 'SET_FUTURE', future: fid })
            // Fetch what-if
            const scenarioId = futureId === 'redSea' ? 'whatif_redsea'
              : futureId === 'reserves' ? 'whatif_reserves'
              : 'whatif_ceasefire'
            atlas.whatIf(WORLD_ID, scenarioId, roleId === 'nurse' ? 'exposure_kenya_nurse' : 'exposure_kenya_driver')
              .then(data => send({ type: 'WHAT_IF_RECEIVED', data }))
          }
        }
        if (tag === 'SPLIT_SCREEN: true') {
          send({ type: 'TOGGLE_COMPARE' })
        }
        if (tag === 'GENERATE_CLIP: true') {
          send({ type: 'ADVANCE_SCENE', scene: 'share' })
        }
      }
    }
  }, [ink, send, audio, atlas, lens, roleId])

  // ── Field console handlers ──
  const handleLens = useCallback((l: LensId) => send({ type: 'SET_LENS', lens: l }), [send])
  const handleTime = useCallback((t: TimeId) => send({ type: 'SET_TIME', time: t }), [send])
  const handleFuture = useCallback((f: FutureId) => {
    send({ type: 'SET_FUTURE', future: f })
    const scenarioId = f === 'redSea' ? 'whatif_redsea' : f === 'reserves' ? 'whatif_reserves' : 'whatif_ceasefire'
    atlas.whatIf(WORLD_ID, scenarioId, roleId === 'nurse' ? 'exposure_kenya_nurse' : 'exposure_kenya_driver')
      .then(data => send({ type: 'WHAT_IF_RECEIVED', data }))
  }, [send, atlas, roleId])
  const handleSwitchPerspective = useCallback(() => send({ type: 'SWITCH_PERSPECTIVE' }), [send])

  const showFieldConsole = ['baseline', 'rupture', 'detour', 'cascade', 'yourMonth', 'whatNext', 'split'].includes(scene)
  const whatIfOptions: WhatIfSummary[] = bootstrap?.what_if_scenarios ?? []

  return (
    <div style={{
      position: 'relative',
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      background: COLORS.dark,
      fontFamily: 'Inter, sans-serif',
    }}>
      {/* Three.js Globe Layer */}
      <div
        ref={globeContainerRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 1,
        }}
      />

      {/* Entry text */}
      {entryText && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 10,
          textAlign: 'center',
          animation: 'fadeIn 1.5s ease',
        }}>
          <h1 style={{
            color: COLORS.textPrimary,
            fontSize: 42,
            fontWeight: 300,
            letterSpacing: 4,
            margin: 0,
          }}>
            21 miles
          </h1>
          <p style={{
            color: COLORS.textSecondary,
            fontSize: 18,
            marginTop: 12,
            letterSpacing: 1,
          }}>
            Where do you live?
          </p>
        </div>
      )}

      {/* Role selection */}
      {showRoleSelect && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 15,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          alignItems: 'center',
        }}>
          <p style={{ color: COLORS.textSecondary, fontSize: 14, margin: 0 }}>Kenya</p>
          <button
            onClick={() => handleSelectRole('nurse')}
            style={{
              padding: '14px 28px',
              background: 'rgba(200, 169, 110, 0.12)',
              border: `1px solid ${COLORS.gold}44`,
              borderRadius: 12,
              color: COLORS.gold,
              fontSize: 16,
              cursor: 'pointer',
              width: 280,
              textAlign: 'left',
            }}
          >
            See through Amara's eyes
            <br />
            <span style={{ fontSize: 12, color: COLORS.textSecondary }}>Nurse, Nairobi</span>
          </button>
          <button
            onClick={() => handleSelectRole('driver')}
            style={{
              padding: '14px 28px',
              background: 'rgba(200, 169, 110, 0.12)',
              border: `1px solid ${COLORS.gold}44`,
              borderRadius: 12,
              color: COLORS.gold,
              fontSize: 16,
              cursor: 'pointer',
              width: 280,
              textAlign: 'left',
            }}
          >
            See through Joseph's eyes
            <br />
            <span style={{ fontSize: 12, color: COLORS.textSecondary }}>Truck driver, Mombasa road</span>
          </button>
        </div>
      )}

      {/* Pixi Stage — 2D living world */}
      <PixiStage
        scene={scene}
        lens={lens}
        compareMode={compareMode}
        supplyLevel={worldMetrics.medicinePressure}
        erosionPct={householdImpact ? householdImpact.pct_of_income.base : 0}
        visible={stageVisible}
      />

      {/* Narrative captions */}
      <NarrativeCaption
        text={inkBeat?.text ?? ''}
        choices={inkBeat?.choices ?? []}
        onChoose={handleInkChoice}
        visible={stageVisible && !!inkBeat?.text}
      />

      {/* Live data pulse */}
      <LiveDataPulse liveParams={liveParams} visible={stageVisible} />

      {/* Compression chamber — "Your month" */}
      <CompressionChamber
        impact={householdImpact}
        visible={scene === 'yourMonth'}
        currency={householdImpact?.currency ?? 'KSh'}
      />

      {/* Compare panel */}
      <ComparePanel
        whatIf={whatIfResult}
        visible={compareMode && !!whatIfResult}
      />

      {/* Connection reveals */}
      <ConnectionReveal
        connections={discoveredConnections}
        visible={discoveredConnections.length > 0}
      />

      {/* Share */}
      <ShareGenerator
        currency={householdImpact?.currency ?? 'KSh'}
        monthlyHit={worldMetrics.monthlyHitKsh}
        monthlyHitPct={householdImpact?.pct_of_income.base ?? 29}
        crisisDay={worldMetrics.crisisDay}
        roleName={roleId === 'nurse' ? 'Amara' : 'Joseph'}
        visible={scene === 'share'}
      />

      {/* Field Console */}
      <FieldConsole
        lens={lens}
        time={time}
        future={future}
        roleId={roleId}
        whatIfOptions={whatIfOptions}
        visible={showFieldConsole}
        onLens={handleLens}
        onTime={handleTime}
        onFuture={handleFuture}
        onSwitchPerspective={handleSwitchPerspective}
      />

      {/* Sound toggle */}
      <button
        onClick={() => audio.setMuted(true)}
        style={{
          position: 'absolute',
          top: 20,
          left: 20,
          zIndex: 50,
          background: 'rgba(10, 10, 18, 0.6)',
          border: 'none',
          borderRadius: '50%',
          width: 36,
          height: 36,
          color: COLORS.textSecondary,
          fontSize: 14,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-label="Toggle sound"
      >
        ♪
      </button>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
