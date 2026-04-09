import { useEffect, useRef, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

// Reference point: center of Calgary downtown bbox
const LAT_REF = 51.0475
const LON_REF = -114.0725
const SCALE = 111320 // meters per degree latitude

function latLonToXZ(lat, lon) {
  const x = (lon - LON_REF) * SCALE * Math.cos(LAT_REF * Math.PI / 180)
  const z = -(lat - LAT_REF) * SCALE
  return { x, z }
}

function getBuildingColor(buildingType) {
  const bt = (buildingType || '').toLowerCase()
  if (bt === 'commercial' || bt === 'retail' || bt === 'office') return 0x4488aa
  if (bt === 'residential' || bt === 'apartments') return 0x6699aa
  if (bt === 'industrial' || bt === 'warehouse') return 0x886644
  if (bt === 'hotel') return 0x9966cc
  if (bt === 'parking') return 0x555566
  return 0x556677
}

export default function CityView({ buildings, highlightedIds, clickedId, onBuildingClick }) {
  const mountRef = useRef(null)
  const sceneRef = useRef(null)
  const cameraRef = useRef(null)
  const rendererRef = useRef(null)
  const controlsRef = useRef(null)
  const meshMapRef = useRef({})
  const animFrameRef = useRef(null)

  // Initialize Three.js scene once
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const width = mount.clientWidth || 800
    const height = mount.clientHeight || 600

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0a0a1a)
    scene.fog = new THREE.Fog(0x0a0a1a, 600, 2000)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 5000)
    camera.position.set(0, 300, 400)
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    mount.appendChild(renderer.domElement)
    rendererRef.current = renderer

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.minDistance = 50
    controls.maxDistance = 2000
    controls.maxPolarAngle = Math.PI / 2.1
    controlsRef.current = controls

    // Lighting
    scene.add(new THREE.AmbientLight(0x404060, 0.6))
    const dirLight = new THREE.DirectionalLight(0xffeedd, 1.0)
    dirLight.position.set(200, 400, 200)
    dirLight.castShadow = true
    scene.add(dirLight)
    scene.add(new THREE.HemisphereLight(0x334466, 0x223344, 0.4))

    // Ground
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(2000, 2000),
      new THREE.MeshLambertMaterial({ color: 0x111a11 })
    )
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    scene.add(ground)
    scene.add(new THREE.GridHelper(1000, 50, 0x334433, 0x1a2a1a))

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    const handleResize = () => {
      if (!mount) return
      const w = mount.clientWidth
      const h = mount.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      window.removeEventListener('resize', handleResize)
      controls.dispose()
      renderer.dispose()
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [])

  // Build/rebuild building meshes when data changes
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene || buildings.length === 0) return

    // Remove old meshes
    Object.values(meshMapRef.current).forEach(mesh => {
      scene.remove(mesh)
      mesh.geometry.dispose()
      mesh.material.dispose()
    })
    meshMapRef.current = {}

    buildings.forEach(building => {
      const { id, properties } = building
      const footprint = properties.footprint
      if (!footprint || footprint.length < 3) return

      const height = Math.max(properties.height || 10, 1)
      const points = footprint.map(([lon, lat]) => latLonToXZ(lat, lon))

      const shape = new THREE.Shape()
      shape.moveTo(points[0].x, points[0].z)
      for (let i = 1; i < points.length; i++) {
        shape.lineTo(points[i].x, points[i].z)
      }
      shape.closePath()

      const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false })
      geometry.rotateX(-Math.PI / 2)

      const material = new THREE.MeshLambertMaterial({
        color: getBuildingColor(properties.building_type)
      })

      const mesh = new THREE.Mesh(geometry, material)
      mesh.userData = { buildingId: id, properties }
      mesh.castShadow = true
      mesh.receiveShadow = true
      scene.add(mesh)
      meshMapRef.current[id] = mesh
    })
  }, [buildings])

  // Update highlight colors: clicked = yellow (priority), LLM filter = orange
  useEffect(() => {
    if (!sceneRef.current) return
    const filterIds = new Set(highlightedIds || [])
    Object.entries(meshMapRef.current).forEach(([id, mesh]) => {
      if (id === clickedId) {
        // Clicked by user → bright yellow
        mesh.material.color.setHex(0xffff00)
        mesh.material.emissive.setHex(0x333300)
      } else if (filterIds.has(id)) {
        // Matched by LLM filter → orange
        mesh.material.color.setHex(0xffaa00)
        mesh.material.emissive.setHex(0x442200)
      } else {
        mesh.material.color.setHex(getBuildingColor(mesh.userData.properties?.building_type))
        mesh.material.emissive.setHex(0x000000)
      }
    })
  }, [highlightedIds, clickedId])

  const handleClick = useCallback((event) => {
    const renderer = rendererRef.current
    const camera = cameraRef.current
    const mount = mountRef.current
    if (!renderer || !camera || !mount) return

    const rect = mount.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    )
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(mouse, camera)
    const intersects = raycaster.intersectObjects(Object.values(meshMapRef.current))
    if (intersects.length > 0) {
      const { buildingId, properties } = intersects[0].object.userData
      onBuildingClick && onBuildingClick(buildingId, properties)
    }
  }, [onBuildingClick])

  return (
    <div ref={mountRef} style={{ width: '100%', height: '100%', cursor: 'crosshair' }} onClick={handleClick} />
  )
}
