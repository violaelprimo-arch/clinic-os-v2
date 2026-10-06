'use client'

import React from 'react'

interface ClinicLogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'light' | 'dark'
  showSubtitle?: boolean
  subtitle?: string
}

export function ClinicLogo({
  className = '',
  size = 'md',
  variant = 'dark',
  showSubtitle = true,
  subtitle = 'نظام تشغيل العيادات الذكي'
}: ClinicLogoProps) {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  }

  const titleSizes = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-2xl',
    xl: 'text-3xl'
  }

  const subtitleSizes = {
    sm: 'text-[10px]',
    md: 'text-xs',
    lg: 'text-xs',
    xl: 'text-sm'
  }

  const isDark = variant === 'dark' // Dark surface, light text
  const textColor = isDark ? 'text-white' : 'text-[#0B1F33]'
  const subtitleColor = isDark ? 'text-teal-400/90' : 'text-[#15B8A6]'

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`} dir="rtl">
      {/* Brand Icon (Medical Infinity + Cross) */}
      <div className={`relative shrink-0 flex items-center justify-center ${iconSizes[size]}`}>
        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-sm">
          {/* Cyan / Teal Loop Node with medical cross inside */}
          <path
            d="M24 16C15.1634 16 8 23.1634 8 32C8 40.8366 15.1634 48 24 48C31.5 48 37.5 41.5 40 37L48 23C50.5 18.5 56.5 12 64 12"
            stroke="#15B8A6"
            strokeWidth="7"
            strokeLinecap="round"
          />
          {/* Medical Blue Node */}
          <path
            d="M40 16C48.8366 16 56 23.1634 56 32C56 40.8366 48.8366 48 40 48C32.5 48 26.5 41.5 24 37L16 23"
            stroke="#2F80ED"
            strokeWidth="7"
            strokeLinecap="round"
          />
          {/* Inner Medical Cross on the left loop */}
          <path
            d="M24 26V38M18 32H30"
            stroke="#15B8A6"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          {/* Subtle pulse dot in the right loop */}
          <circle cx="40" cy="32" r="3.5" fill="#2F80ED" />
        </svg>
      </div>

      {/* Typography */}
      <div className="flex flex-col text-right leading-tight">
        <div className="flex items-center gap-1 font-black tracking-tight">
          <span className={`${titleSizes[size]} ${textColor} font-black`}>Clinic</span>
          <span className={`${titleSizes[size]} text-[#15B8A6] font-black`}>OS</span>
        </div>
        {showSubtitle && (
          <span className={`${subtitleSizes[size]} ${subtitleColor} font-semibold tracking-wide`}>
            {subtitle}
          </span>
        )}
      </div>
    </div>
  )
}
