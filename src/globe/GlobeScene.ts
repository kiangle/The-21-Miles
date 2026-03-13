import * as THREE from 'three'
import { GLOBE_RADIUS, CAMERA_DISTANCE_SPACE, COLORS } from '../app/config/constants'
import { createShippingParticles, type ShippingParticleSystem } from './ShippingParticles'
import { createRuptureEffect, type RuptureEffectSystem } from './RuptureEffect'

/**
 * GlobeScene — The opening. Earth from space.
 *
 * Procedural Earth with continent silhouettes, atmosphere rim shader,
 * dense starfield, luminous shipping particles, Hormuz rupture pulse,
 * and country markers driven by Atlas bootstrap data.
 */

export function latLngToVec3(lat: number, lng: number, radius: number): THREE.Vector3 {
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
  sprite: THREE.Sprite
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
  setMarkersFromBootstrap: (countries: Array<{ id: string; label: string; lat: number; lng: number }>) => void
  getMarkerAtScreen: (x: number, y: number) => CountryMarker | null
  getCameraPositionForCountry: (lat: number, lng: number) => THREE.Vector3
  setOpacity: (opacity: number) => void
  dispose: () => void
  ruptured: boolean
}

// Simplified continent outlines (coarse — enough to read as Earth from space)
const CONTINENT_OUTLINES: Array<{ name: string; points: [number, number][] }> = [
  {
    name: 'Africa',
    points: [
      [37, 10], [35, 12], [32, 15], [25, 17], [20, 17], [15, 17], [13, 15],
      [10, 14], [5, 10], [4, 7], [5, 2], [6, 1], [4, -2], [0, 8], [-2, 10],
      [-5, 12], [-10, 15], [-15, 18], [-20, 22], [-25, 26], [-30, 28],
      [-34, 25], [-34, 18], [-30, 15], [-25, 14], [-18, 12], [-12, 14],
      [-5, 40], [-4, 42], [-1, 42], [2, 45], [5, 44], [10, 50], [12, 44],
      [15, 42], [18, 40], [20, 37], [25, 35], [30, 33], [32, 32], [33, 28],
      [32, 25], [30, 20], [35, 15], [37, 10],
    ],
  },
  {
    name: 'Europe',
    points: [
      [36, -5], [38, 0], [40, 0], [43, 5], [45, 8], [47, 7], [48, 2],
      [50, 2], [51, 4], [53, 5], [55, 8], [57, 10], [60, 10], [62, 5],
      [65, 14], [68, 20], [70, 28], [68, 35], [65, 30], [60, 28],
      [58, 22], [55, 20], [52, 18], [50, 15], [48, 17], [45, 15],
      [42, 20], [40, 22], [38, 24], [36, 22], [36, 15], [38, 10],
      [37, 5], [36, -5],
    ],
  },
  {
    name: 'Asia',
    points: [
      [40, 25], [42, 30], [45, 35], [48, 40], [50, 45], [52, 50],
      [55, 55], [55, 60], [55, 70], [52, 75], [50, 80], [48, 85],
      [50, 90], [52, 100], [50, 110], [45, 115], [40, 120], [38, 125],
      [35, 130], [35, 135], [33, 132], [30, 120], [25, 115], [20, 110],
      [15, 108], [10, 105], [5, 103], [1, 104], [0, 100], [5, 95],
      [10, 80], [15, 75], [20, 73], [22, 70], [25, 68], [28, 65],
      [30, 55], [32, 50], [35, 45], [38, 40], [40, 35], [40, 25],
    ],
  },
  {
    name: 'NorthAmerica',
    points: [
      [60, -140], [65, -130], [68, -120], [70, -110], [70, -90],
      [65, -80], [60, -75], [55, -65], [50, -60], [48, -55],
      [45, -65], [42, -70], [40, -74], [35, -75], [30, -82],
      [25, -80], [20, -87], [18, -90], [15, -88], [15, -92],
      [20, -105], [25, -110], [30, -115], [35, -120], [40, -124],
      [45, -124], [50, -128], [55, -132], [60, -140],
    ],
  },
  {
    name: 'SouthAmerica',
    points: [
      [12, -72], [10, -67], [8, -60], [5, -55], [0, -50], [-5, -45],
      [-10, -37], [-15, -39], [-20, -40], [-25, -45], [-30, -50],
      [-35, -57], [-40, -62], [-45, -65], [-50, -70], [-55, -68],
      [-50, -75], [-45, -73], [-40, -72], [-35, -72], [-30, -71],
      [-20, -70], [-15, -75], [-10, -78], [-5, -80], [0, -78],
      [5, -77], [10, -75], [12, -72],
    ],
  },
  {
    name: 'Australia',
    points: [
      [-12, 130], [-15, 125], [-20, 118], [-25, 114], [-30, 115],
      [-35, 117], [-37, 140], [-38, 145], [-35, 148], [-30, 153],
      [-25, 153], [-20, 148], [-15, 145], [-12, 140], [-12, 135],
      [-12, 130],
    ],
  },
  {
    name: 'MiddleEast',
    points: [
      [32, 32], [33, 35], [35, 36], [37, 40], [38, 44], [35, 45],
      [32, 48], [30, 50], [28, 52], [26, 56], [24, 56], [22, 55],
      [20, 55], [18, 52], [15, 48], [13, 45], [12, 44], [15, 42],
      [20, 38], [25, 35], [30, 33], [32, 32],
    ],
  },
]

function createLandmasses(scene: THREE.Scene, radius: number) {
  const landGroup = new THREE.Group()
  const landRadius = radius * 1.002

  CONTINENT_OUTLINES.forEach(continent => {
    const linePoints: THREE.Vector3[] = continent.points.map(([lat, lng]) =>
      latLngToVec3(lat, lng, landRadius)
    )
    if (linePoints.length > 2) {
      linePoints.push(linePoints[0].clone())
    }

    const lineGeo = new THREE.BufferGeometry().setFromPoints(linePoints)
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x3a5a7a,
      transparent: true,
      opacity: 0.7,
    })
    const line = new THREE.Line(lineGeo, lineMat)
    landGroup.add(line)

    // Semi-transparent filled patches via triangle fan from centroid
    if (continent.points.length > 4) {
      const center = new THREE.Vector3(0, 0, 0)
      for (const [lat, lng] of continent.points) {
        center.add(latLngToVec3(lat, lng, landRadius))
      }
      center.divideScalar(continent.points.length)
      center.normalize().multiplyScalar(landRadius)

      const vertices: number[] = []
      for (let i = 0; i < continent.points.length - 1; i++) {
        const p0 = latLngToVec3(continent.points[i][0], continent.points[i][1], landRadius)
        const p1 = latLngToVec3(continent.points[i + 1][0], continent.points[i + 1][1], landRadius)
        vertices.push(center.x, center.y, center.z)
        vertices.push(p0.x, p0.y, p0.z)
        vertices.push(p1.x, p1.y, p1.z)
      }
      const last = continent.points[continent.points.length - 1]
      const first = continent.points[0]
      const pLast = latLngToVec3(last[0], last[1], landRadius)
      const pFirst = latLngToVec3(first[0], first[1], landRadius)
      vertices.push(center.x, center.y, center.z)
      vertices.push(pLast.x, pLast.y, pLast.z)
      vertices.push(pFirst.x, pFirst.y, pFirst.z)

      const patchGeo = new THREE.BufferGeometry()
      patchGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
      patchGeo.computeVertexNormals()

      const patchMat = new THREE.MeshBasicMaterial({
        color: 0x1a2a3a,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
      landGroup.add(new THREE.Mesh(patchGeo, patchMat))
    }
  })

  scene.add(landGroup)
  return landGroup
}

export function createGlobeScene(): GlobeSceneAPI {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(COLORS.dark)

  // Camera positioned to show Africa/Middle East/Indian Ocean trade context
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200)
  const camPos = latLngToVec3(10, 50, CAMERA_DISTANCE_SPACE)
  camera.position.copy(camPos)
  camera.lookAt(0, 0, 0)

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.2

  // Lighting
  const sunLight = new THREE.DirectionalLight(0xffffff, 1.8)
  sunLight.position.set(5, 3, 8)
  scene.add(sunLight)
  scene.add(new THREE.AmbientLight(0x334466, 0.6))

  // ── Earth ocean sphere ──
  const earthGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 128, 128)
  const earthMat = new THREE.MeshPhongMaterial({
    color: 0x0a1628,
    emissive: 0x030810,
    specular: new THREE.Color(0x20344a),
    shininess: 12,
    transparent: true,
    opacity: 1,
  })

  const loader = new THREE.TextureLoader()
  const landGroup = createLandmasses(scene, GLOBE_RADIUS)

  loader.load('/textures/earth_day.jpg', (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace
    earthMat.map = tex
    earthMat.color.set(0xffffff)
    earthMat.needsUpdate = true
    landGroup.visible = false
  }, undefined, () => { /* keep procedural */ })

  const earth = new THREE.Mesh(earthGeo, earthMat)
  scene.add(earth)

  // ── Atmosphere rim shader ──
  const atmosVert = `
    varying vec3 vNormal;
    varying vec3 vViewDir;
    void main() {
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vNormal = normalize(normalMatrix * normal);
      vViewDir = normalize(-mvPosition.xyz);
      gl_Position = projectionMatrix * mvPosition;
    }
  `
  const atmosFrag = `
    varying vec3 vNormal;
    varying vec3 vViewDir;
    uniform vec3 glowColor;
    uniform float intensity;
    void main() {
      float fresnel = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 2.4);
      gl_FragColor = vec4(glowColor, fresnel * intensity);
    }
  `

  const atmosGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.02, 128, 128)
  const atmosMat = new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.BackSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      glowColor: { value: new THREE.Color('#78a6ff') },
      intensity: { value: 0.55 },
    },
    vertexShader: atmosVert,
    fragmentShader: atmosFrag,
  })
  const atmosphere = new THREE.Mesh(atmosGeo, atmosMat)
  scene.add(atmosphere)

  // Second warmer rim
  const atmosGeo2 = new THREE.SphereGeometry(GLOBE_RADIUS * 1.04, 64, 64)
  const atmosMat2 = new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.BackSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      glowColor: { value: new THREE.Color('#4488aa') },
      intensity: { value: 0.25 },
    },
    vertexShader: atmosVert,
    fragmentShader: atmosFrag,
  })
  scene.add(new THREE.Mesh(atmosGeo2, atmosMat2))

  // ── Dense starfield ──
  const starCount = 5000
  const starPositions = new Float32Array(starCount * 3)
  const starColors = new Float32Array(starCount * 3)

  for (let i = 0; i < starCount; i++) {
    const r = 50 + Math.random() * 80
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
    starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
    starPositions[i * 3 + 2] = r * Math.cos(phi)

    const warmth = 0.85 + Math.random() * 0.15
    starColors[i * 3] = warmth
    starColors[i * 3 + 1] = warmth * (0.9 + Math.random() * 0.1)
    starColors[i * 3 + 2] = warmth
  }

  const starGeo = new THREE.BufferGeometry()
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
  starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3))
  const starMat = new THREE.PointsMaterial({
    size: 0.15,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  scene.add(new THREE.Points(starGeo, starMat))

  // ── Shipping particles ──
  const particles = createShippingParticles()
  scene.add(particles.points)

  // ── Rupture effect ──
  const rupture = createRuptureEffect()
  scene.add(rupture.group)

  let ruptured = false

  // ── Country markers ──
  const markers: CountryMarker[] = []
  let markersVisible = false
  let markersElapsed = 0

  const fallbackCountries = [
    { id: 'kenya', label: 'Kenya', lat: -1.29, lng: 36.82 },
    { id: 'japan', label: 'Japan', lat: 36.2, lng: 138.25 },
    { id: 'germany', label: 'Germany', lat: 51.16, lng: 10.45 },
    { id: 'india', label: 'India', lat: 20.59, lng: 78.96 },
    { id: 'usa', label: 'USA', lat: 37.09, lng: -95.71 },
    { id: 'uk', label: 'UK', lat: 55.38, lng: -3.44 },
  ]

  function addMarker(c: { id: string; label: string; lat: number; lng: number }) {
    const pos = latLngToVec3(c.lat, c.lng, GLOBE_RADIUS + 0.08)

    const markerGeo = new THREE.SphereGeometry(0.1, 16, 16)
    const markerMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(COLORS.gold),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
    })
    const mesh = new THREE.Mesh(markerGeo, markerMat)
    mesh.position.copy(pos)
    mesh.userData = { countryId: c.id }
    scene.add(mesh)

    const spriteMat = new THREE.SpriteMaterial({
      color: new THREE.Color(COLORS.gold),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
    })
    const sprite = new THREE.Sprite(spriteMat)
    sprite.position.copy(pos)
    sprite.scale.setScalar(0.5)
    scene.add(sprite)

    markers.push({ id: c.id, label: c.label, position: pos, mesh, sprite })
  }

  fallbackCountries.forEach(addMarker)

  const raycaster = new THREE.Raycaster()
  const mouse = new THREE.Vector2()
  let globalOpacity = 1
  let rotationAngle = 0

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
    rotationAngle += delta * 0.03
    earth.rotation.y = rotationAngle
    landGroup.rotation.y = rotationAngle
    particles.points.rotation.y = rotationAngle

    particles.update(delta, ruptured)
    rupture.update(delta)

    if (markersVisible) {
      markersElapsed += delta
      markers.forEach((m, i) => {
        const mat = m.mesh.material as THREE.MeshBasicMaterial
        const sMat = m.sprite.material as THREE.SpriteMaterial

        // Front-facing emphasis
        const markerDir = m.mesh.position.clone().normalize()
        const cameraToMarker = m.mesh.position.clone().sub(camera.position).normalize()
        const facing = -markerDir.dot(cameraToMarker)
        const facingFactor = Math.max(0, Math.pow(Math.max(facing, 0), 0.5))

        const pulse = 0.5 + 0.5 * Math.sin(markersElapsed * 2.5 + i * 1.4)
        const opacity = pulse * facingFactor * globalOpacity

        mat.opacity = opacity * 0.9
        sMat.opacity = opacity * 0.5
        m.mesh.scale.setScalar(0.8 + pulse * 0.4)
        m.sprite.scale.setScalar(0.4 + pulse * 0.3)
      })
    }

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
      (m.mesh.material as THREE.MeshBasicMaterial).opacity = 0;
      (m.sprite.material as THREE.SpriteMaterial).opacity = 0
    })
  }

  function setMarkersFromBootstrap(countries: Array<{ id: string; label: string; lat: number; lng: number }>) {
    markers.forEach(m => {
      scene.remove(m.mesh)
      scene.remove(m.sprite)
      m.mesh.geometry.dispose();
      (m.mesh.material as THREE.MeshBasicMaterial).dispose();
      (m.sprite.material as THREE.SpriteMaterial).dispose()
    })
    markers.length = 0
    countries.forEach(addMarker)
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
  }

  function dispose() {
    particles.dispose()
    rupture.dispose()
    earthGeo.dispose()
    earthMat.dispose()
    atmosGeo.dispose()
    atmosMat.dispose()
    atmosGeo2.dispose()
    atmosMat2.dispose()
    starGeo.dispose()
    starMat.dispose()
    markers.forEach(m => {
      m.mesh.geometry.dispose();
      (m.mesh.material as THREE.MeshBasicMaterial).dispose();
      (m.sprite.material as THREE.SpriteMaterial).dispose()
    })
    renderer.dispose()
  }

  return {
    scene, camera, renderer, particles, rupture, markers,
    mount, unmount, update, resize,
    triggerRupture, showMarkers, hideMarkers, setMarkersFromBootstrap,
    getMarkerAtScreen, getCameraPositionForCountry, setOpacity, dispose,
    get ruptured() { return ruptured },
  }
}
