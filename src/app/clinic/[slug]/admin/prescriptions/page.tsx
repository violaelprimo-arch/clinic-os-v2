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
  FileText, ShieldCheck, ChevronDown, Sparkles, Download, Palette
} from 'lucide-react'
import { toast } from 'sonner'
import { db } from '@/lib/firebase'
import { collection, addDoc, query, where, getDocs, doc, updateDoc, onSnapshot } from 'firebase/firestore'
import { useSearchParams } from 'next/navigation'
import { EGYPTIAN_DRUGS } from '@/lib/egyptian-drugs'
import { useEgyptianDrugs } from '@/hooks/useEgyptianDrugs'
import { ClinicLogo } from '@/components/clinic/ClinicLogo'
import { A4Prescription } from '@/components/clinic/A4Prescription'
import { printHtmlViaIframe, generateA4PrescriptionHtml } from '@/lib/printService'
import { renderElementToPdfBlob, downloadElementAsPdf } from '@/lib/pdfGenerator'
import { sharePdfDocument } from '@/lib/whatsappShare'

export default function PrescriptionsPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug
  const searchParams = useSearchParams()

  const [appointmentId, setAppointmentId] = useState(searchParams?.get('appointmentId') || '')
  const [patientName, setPatientName] = useState(searchParams?.get('patientName') || '')
  const [patientPhone, setPatientPhone] = useState(searchParams?.get('phone') || searchParams?.get('patientPhone') || '')
  const [diagnosis, setDiagnosis] = useState('')
  const [age, setAge] = useState(searchParams?.get('age') || '')
  const [instructions, setInstructions] = useState('')
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [selectedBranchName, setSelectedBranchName] = useState('')

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
  const [topOffset, setTopOffset] = useState<number>(25)
  const [primaryColor, setPrimaryColor] = useState('#0f766e')
  const [secondaryColor, setSecondaryColor] = useState('#14b8a6')

  const [isSaving, setIsSaving] = useState(false)
  const [isSharingPdf, setIsSharingPdf] = useState(false)
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)
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
          if (data.prescriptionTemplateUrl) {
            setTemplateMode('custom')
          }
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

        toast.success('تم حفظ واعتماد الروشتة في الملف الطبي بنجاح!')
      }
    } catch (error) {
      toast.error('حدث خطأ أثناء حفظ الروشتة')
    } finally {
      setIsSaving(false)
    }
  }

  // TASK 6: Staff-initiated Manual WhatsApp sharing with REAL PDF Document
  const handleShareWhatsAppPdf = async () => {
    if (!patientPhone) return toast.error('يرجى إدخال رقم هاتف المريض')
    if (!sheetRef.current) return toast.error('تعذر الوصول لنموذج الروشتة')

    setIsSharingPdf(true)
    try {
      toast.info('جاري إنشاء ملف PDF ومشاركته...')
      const { blob } = await renderElementToPdfBlob(sheetRef.current, { format: 'a4', orientation: 'portrait' })

      const fileName = `روشتة_${patientName || 'المريض'}_${dateStr}.pdf`
      const message = `مرحباً ${patientName}،\nمرفق الروشتة الطبية المعتمدة من عيادة ${clinic?.clinicName || 'العيادة'}.\nتاريخ الزيارة: ${dateStr}\nنتمنى لكم دوام الصحة والعافية.`

      await sharePdfDocument({
        pdfBlob: blob,
        fileName,
        recipientPhone: patientPhone,
        messageText: message,
        documentTitle: 'الروشتة الطبية الإلكترونية'
      })
    } catch (e) {
      toast.error('تعذر مشاركة ملف الروشتة')
    } finally {
      setIsSharingPdf(false)
    }
  }

  // Real PDF Download
  const handleDownloadPdf = async () => {
    if (!sheetRef.current) return
    setIsDownloadingPdf(true)
    try {
      await downloadElementAsPdf(
        sheetRef.current,
        `روشتة_${patientName || 'المريض'}_${dateStr}.pdf`,
        { format: 'a4', orientation: 'portrait' }
      )
      toast.success('تم تنزيل الروشتة بصيغة PDF بنجاح')
    } catch (e) {
      toast.error('تعذر تنزيل ملف الروشتة')
    } finally {
      setIsDownloadingPdf(false)
    }
  }

  // Clean Isolated Print via iframe
  const handlePrint = () => {
    const html = generateA4PrescriptionHtml({
      clinicName: clinic?.clinicName || 'Clinic OS',
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
      secondaryColor
    })
    printHtmlViaIframe(html, 'a4')
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
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto" dir="rtl">
      
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-[#E5EAF0] shadow-xs">
        <div>
          <h1 className="text-2xl font-black text-[#182230] flex items-center gap-2">
            <FileSignature className="w-6 h-6 text-[#15B8A6]" />
            إصدار روشتة طبية (A4 Premium)
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            تعبئة بيانات الكشف والأدوية مع معاينة فورية وتصدير PDF أصلي
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* TASK 6: Manual WhatsApp Share with Real PDF */}
          <Button
            onClick={handleShareWhatsAppPdf}
            disabled={isSharingPdf}
            variant="outline"
            className="h-10 text-xs font-bold text-emerald-600 border-emerald-200 hover:bg-emerald-50 rounded-xl"
          >
            <MessageCircle className="w-4 h-4 ml-1.5" />
            {isSharingPdf ? 'جاري المشاركة...' : 'إرسال PDF واتساب'}
          </Button>

          {/* Real PDF Download */}
          <Button
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            variant="outline"
            className="h-10 text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl"
          >
            <Download className="w-4 h-4 ml-1.5" />
            {isDownloadingPdf ? 'جاري التحميل...' : 'تحميل PDF'}
          </Button>

          {/* Clean Isolated Print */}
          <Button
            onClick={handlePrint}
            variant="outline"
            className="h-10 text-xs font-bold border-[#15B8A6] text-[#15B8A6] hover:bg-teal-50 rounded-xl"
          >
            <Printer className="w-4 h-4 ml-1.5" />
            طباعة A4
          </Button>

          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="h-10 px-5 text-xs font-bold bg-[#15B8A6] hover:bg-[#0D9488] text-white rounded-xl shadow-md shadow-[#15B8A6]/20"
          >
            {isSaving ? 'جاري الحفظ...' : 'اعتماد وحفظ بالملف'}
          </Button>
        </div>
      </div>

      {/* 2. Main Two-Column Layout */}
      <div className="grid lg:grid-cols-12 gap-6 items-start">
        
        {/* RIGHT COLUMN: Form Editor (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          
          {/* Patient Details Card */}
          <div className="medical-card p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5EAF0]">
              <h3 className="font-bold text-sm text-[#182230] flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-[#15B8A6]" />
                بيانات المريض والزيارة
              </h3>

              {todayPatients.length > 0 && (
                <select
                  className="text-xs font-bold border border-[#E5EAF0] rounded-xl px-2.5 py-1.5 bg-slate-50 text-slate-700"
                  onChange={(e) => {
                    const selected = todayPatients.find(p => p.id === e.target.value)
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
                  <option value="">-- اختر من كشوفات اليوم --</option>
                  {todayPatients.map(p => (
                    <option key={p.id} value={p.id}>
                      #{p.queue_number} - {p.patientName} {p.branchName ? `(${p.branchName})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1 space-y-1">
                <Label className="text-xs font-bold text-slate-600">اسم المريض</Label>
                <Input
                  value={patientName}
                  onChange={e => setPatientName(e.target.value)}
                  placeholder="اسم المريض"
                  className="h-10 text-xs rounded-xl"
                />
              </div>

              <div className="sm:col-span-1 space-y-1">
                <Label className="text-xs font-bold text-slate-600">رقم الهاتف</Label>
                <Input
                  value={patientPhone}
                  onChange={e => setPatientPhone(e.target.value)}
                  placeholder="01xxxxxxxxx"
                  className="h-10 text-xs font-mono text-right rounded-xl"
                  dir="ltr"
                />
              </div>

              <div className="sm:col-span-1 space-y-1">
                <Label className="text-xs font-bold text-slate-600">السن</Label>
                <Input
                  value={age}
                  onChange={e => setAge(e.target.value)}
                  placeholder="مثال: 32 سنة"
                  className="h-10 text-xs rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-600">التشخيص الطبي</Label>
              <Input
                value={diagnosis}
                onChange={e => setDiagnosis(e.target.value)}
                placeholder="التشخيص الإكلينيكي للحالة"
                className="h-10 text-xs rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-600">تعليمات وإرشادات الطبيب للمريض</Label>
              <Input
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                placeholder="مثال: شرب سوائل دافئة، الراحة التامة، العودة للاستشارة بعد أسبوع"
                className="h-10 text-xs rounded-xl"
              />
            </div>
          </div>

          {/* Medicines Prescription Section */}
          <div className="medical-card p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5EAF0]">
              <h3 className="font-bold text-sm text-[#182230] flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#15B8A6]" />
                الأدوية والعلاج المطلوب (Rx)
              </h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => addDrug()}
                className="h-8 text-xs font-bold border-[#15B8A6] text-[#15B8A6] hover:bg-teal-50 rounded-lg"
              >
                <Plus className="w-3.5 h-3.5 ml-1" />
                إضافة دواء جديد
              </Button>
            </div>

            {/* Quick Favorites Bar */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-400">الأدوية الأكثر تكراراً:</span>
              <div className="flex flex-wrap gap-1.5">
                {favoriteDrugs.map((fav, i) => (
                  <button
                    key={i}
                    onClick={() => addDrug(fav, 'قرص كل 12 ساعة', 'لمدة 5 أيام')}
                    className="px-2.5 py-1 text-[11px] font-bold bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-[#15B8A6] rounded-lg transition-colors"
                  >
                    + {fav}
                  </button>
                ))}
              </div>
            </div>

            {/* Drug Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
              <Input
                value={drugSearch}
                onChange={e => setDrugSearch(e.target.value)}
                placeholder="ابحث في قاعدة الأدوية المصرية..."
                className="h-10 pr-9 text-xs rounded-xl"
              />
              {filteredSearchDrugs.length > 0 && (
                <div className="absolute top-full right-0 w-full mt-1 bg-white border border-[#E5EAF0] shadow-xl rounded-xl z-50 overflow-hidden divide-y divide-slate-100">
                  {filteredSearchDrugs.map((d, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        addDrug(d, 'قرص كل 12 ساعة', 'لمدة 5 أيام')
                        setDrugSearch('')
                      }}
                      className="w-full text-right p-2.5 text-xs font-bold text-slate-700 hover:bg-teal-50 hover:text-[#15B8A6] transition-colors"
                    >
                      + {d}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Drugs List Rows */}
            <div className="space-y-3 pt-2">
              {drugs.map((drug, index) => (
                <div
                  key={drug.id}
                  className="p-3.5 rounded-xl border border-[#E5EAF0] bg-slate-50/50 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-500">دواء #{index + 1}</span>
                    <button
                      onClick={() => removeDrug(drug.id)}
                      className="text-slate-400 hover:text-rose-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid sm:grid-cols-12 gap-2">
                    <div className="sm:col-span-5">
                      <Input
                        value={drug.name}
                        onChange={e => updateDrug(drug.id, 'name', e.target.value)}
                        placeholder="اسم الدواء التجاري"
                        className="h-9 text-xs rounded-lg bg-white"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <Input
                        value={drug.dosage}
                        onChange={e => updateDrug(drug.id, 'dosage', e.target.value)}
                        placeholder="الجرعة (مثال: قرص كل 12 ساعة)"
                        className="h-9 text-xs rounded-lg bg-white"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <Input
                        value={drug.duration}
                        onChange={e => updateDrug(drug.id, 'duration', e.target.value)}
                        placeholder="المدة (مثال: 5 أيام)"
                        className="h-9 text-xs rounded-lg bg-white"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* TASK 8: Accent Color Customizer */}
          <div className="medical-card p-4 space-y-3">
            <h4 className="font-bold text-xs text-slate-700 flex items-center gap-1.5">
              <Palette className="w-4 h-4 text-[#15B8A6]" />
              تخصيص ألوان وتصميم الروشتة (Live Color Accents)
            </h4>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <Label className="text-[11px] font-bold text-slate-500 block mb-1">اللون الرئيسي للترويسة</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={e => setPrimaryColor(e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer border border-slate-200"
                  />
                  <span className="font-mono text-slate-600 text-xs">{primaryColor}</span>
                </div>
              </div>
              <div>
                <Label className="text-[11px] font-bold text-slate-500 block mb-1">اللون الثانوي والخطوط</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={e => setSecondaryColor(e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer border border-slate-200"
                  />
                  <span className="font-mono text-slate-600 text-xs">{secondaryColor}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* LEFT COLUMN: Live A4 Prescription Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          
          {/* Template Switcher Bar */}
          <div className="p-3 bg-white rounded-xl border border-[#E5EAF0] space-y-2 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">نمط ورقة الروشتة:</span>
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setTemplateMode('standard')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    templateMode === 'standard'
                      ? 'bg-white text-[#15B8A6] shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  القالب الفاخر المعياري
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!clinic?.prescriptionTemplateUrl) {
                      toast.info('لم يتم رفع تصميم روشتة مخصص لهذه العيادة من لوحة المالك بعد')
                    } else {
                      setTemplateMode('custom')
                    }
                  }}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    templateMode === 'custom'
                      ? 'bg-white text-[#15B8A6] shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  تصميم العيادة المخصص {clinic?.prescriptionTemplateUrl && '✓'}
                </button>
              </div>
            </div>

            {templateMode === 'custom' && clinic?.prescriptionTemplateUrl && (
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="font-medium text-[11px]">إزاحة البداية من أعلى:</span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="5"
                    max="55"
                    step="1"
                    value={topOffset}
                    onChange={e => setTopOffset(Number(e.target.value))}
                    className="w-28 accent-[#15B8A6]"
                  />
                  <span className="font-mono text-[11px] text-[#15B8A6] font-bold">{topOffset}%</span>
                </div>
              </div>
            )}
          </div>

          {/* Render High-Fidelity A4 Sheet */}
          <div ref={sheetRef} className="overflow-hidden rounded-2xl shadow-xl">
            <A4Prescription
              clinic={clinic}
              patientName={patientName || 'اسم المريض'}
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
            />
          </div>
        </div>

      </div>
    </div>
  )
}
