'use client'

import React from 'react'

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
  // Height classes for full logo image - unified to the prominent larger size
  const heightClasses = {
    sm: 'h-10 sm:h-11',
    md: 'h-10 sm:h-11',
    lg: 'h-12 sm:h-14',
    xl: 'h-16 sm:h-18'
  }

  // Icon only sizes
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  }

  // Application Icon
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

  const commonImgClass = `${heightClasses[size]} w-auto object-contain drop-shadow-sm transition-opacity duration-200`

  return (
    <div className={`inline-flex flex-col items-start select-none ${className}`} dir="ltr">
      <div className="flex items-center">
        {variant === 'auto' ? (
          <>
            {/* Light Mode Logo (Visible in light mode, hidden in dark mode) */}
            <img
              src="/brand/yalla-clinic/logo-light-bg.png"
              alt="Yalla Clinic"
              className={`${commonImgClass} logo-light-mode dark:hidden`}
            />
            {/* Dark Mode Logo (Visible in dark mode, hidden in light mode) */}
            <img
              src="/brand/yalla-clinic/logo-dark-bg.png"
              alt="Yalla Clinic"
              className={`${commonImgClass} logo-dark-mode hidden dark:block`}
            />
          </>
        ) : variant === 'dark' ? (
          <img
            src="/brand/yalla-clinic/logo-dark-bg.png"
            alt="Yalla Clinic"
            className={commonImgClass}
          />
        ) : (
          <img
            src="/brand/yalla-clinic/logo-light-bg.png"
            alt="Yalla Clinic"
            className={commonImgClass}
          />
        )}
      </div>

      {showSubtitle && (
        <span
          className={`text-[10px] font-bold mt-0.5 ${
            variant === 'dark'
              ? 'text-[#02CFF3]'
              : variant === 'light'
              ? 'text-[#087CF4]'
              : 'text-[#087CF4] dark:text-[#02CFF3]'
          }`}
          dir="rtl"
        >
          {subtitle}
        </span>
      )}
    </div>
  )
}
