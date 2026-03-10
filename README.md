<p align="center">
🌌 <strong>NodeScape</strong>
</p>

<p align="center">
  <i>"Explore knowledge like a galaxy."</i>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Status-Active-brightgreen" alt="Status" />
  <img src="https://img.shields.io/badge/UI-Tailwind CSS-blue" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/3D-Three.js-black" alt="Three.js" />
  <img src="https://img.shields.io/badge/Physics-d3--force--3d-orange" alt="d3-force" />
</p>

<p align="center">
  <strong>NodeScape</strong> — Explore knowledge in 3D. <br/>
  An interactive AI-powered knowledge graph explorer built with Three.js that combines visualization, note-taking, and idea exploration into a dynamic network of interconnected concepts.
</p>

<p align="center">
  <img src="screenshots&demos/graph1.png" width="800" />
</p>

<p align="center">
  <img src="screenshots&demos/graph.gif" width="800"/>
</p>

---

# ✨ Features

## 🏡 Homepage & Graph Library
The homepage acts as a **visual knowledge library**.  
All graphs are saved directly in your browser using **local storage**, allowing you to maintain a personal collection of knowledge maps.

<p align="center">
  <img src="screenshots&demos/homepage.png" width="800" />
</p>

You can:
- create new graphs
- rename or delete existing graphs
- reopen graphs instantly from visual cards

This makes NodeScape function as an **offline-first knowledge workspace**.

---

## 🌌 3D Knowledge Graph Explorer

Navigate through complex topics inside a **fully interactive 3D space**.

### Desktop Controls
- Drag → rotate graph
- Drag on node → move node (turn off physics for maximum flexibility)
- Shift / Right click + drag → pan
- Right Click on node → lock view onto node (enable in controls tab)
- Scroll / middle drag → zoom
- Double click on node label / node content → rename node / edit node content

### Mobile Controls
- On-screen **D-Pad** for panning  
- Pinch to zoom  
- Touch rotation
- hold node to move node around / see neighbours

<p align="center">
  <img src="screenshots&demos/graph.png" width="800" height="400"/>
</p>

---

## 📄 Node Pages (Concept Notes)

Clicking a node opens a **detailed concept page** containing structured information about that idea.

Features include:

- rich formatted content
- connections to related nodes
- quick navigation between concepts

Nodes behave like **interactive knowledge pages**, letting you surf through subjects naturally.

<p align="center">
  <img src="screenshots&demos/note.png" width="800" />
</p>

---

## 🧭 Exploration-Focused Design

NodeScape is designed to feel less like a static document and more like **exploring a map of knowledge**.

Future exploration features include:

- **visited node tracking**
- **highlighting connected nodes while reading**
- **numbering visited paths**
- optional **game-like exploration mode**

The goal is to turn learning into **navigating a landscape of ideas** rather than scrolling through text.

---

# 🏛️ Architecture

<p align="center">
LLM (llama 3.3 70B)<br>
↓<br>
Structured JSON Knowledge Graph<br>
↓<br>
NodeScape Parser<br>
↓<br>
3D Graph Renderer (Three.js + d3-force-3d)
</p>

AI generates structured concept data which NodeScape converts into an **interactive spatial knowledge graph**.

---

## 🎛️ AI Tools & Data Sidebars

NodeScape includes two key sidebars for working with graphs.

### AI Data Sidebar (Right)
- AI Chatbot for generating graphs
- Prompt templates for generating graph JSON
- Paste AI output to instantly generate graphs
- Raw JSON editor for advanced editing
- Graph visualization controls

### Node Index Sidebar (Left)
- quick hierarchical list of nodes
- jump directly to any concept in the graph

---

## 🎨 Glassmorphic UI

A modern UI system powered by **Framer Motion** and **Tailwind CSS**, featuring:

- smooth transitions
- dark / light themes
- glassmorphic panels
- animated interface elements

---

# 🛠️ Tech Stack

Built for **performance, scale, and interactive visualization**.

**Frontend**
- React  
- TypeScript  

**3D Visualization**
- Three.js  

**Physics Simulation**
- d3-force-3d  

**Animations**
- Framer Motion  

**Styling**
- Tailwind CSS  

---

# 🚀 Getting Started

## 🌟 Live Demo

Try NodeScape directly in your browser:

**https://node-scape.vercel.app/**

## 🧠 How To Use

1. Copy the **AI Prompt** from the sidebar  
2. Paste it into an LLM like ChatGPT or Claude  
3. Ask for a topic (example: *Stoicism*, *Quantum Computing*)  
4. Paste the returned JSON into NodeScape  
5. Explore the generated knowledge graph  

---

## 🔮 Future Roadmap

NodeScape is evolving toward becoming an **autonomous knowledge graph generator**.

### 🤖 AI Generation
- Local AI generation using **Ollama**
- Direct integration with **OpenAI / Anthropic APIs**

### 📄 Document Knowledge Extraction
Upload PDFs or images and automatically extract their concepts into graph structures.

### 🌱 Self-Expanding Knowledge Graphs
Nodes can dynamically expand and generate missing concepts.

### 🗄️ Persistent Graph Database
Move from local storage to a **cloud database** for multi-device sync.

### 🔍 Graph Search
Search nodes by title or content.

### 🌌 Visual Enhancements
- glow & bloom effects  
- smart node coloring  
- automatic clustering of related nodes  
- better visual grouping of knowledge domains  

---

### 👨‍💻 Built by
**Arjun S Nair**
