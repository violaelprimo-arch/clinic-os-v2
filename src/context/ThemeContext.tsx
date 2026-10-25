'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  // Fast theme application without lag or layout thrashing
  const applyTheme = useCallback((t: Theme) => {
    if (typeof document === 'undefined') return
    const root = document.documentElement

    // Temporarily disable CSS transitions on the DOM to eliminate lag across heavy blur filters
    const css = document.createElement('style')
    css.appendChild(
      document.createTextNode(
        '*, *::before, *::after { -webkit-transition: none !important; -moz-transition: none !important; -o-transition: none !important; -ms-transition: none !important; transition: none !important; }'
      )
    )
    document.head.appendChild(css)

    if (t === 'dark') {
      root.classList.add('dark')
      root.classList.remove('light')
      root.style.colorScheme = 'dark'
    } else {
      root.classList.remove('dark')
      root.classList.add('light')
      root.style.colorScheme = 'light'
    }

    // Force style reflow then safely remove the transition lock on next animation frame
    window.getComputedStyle(document.body).opacity
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          if (document.head.contains(css)) {
            document.head.removeChild(css)
          }
        } catch {}
      })
    })
  }, [])

  useEffect(() => {
    setMounted(true)
    const storedTheme = (localStorage.getItem('clinic_os_theme') as Theme) || 'light'
    setThemeState(storedTheme)
    applyTheme(storedTheme)
  }, [applyTheme])

  const setTheme = useCallback(
    (t: Theme) => {
      setThemeState(t)
      try {
        localStorage.setItem('clinic_os_theme', t)
      } catch {}
      applyTheme(t)
    },
    [applyTheme]
  )

  const toggleTheme = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    if (typeof document !== 'undefined' && 'startViewTransition' in document) {
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
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
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
