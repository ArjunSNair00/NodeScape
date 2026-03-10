import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GraphData, GraphHandle } from '../types/graph'
import { AI_PROMPT, EXAMPLE_TOPICS } from '../data/defaultGraph'
import { parseGraphJSON } from '../lib/validateGraph'

interface Props {
  open: boolean
  graphData: GraphData
  originalGraphData?: GraphData
  graphRef: React.RefObject<GraphHandle | null>
  onClose: () => void
  onGraphChange: (data: GraphData) => void
  onSave: () => void
  onGoHome: () => void
}

type Tab = 'ai' | 'prompt' | 'paste' | 'editor' | 'controls' | 'info'

const TABS: { id: Tab; label: string }[] = [
  { id: 'ai',       label: '✦ AI'     },
  { id: 'prompt',   label: 'PROMPT'   },
  { id: 'paste',    label: 'PASTE'    },
  { id: 'editor',   label: 'EDITOR'   },
  { id: 'controls', label: 'CONTROLS' },
  { id: 'info',     label: 'INFO'     },
]

export default function Sidebar({ open, graphData, originalGraphData, graphRef, onClose, onGraphChange, onSave, onGoHome }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('ai')
  const [copied, setCopied] = useState(false)
  const [jsonInput, setJsonInput] = useState(JSON.stringify(graphData, null, 2))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setJsonInput(JSON.stringify(graphData, null, 2))
  }, [graphData])

  const linkCount = (() => {
    const seen = new Set<string>()
    graphData.nodes.forEach(n => n.connections.forEach(cid => seen.add([n.id, cid].sort().join('-'))))
    return seen.size
  })()

  const handleCopyPrompt = async () => {
    await navigator.clipboard.writeText(AI_PROMPT)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleGenerate = () => {
    setError(null)
    const { data, error: err } = parseGraphJSON(jsonInput)
    if (err) { setError(err); return }
    if (data) { onGraphChange(data); setActiveTab('info') }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="sidebar"
          initial={{ x: 400 }}
          animate={{ x: 0 }}
          exit={{ x: 400 }}
          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          className="absolute top-0 right-0 bottom-0 w-[400px] flex flex-col z-50 border-l border-border"
          style={{ background: 'var(--surface)' }}
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border flex-shrink-0">
            <span className="text-xs text-text tracking-widest font-medium flex-1">⚡ Studio</span>
            {/* Save button */}
            <button
              onClick={() => { onSave(); graphRef.current?.triggerSaveToast(); }}
              className="flex items-center gap-1.5 text-[10px] text-muted2 tracking-widest px-2.5 py-1.5 rounded border border-border2 hover:border-accent hover:text-accent hover:bg-accent/10 transition-all duration-200"
            >
              <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 2h6l2 2v6a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z"/>
                <path d="M4 2v3h4V2M4 7h4"/>
              </svg>
              Save
            </button>
            {/* Home button */}
            <button
              onClick={onGoHome}
              className="flex items-center gap-1.5 text-[10px] text-muted2 tracking-widest px-2.5 py-1.5 rounded border border-border2 hover:border-accent hover:text-accent hover:bg-accent/10 transition-all duration-200"
            >
              <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M1 6l5-4 5 4M2 5.5V10h3V7h2v3h3V5.5"/>
              </svg>
              Home
            </button>
            <button onClick={onClose} className="text-muted hover:text-text transition-colors text-sm leading-none px-1">✕</button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border flex-shrink-0">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2.5 text-[9px] tracking-widest transition-all duration-200 border-b-2 -mb-px ${
                  activeTab === tab.id ? 'text-accent border-accent' : 'text-muted border-transparent hover:text-muted2'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Body */}
          <div className={`flex-1 overflow-x-hidden ${activeTab === 'ai' ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'}`}>
            {activeTab === 'ai'      && <AiChatTab onGraphChange={onGraphChange} />}
            {activeTab === 'prompt'   && <PromptTab copied={copied} onCopy={handleCopyPrompt} />}
            {activeTab === 'paste'    && <PasteTab value={jsonInput} onChange={setJsonInput} error={error} onGenerate={handleGenerate} />}
            {activeTab === 'editor'   && <DataEditTab graphData={graphData} onGraphChange={onGraphChange} />}
            {activeTab === 'controls' && <ControlsTab graphRef={graphRef} originalGraphData={originalGraphData} />}
            {activeTab === 'info'     && <InfoTab graphData={graphData} linkCount={linkCount} />}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Controls Tab ──────────────────────────────────────────────────────────────
function ControlsTab({ graphRef, originalGraphData }: { graphRef: React.RefObject<GraphHandle | null>, originalGraphData?: GraphData }) {
  const [jiggling, setJiggling] = useState(false)
  const [physicsOffWarning, setPhysicsOffWarning] = useState(false)
  const [labelLevel, setLabelLevel] = useState(() => Number(sessionStorage.getItem('labelLevel') || 5)) // 1–9, 5 = default (×1.0)
  const [drawLevel, setDrawLevel] = useState(() => Number(sessionStorage.getItem('drawLevel') || 5)) // 1-9, 5 = default
  const [idleRotate, setIdleRotate] = useState(() => sessionStorage.getItem('idleRotate') !== 'false')
  const [edgeHover, setEdgeHover] = useState(() => sessionStorage.getItem('edgeHover') === 'true')
  const [continuousPhysics, setContinuousPhysics] = useState(() => sessionStorage.getItem('continuousPhysics') !== 'false')
  const [edgeDrag, setEdgeDrag] = useState(() => sessionStorage.getItem('edgeDrag') === 'true')
  const [showNodeIcons, setShowNodeIcons] = useState(() => sessionStorage.getItem('showNodeIcons') !== 'false')
  const [lockCamera, setLockCamera] = useState(() => sessionStorage.getItem('lockCamera') !== 'false')

  const [resetPositions, setResetPositions] = useState(true)
  const [resetColors, setResetColors] = useState(true)

  useEffect(() => {
    sessionStorage.setItem('labelLevel', labelLevel.toString())
    sessionStorage.setItem('drawLevel', drawLevel.toString())
    sessionStorage.setItem('idleRotate', idleRotate.toString())
    sessionStorage.setItem('edgeHover', edgeHover.toString())
    sessionStorage.setItem('continuousPhysics', continuousPhysics.toString())
    sessionStorage.setItem('edgeDrag', edgeDrag.toString())
    sessionStorage.setItem('showNodeIcons', showNodeIcons.toString())
    sessionStorage.setItem('lockCamera', lockCamera.toString())
  }, [labelLevel, drawLevel, idleRotate, edgeHover, continuousPhysics, edgeDrag, showNodeIcons, lockCamera])

  const g = () => graphRef.current

  const handleJiggle = () => {
    // If physics is off, show a warning instead of jigging
    if (!g()?.isContinuousPhysicsEnabled()) {
      setPhysicsOffWarning(true)
      setTimeout(() => setPhysicsOffWarning(false), 2500)
      return
    }
    g()?.jiggle()
    setJiggling(true)
    setTimeout(() => setJiggling(false), 1200)
  }

  const handleReset = () => {
    if (g() && originalGraphData) {
      g()?.resetGraph({ positions: resetPositions, colors: resetColors }, originalGraphData)
    }
  }

  const changeLabel = (delta: number) => {
    const next = Math.max(1, Math.min(9, labelLevel + delta))
    setLabelLevel(next)
    // Map 1-9 to 0.3-2.2 multiplier range
    const mult = 0.3 + ((next - 1) / 8) * 1.9
    // We store absolute, so compute delta from current
    const currentMult = 0.3 + ((labelLevel - 1) / 8) * 1.9
    g()?.setLabelScale(mult - currentMult)
  }

  const changeDrawDistance = (delta: number) => {
    const next = Math.max(1, Math.min(9, drawLevel + delta))
    setDrawLevel(next)
    const density = 0.003 - ((next - 1) / 8) * 0.003
    g()?.setFogDensity(density)
  }

  const BtnRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <span className="text-[11px] text-muted2">{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )

  const ActionBtn = ({ onClick, children, active, wide, disabled }: { onClick: () => void; children: React.ReactNode; active?: boolean; wide?: boolean; disabled?: boolean }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-1.5 text-[10px] tracking-widest border rounded-lg transition-all duration-200 active:scale-95 ${wide ? 'px-4 py-2' : 'w-9 h-9'} ${
        disabled
          ? 'opacity-50 cursor-not-allowed border-border2 text-muted2'
          : active
            ? 'border-accent text-accent bg-accent/15'
            : 'border-border2 text-muted2 hover:border-accent hover:text-accent hover:bg-accent/10'
      }`}
    >
      {children}
    </button>
  )

  return (
    <div className="p-5 space-y-1">
      <p className="text-[10px] text-muted tracking-widest uppercase mb-4">Graph Controls</p>

      <BtnRow label="Jiggle graph">
        <ActionBtn onClick={handleJiggle} wide active={jiggling}>
          <span className={jiggling ? 'animate-spin inline-block' : ''}>✦</span>
          {jiggling ? 'Jiggling…' : 'Jiggle!'}
        </ActionBtn>
      </BtnRow>

      {/* Physics-off warning */}
      {physicsOffWarning && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#f87171]/10 border border-[#f87171]/30 text-[#f87171] text-[10px] tracking-wide -mt-1 mb-1 animate-pulse">
          <span>⚡</span>
          <span>Enable Physics first to use Jiggle</span>
        </div>
      )}

      <BtnRow label="Reset graph">
        <div className="flex flex-col gap-2 w-full">
          <div className="flex items-center gap-4 px-1">
            <label className="flex items-center gap-1.5 text-[10px] text-muted2 cursor-pointer hover:text-text transition-colors">
              <input type="checkbox" checked={resetPositions} onChange={e => setResetPositions(e.target.checked)} className="accent-accent" />
              Positions
            </label>
            <label className="flex items-center gap-1.5 text-[10px] text-muted2 cursor-pointer hover:text-text transition-colors">
              <input type="checkbox" checked={resetColors} onChange={e => setResetColors(e.target.checked)} className="accent-accent" />
              Colors
            </label>
          </div>
          <ActionBtn onClick={handleReset} wide disabled={!originalGraphData || (!resetPositions && !resetColors)}>
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2.5 6a3.5 3.5 0 111.025 2.475M2.5 6V3.5M2.5 6h2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Reset to Original
          </ActionBtn>
        </div>
      </BtnRow>

      <BtnRow label="Randomize positions">
        <ActionBtn onClick={() => g()?.randomizePositions()} wide>
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M1 4h2l1-2 2 6 2-4 1 2h2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M8.5 9.5l1.5-1.5-1.5-1.5M10 8H8" strokeLinecap="round"/>
          </svg>
          Scatter
        </ActionBtn>
      </BtnRow>

      <BtnRow label="Idle Rotation">
        <ActionBtn onClick={() => setIdleRotate(g()?.toggleAutoRotate() ?? false)} wide active={idleRotate}>
          <svg className={`w-3 h-3 ${idleRotate ? 'animate-[spin_4s_linear_infinite]' : ''}`} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M6 1C3.24 1 1 3.24 1 6s2.24 5 5 5 5-2.24 5-5M8.5 2L11 3.5 8.5 5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {idleRotate ? 'ON' : 'OFF'}
        </ActionBtn>
      </BtnRow>

      <BtnRow label="Edge Hover Select">
        <ActionBtn onClick={() => setEdgeHover(g()?.toggleEdgeHover() ?? false)} wide active={edgeHover}>
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2.5 9.5l7-7" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="2.5" cy="9.5" r="1.5" />
            <circle cx="9.5" cy="2.5" r="1.5" />
          </svg>
          {edgeHover ? 'ON' : 'OFF'}
        </ActionBtn>
      </BtnRow>

      <BtnRow label="Edge Dragging">
        <ActionBtn onClick={() => setEdgeDrag(g()?.toggleEdgeDrag() ?? false)} wide active={edgeDrag}>
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M1 6 L11 6" strokeLinecap="round"/>
            <path d="M9 4l2 2-2 2M3 8L1 6l2-2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {edgeDrag ? 'ON' : 'OFF'}
        </ActionBtn>
      </BtnRow>

      <BtnRow label="Physics">
        <ActionBtn onClick={() => setContinuousPhysics(g()?.toggleContinuousPhysics() ?? false)} wide active={continuousPhysics}>
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 10s1.5-3 4-3 4 3 4 3M2 6s2-3 4-3 4 3 4 3" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="6" cy="3" r="1.5" />
            <circle cx="2" cy="10" r="1" />
            <circle cx="10" cy="10" r="1" />
          </svg>
          {continuousPhysics ? 'ON' : 'OFF'}
        </ActionBtn>
      </BtnRow>

      <BtnRow label="Randomize colours">
        <ActionBtn onClick={() => g()?.randomizeColors()} wide>
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="4" cy="4" r="2"/>
            <circle cx="8" cy="4" r="2"/>
            <circle cx="6" cy="8" r="2"/>
          </svg>
          Recolour
        </ActionBtn>
      </BtnRow>

      <BtnRow label={`Label size · ${labelLevel}/9`}>
        <ActionBtn onClick={() => changeLabel(-1)}>
          <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 7h8" strokeLinecap="round"/>
          </svg>
        </ActionBtn>
        {/* Visual scale indicator */}
        <div className="flex items-end gap-0.5 h-5 w-12">
          {Array.from({ length: 9 }, (_, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm transition-all duration-150"
              style={{
                height: `${25 + i * 8}%`,
                background: i < labelLevel ? 'var(--accent)' : 'var(--border2)',
                opacity: i < labelLevel ? 1 : 0.5,
              }}
            />
          ))}
        </div>
        <ActionBtn onClick={() => changeLabel(1)}>
          <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M7 3v8M3 7h8" strokeLinecap="round"/>
          </svg>
        </ActionBtn>
      </BtnRow>

      <BtnRow label={`Draw distance · ${drawLevel}/9`}>
        <ActionBtn onClick={() => changeDrawDistance(-1)}>
          <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 7h8" strokeLinecap="round"/>
          </svg>
        </ActionBtn>
        <div className="flex items-end gap-0.5 h-5 w-12">
          {Array.from({ length: 9 }, (_, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm transition-all duration-150"
              style={{
                height: `${25 + i * 8}%`,
                background: i < drawLevel ? 'var(--accent)' : 'var(--border2)',
                opacity: i < drawLevel ? 1 : 0.5,
              }}
            />
          ))}
        </div>
        <ActionBtn onClick={() => changeDrawDistance(1)}>
          <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M7 3v8M3 7h8" strokeLinecap="round"/>
          </svg>
        </ActionBtn>
      </BtnRow>

      <BtnRow label="Show Node Icons">
        <ActionBtn onClick={() => setShowNodeIcons(g()?.toggleNodeIcons() ?? true)} wide active={showNodeIcons}>
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M6 10s3-2.5 3-5a3 3 0 10-6 0c0 2.5 3 5 3 5z" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="6" cy="5" r="1" />
          </svg>
          {showNodeIcons ? 'ON' : 'OFF'}
        </ActionBtn>
      </BtnRow>

      <BtnRow label="Lock Camera (Right-click)">
        <ActionBtn onClick={() => setLockCamera(g()?.toggleLockCamera() ?? false)} wide active={lockCamera}>
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 1L1 1V4 M11 1L8 1 M11 1V4 M1 11L1 8 M1 11H4 M11 11L11 8 M11 11H8" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="6" cy="6" r="1.5" />
          </svg>
          {lockCamera ? 'ON' : 'OFF'}
        </ActionBtn>
      </BtnRow>

      <div className="mt-4 px-1 pb-4">
        <p className="text-[10px] text-muted2 leading-relaxed text-center">
          When Lock Camera is enabled, right-click a node to smoothly lock your view to it. Pan to break lock.
        </p>
      </div>

      <div className="mt-6 pt-4 border-t border-border">
        <p className="text-[10px] text-muted tracking-widest uppercase mb-3">Keyboard shortcuts</p>
        {[
          ['Arrow keys', 'Pan camera'],
          ['Shift + Arrow', 'Rotate camera'],
          ['Shift + drag', 'Pan camera'],
          ['Right drag', 'Pan camera'],
          ['Middle drag', 'Zoom camera'],
          ['Scroll', 'Zoom'],
        ].map(([key, desc]) => (
          <div key={key} className="flex justify-between items-center py-1.5 border-b border-border last:border-0">
            <span className="text-[10px] font-mono text-accent2 bg-accent2/10 px-1.5 py-0.5 rounded">{key}</span>
            <span className="text-[11px] text-muted2">{desc}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Prompt Tab ────────────────────────────────────────────────────────────────
function PromptTab({ copied, onCopy }: { copied: boolean; onCopy: () => void }) {
  return (
    <div className="p-5">
      <p className="text-[10px] text-muted tracking-widest uppercase mb-2.5">Copy this prompt</p>
      <p className="text-[11px] text-muted2 leading-relaxed mb-4">
        Use with Claude, ChatGPT, Gemini — any AI. Swap the topic at the end.
      </p>
      <pre className="bg-surface2 border border-border2 rounded-lg p-3.5 text-[10.5px] text-muted2 leading-relaxed font-mono whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
        {AI_PROMPT}
      </pre>
      <button
        onClick={onCopy}
        className={`mt-2.5 w-full flex items-center justify-center gap-1.5 text-[10px] tracking-widest py-2 rounded-md border transition-all duration-200 ${
          copied ? 'border-[#4ade80] text-[#4ade80]' : 'border-border2 text-muted2 hover:border-accent hover:text-accent hover:bg-accent/10'
        }`}
      >
        {copied ? '✓ Copied!' : 'Copy Prompt'}
      </button>
      <div className="h-px bg-border my-5" />
      <p className="text-[10px] text-muted tracking-widest uppercase mb-3">Example topics</p>
      <div className="flex flex-wrap gap-1.5">
        {EXAMPLE_TOPICS.map(topic => (
          <span key={topic} className="text-[10px] text-muted2 bg-surface2 border border-border px-2.5 py-1 rounded-full">{topic}</span>
        ))}
      </div>
    </div>
  )
}

// ── Paste Tab ─────────────────────────────────────────────────────────────────
function PasteTab({ value, onChange, error, onGenerate }: {
  value: string; onChange: (v: string) => void; error: string | null; onGenerate: () => void
}) {
  return (
    <div className="p-5">
      <p className="text-[10px] text-muted tracking-widest uppercase mb-2">Paste AI output here</p>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={'Paste the JSON from Claude / ChatGPT here...\n\n{\n  "title": "...",\n  "nodes": [...]\n}'}
        className="w-full min-h-[220px] resize-y bg-surface2 border border-border2 rounded-lg text-[11px] text-text font-mono leading-relaxed p-3.5 outline-none transition-colors placeholder-muted focus:border-accent"
        style={{ userSelect: 'text' }}
      />
      {error && <p className="text-[10px] text-[#f87171] mt-2 leading-relaxed whitespace-pre-wrap">{error}</p>}
      <button
        onClick={onGenerate}
        className="mt-3 w-full py-2.5 bg-accent text-white text-[11px] tracking-widest font-medium rounded-lg hover:bg-[#6a58e8] transition-all duration-200 hover:-translate-y-px active:translate-y-0"
      >
        ✦ Generate Graph
      </button>
      <div className="mt-4 bg-surface2 border border-border rounded-lg p-3.5 text-[10px] text-muted2 leading-[1.8]">
        <strong className="text-text block mb-1.5">Expected shape</strong>
        Each node needs:{' '}
        {['id', 'label', 'icon', 'hex', 'category', 'content', 'connections[]'].map(f => (
          <code key={f} className="text-accent2 bg-accent2/10 px-1 py-0.5 rounded mx-0.5">{f}</code>
        ))}
      </div>
    </div>
  )
}

// ── Info Tab ──────────────────────────────────────────────────────────────────
function InfoTab({ graphData, linkCount }: { graphData: GraphData; linkCount: number }) {
  const cats = [...new Set(graphData.nodes.map(n => n.category))]
  return (
    <div className="p-5 space-y-5">
      <section>
        <h4 className="text-[10px] tracking-widest text-muted uppercase mb-2.5">Current graph</h4>
        {[
          { label: 'Title', value: graphData.title },
          { label: 'Nodes', value: graphData.nodes.length },
          { label: 'Edges', value: linkCount },
          { label: 'Categories', value: cats.length },
        ].map(({ label, value }) => (
          <div key={label} className="flex justify-between items-center py-1.5 border-b border-border last:border-0">
            <span className="text-[11px] text-muted2">{label}</span>
            <span className="text-[11px] text-text font-medium">{value}</span>
          </div>
        ))}
      </section>
      <section>
        <h4 className="text-[10px] tracking-widest text-muted uppercase mb-2.5">Nodes</h4>
        <div className="flex flex-wrap gap-1.5">
          {graphData.nodes.map(n => (
            <span key={n.id} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] border"
              style={{ color: n.hex, borderColor: `${n.hex}33`, background: `${n.hex}11` }}>
              {n.icon} {n.label}
            </span>
          ))}
        </div>
      </section>
    </div>
  )
}

// ── Data Edit Tab ─────────────────────────────────────────────────────────────
function DataEditTab({ graphData, onGraphChange }: { graphData: GraphData; onGraphChange: (d: GraphData) => void }) {
  const [jsonStr, setJsonStr] = useState(() => JSON.stringify(graphData, null, 2))
  const [err, setErr] = useState<string | null>(null)

  // Sync if graph changes externally (e.g., node rename via 3D double click)
  useEffect(() => { setJsonStr(JSON.stringify(graphData, null, 2)) }, [graphData])

  const handleApply = () => {
    setErr(null)
    const { data, error } = parseGraphJSON(jsonStr)
    if (error) { setErr(error); return }
    if (data) { onGraphChange(data) }
  }

  return (
    <div className="p-5 flex flex-col h-full">
      <p className="text-[10px] text-muted tracking-widest uppercase mb-2">Edit Graph JSON</p>
      <textarea
        value={jsonStr}
        onChange={e => setJsonStr(e.target.value)}
        className="flex-1 min-h-[300px] bg-surface2 border border-border2 rounded-lg text-[11px] text-text font-mono leading-relaxed p-3.5 outline-none transition-colors placeholder-muted focus:border-accent"
        style={{ userSelect: 'text' }}
        spellCheck={false}
      />
      {err && <p className="text-[10px] text-[#f87171] mt-2 leading-relaxed whitespace-pre-wrap">{err}</p>}
      <button
        onClick={handleApply}
        className="mt-3 w-full py-2.5 bg-accent text-white text-[11px] tracking-widest font-medium rounded-lg hover:bg-[#6a58e8] transition-all duration-200 hover:-translate-y-px active:translate-y-0"
      >
        Apply Changes
      </button>
    </div>
  )
}

// ── AI Chat Tab ───────────────────────────────────────────────────────────────
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY as string
const GROQ_MODEL = 'llama-3.3-70b-versatile'

const SYSTEM_PROMPT = `You are a knowledge-graph JSON generator. The user gives a topic (and optionally extra instructions like node count). You MUST reply with a single, valid JSON object — no markdown, no explanation, no text outside the JSON.

Schema (follow exactly):
{"title":"Topic","nodes":[{"id":"snake_case_id","label":"Display Name","icon":"single_emoji","hex":"#hexcolor","category":"core|concept|example|resource|layer","content":"HTML string with <strong> tags. 2-3 paragraphs separated by <br><br>.","connections":["other_id"]}]}

CRITICAL JSON rules:
- Every string value MUST be enclosed in double quotes
- Inside strings, escape double quotes as \\" and use <br><br> for line breaks (NO literal newlines inside strings)
- HTML tags like <strong> and <br> go INSIDE the quoted string values, properly
- All keys must be double-quoted
- No trailing commas

Content rules:
- 8-14 nodes (unless user says otherwise)
- connections reference valid ids; bidirectional (list once)
- distinct hex colors per category; no white/black
- icons: one relevant emoji per node
- content: minimum 3 sentences, use <strong> for key terms, separate paragraphs with <br><br>
- every node has at least 2 connections
- the graph should feel like Obsidian: a web of related ideas`

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  nodeCount?: number
}

function tryRepairAndParse(raw: string): { data: import('../types/graph').GraphData | null; error?: string } {
  // Strip markdown fences if partially present
  let cleaned = raw
    .replace(/^```json\s*/m, '')
    .replace(/^```\s*/m, '')
    .replace(/\s*```$/m, '')
    .trim()

  // Sanitize literal newlines inside JSON strings (very common LLM issue)
  // Replace \n and \r inside strings with <br> or space
  cleaned = cleaned.replace(/(["]):([\s\S]*?)(?="[,}\]])/g, (match) => {
    return match.replace(/\n/g, '<br>').replace(/\r/g, '')
  })

  // Try direct parse first
  try {
    const obj = JSON.parse(cleaned)
    if (obj && Array.isArray(obj.nodes) && obj.nodes.length > 0) {
      const { data } = parseGraphJSON(JSON.stringify(obj))
      return { data }
    }
  } catch { /* continue to repair */ }

  // Try repairing by closing open brackets/braces
  try {
    let repaired = cleaned

    // Remove any trailing incomplete key-value or comma patterns
    repaired = repaired.replace(/,\s*$/, '')
    repaired = repaired.replace(/,\s*"[^"]*"\s*:\s*$/, '')
    repaired = repaired.replace(/:\s*$/, ': ""')
    repaired = repaired.replace(/,\s*$/, '')

    // Close any open string — count unescaped quotes
    let inString = false
    let escaped = false
    for (const ch of repaired) {
      if (escaped) { escaped = false; continue }
      if (ch === '\\') { escaped = true; continue }
      if (ch === '"') inString = !inString
    }
    if (inString) repaired += '"'

    // Remove trailing comma again
    repaired = repaired.replace(/,\s*$/, '')

    // Count unmatched delimiters
    const opens = { '{': 0, '[': 0 }
    const closes: Record<string, '{' | '['> = { '}': '{', ']': '[' }
    inString = false
    escaped = false
    for (const ch of repaired) {
      if (escaped) { escaped = false; continue }
      if (ch === '\\') { escaped = true; continue }
      if (ch === '"') { inString = !inString; continue }
      if (inString) continue
      if (ch === '{' || ch === '[') opens[ch]++
      if (ch === '}' || ch === ']') opens[closes[ch]]--
    }

    // Append closing delimiters in reverse order (arrays before objects)
    for (let i = 0; i < opens['[']; i++) repaired += ']'
    for (let i = 0; i < opens['{']; i++) repaired += '}'

    const obj = JSON.parse(repaired)
    if (obj && Array.isArray(obj.nodes) && obj.nodes.length > 0) {
      const { data } = parseGraphJSON(JSON.stringify(obj))
      return { data }
    }
  } catch (e) { return { data: null, error: (e as Error).message } }

  return { data: null }
}

function AiChatTab({ onGraphChange }: { onGraphChange: (data: import('../types/graph').GraphData) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Type a topic and I\'ll generate a knowledge graph for you! You can also specify preferences like number of nodes.' }
  ])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const lastUpdateRef = useRef<number>(0)
  const lastNodeCountRef = useRef<number>(0)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

  const sendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!input.trim() || isStreaming) return

    const userText = input.trim()
    const userMsg: ChatMessage = { role: 'user', content: userText }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsStreaming(true)
    lastNodeCountRef.current = 0

    // Add a placeholder assistant message
    const assistantMsg: ChatMessage = { role: 'assistant', content: '✦ Generating graph…', nodeCount: 0 }
    setMessages(prev => [...prev, assistantMsg])

    const controller = new AbortController()
    abortRef.current = controller

    let fullBuffer = ''

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userText },
          ],
          response_format: { type: 'json_object' },
          stream: true,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => null)
        throw new Error(errData?.error?.message || `API error ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let done = false
      let lineBuffer = '' // accumulate partial SSE lines across read() calls

      while (!done) {
        const { value, done: streamDone } = await reader.read()
        done = streamDone
        if (!value) continue

        lineBuffer += decoder.decode(value, { stream: true })
        const lines = lineBuffer.split('\n')
        // Keep the last (potentially incomplete) line in the buffer
        lineBuffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.trim().startsWith('data:')) continue
          const jsonStr = line.replace(/^data:\s*/, '').trim()
          if (jsonStr === '[DONE]') { done = true; break }

          try {
            const parsed = JSON.parse(jsonStr)
            const delta = parsed.choices?.[0]?.delta?.content
            if (delta) {
              fullBuffer += delta

              // Throttle incremental graph updates to every 300ms
              const now = Date.now()
              if (now - lastUpdateRef.current > 300) {
                lastUpdateRef.current = now
                const { data } = tryRepairAndParse(fullBuffer)
                if (data && data.nodes.length > lastNodeCountRef.current) {
                  lastNodeCountRef.current = data.nodes.length
                  onGraphChange(data)
                  setMessages(prev => {
                    const copy = [...prev]
                    const last = copy[copy.length - 1]
                    if (last.role === 'assistant') {
                      copy[copy.length - 1] = {
                        ...last,
                        content: `✦ Generating graph… ${data.nodes.length} node${data.nodes.length > 1 ? 's' : ''} so far`,
                        nodeCount: data.nodes.length,
                      }
                    }
                    return copy
                  })
                }
              }
            }
          } catch { /* ignore malformed SSE lines */ }
        }
      }

      // Final parse with the complete buffer — use tryRepairAndParse for robustness
      const finalResult = tryRepairAndParse(fullBuffer)
      const data = finalResult.data
      const error = finalResult.error || null
      // Fallback: try the stricter parseGraphJSON if repair didn't work
      if (!data) {
        const strict = parseGraphJSON(fullBuffer)
        if (strict.data) { 
          onGraphChange(strict.data)
          setMessages(prev => {
            const copy = [...prev]
            copy[copy.length - 1] = {
              role: 'assistant',
              content: `✦ Generated "${strict.data!.title}" — ${strict.data!.nodes.length} nodes`,
              nodeCount: strict.data!.nodes.length,
            }
            return copy
          })
          return
        }
      }
      if (data) {
        onGraphChange(data)
        setMessages(prev => {
          const copy = [...prev]
          copy[copy.length - 1] = {
            role: 'assistant',
            content: `✦ Generated "${data.title}" — ${data.nodes.length} nodes`,
            nodeCount: data.nodes.length,
          }
          return copy
        })
      } else {
        setMessages(prev => {
          const copy = [...prev]
          copy[copy.length - 1] = {
            role: 'assistant',
            content: `⚠ Could not parse graph: ${error || 'Unknown error'}`,
          }
          return copy
        })
      }
    } catch (err: unknown) {
      if ((err as Error).name !== 'AbortError') {
        setMessages(prev => {
          const copy = [...prev]
          copy[copy.length - 1] = {
            role: 'assistant',
            content: `⚠ Error: ${(err as Error).message}`,
          }
          return copy
        })
      }
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }

  return (
    <div className="flex flex-col h-full" style={{ minHeight: 0 }}>
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ minHeight: 0 }}>
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-[11.5px] leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-accent text-white rounded-br-md'
                  : 'bg-surface2 text-text border border-border rounded-bl-md'
              }`}
            >
              {msg.content}
              {msg.role === 'assistant' && msg.nodeCount !== undefined && msg.nodeCount > 0 && (
                <div className="mt-2 flex items-center gap-1.5">
                  {Array.from({ length: msg.nodeCount }, (_, j) => (
                    <span
                      key={j}
                      className="inline-block w-1.5 h-1.5 rounded-full bg-accent animate-pulse"
                      style={{ animationDelay: `${j * 80}ms` }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {isStreaming && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1 px-3.5 py-2.5 bg-surface2 border border-border rounded-xl rounded-bl-md">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent animate-pulse" style={{ animationDelay: '150ms' }} />
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent animate-pulse" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Example topics */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2">
          <p className="text-[9px] text-muted tracking-widest uppercase mb-2">Try a topic</p>
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLE_TOPICS.slice(0, 6).map(topic => (
              <button
                key={topic}
                onClick={() => { setInput(topic) }}
                className="text-[10px] text-muted2 bg-surface2 border border-border px-2.5 py-1 rounded-full hover:border-accent hover:text-accent transition-all duration-200"
              >
                {topic}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <form className="flex items-center gap-2 px-4 py-3 border-t border-border flex-shrink-0" onSubmit={sendMessage}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type a topic…"
          disabled={isStreaming}
          className="flex-1 bg-surface2 border border-border2 rounded-lg text-[11px] text-text px-3 py-2 outline-none placeholder-muted transition-colors focus:border-accent"
        />
        {isStreaming ? (
          <button
            type="button"
            onClick={() => abortRef.current?.abort()}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-red/15 text-[#f87171] border border-[#f87171]/30 hover:bg-red/25 transition-all duration-200"
            title="Stop"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="currentColor">
              <rect x="3" y="3" width="8" height="8" rx="1" />
            </svg>
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent text-white disabled:opacity-30 hover:bg-[#6a58e8] transition-all duration-200 disabled:hover:bg-accent"
            title="Send"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="2" x2="6" y2="8" />
              <polygon points="12 2 8 12 6 8 2 6 12 2" />
            </svg>
          </button>
        )}
      </form>
    </div>
  )
}
