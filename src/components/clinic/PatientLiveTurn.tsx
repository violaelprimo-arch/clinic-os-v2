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
    <Card className={`border-t-4 shadow-lg mb-8 overflow-hidden relative ${turnData.status === 'completed' ? 'border-t-green-500' : 'border-t-blue-500'}`}>
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
      <CardContent className="p-6 relative z-10">
        {turnData.status === 'completed' ? (
          <div className="text-center space-y-2">
            <div className="mx-auto w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-bold text-green-700">تم الكشف اليوم بنجاح!</h3>
            <p className="text-slate-600">نتمنى لك دوام الصحة والعافية.</p>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex-1 text-center md:text-right">
              <div className="flex items-center justify-center md:justify-start gap-2 text-primary font-bold mb-2">
                <Activity className="w-5 h-5 animate-pulse" /> التتبع اللحظي للدور (تلقائي)
              </div>
              <h3 className="text-2xl font-black text-slate-800">دورك الحالي في العيادة</h3>
              <p className="text-slate-500 mt-1">يتم تحديث الأرقام تلقائياً بدون الحاجة لتحديث الصفحة.</p>
            </div>
            
            <div className="flex gap-4 w-full md:w-auto">
              <div className="flex-1 md:w-32 bg-blue-50 border border-blue-100 rounded-2xl p-4 text-center">
                <p className="text-sm font-bold text-blue-600 mb-1">المريض الحالي</p>
                <p className="text-4xl font-black text-slate-800">{turnData.currentTurn || '--'}</p>
              </div>
              <div className="flex-1 md:w-32 bg-primary text-white rounded-2xl p-4 text-center shadow-md shadow-primary/30">
                <p className="text-sm font-bold text-blue-100 mb-1">رقم دورك</p>
                <p className="text-4xl font-black">{turnData.myTurn}</p>
              </div>
            </div>

            <div className="w-full md:w-auto text-center md:text-right">
              {turnData.remaining === 0 ? (
                <div className="bg-green-100 text-green-800 px-6 py-4 rounded-xl font-bold text-lg animate-pulse border border-green-200">
                  تفضل بالدخول، دورك الآن!
                </div>
              ) : (
                <div className="bg-amber-50 text-amber-800 px-6 py-4 rounded-xl border border-amber-200">
                  <span className="block text-sm font-semibold opacity-80 mb-1">المتبقي أمامك</span>
                  <span className="text-2xl font-black">{turnData.remaining}</span> مرضى
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
