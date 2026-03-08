import { useState, useEffect, useCallback } from 'react'

export type Theme = 'dark' | 'light'

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('kg-theme') as Theme | null
    if (stored) return stored
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  })

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', theme)
    localStorage.setItem('kg-theme', theme)
  }, [theme])

  const toggle = useCallback(() => {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, toggle }
}

/** Returns Three.js bg color int for current theme */
export function themeBgInt(theme: Theme): number {
  return theme === 'dark' ? 0x080810 : 0xf0f0f8
}

/** Returns Three.js fog color for current theme */
export function themeFogColor(theme: Theme): number {
  return theme === 'dark' ? 0x080810 : 0xf0f0f8
}
