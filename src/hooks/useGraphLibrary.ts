import { useState, useCallback } from 'react'
import { GraphRecord, GraphData } from '../types/graph'

const STORAGE_KEY = 'kg-library'

function loadRecords(): GraphRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveRecords(records: GraphRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  } catch {
    console.warn('localStorage full — could not save graph library')
  }
}

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function useGraphLibrary() {
  const [records, setRecords] = useState<GraphRecord[]>(loadRecords)

  const persist = useCallback((updated: GraphRecord[]) => {
    setRecords(updated)
    saveRecords(updated)
  }, [])

  /** Save (or update) a graph. Returns the record id. */
  const saveGraph = useCallback((data: GraphData, existingId?: string): string => {
    const now = Date.now()
    const all = loadRecords()
    if (existingId) {
      const idx = all.findIndex(r => r.id === existingId)
      if (idx !== -1) {
        const updated = { ...all[idx], title: data.title, nodeCount: data.nodes.length, updatedAt: now, data }
        all[idx] = updated
        persist(all)
        return existingId
      }
    }
    const newRecord: GraphRecord = {
      id: uid(),
      title: data.title,
      nodeCount: data.nodes.length,
      createdAt: now,
      updatedAt: now,
      data,
    }
    persist([newRecord, ...all])
    return newRecord.id
  }, [persist])

  const deleteGraph = useCallback((id: string) => {
    persist(loadRecords().filter(r => r.id !== id))
  }, [persist])

  const renameGraph = useCallback((id: string, title: string) => {
    const all = loadRecords()
    const idx = all.findIndex(r => r.id === id)
    if (idx !== -1) {
      all[idx] = { ...all[idx], title, updatedAt: Date.now(), data: { ...all[idx].data, title } }
      persist(all)
    }
  }, [persist])

  return { records, saveGraph, deleteGraph, renameGraph }
}
