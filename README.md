<h1 align="center">🌌 NodeScape v1.1.0</h1>
</p>
<p align="center">
  <i>"Explore knowledge like a galaxy of interconnected ideas."</i>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Status-Active-brightgreen" alt="Status" />
  <img src="https://img.shields.io/badge/UI-Tailwind CSS-blue" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/3D-Three.js-black" alt="Three.js" />
  <img src="https://img.shields.io/badge/Physics-d3--force--3d-orange" alt="d3-force" />
</p>

<p align="center">
  <img src="screenshots-and-demos/graph1.png" width="800" />

<p align="center">
  NodeScape is an interactive AI-powered spatial knowledge graph explorer that combines visualization, note-taking, and idea exploration into a dynamic network of interconnected concepts, transforming concepts into a navigatable 3D/2D universe.
</p>

---

# ✨ Features

## 🏡 Graph Library

NodeScape includes a **visual homepage** that acts as a personal graph library.

Graphs are stored locally in your browser using **local storage**, making NodeScape an **offline-first knowledge workspace**.

<p align="center">
  <img src="screenshots-and-demos/homepage2.png" width="800" />
</p>

You can:

- create new knowledge graphs
- rename or delete existing graphs
- reopen graphs instantly
- maintain multiple concept maps

---

# 💻 Demo: Using the graph view in combination with path mode

[![Video Thumbnail](screenshots-and-demos/thumbnail.png)](https://www.youtube.com/watch?v=R8EsM01ls-Y)

---

# 🌌 Knowledge Graph Explorer

Navigate complex subjects inside a **fully interactive graph environment**.

NodeScape supports both:

- **3D exploration**
- **2D structured layout**

This allows users to explore concepts spatially or in a structured hierarchy.

### Desktop Controls

| Action                    | Result              |
| ------------------------- | ------------------- |
| Drag                      | Rotate graph        |
| Shift + Drag / Right Drag | Pan camera          |
| Scroll                    | Zoom                |
| Middle Drag               | Zoom camera         |
| Arrow Keys                | Pan camera          |
| Shift + Arrow             | Rotate camera       |
| Drag Node                 | Move node           |
| Middle Click Node         | Lock camera to node |

<p align="center">
  <img src="screenshots-and-demos/graph.gif" width="600"/>
</p>

---

# 🧭 Path Mode (Guided Knowledge Navigation)

NodeScape introduces a **Path Mode** that transforms the graph into a guided learning experience.

When enabled:

• the camera locks onto the current concept  
• visited nodes form a **breadcrumb path**  
• unvisited nodes appear as **dotted connections**  
• unrelated parts of the graph are **dimmed**

This turns the graph into a **learning pathway instead of a chaotic network**.

Users can explore concepts through:

- the **3D graph**
- **connected node buttons**
- the **node index sidebar**
- breadcrumb navigation

<p align="center">
  <img src="screenshots-and-demos/pathmode.png" width="800" />
</p>

---

# 🧬 Hierarchy Layout

Large graphs can be difficult to understand.

NodeScape includes a **Hierarchy Layout system** that organizes nodes into levels.

This helps visualize structures such as:

```

Artificial Intelligence
└ Machine Learning
└ Neural Networks
└ CNN

```

The hierarchy system works with both **2D and 3D modes**, helping reveal relationships between:

- concepts
- techniques
- applications

<p align="center">
  <img src="screenshots-and-demos/hierarchy.png" width="700" />
</p>

---

# 🧊 2D Mode

For structured exploration, NodeScape includes a **2D projection mode**.

This mode:

- flattens the graph
- reveals hierarchical layers
- makes large knowledge maps easier to read

Users can switch freely between **2D and 3D views**.

<p align="center">
  <img src="screenshots-and-demos/2dmode.png" width="500" />
</p>

---

# 📄 Node Pages (Concept Notes)

Clicking a node opens a **detailed concept page**.

Each node functions like a **knowledge card** containing:

- formatted notes
- contextual information
- links to related nodes
- Breadcrumb navigation (browser-style navigation) for nodes
- Address bar

<p align="center">
  <img src="screenshots-and-demos/note2.png" width="800" />
</p>

This creates a hybrid system between:

```

knowledge graph
+
note-taking system

```

---

# 🧠 Exploration-Focused Design

NodeScape is designed to make learning feel like **exploring a map** rather than reading a document.

Key ideas include:

- spatial memory
- visual connections
- concept clustering
- exploration paths

Instead of scrolling through notes, users **navigate through ideas**.

---

# 🏛️ Architecture

<p align="center">
LLM (llama-3.3-70b-versatile / llama-3.1-8b-instant)<br>
↓<br>
Structured JSON Knowledge Graph<br>
↓<br>
NodeScape Parser<br>
↓<br>
3D Graph Renderer (Three.js + d3-force-3d) / 2D Renderer (Pixi.js)
</p>

AI generates structured concept graphs which NodeScape converts into an **interactive knowledge universe**.

Dual model selection: `llama-3.3-70b-versatile` for short topics, `llama-3.1-8b-instant` for file attachments and long prompts.

---

# 🎛️ AI Tools & Data Sidebars

NodeScape includes two powerful sidebars.

### AI Data Sidebar (Right)

Used to generate and edit graphs.

Features:

- AI chatbot for graph generation
- **File attachment** (PDF, Markdown, Text) with drag-and-drop
- prompt templates
- paste AI-generated JSON
- raw JSON editor
- graph controls
- generation progress indicators

---

### Node Index Sidebar (Left)

Displays a **hierarchical list of nodes**.

Users can:

- quickly jump to concepts
- explore the graph structure
- open nodes directly

---

# 🎨 Glassmorphic UI

NodeScape features a modern UI built with:

- **Framer Motion**
- **Tailwind CSS**

Features include:

- animated transitions
- glassmorphic panels
- dark / light themes
- fluid UI interactions

---

# 🛠️ Tech Stack

### Frontend

- React
- TypeScript

### Visualization

- Three.js (3D)
- Pixi.js (2D)
- d3-force-3d

### Animation

- Framer Motion

### Styling

- Tailwind CSS

### Search & Parsing

- Fuse.js (fuzzy search)
- pdfjs-dist (PDF text extraction)

---

# 🚀 Getting Started

## 🌟 Live Demo

https://node-scape.vercel.app/

---

## 🧩 Open-Source Fork Setup (Own Backend)

If you fork NodeScape and want AI generation to work, use your own backend and keys.

1. Create your own Supabase project.
2. Deploy the edge function:

```powershell
npx supabase functions deploy ai
```

3. Set your server-side secret in Supabase:

```powershell
npx supabase secrets set GROQ_API_KEY=your_groq_key
```

4. Set your frontend env var in `.env`:

```dotenv
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

5. Point the frontend to your own function URL in these files:

- `src/components/Sidebar.tsx`
- `src/components/Graph3D.tsx`

Security notes:

- `VITE_SUPABASE_ANON_KEY` is public by design.
- `GROQ_API_KEY` must stay server-side only (never in frontend env).

### Optional: PDF Attachment Feature

The PDF/file attachment feature is disabled by default for public forks. To enable it locally, add to your `.env`:

```dotenv
VITE_ENABLE_PDF_ATTACHMENTS=true
```

This shows the file attachment button (paperclip icon) in the AI chat, allowing you to attach PDFs, Markdown, and text files as context for AI graph generation.

---

## 🧠 How To Create Knowledge Graphs

NodeScape supports **three different ways to build knowledge graphs**, depending on how you prefer to work.

## 🤖 1. Built-in AI Chatbot

The easiest way to generate a knowledge graph.

Use the **AI Chatbot in the right sidebar** to automatically generate structured concept graphs.

Steps:

1. Open the **AI Data sidebar**
2. Sign in with your Supabase account in the AI panel
3. Ask the chatbot for a topic

Example:

```

Artificial Intelligence
Stoicism
Quantum Computing

```

3. The AI produces structured JSON
4. NodeScape instantly converts it into a **3D knowledge graph**

This is the fastest way to explore new topics.

---

## 🌐 2. External AI (Using Prompt Template)

NodeScape also works with external AI tools such as:

- ChatGPT / Claude / Gemini etc.
- Local LLMs

Steps:

1. Copy the **Graph Generation Prompt** from prompt menu
2. Paste it into your preferred AI model
3. Ask for a topic (change the [TOPIC HERE] in the prompt)
4. Copy the returned json
5. Paste into paste section in paste menu

NodeScape will automatically render the graph.

This method allows using **more powerful external models**.

---

## ✏️ 3. Manual Graph Editing

NodeScape also supports **fully manual graph creation**.

Enable **Edit Mode** to:

- create new nodes
- connect nodes
- rename concepts
- write notes
- move nodes in the graph

This allows you to **build custom knowledge maps by hand**, perfect for:

- studying subjects
- planning projects
- mapping ideas
- organizing research

---

These three workflows allow NodeScape to function as both:
AI-powered knowledge generator

- manual knowledge mapping tool

You can freely mix all three approaches while building your knowledge graphs.

---

# 🌍 Why NodeScape Exists

Most knowledge tools are **linear**.

Notes look like this:

```

Topic
├ Subtopic
├ Subtopic
└ Subtopic

```

But real knowledge does **not grow linearly**.
Concepts connect across subjects, forming **networks of ideas**.

For example:

```

Artificial Intelligence
├ Machine Learning
│  ├ Neural Networks
│  │  ├ CNN
│  │  └ Transformers
│  └ Clustering
├ Robotics
└ Computer Vision

```

Traditional notes make it difficult to **see these relationships**.
You scroll through pages of text instead of **exploring how ideas connect**.
NodeScape was built to solve this problem.

Instead of reading knowledge like a document, NodeScape lets you:

- **navigate ideas spatially**
- **see how concepts relate**
- **explore topics naturally**
- **build personal knowledge maps**

It treats knowledge like a **landscape**, not a list.
You don’t just read information — you **explore it**.

---

# 🔮 Future Roadmap

NodeScape is evolving toward becoming a **self-expanding knowledge engine**.

## ☁️ Cloud Backend (Supabase)

NodeScape already uses Supabase for auth. Future plans include:

• **Cloud graph storage** – save graphs securely in a hosted database  
• **Cross-device sync** – access your knowledge maps from anywhere  
• **Collaborative graphs** – multiple users editing the same graph  
• **Graph version history** – track how knowledge maps evolve over time  
• **Shared public graphs** – publish and explore community knowledge maps

---

### 📄 Knowledge Extraction

Upload PDFs, images, and documents. Auto-convert them into **knowledge graphs**.

(Partially implemented — PDF text extraction with chunking is supported)

---

### 🤖 Pluggable AI Backends

- Ollama local models
- OpenAI / Anthropic API integration
- Seamless backend switching

---

### 🌱 Self-Expanding Graphs

Nodes can dynamically generate:

- missing concepts
- deeper subtopics
- related ideas

---

### 🌌 Visual Enhancements

- bloom & glow effects
- clustering of related nodes
- automatic domain grouping
- smarter layouts for large graphs

---

### Other Planned Features

- **Relationships object** — typed edges between nodes (NodeScape V2)

```
(Human body) -> | has | -> (heart)
      ^            ^          ^
      |            |          |
      |            |          |
     node     Relationship   node
```

- **Node encapsulation** — a node contains a subgraph (universe inside a universe)
- **Branches** — parallel paths through the graph
- **Tag system** — clustering and coloring similar nodes
- **Legends** — color-coded map legends
- **Semantic caching** — avoid re-generating graphs for similar prompts using embedding similarity
- **AI generation history** — track what the AI created, separate from saved graphs
- **Mini-map** — navigation aid, useful for large graphs and mobile
- **Mobile version** in React Native

---

The primary focus is anything that improves the core mechanism: understanding, navigation, and learning flow.

---

# 📋 Release Notes

## v1.1.0

### AI & File Handling
- Multi-file attachment (PDF, Markdown, Text) with drag-and-drop
- Large file chunking — PDFs split into 8K chunks, processed sequentially
- Dual model selection — `llama-3.3-70b-versatile` for topics, `llama-3.1-8b-instant` for files/long prompts
- PDF attachment behind feature flag (`VITE_ENABLE_PDF_ATTACHMENTS`)
- Generation stage indicators (Connecting/Streaming/Parsing/Rendering) with live node counter

### Graph Interaction
- Undo/redo system (Ctrl+Z/Y) with configurable history (default 100)
- Directional arrows on all visited path edges with bidirectional support
- Graph growth animation toggle + replay growth button (BFS order)
- Green ring for visited nodes in path mode (2D and 3D)
- Hide Ambient mode matching 3D behavior; hidden nodes non-interactive
- Trash button deletes selected nodes or clears all

### UI Overhaul
- Global search bar with Fuse.js fuzzy matching, content search, and highlight neighbours
- Search options (content search, highlight neighbours) behind a cog toggle popup
- Red close button in node content view (closes split screen, remembers mode)
- Lock camera moved next to Path Mode; smooth lerp, single-pan disengage
- Marquee tool repositioned to top-right toolbar
- 2D state (positions, physics) persists across mode switches

### Bug Fixes
- Fix hover neighbor highlighting when path mode is OFF
- Fix hover showing dotted lines on primary path edges
- Fix node click not opening content
- Fix bidirectional arrow rendering (2D and 3D)
- Fix hidden node glow visibility in 3D
- Fix edge visibility in hide ambient mode
- Fix lock camera panning requiring two drags

## v1.0.0

- Initial release with 3D/2D graph visualization
- AI chat for knowledge graph generation (Supabase Edge Function + Groq)
- Path Mode with breadcrumb navigation
- Edit Mode for manual graph creation
- Glassmorphic UI with dark/light themes
- Local storage graph library

---

# 👨‍💻 Built by

**Arjun S Nair**
