import { useState, useRef, useMemo, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import Graph3D from "./components/Graph3D";
import True2DGraph from "./components/True2DGraph";
import PageView from "./components/PageView";
import Sidebar from "./components/Sidebar";
import HomePage from "./components/HomePage";
import { SearchBar } from "./components/SearchBar";
import { GraphData, NodeData, GraphRecord, GraphHandle } from "./types/graph";
import { Graph2DHandle } from "./components/True2DGraph/graph2d.types";
import { DEFAULT_GRAPH } from "./data/defaultGraph";
import { useTheme } from "./hooks/useTheme";
import { useGraphLibrary } from "./hooks/useGraphLibrary";
import Fuse from "fuse.js";

type View = "home" | "graph";

export default function App() {
  const { theme, toggle: toggleTheme } = useTheme();
  const { records, saveGraph, deleteGraph, renameGraph } = useGraphLibrary();

  const [view, setView] = useState<View>("home");
  const [graphData, setGraphData] = useState<GraphData>(DEFAULT_GRAPH);
  const [originalGraphData, setOriginalGraphData] =
    useState<GraphData>(DEFAULT_GRAPH);
  const [currentId, setCurrentId] = useState<string | undefined>(undefined);
  const [activePage, setActivePage] = useState<NodeData | null>(null);
  const [pageHistory, setPageHistory] = useState<NodeData[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [uiAnimations, setUiAnimations] = useState(
    () => sessionStorage.getItem("uiAnimations") !== "false",
  );
  const [isSplitMode, setIsSplitMode] = useState(
    () => sessionStorage.getItem("splitMode") === "true",
  );
  const [highlightPath, setHighlightPath] = useState<string[]>([]);
  const [isPathMode, setIsPathMode] = useState(
    () => sessionStorage.getItem("isPathMode") === "true",
  );
  const [isPathAppendMode, setIsPathAppendMode] = useState(
    () => sessionStorage.getItem("pathAppendMode") === "true",
  );
  const [isPathHideMode, setIsPathHideMode] = useState(
    () => sessionStorage.getItem("isPathHideMode") === "true"
  );
  const [externalHoverNodeId, setExternalHoverNodeId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchContent, setSearchContent] = useState(true);
  const [highlightNeighbours, setHighlightNeighbours] = useState(true);

  // Undo/Redo system
  const [maxHistory, setMaxHistory] = useState(
    () => parseInt(sessionStorage.getItem("undoMaxHistory") || "100", 10),
  );
  type HistoryEntry = {
    graphData: GraphData;
    highlightPath: string[];
    activePage: NodeData | null;
  };
  const historyRef = useRef<HistoryEntry[]>([]);
  const historyIndexRef = useRef(-1);
  const skipHistoryRef = useRef(false);

  const captureSnapshot = (): HistoryEntry => {
    // Get fresh positions from engine if available
    const fresh = graphRef.current?.getFreshData() || graph2DRef.current?.getFreshData();
    return {
      graphData: JSON.parse(JSON.stringify(fresh || graphData)),
      highlightPath: [...highlightPath],
      activePage: activePage ? { ...activePage } : null,
    };
  };

  const pushHistory = () => {
    if (skipHistoryRef.current) return;
    const entry = captureSnapshot();
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push(entry);
    if (historyRef.current.length > maxHistory) {
      historyRef.current = historyRef.current.slice(historyRef.current.length - maxHistory);
    }
    historyIndexRef.current = historyRef.current.length - 1;
  };

  const restoreSnapshot = (entry: HistoryEntry) => {
    skipHistoryRef.current = true;
    handleGraphChange(entry.graphData);
    setHighlightPath(entry.highlightPath);
    setActivePage(entry.activePage);
    if (entry.activePage) {
      setPageHistory([]);
    }
  };

  const undo = () => {
    if (historyRef.current.length < 2 || historyIndexRef.current < 1) return;
    historyIndexRef.current--;
    restoreSnapshot(historyRef.current[historyIndexRef.current]);
  };

  const redo = () => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current++;
    restoreSnapshot(historyRef.current[historyIndexRef.current]);
  };

  const canUndo = historyIndexRef.current > 0;
  const canRedo = historyIndexRef.current < historyRef.current.length - 1;

  const undoRef = useRef(undo);
  const redoRef = useRef(redo);
  undoRef.current = undo;
  redoRef.current = redo;

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement)?.isContentEditable;
      if (isInput) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undoRef.current();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redoRef.current();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Push initial state to history when graph data first loads
  useEffect(() => {
    if (view === "graph" && graphData.nodes.length > 0 && historyRef.current.length === 0) {
      pushHistory();
    }
  }, [view, graphData.nodes.length]);

  const fuseRef = useRef<Fuse<NodeData> | null>(null);

  useEffect(() => {
    const keys = ["label"];
    if (searchContent) keys.push("content");
    fuseRef.current = new Fuse(graphData.nodes, {
      keys,
      threshold: 0.3,
      ignoreLocation: true,
    });
  }, [graphData.nodes, searchContent]);

  // Auto-push history when graphData or highlightPath changes
  const prevGraphDataRef = useRef(graphData);
  const prevHighlightPathRef = useRef(highlightPath);
  useEffect(() => {
    if (view !== "graph") return;

    // Undo/redo restore — just reset the skip flag and update prev refs
    if (skipHistoryRef.current) {
      skipHistoryRef.current = false;
      prevGraphDataRef.current = graphData;
      prevHighlightPathRef.current = highlightPath;
      return;
    }

    // Skip if no history yet (initial push handles this)
    if (historyRef.current.length === 0) {
      prevGraphDataRef.current = graphData;
      prevHighlightPathRef.current = highlightPath;
      return;
    }

    const graphChanged =
      JSON.stringify(graphData) !== JSON.stringify(prevGraphDataRef.current);
    const pathChanged =
      JSON.stringify(highlightPath) !==
      JSON.stringify(prevHighlightPathRef.current);
    if (graphChanged || pathChanged) {
      pushHistory();
      prevGraphDataRef.current = graphData;
      prevHighlightPathRef.current = highlightPath;
    }
  }, [graphData, highlightPath, activePage, view]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || !fuseRef.current) return [];
    const results = fuseRef.current.search(searchQuery);
    return results.map(r => ({
      id: r.item.id,
      label: r.item.label,
      content: r.item.content
    }));
  }, [searchQuery, graphData.nodes, searchContent]);

  const searchMatchedNodeIds = useMemo(() => {
    const matches = new Set<string>();
    searchResults.forEach(r => matches.add(r.id));
    return matches;
  }, [searchResults]);

  const highlightSet = useMemo(() => {
    const s = new Set(isPathMode ? highlightPath : []);
    
    // Add primary matches
    searchMatchedNodeIds.forEach(id => s.add(id));
    
    // Highlight neighbours if enabled
    if (highlightNeighbours && searchMatchedNodeIds.size > 0) {
      graphData.nodes.forEach((n) => {
        if (searchMatchedNodeIds.has(n.id) && n.connections) {
          n.connections.forEach(c => s.add(c));
        }
      });
      graphData.nodes.forEach((n) => {
        if (n.connections && n.connections.some(c => searchMatchedNodeIds.has(c))) {
          s.add(n.id);
        }
      });
    }

    return s;
  }, [highlightPath, searchMatchedNodeIds, isPathMode, highlightNeighbours, graphData.nodes]);
  const [isLockEnabled, setIsLockEnabled] = useState(
    () => sessionStorage.getItem("lockCamera") !== "false",
  );
  const [lockedToNodeId, setLockedToNodeId] = useState<string | null>(null);
  const [isTrue2D, setIsTrue2D] = useState(
    () => sessionStorage.getItem("true2DMode") === "true",
  );
  const [splitWidth, setSplitWidth] = useState(50); // percentage
  const splitContainerRef = useRef<HTMLDivElement>(null);

  const handleSplitMouseMove = (e: MouseEvent) => {
    if (!splitContainerRef.current) return;
    const rect = splitContainerRef.current.getBoundingClientRect();
    const newWidth = ((e.clientX - rect.left) / rect.width) * 100;
    setSplitWidth(Math.max(20, Math.min(80, newWidth)));
  };

  const handleSplitMouseUp = () => {
    window.removeEventListener("mousemove", handleSplitMouseMove);
    window.removeEventListener("mouseup", handleSplitMouseUp);
    document.body.style.cursor = "default";
  };

  const startResizing = () => {
    window.addEventListener("mousemove", handleSplitMouseMove);
    window.addEventListener("mouseup", handleSplitMouseUp);
    document.body.style.cursor = "col-resize";
  };

  const graphRef = useRef<GraphHandle>(null);
  const graph2DRef = useRef<Graph2DHandle>(null);

  // Open a saved record (or demo)
  const handleOpen = (record: GraphRecord) => {
    setGraphData(record.data);
    setOriginalGraphData(record.data);
    setCurrentId(record.id === "__demo__" ? undefined : record.id);
    setActivePage(null);
    setPageHistory([]);
    setHighlightPath([]);
    setSidebarOpen(false);
    setView("graph");
  };

  // Create a brand-new blank graph (open with default, unsaved)
  const handleCreate = () => {
    const newData = { title: "New Graph", nodes: [] };
    setGraphData(newData);
    setOriginalGraphData(newData);
    setCurrentId(undefined);
    setActivePage(null);
    setPageHistory([]);
    setHighlightPath([]);
    setSidebarOpen(true);
    setIsSplitMode(true);
    sessionStorage.setItem("splitMode", "true");
    setView("graph");
  };

  // Save current graph to library
  const handleSave = () => {
    let dataToSave = graphData;
    if (isTrue2D && graph2DRef.current) {
      dataToSave = graph2DRef.current.getFreshData();
    } else if (graphRef.current) {
      dataToSave = graphRef.current.getFreshData();
      // Preserve existing position2d from the current graphData
      const pos2dMap = new Map(
        graphData.nodes.map((n) => [n.id, n.position2d]),
      );
      dataToSave = {
        ...dataToSave,
        nodes: dataToSave.nodes.map((n) => ({
          ...n,
          position2d: pos2dMap.get(n.id) ?? n.position2d,
        })),
      };
    }
    const id = saveGraph(dataToSave, currentId);
    setCurrentId(id);
    setGraphData(dataToSave);
  };

  // When AI data generates a new graph — also auto-save it
  const handleGraphChange = (data: GraphData) => {
    setGraphData(data);
    setOriginalGraphData(data);
    // auto-save whenever graph data is replaced via paste
    if (sessionStorage.getItem("autoSave") !== "false") {
      const id = saveGraph(data, currentId);
      setCurrentId(id);
    }
  };

  /** Single centralized node selection — used by graph, PageView, Index, breadcrumb */
  const handleNodeSelect = (nodeId: string) => {
    const node = graphData.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    // Re-enable split mode if it was previously active
    if (sessionStorage.getItem("splitModeWasActive") === "true") {
      setIsSplitMode(true);
      sessionStorage.removeItem("splitModeWasActive");
    }

    // 1. Update PageView / active page
    setActivePage(node);

    // 2. Update breadcrumb history (trim if node already in path)
    setPageHistory((prev) => {
      const existingIndex = prev.findIndex((p) => p.id === nodeId);
      if (existingIndex !== -1) return prev.slice(0, existingIndex);
      if (activePage && activePage.id === nodeId) return prev;
      if (activePage) return [...prev, activePage];
      return prev;
    });

    // 3. Update path/highlight when Path Mode is on (immutable updates)
    if (isPathMode) {
      setHighlightPath((prev) => {
        const idx = prev.indexOf(nodeId);
        if (idx !== -1) {
          if (isPathAppendMode) {
            if (prev[prev.length - 1] === nodeId) return prev;
            return [...prev, nodeId];
          }
          return prev.slice(0, idx + 1);
        }
        return [...prev, nodeId];
      });
    }

    // 4. Camera behavior depends on active renderer.
    // In True2D, only lock mode should re-center; normal node open should not move camera.
    if (isTrue2D) {
      if (isLockEnabled) {
        setLockedToNodeId(nodeId);
        graph2DRef.current?.lockToNode(nodeId);
      }
      return;
    }

    // In 3D, preserve existing focus/lock behavior.
    if (isLockEnabled) {
      setLockedToNodeId(nodeId);
      graphRef.current?.lockToNode(nodeId);
    } else {
      graphRef.current?.focusToNode(nodeId);
    }
  };

  const handleClearPath = () => {
    setHighlightPath([]);
  };

  const handleTogglePathMode = () => {
    const next = !isPathMode;
    setIsPathMode(next);
    if (next && activePage) {
      setHighlightPath([...pageHistory.map((p) => p.id), activePage.id]);
    } else if (!next) {
      setHighlightPath([]);
    }
    sessionStorage.setItem("isPathMode", String(next));
  };

  const handleTogglePathAppendMode = () => {
    const next = !isPathAppendMode;
    setIsPathAppendMode(next);
    sessionStorage.setItem("pathAppendMode", String(next));
  };

  const handleTogglePathHideMode = () => {
    const next = !isPathHideMode;
    setIsPathHideMode(next);
    sessionStorage.setItem("isPathHideMode", String(next));
  };

  const handleLockCamera = (nodeId: string) => {
    setIsLockEnabled(true);
    sessionStorage.setItem("lockCamera", "true");
    setLockedToNodeId(nodeId);
    if (isTrue2D) {
      graph2DRef.current?.lockToNode(nodeId);
    } else {
      graphRef.current?.lockToNode(nodeId);
    }
  };

  const handleUnlockCamera = () => {
    setIsLockEnabled(false);
    sessionStorage.setItem("lockCamera", "false");
    setLockedToNodeId(null);
    if (isTrue2D) {
      graph2DRef.current?.unlockCamera();
    } else {
      graphRef.current?.unlockCamera();
    }
  };

  // Handle direct node updates from PageView or Double-Click inline editing
  const handleNodeUpdate = (updatedNode: NodeData) => {
    let currentData = graphData;
    if (graphRef.current) {
      currentData = graphRef.current.getFreshData();
    }
    const newNodes = currentData.nodes.map((n) =>
      n.id === updatedNode.id ? updatedNode : n,
    );
    const newData = { ...currentData, nodes: newNodes };
    setGraphData(newData);
    // Optional: save on every keystroke/blur might be heavy, but autosaving keeps it fresh:
    if (sessionStorage.getItem("autoSave") !== "false") {
      const id = saveGraph(newData, currentId);
      setCurrentId(id);
    }
    setActivePage(updatedNode);

    // Also update history if the active node is in there
    setPageHistory((prev) =>
      prev.map((p) => (p.id === updatedNode.id ? updatedNode : p)),
    );
  };

  const handleBackPage = () => {
    setPageHistory((prev) => {
      const newHistory = [...prev];
      const last = newHistory.pop();
      if (last) setActivePage(last);
      return newHistory;
    });
  };

  const handleJumpToHistory = (index: number) => {
    const target = pageHistory[index];
    if (target) handleNodeSelect(target.id);
  };

  const goHome = () => {
    // Auto-save the current graph (with live drag positions) before leaving the view.
    // This ensures that even without an explicit Save click, positions are preserved.
    if (sessionStorage.getItem("autoSave") !== "false") {
      let fresh = graphData;
      if (isTrue2D && graph2DRef.current) {
        fresh = graph2DRef.current.getFreshData();
      } else if (graphRef.current) {
        fresh = graphRef.current.getFreshData();
      }
      if (fresh.nodes.length > 0) {
        saveGraph(fresh, currentId);
        setGraphData(fresh);
      }
    }
    setActivePage(null);
    setPageHistory([]);
    setHighlightPath([]);
    setLockedToNodeId(null);
    graphRef.current?.unlockCamera();
    setSidebarOpen(false);
    setView("home");
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-bg">
      <AnimatePresence mode="wait">
        {view === "home" ? (
          <HomePage
            key="home"
            records={records}
            theme={theme}
            onOpen={handleOpen}
            onCreate={handleCreate}
            onDelete={deleteGraph}
            onRename={renameGraph}
            onToggleTheme={toggleTheme}
          />
        ) : (
          <div key="graph" className="absolute inset-0 overflow-hidden">
            <SearchBar 
              theme={theme}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              matchesCount={searchMatchedNodeIds.size}
              searchResults={searchResults}
              onResultClick={(nodeId) => handleNodeSelect(nodeId)}
              searchContent={searchContent}
              onSearchContentChange={setSearchContent}
              highlightNeighbours={highlightNeighbours}
              onHighlightNeighboursChange={setHighlightNeighbours}
            />
            {/* Graph area — fills the full container */}
            <div
              ref={splitContainerRef}
              className={`relative w-full h-full flex overflow-hidden ${uiAnimations ? "transition-all duration-300" : ""}`}
            >
              {isSplitMode && (
                <div
                  style={{ width: `${splitWidth}%` }}
                  className="relative h-full border-r border-border shrink-0 z-30 bg-bg"
                >
                  {activePage ? (
                    <PageView
                      node={activePage}
                      nodeMap={Object.fromEntries(
                        graphData.nodes.map((n) => [n.id, n]),
                      )}
                      onClose={() => {
                        setActivePage(null);
                        setPageHistory([]);
                        setIsSplitMode(false);
                        sessionStorage.setItem("splitModeWasActive", "true");
                      }}
                      onNodeSelect={handleNodeSelect}
                      onBack={handleBackPage}
                      canGoBack={pageHistory.length > 0}
                      isEditMode={isEditMode}
                      uiAnimations={uiAnimations}
                      history={pageHistory}
                      onJump={handleJumpToHistory}
                      graphTitle={graphData.title}
                      onUpdateNode={handleNodeUpdate}
                      isPathMode={isPathMode}
                      onTogglePathMode={handleTogglePathMode}
                      isPathAppendMode={isPathAppendMode}
                      onTogglePathAppendMode={handleTogglePathAppendMode}
                      highlightPath={highlightPath}
                      onClearPath={handleClearPath}
                      isCameraLocked={lockedToNodeId !== null}
                      lockedToNodeId={lockedToNodeId}
                      onLockCamera={handleLockCamera}
                      onUnlockCamera={handleUnlockCamera}
                      onNodeHover={setExternalHoverNodeId}
                      isPathHideMode={isPathHideMode}
                      onTogglePathHideMode={handleTogglePathHideMode}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full p-10 text-center animate-in fade-in zoom-in duration-500">
                      <div className="w-20 h-20 mb-8 rounded-3xl border border-dashed border-accent/20 flex items-center justify-center text-accent/30 bg-accent/5">
                        <svg
                          className="w-10 h-10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.2"
                        >
                          <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
                          <path d="M13 2v7h7" />
                          <circle cx="12" cy="15" r="3" />
                          <path d="M10 13l4 4" />
                        </svg>
                      </div>
                      <h3 className="text-base font-medium text-text mb-3 tracking-tight">
                        No Node Selected
                      </h3>
                      <p className="text-[11px] text-muted leading-relaxed max-w-[280px]">
                        Select any node in the graph to reveal its contents
                        here.
                      </p>
                    </div>
                  )}
                  <div
                    onMouseDown={startResizing}
                    className="absolute top-0 -right-1.5 w-3 h-full cursor-col-resize z-50 group pointer-events-auto"
                  >
                    <div className="w-px h-full bg-transparent group-hover:bg-accent/40 mx-auto transition-colors" />
                  </div>
                </div>
              )}

              <div className="flex-1 h-full relative min-w-0">
                {isTrue2D ? (
                  <True2DGraph
                    ref={graph2DRef}
                    graphData={graphData}
                    theme={theme}
                    onNodeSelect={handleNodeSelect}
                    activeNodeId={activePage?.id ?? null}
                    highlightPath={highlightPath}
                    onToggleSidebar={() => setSidebarOpen((o) => !o)}
                    onGraphChange={handleGraphChange}
                    isSplitMode={isSplitMode}
                    sidebarOpen={sidebarOpen}
                    isEditMode={isEditMode}
                    onToggleTheme={toggleTheme}
                    onToggleEditMode={() => setIsEditMode((o) => !o)}
                    uiAnimations={uiAnimations}
                    onToggleUiAnimations={() => {
                      setUiAnimations((p) => {
                        const n = !p;
                        sessionStorage.setItem("uiAnimations", String(n));
                        return n;
                      });
                    }}
                    onGoHome={goHome}
                    onSave={handleSave}
                    onRename={(title: string) => {
                      setGraphData((d) => ({ ...d, title }));
                    }}
                    onToggleSplitMode={() => {
                      const next = !isSplitMode;
                      setIsSplitMode(next);
                      sessionStorage.setItem("splitMode", String(next));
                      if (!next) sessionStorage.removeItem("splitModeWasActive");
                    }}
                    onToggleTrue2D={() => {
                      setIsTrue2D(false);
                      sessionStorage.setItem("true2DMode", "false");
                    }}
                    isPathMode={isPathMode}
                    isPathHideMode={isPathHideMode}
                    externalHoverNodeId={externalHoverNodeId}
                  />
                ) : (
                  <Graph3D
                    ref={graphRef}
                    graphData={graphData}
                    sidebarOpen={sidebarOpen}
                    isEditMode={isEditMode}
                    theme={theme}
                    onBeforeMutate={pushHistory}
                    onNodeSelect={handleNodeSelect}
                    onToggleSidebar={() => setSidebarOpen((o) => !o)}
                    onToggleTheme={toggleTheme}
                    onToggleEditMode={() => setIsEditMode((o) => !o)}
                    isSplitMode={isSplitMode}
                    onToggleSplitMode={() => {
                      const next = !isSplitMode;
                      setIsSplitMode(next);
                      sessionStorage.setItem("splitMode", String(next));
                      if (!next) sessionStorage.removeItem("splitModeWasActive");
                    }}
                    onToggleTrue2D={() => {
                      setIsTrue2D(true);
                      sessionStorage.setItem("true2DMode", "true");
                    }}
                    uiAnimations={uiAnimations}
                    onToggleUiAnimations={() => {
                      setUiAnimations((p) => {
                        const n = !p;
                        sessionStorage.setItem("uiAnimations", String(n));
                        return n;
                      });
                    }}
                    onGoHome={goHome}
                    onSave={handleSave}
                    onRename={(title: string) => {
                      setGraphData((d) => ({ ...d, title }));
                    }}
                    onNodeRename={(id: string, label: string) => {
                      let currentData = graphData;
                      if (graphRef.current) {
                        currentData = graphRef.current.getFreshData();
                      }
                      const newNodes = currentData.nodes.map((n) =>
                        n.id === id ? { ...n, label } : n,
                      );
                      const newData = { ...currentData, nodes: newNodes };
                      setGraphData(newData);
                      if (sessionStorage.getItem("autoSave") !== "false") {
                        const newId = saveGraph(newData, currentId);
                        setCurrentId(newId);
                      }
                    }}
                    isPathMode={isPathMode}
                    highlightSet={highlightSet}
                    highlightPath={highlightPath}
                    onLockChange={(id) => {
                      setLockedToNodeId(id);
                      setIsLockEnabled(id !== null);
                      sessionStorage.setItem("lockCamera", String(id !== null));
                    }}
                    activeNodeId={activePage?.id ?? null}
                    isPathHideMode={isPathHideMode}
                    externalHoverNodeId={externalHoverNodeId}
                  />
                )}

                {/* Sidebar — overlays the graph */}
                <Sidebar
                  open={sidebarOpen}
                  graphData={graphData}
                  originalGraphData={originalGraphData}
                  graphRef={graphRef}
                  onClose={() => setSidebarOpen(false)}
                  onGraphChange={handleGraphChange}
                  onSave={handleSave}
                  onGoHome={goHome}
                  uiAnimations={uiAnimations}
                  onToggleUiAnimations={() => {
                    setUiAnimations((p) => {
                      const n = !p;
                      sessionStorage.setItem("uiAnimations", String(n));
                      return n;
                    });
                  }}
                />

                {/* Page view overlay (Non-Split Mode) */}
                <AnimatePresence>
                  {!isSplitMode && activePage && (
                    <PageView
                      node={activePage}
                      nodeMap={Object.fromEntries(
                        graphData.nodes.map((n) => [n.id, n]),
                      )}
                      onClose={() => {
                        setActivePage(null);
                        setPageHistory([]);
                      }}
                      onNodeSelect={handleNodeSelect}
                      onBack={handleBackPage}
                      canGoBack={pageHistory.length > 0}
                      isEditMode={isEditMode}
                      uiAnimations={uiAnimations}
                      history={pageHistory}
                      onJump={handleJumpToHistory}
                      graphTitle={graphData.title}
                      onUpdateNode={handleNodeUpdate}
                      isPathMode={isPathMode}
                      onTogglePathMode={handleTogglePathMode}
                      isPathAppendMode={isPathAppendMode}
                      onTogglePathAppendMode={handleTogglePathAppendMode}
                      highlightPath={highlightPath}
                      onClearPath={handleClearPath}
                      isCameraLocked={lockedToNodeId !== null}
                      lockedToNodeId={lockedToNodeId}
                      onLockCamera={handleLockCamera}
                      onUnlockCamera={handleUnlockCamera}
                      onNodeHover={setExternalHoverNodeId}
                      isPathHideMode={isPathHideMode}
                      onTogglePathHideMode={handleTogglePathHideMode}
                    />
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
