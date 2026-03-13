import * as THREE from 'three'
import { GLOBE_RADIUS, COLORS, SHIPPING_PARTICLE_COUNT, SHIPPING_PARTICLE_COUNT_MOBILE } from '../app/config/constants'

/**
 * Shipping lane particles flowing on the globe surface.
 * Major routes: Hormuz, Suez, Malacca, Cape, Panama.
 * Each particle follows a route path at constant speed, looping.
 */

// Route definitions as lat/lng waypoints
const ROUTES = {
  hormuz_persian_gulf: [
    { lat: 26.5, lng: 56.3 },
    { lat: 25.0, lng: 57.5 },
    { lat: 23.5, lng: 59.0 },
    { lat: 20.0, lng: 62.0 },
    { lat: 15.0, lng: 65.0 },
    { lat: 10.0, lng: 68.0 },
    { lat: 5.0, lng: 72.0 },
    { lat: 0.0, lng: 75.0 },
  ],
  hormuz_to_africa: [
    { lat: 26.5, lng: 56.3 },
    { lat: 24.0, lng: 54.0 },
    { lat: 20.0, lng: 48.0 },
    { lat: 15.0, lng: 44.0 },
    { lat: 12.6, lng: 43.3 }, // Bab el-Mandeb
    { lat: 8.0, lng: 44.0 },
    { lat: 2.0, lng: 44.0 },
    { lat: -4.0, lng: 39.7 }, // Mombasa
  ],
  suez_med: [
    { lat: 30.0, lng: 32.3 }, // Suez
    { lat: 32.0, lng: 30.0 },
    { lat: 34.0, lng: 25.0 },
    { lat: 36.0, lng: 15.0 },
    { lat: 37.0, lng: 5.0 },
    { lat: 36.0, lng: -5.0 }, // Gibraltar
    { lat: 40.0, lng: -10.0 },
    { lat: 48.0, lng: -5.0 },
    { lat: 51.0, lng: 1.0 }, // English Channel
  ],
  red_sea_suez: [
    { lat: 12.6, lng: 43.3 }, // Bab el-Mandeb
    { lat: 15.0, lng: 42.0 },
    { lat: 20.0, lng: 38.0 },
    { lat: 25.0, lng: 35.0 },
    { lat: 28.0, lng: 33.5 },
    { lat: 30.0, lng: 32.3 }, // Suez
  ],
  cape_route: [
    { lat: -4.0, lng: 39.7 }, // Mombasa
    { lat: -10.0, lng: 40.0 },
    { lat: -20.0, lng: 37.0 },
    { lat: -30.0, lng: 32.0 },
    { lat: -34.4, lng: 18.5 }, // Cape
    { lat: -30.0, lng: 5.0 },
    { lat: -20.0, lng: -5.0 },
    { lat: -5.0, lng: -10.0 },
    { lat: 10.0, lng: -15.0 },
    { lat: 30.0, lng: -15.0 },
    { lat: 48.0, lng: -5.0 },
    { lat: 51.0, lng: 1.0 },
  ],
  malacca_east: [
    { lat: 1.4, lng: 103.8 }, // Malacca
    { lat: 5.0, lng: 110.0 },
    { lat: 10.0, lng: 115.0 },
    { lat: 15.0, lng: 118.0 },
    { lat: 22.0, lng: 120.0 },
    { lat: 30.0, lng: 125.0 },
    { lat: 35.0, lng: 130.0 },
    { lat: 35.0, lng: 140.0 }, // Japan
  ],
  malacca_indian: [
    { lat: 1.4, lng: 103.8 },
    { lat: 0.0, lng: 95.0 },
    { lat: 2.0, lng: 85.0 },
    { lat: 5.0, lng: 75.0 },
    { lat: 10.0, lng: 68.0 },
    { lat: 15.0, lng: 60.0 },
    { lat: 20.0, lng: 58.0 },
    { lat: 26.5, lng: 56.3 }, // Hormuz
  ],
  atlantic_west: [
    { lat: 36.0, lng: -5.0 }, // Gibraltar
    { lat: 35.0, lng: -20.0 },
    { lat: 35.0, lng: -40.0 },
    { lat: 38.0, lng: -55.0 },
    { lat: 40.0, lng: -70.0 },
    { lat: 40.5, lng: -74.0 }, // New York
  ],
}

// Convert lat/lng to 3D position on sphere
function latLngToVec3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  )
}

// Interpolate along a route
function interpolateRoute(
  waypoints: { lat: number; lng: number }[],
  t: number,
  radius: number,
): THREE.Vector3 {
  const totalSegments = waypoints.length - 1
  const segment = Math.min(Math.floor(t * totalSegments), totalSegments - 1)
  const localT = (t * totalSegments) - segment

  const p0 = latLngToVec3(waypoints[segment].lat, waypoints[segment].lng, radius)
  const p1 = latLngToVec3(waypoints[segment + 1].lat, waypoints[segment + 1].lng, radius)

  // Spherical interpolation for smooth curve on globe
  return p0.clone().lerp(p1, localT).normalize().multiplyScalar(radius)
}

export interface ShippingParticleSystem {
  points: THREE.Points
  update: (delta: number, ruptured: boolean) => void
  dispose: () => void
}

export function createShippingParticles(): ShippingParticleSystem {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  const count = isMobile ? SHIPPING_PARTICLE_COUNT_MOBILE : SHIPPING_PARTICLE_COUNT
  const radius = GLOBE_RADIUS + 0.02 // Slightly above surface

  const routeEntries = Object.entries(ROUTES)
  const particlesPerRoute = Math.floor(count / routeEntries.length)

  // Allocate buffers
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const routeIndices = new Int32Array(count)   // which route
  const progresses = new Float32Array(count)    // 0..1 along route
  const speeds = new Float32Array(count)        // speed per particle
  const ruptureStates = new Float32Array(count) // 0=flowing, 1=stopped

  // Base color
  const baseColor = new THREE.Color(COLORS.shipping)
  const ruptureColor = new THREE.Color(COLORS.rupture)

  let idx = 0
  for (let r = 0; r < routeEntries.length; r++) {
    const routeWaypoints = routeEntries[r][1]
    const pCount = r === routeEntries.length - 1 ? count - idx : particlesPerRoute

    for (let i = 0; i < pCount && idx < count; i++, idx++) {
      const t = Math.random()
      const pos = interpolateRoute(routeWaypoints, t, radius)

      positions[idx * 3] = pos.x
      positions[idx * 3 + 1] = pos.y
      positions[idx * 3 + 2] = pos.z

      colors[idx * 3] = baseColor.r
      colors[idx * 3 + 1] = baseColor.g
      colors[idx * 3 + 2] = baseColor.b

      sizes[idx] = 1.0 + Math.random() * 1.5
      routeIndices[idx] = r
      progresses[idx] = t
      speeds[idx] = 0.0003 + Math.random() * 0.0004 // varies
      ruptureStates[idx] = 0
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

  const material = new THREE.PointsMaterial({
    size: 0.03,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  })

  const points = new THREE.Points(geometry, material)

  // Hormuz region detection — is a route going through Hormuz?
  const hormuzRoutes = new Set<number>()
  routeEntries.forEach(([name], i) => {
    if (name.includes('hormuz') || name.includes('malacca_indian')) {
      hormuzRoutes.add(i)
    }
  })

  // Hormuz position for proximity check
  const hormuzPos = latLngToVec3(26.5, 56.3, radius)

  function update(delta: number, ruptured: boolean) {
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute
    const colAttr = geometry.getAttribute('color') as THREE.BufferAttribute

    for (let i = 0; i < count; i++) {
      const routeIdx = routeIndices[i]
      const routeWaypoints = routeEntries[routeIdx][1]
      const isHormuzRoute = hormuzRoutes.has(routeIdx)

      if (ruptured && isHormuzRoute) {
        // Particles on Hormuz routes slow and stop near Hormuz
        const currentPos = new THREE.Vector3(
          posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i),
        )
        const distToHormuz = currentPos.distanceTo(hormuzPos)

        if (distToHormuz < 2.0) {
          // Near Hormuz — stop and turn red
          ruptureStates[i] = Math.min(ruptureStates[i] + delta * 2, 1)
          speeds[i] *= 0.95 // decelerate

          // Jitter
          const jitter = 0.001
          posAttr.setXYZ(
            i,
            currentPos.x + (Math.random() - 0.5) * jitter,
            currentPos.y + (Math.random() - 0.5) * jitter,
            currentPos.z + (Math.random() - 0.5) * jitter,
          )
        } else {
          // Far from Hormuz — slow down gradually
          ruptureStates[i] = Math.min(ruptureStates[i] + delta * 0.5, 0.5)
          progresses[i] += speeds[i] * 0.3 * delta * 60
          if (progresses[i] > 1) progresses[i] = 0
          const newPos = interpolateRoute(routeWaypoints, progresses[i], radius)
          posAttr.setXYZ(i, newPos.x, newPos.y, newPos.z)
        }

        // Lerp color toward red
        const rs = ruptureStates[i]
        colAttr.setXYZ(
          i,
          baseColor.r + (ruptureColor.r - baseColor.r) * rs,
          baseColor.g + (ruptureColor.g - baseColor.g) * rs,
          baseColor.b + (ruptureColor.b - baseColor.b) * rs,
        )
      } else {
        // Normal flow
        progresses[i] += speeds[i] * delta * 60
        if (progresses[i] > 1) progresses[i] -= 1
        if (progresses[i] < 0) progresses[i] += 1

        const newPos = interpolateRoute(routeWaypoints, progresses[i], radius)
        posAttr.setXYZ(i, newPos.x, newPos.y, newPos.z)

        // Restore color if un-ruptured
        if (ruptureStates[i] > 0) {
          ruptureStates[i] = Math.max(ruptureStates[i] - delta, 0)
          const rs = ruptureStates[i]
          colAttr.setXYZ(
            i,
            baseColor.r + (ruptureColor.r - baseColor.r) * rs,
            baseColor.g + (ruptureColor.g - baseColor.g) * rs,
            baseColor.b + (ruptureColor.b - baseColor.b) * rs,
          )
        }
      }
    }

    posAttr.needsUpdate = true
    colAttr.needsUpdate = true
  }

  function dispose() {
    geometry.dispose()
    material.dispose()
  }

  return { points, update, dispose }
}
