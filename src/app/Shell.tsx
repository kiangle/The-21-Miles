import React, { useRef, useEffect, useCallback, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useStage } from './providers/StageProvider'
import PixiStage from '../stage/scene/PixiStage'
import MapRoot from '../stage/map/MapRoot'
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

// Register ScrollTrigger
gsap.registerPlugin(ScrollTrigger)

/**
 * Shell — the single persistent world.
 *
 * No page transitions. No route changes. The world IS the UI.
 * Three.js globe → fly-to → MapLibre + deck.gl + Pixi stage → cascade → your month.
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
  const storyStageRef = useRef<HTMLDivElement>(null)
  const globeRef = useRef<GlobeSceneAPI | null>(null)
  const animFrameRef = useRef<number>(0)
  const lastTimeRef = useRef(0)
  const [stageVisible, setStageVisible] = useState(false)
  const [inkBeat, setInkBeat] = useState<InkBeat | null>(null)
  const [entryText, setEntryText] = useState('')
  const [showRoleSelect, setShowRoleSelect] = useState(false)
  const scrollTriggerRef = useRef<ScrollTrigger | null>(null)

  // ── Globe Init ──
  useEffect(() => {
    if (!globeContainerRef.current) return
    const globe = initGlobe(globeContainerRef.current)
    globeRef.current = globe

    lastTimeRef.current = performance.now()
    const animate = (now: number) => {
      const delta = (now - lastTimeRef.current) / 1000
      lastTimeRef.current = now
      globe.update(Math.min(delta, 0.05))
      animFrameRef.current = requestAnimationFrame(animate)
    }
    animFrameRef.current = requestAnimationFrame(animate)

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

  // ── Set markers from bootstrap data ──
  useEffect(() => {
    if (!bootstrap || !globeRef.current) return
    const countries = bootstrap.countries
    if (countries && countries.length > 0) {
      globeRef.current.setMarkersFromBootstrap(countries)
    }
  }, [bootstrap])

  // ── Entry scene: rupture then markers ──
  useEffect(() => {
    if (scene !== 'entry' || !globeRef.current || !bootstrap) return

    const globe = globeRef.current

    const ruptureTimer = setTimeout(() => {
      globe.triggerRupture()
      audio.init().then(() => audio.playRupture())
    }, 3000)

    const textTimer = setTimeout(() => {
      setEntryText('show')
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

  // ── ScrollTrigger for story progression ──
  useEffect(() => {
    if (!stageVisible || !storyStageRef.current) return

    const st = ScrollTrigger.create({
      trigger: storyStageRef.current,
      start: 'top top',
      end: '+=2000',
      pin: true,
      scrub: true,
      onUpdate: (self) => {
        const p = self.progress
        // Drive visual transitions through scroll
        if (p < 0.33) {
          // Detour phase — shipping visible
        } else if (p < 0.66) {
          // Medicine phase
          if (morphControllerActive()) {
            // Lens shift handled by field console
          }
        } else {
          // Household/compression phase
        }
      },
    })

    scrollTriggerRef.current = st

    return () => {
      st.kill()
      scrollTriggerRef.current = null
    }
  }, [stageVisible])

  function morphControllerActive() {
    return scene === 'cascade'
  }

  // ── Role selection (driven by bootstrap roles) ──
  const handleSelectRole = useCallback((role: 'nurse' | 'driver') => {
    const profileId = role === 'nurse' ? 'exposure_kenya_nurse' : 'exposure_kenya_driver'
    send({ type: 'SELECT_ROLE', roleId: role, profileId })
    setShowRoleSelect(false)

    // Load narrative from bootstrap narrative_pack
    const narrativePack = bootstrap?.narrative_pack || 'kenya'
    ink.load(narrativePack).then(() => {
      if (ink.isLoaded()) {
        // Inject runtime variables
        if (liveParams) {
          ink.injectAtlasVariables({
            crisisDay: liveParams.crisis_day,
            fuelPrice: (liveParams.parameters.kenya_diesel_ksh?.value as number) ?? 279,
            fuelPricePre: 180,
          })
        }
        ink.goToKnot(role === 'nurse' ? 'nurse_intro' : 'driver_intro')
        const beat = ink.continue()
        if (beat) setInkBeat(beat)
      }
    })

    atlas.householdImpact(profileId, WORLD_ID).then(data => {
      send({ type: 'HOUSEHOLD_IMPACT_RECEIVED', data })
    })

    audio.init().then(() => audio.playAmbient())
  }, [send, ink, atlas, audio, bootstrap, liveParams])

  // ── Ink choices ──
  const handleInkChoice = useCallback((choiceIndex: number) => {
    ink.choose(choiceIndex)
    const beat = ink.continue()
    if (beat) {
      setInkBeat(beat)

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
        if (tag.startsWith('DISCOVERY:')) {
          atlas.checkConnections(WORLD_ID, [], '').then(result => {
            if (result.newly_discovered.length > 0) {
              send({ type: 'CONNECTION_DISCOVERED', connections: result.newly_discovered })
            }
          })
        }
        if (tag.startsWith('FUTURE:')) {
          const futureId = tag.replace('FUTURE:', '').trim()
          const futureMap: Record<string, FutureId> = { redSea: 'redSea', reserves: 'reserves', ceasefire: 'closureEnds' }
          const fid = futureMap[futureId]
          if (fid) {
            send({ type: 'SET_FUTURE', future: fid })
            const scenarioId = futureId === 'redSea' ? 'whatif_redsea' : futureId === 'reserves' ? 'whatif_reserves' : 'whatif_ceasefire'
            atlas.whatIf(WORLD_ID, scenarioId, roleId === 'nurse' ? 'exposure_kenya_nurse' : 'exposure_kenya_driver')
              .then(data => send({ type: 'WHAT_IF_RECEIVED', data }))
          }
        }
        if (tag === 'SPLIT_SCREEN: true') send({ type: 'TOGGLE_COMPARE' })
        if (tag === 'GENERATE_CLIP: true') send({ type: 'ADVANCE_SCENE', scene: 'share' })
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

  // Build what-if options from bootstrap future_paths if available, otherwise from what_if_scenarios
  const whatIfOptions: WhatIfSummary[] = bootstrap?.future_paths
    ? bootstrap.future_paths.map(fp => ({
      id: fp.id === 'redSea' ? 'whatif_redsea' : fp.id === 'reserves' ? 'whatif_reserves' : 'whatif_ceasefire',
      label: fp.label,
      hint: fp.hint,
      node_type: 'move',
      direction: fp.direction === 'worse' ? 'worsens' as const : 'improves' as const,
      probability: fp.probability,
    }))
    : bootstrap?.what_if_scenarios ?? []

  // Build role data from bootstrap
  const roles = bootstrap?.roles?.filter(r => r.country_id === 'kenya') ?? []

  return (
    <div style={{
      position: 'relative',
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      background: COLORS.dark,
    }}>
      {/* Three.js Globe Layer */}
      <div ref={globeContainerRef} style={{
        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1,
      }} />

      {/* Entry text — Instrument Serif for title, Instrument Sans for prompt */}
      {entryText && (
        <div style={{
          position: 'absolute', top: '42%', left: '50%',
          transform: 'translate(-50%, -50%)', zIndex: 10,
          textAlign: 'center', animation: 'fadeIn 1.5s ease',
          pointerEvents: 'none',
        }}>
          <h1 style={{
            color: COLORS.textPrimary, fontSize: 48, fontWeight: 400,
            letterSpacing: 4, margin: 0,
            fontFamily: "'Instrument Serif', Georgia, serif",
            textShadow: '0 2px 20px rgba(10,10,18,0.8)',
          }}>
            21 miles
          </h1>
          <p style={{
            color: COLORS.textSecondary, fontSize: 16, marginTop: 12,
            letterSpacing: 1,
            fontFamily: "'Instrument Sans', system-ui, sans-serif",
          }}>
            A distant channel is already inside your month.
          </p>
          <p style={{
            color: COLORS.gold, fontSize: 14, marginTop: 24,
            letterSpacing: 0.5, opacity: 0.9,
            fontFamily: "'Instrument Sans', system-ui, sans-serif",
            animation: 'fadeIn 2s ease 0.5s both',
          }}>
            Start in Kenya
          </p>
        </div>
      )}

      {/* Role selection — driven by bootstrap roles */}
      {showRoleSelect && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          zIndex: 15, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 16,
          background: 'rgba(10, 10, 18, 0.5)',
          animation: 'fadeIn 0.8s ease',
        }}>
          <p style={{
            color: COLORS.textSecondary, fontSize: 14, margin: 0,
            fontFamily: "'Instrument Sans', system-ui, sans-serif",
          }}>Kenya</p>
          {roles.length > 0 ? (
            roles.map(role => (
              <button
                key={role.id}
                onClick={() => handleSelectRole(role.id as 'nurse' | 'driver')}
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
                  fontFamily: "'Instrument Sans', system-ui, sans-serif",
                }}
              >
                See through {role.short_label === 'Nurse' ? "Amara's" : "Joseph's"} eyes
                <br />
                <span style={{ fontSize: 12, color: COLORS.textSecondary }}>{role.short_label}, {role.id === 'nurse' ? 'Nairobi' : 'Mombasa road'}</span>
              </button>
            ))
          ) : (
            <>
              <button onClick={() => handleSelectRole('nurse')} style={{
                padding: '14px 28px', background: 'rgba(200, 169, 110, 0.12)',
                border: `1px solid ${COLORS.gold}44`, borderRadius: 12,
                color: COLORS.gold, fontSize: 16, cursor: 'pointer', width: 280, textAlign: 'left',
                fontFamily: "'Instrument Sans', system-ui, sans-serif",
              }}>
                See through Amara's eyes<br />
                <span style={{ fontSize: 12, color: COLORS.textSecondary }}>Nurse, Nairobi</span>
              </button>
              <button onClick={() => handleSelectRole('driver')} style={{
                padding: '14px 28px', background: 'rgba(200, 169, 110, 0.12)',
                border: `1px solid ${COLORS.gold}44`, borderRadius: 12,
                color: COLORS.gold, fontSize: 16, cursor: 'pointer', width: 280, textAlign: 'left',
                fontFamily: "'Instrument Sans', system-ui, sans-serif",
              }}>
                See through Joseph's eyes<br />
                <span style={{ fontSize: 12, color: COLORS.textSecondary }}>Truck driver, Mombasa road</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* MapLibre + deck.gl Landing Stage — below overlays, pointer-events: none to not block tray */}
      <MapRoot
        visible={stageVisible}
        bootstrap={bootstrap}
        countryId="kenya"
        ruptured={scene === 'rupture' || scene === 'detour' || scene === 'cascade' || scene === 'yourMonth' || scene === 'whatNext' || scene === 'split'}
        lens={lens}
      />

      {/* Pixi Stage — 2D living world. Receives time/future/roleId so tray controls change the world */}
      <PixiStage
        scene={scene}
        lens={lens}
        time={time}
        future={future}
        roleId={roleId}
        compareMode={compareMode}
        supplyLevel={worldMetrics.medicinePressure}
        erosionPct={householdImpact ? householdImpact.pct_of_income.base : 0}
        visible={stageVisible}
      />

      {/* Story stage container for ScrollTrigger */}
      <div ref={storyStageRef} className="story-stage" style={{
        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
        zIndex: 0, pointerEvents: 'none',
      }} />

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
        future={future}
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
          position: 'absolute', top: 20, left: 20, zIndex: 50,
          background: 'rgba(10, 10, 18, 0.6)', border: 'none',
          borderRadius: '50%', width: 36, height: 36,
          color: COLORS.textSecondary, fontSize: 14, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Instrument Sans', system-ui, sans-serif",
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
