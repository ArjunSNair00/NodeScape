import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Application,
  Container,
  FederatedPointerEvent,
  Graphics,
  Text,
  TextStyle,
} from "pixi.js";
import { GraphData } from "../../types/graph";
import { Theme } from "../../hooks/useTheme";
import { applyLayout, buildGraph2DState } from "./useGraph2DLayout";
import {
  Graph2DHandle,
  Graph2DState,
  LayoutAlgorithm,
  Node2D,
} from "./graph2d.types";
import { AnimatePresence, motion } from "framer-motion";

type MarqueeMode = "none" | "rect" | "freehand";

interface Props {
  graphData: GraphData;
  theme: Theme;
  onNodeSelect: (nodeId: string) => void;
  activeNodeId?: string | null;
  highlightPath?: string[];
  onToggleSidebar: () => void;
  onGraphChange: (data: GraphData) => void;
  isSplitMode?: boolean;
  onToggleSplitMode?: () => void;
  onToggleTrue2D?: () => void;
  isPathMode?: boolean;
  isPathHideMode?: boolean;
  externalHoverNodeId?: string | null;
  sidebarOpen?: boolean;
  isEditMode?: boolean;
  onToggleTheme?: () => void;
  onToggleEditMode?: () => void;
  uiAnimations?: boolean;
  onToggleUiAnimations?: () => void;
  onGoHome?: () => void;
  onSave?: () => void;
  onRename?: (title: string) => void;
}

const PHYSICS_BIG_GRAPH_THRESHOLD = 200;

function edgeKey(a: string, b: string): string {
  return [a, b].sort().join("::");
}

function screenToWorld(
  app: Application,
  world: Container,
  x: number,
  y: number,
) {
  return {
    x: (x - world.x) / world.scale.x,
    y: (y - world.y) / world.scale.y,
  };
}

function isPrimaryPathEdge(
  sourceId: string,
  targetId: string,
  path: string[],
): boolean {
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    if (
      (a === sourceId && b === targetId) ||
      (a === targetId && b === sourceId)
    ) {
      return true;
    }
  }
  return false;
}

function getPrimaryPathDirection(
  sourceId: string,
  targetId: string,
  path: string[],
): { fromId: string; toId: string } | null {
  for (let i = 0; i < path.length - 1; i++) {
    const fromId = path[i];
    const toId = path[i + 1];
    if (
      (fromId === sourceId && toId === targetId) ||
      (fromId === targetId && toId === sourceId)
    ) {
      return { fromId, toId };
    }
  }
  return null;
}

function drawArrowHead(
  graphics: Graphics,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  color: number,
  alpha: number,
  size = 8,
) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;

  const tipX = toX;
  const tipY = toY;
  const baseX = tipX - ux * size;
  const baseY = tipY - uy * size;

  const leftX = baseX + px * (size * 0.55);
  const leftY = baseY + py * (size * 0.55);
  const rightX = baseX - px * (size * 0.55);
  const rightY = baseY - py * (size * 0.55);

  graphics.beginFill(color, alpha);
  graphics.moveTo(tipX, tipY);
  graphics.lineTo(leftX, leftY);
  graphics.lineTo(rightX, rightY);
  graphics.lineTo(tipX, tipY);
  graphics.endFill();
}

function drawDashedLine(
  graphics: Graphics,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  dashLength = 4,
  gapLength = 4,
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const totalDashes = Math.floor(distance / (dashLength + gapLength));
  const dashX = (dx / distance) * dashLength;
  const dashY = (dy / distance) * dashLength;
  const gapX = (dx / distance) * gapLength;
  const gapY = (dy / distance) * gapLength;

  let currentX = x1;
  let currentY = y1;

  for (let i = 0; i < totalDashes; i++) {
    graphics.moveTo(currentX, currentY);
    currentX += dashX;
    currentY += dashY;
    graphics.lineTo(currentX, currentY);
    currentX += gapX;
    currentY += gapY;
  }

  // draw remaining segment if any
  if (distance > totalDashes * (dashLength + gapLength)) {
    graphics.moveTo(currentX, currentY);
    graphics.lineTo(x2, y2);
  }
}

const True2DGraph = forwardRef<Graph2DHandle, Props>(function True2DGraph(
  {
    graphData,
    theme,
    onNodeSelect,
    activeNodeId = null,
    highlightPath = [],
    onToggleSidebar,
    onGraphChange,
    isSplitMode = false,
    onToggleSplitMode,
    onToggleTrue2D,
    isPathMode = false,
    isPathHideMode = false,
    externalHoverNodeId = null,
    sidebarOpen = false,
    isEditMode = false,
    onToggleTheme,
    onToggleEditMode,
    uiAnimations = true,
    onToggleUiAnimations,
    onGoHome,
    onSave,
    onRename,
  },
  ref,
) {
  const isDark = theme === "dark";
  const [showSavedToast, setShowSavedToast] = useState(false);
  const handleSaveClick = () => {
    if (onSave) onSave();
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 2000);
  };

  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);
  const edgesLayerRef = useRef<Container | null>(null);
  const nodesLayerRef = useRef<Container | null>(null);
  const labelsLayerRef = useRef<Container | null>(null);

  const graphRef = useRef<Graph2DState>(buildGraph2DState(graphData));
  const nodeGraphicsRef = useRef<Map<string, Graphics>>(new Map());
  const nodeLabelRef = useRef<Map<string, Text>>(new Map());
  const edgeGraphicsRef = useRef<Map<string, Graphics>>(new Map());
  const dragOffsetsRef = useRef<Map<string, { dx: number; dy: number }>>(
    new Map(),
  );

  const [physicsOn, setPhysicsOn] = useState(
    graphData.nodes.length <= PHYSICS_BIG_GRAPH_THRESHOLD,
  );
  const [layoutAlgorithm, setLayoutAlgorithm] =
    useState<LayoutAlgorithm>("force");
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const hoveredNodeIdRef = useRef<string | null>(null);

  // -- Manual Mode & Renamer State --
  const [isManualMode, setIsManualMode] = useState(false);
  const manualModeEnabledRef = useRef(false);
  const [renamer, setRenamer] = useState<{
    id: string | null;
    label: string;
    cx: number;
    cy: number;
    sourceNodeId?: string;
    hex: string;
    isBulkColor?: boolean;
    spawnX?: number;
    spawnY?: number;
  } | null>(null);
  const isCommittingRef = useRef(false);

  // Marquee states
  const [marqueeMode, setMarqueeMode] = useState<MarqueeMode>("none");
  const [marqueeMenuOpen, setMarqueeMenuOpen] = useState(false);
  const activeMarqueeModeRef = useRef(marqueeMode);
  useEffect(() => {
    activeMarqueeModeRef.current = marqueeMode;
  }, [marqueeMode]);
  const selectedNodeIdsRef = useRef<Set<string>>(new Set());
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null);
  const marqueePathRef = useRef<{ x: number; y: number }[]>([]);
  const marqueePolygonRef = useRef<SVGPolygonElement>(null);
  const marqueeRectRef = useRef<SVGRectElement>(null);

  const draftEdgeRef = useRef<{
    sourceId: string;
    x: number;
    y: number;
  } | null>(null);
  const draftEdgeGraphicRef = useRef<Graphics | null>(null);
  const clickRef = useRef<{ time: number; id: string | null }>({
    time: 0,
    id: null,
  });
  const plusRef = useRef<HTMLDivElement>(null);

  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    nodeId: string | null;
  }>({ visible: false, x: 0, y: 0, nodeId: null });
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false);
  const [isLeftSidebarPinned, setIsLeftSidebarPinned] = useState(
    () => sessionStorage.getItem("leftSidebarPinned2D") === "true",
  );
  const renderSceneRef = useRef<() => void>(() => {});
  const fitToViewRef = useRef<() => void>(() => {});
  const physicsOnRef = useRef(physicsOn);
  const lockedNodeIdRef = useRef<string | null>(null);

  const viewportRef = useRef({ x: 0, y: 0, scale: 1 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ mx: 0, my: 0, vx: 0, vy: 0 });
  const draggingNodeRef = useRef<Node2D | null>(null);
  const dragGestureRef = useRef<{
    nodeId: string | null;
    startX: number;
    startY: number;
    moved: boolean;
  }>({ nodeId: null, startX: 0, startY: 0, moved: false });
  const suppressNodeTapRef = useRef<string | null>(null);

  const onNodeSelectRef = useRef(onNodeSelect);
  useEffect(() => {
    onNodeSelectRef.current = onNodeSelect;
  }, [onNodeSelect]);

  const highlightSet = useMemo(() => new Set(highlightPath), [highlightPath]);

  const findConnectedSet = useCallback((id: string): Set<string> => {
    const connected = new Set<string>([id]);
    graphRef.current.edges.forEach((e) => {
      if (e.a.id === id) connected.add(e.b.id);
      if (e.b.id === id) connected.add(e.a.id);
    });
    return connected;
  }, []);

  const colors = useMemo(() => {
    return theme === "dark"
      ? {
          bg: 0x080810,
          edge: 0xa0a0d0,
          text: 0xe2e2f0,
          dim: 0.2,
        }
      : {
          bg: 0xf4f4fb,
          edge: 0x6b6b8a,
          text: 0x1a1a2e,
          dim: 0.3,
        };
  }, [theme]);

  const renderScene = useCallback(() => {
    const world = worldRef.current;
    const edgesLayer = edgesLayerRef.current;
    const app = appRef.current;
    if (!world || !edgesLayer) return;

    const lockedNodeId = lockedNodeIdRef.current;
    if (app && lockedNodeId) {
      const lockedNode = graphRef.current.nodeMap.get(lockedNodeId);
      if (lockedNode) {
        viewportRef.current.x =
          app.renderer.width / 2 - lockedNode.x * viewportRef.current.scale;
        viewportRef.current.y =
          app.renderer.height / 2 - lockedNode.y * viewportRef.current.scale;
      }
    }

    const focusConnected = hoveredNodeId
      ? findConnectedSet(hoveredNodeId)
      : externalHoverNodeId
        ? findConnectedSet(externalHoverNodeId)
        : activeNodeId
          ? findConnectedSet(activeNodeId)
          : null;
    const emphasisSet = new Set<string>(highlightSet);
    if (focusConnected) {
      focusConnected.forEach((id) => emphasisSet.add(id));
    }
    const hasEmphasis = emphasisSet.size > 0;

    graphRef.current.edges.forEach((e) => {
      const key = edgeKey(e.a.id, e.b.id);
      let g = edgeGraphicsRef.current.get(key);
      if (!g) {
        g = new Graphics();
        edgeGraphicsRef.current.set(key, g);
        edgesLayer.addChild(g);
      }

      const inPath = highlightSet.has(e.a.id) && highlightSet.has(e.b.id);
      const isPrimary =
        inPath && isPrimaryPathEdge(e.a.id, e.b.id, highlightPath);
      const inConnected =
        focusConnected != null &&
        focusConnected.has(e.a.id) &&
        focusConnected.has(e.b.id);

      let alpha = hasEmphasis ? (inPath || inConnected ? 0.9 : 0.08) : 0.45;
      let isDashed = false;
      let width = 1.25;

      if (isPathMode && hasEmphasis) {
        if (isPrimary) {
          alpha = 1.0;
          width = 2.2;
        } else if (highlightSet.has(e.a.id) || highlightSet.has(e.b.id)) {
          isDashed = true;
          alpha = 0.5;
          width = 1.25;
        } else {
          alpha = isPathHideMode ? 0.0 : 0.04;
          width = 1.25;
        }
      } else {
        width = inPath ? 2.2 : 1.25;
      }

      g.clear();
      g.lineStyle({ width, color: colors.edge, alpha });

      if (isDashed) {
        drawDashedLine(g, e.a.x, e.a.y, e.b.x, e.b.y);
      } else {
        g.moveTo(e.a.x, e.a.y);
        g.lineTo(e.b.x, e.b.y);
      }

      if (isPathMode && isPrimary) {
        const dir = getPrimaryPathDirection(e.a.id, e.b.id, highlightPath);
        if (dir) {
          const from = dir.fromId === e.a.id ? e.a : e.b;
          const to = dir.toId === e.a.id ? e.a : e.b;

          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const ux = dx / len;
          const uy = dy / len;

          const tipX = to.x - ux * (to.radius + 2);
          const tipY = to.y - uy * (to.radius + 2);

          drawArrowHead(g, from.x, from.y, tipX, tipY, colors.edge, alpha, 10);
        }
      }
    });

    graphRef.current.nodes.forEach((n) => {
      const gfx = nodeGraphicsRef.current.get(n.id);
      const label = nodeLabelRef.current.get(n.id);
      if (!gfx || !label) return;

      const isSelected = activeNodeId === n.id || selectedNodeIdsRef.current.has(n.id);
      const isHovered = hoveredNodeId === n.id || externalHoverNodeId === n.id;
      const inPath = highlightSet.has(n.id);
      const inConnected = focusConnected?.has(n.id) ?? false;

      let alpha = hasEmphasis ? (inPath || inConnected ? 1 : colors.dim) : 1.0;

      let ringAlpha = isSelected
        ? 0.8
        : isHovered
          ? 0.6
          : inPath || inConnected
            ? 0.4
            : hasEmphasis
              ? 0.16
              : 0.8;

      if (isPathMode && hasEmphasis) {
        if (inPath) {
          alpha = 1.0;
          ringAlpha = 0.4;
        } else if (inConnected) {
          alpha = 0.85;
          ringAlpha = 0.2;
        } else {
          alpha = isPathHideMode ? 0.0 : 0.12;
          ringAlpha = isPathHideMode ? 0.0 : 0.05;
        }
      }

      gfx.clear();
      gfx.beginFill(n.color, alpha);
      gfx.drawCircle(0, 0, n.radius);
      gfx.endFill();

      gfx.beginFill(n.color, ringAlpha);
      gfx.drawCircle(0, 0, n.radius * (isSelected ? 2.4 : 2.0));
      gfx.endFill();

      // Breathing effect for selected node
      let currentScale = 1.0;
      if (isSelected) {
        const time = Date.now() / 1000;
        const breath = 0.5 + 0.2 * Math.sin(time * 4.0);
        ringAlpha = breath;
        currentScale = 1.0 + 0.05 * Math.sin(time * 4.0);
      }
      gfx.scale.set(currentScale);

      gfx.x = n.x;
      gfx.y = n.y;

      label.x = n.x;
      label.y = n.y + n.radius + 5;
      label.alpha = alpha;
    });

    if (!draftEdgeGraphicRef.current && edgesLayer) {
      draftEdgeGraphicRef.current = new Graphics();
      edgesLayer.addChild(draftEdgeGraphicRef.current);
    }
    if (draftEdgeGraphicRef.current) {
      const dg = draftEdgeGraphicRef.current;
      if (!dg.destroyed) {
        dg.clear();
        const draft = draftEdgeRef.current;
        if (draft && manualModeEnabledRef.current) {
          const srcNode = graphRef.current.nodeMap.get(draft.sourceId);
          if (srcNode) {
            dg.lineStyle({ width: 2, color: colors.edge, alpha: 0.8 });
            dg.moveTo(srcNode.x, srcNode.y);
            dg.lineTo(draft.x, draft.y);
          }
        }
      }
    }

    world.x = viewportRef.current.x;
    world.y = viewportRef.current.y;
    world.scale.set(viewportRef.current.scale);
  }, [
    colors.dim,
    colors.edge,
    findConnectedSet,
    highlightSet,
    highlightPath,
    isPathMode,
    isPathHideMode,
    externalHoverNodeId,
    hoveredNodeId,
    activeNodeId,
  ]);

  const fitToView = useCallback(() => {
    const app = appRef.current;
    if (!app || graphRef.current.nodes.length === 0) return;

    const nodes = graphRef.current.nodes;
    const minX = Math.min(...nodes.map((n) => n.x - n.radius));
    const maxX = Math.max(...nodes.map((n) => n.x + n.radius));
    const minY = Math.min(...nodes.map((n) => n.y - n.radius));
    const maxY = Math.max(...nodes.map((n) => n.y + n.radius));
    const w = Math.max(1, maxX - minX);
    const h = Math.max(1, maxY - minY);
    const pad = 60;
    const scaleX = (app.renderer.width - pad * 2) / w;
    const scaleY = (app.renderer.height - pad * 2) / h;
    const scale = Math.max(0.15, Math.min(2, Math.min(scaleX, scaleY)));

    viewportRef.current.scale = scale;
    viewportRef.current.x =
      app.renderer.width / 2 - ((minX + maxX) / 2) * scale;
    viewportRef.current.y =
      app.renderer.height / 2 - ((minY + maxY) / 2) * scale;
    renderSceneRef.current();
  }, []);

  const resetLayout = useCallback((algorithm: LayoutAlgorithm) => {
    const app = appRef.current;
    if (!app) return;
    setLayoutAlgorithm(algorithm);
    applyLayout(
      graphRef.current,
      algorithm,
      app.renderer.width,
      app.renderer.height,
    );
    // Preserve OFF state across layout changes; only force OFF for very large graphs.
    setPhysicsOn((prev) =>
      graphRef.current.nodes.length > PHYSICS_BIG_GRAPH_THRESHOLD
        ? false
        : prev,
    );
    fitToViewRef.current();
    renderSceneRef.current();
  }, []);

  const focusNode = useCallback((nodeId: string) => {
    const app = appRef.current;
    const node = graphRef.current.nodeMap.get(nodeId);
    if (!app || !node) return;
    viewportRef.current.x =
      app.renderer.width / 2 - node.x * viewportRef.current.scale;
    viewportRef.current.y =
      app.renderer.height / 2 - node.y * viewportRef.current.scale;
    renderSceneRef.current();
  }, []);

  const beginPanFromEvent = useCallback((e: FederatedPointerEvent) => {
    const native = e.nativeEvent as PointerEvent;
    isPanningRef.current = true;
    panStartRef.current = {
      mx: native.clientX,
      my: native.clientY,
      vx: viewportRef.current.x,
      vy: viewportRef.current.y,
    };
  }, []);

  useEffect(() => {
    renderSceneRef.current = renderScene;
  }, [renderScene]);

  useEffect(() => {
    fitToViewRef.current = fitToView;
  }, [fitToView]);

  useEffect(() => {
    physicsOnRef.current = physicsOn;
  }, [physicsOn]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const app = new Application({
      resizeTo: host,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 2,
      backgroundColor: colors.bg,
    });
    const canvas = app.view as HTMLCanvasElement;
    appRef.current = app;
    host.appendChild(canvas);

    const world = new Container();
    const edgesLayer = new Container();
    const nodesLayer = new Container();
    const labelsLayer = new Container();

    world.addChild(edgesLayer);
    world.addChild(nodesLayer);
    world.addChild(labelsLayer);
    app.stage.addChild(world);

    worldRef.current = world;
    edgesLayerRef.current = edgesLayer;
    nodesLayerRef.current = nodesLayer;
    labelsLayerRef.current = labelsLayer;

    app.stage.eventMode = "static";
    app.stage.hitArea = app.screen;

    const onNativeContextMenu = (e: Event) => {
      e.preventDefault();
    };

    const endInteraction = () => {
      isPanningRef.current = false;
      if (draggingNodeRef.current) {
        if (dragGestureRef.current.nodeId && dragGestureRef.current.moved) {
          suppressNodeTapRef.current = dragGestureRef.current.nodeId;
        }

        const isSelected = selectedNodeIdsRef.current.has(draggingNodeRef.current.id);
        if (isSelected) {
          selectedNodeIdsRef.current.forEach((id) => {
            const n = graphRef.current.nodeMap.get(id);
            if (n) {
              n.pinned = false;
              n.vx = 0; n.vy = 0;
            }
          });
        } else {
          draggingNodeRef.current.pinned = false;
          draggingNodeRef.current.vx = 0; draggingNodeRef.current.vy = 0;
        }

        draggingNodeRef.current = null;
        dragOffsetsRef.current.clear();
        dragGestureRef.current = {
          nodeId: null,
          startX: 0,
          startY: 0,
          moved: false,
        };
      }
    };

    const onWheel = (e: Event) => {
      const wheelEvent = e as WheelEvent;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = wheelEvent.clientX - rect.left;
      const my = wheelEvent.clientY - rect.top;
      const oldScale = viewportRef.current.scale;
      const zoomFactor = wheelEvent.deltaY < 0 ? 1.1 : 0.91;
      const newScale = Math.max(0.15, Math.min(4, oldScale * zoomFactor));
      viewportRef.current.x =
        mx - (mx - viewportRef.current.x) * (newScale / oldScale);
      viewportRef.current.y =
        my - (my - viewportRef.current.y) * (newScale / oldScale);
      viewportRef.current.scale = newScale;
      renderSceneRef.current();
    };

    const onCanvasPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const gx = e.clientX - rect.left;
      const gy = e.clientY - rect.top;

      if (isPanningRef.current) {
        viewportRef.current.x =
          panStartRef.current.vx + (e.clientX - panStartRef.current.mx);
        viewportRef.current.y =
          panStartRef.current.vy + (e.clientY - panStartRef.current.my);
        renderSceneRef.current();
        return;
      }

      if (draggingNodeRef.current) {
        const p = screenToWorld(app, world, gx, gy);

        const isSelected = selectedNodeIdsRef.current.has(draggingNodeRef.current.id);

        if (isSelected && dragOffsetsRef.current.size > 0) {
          // Move all selected nodes via pre-calculated offsets
          selectedNodeIdsRef.current.forEach((id) => {
            const node = graphRef.current.nodeMap.get(id);
            const off = dragOffsetsRef.current.get(id);
            if (node && off) {
              node.x = p.x + off.dx;
              node.y = p.y + off.dy;
              node.pinned = true;
            }
          });
        } else {
          // Move only the dragged node
          draggingNodeRef.current.x = p.x;
          draggingNodeRef.current.y = p.y;
        }

        const screenDx = e.clientX - dragGestureRef.current.startX;
        const screenDy = e.clientY - dragGestureRef.current.startY;
        if (screenDx * screenDx + screenDy * screenDy > 25) {
          dragGestureRef.current.moved = true;
        }
        renderSceneRef.current();
      }
    };

    const onCanvasPointerUp = () => {
      endInteraction();
    };

    canvas.addEventListener("contextmenu", onNativeContextMenu);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("pointermove", onCanvasPointerMove);
    window.addEventListener("pointerup", onCanvasPointerUp);

    app.stage.on("pointerdown", (e: FederatedPointerEvent) => {
      setContextMenu({ visible: false, x: 0, y: 0, nodeId: null });
      const isBackground = e.target === app.stage;

      const now = Date.now();
      if (
        isBackground &&
        e.button === 0 &&
        now - clickRef.current.time < 350 &&
        clickRef.current.id === "empty" &&
        manualModeEnabledRef.current
      ) {
        const world = worldRef.current;
        if (world) {
          const p = screenToWorld(app, world, e.global.x, e.global.y);
          setRenamer({
            id: null,
            label: "",
            cx: (e.nativeEvent as PointerEvent).clientX,
            cy: (e.nativeEvent as PointerEvent).clientY,
            hex: theme === "dark" ? "#ffffff" : "#000000",
            spawnX: p.x,
            spawnY: p.y,
          });
        }
        clickRef.current = { time: 0, id: null };
      } else if (isBackground && e.button === 0) {
        clickRef.current = { time: now, id: "empty" };
      }

      const activeMM = activeMarqueeModeRef.current;
      const isMiddle = e.button === 1;

      if (activeMM !== "none" && e.button === 0 && isBackground) {
        const mRect = canvas.getBoundingClientRect();
        const native = e.nativeEvent as PointerEvent;
        const lx = native.clientX - mRect.left;
        const ly = native.clientY - mRect.top;

        marqueeStartRef.current = { x: lx, y: ly };
        marqueePathRef.current = [{ x: lx, y: ly }];

        if (!e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
            selectedNodeIdsRef.current.clear();
        }

        if (activeMM === "rect" && marqueeRectRef.current) {
            marqueeRectRef.current.classList.remove("hidden");
            marqueeRectRef.current.setAttribute("x", String(lx));
            marqueeRectRef.current.setAttribute("y", String(ly));
            marqueeRectRef.current.setAttribute("width", "0");
            marqueeRectRef.current.setAttribute("height", "0");
        } else if (activeMM === "freehand" && marqueePolygonRef.current) {
            marqueePolygonRef.current.classList.remove("hidden");
            marqueePolygonRef.current.setAttribute("points", `${lx},${ly}`);
        }
      } else {
        const isBackgroundPrimaryDragPan = e.button === 0 && isBackground;
        if (
          isMiddle ||
          (!draftEdgeRef.current && e.shiftKey) ||
          isBackgroundPrimaryDragPan
        ) {
          beginPanFromEvent(e);
        }
      }
    });

    app.stage.on("pointermove", (e: FederatedPointerEvent) => {
      // Manual Mode '+' indicator
      if (
        manualModeEnabledRef.current &&
        hoveredNodeIdRef.current &&
        plusRef.current
      ) {
        plusRef.current.style.left = `${e.global.x + 20}px`;
        plusRef.current.style.top = `${e.global.y - 20}px`;
        plusRef.current.style.opacity = "1";
      } else if (plusRef.current) {
        plusRef.current.style.opacity = "0";
      }

      if (marqueeStartRef.current) {
        const native = e.nativeEvent as PointerEvent;
        const mRect = canvas.getBoundingClientRect();
        const lx = native.clientX - mRect.left;
        const ly = native.clientY - mRect.top;
        const pt = { x: lx, y: ly };
        marqueePathRef.current.push(pt);

        if (activeMarqueeModeRef.current === "rect" && marqueeRectRef.current) {
          const start = marqueeStartRef.current;
          const rx = Math.min(start.x, pt.x);
          const ry = Math.min(start.y, pt.y);
          const rw = Math.abs(pt.x - start.x);
          const rh = Math.abs(pt.y - start.y);
          marqueeRectRef.current.setAttribute("x", String(rx));
          marqueeRectRef.current.setAttribute("y", String(ry));
          marqueeRectRef.current.setAttribute("width", String(rw));
          marqueeRectRef.current.setAttribute("height", String(rh));
        } else if (activeMarqueeModeRef.current === "freehand" && marqueePolygonRef.current) {
          marqueePolygonRef.current.setAttribute(
            "points",
            marqueePathRef.current.map((p) => `${p.x},${p.y}`).join(" ")
          );
        }
        return;
      }

      if (draftEdgeRef.current && worldRef.current) {
        const p = screenToWorld(app, worldRef.current, e.global.x, e.global.y);
        draftEdgeRef.current.x = p.x;
        draftEdgeRef.current.y = p.y;
        renderSceneRef.current();
        return;
      }

      if (isPanningRef.current) {
        viewportRef.current.x =
          panStartRef.current.vx + (e.global.x - panStartRef.current.mx);
        viewportRef.current.y =
          panStartRef.current.vy + (e.global.y - panStartRef.current.my);
        renderSceneRef.current();
        return;
      }

      if (draggingNodeRef.current) {
        const p = screenToWorld(app, world, e.global.x, e.global.y);
        draggingNodeRef.current.x = p.x;
        draggingNodeRef.current.y = p.y;
        const dx = e.global.x - dragGestureRef.current.startX;
        const dy = e.global.y - dragGestureRef.current.startY;
        if (dx * dx + dy * dy > 25) {
          dragGestureRef.current.moved = true;
        }
        renderSceneRef.current();
      }
    });

    const handlePointerUp = (e: FederatedPointerEvent) => {
      if (marqueeStartRef.current) {
        const path = marqueePathRef.current;
        marqueeStartRef.current = null;

        if (marqueeRectRef.current) marqueeRectRef.current.classList.add("hidden");
        if (marqueePolygonRef.current) marqueePolygonRef.current.classList.add("hidden");

        if (path.length > 2 || (activeMarqueeModeRef.current === "rect" && path.length > 0)) {
          const rect = canvas.getBoundingClientRect();
          let boundMinX = Infinity, boundMinY = Infinity, boundMaxX = -Infinity, boundMaxY = -Infinity;

          if (activeMarqueeModeRef.current === "rect") {
            const native = e.nativeEvent as PointerEvent;
            const lxEnd = native.clientX - rect.left;
            const lyEnd = native.clientY - rect.top;
            boundMinX = Math.min(path[0].x, lxEnd);
            boundMaxX = Math.max(path[0].x, lxEnd);
            boundMinY = Math.min(path[0].y, lyEnd);
            boundMaxY = Math.max(path[0].y, lyEnd);
          }

          const pointInPoly = (px: number, py: number) => {
            let inside = false;
            for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
              const xi = path[i].x, yi = path[i].y;
              const xj = path[j].x, yj = path[j].y;
              const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
              if (intersect) inside = !inside;
            }
            return inside;
          };

          const world = worldRef.current;
          if (world && appRef.current) {
            graphRef.current.nodes.forEach((sn) => {
              const sx = sn.x * world.scale.x + world.x;
              const sy = sn.y * world.scale.y + world.y;

              let isInside = false;
              if (activeMarqueeModeRef.current === "rect") {
                isInside = sx >= boundMinX && sx <= boundMaxX && sy >= boundMinY && sy <= boundMaxY;
              } else {
                isInside = pointInPoly(sx, sy);
              }

              if (isInside) {
                const native = e.nativeEvent as PointerEvent;
                if (native.altKey) {
                  selectedNodeIdsRef.current.delete(sn.id);
                } else {
                  selectedNodeIdsRef.current.add(sn.id);
                }
              }
            });
          }
        }
        endInteraction();
        return;
      }

      const draft = draftEdgeRef.current;
      if (draft && worldRef.current) {
        const p = screenToWorld(app, worldRef.current, e.global.x, e.global.y);
        let hitNodeId: string | null = null;
        for (const n of graphRef.current.nodes) {
          if (n.id === draft.sourceId) continue;
          if (Math.hypot(n.x - p.x, n.y - p.y) <= n.radius) {
            hitNodeId = n.id;
            break;
          }
        }
        if (hitNodeId) {
          const byId = new Map(graphRef.current.nodes.map((n) => [n.id, n]));
          const freshNodes = graphData.nodes.map((n) => {
            const live = byId.get(n.id);
            return live ? { ...n, position2d: { x: live.x, y: live.y } } : n;
          });
          const srcIdx = freshNodes.findIndex((n) => n.id === draft.sourceId);
          if (
            srcIdx >= 0 &&
            !freshNodes[srcIdx].connections.includes(hitNodeId)
          ) {
            freshNodes[srcIdx].connections = [
              ...freshNodes[srcIdx].connections,
              hitNodeId,
            ];
            onGraphChange({ ...graphData, nodes: freshNodes });
          }
        } else {
          setRenamer({
            id: null,
            label: "",
            cx: (e.nativeEvent as PointerEvent).clientX,
            cy: (e.nativeEvent as PointerEvent).clientY,
            sourceNodeId: draft.sourceId,
            hex: theme === "dark" ? "#ffffff" : "#000000",
            spawnX: p.x,
            spawnY: p.y,
          });
        }
        draftEdgeRef.current = null;
        if (draftEdgeGraphicRef.current) draftEdgeGraphicRef.current.clear();
        renderSceneRef.current();
      }
      endInteraction();
    };

    app.stage.on("pointerup", handlePointerUp);
    app.stage.on("pointerupoutside", handlePointerUp);

    const tick = () => {
      if (!physicsOnRef.current) {
        renderSceneRef.current();
        return;
      }

      const cfg = {
        repelStrength: 2800,
        springK: 0.0075,
        naturalLength: 130,
        damping: 0.82,
        centerPull: 0.0013,
        maxVelocity: 8,
      };

      const nodes = graphRef.current.nodes;
      const edges = graphRef.current.edges;

      nodes.forEach((a) => {
        if (a.pinned) return;
        let fx = 0;
        let fy = 0;

        nodes.forEach((b) => {
          if (a === b) return;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.sqrt(dx * dx + dy * dy) || 0.1;
          const force = cfg.repelStrength / (d * d + 1);
          fx += (dx / d) * force;
          fy += (dy / d) * force;
        });

        edges.forEach((e) => {
          const other = e.a === a ? e.b : e.b === a ? e.a : null;
          if (!other) return;
          const dx = other.x - a.x;
          const dy = other.y - a.y;
          const d = Math.sqrt(dx * dx + dy * dy) || 0.1;
          const force = (d - cfg.naturalLength) * cfg.springK;
          fx += (dx / d) * force;
          fy += (dy / d) * force;
        });

        fx += (app.renderer.width / 2 - a.x) * cfg.centerPull;
        fy += (app.renderer.height / 2 - a.y) * cfg.centerPull;

        a.vx = (a.vx + fx) * cfg.damping;
        a.vy = (a.vy + fy) * cfg.damping;

        const speed = Math.sqrt(a.vx * a.vx + a.vy * a.vy);
        if (speed > cfg.maxVelocity) {
          a.vx = (a.vx / speed) * cfg.maxVelocity;
          a.vy = (a.vy / speed) * cfg.maxVelocity;
        }

        a.x += a.vx;
        a.y += a.vy;
      });

      renderSceneRef.current();
    };

    app.ticker.add(tick);

    return () => {
      app.ticker.remove(tick);
      canvas.removeEventListener("contextmenu", onNativeContextMenu);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("pointermove", onCanvasPointerMove);
      window.removeEventListener("pointerup", onCanvasPointerUp);
      app.destroy(true, { children: true, texture: true, baseTexture: true });
      appRef.current = null;
      worldRef.current = null;
      edgesLayerRef.current = null;
      nodesLayerRef.current = null;
      labelsLayerRef.current = null;
      nodeGraphicsRef.current.clear();
      nodeLabelRef.current.clear();
      edgeGraphicsRef.current.clear();
      draftEdgeGraphicRef.current = null;
    };
  }, [colors.bg]);

  useEffect(() => {
    const app = appRef.current;
    const nodesLayer = nodesLayerRef.current;
    const labelsLayer = labelsLayerRef.current;
    const edgesLayer = edgesLayerRef.current;
    if (!app || !nodesLayer || !labelsLayer || !edgesLayer) return;

    graphRef.current = buildGraph2DState(graphData);

    // Recreate layers
    edgesLayer.removeChildren();
    nodesLayer.removeChildren();
    labelsLayer.removeChildren();
    edgeGraphicsRef.current.clear();
    nodeGraphicsRef.current.clear();
    nodeLabelRef.current.clear();
    draftEdgeGraphicRef.current = null;

    const has2D = graphData.nodes.some((n) => n.position2d);
    if (!has2D) {
      const algo: LayoutAlgorithm =
        graphData.nodes.length > PHYSICS_BIG_GRAPH_THRESHOLD
          ? "grid"
          : layoutAlgorithm;
      applyLayout(
        graphRef.current,
        algo,
        app.renderer.width,
        app.renderer.height,
      );
      if (graphData.nodes.length > PHYSICS_BIG_GRAPH_THRESHOLD) {
        setPhysicsOn(false);
      }
    }

    graphRef.current.nodes.forEach((n) => {
      const nodeGraphic = new Graphics();
      nodeGraphic.eventMode = "static";
      nodeGraphic.cursor = "pointer";
      nodeGraphic.on("pointerover", () => {
        setHoveredNodeId(n.id);
        hoveredNodeIdRef.current = n.id;
      });
      nodeGraphic.on("pointerout", () => {
        setHoveredNodeId((prev) => (prev === n.id ? null : prev));
        if (hoveredNodeIdRef.current === n.id) {
          hoveredNodeIdRef.current = null;
        }
      });
      nodeGraphic.on("pointerdown", (e: FederatedPointerEvent) => {
        e.stopPropagation();
        if (e.button === 2) {
          setContextMenu({
            visible: true,
            x: e.global.x,
            y: e.global.y,
            nodeId: n.id,
          });
          return;
        }
        if (e.button === 0) {
          const now = Date.now();
          if (
            now - clickRef.current.time < 350 &&
            clickRef.current.id === n.id &&
            manualModeEnabledRef.current
          ) {
            setRenamer({
              id: n.id,
              label: n.label,
              hex: n.color
                ? "#" + n.color.toString(16).padStart(6, "0")
                : theme === "dark"
                  ? "#ffffff"
                  : "#000000",
              cx: e.global.x,
              cy: e.global.y,
            });
            clickRef.current = { time: 0, id: null };
            return;
          }
          clickRef.current = { time: now, id: n.id };

          const world = worldRef.current;
          if (!world) return;
          const p = screenToWorld(app, world, e.global.x, e.global.y);

          // If Manual Mode + Shift => start draft edge
          if (e.shiftKey && manualModeEnabledRef.current) {
            draftEdgeRef.current = { sourceId: n.id, x: p.x, y: p.y };
            return;
          }

          // Left-drag on node moves node (Alt+drag also follows this path).
          const isSelected = selectedNodeIdsRef.current.has(n.id);
          dragOffsetsRef.current.clear();

          if (isSelected) {
            selectedNodeIdsRef.current.forEach((id) => {
              const node = graphRef.current.nodeMap.get(id);
              if (node) {
                node.pinned = true;
                dragOffsetsRef.current.set(id, {
                  dx: node.x - p.x,
                  dy: node.y - p.y,
                });
              }
            });
          } else {
            n.pinned = true;
          }

          draggingNodeRef.current = n;
          dragGestureRef.current = {
            nodeId: n.id,
            startX: (e.nativeEvent as PointerEvent).clientX,
            startY: (e.nativeEvent as PointerEvent).clientY,
            moved: false,
          };
          return;
        }
      });
      nodeGraphic.on("pointertap", (e: FederatedPointerEvent) => {
        if (e.button !== 0) return;
        if (e.altKey) return;
        if (suppressNodeTapRef.current === n.id) {
          suppressNodeTapRef.current = null;
          return;
        }
        onNodeSelectRef.current(n.id);
      });
      nodesLayer.addChild(nodeGraphic);
      nodeGraphicsRef.current.set(n.id, nodeGraphic);

      const labelStyle = new TextStyle({
        fontFamily: "JetBrains Mono",
        fontSize: 44,
        fill: colors.text,
        align: "center",
      });
      const label = new Text(`${n.icon} ${n.label}`, labelStyle);
      label.scale.set(0.25);
      label.anchor.set(0.5, 0);
      labelsLayer.addChild(label);
      nodeLabelRef.current.set(n.id, label);
    });

    fitToViewRef.current();
    renderSceneRef.current();
  }, [beginPanFromEvent, colors.text, graphData, layoutAlgorithm]);

  useEffect(() => {
    renderScene();
  }, [renderScene, highlightSet]);

  useEffect(() => {
    if (!isLeftSidebarPinned) return;
    setLeftSidebarOpen(true);
  }, [isLeftSidebarPinned]);

  useEffect(() => {
    if (!isSplitMode) return;
    setLeftSidebarOpen(false);
  }, [isSplitMode]);

  useImperativeHandle(
    ref,
    () => ({
      getFreshData() {
        const byId = new Map(
          graphRef.current.nodes.map((n) => [n.id, n] as const),
        );
        return {
          ...graphData,
          nodes: graphData.nodes.map((n) => {
            const live = byId.get(n.id);
            if (!live) return n;
            return {
              ...n,
              position2d: { x: live.x, y: live.y },
            };
          }),
        };
      },
      focusToNode(nodeId: string) {
        focusNode(nodeId);
      },
      lockToNode(nodeId: string) {
        lockedNodeIdRef.current = nodeId;
        focusNode(nodeId);
      },
      unlockCamera() {
        lockedNodeIdRef.current = null;
      },
    }),
    [focusNode, graphData],
  );

  const save2DLayout = () => {
    onGraphChange(
      (() => {
        const byId = new Map(
          graphRef.current.nodes.map((n) => [n.id, n] as const),
        );
        return {
          ...graphData,
          nodes: graphData.nodes.map((n) => {
            const live = byId.get(n.id);
            if (!live) return n;
            return {
              ...n,
              position2d: { x: live.x, y: live.y },
            };
          }),
        };
      })(),
    );
  };

  const deleteNodeById = (nodeId: string) => {
    const updatedNodes = graphData.nodes
      .filter((n) => n.id !== nodeId)
      .map((n) => ({
        ...n,
        connections: n.connections.filter((cid) => cid !== nodeId),
      }));

    onGraphChange({
      ...graphData,
      nodes: updatedNodes,
    });

    if (hoveredNodeId === nodeId) setHoveredNodeId(null);
  };

  const commitRenamer = useCallback(
    (finalRenamer: NonNullable<typeof renamer>) => {
      isCommittingRef.current = true;
      const val = finalRenamer.label.trim();

      if (val) {
        // Build map to preserve latest exact positions before mutating graphData
        const byId = new Map(graphRef.current.nodes.map((n) => [n.id, n]));
        const freshNodes = graphData.nodes.map((n) => {
          const live = byId.get(n.id);
          return live ? { ...n, position2d: { x: live.x, y: live.y } } : n;
        });

        if (finalRenamer.id === null) {
          // Create brand new node
          if (freshNodes.find((n) => n.id === val)) {
            alert("A node with this name already exists!");
            isCommittingRef.current = false;
            return;
          }

          const newNode = {
            id: val,
            label: val,
            hex: finalRenamer.hex,
            category: "concept",
            icon: "📄",
            content: "nothing",
            connections: finalRenamer.sourceNodeId
              ? [finalRenamer.sourceNodeId]
              : [],
            position2d: {
              x: finalRenamer.spawnX ?? 0,
              y: finalRenamer.spawnY ?? 0,
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          freshNodes.push(newNode);

          // Connect back to source if it was created via drag
          if (finalRenamer.sourceNodeId) {
            const srcIdx = freshNodes.findIndex(
              (n) => n.id === finalRenamer.sourceNodeId,
            );
            if (srcIdx >= 0 && !freshNodes[srcIdx].connections.includes(val)) {
              freshNodes[srcIdx].connections.push(val);
            }
          }
        } else {
          // Rename or edit existing node
          const idx = freshNodes.findIndex((n) => n.id === finalRenamer.id);
          if (idx !== -1) {
            freshNodes[idx] = {
              ...freshNodes[idx],
              label: val,
              hex: finalRenamer.hex,
            };
          }
        }

        onGraphChange({ ...graphData, nodes: freshNodes });
      }
      isCommittingRef.current = false;
    },
    [graphData, onGraphChange],
  );

  const shouldShowLeftSidebar =
    !isSplitMode && (leftSidebarOpen || isLeftSidebarPinned);

  return (
    <div className="relative w-full h-full overflow-hidden bg-bg">
      <div ref={hostRef} className="absolute inset-0 touch-none" />
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
        <rect
          ref={marqueeRectRef}
          fill="rgba(124,106,247,0.15)"
          stroke="rgba(124,106,247,0.8)"
          strokeWidth="1.5"
          className="hidden"
        />
        <polygon
          ref={marqueePolygonRef}
          fill="rgba(124,106,247,0.15)"
          stroke="rgba(124,106,247,0.8)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          className="hidden"
        />
      </svg>

      {/* Left index sidebar */}
      <div
        className={`absolute top-0 bottom-0 left-0 bg-surface/95 backdrop-blur-md border-r border-border transition-transform duration-300 z-50 flex flex-col w-64 shadow-2xl ${
          shouldShowLeftSidebar ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <span className="text-xs font-medium tracking-widest text-text">
            Index
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                const next = !isLeftSidebarPinned;
                setIsLeftSidebarPinned(next);
                sessionStorage.setItem("leftSidebarPinned2D", next.toString());
                if (!next) setLeftSidebarOpen(false);
              }}
              className={`p-1.5 transition-all rounded-md border ${isLeftSidebarPinned ? "text-accent border-accent bg-accent/10" : "text-muted border-transparent hover:text-text hover:bg-surface2"}`}
              title={isLeftSidebarPinned ? "Unpin Sidebar" : "Pin Sidebar"}
            >
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M16 11V7a4 4 0 00-8 0v4l-2 3v2h6v6l2 2 2-2v-6h6v-2l-2-3z" />
              </svg>
            </button>
            <button
              onClick={() => setLeftSidebarOpen(false)}
              className="text-muted hover:text-accent p-1 transition-colors"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {graphRef.current.nodes.map((n) => {
            const isActive = activeNodeId === n.id;
            return (
              <button
                key={n.id}
                onClick={() => {
                  onNodeSelectRef.current(n.id);
                }}
                onMouseEnter={() => setHoveredNodeId(n.id)}
                onMouseLeave={() =>
                  setHoveredNodeId((prev) => (prev === n.id ? null : prev))
                }
                className={`w-full flex items-center gap-2 text-left px-2.5 py-2 rounded-md transition-all text-[11px] ${
                  isActive
                    ? "bg-accent/15 border border-accent/60 text-accent"
                    : "text-muted2 border border-transparent hover:border-border2 hover:bg-surface2 hover:text-text"
                }`}
              >
                <span>{n.icon}</span>
                <span className="truncate">{n.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {!isSplitMode && !leftSidebarOpen && !isLeftSidebarPinned && (
        <button
          onMouseEnter={() => setLeftSidebarOpen(true)}
          onClick={() => setLeftSidebarOpen(true)}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-40 w-7 h-12 rounded-md border border-border2 bg-surface/85 text-muted2 hover:text-accent hover:border-accent transition-all"
          title="Open Index"
        >
          <svg
            className="w-4 h-4 mx-auto"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      )}

      <div className="absolute top-4 right-5 z-40 flex items-center gap-2">
        <button
          onClick={onToggleTrue2D}
          className="flex items-center justify-center h-8 px-2.5 rounded-md border border-accent text-accent bg-accent/20 shadow-[0_0_10px_rgba(124,106,247,0.3)] text-[10px] font-bold tracking-widest transition-all duration-200 backdrop-blur-md"
          title="Switch to 3D renderer"
        >
          3D VIEW
        </button>

        <button
          onClick={onToggleSplitMode}
          title={isSplitMode ? "Disable Split Screen" : "Enable Split Screen"}
          className={`flex items-center justify-center w-8 h-8 rounded-md border transition-all duration-200 backdrop-blur-md ${
            isSplitMode
              ? "border-accent text-accent bg-accent/20 shadow-[0_0_10px_rgba(124,106,247,0.3)]"
              : "border-border2 bg-surface/90 text-muted2 hover:border-accent hover:text-accent hover:bg-accent/10"
          }`}
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="12" y1="3" x2="12" y2="21" />
          </svg>
        </button>

        <button
          onClick={handleSaveClick}
          title="Save Graph"
          className="flex items-center justify-center w-8 h-8 rounded-md border border-border2 bg-surface/90 backdrop-blur-md text-muted2 hover:border-accent hover:text-accent hover:bg-accent/10 transition-all duration-200"
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
            <polyline points="17 21 17 13 7 13 7 21"></polyline>
            <polyline points="7 3 7 8 15 8"></polyline>
          </svg>
        </button>

        <button
          onClick={onGoHome}
          title="Go Home"
          className="flex items-center justify-center w-8 h-8 rounded-md border border-border2 bg-surface/90 backdrop-blur-md text-muted2 hover:border-accent hover:text-accent hover:bg-accent/10 transition-all duration-200"
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
        </button>

        <button
          onClick={onToggleEditMode}
          title={
            isEditMode ? "View Node Content Mode" : "Edit Node Content Mode"
          }
          className={`flex items-center justify-center w-8 h-8 rounded-md border transition-all duration-200 backdrop-blur-md
            ${
              isEditMode
                ? "border-accent text-accent bg-accent/20 shadow-[0_0_10px_rgba(124,106,247,0.3)]"
                : "border-border2 bg-surface/90 text-muted2 hover:border-accent hover:text-accent hover:bg-accent/10"
            }`}
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 20h9"></path>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
          </svg>
        </button>

        {/* Manual Graph Mode toggle */}
        <button
          onClick={() => {
            const next = !manualModeEnabledRef.current;
            manualModeEnabledRef.current = next;
            setIsManualMode(next);
            if (!next) {
              setContextMenu({ visible: false, x: 0, y: 0, nodeId: null });
              if (plusRef.current) plusRef.current.style.opacity = "0";
            }
          }}
          title={
            isManualMode ? "Manual Build Mode: ON" : "Manual Build Mode: OFF"
          }
          className={`flex items-center justify-center w-8 h-8 rounded-md border transition-all duration-200 backdrop-blur-md ${
            isManualMode
              ? "border-accent text-accent bg-accent/20 shadow-[0_0_10px_rgba(124,106,247,0.3)]"
              : "border-border2 bg-surface/90 text-muted2 hover:border-accent hover:text-accent hover:bg-accent/10"
          }`}
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        </button>

        <button
          onClick={onToggleTheme}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          className="flex items-center justify-center w-8 h-8 rounded-md border border-border2 bg-surface/90 backdrop-blur-md text-muted2 hover:border-accent hover:text-accent hover:bg-accent/10 transition-all duration-200"
        >
          {isDark ? (
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <path d="M8 12a4 4 0 100-8 4 4 0 000 8zm0-10a.75.75 0 000-1.5.75.75 0 000 1.5zm0 11a.75.75 0 000 1.5.75.75 0 000-1.5zM3.05 4.11a.75.75 0 10-1.06-1.06.75.75 0 001.06 1.06zm9.9 7.78a.75.75 0 10-1.06-1.06.75.75 0 001.06 1.06zM2 8a.75.75 0 00-1.5 0A.75.75 0 002 8zm13.5 0a.75.75 0 00-1.5 0 .75.75 0 001.5 0zM4.11 12.95a.75.75 0 10-1.06 1.06.75.75 0 001.06-1.06zm7.78-9.9a.75.75 0 10-1.06 1.06.75.75 0 001.06-1.06z" />
            </svg>
          ) : (
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <path d="M6 .278a.768.768 0 01.08.858 7.208 7.208 0 00-.878 3.46c0 4.021 3.278 7.277 7.318 7.277.527 0 1.04-.055 1.533-.16a.787.787 0 01.81.316.733.733 0 01-.031.893A8.349 8.349 0 018.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.752.752 0 016 .278z" />
            </svg>
          )}
        </button>

        <button
          onClick={() => {
            if (isSplitMode) {
              setLeftSidebarOpen(false);
              return;
            }
            setLeftSidebarOpen((o) => !o);
          }}
          className={`flex items-center justify-center h-8 px-2.5 rounded-md border text-[10px] font-bold tracking-widest transition-all duration-200 backdrop-blur-md ${
            shouldShowLeftSidebar
              ? "border-accent text-accent bg-accent/20 shadow-[0_0_10px_rgba(124,106,247,0.3)]"
              : isSplitMode
                ? "border-border2 bg-surface/70 text-muted opacity-60"
                : "border-border2 bg-surface/90 text-muted2 hover:border-accent hover:text-accent hover:bg-accent/10"
          }`}
          title={
            isSplitMode
              ? "Index is hidden in split mode"
              : shouldShowLeftSidebar
                ? "Hide Index"
                : "Show Index"
          }
        >
          INDEX
        </button>        <button
          onClick={onToggleSidebar}
          className="flex items-center justify-center h-8 px-2.5 rounded-md border border-border2 bg-surface/90 text-[10px] font-bold tracking-widest text-muted2 hover:border-accent hover:text-accent hover:bg-accent/10 transition-all duration-200"
          title="Open Studio Sidebar"
        >
          STUDIO
        </button>
      </div>

      {/* Manual Mode '+' indicator (Optional visual hint) */}
      <div
        ref={plusRef}
        className="fixed pointer-events-none opacity-0 z-[1002] transition-opacity duration-100 flex items-center justify-center w-5 h-5 rounded-full bg-accent text-white shadow-[0_0_10px_rgba(124,106,247,0.5)]"
      >
        <svg
          className="w-3.5 h-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </div>

      {renamer && (
        <div
          id="renamer-modal"
          className={`absolute z-[2000] flex items-center gap-1.5 p-1.5 rounded-xl border shadow-2xl backdrop-blur-xl ${
            isDark
              ? "bg-surface/90 border-border2"
              : "bg-white/90 border-border"
          }`}
          style={{
            left: renamer.cx,
            top: renamer.cy,
            transform: "translate(-50%, -100%)",
            marginTop: "-24px",
          }}
        >
          {!renamer.isBulkColor && (
            <input
              autoFocus
              type="text"
              defaultValue={renamer.label}
              placeholder="Node name..."
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") {
                  commitRenamer({ ...renamer, label: e.currentTarget.value });
                  setRenamer(null);
                }
                if (e.key === "Escape") {
                  setRenamer(null);
                }
              }}
              onChange={(e) => {
                setRenamer((prev) =>
                  prev ? { ...prev, label: e.target.value } : prev,
                );
              }}
              className="w-40 bg-transparent px-2 py-1.5 text-sm outline-none text-text placeholder-muted2"
            />
          )}

          <div className="relative w-8 h-8 rounded-lg overflow-hidden shrink-0 border border-border2 shadow-sm cursor-pointer group">
            <input
              type="color"
              value={renamer.hex}
              onChange={(e) => {
                setRenamer((prev) =>
                  prev ? { ...prev, hex: e.target.value } : prev,
                );
              }}
              className="absolute inset-[-8px] w-[50px] h-[50px] cursor-pointer"
            />
            <div className="absolute inset-0 pointer-events-none ring-1 ring-inset ring-black/10 transition-colors group-hover:ring-black/20" />
          </div>
        </div>
      )}

      {contextMenu.visible && (
        <div
          className="absolute z-[70] min-w-[140px] rounded-lg border border-border2 bg-surface/95 backdrop-blur-md shadow-xl p-1"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => {
              if (contextMenu.nodeId) {
                onNodeSelectRef.current(contextMenu.nodeId);
              }
              setContextMenu({ visible: false, x: 0, y: 0, nodeId: null });
            }}
            className="w-full text-left px-2.5 py-1.5 text-[11px] rounded hover:bg-surface2 text-text"
          >
            Open Node
          </button>
          <button
            onClick={() => {
              if (contextMenu.nodeId) {
                focusNode(contextMenu.nodeId);
              }
              setContextMenu({ visible: false, x: 0, y: 0, nodeId: null });
            }}
            className="w-full text-left px-2.5 py-1.5 text-[11px] rounded hover:bg-surface2 text-text"
          >
            Focus Node
          </button>
          <button
            onClick={() => {
              if (contextMenu.nodeId) {
                const node = graphRef.current.nodeMap.get(contextMenu.nodeId);
                if (node) node.pinned = !node.pinned;
              }
              setContextMenu({ visible: false, x: 0, y: 0, nodeId: null });
            }}
            className="w-full text-left px-2.5 py-1.5 text-[11px] rounded hover:bg-surface2 text-text"
          >
            Pin/Unpin
          </button>
          <button
            onClick={() => {
              if (contextMenu.nodeId) {
                deleteNodeById(contextMenu.nodeId);
              }
              setContextMenu({ visible: false, x: 0, y: 0, nodeId: null });
            }}
            className="w-full text-left px-2.5 py-1.5 text-[11px] rounded hover:bg-[#f87171]/10 hover:text-[#f87171] text-text"
          >
            Delete Node
          </button>
        </div>
      )}

      <div className="absolute bottom-4 left-4 z-40 flex items-center gap-2 rounded-xl border border-border bg-surface/90 backdrop-blur-md px-3 py-2">
        <button
          onClick={() => setPhysicsOn((p) => !p)}
          className={`text-[10px] tracking-widest px-2 py-1 rounded border transition-all ${physicsOn ? "border-accent text-accent bg-accent/10" : "border-border2 text-muted2"}`}
        >
          {physicsOn ? "PHYSICS ON" : "PHYSICS OFF"}
        </button>

        <select
          value={layoutAlgorithm}
          onChange={(e) => resetLayout(e.target.value as LayoutAlgorithm)}
          className="text-[10px] tracking-widest bg-surface2 border border-border2 rounded px-2 py-1 text-text"
        >
          <option value="force">FORCE</option>
          <option value="hierarchy">HIERARCHY</option>
          <option value="radial">RADIAL</option>
          <option value="grid">GRID</option>
        </select>

        <button
          onClick={fitToView}
          className="text-[10px] tracking-widest px-2 py-1 rounded border border-border2 text-muted2 hover:border-accent hover:text-accent transition-all"
        >
          FIT
        </button>

        {/* Marquee Select Dropdown */}
        <div className="relative flex items-center h-6">
          <button
            onClick={() => {
              setMarqueeMode((m) => (m === "none" ? "rect" : "none"));
              if (marqueeMode !== "none") selectedNodeIdsRef.current.clear();
              setContextMenu({ visible: false, x: 0, y: 0, nodeId: null });
            }}
            title={`Marquee Tool: ${marqueeMode === "none" ? "OFF" : marqueeMode.toUpperCase()}`}
            className={`flex items-center justify-center w-7 h-6 rounded-l-md border-y border-l transition-all duration-200 backdrop-blur-md ${
              marqueeMode !== "none"
                ? "border-accent text-accent bg-accent/20 shadow-[0_0_10px_rgba(124,106,247,0.3)]"
                : "border-border2 bg-surface/90 text-muted2 hover:border-accent hover:text-accent hover:bg-accent/10"
            }`}
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
              <rect x="3" y="3" width="18" height="18" strokeDasharray="3 3" />
            </svg>
          </button>
          <button
            onClick={() => {
              setMarqueeMenuOpen((m) => !m);
              setContextMenu({ visible: false, x: 0, y: 0, nodeId: null });
            }}
            className={`flex items-center justify-center w-4 h-6 rounded-r-md border-y border-r transition-all duration-200 backdrop-blur-md ${
              marqueeMode !== "none"
                ? "border-accent text-accent bg-accent/20"
                : "border-border2 bg-surface/90 text-muted2 hover:border-accent hover:text-accent hover:bg-accent/10"
            }`}
          >
            <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <AnimatePresence>
            {marqueeMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
                className="absolute bottom-8 left-0 z-50 w-32 py-1 rounded-xl border border-border2 shadow-xl backdrop-blur-xl"
                style={{ background: isDark ? "rgba(30,30,30,0.85)" : "rgba(255,255,255,0.85)" }}
              >
                <div className="px-3 py-1.5 text-[9px] uppercase tracking-widest text-muted2 font-bold mb-1 border-b border-border/40">Mode</div>
                {[{ id: "rect", label: "Rect" }, { id: "freehand", label: "Free" }].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => { setMarqueeMode(opt.id as MarqueeMode); setMarqueeMenuOpen(false); }}
                    className={`w-full px-3 py-1.5 text-left text-[10px] font-medium tracking-wide flex items-center justify-between hover:bg-accent/10 transition-colors ${marqueeMode === opt.id ? "text-accent" : "text-text"}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          onClick={save2DLayout}
          className="text-[10px] tracking-widest px-2 py-1 rounded border border-border2 text-muted2 hover:border-accent hover:text-accent transition-all"
        >
          SAVE 2D
        </button>
      </div>

      <div className="absolute bottom-4 right-4 z-40 text-[10px] tracking-widest text-muted2 bg-surface/90 border border-border rounded px-2 py-1">
        {graphRef.current.nodes.length} NODES · {graphRef.current.edges.length}{" "}
        EDGES
      </div>
    </div>
  );
});

export default True2DGraph;
