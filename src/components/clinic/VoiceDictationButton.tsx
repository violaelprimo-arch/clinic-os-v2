'use client'

import React, { useMemo } from 'react'
import { Mic, Square, Loader2, Globe, Volume2 } from 'lucide-react'
import { DictationLanguage, DictationStatus } from '@/types/speech'
import { useVoiceDictation } from '@/hooks/useVoiceDictation'
import { cn } from '@/lib/utils'

export interface VoiceDictationButtonProps {
  fieldId: string
  fieldLabel: string
  value: string
  onChange: (newValue: string) => void
  inputRef?: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>
  language?: DictationLanguage
  onLanguageChange?: (lang: DictationLanguage) => void
  size?: 'sm' | 'default'
  className?: string
  showLanguagePill?: boolean
  showStatusBadge?: boolean
  disabled?: boolean
}

export function VoiceDictationButton({
  fieldId,
  fieldLabel,
  value,
  onChange,
  inputRef,
  language = 'ar-EG',
  onLanguageChange,
  size = 'default',
  className,
  showLanguagePill = true,
  showStatusBadge = true,
  disabled = false
}: VoiceDictationButtonProps) {
  const {
    isSupported,
    activeFieldId,
    status,
    interimText,
    start,
    stop,
    language: hookLanguage,
    setLanguage: setHookLanguage,
    toggleLanguage: toggleHookLanguage
  } = useVoiceDictation()

  const currentLang = language || hookLanguage
  const isListeningThis = activeFieldId === fieldId && status === 'listening'
  const isProcessingThis = activeFieldId === fieldId && status === 'processing'
  const isActive = isListeningThis || isProcessingThis

  const handleToggleLanguage = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const nextLang: DictationLanguage = currentLang === 'ar-EG' ? 'en-US' : 'ar-EG'
    if (onLanguageChange) {
      onLanguageChange(nextLang)
    } else {
      setHookLanguage(nextLang)
    }
  }

  const handleMicClick = (e: React.MouseEvent) => {
    e.preventDefault()

    if (isActive) {
      stop()
      return
    }

    // Safely capture cursor position before input focus potentially changes
    let cursorStart: number | null = null
    let cursorEnd: number | null = null
    if (inputRef && inputRef.current) {
      try {
        cursorStart = inputRef.current.selectionStart
        cursorEnd = inputRef.current.selectionEnd
      } catch {
        // Selection API not supported on some special input types
      }
    }

    start({
      fieldId,
      currentValue: value || '',
      onTextChange: onChange,
      cursorStart,
      cursorEnd,
      language: currentLang
    })
  }

  const isSmall = size === 'sm'

  return (
    <div className={cn('inline-flex items-center gap-1.5', className)}>
      {/* 1. Live Listening / Processing Status Badge */}
      {showStatusBadge && isActive && (
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full font-bold transition-all shadow-xs animate-in fade-in',
            isSmall ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1',
            isListeningThis
              ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
              : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
          )}
          role="status"
          aria-live="polite"
        >
          {isListeningThis ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping inline-block" />
              <span>
                {currentLang === 'ar-EG' ? 'جارٍ الاستماع…' : 'Listening…'}
              </span>
            </>
          ) : (
            <>
              <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
              <span>
                {currentLang === 'ar-EG'
                  ? 'جارٍ تحويل الصوت…'
                  : 'Converting speech…'}
              </span>
            </>
          )}
        </span>
      )}

      {/* 2. Language Pill Switcher ("العربية – مصر" / "English") */}
      {showLanguagePill && (
        <button
          type="button"
          onClick={handleToggleLanguage}
          onMouseDown={e => e.preventDefault()}
          title={`لغة الإملاء الصوتي الحالية: ${
            currentLang === 'ar-EG' ? 'العربية (مصر)' : 'English (US)'
          } - انقر للتبديل`}
          aria-label={`تغيير لغة الإملاء الصوتي، الحالية: ${
            currentLang === 'ar-EG' ? 'العربية' : 'الإنجليزية'
          }`}
          className={cn(
            'inline-flex items-center gap-1 rounded-lg font-mono font-bold transition-all cursor-pointer border select-none',
            isSmall ? 'text-[10px] px-1.5 py-0.5 h-7' : 'text-xs px-2 py-1 h-8',
            currentLang === 'ar-EG'
              ? 'bg-secondary hover:bg-secondary/80 text-foreground border-border'
              : 'bg-primary/10 hover:bg-primary/20 text-primary border-primary/30'
          )}
        >
          <Globe className={isSmall ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
          <span>{currentLang === 'ar-EG' ? 'عربي' : 'EN'}</span>
        </button>
      )}

      {/* 3. Main Microphone / Stop Button */}
      <button
        type="button"
        onClick={handleMicClick}
        onMouseDown={e => e.preventDefault()} // Prevents target input from losing cursor position
        disabled={disabled}
        aria-label={
          isActive
            ? `إيقاف الإملاء الصوتي لـ ${fieldLabel}`
            : `بدء الإملاء الصوتي لـ ${fieldLabel} (${
                currentLang === 'ar-EG' ? 'بالعربية' : 'بالإنجليزية'
              })`
        }
        title={
          isActive
            ? 'إيقاف الاستماع الصوتي'
            : `إملاء صوتي لـ ${fieldLabel} (${
                currentLang === 'ar-EG' ? 'العربية – مصر' : 'English'
              })`
        }
        className={cn(
          'relative inline-flex items-center justify-center rounded-xl font-bold transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/40 select-none active:scale-95 disabled:opacity-50 disabled:pointer-events-none',
          isSmall ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-xs',
          isActive
            ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/30 ring-2 ring-rose-400/40 animate-pulse'
            : 'bg-secondary hover:bg-primary/10 text-muted-foreground hover:text-primary border border-border shadow-2xs'
        )}
      >
        {isActive ? (
          <Square className={cn(isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5', 'fill-current')} />
        ) : (
          <Mic className={isSmall ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
        )}
      </button>
    </div>
  )
}
