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

export function tryRepairAndParse(raw: string): { data: GraphData | null; error?: string } {
  // Strip markdown fences if partially present
  let cleaned = raw
    .replace(/^```json\s*/m, '')
    .replace(/^```\s*/m, '')
    .replace(/\s*```$/m, '')
    .trim()

  // Sanitize literal newlines inside JSON strings
  cleaned = cleaned.replace(/(["]):([\s\S]*?)(?="[,}\]])/g, (match) => {
    return match.replace(/\n/g, '<br>').replace(/\r/g, '')
  })

  // Try direct parse first
  try {
    const obj = JSON.parse(cleaned)
    if (obj && Array.isArray(obj.nodes) && obj.nodes.length > 0) {
      const { data } = parseGraphJSON(JSON.stringify(obj))
      return { data }
    }
  } catch { /* continue to repair */ }

  // Try repairing by closing open brackets/braces
  try {
    let repaired = cleaned

    repaired = repaired.replace(/,\s*$/, '')
    repaired = repaired.replace(/,\s*"[^"]*"\s*:\s*$/, '')
    repaired = repaired.replace(/:\s*$/, ': ""')
    repaired = repaired.replace(/,\s*$/, '')

    let inString = false
    let escaped = false
    for (const ch of repaired) {
      if (escaped) { escaped = false; continue }
      if (ch === '\\') { escaped = true; continue }
      if (ch === '"') inString = !inString
    }
    if (inString) repaired += '"'

    repaired = repaired.replace(/,\s*$/, '')

    const opens = { '{': 0, '[': 0 }
    const closes: Record<string, '{' | '['> = { '}': '{', ']': '[' }
    inString = false
    escaped = false
    for (const ch of repaired) {
      if (escaped) { escaped = false; continue }
      if (ch === '\\') { escaped = true; continue }
      if (ch === '"') { inString = !inString; continue }
      if (inString) continue
      if (ch === '{' || ch === '[') opens[ch as '{' | '[']++
      if (ch === '}' || ch === ']') opens[closes[ch as '}' | ']']]--
    }

    for (let i = 0; i < opens['[']; i++) repaired += ']'
    for (let i = 0; i < opens['{']; i++) repaired += '}'

    const obj = JSON.parse(repaired)
    if (obj && Array.isArray(obj.nodes) && obj.nodes.length > 0) {
      const { data } = parseGraphJSON(JSON.stringify(obj))
      return { data }
    }
  } catch (e) { return { data: null, error: (e as Error).message } }

  return { data: null }
}
