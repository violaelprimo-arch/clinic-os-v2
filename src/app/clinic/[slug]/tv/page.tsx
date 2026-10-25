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
import { isClinicFeatureEnabled } from '@/lib/featurePermissions'

interface TvConfig {
  tickerText: string
  instructionsText: string
  showPatientName: boolean
  announceName: boolean
  tickerSpeed: 'normal' | 'slow' | 'fast'
  tickerDirection: 'rtl' | 'ltr'
  voiceGender: 'female' | 'male'
  announcementPhrase: 'patient_number' | 'turn_number'
  chimeSound: 'luxury' | 'classic' | 'none'
  speechTone: 'calm' | 'natural' | 'quick'
}

// In-memory cache for decoded audio buffers to allow instant playback
const ttsAudioCache = new Map<string, AudioBuffer>()

// Convert digits to spelled-out Arabic words with vocalized diacritics (تشكيل فصيح)
function numberToArabicWords(num: number | string): string {
  const clean = String(num).replace(/[^0-9]/g, '')
  const n = parseInt(clean, 10)
  if (isNaN(n) || n <= 0) return String(num)

  const ones = [
    '', 'وَاحِد', 'اثْنَان', 'ثَلَاثَة', 'أَرْبَعَة', 'خَمْسَة', 'سِتَّة', 'سَبْعَة', 'ثَمَانِيَة', 'تِسْعَة', 'عَشَرَة',
    'أَحَدَ عَشَر', 'اثْنَا عَشَر', 'ثَلَاثَةَ عَشَر', 'أَرْبَعَةَ عَشَر', 'خَمْسَةَ عَشَر', 'سِتَّةَ عَشَر', 'سَبْعَةَ عَشَر', 'ثَمَانِيَةَ عَشَر', 'تِسْعَةَ عَشَر'
  ]
  const tens = ['', '', 'عِشْرُونَ', 'ثَلَاثُونَ', 'أَرْبَعُونَ', 'خَمْسُونَ', 'سِتُّونَ', 'سَبْعُونَ', 'ثَمَانُونَ', 'تِسْعُونَ']
  const hundreds = ['', 'مِائَة', 'مِائَتَان', 'ثَلَاثُمِائَة', 'أَرْبَعُمِائَة', 'خَمْسُمِائَة', 'سِتُّمِائَة', 'سَبْعُمِائَة', 'ثَمَانُمِائَة', 'تِسْعُمِائَة']

  if (n < 20) return ones[n]
  if (n < 100) {
    const one = n % 10
    const ten = Math.floor(n / 10)
    return one === 0 ? tens[ten] : `${ones[one]} وَ${tens[ten]}`
  }
  if (n < 1000) {
    const hundred = Math.floor(n / 100)
    const remainder = n % 100
    if (remainder === 0) return hundreds[hundred]
    return `${hundreds[hundred]} وَ${numberToArabicWords(remainder)}`
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
    showPatientName: false,
    announceName: false,
    tickerSpeed: 'normal',
    tickerDirection: 'rtl',
    voiceGender: 'female',
    announcementPhrase: 'patient_number',
    chimeSound: 'luxury',
    speechTone: 'calm'
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
            showPatientName: parsed.showPatientName ?? false,
            announceName: parsed.announceName ?? false,
            tickerDirection: parsed.tickerDirection || 'rtl',
            voiceGender: parsed.voiceGender || 'female',
            announcementPhrase: parsed.announcementPhrase || 'patient_number',
            chimeSound: parsed.chimeSound || 'luxury',
            speechTone: parsed.speechTone || 'calm'
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
        showPatientName: clinic.tvSettings.showPatientName !== undefined ? clinic.tvSettings.showPatientName : prev.showPatientName,
        announceName: clinic.tvSettings.announceName !== undefined ? clinic.tvSettings.announceName : prev.announceName,
        tickerSpeed: clinic.tvSettings.tickerSpeed || prev.tickerSpeed,
        tickerDirection: clinic.tvSettings.tickerDirection || prev.tickerDirection || 'rtl',
        voiceGender: clinic.tvSettings.voiceGender || prev.voiceGender || 'female',
        announcementPhrase: clinic.tvSettings.announcementPhrase || prev.announcementPhrase || 'patient_number',
        chimeSound: clinic.tvSettings.chimeSound || prev.chimeSound || 'luxury',
        speechTone: clinic.tvSettings.speechTone || prev.speechTone || 'calm'
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

  // Web Audio API Synthesized Luxury Hospital & Airport Chimes
  const playChimeSound = (style: 'luxury' | 'classic' | 'none' = tvConfig.chimeSound || 'luxury') => {
    if (style === 'none') return
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

      if (style === 'classic') {
        // Classic Airport Double-Ding (D5 -> A5)
        const osc1 = ctx.createOscillator()
        const g1 = ctx.createGain()
        osc1.type = 'sine'
        osc1.frequency.setValueAtTime(587.33, now)
        g1.gain.setValueAtTime(0.001, now)
        g1.gain.exponentialRampToValueAtTime(0.22, now + 0.03)
        g1.gain.exponentialRampToValueAtTime(0.001, now + 0.5)
        osc1.connect(g1)
        g1.connect(ctx.destination)
        osc1.start(now)
        osc1.stop(now + 0.5)

        const osc2 = ctx.createOscillator()
        const g2 = ctx.createGain()
        osc2.type = 'sine'
        osc2.frequency.setValueAtTime(880.0, now + 0.22)
        g2.gain.setValueAtTime(0.001, now + 0.22)
        g2.gain.exponentialRampToValueAtTime(0.25, now + 0.25)
        g2.gain.exponentialRampToValueAtTime(0.001, now + 0.8)
        osc2.connect(g2)
        g2.connect(ctx.destination)
        osc2.start(now + 0.22)
        osc2.stop(now + 0.8)
        return
      }

      // Luxury 3-Tone Pentatonic Harmonic Bell (F5 -> A5 -> C6)
      // Produces an ultra-soothing, premium medical center chime
      const notes = [
        { freq: 698.46, time: 0.0, duration: 0.75, vol: 0.22 },
        { freq: 880.00, time: 0.22, duration: 0.85, vol: 0.24 },
        { freq: 1046.50, time: 0.46, duration: 1.15, vol: 0.26 }
      ]

      notes.forEach(({ freq, time, duration, vol }) => {
        const noteStart = now + time
        const noteEnd = noteStart + duration

        // Fundamental pure sine tone
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, noteStart)

        gain.gain.setValueAtTime(0.0001, noteStart)
        gain.gain.exponentialRampToValueAtTime(vol, noteStart + 0.035)
        gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd)

        osc.connect(gain)

        // Soft harmonic overtone for crystalline warmth
        const harmOsc = ctx.createOscillator()
        const harmGain = ctx.createGain()
        harmOsc.type = 'triangle'
        harmOsc.frequency.setValueAtTime(freq * 2, noteStart)
        harmGain.gain.setValueAtTime(0.0001, noteStart)
        harmGain.gain.exponentialRampToValueAtTime(vol * 0.18, noteStart + 0.03)
        harmGain.gain.exponentialRampToValueAtTime(0.0001, noteEnd - 0.2)

        harmOsc.connect(harmGain)

        gain.connect(ctx.destination)
        harmGain.connect(ctx.destination)

        osc.start(noteStart)
        osc.stop(noteEnd)
        harmOsc.start(noteStart)
        harmOsc.stop(noteEnd)
      })
    } catch (e) {
      console.warn('Audio chime error:', e)
    }
  }

  // Universal Studio-Engineered Arabic Voice Stream with Compression, EQ & Clean Output
  const playCloudTtsAudio = async (
    text: string,
    gender: 'female' | 'male',
    tone: 'calm' | 'natural' | 'quick' = tvConfig.speechTone || 'calm'
  ): Promise<boolean> => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioCtx()
      }
      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') {
        await ctx.resume()
      }

      const cacheKey = `${gender}_${text}`
      let audioBuffer = ttsAudioCache.get(cacheKey)
      if (!audioBuffer) {
        const res = await fetch(`/api/tts?text=${encodeURIComponent(text)}&gender=${gender}&tl=ar`)
        if (!res.ok) throw new Error(`TTS status ${res.status}`)
        const arrayBuffer = await res.arrayBuffer()
        audioBuffer = await ctx.decodeAudioData(arrayBuffer)
        ttsAudioCache.set(cacheKey, audioBuffer)
      }

      const source = ctx.createBufferSource()
      source.buffer = audioBuffer

      // Studio Broadcast Dynamics Compressor for smooth, balanced, clear delivery
      const compressor = ctx.createDynamicsCompressor()
      compressor.threshold.setValueAtTime(-14, ctx.currentTime)
      compressor.knee.setValueAtTime(8, ctx.currentTime)
      compressor.ratio.setValueAtTime(2.5, ctx.currentTime)
      compressor.attack.setValueAtTime(0.005, ctx.currentTime)
      compressor.release.setValueAtTime(0.2, ctx.currentTime)

      // Master output gain
      const masterGain = ctx.createGain()
      masterGain.gain.setValueAtTime(1.15, ctx.currentTime)

      compressor.connect(masterGain)
      masterGain.connect(ctx.destination)

      // Both male and female now use genuine human neural recordings from Edge Neural TTS!
      // No artificial pitch-shifting down, no slow-motion warping!
      const targetRate = tone === 'calm' ? 0.96 : tone === 'quick' ? 1.05 : 1.0
      source.playbackRate.value = targetRate

      if (gender === 'male') {
        // Subtle warm clarity filter for natural male voice
        const warmthFilter = ctx.createBiquadFilter()
        warmthFilter.type = 'peaking'
        warmthFilter.frequency.value = 220
        warmthFilter.gain.value = 1.5

        source.connect(warmthFilter)
        warmthFilter.connect(compressor)
      } else {
        // Subtle clarity filter for natural female voice
        const clarityFilter = ctx.createBiquadFilter()
        clarityFilter.type = 'peaking'
        clarityFilter.frequency.value = 4500
        clarityFilter.gain.value = 1.0

        source.connect(clarityFilter)
        clarityFilter.connect(compressor)
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
    phraseType: 'patient_number' | 'turn_number' = tvConfig.announcementPhrase || 'patient_number',
    tone: 'calm' | 'natural' | 'quick' = tvConfig.speechTone || 'calm'
  ) => {
    // 1. Convert digit turn into proper vocalized Arabic words (e.g. 5 -> خَمْسَة)
    const turnInWords = numberToArabicWords(turnNumber)
    // Only announce name if BOTH announceName and showPatientName are explicitly enabled
    const namePart = (callName && tvConfig.announceName && tvConfig.showPatientName && patientName && patientName.trim())
      ? `${patientName.trim()} ... `
      : ''
    const prefix = phraseType === 'turn_number' ? 'دَوْرٌ رَقْم' : 'مَرِيضٌ رَقْم'

    // Eloquent Arabic phrasing with breathing micro-pauses (...) for natural cadence
    const fullArabicPhrase = `${prefix} ${turnInWords} ... ${namePart}تَفَضَّلْ بِالدُّخُولِ إِلَى عِيَادَةِ الْكَشْفِ.`

    // 2. Primary Method: Universal Cloud TTS Audio Stream via Web Audio Studio Pipeline
    const played = await playCloudTtsAudio(fullArabicPhrase, gender, tone)
    if (played) return

    // 3. Secondary Method: HTML5 Audio stream
    try {
      const audioUrl = `/api/tts?text=${encodeURIComponent(fullArabicPhrase)}&gender=${gender}&tl=ar`
      const audioEl = new Audio(audioUrl)
      audioEl.playbackRate = 1.0
      await audioEl.play()
      return
    } catch (e) {}

    // 4. Tertiary Fallback: Browser Web Speech API (only if real Arabic voices exist)
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
            utterance.pitch = 1.15
            utterance.rate = tone === 'calm' ? 0.88 : tone === 'quick' ? 1.05 : 0.95
          } else {
            matchedVoice = arabicVoices.find(v => maleKeywords.some(kw => v.name.toLowerCase().includes(kw))) ||
              arabicVoices.find(v => !femaleKeywords.some(kw => v.name.toLowerCase().includes(kw))) || arabicVoices[0]
            utterance.pitch = 0.85
            utterance.rate = tone === 'calm' ? 0.84 : tone === 'quick' ? 0.96 : 0.88
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
    genderOverride?: 'female' | 'male',
    toneOverride?: 'calm' | 'natural' | 'quick'
  ) => {
    const chimeType = tvConfig.chimeSound || 'luxury'
    playChimeSound(chimeType)
    const delayMs = chimeType === 'none' ? 120 : 1050
    setTimeout(() => {
      speakAnnouncement(
        turnNumber,
        patientName,
        tvConfig.announceName,
        genderOverride || tvConfig.voiceGender,
        tvConfig.announcementPhrase,
        toneOverride || tvConfig.speechTone
      )
    }, delayMs)
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

  // Next Waiting Patients (Priority late-arrivals first, then queue number)
  const nextWaitingPatients = useMemo(() => {
    return branchAppointments
      .filter(a => a.status === 'waiting')
      .sort((a, b) => {
        if (a.priorityNext && !b.priorityNext) return -1
        if (!a.priorityNext && b.priorityNext) return 1
        if (a.priorityNext && b.priorityNext) {
          return new Date(a.requeuedAt || 0).getTime() - new Date(b.requeuedAt || 0).getTime()
        }
        return Number(a.queue_number || 0) - Number(b.queue_number || 0)
      })
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
  }, [currentPatient, isAudioEnabled, tvConfig.announceName, tvConfig.voiceGender, tvConfig.announcementPhrase, tvConfig.speechTone, tvConfig.chimeSound])

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

  // Check if TV Screen feature is enabled for clinic by Owner / Package
  const isTvEnabled = useMemo(() => {
    if (!clinic) return true
    return isClinicFeatureEnabled(clinic, 'tvScreen')
  }, [clinic])

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

  if (clinic && !isTvEnabled) {
    return (
      <div className={`min-h-screen w-full flex flex-col items-center justify-center p-6 text-center select-none ${
        isDark ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-900'
      }`} dir="rtl">
        <div className="max-w-md w-full p-8 rounded-3xl border border-rose-500/20 bg-rose-500/5 backdrop-blur-xl shadow-2xl space-y-5">
          <div className="w-20 h-20 rounded-3xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-500 shadow-lg">
            <Tv className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-black text-foreground">شاشة التلفزيون الذكية غير مفعلة</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              تم إيقاف خدمة شاشة الانتظار والنداء الصوتي لهذه العيادة من قبل إدارة المنصة أو باقة الاشتراك الحالية. يرجى التواصل مع إدارة النظام لتفعيل الشاشة أو ترقية الباقة.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href={`/clinic/${slug}`}
              className="inline-flex items-center justify-center w-full h-11 rounded-2xl bg-primary hover:bg-primary-hover text-white text-xs font-black shadow-md transition-all active:scale-95"
            >
              العودة لصفحة العيادة
            </Link>
          </div>
        </div>
      </div>
    )
  }

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

                <div className="space-y-3">
                  {tvConfig.showPatientName && currentPatient.patientName && (
                    <h2 className={`text-3xl sm:text-4xl font-black tracking-wide ${
                      isDark ? 'text-white' : 'text-slate-900'
                    }`}>
                      {currentPatient.patientName}
                    </h2>
                  )}
                  <div className="flex items-center justify-center gap-3 flex-wrap">
                    <span className={`text-lg sm:text-xl font-black px-6 py-2 rounded-2xl border shadow-sm ${
                      isDark
                        ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                        : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}>
                      {currentPatient.serviceName || 'كشف طبي'}
                    </span>
                    {currentPatient.branchName && (
                      <span className={`text-sm font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        • {currentPatient.branchName}
                      </span>
                    )}
                  </div>
                  <p className={`text-sm font-bold ${isDark ? 'text-emerald-400/90' : 'text-emerald-700'}`}>
                    ✓ يُرجى التوجه لغرفة الكشف مباشرة
                  </p>
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
                            {tvConfig.showPatientName && p.patientName ? p.patientName : `تذكرة دور #${p.queue_number}`}
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
                            {p.priorityNext ? 'الدور القادم ⚡' : 'التالي في الدور'}
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

              {/* Chime Sound Style & Voice Tone Controls */}
              <div className="grid sm:grid-cols-2 gap-3">
                
                {/* Chime Style Selector */}
                <div className={`p-3 rounded-2xl border space-y-1.5 ${
                  isDark ? 'bg-slate-800/40 border-white/10' : 'bg-slate-50 border-slate-200'
                }`}>
                  <label className="text-xs font-bold block flex items-center justify-between">
                    <span>رنين التنبيه قبل النداء:</span>
                    <button
                      type="button"
                      onClick={() => playChimeSound(tvConfig.chimeSound || 'luxury')}
                      className="text-[10px] text-blue-500 hover:underline font-bold cursor-pointer"
                    >
                      تجربة الرنة 🔔
                    </button>
                  </label>
                  <div className="grid grid-cols-3 gap-1 pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setTvConfig({ ...tvConfig, chimeSound: 'luxury' })
                        playChimeSound('luxury')
                      }}
                      className={`py-1.5 rounded-xl text-center text-[10px] font-bold border transition-colors cursor-pointer ${
                        (tvConfig.chimeSound || 'luxury') === 'luxury'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : isDark
                            ? 'bg-white/5 border-white/10 text-slate-300'
                            : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      <span>فاخر 3 نغمات 🔔</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTvConfig({ ...tvConfig, chimeSound: 'classic' })
                        playChimeSound('classic')
                      }}
                      className={`py-1.5 rounded-xl text-center text-[10px] font-bold border transition-colors cursor-pointer ${
                        tvConfig.chimeSound === 'classic'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : isDark
                            ? 'bg-white/5 border-white/10 text-slate-300'
                            : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      <span>كلاسيكي 🛎️</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTvConfig({ ...tvConfig, chimeSound: 'none' })}
                      className={`py-1.5 rounded-xl text-center text-[10px] font-bold border transition-colors cursor-pointer ${
                        tvConfig.chimeSound === 'none'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : isDark
                            ? 'bg-white/5 border-white/10 text-slate-300'
                            : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      <span>بدون رنين 🔕</span>
                    </button>
                  </div>
                </div>

                {/* Voice Tone & Cadence */}
                <div className={`p-3 rounded-2xl border space-y-1.5 ${
                  isDark ? 'bg-slate-800/40 border-white/10' : 'bg-slate-50 border-slate-200'
                }`}>
                  <label className="text-xs font-bold block">نبرة وسرعة النطق:</label>
                  <div className="grid grid-cols-3 gap-1 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setTvConfig({ ...tvConfig, speechTone: 'calm' })}
                      className={`py-1.5 rounded-xl text-center text-[10px] font-bold border transition-colors cursor-pointer ${
                        (tvConfig.speechTone || 'calm') === 'calm'
                          ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                          : isDark
                            ? 'bg-white/5 border-white/10 text-slate-300'
                            : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      <span>هادئ وناعم 🌸</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTvConfig({ ...tvConfig, speechTone: 'natural' })}
                      className={`py-1.5 rounded-xl text-center text-[10px] font-bold border transition-colors cursor-pointer ${
                        tvConfig.speechTone === 'natural'
                          ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                          : isDark
                            ? 'bg-white/5 border-white/10 text-slate-300'
                            : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      <span>معتدل إذاعي 🎙️</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTvConfig({ ...tvConfig, speechTone: 'quick' })}
                      className={`py-1.5 rounded-xl text-center text-[10px] font-bold border transition-colors cursor-pointer ${
                        tvConfig.speechTone === 'quick'
                          ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                          : isDark
                            ? 'bg-white/5 border-white/10 text-slate-300'
                            : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      <span>سريع ⚡</span>
                    </button>
                  </div>
                </div>

              </div>

              {/* Show Patient Name on Screen Toggle */}
              <div className={`p-3 rounded-2xl border flex items-center justify-between ${
                isDark ? 'bg-slate-800/40 border-white/10' : 'bg-slate-50 border-slate-200'
              }`}>
                <div>
                  <span className="font-bold text-xs block">إظهار اسم المريض على الشاشة</span>
                  <span className="text-[11px] text-muted-foreground">
                    {tvConfig.showPatientName ? 'معروض حالياً على الشاشة' : 'مخفي تماماً لحفظ خصوصية المرضى (معروض رقم الدور فقط)'}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={tvConfig.showPatientName}
                  onChange={(e) => setTvConfig({ ...tvConfig, showPatientName: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </div>

              {/* Patient Name Voice Toggle */}
              <div className={`p-3 rounded-2xl border flex items-center justify-between ${
                isDark ? 'bg-slate-800/40 border-white/10' : 'bg-slate-50 border-slate-200'
              }`}>
                <div>
                  <span className="font-bold text-xs block">مناداة اسم المريض بالصوت</span>
                  <span className="text-[11px] text-muted-foreground">
                    {tvConfig.announceName ? 'ينطق: مريض رقم 5، [الاسم]، تفضل بالدخول' : 'ينطق: مريض رقم 5، تفضل بالدخول (لحفظ الخصوصية وعدم كشف الاسم)'}
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
                  <span>تجربة صوت أنثوي ناعم 👩</span>
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
                  <span>تجربة صوت ذكوري وقور 👨</span>
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
                    showPatientName: false,
                    announceName: false,
                    tickerSpeed: 'normal',
                    tickerDirection: 'rtl',
                    voiceGender: 'female',
                    announcementPhrase: 'patient_number',
                    chimeSound: 'luxury',
                    speechTone: 'calm'
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
