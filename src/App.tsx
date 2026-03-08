import { useState, useRef } from 'react'
import { AnimatePresence } from 'framer-motion'
import Graph3D from './components/Graph3D'
import PageView from './components/PageView'
import Sidebar from './components/Sidebar'
import HomePage from './components/HomePage'
import { GraphData, NodeData, GraphRecord, GraphHandle } from './types/graph'
import { DEFAULT_GRAPH } from './data/defaultGraph'
import { useTheme } from './hooks/useTheme'
import { useGraphLibrary } from './hooks/useGraphLibrary'

type View = 'home' | 'graph'

export default function App() {
  const { theme, toggle: toggleTheme } = useTheme()
  const { records, saveGraph, deleteGraph, renameGraph } = useGraphLibrary()

  const [view, setView] = useState<View>('home')
  const [graphData, setGraphData]     = useState<GraphData>(DEFAULT_GRAPH)
  const [currentId, setCurrentId]     = useState<string | undefined>(undefined)
  const [activePage, setActivePage]   = useState<NodeData | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isEditMode, setIsEditMode]   = useState(false)

  const graphRef = useRef<GraphHandle>(null)

  // Open a saved record (or demo)
  const handleOpen = (record: GraphRecord) => {
    setGraphData(record.data)
    setCurrentId(record.id === '__demo__' ? undefined : record.id)
    setActivePage(null)
    setSidebarOpen(false)
    setView('graph')
  }

  // Create a brand-new blank graph (open with default, unsaved)
  const handleCreate = () => {
    setGraphData({ title: 'New Graph', nodes: [] })
    setCurrentId(undefined)
    setActivePage(null)
    setSidebarOpen(true)
    setView('graph')
  }

  // Save current graph to library
  const handleSave = () => {
    let dataToSave = graphData
    if (graphRef.current) {
      dataToSave = graphRef.current.getFreshData()
    }
    const id = saveGraph(dataToSave, currentId)
    setCurrentId(id)
  }

  // When AI data generates a new graph — also auto-save it
  const handleGraphChange = (data: GraphData) => {
    setGraphData(data)
    // auto-save whenever graph data is replaced via paste
    const id = saveGraph(data, currentId)
    setCurrentId(id)
  }

  // Handle direct node updates from PageView or Double-Click inline editing
  const handleNodeUpdate = (updatedNode: NodeData) => {
    let currentData = graphData
    if (graphRef.current) {
      currentData = graphRef.current.getFreshData()
    }
    const newNodes = currentData.nodes.map(n => n.id === updatedNode.id ? updatedNode : n)
    const newData = { ...currentData, nodes: newNodes }
    setGraphData(newData)
    // Optional: save on every keystroke/blur might be heavy, but autosaving keeps it fresh:
    const id = saveGraph(newData, currentId)
    setCurrentId(id)
    setActivePage(updatedNode)
  }

  const goHome = () => {
    setActivePage(null)
    setSidebarOpen(false)
    setView('home')
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-bg">
      <AnimatePresence mode="wait">
        {view === 'home' ? (
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
          <div key="graph" className="absolute inset-0 flex">
            {/* Graph area */}
            <div
              className="relative flex-1 transition-all duration-[350ms] ease-[cubic-bezier(.4,0,.2,1)]"
              style={{ marginRight: sidebarOpen ? 400 : 0 }}
            >
              <Graph3D
                ref={graphRef}
                graphData={graphData}
                sidebarOpen={sidebarOpen}
                isEditMode={isEditMode}
                theme={theme}
                onOpenPage={setActivePage}
                onToggleSidebar={() => setSidebarOpen(o => !o)}
                onToggleTheme={toggleTheme}
                onToggleEditMode={() => setIsEditMode(o => !o)}
                onGoHome={goHome}
                onSave={handleSave}
                onRename={(title: string) => {
                  setGraphData(d => ({ ...d, title }))
                }}
              />
            </div>

            {/* Sidebar */}
            <Sidebar
              open={sidebarOpen}
              graphData={graphData}
              graphRef={graphRef}
              onClose={() => setSidebarOpen(false)}
              onGraphChange={handleGraphChange}
              onSave={handleSave}
              onGoHome={goHome}
            />

            {/* Page view overlay */}
            <AnimatePresence>
              {activePage && (
                <PageView
                  node={activePage}
                  nodeMap={Object.fromEntries(graphData.nodes.map(n => [n.id, n]))}
                  onClose={() => setActivePage(null)}
                  onNavigate={setActivePage}
                  isEditMode={isEditMode}
                  onUpdateNode={handleNodeUpdate}
                />
              )}
            </AnimatePresence>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
