import * as THREE from "three";

export interface NodeData {
  id: string;
  label: string;
  icon: string;
  hex: string;
  category: "core" | "concept" | "resource" | "layer" | "example" | string;
  content: string;
  connections: string[];
  color?: number;
  x?: number;
  y?: number;
  z?: number;
  vx?: number;
  vy?: number;
  vz?: number;
  /** Persisted 3D position — written by getGraphData(), read by load() */
  position?: { x: number; y: number; z: number };
}

export interface GraphData {
  title: string;
  nodes: NodeData[];
}

// ── Saved graph record (stored in localStorage) ───────────────────────────────
export interface GraphRecord {
  id: string; // uuid
  title: string;
  nodeCount: number;
  createdAt: number; // Date.now()
  updatedAt: number;
  data: GraphData;
}

export interface SimNode extends NodeData {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  radius: number;
  color: number;
  _sprite?: THREE.Sprite;
  _sprMat?: THREE.SpriteMaterial;
}

export interface SimLink {
  source: SimNode;
  target: SimNode;
}

export interface NodeObj {
  mesh: THREE.Mesh;
  mat: THREE.MeshPhongMaterial;
  glowMat: THREE.MeshBasicMaterial;
  sprMat: THREE.SpriteMaterial;
  node: SimNode;
  animScale?: number;
}

export interface LinkObj {
  line: THREE.Line;
  mat: THREE.LineBasicMaterial;
  dashedMat?: THREE.LineDashedMaterial;
  source: SimNode;
  target: SimNode;
  animProgress?: number;
}

export interface Spherical {
  theta: number;
  phi: number;
  radius: number;
}

// Imperative actions exposed from Graph3D via useImperativeHandle
export interface GraphHandle {
  setSpread(mult: number): void;
  applyHierarchyLayout(): void;
  jiggle: () => void;
  randomizePositions: () => void;
  randomizeColors: () => void;
  setLabelScale: (delta: number) => void;
  setFogDensity: (density: number) => void;
  toggleAutoRotate: () => boolean;
  toggleEdgeHover: () => boolean;
  toggleContinuousPhysics: () => boolean;
  isContinuousPhysicsEnabled: () => boolean;
  toggleEdgeDrag: () => boolean;
  triggerSaveToast: () => void;
  getFreshData: () => GraphData;
  resetGraph: (
    opts: { positions: boolean; colors: boolean },
    original: GraphData,
  ) => void;
  toggleNodeIcons: () => boolean;

  focusToNode: (nodeId: string) => void;
  lockToNode: (nodeId: string) => void;
  unlockCamera: () => void;

  // Bulk Mutations
  appendNodes: (data: GraphData) => void;
  updateNodes: (nodes: Partial<NodeData>[]) => void;
  removeNodes: (ids: string[]) => void;
}
