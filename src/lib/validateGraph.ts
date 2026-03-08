import { GraphData, NodeData } from '../types/graph'

export function parseGraphJSON(raw: string): { data: GraphData | null; error: string | null } {
  if (!raw.trim()) return { data: null, error: 'Please paste some JSON first.' }

  let parsed: unknown
  try {
    const cleaned = raw
      .replace(/^```json\s*/m, '')
      .replace(/^```\s*/m, '')
      .replace(/\s*```$/m, '')
      .trim()
    parsed = JSON.parse(cleaned)
  } catch (e) {
    return { data: null, error: `Invalid JSON: ${(e as Error).message}\n\nMake sure you pasted the raw JSON output from the AI.` }
  }

  const obj = parsed as Record<string, unknown>

  if (!Array.isArray(obj.nodes)) {
    return { data: null, error: 'JSON must have a "nodes" array.' }
  }

  const requiredFields = ['id', 'label', 'hex', 'connections'] as const
  const bad = (obj.nodes as NodeData[]).find(n => requiredFields.some(f => !(f in n)))
  if (bad) {
    return {
      data: null,
      error: `Node "${(bad as NodeData).label || (bad as NodeData).id || '?'}" is missing required fields (id, label, hex, connections).`,
    }
  }

  // Fill defaults
  const nodes = (obj.nodes as NodeData[]).map(n => ({
    icon: n.icon || '⬡',
    category: n.category || 'concept',
    content: n.content || `<strong>${n.label}</strong> is a concept in this knowledge graph.`,
    id: n.id,
    label: n.label,
    hex: n.hex,
    connections: n.connections,
    color: n.color
  }))

  return {
    data: {
      title: typeof obj.title === 'string' ? obj.title : 'Knowledge Graph',
      nodes,
    },
    error: null,
  }
}
