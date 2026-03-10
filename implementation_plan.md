implement this, but node name should be changed (along with json in all tabs) when double clicking on the text label, not the 3d sphere:

# Three UI Features Plan

## 1 — Reset Graph Button (Controls Tab)

**Goal**: A "Reset" button with two checkboxes: *Positions* and *Colors*. Resets the graph to its original generated state.

**Approach**: Store `originalGraphData` in [App.tsx](file:///c:/Users/arath/OneDrive/Desktop/NodeScape/src/App.tsx) whenever a new graph is loaded/generated. Pass it down to [ControlsTab](file:///c:/Users/arath/OneDrive/Desktop/NodeScape/src/components/Sidebar.tsx#122-347) via [Sidebar](file:///c:/Users/arath/OneDrive/Desktop/NodeScape/src/components/Sidebar.tsx#28-121). The reset button calls a new imperative handle method `resetGraph(opts)`.

### Proposed Changes

#### [MODIFY] [App.tsx](file:///c:/Users/arath/OneDrive/Desktop/NodeScape/src/App.tsx)
- Add `originalGraphData` ref — updated whenever `setGraphData` is called from [handleOpen](file:///c:/Users/arath/OneDrive/Desktop/NodeScape/src/App.tsx#27-35) or [handleGraphChange](file:///c:/Users/arath/OneDrive/Desktop/NodeScape/src/App.tsx#55-62) (but NOT from [handleNodeUpdate](file:///c:/Users/arath/OneDrive/Desktop/NodeScape/src/App.tsx#63-77) or auto-saves)
- Pass `originalGraphData` to `<Sidebar>`

#### [MODIFY] [Sidebar.tsx](file:///c:/Users/arath/OneDrive/Desktop/NodeScape/src/components/Sidebar.tsx)
- Add `originalGraphData?: GraphData` prop, thread it to [ControlsTab](file:///c:/Users/arath/OneDrive/Desktop/NodeScape/src/components/Sidebar.tsx#122-347)
- In [ControlsTab](file:///c:/Users/arath/OneDrive/Desktop/NodeScape/src/components/Sidebar.tsx#122-347): add `resetPositions` / `resetColors` checkbox state + Reset button UI
- On click: call `graphRef.current.resetGraph({ positions: resetPositions, colors: resetColors })`

#### [MODIFY] [types/graph.ts](file:///c:/Users/arath/OneDrive/Desktop/NodeScape/src/types/graph.ts)
- Add `resetGraph(opts: { positions: boolean; colors: boolean }, original: GraphData) => void` to [GraphHandle](file:///c:/Users/arath/OneDrive/Desktop/NodeScape/src/types/graph.ts#77-91)

#### [MODIFY] [Graph3D.tsx](file:///c:/Users/arath/OneDrive/Desktop/NodeScape/src/components/Graph3D.tsx)
- Add `resetGraph` to `useImperativeHandle`: loops `simNodes`, overwriting `x/y/z` (from original `NodeData.position` or falls back to scatter) and/or `hex/color` from original nodes. Then calls `engine.resetPhysics()`.

---

## 2 — Double-click Node Label to Rename

**Goal**: Double-clicking on a node's label text (or the node sphere) shows an HTML `<input>` overlay at the node's screen position to rename it in-place.

**Approach**: Detect double-click on canvas. If the hit is a node, project the node's world position to screen coords, render an absolutely-positioned `<input>` over the canvas. On Enter/blur → call `onNodeRename(id, newLabel)` which flows through `App.handleNodeUpdate`.

### Proposed Changes

#### [MODIFY] [Graph3D.tsx](file:///c:/Users/arath/OneDrive/Desktop/NodeScape/src/components/Graph3D.tsx)
- Add `onNodeRename?: (id: string, label: string) => void` prop
- Add `lastClickRef` with time + nodeId to detect double-click (300ms window) in [onMouseUp](file:///c:/Users/arath/OneDrive/Desktop/NodeScape/src/components/Graph3D.tsx#533-546)
- Add `renamingNode` state: `{ id, label, screenX, screenY } | null`
- Render an `<input>` overlay when `renamingNode` is set, positioned at screen coords
- On `Enter` / blur → call `onNodeRename` and clear state
- After rename, rebuild only this node's sprite via `engine.updateNode()`

#### [MODIFY] [App.tsx](file:///c:/Users/arath/OneDrive/Desktop/NodeScape/src/App.tsx)
- Pass `onNodeRename={(id, label) => handleNodeUpdate({...node, label})}` to `<Graph3D>`
  - Look up the full node from `graphData` first

#### [MODIFY] [types/graph.ts](file:///c:/Users/arath/OneDrive/Desktop/NodeScape/src/types/graph.ts)
- Add `onNodeRename?: (id: string, label: string) => void` to [Props](file:///c:/Users/arath/OneDrive/Desktop/NodeScape/src/components/Sidebar.tsx#7-16) in Graph3D

---

## 3 — Remove Sidebar Push Animation

**Goal**: When the sidebar opens, the graph viewport currently slides left (due to `marginRight: sidebarOpen ? 400 : 0` with a 350ms CSS transition). Remove this so the sidebar just overlays without pushing the graph.

**Approach**: Remove the `marginRight` + `transition-all` from the graph container div in [App.tsx](file:///c:/Users/arath/OneDrive/Desktop/NodeScape/src/App.tsx). The sidebar is already `position: absolute` with `z-50`, so it naturally overlays.

### Proposed Changes

#### [MODIFY] [App.tsx](file:///c:/Users/arath/OneDrive/Desktop/NodeScape/src/App.tsx)
- Remove `style={{ marginRight: sidebarOpen ? 400 : 0 }}` and `transition-all duration-[350ms]` className from the graph container `<div>`

---

## Verification Plan

- ✅ Reset: load a graph, move nodes / recolor → click Reset with checkboxes → positions and/or colors return to original
- ✅ Rename: double-click node on canvas → inline input appears → type new name → Enter → label updates in 3D view
- ✅ Sidebar: open sidebar → graph stays perfectly still, no lateral slide
