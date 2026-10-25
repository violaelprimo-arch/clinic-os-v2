'use client'

import { use, useEffect, useState, useMemo, useRef } from 'react'
import { db } from '@/lib/firebase'
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore'
import {
  Tv, Volume2, VolumeX, Maximize2, Minimize2, Clock,
  Calendar, Building2, User, Sparkles, CheckCircle2,
  AlertCircle, ChevronRight, Stethoscope, ArrowRight,
  Sun, Moon, Settings, X, Save, RotateCcw, Megaphone,
  ArrowLeftRight, Mic
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import Link from 'next/link'

interface TvConfig {
  tickerText: string
  instructionsText: string
  announceName: boolean
  tickerSpeed: 'normal' | 'slow' | 'fast'
  tickerDirection: 'rtl' | 'ltr'
  voiceGender: 'female' | 'male'
  announcementPhrase: 'patient_number' | 'turn_number'
}

// In-memory cache for decoded audio buffers to allow instant playback
const ttsAudioCache = new Map<string, AudioBuffer>()

// Convert digits to spelled-out Arabic words so voice engines pronounce full Arabic words
function numberToArabicWords(num: number | string): string {
  const clean = String(num).replace(/[^0-9]/g, '')
  const n = parseInt(clean, 10)
  if (isNaN(n) || n <= 0) return String(num)

  const ones = [
    '', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة',
    'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'
  ]
  const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون']
  const hundreds = ['', 'مائة', 'مئتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة']

  if (n < 20) return ones[n]
  if (n < 100) {
    const one = n % 10
    const ten = Math.floor(n / 10)
    return one === 0 ? tens[ten] : `${ones[one]} و${tens[ten]}`
  }
  if (n < 1000) {
    const hundred = Math.floor(n / 100)
    const remainder = n % 100
    if (remainder === 0) return hundreds[hundred]
    return `${hundreds[hundred]} و${numberToArabicWords(remainder)}`
  }
  return String(num)
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

  // Tracking refs for real-time patient announcements
  const lastAnnouncedCallKeyRef = useRef<string | null>(null)
  const isFirstDataLoadRef = useRef<boolean>(true)

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
    tickerSpeed: 'normal',
    tickerDirection: 'rtl',
    voiceGender: 'female',
    announcementPhrase: 'patient_number'
  })

  // Audio Context Ref
  const audioCtxRef = useRef<AudioContext | null>(null)

  // Load voices listener
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const handleVoices = () => {
      window.speechSynthesis.getVoices()
    }
    handleVoices()
    window.speechSynthesis.onvoiceschanged = handleVoices
  }, [])

  // Toggle audio state with persistent storage
  const setAudioState = (enabled: boolean) => {
    setIsAudioEnabled(enabled)
    if (typeof window !== 'undefined') {
      localStorage.setItem(`clinic_${slug}_tv_audio`, enabled ? 'true' : 'false')
    }
  }

  // Auto-unlock Web Audio Context on first user interaction anywhere on the screen
  useEffect(() => {
    const unlockAudio = () => {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
        if (AudioCtx) {
          if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
            audioCtxRef.current = new AudioCtx()
          }
          if (audioCtxRef.current.state === 'suspended') {
            audioCtxRef.current.resume()
          }
        }
        setIsAudioEnabled(prev => {
          if (!prev) {
            if (typeof window !== 'undefined') {
              localStorage.setItem(`clinic_${slug}_tv_audio`, 'true')
            }
            return true
          }
          return prev
        })
      } catch (e) {}
    }

    window.addEventListener('click', unlockAudio, { once: true })
    window.addEventListener('touchstart', unlockAudio, { once: true })
    window.addEventListener('keydown', unlockAudio, { once: true })

    return () => {
      window.removeEventListener('click', unlockAudio)
      window.removeEventListener('touchstart', unlockAudio)
      window.removeEventListener('keydown', unlockAudio)
    }
  }, [slug])

  // Load Saved Theme, Settings, and Audio state from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem(`clinic_${slug}_tv_theme`) as 'dark' | 'light'
      if (savedTheme) {
        setThemeMode(savedTheme)
      }

      const savedAudio = localStorage.getItem(`clinic_${slug}_tv_audio`)
      if (savedAudio === 'true') {
        setIsAudioEnabled(true)
      }

      const savedConfig = localStorage.getItem(`clinic_${slug}_tv_settings`)
      if (savedConfig) {
        try {
          const parsed = JSON.parse(savedConfig)
          setTvConfig(prev => ({
            ...prev,
            ...parsed,
            tickerDirection: parsed.tickerDirection || 'rtl',
            voiceGender: parsed.voiceGender || 'female',
            announcementPhrase: parsed.announcementPhrase || 'patient_number'
          }))
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
        tickerSpeed: clinic.tvSettings.tickerSpeed || prev.tickerSpeed,
        tickerDirection: clinic.tvSettings.tickerDirection || prev.tickerDirection || 'rtl',
        voiceGender: clinic.tvSettings.voiceGender || prev.voiceGender || 'female',
        announcementPhrase: clinic.tvSettings.announcementPhrase || prev.announcementPhrase || 'patient_number'
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

  // Universal Cloud TTS Audio Stream via Web Audio API with pitch & acoustic modeling
  const playCloudTtsAudio = async (text: string, gender: 'female' | 'male'): Promise<boolean> => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioCtx()
      }
      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') {
        await ctx.resume()
      }

      let audioBuffer = ttsAudioCache.get(text)
      if (!audioBuffer) {
        const res = await fetch(`/api/tts?text=${encodeURIComponent(text)}&tl=ar`)
        if (!res.ok) throw new Error(`TTS status ${res.status}`)
        const arrayBuffer = await res.arrayBuffer()
        audioBuffer = await ctx.decodeAudioData(arrayBuffer)
        ttsAudioCache.set(text, audioBuffer)
      }

      const source = ctx.createBufferSource()
      source.buffer = audioBuffer

      if (gender === 'male') {
        // Deep masculine baritone acoustic processing:
        // 1. Lower playback rate by 15% (drops pitch by ~3 semitones into authentic male register)
        source.playbackRate.value = 0.85

        // 2. Low-shelf bass boost at 220Hz (+6dB for chest resonance)
        const bassFilter = ctx.createBiquadFilter()
        bassFilter.type = 'lowshelf'
        bassFilter.frequency.value = 220
        bassFilter.gain.value = 6

        // 3. Low-pass filter at 3500Hz to eliminate female sibilance
        const lowpassFilter = ctx.createBiquadFilter()
        lowpassFilter.type = 'lowpass'
        lowpassFilter.frequency.value = 3500

        // 4. Output gain
        const gainNode = ctx.createGain()
        gainNode.gain.value = 1.3

        source.connect(bassFilter)
        bassFilter.connect(lowpassFilter)
        lowpassFilter.connect(gainNode)
        gainNode.connect(ctx.destination)
      } else {
        // Clear, bright feminine vocal processing:
        // 1. Melodic feminine playback rate
        source.playbackRate.value = 1.02

        // 2. High clarity presence filter at 2400Hz
        const presenceFilter = ctx.createBiquadFilter()
        presenceFilter.type = 'peaking'
        presenceFilter.frequency.value = 2400
        presenceFilter.gain.value = 2.5

        // 3. Gentle high-pass filter at 120Hz to eliminate sub-bass rumble
        const highpassFilter = ctx.createBiquadFilter()
        highpassFilter.type = 'highpass'
        highpassFilter.frequency.value = 120

        const gainNode = ctx.createGain()
        gainNode.gain.value = 1.1

        source.connect(presenceFilter)
        presenceFilter.connect(highpassFilter)
        highpassFilter.connect(gainNode)
        gainNode.connect(ctx.destination)
      }

      source.start(0)
      return true
    } catch (err) {
      console.warn('Cloud TTS playback error, trying fallbacks:', err)
      return false
    }
  }

  // Arabic Voice Announcement (نداء صوتي لدخول المريض رقم كذا)
  const speakAnnouncement = async (
    turnNumber: string | number,
    patientName?: string,
    callName = true,
    gender: 'female' | 'male' = tvConfig.voiceGender || 'female',
    phraseType: 'patient_number' | 'turn_number' = tvConfig.announcementPhrase || 'patient_number'
  ) => {
    // 1. Convert digit turn into proper Arabic words (e.g. 5 -> خمسة, 12 -> اثنا عشر)
    const turnInWords = numberToArabicWords(turnNumber)
    const namePart = (callName && patientName && patientName.trim()) ? `${patientName.trim()}، ` : ''
    const prefix = phraseType === 'turn_number' ? 'دور رقم' : 'مريض رقم'

    // Full, grammatically complete Arabic announcement sentence
    const fullArabicPhrase = `${prefix} ${turnInWords}، ${namePart}تفضل بالدخول لغرفة الكشف.`

    // 2. Primary Method: Universal Cloud TTS Audio Stream via Web Audio API (Guaranteed on all TVs & browsers)
    const played = await playCloudTtsAudio(fullArabicPhrase, gender)
    if (played) return

    // 3. Secondary Method: If Cloud TTS fetch failed, try HTML5 Audio element with stream
    try {
      const audioUrl = `/api/tts?text=${encodeURIComponent(fullArabicPhrase)}&tl=ar`
      const audioEl = new Audio(audioUrl)
      if (gender === 'male') {
        (audioEl as any).preservesPitch = false
        audioEl.playbackRate = 0.85
      } else {
        audioEl.playbackRate = 1.02
      }
      await audioEl.play()
      return
    } catch (e) {
      // Audio element also failed, try local SpeechSynthesis as last resort
    }

    // 4. Tertiary Fallback: Browser Web Speech API (only if Arabic voices exist, avoiding English voice reciting numbers)
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel()
        const utterance = new SpeechSynthesisUtterance(fullArabicPhrase)
        utterance.lang = 'ar-SA'

        const voices = window.speechSynthesis.getVoices()
        const arabicVoices = voices.filter(v => v.lang.startsWith('ar') || v.lang.includes('ar-') || v.lang.includes('AR'))

        if (arabicVoices.length > 0) {
          const femaleKeywords = ['female', 'hoda', 'zeina', 'salma', 'laila', 'zariyah', 'nour', 'fatima', 'maryam', 'amira', 'mona', 'sara']
          const maleKeywords = ['male', 'shakir', 'naayf', 'maged', 'tarik', 'hamed', 'youssef', 'omar', 'ahmed', 'ali', 'hassan']

          let matchedVoice: SpeechSynthesisVoice | undefined
          if (gender === 'female') {
            matchedVoice = arabicVoices.find(v => femaleKeywords.some(kw => v.name.toLowerCase().includes(kw))) || arabicVoices[0]
            utterance.pitch = 1.25
            utterance.rate = 0.9
          } else {
            matchedVoice = arabicVoices.find(v => maleKeywords.some(kw => v.name.toLowerCase().includes(kw))) ||
              arabicVoices.find(v => !femaleKeywords.some(kw => v.name.toLowerCase().includes(kw))) || arabicVoices[0]
            utterance.pitch = 0.8
            utterance.rate = 0.86
          }

          if (matchedVoice) {
            utterance.voice = matchedVoice
          }
          window.speechSynthesis.speak(utterance)
        }
      } catch (err) {
        console.warn('Speech synthesis fallback error:', err)
      }
    }
  }

  // Combined Chime + Voice Call Trigger
  const triggerPatientVoiceCall = (
    turnNumber: string | number,
    patientName?: string,
    genderOverride?: 'female' | 'male'
  ) => {
    playChimeSound()
    setTimeout(() => {
      speakAnnouncement(
        turnNumber,
        patientName,
        tvConfig.announceName,
        genderOverride || tvConfig.voiceGender,
        tvConfig.announcementPhrase
      )
    }, 750)
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

  // Trigger Voice Call when serving patient changes, enters, or is recalled
  useEffect(() => {
    if (!currentPatient) {
      // When no patient is being served, reset tracking key so the next entering patient triggers immediately
      lastAnnouncedCallKeyRef.current = null
      return
    }

    const currentCallKey = `${currentPatient.id}_${currentPatient.startedAt || currentPatient.queue_number}`

    // Avoid sudden blast on initial page mount if patient was already active
    if (isFirstDataLoadRef.current) {
      isFirstDataLoadRef.current = false
      lastAnnouncedCallKeyRef.current = currentCallKey
      return
    }

    // Patient entered (from null or previous patient) or doctor recalled turn
    if (lastAnnouncedCallKeyRef.current !== currentCallKey) {
      lastAnnouncedCallKeyRef.current = currentCallKey
      if (isAudioEnabled) {
        triggerPatientVoiceCall(
          currentPatient.queue_number,
          currentPatient.patientName
        )
      }
    }
  }, [currentPatient, isAudioEnabled, tvConfig.announceName, tvConfig.voiceGender, tvConfig.announcementPhrase])

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
  const marqueeAnimationClass = tvConfig.tickerDirection === 'ltr' ? 'animate-marquee-ltr' : 'animate-marquee-rtl'

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
                setAudioState(nextState)
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
              setAudioState(true)
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
            className={`inline-block text-xs font-black tracking-wide ${marqueeAnimationClass}`}
            style={{ animationDuration: marqueeDuration }}
          >
            {activeTickerText}
          </div>
        </div>
      </footer>

      {/* CUSTOMIZE TV SCREEN MODAL */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className={`w-full max-w-xl rounded-3xl border shadow-2xl overflow-hidden my-auto p-6 space-y-4 transition-colors max-h-[92vh] overflow-y-auto ${
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
                  <p className="text-xs text-muted-foreground">تخصيص شريط التنبيهات، اتجاه الحركة، وصوت النداء (ذكر / أنثى)</p>
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
                  شريط التنبيهات المتحرك في الأسفل:
                </label>
                <textarea
                  rows={2}
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

              {/* Ticker Direction & Speed */}
              <div className="grid sm:grid-cols-2 gap-3">
                
                {/* Ticker Direction (تحديد اتجاه حركة الشريط) */}
                <div className={`p-3 rounded-2xl border space-y-1.5 ${
                  isDark ? 'bg-slate-800/40 border-white/10' : 'bg-slate-50 border-slate-200'
                }`}>
                  <label className="text-xs font-bold block flex items-center gap-1.5">
                    <ArrowLeftRight className="w-3.5 h-3.5 text-blue-500" />
                    <span>اتجاه حركة الشريط:</span>
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setTvConfig({ ...tvConfig, tickerDirection: 'rtl' })}
                      className={`py-1.5 rounded-xl text-center text-[11px] font-bold border transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                        tvConfig.tickerDirection === 'rtl'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : isDark
                            ? 'bg-white/5 border-white/10 text-slate-300'
                            : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      <span>يمين لـ يسار ⬅️</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTvConfig({ ...tvConfig, tickerDirection: 'ltr' })}
                      className={`py-1.5 rounded-xl text-center text-[11px] font-bold border transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                        tvConfig.tickerDirection === 'ltr'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : isDark
                            ? 'bg-white/5 border-white/10 text-slate-300'
                            : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      <span>يسار لـ يمين ➡️</span>
                    </button>
                  </div>
                </div>

                {/* Ticker Speed */}
                <div className={`p-3 rounded-2xl border space-y-1.5 ${
                  isDark ? 'bg-slate-800/40 border-white/10' : 'bg-slate-50 border-slate-200'
                }`}>
                  <label className="text-xs font-bold block">سرعة حركة الشريط:</label>
                  <div className="grid grid-cols-3 gap-1 pt-0.5">
                    {(['slow', 'normal', 'fast'] as const).map(speed => (
                      <button
                        key={speed}
                        type="button"
                        onClick={() => setTvConfig({ ...tvConfig, tickerSpeed: speed })}
                        className={`py-1.5 rounded-xl text-center text-[11px] font-bold border transition-colors cursor-pointer ${
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

              {/* Voice Gender Selection & Phrasing (تحديد صوت النطق ذكر أو أنثى) */}
              <div className="grid sm:grid-cols-2 gap-3">
                
                {/* Voice Gender Selector */}
                <div className={`p-3 rounded-2xl border space-y-1.5 ${
                  isDark ? 'bg-slate-800/40 border-white/10' : 'bg-slate-50 border-slate-200'
                }`}>
                  <label className="text-xs font-bold block flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-purple-500" />
                    <span>صوت النداء (ذكر / أنثى):</span>
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setTvConfig({ ...tvConfig, voiceGender: 'female' })}
                      className={`py-1.5 rounded-xl text-center text-[11px] font-bold border transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                        tvConfig.voiceGender === 'female'
                          ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                          : isDark
                            ? 'bg-white/5 border-white/10 text-slate-300'
                            : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      <span>👩 صوت أنثوي</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTvConfig({ ...tvConfig, voiceGender: 'male' })}
                      className={`py-1.5 rounded-xl text-center text-[11px] font-bold border transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                        tvConfig.voiceGender === 'male'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : isDark
                            ? 'bg-white/5 border-white/10 text-slate-300'
                            : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      <span>👨 صوت ذكوري</span>
                    </button>
                  </div>
                </div>

                {/* Announcement Phrasing */}
                <div className={`p-3 rounded-2xl border space-y-1.5 ${
                  isDark ? 'bg-slate-800/40 border-white/10' : 'bg-slate-50 border-slate-200'
                }`}>
                  <label className="text-xs font-bold block">صيغة النداء:</label>
                  <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setTvConfig({ ...tvConfig, announcementPhrase: 'patient_number' })}
                      className={`py-1.5 rounded-xl text-center text-[11px] font-bold border transition-colors cursor-pointer ${
                        tvConfig.announcementPhrase === 'patient_number'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : isDark
                            ? 'bg-white/5 border-white/10 text-slate-300'
                            : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      <span>مريض رقم كذا 🩺</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTvConfig({ ...tvConfig, announcementPhrase: 'turn_number' })}
                      className={`py-1.5 rounded-xl text-center text-[11px] font-bold border transition-colors cursor-pointer ${
                        tvConfig.announcementPhrase === 'turn_number'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : isDark
                            ? 'bg-white/5 border-white/10 text-slate-300'
                            : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      <span>دور رقم كذا 🔢</span>
                    </button>
                  </div>
                </div>

              </div>

              {/* Patient Name Checkbox */}
              <div className={`p-3 rounded-2xl border flex items-center justify-between ${
                isDark ? 'bg-slate-800/40 border-white/10' : 'bg-slate-50 border-slate-200'
              }`}>
                <div>
                  <span className="font-bold text-xs block">مناداة اسم المريض مع الرقم</span>
                  <span className="text-[11px] text-muted-foreground">
                    {tvConfig.announceName ? 'ينطق: مريض رقم 5، [الاسم]، تفضل بالدخول' : 'ينطق: مريض رقم 5، تفضل بالدخول (لحفظ الخصوصية)'}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={tvConfig.announceName}
                  onChange={(e) => setTvConfig({ ...tvConfig, announceName: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
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

              {/* Live Audio Test Buttons for Both Genders */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setAudioState(true)
                    triggerPatientVoiceCall(
                      currentPatient?.queue_number || '5',
                      currentPatient?.patientName || 'أحمد علي',
                      'female'
                    )
                  }}
                  className="py-2.5 px-3 rounded-2xl bg-purple-600/15 hover:bg-purple-600/25 text-purple-700 dark:text-purple-300 border border-purple-500/30 flex items-center justify-center gap-1.5 font-black cursor-pointer transition-colors"
                >
                  <Megaphone className="w-4 h-4" />
                  <span>تجربة صوت أنثوي 👩</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAudioState(true)
                    triggerPatientVoiceCall(
                      currentPatient?.queue_number || '5',
                      currentPatient?.patientName || 'أحمد علي',
                      'male'
                    )
                  }}
                  className="py-2.5 px-3 rounded-2xl bg-blue-600/15 hover:bg-blue-600/25 text-blue-700 dark:text-blue-300 border border-blue-500/30 flex items-center justify-center gap-1.5 font-black cursor-pointer transition-colors"
                >
                  <Megaphone className="w-4 h-4" />
                  <span>تجربة صوت ذكوري 👨</span>
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
                    tickerSpeed: 'normal',
                    tickerDirection: 'rtl',
                    voiceGender: 'female',
                    announcementPhrase: 'patient_number'
                  })
                  toast.info('تم استعادة النصوص والإعدادات الافتراضية')
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

      {/* Marquee Keyframes for RTL and LTR */}
      <style jsx global>{`
        @keyframes marquee-rtl {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        @keyframes marquee-ltr {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-marquee-rtl {
          animation: marquee-rtl 28s linear infinite;
        }
        .animate-marquee-ltr {
          animation: marquee-ltr 28s linear infinite;
        }
      `}</style>
    </div>
  )
}
