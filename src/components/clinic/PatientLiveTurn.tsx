'use client'

import { useState, useEffect } from 'react'
import { db } from '@/lib/firebase'
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore'
import { Activity, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import { calculatePatientLivePosition, PatientQueueStatusResult } from '@/lib/queueCalculations'

export function PatientLiveTurn({ clinicId, patientPhone }: { clinicId: string; patientPhone: string }) {
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
    <div className={`medical-card mb-8 overflow-hidden relative border-t-4 ${
      liveResult.status === 'completed'
        ? 'border-t-emerald-500'
        : liveResult.isCurrentTurn
        ? 'border-t-teal-500'
        : 'border-t-[#15B8A6]'
    }`}>
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#15B8A6]/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
      
      <div className="p-6 relative z-10">
        {liveResult.status === 'completed' ? (
          <div className="text-center space-y-2 py-2">
            <div className="mx-auto w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-3">
              <CheckCircle className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-black text-emerald-800">تم الكشف الطبي اليوم بنجاح!</h3>
            <p className="text-xs text-slate-500">نتمنى لك دوام الصحة والعافية، يمكنك مراجعة الروشتة والأدوية بالأسفل.</p>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex-1 text-center md:text-right">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 text-[#15B8A6] font-bold text-xs mb-2">
                <Activity className="w-3.5 h-3.5 animate-pulse" />
                <span>التتبع اللحظي للدور (تلقائي ومباشر)</span>
              </div>
              <h3 className="text-xl font-black text-[#182230]">دورك الحالي في العيادة</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {myAppt.branchName ? `فرع: ${myAppt.branchName} • ` : ''}
                يتم تحديث الأرقام لحظة بلحظة مع دخول كل مريض
              </p>
            </div>
            
            <div className="flex gap-3 w-full md:w-auto">
              <div className="flex-1 md:w-32 bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-center">
                <p className="text-xs font-bold text-slate-500 mb-1">المريض الحالي</p>
                <p className="text-2xl font-black text-[#182230] font-mono">
                  {liveResult.currentPatientExamining?.queueNumber ? `#${liveResult.currentPatientExamining.queueNumber}` : '—'}
                </p>
              </div>
              <div className="flex-1 md:w-32 bg-[#15B8A6] text-white rounded-2xl p-4 text-center shadow-md shadow-[#15B8A6]/25">
                <p className="text-xs font-bold text-teal-100 mb-1">رقم دورك</p>
                <p className="text-2xl font-black font-mono">#{myAppt.queue_number}</p>
              </div>
            </div>

            <div className="w-full md:w-auto text-center md:text-right">
              {liveResult.isCurrentTurn ? (
                <div className="bg-emerald-50 text-emerald-800 px-5 py-3.5 rounded-2xl font-black text-sm animate-pulse border border-emerald-200">
                  تفضل بالدخول، دورك الآن!
                </div>
              ) : liveResult.isNextInLine ? (
                <div className="bg-amber-100 text-amber-900 px-5 py-3 rounded-2xl border border-amber-300 text-center animate-bounce">
                  <span className="block text-xs font-black text-amber-800">أنت المريض التالي للدخول</span>
                  <span className="text-[11px] font-bold">يرجى الاستعداد أمام غرفة الطبيب</span>
                </div>
              ) : (
                <div className="bg-amber-50 text-amber-800 px-5 py-3 rounded-2xl border border-amber-200 text-center">
                  <span className="block text-xs font-bold text-amber-700 mb-0.5">المتبقي أمامك</span>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-2xl font-black font-mono">{liveResult.aheadCount}</span>
                    <span className="text-xs font-bold">مرضى</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
