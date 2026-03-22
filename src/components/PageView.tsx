import { motion } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import { NodeData } from "../types/graph";

interface Props {
  node: NodeData;
  nodeMap: Record<string, NodeData>;
  isEditMode: boolean;
  canGoBack?: boolean;
  onClose: () => void;
  onNodeSelect: (nodeId: string) => void;
  onBack?: () => void;
  uiAnimations?: boolean;
  history?: NodeData[];
  onJump?: (index: number) => void;
  graphTitle?: string;
  onUpdateNode: (updatedNode: NodeData) => void;
  isPathMode?: boolean;
  onTogglePathMode?: () => void;
  isPathAppendMode?: boolean;
  onTogglePathAppendMode?: () => void;
  highlightPath?: string[];
  onClearPath?: () => void;
  isCameraLocked?: boolean;
  lockedToNodeId?: string | null;
  onLockCamera?: (nodeId: string) => void;
  onUnlockCamera?: () => void;
  onNodeHover?: (nodeId: string | null) => void;
  isPathHideMode?: boolean;
  onTogglePathHideMode?: () => void;
}

function EditableText({
  value,
  isEditMode,
  multiline,
  className,
  as: Component = "span",
  onChange,
  dangerouslySetInnerHTML,
}: {
  value: string;
  isEditMode: boolean;
  multiline?: boolean;
  className?: string;
  as?: any;
  onChange: (val: string) => void;
  dangerouslySetInnerHTML?: any;
}) {
  const [editing, setEditing] = useState(false);
  const [localVal, setLocalVal] = useState(value);
  const inputRef = useRef<any>(null);

  useEffect(() => {
    setLocalVal(value);
  }, [value]);

  useEffect(() => {
    if ((editing || isEditMode) && inputRef.current) {
      if (!isEditMode) inputRef.current.focus();
    }
  }, [editing, isEditMode]);

  const handleBlur = () => {
    setEditing(false);
    if (localVal !== value) onChange(localVal);
  };

  const isEditing = editing || isEditMode;

  if (isEditing) {
    if (multiline) {
      return (
        <textarea
          ref={inputRef}
          value={localVal}
          onChange={(e) => setLocalVal(e.target.value)}
          onBlur={handleBlur}
          className={`bg-transparent outline-none resize-none overflow-y-auto min-h-[50vh] max-h-[70vh] w-full border border-border2 focus:border-accent p-3 rounded-xl shadow-inner ${className || ""}`}
        />
      );
    }
    return (
      <input
        ref={inputRef}
        value={localVal}
        onChange={(e) => setLocalVal(e.target.value)}
        onBlur={handleBlur}
        className={`bg-transparent outline-none border border-border2 focus:border-accent px-2 py-0.5 rounded w-full ${className || ""}`}
      />
    );
  }

  return (
    <Component
      className={`cursor-pointer hover:bg-surface3/50 rounded transition-colors ${className || ""}`}
      onDoubleClick={() => setEditing(true)}
      dangerouslySetInnerHTML={dangerouslySetInnerHTML}
    >
      {dangerouslySetInnerHTML ? undefined : value}
    </Component>
  );
}

export default function PageView({
  node,
  nodeMap,
  isEditMode,
  canGoBack,
  onClose,
  onNodeSelect,
  onBack,
  uiAnimations = true,
  history = [],
  onJump,
  graphTitle = "graph",
  onUpdateNode,
  isPathMode = false,
  onTogglePathMode,
  isPathAppendMode = false,
  onTogglePathAppendMode,
  highlightPath = [],
  onClearPath,
  isCameraLocked = false,
  lockedToNodeId = null,
  onLockCamera,
  onUnlockCamera,
  onNodeHover,
  isPathHideMode = false,
  onTogglePathHideMode,
}: Props) {
  const Wrapper = uiAnimations ? motion.div : ("div" as any);
  const MotionH1 = uiAnimations ? motion.h1 : ("h1" as any);
  const MotionDiv = uiAnimations ? motion.div : ("div" as any);
  const MotionSpan = uiAnimations ? motion.span : ("span" as any);

  return (
    <Wrapper
      key={node.id}
      {...(uiAnimations
        ? {
            initial: { opacity: 0, y: 22 },
            animate: { opacity: 1, y: 0 },
            exit: { opacity: 0, y: 22 },
            transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] },
          }
        : {})}
      className="absolute inset-0 z-30 bg-bg flex flex-col overflow-y-auto"
    >
      {/* Header + Controls - sticky together */}
      <div
        className="sticky top-0 z-10 backdrop-blur-xl shrink-0"
        style={{ background: "rgba(8,8,16,0.94)" }}
      >
        <div className="flex items-center gap-4 px-7 py-3.5">
          {canGoBack && onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-[11px] text-muted tracking-wider px-3.5 py-1.5 rounded-md border border-border hover:border-accent hover:text-accent hover:bg-accent/10 transition-all duration-200"
            >
              <svg
                className="w-3 h-3"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M10 6H2M6 10L2 6l4-4" />
              </svg>
              back
            </button>
          )}
          <span className="text-[11px] text-muted truncate">
            {graphTitle.toLowerCase()} /{" "}
            {history.map((h, i) => (
              <span key={`${h.id}-${i}`}>
                <button
                  onClick={() => onJump?.(i)}
                  className="hover:text-accent transition-colors"
                >
                  {h.label.toLowerCase().replace(/ /g, "-")}
                </button>
                {" / "}
              </span>
            ))}
            <span className="text-accent">
              {node.label.toLowerCase().replace(/ /g, "-")}
            </span>
          </span>
        </div>
        {/* Controls row: Lock Camera left, Path Mode + Clear Path right */}
        <div className="flex items-center justify-between gap-2 px-7 py-2.5 border-t border-border">
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                isCameraLocked && lockedToNodeId === node.id
                  ? onUnlockCamera?.()
                  : onLockCamera?.(node.id)
              }
              className={`flex items-center gap-1.5 text-[10px] tracking-widest px-2.5 py-1 rounded border transition-all ${
                isCameraLocked && lockedToNodeId === node.id
                  ? "border-accent text-accent bg-accent/10"
                  : "border-border text-muted hover:border-accent/60"
              }`}
            >
              Lock Camera{" "}
              {isCameraLocked && lockedToNodeId === node.id ? "ON" : "OFF"}
            </button>
            <button
              onClick={onTogglePathMode ?? (() => {})}
              className={`flex items-center gap-1.5 text-[10px] tracking-widest px-2.5 py-1 rounded border transition-all ${
                isPathMode
                  ? "border-accent text-accent bg-accent/10"
                  : "border-border text-muted hover:border-accent/60"
              }`}
            >
              Path Mode {isPathMode ? "ON" : "OFF"}
            </button>
            <button
              onClick={onTogglePathAppendMode ?? (() => {})}
              className={`flex items-center gap-1.5 text-[10px] tracking-widest px-2.5 py-1 rounded border transition-all ${
                isPathAppendMode
                  ? "border-accent text-accent bg-accent/10"
                  : "border-border text-muted hover:border-accent/60"
              }`}
              title="When ON, revisiting earlier nodes appends to the current path"
            >
              Append {isPathAppendMode ? "ON" : "OFF"}
            </button>
            <button
              onClick={onTogglePathHideMode ?? (() => {})}
              className={`flex items-center gap-1.5 text-[10px] tracking-widest px-2.5 py-1 rounded border transition-all ${
                isPathHideMode
                  ? "border-accent text-accent bg-accent/10"
                  : "border-border text-muted hover:border-accent/60"
              }`}
              title="When ON, only nodes that are highlighted will be visible"
            >
              Hide Ambient {isPathHideMode ? "ON" : "OFF"}
            </button>
            {highlightPath.length > 0 && (
              <button
                onClick={onClearPath ?? (() => {})}
                className="flex items-center gap-1.5 text-[10px] tracking-widest px-2.5 py-1 rounded border border-border text-muted hover:border-[#f87171] hover:text-[#f87171] transition-all"
              >
                Clear Path
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded border border-[#f87171]/30 text-[#f87171] hover:border-[#f87171] hover:bg-[#f87171]/10 transition-all"
            title="Close"
          >
            <svg
              className="w-3 h-3"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <line x1="2" y1="2" x2="10" y2="10" />
              <line x1="10" y1="2" x2="2" y2="10" />
            </svg>
          </button>
        </div>
        </div>

      {/* Body */}
      <div className="max-w-2xl mx-auto w-full px-10 py-14 pb-20">
        <MotionSpan
          {...(uiAnimations
            ? {
                initial: { scale: 0.8, opacity: 0 },
                animate: { scale: 1, opacity: 1 },
                transition: { delay: 0.05 },
              }
            : {})}
          className="text-4xl block mb-5"
        >
          <EditableText
            value={node.icon || "⬡"}
            isEditMode={isEditMode}
            onChange={(val) => onUpdateNode({ ...node, icon: val })}
            className="w-16"
          />
        </MotionSpan>

        <MotionDiv
          {...(uiAnimations
            ? {
                initial: { opacity: 0 },
                animate: { opacity: 1 },
                transition: { delay: 0.08 },
              }
            : {})}
          className="flex items-center gap-2 text-[10px] text-muted tracking-[0.15em] uppercase mb-3"
        >
          <span className="inline-block w-6 h-px bg-border" />
          <EditableText
            value={node.category}
            isEditMode={isEditMode}
            onChange={(val) => onUpdateNode({ ...node, category: val })}
            className="flex-1"
          />
        </MotionDiv>

        <MotionH1
          {...(uiAnimations
            ? {
                initial: { opacity: 0, y: 8 },
                animate: { opacity: 1, y: 0 },
                transition: { delay: 0.1 },
              }
            : {})}
          className="font-serif text-[42px] leading-[1.15] mb-7 text-text"
        >
          <EditableText
            value={node.label}
            isEditMode={isEditMode}
            onChange={(val) => onUpdateNode({ ...node, label: val })}
          />
        </MotionH1>

        <MotionDiv
          {...(uiAnimations
            ? {
                initial: { scaleX: 0, originX: 0 },
                animate: { scaleX: 1 },
                transition: { delay: 0.15, duration: 0.4 },
              }
            : {})}
          className="h-px mb-7 opacity-40"
          style={{
            background: "linear-gradient(to right, #7c6af7, transparent)",
          }}
        />

        <MotionDiv
          {...(uiAnimations
            ? {
                initial: { opacity: 0, y: 6 },
                animate: { opacity: 1, y: 0 },
                transition: { delay: 0.18 },
              }
            : {})}
          className="text-sm leading-[1.85] text-[#a0a0be] font-light [&_strong]:text-text [&_strong]:font-medium"
        >
          <EditableText
            value={node.content}
            isEditMode={isEditMode}
            multiline
            as="div"
            dangerouslySetInnerHTML={{ __html: node.content }}
            onChange={(val) => onUpdateNode({ ...node, content: val })}
          />
        </MotionDiv>

        {/* Connections */}
        {node.connections.length > 0 && (
          <MotionDiv
            {...(uiAnimations
              ? {
                  initial: { opacity: 0 },
                  animate: { opacity: 1 },
                  transition: { delay: 0.25 },
                }
              : {})}
            className="mt-12"
          >
            <h3 className="text-[10px] tracking-[0.15em] text-muted uppercase mb-4">
              Connected nodes
            </h3>
            <div className="flex flex-wrap gap-2">
              {(() => {
                const visitedIds = new Set(history.map((h) => h.id));
                const unvisited = node.connections.filter(
                  (cid) => !visitedIds.has(cid),
                );
                const visited = node.connections.filter((cid) =>
                  visitedIds.has(cid),
                );

                return [...unvisited, ...visited].map((cid) => {
                  const cn = nodeMap[cid];
                  if (!cn) return null;
                  const isVisited = visitedIds.has(cid);
                  return (
                    <button
                      key={cid}
                      onClick={() => onNodeSelect(cn.id)}
                      onMouseEnter={() => onNodeHover?.(cn.id)}
                      onMouseLeave={() => onNodeHover?.(null)}
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border transition-all duration-200 text-xs ${
                        isVisited
                          ? "border-border/40 bg-surface2/40 text-muted/50 hover:border-accent/40"
                          : "border-border bg-surface2 text-muted hover:border-accent hover:text-text hover:bg-accent/10"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${isVisited ? "grayscale opacity-50" : ""}`}
                        style={{ background: cn.hex }}
                      />
                      <span className={isVisited ? "opacity-60" : ""}>
                        {cn.icon} {cn.label}
                      </span>
                    </button>
                  );
                });
              })()}
            </div>
          </MotionDiv>
        )}
      </div>
    </Wrapper>
  );
}
