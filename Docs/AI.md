# NodeScape AI Overview

This file explains how AI is wired in this project. For a full project context, see CONTEXT.md.

---

## AI Provider

- Provider: Groq
- API style: OpenAI-compatible Chat Completions endpoint
- Endpoint used: https://api.groq.com/openai/v1/chat/completions

## Models in Use

- Main graph generation and deep-dive features:
  - model: llama-3.3-70b-versatile
- Supabase Edge Function ai:
  - model: llama-3.3-70b-versatile

## Where AI Is Called

### 1) In-app AI Chat (Graph generation/editing)

- File: src/components/Sidebar.tsx
- Uses environment key: VITE_SUPABASE_FUNCTION_AI_URL (optional; defaults to /functions/v1/ai)
- Sends system + user messages to Supabase Edge Function ai
- Requests JSON output with response_format: { type: "json_object" }
- Uses streaming (SSE) to progressively build and parse returned JSON
- Supports modes:
  - generate: create new graph
  - append: add nodes to existing graph
  - update: overwrite selected existing nodes
  - remove: return nodes to delete

### 1b) Persistent PDF Memory

- File: src/components/Sidebar.tsx
- When a user uploads a PDF in the AI chat, the file content is parsed immediately via pdf.js.
- The raw text is appended to the system prompt of subsequent queries within the same session.
- By storing extracted text at the session level instead of clearing it after a single message, conversations can freely reference previous documents.

### 2) Deep Dive from selected node

- File: src/components/Graph3D.tsx
- Uses environment key: VITE_SUPABASE_FUNCTION_AI_URL (optional; defaults to /functions/v1/ai)
- Requires exactly one selected node
- Sends a strict system prompt to generate 3-5 subtopic nodes
- Streams model output and incrementally repairs/parses JSON chunks
- Adds returned nodes and connections into the graph engine in real time

### 3) Supabase Edge Function (server-side proxy path)

- File: supabase/functions/ai/index.ts
- Runtime: Deno edge function
- Reads GROQ_API_KEY from server environment
- Accepts JSON body with prompt
- Accepts OpenAI-compatible chat payloads (messages/model/response_format/stream) and legacy prompt payloads
- Forwards request to Groq chat completions API
- Streams SSE responses through to the client when stream=true
- Returns raw model response as JSON
- Includes CORS headers and handles OPTIONS preflight

## Prompting and Output Contract

- The app uses strict prompt rules to force a single valid JSON object.
- Generated node content is expected to include HTML snippets (for example <strong> and <br><br>) for rich rendering.
- Connection IDs are expected to reference valid node IDs.

## Streaming Behavior

- The client reads SSE data lines from the response stream.
- Partial delta tokens are appended into a buffer.
- Buffer content is repeatedly parsed (with repair fallback) until valid graph JSON is available.
- UI updates while generation is still in progress.

## Required Environment Variables

### Frontend (Vite)

- VITE_SUPABASE_ANON_KEY
- VITE_SUPABASE_URL (optional; defaults to the current Supabase project URL)

### Supabase Edge Function

- GROQ_API_KEY

## Security & Auth Notes

- **Frontend AI paths** now call the Supabase edge function instead of Groq directly.
- **GROQ_API_KEY** must only exist in the edge-function environment (server-side).
- **AI generation requires a signed-in Supabase user session** (function JWT verification is enforced).
- **No private API keys are ever exposed to the frontend.**
- See CONTEXT.md for a full security model and architecture summary.

## Open-Source Forks

If you fork NodeScape and want AI generation to work, you must use your own backend and keys. See CONTEXT.md and README.md for full instructions.

Checklist for forks:

- Deploy the `ai` edge function to your Supabase project
- Set `GROQ_API_KEY` in Supabase function secrets (never in frontend)
- Set `VITE_SUPABASE_ANON_KEY` in frontend `.env`
- Update function URL constants in `src/components/Sidebar.tsx` and `src/components/Graph3D.tsx` to your Supabase URL

**Important:**

- `VITE_SUPABASE_ANON_KEY` is public and expected to be visible in browser requests
- `GROQ_API_KEY` is private and must never be exposed to frontend code

---

For a complete project context, security model, and agent-readable summary, see CONTEXT.md.
