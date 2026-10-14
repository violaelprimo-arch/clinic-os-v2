'use client'

import { use, useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  LogOut, FileText, Clock, Activity, Calendar, ShieldCheck, Plus,
  Printer, User, ArrowRight, Receipt, Download, X, Eye, MessageCircle, Image as ImageIcon
} from 'lucide-react'
import Link from 'next/link'
import { PatientLiveTurn } from '@/components/clinic/PatientLiveTurn'
import { BookingForm } from '@/components/clinic/BookingForm'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { motion } from 'framer-motion'
import { ClinicLogo } from '@/components/clinic/ClinicLogo'
import { InvoiceView, InvoiceData } from '@/components/clinic/InvoiceView'
import { A4Prescription } from '@/components/clinic/A4Prescription'
import { downloadElementAsPdf, renderElementToPdfBlob, downloadElementAsImage, renderElementToImageBlob } from '@/lib/pdfGenerator'
import { shareDocumentOrImage, sharePdfDocument } from '@/lib/whatsappShare'
import { TechnicalSupportButton } from '@/components/clinic/TechnicalSupportButton'
import { NotificationCenter } from '@/components/clinic/NotificationCenter'
import { formatCairo12Hour } from '@/lib/queue-calculator'
import { getClinicUrl } from '@/lib/clinic-url'
import { toast } from 'sonner'

export default function PatientDashboard({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug
  const router = useRouter()

  const [patientData, setPatientData] = useState<{ phone: string; name: string; clinic_id: string; age?: string } | null>(null)
  const [appointments, setAppointments] = useState<any[]>([])
  const [prescriptions, setPrescriptions] = useState<any[]>([])
  const [clinic, setClinic] = useState<any>(null)
  const [services, setServices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceData | null>(null)
  const [selectedPrescription, setSelectedPrescription] = useState<any | null>(null)
  const [isDownloadingRx, setIsDownloadingRx] = useState(false)
  const [isDownloadingRxImage, setIsDownloadingRxImage] = useState(false)

  const rxModalSheetRef = useRef<HTMLDivElement>(null)

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
          primaryColor: '#087CF4'
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
          .map((d) => ({ id: d.id, ...d.data() } as any))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

        setAppointments(appts)

        // Fetch Prescriptions (TASK 7: only approved/finalized prescriptions)
        const rxQ = query(
          collection(db, 'prescriptions'),
          where('clinic_id', '==', parsed.clinic_id),
          where('patientPhone', '==', parsed.phone)
        )
        const rxSnap = await getDocs(rxQ)
        const rxs = rxSnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as any))
          .filter((rx) => rx.status === 'approved' || rx.status === 'finalized' || !rx.status)
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

  const handleDownloadRxPdf = async () => {
    if (!rxModalSheetRef.current || !selectedPrescription) return
    setIsDownloadingRx(true)
    try {
      await downloadElementAsPdf(
        rxModalSheetRef.current,
        `روشتة_${selectedPrescription.patientName || 'المريض'}_${selectedPrescription.date || 'كشف'}.pdf`,
        { format: 'a4', orientation: 'portrait' }
      )
      toast.success('تم تحميل الروشتة بصيغة PDF بنجاح')
    } catch (e) {
      console.error(e)
      toast.error('تعذر تحميل ملف الروشتة')
    } finally {
      setIsDownloadingRx(false)
    }
  }

  const handleDownloadRxImage = async () => {
    if (!rxModalSheetRef.current || !selectedPrescription) return
    setIsDownloadingRxImage(true)
    try {
      await downloadElementAsImage(
        rxModalSheetRef.current,
        `روشتة_${selectedPrescription.patientName || 'المريض'}_${selectedPrescription.date || 'كشف'}.png`,
        { scale: 2.5 }
      )
      toast.success('تم تنزيل الروشتة كصورة PNG بنجاح')
    } catch (e) {
      console.error(e)
      toast.error('تعذر تنزيل صورة الروشتة')
    } finally {
      setIsDownloadingRxImage(false)
    }
  }

  const [isSharingRx, setIsSharingRx] = useState(false)
  const handleShareWhatsAppRx = async () => {
    if (!rxModalSheetRef.current || !selectedPrescription) return
    setIsSharingRx(true)
    try {
      toast.info('جاري إعداد صورة الروشتة للمشاركة...')
      const { blob } = await renderElementToImageBlob(rxModalSheetRef.current, { scale: 2.5 })

      const pName = selectedPrescription.patientName || patientData?.name || 'المريض'
      const rxDate = selectedPrescription.date || new Date().toISOString().split('T')[0]
      const fileName = `روشتة_${pName}_${rxDate}.png`
      const apptId = selectedPrescription.appointment_id || selectedPrescription.id
      const directRxUrl = apptId
        ? getClinicUrl(slug, `/prescription/${apptId}`)
        : getClinicUrl(slug, '/patient')

      const message = `الروشتة الطبية الإلكترونية 📄\nعيادة: ${clinic?.clinicName || 'العيادة الطبية'}\nالطبيب: د. ${clinic?.doctorName || ''}\nالمريض: ${pName}\nالتاريخ: ${rxDate}\n\n🔗 يمكنك استعراض وتحميل الروشتة الرسمية بتصميم العيادة عبر الرابط المباشر:\n${directRxUrl}\n\nنتمنى لكم دوام الصحة والعافية والشفاء العاجل! 🌿`

      await shareDocumentOrImage({
        blob,
        fileName,
        fileType: 'image',
        recipientPhone: patientData?.phone || '',
        messageText: message,
        documentTitle: 'الروشتة الطبية'
      })
    } catch (e) {
      console.error(e)
      toast.error('تعذر مشاركة الروشتة')
    } finally {
      setIsSharingRx(false)
    }
  }

  if (loading || !patientData) {
    return (
      <div className="min-h-screen bg-[#F6F8FB] flex flex-col items-center justify-center gap-4" dir="rtl">
        <ClinicLogo size="lg" variant="light" />
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
          <div className="w-5 h-5 border-2 border-[#087CF4] border-t-transparent rounded-full animate-spin"></div>
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
            <TechnicalSupportButton variant="compact" />

            {patientData?.phone && (
              <NotificationCenter
                recipientTarget={patientData.phone}
                recipientLabel={patientData.name || 'المريض'}
                recipientType="patient"
              />
            )}

            <Link href={`/clinic/${slug}`}>
              <Button variant="ghost" size="sm" className="text-xs font-bold text-slate-600 hover:text-[#087CF4]">
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
          className="medical-card bg-gradient-to-br from-[#061A38] via-[#0E2342] to-[#07162D] rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
        >
          <div className="absolute top-0 right-0 w-80 h-80 bg-[#087CF4]/20 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10 space-y-2 flex-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-bold">
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
              <DialogTrigger className="inline-flex items-center justify-center bg-[#087CF4] hover:bg-[#0769D1] text-white font-black text-xs h-11 px-6 rounded-xl shadow-lg shadow-[#087CF4]/30 transition-all cursor-pointer">
                <Plus className="w-4 h-4 ml-1.5" />
                حجز كشف جديد بالعيادة
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-6 rounded-3xl" dir="rtl">
                <DialogHeader className="text-right">
                  <DialogTitle className="text-lg font-black text-[#182230]">
                    حجز موعد كشف جديد
                  </DialogTitle>
                </DialogHeader>
                <BookingForm
                  clinic={clinic}
                  services={services}
                  defaultPhone={patientData.phone}
                  defaultName={patientData.name}
                  defaultAge={patientData.age || ''}
                />
              </DialogContent>
            </Dialog>
          </div>
        </motion.div>

        {/* 3. Live Turn Tracker */}
        <PatientLiveTurn clinicId={patientData.clinic_id} patientPhone={patientData.phone} />

        {/* 4. Visits & Prescriptions Timeline */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-[#182230] flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#087CF4]" />
              سجل الزيارات والروشتات الطبية
            </h2>
            <span className="text-xs font-bold text-slate-400">
              {appointments.length} زيارات مسجلة
            </span>
          </div>

          {appointments.length === 0 ? (
            <div className="medical-card p-12 text-center space-y-3">
              <FileText className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-700">لا توجد سجلات طبية سابقة</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                عند حجز أول كشف ومقابلة الطبيب، ستظهر تفاصيل الزيارة والروشتة الطبية هنا تلقائياً.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {appointments.map((appt) => {
                // TASK 7: Strict prescription binding to appointment
                const relatedRx = prescriptions.find(
                  (rx) => rx.appointment_id === appt.id || (rx.date === appt.date && !rx.appointment_id)
                )

                return (
                  <motion.div
                    key={appt.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="medical-card p-6 rounded-2xl border border-[#E5EAF0] space-y-4 shadow-xs"
                  >
                    {/* Top Row: Date & Service & PDF Action */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-sm text-[#182230]">{appt.serviceName || 'كشف طبي'}</span>
                          {appt.branchName && (
                            <Badge variant="outline" className="text-[10px] text-slate-500 border-slate-200">
                              فرع {appt.branchName}
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-slate-400 font-mono mt-0.5 block" dir="ltr">
                          {appt.date}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* TASK 5: Only PDF invoice view/download, NO direct thermal print */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedInvoice({
                              invoiceNumber: appt.invoiceNumber || `INV-${appt.id.slice(0, 8)}`,
                              clinicName: clinic?.clinicName || 'العيادة',
                              doctorName: clinic?.doctorName,
                              branchName: appt.branchName,
                              clinicAddress: clinic?.clinicAddress,
                              clinicPhone: clinic?.clinicPhone,
                              patientName: appt.patientName,
                              patientPhone: appt.phone,
                              date: appt.date,
                              cairoTime: formatCairo12Hour(new Date(appt.createdAt || Date.now())),
                              serviceName: appt.serviceName || 'كشف',
                              servicePrice: appt.servicePrice || 0,
                              discount: appt.discountApplied || 0,
                              netTotal: appt.servicePrice || 0,
                              paymentMethod: appt.paymentMethod || 'cash',
                              paymentStatus: appt.paymentStatus || 'pending',
                              transferNumber: appt.transferNumber,
                              appointmentId: appt.id,
                              queueNumber: appt.queue_number
                            })
                          }}
                          className="h-8 text-xs font-bold border-[#E5EAF0] text-slate-700 hover:text-[#087CF4] rounded-xl flex items-center gap-1"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          الفاتورة الإلكترونية PDF
                        </Button>

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
                      <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-100 space-y-1">
                        <h4 className="font-bold text-xs text-[#087CF4] flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5" />
                          تشخيص الطبيب المعالج:
                        </h4>
                        <p className="text-xs text-slate-700 font-medium whitespace-pre-wrap leading-relaxed pr-5">
                          {appt.diagnosis}
                        </p>
                      </div>
                    )}

                    {/* TASK 7: Prescription Section with Real PDF Viewer Trigger */}
                    {relatedRx ? (
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-xs text-[#182230] flex items-center gap-1.5">
                            <FileText className="w-4 h-4 text-[#087CF4]" />
                            الروشتة الطبية المعتمدة (Rx)
                          </h4>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400">
                              {relatedRx.drugs?.length || 0} أصناف
                            </span>

                            {/* Real PDF View Button */}
                            <Button
                              size="sm"
                              onClick={() => setSelectedPrescription(relatedRx)}
                              className="h-7 px-3 text-[11px] font-bold bg-[#087CF4] hover:bg-[#0769D1] text-white rounded-lg shadow-2xs flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3 ml-1" />
                              عرض وتحميل الروشتة PDF
                            </Button>
                          </div>
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
                                <span className="text-[10px] font-mono font-bold text-[#087CF4] bg-blue-50 px-2 py-0.5 rounded-md">
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
                        <span>لم يتم اعتماد روشتة إلكترونية لهذه الزيارة بعد.</span>
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {/* Invoice View Modal (Restricted patient view: NO direct thermal print) */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <InvoiceView
              invoice={selectedInvoice}
              isPatientView={true}
              onClose={() => setSelectedInvoice(null)}
            />
          </div>
        </div>
      )}

      {/* TASK 7: Genuine A4 Prescription PDF Viewer Modal */}
      {selectedPrescription && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto" dir="rtl">
          <div className="bg-white rounded-3xl p-5 max-w-3xl w-full max-h-[95vh] overflow-y-auto shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#087CF4]" />
                <h3 className="font-black text-sm text-[#182230]">
                  الروشتة الطبية الرسمية المعروضة
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleShareWhatsAppRx}
                  disabled={isSharingRx}
                  className="h-9 px-3.5 text-xs font-bold bg-[#25D366] hover:bg-[#128C7E] text-white rounded-xl shadow-xs flex items-center gap-1.5"
                >
                  <MessageCircle className="w-4 h-4 ml-1" />
                  {isSharingRx ? 'جاري المشاركة...' : 'مشاركة واتساب'}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDownloadRxImage}
                  disabled={isDownloadingRxImage}
                  className="h-9 px-3 text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl shadow-xs flex items-center gap-1.5"
                >
                  <ImageIcon className="w-4 h-4 ml-1" />
                  {isDownloadingRxImage ? 'جاري التحميل...' : 'تحميل صورة'}
                </Button>

                <Button
                  size="sm"
                  onClick={handleDownloadRxPdf}
                  disabled={isDownloadingRx}
                  className="h-9 px-4 text-xs font-bold bg-[#087CF4] hover:bg-[#0769D1] text-white rounded-xl shadow-xs flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4 ml-1" />
                  {isDownloadingRx ? 'جاري التحميل...' : 'تحميل PDF'}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedPrescription(null)}
                  className="h-9 px-3 text-xs font-bold border-slate-200 text-slate-600 rounded-xl"
                >
                  إغلاق
                </Button>
              </div>
            </div>

            {/* Rendered A4 Prescription Document */}
            <div ref={rxModalSheetRef} className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
              <A4Prescription
                clinic={clinic}
                patientName={selectedPrescription.patientName}
                age={selectedPrescription.age}
                date={selectedPrescription.date}
                diagnosis={selectedPrescription.diagnosis}
                drugs={selectedPrescription.drugs || []}
                instructions={selectedPrescription.instructions}
                templateMode={selectedPrescription.templateMode || 'standard'}
                topOffset={selectedPrescription.topOffset || 25}
                primaryColor={selectedPrescription.primaryColor}
                secondaryColor={selectedPrescription.secondaryColor}
                branchName={selectedPrescription.branchName}
              />
            </div>
          </div>
        </div>
      )}

      {/* TASK 12: Standardized Copyright Footer */}
      <footer className="mt-12 text-center text-xs text-slate-400 space-y-2">
        <div className="flex items-center justify-center gap-4">
          <TechnicalSupportButton variant="compact" />
        </div>
        <p>جميع الحقوق محفوظة YallaCodeX 2026</p>
      </footer>
    </div>
  )
}
