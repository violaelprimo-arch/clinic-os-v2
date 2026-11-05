'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
  isSystem: boolean
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

function resolveInitialTheme(): { theme: Theme; isSystem: boolean } {
  if (typeof window === 'undefined') {
    return { theme: 'light', isSystem: true }
  }
  try {
    const stored = localStorage.getItem('clinic_os_theme')
    if (stored === 'dark' || stored === 'light') {
      return { theme: stored, isSystem: false }
    }
    const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    return { theme: systemDark ? 'dark' : 'light', isSystem: true }
  } catch (e) {
    return { theme: 'light', isSystem: true }
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light')
  const [isSystem, setIsSystem] = useState<boolean>(true)
  const [mounted, setMounted] = useState(false)

  // Fast and smooth theme application with zero lag or layout thrashing
  const applyTheme = useCallback((t: Theme) => {
    if (typeof document === 'undefined') return
    const root = document.documentElement

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (prefersReducedMotion) {
      root.classList.add('reduced-motion')
    }

    if (t === 'dark') {
      root.classList.add('dark')
      root.classList.remove('light')
      root.style.colorScheme = 'dark'
    } else {
      root.classList.remove('dark')
      root.classList.add('light')
      root.style.colorScheme = 'light'
    }

    // Broadcast theme update to any active iframes (such as live booking preview)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('clinic_theme_changed', { detail: { theme: t } }))
      try {
        const iframes = document.querySelectorAll('iframe')
        iframes.forEach((ifr) => {
          ifr.contentWindow?.postMessage({ type: 'THEME_CHANGE', theme: t }, '*')
        })
      } catch (e) {}
    }
  }, [])

  useEffect(() => {
    setMounted(true)
    const initial = resolveInitialTheme()
    setThemeState(initial.theme)
    setIsSystem(initial.isSystem)
    applyTheme(initial.theme)

    // Listen to OS system color scheme changes if user hasn't chosen a manual theme
    let mediaQuery: MediaQueryList | null = null
    const handleSystemChange = (e: MediaQueryListEvent) => {
      const stored = localStorage.getItem('clinic_os_theme')
      if (!stored) {
        const nextTheme = e.matches ? 'dark' : 'light'
        setThemeState(nextTheme)
        setIsSystem(true)
        applyTheme(nextTheme)
      }
    }

    if (typeof window !== 'undefined' && window.matchMedia) {
      mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      mediaQuery.addEventListener('change', handleSystemChange)
    }

    // Listen for iframe THEME_CHANGE messages (for live preview in settings)
    const handleWindowMessage = (e: MessageEvent) => {
      if (e.data?.type === 'THEME_CHANGE' && (e.data.theme === 'dark' || e.data.theme === 'light')) {
        setThemeState(e.data.theme)
        applyTheme(e.data.theme)
      }
    }

    // Listen for localStorage changes across windows/tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'clinic_os_theme' && (e.newValue === 'dark' || e.newValue === 'light')) {
        setThemeState(e.newValue)
        applyTheme(e.newValue)
      }
    }

    window.addEventListener('message', handleWindowMessage)
    window.addEventListener('storage', handleStorageChange)

    return () => {
      if (mediaQuery) {
        mediaQuery.removeEventListener('change', handleSystemChange)
      }
      window.removeEventListener('message', handleWindowMessage)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [applyTheme])

  const setTheme = useCallback(
    (t: Theme) => {
      setThemeState(t)
      setIsSystem(false)
      try {
        localStorage.setItem('clinic_os_theme', t)
      } catch {}
      applyTheme(t)
    },
    [applyTheme]
  )

  const toggleTheme = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
  }, [theme, setTheme])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, isSystem }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
