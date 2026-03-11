import * as THREE from 'three'
import { GraphData, SimNode, SimLink, NodeObj, LinkObj, Spherical } from '../types/graph'

export function hexToInt(hex: string): number {
  return parseInt(hex.replace('#', ''), 16)
}

export function buildLabelSprite(label: string, icon?: string): { sprite: THREE.Sprite; sprMat: THREE.SpriteMaterial } {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 160
  const ctx = canvas.getContext('2d')!

  ctx.shadowColor = 'rgba(0,0,0,1)'
  ctx.shadowBlur = 28
  ctx.font = '600 64px "JetBrains Mono", monospace'
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const text = icon ? `${icon} ${label}` : label
  ctx.fillText(text, 512, 80)
  ctx.shadowBlur = 14
  ctx.fillText(text, 512, 80)
  ctx.shadowBlur = 0
  ctx.fillText(text, 512, 80)

  const tex = new THREE.CanvasTexture(canvas)
  const sprMat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 1, depthTest: false, depthWrite: false })
  const sprite = new THREE.Sprite(sprMat)
  sprite.renderOrder = 999
  return { sprite, sprMat }
}

export function initSimNodes(data: GraphData): SimNode[] {
  const phi = Math.PI * (3 - Math.sqrt(5))
  return data.nodes.map((n, i) => {
    const y = 1 - (i / Math.max(data.nodes.length - 1, 1)) * 2
    const r = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = phi * i
    const R = 170
    return {
      ...n,
      color: hexToInt(n.hex),
      x: n.x ?? Math.cos(theta) * r * R + (Math.random() - 0.5) * 50,
      y: n.y ?? y * R + (Math.random() - 0.5) * 50,
      z: n.z ?? Math.sin(theta) * r * R + (Math.random() - 0.5) * 50,
      vx: n.vx ?? 0, vy: n.vy ?? 0, vz: n.vz ?? 0,
      radius: n.category === 'core' ? 10 : n.category === 'example' ? 8 : 7,
    }
  })
}

export function buildLinksRaw(data: GraphData): { a: string; b: string }[] {
  const raw: { a: string; b: string }[] = []
  data.nodes.forEach(n => {
    (n.connections || []).forEach(cid => {
      if (!raw.find(l => (l.a === n.id && l.b === cid) || (l.a === cid && l.b === n.id))) {
        raw.push({ a: n.id, b: cid })
      }
    })
  })
  return raw
}

export function buildSceneObjects(
  scene: THREE.Scene,
  simNodes: SimNode[],
  simLinks: SimLink[]
): { nodeObjs: NodeObj[]; linkObjs: LinkObj[] } {
  // If no true override passed later, just check session storage directly inside graphBuilder
  const showIcons = sessionStorage.getItem('showNodeIcons') !== 'false'
  const nodeObjs: NodeObj[] = []
  const linkObjs: LinkObj[] = []

  simNodes.forEach(n => {
    const geo = new THREE.SphereGeometry(n.radius, 32, 32)
    const mat = new THREE.MeshPhongMaterial({
      color: n.color, emissive: n.color, emissiveIntensity: 0.5,
      shininess: 90, transparent: true, opacity: 0.95,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(n.x, n.y, n.z)
    mesh.userData.nodeId = n.id
    scene.add(mesh)

    // Inner bright core
    const coreGeo = new THREE.SphereGeometry(n.radius * 0.45, 16, 16)
    mesh.add(new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18 })))

    // Outer glow shell
    const glowGeo = new THREE.SphereGeometry(n.radius * 3, 16, 16)
    const glowMat = new THREE.MeshBasicMaterial({ color: n.color, transparent: true, opacity: 0.055, side: THREE.BackSide })
    mesh.add(new THREE.Mesh(glowGeo, glowMat))

    // Label sprite (scene-level, not mesh child — so we can scale by distance)
    const { sprite, sprMat } = buildLabelSprite(n.label, showIcons ? n.icon : undefined)
    scene.add(sprite)
    n._sprite = sprite
    n._sprMat = sprMat

    nodeObjs.push({ mesh, mat, glowMat, sprMat, node: n })
  })

  simLinks.forEach(l => {
    const pts = [
      new THREE.Vector3(l.source.x, l.source.y, l.source.z),
      new THREE.Vector3(l.target.x, l.target.y, l.target.z),
    ]
    const geo = new THREE.BufferGeometry().setFromPoints(pts)
    const color = new THREE.Color(l.source.hex).lerp(new THREE.Color(l.target.hex), 0.5)
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.75 })
    const line = new THREE.Line(geo, mat)
    scene.add(line)
    linkObjs.push({ line, mat, source: l.source, target: l.target })
  })

  return { nodeObjs, linkObjs }
}

export function clearSceneObjects(scene: THREE.Scene, nodeObjs: NodeObj[], linkObjs: LinkObj[]) {
  nodeObjs.forEach(o => {
    scene.remove(o.mesh)
    o.mesh.geometry.dispose()
    if (o.node._sprite) {
      scene.remove(o.node._sprite)
      o.node._sprite.material.dispose()
    }
  })
  linkObjs.forEach(o => {
    scene.remove(o.line)
    o.line.geometry.dispose()
  })
}

export function runPhysics(simNodes: SimNode[], simLinks: SimLink[], tick: number, draggedNodeId?: string): number {
  const alpha = Math.max(0.012, 0.38 * Math.exp(-tick * 0.08)) // Faster alpha decay: 0.005 -> 0.08

  // Repulsion
  for (let i = 0; i < simNodes.length; i++) {
    for (let j = i + 1; j < simNodes.length; j++) {
      const a = simNodes[i], b = simNodes[j]
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1
      const f = (8000 / (d * d)) * alpha
      a.vx -= dx / d * f; a.vy -= dy / d * f; a.vz -= dz / d * f
      b.vx += dx / d * f; b.vy += dy / d * f; b.vz += dz / d * f
    }
  }

  // Link attraction
  simLinks.forEach(l => {
    const dx = l.target.x - l.source.x, dy = l.target.y - l.source.y, dz = l.target.z - l.source.z
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1
    const f = (d - 155) * 0.032 * alpha
    l.source.vx += dx / d * f; l.source.vy += dy / d * f; l.source.vz += dz / d * f
    l.target.vx -= dx / d * f; l.target.vy -= dy / d * f; l.target.vz -= dz / d * f
  })

  // Center gravity + integrate
  let maxV2 = 0
  simNodes.forEach(n => {
    n.vx -= n.x * 0.006 * alpha
    n.vy -= n.y * 0.006 * alpha
    n.vz -= n.z * 0.006 * alpha
    if (draggedNodeId && n.id === draggedNodeId) return
    
    // Velocity decay: 0.82 -> 0.4 (1 - 0.6)
    n.vx *= 0.4 
    n.vy *= 0.4 
    n.vz *= 0.4
    
    const v2 = n.vx * n.vx + n.vy * n.vy + n.vz * n.vz
    if (v2 > maxV2) maxV2 = v2

    n.x += n.vx; n.y += n.vy; n.z += n.vz
  })

  return Math.sqrt(maxV2)
}

export function syncPositions(nodeObjs: NodeObj[], linkObjs: LinkObj[], spherical: Spherical, labelMult = 1) {
  const labelScale = spherical.radius * 0.13 * labelMult

  nodeObjs.forEach(o => {
    o.mesh.position.set(o.node.x, o.node.y, o.node.z)
    if (o.node._sprite) {
      o.node._sprite.position.set(o.node.x, o.node.y + o.node.radius + labelScale * 0.22, o.node.z)
      o.node._sprite.scale.set(labelScale * 1.4, labelScale * 0.35, 1)
    }
  })

  linkObjs.forEach(lo => {
    const pos = lo.line.geometry.attributes.position as THREE.BufferAttribute
    pos.setXYZ(0, lo.source.x, lo.source.y, lo.source.z)
    
    // Grow edge from source to target if animating
    if (lo.animProgress !== undefined && lo.animProgress < 1) {
      const p = lo.animProgress
      const tx = lo.source.x + (lo.target.x - lo.source.x) * p
      const ty = lo.source.y + (lo.target.y - lo.source.y) * p
      const tz = lo.source.z + (lo.target.z - lo.source.z) * p
      pos.setXYZ(1, tx, ty, tz)
      // also lerp opacity
      lo.mat.opacity = 0.75 * p
    } else {
      pos.setXYZ(1, lo.target.x, lo.target.y, lo.target.z)
    }
    
    pos.needsUpdate = true
  })
}

export function setHoveredNode(
  hit: NodeObj | LinkObj | null,
  hovObj: NodeObj | LinkObj | null,
  nodeObjs: NodeObj[],
  linkObjs: LinkObj[]
): NodeObj | LinkObj | null {
  if (hit === hovObj) return hovObj

  nodeObjs.forEach(o => {
    const spr = o.node._sprMat
    if (!hit) {
      o.mat.emissiveIntensity = 0.5
      o.mat.opacity = 0.95
      o.glowMat.opacity = 0.055
      if (spr) spr.opacity = 1
    } else if ('node' in hit) {
      const isSelf = o.node.id === hit.node.id
      const isConn = hit.node.connections.includes(o.node.id) || o.node.connections.includes(hit.node.id)
      o.mat.emissiveIntensity = isSelf ? 1.4 : isConn ? 0.7 : 0.2
      o.mat.opacity = isSelf ? 1 : isConn ? 0.95 : 0.18
      o.glowMat.opacity = isSelf ? 0.25 : isConn ? 0.1 : 0.01
      if (spr) spr.opacity = isSelf ? 1 : isConn ? 0.9 : 0.2
    } else {
      // It's a LinkObj
      const isSelf = o.node.id === hit.source.id || o.node.id === hit.target.id
      o.mat.emissiveIntensity = isSelf ? 1.2 : 0.2
      o.mat.opacity = isSelf ? 1 : 0.18
      o.glowMat.opacity = isSelf ? 0.2 : 0.01
      if (spr) spr.opacity = isSelf ? 1 : 0.2
    }
  })

  linkObjs.forEach(lo => {
    if (!hit) {
      lo.mat.opacity = 0.75
    } else if ('node' in hit) {
      const conn = lo.source.id === hit.node.id || lo.target.id === hit.node.id
      lo.mat.opacity = conn ? 1 : 0.06
    } else {
      // It's a LinkObj
      const isSelf = lo === hit
      lo.mat.opacity = isSelf ? 1 : 0.06
    }
  })

  return hit
}

export function applyCam(camera: THREE.PerspectiveCamera, spherical: Spherical, panOffset: THREE.Vector3) {
  const { theta, phi, radius } = spherical
  const x = radius * Math.sin(phi) * Math.sin(theta)
  const y = radius * Math.cos(phi)
  const z = radius * Math.sin(phi) * Math.cos(theta)
  camera.position.set(x + panOffset.x, y + panOffset.y, z + panOffset.z)
  camera.lookAt(panOffset.x, panOffset.y, panOffset.z)
}
