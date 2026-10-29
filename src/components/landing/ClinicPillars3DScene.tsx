'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import { Sparkles, Eye, RotateCw, Layers } from 'lucide-react'

interface ClinicPillars3DSceneProps {
  heroImage?: string
  motionLevel?: 'none' | 'subtle' | 'normal' | 'advanced'
  motionSpeed?: 'slow' | 'normal' | 'fast'
  isRtl?: boolean
  className?: string
  fallbackView?: React.ReactNode
}

// 5 Core Clinic Nodes
interface PillarNode {
  id: string
  title: string
  subtitle: string
  color: number
  hexColor: string
  pos: [number, number, number]
  orbitSpeed: number
  orbitRadius: number
  phaseOffset: number
}

const PILLARS_AR: PillarNode[] = [
  {
    id: 'booking',
    title: 'حجز ومتابعة الدور',
    subtitle: 'Booking & Queue',
    color: 0x00a8e8, // Electric Cyan
    hexColor: '#00a8e8',
    pos: [-3.2, 1.4, 0.5],
    orbitRadius: 3.4,
    orbitSpeed: 0.28,
    phaseOffset: 0,
  },
  {
    id: 'tv',
    title: 'تلفزيون الانتظار',
    subtitle: 'Waiting TV & Audio',
    color: 0x0284c7, // Sky Blue
    hexColor: '#0284c7',
    pos: [3.2, 1.6, -0.4],
    orbitRadius: 3.5,
    orbitSpeed: 0.24,
    phaseOffset: (Math.PI * 2) / 5,
  },
  {
    id: 'emr',
    title: 'الملف الطبي EMR',
    subtitle: 'Patient Records',
    color: 0x6366f1, // Indigo
    hexColor: '#6366f1',
    pos: [3.0, -1.5, 0.6],
    orbitRadius: 3.3,
    orbitSpeed: 0.32,
    phaseOffset: ((Math.PI * 2) * 2) / 5,
  },
  {
    id: 'rx',
    title: 'الروشتة الذكية A4',
    subtitle: 'Digital Rx & Print',
    color: 0x10b981, // Emerald Green
    hexColor: '#10b981',
    pos: [-2.9, -1.6, -0.5],
    orbitRadius: 3.2,
    orbitSpeed: 0.26,
    phaseOffset: ((Math.PI * 2) * 3) / 5,
  },
  {
    id: 'billing',
    title: 'الحسابات والفواتير',
    subtitle: 'Billing & Invoices',
    color: 0x0ea5e9, // Brand Accent
    hexColor: '#0ea5e9',
    pos: [0, 2.8, -0.8],
    orbitRadius: 2.9,
    orbitSpeed: 0.3,
    phaseOffset: ((Math.PI * 2) * 4) / 5,
  },
]

const PILLARS_EN: PillarNode[] = [
  {
    id: 'booking',
    title: 'Instant Booking',
    subtitle: 'Queue Tracking',
    color: 0x00a8e8,
    hexColor: '#00a8e8',
    pos: [-3.2, 1.4, 0.5],
    orbitRadius: 3.4,
    orbitSpeed: 0.28,
    phaseOffset: 0,
  },
  {
    id: 'tv',
    title: 'Waiting Room TV',
    subtitle: 'Audio Call System',
    color: 0x0284c7,
    hexColor: '#0284c7',
    pos: [3.2, 1.6, -0.4],
    orbitRadius: 3.5,
    orbitSpeed: 0.24,
    phaseOffset: (Math.PI * 2) / 5,
  },
  {
    id: 'emr',
    title: 'Medical EMR',
    subtitle: 'Complete Dossier',
    color: 0x6366f1,
    hexColor: '#6366f1',
    pos: [3.0, -1.5, 0.6],
    orbitRadius: 3.3,
    orbitSpeed: 0.32,
    phaseOffset: ((Math.PI * 2) * 2) / 5,
  },
  {
    id: 'rx',
    title: 'Smart A4 Rx',
    subtitle: 'One-Click Protocols',
    color: 0x10b981,
    hexColor: '#10b981',
    pos: [-2.9, -1.6, -0.5],
    orbitRadius: 3.2,
    orbitSpeed: 0.26,
    phaseOffset: ((Math.PI * 2) * 3) / 5,
  },
  {
    id: 'billing',
    title: 'Clinic Finances',
    subtitle: 'Daily Income & Receipts',
    color: 0x0ea5e9,
    hexColor: '#0ea5e9',
    pos: [0, 2.8, -0.8],
    orbitRadius: 2.9,
    orbitSpeed: 0.3,
    phaseOffset: ((Math.PI * 2) * 4) / 5,
  },
]

// Canvas texture generator for crisp, high-dpi node badges
function createBadgeTexture(
  title: string,
  subtitle: string,
  accentColor: string,
  isRtl: boolean
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(canvas)

  // Clear background
  ctx.clearRect(0, 0, 512, 256)

  // Rounded card panel with glass gradient
  const r = 32
  const x = 16
  const y = 16
  const w = 480
  const h = 224

  ctx.save()
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()

  // Deep dark glass fill
  const grad = ctx.createLinearGradient(x, y, x + w, y + h)
  grad.addColorStop(0, 'rgba(10, 25, 48, 0.92)')
  grad.addColorStop(1, 'rgba(4, 12, 25, 0.96)')
  ctx.fillStyle = grad
  ctx.fill()

  // Glowing border
  ctx.lineWidth = 4
  const borderGrad = ctx.createLinearGradient(x, y, x + w, y)
  borderGrad.addColorStop(0, accentColor)
  borderGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.4)')
  borderGrad.addColorStop(1, accentColor)
  ctx.strokeStyle = borderGrad
  ctx.stroke()
  ctx.restore()

  // Indicator Dot
  const dotX = isRtl ? 450 : 62
  const dotY = 70
  ctx.beginPath()
  ctx.arc(dotX, dotY, 10, 0, Math.PI * 2)
  ctx.fillStyle = accentColor
  ctx.shadowColor = accentColor
  ctx.shadowBlur = 18
  ctx.fill()
  ctx.shadowBlur = 0

  // Title Text
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 36px "Cairo", system-ui, -apple-system, sans-serif'
  ctx.textAlign = isRtl ? 'right' : 'left'
  const textX = isRtl ? 425 : 88
  ctx.fillText(title, textX, 82)

  // Subtitle / English / Description
  ctx.fillStyle = 'rgba(203, 213, 225, 0.9)'
  ctx.font = '600 24px system-ui, -apple-system, sans-serif'
  ctx.fillText(subtitle, textX, 134)

  // Bottom Status Pill
  const pillW = 200
  const pillH = 36
  const pillX = isRtl ? 440 - pillW : 88
  const pillY = 160
  ctx.beginPath()
  ctx.roundRect(pillX, pillY, pillW, pillH, 18)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
  ctx.lineWidth = 1.5
  ctx.stroke()

  ctx.fillStyle = accentColor
  ctx.font = 'bold 18px "Cairo", system-ui, sans-serif'
  ctx.textAlign = isRtl ? 'right' : 'left'
  ctx.fillText('● نشط ومتزامن', isRtl ? pillX + pillW - 16 : pillX + 16, pillY + 24)

  const texture = new THREE.CanvasTexture(canvas)
  texture.generateMipmaps = true
  texture.minFilter = THREE.LinearMipmapLinearFilter
  return texture
}

// Hub texture for central floating OS Core
function createHubTexture(isRtl: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 340
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(canvas)

  ctx.clearRect(0, 0, 512, 340)

  // Background Glass panel
  ctx.beginPath()
  ctx.roundRect(16, 16, 480, 308, 28)
  const bgGrad = ctx.createLinearGradient(0, 0, 512, 340)
  bgGrad.addColorStop(0, 'rgba(8, 20, 42, 0.95)')
  bgGrad.addColorStop(0.5, 'rgba(2, 10, 24, 0.98)')
  bgGrad.addColorStop(1, 'rgba(0, 102, 220, 0.25)')
  ctx.fillStyle = bgGrad
  ctx.fill()

  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(0, 168, 232, 0.6)'
  ctx.stroke()

  // Header Bar
  ctx.beginPath()
  ctx.roundRect(16, 16, 480, 56, [28, 28, 0, 0])
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'
  ctx.fill()

  // Window dots
  ctx.fillStyle = '#f43f5e'
  ctx.beginPath()
  ctx.arc(42, 44, 7, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#f59e0b'
  ctx.beginPath()
  ctx.arc(64, 44, 7, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#10b981'
  ctx.beginPath()
  ctx.arc(86, 44, 7, 0, Math.PI * 2)
  ctx.fill()

  // Title
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 32px "Cairo", system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('يلا كلينيك — Yalla Clinic OS', 256, 130)

  // Subtitle
  ctx.fillStyle = '#38bdf8'
  ctx.font = 'bold 22px "Cairo", system-ui, sans-serif'
  ctx.fillText('منظومة العيادات السحابية الذكية', 256, 175)

  // Network Flow metric
  ctx.fillStyle = '#94a3b8'
  ctx.font = '18px monospace'
  ctx.fillText('FLOW STATUS: 100% OPERATIONAL', 256, 220)

  // Bottom Pulsing Badge
  ctx.beginPath()
  ctx.roundRect(106, 245, 300, 44, 22)
  const pillGrad = ctx.createLinearGradient(106, 245, 406, 245)
  pillGrad.addColorStop(0, '#0066dc')
  pillGrad.addColorStop(1, '#00a8e8')
  ctx.fillStyle = pillGrad
  ctx.fill()

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 20px "Cairo", system-ui, sans-serif'
  ctx.fillText('اتصال فوري مشفر ومباشر', 256, 274)

  const texture = new THREE.CanvasTexture(canvas)
  texture.generateMipmaps = true
  texture.minFilter = THREE.LinearMipmapLinearFilter
  return texture
}

export function ClinicPillars3DScene({
  heroImage,
  motionLevel = 'subtle',
  motionSpeed = 'normal',
  isRtl = true,
  className = '',
  fallbackView,
}: ClinicPillars3DSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [webGlSupported, setWebGlSupported] = useState<boolean | null>(null)
  const [isInteracting, setIsInteracting] = useState(false)

  // Check WebGL availability once
  useEffect(() => {
    try {
      const testCanvas = document.createElement('canvas')
      const gl =
        testCanvas.getContext('webgl') ||
        testCanvas.getContext('experimental-webgl')
      setWebGlSupported(Boolean(gl))
    } catch {
      setWebGlSupported(false)
    }
  }, [])

  useEffect(() => {
    if (webGlSupported === false || motionLevel === 'none') return

    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    // Multipliers for speed
    const speedMult =
      motionSpeed === 'fast' ? 1.6 : motionSpeed === 'slow' ? 0.6 : 1.0

    // Check reduced motion preference
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches

    // 1. Scene & Camera Setup
    const scene = new THREE.Scene()
    // Soft atmospheric fog matching page background
    scene.fog = new THREE.FogExp2(0x061122, 0.055)

    const width = container.clientWidth || 800
    const height = container.clientHeight || 520
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100)

    // Dynamic responsive camera tuning based on viewport ratio
    const updateCameraForViewport = () => {
      if (!container || !renderer) return
      const w = container.clientWidth || 800
      const h = container.clientHeight || 520
      const aspect = w / h
      camera.aspect = aspect

      if (aspect < 0.8) {
        // Mobile portrait (320px - 430px): zoom out gently to fit all 5 nodes comfortably
        camera.fov = 54
        camera.position.set(0, 0, 13.8)
      } else if (aspect < 1.25) {
        // Tablet / square viewports
        camera.fov = 48
        camera.position.set(0, 0, 12.0)
      } else {
        // Desktop widescreen
        camera.fov = 44
        camera.position.set(0, 0, 10.5)
      }
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }

    // 2. WebGL Renderer
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      })
    } catch (err) {
      console.warn('WebGL init error:', err)
      setWebGlSupported(false)
      return
    }

    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    renderer.setClearColor(0x000000, 0) // transparent background
    updateCameraForViewport()

    // 3. Lighting System
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2)
    scene.add(ambientLight)

    const cyanPointLight = new THREE.PointLight(0x00a8e8, 3.5, 20)
    cyanPointLight.position.set(4, 5, 4)
    scene.add(cyanPointLight)

    const bluePointLight = new THREE.PointLight(0x0066dc, 3.0, 20)
    bluePointLight.position.set(-4, -4, 3)
    scene.add(bluePointLight)

    const rimLight = new THREE.DirectionalLight(0xffffff, 1.4)
    rimLight.position.set(0, 6, 6)
    scene.add(rimLight)

    // 4. Main Scene Pivot (for pointer rotation & parallax)
    const scenePivot = new THREE.Group()
    scene.add(scenePivot)

    // 5. Central Hub (Floating 3D Tablet or Showcase Screen)
    const hubGroup = new THREE.Group()
    scenePivot.add(hubGroup)

    let hubMesh: THREE.Mesh | null = null
    const hubWidth = 4.2
    const hubHeight = 2.7
    const hubGeo = new THREE.BoxGeometry(hubWidth, hubHeight, 0.14)

    // Check if heroImage texture can be loaded, otherwise use procedural Canvas Texture
    let hubTexture: THREE.Texture
    if (heroImage) {
      const textureLoader = new THREE.TextureLoader()
      hubTexture = textureLoader.load(heroImage)
      hubTexture.generateMipmaps = true
      hubTexture.minFilter = THREE.LinearMipmapLinearFilter
    } else {
      hubTexture = createHubTexture(isRtl)
    }

    const hubMat = new THREE.MeshStandardMaterial({
      map: hubTexture,
      roughness: 0.25,
      metalness: 0.6,
      transparent: true,
    })

    const hubBorderMat = new THREE.MeshStandardMaterial({
      color: 0x00a8e8,
      emissive: 0x0066dc,
      emissiveIntensity: 0.35,
      roughness: 0.3,
      metalness: 0.8,
    })

    // Mesh with materials: front/back get texture, edges get metallic cyan rim
    const hubMaterials = [
      hubBorderMat, // right
      hubBorderMat, // left
      hubBorderMat, // top
      hubBorderMat, // bottom
      hubMat,       // front
      hubBorderMat, // back
    ]

    hubMesh = new THREE.Mesh(hubGeo, hubMaterials)
    hubGroup.add(hubMesh)

    // Subtle 3D Glass Bezel / Rim Frame
    const ringGeo = new THREE.TorusGeometry(3.6, 0.02, 16, 100)
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00a8e8,
      transparent: true,
      opacity: 0.35,
    })
    const orbitRing = new THREE.Mesh(ringGeo, ringMat)
    orbitRing.rotation.x = Math.PI / 2.3
    scenePivot.add(orbitRing)

    const ringGeo2 = new THREE.TorusGeometry(4.4, 0.015, 16, 100)
    const ringMat2 = new THREE.MeshBasicMaterial({
      color: 0x6366f1,
      transparent: true,
      opacity: 0.25,
    })
    const orbitRing2 = new THREE.Mesh(ringGeo2, ringMat2)
    orbitRing2.rotation.x = -Math.PI / 2.6
    orbitRing2.rotation.y = 0.4
    scenePivot.add(orbitRing2)

    // 6. 5 Pillar Node Meshes & Textures
    const pillarData = isRtl ? PILLARS_AR : PILLARS_EN
    const nodeGroups: {
      group: THREE.Group
      data: PillarNode
      initialPos: THREE.Vector3
      mesh: THREE.Mesh
      beaconMesh: THREE.Mesh
    }[] = []

    pillarData.forEach((p) => {
      const nodeGroup = new THREE.Group()
      const initV = new THREE.Vector3(...p.pos)
      nodeGroup.position.copy(initV)

      // Card Mesh with badge canvas texture
      const badgeTex = createBadgeTexture(p.title, p.subtitle, p.hexColor, isRtl)
      const badgeGeo = new THREE.PlaneGeometry(1.85, 0.95)
      const badgeMat = new THREE.MeshBasicMaterial({
        map: badgeTex,
        transparent: true,
        side: THREE.DoubleSide,
      })
      const badgeMesh = new THREE.Mesh(badgeGeo, badgeMat)
      nodeGroup.add(badgeMesh)

      // 3D Beacon Node Anchor (Spherical glowing core)
      const beaconGeo = new THREE.SphereGeometry(0.18, 24, 24)
      const beaconMat = new THREE.MeshStandardMaterial({
        color: p.color,
        emissive: p.color,
        emissiveIntensity: 0.9,
        roughness: 0.2,
      })
      const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat)
      beaconMesh.position.set(0, -0.65, 0.05)
      nodeGroup.add(beaconMesh)

      // Outer pulse ring for beacon
      const pulseGeo = new THREE.RingGeometry(0.24, 0.3, 32)
      const pulseMat = new THREE.MeshBasicMaterial({
        color: p.color,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
      })
      const pulseMesh = new THREE.Mesh(pulseGeo, pulseMat)
      pulseMesh.position.copy(beaconMesh.position)
      nodeGroup.add(pulseMesh)

      scenePivot.add(nodeGroup)
      nodeGroups.push({
        group: nodeGroup,
        data: p,
        initialPos: initV,
        mesh: badgeMesh,
        beaconMesh: pulseMesh,
      })
    })

    // 7. Dynamic Flow Light Trails (Spline curves connecting Hub -> Nodes -> Next Node)
    const curvePoints = [
      new THREE.Vector3(0, 0, 0),
      ...pillarData.map((p) => new THREE.Vector3(...p.pos)),
      new THREE.Vector3(0, 0, 0),
    ]
    const closedSpline = new THREE.CatmullRomCurve3(curvePoints, true)

    // Flow line geometry
    const splinePoints = closedSpline.getPoints(160)
    const splineGeo = new THREE.BufferGeometry().setFromPoints(splinePoints)
    const splineMat = new THREE.LineBasicMaterial({
      color: 0x00a8e8,
      transparent: true,
      opacity: 0.45,
      linewidth: 2,
    })
    const flowLine = new THREE.Line(splineGeo, splineMat)
    scenePivot.add(flowLine)

    // Glowing Particle Photons moving along the path
    const photonCount = 18
    const photonGeo = new THREE.SphereGeometry(0.06, 12, 12)
    const photonMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.95,
    })

    const photons: { mesh: THREE.Mesh; progress: number; speed: number }[] = []
    for (let i = 0; i < photonCount; i++) {
      const photonMesh = new THREE.Mesh(photonGeo, photonMat)
      scenePivot.add(photonMesh)
      photons.push({
        mesh: photonMesh,
        progress: i / photonCount,
        speed: (0.04 + Math.random() * 0.02) * speedMult,
      })
    }

    // Floating Stardust Particles
    const dustCount = 80
    const dustGeo = new THREE.BufferGeometry()
    const dustPositions = new Float32Array(dustCount * 3)
    for (let i = 0; i < dustCount * 3; i += 3) {
      dustPositions[i] = (Math.random() - 0.5) * 14
      dustPositions[i + 1] = (Math.random() - 0.5) * 8
      dustPositions[i + 2] = (Math.random() - 0.5) * 6
    }
    dustGeo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(dustPositions, 3)
    )
    const dustMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.04,
      transparent: true,
      opacity: 0.5,
    })
    const dustParticles = new THREE.Points(dustGeo, dustMat)
    scenePivot.add(dustParticles)

    // 8. Interaction & Parallax tracking
    const mouseTarget = { x: 0, y: 0 }
    const mouseCurrent = { x: 0, y: 0 }
    let isVisible = true
    let isTabActive = true
    let animationFrameId: number

    const handleMouseMove = (e: MouseEvent) => {
      if (prefersReducedMotion) return
      const rect = container.getBoundingClientRect()
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1)
      const maxAngle = motionLevel === 'advanced' ? 0.35 : 0.2
      mouseTarget.x = nx * maxAngle
      mouseTarget.y = ny * (maxAngle * 0.7)
    }

    const handleMouseLeave = () => {
      mouseTarget.x = 0
      mouseTarget.y = 0
    }

    container.addEventListener('mousemove', handleMouseMove)
    container.addEventListener('mouseleave', handleMouseLeave)

    // 9. Resize Handling
    const handleResize = () => {
      updateCameraForViewport()
    }
    window.addEventListener('resize', handleResize)

    // 10. IntersectionObserver: Pause RAF when scrolled offscreen
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        isVisible = entry.isIntersecting
      },
      { threshold: 0.05 }
    )
    observer.observe(container)

    // 11. Visibility Change: Pause when tab is inactive
    const handleVisibilityChange = () => {
      isTabActive = !document.hidden
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // 12. Main Animation Loop
    let clock = new THREE.Clock()
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate)

      // Only calculate & render when visible and tab active
      if (!isVisible || !isTabActive) return

      const delta = clock.getDelta()
      const elapsed = clock.getElapsedTime() * speedMult

      // Smooth pointer lerp
      mouseCurrent.x += (mouseTarget.x - mouseCurrent.x) * 0.05
      mouseCurrent.y += (mouseTarget.y - mouseCurrent.y) * 0.05

      // Pivot tilt
      scenePivot.rotation.y = mouseCurrent.x
      scenePivot.rotation.x = -mouseCurrent.y

      // Central Hub floating breathing motion
      if (!prefersReducedMotion) {
        hubGroup.position.y = Math.sin(elapsed * 1.2) * 0.12
        hubGroup.rotation.y = Math.sin(elapsed * 0.6) * 0.04
        orbitRing.rotation.z = elapsed * 0.15
        orbitRing2.rotation.z = -elapsed * 0.12

        // Orbit nodes gentle floating harmonic movement
        nodeGroups.forEach((ng, idx) => {
          const p = ng.data
          const freq = elapsed * p.orbitSpeed + p.phaseOffset
          // Harmonic wave in 3D
          ng.group.position.x = ng.initialPos.x + Math.sin(freq) * 0.22
          ng.group.position.y = ng.initialPos.y + Math.cos(freq * 1.3) * 0.18
          ng.group.position.z = ng.initialPos.z + Math.sin(freq * 0.8) * 0.15

          // Always face camera gently (Billboard effect for readability)
          ng.mesh.lookAt(camera.position)

          // Pulse beacon ring scale
          const pulseScale = 1 + (Math.sin(elapsed * 3 + idx) + 1) * 0.25
          ng.beaconMesh.scale.set(pulseScale, pulseScale, pulseScale)
        })

        // Photons traversing the clinic pipeline
        photons.forEach((photon) => {
          photon.progress = (photon.progress + photon.speed * delta) % 1
          const pt = closedSpline.getPoint(photon.progress)
          photon.mesh.position.copy(pt)
        })

        // Ambient stardust gentle rotation
        dustParticles.rotation.y = elapsed * 0.03
      }

      renderer.render(scene, camera)
    }

    animate()

    // 13. Comprehensive Disposal & Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId)
      observer.disconnect()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('resize', handleResize)
      container.removeEventListener('mousemove', handleMouseMove)
      container.removeEventListener('mouseleave', handleMouseLeave)

      // Geometries & Materials
      hubGeo.dispose()
      hubMat.dispose()
      hubBorderMat.dispose()
      ringGeo.dispose()
      ringMat.dispose()
      ringGeo2.dispose()
      ringMat2.dispose()
      splineGeo.dispose()
      splineMat.dispose()
      photonGeo.dispose()
      photonMat.dispose()
      dustGeo.dispose()
      dustMat.dispose()

      nodeGroups.forEach((ng) => {
        ng.mesh.geometry.dispose()
        if (Array.isArray(ng.mesh.material)) {
          ng.mesh.material.forEach((m) => m.dispose())
        } else {
          ng.mesh.material.dispose()
        }
      })

      renderer.dispose()
    }
  }, [
    webGlSupported,
    heroImage,
    motionLevel,
    motionSpeed,
    isRtl,
  ])

  // Fallback to static architectural view if WebGL is unsupported or disabled
  if (webGlSupported === false || motionLevel === 'none') {
    return <>{fallbackView}</>
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-[380px] sm:h-[480px] lg:h-[580px] overflow-hidden rounded-3xl bg-gradient-to-b from-[#081528] via-[#050e1c] to-[#030914] select-none touch-pan-y ${className}`}
    >
      {/* Interactive Canvas with Touch-Pan-Y to preserve vertical scrolling */}
      <canvas
        ref={canvasRef}
        className="w-full h-full block cursor-grab active:cursor-grabbing touch-pan-y"
      />

      {/* Floating Status & Interaction Pill */}
      <div className="absolute bottom-4 left-4 right-4 sm:right-auto sm:left-4 z-20 flex items-center justify-between sm:justify-start gap-3 px-4 py-2 rounded-2xl bg-slate-900/80 backdrop-blur-md border border-slate-700/60 text-xs text-slate-300 pointer-events-auto">
        <span className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50" />
          <span className="font-bold text-white">مشهد ثلاثي الأبعاد تفاعلي</span>
        </span>
        <span className="hidden sm:inline text-slate-500">•</span>
        <span className="text-[11px] text-slate-400">
          حرّك المؤشر لاستكشاف ترابط وظائف العيادة
        </span>
      </div>

      {/* Subtle Rim Gradient Vignette */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#030914] via-transparent to-transparent opacity-60"
      />
    </div>
  )
}
