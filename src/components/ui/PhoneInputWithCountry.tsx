'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  COUNTRIES,
  DEFAULT_COUNTRY,
  CountryInfo,
  normalizePhoneDigits,
  parsePhoneAndCountry,
  formatToE164,
  validatePhoneNumber
} from '@/lib/countryPhoneHelper'
import { ChevronDown, Search, Check, AlertCircle } from 'lucide-react'

export interface PhoneInputWithCountryProps {
  value: string
  onChange: (fullNumber: string, country: CountryInfo, localNumber: string) => void
  defaultCountryCode?: string
  placeholder?: string
  disabled?: boolean
  required?: boolean
  hasError?: boolean
  errorMessage?: string
  className?: string
  inputClassName?: string
  id?: string
  autoFocus?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function PhoneInputWithCountry({
  value,
  onChange,
  defaultCountryCode = 'EG',
  placeholder,
  disabled = false,
  required = false,
  hasError = false,
  errorMessage,
  className = '',
  inputClassName = '',
  id,
  autoFocus = false,
  size = 'md'
}: PhoneInputWithCountryProps) {
  // 1. Initial State from value or default country
  const [selectedCountry, setSelectedCountry] = useState<CountryInfo>(() => {
    if (value) {
      const parsed = parsePhoneAndCountry(value)
      if (parsed.country) return parsed.country
    }
    const found = COUNTRIES.find((c) => c.code === defaultCountryCode)
    return found || DEFAULT_COUNTRY
  })

  const [localNumber, setLocalNumber] = useState<string>(() => {
    if (!value) return ''
    const parsed = parsePhoneAndCountry(value)
    return parsed.localNumber
  })

  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const numberInputRef = useRef<HTMLInputElement>(null)

  // Sync internal state when prop `value` changes from parent externally
  useEffect(() => {
    if (!value) {
      setLocalNumber('')
      return
    }
    const parsed = parsePhoneAndCountry(value)
    if (parsed.country && parsed.country.code !== selectedCountry.code) {
      setSelectedCountry(parsed.country)
    }
    // Only update localNumber if value was changed externally to something different than current input
    const currentFull = formatToE164(localNumber, selectedCountry.dialCode)
    if (value !== currentFull && parsed.localNumber !== localNumber) {
      setLocalNumber(parsed.localNumber)
    }
  }, [value])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isDropdownOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 50)
    } else {
      setSearchQuery('')
    }
  }, [isDropdownOpen])

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false)
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isDropdownOpen])

  // Filter countries for dropdown
  const filteredCountries = useMemo(() => {
    if (!searchQuery.trim()) return COUNTRIES
    const q = searchQuery.toLowerCase().trim()
    return COUNTRIES.filter(
      (c) =>
        c.nameAr.includes(q) ||
        c.nameEn.toLowerCase().includes(q) ||
        c.dialCode.includes(q) ||
        c.code.toLowerCase().includes(q)
    )
  }, [searchQuery])

  // Handle local phone typing & pasting
  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    const normalizedDigits = normalizePhoneDigits(raw)

    // 1. Check if user pasted an international number starting with '+' or '00'
    if (normalizedDigits.trim().startsWith('+') || normalizedDigits.trim().startsWith('00')) {
      const parsed = parsePhoneAndCountry(normalizedDigits)
      if (parsed.country) {
        setSelectedCountry(parsed.country)
      }
      setLocalNumber(parsed.localNumber)
      onChange(parsed.fullNumber, parsed.country || selectedCountry, parsed.localNumber)
      return
    }

    // 2. Normal typing: strip non-digits
    const digitsOnly = normalizedDigits.replace(/[^0-9]/g, '')

    // 3. If pasted digits start with current dial code (e.g. "2010..." for EG or "9665..." for SA)
    const dialDigits = selectedCountry.dialCode.replace(/[^0-9]/g, '')
    let effectiveLocal = digitsOnly
    if (dialDigits && digitsOnly.startsWith(dialDigits) && digitsOnly.length > dialDigits.length + 6) {
      const withoutDial = digitsOnly.substring(dialDigits.length)
      const shouldHaveLeadingZero = selectedCountry.placeholder.startsWith('0')
      effectiveLocal = shouldHaveLeadingZero && !withoutDial.startsWith('0') && withoutDial.length > 0
        ? `0${withoutDial}`
        : withoutDial
    }

    setLocalNumber(effectiveLocal)

    const fullE164 = effectiveLocal ? formatToE164(effectiveLocal, selectedCountry.dialCode) : ''
    onChange(fullE164, selectedCountry, effectiveLocal)
  }

  // Handle country selection
  const handleSelectCountry = (country: CountryInfo) => {
    setSelectedCountry(country)
    setIsDropdownOpen(false)

    // Recalculate full E.164 with the newly selected country dial code
    const fullE164 = localNumber ? formatToE164(localNumber, country.dialCode) : ''
    onChange(fullE164, country, localNumber)

    // Return focus to number input
    setTimeout(() => {
      numberInputRef.current?.focus()
    }, 50)
  }

  const heightClasses = {
    sm: 'h-10 text-xs',
    md: 'h-12 text-sm',
    lg: 'h-14 text-base'
  }[size]

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      {/* Input Group Container */}
      <div
        dir="ltr"
        className={`group flex items-center rounded-2xl bg-slate-50 dark:bg-slate-800/90 border-2 transition-all ${heightClasses} ${
          hasError
            ? 'border-rose-400 dark:border-rose-500 bg-rose-50/20'
            : isDropdownOpen
            ? 'border-sky-500 ring-4 ring-sky-500/10'
            : 'border-slate-200 dark:border-slate-700/80 focus-within:border-sky-500 focus-within:ring-4 focus-within:ring-sky-500/10'
        } ${disabled ? 'opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-900' : ''}`}
      >
        {/* Country Selector Trigger */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsDropdownOpen((prev) => !prev)}
          className="h-full px-3.5 bg-slate-100/70 hover:bg-slate-200/70 dark:bg-slate-900/50 dark:hover:bg-slate-900 border-r border-slate-200 dark:border-slate-700 flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer select-none rounded-l-[14px]"
          title={`${selectedCountry.nameAr} (${selectedCountry.dialCode})`}
        >
          <span className="text-lg leading-none" role="img" aria-label={selectedCountry.nameAr}>
            {selectedCountry.flag}
          </span>
          <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200">
            {selectedCountry.dialCode}
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
              isDropdownOpen ? 'rotate-180 text-sky-500' : ''
            }`}
          />
        </button>

        {/* Local Number Input */}
        <input
          ref={numberInputRef}
          id={id}
          type="tel"
          disabled={disabled}
          required={required}
          autoFocus={autoFocus}
          value={localNumber}
          onChange={handleNumberChange}
          placeholder={placeholder || selectedCountry.placeholder}
          className={`w-full h-full px-3.5 bg-transparent outline-none font-mono font-bold text-slate-900 dark:text-white placeholder:text-slate-400 placeholder:font-normal ${inputClassName}`}
        />
      </div>

      {/* Error Message */}
      {hasError && errorMessage && (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-rose-500 dark:text-rose-400 text-right" dir="rtl">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Country Selection Dropdown Popover */}
      {isDropdownOpen && (
        <div
          ref={dropdownRef}
          dir="rtl"
          className="absolute z-50 top-full mt-2 left-0 right-0 sm:right-auto sm:w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-sky-100 dark:border-slate-700 p-2.5 space-y-2 animate-in fade-in slide-in-from-top-2 duration-150"
        >
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالدولة أو كود الاتصال..."
              className="w-full pr-9 pl-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-sky-500 focus:bg-white dark:focus:bg-slate-800"
            />
          </div>

          {/* Countries List */}
          <div className="max-h-56 overflow-y-auto space-y-1 pr-0.5 custom-scrollbar">
            {filteredCountries.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                لا توجد نتائج مطابقة لبحثك
              </div>
            ) : (
              filteredCountries.map((country) => {
                const isSelected = country.code === selectedCountry.code
                return (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => handleSelectCountry(country)}
                    className={`w-full px-2.5 py-2 rounded-xl text-xs font-bold flex items-center justify-between gap-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="text-base shrink-0 leading-none" role="img" aria-label={country.nameAr}>
                        {country.flag}
                      </span>
                      <span className="truncate text-right">{country.nameAr}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0" dir="ltr">
                      <span className="font-mono text-[11px] text-slate-400 dark:text-slate-400 font-semibold">
                        {country.dialCode}
                      </span>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
