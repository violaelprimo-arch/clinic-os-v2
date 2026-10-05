'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LogOut, FileText, Clock, Activity, Calendar, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { PatientLiveTurn } from '@/components/clinic/PatientLiveTurn'

export default function PatientDashboard({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug
  const router = useRouter()
  
  const [patientData, setPatientData] = useState<{ phone: string, name: string, clinic_id: string } | null>(null)
  const [appointments, setAppointments] = useState<any[]>([])
  const [prescriptions, setPrescriptions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 1. Check Auth
    const authData = localStorage.getItem('patient_auth')
    if (!authData) {
      router.push(`/clinic/${slug}/patient/login`)
      return
    }
    
    const parsed = JSON.parse(authData)
    setPatientData(parsed)

    // 2. Fetch History
    const fetchHistory = async () => {
      try {
        const apptsQ = query(
          collection(db, 'appointments'),
          where('clinic_id', '==', parsed.clinic_id),
          where('phone', '==', parsed.phone)
        )
        const apptsSnap = await getDocs(apptsQ)
        const appts = apptsSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as any))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        
        setAppointments(appts)

        const rxQ = query(
          collection(db, 'prescriptions'),
          where('clinic_id', '==', parsed.clinic_id),
          where('patientPhone', '==', parsed.phone)
        )
        const rxSnap = await getDocs(rxQ)
        const rxs = rxSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as any))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        
        setPrescriptions(rxs)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchHistory()
  }, [slug, router])

  const handleLogout = () => {
    localStorage.removeItem('patient_auth')
    router.push(`/clinic/${slug}/patient/login`)
  }

  if (loading || !patientData) {
    return <div className="min-h-screen flex items-center justify-center font-bold text-slate-500">جاري تحميل ملفك الطبي...</div>
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-12 font-sans" dir="rtl">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-40 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
            <span className="font-bold text-lg text-slate-800">بوابة المريض</span>
          </div>
          <Button variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700 font-bold" onClick={handleLogout}>
            تسجيل الخروج <LogOut className="w-4 h-4 mr-2" />
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 mt-8 space-y-8">
        {/* Welcome Section */}
        <div className="bg-gradient-to-l from-primary to-blue-600 rounded-3xl p-8 text-white shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
          <h1 className="text-3xl md:text-4xl font-black mb-2 relative z-10">مرحباً بك، {patientData.name} 👋</h1>
          <p className="text-blue-100 text-lg relative z-10">يمكنك هنا متابعة جميع كشوفاتك وروشتاتك الطبية بكل سهولة.</p>
        </div>

        {/* Live Turn Tracking Banner */}
        <PatientLiveTurn clinicId={patientData.clinic_id} patientPhone={patientData.phone} />

        {/* Timeline */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" /> السجل الطبي الخاص بك
          </h2>
          
          {appointments.length === 0 ? (
            <Card className="border-dashed border-2 shadow-none bg-transparent">
              <CardContent className="p-12 text-center text-slate-500 font-semibold">
                لا توجد زيارات سابقة مسجلة برقم هاتفك.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {appointments.map((appt, idx) => {
                // Find prescription for this specific date
                const relatedRx = prescriptions.find(rx => rx.date === appt.date)

                return (
                  <Card key={appt.id} className={`shadow-md border-r-4 ${idx === 0 ? 'border-r-green-500 bg-white' : 'border-r-slate-300 bg-slate-50'}`}>
                    <CardHeader className="pb-3 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <CardTitle className="text-xl flex items-center gap-2 text-slate-800">
                          <Calendar className="w-5 h-5 text-slate-500" />
                          زيارة بتاريخ: <span dir="ltr">{appt.date}</span>
                        </CardTitle>
                        <CardDescription className="mt-1 font-bold text-primary text-base">
                          {appt.serviceName}
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className={`text-sm px-3 py-1 ${appt.status === 'completed' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                        {appt.status === 'completed' ? 'تم الكشف' : 'في الانتظار'}
                      </Badge>
                    </CardHeader>
                    
                    <CardContent className="pt-4 space-y-4">
                      {/* Diagnosis */}
                      {appt.diagnosis && (
                        <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                          <h4 className="font-bold text-blue-900 flex items-center gap-2 mb-2">
                            <Activity className="w-4 h-4" /> تشخيص الطبيب
                          </h4>
                          <p className="text-slate-700 whitespace-pre-wrap">{appt.diagnosis}</p>
                        </div>
                      )}

                      {/* Prescription */}
                      {relatedRx ? (
                        <div className="bg-slate-100/50 p-4 rounded-xl border border-slate-200">
                          <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-3">
                            <FileText className="w-4 h-4" /> الروشتة والأدوية المصروفة
                          </h4>
                          {relatedRx.drugs && relatedRx.drugs.length > 0 ? (
                            <div className="grid gap-2">
                              {relatedRx.drugs.map((drug: any, dIdx: number) => (
                                <div key={dIdx} className="bg-white p-3 rounded-lg shadow-sm border border-slate-100 flex justify-between items-center">
                                  <div className="font-bold text-primary">{drug.name}</div>
                                  <div className="text-sm text-slate-600 font-medium bg-slate-50 px-2 py-1 rounded">{drug.dosage} - {drug.duration}</div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-slate-500">لا توجد أدوية محددة في هذه الروشتة.</p>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-slate-400 italic flex items-center gap-2 px-2">
                          <Clock className="w-4 h-4" /> لم يتم تسجيل روشتة إلكترونية لهذه الزيارة.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
