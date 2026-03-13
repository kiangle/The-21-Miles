import * as THREE from 'three'
import { GLOBE_RADIUS, COLORS } from '../app/config/constants'

/**
 * Rupture effect at Hormuz — coherent pressure pulse, not fireworks.
 *
 * A hotspot glow + one expanding ring + nearby flow suppression.
 * Reads as a strategic blockage, not an explosion.
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

// Canvas-generated circular glow for the rupture halo
function createRuptureGlowTexture(): THREE.CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255,80,40,1)')
  gradient.addColorStop(0.15, 'rgba(255,60,30,0.7)')
  gradient.addColorStop(0.4, 'rgba(200,30,10,0.25)')
  gradient.addColorStop(0.7, 'rgba(180,20,0,0.08)')
  gradient.addColorStop(1, 'rgba(150,10,0,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  return tex
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

  // Core glow sphere — the hotspot
  const glowGeo = new THREE.SphereGeometry(0.12, 16, 16)
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

  // Circular halo sprite with canvas texture (replaces square sprite)
  const ruptureGlowTex = createRuptureGlowTexture()
  const spriteMat = new THREE.SpriteMaterial({
    map: ruptureGlowTex,
    color: new THREE.Color('#ff4422'),
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const haloSprite = new THREE.Sprite(spriteMat)
  haloSprite.position.copy(hormuzPos)
  haloSprite.scale.setScalar(0.4)
  group.add(haloSprite)

  // Single expanding ring — clean, not noisy
  const ringGeo = new THREE.TorusGeometry(0.02, 0.006, 8, 64)
  const ringMat = new THREE.MeshBasicMaterial({
    color: COLORS.rupture,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const ring = new THREE.Mesh(ringGeo, ringMat)
  ring.position.copy(hormuzPos)
  ring.lookAt(new THREE.Vector3(0, 0, 0))
  group.add(ring)

  let active = false
  let elapsed = 0

  function trigger() {
    active = true
    elapsed = 0
  }

  function update(delta: number) {
    if (!active) return

    elapsed += delta

    // Phase 1: Initial pressure build (0-2.5s)
    if (elapsed < 2.5) {
      const t = elapsed / 2.5

      // Glow ramps up smoothly
      glowMat.opacity = Math.min(t * 2, 1) * 0.85
      glow.scale.setScalar(1 + t * 0.8)

      // Halo expands gently
      spriteMat.opacity = Math.min(t * 1.5, 0.6)
      haloSprite.scale.setScalar(0.4 + t * 1.2)

      // Ring expands outward, fading
      const ringScale = 1 + t * 60
      ring.scale.setScalar(ringScale)
      ringMat.opacity = Math.max(0.7 - t * 0.35, 0)
    } else {
      // Phase 2: Persistent steady pulse — the blockage is ongoing
      const pulse = 0.55 + 0.25 * Math.sin(elapsed * 2.0)

      glowMat.opacity = pulse
      glow.scale.setScalar(1.4 + 0.15 * Math.sin(elapsed * 2.0))

      spriteMat.opacity = pulse * 0.5
      haloSprite.scale.setScalar(1.3 + 0.2 * Math.sin(elapsed * 1.5))

      // Ring fades out completely after initial burst
      ringMat.opacity = Math.max(ringMat.opacity - delta * 0.5, 0)
    }
  }

  function dispose() {
    glowGeo.dispose()
    glowMat.dispose()
    ruptureGlowTex.dispose()
    spriteMat.dispose()
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
