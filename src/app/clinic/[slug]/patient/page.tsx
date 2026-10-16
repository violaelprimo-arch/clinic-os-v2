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
import { ClinicLoading } from '@/components/clinic/ClinicLoading'
import { InvoiceView, InvoiceData } from '@/components/clinic/InvoiceView'
import { A4Prescription } from '@/components/clinic/A4Prescription'
import { downloadElementAsPdf, renderElementToPdfBlob, downloadElementAsImage, renderElementToImageBlob } from '@/lib/pdfGenerator'
import { shareDocumentOrImage, sharePdfDocument } from '@/lib/whatsappShare'
import { NotificationCenter } from '@/components/clinic/NotificationCenter'
import { formatCairo12Hour } from '@/lib/queue-calculator'
import { getClinicUrl } from '@/lib/clinic-url'
import { toast } from 'sonner'
import { useLanguage } from '@/context/LanguageContext'

export default function PatientDashboard({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug
  const router = useRouter()
  const { t, dir, isRtl } = useLanguage()

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
          { id: '1', name: isRtl ? 'كشف عام' : 'General Exam', price: 250 },
          { id: '2', name: isRtl ? 'استشارة' : 'Consultation', price: 100 },
          { id: '3', name: isRtl ? 'كشف مستعجل' : 'Urgent Exam', price: 400 }
        ]
        setServices(clinicServices)
      } else if (slug === 'demo') {
        setClinic({
          id: 'demo',
          clinicName: isRtl ? 'العيادة التخصصية' : 'Specialized Clinic',
          doctorName: isRtl ? 'الطبيب' : 'Doctor',
          specialty: isRtl ? 'استشاري الطب المتخصص' : 'Consultant Physician',
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
  }, [slug, router, isRtl])

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
        `Rx_${selectedPrescription.patientName || 'patient'}_${selectedPrescription.date || 'visit'}.pdf`,
        { format: 'a4', orientation: 'portrait' }
      )
      toast.success(isRtl ? 'تم تحميل الروشتة بصيغة PDF بنجاح' : 'Prescription downloaded as PDF')
    } catch (e) {
      console.error(e)
      toast.error(isRtl ? 'تعذر تحميل ملف الروشتة' : 'Failed to download prescription PDF')
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
        `Rx_${selectedPrescription.patientName || 'patient'}_${selectedPrescription.date || 'visit'}.png`,
        { scale: 2.5 }
      )
      toast.success(isRtl ? 'تم تنزيل الروشتة كصورة PNG بنجاح' : 'Prescription downloaded as PNG')
    } catch (e) {
      console.error(e)
      toast.error(isRtl ? 'تعذر تنزيل صورة الروشتة' : 'Failed to download prescription image')
    } finally {
      setIsDownloadingRxImage(false)
    }
  }

  const [isSharingRx, setIsSharingRx] = useState(false)
  const handleShareWhatsAppRx = async () => {
    if (!rxModalSheetRef.current || !selectedPrescription) return
    setIsSharingRx(true)
    try {
      toast.info(isRtl ? 'جاري إعداد صورة الروشتة للمشاركة...' : 'Preparing prescription for sharing...')
      const { blob } = await renderElementToImageBlob(rxModalSheetRef.current, { scale: 2.5 })

      const pName = selectedPrescription.patientName || patientData?.name || (isRtl ? 'المريض' : 'Patient')
      const rxDate = selectedPrescription.date || new Date().toISOString().split('T')[0]
      const fileName = `Rx_${pName}_${rxDate}.png`
      const apptId = selectedPrescription.appointment_id || selectedPrescription.id
      const directRxUrl = apptId
        ? getClinicUrl(slug, `/prescription/${apptId}`)
        : getClinicUrl(slug, '/patient')

      const message = isRtl
        ? `الروشتة الطبية الإلكترونية 📄\nعيادة: ${clinic?.clinicName || 'العيادة الطبية'}\nالطبيب: د. ${clinic?.doctorName || ''}\nالمريض: ${pName}\nالتاريخ: ${rxDate}\n\n🔗 يمكنك استعراض وتحميل الروشتة الرسمية بتصميم العيادة عبر الرابط المباشر:\n${directRxUrl}\n\nنتمنى لكم دوام الصحة والعافية والشفاء العاجل! 🌿`
        : `Official E-Prescription 📄\nClinic: ${clinic?.clinicName || 'Clinic'}\nDoctor: Dr. ${clinic?.doctorName || ''}\nPatient: ${pName}\nDate: ${rxDate}\n\n🔗 Access and download your official Rx via:\n${directRxUrl}\n\nWishing you good health and a speedy recovery! 🌿`

      await shareDocumentOrImage({
        blob,
        fileName,
        fileType: 'image',
        recipientPhone: patientData?.phone || '',
        messageText: message,
        documentTitle: isRtl ? 'الروشتة الطبية' : 'Medical Prescription'
      })
    } catch (e) {
      console.error(e)
      toast.error(isRtl ? 'تعذر مشاركة الروشتة' : 'Failed to share prescription')
    } finally {
      setIsSharingRx(false)
    }
  }

  if (loading || !patientData) {
    return <ClinicLoading fullScreen size="lg" label={t('loading_medical_profile', 'جاري تحميل ملفك الطبي...')} />
  }

  return (
    <div className="min-h-screen bg-background pb-16 font-sans text-foreground" dir={dir}>
      {/* 1. Header Topbar */}
      <header className="bg-card border-b border-border sticky top-0 z-40 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/clinic/${slug}`}>
              <ClinicLogo size="sm" variant="auto" showSubtitle={false} />
            </Link>
            <div className="hidden sm:block rtl:border-r ltr:border-l border-border rtl:pr-3 ltr:pl-3">
              <span className="font-black text-sm text-foreground">{t('patient_portal', 'بوابة المريض الإلكترونية')}</span>
              <span className="text-[10px] text-muted-foreground block font-medium">
                {clinic?.clinicName || (isRtl ? 'العيادة' : 'Clinic')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {patientData?.phone && (
              <NotificationCenter
                recipientTarget={patientData.phone}
                recipientLabel={patientData.name || (isRtl ? 'المريض' : 'Patient')}
                recipientType="patient"
              />
            )}

            <Link href={`/clinic/${slug}`}>
              <Button variant="ghost" size="sm" className="text-xs font-bold text-muted-foreground hover:text-primary">
                {t('home', 'الصفحة الرئيسية')}
                <ArrowRight className="w-3.5 h-3.5 mx-1 rtl:rotate-0 ltr:rotate-180" />
              </Button>
            </Link>

            <Button
              variant="outline"
              size="sm"
              className="text-xs font-bold text-rose-600 dark:text-rose-400 border-rose-500/20 hover:bg-rose-500/10 rounded-xl"
              onClick={handleLogout}
            >
              <LogOut className="w-3.5 h-3.5 mx-1.5" />
              {t('logout', 'تسجيل الخروج')}
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
          className="yalla-card bg-gradient-to-br from-[#061A38] via-[#0E2342] to-[#07162D] rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
        >
          <div className="absolute top-0 right-0 w-80 h-80 bg-primary/20 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10 space-y-2 flex-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{t('patient_portal_verified', 'الملف الطبي الشخصي المعتمد')}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">
              {t('welcome_back', 'أهلاً بك،')} {patientData.name} 👋
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
              {t('patient_hero_desc', 'يمكنك متابعة رقم دورك اللحظي في العيادة، ومراجعة سجل زياراتك الطبية والروشتات السابقة المصروفة لك.')}
            </p>
          </div>

          <div className="relative z-10 shrink-0">
            <Dialog>
              <DialogTrigger className="inline-flex items-center justify-center yalla-gradient-btn text-white font-black text-xs h-11 px-6 rounded-xl shadow-xs cursor-pointer">
                <Plus className="w-4 h-4 mx-1.5" />
                {t('book_new_appointment', 'حجز كشف جديد بالعيادة')}
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-6 rounded-3xl" dir={dir}>
                <DialogHeader className="text-start">
                  <DialogTitle className="text-lg font-black text-foreground">
                    {t('book_new_exam', 'حجز موعد كشف جديد')}
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
            <h2 className="text-lg font-black text-foreground flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              {t('medical_visits_and_rxs', 'سجل الزيارات والروشتات الطبية')}
            </h2>
            <span className="text-xs font-bold text-muted-foreground">
              {appointments.length} {t('registered_visits', 'زيارات مسجلة')}
            </span>
          </div>

          {appointments.length === 0 ? (
            <div className="yalla-card p-12 text-center space-y-3">
              <FileText className="w-12 h-12 text-muted-foreground/40 mx-auto" />
              <h3 className="text-base font-bold text-foreground">{t('no_prior_medical_records', 'لا توجد سجلات طبية سابقة')}</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {t('records_will_appear_hint', 'عند حجز أول كشف ومقابلة الطبيب، ستظهر تفاصيل الزيارة والروشتة الطبية هنا تلقائياً.')}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {appointments.map((appt) => {
                // Strict prescription binding to appointment
                const relatedRx = prescriptions.find(
                  (rx) => rx.appointment_id === appt.id || (rx.date === appt.date && !rx.appointment_id)
                )

                return (
                  <motion.div
                    key={appt.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="yalla-card p-6 rounded-2xl border border-border space-y-4 shadow-xs"
                  >
                    {/* Top Row: Date & Service & PDF Action */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-sm text-foreground">{appt.serviceName || t('medical_exam', 'كشف طبي')}</span>
                          {appt.branchName && (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground border-border">
                              {t('branch', 'فرع')} {appt.branchName}
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground font-mono mt-0.5 block" dir="ltr">
                          {appt.date}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* Only PDF invoice view/download, NO direct thermal print */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedInvoice({
                              invoiceNumber: appt.invoiceNumber || `INV-${appt.id.slice(0, 8)}`,
                              clinicName: clinic?.clinicName || (isRtl ? 'العيادة' : 'Clinic'),
                              doctorName: clinic?.doctorName,
                              branchName: appt.branchName,
                              clinicAddress: clinic?.clinicAddress,
                              clinicPhone: clinic?.clinicPhone,
                              patientName: appt.patientName,
                              patientPhone: appt.phone,
                              date: appt.date,
                              cairoTime: formatCairo12Hour(new Date(appt.createdAt || Date.now())),
                              serviceName: appt.serviceName || t('consultation_type_exam', 'كشف'),
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
                          className="h-8 text-xs font-bold border-border text-foreground hover:text-primary rounded-xl flex items-center gap-1"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          {t('electronic_invoice_pdf', 'الفاتورة الإلكترونية PDF')}
                        </Button>

                        <span
                          className={`text-xs font-bold px-3 py-1 rounded-full border ${
                            appt.status === 'completed'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                          }`}
                        >
                          {appt.status === 'completed' ? t('exam_completed_status', 'تم الكشف الطبي') : t('in_waiting_queue', 'في قائمة الانتظار')}
                        </span>
                      </div>
                    </div>

                    {/* Diagnosis Strip */}
                    {appt.diagnosis && (
                      <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/10 space-y-1">
                        <h4 className="font-bold text-xs text-primary flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5" />
                          {t('treating_physician_diagnosis', 'تشخيص الطبيب المعالج:')}
                        </h4>
                        <p className="text-xs text-foreground font-medium whitespace-pre-wrap leading-relaxed pe-5">
                          {appt.diagnosis}
                        </p>
                      </div>
                    )}

                    {/* Prescription Section with Real PDF Viewer Trigger */}
                    {relatedRx ? (
                      <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-xs text-foreground flex items-center gap-1.5">
                            <FileText className="w-4 h-4 text-primary" />
                            {t('certified_medical_rx', 'الروشتة الطبية المعتمدة (Rx)')}
                          </h4>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-muted-foreground">
                              {relatedRx.drugs?.length || 0} {t('drugs_count', 'أصناف')}
                            </span>

                            {/* Real PDF View Button */}
                            <Button
                              size="sm"
                              onClick={() => setSelectedPrescription(relatedRx)}
                              className="h-7 px-3 text-[11px] font-bold yalla-gradient-btn text-white rounded-lg shadow-2xs flex items-center gap-1"
                            >
                              <Eye className={`w-3 h-3 ${isRtl ? 'ml-1' : 'mr-1'}`} />
                              {t('view_and_download_rx_pdf', 'عرض وتحميل الروشتة PDF')}
                            </Button>
                          </div>
                        </div>

                        {relatedRx.drugs && relatedRx.drugs.length > 0 ? (
                          <div className="grid sm:grid-cols-2 gap-2">
                            {relatedRx.drugs.map((drug: any, dIdx: number) => (
                              <div
                                key={dIdx}
                                className="bg-card p-3 rounded-xl border border-border flex items-start justify-between gap-2 shadow-2xs"
                              >
                                <div>
                                  <div className="font-bold text-xs text-foreground">{drug.name}</div>
                                  <div className="text-[11px] text-muted-foreground font-medium mt-0.5">
                                    {drug.dosage} {drug.duration ? `— ${drug.duration}` : ''}
                                  </div>
                                </div>
                                <span className="text-[10px] font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                                  #{dIdx + 1}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">{t('no_drugs_in_rx', 'لا توجد أدوية مسجلة في هذه الروشتة.')}</p>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground flex items-center gap-1.5 px-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{isRtl ? 'لم يتم اعتماد روشتة إلكترونية لهذه الزيارة بعد.' : 'No electronic prescription has been finalized for this visit yet.'}</span>
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
          <div className="bg-card text-card-foreground rounded-3xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-border">
            <InvoiceView
              invoice={selectedInvoice}
              isPatientView={true}
              onClose={() => setSelectedInvoice(null)}
            />
          </div>
        </div>
      )}

      {/* Genuine A4 Prescription PDF Viewer Modal */}
      {selectedPrescription && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto" dir={dir}>
          <div className="bg-card text-card-foreground rounded-3xl p-5 max-w-3xl w-full max-h-[95vh] overflow-y-auto shadow-2xl space-y-4 border border-border">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <h3 className="font-black text-sm text-foreground">
                  {isRtl ? 'الروشتة الطبية الرسمية المعروضة' : 'Official Medical Prescription'}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleShareWhatsAppRx}
                  disabled={isSharingRx}
                  className="h-9 px-3.5 text-xs font-bold bg-[#25D366] hover:bg-[#128C7E] text-white rounded-xl shadow-xs flex items-center gap-1.5"
                >
                  <MessageCircle className={`w-4 h-4 ${isRtl ? 'ml-1' : 'mr-1'}`} />
                  {isSharingRx ? (isRtl ? 'جاري المشاركة...' : 'Sharing...') : t('send_whatsapp_img', 'مشاركة واتساب')}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDownloadRxImage}
                  disabled={isDownloadingRxImage}
                  className="h-9 px-3 text-xs font-bold border-border text-foreground hover:bg-muted/40 rounded-xl shadow-xs flex items-center gap-1.5"
                >
                  <ImageIcon className={`w-4 h-4 ${isRtl ? 'ml-1' : 'mr-1'}`} />
                  {isDownloadingRxImage ? (isRtl ? 'جاري التحميل...' : 'Downloading...') : t('download_img', 'تحميل صورة')}
                </Button>

                <Button
                  size="sm"
                  onClick={handleDownloadRxPdf}
                  disabled={isDownloadingRx}
                  className="h-9 px-4 text-xs font-bold yalla-gradient-btn text-white rounded-xl shadow-xs flex items-center gap-1.5"
                >
                  <Download className={`w-4 h-4 ${isRtl ? 'ml-1' : 'mr-1'}`} />
                  {isDownloadingRx ? (isRtl ? 'جاري التحميل...' : 'Downloading...') : t('download_pdf', 'تحميل PDF')}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedPrescription(null)}
                  className="h-9 px-3 text-xs font-bold border-border text-foreground rounded-xl"
                >
                  {t('close', 'إغلاق')}
                </Button>
              </div>
            </div>

            {/* Rendered A4 Prescription Document */}
            <div ref={rxModalSheetRef} className="rounded-2xl overflow-hidden border border-border shadow-xs bg-white text-slate-900">
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

      {/* Standardized Copyright Footer */}
      <footer className="mt-12 text-center text-xs text-muted-foreground space-y-2">
        <p>{t('copyright_text', 'جميع الحقوق محفوظة YallaCodeX 2026')}</p>
      </footer>
    </div>
  )
}
