import { GraphData } from '../types/graph'

export const DEFAULT_GRAPH: GraphData = {
  title: 'Operating System',
  nodes: [
    {
      id: 'os',
      label: 'Operating System',
      icon: '🖥️',
      hex: '#7c6af7',
      category: 'core',
      content: `An <strong>Operating System (OS)</strong> is essential system software that acts as the fundamental interface between a user and computer hardware. It manages all the critical resources of a computer — from the CPU and memory to peripheral devices like keyboards and displays.<br><br>Without an OS, users would need to directly interact with hardware using machine code — an impractical task for everyday computing. The OS provides an abstraction layer that simplifies this complexity, allowing users and applications to work efficiently.<br><br>Modern operating systems are sophisticated pieces of engineering, handling <strong>multitasking</strong>, <strong>security</strong>, <strong>networking</strong>, and <strong>user interfaces</strong> all simultaneously.`,
      connections: ['cpu', 'memory', 'apps', 'interface', 'devices', 'windows', 'linux', 'android'],
    },
    {
      id: 'cpu',
      label: 'CPU Management',
      icon: '⚙️',
      hex: '#4fc3f7',
      category: 'resource',
      content: `The OS acts as the <strong>central scheduler</strong> for the CPU, deciding which processes get processor time and for how long — a process called <strong>process scheduling</strong>.<br><br>Through <strong>time-slicing</strong>, the OS creates the illusion of multiple programs running simultaneously on a single core. Each process gets a tiny slice of CPU time in rapid succession.<br><br>Modern multi-core processors allow true parallel execution, and the OS coordinates work across all cores, balancing load and preventing any single process from monopolizing resources.`,
      connections: ['os', 'memory', 'apps'],
    },
    {
      id: 'memory',
      label: 'Memory',
      icon: '🧠',
      hex: '#81c784',
      category: 'resource',
      content: `<strong>Memory management</strong> is one of the OS's most critical functions. The OS allocates RAM to running processes, ensuring each program has the space it needs while keeping programs isolated from each other.<br><br><strong>Virtual memory</strong> extends available RAM by using disk space as overflow. The OS handles the <strong>paging</strong> mechanism that swaps data between RAM and disk transparently.<br><br>Memory protection ensures one program cannot access or corrupt another's memory space, which is fundamental to system stability and security.`,
      connections: ['os', 'cpu', 'apps'],
    },
    {
      id: 'apps',
      label: 'Applications',
      icon: '📦',
      hex: '#ffb74d',
      category: 'layer',
      content: `Applications run <strong>on top of</strong> the OS, relying on it for all hardware access via <strong>system calls</strong>. They never communicate with hardware directly.<br><br>The OS provides a stable, consistent <strong>API</strong> that apps use regardless of the underlying hardware — this is why the same app can run on different hardware configurations.<br><br>Application isolation ensures one app's crash doesn't bring down the entire system, a core design principle of modern OSes.`,
      connections: ['os', 'cpu', 'memory', 'interface'],
    },
    {
      id: 'interface',
      label: 'User Interface',
      icon: '🎨',
      hex: '#f06292',
      category: 'layer',
      content: `The OS provides the <strong>user interface</strong> — from command-line interfaces (CLI) like Bash and PowerShell, to graphical user interfaces (GUI) with windows, icons, and pointers.<br><br><strong>CLI interfaces</strong> give power users direct, scriptable control. <strong>GUIs</strong> make computing accessible to everyone.<br><br>Modern OSes often provide both — a rich graphical desktop for everyday use, with a terminal available for advanced tasks and developers.`,
      connections: ['os', 'apps', 'windows', 'linux'],
    },
    {
      id: 'devices',
      label: 'Peripheral Devices',
      icon: '🖱️',
      hex: '#80cbc4',
      category: 'resource',
      content: `The OS manages all <strong>peripheral devices</strong> through software modules called <strong>device drivers</strong>. Every piece of hardware — keyboard, mouse, printer, GPU — needs a driver that the OS uses to communicate with it.<br><br>Drivers act as translators between the OS's standard commands and the specific hardware's native language. This abstraction means app developers don't need to know hardware specifics.<br><br>Plug-and-play systems allow modern OSes to automatically detect new devices and load appropriate drivers.`,
      connections: ['os', 'cpu'],
    },
    {
      id: 'windows',
      label: 'Microsoft Windows',
      icon: '🪟',
      hex: '#29b6f6',
      category: 'example',
      content: `<strong>Microsoft Windows</strong> is the world's most widely used desktop OS, powering billions of PCs globally. First released in 1985, it evolved from a graphical shell over MS-DOS to a fully independent system.<br><br>Windows offers broad hardware compatibility, an <strong>NTFS file system</strong>, Active Directory for enterprise management, and WSL (Windows Subsystem for Linux) for developers.<br><br><strong>Windows 11</strong> introduced a redesigned interface, improved gaming capabilities, and tighter security with TPM 2.0 requirements.`,
      connections: ['os', 'interface', 'linux'],
    },
    {
      id: 'linux',
      label: 'Linux',
      icon: '🐧',
      hex: '#a5d6a7',
      category: 'example',
      content: `<strong>Linux</strong> is an open-source OS kernel created by Linus Torvalds in 1991. Its source code can be studied, modified, and distributed by anyone — making it the foundation of the open-source world.<br><br>Linux powers most web servers, cloud infrastructure (AWS, Google Cloud, Azure), and <strong>Android</strong> devices. It's the OS of choice for developers and server administrators.<br><br>Linux comes in many <strong>distributions</strong> — Ubuntu, Fedora, Arch — each tailored for different use cases.`,
      connections: ['os', 'android', 'interface'],
    },
    {
      id: 'android',
      label: 'Android & iOS',
      icon: '📱',
      hex: '#ffcc80',
      category: 'example',
      content: `<strong>Android</strong> and <strong>iOS</strong> power virtually all smartphones worldwide, optimized for touch input, battery efficiency, and curated app ecosystems.<br><br>Android is built on the Linux kernel and is open-source, allowing device manufacturers to customize it. iOS is Apple's proprietary system with tight hardware-software integration.<br><br>Both platforms introduced the <strong>app store</strong> model that changed software distribution forever. They manage resources aggressively, suspending background apps to preserve battery life.`,
      connections: ['os', 'linux', 'apps'],
    },
  ],
}

export const AI_PROMPT = `Generate a knowledge graph JSON for the topic: [YOUR TOPIC HERE]

Return ONLY valid JSON, no explanation, no markdown fences. Use this exact schema:

{
  "title": "Topic Name",
  "nodes": [
    {
      "id": "unique_id",
      "label": "Display Name",
      "icon": "emoji",
      "hex": "#hexcolor",
      "category": "core|concept|example|resource|layer",
      "content": "Rich HTML content about this node. Use <strong> tags for emphasis. 2-3 paragraphs.",
      "connections": ["other_id_1", "other_id_2"]
    }
  ]
}

Rules:
- 8 to 14 nodes total
- connections must reference valid ids in the same list
- connections are bidirectional so no need to repeat both sides
- hex colors: pick distinct colors per category, avoid white/black
- icons: use relevant single emojis
- content: minimum 3 sentences, use <strong> for key terms
- make sure every node has at least 2 connections
- the graph should feel like Obsidian: a web of related ideas`

export const EXAMPLE_TOPICS = [
  'Machine Learning',
  'The Solar System',
  'DSA Concepts',
  'Human Anatomy',
  'React Ecosystem',
  'World War II',
  'Jazz Music Theory',
  'Blockchain',
  'Stoic Philosophy',
  'Quantum Computing',
]
