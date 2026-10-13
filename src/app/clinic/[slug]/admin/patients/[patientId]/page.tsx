'use client'

import { use, useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, updateDoc, doc, onSnapshot } from 'firebase/firestore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Clock, Phone, ArrowRight, User, Calendar, Pill, DollarSign, Printer, Activity, ChevronDown, ChevronUp, Stethoscope, CheckCircle, Save, MessageCircle, FileText } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { A4Prescription } from '@/components/clinic/A4Prescription'

export default function PatientProfilePage({
 params }: { params: Promise<{ slug: string, patientId: string }> }) {
  const resolvedParams = use(params)
  const { slug, patientId } = resolvedParams

  const handlePrint = () => {
    window.print()
  }

  const sendWhatsAppRx = (appt: any) => {
    if (!phone) return toast.error('يرجى إدخال رقم هاتف المريض')
    let formattedPhone = phone.replace(/[^0-9]/g, '')
    if (formattedPhone.startsWith('0')) formattedPhone = '2' + formattedPhone

    const drugsList = appt.drugs
      .filter((d: any) => d.name)
      .map((d: any, i: number) => `${i + 1}. ${d.name} (${d.dosage} - ${d.duration})`)
      .join('\n')

    const message = encodeURIComponent(
      `الروشتة الطبية الإلكترونية 📋\nالعيادة: ${clinic?.clinicName || 'العيادة'}\nالمريض: ${patientData?.name}\nالتاريخ: ${appt.date}\n\nالعلاج المطلوب:\n${drugsList}\n\nنتمنى لك الشفاء العاجل!`
    )
    window.open(`https://wa.me/${formattedPhone}?text=${message}`, '_blank')
  }

  const phone = decodeURIComponent(patientId)

  const [appointments, setAppointments] = useState<any[]>([])
  const [patientData, setPatientData] = useState<any>({ name: 'جاري التحميل...', age: '', dob: '' })
  const [loading, setLoading] = useState(true)
  const [expandedVisitId, setExpandedVisitId] = useState<string | null>(null)
  const [editingDiagnosisFor, setEditingDiagnosisFor] = useState<string | null>(null)
  const [tempDiagnosis, setTempDiagnosis] = useState('')
  const [clinic, setClinic] = useState<any>(null)

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
      await updateDoc(doc(db, 'appointments', apptId), {
        vitalSigns: {
          bloodPressureSystolic: vitalsBpSys ? Number(vitalsBpSys) : null,
          bloodPressureDiastolic: vitalsBpDia ? Number(vitalsBpDia) : null,
          heartRate: vitalsPulse ? Number(vitalsPulse) : null,
          temperature: vitalsTemp ? Number(vitalsTemp) : null,
          glucoseLevel: vitalsGlucose ? Number(vitalsGlucose) : null,
          weightKg: vitalsWeight ? Number(vitalsWeight) : null,
          recordedAt: new Date().toISOString()
        }
      })
      toast.success('تم حفظ العلامات الحيوية بنجاح')
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
              phone: latest.phone || phone
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

  const handleSaveDiagnosis = async (apptId: string) => {
    try {
      await updateDoc(doc(db, 'appointments', apptId), { diagnosis: tempDiagnosis })
      setEditingDiagnosisFor(null)
      toast.success('تم حفظ التشخيص بنجاح')
    } catch (error) {
      toast.error('حدث خطأ أثناء الحفظ')
    }
  }

  if (loading) return <div className="p-8 text-center text-slate-400 font-bold" dir="rtl">جاري تحميل الملف الطبي...</div>

  return (
    <div className="max-w-5xl mx-auto space-y-6 print:hidden" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/clinic/${slug}/admin/patients`}>
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl border-[#E5EAF0]">
            <ArrowRight className="w-5 h-5 text-slate-600" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-black text-[#182230]">الملف الطبي الشامل</h1>
          <p className="text-sm text-slate-400 font-medium">سجل المريض وتاريخ الزيارات</p>
        </div>
      </div>

      {/* Patient Basic Info */}
      <Card className="border-[#E5EAF0] shadow-sm rounded-2xl overflow-hidden bg-white">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="w-24 h-24 rounded-3xl bg-teal-50 text-[#15B8A6] flex items-center justify-center shrink-0">
              <User className="w-10 h-10" />
            </div>
            <div className="flex-1 text-center md:text-right space-y-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-[#182230]">{patientData.name}</h2>
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mt-2">
                    <span className="flex items-center gap-1.5 text-sm font-bold text-slate-600">
                      <Phone className="w-4 h-4 text-slate-400" />
                      <span dir="ltr">{patientData.phone}</span>
                    </span>
                    {(patientData.age || patientData.dob) && (
                      <span className="flex items-center gap-1.5 text-sm font-bold text-slate-600">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span>{patientData.age ? `${patientData.age} سنة` : patientData.dob}</span>
                      </span>
                    )}
                  </div>
                </div>
                <Badge className="bg-emerald-100 text-emerald-800 border-none font-bold px-4 py-2 text-sm rounded-xl">
                  مريض نشط
                </Badge>
              </div>
              <div className="flex items-center gap-6 pt-2">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-400">إجمالي الزيارات</p>
                  <p className="text-xl font-black text-[#182230]">{appointments.length}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-400">آخر زيارة</p>
                  <p className="text-sm font-bold text-[#15B8A6]">{appointments[0]?.date || 'لا يوجد'}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Unified Visits Record (Task 11) */}
      <div className="space-y-4">
        <h3 className="font-black text-lg text-[#182230] flex items-center gap-2">
          <Clock className="w-5 h-5 text-slate-400" />
          السجل التاريخي للزيارات
        </h3>
        
        {appointments.length === 0 ? (
          <div className="p-8 text-center border-2 border-dashed border-[#E5EAF0] rounded-3xl">
            <p className="text-slate-400 font-bold text-sm">لا يوجد سجل تاريخي لهذا المريض.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {appointments.map((appt, idx) => {
              const isExpanded = expandedVisitId === appt.id;
              
              return (
                <div key={appt.id} className={`bg-white border rounded-2xl transition-all duration-300 ${isExpanded ? 'border-[#15B8A6] shadow-md' : 'border-[#E5EAF0] hover:border-slate-300'}`}>
                  
                  {/* Visit Header (Clickable) */}
                  <div 
                    onClick={() => setExpandedVisitId(isExpanded ? null : appt.id)}
                    className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black transition-colors ${isExpanded ? 'bg-[#15B8A6] text-white' : 'bg-slate-50 text-slate-600'}`}>
                        #{appointments.length - idx}
                      </div>
                      <div>
                        <h4 className="font-bold text-base text-[#182230] flex items-center gap-2">
                          {appt.serviceName || 'كشف طبي'}
                          {appt.status === 'completed' && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                        </h4>
                        <p className="text-sm text-slate-500 font-mono mt-0.5">{appt.date}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 self-end sm:self-center">
                      {appt.paymentStatus === 'paid' ? (
                        <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200">دفع: {appt.servicePrice} ج.م</Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">مستحق: {appt.servicePrice} ج.م</Badge>
                      )}
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                    </div>
                  </div>

                  {/* Visit Details (Expanded) */}
                  {isExpanded && (
                    <div className="border-t border-[#E5EAF0] bg-slate-50/50 p-5 space-y-6 rounded-b-2xl">
                      
                      {/* 0. Vital Signs Section (العلامات الحيوية) */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h5 className="font-bold text-sm text-[#182230] flex items-center gap-1.5">
                            <Activity className="w-4 h-4 text-rose-500" />
                            العلامات الحيوية (Vital Signs)
                          </h5>
                          {editingVitalsFor !== appt.id && (
                            <Button
                              variant="link"
                              onClick={() => handleOpenEditVitals(appt)}
                              className="h-auto p-0 text-xs text-teal-600 font-bold"
                            >
                              {appt.vitalSigns ? 'تعديل القياسات' : 'تسجيل القياسات'}
                            </Button>
                          )}
                        </div>

                        {editingVitalsFor === appt.id ? (
                          <div className="bg-white p-4 rounded-xl border border-teal-200 space-y-3 shadow-2xs">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">ضغط الدم الانقباضي (SYS)</label>
                                <Input
                                  value={vitalsBpSys}
                                  onChange={e => setVitalsBpSys(e.target.value)}
                                  placeholder="120"
                                  className="h-9 text-xs"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">ضغط الدم الانبساطي (DIA)</label>
                                <Input
                                  value={vitalsBpDia}
                                  onChange={e => setVitalsBpDia(e.target.value)}
                                  placeholder="80"
                                  className="h-9 text-xs"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">النبض (HR bpm)</label>
                                <Input
                                  value={vitalsPulse}
                                  onChange={e => setVitalsPulse(e.target.value)}
                                  placeholder="75"
                                  className="h-9 text-xs"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">درجة الحرارة (°C)</label>
                                <Input
                                  value={vitalsTemp}
                                  onChange={e => setVitalsTemp(e.target.value)}
                                  placeholder="37.0"
                                  className="h-9 text-xs"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">مستوى السكر (mg/dL)</label>
                                <Input
                                  value={vitalsGlucose}
                                  onChange={e => setVitalsGlucose(e.target.value)}
                                  placeholder="100"
                                  className="h-9 text-xs"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">الوزن (kg)</label>
                                <Input
                                  value={vitalsWeight}
                                  onChange={e => setVitalsWeight(e.target.value)}
                                  placeholder="70"
                                  className="h-9 text-xs"
                                />
                              </div>
                            </div>
                            <div className="flex gap-2 pt-2 border-t border-slate-100">
                              <Button
                                onClick={() => handleSaveVitals(appt.id)}
                                disabled={isSavingVitals}
                                className="bg-[#15B8A6] hover:bg-[#0D9488] text-white text-xs h-8 font-bold"
                              >
                                {isSavingVitals ? 'جاري الحفظ...' : 'حفظ القياسات'}
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => setEditingVitalsFor(null)}
                                className="text-xs h-8 font-bold"
                              >
                                إلغاء
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-white p-4 rounded-xl border border-[#E5EAF0]">
                            {appt.vitalSigns && (appt.vitalSigns.bloodPressureSystolic || appt.vitalSigns.heartRate || appt.vitalSigns.temperature || appt.vitalSigns.glucoseLevel || appt.vitalSigns.weightKg) ? (
                              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                                {(appt.vitalSigns.bloodPressureSystolic || appt.vitalSigns.bloodPressureDiastolic) && (
                                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                                    <span className="text-[10px] text-slate-400 font-bold block">ضغط الدم</span>
                                    <span className="text-xs font-black text-slate-800">
                                      {appt.vitalSigns.bloodPressureSystolic || '--'}/{appt.vitalSigns.bloodPressureDiastolic || '--'}
                                    </span>
                                    <span className="text-[9px] text-slate-400 block">mmHg</span>
                                  </div>
                                )}
                                {appt.vitalSigns.heartRate && (
                                  <div className="p-2 rounded-lg bg-rose-50/50 border border-rose-100">
                                    <span className="text-[10px] text-rose-500 font-bold block">النبض</span>
                                    <span className="text-xs font-black text-rose-700">{appt.vitalSigns.heartRate}</span>
                                    <span className="text-[9px] text-rose-400 block">bpm</span>
                                  </div>
                                )}
                                {appt.vitalSigns.temperature && (
                                  <div className="p-2 rounded-lg bg-amber-50/50 border border-amber-100">
                                    <span className="text-[10px] text-amber-500 font-bold block">الحرارة</span>
                                    <span className="text-xs font-black text-amber-700">{appt.vitalSigns.temperature}</span>
                                    <span className="text-[9px] text-amber-400 block">°C</span>
                                  </div>
                                )}
                                {appt.vitalSigns.glucoseLevel && (
                                  <div className="p-2 rounded-lg bg-blue-50/50 border border-blue-100">
                                    <span className="text-[10px] text-blue-500 font-bold block">السكر</span>
                                    <span className="text-xs font-black text-blue-700">{appt.vitalSigns.glucoseLevel}</span>
                                    <span className="text-[9px] text-blue-400 block">mg/dL</span>
                                  </div>
                                )}
                                {appt.vitalSigns.weightKg && (
                                  <div className="p-2 rounded-lg bg-teal-50/50 border border-teal-100">
                                    <span className="text-[10px] text-teal-600 font-bold block">الوزن</span>
                                    <span className="text-xs font-black text-teal-800">{appt.vitalSigns.weightKg}</span>
                                    <span className="text-[9px] text-teal-500 block">kg</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-400 italic text-center py-2">
                                لم يتم تسجيل علامات حيوية لهذه الزيارة بعد.
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 1. Diagnosis Section */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h5 className="font-bold text-sm text-[#182230] flex items-center gap-1.5">
                            <Stethoscope className="w-4 h-4 text-[#15B8A6]" />
                            التشخيص والملاحظات
                          </h5>
                          {editingDiagnosisFor !== appt.id && (
                            <Button variant="link" onClick={() => { setEditingDiagnosisFor(appt.id); setTempDiagnosis(appt.diagnosis || ''); }} className="h-auto p-0 text-xs text-blue-600">
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
                              className="bg-white border-[#E5EAF0]"
                            />
                            <div className="flex gap-2">
                              <Button onClick={() => handleSaveDiagnosis(appt.id)} className="bg-[#182230] text-white text-xs h-8">حفظ</Button>
                              <Button variant="outline" onClick={() => setEditingDiagnosisFor(null)} className="text-xs h-8">إلغاء</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-white p-4 rounded-xl border border-[#E5EAF0] text-sm text-slate-700 min-h-[60px]">
                            {appt.diagnosis ? appt.diagnosis : <span className="text-slate-400 italic">لا يوجد تشخيص مسجل لهذه الزيارة.</span>}
                          </div>
                        )}
                      </div>

                      {/* 2. Prescription Section */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h5 className="font-bold text-sm text-[#182230] flex items-center gap-1.5">
                            <Pill className="w-4 h-4 text-indigo-500" />
                            الروشتة الدوائية
                          </h5>
                          <div className="flex items-center gap-2">
                            <Link href={`/clinic/${slug}/admin/prescriptions?appointmentId=${appt.id}&phone=${phone}&patientName=${patientData?.name}&age=${patientData?.age || patientData?.dob}`}>
                              <Button variant="outline" size="sm" className="h-8 text-xs font-bold border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                                {appt.drugs ? 'تعديل الروشتة' : 'كتابة روشتة جديدة'}
                              </Button>
                            </Link>
                          </div>
                        </div>

                        {appt.drugs && appt.drugs.length > 0 ? (
                          <Dialog>
                            <DialogTrigger>
                              <Button variant="outline" className="w-full h-12 bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100">
                                <FileText className="w-4 h-4 ml-2" />
                                عرض الروشتة وإرسالها
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto print:max-w-none print:w-full print:h-auto print:max-h-none print:overflow-visible print:border-none print:shadow-none print:bg-transparent print:p-0 print:m-0">
                              <DialogHeader className="print:hidden">
                                <DialogTitle>الروشتة الطبية - {appt.date}</DialogTitle>
                              </DialogHeader>
                              <div className="flex flex-wrap gap-2 mb-4 print:hidden">
                                <Button onClick={handlePrint} className="bg-[#15B8A6] hover:bg-[#0D9488] text-white">
                                  <Printer className="w-4 h-4 ml-2" />
                                  طباعة الروشتة
                                </Button>
                                <Button onClick={() => sendWhatsAppRx(appt)} className="bg-[#25D366] hover:bg-[#128C7E] text-white">
                                  <MessageCircle className="w-4 h-4 ml-2" />
                                  إرسال واتساب
                                </Button>
                                <Link href={`/clinic/${slug}/admin/prescriptions?appointmentId=${appt.id}&phone=${phone}&patientName=${patientData.name}&age=${patientData.age || patientData.dob}`}>
                                  <Button variant="outline">
                                    تعديل الروشتة
                                  </Button>
                                </Link>
                              </div>
                              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden print:overflow-visible print:border-0 print:m-0 print:p-0 print:w-[100vw] print:h-[100vh]">
                                <A4Prescription 
                                  clinic={clinic}
                                  patientName={patientData?.name || appt?.patientName || 'المريض'}
                                  age={patientData?.age || appt?.age || patientData?.dob || appt?.dob || ''}
                                  date={appt.date}
                                  diagnosis={appt.diagnosis}
                                  drugs={appt.drugs}
                                  templateMode={clinic?.prescriptionTemplateUrl ? 'custom' : 'standard'}
                                  topOffset={25}
                                />
                              </div>
                            </DialogContent>
                          </Dialog>
                        ) : (
                          <div className="bg-white p-4 rounded-xl border border-[#E5EAF0] text-sm text-slate-400 italic">
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
    </div>
  )
}
