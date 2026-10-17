'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  Bell,
  RotateCw,
  Check,
  X,
  Clock,
  Activity,
  User,
  AlertCircle,
  Search,
  ExternalLink,
  MapPin,
  CheckCircle2,
  Hourglass
} from 'lucide-react'
import { db } from '@/lib/firebase'
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore'
import { calculatePatientLivePosition, PatientQueueStatusResult } from '@/lib/queueCalculations'
import Link from 'next/link'

export function PatientLiveTurn({
  clinic,
  clinicId: propClinicId,
  patientPhone: propPhone,
  patientName: propName,
  appointmentId: propApptId,
  onClose
}: {
  clinic?: any
  clinicId?: string
  patientPhone?: string
  patientName?: string
  appointmentId?: string
  onClose?: () => void
}) {
  const resolvedClinicId = clinic?.id || propClinicId || clinic?.slug || 'demo'
  const slug = clinic?.slug || 'zizo'

  const [inputPhone, setInputPhone] = useState<string>(propPhone || '')
  const [activePhone, setActivePhone] = useState<string>(propPhone || '')
  const [activeApptId, setActiveApptId] = useState<string>(propApptId || '')
  const [myAppt, setMyAppt] = useState<any>(null)
  const [allTodayAppts, setAllTodayAppts] = useState<any[]>([])
  const [clinicData, setClinicData] = useState<any>(clinic || null)
  const [loading, setLoading] = useState<boolean>(true)
  const [searchError, setSearchError] = useState<string>('')
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)

  // 1. Fetch clinic details if not provided
  useEffect(() => {
    if (clinic && clinic.clinicName) {
      setClinicData(clinic)
      return
    }
    const qC = query(collection(db, 'clinics'), where('slug', '==', slug))
    getDocs(qC)
      .then((snap) => {
        if (!snap.empty) {
          setClinicData({ id: snap.docs[0].id, ...snap.docs[0].data() })
        }
      })
      .catch((err) => console.error('Error fetching clinic for live turn:', err))
  }, [clinic, slug])

  // 2. Resolve active phone from localStorage if empty
  useEffect(() => {
    if (!activePhone && !activeApptId && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('patient_auth')
        if (stored) {
          const parsed = JSON.parse(stored)
          if (parsed.phone) {
            setActivePhone(parsed.phone)
            setInputPhone(parsed.phone)
          }
        }
      } catch (e) {
        console.warn('Failed to parse patient_auth:', e)
      }
    }
  }, [activePhone, activeApptId])

  // 3. Real-time snapshot of today's appointments
  useEffect(() => {
    if (!resolvedClinicId) return

    const now = new Date()
    const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0]

    const q = query(
      collection(db, 'appointments'),
      where('clinic_id', '==', resolvedClinicId),
      where('date', '==', today)
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: any[] = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as any))
        setAllTodayAppts(list)

        // Find patient appointment
        let found = null
        if (activeApptId) {
          found = list.find((a: any) => a.id === activeApptId)
        }
        if (!found && activePhone) {
          const clean = activePhone.trim().replace(/\s+/g, '')
          // Sort by createdAt descending to get most recent today's booking
          const matches = list
            .filter((a: any) => a.phone && a.phone.replace(/\s+/g, '') === clean)
            .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
          found = matches[0] || null
        }

        setMyAppt(found)
        setLoading(false)
        setIsRefreshing(false)
      },
      (err) => {
        console.error('Error in live queue snapshot:', err)
        setLoading(false)
        setIsRefreshing(false)
      }
    )

    return () => unsubscribe()
  }, [resolvedClinicId, activePhone, activeApptId])

  const liveResult: PatientQueueStatusResult | null = useMemo(() => {
    if (!myAppt) return null
    return calculatePatientLivePosition({
      targetAppointmentId: myAppt.id,
      targetAppointment: myAppt,
      allTodayAppointments: allTodayAppts,
      clinic: clinicData
    })
  }, [myAppt, allTodayAppts, clinicData])

  const handlePhoneSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputPhone.trim()) {
      setSearchError('يرجى إدخال رقم الهاتف')
      return
    }
    setSearchError('')
    setLoading(true)
    setActivePhone(inputPhone.trim())
  }

  const handleRefresh = () => {
    setIsRefreshing(true)
    setTimeout(() => setIsRefreshing(false), 600)
  }

  // Calculate circular gauge offset
  const maxTurn = Math.max(10, (liveResult?.aheadCount || 0) + 3)
  const currentAhead = liveResult?.aheadCount || 0
  const progress = liveResult?.isCurrentTurn
    ? 1
    : liveResult?.status === 'completed'
    ? 1
    : Math.max(0.1, (maxTurn - currentAhead) / maxTurn)
  const dashOffset = (301.59 * (1 - progress)).toFixed(1)

  const patientDisplayName = myAppt?.patientName || propName || 'المريض'

  return (
    <div dir="rtl" className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-[410px] rounded-[40px] bg-gradient-to-b from-[#071529] via-[#091b34] to-[#051020] text-white p-6 shadow-2xl border border-sky-400/25 space-y-5 my-auto">
        {/* Top Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-bold text-sky-300">مباشر ولحظي</span>
          </div>

          <div className="text-xl font-extrabold tracking-tight" dir="ltr">
            <span className="text-sky-400">yalla</span>
            <span className="text-slate-300 font-semibold">clinic</span>
          </div>

          {onClose ? (
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <div className="w-9" />
          )}
        </div>

        {/* Patient Not Found or No Phone Set Yet */}
        {!activePhone && !myAppt ? (
          <div className="py-6 space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-sky-500/15 border border-sky-400/30 text-sky-400 flex items-center justify-center mx-auto">
              <Search className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">تتبع دورك المباشر في العيادة</h3>
              <p className="text-xs text-slate-300 mt-1">
                أدخل رقم هاتفك المسجل بالحجز للاطلاع على ترتيبك ووقت الدخول المتوقع
              </p>
            </div>

            <form onSubmit={handlePhoneSearch} className="space-y-3">
              <input
                type="tel"
                dir="ltr"
                required
                value={inputPhone}
                onChange={(e) => setInputPhone(e.target.value)}
                placeholder="01012345678"
                className="w-full px-4 py-3 rounded-2xl bg-white/10 border border-sky-400/30 text-white text-center font-bold text-sm outline-none focus:border-sky-400"
              />
              {searchError && <p className="text-xs font-bold text-rose-400">{searchError}</p>}
              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#0066dc] to-[#00a8e8] text-white font-extrabold text-sm shadow-lg hover:shadow-xl transition-all cursor-pointer"
              >
                تتبع الدور الآن
              </button>
            </form>
          </div>
        ) : loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <RotateCw className="w-8 h-8 animate-spin text-sky-400" />
            <span className="text-xs font-bold text-sky-200">جاري قراءة بيانات الانتظار المباشرة...</span>
          </div>
        ) : !myAppt ? (
          <div className="py-6 space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-400/30 text-amber-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">لا يوجد حجز مسجل اليوم</h3>
              <p className="text-xs text-slate-300 mt-1">
                لم نجد حجزاً نشطاً لرقم الهاتف (<strong dir="ltr">{activePhone}</strong>) لتاريخ اليوم في هذه العيادة.
              </p>
            </div>
            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={() => {
                  setActivePhone('')
                  setInputPhone('')
                }}
                className="w-full py-2.5 rounded-2xl bg-white/10 text-slate-200 font-bold text-xs hover:bg-white/15"
              >
                البحث برقم آخر
              </button>
              {onClose && (
                <button
                  onClick={onClose}
                  className="w-full py-2.5 rounded-2xl bg-sky-600 text-white font-bold text-xs hover:bg-sky-500"
                >
                  إغلاق
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Live Queue View */
          <div className="space-y-4">
            {/* Patient Header */}
            <div className="flex items-center justify-between bg-white/5 p-3 rounded-2xl border border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-sky-500/20 border-2 border-sky-400 flex items-center justify-center font-black text-sky-300 text-base">
                  {patientDisplayName.charAt(0)}
                </div>
                <div>
                  <div className="text-xs text-sky-300/90 font-medium">أهلاً بك</div>
                  <div className="text-sm font-black text-white">{patientDisplayName}</div>
                </div>
              </div>
              <div className="text-left text-xs text-slate-300">
                <span className="font-bold block text-sky-400">
                  {myAppt.branchName || 'الفرع الرئيسي'}
                </span>
                <span className="text-[10px] text-slate-400 font-mono" dir="ltr">
                  {myAppt.phone}
                </span>
              </div>
            </div>

            {/* Main Queue Card */}
            <div className="bg-[#0c213d]/90 backdrop-blur-xl rounded-[28px] p-5 border border-sky-400/20 shadow-2xl space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <button
                  onClick={handleRefresh}
                  title="تحديث فوري"
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-sky-400' : ''}`} />
                </button>
                <span className="font-bold text-sm text-sky-100">
                  {liveResult?.status === 'completed'
                    ? 'الكشف الطبي منتهي'
                    : liveResult?.isCurrentTurn
                    ? 'حان دورك الآن!'
                    : 'ترتيبك في قائمة الانتظار'}
                </span>
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
                  <span className="text-4xl font-black text-white drop-shadow-[0_0_14px_rgba(56,189,248,0.65)] font-mono">
                    #{myAppt.queue_number}
                  </span>
                  <span className="text-[10px] font-bold text-sky-300 mt-1">تذكرة الحجز</span>
                </div>
              </div>

              {/* Status Pill */}
              <div className="text-center -mt-1">
                <span
                  className={`text-xs font-bold px-4 py-1.5 rounded-full border ${
                    liveResult?.status === 'completed'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                      : liveResult?.isCurrentTurn
                      ? 'bg-emerald-500/25 text-emerald-300 border-emerald-400/40 animate-pulse'
                      : 'bg-sky-500/15 text-sky-300 border-sky-400/25'
                  }`}
                >
                  {liveResult?.statusLabel || 'في قائمة الانتظار'}
                </span>
              </div>

              {/* Metrics */}
              {liveResult?.status !== 'completed' && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="bg-[#08172c] rounded-2xl p-3 text-center border border-white/5">
                    <div className="text-base font-black text-white">
                      <span className="text-lg text-sky-400 font-mono">
                        {liveResult?.estimatedWaitMins ?? (currentAhead * 15)}
                      </span>{' '}
                      دقيقة
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">الوقت المتوقع</div>
                  </div>
                  <div className="bg-[#08172c] rounded-2xl p-3 text-center border border-white/5">
                    <div className="text-lg font-black text-sky-400 font-mono">
                      {liveResult?.aheadCount ?? 0}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">مرضى أمامك</div>
                  </div>
                </div>
              )}

              {/* Currently with Doctor (Only when not completed) */}
              {liveResult?.status !== 'completed' && myAppt?.status !== 'completed' && (
                liveResult?.currentPatientExamining ? (
                  <div className="bg-sky-950/40 border border-sky-500/20 rounded-2xl p-2.5 text-center text-xs text-sky-200">
                    <span>المريض حالياً بغرفة الكشف: </span>
                    <strong className="text-white font-mono mr-1">
                      {Number(liveResult.currentPatientExamining.queueNumber) === Number(myAppt.queue_number)
                        ? 'أنت الآن مع الطبيب'
                        : `#${liveResult.currentPatientExamining.queueNumber}`}
                    </strong>
                  </div>
                ) : (
                  <div className="bg-sky-950/40 border border-sky-500/20 rounded-2xl p-2.5 text-center text-xs text-slate-300">
                    <span>المريض حالياً بغرفة الكشف: </span>
                    <span className="text-sky-300 font-bold mr-1">في انتظار بدء الكشف</span>
                  </div>
                )
              )}

              {/* Action Button */}
              <div className="pt-1">
                <Link
                  href={`/clinic/${slug}/track/${myAppt.id}`}
                  onClick={onClose}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#0066dc] to-[#00a8e8] text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow hover:opacity-95 transition-all"
                >
                  <span>صفحة المتابعة الكاملة</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
