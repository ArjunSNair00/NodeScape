import { useState, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import Graph3D from "./components/Graph3D";
import PageView from "./components/PageView";
import Sidebar from "./components/Sidebar";
import HomePage from "./components/HomePage";
import { GraphData, NodeData, GraphRecord, GraphHandle } from "./types/graph";
import { DEFAULT_GRAPH } from "./data/defaultGraph";
import { useTheme } from "./hooks/useTheme";
import { useGraphLibrary } from "./hooks/useGraphLibrary";

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
  const [isSplitMode, setIsSplitMode] = useState(false);
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

  // Open a saved record (or demo)
  const handleOpen = (record: GraphRecord) => {
    setGraphData(record.data);
    setOriginalGraphData(record.data);
    setCurrentId(record.id === "__demo__" ? undefined : record.id);
    setActivePage(null);
    setPageHistory([]);
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
    setSidebarOpen(true);
    setView("graph");
  };

  // Save current graph to library
  const handleSave = () => {
    let dataToSave = graphData;
    if (graphRef.current) {
      dataToSave = graphRef.current.getFreshData();
    }
    const id = saveGraph(dataToSave, currentId);
    setCurrentId(id);
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

  const handleNavigatePage = (node: NodeData) => {
    if (activePage) setPageHistory((prev) => [...prev, activePage]);
    setActivePage(node);
  };

  const handleBackPage = () => {
    setPageHistory((prev) => {
      const newHistory = [...prev];
      const last = newHistory.pop();
      if (last) setActivePage(last);
      return newHistory;
    });
  };

  const goHome = () => {
    // Auto-save the current graph (with live drag positions) before leaving the view.
    // This ensures that even without an explicit Save click, positions are preserved.
    if (sessionStorage.getItem("autoSave") !== "false") {
      if (graphRef.current) {
        const fresh = graphRef.current.getFreshData();
        if (fresh.nodes.length > 0) {
          saveGraph(fresh, currentId);
        }
      }
    }
    setActivePage(null);
    setPageHistory([]);
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
            {/* Graph area — fills the full container */}
            <div ref={splitContainerRef} className="relative w-full h-full flex overflow-hidden">
              {isSplitMode && activePage && (
                <div 
                  style={{ width: `${splitWidth}%` }}
                  className="relative h-full border-r border-border shrink-0 z-30"
                >
                  <PageView
                    node={activePage}
                    nodeMap={Object.fromEntries(
                      graphData.nodes.map((n) => [n.id, n]),
                    )}
                    onClose={() => {
                      setActivePage(null);
                      setPageHistory([]);
                    }}
                    onNavigate={handleNavigatePage}
                    onBack={handleBackPage}
                    canGoBack={pageHistory.length > 0}
                    isEditMode={isEditMode}
                    onUpdateNode={handleNodeUpdate}
                  />
                  <div 
                    onMouseDown={startResizing}
                    className="absolute top-0 -right-1.5 w-3 h-full cursor-col-resize z-50 group pointer-events-auto"
                  >
                    <div className="w-px h-full bg-transparent group-hover:bg-accent/40 mx-auto transition-colors" />
                  </div>
                </div>
              )}
              
              <div className="flex-1 h-full relative min-w-0">
                <Graph3D
                  ref={graphRef}
                  graphData={graphData}
                  sidebarOpen={sidebarOpen}
                  isEditMode={isEditMode}
                  theme={theme}
                  onOpenPage={(node) => {
                    setPageHistory([]); // clear history when opening directly from 3D space
                    setActivePage(node);
                  }}
                  onToggleSidebar={() => setSidebarOpen((o) => !o)}
                  onToggleTheme={toggleTheme}
                  onToggleEditMode={() => setIsEditMode((o) => !o)}
                  isSplitMode={isSplitMode}
                  onToggleSplitMode={() => setIsSplitMode(!isSplitMode)}
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
                />

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
                      onNavigate={handleNavigatePage}
                      onBack={handleBackPage}
                      canGoBack={pageHistory.length > 0}
                      isEditMode={isEditMode}
                      onUpdateNode={handleNodeUpdate}
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
