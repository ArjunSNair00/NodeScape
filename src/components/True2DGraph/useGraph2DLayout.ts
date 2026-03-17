import { GraphData } from "../../types/graph";
import {
  Edge2D,
  Graph2DState,
  LayoutAlgorithm,
  Node2D,
  nodeRadius,
} from "./graph2d.types";

function seededRandom(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h % 1000) / 1000;
}

function hexToInt(hex: string): number {
  return parseInt(hex.replace("#", ""), 16);
}

function buildAdj(
  nodeMap: Map<string, Node2D>,
  edges: Edge2D[],
): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  nodeMap.forEach((_v, id) => adj.set(id, []));
  edges.forEach((e) => {
    adj.get(e.a.id)?.push(e.b.id);
    adj.get(e.b.id)?.push(e.a.id);
  });
  return adj;
}

export function buildGraph2DState(data: GraphData): Graph2DState {
  const nodes: Node2D[] = data.nodes.map((n, i) => ({
    id: n.id,
    label: n.label,
    icon: n.icon || "⬡",
    hex: n.hex,
    color: hexToInt(n.hex),
    category: n.category,
    content: n.content,
    connections: [...(n.connections || [])],
    x: n.position2d?.x ?? i * 10,
    y: n.position2d?.y ?? i * 10,
    vx: 0,
    vy: 0,
    radius: nodeRadius(n),
    pinned: false,
  }));

  const nodeMap = new Map(nodes.map((n) => [n.id, n] as const));
  const edgeIds = new Set<string>();
  const edges: Edge2D[] = [];

  nodes.forEach((n) => {
    n.connections.forEach((cid) => {
      const target = nodeMap.get(cid);
      if (!target) return;
      const key = [n.id, cid].sort().join("::");
      if (edgeIds.has(key)) return;
      edgeIds.add(key);
      edges.push({ a: n, b: target });
    });
  });

  return { nodes, edges, nodeMap };
}

export function applyLayout(
  state: Graph2DState,
  algorithm: LayoutAlgorithm,
  width: number,
  height: number,
): void {
  const { nodes, edges, nodeMap } = state;
  if (nodes.length === 0) return;

  if (algorithm === "grid") {
    const sorted = [...nodes].sort(
      (a, b) => b.connections.length - a.connections.length,
    );
    const cols = Math.max(
      1,
      Math.ceil(Math.sqrt(sorted.length * (width / Math.max(1, height)))),
    );
    const rows = Math.ceil(sorted.length / cols);
    const cellW = Math.max(70, (width - 80) / cols);
    const cellH = Math.max(70, (height - 80) / rows);

    sorted.forEach((n, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      n.x = 40 + col * cellW + cellW / 2;
      n.y = 40 + row * cellH + cellH / 2;
      n.vx = 0;
      n.vy = 0;
    });
    return;
  }

  if (algorithm === "radial") {
    const degree = new Map<string, number>();
    nodes.forEach((n) => degree.set(n.id, 0));
    edges.forEach((e) => {
      degree.set(e.a.id, (degree.get(e.a.id) || 0) + 1);
      degree.set(e.b.id, (degree.get(e.b.id) || 0) + 1);
    });
    const hub =
      [...degree.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? nodes[0].id;

    const adj = buildAdj(nodeMap, edges);
    const depth = new Map<string, number>([[hub, 0]]);
    const q = [hub];

    while (q.length > 0) {
      const id = q.shift()!;
      const d = depth.get(id)!;
      (adj.get(id) || []).forEach((next) => {
        if (!depth.has(next)) {
          depth.set(next, d + 1);
          q.push(next);
        }
      });
    }

    const ringMap = new Map<number, string[]>();
    nodes.forEach((n) => {
      const d = depth.get(n.id) ?? 1;
      if (!ringMap.has(d)) ringMap.set(d, []);
      ringMap.get(d)!.push(n.id);
    });

    const cx = width / 2;
    const cy = height / 2;
    [...ringMap.entries()].forEach(([d, ids]) => {
      if (d === 0) {
        const center = nodeMap.get(ids[0]);
        if (center) {
          center.x = cx;
          center.y = cy;
          center.vx = 0;
          center.vy = 0;
        }
        return;
      }
      const r = d * Math.min(width, height) * 0.15;
      ids.forEach((id, i) => {
        const node = nodeMap.get(id);
        if (!node) return;
        const angle = (i / Math.max(1, ids.length)) * Math.PI * 2;
        node.x = cx + Math.cos(angle) * r;
        node.y = cy + Math.sin(angle) * r;
        node.vx = 0;
        node.vy = 0;
      });
    });
    return;
  }

  if (algorithm === "hierarchy") {
    const degree = new Map<string, number>();
    nodes.forEach((n) => degree.set(n.id, 0));
    edges.forEach((e) => {
      degree.set(e.a.id, (degree.get(e.a.id) || 0) + 1);
      degree.set(e.b.id, (degree.get(e.b.id) || 0) + 1);
    });
    const root =
      [...degree.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? nodes[0].id;

    const adj = buildAdj(nodeMap, edges);
    const level = new Map<string, number>([[root, 0]]);
    const q = [root];
    while (q.length) {
      const id = q.shift()!;
      const l = level.get(id)!;
      (adj.get(id) || []).forEach((next) => {
        if (!level.has(next)) {
          level.set(next, l + 1);
          q.push(next);
        }
      });
    }

    const deepest = level.size ? Math.max(...level.values()) : 0;
    nodes.forEach((n) => {
      if (!level.has(n.id)) level.set(n.id, deepest + 1);
    });

    const byLevel = new Map<number, string[]>();
    level.forEach((l, id) => {
      if (!byLevel.has(l)) byLevel.set(l, []);
      byLevel.get(l)!.push(id);
    });

    const total = Math.max(...byLevel.keys()) + 1;
    const spacingY = Math.min(120, (height - 100) / Math.max(1, total));

    [...byLevel.entries()].forEach(([l, ids]) => {
      const totalWidth = (ids.length - 1) * 140;
      ids.forEach((id, i) => {
        const node = nodeMap.get(id);
        if (!node) return;
        node.x = width / 2 - totalWidth / 2 + i * 140;
        node.y = 50 + l * spacingY;
        node.vx = 0;
        node.vy = 0;
      });
    });
    return;
  }

  // force initial (deterministic scatter)
  const r = Math.min(width, height) * 0.28;
  nodes.forEach((n, i) => {
    const angle = (i / Math.max(1, nodes.length)) * Math.PI * 2;
    const jitter = 0.6 + seededRandom(n.id) * 0.7;
    n.x = width / 2 + Math.cos(angle) * r * jitter;
    n.y = height / 2 + Math.sin(angle) * r * jitter;
    n.vx = 0;
    n.vy = 0;
  });
}
