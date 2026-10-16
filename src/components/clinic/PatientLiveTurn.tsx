'use client'

import { useState, useEffect } from 'react'
import { db } from '@/lib/firebase'
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore'
import { Activity, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import { calculatePatientLivePosition, PatientQueueStatusResult } from '@/lib/queueCalculations'
import { useLanguage } from '@/context/LanguageContext'

export function PatientLiveTurn({ clinicId, patientPhone }: { clinicId: string; patientPhone: string }) {
  const { t, isRtl, dir } = useLanguage()
  const [liveResult, setLiveResult] = useState<PatientQueueStatusResult | null>(null)
  const [myAppt, setMyAppt] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clinicId || !patientPhone) return

    const today = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]

    let clinicData: any = null

    // 1. Fetch clinic data for queue ratios
    getDocs(query(collection(db, 'clinics'))).then(clinicSnap => {
      const clinicDoc = clinicSnap.docs.find(d => d.id === clinicId || d.data().slug === clinicId)
      if (clinicDoc) {
        clinicData = clinicDoc.data()
      }
    }).catch(console.error)

    // 2. Listen to today's appointments for this clinic
    const q = query(
      collection(db, 'appointments'),
      where('clinic_id', '==', clinicId),
      where('date', '==', today)
    )

    const unsubscribeAppts = onSnapshot(q, (snap) => {
      const allAppts = snap.docs.map(d => ({ id: d.id, ...d.data() } as any))
      const targetAppt = allAppts.find(a => a.phone === patientPhone)

      if (!targetAppt) {
        setMyAppt(null)
        setLiveResult(null)
        setLoading(false)
        return
      }

      setMyAppt(targetAppt)
      const res = calculatePatientLivePosition({
        targetAppointmentId: targetAppt.id,
        targetAppointment: targetAppt,
        allTodayAppointments: allAppts,
        clinic: clinicData
      })
      setLiveResult(res)
      setLoading(false)
    }, (err) => {
      console.error('Error fetching live turn:', err)
      setLoading(false)
    })

    return () => unsubscribeAppts()
  }, [clinicId, patientPhone])

  if (loading || !myAppt || !liveResult) return null

  return (
    <div dir={dir} className={`yalla-card mb-8 overflow-hidden relative border-t-4 ${
      liveResult.status === 'completed'
        ? 'border-t-emerald-500'
        : liveResult.isCurrentTurn
        ? 'border-t-primary'
        : 'border-t-[#02CFF3]'
    }`}>
      <div className={`absolute top-0 ${isRtl ? 'right-0 translate-x-1/3' : 'left-0 -translate-x-1/3'} w-32 h-32 bg-primary/5 rounded-full blur-2xl -translate-y-1/2 pointer-events-none`}></div>
      
      <div className="p-6 relative z-10">
        {liveResult.status === 'completed' ? (
          <div className="text-center space-y-2 py-2">
            <div className="mx-auto w-14 h-14 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mb-3">
              <CheckCircle className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-black text-emerald-700 dark:text-emerald-400">
              {t('exam_completed_today', isRtl ? 'تم الكشف الطبي اليوم بنجاح!' : 'Medical exam completed today successfully!')}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t('wishing_good_health_rx_hint', isRtl ? 'نتمنى لك دوام الصحة والعافية، يمكنك مراجعة الروشتة والأدوية بالأسفل.' : 'Wishing you good health. You can review your prescription and medications below.')}
            </p>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className={`flex-1 text-center ${isRtl ? 'md:text-right' : 'md:text-left'}`}>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary font-bold text-xs mb-2">
                <Activity className="w-3.5 h-3.5 animate-pulse" />
                <span>{t('live_turn_tag', isRtl ? 'التتبع اللحظي للدور (تلقائي ومباشر)' : 'Live Turn Tracking (Real-time)')}</span>
              </div>
              <h3 className="text-xl font-black text-foreground">
                {t('your_current_turn_clinic', isRtl ? 'دورك الحالي في العيادة' : 'Your Current Clinic Turn')}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {myAppt.branchName ? `${t('branch', isRtl ? 'فرع:' : 'Branch:')} ${myAppt.branchName} • ` : ''}
                {t('live_turn_realtime_hint', isRtl ? 'يتم تحديث الأرقام لحظة بلحظة مع دخول كل مريض' : 'Numbers update automatically as each patient enters')}
              </p>
            </div>
            
            <div className="flex gap-3 w-full md:w-auto">
              <div className="flex-1 md:w-32 bg-muted/40 border border-border rounded-2xl p-4 text-center">
                <p className="text-xs font-bold text-muted-foreground mb-1">
                  {t('current_patient', isRtl ? 'المريض الحالي' : 'Current Patient')}
                </p>
                <p className="text-2xl font-black text-foreground font-mono">
                  {liveResult.currentPatientExamining?.queueNumber ? `#${liveResult.currentPatientExamining.queueNumber}` : '—'}
                </p>
              </div>
              <div className="flex-1 md:w-32 yalla-gradient-btn text-white rounded-2xl p-4 text-center shadow-xs">
                <p className="text-xs font-bold text-white/90 mb-1">
                  {t('your_turn_num', isRtl ? 'رقم دورك' : 'Your Turn')}
                </p>
                <p className="text-2xl font-black font-mono">#{myAppt.queue_number}</p>
              </div>
            </div>

            <div className={`w-full md:w-auto text-center ${isRtl ? 'md:text-right' : 'md:text-left'}`}>
              {liveResult.isCurrentTurn ? (
                <div className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-5 py-3.5 rounded-2xl font-black text-sm animate-pulse border border-emerald-500/20">
                  {t('please_enter_turn_now', isRtl ? 'تفضل بالدخول، دورك الآن!' : 'Please enter, it is your turn now!')}
                </div>
              ) : liveResult.isNextInLine ? (
                <div className="bg-amber-500/10 text-amber-700 dark:text-amber-400 px-5 py-3 rounded-2xl border border-amber-500/20 text-center animate-bounce">
                  <span className="block text-xs font-black text-amber-800 dark:text-amber-300">
                    {t('you_are_next', isRtl ? 'أنت المريض التالي للدخول' : 'You are the next patient in line')}
                  </span>
                  <span className="text-[11px] font-bold">
                    {t('please_prepare_door', isRtl ? 'يرجى الاستعداد أمام غرفة الطبيب' : 'Please prepare near the consultation room')}
                  </span>
                </div>
              ) : (
                <div className="bg-amber-500/10 text-amber-700 dark:text-amber-400 px-5 py-3 rounded-2xl border border-amber-500/20 text-center">
                  <span className="block text-xs font-bold text-amber-800 dark:text-amber-300 mb-0.5">
                    {t('remaining_ahead', isRtl ? 'المتبقي أمامك' : 'Ahead of You')}
                  </span>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-2xl font-black font-mono">{liveResult.aheadCount}</span>
                    <span className="text-xs font-bold">
                      {liveResult.aheadCount === 1 ? (isRtl ? 'مريض' : 'patient') : (isRtl ? 'مرضى' : 'patients')}
                    </span>
                  </div>
                  {liveResult.aheadCount > 0 && (
                    <span className="text-[10px] text-muted-foreground block mt-1">
                      {isRtl
                        ? `(الوقت التقديري: حوالي ${(liveResult.aheadCount || 0) * 15} دقيقة)`
                        : `(Estimated: approx. ${(liveResult.aheadCount || 0) * 15} mins)`}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
