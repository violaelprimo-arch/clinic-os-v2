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

  // Fast theme application without lag, flashing, or layout thrashing
  const applyTheme = useCallback((t: Theme) => {
    if (typeof document === 'undefined') return
    const root = document.documentElement

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // If user prefers reduced motion, disable transitions momentarily for an instantaneous flip
    let css: HTMLStyleElement | null = null
    if (prefersReducedMotion) {
      css = document.createElement('style')
      css.appendChild(
        document.createTextNode(
          '*, *::before, *::after { -webkit-transition: none !important; -moz-transition: none !important; -o-transition: none !important; -ms-transition: none !important; transition: none !important; }'
        )
      )
      document.head.appendChild(css)
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

    if (css) {
      requestAnimationFrame(() => {
        try {
          if (css && document.head.contains(css)) {
            document.head.removeChild(css)
          }
        } catch {}
      })
    }
  }, [])

  useEffect(() => {
    setMounted(true)
    const initial = resolveInitialTheme()
    setThemeState(initial.theme)
    setIsSystem(initial.isSystem)
    applyTheme(initial.theme)

    // Listen to OS system color scheme changes if user hasn't chosen a manual theme
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleSystemChange = (e: MediaQueryListEvent) => {
        const stored = localStorage.getItem('clinic_os_theme')
        if (!stored) {
          const nextTheme = e.matches ? 'dark' : 'light'
          setThemeState(nextTheme)
          setIsSystem(true)
          applyTheme(nextTheme)
        }
      }

      mediaQuery.addEventListener('change', handleSystemChange)
      return () => mediaQuery.removeEventListener('change', handleSystemChange)
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
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (!prefersReducedMotion && typeof document !== 'undefined' && 'startViewTransition' in document) {
      try {
        ;(document as any).startViewTransition(() => {
          setTheme(next)
        })
        return
      } catch {}
    }
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
