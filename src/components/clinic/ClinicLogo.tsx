'use client'

import React from 'react'
import { useTheme } from '@/context/ThemeContext'

interface ClinicLogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'light' | 'dark' | 'auto'
  showSubtitle?: boolean
  subtitle?: string
  iconOnly?: boolean
}

export function ClinicLogo({
  className = '',
  size = 'md',
  variant = 'auto',
  showSubtitle = false,
  subtitle = 'نظام العيادات الذكي',
  iconOnly = false
}: ClinicLogoProps) {
  let activeTheme = 'light'
  try {
    const themeCtx = useTheme()
    activeTheme = themeCtx.theme
  } catch (e) {
    // If rendered outside ThemeProvider
    activeTheme = 'light'
  }

  const effectiveVariant = variant === 'auto' ? activeTheme : variant

  // Height classes for full logo image
  const heightClasses = {
    sm: 'h-7 sm:h-8',
    md: 'h-9 sm:h-10',
    lg: 'h-11 sm:h-13',
    xl: 'h-14 sm:h-16'
  }

  // Icon only sizes
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  }

  // Official brand assets:
  // Primary Logo for Light Background: /brand/yalla-clinic/logo-light-bg.png
  // Logo for Dark Background: /brand/yalla-clinic/logo-dark-bg.png
  // Application Icon: /brand/yalla-clinic/app-icon.png
  const logoSrc =
    effectiveVariant === 'dark'
      ? '/brand/yalla-clinic/logo-dark-bg.png'
      : '/brand/yalla-clinic/logo-light-bg.png'

  if (iconOnly) {
    return (
      <div className={`inline-flex items-center shrink-0 ${className}`}>
        <img
          src="/brand/yalla-clinic/app-icon.png"
          alt="Yalla Clinic Icon"
          className={`${iconSizes[size]} rounded-2xl object-contain drop-shadow-sm`}
        />
      </div>
    )
  }

  return (
    <div className={`inline-flex flex-col items-start select-none ${className}`} dir="ltr">
      <div className="flex items-center">
        <img
          src={logoSrc}
          alt="Yalla Clinic"
          className={`${heightClasses[size]} w-auto max-w-[220px] sm:max-w-none object-contain drop-shadow-sm`}
        />
      </div>
      {showSubtitle && (
        <span
          className={`text-[10px] font-bold mt-0.5 ${
            effectiveVariant === 'dark' ? 'text-[#02CFF3]' : 'text-[#087CF4]'
          }`}
          dir="rtl"
        >
          {subtitle}
        </span>
      )}
    </div>
  )
}
