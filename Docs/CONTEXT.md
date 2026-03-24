# CONTEXT.md

## Project Overview

NodeScape is a secure, open-source, AI-augmented knowledge graph and system dashboard application. It leverages Supabase for authentication and backend, a Groq API (OpenAI-compatible) for LLM-powered features, and a modern React + Vite + Tailwind frontend. The project is designed for technical users, with a bold, technical-deconstructivist (Noisia-inspired) UI, and is production-ready for open-source forks.

## Key Technologies

- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Visualization:** Three.js (3D), Pixi.js (True2D), d3-force-3d (physics)
- **Animation:** Framer Motion
- **Backend:** Supabase (Edge Functions, Auth, Database)
- **AI Integration:** Groq API (OpenAI-compatible, called from Supabase Edge Function)
- **PDF Parsing:** pdfjs-dist (browser-based)
- **Search:** Fuse.js (fuzzy search)
- **Auth:** Supabase email/password (optional), session auto-refresh, localStorage persistence
- **Security:** Supabase anon key is public, GROQ_API_KEY server-side only

## Main Features

- Interactive knowledge graph (2D/3D with full feature parity)
- AI chat and knowledge augmentation (via Supabase Edge Function proxy)
- File attachment for AI (PDF, Markdown, Text) with chunking and sequential processing
- Persistent PDF memory for AI chat sessions
- Path Mode with directional arrows, hide ambient, and append mode
- Graph growth animation (incremental node-by-node generation)
- Replay growth animation on existing graphs (BFS order)
- Undo/redo system (Ctrl+Z/Y) with configurable history size
- Secure sign-in/sign-out flow with session management and auto-refresh
- Session-expired toast and robust error handling
- Global search bar with fuzzy matching and content search (Fuse.js)
- Marquee selection (rect/freehand) in both 2D and 3D
- Visited node highlighting (green ring) in path mode
- Mobile-first, high-entropy, technical UI

## Directory Structure (Key Parts)

- `/src/` — Main frontend code (components, hooks, types, data, lib)
- `/src/components/Graph3D.tsx` — 3D graph visualization (Three.js)
- `/src/components/True2DGraph/` — 2D graph visualization (Pixi.js)
- `/src/components/Sidebar.tsx` — AI chat, controls, index sidebar
- `/src/components/PageView.tsx` — Node content view with path controls
- `/src/components/SearchBar.tsx` — Global search with fuzzy matching
- `/src/lib/graphBuilder.ts` — 3D node/edge rendering and physics
- `/src/lib/parseFile.ts` — PDF and text file parsing + chunking
- `/src/lib/validateGraph.ts` — JSON parsing with repair fallback
- `/supabase/functions/ai/` — Edge Function proxy for AI (CORS, JWT, rate limiting)

## Security & Auth

- **Supabase anon key is public** (safe for frontend)
- **AI Edge Function**: JWT verification is disabled (auth is optional)
- **No private API keys in frontend**
- **Auth features**: Sign in/up, forgot password, email confirmation, password recovery
- **Session tokens**: managed by Supabase SDK, auto-refreshed, stored in localStorage

## Environment Variables

- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Public anon key (safe for frontend)
- **No Groq/OpenAI keys in frontend**

## Usage Flow

1. User opens the app — AI chat is immediately available (no sign-in required)
2. Optional: sign in via Supabase for account-based features
3. AI requests are proxied through Supabase Edge Function
4. Rate limiting and CORS enforced on backend
5. UI displays errors and toasts as needed

## Open Source & Forking

- Safe for public forks: no private keys, all sensitive logic is backend-protected
- Docs updated for open-source setup and environment

## Recent Updates

### AI & File Attachment
- **Multi-file attachment**: Attach PDF, Markdown, and text files via "+" button or drag-and-drop
- **PDF parsing**: Browser-based via pdfjs-dist, no server needed
- **File chunking**: Large files split into ~8K char chunks, processed sequentially via separate API calls
- **Deduplication**: Previous chunk's node IDs passed to subsequent chunks to prevent duplicates
- **Model selection**: `llama-3.1-8b-instant` for file attachments and long prompts (>200 chars), `llama-3.3-70b-versatile` for short topics
- **PDF system prompt**: Dedicated prompt that instructs AI to prioritize document content
- **Generation stage indicators**: Connecting → Streaming → Parsing → Rendering with live node counter

### Path Mode & Arrows
- **Directional arrows**: Arrows show on all visited edges in path mode, not just primary
- **Bidirectional arrows**: When append mode revisits a node, two arrows show at each end of the edge
- **Hide Ambient mode**: Hides non-path nodes and edges completely; matches 3D behavior (path nodes + their neighbors stay visible)
- **Hover override in hide mode**: Hovering a path node reveals its children even in hide mode
- **Hidden nodes non-interactive**: Hidden nodes can't be hovered or clicked in both 2D and 3D; marquee skips hidden nodes

### Graph Controls
- **Undo/redo system**: Ctrl+Z to undo, Ctrl+Y/Ctrl+Shift+Z to redo; configurable history size (default 100)
- **Covers**: node editing, path traversal, AI generation, node deletion, position changes
- **Graph growth animation**: Toggle in Controls tab; when ON, AI generation adds nodes one-by-one with BFS order
- **Replay growth**: Button to re-animate existing graph from root to leaf
- **Trash button**: Deletes selected nodes (or clears all if nothing selected)
- **Visited node highlighting**: Green ring around visited nodes in path mode (2D and 3D)

### UI Improvements
- **Close button**: Red X button in node content view that closes split screen
- **Lock camera**: Moved next to Path Mode button; smooth lerp transition; disengages on pan, re-engages on click
- **Search bar**: Options (Search Content, Highlight Neighbours) behind a cog toggle popup
- **Marquee tool**: Moved to top-right toolbar in 2D mode
- **2D state persistence**: Node positions and physics state preserved when switching between 2D and 3D modes
- **Remove SAVE 2D button**: Positions auto-save on unmount and through regular save

### Auth & Security
- **Auth disabled by default**: AI chat works without sign-in; edge function no longer requires JWT
- **Forgot password**: Email-based password reset with recovery form
- **Auth callback page**: Simple HTML page for email confirmation and password reset (`/auth-callback.html`)
- **Show/hide password toggle**: Eye icon on all password fields
- **Google autofill**: `autoComplete` attributes on email/password inputs
- **Hardcoded fallbacks**: Supabase URL and anon key have hardcoded fallbacks for deployment without .env

### Bug Fixes
- Fix hover neighbor highlighting when path mode is OFF
- Fix hover showing dotted lines on primary path edges
- Fix node click not opening content
- Fix bidirectional arrow rendering (both 2D and 3D)
- Fix 3D hidden nodes still slightly visible (glow material)
- Fix edge visibility in hide ambient mode (both endpoints must be visible)
- Fix duplicate physics repulsion in graph builder
- Fix API key exposure in git (removed tracked .env files)

## Future Roadmap

- **Pluggable AI Backends**: Enable seamless switching between Groq, OpenAI, Anthropic, and local LLMs.
- **Real-Time Collaboration**: Real-time multi-user editing for graph components using Supabase Realtime/WebSockets.
- **Advanced Graph Analytics**: Implement shortest-path algorithms, cluster analysis, and custom cypher-like querying.
- **Local-First Sync**: Complete offline mode with automatic state resolution when reconnecting to Supabase.
- **Knowledge Extraction**: Upload PDFs/images and auto-convert to knowledge graphs.
- **Semantic Caching**: Cache AI-generated graphs using embedding similarity to avoid re-generation.

## References

- See `README.md` for more details on features, setup, and design philosophy.
- See `Docs/AI.md` for AI integration details, models, and PDF handling.
- See `supabase/functions/ai/index.ts` for backend AI proxy logic.
- See `src/lib/supabaseAuth.ts` and `src/components/Sidebar.tsx` for auth/session logic.

---

This CONTEXT.md is intended for developers to quickly understand the architecture, security model, and main workflows of NodeScape. For detailed implementation or contribution, refer to the code and documentation files mentioned above.
