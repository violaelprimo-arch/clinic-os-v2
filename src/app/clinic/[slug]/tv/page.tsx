'use client'

import { use, useEffect, useState, useMemo, useRef } from 'react'
import { db } from '@/lib/firebase'
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore'
import {
  Tv, Volume2, VolumeX, Maximize2, Minimize2, Clock,
  Calendar, Building2, User, Sparkles, CheckCircle2,
  AlertCircle, ChevronRight, Stethoscope, ArrowRight,
  Sun, Moon, Settings, X, Save, RotateCcw, Megaphone
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import Link from 'next/link'

interface TvConfig {
  tickerText: string
  instructionsText: string
  announceName: boolean
  tickerSpeed: 'normal' | 'slow' | 'fast'
}

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

  // Light / Dark Mode State
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark')

  // Screen Settings Modal State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isSavingSettings, setIsSavingSettings] = useState(false)

  // Default texts
  const defaultTickerText = useMemo(() => {
    const cName = clinic?.clinicName || 'العيادة الطبية'
    return `أهلاً بكم في ${cName} • نرجو من السادة المرضى الكرام الالتزام بأرقام الدور الموضحة بالشاشة • نعتذر عن أي انتظار ونتمنى لكم الشفاء العاجل ودوام الصحة والعافية • للاستفسارات والحجز يرجى مراجعة موظف الاستقبال.`
  }, [clinic?.clinicName])

  const defaultInstructionsText = 'يُرجى الالتزام بالهدوء داخل صالة الانتظار وتجهيز كارت الكشف أو رسالة الواتساب. سيتم إطلاق تنبيه صوتي والنداء التلقائي على المريض عند استدعاء كل دور.'

  // TV Screen Config
  const [tvConfig, setTvConfig] = useState<TvConfig>({
    tickerText: '',
    instructionsText: '',
    announceName: true,
    tickerSpeed: 'normal'
  })

  // Audio Context Ref
  const audioCtxRef = useRef<AudioContext | null>(null)

  // Load Saved Theme and Settings from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem(`clinic_${slug}_tv_theme`) as 'dark' | 'light'
      if (savedTheme) {
        setThemeMode(savedTheme)
      }

      const savedConfig = localStorage.getItem(`clinic_${slug}_tv_settings`)
      if (savedConfig) {
        try {
          const parsed = JSON.parse(savedConfig)
          setTvConfig(prev => ({ ...prev, ...parsed }))
        } catch (e) {}
      }
    }
  }, [slug])

  // Sync settings with Firestore clinic doc if available
  useEffect(() => {
    if (clinic?.tvSettings) {
      setTvConfig(prev => ({
        ...prev,
        tickerText: clinic.tvSettings.tickerText || prev.tickerText,
        instructionsText: clinic.tvSettings.instructionsText || prev.instructionsText,
        announceName: clinic.tvSettings.announceName !== undefined ? clinic.tvSettings.announceName : prev.announceName,
        tickerSpeed: clinic.tvSettings.tickerSpeed || prev.tickerSpeed
      }))
    }
  }, [clinic?.tvSettings])

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

  // Arabic Speech Synthesis Voice Announcement (نداء صوتي لدخول المريض رقم كذا)
  const speakAnnouncement = (turnNumber: string | number, patientName?: string, callName = true) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return

    try {
      window.speechSynthesis.cancel()

      const turn = String(turnNumber).trim()
      const name = (callName && patientName && patientName.trim()) ? `${patientName.trim()}، ` : ''
      const textToSpeak = `تنبيه: مريض رقم ${turn}، ${name}تفضل بالدخول لغرفة الكشف.`

      const utterance = new SpeechSynthesisUtterance(textToSpeak)
      utterance.lang = 'ar-SA'
      utterance.rate = 0.88 // Slightly slower for crisp clinic acoustics
      utterance.pitch = 1.05

      // Find best available Arabic voice in browser
      const voices = window.speechSynthesis.getVoices()
      const arabicVoice = voices.find(v => v.lang.startsWith('ar') || v.lang.includes('ar-') || v.lang.includes('AR'))
      if (arabicVoice) {
        utterance.voice = arabicVoice
      }

      window.speechSynthesis.speak(utterance)
    } catch (err) {
      console.warn('Speech synthesis error:', err)
    }
  }

  // Combined Chime + Voice Call Trigger
  const triggerPatientVoiceCall = (turnNumber: string | number, patientName?: string) => {
    playChimeSound()
    setTimeout(() => {
      speakAnnouncement(turnNumber, patientName, tvConfig.announceName)
    }, 600)
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

  // Trigger Voice Call when serving turn changes
  useEffect(() => {
    const currentTurn = currentPatient?.queue_number || null
    if (currentTurn !== null && previousServingTurn !== null && currentTurn !== previousServingTurn) {
      if (isAudioEnabled) {
        triggerPatientVoiceCall(currentTurn, currentPatient?.patientName)
      }
    }
    if (currentTurn !== previousServingTurn) {
      setPreviousServingTurn(currentTurn)
    }
  }, [currentPatient, previousServingTurn, isAudioEnabled, tvConfig.announceName])

  // Toggle Theme Mode (Dark <-> Light)
  const toggleTheme = () => {
    const nextMode = themeMode === 'dark' ? 'light' : 'dark'
    setThemeMode(nextMode)
    if (typeof window !== 'undefined') {
      localStorage.setItem(`clinic_${slug}_tv_theme`, nextMode)
    }
  }

  // Toggle Fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }

  // Save Settings (Local + Cloud Firestore)
  const handleSaveSettings = async () => {
    setIsSavingSettings(true)
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(`clinic_${slug}_tv_settings`, JSON.stringify(tvConfig))
      }

      if (clinic?.id) {
        await updateDoc(doc(db, 'clinics', clinic.id), {
          tvSettings: tvConfig
        })
      }
      toast.success('تم حفظ إعدادات الشاشة والنداء الصوتي بنجاح')
      setIsSettingsOpen(false)
    } catch (e) {
      toast.success('تم حفظ الإعدادات محلياً للشاشة بنجاح')
      setIsSettingsOpen(false)
    } finally {
      setIsSavingSettings(false)
    }
  }

  // Active branch label
  const activeBranchName = selectedBranchId !== 'all'
    ? clinic?.branches?.find((b: any) => b.id === selectedBranchId)?.name || 'الفرع المحدد'
    : clinic?.branchName || 'الفرع الرئيسي'

  // Computed display texts
  const activeTickerText = tvConfig.tickerText && tvConfig.tickerText.trim() ? tvConfig.tickerText.trim() : defaultTickerText
  const activeInstructionsText = tvConfig.instructionsText && tvConfig.instructionsText.trim() ? tvConfig.instructionsText.trim() : defaultInstructionsText

  const marqueeDuration = tvConfig.tickerSpeed === 'fast' ? '18s' : tvConfig.tickerSpeed === 'slow' ? '40s' : '28s'

  const isDark = themeMode === 'dark'

  return (
    <div
      dir="rtl"
      className={`min-h-screen font-sans overflow-hidden flex flex-col justify-between select-none relative transition-colors duration-300 ${
        isDark ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-900'
      }`}
    >
      {/* Dynamic Ambient Background Glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {isDark ? (
          <>
            <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-600/20 rounded-full blur-[140px] animate-pulse" />
            <div className="absolute top-1/2 left-1/4 w-96 h-96 bg-cyan-500/15 rounded-full blur-[160px] animate-pulse" />
            <div className="absolute -bottom-40 right-1/3 w-96 h-96 bg-emerald-500/15 rounded-full blur-[150px] animate-pulse" />
          </>
        ) : (
          <>
            <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-200/50 rounded-full blur-[120px]" />
            <div className="absolute top-1/2 left-1/4 w-96 h-96 bg-cyan-100/60 rounded-full blur-[140px]" />
            <div className="absolute -bottom-40 right-1/3 w-96 h-96 bg-emerald-100/50 rounded-full blur-[130px]" />
          </>
        )}
      </div>

      {/* TOP HEADER */}
      <header className={`relative z-20 px-8 py-5 border-b backdrop-blur-xl flex items-center justify-between shadow-lg transition-colors ${
        isDark
          ? 'border-white/10 bg-slate-900/70 text-white'
          : 'border-slate-200/90 bg-white/85 text-slate-900'
      }`}>
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-2xl border p-2 flex items-center justify-center shadow-md ${
            isDark ? 'bg-white/10 border-white/15' : 'bg-slate-50 border-slate-200'
          }`}>
            {clinic?.logoUrl ? (
              <img src={clinic.logoUrl} alt={clinic.clinicName} className="w-full h-full object-contain" />
            ) : (
              <Stethoscope className={`w-8 h-8 ${isDark ? 'text-cyan-400' : 'text-blue-600'}`} />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className={`text-2xl font-black tracking-wide ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {clinic?.clinicName || 'العيادة الطبية'}
              </h1>
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                isDark
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                  : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}>
                {activeBranchName}
              </span>
            </div>
            <p className={`text-sm font-semibold mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              د. {clinic?.doctorName || 'العيادة'} {clinic?.specialty ? `• ${clinic.specialty}` : ''}
            </p>
          </div>
        </div>

        {/* Digital Clock & Date */}
        <div className="flex items-center gap-6 sm:gap-8">
          <div className="text-center font-mono">
            <div className={`text-3xl font-black tracking-widest ${
              isDark
                ? 'text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.4)]'
                : 'text-blue-600 drop-shadow-sm'
            }`}>
              {currentTime || '--:--:--'}
            </div>
            <div className={`text-xs font-bold mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {currentDateStr}
            </div>
          </div>

          {/* Quick Controls: Voice Audio, Theme Mode, Settings, Fullscreen */}
          <div className="flex items-center gap-2">
            
            {/* Audio Toggle Button */}
            <button
              onClick={() => {
                const nextState = !isAudioEnabled
                setIsAudioEnabled(nextState)
                if (nextState) {
                  triggerPatientVoiceCall(
                    currentPatient?.queue_number || '1',
                    currentPatient?.patientName || 'المريض'
                  )
                }
              }}
              className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                isAudioEnabled
                  ? isDark
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                    : 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-sm'
                  : isDark
                    ? 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                    : 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
              title={isAudioEnabled ? 'النداء الصوتي مفعل' : 'تفعيل النداء الصوتي للشاشة'}
            >
              {isAudioEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>

            {/* Dark / Light Mode Switcher */}
            <button
              onClick={toggleTheme}
              className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                isDark
                  ? 'bg-white/5 hover:bg-white/10 border-white/10 text-amber-300'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-amber-600 shadow-xs'
              }`}
              title={isDark ? 'التحويل إلى الوضع الفاتح (Light Mode)' : 'التحويل إلى الوضع الليلي (Dark Mode)'}
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Screen Customization Settings Button */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                isDark
                  ? 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300 hover:text-white'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 shadow-xs'
              }`}
              title="تخصيص شريط التنبيهات والنداء الصوتي والتعليمات"
            >
              <Settings className="w-5 h-5" />
            </button>

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                isDark
                  ? 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300 hover:text-white'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 shadow-xs'
              }`}
              title="ملء الشاشة للتلفزيون"
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Audio Enable Prompt Banner if not enabled yet */}
      {!isAudioEnabled && (
        <div className={`relative z-20 border-b px-6 py-2.5 text-center text-xs font-bold flex items-center justify-center gap-3 shadow-sm ${
          isDark
            ? 'bg-blue-600/30 border-blue-500/30 text-blue-200'
            : 'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          <Megaphone className="w-4 h-4 text-blue-500 animate-bounce" />
          <span>انقر هنا لتفعيل النداء الصوتي الآلي للمرضى والرنين التنبيهي عند استدعاء كل دور 📢</span>
          <button
            onClick={() => {
              setIsAudioEnabled(true)
              triggerPatientVoiceCall(
                currentPatient?.queue_number || '1',
                currentPatient?.patientName || 'المريض'
              )
            }}
            className="px-3 py-1 rounded-xl bg-blue-600 text-white font-black text-xs cursor-pointer hover:bg-blue-700 shadow-xs transition-transform active:scale-95"
          >
            تفعيل النداء الصوتي الآن 🔊
          </button>
        </div>
      )}

      {/* MAIN SCREEN BODY */}
      <main className="relative z-10 flex-1 p-6 md:p-10 grid lg:grid-cols-12 gap-8 items-stretch">
        
        {/* RIGHT COLUMN: HERO (الدور الحالي الآن - 7 cols) */}
        <section className="lg:col-span-7 flex flex-col justify-center">
          <motion.div
            layout
            className={`h-full rounded-3xl p-8 sm:p-10 border-2 backdrop-blur-2xl shadow-2xl flex flex-col justify-between relative overflow-hidden transition-colors ${
              isDark
                ? 'bg-slate-900/80 border-white/15'
                : 'bg-white/95 border-slate-200/90'
            }`}
          >
            {/* Glowing Border Accent */}
            <div className="absolute top-0 right-0 left-0 h-2 bg-gradient-to-r from-cyan-500 via-blue-500 to-emerald-500" />

            {/* Status Heading */}
            <div className={`flex items-center justify-between pb-4 border-b ${
              isDark ? 'border-white/10' : 'border-slate-200'
            }`}>
              <div className="flex items-center gap-3">
                <span className="relative flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]"></span>
                </span>
                <span className="text-xl font-black text-emerald-500 tracking-wider uppercase">
                  الدور الحالي • تفضل بالدخول الآن
                </span>
              </div>
              <span className={`text-sm font-bold px-3 py-1 rounded-xl border ${
                isDark
                  ? 'bg-white/10 text-slate-300 border-white/10'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}>
                غرفة الكشف
              </span>
            </div>

            {/* Giant Serving Turn Card */}
            {currentPatient ? (
              <div className="py-8 my-auto text-center space-y-6">
                <div>
                  <span className={`text-base font-bold block tracking-widest uppercase ${
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    رقم الدور
                  </span>
                  <motion.div
                    key={currentPatient.id + currentPatient.queue_number}
                    initial={{ scale: 0.85, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                    className={`text-8xl sm:text-9xl font-black font-mono my-2 ${
                      isDark
                        ? 'text-cyan-400 drop-shadow-[0_0_35px_rgba(34,211,238,0.5)]'
                        : 'text-blue-600 drop-shadow-md'
                    }`}
                  >
                    #{currentPatient.queue_number}
                  </motion.div>
                </div>

                <div className="space-y-2">
                  <h2 className={`text-3xl sm:text-4xl font-black tracking-wide ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}>
                    {currentPatient.patientName}
                  </h2>
                  <div className="flex items-center justify-center gap-3 flex-wrap">
                    <span className={`text-base font-bold px-4 py-1.5 rounded-2xl border ${
                      isDark
                        ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                        : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}>
                      {currentPatient.serviceName || 'كشف طبي'}
                    </span>
                    {currentPatient.branchName && (
                      <span className={`text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        • {currentPatient.branchName}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-16 my-auto text-center space-y-4">
                <div className={`w-24 h-24 rounded-full border mx-auto flex items-center justify-center ${
                  isDark ? 'bg-white/5 border-white/10 text-slate-500' : 'bg-slate-100 border-slate-200 text-slate-400'
                }`}>
                  <User className="w-12 h-12" />
                </div>
                <h3 className={`text-2xl font-black ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>
                  عيادة الطبيب بانتظار استدعاء المريض القادم
                </h3>
                <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>
                  يرجى من السادة المرضى الكرام التواجد في صالة الانتظار ومتابعة الشاشة
                </p>
              </div>
            )}

            {/* Doctor Card Footer */}
            <div className={`pt-4 border-t flex items-center justify-between text-sm ${
              isDark ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-600'
            }`}>
              <div className="flex items-center gap-2 font-bold">
                <Stethoscope className={`w-4 h-4 ${isDark ? 'text-cyan-400' : 'text-blue-600'}`} />
                <span>د. {clinic?.doctorName || 'العيادة'}</span>
              </div>
              <div className="font-mono text-xs font-semibold">
                {currentPatient ? 'جارٍ الكشف الآن • يرجى الانتظار' : 'العيادة جاهزة لاستقبال المرضى'}
              </div>
            </div>
          </motion.div>
        </section>

        {/* LEFT COLUMN: UPCOMING QUEUE (قائمة الانتظار القادمة - 5 cols) */}
        <section className="lg:col-span-5 flex flex-col justify-between">
          <div className={`h-full rounded-3xl p-6 sm:p-7 border backdrop-blur-xl shadow-2xl flex flex-col justify-between space-y-4 transition-colors ${
            isDark
              ? 'bg-slate-900/60 border-white/10 text-white'
              : 'bg-white/90 border-slate-200/90 text-slate-900'
          }`}>
            
            {/* Heading */}
            <div className={`flex items-center justify-between pb-3 border-b ${
              isDark ? 'border-white/10' : 'border-slate-200'
            }`}>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" />
                <h3 className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  الأدوار القادمة بالانتظار
                </h3>
              </div>
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border font-mono ${
                isDark
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}>
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
                          ? isDark
                            ? 'bg-blue-600/20 border-blue-500/40 shadow-lg shadow-blue-600/10'
                            : 'bg-blue-50/90 border-blue-300 text-blue-950 shadow-sm'
                          : isDark
                            ? 'bg-white/5 border-white/10 text-white'
                            : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black font-mono text-xl ${
                          idx === 0
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                            : isDark
                              ? 'bg-white/10 text-slate-300'
                              : 'bg-slate-200 text-slate-700'
                        }`}>
                          #{p.queue_number}
                        </div>
                        <div>
                          <h4 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {p.patientName}
                          </h4>
                          <p className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {p.serviceName || 'كشف طبي'}
                          </p>
                        </div>
                      </div>

                      <div className="text-left font-mono">
                        {idx === 0 ? (
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border animate-pulse ${
                            isDark
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              : 'bg-amber-100 text-amber-900 border-amber-300'
                          }`}>
                            التالي في الدور
                          </span>
                        ) : (
                          <span className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            قريباً
                          </span>
                        )}
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className={`h-full flex flex-col items-center justify-center text-center p-8 space-y-2 ${
                    isDark ? 'text-slate-500' : 'text-slate-400'
                  }`}>
                    <CheckCircle2 className="w-10 h-10 text-emerald-500/60" />
                    <p className="text-sm font-bold">لا يوجد مرضى آخرين في قائمة الانتظار حالياً</p>
                  </div>
                )}
              </AnimatePresence>
            </div>

            {/* Editable Instructions Box with Clear Visuals */}
            <div className={`p-4 rounded-2xl border text-xs space-y-1.5 transition-colors ${
              isDark
                ? 'bg-white/5 border-white/10 text-slate-300'
                : 'bg-blue-50/70 border-blue-200/80 text-slate-700 shadow-xs'
            }`}>
              <div className="flex items-center justify-between font-black">
                <div className="flex items-center gap-1.5">
                  <Sparkles className={`w-4 h-4 ${isDark ? 'text-cyan-400' : 'text-blue-600'}`} />
                  <span className={isDark ? 'text-cyan-300' : 'text-blue-800'}>تعليمات صالة الانتظار:</span>
                </div>
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="text-[10px] text-primary hover:underline cursor-pointer font-bold"
                >
                  تعديل ✍️
                </button>
              </div>
              <p className="text-xs leading-relaxed font-medium">
                {activeInstructionsText}
              </p>
            </div>

          </div>
        </section>

      </main>

      {/* BOTTOM TICKER / MARQUEE BANNER (الكلمة اللي ماشية تحت) */}
      <footer className={`relative z-20 border-t px-6 py-3.5 flex items-center overflow-hidden transition-colors ${
        isDark
          ? 'bg-slate-900/95 border-white/10 text-slate-300'
          : 'bg-white/95 border-slate-200 text-slate-800 shadow-lg'
      }`}>
        <div className={`shrink-0 flex items-center gap-2 font-black text-xs pe-4 border-e ${
          isDark ? 'text-cyan-400 border-white/10' : 'text-blue-600 border-slate-200'
        }`}>
          <Sparkles className="w-4 h-4" />
          <span>تنويه العيادة:</span>
        </div>
        <div className="flex-1 overflow-hidden whitespace-nowrap ps-4">
          <div
            className="inline-block animate-marquee text-xs font-black tracking-wide"
            style={{ animationDuration: marqueeDuration }}
          >
            {activeTickerText}
          </div>
        </div>
      </footer>

      {/* CUSTOMIZE TV SCREEN MODAL */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className={`w-full max-w-xl rounded-3xl border shadow-2xl overflow-hidden my-auto p-6 space-y-5 transition-colors ${
            isDark ? 'bg-slate-900 border-white/15 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            
            {/* Modal Header */}
            <div className={`flex items-center justify-between pb-3 border-b ${
              isDark ? 'border-white/10' : 'border-slate-200'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-500 flex items-center justify-center">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black">إعدادات الشاشة الذكية والنداء الصوتي</h3>
                  <p className="text-xs text-muted-foreground">تخصيص شريط التنبيهات المار، التعليمات، ونطق الأسماء</p>
                </div>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-slate-500/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-4 text-xs font-semibold">
              
              {/* Ticker Text Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold block">
                  شريط التنبيهات المتحرك في الأسفل (الكلمة المارة من اليمين لليسار):
                </label>
                <textarea
                  rows={3}
                  value={tvConfig.tickerText}
                  onChange={(e) => setTvConfig({ ...tvConfig, tickerText: e.target.value })}
                  placeholder={defaultTickerText}
                  className={`w-full p-3 rounded-2xl border text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed ${
                    isDark ? 'bg-slate-800/80 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
                <p className="text-[11px] text-muted-foreground">
                  اتركه فارغاً لاستخدام النص الترحيبي الافتراضي باسم العيادة.
                </p>
              </div>

              {/* Instructions Text Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold block">
                  تعليمات صالة الانتظار (البطاقة الجانبية بالشاشة):
                </label>
                <textarea
                  rows={2}
                  value={tvConfig.instructionsText}
                  onChange={(e) => setTvConfig({ ...tvConfig, instructionsText: e.target.value })}
                  placeholder={defaultInstructionsText}
                  className={`w-full p-3 rounded-2xl border text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed ${
                    isDark ? 'bg-slate-800/80 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              {/* Voice Call Options & Speed */}
              <div className="grid sm:grid-cols-2 gap-3 pt-1">
                
                {/* Voice Call Name Option */}
                <div className={`p-3.5 rounded-2xl border space-y-1.5 ${
                  isDark ? 'bg-slate-800/40 border-white/10' : 'bg-slate-50 border-slate-200'
                }`}>
                  <label className="text-xs font-bold block flex items-center justify-between">
                    <span>مناداة اسم المريض:</span>
                    <input
                      type="checkbox"
                      checked={tvConfig.announceName}
                      onChange={(e) => setTvConfig({ ...tvConfig, announceName: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </label>
                  <p className="text-[11px] text-muted-foreground leading-normal">
                    {tvConfig.announceName ? 'ينطق: رقم الدور + اسم المريض' : 'ينطق: رقم الدور فقط (لخصوصية المريض)'}
                  </p>
                </div>

                {/* Ticker Speed */}
                <div className={`p-3.5 rounded-2xl border space-y-1.5 ${
                  isDark ? 'bg-slate-800/40 border-white/10' : 'bg-slate-50 border-slate-200'
                }`}>
                  <label className="text-xs font-bold block">سرعة حركة الشريط المتحرك:</label>
                  <div className="flex items-center gap-1.5 pt-0.5">
                    {(['slow', 'normal', 'fast'] as const).map(speed => (
                      <button
                        key={speed}
                        type="button"
                        onClick={() => setTvConfig({ ...tvConfig, tickerSpeed: speed })}
                        className={`flex-1 py-1 rounded-xl text-center text-[11px] font-bold border transition-colors cursor-pointer ${
                          tvConfig.tickerSpeed === speed
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : isDark
                              ? 'bg-white/5 border-white/10 text-slate-300'
                              : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        {speed === 'slow' ? 'هادئ 🐢' : speed === 'fast' ? 'سريع ⚡' : 'معتدل 🎯'}
                      </button>
                    ))}
                  </div>
                </div>

              </div>

              {/* Test Audio Announcement Button */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsAudioEnabled(true)
                    triggerPatientVoiceCall(
                      currentPatient?.queue_number || '5',
                      currentPatient?.patientName || 'أحمد علي'
                    )
                  }}
                  className="w-full py-2.5 rounded-2xl bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center gap-2 font-black cursor-pointer transition-colors"
                >
                  <Megaphone className="w-4 h-4" />
                  <span>تجربة النداء الصوتي الآن 📢 (تنبيه مريض رقم 5)</span>
                </button>
              </div>

            </div>

            {/* Modal Footer */}
            <div className={`pt-3 border-t flex items-center justify-between gap-3 ${
              isDark ? 'border-white/10' : 'border-slate-200'
            }`}>
              <button
                type="button"
                onClick={() => {
                  setTvConfig({
                    tickerText: '',
                    instructionsText: '',
                    announceName: true,
                    tickerSpeed: 'normal'
                  })
                  toast.info('تم استعادة النصوص الافتراضية')
                }}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer font-bold"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>استعادة الافتراضي</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                    isDark ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  disabled={isSavingSettings}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs flex items-center gap-1.5 shadow-md shadow-blue-600/25 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingSettings ? 'جاري الحفظ...' : 'حفظ التعديلات'}</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Marquee Keyframes */}
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
