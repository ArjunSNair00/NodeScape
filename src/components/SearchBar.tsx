import { useState, useEffect, useRef } from "react";
import { Theme } from "../hooks/useTheme";

interface SearchResult {
  id: string;
  label: string;
  content?: string;
}

interface SearchBarProps {
  theme: Theme;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  matchesCount?: number;
  searchResults?: SearchResult[];
  onResultClick?: (nodeId: string) => void;
  searchContent: boolean;
  onSearchContentChange: (val: boolean) => void;
  highlightNeighbours: boolean;
  onHighlightNeighboursChange: (val: boolean) => void;
}

export function SearchBar({
  theme,
  searchQuery,
  onSearchChange,
  matchesCount = 0,
  searchResults = [],
  onResultClick,
  searchContent,
  onSearchContentChange,
  highlightNeighbours,
  onHighlightNeighboursChange,
}: SearchBarProps) {
  const isDark = theme === "dark";
  const [isFocused, setIsFocused] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "f" || e.key === "k")) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        inputRef.current?.blur();
        if (searchQuery) onSearchChange(""); 
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchQuery, onSearchChange]);

  return (
    <div
      className={`absolute top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 w-auto group flex items-start gap-3`}
    >
      <div className="relative flex items-start flex-col gap-2 pointer-events-auto">
        <div className="flex gap-2 items-center">
            <div
            className={`relative flex items-center h-10 px-3 rounded-2xl border backdrop-blur-md shadow-sm transition-all duration-300 ${
                isFocused || searchQuery ? "w-[300px]" : "w-[240px]"
            } ${
                isFocused
                ? "border-accent/40 shadow border shadow-accent/10 bg-surface/80"
                : isDark
                    ? "border-border2/60 bg-surface/50 hover:bg-surface/80 hover:border-border2/80"
                    : "border-border/60 bg-surface/50 hover:bg-surface/80 hover:border-border/80"
            }`}
            >
            <svg
                className={`w-4 h-4 shrink-0 mr-2 transition-colors ${
                isFocused ? "text-accent" : "text-muted"
                }`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
            >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => {
                  // small timeout to allow clicking results
                  setTimeout(() => setIsFocused(false), 200);
                }}
                placeholder="Search nodes & content (⌘K)"
                className="w-full bg-transparent border-none outline-none text-[13px] text-text placeholder-muted/60"
            />
            {searchQuery && (
                <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted whitespace-nowrap">
                    {matchesCount} {matchesCount === 1 ? "match" : "matches"}
                </span>
                <button
                    type="button"
                    onMouseDown={(e) => {
                    e.preventDefault(); // keep focus
                    onSearchChange("");
                    }}
                    className="p-1 -mr-1 rounded-full text-muted hover:text-text hover:bg-surface/50 transition-colors"
                >
                    <svg
                    className="w-3.5 h-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    >
                    <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                </button>
                </div>
            )}
            </div>

            {/* Cog toggle button */}
            <div className="relative">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setShowOptions(!showOptions)}
                className={`flex items-center justify-center w-10 h-10 rounded-2xl border backdrop-blur-md shadow-sm transition-all duration-300 ${
                  showOptions
                    ? "border-accent/40 text-accent bg-accent/10"
                    : isDark
                      ? "border-border2/60 bg-surface/50 text-muted hover:bg-surface/80 hover:border-border2/80"
                      : "border-border/60 bg-surface/50 text-muted hover:bg-surface/80 hover:border-border/80"
                }`}
                title="Search options"
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
                </svg>
              </button>

              {/* Options popup — positioned absolutely below the cog */}
              {showOptions && (
                <div className={`absolute top-12 left-0 z-50 flex flex-col items-start justify-center gap-1.5 px-3 py-2 rounded-xl border backdrop-blur-md shadow-lg transition-all duration-200 ${
                    isDark ? "border-border2/60 bg-surface/90" : "border-border/60 bg-surface/90"
                }`}>
                  <label className="flex items-center gap-2 cursor-pointer text-[11px] text-text/80 hover:text-text whitespace-nowrap">
                      <input 
                          type="checkbox" 
                          className="rounded border-border2/60 bg-surface/50 text-accent focus:ring-accent"
                          checked={searchContent}
                          onChange={(e) => onSearchContentChange(e.target.checked)}
                      />
                      Search Content
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-[11px] text-text/80 hover:text-text whitespace-nowrap">
                      <input 
                          type="checkbox" 
                          className="rounded border-border2/60 bg-surface/50 text-accent focus:ring-accent"
                          checked={highlightNeighbours}
                          onChange={(e) => onHighlightNeighboursChange(e.target.checked)}
                      />
                      Highlight Neighbours
                  </label>
                </div>
              )}
            </div>
        </div>

        {/* Dropdown Results */}
        {isFocused && searchResults.length > 0 && (
          <div className={`w-[300px] mt-1 max-h-[300px] overflow-y-auto rounded-xl border backdrop-blur-md shadow-lg scrollbar-custom ${
            isDark ? "border-border2/60 bg-surface/90" : "border-border/60 bg-surface/90"
          }`}>
            {searchResults.map((res) => (
              <div
                key={res.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (onResultClick) onResultClick(res.id);
                  onSearchChange(""); // clear search on select
                  setIsFocused(false);
                }}
                className={`px-3 py-2 cursor-pointer border-b last:border-0 transition-colors ${
                  isDark ? "border-border2/40 hover:bg-surface-elevated/80" : "border-border/40 hover:bg-surface-elevated/80"
                }`}
              >
                <div className="text-[13px] font-medium text-text">{res.label}</div>
                {res.content && (
                  <div className="text-[11px] text-muted line-clamp-1 mt-0.5">
                    {res.content}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
