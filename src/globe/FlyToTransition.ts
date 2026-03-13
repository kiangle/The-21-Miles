import gsap from 'gsap'
import type { GlobeSceneAPI } from './GlobeScene'
import { FLY_TO_DURATION } from '../app/config/constants'

/**
 * Camera flies from space to a country.
 * During the transition, Three.js fades out and the 2D stage fades in.
 */

function latLngToVec3(lat: number, lng: number, dist: number) {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)
  return {
    x: -dist * Math.sin(phi) * Math.cos(theta),
    y: dist * Math.cos(phi),
    z: dist * Math.sin(phi) * Math.sin(theta),
  }
}

export function flyToCountry(
  globe: GlobeSceneAPI,
  lat: number,
  lng: number,
  onComplete: () => void,
  onCrossfadeStart?: () => void,
): gsap.core.Timeline {
  const target = latLngToVec3(lat, lng, 7)

  const tl = gsap.timeline({
    onComplete,
  })

  // Phase 1: Camera zooms toward the country
  tl.to(globe.camera.position, {
    x: target.x,
    y: target.y,
    z: target.z,
    duration: FLY_TO_DURATION * 0.7,
    ease: 'power2.inOut',
    onUpdate: () => {
      globe.camera.lookAt(0, 0, 0)
    },
  })

  // Phase 2: Crossfade — globe fades out, stage fades in
  tl.to({}, {
    duration: FLY_TO_DURATION * 0.3,
    onStart: () => {
      onCrossfadeStart?.()
    },
    onUpdate: function () {
      const progress = this.progress()
      globe.setOpacity(1 - progress)
    },
  })

  return tl
}
