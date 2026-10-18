'use client'

import { use, useState, useEffect, useMemo, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Plus, Printer, Trash2, Search, FileSignature, MapPin,
  Phone, User as UserIcon, Star, Check, MessageCircle,
  FileText, ShieldCheck, ChevronDown, Sparkles, Download, Palette, Image as ImageIcon, Lock
} from 'lucide-react'
import { isClinicFeatureEnabled } from '@/lib/featurePermissions'
import { toast } from 'sonner'
import { db } from '@/lib/firebase'
import { collection, addDoc, query, where, getDocs, doc, updateDoc, onSnapshot } from 'firebase/firestore'
import { useSearchParams } from 'next/navigation'
import { EGYPTIAN_DRUGS } from '@/lib/egyptian-drugs'
import { useEgyptianDrugs } from '@/hooks/useEgyptianDrugs'
import { ClinicLogo } from '@/components/clinic/ClinicLogo'
import { A4Prescription } from '@/components/clinic/A4Prescription'
import { PhoneInputWithCountry } from '@/components/ui/PhoneInputWithCountry'
import { printHtmlViaIframe, generateA4PrescriptionHtml } from '@/lib/printService'
import { renderElementToPdfBlob, downloadElementAsPdf, renderElementToImageBlob, downloadElementAsImage } from '@/lib/pdfGenerator'
import {
  shareDocumentOrImage,
  sharePdfDocument,
  generateCleanRxFileName,
  formatEgyptianPhoneForWhatsApp,
  openManualWhatsAppChat,
  formatPrescriptionWhatsAppMessage
} from '@/lib/whatsappShare'
import { getClinicUrl } from '@/lib/clinic-url'
import { useLanguage } from '@/context/LanguageContext'

export default function PrescriptionsPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug
  const searchParams = useSearchParams()
  const { t, tDynamic, dir, isRtl, language } = useLanguage()

  const [appointmentId, setAppointmentId] = useState(searchParams?.get('appointmentId') || '')
  const [patientName, setPatientName] = useState(searchParams?.get('patientName') || '')
  const [patientPhone, setPatientPhone] = useState(searchParams?.get('phone') || searchParams?.get('patientPhone') || '')
  const [diagnosis, setDiagnosis] = useState('')
  const [age, setAge] = useState(searchParams?.get('age') || '')
  const [instructions, setInstructions] = useState('')
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [selectedBranchName, setSelectedBranchName] = useState('')
  const [whatsappTarget, setWhatsappTarget] = useState<'auto' | 'app' | 'web'>('auto')
  const [showWhatsappMenu, setShowWhatsappMenu] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('yalla_rx_whatsapp_mode') as 'auto' | 'app' | 'web'
      if (saved) setWhatsappTarget(saved)
    }
  }, [])

  const setAndSaveWhatsappTarget = (mode: 'auto' | 'app' | 'web') => {
    setWhatsappTarget(mode)
    if (typeof window !== 'undefined') {
      localStorage.setItem('yalla_rx_whatsapp_mode', mode)
    }
  }

  const { drugs: apiDrugs, loading: apiDrugsLoading } = useEgyptianDrugs()
  const [drugs, setDrugs] = useState<any[]>([
    { id: 1, name: searchParams?.get('drug') || '', dosage: '', duration: '', notes: '' }
  ])

  const [drugSearch, setDrugSearch] = useState('')
  const [favoriteDrugs, setFavoriteDrugs] = useState<string[]>([
    'Augmentin 1g', 'Catafast 50 mg', 'Panadol 500 mg', 'Brufen 600 mg', 'Controloc 40 mg', 'Alphintern'
  ])
  const [clinicId, setClinicId] = useState<string | null>(null)
  const [clinic, setClinic] = useState<any>(null)
  const [templateMode, setTemplateMode] = useState<'standard' | 'custom'>('standard')
  const [pageSize, setPageSize] = useState<'a4' | 'a5'>('a4')
  const [showHeaderFooter, setShowHeaderFooter] = useState<boolean>(true)
  const [printBackground, setPrintBackground] = useState<boolean>(true)
  const [topOffset, setTopOffset] = useState<number>(25)
  const [primaryColor, setPrimaryColor] = useState('#061A38')
  const [secondaryColor, setSecondaryColor] = useState('#087CF4')

  const [isSaving, setIsSaving] = useState(false)
  const [isSharingPdf, setIsSharingPdf] = useState(false)
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)
  const [isDownloadingImage, setIsDownloadingImage] = useState(false)
  const [todayPatients, setTodayPatients] = useState<any[]>([])
  const dateStr = new Date().toISOString().split('T')[0]

  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const q = query(collection(db, 'clinics'), where('slug', '==', slug))
    const unsubClinic = onSnapshot(
      q,
      async (snapshot) => {
        if (!snapshot.empty) {
          const cDoc = snapshot.docs[0]
          const data = cDoc.data()
          setClinic({ id: cDoc.id, ...data })
          setClinicId(cDoc.id)
          if (data.primaryColor) setPrimaryColor(data.primaryColor)
          if (data.secondaryColor) setSecondaryColor(data.secondaryColor)
          if (data.favoriteDrugs && data.favoriteDrugs.length > 0) {
            setFavoriteDrugs(data.favoriteDrugs)
          }

          // Fetch today's patients for quick select
          try {
            const todayQ = query(
              collection(db, 'appointments'),
              where('clinic_id', '==', cDoc.id),
              where('date', '==', dateStr)
            )
            const todaySnap = await getDocs(todayQ)
            setTodayPatients(todaySnap.docs.map(d => ({ id: d.id, ...d.data() })))
          } catch (e) {
            console.error(e)
          }
        }
      },
      (err) => {
        console.error(err)
      }
    )

    return () => unsubClinic()
  }, [slug, dateStr])

  const [activeBranchId, setActiveBranchId] = useState<string>('all')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('clinic_selected_branch') || 'all'
      setActiveBranchId(saved)

      const handleBranchChanged = (e: any) => {
        const bId = e.detail?.branchId || 'all'
        setActiveBranchId(bId)
      }
      window.addEventListener('clinic_branch_changed', handleBranchChanged)
      return () => window.removeEventListener('clinic_branch_changed', handleBranchChanged)
    }
  }, [])

  const filteredTodayPatients = useMemo(() => {
    if (!activeBranchId || activeBranchId === 'all') return todayPatients
    return todayPatients.filter(p => {
      const pBranch = p.branch_id || p.branchId
      const isMain = activeBranchId === 'main' || clinic?.branches?.find((b: any) => b.isMain)?.id === activeBranchId
      return pBranch ? pBranch === activeBranchId : isMain
    })
  }, [todayPatients, activeBranchId, clinic])

  const isCustomTemplateEnabled = useMemo(() => isClinicFeatureEnabled(clinic, 'customTemplate'), [clinic])
  const isDrugsDbEnabled = useMemo(() => isClinicFeatureEnabled(clinic, 'drugs'), [clinic])

  useEffect(() => {
    if (!isCustomTemplateEnabled && templateMode === 'custom') {
      setTemplateMode('standard')
    }
  }, [isCustomTemplateEnabled, templateMode])

  const addDrug = (name = '', dosage = '', duration = '', notes = '') => {
    setDrugs([...drugs, { id: Date.now(), name, dosage, duration, notes }])
  }

  const removeDrug = (id: number) => {
    if (drugs.length === 1) {
      setDrugs([{ id: Date.now(), name: '', dosage: '', duration: '', notes: '' }])
      return
    }
    setDrugs(drugs.filter(d => d.id !== id))
  }

  const updateDrug = (id: number, field: string, value: string) => {
    setDrugs(drugs.map(d => (d.id === id ? { ...d, [field]: value } : d)))
  }

  // TASK 6 & 7: Save Prescription without automated WhatsApp message
  const handleSave = async () => {
    if (!patientName.trim()) return toast.error('يرجى إدخال اسم المريض')
    if (!patientPhone.trim()) return toast.error('يرجى إدخال رقم هاتف المريض')

    setIsSaving(true)
    try {
      if (clinicId) {
        const docRef = await addDoc(collection(db, 'prescriptions'), {
          clinic_id: clinicId,
          branch_id: selectedBranchId || clinic?.branchId || '',
          branchName: selectedBranchName || clinic?.branchName || '',
          appointment_id: appointmentId || '',
          patientName,
          patientPhone,
          age,
          diagnosis,
          instructions,
          date: dateStr,
          status: 'approved',
          doctorName: clinic?.doctorName || 'طبيب العيادة',
          templateMode,
          topOffset,
          primaryColor,
          secondaryColor,
          drugs: drugs.filter(d => d.name && d.name.trim() !== ''),
          createdAt: new Date().toISOString()
        })

        // Record Audit Log
        try {
          const { recordAuditLog } = await import('@/lib/audit-logger')
          recordAuditLog({
            action: 'PRESCRIPTION_CREATED',
            actorName: clinic?.doctorName || 'طبيب العيادة',
            actorRole: 'doctor',
            clinicId,
            details: { prescriptionId: docRef.id, patientName, patientPhone, appointmentId }
          })
        } catch (e) {}

        if (appointmentId) {
          try {
            await updateDoc(doc(db, 'appointments', appointmentId), {
              diagnosis,
              drugs: drugs.filter(d => d.name && d.name.trim() !== ''),
              prescription_id: docRef.id,
              prescriptionStatus: 'approved'
            })
          } catch (e) {}
        }

        if (patientPhone) {
          try {
            const { createClinicNotification } = await import('@/lib/notificationService')
            await createClinicNotification({
              clinicId,
              branchId: selectedBranchId || clinic?.branchId || undefined,
              recipientType: 'patient',
              recipientTarget: patientPhone,
              title: 'تم إصدار الروشتة الطبية 📄',
              body: `تم اعتماد الروشتة الطبية الخاصة بك بواسطة د. ${clinic?.doctorName || 'العيادة'}. يمكنك استعراضها وتحميلها عبر بوابتك الإلكترونية.`,
              type: 'prescription_ready',
              eventId: `rx_ready_${docRef.id}`,
              appointmentId: appointmentId || undefined
            })
          } catch (e) {}
        }

        toast.success('تم حفظ واعتماد الروشتة في الملف الطبي بنجاح!')
      }
    } catch (error) {
      toast.error('حدث خطأ أثناء حفظ الروشتة')
    } finally {
      setIsSaving(false)
    }
  }

  // Real PDF WhatsApp sharing: Opens chat instantly (0ms synchronous click), generates & auto-downloads PDF, copies Ctrl+V image
  const handleShareWhatsAppRx = async (modeOverride?: 'auto' | 'app' | 'web') => {
    if (!patientPhone) return toast.error('يرجى إدخال رقم هاتف المريض أولاً')

    const message = formatPrescriptionWhatsAppMessage({
      clinicName: clinic?.clinicName || 'العيادة الطبية',
      doctorName: clinic?.doctorName,
      specialty: clinic?.specialty,
      patientName: patientName || 'المريض',
      patientAge: age,
      date: dateStr,
      rxNumber: 1042,
      diagnosis,
      instructions,
      drugs: drugs.filter(d => d.name && d.name.trim() !== '')
      // Strictly NO directRxUrl sent, zero web links!
    })

    const targetMode = modeOverride || whatsappTarget || 'auto'
    const cleanFileName = generateCleanRxFileName(patientName, dateStr, 'pdf')

    // 1. OPEN WHATSAPP CHAT SYNCHRONOUSLY IN 0ms (Guarantees zero popup blocker!)
    openManualWhatsAppChat({
      phone: patientPhone,
      message,
      target: targetMode
    })

    toast.success(`تم فتح محادثة المريض (${patientPhone}) في واتساب! جاري تجهيز الـ PDF... 🚀`, {
      duration: 4000
    })

    // 2. Generate PDF and clipboard image in background, then auto-download
    if (sheetRef.current) {
      setIsSharingPdf(true)
      try {
        const { blob: pdfBlob } = await renderElementToPdfBlob(sheetRef.current, {
          fileName: cleanFileName,
          format: pageSize === 'a5' ? 'a5' : 'a4',
          orientation: 'portrait',
          scale: 2.2
        })

        // Download clean PDF file immediately
        const downloadUrl = window.URL.createObjectURL(pdfBlob)
        const a = document.createElement('a')
        a.href = downloadUrl
        a.download = cleanFileName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 30000)

        // Copy high-res image to clipboard for instant Ctrl+V pasting
        if (typeof navigator !== 'undefined' && navigator.clipboard && window.ClipboardItem) {
          renderElementToImageBlob(sheetRef.current, { scale: 2.5 }).then(async ({ blob: imgBlob }) => {
            try {
              await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': imgBlob })
              ])
            } catch {}
          }).catch(() => {})
        }

        toast.success(`✅ تم تجهيز الـ PDF! اسحب الملف للشات المفتوح أو اضغط (Ctrl + V) لإرسال صورة الروشتة فوراً 🚀`, {
          duration: 9000
        })
      } catch (err) {
        console.warn('Background PDF generation warning:', err)
      } finally {
        setIsSharingPdf(false)
      }
    }
  }

  // Real Image Download (PNG)
  const handleDownloadImage = async () => {
    if (!sheetRef.current) return
    setIsDownloadingImage(true)
    try {
      const fileName = generateCleanRxFileName(patientName, dateStr, 'png')
      await downloadElementAsImage(
        sheetRef.current,
        fileName,
        { scale: 2.5 }
      )
      toast.success(`تم تنزيل صورة الروشتة (${fileName}) بنجاح`)
    } catch (e) {
      console.error(e)
      toast.error('تعذر تنزيل صورة الروشتة')
    } finally {
      setIsDownloadingImage(false)
    }
  }

  // Real PDF Download
  const handleDownloadPdf = async () => {
    if (!sheetRef.current) return
    setIsDownloadingPdf(true)
    try {
      const fileName = generateCleanRxFileName(patientName, dateStr, 'pdf')
      await downloadElementAsPdf(
        sheetRef.current,
        fileName,
        { format: pageSize, orientation: 'portrait' }
      )
      toast.success(`تم تنزيل ملف الروشتة PDF (${fileName}) بنجاح`)
    } catch (e) {
      console.error(e)
      toast.error('تعذر تنزيل ملف الروشتة')
    } finally {
      setIsDownloadingPdf(false)
    }
  }

  // Clean Isolated Print via iframe
  const handlePrint = () => {
    const html = generateA4PrescriptionHtml({
      clinicName: clinic?.clinicName || 'Yalla Clinic',
      doctorName: clinic?.doctorName || 'طبيب العيادة',
      specialty: clinic?.specialty,
      degreeTitle: clinic?.certificationTitle,
      branchName: selectedBranchName || clinic?.branchName,
      clinicAddress: clinic?.clinicAddress,
      clinicPhone: clinic?.clinicPhone,
      logoUrl: clinic?.logoUrl,
      patientName: patientName || 'المريض',
      patientAge: age ? String(age) : undefined,
      date: dateStr,
      diagnosis,
      instructions,
      drugs: drugs.filter(d => d.name && d.name.trim() !== ''),
      primaryColor,
      secondaryColor,
      pageSize,
      showHeaderFooter,
      printBackground,
      templateMode,
      topOffset,
      prescriptionTemplateUrl: clinic?.prescriptionTemplateUrl
    })
    printHtmlViaIframe(html, pageSize)
  }

  // Filtered drugs for quick search
  const filteredSearchDrugs = useMemo(() => {
    if (!drugSearch.trim()) return []
    const queryTerm = drugSearch.toLowerCase()
    return Array.from(
      new Set([...EGYPTIAN_DRUGS, ...apiDrugs.map(a => a.commercial_name_en || a.commercial_name_ar)])
    )
      .filter(d => d.toLowerCase().includes(queryTerm))
      .slice(0, 8)
  }, [drugSearch, apiDrugs])

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto" dir={dir}>
      
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 yalla-card p-5 border border-border shadow-xs">
        <div>
          <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
            <FileSignature className="w-6 h-6 text-primary" />
            {t('issue_rx_title', 'إصدار روشتة طبية (A4 Premium)')}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('issue_rx_desc', 'تعبئة بيانات الكشف والأدوية مع معاينة فورية وتصدير PDF أصلي')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Unified Instant WhatsApp Share Button (No download, 0ms popup-free launch, full Rx in chat, Ctrl+V image) */}
          <div className="relative inline-flex items-center">
            <Button
              onClick={() => handleShareWhatsAppRx()}
              className="h-10 text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-s-xl rounded-e-none shadow-md shadow-emerald-600/25 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
              title="إرسال الروشتة مباشرة إلى محادثة المريض في واتساب"
            >
              <MessageCircle className="w-4 h-4 ml-1" />
              <span>{t('send_whatsapp_pdf', 'إرسال واتساب للمريض')}</span>
              {patientPhone && (
                <span className="text-[10px] bg-emerald-700/60 px-1.5 py-0.5 rounded-md font-mono font-normal" dir="ltr">
                  {formatEgyptianPhoneForWhatsApp(patientPhone).slice(-8)}
                </span>
              )}
            </Button>
            <button
              type="button"
              onClick={() => setShowWhatsappMenu(!showWhatsappMenu)}
              className="h-10 px-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-e-xl rounded-s-none border-s border-emerald-600 transition-all flex items-center justify-center cursor-pointer"
              title="خيارات فتح واتساب (الكمبيوتر أو الويب)"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showWhatsappMenu ? 'rotate-180' : ''}`} />
            </button>

            {showWhatsappMenu && (
              <div className="absolute top-full end-0 mt-1.5 w-64 bg-card border border-border rounded-2xl shadow-2xl p-2 z-50 space-y-1">
                <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground border-b border-border pb-1">
                  طريقة فتح محادثة واتساب:
                </div>
                <button
                  type="button"
                  onClick={() => { setAndSaveWhatsappTarget('auto'); handleShareWhatsAppRx('auto'); setShowWhatsappMenu(false); }}
                  className="w-full text-right px-2.5 py-1.5 text-xs rounded-xl hover:bg-secondary flex items-center justify-between cursor-pointer"
                >
                  <span className="font-bold">📱 تلقائي (المثبت أو الويب)</span>
                  {whatsappTarget === 'auto' && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                </button>
                <button
                  type="button"
                  onClick={() => { setAndSaveWhatsappTarget('app'); handleShareWhatsAppRx('app'); setShowWhatsappMenu(false); }}
                  className="w-full text-right px-2.5 py-1.5 text-xs rounded-xl hover:bg-secondary flex items-center justify-between cursor-pointer"
                >
                  <span className="font-bold">💻 تطبيق الكمبيوتر (Desktop App)</span>
                  {whatsappTarget === 'app' && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                </button>
                <button
                  type="button"
                  onClick={() => { setAndSaveWhatsappTarget('web'); handleShareWhatsAppRx('web'); setShowWhatsappMenu(false); }}
                  className="w-full text-right px-2.5 py-1.5 text-xs rounded-xl hover:bg-secondary flex items-center justify-between cursor-pointer"
                >
                  <span className="font-bold">🌐 واتساب ويب (WhatsApp Web)</span>
                  {whatsappTarget === 'web' && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                </button>
              </div>
            )}
          </div>

          {/* Real PDF Download */}
          <Button
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            variant="outline"
            className="h-10 text-xs font-bold border-border text-foreground hover:bg-secondary rounded-xl"
            title="Download PDF"
          >
            <Download className="w-4 h-4 ml-1.5" />
            {isDownloadingPdf ? t('loading', 'جاري التحميل...') : t('download_pdf', 'تحميل PDF')}
          </Button>

          {/* Real Image Download */}
          <Button
            onClick={handleDownloadImage}
            disabled={isDownloadingImage}
            variant="outline"
            className="h-10 text-xs font-bold border-border text-foreground hover:bg-secondary rounded-xl"
            title="Download PNG"
          >
            <ImageIcon className="w-4 h-4 ml-1.5" />
            {isDownloadingImage ? t('loading', 'جاري التحميل...') : t('download_img', 'تحميل صورة')}
          </Button>

          {/* Clean Isolated Print */}
          <Button
            onClick={handlePrint}
            variant="outline"
            className="h-10 text-xs font-bold border-primary text-primary hover:bg-primary/10 rounded-xl"
          >
            <Printer className="w-4 h-4 ml-1.5" />
            {t('print_size', 'طباعة')} {pageSize.toUpperCase()}
          </Button>

          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="h-10 px-5 text-xs font-bold yalla-gradient-btn text-white rounded-xl shadow-md"
          >
            {isSaving ? t('saving', 'جاري الحفظ...') : t('save_rx_to_file', 'اعتماد وحفظ بالملف')}
          </Button>
        </div>
      </div>

      {/* 2. Main Two-Column Layout */}
      <div className="grid lg:grid-cols-12 gap-6 items-start">
        
        {/* RIGHT COLUMN: Form Editor (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          
          {/* Patient Details Card */}
          <div className="yalla-card p-5 space-y-4 border border-border">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-primary" />
                {t('patient_visit_info', 'بيانات المريض والزيارة')}
              </h3>

              {filteredTodayPatients.length > 0 && (
                <select
                  className="text-xs font-bold border border-border rounded-xl px-2.5 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  onChange={(e) => {
                    const selected = filteredTodayPatients.find(p => p.id === e.target.value)
                    if (selected) {
                      setPatientName(selected.patientName || '')
                      setAppointmentId(selected.id)
                      setPatientPhone(selected.phone || '')
                      setAge(selected.age || selected.dob || '')
                      if (selected.branch_id) setSelectedBranchId(selected.branch_id)
                      if (selected.branchName) setSelectedBranchName(selected.branchName)
                    }
                  }}
                >
                  <option value="">{t('select_from_today_patients', '-- اختر من كشوفات اليوم --')}</option>
                  {filteredTodayPatients.map(p => (
                    <option key={p.id} value={p.id}>
                      #{p.queue_number} - {p.patientName} {p.branchName ? `(${tDynamic(p.branchName)})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1 space-y-1">
                <Label className="text-xs font-bold text-muted-foreground">{t('patient_name', 'اسم المريض')}</Label>
                <Input
                  value={patientName}
                  onChange={e => setPatientName(e.target.value)}
                  placeholder={t('patient_name', 'اسم المريض')}
                  className="h-10 text-xs rounded-xl bg-background border-border text-foreground"
                />
              </div>

              <div className="sm:col-span-1 space-y-1">
                <Label className="text-xs font-bold text-muted-foreground">{t('phone', 'رقم الهاتف')}</Label>
                <PhoneInputWithCountry
                  value={patientPhone}
                  onChange={(fullNumber) => setPatientPhone(fullNumber)}
                  size="sm"
                />
              </div>

              <div className="sm:col-span-1 space-y-1">
                <Label className="text-xs font-bold text-muted-foreground">{t('patient_age', 'السن')}</Label>
                <Input
                  value={age}
                  onChange={e => setAge(e.target.value)}
                  placeholder={language === 'en' ? 'e.g., 32 years' : 'مثال: 32 سنة'}
                  className="h-10 text-xs rounded-xl bg-background border-border text-foreground"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-muted-foreground">{t('clinical_diagnosis', 'التشخيص الطبي')}</Label>
              <Input
                value={diagnosis}
                onChange={e => setDiagnosis(e.target.value)}
                placeholder={t('diagnosis_placeholder', 'التشخيص الإكلينيكي للحالة')}
                className="h-10 text-xs rounded-xl bg-background border-border text-foreground"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-muted-foreground">{t('doctor_instructions', 'تعليمات وإرشادات الطبيب للمريض')}</Label>
              <Input
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                placeholder={t('doctor_instructions_placeholder', 'مثال: شرب سوائل دافئة، الراحة التامة، العودة للاستشارة بعد أسبوع')}
                className="h-10 text-xs rounded-xl bg-background border-border text-foreground"
              />
            </div>
          </div>

          {/* Medicines Prescription Section */}
          <div className="yalla-card p-5 space-y-4 border border-border">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                {t('rx_medications', 'الأدوية والعلاج المطلوب (Rx)')}
              </h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => addDrug()}
                className="h-8 text-xs font-bold border-primary text-primary hover:bg-primary/10 rounded-lg gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                {t('add_new_drug', 'إضافة دواء جديد')}
              </Button>
            </div>

            {/* Quick Favorites Bar & Drug Search */}
            {isDrugsDbEnabled ? (
              <>
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-muted-foreground">{t('most_frequent_drugs', 'الأدوية الأكثر تكراراً:')}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {favoriteDrugs.map((fav, i) => (
                      <button
                        key={i}
                        onClick={() => addDrug(fav, language === 'en' ? '1 tablet q12h' : 'قرص كل 12 ساعة', language === 'en' ? 'for 5 days' : 'لمدة 5 أيام')}
                        className="px-2.5 py-1 text-[11px] font-bold bg-secondary hover:bg-primary/10 text-foreground hover:text-primary rounded-lg transition-colors cursor-pointer"
                      >
                        + {fav}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Drug Search Input */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute end-3 top-3 text-muted-foreground pointer-events-none" />
                  <Input
                    value={drugSearch}
                    onChange={e => setDrugSearch(e.target.value)}
                    placeholder={t('search_egyptian_drugs', 'ابحث في قاعدة الأدوية المصرية...')}
                    className="h-10 pe-9 text-xs rounded-xl bg-background border-border text-foreground"
                  />
                  {filteredSearchDrugs.length > 0 && (
                    <div className="absolute top-full start-0 w-full mt-1 bg-card border border-border shadow-xl rounded-xl z-50 overflow-hidden divide-y divide-border">
                      {filteredSearchDrugs.map((d, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            addDrug(d, language === 'en' ? '1 tablet q12h' : 'قرص كل 12 ساعة', language === 'en' ? 'for 5 days' : 'لمدة 5 أيام')
                            setDrugSearch('')
                          }}
                          className="w-full text-start p-2.5 text-xs font-bold text-foreground hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
                        >
                          + {d}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-800 dark:text-amber-400 flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>{language === 'en' ? 'Egyptian Drug Database is not activated on your current subscription plan. You can type medication names and dosages manually below.' : 'دليل وقاعدة الأدوية المصرية غير مفعلة في باقة اشتراكك الحالية. يمكنك كتابة أسماء الأدوية والجرعات يدوياً بالأسفل.'}</span>
              </div>
            )}

            {/* Drugs List Rows */}
            <div className="space-y-3 pt-2">
              {drugs.map((drug, index) => (
                <div
                  key={drug.id}
                  className="p-3.5 rounded-xl border border-border bg-secondary/30 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-muted-foreground">{t('drug_num', 'دواء')} #{index + 1}</span>
                    <button
                      onClick={() => removeDrug(drug.id)}
                      className="text-muted-foreground hover:text-rose-500 transition-colors cursor-pointer"
                      title={t('delete', 'حذف')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid sm:grid-cols-12 gap-2">
                    <div className="sm:col-span-5">
                      <Input
                        value={drug.name}
                        onChange={e => updateDrug(drug.id, 'name', e.target.value)}
                        placeholder={t('trade_drug_name', 'اسم الدواء التجاري')}
                        className="h-9 text-xs rounded-lg bg-background border-border text-foreground"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <Input
                        value={drug.dosage}
                        onChange={e => updateDrug(drug.id, 'dosage', e.target.value)}
                        placeholder={t('dosage_label', 'الجرعة (مثال: قرص كل 12 ساعة)')}
                        className="h-9 text-xs rounded-lg bg-background border-border text-foreground"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <Input
                        value={drug.duration}
                        onChange={e => updateDrug(drug.id, 'duration', e.target.value)}
                        placeholder={t('duration_label', 'المدة (مثال: 5 أيام)')}
                        className="h-9 text-xs rounded-lg bg-background border-border text-foreground"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Accent Color Customizer */}
          <div className="yalla-card p-4 space-y-3 border border-border">
            <h4 className="font-bold text-xs text-foreground flex items-center gap-1.5">
              <Palette className="w-4 h-4 text-primary" />
              {t('rx_color_customizer', 'تخصيص ألوان وتصميم الروشتة (Live Color Accents)')}
            </h4>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <Label className="text-[11px] font-bold text-muted-foreground block mb-1">{t('primary_header_color', 'اللون الرئيسي للترويسة')}</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={e => setPrimaryColor(e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer border border-border"
                  />
                  <span className="font-mono text-muted-foreground text-xs">{primaryColor}</span>
                </div>
              </div>
              <div>
                <Label className="text-[11px] font-bold text-muted-foreground block mb-1">{t('secondary_color', 'اللون الثانوي والخطوط')}</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={e => setSecondaryColor(e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer border border-border"
                  />
                  <span className="font-mono text-muted-foreground text-xs">{secondaryColor}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* LEFT COLUMN: Live A4 Prescription Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          
          {/* Template & Paper Size Designer Controls */}
          <div className="p-3.5 yalla-card rounded-2xl border border-border space-y-3 shadow-2xs">
            {/* Row 1: Option A vs Option B */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-border">
              <span className="text-xs font-black text-foreground">{t('rx_template', 'قالب الروشتة:')}</span>
              <div className="flex items-center gap-1.5 bg-secondary p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setTemplateMode('standard')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    templateMode === 'standard'
                      ? 'bg-card text-primary shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t('template_luxury_b', 'Option B (النموذج الفاخر)')}
                </button>
                {isCustomTemplateEnabled ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (!clinic?.prescriptionTemplateUrl) {
                        toast.info(language === 'en' ? 'No custom prescription design uploaded for this clinic yet from Owner Dashboard' : 'لم يتم رفع تصميم روشتة مخصص لهذه العيادة من لوحة المالك بعد')
                      } else {
                        setTemplateMode('custom')
                      }
                    }}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      templateMode === 'custom'
                        ? 'bg-card text-primary shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t('template_clinic_a', 'Option A (تصميم العيادة)')} {clinic?.prescriptionTemplateUrl && '✓'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      toast.error(language === 'en' ? 'Custom template (Option A) is locked in your plan. Please upgrade to unlock.' : 'ميزة قالب الروشتة المخصص (Option A) مقفولة في باقة اشتراكك الحالية. يرجى الترقية لتفعيلها.')
                    }}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-not-allowed opacity-60 flex items-center gap-1 text-muted-foreground bg-secondary/50"
                    title={language === 'en' ? 'Feature locked on your plan' : 'ميزة مقفولة في باقتك الحالية'}
                  >
                    <Lock className="w-3 h-3 text-amber-600" />
                    {language === 'en' ? 'Option A (Locked)' : 'Option A (مقفول)'}
                  </button>
                )}
              </div>
            </div>

            {/* Row 2: Paper Size A4 vs A5 */}
            <div className="flex items-center justify-between text-xs pb-2.5 border-b border-border">
              <span className="font-bold text-foreground">{t('paper_size', 'مقاس الورق:')}</span>
              <div className="flex items-center gap-1.5 bg-secondary p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setPageSize('a4')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    pageSize === 'a4'
                      ? 'bg-card text-primary shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t('paper_a4', 'A4 (ورق كامل)')}
                </button>
                <button
                  type="button"
                  onClick={() => setPageSize('a5')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    pageSize === 'a5'
                      ? 'bg-card text-primary shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t('paper_a5', 'A5 (نصف ورقة)')}
                </button>
              </div>
            </div>

            {/* Row 3: Printing Toggles */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-muted-foreground select-none">
                <input
                  type="checkbox"
                  checked={showHeaderFooter}
                  onChange={(e) => setShowHeaderFooter(e.target.checked)}
                  className="rounded text-primary focus:ring-primary"
                />
                <span>{t('show_header_footer', 'إظهار الترويسة والفوتر (تعطيل للورق الجاهز)')}</span>
              </label>

              {templateMode === 'custom' && (
                <label className="flex items-center gap-2 cursor-pointer font-bold text-muted-foreground select-none">
                  <input
                    type="checkbox"
                    checked={printBackground}
                    onChange={(e) => setPrintBackground(e.target.checked)}
                    className="rounded text-primary focus:ring-primary"
                  />
                  <span>{t('print_bg_image', 'طباعة صورة الخلفية (تفعيل للـ PDF)')}</span>
                </label>
              )}
            </div>

            {/* Custom Template Top Offset Slider */}
            {templateMode === 'custom' && clinic?.prescriptionTemplateUrl && (
              <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium text-[11px]">{t('top_offset', 'إزاحة البداية من أعلى:')}</span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="5"
                    max="55"
                    step="1"
                    value={topOffset}
                    onChange={e => setTopOffset(Number(e.target.value))}
                    className="w-28 accent-primary"
                  />
                  <span className="font-mono text-[11px] text-primary font-bold">{topOffset}%</span>
                </div>
              </div>
            )}
          </div>

          {/* Render High-Fidelity Prescription Sheet (Live Preview) */}
          <div ref={sheetRef} className="overflow-hidden rounded-2xl shadow-xl border border-border">
            <A4Prescription
              clinic={clinic}
              patientName={patientName || t('patient_name', 'اسم المريض')}
              age={age ? String(age) : ''}
              date={dateStr}
              diagnosis={diagnosis}
              drugs={drugs.filter(d => d.name && d.name.trim() !== '')}
              instructions={instructions}
              templateMode={templateMode}
              topOffset={topOffset}
              primaryColor={primaryColor}
              secondaryColor={secondaryColor}
              branchName={selectedBranchName || clinic?.branchName}
              pageSize={pageSize}
              showHeaderFooter={showHeaderFooter}
              printBackground={printBackground}
            />
          </div>
        </div>

      </div>
    </div>
  )
}
