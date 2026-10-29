import React from 'react'

export function TvLoadingSkeleton({ slug }: { slug?: string }) {
  return (
    <div
      dir="rtl"
      className="min-h-screen font-sans overflow-hidden flex flex-col justify-between select-none relative bg-slate-950 text-white"
    >
      {/* Ambient Background Glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-600/20 rounded-full blur-[140px] animate-pulse" />
        <div className="absolute top-1/2 left-1/4 w-96 h-96 bg-cyan-500/15 rounded-full blur-[160px] animate-pulse" />
        <div className="absolute -bottom-40 right-1/3 w-96 h-96 bg-emerald-500/15 rounded-full blur-[150px] animate-pulse" />
      </div>

      {/* TOP HEADER */}
      <header className="relative z-20 px-8 py-5 border-b border-white/10 bg-slate-900/70 text-white backdrop-blur-xl flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl border border-white/15 bg-white/10 p-2 flex items-center justify-center shadow-md animate-pulse">
            <div className="w-8 h-8 rounded-lg bg-cyan-400/20" />
          </div>
          <div className="space-y-2">
            <div className="h-6 w-48 bg-white/20 rounded-md animate-pulse" />
            <div className="h-4 w-28 bg-white/10 rounded-md animate-pulse" />
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-left space-y-1">
            <div className="h-7 w-28 bg-cyan-400/20 rounded-md animate-pulse" />
            <div className="h-4 w-36 bg-white/10 rounded-md animate-pulse" />
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="relative z-10 flex-1 px-8 py-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch max-w-[1920px] mx-auto w-full">
        {/* RIGHT COLUMN: Active Patient */}
        <div className="lg:col-span-7 flex flex-col justify-center">
          <div className="relative rounded-3xl border border-white/15 bg-slate-900/60 p-8 shadow-2xl backdrop-blur-2xl flex flex-col items-center justify-center text-center min-h-[480px]">
            <div className="h-5 w-40 bg-white/20 rounded-full mb-6 animate-pulse" />
            <div className="w-48 h-32 bg-cyan-500/10 border border-cyan-500/20 rounded-3xl flex items-center justify-center mb-6 animate-pulse">
              <div className="h-20 w-28 bg-cyan-400/20 rounded-2xl" />
            </div>
            <div className="h-7 w-64 bg-white/15 rounded-xl mb-3 animate-pulse" />
            <div className="h-4 w-48 bg-white/10 rounded-lg animate-pulse" />
          </div>
        </div>

        {/* LEFT COLUMN: Upcoming Queue */}
        <div className="lg:col-span-5 flex flex-col justify-center space-y-4">
          <div className="flex items-center justify-between px-2">
            <div className="h-5 w-32 bg-white/20 rounded-md animate-pulse" />
            <div className="h-4 w-20 bg-white/10 rounded-md animate-pulse" />
          </div>

          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="rounded-2xl border border-white/10 bg-slate-900/40 p-4 flex items-center justify-between backdrop-blur-xl animate-pulse"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/10" />
                  <div className="space-y-2">
                    <div className="h-4 w-32 bg-white/15 rounded" />
                    <div className="h-3 w-20 bg-white/10 rounded" />
                  </div>
                </div>
                <div className="h-6 w-16 bg-white/10 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* FOOTER TICKER */}
      <footer className="relative z-20 border-t border-white/10 bg-slate-900/80 px-6 py-4 shadow-2xl backdrop-blur-xl flex items-center gap-4">
        <div className="h-8 w-24 bg-cyan-500/20 rounded-xl animate-pulse shrink-0" />
        <div className="flex-1 h-5 bg-white/10 rounded-md animate-pulse" />
      </footer>
    </div>
  )
}
