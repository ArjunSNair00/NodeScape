# CONTEXT.md

## Project Overview

NodeScape is a secure, open-source, AI-augmented knowledge graph and system dashboard application. It leverages Supabase for authentication and backend, a Groq API (OpenAI-compatible) for LLM-powered features, and a modern React + Vite + Tailwind frontend. The project is designed for technical users, with a bold, technical-deconstructivist (Noisia-inspired) UI, and is production-ready for open-source forks.

## Key Technologies

- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Backend:** Supabase (Edge Functions, Auth, Database)
- **AI Integration:** Groq API (OpenAI-compatible, called from Supabase Edge Function)
- **Auth:** Supabase email/password, JWT-enforced, session auto-refresh, localStorage persistence
- **Security:** All AI endpoints require authentication, JWT, and are rate-limited

## Main Features

- Interactive knowledge graph (2D/3D with full feature parity)
- AI chat and knowledge augmentation (via authenticated Supabase Edge Function proxy)
- Persistent PDF memory for AI chat sessions
- Secure sign-in/sign-out flow with session management and auto-refresh
- Session-expired toast and robust error handling
- Global search bar with auto-highlighting and content search
- Mobile-first, high-entropy, technical UI

## Directory Structure (Key Parts)

- `/src/` — Main frontend code (components, hooks, types, data, lib)
- `/supabase/functions/ai/` — Edge Function proxy for AI (CORS, JWT, rate limiting)
- `/IDEAS/` — Design docs, implementation plans, UI/UX notes
- `/UI_inspiration/` — Visual/UX references
- `/screenshots-and-demos/` — Demos and screenshots

## Security & Auth

- **Supabase anon key is public** (safe for frontend)
- **AI Edge Function is protected**: requires JWT, only accessible to signed-in users
- **No private API keys in frontend**
- **Session tokens**: managed by Supabase SDK, auto-refreshed, stored in localStorage

## Environment Variables

- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Public anon key (safe for frontend)
- **No Groq/OpenAI keys in frontend**

## Usage Flow

1. User signs in (Supabase email/password)
2. Session token is stored and auto-refreshed
3. AI requests are proxied through Supabase Edge Function (JWT required)
4. Rate limiting and CORS enforced on backend
5. UI displays session state, errors, and toasts as needed

## Open Source & Forking

- Safe for public forks: no private keys, all sensitive logic is backend-protected
- Docs updated for open-source setup and environment

## Recent Updates & Backend Changes

- **Persistent PDF Memory:** PDF uploads are now retained in memory per chat session. The frontend extracts the PDF content once using `pdf.js` and injects it into the system prompt for all subsequent queries within that session.
- **True2D Parity:** The True2D graph visualization is fully featured, supporting editing, drafting edges, marquee selection (rect/freehand), and physics interactions.
- **Enhanced UI Overlay:** Added global search with auto-highlighting for nodes and content, plus "Hide Ambient" functionality in Path Mode.

## Future Roadmap

- **Pluggable AI Backends**: Enable seamless switching between Groq, OpenAI, Anthropic, and local LLMs.
- **Real-Time Collaboration**: Real-time multi-user editing for graph components using Supabase Realtime/WebSockets.
- **Advanced Graph Analytics**: Implement shortest-path algorithms, cluster analysis, and custom cypher-like querying.
- **Local-First Sync**: Complete offline mode with automatic state resolution when reconnecting to Supabase.

## References

- See `README.md` for more details on features, setup, and design philosophy.
- See `supabase/functions/ai/index.ts` for backend AI proxy logic.
- See `src/lib/supabaseAuth.ts` and `src/components/Sidebar.tsx` for auth/session logic.

---

This CONTEXT.md is intended for developers to quickly understand the architecture, security model, and main workflows of NodeScape. For detailed implementation or contribution, refer to the code and documentation files mentioned above.
