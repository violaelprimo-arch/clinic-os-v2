'use client'

import React from 'react'

export function ClinicLandingSkeleton({ isRtl = true }: { isRtl?: boolean }) {
  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="min-h-screen flex flex-col bg-[#f4f9ff] dark:bg-[#050d1a] text-slate-900 dark:text-slate-50 font-sans transition-colors overflow-x-hidden animate-pulse"
      aria-busy="true"
      aria-label={isRtl ? 'جاري تحميل العيادة...' : 'Loading clinic...'}
    >
      {/* Header Skeleton */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-[#081526]/90 backdrop-blur-xl border-b border-sky-100 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Book button placeholder */}
            <div className="h-9 sm:h-10 w-24 sm:w-28 rounded-xl bg-sky-200 dark:bg-slate-700" />
            {/* Login button placeholder */}
            <div className="h-9 sm:h-10 w-20 sm:w-24 rounded-xl bg-slate-200 dark:bg-slate-800" />
            {/* Theme & Lang toggles placeholder */}
            <div className="h-9 sm:h-10 w-16 sm:w-20 rounded-xl bg-slate-100 dark:bg-slate-800" />
          </div>

          <div className="hidden lg:flex items-center gap-6">
            <div className="h-4 w-14 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-4 w-16 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-4 w-20 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-4 w-14 rounded bg-slate-200 dark:bg-slate-800" />
          </div>

          {/* Logo placeholder */}
          <div className="h-9 sm:h-10 w-28 sm:w-36 rounded-xl bg-slate-200 dark:bg-slate-800" />
        </div>
      </header>

      {/* Hero Section Skeleton */}
      <section className="relative pt-10 pb-20 lg:pt-14 lg:pb-28 overflow-hidden bg-gradient-to-b from-[#e8f3ff] via-[#f5faff] to-white dark:from-[#071426] dark:via-[#0a1b33] dark:to-[#071222]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
            {/* Visual Column */}
            <div className="lg:col-span-6 order-2 lg:order-1">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-5">
                {/* 4 Trust Pills */}
                <div className="grid grid-cols-2 sm:flex sm:flex-col gap-2.5 sm:gap-3 w-full sm:w-auto">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="h-12 sm:h-14 w-full sm:w-44 rounded-xl sm:rounded-2xl bg-white/90 dark:bg-slate-800/85 border border-white dark:border-sky-500/20 shadow-xs"
                    />
                  ))}
                </div>

                {/* Doctor Portrait Card Skeleton */}
                <div className="w-56 sm:w-64 md:w-72 lg:w-80 h-72 sm:h-80 md:h-96 rounded-[28px] sm:rounded-[32px] overflow-hidden border-4 border-white dark:border-slate-800 shadow-2xl bg-gradient-to-b from-sky-100 to-sky-200 dark:from-slate-800 dark:to-slate-900 relative">
                  <div className="absolute bottom-3 right-3 left-3 h-14 rounded-xl bg-slate-300/60 dark:bg-slate-700/60" />
                </div>
              </div>
            </div>

            {/* Text Column */}
            <div className="lg:col-span-6 order-1 lg:order-2 space-y-5 text-center lg:text-start">
              {/* Badge */}
              <div className="h-7 w-48 rounded-full bg-sky-200 dark:bg-sky-950/80 mx-auto lg:mx-0" />

              {/* Title */}
              <div className="space-y-3">
                <div className="h-10 sm:h-12 w-3/4 rounded-2xl bg-slate-300 dark:bg-slate-700 mx-auto lg:mx-0" />
                <div className="h-8 sm:h-10 w-1/2 rounded-xl bg-sky-200 dark:bg-sky-900/60 mx-auto lg:mx-0" />
              </div>

              {/* Subtitles */}
              <div className="space-y-2">
                <div className="h-4 w-5/6 rounded bg-slate-200 dark:bg-slate-800 mx-auto lg:mx-0" />
                <div className="h-4 w-2/3 rounded bg-slate-200 dark:bg-slate-800 mx-auto lg:mx-0" />
              </div>

              {/* Buttons */}
              <div className="pt-3 flex flex-wrap items-center justify-center lg:justify-start gap-3">
                <div className="h-12 sm:h-14 w-40 rounded-full bg-sky-400 dark:bg-sky-600" />
                <div className="h-12 sm:h-14 w-32 rounded-full bg-slate-200 dark:bg-slate-800" />
                <div className="h-12 sm:h-14 w-32 rounded-full bg-slate-200 dark:bg-slate-800" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Skeleton */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="bg-white dark:bg-[#081526] rounded-[28px] sm:rounded-[36px] p-6 sm:p-10 shadow-xl border border-sky-100/80 dark:border-slate-800">
          <div className="h-8 w-56 rounded-xl bg-slate-200 dark:bg-slate-800 mx-auto mb-8" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-36 rounded-2xl p-4 bg-slate-100 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 flex flex-col items-center justify-center gap-2"
              >
                <div className="w-12 h-12 rounded-2xl bg-sky-200 dark:bg-sky-900/50" />
                <div className="h-4 w-20 rounded bg-slate-300 dark:bg-slate-700" />
                <div className="h-3 w-14 rounded bg-slate-200 dark:bg-slate-800" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
