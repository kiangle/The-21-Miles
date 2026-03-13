import * as THREE from 'three'
import { GLOBE_RADIUS, COLORS } from '../app/config/constants'

/**
 * Red pulse at Hormuz when the strait closes.
 * Visible from opening camera — large glow + expanding rings + sprite halo.
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
  const hormuzPos = latLngToVec3(26.5, 56.3, GLOBE_RADIUS + 0.05)
  const hormuzNormal = hormuzPos.clone().normalize()

  // Core glow sphere — larger than before
  const glowGeo = new THREE.SphereGeometry(0.15, 16, 16)
  const glowMat = new THREE.MeshBasicMaterial({
    color: COLORS.rupture,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const glow = new THREE.Mesh(glowGeo, glowMat)
  glow.position.copy(hormuzPos)
  group.add(glow)

  // Halo sprite for bloom-like aura
  const spriteMat = new THREE.SpriteMaterial({
    color: new THREE.Color('#ff6633'),
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const haloSprite = new THREE.Sprite(spriteMat)
  haloSprite.position.copy(hormuzPos)
  haloSprite.scale.setScalar(0.5)
  group.add(haloSprite)

  // Expanding ring 1
  const ringGeo = new THREE.TorusGeometry(0.02, 0.008, 8, 64)
  const ringMat = new THREE.MeshBasicMaterial({
    color: COLORS.rupture,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const ring1 = new THREE.Mesh(ringGeo, ringMat)
  ring1.position.copy(hormuzPos)
  ring1.lookAt(new THREE.Vector3(0, 0, 0))
  group.add(ring1)

  // Expanding ring 2 (delayed)
  const ringMat2 = ringMat.clone()
  const ring2 = new THREE.Mesh(ringGeo, ringMat2)
  ring2.position.copy(hormuzPos)
  ring2.lookAt(new THREE.Vector3(0, 0, 0))
  group.add(ring2)

  let active = false
  let elapsed = 0

  function trigger() {
    active = true
    elapsed = 0
  }

  function update(delta: number) {
    if (!active) return

    elapsed += delta

    // Phase 1: Initial burst (0-3s)
    if (elapsed < 3) {
      const t = elapsed / 3

      // Glow ramps up fast and grows
      glowMat.opacity = Math.min(t * 4, 1) * 0.9
      glow.scale.setScalar(1 + t * 1.5)

      // Halo grows
      spriteMat.opacity = Math.min(t * 3, 0.7)
      haloSprite.scale.setScalar(0.5 + t * 2)

      // Ring 1 expands
      const ringScale = 1 + t * 100
      ring1.scale.setScalar(ringScale)
      ringMat.opacity = Math.max(0.8 - t * 0.4, 0)

      // Ring 2 (delayed by 0.5s)
      if (elapsed > 0.5) {
        const t2 = (elapsed - 0.5) / 2.5
        ring2.scale.setScalar(1 + t2 * 80)
        ringMat2.opacity = Math.max(0.6 - t2 * 0.4, 0)
      }
    } else {
      // Phase 2: Persistent pulsing
      const pulse = 0.5 + 0.4 * Math.sin(elapsed * 3)
      const pulse2 = 0.3 + 0.2 * Math.sin(elapsed * 2.1 + 1)

      glowMat.opacity = pulse
      glow.scale.setScalar(1.5 + 0.3 * Math.sin(elapsed * 3))

      spriteMat.opacity = pulse2
      haloSprite.scale.setScalar(1.5 + 0.5 * Math.sin(elapsed * 1.8))

      // Rings fade out after initial burst
      ringMat.opacity = 0
      ringMat2.opacity = 0
    }
  }

  function dispose() {
    glowGeo.dispose()
    glowMat.dispose()
    spriteMat.dispose()
    ringGeo.dispose()
    ringMat.dispose()
    ringMat2.dispose()
  }

  return {
    group,
    trigger,
    update,
    dispose,
    get isActive() { return active },
  }
}
