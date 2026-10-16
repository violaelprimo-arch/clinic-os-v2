'use client'

import React, { useState, useEffect } from 'react'
import { Bell, RotateCw, Check, X } from 'lucide-react'

export function PatientLiveTurn({
  clinic,
  patientName = 'محمد علي',
  initialQueueNumber = 6,
  onClose
}: {
  clinic?: any
  patientName?: string
  initialQueueNumber?: number
  onClose?: () => void
}) {
  const [queueNumber, setQueueNumber] = useState<number>(initialQueueNumber)
  const [aheadCount, setAheadCount] = useState<number>(Math.max(0, initialQueueNumber - 1))
  const [waitMinutes, setWaitMinutes] = useState<number>(Math.max(0, (initialQueueNumber - 1) * 5))
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true)
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(false)

  const fetchLiveQueue = async () => {
    if (!clinic?.slug) return
    try {
      const res = await fetch(`/api/clinic/${clinic.slug}/queue`)
      if (res.ok) {
        const data = await res.json()
        if (typeof data?.currentTurn === 'number') {
          setQueueNumber(data.currentTurn)
          setAheadCount(Math.max(0, data.aheadCount ?? data.currentTurn - 1))
          setWaitMinutes(Math.max(0, (data.aheadCount ?? data.currentTurn - 1) * 5))
        }
      }
    } catch {
      // Keep current display values on offline/fallback
    }
  }

  useEffect(() => {
    if (!autoRefresh) return
    const timer = setInterval(fetchLiveQueue, 15000)
    return () => clearInterval(timer)
  }, [autoRefresh, clinic?.slug])

  const maxTurn = 8
  const progress = Math.max(0.1, (maxTurn - aheadCount) / maxTurn)
  const dashOffset = (301.59 * (1 - progress)).toFixed(1)

  return (
    <div dir="rtl" className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-[395px] rounded-[40px] bg-gradient-to-b from-[#071529] via-[#091b34] to-[#051020] text-white p-6 shadow-2xl border border-sky-400/20 space-y-5 my-auto">
        {/* Top Bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setNotificationsEnabled(!notificationsEnabled)}
            className="relative w-9 h-9 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center text-sky-300 transition-colors"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-rose-500" />
          </button>

          <div className="text-xl font-extrabold tracking-tight" dir="ltr">
            <span className="text-sky-400">yalla</span>
            <span className="text-slate-300 font-semibold">clinic</span>
          </div>

          {onClose ? (
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <div className="w-9" />
          )}
        </div>

        {/* Welcome Header */}
        <div className="flex items-center justify-center gap-3 py-1">
          <div className="text-right">
            <div className="text-xs text-sky-300/90 font-medium">أهلاً بك</div>
            <div className="text-base font-black text-white">{patientName}</div>
          </div>
          <div className="w-12 h-12 rounded-full bg-sky-500/20 border-2 border-sky-400 flex items-center justify-center font-black text-sky-300 text-lg">
            {patientName.charAt(0)}
          </div>
        </div>

        {/* Main Queue Card */}
        <div className="bg-[#0c213d]/90 backdrop-blur-xl rounded-[28px] p-5 border border-sky-400/20 shadow-2xl space-y-5">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <button onClick={fetchLiveQueue} title="تحديث الدور" className="text-slate-400 hover:text-white">
              <RotateCw className="w-4 h-4" />
            </button>
            <span className="font-bold text-sm text-sky-100">رقم دورك الحالي</span>
            <span className="w-4" />
          </div>

          {/* Circular Neon Ring Gauge */}
          <div className="relative w-40 h-40 mx-auto flex items-center justify-center">
            <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="48" stroke="rgba(56, 189, 248, 0.14)" strokeWidth="10" fill="transparent" />
              <circle
                cx="60"
                cy="60"
                r="48"
                stroke="#00d4ff"
                strokeWidth="10"
                strokeDasharray="301.59"
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-5xl font-black text-white drop-shadow-[0_0_14px_rgba(56,189,248,0.65)]">
                {queueNumber}
              </span>
            </div>
          </div>

          <div className="text-center -mt-2">
            <span className="text-xs font-bold text-sky-300 bg-sky-500/15 px-3.5 py-1 rounded-full border border-sky-400/25">
              {queueNumber === 1 ? 'حان دورك الآن • تفضل بالدخول' : 'في الانتظار'}
            </span>
          </div>

          {/* 2 Metric Boxes */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="bg-[#08172c] rounded-2xl p-3 text-center border border-white/5">
              <div className="text-base font-black text-white">
                <span className="text-lg text-sky-400">{waitMinutes}</span> دقيقة
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">الوقت المتوقع</div>
            </div>
            <div className="bg-[#08172c] rounded-2xl p-3 text-center border border-white/5">
              <div className="text-lg font-black text-sky-400">{aheadCount}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">عدد المنتظرين قبلك</div>
            </div>
          </div>

          {/* 4 Timeline Steps */}
          <div className="space-y-3.5 pt-2 pr-2">
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className="w-4 h-4 rounded-full bg-sky-400 flex items-center justify-center text-[9px] text-slate-950 font-bold">
                  <Check className="w-2.5 h-2.5" />
                </div>
                <div className="w-0.5 h-7 bg-sky-400/60 mt-1" />
              </div>
              <div className="flex-1 flex items-center justify-between -mt-0.5">
                <span className="text-xs font-bold text-white">تم تأكيد الحجز</span>
                <span className="text-[11px] text-slate-400">10:30 ص</span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className="w-4 h-4 rounded-full bg-sky-400 ring-4 ring-sky-400/25 animate-pulse" />
                <div className="w-0.5 h-7 bg-slate-700 mt-1" />
              </div>
              <div className="flex-1 flex items-center justify-between -mt-0.5">
                <span className="text-xs font-bold text-sky-300">أنت في قائمة الانتظار</span>
                <span className="text-[11px] text-sky-400 font-bold">الآن</span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className={`w-4 h-4 rounded-full ${queueNumber <= 2 ? 'bg-amber-400 ring-4 ring-amber-400/25' : 'bg-slate-700 border border-slate-500'}`} />
                <div className="w-0.5 h-7 bg-slate-700 mt-1" />
              </div>
              <div className="flex-1 flex items-center justify-between -mt-0.5">
                <span className="text-xs font-bold text-slate-400">الدور قريب</span>
                <span className="text-[11px] text-slate-500">قريباً</span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className={`w-4 h-4 rounded-full ${queueNumber === 1 ? 'bg-emerald-400 ring-4 ring-emerald-400/30' : 'bg-slate-700 border border-slate-500'}`} />
              </div>
              <div className="flex-1 flex items-center justify-between -mt-0.5">
                <span className="text-xs font-bold text-slate-400">دخل للكشف</span>
                <span className="text-[11px] text-slate-500">عيادة 1</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="space-y-2.5 pt-1">
          <button
            type="button"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="w-full py-3.5 rounded-full bg-gradient-to-r from-sky-500 to-cyan-400 text-slate-950 font-black text-sm shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <RotateCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            <span>تحديث تلقائي</span>
          </button>

          <button
            type="button"
            onClick={() => setNotificationsEnabled(!notificationsEnabled)}
            className="w-full py-3 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all"
          >
            <Bell className="w-4 h-4 text-sky-400" />
            <span>{notificationsEnabled ? 'الإشعارات الفورية مفعلة ✓' : 'إشعارات فورية'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
