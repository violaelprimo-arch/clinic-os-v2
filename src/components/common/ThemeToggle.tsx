'use client'

import React, { useEffect, useState } from 'react'
import { useTheme } from '@/context/ThemeContext'
import { useLanguage } from '@/context/LanguageContext'
import { Sun, Moon } from 'lucide-react'

export function ThemeToggle({ className = '', showLabel = false }: { className?: string; showLabel?: boolean }) {
  const { theme, toggleTheme } = useTheme()
  const { language } = useLanguage()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className={`w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 animate-pulse ${className}`} />
    )
  }

  const isDark = theme === 'dark'
  const isAr = language === 'ar'

  const titleText = isDark
    ? (isAr ? 'التبديل إلى الوضع النهاري (Light Mode)' : 'Switch to Light Mode')
    : (isAr ? 'التبديل إلى الوضع الليلي (Dark Mode)' : 'Switch to Dark Mode')

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative inline-flex items-center justify-center gap-2 h-9 px-2.5 rounded-xl transition-all duration-200 cursor-pointer border select-none bg-card border-border text-foreground hover:border-primary/50 shadow-xs ${className}`}
      title={titleText}
      aria-label="Toggle Theme"
    >
      {isDark ? (
        <Sun className="w-4 h-4 transition-transform duration-300 hover:rotate-45 text-amber-400" />
      ) : (
        <Moon className="w-4 h-4 transition-transform duration-300 hover:-rotate-12 text-primary" />
      )}
      {showLabel && (
        <span className="text-xs font-bold">
          {isDark ? (isAr ? 'فاتح' : 'Light') : (isAr ? 'داكن' : 'Dark')}
        </span>
      )}
    </button>
  )
}
