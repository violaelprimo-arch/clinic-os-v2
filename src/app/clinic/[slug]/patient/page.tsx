'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, onSnapshot, updateDoc, doc } from 'firebase/firestore'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LogOut, FileText, Clock, Activity, Calendar, ShieldCheck, Plus } from 'lucide-react'
import Link from 'next/link'
import { PatientLiveTurn } from '@/components/clinic/PatientLiveTurn'
import { BookingForm } from '@/components/clinic/BookingForm'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { getDoc } from 'firebase/firestore'

import { motion } from 'framer-motion'
import { ClinicLogo } from '@/components/clinic/ClinicLogo'
import { Printer, User, ArrowRight } from 'lucide-react'

export default function PatientDashboard({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug
  const router = useRouter()
  
  const [patientData, setPatientData] = useState<{ phone: string, name: string, clinic_id: string } | null>(null)
  const [appointments, setAppointments] = useState<any[]>([])
  const [prescriptions, setPrescriptions] = useState<any[]>([])
  const [clinic, setClinic] = useState<any>(null)
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [editAge, setEditAge] = useState('')
  const [editName, setEditName] = useState('')
  const [services, setServices] = useState<any[]>([])
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

    // 2. Real-time clinic synchronization
    const qClinic = query(collection(db, 'clinics'), where('slug', '==', slug))
    const unsubClinic = onSnapshot(qClinic, (cSnap) => {
      if (!cSnap.empty) {
        const cDoc = cSnap.docs[0]
        const cData = cDoc.data()
        setClinic({ id: cDoc.id, ...cData })
        const clinicServices = cData.services || [
          { id: '1', name: 'كشف عام', price: 250 },
          { id: '2', name: 'استشارة', price: 100 },
          { id: '3', name: 'كشف مستعجل', price: 400 }
        ]
        setServices(clinicServices)
      } else if (slug === 'demo') {
        setClinic({
          id: 'demo',
          clinicName: 'العيادة التخصصية',
          doctorName: 'الطبيب',
          specialty: 'استشاري الطب المتخصص',
          primaryColor: '#15B8A6'
        })
      }
    })

    // 3. Fetch History & Records
    const fetchData = async () => {
      try {

        // Fetch Appointments
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

        // Fetch Prescriptions
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

    fetchData()

    return () => unsubClinic()
  }, [slug, router])

  const handleLogout = () => {
    localStorage.removeItem('patient_auth')
    router.push(`/clinic/${slug}/patient/login`)
  }

  if (loading || !patientData) {
    return (
      <div className="min-h-screen bg-[#F6F8FB] flex flex-col items-center justify-center gap-4" dir="rtl">
        <ClinicLogo size="lg" variant="light" />
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
          <div className="w-5 h-5 border-2 border-[#15B8A6] border-t-transparent rounded-full animate-spin"></div>
          جاري تحميل ملفك الطبي...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F6F8FB] pb-16 font-sans text-[#182230]" dir="rtl">
      
      {/* 1. Header Topbar */}
      <header className="bg-white border-b border-[#E5EAF0] sticky top-0 z-40 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/clinic/${slug}`}>
              <ClinicLogo size="sm" variant="light" showSubtitle={false} />
            </Link>
            <div className="hidden sm:block border-r border-slate-200 pr-3">
              <span className="font-black text-sm text-[#182230]">بوابة المريض الإلكترونية</span>
              <span className="text-[10px] text-slate-400 block font-medium">
                {clinic?.clinicName || 'العيادة'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href={`/clinic/${slug}`}>
              <Button variant="ghost" size="sm" className="text-xs font-bold text-slate-600 hover:text-[#15B8A6]">
                الصفحة الرئيسية
                <ArrowRight className="w-3.5 h-3.5 mr-1" />
              </Button>
            </Link>

            <Button
              variant="outline"
              size="sm"
              className="text-xs font-bold text-rose-600 border-rose-200 hover:bg-rose-50 rounded-xl"
              onClick={handleLogout}
            >
              <LogOut className="w-3.5 h-3.5 ml-1.5" />
              تسجيل الخروج
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 mt-8 space-y-8">
        
        {/* 2. Welcome Hero Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="medical-card bg-gradient-to-br from-[#0B1F33] via-[#0F2840] to-[#0B1F33] rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
        >
          {/* Ambient Glow */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-[#15B8A6]/20 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10 space-y-2 flex-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>الملف الطبي الشخصي المعتمد</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">
              أهلاً بك، {patientData.name} 👋
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
              يمكنك متابعة رقم دورك اللحظي في العيادة، ومراجعة سجل زياراتك الطبية والروشتات السابقة المصروفة لك.
            </p>
          </div>
          
          <div className="relative z-10 shrink-0">
            <Dialog>
              <DialogTrigger className="inline-flex items-center justify-center bg-[#15B8A6] hover:bg-[#0D9488] text-white font-black text-xs h-11 px-6 rounded-xl shadow-lg shadow-[#15B8A6]/30 transition-all cursor-pointer">
                <Plus className="w-4 h-4 ml-1.5" />
                حجز كشف جديد بالعيادة
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-transparent border-none shadow-none">
                {clinic && services.length > 0 && (
                  <BookingForm 
                    clinic={clinic} 
                    services={services} 
                    defaultName={patientData.name} 
                    defaultPhone={patientData.phone} 
                  />
                )}
              </DialogContent>
            </Dialog>
          </div>
        </motion.div>

        {/* 3. Live Turn Tracking Banner */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <PatientLiveTurn clinicId={patientData.clinic_id} patientPhone={patientData.phone} />
        </motion.div>

        {/* 4. Visits Timeline & Prescriptions */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-[#182230] flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#15B8A6]" />
              سجل الزيارات والروشتات الطبية
            </h2>
            <span className="text-xs font-bold text-slate-400">
              إجمالي الزيارات: {appointments.length}
            </span>
          </div>
          
          {appointments.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="medical-card p-12 text-center space-y-3 bg-white"
            >
              <div className="w-14 h-14 rounded-2xl bg-teal-50 text-[#15B8A6] flex items-center justify-center mx-auto">
                <Calendar className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-sm text-[#182230]">لا توجد زيارات سابقة مسجلة برقم هاتفك حتى الآن</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                عند إتمام كشفك الأول بالعيادة، ستظهر كافة التشخيصات والروشتات الطبية الخاصة بك في هذه الصفحة تلقائياً.
              </p>
            </motion.div>
          ) : (
            <div className="space-y-5">
              {appointments.map((appt, idx) => {
                const relatedRx = prescriptions.find(rx => rx.date === appt.date)

                return (
                  <motion.div
                    key={appt.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: idx * 0.05 }}
                    className="medical-card p-5 sm:p-6 space-y-4 hover:shadow-md transition-shadow"
                  >
                    {/* Visit Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E5EAF0]">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-[#15B8A6]">زيارة #{appointments.length - idx}</span>
                          <span className="text-slate-300">•</span>
                          <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span dir="ltr" className="font-mono">{appt.date}</span>
                          </span>
                        </div>
                        <h3 className="font-black text-base text-[#182230]">
                          {appt.serviceName || 'كشف عام'}
                        </h3>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-bold px-3 py-1 rounded-full border ${
                            appt.status === 'completed'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {appt.status === 'completed' ? 'تم الكشف الطبي' : 'في قائمة الانتظار'}
                        </span>
                      </div>
                    </div>
                    
                    {/* Diagnosis Strip */}
                    {appt.diagnosis && (
                      <div className="p-3.5 rounded-xl bg-teal-50/60 border border-teal-100 space-y-1">
                        <h4 className="font-bold text-xs text-[#0D9488] flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5" />
                          تشخيص الطبيب المعالج:
                        </h4>
                        <p className="text-xs text-slate-700 font-medium whitespace-pre-wrap leading-relaxed pr-5">
                          {appt.diagnosis}
                        </p>
                      </div>
                    )}

                    {/* Prescription Section */}
                    {relatedRx ? (
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-xs text-[#182230] flex items-center gap-1.5">
                            <FileText className="w-4 h-4 text-[#15B8A6]" />
                            الروشتة الطبية والعلاج المطلوب (Rx)
                          </h4>
                          <span className="text-[10px] font-bold text-slate-400">
                            {relatedRx.drugs?.length || 0} أصناف دوائية
                          </span>
                        </div>

                        {relatedRx.drugs && relatedRx.drugs.length > 0 ? (
                          <div className="grid sm:grid-cols-2 gap-2">
                            {relatedRx.drugs.map((drug: any, dIdx: number) => (
                              <div
                                key={dIdx}
                                className="bg-white p-3 rounded-xl border border-[#E5EAF0] flex items-start justify-between gap-2 shadow-2xs"
                              >
                                <div>
                                  <div className="font-bold text-xs text-[#182230]">{drug.name}</div>
                                  <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                                    {drug.dosage} {drug.duration ? `— ${drug.duration}` : ''}
                                  </div>
                                </div>
                                <span className="text-[10px] font-mono font-bold text-[#15B8A6] bg-teal-50 px-2 py-0.5 rounded-md">
                                  #{dIdx + 1}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400">لا توجد أدوية مسجلة في هذه الروشتة.</p>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 flex items-center gap-1.5 px-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>لم يتم تسجيل روشتة إلكترونية لهذه الزيارة.</span>
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
