'use client'

import React, { useState, useRef } from 'react'
import {
  FileSignature,
  Plus,
  Trash2,
  Printer,
  Download,
  Save,
  Search,
  Sparkles,
  Pill,
  CheckCircle2,
  FileText,
  User,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { DemoPrescriptionDrug } from './types'
import { DemoClinicHookReturn } from './useDemoClinic'
import { A4Prescription } from '@/components/clinic/A4Prescription'
import { generateA4PrescriptionHtml, printHtmlViaIframe } from '@/lib/printService'
import { useLanguage } from '@/context/LanguageContext'

interface DemoPrescriptionViewProps {
  demo: DemoClinicHookReturn
  initialPatientName?: string
}

const COMMON_DRUGS_SUGGESTIONS = [
  { name: 'Systane Ultra Eye Drops', dosage: 'نقطة 3 مرات يومياً', duration: 'شهر', notes: 'ترطيب عميق' },
  { name: 'Tobradex Eye Drops', dosage: 'نقطة مرتين يومياً', duration: '7 أيام', notes: 'مضاد حيوي وكورتيزون' },
  { name: 'Refresh Tears Eye Drops', dosage: 'نقطة عند اللزوم', duration: 'مستمر', notes: 'بديل دموع' },
  { name: 'Nevanac 0.1% Eye Drops', dosage: 'نقطة مرتين يومياً', duration: '5 أيام', notes: 'مسكن ومضاد التهاب' },
  { name: 'Pataday 0.2% Eye Drops', dosage: 'نقطة واحدة صباحاً', duration: 'أسبوعين', notes: 'حساسية العين' },
  { name: 'Cataflam 50mg Tablets', dosage: 'قرص بعد الأكل مرتين', duration: '3 أيام', notes: 'مسكن للألم' },
  { name: 'Augmentin 1g Tablets', dosage: 'قرص كل 12 ساعة', duration: '7 أيام', notes: 'مضاد حيوي واسع المجال' },
  { name: 'Panadol Extra Tablets', dosage: 'قرصين عند اللزوم', duration: 'عند الحاجة', notes: 'مسكن وخافض للحرارة' },
]

const DIAGNOSIS_PRESETS = [
  'جفاف القرنية المزمن وإجهاد بصري رقمي',
  'التهاب الملتحمة التحسسي الموسمي',
  'فحص قاع عين طبيعي ومقاس نظارة جديد',
  'متابعة بعد عملية الفيمتو ليزك واستقرار القرنية',
  'ارتفاع ضغط العين ومتابعة العصب البصري',
]

export function DemoPrescriptionView({
  demo,
  initialPatientName,
}: DemoPrescriptionViewProps) {
  const { isRtl } = useLanguage()
  const copy = (ar: string, en: string) => (isRtl ? ar : en)
  const prescriptionRef = useRef<HTMLDivElement>(null)

  // Select patient
  const defaultPatient =
    demo.patients.find((p) => p.name === initialPatientName) ||
    (demo.currentInExam
      ? demo.patients.find((p) => p.id === demo.currentInExam?.patientId)
      : null) ||
    demo.patients[0]

  const [selectedPatientId, setSelectedPatientId] = useState<string>(
    defaultPatient?.id || demo.patients[0]?.id || 'pat-1',
  )

  const activePatient =
    demo.patients.find((p) => p.id === selectedPatientId) || demo.patients[0]

  const [diagnosis, setDiagnosis] = useState(
    'جفاف القرنية المزمن وإجهاد بصري ناتج عن الشاشات',
  )
  const [instructions, setInstructions] = useState(
    'استخدام قطرات الترطيب بانتظام، وأخذ فترات راحة كل 20 دقيقة أمام شاشة الحاسوب.',
  )

  const [drugs, setDrugs] = useState<DemoPrescriptionDrug[]>([
    {
      name: 'Systane Ultra Eye Drops',
      dosage: 'نقطة واحدة في كل عين 3 مرات يومياً',
      duration: 'لمدة شهر',
      notes: 'خالية من المواد الحافظة',
    },
    {
      name: 'Nevanac 0.1% Eye Drops',
      dosage: 'نقطة واحدة مرتين يومياً',
      duration: '5 أيام فقط',
      notes: 'لتهدئة تهيج العين والسطح الخارجي',
    },
  ])

  // New drug input state
  const [newDrugName, setNewDrugName] = useState('')
  const [newDrugDosage, setNewDrugDosage] = useState('')
  const [newDrugDuration, setNewDrugDuration] = useState('')
  const [newDrugNotes, setNewDrugNotes] = useState('')

  const handleAddDrug = () => {
    if (!newDrugName.trim()) {
      toast.error(copy('يرجى كتابة اسم الدواء', 'Please enter medication name'))
      return
    }

    setDrugs((prev) => [
      ...prev,
      {
        name: newDrugName.trim(),
        dosage: newDrugDosage.trim() || 'نقطة واحدة 3 مرات يومياً',
        duration: newDrugDuration.trim() || 'أسبوع',
        notes: newDrugNotes.trim(),
      },
    ])

    setNewDrugName('')
    setNewDrugDosage('')
    setNewDrugDuration('')
    setNewDrugNotes('')
    toast.success(copy('تمت إضافة الدواء للروشتة', 'Medication added to prescription'))
  }

  const handleRemoveDrug = (index: number) => {
    setDrugs((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSaveToPatient = () => {
    demo.savePrescription({
      patientId: activePatient.id,
      patientName: activePatient.name,
      age: activePatient.age,
      date: '2026-10-26',
      diagnosis,
      instructions,
      drugs,
    })
    toast.success(
      copy(
        `تم حفظ الروشتة في ملف المريض (${activePatient.name}) بنجاح! 🗂️`,
        `Prescription saved to (${activePatient.name})'s medical record! 🗂️`,
      ),
    )
  }

  const handlePrint = () => {
    const printData = {
      doctorName: demo.clinicInfo.doctorName,
      clinicName: demo.clinicInfo.clinicName,
      specialty: demo.clinicInfo.specialty,
      phone: demo.clinicInfo.phone,
      address: demo.clinicInfo.address,
      patientName: activePatient.name,
      age: activePatient.age,
      date: '2026-10-26',
      diagnosis,
      instructions,
      drugs,
      primaryColor: demo.clinicInfo.primaryColor,
      secondaryColor: '#087CF4',
    }

    try {
      const html = generateA4PrescriptionHtml(printData)
      printHtmlViaIframe(html, 'a4')
      toast.success(copy('جاري فتح معاينة الطباعة للروشتة 🖨️', 'Opening print preview 🖨️'))
    } catch {
      window.print()
    }
  }

  const handleDownloadPdf = () => {
    // Generate clean printable HTML and download as .html / printable file
    const printData = {
      doctorName: demo.clinicInfo.doctorName,
      clinicName: demo.clinicInfo.clinicName,
      specialty: demo.clinicInfo.specialty,
      phone: demo.clinicInfo.phone,
      address: demo.clinicInfo.address,
      patientName: activePatient.name,
      age: activePatient.age,
      date: '2026-10-26',
      diagnosis,
      instructions,
      drugs,
      primaryColor: demo.clinicInfo.primaryColor,
      secondaryColor: '#087CF4',
    }

    const html = generateA4PrescriptionHtml(printData)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Prescription-${activePatient.name}-2026-10-26.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success(
      copy(
        'تم تنزيل نسخة الروشتة بنجاح! يمكنك فتحها أو طباعتها مباشرة 📄',
        'Prescription downloaded successfully! You can view or print it 📄',
      ),
    )
  }

  // Clinic mock object for A4Prescription component
  const clinicMock = {
    clinicName: demo.clinicInfo.clinicName,
    doctorName: demo.clinicInfo.doctorName,
    specialty: demo.clinicInfo.specialty,
    phone: demo.clinicInfo.phone,
    clinicPhone: demo.clinicInfo.phone,
    address: demo.clinicInfo.address,
    clinicAddress: demo.clinicInfo.address,
    primaryColor: demo.clinicInfo.primaryColor,
    secondaryColor: '#087CF4',
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-black text-foreground">
            {copy('منظومة الروشتة الإلكترونية الذكية', 'Smart Digital Prescription')}
          </h3>
          <p className="text-xs text-muted-foreground">
            {copy(
              'اكتب التشخيص والأدوية مع معاينة حية لقالب الروشتة A4 وطباعتها بضغطة زر',
              'Enter diagnosis and medications with live A4 preview and 1-click printing',
            )}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={handleSaveToPatient}
            className="gap-1.5 rounded-xl bg-emerald-600 font-bold text-white hover:bg-emerald-500 shadow-sm"
          >
            <Save className="size-3.5" />
            <span>{copy('حفظ في الملف الطبي', 'Save to Record')}</span>
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handlePrint}
            className="gap-1.5 rounded-xl border-border font-bold hover:bg-muted"
          >
            <Printer className="size-3.5" />
            <span>{copy('طباعة الروشتة', 'Print A4')}</span>
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleDownloadPdf}
            className="gap-1.5 rounded-xl border-border font-bold hover:bg-muted"
          >
            <Download className="size-3.5" />
            <span>{copy('تحميل PDF تجريبي', 'Download Demo')}</span>
          </Button>
        </div>
      </div>

      {/* Main Grid: Form on Left/Right & Live A4 Preview on Other Side */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Editor Form (5 cols) */}
        <div className="space-y-4 lg:col-span-5">
          {/* Patient Selector */}
          <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm space-y-2">
            <label className="text-xs font-bold text-foreground">
              {copy('المريض المستهدف:', 'Select Patient:')}
            </label>
            <select
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              {demo.patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.age} سنة) - {p.phone}
                </option>
              ))}
            </select>
          </div>

          {/* Diagnosis & Presets */}
          <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm space-y-2.5">
            <label className="text-xs font-bold text-foreground">
              {copy('التشخيص السريري:', 'Clinical Diagnosis:')}
            </label>
            <Input
              type="text"
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              className="h-9 rounded-xl text-xs"
              placeholder={copy('اكتب التشخيص هنا...', 'Enter diagnosis...')}
            />

            {/* Quick chips */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {DIAGNOSIS_PRESETS.map((preset, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setDiagnosis(preset)}
                  className="rounded-lg border border-border/70 bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Drugs Adder */}
          <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground">
                {copy('إضافة أصناف علاجية:', 'Add Medications:')}
              </label>
              <span className="text-[10px] text-muted-foreground font-mono">
                {drugs.length} {copy('أصناف', 'items')}
              </span>
            </div>

            {/* Quick Suggestions Chips */}
            <div className="flex flex-wrap gap-1 text-[10px]">
              {COMMON_DRUGS_SUGGESTIONS.slice(0, 4).map((d, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setNewDrugName(d.name)
                    setNewDrugDosage(d.dosage)
                    setNewDrugDuration(d.duration)
                    setNewDrugNotes(d.notes)
                  }}
                  className="rounded-md bg-secondary/80 px-2 py-1 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                >
                  + {d.name.split(' ')[0]}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="col-span-2">
                <Input
                  type="text"
                  placeholder={copy('اسم الدواء (مثل: Systane Ultra)', 'Drug name...')}
                  value={newDrugName}
                  onChange={(e) => setNewDrugName(e.target.value)}
                  className="h-8 rounded-xl text-xs"
                />
              </div>
              <Input
                type="text"
                placeholder={copy('الجرعة (نقطة 3 مرات يومياً)', 'Dosage...')}
                value={newDrugDosage}
                onChange={(e) => setNewDrugDosage(e.target.value)}
                className="h-8 rounded-xl text-xs"
              />
              <Input
                type="text"
                placeholder={copy('المدة (أسبوعين)', 'Duration...')}
                value={newDrugDuration}
                onChange={(e) => setNewDrugDuration(e.target.value)}
                className="h-8 rounded-xl text-xs"
              />
              <div className="col-span-2">
                <Input
                  type="text"
                  placeholder={copy('ملاحظات إضافية (اختياري)', 'Notes (optional)...')}
                  value={newDrugNotes}
                  onChange={(e) => setNewDrugNotes(e.target.value)}
                  className="h-8 rounded-xl text-xs"
                />
              </div>
            </div>

            <Button
              type="button"
              size="sm"
              onClick={handleAddDrug}
              className="w-full gap-1.5 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground font-bold"
            >
              <Plus className="size-3.5" />
              <span>{copy('إضافة الدواء إلى الروشتة', 'Add to Prescription')}</span>
            </Button>

            {/* List of current drugs */}
            <div className="space-y-1.5 pt-1">
              {drugs.map((drug, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/30 p-2.5 text-xs"
                >
                  <div className="min-w-0">
                    <strong className="block truncate text-foreground">{drug.name}</strong>
                    <span className="text-[11px] text-muted-foreground">
                      {drug.dosage} • {drug.duration}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveDrug(i)}
                    className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500"
                    title={copy('حذف', 'Remove')}
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm space-y-2">
            <label className="text-xs font-bold text-foreground">
              {copy('إرشادات عامة للمريض:', 'General Instructions:')}
            </label>
            <Textarea
              rows={2}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="rounded-xl text-xs resize-none"
            />
          </div>
        </div>

        {/* Live A4 Prescription Preview (7 cols) */}
        <div className="lg:col-span-7">
          <div className="sticky top-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-bold flex items-center gap-1.5 text-foreground">
                <FileText className="size-4 text-primary" />
                {copy('معاينة حية لقالب الروشتة A4', 'Live A4 Prescription Preview')}
              </span>
              <span className="font-mono text-[11px]">210mm × 297mm (A4)</span>
            </div>

            {/* Scaled A4 Prescription Box */}
            <div
              ref={prescriptionRef}
              className="overflow-hidden rounded-2xl border border-border/80 bg-white shadow-xl transition-all"
            >
              <div className="scale-90 sm:scale-95 origin-top">
                <A4Prescription
                  clinic={clinicMock}
                  patientName={activePatient.name}
                  age={activePatient.age}
                  date="2026-10-26"
                  diagnosis={diagnosis}
                  drugs={drugs}
                  instructions={instructions}
                  primaryColor={demo.clinicInfo.primaryColor}
                  secondaryColor="#087CF4"
                  templateMode="standard"
                  prescriptionNumber={`RX-2026-${activePatient.age}`}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
