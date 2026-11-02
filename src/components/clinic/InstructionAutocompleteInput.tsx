'use client'

import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Check, Sparkles } from 'lucide-react'
import { filterSuggestions } from '@/lib/prescriptionSuggestions'
import { useLanguage } from '@/context/LanguageContext'

export interface InstructionAutocompleteInputProps {
  value: string
  onChange: (value: string) => void
  suggestions: string[]
  placeholder?: string
  className?: string
  typeLabel?: string
  inputRef?: React.RefObject<HTMLInputElement | null>
  disabled?: boolean
  rightElement?: React.ReactNode
  id?: string
}

export function InstructionAutocompleteInput({
  value,
  onChange,
  suggestions = [],
  placeholder,
  className = '',
  typeLabel = 'التعليمات',
  inputRef,
  disabled = false,
  rightElement,
  id
}: InstructionAutocompleteInputProps) {
  const { isRtl } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number>(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const internalInputRef = useRef<HTMLInputElement>(null)
  const effectiveRef = inputRef || internalInputRef

  // Filtered suggestions based on current typed value
  const filteredList = useMemo(() => {
    return filterSuggestions(suggestions, value, 8)
  }, [suggestions, value])

  // Click outside listener
  useEffect(() => {
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setSelectedIndex(-1)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
    }
  }, [])

  // Scroll active item into view
  useEffect(() => {
    if (selectedIndex >= 0 && dropdownRef.current) {
      const items = dropdownRef.current.querySelectorAll('[role="option"]')
      if (items[selectedIndex]) {
        (items[selectedIndex] as HTMLElement).scrollIntoView({
          block: 'nearest',
          behavior: 'smooth'
        })
      }
    }
  }, [selectedIndex])

  const handleSelect = (text: string) => {
    onChange(text)
    setIsOpen(false)
    setSelectedIndex(-1)
    if (effectiveRef.current) {
      effectiveRef.current.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        setIsOpen(true)
        setSelectedIndex(0)
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev < filteredList.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredList.length - 1))
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < filteredList.length) {
        e.preventDefault()
        e.stopPropagation()
        handleSelect(filteredList[selectedIndex])
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setIsOpen(false)
      setSelectedIndex(-1)
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <Input
          id={id}
          ref={effectiveRef}
          value={value}
          disabled={disabled}
          onChange={(e) => {
            onChange(e.target.value)
            if (!isOpen) setIsOpen(true)
            setSelectedIndex(-1)
          }}
          onFocus={() => {
            if (!disabled && filteredList.length > 0) {
              setIsOpen(true)
            }
          }}
          onClick={() => {
            if (!disabled && filteredList.length > 0) {
              setIsOpen(true)
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`h-9 text-xs rounded-lg bg-background border-border text-foreground transition-all focus:ring-1 focus:ring-primary ${className}`}
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          autoComplete="off"
        />

        {rightElement && (
          <div className="absolute end-1 flex items-center z-10">
            {rightElement}
          </div>
        )}
      </div>

      {/* Floating Suggestions Dropdown */}
      {isOpen && filteredList.length > 0 && !disabled && (
        <div
          ref={dropdownRef}
          className="absolute top-full start-0 end-0 mt-1 z-50 bg-popover dark:bg-slate-900 border border-border dark:border-slate-700/80 rounded-xl shadow-xl overflow-hidden max-h-56 overflow-y-auto text-xs py-1 print:hidden animate-in fade-in zoom-in-95 duration-100"
          dir={isRtl ? 'rtl' : 'ltr'}
          role="listbox"
        >
          <div className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground border-b border-border/40 flex items-center justify-between bg-muted/30">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-primary" />
              <span>اقتراحات {typeLabel} سابقة</span>
            </span>
            <span className="text-[9px] opacity-70 font-mono">
              ↑↓ للتنقل • Enter للاختيار
            </span>
          </div>

          <div className="py-1">
            {filteredList.map((item, idx) => {
              const isSelected = idx === selectedIndex
              const isCurrentExact = value.trim() === item.trim()

              return (
                <div
                  key={`${idx}_${item}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(e) => {
                    // Prevent blur from closing dropdown before select finishes
                    e.preventDefault()
                    handleSelect(item)
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`px-3 py-2 cursor-pointer transition-colors flex items-center justify-between gap-2 text-foreground ${
                    isSelected
                      ? 'bg-primary/15 text-primary font-bold dark:bg-primary/20'
                      : 'hover:bg-muted/70'
                  }`}
                >
                  <span className="truncate leading-relaxed">{item}</span>
                  {isCurrentExact && (
                    <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
