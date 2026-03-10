import { useEffect, useRef, useCallback, useState, forwardRef, useImperativeHandle } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as THREE from 'three'
import { GraphData, NodeObj, LinkObj, SimNode, SimLink, Spherical, GraphHandle } from '../types/graph'
import {
  initSimNodes, buildLinksRaw, buildSceneObjects, clearSceneObjects,
  runPhysics, syncPositions, setHoveredNode, applyCam, buildLabelSprite, hexToInt,
} from '../lib/graphBuilder'
import { Theme, themeBgInt, themeFogColor } from '../hooks/useTheme'
import { GraphStateEngine } from '../engine/GraphStateEngine'

interface Props {
  graphData: GraphData
  sidebarOpen: boolean
  isEditMode: boolean
  theme: Theme
  onOpenPage: (node: import('../types/graph').NodeData) => void
  onToggleSidebar: () => void
  onToggleTheme: () => void
  onToggleEditMode: () => void
  onGoHome: () => void
  onSave: () => void
  onRename?: (title: string) => void
  onNodeRename?: (id: string, label: string) => void
}

// ─── Mobile D-Pad ─────────────────────────────────────────────────────────────
type DPadMode = 'pan' | 'rotate'

function DPad({
  onAction,
  isDark,
}: {
  onAction: (dir: 'up' | 'down' | 'left' | 'right', mode: DPadMode) => void
  isDark: boolean
}) {
  const [mode, setMode] = useState<DPadMode>('pan')

  const btnBase =
    'flex items-center justify-center w-11 h-11 rounded-xl border text-muted2 active:text-accent active:border-accent active:bg-accent/20 transition-all duration-100 select-none'
  const btnStyle = isDark
    ? 'border-border2 bg-surface/90'
    : 'border-border bg-surface/95'

  const fire = (dir: 'up' | 'down' | 'left' | 'right') => {
    onAction(dir, mode)
  }

  const ArrowSVG = ({ dir }: { dir: string }) => {
    const paths: Record<string, string> = {
      up:    'M6 10L10 6L14 10',
      down:  'M6 10L10 14L14 10',
      left:  'M10 6L6 10L10 14',
      right: 'M10 6L14 10L10 14',
    }
    return (
      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={paths[dir]} />
      </svg>
    )
  }

  return (
    // Only show on touch-primary devices (md breakpoint hides it on desktop)
    <div className="absolute bottom-20 right-5 z-30 md:hidden flex flex-col items-center gap-1">
      {/* Mode toggle pill */}
      <button
        onClick={() => setMode(m => m === 'pan' ? 'rotate' : 'pan')}
        className={`mb-1 px-3 py-1 rounded-full text-[9px] tracking-widest border transition-all duration-200 ${
          mode === 'rotate'
            ? 'border-accent text-accent bg-accent/15'
            : isDark ? 'border-border2 text-muted bg-surface/90' : 'border-border text-muted bg-surface/95'
        }`}
      >
        {mode === 'pan' ? '⟷ PAN' : '↺ ROTATE'}
      </button>

      {/* D-pad grid */}
      <div className="grid grid-cols-3 gap-1">
        <div />
        <button className={`${btnBase} ${btnStyle}`} onPointerDown={() => fire('up')}>
          <ArrowSVG dir="up" />
        </button>
        <div />
        <button className={`${btnBase} ${btnStyle}`} onPointerDown={() => fire('left')}>
          <ArrowSVG dir="left" />
        </button>
        <div className="w-11 h-11 rounded-xl border border-border/40 flex items-center justify-center">
          <span className="text-[8px] text-muted/60 tracking-widest">{mode === 'pan' ? 'PAN' : 'ROT'}</span>
        </div>
        <button className={`${btnBase} ${btnStyle}`} onPointerDown={() => fire('right')}>
          <ArrowSVG dir="right" />
        </button>
        <div />
        <button className={`${btnBase} ${btnStyle}`} onPointerDown={() => fire('down')}>
          <ArrowSVG dir="down" />
        </button>
        <div />
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
const Graph3D = forwardRef<GraphHandle, Props>(function Graph3D({ graphData, sidebarOpen, isEditMode, theme, onOpenPage, onToggleSidebar, onToggleEditMode, onToggleTheme, onGoHome, onSave, onRename, onNodeRename }, ref) {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const sceneRef     = useRef<THREE.Scene | null>(null)
  const rendererRef  = useRef<THREE.WebGLRenderer | null>(null)
  const cameraRef    = useRef<THREE.PerspectiveCamera | null>(null)
  const pLightRef    = useRef<THREE.PointLight | null>(null)
  const pLight2Ref   = useRef<THREE.PointLight | null>(null)
  const fogRef       = useRef<THREE.FogExp2 | null>(null)

  const nodeObjsRef    = useRef<NodeObj[]>([])
  const linkObjsRef    = useRef<LinkObj[]>([])
  const simNodesRef    = useRef<SimNode[]>([])
  const simLinksRef    = useRef<SimLink[]>([])
  const simTickRef     = useRef(0)
  const engineRef      = useRef<GraphStateEngine | null>(null)
  const hovObjRef      = useRef<NodeObj | LinkObj | null>(null)
  const draggedNodeRef = useRef<SimNode | null>(null)
  const draggedLinkRef = useRef<LinkObj | null>(null)
  const draggedLinkDragPtRef = useRef<THREE.Vector3 | null>(null)

  const sphRef       = useRef<Spherical>({ theta: 0.5, phi: 1.3, radius: 440 })
  const panOffRef    = useRef(new THREE.Vector3())
  const panTargetRef = useRef(new THREE.Vector3())

  const dragPlaneRef = useRef(new THREE.Plane())
  const raycasterRef = useRef(new THREE.Raycaster())
  const mouse2Ref    = useRef(new THREE.Vector2())
  const tooltipRef   = useRef<HTMLDivElement>(null)
  const previewRef   = useRef<HTMLDivElement>(null)

  const mouseRef    = useRef({ down: false, right: false, middle: false, shift: false, totalDist: 0, last: { x: 0, y: 0 }, start: { x: 0, y: 0 } })
  const autoRotEnabledRef = useRef(sessionStorage.getItem('idleRotate') !== 'false')
  const autoRotRef  = useRef(autoRotEnabledRef.current)
  const edgeHoverEnabledRef = useRef(sessionStorage.getItem('edgeHover') === 'true')
  const continuousPhysicsEnabledRef = useRef(sessionStorage.getItem('continuousPhysics') !== 'false')
  const edgeDragEnabledRef = useRef(sessionStorage.getItem('edgeDrag') === 'true')
  const nodeIconsEnabledRef = useRef(sessionStorage.getItem('showNodeIcons') !== 'false')
  const lockCameraEnabledRef = useRef(sessionStorage.getItem('lockCamera') !== 'false')
  const hoverPreviewEnabledRef = useRef(sessionStorage.getItem('hoverPreview') === 'true')
  const lockedNodeIdRef = useRef<string | null>(null)
  const idleTRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const animRef     = useRef(0)
  const tRef           = useRef(0)
  const labelMultRef   = useRef(0.3 + ((Number(sessionStorage.getItem('labelLevel') || 5) - 1) / 8) * 1.9)        // user-adjustable label scale multiplier
  const jigglingRef    = useRef(false)    // true while jiggle animation running

  const [renamer, setRenamer] = useState<{ id: string, label: string, cx: number, cy: number } | null>(null)
  const clickRef = useRef<{ time: number, id: string | null }>({ time: 0, id: null })

  // Held arrow keys: each key maps to how long it's been held (for acceleration)
  const heldKeysRef = useRef<Set<string>>(new Set())

  const touchRef = useRef({
    active: false,
    count: 0,
    last: [{ x: 0, y: 0 }, { x: 0, y: 0 }],
    start: [{ x: 0, y: 0 }, { x: 0, y: 0 }],
    totalDist: 0,
    lastPinchDist: 0,
    lastMidpoint: { x: 0, y: 0 },
  })
  
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false)
  const [showSavedToast, setShowSavedToast] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [hoverPreviewOn, setHoverPreviewOn] = useState(() => sessionStorage.getItem('hoverPreview') === 'true')
  const isCommittingRef = useRef(false)
  
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(graphData.title)
  // Update draft if graph changes externally
  useEffect(() => { setTitleDraft(graphData.title) }, [graphData.title])

  const commitTitleRename = () => {
    isCommittingRef.current = true
    const trimmed = titleDraft.trim()
    if (trimmed && trimmed !== graphData.title && onRename) onRename(trimmed)
    else setTitleDraft(graphData.title) // revert
    setEditingTitle(false)
    setTimeout(() => { isCommittingRef.current = false }, 100)
  }

  const handleSaveClick = () => {
    onSave()
    setShowSavedToast(true)
    setTimeout(() => setShowSavedToast(false), 2000)
  }

  // ── helpers ──────────────────────────────────────────────────────────────────
  const sph = () => sphRef.current

  const doApplyCam = useCallback(() => {
    if (!cameraRef.current) return
    applyCam(cameraRef.current, sphRef.current, panOffRef.current)
  }, [])

  const kickIdle = useCallback(() => {
    autoRotRef.current = false
    if (idleTRef.current) clearTimeout(idleTRef.current)
    idleTRef.current = setTimeout(() => { 
      if (autoRotEnabledRef.current) autoRotRef.current = true 
    }, 3500)
  }, [])

  const getHit = useCallback((cx: number, cy: number): NodeObj | LinkObj | null => {
    const canvas = canvasRef.current
    if (!canvas || !cameraRef.current) return null
    const rect = canvas.getBoundingClientRect()
    mouse2Ref.current.x = ((cx - rect.left) / rect.width) * 2 - 1
    mouse2Ref.current.y = -((cy - rect.top) / rect.height) * 2 + 1
    
    // Increase line threshold for easier intersection
    raycasterRef.current.params.Line.threshold = 4
    raycasterRef.current.setFromCamera(mouse2Ref.current, cameraRef.current)
    
    // Intersect nodes first
    const nHits = raycasterRef.current.intersectObjects(nodeObjsRef.current.map(o => o.mesh))
    if (nHits.length) return nodeObjsRef.current.find(o => o.mesh === nHits[0].object) ?? null

    // Then intersect links
    if (edgeHoverEnabledRef.current) {
      const lHits = raycasterRef.current.intersectObjects(linkObjsRef.current.map(o => o.line))
      if (lHits.length) return linkObjsRef.current.find(o => o.line === lHits[0].object) ?? null
    }

    return null
  }, [])

  const showTooltip = useCallback((cx: number, cy: number, hit: NodeObj | LinkObj | null) => {
    const tt      = tooltipRef.current
    const preview = previewRef.current
    if (!tt || !preview) return

    if (!hit) {
      tt.style.opacity      = '0'
      preview.style.opacity = '0'
      return
    }

    if (!hoverPreviewEnabledRef.current) {
      // ── Simple label tooltip (existing behaviour) ──────────────────────────
      preview.style.opacity = '0'
      tt.style.opacity = '1'
      tt.style.left = `${cx + 14}px`
      tt.style.top  = `${cy - 8}px`
      if ('node' in hit) {
        tt.textContent = `${hit.node.icon} ${hit.node.label}`
      } else {
        tt.textContent = `${hit.source.label} ↔ ${hit.target.label}`
      }
    } else {
      // ── Rich preview popup ─────────────────────────────────────────────────
      tt.style.opacity = '0'

      if ('node' in hit) {
        const node = hit.node
        // Build inner HTML: header + divider + scrollable content
        preview.innerHTML = [
          `<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">`,
          `<span style="font-size:15px;line-height:1">${node.icon}</span>`,
          `<strong style="font-size:11px;color:var(--text);letter-spacing:.04em;line-height:1.2">${node.label}</strong>`,
          `</div>`,
          `<div style="height:1px;background:var(--border);margin-bottom:7px"></div>`,
          `<div style="font-size:10.5px;color:var(--muted2);line-height:1.65">${node.content || '<em>No content</em>'}</div>`,
        ].join('')

        // Clamp position to viewport
        const W = window.innerWidth, H = window.innerHeight
        const pw = 264, ph = 220
        const left = cx + 18 + pw > W ? cx - pw - 10 : cx + 18
        const top  = cy - 8 + ph > H ? H - ph - 12  : cy - 8

        preview.style.left    = `${left}px`
        preview.style.top     = `${top}px`
        preview.style.opacity = '1'
        preview.scrollTop     = 0
      } else {
        // Edge hover — fall back to simple tooltip
        tt.style.left    = `${cx + 14}px`
        tt.style.top     = `${cy - 8}px`
        tt.textContent   = `${hit.source.label} ↔ ${hit.target.label}`
        tt.style.opacity = '1'
        preview.style.opacity = '0'
      }
    }
  }, [])

  // Shared pan helper — used by mouse, keyboard, and D-pad
  const doPan = useCallback((dx: number, dy: number) => {
    lockedNodeIdRef.current = null
    const speed = sph().radius * 0.0012
    const right = new THREE.Vector3()
    right.crossVectors(
      cameraRef.current!.getWorldDirection(new THREE.Vector3()),
      new THREE.Vector3(0, 1, 0)
    ).normalize()
    panTargetRef.current.addScaledVector(right, -dx * speed)
    panTargetRef.current.addScaledVector(new THREE.Vector3(0, 1, 0), dy * speed)
  }, [])

  const resize = useCallback(() => {
    const container = containerRef.current
    const renderer  = rendererRef.current
    const camera    = cameraRef.current
    if (!container || !renderer || !camera) return
    renderer.setSize(container.clientWidth, container.clientHeight)
    camera.aspect = container.clientWidth / container.clientHeight
    camera.updateProjectionMatrix()
  }, [])

  // ── theme → renderer bg ──────────────────────────────────────────────────────
  useEffect(() => {
    rendererRef.current?.setClearColor(themeBgInt(theme), 1)
    if (fogRef.current) fogRef.current.color.setHex(themeFogColor(theme))
  }, [theme])

  // ── rebuild graph when data changes ──────────────────────────────────────────
  useEffect(() => {
    if (!engineRef.current) return   // engine not yet created (mount effect runs after)
    engineRef.current.load(graphData)
    hovObjRef.current    = null
    draggedNodeRef.current = null
  }, [graphData])

  // ── mount Three.js once ───────────────────────────────────────────────────────
  useEffect(() => {
    const canvas    = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(themeBgInt(theme), 1)
    rendererRef.current = renderer

    const scene = new THREE.Scene()
    const initialDrawLevel = Number(sessionStorage.getItem('drawLevel') || 9)
    const initialDensity = 0.003 - ((initialDrawLevel - 1) / 8) * 0.003
    const fog   = new THREE.FogExp2(themeFogColor(theme), initialDensity)
    scene.fog   = fog; fogRef.current = fog; sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 3000)
    cameraRef.current = camera

    scene.add(new THREE.AmbientLight(0xffffff, 0.25))
    const pLight = new THREE.PointLight(0x8877ff, 3, 800); scene.add(pLight); pLightRef.current = pLight
    const pLight2 = new THREE.PointLight(0x44aaff, 1.5, 600); scene.add(pLight2); pLight2Ref.current = pLight2

    // ── Create and initialise the engine ─────────────────────────────────────
    const engine = new GraphStateEngine(
      scene,
      simNodesRef,
      simLinksRef,
      nodeObjsRef,
      linkObjsRef,
      simTickRef,
    )
    engineRef.current = engine
    engine.load(graphData)

    resize()

    const loop = () => {
      animRef.current = requestAnimationFrame(loop)
      tRef.current += 0.012

      // ── apply held arrow keys each frame ──────────────────────────────────
      const held = heldKeysRef.current
      if (held.size > 0 && cameraRef.current) {
        const step = sph().radius * 0.006
        const rotStep = 0.022

        if (held.has('ArrowLeft'))  {
          if (held.has('Shift')) { sph().theta += rotStep } else { doPan(step * 80, 0) }
        }
        if (held.has('ArrowRight')) {
          if (held.has('Shift')) { sph().theta -= rotStep } else { doPan(-step * 80, 0) }
        }
        if (held.has('ArrowUp'))    {
          if (held.has('Shift')) { sph().phi = Math.max(0.1, sph().phi - rotStep) } else { doPan(0, -step * 80) }
        }
        if (held.has('ArrowDown'))  {
          if (held.has('Shift')) { sph().phi = Math.min(Math.PI - 0.1, sph().phi + rotStep) } else { doPan(0, step * 80) }
        }
      }

      // ── physics tick (delegated to engine) ────────────────────────────────
      engineRef.current?.tick(draggedNodeRef.current?.id)
      syncPositions(nodeObjsRef.current, linkObjsRef.current, sphRef.current, labelMultRef.current)

      nodeObjsRef.current.forEach((o, i) => {
        const hoverIsNode = hovObjRef.current && 'node' in hovObjRef.current
        const hoverIsLink = hovObjRef.current && 'source' in hovObjRef.current
        
        const isHoveredNode = hoverIsNode && o.node.id === (hovObjRef.current as NodeObj).node.id
        
        if (!isHoveredNode) {
          const p = 1 + 0.18 * Math.sin(tRef.current * 1.6 + i * 0.9)
          let base = 0.055
          
          if (hoverIsNode) {
            base = (hovObjRef.current as NodeObj).node.connections.includes(o.node.id) ? 0.1 : 0.01
          } else if (hoverIsLink) {
            const l = hovObjRef.current as LinkObj
            base = (o.node.id === l.source.id || o.node.id === l.target.id) ? 0.15 : 0.01
          }
          
          o.glowMat.opacity = base * p
        }
      })

      pLightRef.current?.position.set(140*Math.sin(tRef.current*.28), 90*Math.cos(tRef.current*.18), 110*Math.sin(tRef.current*.22))
      pLight2Ref.current?.position.set(-120*Math.cos(tRef.current*.15), 80*Math.sin(tRef.current*.19), -100*Math.cos(tRef.current*.12))

      if (autoRotRef.current) sphRef.current.theta += 0.0025
      if (lockedNodeIdRef.current) {
        const n = simNodesRef.current.find(sn => sn.id === lockedNodeIdRef.current)
        if (n) panTargetRef.current.set(n.x, n.y, n.z)
      }
      panOffRef.current.lerp(panTargetRef.current, 0.07)
      doApplyCam()
      renderer.render(scene, camera)
    }
    doApplyCam()
    loop()

    setTimeout(() => {
      const el = document.getElementById('graph-hint')
      if (el) el.style.opacity = '0'
    }, 6000)

    return () => {
      cancelAnimationFrame(animRef.current)
      renderer.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── resize — use ResizeObserver on the container so sidebar open/close
  // (which can fire spurious window resize events in some browsers) never
  // triggers a false renderer resize and camera-aspect snap.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const ro = new ResizeObserver(() => resize())
    ro.observe(container)
    return () => ro.disconnect()
  }, [resize])

  // ── keyboard: arrow keys + shift+arrow ───────────────────────────────────────
  useEffect(() => {
    const arrowKeys = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'])

    const onKeyDown = (e: KeyboardEvent) => {
      // Don't steal input from text fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (!arrowKeys.has(e.key) && e.key !== 'Shift') return
      e.preventDefault()
      heldKeysRef.current.add(e.key)
      kickIdle()
    }
    const onKeyUp = (e: KeyboardEvent) => {
      heldKeysRef.current.delete(e.key)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup',   onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup',   onKeyUp)
    }
  }, [kickIdle])

  // ── mouse events ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault()
      kickIdle()
      const isShift = e.shiftKey
      mouseRef.current = {
        down: true,
        right: e.button === 2,
        middle: e.button === 1,
        shift: isShift,
        totalDist: 0,
        last: { x: e.clientX, y: e.clientY },
        start: { x: e.clientX, y: e.clientY },
      }

      if (e.button === 2 && lockCameraEnabledRef.current) {
        const hit = getHit(e.clientX, e.clientY)
        if (hit && 'node' in hit) {
          lockedNodeIdRef.current = hit.node.id
        }
      } else if (e.button !== 2 && e.button !== 1 && !isShift) {
        const hit = getHit(e.clientX, e.clientY)
        if (hit) {
          if ('node' in hit) {
            draggedNodeRef.current = hit.node
            const camDir = new THREE.Vector3()
            cameraRef.current!.getWorldDirection(camDir)
            dragPlaneRef.current.setFromNormalAndCoplanarPoint(
              camDir,
              new THREE.Vector3(hit.node.x, hit.node.y, hit.node.z)
            )
            canvas.style.cursor = 'grabbing'
            if (continuousPhysicsEnabledRef.current) engineRef.current?.resetPhysics()
          } else if ('source' in hit && edgeDragEnabledRef.current) {
            draggedLinkRef.current = hit
            const camDir = new THREE.Vector3()
            cameraRef.current!.getWorldDirection(camDir)
            dragPlaneRef.current.setFromNormalAndCoplanarPoint(
              camDir,
              new THREE.Vector3(
                (hit.source.x + hit.target.x) / 2,
                (hit.source.y + hit.target.y) / 2,
                (hit.source.z + hit.target.z) / 2
              )
            )
            draggedLinkDragPtRef.current = null
            canvas.style.cursor = 'grabbing'
            if (continuousPhysicsEnabledRef.current) engineRef.current?.resetPhysics()
          }
        }
      }
    }

    const onMouseMove = (e: MouseEvent) => {
      const m  = mouseRef.current
      const dx = e.clientX - m.last.x
      const dy = e.clientY - m.last.y
      m.totalDist += Math.sqrt(dx * dx + dy * dy)
      m.last = { x: e.clientX, y: e.clientY }

      if (m.down) {
        if (continuousPhysicsEnabledRef.current && (draggedNodeRef.current || draggedLinkRef.current)) {
          engineRef.current?.resetPhysics()
        }

        if (draggedNodeRef.current || draggedLinkRef.current) {
          const rect = canvas.getBoundingClientRect()
          mouse2Ref.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
          mouse2Ref.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
          raycasterRef.current.setFromCamera(mouse2Ref.current, cameraRef.current!)
          const pt = new THREE.Vector3()
          raycasterRef.current.ray.intersectPlane(dragPlaneRef.current, pt)
          if (pt) {
            if (draggedNodeRef.current) {
              const n = draggedNodeRef.current
              n.x = pt.x; n.y = pt.y; n.z = pt.z
              n.vx = n.vy = n.vz = 0
            } else if (draggedLinkRef.current) {
              const l = draggedLinkRef.current
              if (!draggedLinkDragPtRef.current) {
                draggedLinkDragPtRef.current = pt.clone()
              } else {
                const dx = pt.x - draggedLinkDragPtRef.current.x
                const dy = pt.y - draggedLinkDragPtRef.current.y
                const dz = pt.z - draggedLinkDragPtRef.current.z
                l.source.x += dx; l.source.y += dy; l.source.z += dz
                l.target.x += dx; l.target.y += dy; l.target.z += dz
                l.source.vx = l.source.vy = l.source.vz = 0
                l.target.vx = l.target.vy = l.target.vz = 0
                draggedLinkDragPtRef.current.copy(pt)
              }
            }
          }
          return
        }
      }

      if (m.down && !draggedNodeRef.current && !draggedLinkRef.current) {
        // Pan: right-click drag OR shift+left-drag
        if (m.right || m.shift) {
          doPan(dx, dy)
        } else if (m.middle) {
          // Middle drag to zoom
          sph().radius = Math.max(80, Math.min(1000, sph().radius + dy * 0.45))
        } else {
          // Rotate
          sph().theta -= dx * 0.007
          sph().phi = Math.max(0.1, Math.min(Math.PI - 0.1, sph().phi - dy * 0.007))
        }
        doApplyCam()
        return
      }

      if (!m.down) {
        const hit = getHit(e.clientX, e.clientY)
        hovObjRef.current = setHoveredNode(hit, hovObjRef.current, nodeObjsRef.current, linkObjsRef.current)
        canvas.style.cursor = hit ? 'grab' : 'default'
        showTooltip(e.clientX, e.clientY, hit)
      }
    }

    const onMouseUp = (e: MouseEvent) => {
      const m = mouseRef.current
      if (!m.right && !m.shift && m.totalDist < 5) {
        let doubleClickedSprite = false
        const now = Date.now()
        
        // Raycast against label sprites for double-click rename
        const rect = canvas.getBoundingClientRect()
        mouse2Ref.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
        mouse2Ref.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
        raycasterRef.current.setFromCamera(mouse2Ref.current, cameraRef.current!)
        
        const sprites = nodeObjsRef.current.map(o => o.node._sprite).filter(Boolean) as THREE.Sprite[]
        if (sprites.length > 0) {
          const sHits = raycasterRef.current.intersectObjects(sprites)
          if (sHits.length > 0) {
            const hitSprite = sHits[0].object
            const matchObj = nodeObjsRef.current.find(o => o.node._sprite === hitSprite)
            if (matchObj) {
              const id = matchObj.node.id
              if (clickRef.current.id === id && now - clickRef.current.time < 350) {
                // Double click!
                doubleClickedSprite = true
                setRenamer({ id, label: matchObj.node.label, cx: e.clientX, cy: e.clientY })
                clickRef.current = { time: 0, id: null }
              } else {
                clickRef.current = { time: now, id }
              }
            }
          } else {
            clickRef.current = { time: 0, id: null }
          }
        }

        if (!doubleClickedSprite) {
          const hit = getHit(e.clientX, e.clientY)
          if (hit && 'node' in hit) onOpenPage(hit.node)
        }
      }
      draggedNodeRef.current = null
      draggedLinkRef.current = null
      draggedLinkDragPtRef.current = null
      mouseRef.current.down = false
      canvas.style.cursor = 'default'
      showTooltip(0, 0, null)
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      kickIdle()
      sph().radius = Math.max(80, Math.min(1000, sph().radius + e.deltaY * 0.45))
      doApplyCam()
    }

    canvas.addEventListener('mousedown', onMouseDown)
    canvas.addEventListener('contextmenu', e => e.preventDefault())
    canvas.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('contextmenu', e => e.preventDefault())
      canvas.removeEventListener('wheel', onWheel)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [doApplyCam, doPan, getHit, kickIdle, onOpenPage, showTooltip])

  // ── touch events ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const getTouchMidpoint = (t: TouchList) => ({
      x: (t[0].clientX + t[1].clientX) / 2,
      y: (t[0].clientY + t[1].clientY) / 2,
    })
    const getPinchDist = (t: TouchList) =>
      Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)

    const onTouchStart = (e: TouchEvent) => {
      kickIdle()
      const tr = touchRef.current
      tr.active = true; tr.count = e.touches.length; tr.totalDist = 0
      tr.start = [{ x: e.touches[0].clientX, y: e.touches[0].clientY }, { x: e.touches[1]?.clientX ?? 0, y: e.touches[1]?.clientY ?? 0 }]
      tr.last  = [...tr.start]
      if (e.touches.length === 2) {
        tr.lastPinchDist = getPinchDist(e.touches)
        tr.lastMidpoint  = getTouchMidpoint(e.touches)
      }
      if (e.touches.length === 1) {
        const hit = getHit(e.touches[0].clientX, e.touches[0].clientY)
        if (hit) {
          if ('node' in hit) {
            draggedNodeRef.current = hit.node
            const camDir = new THREE.Vector3()
            cameraRef.current!.getWorldDirection(camDir)
            dragPlaneRef.current.setFromNormalAndCoplanarPoint(camDir, new THREE.Vector3(hit.node.x, hit.node.y, hit.node.z))
            if (continuousPhysicsEnabledRef.current) engineRef.current?.resetPhysics()
          } else if ('source' in hit && edgeDragEnabledRef.current) {
            draggedLinkRef.current = hit
            const camDir = new THREE.Vector3()
            cameraRef.current!.getWorldDirection(camDir)
            dragPlaneRef.current.setFromNormalAndCoplanarPoint(
              camDir,
              new THREE.Vector3((hit.source.x + hit.target.x) / 2, (hit.source.y + hit.target.y) / 2, (hit.source.z + hit.target.z) / 2)
            )
            draggedLinkDragPtRef.current = null
            if (continuousPhysicsEnabledRef.current) engineRef.current?.resetPhysics()
          }
        }
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      kickIdle()
      const tr = touchRef.current
      if (!tr.active) return

      if (e.touches.length === 1) {
        const dx = e.touches[0].clientX - tr.last[0].x
        const dy = e.touches[0].clientY - tr.last[0].y
        tr.totalDist += Math.sqrt(dx * dx + dy * dy)
        tr.last[0] = { x: e.touches[0].clientX, y: e.touches[0].clientY }

        if (continuousPhysicsEnabledRef.current && (draggedNodeRef.current || draggedLinkRef.current)) {
          engineRef.current?.resetPhysics()
        }

        if (draggedNodeRef.current || draggedLinkRef.current) {
          const rect = canvas.getBoundingClientRect()
          mouse2Ref.current.x = ((e.touches[0].clientX - rect.left) / rect.width) * 2 - 1
          mouse2Ref.current.y = -((e.touches[0].clientY - rect.top) / rect.height) * 2 + 1
          raycasterRef.current.setFromCamera(mouse2Ref.current, cameraRef.current!)
          const pt = new THREE.Vector3()
          raycasterRef.current.ray.intersectPlane(dragPlaneRef.current, pt)
          if (pt) {
            if (draggedNodeRef.current) {
              const n = draggedNodeRef.current; n.x = pt.x; n.y = pt.y; n.z = pt.z; n.vx = n.vy = n.vz = 0
            } else if (draggedLinkRef.current) {
              const l = draggedLinkRef.current
              if (!draggedLinkDragPtRef.current) {
                draggedLinkDragPtRef.current = pt.clone()
              } else {
                const dx = pt.x - draggedLinkDragPtRef.current.x
                const dy = pt.y - draggedLinkDragPtRef.current.y
                const dz = pt.z - draggedLinkDragPtRef.current.z
                l.source.x += dx; l.source.y += dy; l.source.z += dz
                l.target.x += dx; l.target.y += dy; l.target.z += dz
                l.source.vx = l.source.vy = l.source.vz = 0
                l.target.vx = l.target.vy = l.target.vz = 0
                draggedLinkDragPtRef.current.copy(pt)
              }
            }
          }
        } else {
          sph().theta -= dx * 0.009
          sph().phi = Math.max(0.1, Math.min(Math.PI - 0.1, sph().phi - dy * 0.009))
          doApplyCam()
        }
      } else if (e.touches.length === 2) {
        draggedNodeRef.current = null
        const pinchDist = getPinchDist(e.touches)
        const midpoint  = getTouchMidpoint(e.touches)
        sph().radius = Math.max(80, Math.min(1000, sph().radius - (pinchDist - tr.lastPinchDist) * 1.2))
        doPan(midpoint.x - tr.lastMidpoint.x, midpoint.y - tr.lastMidpoint.y)
        tr.lastPinchDist = pinchDist; tr.lastMidpoint = midpoint
        doApplyCam()
      }
    }

    const onTouchEnd = (e: TouchEvent) => {
      const tr = touchRef.current
      if (tr.count === 1 && tr.totalDist < 8 && !draggedNodeRef.current && !draggedLinkRef.current) {
        const touch = e.changedTouches[0]
        const hit = getHit(touch.clientX, touch.clientY)
        if (hit && 'node' in hit) onOpenPage(hit.node)
      }
      draggedNodeRef.current = null
      draggedLinkRef.current = null
      draggedLinkDragPtRef.current = null
      if (e.touches.length === 0) { tr.active = false; tr.count = 0 }
      else { tr.count = e.touches.length; if (e.touches.length === 1) tr.last[0] = { x: e.touches[0].clientX, y: e.touches[0].clientY } }
    }

    canvas.addEventListener('touchstart',  onTouchStart, { passive: true })
    canvas.addEventListener('touchmove',   onTouchMove,  { passive: false })
    canvas.addEventListener('touchend',    onTouchEnd,   { passive: true })
    canvas.addEventListener('touchcancel', onTouchEnd,   { passive: true })

    return () => {
      canvas.removeEventListener('touchstart',  onTouchStart)
      canvas.removeEventListener('touchmove',   onTouchMove)
      canvas.removeEventListener('touchend',    onTouchEnd)
      canvas.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [doApplyCam, doPan, getHit, kickIdle, onOpenPage])

  // ── D-pad action handler ──────────────────────────────────────────────────────
  const handleDPadAction = useCallback((dir: 'up' | 'down' | 'left' | 'right', mode: DPadMode) => {
    kickIdle()
    const panStep = sph().radius * 0.48
    const rotStep = 0.15

    if (mode === 'pan') {
      if (dir === 'left')  doPan(panStep, 0)
      if (dir === 'right') doPan(-panStep, 0)
      if (dir === 'up')    doPan(0, panStep)
      if (dir === 'down')  doPan(0, -panStep)
    } else {
      if (dir === 'left')  sph().theta += rotStep
      if (dir === 'right') sph().theta -= rotStep
      if (dir === 'up')    sph().phi = Math.min(Math.PI - 0.1, sph().phi + rotStep)
      if (dir === 'down')  sph().phi = Math.max(0.1, sph().phi - rotStep)
      doApplyCam()
    }
  }, [doPan, doApplyCam, kickIdle])

  // ── Imperative graph controls (exposed to parent via ref) ────────────────────
  useImperativeHandle(ref, () => ({
    jiggle() {
      if (jigglingRef.current) return
      jigglingRef.current = true
      simNodesRef.current.forEach(n => {
        const force = 40
        n.vx += (Math.random() - 0.5) * force
        n.vy += (Math.random() - 0.5) * force
        n.vz += (Math.random() - 0.5) * force
      })
      // Restart physics for a bit via the engine so the internal tick counter resets
      engineRef.current?.resetPhysics(120)
      setTimeout(() => { jigglingRef.current = false }, 1200)
    },

    randomizePositions() {
      const R = 200
      simNodesRef.current.forEach(n => {
        n.x = (Math.random() - 0.5) * R * 2
        n.y = (Math.random() - 0.5) * R * 2
        n.z = (Math.random() - 0.5) * R * 2
        n.vx = n.vy = n.vz = 0
      })
      engineRef.current?.resetPhysics()   // full restart from new positions
    },

    randomizeColors() {
      const scene = sceneRef.current
      if (!scene) return
      const palette = ['#ff6b6b','#ffd93d','#6bcb77','#4d96ff','#c77dff','#f4a261','#48cae4','#f72585','#06d6a0','#fca311']
      simNodesRef.current.forEach(n => {
        const hex = palette[Math.floor(Math.random() * palette.length)]
        n.hex = hex
        n.color = hexToInt(hex)
      })
      nodeObjsRef.current.forEach(o => {
        const hex = o.node.hex
        const col = new THREE.Color(hex)
        o.mat.color.set(col)
        o.mat.emissive.set(col)
        o.glowMat.color.set(col)
        const { sprite, sprMat } = buildLabelSprite(o.node.label)
        sprite.renderOrder = 999
        if (o.node._sprite) scene.remove(o.node._sprite)
        o.node._sprite = sprite
        o.node._sprMat = sprMat
        o.sprMat = sprMat
        scene.add(sprite)
      })
      linkObjsRef.current.forEach(lo => {
        const col = new THREE.Color(lo.source.hex).lerp(new THREE.Color(lo.target.hex), 0.5)
        lo.mat.color.set(col)
      })
    },

    setLabelScale(delta: number) {
      labelMultRef.current = Math.max(0.3, Math.min(3.0, labelMultRef.current + delta))
    },

    setFogDensity(density: number) {
      if (fogRef.current) fogRef.current.density = density
    },

    toggleAutoRotate() {
      autoRotEnabledRef.current = !autoRotEnabledRef.current
      autoRotRef.current = autoRotEnabledRef.current
      return autoRotEnabledRef.current
    },

    toggleEdgeHover() {
      edgeHoverEnabledRef.current = !edgeHoverEnabledRef.current
      return edgeHoverEnabledRef.current
    },

    toggleContinuousPhysics() {
      continuousPhysicsEnabledRef.current = !continuousPhysicsEnabledRef.current
      // When enabling physics, give it a gentle kick so it wakes up immediately
      if (continuousPhysicsEnabledRef.current) engineRef.current?.resetPhysics(60)
      return continuousPhysicsEnabledRef.current
    },

    isContinuousPhysicsEnabled() {
      return continuousPhysicsEnabledRef.current
    },

    toggleEdgeDrag() {
      edgeDragEnabledRef.current = !edgeDragEnabledRef.current
      return edgeDragEnabledRef.current
    },

    toggleNodeIcons() {
      nodeIconsEnabledRef.current = !nodeIconsEnabledRef.current
      const showIcons = nodeIconsEnabledRef.current
      const scene = sceneRef.current
      if (scene) {
        nodeObjsRef.current.forEach(o => {
          const { sprite, sprMat } = buildLabelSprite(o.node.label, showIcons ? o.node.icon : undefined)
          sprite.renderOrder = 999
          if (o.node._sprite) scene.remove(o.node._sprite)
          o.node._sprite = sprite
          o.node._sprMat = sprMat
          o.sprMat = sprMat
          scene.add(sprite)
        })
      }
      return showIcons
    },

    toggleLockCamera() {
      lockCameraEnabledRef.current = !lockCameraEnabledRef.current
      if (!lockCameraEnabledRef.current) lockedNodeIdRef.current = null
      return lockCameraEnabledRef.current
    },

    triggerSaveToast() {
      setShowSavedToast(true)
      setTimeout(() => setShowSavedToast(false), 2000)
    },

    getFreshData() {
      return engineRef.current?.getGraphData() ?? graphData
    },

    resetGraph(opts: { positions: boolean; colors: boolean }, original: GraphData) {
      if (opts.positions) {
        simNodesRef.current.forEach(n => {
          const orig = original.nodes.find(o => o.id === n.id)
          if (orig && orig.position) {
            n.x = orig.position.x
            n.y = orig.position.y
            n.z = orig.position.z
          } else {
            const R = 200
            n.x = (Math.random() - 0.5) * R * 2
            n.y = (Math.random() - 0.5) * R * 2
            n.z = (Math.random() - 0.5) * R * 2
          }
          n.vx = n.vy = n.vz = 0
        })
        engineRef.current?.resetPhysics()
      }
      if (opts.colors) {
        const scene = sceneRef.current
        simNodesRef.current.forEach(n => {
          const orig = original.nodes.find(o => o.id === n.id)
          if (orig && orig.hex) {
            n.hex = orig.hex
            n.color = hexToInt(orig.hex)
          }
        })
        if (scene) {
          nodeObjsRef.current.forEach(o => {
            const col = new THREE.Color(o.node.hex)
            o.mat.color.set(col)
            o.mat.emissive.set(col)
            o.glowMat.color.set(col)
          })
          linkObjsRef.current.forEach(lo => {
            const col = new THREE.Color(lo.source.hex).lerp(new THREE.Color(lo.target.hex), 0.5)
            lo.mat.color.set(col)
          })
        }
      }
    }
  }), [graphData])


  const isDark    = theme === 'dark'
  const headerBg  = isDark ? 'rgba(8,8,16,0.92)' : 'rgba(244,244,251,0.92)'
  const tooltipBg = isDark ? 'rgba(15,15,24,0.96)' : 'rgba(255,255,255,0.96)'

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden">
      {/* Node Index Left Sidebar */}
      <div 
        className={`absolute top-0 bottom-0 left-0 bg-surface/95 backdrop-blur-md border-r border-border transition-transform duration-300 z-50 flex flex-col w-64 shadow-2xl ${
          leftSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <span className="text-xs font-medium tracking-widest text-text">Index</span>
          <button 
            onClick={() => setLeftSidebarOpen(false)}
            className="text-muted hover:text-accent p-1 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {graphData.nodes.map(n => (
            <button
              key={n.id}
              onClick={() => {
                onOpenPage(n)
                setLeftSidebarOpen(false)
              }}
              className="w-full text-left px-3 py-2 text-xs text-muted hover:text-text hover:bg-surface2 rounded transition-colors truncate flex items-center gap-2"
            >
              <span>{n.icon}</span>
              <span>{n.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Button to open Left Sidebar */}
      <button
        onClick={() => setLeftSidebarOpen(true)}
        className={`absolute top-4 left-5 z-40 flex items-center justify-center p-2 rounded-md border border-border2 bg-surface/90 backdrop-blur-md text-muted2 hover:border-accent hover:text-accent hover:bg-accent/10 transition-all duration-300 ${leftSidebarOpen ? 'opacity-0 pointer-events-none -translate-x-4' : 'opacity-100 translate-x-0'}`}
        title="Open Node Index"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
      </button>

      {/* Clear Graph button */}
      <button
        onClick={() => setShowClearConfirm(true)}
        className={`absolute top-14 left-5 z-40 flex items-center justify-center p-2 rounded-md border border-border2 bg-surface/90 backdrop-blur-md text-muted2 hover:border-[#f87171] hover:text-[#f87171] hover:bg-[#f87171]/10 transition-all duration-300 ${leftSidebarOpen ? 'opacity-0 pointer-events-none -translate-x-4' : 'opacity-100 translate-x-0'}`}
        title="Clear Graph"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
          <path d="M10 11v6"></path>
          <path d="M14 11v6"></path>
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
        </svg>
      </button>

      {/* Clear Graph confirmation dialog */}
      <AnimatePresence>
        {showClearConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 z-[200] flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
            onClick={() => setShowClearConfirm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 10 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="relative mx-4 w-full max-w-xs rounded-2xl border border-border shadow-2xl p-6 flex flex-col gap-4"
              style={{ background: 'var(--surface)' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Icon */}
              <div className="flex items-center justify-center w-11 h-11 rounded-full mx-auto" style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)' }}>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                  <path d="M10 11v6"></path>
                  <path d="M14 11v6"></path>
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
                </svg>
              </div>

              {/* Text */}
              <div className="text-center">
                <p className="text-sm font-semibold text-text mb-1">Clear the entire graph?</p>
                <p className="text-[11px] text-muted leading-relaxed">This will permanently remove all nodes and edges. This action cannot be undone.</p>
              </div>

              {/* Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 py-2 text-[11px] tracking-widest text-muted2 border border-border2 rounded-lg hover:border-accent hover:text-accent hover:bg-accent/10 transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    engineRef.current?.clearGraph()
                    hovObjRef.current = null
                    draggedNodeRef.current = null
                    draggedLinkRef.current = null
                    setShowClearConfirm(false)
                  }}
                  className="flex-1 py-2 text-[11px] tracking-widest text-white rounded-lg transition-all duration-200 hover:opacity-90 active:scale-95"
                  style={{ background: '#f87171' }}
                >
                  Clear
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="absolute top-0 left-16 right-0 px-6 py-4 flex items-center gap-2.5 z-20 pointer-events-none"
        style={{ background: `linear-gradient(to bottom, ${headerBg}, transparent)` }}>
        <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />

        {/* Home button — right of the three circles */}
        <button
          onClick={onGoHome}
          title="Go Home"
          className="pointer-events-auto ml-1 flex items-center justify-center w-6 h-6 rounded-md border border-border2/60 bg-surface/70 backdrop-blur-sm text-muted2 hover:border-accent hover:text-accent hover:bg-accent/10 transition-all duration-200"
        >
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </button>
        <div className="ml-2 flex items-center pointer-events-auto">
          {editingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={e => setTitleDraft(e.target.value)}
              onBlur={() => { if (!isCommittingRef.current) { setEditingTitle(false); setTitleDraft(graphData.title); } }}
              onKeyDown={e => { if (e.key === 'Enter') commitTitleRename(); if (e.key === 'Escape') { setEditingTitle(false); setTitleDraft(graphData.title); } }}
              className="text-xs text-text tracking-widest bg-surface2/80 border border-accent rounded px-2 py-0.5 outline-none w-48"
              style={{ userSelect: 'text' }}
            />
          ) : (
            <span
              className="text-xs text-muted tracking-widest cursor-pointer hover:text-accent transition-colors"
              onClick={() => { setEditingTitle(true) }}
              title="Rename Graph"
            >
              {graphData.title}
            </span>
          )}
          <span className="text-xs text-muted tracking-widest whitespace-pre"> · 3D</span>
        </div>
        
        <span className="ml-auto pointer-events-auto text-[10px] text-muted px-3 py-1 rounded-full border border-border bg-surface/80 backdrop-blur-md">
          {graphData.nodes.length} nodes
        </span>
      </div>

      <AnimatePresence>
        {showSavedToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="absolute top-20 left-1/2 z-50 flex items-center gap-2 px-4 py-2 bg-surface text-text border border-accent/50 shadow-[0_0_15px_rgba(124,106,247,0.2)] rounded-full text-xs font-medium tracking-wide pointer-events-none"
          >
            <svg className="w-3.5 h-3.5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
            Graph Saved
          </motion.div>
        )}
      </AnimatePresence>

      {/* Canvas */}
      <canvas ref={canvasRef} className="block w-full h-full touch-none" />

      {/* Inline Renamer Overlay */}
      <AnimatePresence>
        {renamer && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute z-50 -translate-x-1/2 -translate-y-1/2 shadow-2xl rounded-lg overflow-hidden border border-accent/40"
            style={{ left: renamer.cx, top: renamer.cy }}
          >
            <input
              autoFocus
              value={renamer.label}
              onChange={e => setRenamer({ ...renamer, label: e.target.value })}
              onBlur={() => { if (!isCommittingRef.current) setRenamer(null) }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  isCommittingRef.current = true
                  const val = renamer.label.trim()
                  if (val) {
                    if (onNodeRename) onNodeRename(renamer.id, val)
                    const obj = nodeObjsRef.current.find(o => o.node.id === renamer.id)
                    if (obj) {
                      obj.node.label = val
                      const { sprite, sprMat } = buildLabelSprite(val, nodeIconsEnabledRef.current ? obj.node.icon : undefined)
                      const scene = sceneRef.current
                      if (scene) {
                        if (obj.node._sprite) scene.remove(obj.node._sprite)
                        sprite.renderOrder = 999
                        scene.add(sprite)
                        obj.node._sprite = sprite
                        obj.node._sprMat = sprMat
                        obj.sprMat = sprMat
                      }
                    }
                  }
                  setRenamer(null)
                  setTimeout(() => { isCommittingRef.current = false }, 100)
                }
                if (e.key === 'Escape') setRenamer(null)
              }}
              className="bg-surface/95 text-text px-3 py-1.5 min-w-[120px] max-w-[300px] text-center text-sm font-medium tracking-wide outline-none focus:bg-surface"
              style={{ width: `${Math.max(120, renamer.label.length * 10)}px` }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hint — desktop vs mobile */}
      <div id="graph-hint"
        className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-muted tracking-widest px-4 py-1.5 rounded-full border border-border bg-bg/80 backdrop-blur-md z-20 pointer-events-none transition-opacity duration-500 whitespace-nowrap">
        <span className="hidden md:inline">drag to rotate · shift+drag or right-drag to pan · scroll to zoom · click to open</span>
        <span className="inline md:hidden">tap to open · drag to rotate · pinch to zoom · use d-pad to pan</span>
      </div>

      {/* Top-right controls */}
      <div className="absolute top-4 right-5 z-40 flex items-center gap-2">
        {/* Hover Preview toggle */}
        <button
          onClick={() => {
            const next = !hoverPreviewEnabledRef.current
            hoverPreviewEnabledRef.current = next
            sessionStorage.setItem('hoverPreview', String(next))
            setHoverPreviewOn(next)
            // Hide both tooltips immediately on toggle
            if (tooltipRef.current) tooltipRef.current.style.opacity = '0'
            if (previewRef.current)  previewRef.current.style.opacity  = '0'
          }}
          title={hoverPreviewOn ? 'Detailed Hover Preview: ON' : 'Detailed Hover Preview: OFF'}
          className={`flex items-center justify-center w-8 h-8 rounded-md border transition-all duration-200 backdrop-blur-md ${
            hoverPreviewOn
              ? 'border-accent text-accent bg-accent/20 shadow-[0_0_10px_rgba(124,106,247,0.3)]'
              : 'border-border2 bg-surface/90 text-muted2 hover:border-accent hover:text-accent hover:bg-accent/10'
          }`}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
            <line x1="12" y1="5" x2="12" y2="3"/>
            <line x1="12" y1="21" x2="12" y2="19"/>
          </svg>
        </button>

        <button onClick={handleSaveClick} title="Save Graph"
          className="flex items-center justify-center w-8 h-8 rounded-md border border-border2 bg-surface/90 backdrop-blur-md text-muted2 hover:border-accent hover:text-accent hover:bg-accent/10 transition-all duration-200">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
            <polyline points="17 21 17 13 7 13 7 21"></polyline>
            <polyline points="7 3 7 8 15 8"></polyline>
          </svg>
        </button>
        <button onClick={onGoHome} title="Go Home"
          className="flex items-center justify-center w-8 h-8 rounded-md border border-border2 bg-surface/90 backdrop-blur-md text-muted2 hover:border-accent hover:text-accent hover:bg-accent/10 transition-all duration-200">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
        </button>
        <button onClick={onToggleEditMode} title={isEditMode ? "View Mode" : "Edit Mode"}
          className={`flex items-center justify-center w-8 h-8 rounded-md border transition-all duration-200 backdrop-blur-md
            ${isEditMode 
              ? 'border-accent text-accent bg-accent/20 shadow-[0_0_10px_rgba(124,106,247,0.3)]' 
              : 'border-border2 bg-surface/90 text-muted2 hover:border-accent hover:text-accent hover:bg-accent/10'}`}>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9"></path>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
          </svg>
        </button>
        <button onClick={onToggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          className="flex items-center justify-center w-8 h-8 rounded-md border border-border2 bg-surface/90 backdrop-blur-md text-muted2 hover:border-accent hover:text-accent hover:bg-accent/10 transition-all duration-200">
          {isDark
            ? <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><path d="M8 12a4 4 0 100-8 4 4 0 000 8zm0-10a.75.75 0 000-1.5.75.75 0 000 1.5zm0 11a.75.75 0 000 1.5.75.75 0 000-1.5zM3.05 4.11a.75.75 0 10-1.06-1.06.75.75 0 001.06 1.06zm9.9 7.78a.75.75 0 10-1.06-1.06.75.75 0 001.06 1.06zM2 8a.75.75 0 00-1.5 0A.75.75 0 002 8zm13.5 0a.75.75 0 00-1.5 0 .75.75 0 001.5 0zM4.11 12.95a.75.75 0 10-1.06 1.06.75.75 0 001.06-1.06zm7.78-9.9a.75.75 0 10-1.06 1.06.75.75 0 001.06-1.06z"/></svg>
            : <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><path d="M6 .278a.768.768 0 01.08.858 7.208 7.208 0 00-.878 3.46c0 4.021 3.278 7.277 7.318 7.277.527 0 1.04-.055 1.533-.16a.787.787 0 01.81.316.733.733 0 01-.031.893A8.349 8.349 0 018.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.752.752 0 016 .278z"/></svg>
          }
        </button>
        <button onClick={onToggleSidebar}
          className="flex items-center gap-1.5 text-[10px] text-muted2 tracking-widest px-3.5 py-1.5 rounded-md border border-border2 bg-surface/90 backdrop-blur-md hover:border-accent hover:text-accent hover:bg-accent/10 transition-all duration-200">
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 3h8M2 6h5M2 9h7" />
          </svg>
          AI Data
        </button>
      </div>

      {/* Mobile D-Pad — hidden on md+ */}
      <DPad onAction={handleDPadAction} isDark={isDark} />

      {/* Tooltip — simple label */}
      <div ref={tooltipRef}
        className="fixed pointer-events-none opacity-0 transition-opacity duration-100 z-[1000] px-3.5 py-1.5 rounded-md border border-border text-xs text-text backdrop-blur-md"
        style={{ background: tooltipBg }}
      />

      {/* Rich hover preview popup */}
      <div
        ref={previewRef}
        className="fixed pointer-events-none opacity-0 z-[1001] rounded-xl border border-border shadow-2xl backdrop-blur-md overflow-y-auto"
        style={{
          background: tooltipBg,
          width: '264px',
          maxHeight: '220px',
          padding: '10px 12px',
          transition: 'opacity 0.12s ease',
          // Custom thin scrollbar
          scrollbarWidth: 'thin',
        }}
      />
    </div>
  )
}
)

export default Graph3D
