import { motion } from 'framer-motion'
import { useState, useRef, useEffect } from 'react'
import { NodeData } from '../types/graph'

interface Props {
  node: NodeData
  nodeMap: Record<string, NodeData>
  isEditMode: boolean
  onClose: () => void
  onNavigate: (node: NodeData) => void
  onUpdateNode: (updatedNode: NodeData) => void
}

function EditableText({
  value,
  isEditMode,
  multiline,
  className,
  as: Component = 'span',
  onChange,
  dangerouslySetInnerHTML,
}: {
  value: string
  isEditMode: boolean
  multiline?: boolean
  className?: string
  as?: any
  onChange: (val: string) => void
  dangerouslySetInnerHTML?: any
}) {
  const [editing, setEditing] = useState(false)
  const [localVal, setLocalVal] = useState(value)
  const inputRef = useRef<any>(null)

  useEffect(() => { setLocalVal(value) }, [value])

  useEffect(() => {
    if ((editing || isEditMode) && inputRef.current) {
      if (!isEditMode) inputRef.current.focus()
    }
  }, [editing, isEditMode])

  const handleBlur = () => {
    setEditing(false)
    if (localVal !== value) onChange(localVal)
  }

  const isEditing = editing || isEditMode

  if (isEditing) {
    if (multiline) {
      return (
        <textarea
          ref={inputRef}
          value={localVal}
          onChange={e => setLocalVal(e.target.value)}
          onBlur={handleBlur}
          className={`bg-transparent outline-none resize-none overflow-hidden w-full border border-border2 focus:border-accent p-2 rounded ${className || ''}`}
          rows={Math.max(4, localVal.split('\n').length)}
        />
      )
    }
    return (
      <input
        ref={inputRef}
        value={localVal}
        onChange={e => setLocalVal(e.target.value)}
        onBlur={handleBlur}
        className={`bg-transparent outline-none border border-border2 focus:border-accent px-2 py-0.5 rounded w-full ${className || ''}`}
      />
    )
  }

  return (
    <Component
      className={`cursor-pointer hover:bg-surface3/50 rounded transition-colors ${className || ''}`}
      onDoubleClick={() => setEditing(true)}
      dangerouslySetInnerHTML={dangerouslySetInnerHTML}
    >
      {dangerouslySetInnerHTML ? undefined : value}
    </Component>
  )
}

export default function PageView({ node, nodeMap, isEditMode, onClose, onNavigate, onUpdateNode }: Props) {
  return (
    <motion.div
      key={node.id}
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 22 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      className="absolute inset-0 z-30 bg-bg flex flex-col overflow-y-auto"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-4 px-7 py-3.5 border-b border-border backdrop-blur-xl"
        style={{ background: 'rgba(8,8,16,0.94)' }}>
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-[11px] text-muted tracking-wider px-3.5 py-1.5 rounded-md border border-border hover:border-accent hover:text-accent hover:bg-accent/10 transition-all duration-200"
        >
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 2L4 6l4 4" />
          </svg>
          graph view
        </button>
        <span className="text-[11px] text-muted">
          graph / <span className="text-accent">{node.label.toLowerCase().replace(/ /g, '-')}</span>
        </span>
      </div>

      {/* Body */}
      <div className="max-w-2xl mx-auto w-full px-10 py-14 pb-20">
        <motion.span
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.05 }}
          className="text-4xl block mb-5"
        >
          <EditableText
            value={node.icon || '⬡'}
            isEditMode={isEditMode}
            onChange={val => onUpdateNode({ ...node, icon: val })}
            className="w-16"
          />
        </motion.span>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.08 }}
          className="flex items-center gap-2 text-[10px] text-muted tracking-[0.15em] uppercase mb-3"
        >
          <span className="inline-block w-6 h-px bg-border" />
          <EditableText
            value={node.category}
            isEditMode={isEditMode}
            onChange={val => onUpdateNode({ ...node, category: val })}
            className="flex-1"
          />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="font-serif text-[42px] leading-[1.15] mb-7 text-text"
        >
          <EditableText
            value={node.label}
            isEditMode={isEditMode}
            onChange={val => onUpdateNode({ ...node, label: val })}
          />
        </motion.h1>

        <motion.div
          initial={{ scaleX: 0, originX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="h-px mb-7 opacity-40"
          style={{ background: 'linear-gradient(to right, #7c6af7, transparent)' }}
        />

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="text-sm leading-[1.85] text-[#a0a0be] font-light [&_strong]:text-text [&_strong]:font-medium"
        >
          <EditableText
            value={node.content}
            isEditMode={isEditMode}
            multiline
            as="div"
            dangerouslySetInnerHTML={{ __html: node.content }}
            onChange={val => onUpdateNode({ ...node, content: val })}
          />
        </motion.div>

        {/* Connections */}
        {node.connections.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="mt-12"
          >
            <h3 className="text-[10px] tracking-[0.15em] text-muted uppercase mb-4">Connected nodes</h3>
            <div className="flex flex-wrap gap-2">
              {node.connections.map(cid => {
                const cn = nodeMap[cid]
                if (!cn) return null
                return (
                  <button
                    key={cid}
                    onClick={() => onNavigate(cn)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-border bg-surface2 text-xs text-muted hover:border-accent hover:text-text hover:bg-accent/10 transition-all duration-200"
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: cn.hex }} />
                    {cn.icon} {cn.label}
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
