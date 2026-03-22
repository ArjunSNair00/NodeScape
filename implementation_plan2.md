# Implementation Plan: Features 1-5

## User Review Required
Please review the proposed placement and behavior of the **Search Bar**. 
- I will place it in the graph controls overlay (where the "Trash can" / delete button is located). 
- It will support searching by label (and content if the checkbox is checked).
- Auto-highlighting will pulse or color the matched nodes and their immediate neighbors.
- Pressing `Enter` will open the top matched node. 

## Proposed Changes

### True2DGraph
#### [MODIFY] True2DGraph/index.tsx
- Add SVG marquee overlay (`<svg className="absolute inset-0...">`) with rect and polygon elements, matching [Graph3D.tsx](file:///c:/Users/arath/OneDrive/Desktop/NodeScape/src/components/Graph3D.tsx).
- Update mouse event handlers ([onMouseDown](file:///c:/Users/arath/OneDrive/Desktop/NodeScape/src/components/Graph3D.tsx#1272-1429), [onMouseMove](file:///c:/Users/arath/OneDrive/Desktop/NodeScape/src/components/Graph3D.tsx#1430-1669), [onMouseUp](file:///c:/Users/arath/OneDrive/Desktop/NodeScape/src/components/Graph3D.tsx#1670-1959)) to compute local coordinate space and handle marquee selection (rect and freehand) using `engine.screenToWorld` math for hit detection.
- Add support for `externalHoverNodeId` (passed from [App.tsx](file:///c:/Users/arath/OneDrive/Desktop/NodeScape/src/App.tsx)) to trigger node and neighbor highlighting as if hovered directly.
- Add support for `isPathHideMode`. When true, any node/edge not in `highlightPath` or hovered will have its visibility completely toggled off or opacity set to `0`.
- Add Search Bar UI next to the Action Buttons (Trash can / Delete Selected). Implement autocomplete highlight logic and "Enter to open" behavior.

### Graph3D
#### [MODIFY] Graph3D.tsx
- Add support for `externalHoverNodeId` (passed from [App.tsx](file:///c:/Users/arath/OneDrive/Desktop/NodeScape/src/App.tsx)) to trigger node and neighbor highlighting over the network.
- Add support for `isPathHideMode`. When true, nodes/edges not in the highlighted path have `mesh.visible = false` or `opacity = 0`.
- Add Search Bar UI next to the Action Buttons (Delete Selected). Implement search-as-you-type highlighting and "Enter to open" behavior.

### App level & PageView
#### [MODIFY] App.tsx
- Add `externalHoverNodeId` state and pass down to Graph components and [PageView](file:///c:/Users/arath/OneDrive/Desktop/NodeScape/src/components/PageView.tsx#102-398).
- Add `isPathHideMode` state and pass down similarly.

#### [MODIFY] PageView.tsx
- On the "Connected nodes" buttons, add `onMouseEnter={() => onNodeHover?.(cid)}` and `onMouseLeave={() => onNodeHover?.(null)}`.
- In the top controls row (next to Path Mode ON/OFF), add a button for "Hide Ambient" (Hide Non-Highlighted) that toggles `isPathHideMode`.

### Documentation
#### [MODIFY] README.md
- Move "Open-Source Fork Setup (Own Backend)" section below "How To Create Knowledge Graphs".
- Update the backend descriptions to reflect the Supabase Edge Function AI Gateway.
- Update the Future Roadmap section.
#### [MODIFY] Docs/CONTEXT.md
- Update backend arch details.
#### [MODIFY] Docs/AI.md
- Document the Supabase edge function deploy process (`--no-verify-jwt`).

## Verification Plan

### Automated Tests
- This project primarily relies on manual visualization testing. No automated testing suite is configured for visual graph interactions.

### Manual Verification
1. **True2D Marquee**: Open 2D Map mode. Use Rect and Freehand select tools. Verify nodes within the bound are selected visually, accounting for split-screen offset.
2. **Hover Highlight**: Open a node. Hover over its "Connected nodes" list buttons in the PageView. Verify the 3D/2D graph highlights the target node and its neighbors.
3. **Path Mode Hide**: Activate Path Mode. Toggle "Hide Ambient" ON. Verify all other nodes completely disappear rather than dimming.
4. **Search Bar**: Type in the new search bar. Verify matching nodes highlight in real-time. Check "Search Content". Press Enter and verify it opens the node's PageView.
5. **Docs**: Read through [README.md](file:///c:/Users/arath/OneDrive/Desktop/NodeScape/README.md) to ensure correct section ordering.
