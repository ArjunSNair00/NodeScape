import * as THREE from 'three'

export interface NodeData {
  id: string
  label: string
  icon: string
  hex: string
  category: 'core' | 'concept' | 'resource' | 'layer' | 'example' | string
  content: string
  connections: string[]
  color?: number
  x?: number
  y?: number
  z?: number
  vx?: number
  vy?: number
  vz?: number
}

export interface GraphData {
  title: string
  nodes: NodeData[]
}

// ── Saved graph record (stored in localStorage) ───────────────────────────────
export interface GraphRecord {
  id: string           // uuid
  title: string
  nodeCount: number
  createdAt: number    // Date.now()
  updatedAt: number
  data: GraphData
}

export interface SimNode extends NodeData {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  radius: number
  color: number
  _sprite?: THREE.Sprite
  _sprMat?: THREE.SpriteMaterial
}

export interface SimLink {
  source: SimNode
  target: SimNode
}

export interface NodeObj {
  mesh: THREE.Mesh
  mat: THREE.MeshPhongMaterial
  glowMat: THREE.MeshBasicMaterial
  sprMat: THREE.SpriteMaterial
  node: SimNode
}

export interface LinkObj {
  line: THREE.Line
  mat: THREE.LineBasicMaterial
  source: SimNode
  target: SimNode
}

export interface Spherical {
  theta: number
  phi: number
  radius: number
}

// Imperative actions exposed from Graph3D via useImperativeHandle
export interface GraphHandle {
  jiggle: () => void
  randomizePositions: () => void
  randomizeColors: () => void
  setLabelScale: (delta: number) => void
  setFogDensity: (density: number) => void
  toggleAutoRotate: () => boolean
  toggleEdgeHover: () => boolean
  toggleContinuousPhysics: () => boolean
  toggleEdgeDrag: () => boolean
  triggerSaveToast: () => void
  getFreshData: () => GraphData
}
