import * as THREE from 'three'
import { GLOBE_RADIUS, CAMERA_DISTANCE_SPACE, COLORS } from '../app/config/constants'
import { createShippingParticles, type ShippingParticleSystem } from './ShippingParticles'
import { createRuptureEffect, type RuptureEffectSystem } from './RuptureEffect'

/**
 * GlobeScene — The opening. Earth from space.
 *
 * Photorealistic globe with NASA Blue Marble textures.
 * Shipping lanes as luminous particle streams.
 * Country markers pulse when "Where do you live?" appears.
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

export interface CountryMarker {
  id: string
  label: string
  position: THREE.Vector3
  mesh: THREE.Mesh
}

export interface GlobeSceneAPI {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  particles: ShippingParticleSystem
  rupture: RuptureEffectSystem
  markers: CountryMarker[]
  mount: (container: HTMLElement) => void
  unmount: () => void
  update: (delta: number) => void
  resize: (w: number, h: number) => void
  triggerRupture: () => void
  showMarkers: () => void
  hideMarkers: () => void
  getMarkerAtScreen: (x: number, y: number) => CountryMarker | null
  getCameraPositionForCountry: (lat: number, lng: number) => THREE.Vector3
  setOpacity: (opacity: number) => void
  dispose: () => void
  ruptured: boolean
}

export function createGlobeScene(): GlobeSceneAPI {
  // Scene
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(COLORS.dark)

  // Camera
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
  camera.position.set(0, 2, CAMERA_DISTANCE_SPACE)
  camera.lookAt(0, 0, 0)

  // Renderer
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.2

  // Lights
  const sunLight = new THREE.DirectionalLight(0xffffff, 2)
  sunLight.position.set(5, 3, 8)
  scene.add(sunLight)
  const ambientLight = new THREE.AmbientLight(0x222244, 0.5)
  scene.add(ambientLight)

  // Earth sphere — procedural for now (textures loaded async)
  const earthGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 64, 64)

  // Procedural earth-like material (blue ocean, green/brown land hint)
  const earthMat = new THREE.MeshPhongMaterial({
    color: 0x1a3a5c,
    emissive: 0x050510,
    specular: 0x222244,
    shininess: 25,
    transparent: true,
    opacity: 1,
  })

  // Load NASA Blue Marble texture if available
  const loader = new THREE.TextureLoader()
  loader.load('/textures/earth_day.jpg', (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace
    earthMat.map = tex
    earthMat.needsUpdate = true
  })
  loader.load('/textures/earth_night.jpg', (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace
    earthMat.emissiveMap = tex
    earthMat.emissive = new THREE.Color(0x333333)
    earthMat.needsUpdate = true
  })
  loader.load('/textures/earth_specular.jpg', (tex) => {
    earthMat.specularMap = tex
    earthMat.needsUpdate = true
  })

  const earth = new THREE.Mesh(earthGeo, earthMat)
  scene.add(earth)

  // Atmosphere glow
  const atmosGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.015, 64, 64)
  const atmosMat = new THREE.MeshBasicMaterial({
    color: 0x4488ff,
    transparent: true,
    opacity: 0.08,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
  })
  const atmosphere = new THREE.Mesh(atmosGeo, atmosMat)
  scene.add(atmosphere)

  // Stars background
  const starCount = 2000
  const starPositions = new Float32Array(starCount * 3)
  for (let i = 0; i < starCount; i++) {
    const r = 40 + Math.random() * 40
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
    starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
    starPositions[i * 3 + 2] = r * Math.cos(phi)
  }
  const starGeo = new THREE.BufferGeometry()
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
  const starMat = new THREE.PointsMaterial({
    size: 0.05,
    color: 0xffffff,
    transparent: true,
    opacity: 0.7,
    sizeAttenuation: true,
  })
  scene.add(new THREE.Points(starGeo, starMat))

  // Shipping particles
  const particles = createShippingParticles()
  scene.add(particles.points)

  // Rupture effect
  const rupture = createRuptureEffect()
  scene.add(rupture.group)

  let ruptured = false

  // Country markers (pulsing dots)
  const markers: CountryMarker[] = []
  const defaultCountries = [
    { id: 'kenya', label: 'Kenya', lat: -1.29, lng: 36.82 },
    { id: 'japan', label: 'Japan', lat: 36.2, lng: 138.25 },
    { id: 'germany', label: 'Germany', lat: 51.16, lng: 10.45 },
    { id: 'india', label: 'India', lat: 20.59, lng: 78.96 },
    { id: 'usa', label: 'USA', lat: 37.09, lng: -95.71 },
    { id: 'uk', label: 'UK', lat: 55.38, lng: -3.44 },
  ]

  defaultCountries.forEach(c => {
    const pos = latLngToVec3(c.lat, c.lng, GLOBE_RADIUS + 0.06)
    const markerGeo = new THREE.SphereGeometry(0.06, 12, 12)
    const markerMat = new THREE.MeshBasicMaterial({
      color: COLORS.gold,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
    })
    const mesh = new THREE.Mesh(markerGeo, markerMat)
    mesh.position.copy(pos)
    mesh.userData = { countryId: c.id }
    scene.add(mesh)
    markers.push({ id: c.id, label: c.label, position: pos, mesh })
  })

  let markersVisible = false
  let markersElapsed = 0

  // Raycaster for marker picking
  const raycaster = new THREE.Raycaster()
  raycaster.params.Points = { threshold: 0.1 }
  const mouse = new THREE.Vector2()

  // Wrapper group for opacity control
  let globalOpacity = 1

  function mount(container: HTMLElement) {
    renderer.setSize(container.clientWidth, container.clientHeight)
    camera.aspect = container.clientWidth / container.clientHeight
    camera.updateProjectionMatrix()
    container.appendChild(renderer.domElement)
    renderer.domElement.style.position = 'absolute'
    renderer.domElement.style.top = '0'
    renderer.domElement.style.left = '0'
    renderer.domElement.style.zIndex = '1'
  }

  function unmount() {
    renderer.domElement.remove()
  }

  function update(delta: number) {
    // Slow rotation
    earth.rotation.y += delta * 0.03
    particles.points.rotation.y = earth.rotation.y

    // Update particles
    particles.update(delta, ruptured)

    // Update rupture effect
    rupture.update(delta)

    // Pulse markers
    if (markersVisible) {
      markersElapsed += delta
      markers.forEach((m, i) => {
        const mat = m.mesh.material as THREE.MeshBasicMaterial
        const pulse = 0.5 + 0.5 * Math.sin(markersElapsed * 2 + i * 1.2)
        mat.opacity = pulse * globalOpacity
        m.mesh.scale.setScalar(0.8 + pulse * 0.4)
      })
    }

    // Render
    renderer.render(scene, camera)
  }

  function resize(w: number, h: number) {
    renderer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }

  function triggerRupture() {
    ruptured = true
    rupture.trigger()
  }

  function showMarkers() {
    markersVisible = true
    markersElapsed = 0
  }

  function hideMarkers() {
    markersVisible = false
    markers.forEach(m => {
      (m.mesh.material as THREE.MeshBasicMaterial).opacity = 0
    })
  }

  function getMarkerAtScreen(screenX: number, screenY: number): CountryMarker | null {
    const rect = renderer.domElement.getBoundingClientRect()
    mouse.x = ((screenX - rect.left) / rect.width) * 2 - 1
    mouse.y = -((screenY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(mouse, camera)

    const meshes = markers.map(m => m.mesh)
    const intersects = raycaster.intersectObjects(meshes)
    if (intersects.length > 0) {
      const hit = intersects[0].object
      return markers.find(m => m.mesh === hit) ?? null
    }
    return null
  }

  function getCameraPositionForCountry(lat: number, lng: number): THREE.Vector3 {
    return latLngToVec3(lat, lng, CAMERA_DISTANCE_SPACE * 0.4)
  }

  function setOpacity(opacity: number) {
    globalOpacity = opacity
    renderer.domElement.style.opacity = String(opacity)
    earthMat.opacity = opacity
    atmosMat.opacity = 0.08 * opacity
  }

  function dispose() {
    particles.dispose()
    rupture.dispose()
    earthGeo.dispose()
    earthMat.dispose()
    atmosGeo.dispose()
    atmosMat.dispose()
    starGeo.dispose()
    starMat.dispose()
    markers.forEach(m => {
      m.mesh.geometry.dispose();
      (m.mesh.material as THREE.MeshBasicMaterial).dispose()
    })
    renderer.dispose()
  }

  return {
    scene,
    camera,
    renderer,
    particles,
    rupture,
    markers,
    mount,
    unmount,
    update,
    resize,
    triggerRupture,
    showMarkers,
    hideMarkers,
    getMarkerAtScreen,
    getCameraPositionForCountry,
    setOpacity,
    dispose,
    get ruptured() { return ruptured },
  }
}
