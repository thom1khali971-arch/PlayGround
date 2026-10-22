import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { MATERIALS, FINISHES, METALS } from './furniture.js'

function mulberry32(seed) {
  let a = seed
  return function random() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeWoodTexture(species) {
  const size = 768
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const random = mulberry32(species.base.charCodeAt(1) * 977 + species.grainDark.charCodeAt(3) * 131)
  ctx.fillStyle = species.base
  ctx.fillRect(0, 0, size, size)

  for (let i = 0; i < 18; i += 1) {
    const x = random() * size
    const w = 18 + random() * 90
    const grad = ctx.createLinearGradient(x - w, 0, x + w, 0)
    grad.addColorStop(0, 'rgba(0,0,0,0)')
    grad.addColorStop(0.5, random() > 0.5 ? 'rgba(255,235,205,0.055)' : 'rgba(55,32,12,0.06)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = grad
    ctx.fillRect(x - w, 0, w * 2, size)
  }

  const drawGrain = (count, color, alpha, width) => {
    for (let i = 0; i < count; i += 1) {
      const x = random() * size
      const phase = random() * Math.PI * 2
      const amp = 2 + random() * 12
      const freq = 0.006 + random() * 0.018
      const drift = (random() - 0.5) * 28
      ctx.beginPath()
      ctx.strokeStyle = color
      ctx.globalAlpha = alpha * (0.35 + random() * 0.65)
      ctx.lineWidth = width * (0.5 + random())
      for (let y = -20; y <= size + 20; y += 8) {
        const xx = x + Math.sin(y * freq + phase) * amp + (y / size) * drift
        if (y === -20) ctx.moveTo(xx, y)
        else ctx.lineTo(xx, y)
      }
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  drawGrain(230, species.grainDark, 0.13, 1.2)
  drawGrain(150, species.grainLight, 0.1, 1.1)
  drawGrain(60, '#2b1a0c', 0.07, 0.7)

  for (let k = 0; k < species.knots; k += 1) {
    const cx = 60 + random() * (size - 120)
    const cy = 60 + random() * (size - 120)
    const rx = 6 + random() * 12
    for (let r = 6; r > 0; r -= 1) {
      ctx.beginPath()
      ctx.strokeStyle = species.grainDark
      ctx.globalAlpha = 0.12
      ctx.lineWidth = 1.4
      ctx.ellipse(cx, cy, rx * (r / 5), rx * (r / 2.4), 0.4, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.globalAlpha = 0.18
    ctx.fillStyle = species.grainDark
    ctx.beginPath()
    ctx.ellipse(cx, cy, rx * 0.32, rx * 0.18, 0.4, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }

  for (let i = 0; i < 1200; i += 1) {
    const x = random() * size
    const y = random() * size
    ctx.fillStyle = random() > 0.5 ? 'rgba(40,22,8,0.09)' : 'rgba(255,240,215,0.06)'
    ctx.fillRect(x, y, 0.6 + random() * 1.4, 2 + random() * 8)
  }

  const image = ctx.getImageData(0, 0, size, size)
  const data = image.data
  for (let i = 0; i < data.length; i += 4) {
    const n = (random() - 0.5) * 11
    data[i] = Math.max(0, Math.min(255, data[i] + n))
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n))
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n))
  }
  ctx.putImageData(image, 0, 0)

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(1.25, 1.25)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

function makeFloorTexture() {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const random = mulberry32(9182)
  ctx.fillStyle = '#4a3c2f'
  ctx.fillRect(0, 0, size, size)
  for (let i = 0; i < 9000; i += 1) {
    const v = 42 + random() * 58
    ctx.fillStyle = `rgba(${v},${v * 0.82},${v * 0.68},${0.05 + random() * 0.12})`
    ctx.fillRect(random() * size, random() * size, 1 + random() * 2, 1 + random() * 2)
  }
  for (let i = 0; i < 40; i += 1) {
    ctx.strokeStyle = `rgba(0,0,0,${0.04 + random() * 0.06})`
    ctx.lineWidth = 0.7
    ctx.beginPath()
    ctx.moveTo(random() * size, random() * size)
    ctx.lineTo(random() * size, random() * size)
    ctx.stroke()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(7, 7)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export function createViewport(container, { onHover } = {}) {
  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(0x1b1410, 0.042)
  const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 100)
  camera.position.set(2.6, 2.1, 3.4)

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.08
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  container.appendChild(renderer.domElement)

  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environmentIntensity = 0.5

  const hemi = new THREE.HemisphereLight(0xd8e2ff, 0x2b1d13, 0.62)
  scene.add(hemi)

  const key = new THREE.DirectionalLight(0xffe4c4, 3.1)
  key.position.set(3.4, 5.2, 3.8)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  key.shadow.camera.near = 0.5
  key.shadow.camera.far = 24
  key.shadow.camera.left = -4
  key.shadow.camera.right = 4
  key.shadow.camera.top = 5
  key.shadow.camera.bottom = -2
  key.shadow.bias = -0.00035
  key.shadow.normalBias = 0.025
  key.shadow.radius = 4
  scene.add(key)

  const fill = new THREE.DirectionalLight(0xa8bfff, 1.25)
  fill.position.set(-3.8, 2.6, -2.4)
  scene.add(fill)

  const rim = new THREE.DirectionalLight(0xffb877, 1.5)
  rim.position.set(-2.4, 3.4, 3.6)
  scene.add(rim)

  const frontFill = new THREE.DirectionalLight(0xffd9b0, 0.5)
  frontFill.position.set(0.4, 1.8, 4.5)
  scene.add(frontFill)

  const floorTexture = makeFloorTexture()
  floorTexture.wrapS = THREE.RepeatWrapping
  floorTexture.wrapT = THREE.RepeatWrapping
  floorTexture.repeat.set(32, 32)
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({
      map: floorTexture,
      color: 0xd2bea4,
      roughness: 0.93,
      metalness: 0,
    }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.001
  ground.receiveShadow = true
  scene.add(ground)

  const shadowVert = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `
  const shadowFrag = `
    varying vec2 vUv;
    uniform float uOpacity;
    uniform float uInner;
    void main() {
      float d = distance(vUv, vec2(0.5)) * 2.0;
      float a = (1.0 - smoothstep(uInner, 1.0, d)) * uOpacity;
      gl_FragColor = vec4(0.0, 0.0, 0.0, a);
    }
  `
  function makeShadowPlane(opacity, inner, order) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShaderMaterial({
        vertexShader: shadowVert,
        fragmentShader: shadowFrag,
        uniforms: { uOpacity: { value: opacity }, uInner: { value: inner } },
        transparent: true,
        depthWrite: false,
      }),
    )
    mesh.rotation.x = -Math.PI / 2
    mesh.renderOrder = order
    scene.add(mesh)
    return mesh
  }
  const contact = makeShadowPlane(0.3, 0.5, 2)
  contact.position.y = 0.002

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.07
  controls.minDistance = 0.7
  controls.maxDistance = 14
  controls.maxPolarAngle = Math.PI / 2 - 0.035
  controls.target.set(0, 0.8, 0)
  controls.autoRotateSpeed = 0.8

  const modelGroup = new THREE.Group()
  scene.add(modelGroup)
  const dimsGroup = new THREE.Group()
  scene.add(dimsGroup)

  const labelHost = container.parentElement || container
  const dimLabels = {}
  const dimLabelWorlds = {
    width: new THREE.Vector3(),
    height: new THREE.Vector3(),
    depth: new THREE.Vector3(),
  }
  for (const key of ['width', 'height', 'depth']) {
    const label = document.createElement('span')
    label.className = 'dim-label'
    label.dataset.dim = key
    labelHost.appendChild(label)
    dimLabels[key] = label
  }

  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  const woodTextures = new Map()
  const baseMaterials = new Map()
  const meshes = []
  let hovered = null
  let footprint = [1, 1, 1]
  let explodeTarget = 0
  let explodeFactor = 0
  let desiredPos = camera.position.clone()
  let desiredTarget = controls.target.clone()
  let fitAnim = false
  let firstFrame = true
  let disposed = false

  function woodTextureFor(key) {
    if (!woodTextures.has(key)) woodTextures.set(key, makeWoodTexture(MATERIALS[key]))
    return woodTextures.get(key)
  }

  function baseMaterial(kind, materialKey, finishKey, metalKey) {
    const key = `${kind}|${materialKey}|${finishKey}|${metalKey}`
    if (baseMaterials.has(key)) return baseMaterials.get(key)
    const species = MATERIALS[materialKey]
    const finish = FINISHES[finishKey]
    const metal = METALS[metalKey]
    let material

    if (kind === 'metal') {
      material = new THREE.MeshStandardMaterial({
        color: metal.color,
        metalness: 1,
        roughness: metal.roughness,
        envMapIntensity: 1.4,
      })
    } else if (kind === 'back') {
      const tex = woodTextureFor(materialKey)
      material = new THREE.MeshStandardMaterial({
        color: species.paint || 0x6f5b48,
        map: tex,
        roughness: 0.9,
      })
    } else if (finish.paint) {
      material = new THREE.MeshStandardMaterial({
        color: finish.paint,
        roughness: finish.roughness,
        metalness: 0,
        bumpMap: woodTextureFor(materialKey),
        bumpScale: 0.0016,
        envMapIntensity: 0.6,
      })
    } else {
      material = new THREE.MeshPhysicalMaterial({
        color: finish.tint,
        map: woodTextureFor(materialKey),
        roughness: finish.roughness,
        metalness: 0,
        clearcoat: finish.sheen ? 0.7 : 0.08,
        clearcoatRoughness: finish.sheen ? 0.16 : 0.5,
        bumpMap: woodTextureFor(materialKey),
        bumpScale: 0.0011,
        envMapIntensity: 0.75,
      })
    }
    baseMaterials.set(key, material)
    return material
  }

  function clearModel() {
    for (const mesh of meshes) {
      mesh.geometry.dispose()
      mesh.material.dispose()
      modelGroup.remove(mesh)
    }
    meshes.length = 0
    hovered = null
  }

  function explodeOffset(part, fp) {
    const [W, H, D] = fp
    const [x, y] = part.pos
    const nx = W ? x / (W / 2) : 0
    const ny = H ? (y - H / 2) / (H / 2) : 0
    const nz = D ? part.pos[2] / (D / 2) : 0
    const scale = Math.min(1.45, Math.max(0.72, Math.max(W, H, D) / 1600))
    const off = new THREE.Vector3()
    const isHorizontal = part.size[1] <= Math.max(part.size[0], part.size[2]) * 0.6
    if (isHorizontal) {
      off.set(nx * 0.06, ny * 0.15, nz * 0.1)
    } else {
      off.set(nx * 0.24, ny * 0.12, nz * 0.18)
    }
    if (part.group === 'Portas' || part.group === 'Gavetas') off.z += 0.26
    if (part.group === 'Ferragens') {
      off.z += 0.28
      off.x *= 1.25
    }
    if (part.group === 'Fundo') off.z -= 0.14
    if (off.length() < 0.05) off.set(0, 0, 0.12)
    return off.multiplyScalar(scale)
  }

  function setModel(model, { materialKey, finishKey, metalKey, resetView = false }) {
    clearModel()
    footprint = model.footprint
    const [W, H, D] = model.footprint

    for (const part of model.parts) {
      const geometry = new THREE.BoxGeometry(part.size[0] / 1000, part.size[1] / 1000, part.size[2] / 1000)
      const material = baseMaterial(part.material === 'metal' ? 'metal' : part.material === 'back' ? 'back' : 'wood', materialKey, finishKey, metalKey).clone()
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.set(part.pos[0] / 1000, part.pos[1] / 1000, part.pos[2] / 1000)
      mesh.rotation.set(part.rot[0], part.rot[1], part.rot[2])
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.userData = {
        part,
        base: mesh.position.clone(),
        offset: explodeOffset(part, model.footprint),
      }
      modelGroup.add(mesh)
      meshes.push(mesh)
    }

    const w = W / 1000
    const d = D / 1000
    contact.scale.set(w * 1.25, d * 2.2, 1)

    buildDimensions(W, H, D, model)
    frameModel(W, H, D, resetView)
    if (firstFrame) {
      firstFrame = false
      camera.position.copy(desiredPos)
      controls.target.copy(desiredTarget)
      controls.update()
      fitAnim = false
    }
  }

  function buildDimensions(Wmm, Hmm, Dmm, model) {
    while (dimsGroup.children.length) {
      const child = dimsGroup.children.pop()
      child.geometry?.dispose()
      child.material?.map?.dispose()
      child.material?.dispose()
    }
    const W = Wmm / 1000
    const H = Hmm / 1000
    const D = Dmm / 1000
    const gap = Math.max(W, H, D) * 0.045 + 0.025
    const mat = new THREE.LineBasicMaterial({ color: 0xe6a85c, transparent: true, opacity: 0.8, depthTest: false })
    const addLine = (points) => {
      const geom = new THREE.BufferGeometry().setFromPoints(points.map((p) => new THREE.Vector3(...p)))
      const line = new THREE.Line(geom, mat)
      line.renderOrder = 20
      dimsGroup.add(line)
    }
    const tick = 0.045
    const yGround = 0.006

    addLine([[-W / 2, yGround, D / 2 + gap], [W / 2, yGround, D / 2 + gap]])
    addLine([[-W / 2, yGround, D / 2 + gap - tick], [-W / 2, yGround, D / 2 + gap + tick]])
    addLine([[W / 2, yGround, D / 2 + gap - tick], [W / 2, yGround, D / 2 + gap + tick]])
    dimLabelWorlds.width.set(0, yGround + 0.02, D / 2 + gap + 0.02)
    dimLabels.width.textContent = `L ${Math.round(Wmm)} mm`

    addLine([[-W / 2 - gap, 0, D / 2], [-W / 2 - gap, H, D / 2]])
    addLine([[-W / 2 - gap - tick, 0, D / 2], [-W / 2 - gap + tick, 0, D / 2]])
    addLine([[-W / 2 - gap - tick, H, D / 2], [-W / 2 - gap + tick, H, D / 2]])
    dimLabelWorlds.height.set(-W / 2 - gap, H / 2, D / 2 + 0.02)
    dimLabels.height.textContent = `A ${Math.round(Hmm)} mm`

    addLine([[W / 2 + gap, yGround, -D / 2], [W / 2 + gap, yGround, D / 2]])
    addLine([[W / 2 + gap - tick, yGround, -D / 2], [W / 2 + gap + tick, yGround, -D / 2]])
    addLine([[W / 2 + gap - tick, yGround, D / 2], [W / 2 + gap + tick, yGround, D / 2]])
    dimLabelWorlds.depth.set(W / 2 + gap, yGround + 0.02, 0)
    dimLabels.depth.textContent = `P ${Math.round(Dmm)} mm`

    dimsGroup.visible = showDims
    for (const label of Object.values(dimLabels)) label.style.display = showDims ? 'block' : 'none'
    dimsGroup.userData.model = model
  }

  let showDims = true

  function frameModel(Wmm, Hmm, Dmm, resetView = false) {
    const W = Wmm / 1000
    const H = Hmm / 1000
    const D = Dmm / 1000
    const radius = Math.sqrt((W / 2) ** 2 + (H / 2) ** 2 + (D / 2) ** 2)
    const vfov = (camera.fov * Math.PI) / 180
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect)
    const distV = radius / Math.sin(vfov / 2)
    const distH = radius / Math.sin(hfov / 2)
    const narrow = container.clientWidth < 720
    const distance = Math.max(distV, distH) * (narrow ? 1.22 : 1.04)
    const target = new THREE.Vector3(0, H * 0.5, 0)
    let dir = camera.position.clone().sub(controls.target)
    if (resetView || dir.lengthSq() < 0.001) dir.set(0.82, 0.52, 1.18)
    dir.normalize()
    desiredTarget.copy(target)
    desiredPos.copy(target).addScaledVector(dir, distance)
    fitAnim = true
  }

  function updateDimLabels() {
    if (!showDims) return
    const width = labelHost.clientWidth
    const height = labelHost.clientHeight
    if (!width || !height) return
    for (const key of Object.keys(dimLabelWorlds)) {
      const label = dimLabels[key]
      const projected = dimLabelWorlds[key].clone().project(camera)
      if (projected.z < -1 || projected.z > 1) {
        label.style.display = 'none'
        continue
      }
      const halfW = label.offsetWidth / 2 + 6
      const halfH = label.offsetHeight / 2 + 6
      const x = Math.min(width - halfW, Math.max(halfW, (projected.x * 0.5 + 0.5) * width))
      const y = Math.min(height - halfH, Math.max(halfH, (-projected.y * 0.5 + 0.5) * height))
      label.style.display = 'block'
      label.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`
    }
  }

  function resize() {
    const width = container.clientWidth
    const height = container.clientHeight
    if (!width || !height) return
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }

  const observer = new ResizeObserver(() => {
    resize()
    if (modelGroup.children.length) frameModel(footprint[0], footprint[1], footprint[2], false)
  })
  observer.observe(container)
  resize()

  controls.addEventListener('start', () => {
    fitAnim = false
  })

  function updatePointer(event) {
    const rect = renderer.domElement.getBoundingClientRect()
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  }

  renderer.domElement.addEventListener('pointermove', (event) => {
    updatePointer(event)
    raycaster.setFromCamera(pointer, camera)
    const hits = raycaster.intersectObjects(meshes, false)
    const next = hits[0]?.object || null
    if (next !== hovered) {
      if (hovered) hovered.material.emissive.setHex(0x000000)
      hovered = next
      if (hovered) {
        hovered.material.emissive.setHex(0x8a5a1f)
        hovered.material.emissiveIntensity = 0.32
      }
      if (onHover) onHover(hovered ? hovered.userData.part : null, event)
    } else if (hovered && onHover) {
      onHover(hovered.userData.part, event)
    }
    renderer.domElement.style.cursor = hovered ? 'crosshair' : 'grab'
  })

  renderer.domElement.addEventListener('pointerleave', () => {
    if (hovered) hovered.material.emissive.setHex(0x000000)
    hovered = null
    if (onHover) onHover(null)
  })

  function setOptions({ explode, dims, autoRotate }) {
    if (typeof explode === 'boolean') explodeTarget = explode ? 1 : 0
    if (typeof dims === 'boolean') {
      showDims = dims
      dimsGroup.visible = dims
      for (const label of Object.values(dimLabels)) label.style.display = dims ? 'block' : 'none'
    }
    if (typeof autoRotate === 'boolean') controls.autoRotate = autoRotate
  }

  function resetView() {
    if (!footprint) return
    frameModel(footprint[0], footprint[1], footprint[2], true)
  }

  function downloadImage(filename = 'marcenaria.png') {
    renderer.render(scene, camera)
    return new Promise((resolve) => {
      renderer.domElement.toBlob((blob) => {
        if (!blob) return resolve(false)
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        link.click()
        setTimeout(() => URL.revokeObjectURL(url), 2000)
        resolve(true)
      }, 'image/png')
    })
  }

  function snapshotDataUrl(background) {
    const previous = scene.background
    if (background) scene.background = new THREE.Color(background)
    renderer.render(scene, camera)
    const url = renderer.domElement.toDataURL('image/png')
    if (background) scene.background = previous
    return url
  }

  function animate() {
    if (disposed) return
    requestAnimationFrame(animate)

    if (fitAnim) {
      camera.position.lerp(desiredPos, 0.12)
      controls.target.lerp(desiredTarget, 0.12)
      if (camera.position.distanceTo(desiredPos) < 0.002) {
        camera.position.copy(desiredPos)
        controls.target.copy(desiredTarget)
        fitAnim = false
      }
    }

    const nextFactor = explodeFactor + (explodeTarget - explodeFactor) * 0.12
    if (Math.abs(nextFactor - explodeFactor) > 0.0002) {
      explodeFactor = nextFactor
      for (const mesh of meshes) {
        mesh.position.copy(mesh.userData.base).addScaledVector(mesh.userData.offset, explodeFactor)
      }
    } else if (explodeFactor !== explodeTarget) {
      explodeFactor = explodeTarget
      for (const mesh of meshes) {
        mesh.position.copy(mesh.userData.base).addScaledVector(mesh.userData.offset, explodeFactor)
      }
    }

    controls.update()
    camera.updateMatrixWorld()
    renderer.render(scene, camera)
    updateDimLabels()
  }
  animate()


  return {
    setModel,
    setOptions,
    resetView,
    downloadImage,
    snapshotDataUrl,
    resize,
    dispose() {
      disposed = true
      observer.disconnect()
      clearModel()
      controls.dispose()
      renderer.dispose()
      pmrem.dispose()
      renderer.domElement.remove()
      for (const label of Object.values(dimLabels)) label.remove()
    },
    get camera() {
      return camera
    },
  }
}
