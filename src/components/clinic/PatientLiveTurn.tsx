'use client'

import { useState, useEffect } from 'react'
import { db } from '@/lib/firebase'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { Card, CardContent } from '@/components/ui/card'
import { Activity, Clock, CheckCircle } from 'lucide-react'

export function PatientLiveTurn({ clinicId, patientPhone }: { clinicId: string, patientPhone: string }) {
  const [turnData, setTurnData] = useState<{
    myTurn: number;
    currentTurn: number;
    status: string;
    remaining: number;
  } | null>(null)
  
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clinicId || !patientPhone) return

    const today = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]
    
    const q = query(
      collection(db, 'appointments'),
      where('clinic_id', '==', clinicId),
      where('date', '==', today)
    )

    const unsubscribe = onSnapshot(q, (snap) => {
      let allAppts = snap.docs.map(d => ({ id: d.id, ...d.data() } as any))
      
      // Filter out urgent so they are invisible to the normal sequence tracker
      allAppts = allAppts.filter(a => a.serviceType !== 'urgent')

      // Sort by queue number
      allAppts.sort((a, b) => a.queue_number - b.queue_number)
      
      // Find current turn (first waiting normal/consult)
      const waitingAppts = allAppts.filter(a => a.status === 'waiting')
      const currentTurn = waitingAppts.length > 0 ? waitingAppts[0].queue_number : 0
      
      // Find my turn
      const myAppt = allAppts.find(a => a.phone === patientPhone)

      if (!myAppt) {
        setTurnData(null)
      } else {
        if (myAppt.status === 'completed') {
          setTurnData({
            status: 'completed',
            myTurn: myAppt.queue_number,
            currentTurn: currentTurn,
            remaining: 0
          })
        } else {
          // Calculate remaining (how many waiting people are ahead of me)
          const remaining = waitingAppts.filter(a => a.queue_number < myAppt.queue_number).length
          setTurnData({
            status: 'waiting',
            myTurn: myAppt.queue_number,
            currentTurn: currentTurn,
            remaining: remaining
          })
        }
      }
      setLoading(false)
    }, (err) => {
      console.error(err)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [clinicId, patientPhone])

  if (loading) return null // Hide while checking
  if (!turnData) return null // Hide if no appointment today

  return (
    <div className={`medical-card mb-8 overflow-hidden relative border-t-4 ${turnData.status === 'completed' ? 'border-t-emerald-500' : 'border-t-[#15B8A6]'}`}>
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#15B8A6]/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
      <div className="p-6 relative z-10">
        {turnData.status === 'completed' ? (
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
              <p className="text-xs text-slate-400 mt-0.5">يتم تحديث الأرقام لحظة بلحظة مع دخول كل مريض</p>
            </div>
            
            <div className="flex gap-3 w-full md:w-auto">
              <div className="flex-1 md:w-32 bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-center">
                <p className="text-xs font-bold text-slate-500 mb-1">المريض الحالي</p>
                <p className="text-3xl font-black text-[#182230] font-mono">{turnData.currentTurn || '--'}</p>
              </div>
              <div className="flex-1 md:w-32 bg-[#15B8A6] text-white rounded-2xl p-4 text-center shadow-md shadow-[#15B8A6]/25">
                <p className="text-xs font-bold text-teal-100 mb-1">رقم دورك</p>
                <p className="text-3xl font-black font-mono">{turnData.myTurn}</p>
              </div>
            </div>

            <div className="w-full md:w-auto text-center md:text-right">
              {turnData.remaining === 0 ? (
                <div className="bg-emerald-50 text-emerald-800 px-5 py-3.5 rounded-2xl font-black text-sm animate-pulse border border-emerald-200">
                  تفضل بالدخول، دورك الآن!
                </div>
              ) : (
                <div className="bg-amber-50 text-amber-800 px-5 py-3 rounded-2xl border border-amber-200 text-center">
                  <span className="block text-xs font-bold text-amber-700 mb-0.5">المتبقي أمامك</span>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-2xl font-black font-mono">{turnData.remaining}</span>
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
