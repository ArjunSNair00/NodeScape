import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GraphRecord, GraphData } from '../types/graph'
import { DEFAULT_GRAPH } from '../data/defaultGraph'
import { Theme } from '../hooks/useTheme'

interface Props {
  records: GraphRecord[]
  theme: Theme
  onOpen: (record: GraphRecord) => void
  onCreate: () => void
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => void
  onToggleTheme: () => void
}

type SortMode = 'createdAt' | 'updatedAt' | 'name' | 'custom'

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// Mini preview of a graph — just coloured node dots in a rough force layout
function GraphPreview({ data }: { data: GraphData }) {
  const nodes = data.nodes.slice(0, 12)
  const w = 280, h = 140, cx = w / 2, cy = h / 2, r = 50

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="w-full h-full">
      {/* edges */}
      {nodes.map((n, i) => {
        const angle = (i / nodes.length) * Math.PI * 2
        const nx = cx + r * Math.cos(angle)
        const ny = cy + r * Math.sin(angle)
        return n.connections.slice(0, 2).map(cid => {
          const j = nodes.findIndex(nd => nd.id === cid)
          if (j < 0) return null
          const angle2 = (j / nodes.length) * Math.PI * 2
          return (
            <line
              key={`${n.id}-${cid}`}
              x1={nx} y1={ny}
              x2={cx + r * Math.cos(angle2)}
              y2={cy + r * Math.sin(angle2)}
              stroke={n.hex}
              strokeOpacity={0.25}
              strokeWidth={1}
            />
          )
        })
      })}
      {/* nodes */}
      {nodes.map((n, i) => {
        const angle = (i / nodes.length) * Math.PI * 2
        const nx = cx + r * Math.cos(angle)
        const ny = cy + r * Math.sin(angle)
        const isCore = n.category === 'core'
        return (
          <g key={n.id}>
            <circle cx={nx} cy={ny} r={isCore ? 7 : 4.5} fill={n.hex} opacity={0.9} />
            <circle cx={nx} cy={ny} r={isCore ? 13 : 9} fill={n.hex} opacity={0.12} />
          </g>
        )
      })}
    </svg>
  )
}

function GraphCard({
  record,
  onOpen,
  onDelete,
  onRename,
  isDraggable,
  onDragStart,
  onDragOver,
  onDrop,
  isDraggedOver,
}: {
  record: GraphRecord
  onOpen: () => void
  onDelete: () => void
  onRename: (t: string) => void
  isDraggable: boolean
  onDragStart: () => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: () => void
  isDraggedOver: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(record.title)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const commitRename = () => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== record.title) onRename(trimmed)
    setEditing(false)
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      draggable={isDraggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`group relative flex flex-col rounded-xl border bg-surface overflow-hidden cursor-pointer hover:border-border2 transition-all duration-200 hover:shadow-lg hover:shadow-black/20 ${
        isDraggedOver ? 'border-accent shadow-[0_0_0_2px_rgba(124,106,247,0.35)]' : 'border-border'
      }`}
      onClick={() => { if (!editing && !confirmDelete) onOpen() }}
    >
      {/* Drag handle — only shown in custom sort mode */}
      {isDraggable && (
        <div
          className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-150 cursor-grab active:cursor-grabbing p-1 rounded text-muted2 hover:text-accent"
          onMouseDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
          title="Drag to reorder"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="5.5" cy="4" r="1.2" />
            <circle cx="5.5" cy="8" r="1.2" />
            <circle cx="5.5" cy="12" r="1.2" />
            <circle cx="10.5" cy="4" r="1.2" />
            <circle cx="10.5" cy="8" r="1.2" />
            <circle cx="10.5" cy="12" r="1.2" />
          </svg>
        </div>
      )}

      {/* Preview */}
      <div className="relative h-36 bg-surface2 overflow-hidden flex items-center justify-center"
        style={{ background: 'radial-gradient(ellipse at center, rgba(124,106,247,0.06) 0%, transparent 70%)' }}>
        <GraphPreview data={record.data} />
        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          style={{ background: 'rgba(8,8,16,0.55)' }}>
          <span className="text-[11px] text-white tracking-widest font-medium px-4 py-1.5 rounded-full border border-white/20 bg-white/10 backdrop-blur-sm">
            Open Graph →
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-3.5 flex flex-col gap-1">
        {editing ? (
          <input
            autoFocus
            onClick={e => e.stopPropagation()}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditing(false) }}
            className="text-[12px] text-text font-medium bg-surface2 border border-accent rounded px-2 py-0.5 outline-none w-full"
            style={{ userSelect: 'text' }}
          />
        ) : (
          <h3 className="text-[12px] text-text font-medium truncate leading-snug">{record.title}</h3>
        )}
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-[10px] text-muted">{record.nodeCount} nodes · {timeAgo(record.updatedAt)}</span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150" onClick={e => e.stopPropagation()}>
            {/* Rename */}
            <button
              onClick={() => { setEditing(true); setDraft(record.title) }}
              className="p-1 rounded text-muted hover:text-accent transition-colors"
              title="Rename"
            >
              <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M8.5 1.5l2 2-7 7H1.5v-2l7-7z"/>
              </svg>
            </button>
            {/* Delete */}
            {confirmDelete ? (
              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                <button onClick={onDelete} className="text-[9px] text-red-400 border border-red-400/40 px-1.5 py-0.5 rounded hover:bg-red-400/10 transition-colors">del</button>
                <button onClick={() => setConfirmDelete(false)} className="text-[9px] text-muted border border-border px-1.5 py-0.5 rounded hover:bg-surface2 transition-colors">no</button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="p-1 rounded text-muted hover:text-red-400 transition-colors"
                title="Delete"
              >
                <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 3h8M5 3V2h2v1M4.5 9.5l-.5-5M7.5 9.5l.5-5" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

const ORDER_KEY = 'nodescape-card-order'

function getSavedOrder(): string[] {
  try { return JSON.parse(localStorage.getItem(ORDER_KEY) ?? '[]') } catch { return [] }
}

function saveOrder(ids: string[]) {
  localStorage.setItem(ORDER_KEY, JSON.stringify(ids))
}

function sortRecords(records: GraphRecord[], mode: SortMode, customOrder: string[]): GraphRecord[] {
  if (mode === 'custom') {
    const ordered: GraphRecord[] = []
    customOrder.forEach(id => { const r = records.find(r => r.id === id); if (r) ordered.push(r) })
    records.forEach(r => { if (!customOrder.includes(r.id)) ordered.push(r) })
    return ordered
  }
  const copy = [...records]
  if (mode === 'name') copy.sort((a, b) => a.title.localeCompare(b.title))
  else if (mode === 'updatedAt') copy.sort((a, b) => b.updatedAt - a.updatedAt)
  else copy.sort((a, b) => b.createdAt - a.createdAt) // createdAt default
  return copy
}

export default function HomePage({ records, theme, onOpen, onCreate, onDelete, onRename, onToggleTheme }: Props) {
  const isDark = theme === 'dark'
  const [showDocs, setShowDocs] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [sortMode, setSortMode] = useState<SortMode>('createdAt')
  const [customOrder, setCustomOrder] = useState<string[]>(() => getSavedOrder())
  const dragIdRef = useRef<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  // Sync custom order when records change (new record added etc.)
  useEffect(() => {
    const existing = getSavedOrder()
    const newIds = records.map(r => r.id).filter(id => !existing.includes(id))
    if (newIds.length > 0) {
      const merged = [...existing, ...newIds]
      setCustomOrder(merged)
      saveOrder(merged)
    }
  }, [records])

  const sorted = sortRecords(records, sortMode, customOrder)

  const handleDragStart = (id: string) => { dragIdRef.current = id }
  const handleDragOver = (e: React.DragEvent, overId: string) => {
    e.preventDefault()
    setDragOverId(overId)
  }
  const handleDrop = (targetId: string) => {
    const fromId = dragIdRef.current
    if (!fromId || fromId === targetId) { setDragOverId(null); return }

    // Build current ordered list of IDs
    const base = sortRecords(records, 'custom', customOrder).map(r => r.id)
    const fromIdx = base.indexOf(fromId)
    const toIdx = base.indexOf(targetId)
    if (fromIdx === -1 || toIdx === -1) { setDragOverId(null); return }

    const next = [...base]
    next.splice(fromIdx, 1)
    next.splice(toIdx, 0, fromId)
    setCustomOrder(next)
    saveOrder(next)
    dragIdRef.current = null
    setDragOverId(null)
  }

  const SORT_TABS: { id: SortMode; label: string }[] = [
    { id: 'createdAt', label: 'Created' },
    { id: 'updatedAt', label: 'Modified' },
    { id: 'name',      label: 'Name' },
    { id: 'custom',    label: 'Custom' },
  ]

  return (
    <motion.div
      key="home"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.25 }}
      className="absolute inset-0 flex flex-col overflow-hidden bg-bg"
    >
      {/* Top bar */}
      <div className="relative flex items-center px-8 py-5 border-b border-border flex-shrink-0"
        style={{ background: isDark ? 'rgba(8,8,16,0.96)' : 'rgba(244,244,251,0.96)' }}>

        {/* Left — traffic lights + title */}
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
          </div>
          <span className="text-[22px] font-semibold text-text tracking-wide leading-none">NodeScape</span>
          <span className="text-[10px] text-muted tracking-widest border border-border px-2 py-0.5 rounded-full">v1.1.0</span>
        </div>

        {/* Right — actions */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={onToggleTheme}
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-border2 text-muted2 hover:border-accent hover:text-accent hover:bg-accent/10 transition-all duration-200"
          >
            {isDark
              ? <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><path d="M8 12a4 4 0 100-8 4 4 0 000 8zm0-10a.75.75 0 000-1.5.75.75 0 000 1.5zm0 11a.75.75 0 000 1.5.75.75 0 000-1.5zM3.05 4.11a.75.75 0 10-1.06-1.06.75.75 0 001.06 1.06zm9.9 7.78a.75.75 0 10-1.06-1.06.75.75 0 001.06 1.06zM2 8a.75.75 0 00-1.5 0A.75.75 0 002 8zm13.5 0a.75.75 0 00-1.5 0 .75.75 0 001.5 0zM4.11 12.95a.75.75 0 10-1.06 1.06.75.75 0 001.06-1.06zm7.78-9.9a.75.75 0 10-1.06 1.06.75.75 0 001.06-1.06z"/></svg>
              : <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><path d="M6 .278a.768.768 0 01.08.858 7.208 7.208 0 00-.878 3.46c0 4.021 3.278 7.277 7.318 7.277.527 0 1.04-.055 1.533-.16a.787.787 0 01.81.316.733.733 0 01-.031.893A8.349 8.349 0 018.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.752.752 0 016 .278z"/></svg>
            }
          </button>
          <button
            onClick={onCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-[11px] tracking-widest font-medium hover:bg-[#6a58e8] transition-all duration-200 hover:-translate-y-px active:translate-y-0"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 2v10M2 7h10" strokeLinecap="round"/>
            </svg>
            New Graph
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-8 py-8">
        {records.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
              className="w-24 h-24 rounded-2xl border border-border bg-surface flex items-center justify-center text-5xl"
            >
              🕸️
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <p className="text-[15px] text-text font-medium mb-2">No graphs yet</p>
              <p className="text-[12px] text-muted max-w-xs leading-relaxed">
                Create your first knowledge graph or load the default Operating System demo.
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex gap-3"
            >
              <button
                onClick={onCreate}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white text-[11px] tracking-widest font-medium hover:bg-[#6a58e8] transition-all duration-200"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M7 2v10M2 7h10" strokeLinecap="round"/>
                </svg>
                Create New
              </button>
              <button
                onClick={() => onOpen({ id: '__demo__', title: DEFAULT_GRAPH.title, nodeCount: DEFAULT_GRAPH.nodes.length, createdAt: Date.now(), updatedAt: Date.now(), data: DEFAULT_GRAPH })}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border text-muted2 text-[11px] tracking-widest hover:border-accent hover:text-accent hover:bg-accent/10 transition-all duration-200"
              >
                Load Demo
              </button>
            </motion.div>
          </div>
        ) : (
          <>
            {/* Toolbar: count + sort controls */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[11px] text-muted tracking-widest uppercase">Your Graphs · {records.length}</h2>

              {/* Sort pills */}
              <div className="flex items-center gap-1 p-1 rounded-lg border border-border bg-surface">
                {SORT_TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setSortMode(tab.id)}
                    className={`px-3 py-1 rounded-md text-[10px] tracking-widest transition-all duration-150 ${
                      sortMode === tab.id
                        ? 'bg-accent text-white shadow-sm'
                        : 'text-muted2 hover:text-text'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {sortMode === 'custom' && (
              <p className="text-[10px] text-muted tracking-wide mb-4 -mt-2">
                Hover a card and drag the ⠿ handle to reorder
              </p>
            )}

            <motion.div layout className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
              <AnimatePresence mode="popLayout">
                {sorted.map(r => (
                  <GraphCard
                    key={r.id}
                    record={r}
                    onOpen={() => onOpen(r)}
                    onDelete={() => onDelete(r.id)}
                    onRename={title => onRename(r.id, title)}
                    isDraggable={sortMode === 'custom'}
                    onDragStart={() => handleDragStart(r.id)}
                    onDragOver={e => handleDragOver(e, r.id)}
                    onDrop={() => handleDrop(r.id)}
                    isDraggedOver={dragOverId === r.id && dragIdRef.current !== r.id}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-8 py-4 border-t border-border flex justify-center gap-6 flex-shrink-0"
           style={{ background: isDark ? 'rgba(8,8,16,0.96)' : 'rgba(244,244,251,0.96)' }}>
        <button
          onClick={() => { setShowDocs(!showDocs); setShowAbout(false); }}
          className="text-[11px] text-muted tracking-widest uppercase hover:text-accent transition-colors"
        >
          {showDocs ? 'Hide Documentation' : 'View Documentation'}
        </button>
        <button
          onClick={() => { setShowAbout(!showAbout); setShowDocs(false); }}
          className="text-[11px] text-muted tracking-widest uppercase hover:text-accent transition-colors"
        >
          {showAbout ? 'Hide About' : 'About'}
        </button>
      </div>

      {/* Documentation Overlay */}
      <AnimatePresence>
        {showDocs && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="absolute bottom-16 left-8 right-8 top-24 bg-surface border border-border rounded-xl shadow-2xl p-8 overflow-y-auto z-50 text-text"
          >
            <button
              onClick={() => setShowDocs(false)}
              className="absolute top-4 right-4 p-2 text-muted hover:text-text transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <h2 className="text-xl font-medium mb-6">How to Use NodeScape</h2>
            
            <div className="space-y-6 text-sm leading-relaxed max-w-3xl">
              <section>
                <h3 className="text-accent font-medium text-base mb-2">1. Creating a New Graph</h3>
                <p className="text-muted2">
                  Click 'New Graph' to start with an empty canvas. The AI Data sidebar will open automatically.
                </p>
              </section>

              <section>
                <h3 className="text-accent font-medium text-base mb-2">2. Using the AI Data Sidebar</h3>
                <p className="text-muted2">
                  The quickest way to build a graph is by pasting JSON data. You can copy the provided "AI Prompt" from the sidebar and paste it into ChatGPT, Claude, or any LLM of your choice.
                  Once the AI generates the JSON, paste it entirely into the "Paste JSON" tab. The graph will instantly render!
                </p>
              </section>

              <section>
                <h3 className="text-accent font-medium text-base mb-2">3. Manual Editing</h3>
                <p className="text-muted2">
                  In the AI Data sidebar, use the "Data Editor" tab to manually edit the raw JSON of your graph at any time. Click "Apply Changes" to see your updates.
                </p>
              </section>

              <section>
                <h3 className="text-accent font-medium text-base mb-2">4. Navigating the 3D Space</h3>
                <ul className="list-disc pl-5 mt-2 text-muted2 space-y-1">
                  <li><strong>Left Click + Drag:</strong> Rotate the camera around the graph.</li>
                  <li><strong>Right Click + Drag</strong> or <strong>Shift + Drag:</strong> Pan the camera position.</li>
                  <li><strong>Scroll Wheel / Pinch:</strong> Zoom in and out.</li>
                  <li><strong>Click a Node:</strong> Open the detailed page view for that node.</li>
                  <li><strong>Long Press / Drag Node:</strong> Manually position a node in 3D space.</li>
                </ul>
              </section>
              
              <section>
                <h3 className="text-accent font-medium text-base mb-2">5. Renaming</h3>
                <p className="text-muted2">
                  You can rename your graph from the Home Page by hovering over a graph card and clicking the edit icon. You can also rename a graph while viewing it by clicking its title in the top left corner.
                </p>
              </section>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* About Overlay */}
      <AnimatePresence>
        {showAbout && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="absolute bottom-16 left-8 right-8 top-24 bg-surface border border-border rounded-xl shadow-2xl p-8 overflow-y-auto z-50 text-text"
          >
            <button
              onClick={() => setShowAbout(false)}
              className="absolute top-4 right-4 p-2 text-muted hover:text-text transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <h2 className="text-xl font-medium mb-2">About NodeScape</h2>
            <p className="text-accent text-sm font-medium tracking-wide mb-8 uppercase">Explore a subject like a galaxy</p>
            
            <div className="space-y-6 text-sm leading-relaxed max-w-3xl">
              <section>
                <h3 className="text-muted font-medium text-xs tracking-widest uppercase mb-2">Creator</h3>
                <p className="text-text">
                 <strong>Arjun S Nair</strong>
                </p>
              </section>

              <section>
                <h3 className="text-muted font-medium text-xs tracking-widest uppercase mb-2">What is NodeScape?</h3>
                <p className="text-muted2">
                  NodeScape is a fast, visually stunning 3D knowledge graph visualizer and editor. It allows you to paste structured data directly from AI models, rendering it immediately into a beautiful, interactive 3D web of linked concepts. It functions as a dynamic library for visualizing related ideas and subjects.
                </p>
              </section>

              <section>
                <h3 className="text-muted font-medium text-xs tracking-widest uppercase mb-2">Tech Stack</h3>
                <ul className="list-disc pl-5 mt-2 text-muted2 space-y-1">
                  <li><strong>React &amp; TypeScript</strong> for a robust UI and frontend state management.</li>
                  <li><strong>Three.js</strong> for performant WebGL 3D rendering.</li>
                  <li><strong>d3-force-3d</strong> to smoothly calculate and simulate force-directed layouts.</li>
                  <li><strong>Framer Motion</strong> for fluid page and component animations.</li>
                  <li><strong>Tailwind CSS</strong> for rapid UI styling and theme support.</li>
                </ul>
              </section>

              <section>
                <h3 className="text-muted font-medium text-xs tracking-widest uppercase mb-2">Future Plans</h3>
                <ul className="list-disc pl-5 mt-2 text-muted2 space-y-1">
                  <li><strong>Local &amp; Cloud AI Generation:</strong> Integrating an embedded <strong>Ollama model</strong> to generate custom 3D knowledge nodes completely on the fly using local AI. We also plan to support connecting directly to <strong>Cloud AI APIs</strong> (like OpenAI, Anthropic, etc.) for generation without manual copy-pasting.</li>
                  <li><strong>Document Knowledge Extraction:</strong> Ability to upload PDFs, images, and other document types directly into NodeScape. The system will automatically process these files, extract deeply nested knowledge, and instantly generate the corresponding nodes and edges to visualize the document's concepts.</li>
                </ul>
              </section>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
