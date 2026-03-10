import * as THREE from 'three'
import type { MutableRefObject } from 'react'
import {
  GraphData,
  NodeData,
  NodeObj,
  LinkObj,
  SimNode,
  SimLink,
} from '../types/graph'
import {
  initSimNodes,
  buildLinksRaw,
  buildSceneObjects,
  clearSceneObjects,
  runPhysics,
  buildLabelSprite,
  hexToInt,
} from '../lib/graphBuilder'

/**
 * GraphStateEngine — single authority for all graph state mutations.
 *
 * The engine writes into the same MutableRefObjects that Graph3D's rAF loop
 * already reads from every frame, so the renderer remains completely unchanged.
 *
 * Node dragging: the mouse/touch handlers in Graph3D mutate SimNode.x/y/z
 * directly (via draggedNodeRef).  tick() passes the dragged node id through
 * to runPhysics, which skips integration for that node — exactly as before.
 */
export class GraphStateEngine {
  // ─── live sim arrays (shared with Graph3D refs) ────────────────────────────
  private simNodes: SimNode[] = []
  private simLinks: SimLink[] = []

  // ─── Three.js scene objects ────────────────────────────────────────────────
  private nodeObjs: NodeObj[] = []
  private linkObjs: LinkObj[] = []

  // ─── physics progress ─────────────────────────────────────────────────────
  private simTick = 0

  // ─── external refs — written here, read by Graph3D's rAF loop ─────────────
  private readonly scene: THREE.Scene
  private readonly simNodesRef: MutableRefObject<SimNode[]>
  private readonly simLinksRef: MutableRefObject<SimLink[]>
  private readonly nodeObjsRef: MutableRefObject<NodeObj[]>
  private readonly linkObjsRef: MutableRefObject<LinkObj[]>
  private readonly simTickRef: MutableRefObject<number>

  constructor(
    scene: THREE.Scene,
    simNodesRef: MutableRefObject<SimNode[]>,
    simLinksRef: MutableRefObject<SimLink[]>,
    nodeObjsRef: MutableRefObject<NodeObj[]>,
    linkObjsRef: MutableRefObject<LinkObj[]>,
    simTickRef: MutableRefObject<number>,
  ) {
    this.scene = scene
    this.simNodesRef = simNodesRef
    this.simLinksRef = simLinksRef
    this.nodeObjsRef = nodeObjsRef
    this.linkObjsRef = linkObjsRef
    this.simTickRef = simTickRef
  }

  // ── helpers ─────────────────────────────────────────────────────────────────

  /** Push local arrays back into the shared refs so the renderer sees them. */
  private syncRefs() {
    this.simNodesRef.current = this.simNodes
    this.simLinksRef.current = this.simLinks
    this.nodeObjsRef.current = this.nodeObjs
    this.linkObjsRef.current = this.linkObjs
    this.simTickRef.current  = this.simTick
  }

  /** Build a SimLink pair from two already-present SimNodes, and a Three.js Line. */
  private buildOneLinkObj(source: SimNode, target: SimNode): { simLink: SimLink; linkObj: LinkObj } | null {
    const pts = [
      new THREE.Vector3(source.x, source.y, source.z),
      new THREE.Vector3(target.x, target.y, target.z),
    ]
    const geo = new THREE.BufferGeometry().setFromPoints(pts)
    const color = new THREE.Color(source.hex).lerp(new THREE.Color(target.hex), 0.5)
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.75 })
    const line = new THREE.Line(geo, mat)
    this.scene.add(line)
    return {
      simLink: { source, target },
      linkObj: { line, mat, source, target },
    }
  }

  /** Dispose a single NodeObj and its sprite from the scene. Does not touch links. */
  private disposeNodeObj(obj: NodeObj) {
    this.scene.remove(obj.mesh)
    obj.mesh.geometry.dispose()
    if (obj.node._sprite) {
      this.scene.remove(obj.node._sprite)
      obj.node._sprite.material.dispose()
    }
  }

  /** Dispose a single LinkObj from the scene. */
  private disposeLinkObj(obj: LinkObj) {
    this.scene.remove(obj.line)
    obj.line.geometry.dispose()
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  /**
   * Full replace — tears down the current scene and rebuilds from data.
   * Equivalent to the old useEffect([graphData]) block.
   * Reuses saved positions from NodeData.position when available.
   */
  load(data: GraphData) {
    // Capture the graph title for getGraphData()
    this._title = data.title

    // Detect whether topology changed (so physics restart only when needed)
    const prevIds = this.simNodes.map(n => n.id).join(',')
    const newIds  = data.nodes.map(n => n.id).join(',')
    const structureChanged = prevIds !== newIds

    // Tear down existing scene objects
    clearSceneObjects(this.scene, this.nodeObjs, this.linkObjs)

    // Apply saved positions into the raw NodeData before initSimNodes runs
    const nodesWithPosition: NodeData[] = data.nodes.map(n => ({
      ...n,
      // If a persisted position exists, use it; otherwise initSimNodes will randomise
      x: n.position?.x ?? n.x,
      y: n.position?.y ?? n.y,
      z: n.position?.z ?? n.z,
    }))
    const dataWithPos: GraphData = { ...data, nodes: nodesWithPosition }

    // Build sim arrays
    const simNodes = initSimNodes(dataWithPos)
    const linksRaw = buildLinksRaw(dataWithPos)
    const simLinks: SimLink[] = linksRaw
      .map(l => ({
        source: simNodes.find(n => n.id === l.a)!,
        target: simNodes.find(n => n.id === l.b)!,
      }))
      .filter(l => l.source && l.target)

    // Build Three.js objects
    const { nodeObjs, linkObjs } = buildSceneObjects(this.scene, simNodes, simLinks)

    // Store locally
    this.simNodes = simNodes
    this.simLinks = simLinks
    this.nodeObjs = nodeObjs
    this.linkObjs = linkObjs

    if (structureChanged) {
      // If nodes carry persisted positions, skip the physics warm-up so they
      // don't drift away from the saved layout. Only restart physics for a
      // brand-new graph that has no saved positions.
      const hasPersistedPositions = data.nodes.some(n => n.position != null)
      this.simTick = hasPersistedPositions ? 500 : 0
    }

    this.syncRefs()
  }

  /**
   * Incremental — adds a single node without rebuilding the graph.
   * Creates a SimNode + Three.js sphere + sprite and inserts them.
   * Does NOT add any edges (call addEdge separately).
   */
  addNode(node: NodeData) {
    // Bail if already present
    if (this.simNodes.find(n => n.id === node.id)) return

    // Determine starting position
    const R = 170
    const x = node.position?.x ?? node.x ?? (Math.random() - 0.5) * R * 2
    const y = node.position?.y ?? node.y ?? (Math.random() - 0.5) * R * 2
    const z = node.position?.z ?? node.z ?? (Math.random() - 0.5) * R * 2

    const simNode: SimNode = {
      ...node,
      color: hexToInt(node.hex),
      x, y, z,
      vx: 0, vy: 0, vz: 0,
      radius: node.category === 'core' ? 10 : node.category === 'example' ? 8 : 7,
    }

    // Three.js sphere
    const geo = new THREE.SphereGeometry(simNode.radius, 32, 32)
    const mat = new THREE.MeshPhongMaterial({
      color: simNode.color, emissive: simNode.color, emissiveIntensity: 0.5,
      shininess: 90, transparent: true, opacity: 0.95,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(x, y, z)
    mesh.userData.nodeId = simNode.id
    this.scene.add(mesh)

    // Inner core
    mesh.add(new THREE.Mesh(
      new THREE.SphereGeometry(simNode.radius * 0.45, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18 }),
    ))

    // Glow shell
    const glowGeo = new THREE.SphereGeometry(simNode.radius * 3, 16, 16)
    const glowMat = new THREE.MeshBasicMaterial({
      color: simNode.color, transparent: true, opacity: 0.055, side: THREE.BackSide,
    })
    mesh.add(new THREE.Mesh(glowGeo, glowMat))

    // Label sprite
    const { sprite, sprMat } = buildLabelSprite(simNode.label)
    sprite.renderOrder = 999
    this.scene.add(sprite)
    simNode._sprite = sprite
    simNode._sprMat = sprMat

    const nodeObj: NodeObj = { mesh, mat, glowMat, sprMat, node: simNode }

    this.simNodes.push(simNode)
    this.nodeObjs.push(nodeObj)

    // Restart physics briefly so new node settles in
    this.simTick = Math.min(this.simTick, 350)

    this.syncRefs()
  }

  /**
   * Incremental — removes a single node and all edges that touch it.
   */
  removeNode(id: string) {
    const nodeIdx = this.simNodes.findIndex(n => n.id === id)
    if (nodeIdx === -1) return

    // Remove all edges touching this node
    const edgesToRemove = this.linkObjs.filter(
      lo => lo.source.id === id || lo.target.id === id,
    )
    edgesToRemove.forEach(lo => this.disposeLinkObj(lo))
    this.linkObjs = this.linkObjs.filter(lo => lo.source.id !== id && lo.target.id !== id)
    this.simLinks = this.simLinks.filter(sl => sl.source.id !== id && sl.target.id !== id)

    // Remove node
    const objIdx = this.nodeObjs.findIndex(o => o.node.id === id)
    if (objIdx !== -1) {
      this.disposeNodeObj(this.nodeObjs[objIdx])
      this.nodeObjs.splice(objIdx, 1)
    }
    this.simNodes.splice(nodeIdx, 1)

    this.syncRefs()
  }

  /**
   * Incremental — updates a node's label and/or color in-place.
   * Rebuilds only this node's sprite texture and material color.
   * Does NOT restart physics or rebuild the scene.
   */
  updateNode(updated: NodeData) {
    const simNode = this.simNodes.find(n => n.id === updated.id)
    const nodeObj = this.nodeObjs.find(o => o.node.id === updated.id)
    if (!simNode || !nodeObj) return

    // Apply scalar field updates
    const labelChanged = simNode.label !== updated.label
    const colorChanged = simNode.hex   !== updated.hex

    Object.assign(simNode, {
      label: updated.label,
      icon: updated.icon,
      hex: updated.hex,
      category: updated.category,
      content: updated.content,
      connections: updated.connections,
      color: hexToInt(updated.hex),
    })

    if (colorChanged) {
      const col = new THREE.Color(updated.hex)
      nodeObj.mat.color.set(col)
      nodeObj.mat.emissive.set(col)
      nodeObj.glowMat.color.set(col)
      // Update connected link colors
      this.linkObjs
        .filter(lo => lo.source.id === updated.id || lo.target.id === updated.id)
        .forEach(lo => {
          const c = new THREE.Color(lo.source.hex).lerp(new THREE.Color(lo.target.hex), 0.5)
          lo.mat.color.set(c)
        })
    }

    if (labelChanged || colorChanged) {
      // Replace sprite
      if (simNode._sprite) {
        this.scene.remove(simNode._sprite)
        simNode._sprite.material.dispose()
      }
      const { sprite, sprMat } = buildLabelSprite(simNode.label)
      sprite.renderOrder = 999
      this.scene.add(sprite)
      simNode._sprite = sprite
      simNode._sprMat = sprMat
      nodeObj.sprMat = sprMat
    }

    // No syncRefs needed — we mutated in-place; render loop already has the refs
  }

  /**
   * Incremental — adds an edge between two existing nodes.
   */
  addEdge(sourceId: string, targetId: string) {
    const source = this.simNodes.find(n => n.id === sourceId)
    const target = this.simNodes.find(n => n.id === targetId)
    if (!source || !target) return

    // De-duplicate
    const exists = this.simLinks.some(
      l => (l.source.id === sourceId && l.target.id === targetId) ||
           (l.source.id === targetId && l.target.id === sourceId),
    )
    if (exists) return

    const result = this.buildOneLinkObj(source, target)
    if (!result) return

    this.simLinks.push(result.simLink)
    this.linkObjs.push(result.linkObj)

    // Also update the NodeData connections array on both simNodes
    if (!source.connections.includes(targetId)) source.connections.push(targetId)
    if (!target.connections.includes(sourceId)) target.connections.push(sourceId)

    this.syncRefs()
  }

  /**
   * Incremental — removes the edge between two nodes.
   */
  removeEdge(sourceId: string, targetId: string) {
    const idx = this.linkObjs.findIndex(
      lo => (lo.source.id === sourceId && lo.target.id === targetId) ||
            (lo.source.id === targetId && lo.target.id === sourceId),
    )
    if (idx === -1) return
    this.disposeLinkObj(this.linkObjs[idx])
    this.linkObjs.splice(idx, 1)
    this.simLinks.splice(idx, 1)

    // Clean up connections arrays
    const src = this.simNodes.find(n => n.id === sourceId)
    const tgt = this.simNodes.find(n => n.id === targetId)
    if (src) src.connections = src.connections.filter(id => id !== targetId)
    if (tgt) tgt.connections = tgt.connections.filter(id => id !== sourceId)

    this.syncRefs()
  }

  /**
   * Removes all nodes and edges from the scene and resets state.
   */
  clearGraph() {
    clearSceneObjects(this.scene, this.nodeObjs, this.linkObjs)
    this.simNodes = []
    this.simLinks = []
    this.nodeObjs = []
    this.linkObjs = []
    this.simTick  = 0
    this.syncRefs()
  }

  /**
   * Physics step — called from the rAF loop instead of the bare runPhysics call.
   * Respects the 500-tick limit and the dragged-node exemption.
   * Node dragging (direct SimNode.x/y/z mutation by mouse handlers) is fully preserved —
   * the dragged node is simply skipped during integration.
   */
  tick(draggedNodeId?: string) {
    if (this.simTick < 500) {
      const maxV = runPhysics(this.simNodes, this.simLinks, this.simTick, draggedNodeId)
      
      // Automatic stabilization: stop if movement is negligible
      if (maxV < 0.001 && this.simTick > 10) {
        this.simTick = 500
      } else {
        this.simTick++
      }
      
      this.simTickRef.current = this.simTick
    }
  }

  /**
   * Restart physics — resets the internal tick counter so physics runs again.
   * Call this whenever you want to wake physics back up (drag, jiggle, scatter, etc.).
   * @param amount  How far back to rewind.  Default 500 = full restart.
   *                Pass a smaller number (e.g. 120) for a gentle nudge.
   */
  resetPhysics(amount = 500) {
    this.simTick = Math.max(0, this.simTick - amount)
    this.simTickRef.current = this.simTick
  }

  /** Returns true while physics is still settling (simTick < 500). */
  isPhysicsActive(): boolean {
    return this.simTick < 500
  }

  /**
   * Snapshot — copies live SimNode positions back into NodeData.position,
   * then returns a plain GraphData object suitable for saving.
   * Replaces the old getFreshData() imperative-handle method.
   */
  getGraphData(): GraphData {
    const nodes: NodeData[] = this.simNodes.map(n => ({
      id:          n.id,
      label:       n.label,
      icon:        n.icon,
      hex:         n.hex,
      category:    n.category,
      content:     n.content,
      connections: [...n.connections],
      position:    { x: n.x, y: n.y, z: n.z },
    }))

    // Recover title from the original graphData that was last load()ed.
    // We store it on load so getGraphData() can reconstruct the full GraphData.
    return { title: this._title, nodes }
  }

  // Store title separately since SimNode doesn't carry it (assigned in load())
  private _title = 'Knowledge Graph'
}
