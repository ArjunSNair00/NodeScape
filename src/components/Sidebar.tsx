import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GraphData, GraphHandle } from '../types/graph'
import { AI_PROMPT, EXAMPLE_TOPICS } from '../data/defaultGraph'
import { parseGraphJSON } from '../lib/validateGraph'

interface Props {
  open: boolean
  graphData: GraphData
  graphRef: React.RefObject<GraphHandle | null>
  onClose: () => void
  onGraphChange: (data: GraphData) => void
  onSave: () => void
  onGoHome: () => void
}

type Tab = 'prompt' | 'paste' | 'editor' | 'controls' | 'info'

const TABS: { id: Tab; label: string }[] = [
  { id: 'prompt',   label: 'PROMPT'   },
  { id: 'paste',    label: 'PASTE'    },
  { id: 'editor',   label: 'EDITOR'   },
  { id: 'controls', label: 'CONTROLS' },
  { id: 'info',     label: 'INFO'     },
]

export default function Sidebar({ open, graphData, graphRef, onClose, onGraphChange, onSave, onGoHome }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('prompt')
  const [copied, setCopied] = useState(false)
  const [jsonInput, setJsonInput] = useState('')
  const [error, setError] = useState<string | null>(null)

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
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            {activeTab === 'prompt'   && <PromptTab copied={copied} onCopy={handleCopyPrompt} />}
            {activeTab === 'paste'    && <PasteTab value={jsonInput} onChange={setJsonInput} error={error} onGenerate={handleGenerate} />}
            {activeTab === 'editor'   && <DataEditTab graphData={graphData} onGraphChange={onGraphChange} />}
            {activeTab === 'controls' && <ControlsTab graphRef={graphRef} />}
            {activeTab === 'info'     && <InfoTab graphData={graphData} linkCount={linkCount} />}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Controls Tab ──────────────────────────────────────────────────────────────
function ControlsTab({ graphRef }: { graphRef: React.RefObject<GraphHandle | null> }) {
  const [jiggling, setJiggling] = useState(false)
  const [labelLevel, setLabelLevel] = useState(() => Number(sessionStorage.getItem('labelLevel') || 5)) // 1–9, 5 = default (×1.0)
  const [drawLevel, setDrawLevel] = useState(() => Number(sessionStorage.getItem('drawLevel') || 5)) // 1-9, 5 = default
  const [idleRotate, setIdleRotate] = useState(() => sessionStorage.getItem('idleRotate') !== 'false')
  const [edgeHover, setEdgeHover] = useState(() => sessionStorage.getItem('edgeHover') === 'true')
  const [continuousPhysics, setContinuousPhysics] = useState(() => sessionStorage.getItem('continuousPhysics') === 'true')
  const [edgeDrag, setEdgeDrag] = useState(() => sessionStorage.getItem('edgeDrag') === 'true')

  useEffect(() => {
    sessionStorage.setItem('labelLevel', labelLevel.toString())
    sessionStorage.setItem('drawLevel', drawLevel.toString())
    sessionStorage.setItem('idleRotate', idleRotate.toString())
    sessionStorage.setItem('edgeHover', edgeHover.toString())
    sessionStorage.setItem('continuousPhysics', continuousPhysics.toString())
    sessionStorage.setItem('edgeDrag', edgeDrag.toString())
  }, [labelLevel, drawLevel, idleRotate, edgeHover, continuousPhysics, edgeDrag])

  const g = () => graphRef.current

  const handleJiggle = () => {
    g()?.jiggle()
    setJiggling(true)
    setTimeout(() => setJiggling(false), 1200)
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

  const ActionBtn = ({ onClick, children, active, wide }: { onClick: () => void; children: React.ReactNode; active?: boolean; wide?: boolean }) => (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 text-[10px] tracking-widest border rounded-lg transition-all duration-200 active:scale-95 ${wide ? 'px-4 py-2' : 'w-9 h-9'} ${
        active
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

      <BtnRow label="Continuous Physics">
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

  // Sync if graph changes externally
  // useEffect(() => { setJsonStr(JSON.stringify(graphData, null, 2)) }, [graphData])

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
