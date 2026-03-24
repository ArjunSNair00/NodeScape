import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GraphData, GraphHandle } from "../types/graph";
import { AI_PROMPT, EXAMPLE_TOPICS } from "../data/defaultGraph";
import { parseGraphJSON, tryRepairAndParse } from "../lib/validateGraph";
import { parsePDF, parseTextFile, chunkText } from "../lib/parseFile";
import {
  getSupabaseAccessToken,
  getSupabaseUser,
  resetPassword,
  signInWithPassword,
  signOutSupabase,
  signUpWithPassword,
  subscribeToAuthChanges,
} from "../lib/supabaseAuth";

interface Props {
  open: boolean;
  graphData: GraphData;
  originalGraphData?: GraphData;
  graphRef: React.RefObject<GraphHandle | null>;
  onClose: () => void;
  onGraphChange: (data: GraphData) => void;
  onSave: () => void;
  onGoHome: () => void;
  uiAnimations?: boolean;
  onToggleUiAnimations?: () => void;
}

type Tab = "ai" | "prompt" | "paste" | "editor" | "controls" | "info";

const TABS: { id: Tab; label: string }[] = [
  { id: "ai", label: "✦ AI" },
  { id: "prompt", label: "PROMPT" },
  { id: "paste", label: "PASTE" },
  { id: "editor", label: "EDITOR" },
  { id: "controls", label: "CONTROLS" },
  { id: "info", label: "INFO" },
];

export default function Sidebar({
  open,
  graphData,
  originalGraphData,
  graphRef,
  onClose,
  onGraphChange,
  onSave,
  onGoHome,
  uiAnimations = true,
  onToggleUiAnimations,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("ai");
  const [copied, setCopied] = useState(false);
  const [jsonInput, setJsonInput] = useState(
    JSON.stringify(graphData, null, 2),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setJsonInput(JSON.stringify(graphData, null, 2));
  }, [graphData]);

  const linkCount = (() => {
    const seen = new Set<string>();
    graphData.nodes.forEach((n) =>
      n.connections.forEach((cid) => seen.add([n.id, cid].sort().join("-"))),
    );
    return seen.size;
  })();

  const handleCopyPrompt = async () => {
    await navigator.clipboard.writeText(AI_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerate = () => {
    setError(null);
    const { data, error: err } = parseGraphJSON(jsonInput);
    if (err) {
      setError(err);
      return;
    }
    if (data) {
      onGraphChange(data);
      setActiveTab("info");
    }
  };

  return (
    <>
      {open && (
        <div
          key="sidebar"
          className="absolute top-0 right-0 bottom-0 w-[400px] flex flex-col z-50 border-l border-border"
          style={{ background: "var(--surface)" }}
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border flex-shrink-0">
            <span className="text-xs text-text tracking-widest font-medium flex-1">
              ⚡ Studio
            </span>
            {/* Save button */}
            <button
              onClick={() => {
                onSave();
                graphRef.current?.triggerSaveToast();
              }}
              className="flex items-center gap-1.5 text-[10px] text-muted2 tracking-widest px-2.5 py-1.5 rounded border border-border2 hover:border-accent hover:text-accent hover:bg-accent/10 transition-all duration-200"
            >
              <svg
                className="w-3 h-3"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M2 2h6l2 2v6a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" />
                <path d="M4 2v3h4V2M4 7h4" />
              </svg>
              Save
            </button>
            {/* Home button */}
            <button
              onClick={onGoHome}
              className="flex items-center gap-1.5 text-[10px] text-muted2 tracking-widest px-2.5 py-1.5 rounded border border-border2 hover:border-accent hover:text-accent hover:bg-accent/10 transition-all duration-200"
            >
              <svg
                className="w-3 h-3"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M1 6l5-4 5 4M2 5.5V10h3V7h2v3h3V5.5" />
              </svg>
              Home
            </button>
            <button
              onClick={onClose}
              className="text-muted hover:text-text transition-colors text-sm leading-none px-1"
            >
              ✕
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border flex-shrink-0">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2.5 text-[9px] tracking-widest transition-all duration-200 border-b-2 -mb-px ${
                  activeTab === tab.id
                    ? "text-accent border-accent"
                    : "text-muted border-transparent hover:text-muted2"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Body */}
          <div
            className={`flex-1 overflow-x-hidden ${activeTab === "ai" ? "overflow-hidden flex flex-col" : "overflow-y-auto"}`}
          >
            {activeTab === "ai" && (
              <AiChatTab
                onGraphChange={onGraphChange}
                graphRef={graphRef}
                graphData={graphData}
              />
            )}
            {activeTab === "prompt" && (
              <PromptTab copied={copied} onCopy={handleCopyPrompt} />
            )}
            {activeTab === "paste" && (
              <PasteTab
                value={jsonInput}
                onChange={setJsonInput}
                error={error}
                onGenerate={handleGenerate}
              />
            )}
            {activeTab === "editor" && (
              <DataEditTab
                graphData={graphData}
                onGraphChange={onGraphChange}
              />
            )}
            {activeTab === "controls" && (
              <ControlsTab
                graphRef={graphRef}
                originalGraphData={originalGraphData}
                uiAnimations={uiAnimations}
                onToggleUiAnimations={onToggleUiAnimations}
              />
            )}
            {activeTab === "info" && (
              <InfoTab graphData={graphData} linkCount={linkCount} />
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ── Controls Tab ──────────────────────────────────────────────────────────────
function ControlsTab({
  graphRef,
  originalGraphData,
  uiAnimations,
  onToggleUiAnimations,
}: {
  graphRef: React.RefObject<GraphHandle | null>;
  originalGraphData?: GraphData;
  uiAnimations: boolean;
  onToggleUiAnimations?: () => void;
}) {
  const [jiggling, setJiggling] = useState(false);
  const [physicsOffWarning, setPhysicsOffWarning] = useState(false);
  const [labelLevel, setLabelLevel] = useState(() =>
    Number(sessionStorage.getItem("labelLevel") || 5),
  ); // 1–9, 5 = default (×1.0)
  const [drawLevel, setDrawLevel] = useState(() => {
    const saved = sessionStorage.getItem("drawLevel");
    // If never set, or set to the old default of 5, use the new default of 9
    if (!saved || saved === "5") return 9;
    return Number(saved);
  }); // 1-9, 9 = max default
  const [idleRotate, setIdleRotate] = useState(
    () => sessionStorage.getItem("idleRotate") !== "false",
  );
  const [edgeHover, setEdgeHover] = useState(
    () => sessionStorage.getItem("edgeHover") === "true",
  );
  const [continuousPhysics, setContinuousPhysics] = useState(
    () => sessionStorage.getItem("continuousPhysics") !== "false",
  );
  const [edgeDrag, setEdgeDrag] = useState(
    () => sessionStorage.getItem("edgeDrag") === "true",
  );
  const [showNodeIcons, setShowNodeIcons] = useState(
    () => sessionStorage.getItem("showNodeIcons") !== "false",
  );
  const [expandReplace, setExpandReplace] = useState(
    () => sessionStorage.getItem("expandReplace") === "true",
  );
  const [autoSave, setAutoSave] = useState(() => {
    const saved = sessionStorage.getItem("autoSave");
    return saved === "true";
  });
  const [graphGrowthAnimation, setGraphGrowthAnimation] = useState(
    () => sessionStorage.getItem("graphGrowthAnimation") !== "false",
  );

  const [resetPositions, setResetPositions] = useState(true);
  const [resetColors, setResetColors] = useState(true);
  const [spreadLevel, setSpreadLevel] = useState(5); // 1-9, 5 = default (×1.0)

  useEffect(() => {
    sessionStorage.setItem("labelLevel", labelLevel.toString());
    sessionStorage.setItem("drawLevel", drawLevel.toString());
    sessionStorage.setItem("idleRotate", idleRotate.toString());
    sessionStorage.setItem("edgeHover", edgeHover.toString());
    sessionStorage.setItem("continuousPhysics", continuousPhysics.toString());
    sessionStorage.setItem("edgeDrag", edgeDrag.toString());
    sessionStorage.setItem("showNodeIcons", showNodeIcons.toString());
    sessionStorage.setItem("expandReplace", expandReplace.toString());
    sessionStorage.setItem("autoSave", autoSave.toString());
    sessionStorage.setItem(
      "graphGrowthAnimation",
      graphGrowthAnimation.toString(),
    );
  }, [
    labelLevel,
    drawLevel,
    idleRotate,
    edgeHover,
    continuousPhysics,
    edgeDrag,
    showNodeIcons,
    expandReplace,
    autoSave,
    graphGrowthAnimation,
  ]);

  const g = () => graphRef.current;

  const handleJiggle = () => {
    // If physics is off, show a warning instead of jigging
    if (!g()?.isContinuousPhysicsEnabled()) {
      setPhysicsOffWarning(true);
      setTimeout(() => setPhysicsOffWarning(false), 2500);
      return;
    }
    g()?.jiggle();
    setJiggling(true);
    setTimeout(() => setJiggling(false), 1200);
  };

  const handleReset = () => {
    if (g() && originalGraphData) {
      g()?.resetGraph(
        { positions: resetPositions, colors: resetColors },
        originalGraphData,
      );
    }
  };

  const changeLabel = (delta: number) => {
    const next = Math.max(1, Math.min(9, labelLevel + delta));
    setLabelLevel(next);
    // Map 1-9 to 0.3-2.2 multiplier range
    const mult = 0.3 + ((next - 1) / 8) * 1.9;
    // We store absolute, so compute delta from current
    const currentMult = 0.3 + ((labelLevel - 1) / 8) * 1.9;
    g()?.setLabelScale(mult - currentMult);
  };

  const changeDrawDistance = (delta: number) => {
    const next = Math.max(1, Math.min(9, drawLevel + delta));
    setDrawLevel(next);
    const density = 0.003 - ((next - 1) / 8) * 0.003;
    g()?.setFogDensity(density);
  };

  const BtnRow = ({
    label,
    children,
  }: {
    label: string;
    children: React.ReactNode;
  }) => (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <span className="text-[11px] text-muted2">{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );

  const ActionBtn = ({
    onClick,
    children,
    active,
    wide,
    disabled,
    className = "",
    style = {},
  }: {
    onClick: () => void;
    children: React.ReactNode;
    active?: boolean;
    wide?: boolean;
    disabled?: boolean;
    className?: string;
    style?: React.CSSProperties;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      style={style}
      className={`flex items-center justify-center gap-1.5 text-[10px] tracking-widest border rounded-lg transition-all duration-200 active:scale-95 ${wide ? "px-4 py-2" : "w-9 h-9"} ${
        disabled
          ? "opacity-50 cursor-not-allowed border-border2 text-muted2"
          : active
            ? "border-accent text-accent bg-accent/15"
            : "border-border2 text-muted2 hover:border-accent hover:text-accent hover:bg-accent/10"
      } ${className}`}
    >
      {children}
    </button>
  );

  return (
    <div className="p-5 space-y-1">
      <p className="text-[10px] text-muted tracking-widest uppercase mb-4">
        Graph Controls
      </p>

      <BtnRow label="Idle Rotation">
        <ActionBtn
          onClick={() => setIdleRotate(g()?.toggleAutoRotate() ?? false)}
          wide
          active={idleRotate}
        >
          <svg
            className={`w-3 h-3 ${idleRotate ? "animate-[spin_4s_linear_infinite]" : ""}`}
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path
              d="M6 1C3.24 1 1 3.24 1 6s2.24 5 5 5 5-2.24 5-5M8.5 2L11 3.5 8.5 5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {idleRotate ? "ON" : "OFF"}
        </ActionBtn>
      </BtnRow>

      <BtnRow label="Physics">
        <ActionBtn
          onClick={() =>
            setContinuousPhysics(g()?.toggleContinuousPhysics() ?? false)
          }
          wide
          active={continuousPhysics}
        >
          <svg
            className="w-3 h-3"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path
              d="M2 10s1.5-3 4-3 4 3 4 3M2 6s2-3 4-3 4 3 4 3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="6" cy="3" r="1.5" />
            <circle cx="2" cy="10" r="1" />
            <circle cx="10" cy="10" r="1" />
          </svg>
          {continuousPhysics ? "ON" : "OFF"}
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
              <input
                type="checkbox"
                checked={resetPositions}
                onChange={(e) => setResetPositions(e.target.checked)}
                className="accent-accent"
              />
              Positions
            </label>
            <label className="flex items-center gap-1.5 text-[10px] text-muted2 cursor-pointer hover:text-text transition-colors">
              <input
                type="checkbox"
                checked={resetColors}
                onChange={(e) => setResetColors(e.target.checked)}
                className="accent-accent"
              />
              Colors
            </label>
          </div>
          <ActionBtn
            onClick={handleReset}
            wide
            disabled={!originalGraphData || (!resetPositions && !resetColors)}
          >
            <svg
              className="w-3 h-3"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                d="M2.5 6a3.5 3.5 0 111.025 2.475M2.5 6V3.5M2.5 6h2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Reset to Original
          </ActionBtn>
        </div>
      </BtnRow>

      <BtnRow label="Original Data Save">
        <ActionBtn
          onClick={() => setAutoSave(!autoSave)}
          wide
          active={autoSave}
        >
          <svg
            className="w-3 h-3"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path
              d="M2 2h6l2 2v6a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M4 2v3h4V2M4 7h4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {autoSave ? "AUTO" : "MANUAL"}
        </ActionBtn>
      </BtnRow>

      <BtnRow label={`Label size · ${labelLevel}/9`}>
        <ActionBtn onClick={() => changeLabel(-1)}>
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M3 7h8" strokeLinecap="round" />
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
                background: i < labelLevel ? "var(--accent)" : "var(--border2)",
                opacity: i < labelLevel ? 1 : 0.5,
              }}
            />
          ))}
        </div>
        <ActionBtn onClick={() => changeLabel(1)}>
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M7 3v8M3 7h8" strokeLinecap="round" />
          </svg>
        </ActionBtn>
      </BtnRow>

      <BtnRow label={`Draw distance · ${drawLevel}/9`}>
        <ActionBtn onClick={() => changeDrawDistance(-1)}>
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M3 7h8" strokeLinecap="round" />
          </svg>
        </ActionBtn>
        <div className="flex items-end gap-0.5 h-5 w-12">
          {Array.from({ length: 9 }, (_, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm transition-all duration-150"
              style={{
                height: `${25 + i * 8}%`,
                background: i < drawLevel ? "var(--accent)" : "var(--border2)",
                opacity: i < drawLevel ? 1 : 0.5,
              }}
            />
          ))}
        </div>
        <ActionBtn onClick={() => changeDrawDistance(1)}>
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M7 3v8M3 7h8" strokeLinecap="round" />
          </svg>
        </ActionBtn>
      </BtnRow>

      <BtnRow label="Show Node Icons">
        <ActionBtn
          onClick={() => setShowNodeIcons(g()?.toggleNodeIcons() ?? true)}
          wide
          active={showNodeIcons}
        >
          <svg
            className="w-3 h-3"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path
              d="M6 10s3-2.5 3-5a3 3 0 10-6 0c0 2.5 3 5 3 5z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="6" cy="5" r="1" />
          </svg>
          {showNodeIcons ? "ON" : "OFF"}
        </ActionBtn>
      </BtnRow>

      <BtnRow label="Graph Growth Animation">
        <ActionBtn
          onClick={() => setGraphGrowthAnimation(!graphGrowthAnimation)}
          wide
          active={graphGrowthAnimation}
        >
          <svg
            className="w-3 h-3"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path
              d="M6 2v8M2 6h8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {graphGrowthAnimation ? "ON" : "OFF"}
        </ActionBtn>
      </BtnRow>

      <BtnRow label="Replay Growth">
        <ActionBtn
          onClick={() => graphRef.current?.triggerGrowExisting()}
          wide
        >
          <svg
            className="w-3 h-3"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M2 6a4 4 0 017-2.8M10 6a4 4 0 01-7 2.8" strokeLinecap="round" />
            <path d="M10 2v3h-3M2 10v-3h3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          REPLAY
        </ActionBtn>
      </BtnRow>

      <BtnRow label="Undo History">
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={10}
            max={500}
            step={10}
            value={Number(sessionStorage.getItem("undoMaxHistory") || "100")}
            onChange={(e) => {
              const val = e.target.value;
              sessionStorage.setItem("undoMaxHistory", val);
            }}
            className="w-20 accent-accent"
          />
          <span className="text-[10px] text-muted w-8 text-right">
            {sessionStorage.getItem("undoMaxHistory") || "100"}
          </span>
        </div>
      </BtnRow>

      <BtnRow label="Expand Instead of Replace">
        <ActionBtn
          onClick={() => setExpandReplace(!expandReplace)}
          wide
          active={expandReplace}
        >
          <svg
            className="w-3 h-3"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M6 1v10M1 6h10" strokeLinecap="round" />
          </svg>
          {expandReplace ? "EXPAND" : "REPLACE"}
        </ActionBtn>
      </BtnRow>

      <BtnRow label="Jiggle graph">
        <ActionBtn onClick={handleJiggle} wide active={jiggling}>
          <span className={jiggling ? "animate-spin inline-block" : ""}>✦</span>
          {jiggling ? "Jiggling…" : "Jiggle!"}
        </ActionBtn>
      </BtnRow>

      <BtnRow label={`Node spread · ${spreadLevel}/9`}>
        <ActionBtn
          onClick={() => {
            const next = Math.max(1, Math.min(9, spreadLevel - 1));
            setSpreadLevel(next);
            const mult = 0.3 + ((next - 1) / 8) * 2.7;
            g()?.setSpread(mult);
          }}
        >
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M3 7h8" strokeLinecap="round" />
          </svg>
        </ActionBtn>
        <div className="flex items-end gap-0.5 h-5 w-12">
          {Array.from({ length: 9 }, (_, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm transition-all duration-150"
              style={{
                height: `${25 + i * 8}%`,
                background:
                  i < spreadLevel ? "var(--accent)" : "var(--border2)",
                opacity: i < spreadLevel ? 1 : 0.5,
              }}
            />
          ))}
        </div>
        <ActionBtn
          onClick={() => {
            const next = Math.max(1, Math.min(9, spreadLevel + 1));
            setSpreadLevel(next);
            const mult = 0.3 + ((next - 1) / 8) * 2.7;
            g()?.setSpread(mult);
          }}
        >
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M7 3v8M3 7h8" strokeLinecap="round" />
          </svg>
        </ActionBtn>
      </BtnRow>

      <BtnRow label="Auto Layout">
        <ActionBtn onClick={() => g()?.applyHierarchyLayout()} wide>
          <svg
            className="w-3 h-3"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="6" cy="2" r="1.5" />
            <circle cx="2" cy="9" r="1.5" />
            <circle cx="10" cy="9" r="1.5" />
            <path d="M6 3.5v2M6 5.5l-3 2M6 5.5l3 2" strokeLinecap="round" />
          </svg>
          Hierarchy (for 2d graphs)
        </ActionBtn>
      </BtnRow>

      <BtnRow label="Randomize positions">
        <ActionBtn onClick={() => g()?.randomizePositions()} wide>
          <svg
            className="w-3 h-3"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path
              d="M1 4h2l1-2 2 6 2-4 1 2h2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M8.5 9.5l1.5-1.5-1.5-1.5M10 8H8" strokeLinecap="round" />
          </svg>
          Scatter
        </ActionBtn>
      </BtnRow>

      <BtnRow label="Edge Hover Select">
        <ActionBtn
          onClick={() => setEdgeHover(g()?.toggleEdgeHover() ?? false)}
          wide
          active={edgeHover}
        >
          <svg
            className="w-3 h-3"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path
              d="M2.5 9.5l7-7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="2.5" cy="9.5" r="1.5" />
            <circle cx="9.5" cy="2.5" r="1.5" />
          </svg>
          {edgeHover ? "ON" : "OFF"}
        </ActionBtn>
      </BtnRow>

      <BtnRow label="Edge Dragging">
        <ActionBtn
          onClick={() => setEdgeDrag(g()?.toggleEdgeDrag() ?? false)}
          wide
          active={edgeDrag}
        >
          <svg
            className="w-3 h-3"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M1 6 L11 6" strokeLinecap="round" />
            <path
              d="M9 4l2 2-2 2M3 8L1 6l2-2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {edgeDrag ? "ON" : "OFF"}
        </ActionBtn>
      </BtnRow>

      <BtnRow label="UI Animations">
        <ActionBtn
          onClick={onToggleUiAnimations || (() => {})}
          wide
          active={uiAnimations}
        >
          <svg
            className="w-3 h-3"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M2 2l8 8M10 2l-8 8" strokeLinecap="round" />
          </svg>
          {uiAnimations ? "ON" : "OFF"}
        </ActionBtn>
      </BtnRow>

      <BtnRow label="Randomize colours">
        <ActionBtn onClick={() => g()?.randomizeColors()} wide>
          <svg
            className="w-3 h-3"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="4" cy="4" r="2" />
            <circle cx="8" cy="4" r="2" />
            <circle cx="6" cy="8" r="2" />
          </svg>
          Recolour
        </ActionBtn>
      </BtnRow>

      <div className="mt-4 px-1 pb-4">
        <p className="text-[10px] text-muted2 leading-relaxed text-center">
          When Lock Camera is enabled, right-click a node to smoothly lock your
          view to it. Pan to break lock.
        </p>
      </div>

      <div className="mt-6 pt-4 border-t border-border">
        <p className="text-[10px] text-muted tracking-widest uppercase mb-3">
          Keyboard shortcuts
        </p>
        <p className="text-[10px] text-muted tracking-widest uppercase mb-3">
          Graph View
        </p>
        {[
          ["Click node", "Focus node & expand related topics"],
          ["Click graph name", "Rename graph"],
          ["Double click name", "Rename node"],
          ["Right click node", "Edit node"],
          ["Right click empty space", "Add node"],
          ["Middle click node", "Lock camera to node (no selection)"],
          ["Middle click empty space", "Unlock camera"],
          ["Drag / Middle drag", "Rotate camera"],
          ["Right drag / Shift + drag", "Pan camera"],
          ["Scroll / Middle drag", "Zoom camera"],
          ["Arrow keys", "Pan camera"],
          ["Shift + Arrow keys", "Rotate camera"],
        ].map(([key, desc]) => (
          <div
            key={key}
            className="flex justify-between items-center py-1.5 border-b border-border last:border-0"
          >
            <span className="text-[10px] font-mono text-accent2 bg-accent2/10 px-1.5 py-0.5 rounded">
              {key}
            </span>
            <span className="text-[11px] text-muted2">{desc}</span>
          </div>
        ))}
        <br></br>
        <p className="text-[10px] text-muted tracking-widest uppercase mb-3">
          Edit Mode
        </p>
        {[
          ["Click node", "Add node attached to clicked node"],
          [
            "Shift + Drag node",
            "Drag to create new node attached to dragged node",
          ],
          ["Middle click node", "Lock camera to node"],
          ["Middle click empty space", "Unlock camera"],
          ["Drag / Middle drag", "Rotate camera"],
          ["Shift + drag / Right drag", "Pan camera"],
          ["Right drag", "Pan camera"],
          ["Scroll / Middle drag", "Zoom camera"],
          ["Arrow keys", "Pan camera"],
          ["Shift + Arrow keys", "Rotate camera"],
        ].map(([key, desc]) => (
          <div
            key={key}
            className="flex justify-between items-center py-1.5 border-b border-border last:border-0"
          >
            <span className="text-[10px] font-mono text-accent2 bg-accent2/10 px-1.5 py-0.5 rounded">
              {key}
            </span>
            <span className="text-[11px] text-muted2">{desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Prompt Tab ────────────────────────────────────────────────────────────────
function PromptTab({
  copied,
  onCopy,
}: {
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="p-5">
      <p className="text-[10px] text-muted tracking-widest uppercase mb-2.5">
        Copy this prompt
      </p>
      <p className="text-[11px] text-muted2 leading-relaxed mb-4">
        Use with Claude, ChatGPT, Gemini — any AI. Swap the topic at the end.
      </p>
      <pre className="bg-surface2 border border-border2 rounded-lg p-3.5 text-[10.5px] text-muted2 leading-relaxed font-mono whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
        {AI_PROMPT}
      </pre>
      <button
        onClick={onCopy}
        className={`mt-2.5 w-full flex items-center justify-center gap-1.5 text-[10px] tracking-widest py-2 rounded-md border transition-all duration-200 ${
          copied
            ? "border-[#4ade80] text-[#4ade80]"
            : "border-border2 text-muted2 hover:border-accent hover:text-accent hover:bg-accent/10"
        }`}
      >
        {copied ? "✓ Copied!" : "Copy Prompt"}
      </button>
      <div className="h-px bg-border my-5" />
      <p className="text-[10px] text-muted tracking-widest uppercase mb-3">
        Example topics
      </p>
      <div className="flex flex-wrap gap-1.5">
        {EXAMPLE_TOPICS.map((topic) => (
          <span
            key={topic}
            className="text-[10px] text-muted2 bg-surface2 border border-border px-2.5 py-1 rounded-full"
          >
            ``
            {topic}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Paste Tab ─────────────────────────────────────────────────────────────────
function PasteTab({
  value,
  onChange,
  error,
  onGenerate,
}: {
  value: string;
  onChange: (v: string) => void;
  error: string | null;
  onGenerate: () => void;
}) {
  return (
    <div className="p-5">
      <p className="text-[10px] text-muted tracking-widest uppercase mb-2">
        Paste AI output here
      </p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          'Paste the JSON from Claude / ChatGPT here...\n\n{\n  "title": "...",\n  "nodes": [...]\n}'
        }
        className="w-full min-h-[220px] resize-y bg-surface2 border border-border2 rounded-lg text-[11px] text-text font-mono leading-relaxed p-3.5 outline-none transition-colors placeholder-muted focus:border-accent"
        style={{ userSelect: "text" }}
      />
      {error && (
        <p className="text-[10px] text-[#f87171] mt-2 leading-relaxed whitespace-pre-wrap">
          {error}
        </p>
      )}
      <button
        onClick={onGenerate}
        className="mt-3 w-full py-2.5 bg-accent text-white text-[11px] tracking-widest font-medium rounded-lg hover:bg-[#6a58e8] transition-all duration-200 hover:-translate-y-px active:translate-y-0"
      >
        ✦ Generate Graph
      </button>
      <div className="mt-4 bg-surface2 border border-border rounded-lg p-3.5 text-[10px] text-muted2 leading-[1.8]">
        <strong className="text-text block mb-1.5">Expected shape</strong>
        Each node needs:{" "}
        {[
          "id",
          "label",
          "icon",
          "hex",
          "category",
          "content",
          "connections[]",
        ].map((f) => (
          <code
            key={f}
            className="text-accent2 bg-accent2/10 px-1 py-0.5 rounded mx-0.5"
          >
            {f}
          </code>
        ))}
      </div>
    </div>
  );
}

// ── Info Tab ──────────────────────────────────────────────────────────────────
function InfoTab({
  graphData,
  linkCount,
}: {
  graphData: GraphData;
  linkCount: number;
}) {
  const cats = [...new Set(graphData.nodes.map((n) => n.category))];
  return (
    <div className="p-5 space-y-5">
      <section>
        <h4 className="text-[10px] tracking-widest text-muted uppercase mb-2.5">
          Current graph
        </h4>
        {[
          { label: "Title", value: graphData.title },
          { label: "Nodes", value: graphData.nodes.length },
          { label: "Edges", value: linkCount },
          { label: "Categories", value: cats.length },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="flex justify-between items-center py-1.5 border-b border-border last:border-0"
          >
            <span className="text-[11px] text-muted2">{label}</span>
            <span className="text-[11px] text-text font-medium">{value}</span>
          </div>
        ))}
      </section>
      <section>
        <h4 className="text-[10px] tracking-widest text-muted uppercase mb-2.5">
          Nodes
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {graphData.nodes.map((n) => (
            <span
              key={n.id}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] border"
              style={{
                color: n.hex,
                borderColor: `${n.hex}33`,
                background: `${n.hex}11`,
              }}
            >
              {n.icon} {n.label}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}

// ── Data Edit Tab ─────────────────────────────────────────────────────────────
function DataEditTab({
  graphData,
  onGraphChange,
}: {
  graphData: GraphData;
  onGraphChange: (d: GraphData) => void;
}) {
  const [jsonStr, setJsonStr] = useState(() =>
    JSON.stringify(graphData, null, 2),
  );
  const [err, setErr] = useState<string | null>(null);

  // Sync if graph changes externally (e.g., node rename via 3D double click)
  useEffect(() => {
    setJsonStr(JSON.stringify(graphData, null, 2));
  }, [graphData]);

  const handleApply = () => {
    setErr(null);
    const { data, error } = parseGraphJSON(jsonStr);
    if (error) {
      setErr(error);
      return;
    }
    if (data) {
      onGraphChange(data);
    }
  };

  return (
    <div className="p-5 flex flex-col h-full">
      <p className="text-[10px] text-muted tracking-widest uppercase mb-2">
        Edit Graph JSON
      </p>
      <textarea
        value={jsonStr}
        onChange={(e) => setJsonStr(e.target.value)}
        className="flex-1 min-h-[300px] bg-surface2 border border-border2 rounded-lg text-[11px] text-text font-mono leading-relaxed p-3.5 outline-none transition-colors placeholder-muted focus:border-accent"
        style={{ userSelect: "text" }}
        spellCheck={false}
      />
      {err && (
        <p className="text-[10px] text-[#f87171] mt-2 leading-relaxed whitespace-pre-wrap">
          {err}
        </p>
      )}
      <button
        onClick={handleApply}
        className="mt-3 w-full py-2.5 bg-accent text-white text-[11px] tracking-widest font-medium rounded-lg hover:bg-[#6a58e8] transition-all duration-200 hover:-translate-y-px active:translate-y-0"
      >
        Apply Changes
      </button>
    </div>
  );
}

// ── AI Chat Tab ───────────────────────────────────────────────────────────────
const AI_FUNCTION_URL =
  "https://trxpofoucgdytlhovrkq.supabase.co/functions/v1/ai";
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyeHBvZm91Y2dkeXRsaG92cmtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNzQyNjcsImV4cCI6MjA4OTc1MDI2N30.FDM-GQl4u1OdkwfduQCQLxOBRTk9cHOvlHJlLojjVoA";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_MODEL_FAST = "llama-3.1-8b-instant";
const LONG_PROMPT_THRESHOLD = 200;
const ENABLE_PDF_ATTACHMENTS = import.meta.env.VITE_ENABLE_PDF_ATTACHMENTS === "true";

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
- the graph should feel like Obsidian: a web of related ideas`;

const PDF_SYSTEM_PROMPT = `You are a knowledge-graph JSON generator. The user provides PDF/document context along with a topic or prompt. You MUST reply with a single, valid JSON object — no markdown, no explanation, no text outside the JSON.

Schema (follow exactly):
{"title":"Topic","nodes":[{"id":"snake_case_id","label":"Display Name","icon":"single_emoji","hex":"#hexcolor","category":"core|concept|example|resource|layer","content":"HTML string with <strong> tags. 2-3 paragraphs separated by <br><br>.","connections":["other_id"]}]}

CRITICAL JSON rules:
- Every string value MUST be enclosed in double quotes
- Inside strings, escape double quotes as \\" and use <br><br> for line breaks (NO literal newlines inside strings)
- HTML tags like <strong> and <br> go INSIDE the quoted string values, properly
- All keys must be double-quoted
- No trailing commas

Content rules:
- Base node content on the provided document context — extract key concepts, facts, and relationships
- 8-14 nodes (unless user says otherwise)
- connections reference valid ids; bidirectional (list once)
- distinct hex colors per category; no white/black
- icons: one relevant emoji per node
- content: minimum 3 sentences, use <strong> for key terms, separate paragraphs with <br><br>
- every node has at least 2 connections
- the graph should feel like Obsidian: a web of related ideas
- Prioritize information from the document context over general knowledge`;

type AIMode = "generate" | "append" | "update" | "remove";
type StreamStage = "idle" | "connecting" | "streaming" | "parsing" | "rendering";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  nodeCount?: number;
  attachment?: string;
}

function AiChatTab({
  onGraphChange,
  graphRef,
  graphData,
}: {
  onGraphChange: (data: GraphData) => void;
  graphRef: React.RefObject<GraphHandle | null>;
  graphData: GraphData;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Type a topic and I'll generate a knowledge graph for you! You can also specify preferences like number of nodes.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamStage, setStreamStage] = useState<StreamStage>("idle");
  const [liveNodeCount, setLiveNodeCount] = useState(0);
  const [aiMode, setAiMode] = useState<AIMode>("generate");
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [authToast, setAuthToast] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<
    { name: string; content: string; parsing: boolean; error?: string }[]
  >([]);
  const [dragOver, setDragOver] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const lastNodeCountRef = useRef<number>(0);
  const manualSignOutRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const parsingRef = useRef(0);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const refreshAuthUser = useCallback(async () => {
    const user = await getSupabaseUser();
    setSignedInEmail(user?.email ?? null);
    setIsAuthChecking(false);
  }, []);

  useEffect(() => {
    refreshAuthUser();
  }, [refreshAuthUser]);

  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((event, session) => {
      setSignedInEmail(session?.user?.email ?? null);

      if (event === "SIGNED_OUT") {
        const wasManual = manualSignOutRef.current;
        manualSignOutRef.current = false;
        if (!wasManual) {
          setAuthToast("Session expired, please sign in again.");
        }
      }

      if (event === "TOKEN_REFRESHED") {
        setAuthError(null);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!authToast) return;
    const t = setTimeout(() => setAuthToast(null), 2800);
    return () => clearTimeout(t);
  }, [authToast]);

  const handleSignIn = async () => {
    if (!authEmail.trim() || !authPassword) {
      setAuthError("Enter email and password.");
      return;
    }
    setIsAuthLoading(true);
    setAuthError(null);
    const { error } = await signInWithPassword(authEmail.trim(), authPassword);
    if (error) {
      setAuthError(error.message);
    } else {
      setAuthPassword("");
      await refreshAuthUser();
    }
    setIsAuthLoading(false);
  };

  const handleSignUp = async () => {
    if (!authEmail.trim() || !authPassword) {
      setAuthError("Enter email and password.");
      return;
    }
    setIsAuthLoading(true);
    setAuthError(null);
    const { error } = await signUpWithPassword(authEmail.trim(), authPassword);
    if (error) {
      setAuthError(error.message);
    } else {
      setAuthPassword("");
      setAuthError("Account created. Check email if confirmation is enabled.");
      await refreshAuthUser();
    }
    setIsAuthLoading(false);
  };

  const handleSignOut = async () => {
    setIsAuthLoading(true);
    setAuthError(null);
    manualSignOutRef.current = true;
    const { error } = await signOutSupabase();
    if (error) {
      setAuthError(error.message);
      manualSignOutRef.current = false;
    }
    await refreshAuthUser();
    setIsAuthLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!authEmail.trim()) {
      setAuthError("Enter your email address.");
      return;
    }
    setIsAuthLoading(true);
    setAuthError(null);
    const { error } = await resetPassword(authEmail.trim());
    if (error) {
      setAuthError(error.message);
    } else {
      setResetEmailSent(true);
    }
    setIsAuthLoading(false);
  };

  const handleFiles = async (fileList: FileList | File[]) => {
    const accepted = Array.from(fileList).filter((f) =>
      /\.(pdf|md|txt|text)$/i.test(f.name),
    );
    if (accepted.length === 0) return;

    // Add placeholder chips immediately
    const placeholders = accepted.map((f) => ({
      name: f.name,
      content: "",
      parsing: true,
    }));
    setAttachedFiles((prev) => [...prev, ...placeholders]);

    // Parse each file and update by name (avoids stale index bugs)
    for (const file of accepted) {
      parsingRef.current++;
      try {
        let content: string;
        if (/\.pdf$/i.test(file.name)) {
          content = await parsePDF(file);
        } else {
          content = await parseTextFile(file);
        }
        setAttachedFiles((prev) =>
          prev.map((f) =>
            f.name === file.name && f.parsing
              ? { name: file.name, content, parsing: false }
              : f,
          ),
        );
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to parse file";
        console.error(`[FileAttach] Failed to parse ${file.name}:`, err);
        setAttachedFiles((prev) =>
          prev.map((f) =>
            f.name === file.name && f.parsing
              ? { name: file.name, content: "", parsing: false, error: msg }
              : f,
          ),
        );
      } finally {
        parsingRef.current--;
      }
    }
  };

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const sendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isStreaming || parsingRef.current > 0) return;

    const userText = input.trim();
    const hasFiles = attachedFiles.some((f) => !f.error && !f.parsing);
    const fileNames = hasFiles
      ? attachedFiles
          .filter((f) => !f.error && !f.parsing)
          .map((f) => f.name)
          .join(", ")
      : undefined;
    const userMsg: ChatMessage = {
      role: "user",
      content: userText,
      attachment: fileNames,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);
    setStreamStage("connecting");
    setLiveNodeCount(0);
    lastNodeCountRef.current = 0;

    // Add a placeholder assistant message
    const assistantMsg: ChatMessage = {
      role: "assistant",
      content: "✦ Connecting…",
      nodeCount: 0,
    };
    setMessages((prev) => [...prev, assistantMsg]);

    const controller = new AbortController();
    abortRef.current = controller;

    const isExpand = sessionStorage.getItem("expandReplace") === "true";
    const actualMode = aiMode === "generate" && isExpand ? "append" : aiMode;

    let contextualPrompt = hasFiles ? PDF_SYSTEM_PROMPT : SYSTEM_PROMPT;
    if (actualMode === "append") {
      contextualPrompt += `\n\nAPPEND MODE: The user has an existing graph with nodes: ${graphData.nodes.map((n) => n.id).join(", ")}. Generate NEW nodes to append to this graph. You may connect new nodes to the existing node IDs.`;
    } else if (actualMode === "update") {
      contextualPrompt += `\n\nUPDATE MODE: The user has existing nodes: ${JSON.stringify(graphData.nodes.map((n) => ({ id: n.id, label: n.label, category: n.category })))}\nProvide the exact JSON schema containing ONLY the nodes you want to modify, passing their exact 'id' to overwrite their contents, connections, and colors.`;
    } else if (actualMode === "remove") {
      contextualPrompt += `\n\nREMOVE MODE: The user has existing nodes: ${JSON.stringify(graphData.nodes.map((n) => ({ id: n.id, label: n.label })))}\nProvide the exact JSON schema containing ONLY the nodes you want to DELETE. (The application will read these IDs and permanently remove them).`;
    }

    // Chunk all file content
    let chunks: { fileName: string; text: string }[] = [];
    if (hasFiles) {
      const validFiles = attachedFiles.filter((f) => !f.error && !f.parsing);
      for (const f of validFiles) {
        const fileChunks = chunkText(f.content);
        for (const c of fileChunks) {
          chunks.push({ fileName: f.name, text: c });
        }
      }
      setAttachedFiles([]);
    }

    // Helper: make one streaming API call and return parsed graph data
    const callChunkAPI = async (
      systemPrompt: string,
      message: string,
      signal: AbortSignal,
      model: string = GROQ_MODEL,
    ): Promise<GraphData | null> => {
      const userAccessToken = await getSupabaseAccessToken();

      const response = await fetch(AI_FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY!,
          ...(userAccessToken ? { Authorization: `Bearer ${userAccessToken}` } : {}),
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message },
          ],
          response_format: { type: "json_object" },
          stream: true,
        }),
        signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        let errData: any = null;
        try { errData = errText ? JSON.parse(errText) : null; } catch { /* */ }
        throw new Error(
          errData?.error?.message || errData?.error || errData?.message || errText || `API error ${response.status}`,
        );
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      setStreamStage("streaming");
      const decoder = new TextDecoder();
      let streamDone = false;
      let lineBuffer = "";
      let fullBuffer = "";

      while (!streamDone) {
        const { value, done } = await reader.read();
        streamDone = done;
        if (!value) continue;

        lineBuffer += decoder.decode(value, { stream: true });
        const lines = lineBuffer.split("\n");
        lineBuffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim().startsWith("data:")) continue;
          const jsonStr = line.replace(/^data:\s*/, "").trim();
          if (jsonStr === "[DONE]") { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) fullBuffer += delta;
          } catch { /* ignore */ }
        }
      }

      setStreamStage("parsing");
      const result = tryRepairAndParse(fullBuffer);
      if (result.data) return result.data;

      const strict = parseGraphJSON(fullBuffer);
      return strict.data ?? null;
    };

    // Helper: merge new nodes into accumulator, skip duplicates
    const mergeGraphs = (
      accumulator: GraphData,
      newData: GraphData,
    ): GraphData => {
      const existingIds = new Set(accumulator.nodes.map((n) => n.id));
      const newNodes = newData.nodes.filter((n) => !existingIds.has(n.id));
      return {
        ...accumulator,
        title: accumulator.title || newData.title,
        nodes: [...accumulator.nodes, ...newNodes],
      };
    };

    try {
      if (!SUPABASE_ANON_KEY) throw new Error("Missing VITE_SUPABASE_ANON_KEY in .env");

      // Helper: grow graph incrementally node-by-node (BFS order)
      const growGraphIncremental = async (data: GraphData) => {
        if (!graphRef.current) return;

        // BFS ordering from most-connected node
        const nodes = data.nodes;
        const root = [...nodes].sort(
          (a, b) => b.connections.length - a.connections.length,
        )[0];
        const visited = new Set<string>();
        const queue = [root.id];
        const ordered: typeof nodes = [];
        visited.add(root.id);
        while (queue.length > 0) {
          const id = queue.shift()!;
          const node = nodes.find((n) => n.id === id);
          if (!node) continue;
          ordered.push(node);
          for (const cid of node.connections) {
            if (!visited.has(cid) && nodes.find((n) => n.id === cid)) {
              visited.add(cid);
              queue.push(cid);
            }
          }
        }
        for (const n of nodes) {
          if (!visited.has(n.id)) ordered.push(n);
        }

        // Clear the graph by loading empty data
        const freshData = graphRef.current.getFreshData();
        // Use appendNodes with the full dataset after a direct clear
        // We clear by removing all existing nodes
        const existingIds = freshData.nodes.map((n) => n.id);
        if (existingIds.length > 0) {
          graphRef.current.removeNodes(existingIds);
        }

        // Add nodes one by one with BFS ordering
        for (let i = 0; i < ordered.length; i++) {
          if (controller.signal.aborted) break;
          graphRef.current.appendNodes({
            title: data.title,
            nodes: [ordered[i]],
          });
          setLiveNodeCount(i + 1);
          if (i < ordered.length - 1) {
            await new Promise((r) => setTimeout(r, 200));
          }
        }

        // Sync React state with the final graph
        onGraphChange(data);
      };

      const animateGrow =
        sessionStorage.getItem("graphGrowthAnimation") !== "false";

      // Select model: fast model for files or long prompts
      const useFastModel = hasFiles || userText.length > LONG_PROMPT_THRESHOLD;
      const model = useFastModel ? GROQ_MODEL_FAST : GROQ_MODEL;

      if (!hasFiles || chunks.length === 0) {
        // ── No files: single streaming call (original behavior) ──
        const data = await callChunkAPI(contextualPrompt, userText, controller.signal, model);
        if (data) {
          if (actualMode === "generate") {
            if (animateGrow) {
              await growGraphIncremental(data);
            } else {
              onGraphChange(data);
            }
          } else if (actualMode === "append") { graphRef.current?.appendNodes(data); graphRef.current?.updateNodes(data.nodes); }
          else if (actualMode === "update") graphRef.current?.updateNodes(data.nodes);
          else if (actualMode === "remove") graphRef.current?.removeNodes(data.nodes.map((n) => n.id));
          setStreamStage("rendering");
          setLiveNodeCount(data.nodes.length);
          setMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = {
              role: "assistant",
              content: `✦ Generated "${data.title}" — ${data.nodes.length} nodes`,
              nodeCount: data.nodes.length,
            };
            return copy;
          });
        } else {
          setMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = {
              role: "assistant",
              content: "⚠ Could not parse graph from AI response.",
            };
            return copy;
          });
        }
      } else {
        // ── Files: process each chunk sequentially ──
        let merged: GraphData = { title: "", nodes: [] };
        const totalChunks = chunks.length;

        for (let i = 0; i < chunks.length; i++) {
          if (controller.signal.aborted) break;
          const { fileName, text } = chunks[i];

          // Update chat message with progress
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last.role === "assistant") {
              copy[copy.length - 1] = {
                ...last,
                content: totalChunks > 1
                  ? `✦ Processing chunk ${i + 1}/${totalChunks} — ${fileName}`
                  : `✦ Processing ${fileName}…`,
              };
            }
            return copy;
          });

          // Build chunk-specific prompt
          const existingIds = merged.nodes.map((n) => n.id);
          let chunkPrompt = contextualPrompt;
          if (existingIds.length > 0) {
            chunkPrompt += `\n\nEXISTING NODES (do NOT duplicate these, you may reference them in connections): ${existingIds.join(", ")}`;
          }
          chunkPrompt += `\n\nFILE CONTEXT (from "${fileName}", chunk ${i + 1}/${totalChunks}):\n${text}`;

          const data = await callChunkAPI(
            chunkPrompt,
            existingIds.length > 0
              ? `Continue building the knowledge graph from this document section. The user's focus: ${userText}`
              : userText,
            controller.signal,
            model,
          );

          if (data) {
            merged = mergeGraphs(merged, data);

            // Incremental update — show nodes appearing in real time
            setLiveNodeCount(merged.nodes.length);
            lastNodeCountRef.current = merged.nodes.length;
            if (actualMode === "generate" && !animateGrow) onGraphChange(merged);
            else graphRef.current?.appendNodes(merged);
          }
        }

        // Final sync
        if (actualMode === "generate" && animateGrow) {
          // Delay slightly to let the last append animation finish
          await new Promise((r) => setTimeout(r, 300));
          onGraphChange(merged);
        }

        setStreamStage("rendering");
        setLiveNodeCount(merged.nodes.length);
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = {
            role: "assistant",
            content: `✦ Generated "${merged.title}" — ${merged.nodes.length} nodes (from ${totalChunks} chunks)`,
            nodeCount: merged.nodes.length,
          };
          return copy;
        });
      }
    } catch (err: unknown) {
      if ((err as Error).name !== "AbortError") {
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = {
            role: "assistant",
            content: `⚠ Error: ${(err as Error).message}`,
          };
          return copy;
        });
      } else {
        // User cancelled
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last.role === "assistant") {
            copy[copy.length - 1] = {
              ...last,
              content: `✦ Cancelled${liveNodeCount > 0 ? ` — ${liveNodeCount} node${liveNodeCount !== 1 ? "s" : ""} generated` : ""}`,
              nodeCount: liveNodeCount > 0 ? liveNodeCount : undefined,
            };
          }
          return copy;
        });
      }
    } finally {
      setIsStreaming(false);
      setStreamStage("idle");
      abortRef.current = null;
    }
  };

  return (
    <div className="flex flex-col h-full" style={{ minHeight: 0 }}>
      {/* Messages area */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-3"
        style={{ minHeight: 0 }}
      >
        <div className="border border-border rounded-xl bg-surface2 p-3">
          {/* Auth disabled — AI works without sign-in */}
        </div>

        <AnimatePresence>
          {authToast && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="text-[10px] rounded-lg border border-[#f87171]/30 bg-[#f87171]/10 text-[#f87171] px-3 py-2"
            >
              {authToast}
            </motion.div>
          )}
        </AnimatePresence>

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-[11.5px] leading-relaxed ${
                msg.role === "user"
                  ? "bg-accent text-white rounded-br-md"
                  : "bg-surface2 text-text border border-border rounded-bl-md"
              }`}
            >
              {msg.content}
              {msg.attachment && (
                <div className="mt-1 flex items-center gap-1 text-[9px] opacity-70">
                  <svg
                    className="w-2.5 h-2.5"
                    viewBox="0 0 14 14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M11.5 7.5l-5.3 5.3a2.1 2.1 0 01-3-3l6.4-6.4a1.4 1.4 0 012 2L5.2 11.7a.7.7 0 01-1-1l4.3-4.3" />
                  </svg>
                  {msg.attachment}
                </div>
              )}
              {msg.role === "assistant" &&
                msg.nodeCount !== undefined &&
                msg.nodeCount > 0 && (
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
            <div className="flex flex-col gap-1.5 px-3.5 py-2.5 bg-surface2 border border-border rounded-xl rounded-bl-md min-w-[160px]">
              {/* Stage indicators */}
              <div className="flex items-center gap-2">
                {(["connecting", "streaming", "parsing", "rendering"] as StreamStage[]).map(
                  (stage, idx) => {
                    const labels = ["Connecting", "Streaming", "Parsing", "Rendering"];
                    const isActive = streamStage === stage;
                    const isPast =
                      ["connecting", "streaming", "parsing", "rendering"].indexOf(streamStage) > idx;
                    return (
                      <div key={stage} className="flex items-center gap-1">
                        {idx > 0 && (
                          <div
                            className={`w-3 h-px transition-colors duration-300 ${
                              isPast ? "bg-accent" : "bg-border2"
                            }`}
                          />
                        )}
                        <div className="flex items-center gap-1">
                          <div
                            className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                              isActive
                                ? "bg-accent animate-pulse scale-110"
                                : isPast
                                  ? "bg-accent/60"
                                  : "bg-border2"
                            }`}
                          />
                          <span
                            className={`text-[8px] tracking-wider uppercase transition-colors duration-300 ${
                              isActive
                                ? "text-accent"
                                : isPast
                                  ? "text-muted"
                                  : "text-border2"
                            }`}
                          >
                            {labels[idx]}
                          </span>
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
              {/* Node counter */}
              {liveNodeCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="flex gap-0.5">
                    {Array.from({ length: Math.min(liveNodeCount, 12) }, (_, j) => (
                      <span
                        key={j}
                        className="inline-block w-1 h-1 rounded-full bg-accent/70"
                        style={{ animation: `fadeIn 0.2s ease ${j * 50}ms both` }}
                      />
                    ))}
                    {liveNodeCount > 12 && (
                      <span className="text-[8px] text-muted ml-0.5">+{liveNodeCount - 12}</span>
                    )}
                  </div>
                  <span className="text-[8px] text-muted">
                    {liveNodeCount} node{liveNodeCount !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Example topics */}
      {messages.length <= 1 && attachedFiles.length === 0 && (
        <div className="px-4 pb-2">
          <p className="text-[9px] text-muted tracking-widest uppercase mb-2">
            Try a topic
          </p>
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLE_TOPICS.slice(0, 6).map((topic) => (
              <button
                key={topic}
                onClick={() => {
                  setInput(topic);
                }}
                className="text-[10px] text-muted2 bg-surface2 border border-border px-2.5 py-1 rounded-full hover:border-accent hover:text-accent transition-all duration-200"
              >
                {topic}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* File attachment chips — shown above input */}
      {ENABLE_PDF_ATTACHMENTS && (
        <AnimatePresence>
          {attachedFiles.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="px-4 pb-1.5 flex flex-wrap gap-1.5"
            >
              {attachedFiles.map((file, i) => (
                <motion.div
                  key={file.name + i}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] border ${
                    file.error
                      ? "bg-[#f87171]/10 border-[#f87171]/30 text-[#f87171]"
                      : file.parsing
                        ? "bg-accent/10 border-accent/30 text-accent"
                        : "bg-surface2 border-border text-muted2"
                  }`}
                >
                  {/* File icon */}
                  <svg
                    className="w-3 h-3 flex-shrink-0"
                    viewBox="0 0 14 14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M8.5 1.5H3.5A1.5 1.5 0 002 3v8a1.5 1.5 0 001.5 1.5h7A1.5 1.5 0 0012 11V5.5L8.5 1.5z" />
                    <polyline points="8.5 1.5 8.5 5.5 12 5.5" />
                  </svg>

                  {/* Filename / status */}
                  {file.parsing ? (
                    <span className="animate-pulse">
                      {file.name}
                      <span className="inline-block ml-1 animate-spin">⏳</span>
                    </span>
                  ) : file.error ? (
                    <span title={file.error}>{file.name} — error</span>
                  ) : (
                    <span>{file.name}</span>
                  )}

                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="ml-0.5 hover:opacity-80 transition-opacity"
                  >
                    <svg
                      className="w-2.5 h-2.5"
                      viewBox="0 0 10 10"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    >
                      <line x1="2" y1="2" x2="8" y2="8" />
                      <line x1="8" y1="2" x2="2" y2="8" />
                    </svg>
                  </button>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Input area */}
      <div
        className="relative border-t border-border flex-shrink-0"
        onDragOver={ENABLE_PDF_ATTACHMENTS ? (e: any) => { e.preventDefault(); setDragOver(true); } : undefined}
        onDragLeave={ENABLE_PDF_ATTACHMENTS ? () => setDragOver(false) : undefined}
        onDrop={ENABLE_PDF_ATTACHMENTS ? (e: any) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
        } : undefined}
      >
        {/* Drag-and-drop overlay */}
        {ENABLE_PDF_ATTACHMENTS && (
          <AnimatePresence>
            {dragOver && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-20 bg-accent/10 border-2 border-dashed border-accent flex items-center justify-center rounded"
              >
                <span className="text-[10px] text-accent tracking-widest uppercase">
                  Drop .pdf / .md / .txt here
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        )}

        <AnimatePresence>
          {showModeDropdown && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-[calc(100%+0.5rem)] right-4 flex flex-col bg-surface border border-border2 rounded-lg shadow-xl overflow-hidden z-10 w-32"
            >
              {(["generate", "append", "update", "remove"] as AIMode[]).map(
                (m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setAiMode(m);
                      setShowModeDropdown(false);
                    }}
                    className={`px-4 py-2 text-[10px] tracking-widest uppercase text-left hover:bg-surface2 transition-colors ${m === aiMode ? "text-accent font-medium bg-accent/5" : "text-muted"}`}
                  >
                    {m}
                  </button>
                ),
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hidden file input */}
        {ENABLE_PDF_ATTACHMENTS && (
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.md,.txt,.text"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        )}

        <form
          className="flex items-center gap-2 px-4 py-3 min-w-0"
          onSubmit={sendMessage}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Type a topic to ${aiMode}…`}
            disabled={isStreaming}
            className="flex-1 min-w-0 bg-surface2 border border-border2 rounded-lg text-[11px] text-text px-3 py-2 outline-none placeholder-muted transition-colors focus:border-accent"
          />

          {/* Attach file button — paperclip icon */}
          {ENABLE_PDF_ATTACHMENTS && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming}
              className="flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-lg bg-surface2 border border-border2 text-muted hover:border-accent hover:text-accent transition-all duration-200 disabled:opacity-30"
              title="Attach file (.pdf, .md, .txt)"
            >
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M11 6.5l-5.3 5.3a2.1 2.1 0 01-3-3l6.4-6.4a1.4 1.4 0 012 2L4.7 10.7a.7.7 0 01-1-1l4.3-4.3" />
              </svg>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowModeDropdown(!showModeDropdown)}
            className={`flex items-center justify-center flex-shrink-0 h-8 px-2 rounded-lg border transition-all duration-200 ${showModeDropdown ? "bg-surface2 border-accent text-accent" : "bg-surface2 border-border2 text-muted hover:border-accent hover:text-accent"}`}
            title="Set Response Mode"
          >
            <span className="text-[9px] uppercase tracking-widest font-medium w-14 text-center">
              {aiMode}
            </span>
          </button>
          {isStreaming ? (
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-red/15 text-[#f87171] border border-[#f87171]/30 hover:bg-red/25 transition-all duration-200"
              title="Stop"
            >
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 14 14"
                fill="currentColor"
              >
                <rect x="3" y="3" width="8" height="8" rx="1" />
              </svg>
            </button>
          ) : (
            <button
              type="submit"
              disabled={
                !input.trim() ||
                parsingRef.current > 0
              }
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent text-white disabled:opacity-30 hover:bg-[#6a58e8] transition-all duration-200 disabled:hover:bg-accent"
              title="Send"
            >
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="2" x2="6" y2="8" />
                <polygon points="12 2 8 12 6 8 2 6 12 2" />
              </svg>
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
