import { GraphData, NodeData } from "../../types/graph";

export interface Node2D {
  id: string;
  label: string;
  icon: string;
  hex: string;
  color: number;
  category: string;
  content: string;
  connections: string[];
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  pinned: boolean;
}

export interface Edge2D {
  a: Node2D;
  b: Node2D;
}

export interface Graph2DState {
  nodes: Node2D[];
  edges: Edge2D[];
  nodeMap: Map<string, Node2D>;
}

export type LayoutAlgorithm = "force" | "hierarchy" | "radial" | "grid";

export interface Graph2DHandle {
  getFreshData(): GraphData;
  focusToNode(nodeId: string): void;
  lockToNode(nodeId: string): void;
  unlockCamera(): void;
}

export function nodeRadius(node: NodeData): number {
  if (node.category === "core") return 12;
  if (node.category === "example") return 10;
  return 8;
}
