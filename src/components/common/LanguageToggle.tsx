'use client'

import React, { useEffect, useState } from 'react'
import { useLanguage } from '@/context/LanguageContext'
import { Languages } from 'lucide-react'

export function LanguageToggle({ className = '', variant = 'pill' }: { className?: string; variant?: 'pill' | 'icon' }) {
  const { language, toggleLanguage } = useLanguage()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className={`h-9 w-16 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 animate-pulse ${className}`} />
    )
  }

  const isAr = language === 'ar'

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={toggleLanguage}
        className={`relative inline-flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 cursor-pointer border bg-white dark:bg-[#0E2342] border-[#DCE9F5] dark:border-[#254565] text-[#092145] dark:text-[#F3FAFF] hover:border-[#087CF4]/50 dark:hover:border-[#02CFF3]/50 hover:text-[#087CF4] dark:hover:text-[#02CFF3] shadow-xs select-none ${className}`}
        title={isAr ? 'Switch to English' : 'التحويل للغة العربية'}
        aria-label="Toggle Language"
      >
        <span className="text-[11px] font-black uppercase font-mono">{isAr ? 'EN' : 'ع'}</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className={`inline-flex items-center gap-1.5 h-9 px-2.5 rounded-xl border text-xs font-bold transition-all duration-200 cursor-pointer shadow-xs bg-white dark:bg-[#0E2342] border-[#DCE9F5] dark:border-[#254565] text-[#092145] dark:text-[#F3FAFF] hover:border-[#087CF4]/50 dark:hover:border-[#02CFF3]/50 hover:text-[#087CF4] dark:hover:text-[#02CFF3] select-none ${className}`}
      title={isAr ? 'Switch to English' : 'التحويل للغة العربية'}
      aria-label="Toggle Language"
    >
      <Languages className="w-3.5 h-3.5 text-[#087CF4] dark:text-[#02CFF3]" />
      <span className="font-bold">{isAr ? 'English' : 'عربي'}</span>
    </button>
  )
}
