import * as THREE from 'three'
import { GLOBE_RADIUS, COLORS } from '../app/config/constants'

/**
 * Red pulse emanating from Hormuz when the strait closes.
 * An expanding ring on the globe surface + a point glow.
 */

function latLngToVec3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  )
}

export interface RuptureEffectSystem {
  group: THREE.Group
  trigger: () => void
  update: (delta: number) => void
  dispose: () => void
  isActive: boolean
}

export function createRuptureEffect(): RuptureEffectSystem {
  const group = new THREE.Group()
  const hormuzPos = latLngToVec3(26.5, 56.3, GLOBE_RADIUS + 0.03)

  // Glow sphere at Hormuz
  const glowGeo = new THREE.SphereGeometry(0.08, 16, 16)
  const glowMat = new THREE.MeshBasicMaterial({
    color: COLORS.rupture,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
  })
  const glow = new THREE.Mesh(glowGeo, glowMat)
  glow.position.copy(hormuzPos)
  group.add(glow)

  // Expanding ring — implemented as a torus
  const ringGeo = new THREE.TorusGeometry(0.01, 0.005, 8, 64)
  const ringMat = new THREE.MeshBasicMaterial({
    color: COLORS.rupture,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
  })
  const ring = new THREE.Mesh(ringGeo, ringMat)
  ring.position.copy(hormuzPos)
  // Orient ring to be tangent to the globe at Hormuz
  ring.lookAt(new THREE.Vector3(0, 0, 0))
  group.add(ring)

  let active = false
  let elapsed = 0
  const PULSE_DURATION = 3 // seconds

  function trigger() {
    active = true
    elapsed = 0
    glowMat.opacity = 0
    ringMat.opacity = 0
  }

  function update(delta: number) {
    if (!active) return

    elapsed += delta
    const t = elapsed / PULSE_DURATION

    if (t > 1) {
      // Keep glow pulsing after initial pulse
      const pulse = 0.5 + 0.3 * Math.sin(elapsed * 3)
      glowMat.opacity = pulse
      glow.scale.setScalar(1 + 0.2 * Math.sin(elapsed * 3))
      ringMat.opacity = 0
      return
    }

    // Glow ramps up fast
    glowMat.opacity = Math.min(t * 4, 1)
    glow.scale.setScalar(1 + t * 0.5)

    // Ring expands
    const ringScale = 1 + t * 80
    ring.scale.setScalar(ringScale)
    ringMat.opacity = Math.max(1 - t * 1.5, 0)
  }

  function dispose() {
    glowGeo.dispose()
    glowMat.dispose()
    ringGeo.dispose()
    ringMat.dispose()
  }

  return {
    group,
    trigger,
    update,
    dispose,
    get isActive() { return active },
  }
}
