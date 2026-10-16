'use client'

import React from 'react'
import { motion } from 'framer-motion'

interface ClinicLoadingProps {
  label?: string
  fullScreen?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function ClinicLoading({
  label,
  fullScreen = false,
  size = 'md',
  className = ''
}: ClinicLoadingProps) {
  const iconSizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-16 h-16',
    lg: 'w-20 h-20'
  }

  const ringSizeClasses = {
    sm: 'w-14 h-14',
    md: 'w-22 h-22',
    lg: 'w-28 h-28'
  }

  const content = (
    <div className={`flex flex-col items-center justify-center gap-4 select-none ${className}`}>
      {/* Icon with Ambient Breathing Glow & Floating Motion */}
      <div className="relative flex items-center justify-center">
        {/* Soft Ambient Cyan/Blue Glow behind Icon */}
        <div className="absolute inset-0 bg-primary/25 dark:bg-[#02CFF3]/30 rounded-full blur-2xl animate-pulse pointer-events-none" />

        {/* Outer Circular Gradient Pulse Ring */}
        <div className={`absolute ${ringSizeClasses[size]} rounded-full border border-primary/20 dark:border-[#02CFF3]/25 animate-ping opacity-25`} />

        {/* Floating Brand Icon */}
        <motion.div
          animate={{
            y: [-3, 3, -3],
            scale: [1, 1.02, 1]
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
          className="relative z-10"
        >
          <img
            src="/brand/yalla-clinic/app-icon.png"
            alt="Yalla Clinic"
            className={`${iconSizeClasses[size]} rounded-2xl object-contain drop-shadow-[0_8px_20px_rgba(8,124,244,0.35)]`}
          />
        </motion.div>
      </div>

      {/* Loading Spinner & Label */}
      {label && (
        <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold text-muted-foreground mt-1">
          <div className="w-4 h-4 border-2 border-primary dark:border-[#02CFF3] border-t-transparent rounded-full animate-spin shrink-0" />
          <span className="tracking-wide text-foreground/80">{label}</span>
        </div>
      )}
    </div>
  )

  if (fullScreen) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 transition-colors">
        {content}
      </div>
    )
  }

  return content
}
