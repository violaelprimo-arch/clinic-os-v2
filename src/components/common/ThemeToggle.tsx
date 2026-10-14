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
      className={`relative inline-flex items-center justify-center gap-2 h-9 px-2.5 rounded-xl transition-all duration-200 cursor-pointer border select-none ${
        isDark
          ? 'bg-[#0E2342] border-[#254565] text-amber-300 hover:text-amber-200 hover:border-[#02CFF3]/40 shadow-xs'
          : 'bg-white border-[#DCE9F5] text-[#092145] hover:text-[#087CF4] hover:border-[#087CF4]/40 shadow-xs'
      } ${className}`}
      title={titleText}
      aria-label="Toggle Theme"
    >
      {isDark ? (
        <Sun className="w-4 h-4 transition-transform duration-300 hover:rotate-45 text-amber-300" />
      ) : (
        <Moon className="w-4 h-4 transition-transform duration-300 hover:-rotate-12 text-[#087CF4]" />
      )}
      {showLabel && (
        <span className="text-xs font-bold">
          {isDark ? (isAr ? 'فاتح' : 'Light') : (isAr ? 'داكن' : 'Dark')}
        </span>
      )}
    </button>
  )
}
