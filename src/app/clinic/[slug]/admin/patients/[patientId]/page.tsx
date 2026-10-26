'use client'

import { ResidentialAreaSelector, ResidentialAreaValue } from '@/components/common/ResidentialAreaSelector'

import { use, useEffect, useState, useRef } from 'react'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, updateDoc, doc, onSnapshot } from 'firebase/firestore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Clock, Phone, ArrowRight, User, Calendar, Pill, DollarSign, Printer, Activity, ChevronDown, ChevronUp, Stethoscope, CheckCircle, Save, MessageCircle, FileText, Download, MapPin } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { A4Prescription } from '@/components/clinic/A4Prescription'
import { downloadElementAsPdf, renderElementToPdfBlob, renderElementToImageBlob } from '@/lib/pdfGenerator'
import { printHtmlViaIframe, generateA4PrescriptionHtml } from '@/lib/printService'
import { sharePdfDocument, generateCleanRxFileName, formatPrescriptionWhatsAppMessage, openManualWhatsAppChat, getSavedWhatsAppTarget } from '@/lib/whatsappShare'
import { WhatsAppShareButton } from '@/components/common/WhatsAppShareButton'
import { getClinicUrl } from '@/lib/clinic-url'
import { useLanguage } from '@/context/LanguageContext'

export default function PatientProfilePage({
 params }: { params: Promise<{ slug: string, patientId: string }> }) {
  const resolvedParams = use(params)
  const { slug, patientId } = resolvedParams
  const { t, dir } = useLanguage()

  const [sharingApptId, setSharingApptId] = useState<string | null>(null)
  const [downloadingApptId, setDownloadingApptId] = useState<string | null>(null)

  const handlePrintRx = (appt: any) => {
    const pName = patientData?.name || appt?.patientName || 'المريض'
    const pAge = patientData?.age || appt?.age || patientData?.dob || appt?.dob || ''
    const html = generateA4PrescriptionHtml({
      clinicName: clinic?.clinicName || 'العيادة الطبية',
      doctorName: clinic?.doctorName,
      specialty: clinic?.specialty,
      certificationTitle: clinic?.certificationTitle,
      clinicPhone: clinic?.clinicPhone,
      clinicAddress: clinic?.clinicAddress,
      primaryColor: clinic?.primaryColor || '#087CF4',
      logoUrl: clinic?.logoUrl,
      patientName: pName,
      patientAge: pAge,
      date: appt.date,
      diagnosis: appt.diagnosis,
      instructions: appt.instructions,
      notes: appt.notes,
      vitalSigns: appt.vitalSigns,
      drugs: appt.drugs || [],
      prescriptionTemplateUrl: clinic?.prescriptionTemplateUrl,
      templateMode: appt.prescription_templateMode || appt.templateMode || (clinic?.prescriptionTemplateUrl ? 'custom' : 'standard'),
      showHeaderFooter: true,
      printBackground: true
    })
    printHtmlViaIframe(html, 'a4')
  }

  const handleDownloadRxPdf = async (appt: any) => {
    const rxElement = document.getElementById(`rx-sheet-${appt.id}`)
    if (!rxElement) return
    setDownloadingApptId(appt.id)
    try {
      const pName = patientData?.name || appt?.patientName || 'المريض'
      const fileName = generateCleanRxFileName(pName, appt.date, 'pdf')
      await downloadElementAsPdf(
        rxElement,
        fileName,
        { format: 'a4', orientation: 'portrait' }
      )
      toast.success(`تم تحميل ملف الروشتة PDF (${fileName}) بنجاح`)
    } catch (e) {
      toast.error('حدث خطأ أثناء تحميل الروشتة')
    } finally {
      setDownloadingApptId(null)
    }
  }

  const sendWhatsAppRx = async (appt: any, targetOverride?: 'web' | 'app') => {
    if (!phone) return toast.error('يرجى إدخال رقم هاتف المريض')
    setSharingApptId(appt.id)

    try {
      const pName = patientData?.name || appt?.patientName || 'المريض'
      const pAge = patientData?.age || appt?.age || patientData?.dob || appt?.dob || ''
      const cleanFileName = generateCleanRxFileName(pName, appt.date, 'pdf')

      const host = typeof window !== 'undefined' && window.location.origin
        ? window.location.origin
        : 'https://www.yalla-clinic.com'
      const directRxUrl = `${host}/clinic/${slug}/prescription/${appt.id}`

      const message = formatPrescriptionWhatsAppMessage({
        clinicName: clinic?.clinicName || 'العيادة الطبية',
        doctorName: clinic?.doctorName,
        specialty: clinic?.specialty,
        patientName: pName,
        patientAge: pAge,
        date: appt.date,
        diagnosis: appt.diagnosis,
        drugs: appt.drugs || [],
        directRxUrl
      })

      const targetMode = targetOverride || getSavedWhatsAppTarget()
      const rxElement = document.getElementById(`rx-sheet-${appt.id}`)

      // Open WhatsApp chat synchronously in 0ms (Zero popup blocker, opens exact phone, puts Rx in chat!)
      openManualWhatsAppChat({
        phone,
        message,
        target: targetMode
      })

      toast.success(`تم فتح محادثة المريض (${phone}) وإدراج الروشتة في الشات! اضغط Enter للإرسال 🚀`, { duration: 5000 })

      // 3. Desktop Clipboard image copy for Ctrl+V paste (strictly WITHOUT auto-downloading to computer)
      if (rxElement) {
        if (typeof navigator !== 'undefined' && navigator.clipboard && window.ClipboardItem) {
          renderElementToImageBlob(rxElement, { scale: 2.5 }).then(async ({ blob: imgBlob }) => {
            try {
              await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': imgBlob })
              ])
            } catch {}
          }).catch(() => {})
        }

        toast.success(`✅ تم إرفاق رابط الـ PDF الرسمي بالرسالة! يمكنك أيضاً الضغط على (Ctrl + V) لإرسال صورة الروشتة فوراً 🚀`, {
          duration: 6000
        })
      }
    } catch (err) {
      console.error(err)
      toast.error('تعذر مشاركة الروشتة عبر واتساب')
    } finally {
      setSharingApptId(null)
    }
  }

  const phone = decodeURIComponent(patientId)

  const [appointments, setAppointments] = useState<any[]>([])
  const [patientData, setPatientData] = useState<any>({ name: 'جاري التحميل...', age: '', dob: '' })
  const [loading, setLoading] = useState(true)
  const [expandedVisitId, setExpandedVisitId] = useState<string | null>(null)
  const [editingDiagnosisFor, setEditingDiagnosisFor] = useState<string | null>(null)
  const [tempDiagnosis, setTempDiagnosis] = useState('')
  const [clinic, setClinic] = useState<any>(null)
  const [isEditResidenceOpen, setIsEditResidenceOpen] = useState(false)
  const [editResidenceValue, setEditResidenceValue] = useState<ResidentialAreaValue | null>(null)
  const [isSavingResidence, setIsSavingResidence] = useState(false)

  // Vital Signs State
  const [editingVitalsFor, setEditingVitalsFor] = useState<string | null>(null)
  const [vitalsBpSys, setVitalsBpSys] = useState<string>('')
  const [vitalsBpDia, setVitalsBpDia] = useState<string>('')
  const [vitalsPulse, setVitalsPulse] = useState<string>('')
  const [vitalsTemp, setVitalsTemp] = useState<string>('')
  const [vitalsGlucose, setVitalsGlucose] = useState<string>('')
  const [vitalsWeight, setVitalsWeight] = useState<string>('')
  const [isSavingVitals, setIsSavingVitals] = useState(false)

  const handleOpenEditVitals = (appt: any) => {
    setEditingVitalsFor(appt.id)
    setVitalsBpSys(appt.vitalSigns?.bloodPressureSystolic ? String(appt.vitalSigns.bloodPressureSystolic) : '')
    setVitalsBpDia(appt.vitalSigns?.bloodPressureDiastolic ? String(appt.vitalSigns.bloodPressureDiastolic) : '')
    setVitalsPulse(appt.vitalSigns?.heartRate ? String(appt.vitalSigns.heartRate) : '')
    setVitalsTemp(appt.vitalSigns?.temperature ? String(appt.vitalSigns.temperature) : '')
    setVitalsGlucose(appt.vitalSigns?.glucoseLevel ? String(appt.vitalSigns.glucoseLevel) : '')
    setVitalsWeight(appt.vitalSigns?.weightKg ? String(appt.vitalSigns.weightKg) : '')
  }

  const handleSaveVitals = async (apptId: string) => {
    setIsSavingVitals(true)
    try {
      const hasAny = vitalsBpSys.trim() || vitalsBpDia.trim() || vitalsPulse.trim() || vitalsTemp.trim() || vitalsGlucose.trim() || vitalsWeight.trim()
      await updateDoc(doc(db, 'appointments', apptId), {
        vitalSigns: hasAny ? {
          bloodPressureSystolic: vitalsBpSys ? Number(vitalsBpSys) || vitalsBpSys : null,
          bloodPressureDiastolic: vitalsBpDia ? Number(vitalsBpDia) || vitalsBpDia : null,
          heartRate: vitalsPulse ? Number(vitalsPulse) || vitalsPulse : null,
          temperature: vitalsTemp ? Number(vitalsTemp) || vitalsTemp : null,
          glucoseLevel: vitalsGlucose ? Number(vitalsGlucose) || vitalsGlucose : null,
          weightKg: vitalsWeight ? Number(vitalsWeight) || vitalsWeight : null,
          recordedAt: new Date().toISOString()
        } : null
      })
      toast.success(hasAny ? 'تم حفظ العلامات الحيوية بنجاح' : 'تم إزالة العلامات الحيوية وإخفاؤها من الملف')
      setEditingVitalsFor(null)
    } catch (err) {
      toast.error('حدث خطأ أثناء حفظ العلامات الحيوية')
    } finally {
      setIsSavingVitals(false)
    }
  }

  useEffect(() => {
    let unsub: any = null
    const load = async () => {
      try {
        const qClinic = query(collection(db, 'clinics'), where('slug', '==', slug))
        const cSnap = await getDocs(qClinic)
        if (!cSnap.empty) {
          setClinic({ id: cSnap.docs[0].id, ...cSnap.docs[0].data() })
        }

        const qAppt = query(collection(db, 'appointments'), where('phone', '==', phone))
        unsub = onSnapshot(qAppt, (snap) => {
          if (!snap.empty) {
            const appts = snap.docs
              .map(d => ({ id: d.id, ...d.data() } as any))
              .sort((a: any, b: any) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime())
            setAppointments(appts)

            const latest = appts[0]
            setPatientData({
              name: latest.patientName || 'مريض بدون اسم',
              age: latest.age || '',
              dob: latest.dob || '',
              phone: latest.phone || phone,
              residence: latest.patientResidenceSnapshot || latest.residence || null
            })
          } else {
            setAppointments([])
            setPatientData({
              name: 'سجل جديد',
              age: '',
              dob: '',
              phone
            })
          }
          setLoading(false)
        })
      } catch (err) {
        console.error('Error loading patient profile:', err)
        setLoading(false)
      }
    }

    load()
    return () => {
      if (unsub) unsub()
    }
  }, [slug, phone])


  const handleSaveProfileResidence = async () => {
    if (appointments.length === 0) return
    setIsSavingResidence(true)
    try {
      const latestAppt = appointments[0]
      await updateDoc(doc(db, 'appointments', latestAppt.id), {
        address: editResidenceValue?.areaNameAr || null,
        city: editResidenceValue?.cityNameAr || editResidenceValue?.governorateNameAr || null,
        patientResidenceSnapshot: editResidenceValue?.governorateId ? {
          governorateId: editResidenceValue.governorateId,
          governorateNameAr: editResidenceValue.governorateNameAr || '',
          governorateNameEn: editResidenceValue.governorateNameEn || '',
          cityId: editResidenceValue.cityId || '',
          cityNameAr: editResidenceValue.cityNameAr || '',
          cityNameEn: editResidenceValue.cityNameEn || '',
          areaId: editResidenceValue.areaId || '',
          areaNameAr: editResidenceValue.areaNameAr || '',
          areaNameEn: editResidenceValue.areaNameEn || '',
          customAreaName: editResidenceValue.customAreaName || null,
          source: 'staff_override',
          recordedAt: new Date().toISOString()
        } : null
      })

      setPatientData((prev: any) => ({
        ...prev,
        residence: editResidenceValue
      }))

      toast.success('تم حفظ وتحديث منطقة السكن للمريض بنجاح')
      setIsEditResidenceOpen(false)
    } catch (e) {
      console.error(e)
      toast.error('حدث خطأ أثناء حفظ منطقة السكن')
    } finally {
      setIsSavingResidence(false)
    }
  }

  const handleSaveDiagnosis = async (apptId: string) => {
    try {
      await updateDoc(doc(db, 'appointments', apptId), { diagnosis: tempDiagnosis })
      setEditingDiagnosisFor(null)
      toast.success('تم حفظ التشخيص بنجاح')
    } catch (error) {
      toast.error('حدث خطأ أثناء الحفظ')
    }
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground font-bold" dir={dir}>جاري تحميل الملف الطبي...</div>

  return (
    <div className="max-w-5xl mx-auto space-y-6 print:hidden" dir={dir}>
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/clinic/${slug}/admin/patients`}>
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl border-border text-foreground hover:bg-secondary">
            <ArrowRight className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-black text-foreground">الملف الطبي الشامل</h1>
          <p className="text-sm text-muted-foreground font-medium">سجل المريض وتاريخ الزيارات</p>
        </div>
      </div>

      {/* Patient Basic Info */}
      <div className="yalla-card p-6 border border-border">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="w-24 h-24 rounded-3xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <User className="w-10 h-10" />
          </div>
          <div className="flex-1 text-center md:text-right space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-foreground">{patientData.name}</h2>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mt-2">
                  <span className="flex items-center gap-1.5 text-sm font-bold text-muted-foreground">
                    <Phone className="w-4 h-4 text-muted-foreground/60" />
                    <span dir="ltr">{patientData.phone}</span>
                  </span>
                  {(patientData.age || patientData.dob) && (
                    <span className="flex items-center gap-1.5 text-sm font-bold text-muted-foreground">
                      <Calendar className="w-4 h-4 text-muted-foreground/60" />
                      <span>{patientData.age ? `${patientData.age} سنة` : patientData.dob}</span>
                    </span>
                  )}
                </div>

                {/* Residential Area */}
                <div className="flex items-center justify-center md:justify-start gap-2 flex-wrap mt-2">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground bg-secondary/60 px-3 py-1 rounded-xl">
                    <MapPin className="w-3.5 h-3.5 text-primary" />
                    <span>
                      {patientData.residence?.governorateNameAr
                        ? `${patientData.residence.governorateNameAr} - ${patientData.residence.areaNameAr || patientData.residence.cityNameAr}`
                        : 'منطقة السكن: غير مسجلة'}
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditResidenceValue(patientData.residence)
                      setIsEditResidenceOpen(true)
                    }}
                    className="h-7 text-xs font-bold text-primary hover:bg-primary/10 rounded-lg px-2 cursor-pointer"
                  >
                    {patientData.residence?.governorateNameAr ? 'تعديل السكن' : 'استكمال منطقة السكن'}
                  </Button>
                </div>
              </div>
              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold px-4 py-2 text-sm rounded-xl">
                مريض نشط
              </Badge>
            </div>
            <div className="flex items-center gap-6 pt-2">
              <div className="space-y-1">
                <p className="text-xs font-bold text-muted-foreground">إجمالي الزيارات</p>
                <p className="text-xl font-black text-foreground">{appointments.length}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-muted-foreground">آخر زيارة</p>
                <p className="text-sm font-bold text-primary">{appointments[0]?.date || 'لا يوجد'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Unified Visits Record */}
      <div className="space-y-4">
        <h3 className="font-black text-lg text-foreground flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          السجل التاريخي للزيارات
        </h3>
        
        {appointments.length === 0 ? (
          <div className="p-8 text-center border-2 border-dashed border-border rounded-3xl yalla-card">
            <p className="text-muted-foreground font-bold text-sm">لا يوجد سجل تاريخي لهذا المريض.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {appointments.map((appt, idx) => {
              const isExpanded = expandedVisitId === appt.id;
              
              return (
                <div key={appt.id} className={`yalla-card border transition-all duration-300 ${isExpanded ? 'border-primary shadow-md' : 'border-border hover:border-primary/40'}`}>
                  
                  {/* Visit Header (Clickable) */}
                  <div 
                    onClick={() => setExpandedVisitId(isExpanded ? null : appt.id)}
                    className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black transition-colors ${isExpanded ? 'yalla-gradient-btn text-white' : 'bg-secondary text-foreground'}`}>
                        #{appointments.length - idx}
                      </div>
                      <div>
                        <h4 className="font-bold text-base text-foreground flex items-center gap-2">
                          {appt.serviceName || 'كشف طبي'}
                          {appt.status === 'completed' && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                        </h4>
                        <p className="text-sm text-muted-foreground font-mono mt-0.5">{appt.date}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 self-end sm:self-center">
                      {appt.paymentStatus === 'paid' ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold">دفع: {appt.servicePrice} {t('currency_egp', 'ج.م')}</Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-500/20 bg-amber-500/10 font-bold">مستحق: {appt.servicePrice} {t('currency_egp', 'ج.م')}</Badge>
                      )}
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                    </div>
                  </div>

                  {/* Visit Details (Expanded) */}
                  {isExpanded && (
                    <div className="border-t border-border bg-secondary/20 p-5 space-y-6 rounded-b-2xl">
                      
                      {/* 0. Vital Signs Section (العلامات الحيوية - يحدد الطبيب كتابتها ولو لم تسجل تختفي تماماً) */}
                      {(appt.vitalSigns && (appt.vitalSigns.bloodPressureSystolic || appt.vitalSigns.bloodPressureDiastolic || appt.vitalSigns.heartRate || appt.vitalSigns.temperature || appt.vitalSigns.glucoseLevel || appt.vitalSigns.weightKg) || editingVitalsFor === appt.id) ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h5 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                              <Activity className="w-4 h-4 text-rose-500" />
                              العلامات الحيوية (Vital Signs)
                            </h5>
                            {editingVitalsFor !== appt.id && (
                              <Button
                                variant="link"
                                onClick={() => handleOpenEditVitals(appt)}
                                className="h-auto p-0 text-xs text-primary font-bold"
                              >
                                تعديل القياسات
                              </Button>
                            )}
                          </div>

                          {editingVitalsFor === appt.id ? (
                            <div className="bg-card p-4 rounded-xl border border-border space-y-3 shadow-2xs">
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                <div className="space-y-1">
                                  <label className="text-[11px] font-bold text-muted-foreground">ضغط الدم الانقباضي (SYS)</label>
                                  <Input
                                    value={vitalsBpSys}
                                    onChange={e => setVitalsBpSys(e.target.value)}
                                    placeholder="120"
                                    className="h-9 text-xs bg-background border-border text-foreground"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[11px] font-bold text-muted-foreground">ضغط الدم الانبساطي (DIA)</label>
                                  <Input
                                    value={vitalsBpDia}
                                    onChange={e => setVitalsBpDia(e.target.value)}
                                    placeholder="80"
                                    className="h-9 text-xs bg-background border-border text-foreground"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[11px] font-bold text-muted-foreground">النبض (HR bpm)</label>
                                  <Input
                                    value={vitalsPulse}
                                    onChange={e => setVitalsPulse(e.target.value)}
                                    placeholder="75"
                                    className="h-9 text-xs bg-background border-border text-foreground"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[11px] font-bold text-muted-foreground">درجة الحرارة (°C)</label>
                                  <Input
                                    value={vitalsTemp}
                                    onChange={e => setVitalsTemp(e.target.value)}
                                    placeholder="37.0"
                                    className="h-9 text-xs bg-background border-border text-foreground"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[11px] font-bold text-muted-foreground">مستوى السكر (mg/dL)</label>
                                  <Input
                                    value={vitalsGlucose}
                                    onChange={e => setVitalsGlucose(e.target.value)}
                                    placeholder="100"
                                    className="h-9 text-xs bg-background border-border text-foreground"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[11px] font-bold text-muted-foreground">الوزن (kg)</label>
                                  <Input
                                    value={vitalsWeight}
                                    onChange={e => setVitalsWeight(e.target.value)}
                                    placeholder="70"
                                    className="h-9 text-xs bg-background border-border text-foreground"
                                  />
                                </div>
                              </div>
                              <div className="flex gap-2 pt-2 border-t border-border">
                                <Button
                                  onClick={() => handleSaveVitals(appt.id)}
                                  disabled={isSavingVitals}
                                  className="yalla-gradient-btn text-white text-xs h-8 font-bold"
                                >
                                  {isSavingVitals ? 'جاري الحفظ...' : 'حفظ القياسات'}
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => setEditingVitalsFor(null)}
                                  className="text-xs h-8 font-bold border-border"
                                >
                                  إلغاء
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-card p-4 rounded-xl border border-border">
                              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                                {(appt.vitalSigns.bloodPressureSystolic || appt.vitalSigns.bloodPressureDiastolic) && (
                                  <div className="p-2 rounded-lg bg-secondary/50 border border-border">
                                    <span className="text-[10px] text-muted-foreground font-bold block">ضغط الدم</span>
                                    <span className="text-xs font-black text-foreground">
                                      {appt.vitalSigns.bloodPressureSystolic || '--'}/{appt.vitalSigns.bloodPressureDiastolic || '--'}
                                    </span>
                                    <span className="text-[9px] text-muted-foreground block">mmHg</span>
                                  </div>
                                )}
                                {appt.vitalSigns.heartRate && (
                                  <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                                    <span className="text-[10px] text-rose-500 font-bold block">النبض</span>
                                    <span className="text-xs font-black text-rose-700 dark:text-rose-400">{appt.vitalSigns.heartRate}</span>
                                    <span className="text-[9px] text-rose-400 block">bpm</span>
                                  </div>
                                )}
                                {appt.vitalSigns.temperature && (
                                  <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                    <span className="text-[10px] text-amber-500 font-bold block">الحرارة</span>
                                    <span className="text-xs font-black text-amber-700 dark:text-amber-400">{appt.vitalSigns.temperature}</span>
                                    <span className="text-[9px] text-amber-400 block">°C</span>
                                  </div>
                                )}
                                {appt.vitalSigns.glucoseLevel && (
                                  <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                                    <span className="text-[10px] text-primary font-bold block">السكر</span>
                                    <span className="text-xs font-black text-primary">{appt.vitalSigns.glucoseLevel}</span>
                                    <span className="text-[9px] text-primary/60 block">mg/dL</span>
                                  </div>
                                )}
                                {appt.vitalSigns.weightKg && (
                                  <div className="p-2 rounded-lg bg-teal-500/10 border border-teal-500/20">
                                    <span className="text-[10px] text-teal-600 dark:text-teal-400 font-bold block">الوزن</span>
                                    <span className="text-xs font-black text-teal-800 dark:text-teal-300">{appt.vitalSigns.weightKg}</span>
                                    <span className="text-[9px] text-teal-500 block">kg</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex justify-end -mt-1 -mb-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEditVitals(appt)}
                            className="text-[11px] font-bold text-muted-foreground hover:text-rose-600 transition-colors flex items-center gap-1.5 cursor-pointer py-1 px-2.5 rounded-lg hover:bg-rose-50/50"
                          >
                            <Activity className="w-3.5 h-3.5 text-rose-500" />
                            <span>+ تسجيل علامات حيوية لهذه الزيارة</span>
                          </button>
                        </div>
                      )}

                      {/* 1. Diagnosis Section */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h5 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                            <Stethoscope className="w-4 h-4 text-primary" />
                            التشخيص والملاحظات
                          </h5>
                          {editingDiagnosisFor !== appt.id && (
                            <Button variant="link" onClick={() => { setEditingDiagnosisFor(appt.id); setTempDiagnosis(appt.diagnosis || ''); }} className="h-auto p-0 text-xs text-primary font-bold">
                              {appt.diagnosis ? 'تعديل التشخيص' : 'إضافة تشخيص'}
                            </Button>
                          )}
                        </div>

                        {editingDiagnosisFor === appt.id ? (
                          <div className="space-y-2">
                            <Input 
                              value={tempDiagnosis}
                              onChange={e => setTempDiagnosis(e.target.value)}
                              placeholder="اكتب التشخيص هنا..."
                              className="bg-background border-border text-foreground"
                            />
                            <div className="flex gap-2">
                              <Button onClick={() => handleSaveDiagnosis(appt.id)} className="yalla-gradient-btn text-white text-xs h-8">حفظ</Button>
                              <Button variant="outline" onClick={() => setEditingDiagnosisFor(null)} className="text-xs h-8 border-border">إلغاء</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-card p-4 rounded-xl border border-border text-sm text-foreground space-y-2">
                            <div>
                              {appt.diagnosis ? appt.diagnosis : <span className="text-muted-foreground italic">لا يوجد تشخيص مسجل لهذه الزيارة.</span>}
                            </div>
                            {appt.notes && (
                              <div className="pt-2 border-t border-border text-xs text-sky-800 dark:text-sky-300 bg-sky-50/50 dark:bg-sky-950/20 p-2.5 rounded-lg flex items-start gap-1.5">
                                <span className="font-bold shrink-0">ملاحظات الطبيب:</span>
                                <span className="whitespace-pre-wrap">{appt.notes}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 2. Prescription Section */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h5 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                            <Pill className="w-4 h-4 text-primary" />
                            الروشتة الدوائية
                          </h5>
                          <div className="flex items-center gap-2">
                            <Link href={`/clinic/${slug}/admin/prescriptions?appointmentId=${appt.id}&phone=${phone}&patientName=${patientData?.name}&age=${patientData?.age || patientData?.dob}`}>
                              <Button variant="outline" size="sm" className="h-8 text-xs font-bold border-border text-primary hover:bg-primary/10">
                                {appt.drugs ? 'تعديل الروشتة' : 'كتابة روشتة جديدة'}
                              </Button>
                            </Link>
                          </div>
                        </div>

                        {appt.drugs && appt.drugs.length > 0 ? (
                          <Dialog>
                            <DialogTrigger>
                              <Button variant="outline" className="w-full h-12 bg-primary/10 border-primary/20 text-primary hover:bg-primary/20 font-bold">
                                <FileText className="w-4 h-4 ml-2" />
                                عرض الروشتة وإرسالها
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-card border border-border print:max-w-none print:w-full print:h-auto print:max-h-none print:overflow-visible print:border-none print:shadow-none print:bg-transparent print:p-0 print:m-0" dir={dir}>
                              <DialogHeader className="print:hidden">
                                <DialogTitle className="text-foreground">الروشتة الطبية - {appt.date}</DialogTitle>
                              </DialogHeader>
                              <div className="flex flex-wrap items-center gap-2 mb-4 print:hidden">
                                <Button
                                  onClick={() => handlePrintRx(appt)}
                                  className="h-9 px-3.5 text-xs font-bold yalla-gradient-btn text-white rounded-xl shadow-xs"
                                >
                                  <Printer className="w-4 h-4 ml-1.5" />
                                  طباعة الروشتة A4
                                </Button>
                                <Button
                                  onClick={() => handleDownloadRxPdf(appt)}
                                  disabled={downloadingApptId === appt.id}
                                  variant="outline"
                                  className="h-9 px-3.5 text-xs font-bold border-border text-foreground hover:bg-secondary rounded-xl"
                                >
                                  <Download className="w-4 h-4 ml-1.5" />
                                  {downloadingApptId === appt.id ? 'جاري التحميل...' : 'تحميل الروشتة PDF'}
                                </Button>
                                <WhatsAppShareButton
                                  onSend={(target) => sendWhatsAppRx(appt, target)}
                                  phone={phone}
                                  loading={sharingApptId === appt.id}
                                  label={sharingApptId === appt.id ? 'جاري الفتح...' : 'إرسال واتساب للمريض'}
                                  size="sm"
                                  showPhoneBadge={false}
                                />
                                <Link href={`/clinic/${slug}/admin/prescriptions?appointmentId=${appt.id}&phone=${phone}&patientName=${patientData.name}&age=${patientData.age || patientData.dob}`}>
                                  <Button variant="outline" className="h-9 px-3.5 text-xs font-bold rounded-xl border-border">
                                    تعديل الروشتة
                                  </Button>
                                </Link>
                              </div>
                              <div id={`rx-sheet-${appt.id}`} className="bg-white rounded-xl border border-border overflow-hidden print:overflow-visible print:border-0 print:m-0 print:p-0 print:w-[100vw] print:h-[100vh]">
                                <A4Prescription 
                                  clinic={clinic}
                                  patientName={patientData?.name || appt?.patientName || 'المريض'}
                                  age={patientData?.age || appt?.age || patientData?.dob || appt?.dob || ''}
                                  date={appt.date}
                                  diagnosis={appt.diagnosis}
                                  instructions={appt.instructions}
                                  notes={appt.notes}
                                  vitalSigns={appt.vitalSigns}
                                  drugs={appt.drugs}
                                  templateMode={appt.prescription_templateMode || appt.templateMode || (clinic?.prescriptionTemplateUrl ? 'custom' : 'standard')}
                                  topOffset={25}
                                />
                              </div>
                            </DialogContent>
                          </Dialog>
                        ) : (
                          <div className="bg-card p-4 rounded-xl border border-border text-sm text-muted-foreground italic">
                            لم يتم صرف روشتة لهذه الزيارة.
                          </div>
                        )}
                      </div>

                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Quick Modal: Complete / Edit Patient Residence */}
      <Dialog open={isEditResidenceOpen} onOpenChange={setIsEditResidenceOpen}>
        <DialogContent className="sm:max-w-lg bg-card border border-border" dir={dir}>
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              <span>استكمال وتعديل منطقة السكن للمريض</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="p-3 rounded-2xl bg-secondary/40 border border-border/80 text-xs">
              <p className="font-bold text-foreground">{patientData.name}</p>
              <p className="text-muted-foreground font-mono mt-0.5" dir="ltr">{phone}</p>
            </div>

            <ResidentialAreaSelector
              value={editResidenceValue}
              onChange={setEditResidenceValue}
              showLocationButton={false}
              compact={false}
              defaultSource="staff_override"
            />

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditResidenceOpen(false)}
                className="rounded-xl"
              >
                إلغاء
              </Button>
              <Button
                type="button"
                onClick={handleSaveProfileResidence}
                disabled={isSavingResidence}
                className="yalla-gradient-btn text-white rounded-xl"
              >
                {isSavingResidence ? 'جاري الحفظ...' : 'حفظ منطقة السكن'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}
