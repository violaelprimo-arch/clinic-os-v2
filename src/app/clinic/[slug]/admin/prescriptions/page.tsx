'use client'

import { use, useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Plus, Printer, Trash2, Search, FileSignature, MapPin,
  Phone, User as UserIcon, Star, Check, MessageCircle,
  FileText, ShieldCheck, ChevronDown, Sparkles
} from 'lucide-react'
import { toast } from 'sonner'
import { db } from '@/lib/firebase'
import { collection, addDoc, query, where, getDocs, doc, updateDoc, onSnapshot } from 'firebase/firestore'
import { useSearchParams } from 'next/navigation'
import { EGYPTIAN_DRUGS, STRUCTURED_DRUGS } from '@/lib/egyptian-drugs'
import { ClinicLogo } from '@/components/clinic/ClinicLogo'
import { A4Prescription } from '@/components/clinic/A4Prescription'

export default function PrescriptionsPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug
  const searchParams = useSearchParams()

  const [patientName, setPatientName] = useState(searchParams?.get('patientName') || '')
  const [patientPhone, setPatientPhone] = useState(searchParams?.get('patientPhone') || '')
  const [diagnosis, setDiagnosis] = useState('')
  const [age, setAge] = useState('28')

  const [drugs, setDrugs] = useState<any[]>([
    { id: 1, name: searchParams?.get('drug') || '', dosage: '', duration: '' }
  ])

  const [drugSearch, setDrugSearch] = useState('')
  const [favoriteDrugs, setFavoriteDrugs] = useState<string[]>([
    'Augmentin 1g', 'Catafast 50 mg', 'Panadol 500 mg', 'Brufen 600 mg', 'Controloc 40 mg', 'Alphintern'
  ])
  const [clinicId, setClinicId] = useState<string | null>(null)
  const [clinic, setClinic] = useState<any>(null)
  const [templateMode, setTemplateMode] = useState<'standard' | 'custom'>('standard')
  const [topOffset, setTopOffset] = useState<number>(140)
  const [isSaving, setIsSaving] = useState(false)
  const [todayPatients, setTodayPatients] = useState<any[]>([])
  const dateStr = new Date().toISOString().split('T')[0]

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
        } else if (slug === 'demo') {
          setClinic({
            id: 'demo',
            clinicName: 'العيادة التخصصية',
            doctorName: 'الطبيب',
            specialty: 'استشاري الطب الباطني والجهاز الهضمي',
            clinicAddress: 'شارع التسعين الشمالي، التجمع الخامس، القاهرة',
            clinicPhone: '01012345678'
          })
        }
      },
      (err) => {
        console.error(err)
      }
    )

    return () => unsubClinic()
  }, [slug, dateStr])

  const addDrug = (name = '', dosage = '', duration = '') => {
    setDrugs([...drugs, { id: Date.now(), name, dosage, duration }])
  }

  const removeDrug = (id: number) => {
    if (drugs.length === 1) {
      setDrugs([{ id: Date.now(), name: '', dosage: '', duration: '' }])
      return
    }
    setDrugs(drugs.filter(d => d.id !== id))
  }

  const updateDrug = (id: number, field: string, value: string) => {
    setDrugs(drugs.map(d => d.id === id ? { ...d, [field]: value } : d))
  }

  const handleSave = async () => {
    if (!patientName.trim()) return toast.error('يرجى إدخال اسم المريض')
    if (!patientPhone.trim()) return toast.error('يرجى إدخال رقم هاتف المريض للربط بملفه')

    setIsSaving(true)
    try {
      if (clinicId) {
        await addDoc(collection(db, 'prescriptions'), {
          clinic_id: clinicId,
          patientName,
          patientPhone,
          age,
          diagnosis,
          date: dateStr,
          drugs: drugs.filter(d => d.name.trim() !== ''),
          createdAt: new Date().toISOString()
        })
      }
      toast.success('تم حفظ الروشتة وإضافتها لملف المريض بنجاح')
    } catch (error) {
      toast.error('حدث خطأ أثناء حفظ الروشتة')
    } finally {
      setIsSaving(false)
    }
  }

  const sendWhatsAppRx = () => {
    if (!patientPhone) return toast.error('يرجى إدخال رقم هاتف المريض')
    let formattedPhone = patientPhone.replace(/[^0-9]/g, '')
    if (formattedPhone.startsWith('0')) formattedPhone = '2' + formattedPhone

    const drugsList = drugs
      .filter(d => d.name)
      .map((d, i) => `${i + 1}. ${d.name} (${d.dosage} - ${d.duration})`)
      .join('\n')

    const message = encodeURIComponent(
      `الروشتة الطبية الإلكترونية 📋\nالعيادة: ${clinic?.clinicName || 'العيادة'}\nالمريض: ${patientName}\nالتاريخ: ${dateStr}\n\nالعلاج المطلوب:\n${drugsList}\n\nنتمنى لك الشفاء العاجل!`
    )
    window.open(`https://wa.me/${formattedPhone}?text=${message}`, '_blank')
  }

  // Filtered drugs for quick search
  const filteredSearchDrugs = useMemo(() => {
    if (!drugSearch.trim()) return []
    const queryTerm = drugSearch.toLowerCase()
    return EGYPTIAN_DRUGS.filter(d => d.toLowerCase().includes(queryTerm)).slice(0, 8)
  }, [drugSearch])

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto" dir="rtl">
      
      {/* 1. Header Toolbar (Hidden on Print) */}
      <div className="print:hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-[#E5EAF0] shadow-xs">
        <div>
          <h1 className="text-2xl font-black text-[#182230] flex items-center gap-2">
            <FileSignature className="w-6 h-6 text-[#15B8A6]" />
            إصدار روشتة طبية
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            تعبئة بيانات الكشف والأدوية مع معاينة فورية وتنسيق طباعة معتمد
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            onClick={sendWhatsAppRx}
            variant="outline"
            className="h-10 text-xs font-bold text-emerald-600 border-emerald-200 hover:bg-emerald-50 rounded-xl"
          >
            <MessageCircle className="w-4 h-4 ml-1.5" />
            إرسال واتساب
          </Button>

          <Button
            onClick={() => window.print()}
            variant="outline"
            className="h-10 text-xs font-bold border-[#15B8A6] text-[#15B8A6] hover:bg-teal-50 rounded-xl"
          >
            <Printer className="w-4 h-4 ml-1.5" />
            طباعة الروشتة
          </Button>

          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="h-10 px-5 text-xs font-bold bg-[#15B8A6] hover:bg-[#0D9488] text-white rounded-xl shadow-md shadow-[#15B8A6]/20"
          >
            {isSaving ? 'جاري الحفظ...' : 'حفظ في الملف'}
          </Button>
        </div>
      </div>

      {/* 2. Main Two-Column Layout (Form Editor on right, A4 Preview on left) */}
      <div className="grid lg:grid-cols-12 gap-6 items-start">
        
        {/* RIGHT COLUMN: Form Editor (7 cols) - Hidden on Print */}
        <div className="lg:col-span-7 space-y-5 print:hidden">
          
          {/* Patient Details Card */}
          <div className="medical-card p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5EAF0]">
              <h3 className="font-bold text-sm text-[#182230] flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-[#15B8A6]" />
                بيانات المريض
              </h3>

              {todayPatients.length > 0 && (
                <select
                  className="text-xs font-bold border border-[#E5EAF0] rounded-xl px-2.5 py-1.5 bg-slate-50 text-slate-700"
                  onChange={(e) => {
                    const selected = todayPatients.find(p => p.id === e.target.value)
                    if (selected) {
                      setPatientName(selected.patientName || '')
                      setPatientPhone(selected.phone || '')
                    }
                  }}
                >
                  <option value="">-- اختر من كشوفات اليوم --</option>
                  {todayPatients.map(p => (
                    <option key={p.id} value={p.id}>
                      #{p.queue_number} - {p.patientName}
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
                  placeholder="المريض"
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
                  placeholder="28 سنة"
                  className="h-10 text-xs rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-600">التشخيص الطبي</Label>
              <Input
                value={diagnosis}
                onChange={e => setDiagnosis(e.target.value)}
                placeholder="مثال: التهاب اللوزتين الحاد"
                className="h-10 text-xs rounded-xl"
              />
            </div>
          </div>

          {/* Medicines Prescription Form */}
          <div className="medical-card p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5EAF0]">
              <h3 className="font-bold text-sm text-[#182230] flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#15B8A6]" />
                الأدوية والجرعات (R)
              </h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => addDrug()}
                className="h-8 text-xs font-bold text-[#15B8A6] border-teal-200 hover:bg-teal-50 rounded-xl"
              >
                <Plus className="w-3.5 h-3.5 ml-1" />
                إضافة دواء آخر
              </Button>
            </div>

            {/* Quick Favorites Bar */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-400">أدوية شائعة لسرعة الإضافة:</span>
              <div className="flex flex-wrap gap-1.5">
                {favoriteDrugs.map((fav, i) => (
                  <button
                    key={i}
                    onClick={() => addDrug(fav, 'قرص كل 12 ساعة', 'لمدة 5 أيام')}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-teal-50 hover:text-[#15B8A6] border border-slate-200 transition-colors"
                  >
                    + {fav}
                  </button>
                ))}
              </div>
            </div>

            {/* Drug Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={drugSearch}
                onChange={e => setDrugSearch(e.target.value)}
                placeholder="ابحث عن اسم الدواء في الدليل..."
                className="pr-10 h-10 text-xs bg-[#F6F8FB] rounded-xl focus:bg-white"
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

            {/* Medicines List Rows */}
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
                        placeholder="اسم الدواء"
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
        </div>

        {/* LEFT COLUMN: Realistic A4 Prescription Sheet Preview (5 cols on screen, full on print) */}
        <div className="lg:col-span-5 print:w-full print:block space-y-3">
          
          {/* Template Switcher Bar (Hidden on print) */}
          <div className="print:hidden p-3 bg-white rounded-xl border border-[#E5EAF0] space-y-2 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">قالب ورقة الروشتة:</span>
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
                  القالب القياسي
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
                <span className="font-medium text-[11px]">إزاحة البداية من أعلى (لهامش الترويسة):</span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="60"
                    max="280"
                    step="10"
                    value={topOffset}
                    onChange={e => setTopOffset(Number(e.target.value))}
                    className="w-24 accent-[#15B8A6]"
                  />
                  <span className="font-mono text-[11px] text-[#15B8A6] font-bold">{topOffset}px</span>
                </div>
              </div>
            )}
          </div>

          {/* Print CSS Exact Colors */}
          <style dangerouslySetInnerHTML={{ __html: '@media print { * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }' }} />

          {/* Actual Sheet */}
          <div
            className="medical-card bg-white p-6 sm:p-8 space-y-6 shadow-lg border border-[#E5EAF0] relative min-h-[620px] flex flex-col justify-between rounded-2xl print:shadow-none print:border-none print:p-8"
            style={
              templateMode === 'custom' && clinic?.prescriptionTemplateUrl
                ? {
                    backgroundImage: `url("${clinic.prescriptionTemplateUrl}")`,
                    backgroundSize: '100% 100%',
                    backgroundPosition: 'top center',
                    backgroundRepeat: 'no-repeat',
                    paddingTop: `${topOffset}px`,
                  }
                : undefined
            }
          >
            
            {/* Top Sheet Header (Only in Standard Mode) */}
            <div>
              {templateMode === 'standard' && (
                <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
                  <div>
                    <h2 className="text-xl font-black text-[#182230]">
                      {clinic?.doctorName ? `د. ${clinic.doctorName}` : 'د. الطبيب'}
                    </h2>
                    <p className="text-xs font-bold text-[#15B8A6] mt-0.5">
                      {clinic?.specialty || 'استشاري الطب الباطني والجهاز الهضمي'}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      عضو الجمعية الطبية المصرية
                    </p>
                  </div>

                  <div className="text-left flex flex-col items-end">
                    <ClinicLogo size="sm" variant="light" showSubtitle={false} />
                    <span className="text-[10px] font-bold text-slate-400 mt-1 font-mono">
                      {clinic?.clinicName || 'Clinic OS'}
                    </span>
                  </div>
                </div>
              )}

              {/* Patient Meta Strip */}
              <div
                className={`flex items-center justify-between py-2.5 text-xs font-bold rounded-lg ${
                  templateMode === 'custom'
                    ? 'bg-white/85 backdrop-blur-2xs border border-slate-200/80 px-3 shadow-2xs mt-1'
                    : 'bg-slate-50/70 border-b border-slate-200 text-slate-700 px-3 mt-3'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">الاسم:</span>
                  <span className="text-[#182230]">{patientName || '................................'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">السن:</span>
                  <span className="text-[#182230]">{age || '28'} سنة</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">التاريخ:</span>
                  <span className="font-mono text-[#182230]">{dateStr}</span>
                </div>
              </div>

              {/* Diagnosis if any */}
              {diagnosis && (
                <div className="mt-2.5 text-xs text-slate-600 font-semibold px-1 flex items-baseline gap-1.5 bg-white/70 backdrop-blur-2xs py-1 rounded">
                  <span className="text-slate-400 font-bold">التشخيص:</span>
                  <span className="text-[#182230] font-bold">{diagnosis}</span>
                </div>
              )}

              {/* The Iconic Rx/ Symbol */}
              <div className="pt-4 pb-2 text-left" dir="ltr">
                <span className="text-3xl font-black font-serif text-[#182230] tracking-wider select-none">R/</span>
              </div>

              {/* Medicines List */}
              <div className="space-y-4 pl-3 min-h-[220px]" dir="ltr">
                {drugs.filter(d => d.name.trim()).map((drug, index) => (
                  <div key={index} className="space-y-0.5 bg-white/60 backdrop-blur-2xs p-1.5 rounded-lg">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-black text-[#15B8A6]">{index + 1}.</span>
                      <h4 className="font-black text-sm text-[#182230] tracking-wide font-sans text-left">
                        {drug.name}
                      </h4>
                    </div>
                    <p className="text-xs text-slate-700 font-medium pl-5 text-right" dir="rtl">
                      {drug.dosage} {drug.duration ? `— ${drug.duration}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Sheet Footer */}
            {templateMode === 'standard' ? (
              <div className="pt-6 border-t border-slate-200 space-y-4">
                <div className="flex justify-between items-end">
                  <div className="text-[10px] text-slate-400 space-y-0.5">
                    <p className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-[#15B8A6]" />
                      {clinic?.clinicAddress || 'شارع التسعين الشمالي، التجمع الخامس، القاهرة'}
                    </p>
                    <p className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-[#15B8A6]" />
                      {clinic?.clinicPhone || '01012345678'}
                    </p>
                  </div>

                  {/* Signature Simulation Line */}
                  <div className="text-center">
                    <div className="w-28 border-b-2 border-slate-400 pb-1 italic font-serif text-slate-500 text-xs">
                      {clinic?.doctorName ? `د. ${clinic.doctorName}` : 'د. الطبيب'}
                    </div>
                    <span className="text-[9px] text-slate-400 font-bold">توقيع وختم الطبيب</span>
                  </div>
                </div>
              </div>
            ) : (
              /* Minimal Doctor Signature Line for Custom Pre-printed letterhead */
              <div className="pt-4 flex justify-end items-end">
                <div className="text-center">
                  <div className="w-28 border-b-2 border-slate-700 pb-1 italic font-serif text-slate-800 text-xs font-bold">
                    {clinic?.doctorName ? `د. ${clinic.doctorName}` : ''}
                  </div>
                  <span className="text-[9px] text-slate-500 font-bold">توقيع الطبيب</span>
                </div>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  )
}
