'use client'

import { use, useEffect, useState, useRef } from 'react'
import { db } from '@/lib/firebase'
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import {
  FileText, Download, Printer, MessageCircle, ArrowRight,
  ShieldCheck, AlertCircle, Loader2, Calendar, User, Pill, Image as ImageIcon
} from 'lucide-react'
import Link from 'next/link'
import { ClinicLogo } from '@/components/clinic/ClinicLogo'
import { A4Prescription } from '@/components/clinic/A4Prescription'
import { downloadElementAsPdf, renderElementToPdfBlob, downloadElementAsImage, renderElementToImageBlob } from '@/lib/pdfGenerator'
import { printHtmlViaIframe, generateA4PrescriptionHtml } from '@/lib/printService'
import { shareDocumentOrImage, sharePdfDocument } from '@/lib/whatsappShare'
import { getClinicUrl } from '@/lib/clinic-url'
import { LanguageToggle } from '@/components/common/LanguageToggle'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { useLanguage } from '@/context/LanguageContext'
import { toast } from 'sonner'

export default function PublicPrescriptionPage({
  params
}: {
  params: Promise<{ slug: string; appointmentId: string }>
}) {
  const resolvedParams = use(params)
  const { slug, appointmentId } = resolvedParams
  const { t, isRtl, dir } = useLanguage()

  const [clinic, setClinic] = useState<any>(null)
  const [appointment, setAppointment] = useState<any>(null)
  const [prescription, setPrescription] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isDownloadingImage, setIsDownloadingImage] = useState(false)
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

  const patientName = prescription?.patientName || appointment?.patientName || (isRtl ? 'المريض' : 'Patient')
  const patientAge = prescription?.age || appointment?.age || appointment?.dob || ''
  const rxDate = prescription?.date || appointment?.date || new Date().toISOString().split('T')[0]
  const rxDiagnosis = prescription?.diagnosis || appointment?.diagnosis || ''
  const rxDrugs = prescription?.drugs || appointment?.drugs || []
  const patientPhone = appointment?.phone || prescription?.patientPhone || ''

  // Isolated A4 Printing
  const handlePrint = () => {
    const html = generateA4PrescriptionHtml({
      clinicName: clinic?.clinicName || (isRtl ? 'العيادة الطبية' : 'Medical Clinic'),
      doctorName: clinic?.doctorName || (isRtl ? 'طبيب العيادة' : 'Clinic Physician'),
      specialty: clinic?.specialty,
      certificationTitle: clinic?.certificationTitle,
      clinicPhone: clinic?.clinicPhone,
      clinicAddress: clinic?.clinicAddress,
      primaryColor: clinic?.primaryColor || '#087CF4',
      logoUrl: clinic?.logoUrl,
      patientName,
      patientAge,
      date: rxDate,
      diagnosis: rxDiagnosis,
      instructions: prescription?.instructions,
      drugs: rxDrugs,
      prescriptionTemplateUrl: clinic?.prescriptionTemplateUrl,
      templateMode: prescription?.templateMode || 'standard',
      showHeaderFooter: true,
      printBackground: true
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
        `Rx_${patientName}_${rxDate}.pdf`,
        { format: 'a4', orientation: 'portrait' }
      )
      toast.success(isRtl ? 'تم تحميل ملف الروشتة PDF بنجاح' : 'Prescription downloaded as PDF')
    } catch (e) {
      console.error(e)
      toast.error(isRtl ? 'حدث خطأ أثناء تحميل الروشتة' : 'Error downloading prescription PDF')
    } finally {
      setIsDownloading(false)
    }
  }

  // Real Image Download
  const handleDownloadImage = async () => {
    if (!printSheetRef.current) return
    setIsDownloadingImage(true)
    try {
      await downloadElementAsImage(
        printSheetRef.current,
        `Rx_${patientName}_${rxDate}.png`,
        { scale: 2.5 }
      )
      toast.success(isRtl ? 'تم تنزيل الروشتة كصورة PNG بنجاح' : 'Prescription downloaded as PNG')
    } catch (e) {
      console.error(e)
      toast.error(isRtl ? 'حدث خطأ أثناء تحميل صورة الروشتة' : 'Error downloading prescription image')
    } finally {
      setIsDownloadingImage(false)
    }
  }

  // WhatsApp Share with Image (and clipboard copy / download for desktop)
  const handleShareWhatsApp = async () => {
    if (!printSheetRef.current) return
    setIsSharing(true)
    try {
      toast.info(isRtl ? 'جاري إعداد صورة الروشتة...' : 'Preparing prescription image...')
      const { blob } = await renderElementToImageBlob(printSheetRef.current, { scale: 2.5 })

      const fileName = `Rx_${patientName}_${rxDate}.png`
      const currentUrl = getClinicUrl(slug, `/prescription/${appointmentId}`)
      const message = isRtl
        ? `الروشتة الطبية الإلكترونية 📄\nعيادة: ${clinic?.clinicName || 'العيادة الطبية'}\nالطبيب: د. ${clinic?.doctorName || ''}\nالمريض: ${patientName}\nالتاريخ: ${rxDate}\n\n🔗 يمكنك استعراض وتحميل الروشتة الرسمية بتصميم العيادة عبر الرابط المباشر:\n${currentUrl}\n\nنتمنى لكم دوام الصحة والعافية والشفاء العاجل! 🌿`
        : `Official E-Prescription 📄\nClinic: ${clinic?.clinicName || 'Clinic'}\nDoctor: Dr. ${clinic?.doctorName || ''}\nPatient: ${patientName}\nDate: ${rxDate}\n\n🔗 Access and download your official Rx via:\n${currentUrl}\n\nWishing you good health and a speedy recovery! 🌿`

      await shareDocumentOrImage({
        blob,
        fileName,
        fileType: 'image',
        recipientPhone: patientPhone,
        messageText: message,
        documentTitle: isRtl ? 'الروشتة الطبية' : 'Medical Prescription'
      })
    } catch (e) {
      console.error(e)
      toast.error(isRtl ? 'تعذر مشاركة الروشتة' : 'Failed to share prescription')
    } finally {
      setIsSharing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4" dir={dir}>
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-xs font-bold text-muted-foreground">
            {t('loading_rx_data', isRtl ? 'جاري تحميل بيانات الروشتة الطبية...' : 'Loading medical prescription...')}
          </p>
        </div>
      </div>
    )
  }

  if (!appointment && !prescription) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4" dir={dir}>
        <div className="bg-card rounded-3xl p-8 max-w-md w-full text-center space-y-4 shadow-sm border border-border">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
          <h2 className="text-lg font-black text-foreground">
            {t('rx_not_available', isRtl ? 'الروشتة غير متوفرة' : 'Prescription Not Available')}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t('rx_not_found_desc', isRtl ? 'لم نتمكن من العثور على بيانات هذه الروشتة أو قد تم حذف الحجز.' : 'Could not find records for this prescription or booking was removed.')}
          </p>
          <Link href={`/clinic/${slug}`}>
            <Button className="w-full yalla-gradient-btn text-white rounded-xl text-xs font-bold">
              {t('back_to_clinic', isRtl ? 'العودة إلى العيادة' : 'Back to Clinic')}
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans py-6 px-3 sm:px-6 transition-colors" dir={dir}>
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Top Floating Controls */}
        <div className="flex items-center justify-between">
          <Link
            href={`/clinic/${slug}`}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
            <span>{t('back_to_clinic', isRtl ? 'العودة للعيادة' : 'Back to Clinic')}</span>
          </Link>

          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>

        {/* Top Control Bar */}
        <div className="bg-card p-4 rounded-3xl border border-border shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <h1 className="text-sm font-black text-foreground">
                  {t('official_medical_rx', isRtl ? 'الروشتة الطبية الرسمية' : 'Official Medical Prescription')}
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {t('approved_tag', isRtl ? 'معتمدة' : 'Verified')}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {t('patient_label', isRtl ? 'المريض:' : 'Patient:')} <strong className="text-foreground">{patientName}</strong> • {rxDate}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Download Image Button */}
            <Button
              onClick={handleDownloadImage}
              disabled={isDownloadingImage}
              variant="outline"
              className="flex-1 sm:flex-none h-10 px-3.5 text-xs font-bold border-border text-foreground hover:bg-muted/40 rounded-xl shadow-xs cursor-pointer"
            >
              <ImageIcon className={`w-4 h-4 ${isRtl ? 'ml-1.5' : 'mr-1.5'}`} />
              {isDownloadingImage ? (isRtl ? 'جاري التحميل...' : 'Downloading...') : t('download_img', isRtl ? 'تحميل صورة' : 'Download Image')}
            </Button>

            {/* Download PDF Button */}
            <Button
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex-1 sm:flex-none h-10 px-4 text-xs font-bold yalla-gradient-btn text-white rounded-xl shadow-xs cursor-pointer"
            >
              <Download className={`w-4 h-4 ${isRtl ? 'ml-1.5' : 'mr-1.5'}`} />
              {isDownloading ? (isRtl ? 'جاري التحميل...' : 'Downloading...') : t('download_pdf', isRtl ? 'تحميل PDF' : 'Download PDF')}
            </Button>

            {/* Print A4 Button */}
            <Button
              onClick={handlePrint}
              variant="outline"
              className="flex-1 sm:flex-none h-10 px-4 text-xs font-bold border-border text-foreground hover:bg-muted/40 rounded-xl cursor-pointer"
            >
              <Printer className={`w-4 h-4 ${isRtl ? 'ml-1.5' : 'mr-1.5'}`} />
              {t('print_a4', isRtl ? 'طباعة A4' : 'Print A4')}
            </Button>

            {/* WhatsApp Share Button */}
            <Button
              onClick={handleShareWhatsApp}
              disabled={isSharing}
              className="flex-1 sm:flex-none h-10 px-4 text-xs font-bold bg-[#25D366] hover:bg-[#128C7E] text-white rounded-xl shadow-xs cursor-pointer"
            >
              <MessageCircle className={`w-4 h-4 ${isRtl ? 'ml-1.5' : 'mr-1.5'}`} />
              {isSharing ? (isRtl ? 'جاري المشاركة...' : 'Sharing...') : t('send_whatsapp_btn', isRtl ? 'مشاركة عبر واتساب' : 'Share via WhatsApp')}
            </Button>
          </div>
        </div>

        {/* Prescription Sheet Container */}
        <div className="bg-card rounded-3xl p-2 sm:p-6 border border-border shadow-sm overflow-x-auto flex justify-center">
          <div ref={printSheetRef} className="w-full max-w-[210mm] bg-white text-slate-900 rounded-2xl overflow-hidden shadow-xs">
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

        {/* Bottom Standard Footer */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div>
            {t('copyright_text', 'جميع الحقوق محفوظة YallaCodeX 2026')}
          </div>
          <div className="flex items-center gap-3">
            <Link href={`/clinic/${slug}`} className="hover:text-primary transition-colors">
              {clinic?.clinicName || (isRtl ? 'صفحة العيادة' : 'Clinic Page')}
            </Link>
          </div>
        </div>

      </div>
    </div>
  )
}
