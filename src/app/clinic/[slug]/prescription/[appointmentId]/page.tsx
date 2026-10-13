'use client'

import { use, useEffect, useState, useRef } from 'react'
import { db } from '@/lib/firebase'
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import {
  FileText, Download, Printer, MessageCircle, ArrowRight,
  ShieldCheck, AlertCircle, Loader2, Calendar, User, Pill
} from 'lucide-react'
import Link from 'next/link'
import { ClinicLogo } from '@/components/clinic/ClinicLogo'
import { A4Prescription } from '@/components/clinic/A4Prescription'
import { downloadElementAsPdf, renderElementToPdfBlob } from '@/lib/pdfGenerator'
import { printHtmlViaIframe, generateA4PrescriptionHtml } from '@/lib/printService'
import { sharePdfDocument } from '@/lib/whatsappShare'
import { TechnicalSupportButton } from '@/components/clinic/TechnicalSupportButton'
import { toast } from 'sonner'

export default function PublicPrescriptionPage({
  params
}: {
  params: Promise<{ slug: string; appointmentId: string }>
}) {
  const resolvedParams = use(params)
  const { slug, appointmentId } = resolvedParams

  const [clinic, setClinic] = useState<any>(null)
  const [appointment, setAppointment] = useState<any>(null)
  const [prescription, setPrescription] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isSharing, setIsSharing] = useState(false)

  const printSheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Fetch Clinic
        const qClinic = query(collection(db, 'clinics'), where('slug', '==', slug))
        const cSnap = await getDocs(qClinic)
        let clinicData: any = null
        if (!cSnap.empty) {
          clinicData = { id: cSnap.docs[0].id, ...cSnap.docs[0].data() }
          setClinic(clinicData)
        }

        // 2. Fetch Appointment
        const apptDoc = await getDoc(doc(db, 'appointments', appointmentId))
        let apptData: any = null
        if (apptDoc.exists()) {
          apptData = { id: apptDoc.id, ...apptDoc.data() }
          setAppointment(apptData)
        }

        // 3. Fetch Prescription if stored separately
        const qRx = query(collection(db, 'prescriptions'), where('appointment_id', '==', appointmentId))
        const rxSnap = await getDocs(qRx)
        if (!rxSnap.empty) {
          setPrescription({ id: rxSnap.docs[0].id, ...rxSnap.docs[0].data() })
        } else if (apptData?.drugs && apptData.drugs.length > 0) {
          setPrescription({
            patientName: apptData.patientName,
            age: apptData.age || apptData.dob,
            date: apptData.date,
            diagnosis: apptData.diagnosis,
            drugs: apptData.drugs
          })
        }
      } catch (err) {
        console.error('Error fetching prescription:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [slug, appointmentId])

  const patientName = prescription?.patientName || appointment?.patientName || 'المريض'
  const patientAge = prescription?.age || appointment?.age || appointment?.dob || ''
  const rxDate = prescription?.date || appointment?.date || new Date().toISOString().split('T')[0]
  const rxDiagnosis = prescription?.diagnosis || appointment?.diagnosis || ''
  const rxDrugs = prescription?.drugs || appointment?.drugs || []
  const patientPhone = appointment?.phone || prescription?.patientPhone || ''

  // Isolated A4 Printing
  const handlePrint = () => {
    if (!rxDrugs || rxDrugs.length === 0) {
      toast.error('لا توجد أدوية للطباعة في هذه الروشتة')
      return
    }

    const html = generateA4PrescriptionHtml({
      clinicName: clinic?.clinicName || 'العيادة الطبية',
      doctorName: clinic?.doctorName,
      specialty: clinic?.specialty,
      certificationTitle: clinic?.certificationTitle,
      clinicPhone: clinic?.clinicPhone,
      clinicAddress: clinic?.clinicAddress,
      primaryColor: clinic?.primaryColor || '#15B8A6',
      logoUrl: clinic?.logoUrl,
      patientName,
      patientAge,
      date: rxDate,
      diagnosis: rxDiagnosis,
      drugs: rxDrugs,
      prescriptionTemplateUrl: clinic?.prescriptionTemplateUrl,
      templateMode: clinic?.prescriptionTemplateUrl ? 'custom' : 'standard'
    })

    printHtmlViaIframe(html, 'a4')
  }

  // Real PDF Download
  const handleDownload = async () => {
    if (!printSheetRef.current) return
    setIsDownloading(true)
    try {
      await downloadElementAsPdf(
        printSheetRef.current,
        `روشتة_${patientName}_${rxDate}.pdf`,
        { format: 'a4', orientation: 'portrait' }
      )
      toast.success('تم تحميل ملف الروشتة PDF بنجاح')
    } catch (e) {
      toast.error('حدث خطأ أثناء تحميل الروشتة')
    } finally {
      setIsDownloading(false)
    }
  }

  // WhatsApp Share with real PDF
  const handleShareWhatsApp = async () => {
    if (!printSheetRef.current) return
    setIsSharing(true)
    try {
      toast.info('جاري إعداد ملف الروشتة PDF...')
      const { blob } = await renderElementToPdfBlob(printSheetRef.current, { format: 'a4', orientation: 'portrait' })

      const fileName = `روشتة_${patientName}_${rxDate}.pdf`
      const currentUrl = typeof window !== 'undefined' ? window.location.href : ''
      const message = `الروشتة الطبية الإلكترونية الرسمية 📄\nعيادة: ${clinic?.clinicName || 'العيادة الطبية'}\nالطبيب: د. ${clinic?.doctorName || ''}\nالمريض: ${patientName}\nالتاريخ: ${rxDate}\n\n🔗 يمكنك استعراض وتحميل الروشتة الرسمية بتصميم العيادة عبر الرابط المباشر:\n${currentUrl}\n\nنتمنى لكم دوام الصحة والعافية والشفاء العاجل! 🌿`

      await sharePdfDocument({
        pdfBlob: blob,
        fileName,
        recipientPhone: patientPhone,
        messageText: message,
        documentTitle: 'الروشتة الطبية الإلكترونية'
      })
    } catch (e) {
      toast.error('تعذر مشاركة الروشتة')
    } finally {
      setIsSharing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F8FB] flex items-center justify-center p-4" dir="rtl">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-[#15B8A6] mx-auto" />
          <p className="text-xs font-bold text-slate-500">جاري تحميل بيانات الروشتة الطبية...</p>
        </div>
      </div>
    )
  }

  if (!appointment && !prescription) {
    return (
      <div className="min-h-screen bg-[#F6F8FB] flex items-center justify-center p-4" dir="rtl">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center space-y-4 shadow-sm border border-slate-200">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-lg font-black text-slate-800">الروشتة غير متوفرة</h2>
          <p className="text-xs text-slate-500">
            لم نتمكن من العثور على بيانات هذه الروشتة أو قد تم حذف الحجز.
          </p>
          <Link href={`/clinic/${slug}`}>
            <Button className="w-full bg-[#15B8A6] hover:bg-[#0D9488] text-white rounded-xl text-xs font-bold">
              العودة إلى العيادة
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F6F8FB] text-[#182230] font-sans py-6 px-3 sm:px-6" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Top Control Bar */}
        <div className="bg-white p-4 rounded-3xl border border-[#E5EAF0] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/clinic/${slug}`}
              className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors"
              title="العودة لصفحة العيادة"
            >
              <ArrowRight className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#15B8A6]" />
                <h1 className="text-sm font-black text-[#182230]">الروشتة الطبية الرسمية</h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-[#0D9488] border border-teal-100">
                  معتمدة
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                المريض: <strong className="text-slate-700">{patientName}</strong> • {rxDate}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Download PDF Button */}
            <Button
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex-1 sm:flex-none h-10 px-4 text-xs font-bold bg-[#15B8A6] hover:bg-[#0D9488] text-white rounded-xl shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4 ml-1.5" />
              {isDownloading ? 'جاري التحميل...' : 'تحميل PDF'}
            </Button>

            {/* Print A4 Button */}
            <Button
              onClick={handlePrint}
              variant="outline"
              className="flex-1 sm:flex-none h-10 px-4 text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl cursor-pointer"
            >
              <Printer className="w-4 h-4 ml-1.5" />
              طباعة A4
            </Button>

            {/* WhatsApp Share Button */}
            <Button
              onClick={handleShareWhatsApp}
              disabled={isSharing}
              className="flex-1 sm:flex-none h-10 px-4 text-xs font-bold bg-[#25D366] hover:bg-[#128C7E] text-white rounded-xl shadow-xs cursor-pointer"
            >
              <MessageCircle className="w-4 h-4 ml-1.5" />
              {isSharing ? 'جاري المشاركة...' : 'مشاركة عبر واتساب'}
            </Button>
          </div>
        </div>

        {/* Prescription Sheet Container */}
        <div className="bg-white rounded-3xl p-2 sm:p-6 border border-[#E5EAF0] shadow-sm overflow-x-auto flex justify-center">
          <div ref={printSheetRef} className="w-full max-w-[210mm] bg-white">
            <A4Prescription
              clinic={clinic}
              patientName={patientName}
              age={patientAge}
              date={rxDate}
              diagnosis={rxDiagnosis}
              drugs={rxDrugs}
              templateMode={clinic?.prescriptionTemplateUrl ? 'custom' : 'standard'}
              topOffset={25}
            />
          </div>
        </div>

        {/* Bottom Support & Standard Footer */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div>
            جميع الحقوق محفوظة © {new Date().getFullYear()} Clinic OS
          </div>
          <div className="flex items-center gap-3">
            <TechnicalSupportButton />
            <span>•</span>
            <Link href={`/clinic/${slug}`} className="hover:text-[#15B8A6]">
              {clinic?.clinicName || 'صفحة العيادة'}
            </Link>
          </div>
        </div>

      </div>
    </div>
  )
}
