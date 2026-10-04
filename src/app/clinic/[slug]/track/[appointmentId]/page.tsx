'use client'

import { use, useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Activity, Clock, CheckCircle, Zap, MapPin } from 'lucide-react'

export default function TrackPatientPage({ params }: { params: Promise<{ slug: string, appointmentId: string }> }) {
  const resolvedParams = use(params)
  const { slug, appointmentId } = resolvedParams
  const [appointment, setAppointment] = useState<any>(null)
  const [peopleAhead, setPeopleAhead] = useState<number | null>(null)
  const [averageTime, setAverageTime] = useState<number>(15) // Default 15 mins
  const [loading, setLoading] = useState(true)
  const [clinic, setClinic] = useState<any>(null)

  useEffect(() => {
    // 1. Fetch clinic data to get color/styles
    const fetchClinic = async () => {
      const q = query(collection(db, 'clinics'), where('slug', '==', slug))
      onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) setClinic(snapshot.docs[0].data())
      })
    }
    fetchClinic()

    // 2. Listen to the specific appointment
    const unsubscribeAppt = onSnapshot(doc(db, 'appointments', appointmentId), (docSnap) => {
      if (docSnap.exists()) {
        const apptData = docSnap.data()
        setAppointment(apptData)
        
        // 3. Listen to today's queue and calculate dynamic average
        if (apptData.status === 'waiting') {
          const qQueue = query(
            collection(db, 'appointments'),
            where('clinic_id', '==', apptData.clinic_id),
            where('date', '==', apptData.date)
          )
          onSnapshot(qQueue, (queueSnap) => {
            let aheadCount = 0
            const completedAppts: any[] = []

            queueSnap.docs.forEach(doc => {
              const d = doc.data()
              // Count people ahead
              if (d.status === 'waiting' && d.queue_number < apptData.queue_number) {
                aheadCount++
              }
              // Collect completed appointments for average time calculation
              if (d.status === 'completed' && d.completedAt) {
                completedAppts.push(d)
              }
            })

            // Sort completed appointments by queue number
            completedAppts.sort((a, b) => a.queue_number - b.queue_number)

            // Calculate Dynamic Average Time
            let validIntervals = []
            for (let i = 1; i < completedAppts.length; i++) {
              const prevTime = new Date(completedAppts[i-1].completedAt).getTime()
              const currTime = new Date(completedAppts[i].completedAt).getTime()
              const diffMins = (currTime - prevTime) / (1000 * 60)
              
              if (diffMins >= 2 && diffMins <= 45) {
                validIntervals.push(diffMins)
              }
            }

            let computedAvg = null
            if (validIntervals.length > 0) {
              const sum = validIntervals.reduce((a, b) => a + b, 0)
              computedAvg = Math.round(sum / validIntervals.length)
              computedAvg = Math.max(3, Math.min(computedAvg, 30))
            }

            setPeopleAhead(aheadCount)
            if (computedAvg) setAverageTime(computedAvg)
            setLoading(false)
          })
        } else {
          setPeopleAhead(0)
          setLoading(false)
        }
      } else {
        setLoading(false)
      }
    })

    return () => unsubscribeAppt()
  }, [slug, appointmentId])

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">جاري التحميل...</div>
  if (!appointment) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-red-500">لم يتم العثور على الحجز</div>

  const primaryColor = clinic?.primaryColor || '#0ea5e9'
  const fallbackAverage = clinic?.averageVisitTime || 15
  const finalAverageTime = averageTime !== 15 ? averageTime : fallbackAverage // if dynamically calculated, it overwrote 15
  
  const isCompleted = appointment.status === 'completed'
  const estimatedMins = (peopleAhead || 0) * finalAverageTime 

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans" dir="rtl">
      <style dangerouslySetInnerHTML={{__html: `:root { --primary: ${primaryColor}; }`}} />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-3xl mix-blend-multiply opacity-70 pointer-events-none -translate-y-1/2 translate-x-1/3"></div>

      <Card className="max-w-md w-full shadow-2xl relative z-10 border-t-8" style={{ borderTopColor: primaryColor }}>
        <CardHeader className="text-center pb-2">
          {clinic?.heroImage && (
            <img src={clinic.heroImage} alt="Clinic Logo" className="w-16 h-16 rounded-full mx-auto object-cover mb-2 shadow-md border-2 border-primary/20" />
          )}
          <CardTitle className="text-2xl font-black text-slate-800">مرحباً {appointment.patientName.split(' ')[0]}</CardTitle>
          <CardDescription>شاشة متابعة الدور المباشرة</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-4">
          
          <div className="bg-slate-100 rounded-3xl p-6 text-center shadow-inner relative overflow-hidden">
            <p className="text-slate-500 font-bold mb-2">رقم دورك</p>
            <div className="text-7xl font-black text-primary">{appointment.queue_number}</div>
          </div>

          {isCompleted ? (
            <div className="bg-green-50 p-6 rounded-2xl flex flex-col items-center text-green-700 text-center border border-green-200">
              <CheckCircle className="w-12 h-12 mb-3" />
              <h3 className="font-bold text-xl">تم الكشف بنجاح!</h3>
              <p className="text-sm mt-1">نتمنى لك دوام الصحة والعافية.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 font-semibold">الأشخاص أمامك</p>
                    <p className="font-black text-xl text-slate-800">{peopleAhead} مرضى</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 font-semibold">الوقت التقريبي المتبقي</p>
                    <p className="font-black text-xl text-slate-800">{estimatedMins === 0 ? 'الآن دورك!' : `${estimatedMins} دقيقة`}</p>
                  </div>
                </div>
              </div>

              {clinic?.mapsLink && (
                <a href={clinic.mapsLink} target="_blank" rel="noreferrer" className="block w-full">
                  <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors rounded-xl shadow-sm cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm text-blue-800 font-bold">لوكيشن العيادة</p>
                        <p className="text-xs text-blue-600">اضغط هنا لفتح خريطة جوجل</p>
                      </div>
                    </div>
                  </div>
                </a>
              )}

              {estimatedMins <= 30 && estimatedMins > 0 && (
                <div className="bg-primary/10 border-r-4 border-primary p-4 rounded-lg text-primary text-sm font-bold flex gap-2">
                  <Activity className="w-5 h-5 shrink-0" />
                  <p>اقترب دورك! يرجى التوجه للعيادة أو التواجد بالاستراحة.</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
