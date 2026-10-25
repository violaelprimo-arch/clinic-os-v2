'use client'

import { use, useEffect, useState, useMemo, useRef } from 'react'
import { db } from '@/lib/firebase'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import {
  Tv, Volume2, VolumeX, Maximize2, Minimize2, Clock,
  Calendar, Building2, User, Sparkles, CheckCircle2,
  AlertCircle, ChevronRight, Stethoscope, ArrowRight
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { ClinicLogo } from '@/components/clinic/ClinicLogo'
import Link from 'next/link'

export default function WaitingRoomTvPage({
  params
}: {
  params: Promise<{ slug: string }>
}) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug

  const [clinic, setClinic] = useState<any>(null)
  const [appointments, setAppointments] = useState<any[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all')
  const [currentTime, setCurrentTime] = useState<string>('')
  const [currentDateStr, setCurrentDateStr] = useState<string>('')
  const [isAudioEnabled, setIsAudioEnabled] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [previousServingTurn, setPreviousServingTurn] = useState<string | number | null>(null)

  // Audio Context Ref
  const audioCtxRef = useRef<AudioContext | null>(null)

  // Cairo today date string
  const cairoTodayDate = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date())
    } catch (e) {
      const d = new Date()
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
  }, [])

  // Clock Ticker (Runs every second)
  useEffect(() => {
    const updateClock = () => {
      const now = new Date()
      const timeStr = new Intl.DateTimeFormat('ar-EG', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        timeZone: 'Africa/Cairo'
      }).format(now)

      const dateText = new Intl.DateTimeFormat('ar-EG', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Africa/Cairo'
      }).format(now)

      setCurrentTime(timeStr)
      setCurrentDateStr(dateText)
    }

    updateClock()
    const interval = setInterval(updateClock, 1000)
    return () => clearInterval(interval)
  }, [])

  // Web Audio API Synthesized Hospital/Airport Ding-Dong Chime
  const playChimeSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioCtx()
      }
      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') {
        ctx.resume()
      }

      const now = ctx.currentTime

      // Tone 1: C5 (523.25 Hz)
      const osc1 = ctx.createOscillator()
      const gain1 = ctx.createGain()
      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(523.25, now)
      gain1.gain.setValueAtTime(0.25, now)
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5)
      osc1.connect(gain1)
      gain1.connect(ctx.destination)
      osc1.start(now)
      osc1.stop(now + 0.5)

      // Tone 2: E5 (659.25 Hz) delayed by 0.25s
      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.type = 'sine'
      osc2.frequency.setValueAtTime(659.25, now + 0.25)
      gain2.gain.setValueAtTime(0.28, now + 0.25)
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.85)
      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      osc2.start(now + 0.25)
      osc2.stop(now + 0.85)
    } catch (e) {
      console.warn('Audio chime error:', e)
    }
  }

  // Real-time Clinic Listener
  useEffect(() => {
    const q = query(collection(db, 'clinics'), where('slug', '==', slug))
    const unsub = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const cDoc = snapshot.docs[0]
        setClinic({ id: cDoc.id, ...cDoc.data() })
      }
    })
    return () => unsub()
  }, [slug])

  // Real-time Today Appointments Listener
  useEffect(() => {
    if (!clinic?.id) return
    const q = query(
      collection(db, 'appointments'),
      where('clinic_id', '==', clinic.id),
      where('date', '==', cairoTodayDate)
    )
    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
      setAppointments(list)
    })
    return () => unsub()
  }, [clinic?.id, cairoTodayDate])

  // Filter for Active Branch
  const branchAppointments = useMemo(() => {
    return appointments.filter(a => {
      if (selectedBranchId && selectedBranchId !== 'all') {
        const apptBranch = a.branch_id || a.branchId
        const isMain = selectedBranchId === 'main' || clinic?.branches?.find((b: any) => b.isMain)?.id === selectedBranchId
        return apptBranch ? apptBranch === selectedBranchId : isMain
      }
      return true
    })
  }, [appointments, selectedBranchId, clinic])

  // Current Patient (Status: in_progress)
  const currentPatient = useMemo(() => {
    return branchAppointments.find(a => a.status === 'in_progress') || null
  }, [branchAppointments])

  // Next Waiting Patients (Sorted by queue number)
  const nextWaitingPatients = useMemo(() => {
    return branchAppointments
      .filter(a => a.status === 'waiting')
      .sort((a, b) => Number(a.queue_number || 0) - Number(b.queue_number || 0))
      .slice(0, 5)
  }, [branchAppointments])

  // Trigger Chime when serving turn changes
  useEffect(() => {
    const currentTurn = currentPatient?.queue_number || null
    if (currentTurn !== null && previousServingTurn !== null && currentTurn !== previousServingTurn) {
      if (isAudioEnabled) {
        playChimeSound()
      }
    }
    if (currentTurn !== previousServingTurn) {
      setPreviousServingTurn(currentTurn)
    }
  }, [currentPatient, previousServingTurn, isAudioEnabled])

  // Toggle Fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }

  // Active branch label
  const activeBranchName = selectedBranchId !== 'all'
    ? clinic?.branches?.find((b: any) => b.id === selectedBranchId)?.name || 'الفرع المحدد'
    : clinic?.branchName || 'الفرع الرئيسي'

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-slate-950 text-white font-sans overflow-hidden flex flex-col justify-between select-none relative"
    >
      {/* Dynamic Ambient visionOS Aurora Glow Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-600/20 rounded-full blur-[140px] animate-pulse" />
        <div className="absolute top-1/2 left-1/4 w-96 h-96 bg-cyan-500/15 rounded-full blur-[160px] animate-pulse" />
        <div className="absolute -bottom-40 right-1/3 w-96 h-96 bg-emerald-500/15 rounded-full blur-[150px] animate-pulse" />
      </div>

      {/* TOP BAR */}
      <header className="relative z-20 px-8 py-5 border-b border-white/10 bg-slate-900/60 backdrop-blur-xl flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/15 p-2 flex items-center justify-center shadow-lg">
            {clinic?.logoUrl ? (
              <img src={clinic.logoUrl} alt={clinic.clinicName} className="w-full h-full object-contain" />
            ) : (
              <Stethoscope className="w-8 h-8 text-cyan-400" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-black text-white tracking-wide">
                {clinic?.clinicName || 'العيادة الطبية'}
              </h1>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                {activeBranchName}
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-400 mt-0.5">
              د. {clinic?.doctorName || 'العيادة'} {clinic?.specialty ? `• ${clinic.specialty}` : ''}
            </p>
          </div>
        </div>

        {/* Digital Clock & Date */}
        <div className="flex items-center gap-8">
          <div className="text-center font-mono">
            <div className="text-3xl font-black tracking-widest text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.4)]">
              {currentTime || '--:--:--'}
            </div>
            <div className="text-xs font-bold text-slate-400 mt-0.5">
              {currentDateStr}
            </div>
          </div>

          {/* Controls: Audio & Fullscreen */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setIsAudioEnabled(!isAudioEnabled)
                if (!isAudioEnabled) {
                  playChimeSound()
                }
              }}
              className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                isAudioEnabled
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
              }`}
              title={isAudioEnabled ? 'التنبيه الصوتي مفعل' : 'تفعيل التنبيه الصوتي (Chime)'}
            >
              {isAudioEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>

            <button
              onClick={toggleFullscreen}
              className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all cursor-pointer"
              title="ملء الشاشة للتلفزيون"
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Audio Enable Prompt Banner if not enabled yet */}
      {!isAudioEnabled && (
        <div className="relative z-20 bg-blue-600/30 border-b border-blue-500/30 px-6 py-2 text-center text-xs font-bold text-blue-200 flex items-center justify-center gap-2">
          <Volume2 className="w-4 h-4 text-cyan-300 animate-pulse" />
          <span>انقر على زر السماعة في الأعلى لتفعيل الرنين الصوتي عند مناداة المريض القادم 🔔</span>
          <button
            onClick={() => {
              setIsAudioEnabled(true)
              playChimeSound()
            }}
            className="px-2.5 py-0.5 rounded-lg bg-cyan-500 text-slate-950 font-black text-[11px] cursor-pointer hover:bg-cyan-400 transition-colors"
          >
            تفعيل الآن
          </button>
        </div>
      )}

      {/* MAIN SCREEN BODY (Two Columns Grid for Smart TV) */}
      <main className="relative z-10 flex-1 p-6 md:p-10 grid lg:grid-cols-12 gap-8 items-stretch">
        
        {/* RIGHT COLUMN: HERO (الدور الحالي الآن - 7 cols) */}
        <section className="lg:col-span-7 flex flex-col justify-center">
          <motion.div
            layout
            className="h-full rounded-3xl p-8 sm:p-10 bg-slate-900/80 border-2 border-white/15 backdrop-blur-2xl shadow-2xl flex flex-col justify-between relative overflow-hidden group"
          >
            {/* Glowing Border Accent */}
            <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-cyan-500 via-blue-500 to-emerald-500" />

            {/* Status Heading */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <span className="relative flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]"></span>
                </span>
                <span className="text-xl font-black text-emerald-400 tracking-wider uppercase">
                  الدور الحالي • تفضل بالدخول الآن
                </span>
              </div>
              <span className="text-sm font-bold px-3 py-1 rounded-xl bg-white/10 text-slate-300 border border-white/10">
                غرفة الكشف
              </span>
            </div>

            {/* Giant Serving Turn Card */}
            {currentPatient ? (
              <div className="py-8 my-auto text-center space-y-6">
                <div>
                  <span className="text-base font-bold text-slate-400 block tracking-widest uppercase">
                    رقم الدور
                  </span>
                  <motion.div
                    key={currentPatient.id + currentPatient.queue_number}
                    initial={{ scale: 0.85, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                    className="text-8xl sm:text-9xl font-black font-mono text-cyan-400 drop-shadow-[0_0_35px_rgba(34,211,238,0.5)] my-2"
                  >
                    #{currentPatient.queue_number}
                  </motion.div>
                </div>

                <div className="space-y-2">
                  <h2 className="text-3xl sm:text-4xl font-black text-white tracking-wide">
                    {currentPatient.patientName}
                  </h2>
                  <div className="flex items-center justify-center gap-3 flex-wrap">
                    <span className="text-base font-bold px-4 py-1.5 rounded-2xl bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                      {currentPatient.serviceName || 'كشف طبي'}
                    </span>
                    {currentPatient.branchName && (
                      <span className="text-sm text-slate-400 font-semibold">
                        • {currentPatient.branchName}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-16 my-auto text-center space-y-4">
                <div className="w-24 h-24 rounded-full bg-white/5 border border-white/10 mx-auto flex items-center justify-center text-slate-500">
                  <User className="w-12 h-12" />
                </div>
                <h3 className="text-2xl font-black text-slate-300">
                  عيادة الطبيب بانتظار استدعاء المريض القادم
                </h3>
                <p className="text-sm text-slate-500">
                  يرجى من السادة المرضى الكرام التواجد في صالة الانتظار ومتابعة الشاشة
                </p>
              </div>
            )}

            {/* Doctor Card Footer */}
            <div className="pt-4 border-t border-white/10 flex items-center justify-between text-slate-400 text-sm">
              <div className="flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-cyan-400" />
                <span>د. {clinic?.doctorName || 'العيادة'}</span>
              </div>
              <div className="font-mono text-xs">
                {currentPatient ? `جارٍ الكشف الآن • يرجى الانتظار` : 'العيادة جاهزة لاستقبال المرضى'}
              </div>
            </div>
          </motion.div>
        </section>

        {/* LEFT COLUMN: UPCOMING QUEUE (قائمة الانتظار القادمة - 5 cols) */}
        <section className="lg:col-span-5 flex flex-col justify-between">
          <div className="h-full rounded-3xl p-6 sm:p-7 bg-slate-900/60 border border-white/10 backdrop-blur-xl shadow-2xl flex flex-col justify-between space-y-4">
            
            {/* Heading */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-black text-white">
                  الأدوار القادمة بالانتظار
                </h3>
              </div>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                {nextWaitingPatients.length} بالانتظار
              </span>
            </div>

            {/* Next Patients List */}
            <div className="flex-1 space-y-3 overflow-hidden">
              <AnimatePresence mode="popLayout">
                {nextWaitingPatients.length > 0 ? (
                  nextWaitingPatients.map((p, idx) => (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ delay: idx * 0.08 }}
                      className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${
                        idx === 0
                          ? 'bg-blue-600/20 border-blue-500/40 shadow-lg shadow-blue-600/10'
                          : 'bg-white/5 border-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black font-mono text-xl ${
                          idx === 0
                            ? 'bg-blue-500 text-white shadow-md shadow-blue-500/40'
                            : 'bg-white/10 text-slate-300'
                        }`}>
                          #{p.queue_number}
                        </div>
                        <div>
                          <h4 className="text-base font-bold text-white">
                            {p.patientName}
                          </h4>
                          <p className="text-xs text-slate-400 font-semibold">
                            {p.serviceName || 'كشف طبي'}
                          </p>
                        </div>
                      </div>

                      <div className="text-left font-mono">
                        {idx === 0 ? (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                            التالي في الدور
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">
                            قريباً
                          </span>
                        )}
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-2 text-slate-500">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500/50" />
                    <p className="text-sm font-bold">لا يوجد مرضى آخرين في قائمة الانتظار حالياً</p>
                  </div>
                )}
              </AnimatePresence>
            </div>

            {/* Fast Instructions Box */}
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-xs text-slate-400 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-300">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>تعليمات صالة الانتظار:</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                يُرجى الالتزام بالهدوء وتجهيز كارت الكشف أو رسالة الواتساب. سيتم تشغيل نغمة صوتية تلقائياً عند استدعاء كل دور.
              </p>
            </div>

          </div>
        </section>

      </main>

      {/* BOTTOM TICKER / MARQUEE BANNER */}
      <footer className="relative z-20 bg-slate-900/90 border-t border-white/10 px-6 py-3 flex items-center overflow-hidden">
        <div className="shrink-0 flex items-center gap-2 font-black text-xs text-cyan-400 pe-4 border-e border-white/10">
          <Sparkles className="w-4 h-4" />
          <span>تنويه العيادة:</span>
        </div>
        <div className="flex-1 overflow-hidden whitespace-nowrap ps-4">
          <div className="inline-block animate-marquee text-xs font-bold text-slate-300">
            أهلاً بكم في {clinic?.clinicName || 'العيادة الطبية'} • نرجو من السادة المرضى الكرام الالتزام بأرقام الدور الموضحة بالشاشة • نعتذر عن أي انتظار ونتمنى لكم الشفاء العاجل ودوام الصحة والعافية • للحجز والاستفسارات يرجى مراجعة موظف الاستقبال.
          </div>
        </div>
      </footer>

      {/* Marquee Animation Style */}
      <style jsx global>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          animation: marquee 28s linear infinite;
        }
      `}</style>
    </div>
  )
}
