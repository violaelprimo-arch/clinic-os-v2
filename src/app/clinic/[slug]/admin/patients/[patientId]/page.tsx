'use client'

import { use, useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, updateDoc, doc, onSnapshot } from 'firebase/firestore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Clock, Phone, ArrowRight, User, Calendar, Pill, DollarSign, Printer, Activity, ChevronDown, ChevronUp, Stethoscope, CheckCircle, Save } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { A4Prescription } from '@/components/clinic/A4Prescription'

export default function PatientProfilePage({ params }: { params: Promise<{ slug: string, patientId: string }> }) {
  const resolvedParams = use(params)
  const { slug, patientId } = resolvedParams
  const phone = decodeURIComponent(patientId)

  const [appointments, setAppointments] = useState<any[]>([])
  const [patientData, setPatientData] = useState<any>({ name: 'جاري التحميل...', age: '', dob: '' })
  const [loading, setLoading] = useState(true)
  const [expandedVisitId, setExpandedVisitId] = useState<string | null>(null)
  const [editingDiagnosisFor, setEditingDiagnosisFor] = useState<string | null>(null)
  const [tempDiagnosis, setTempDiagnosis] = useState('')
  const [clinic, setClinic] = useState<any>(null)

  useEffect(() => {
    // Real-time integration (Task 13)
    const qAppt = query(collection(db, 'appointments'), where('phone', '==', phone))
    
    const fetchClinic = async () => {
      const q = query(collection(db, 'clinics'), where('slug', '==', slug));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setClinic({ id: snap.docs[0].id, ...snap.docs[0].data() });
      }
    };
    fetchClinic();
    
    const unsub = onSnapshot(qAppt, (snap) => {
      if (!snap.empty) {
        const appts = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
        
        setAppointments(appts)
        
        // Pick latest for profile data
        const latest = appts[0]
        setPatientData({
          name: latest.patientName,
          age: latest.age || '',
          dob: latest.dob || '',
          phone: latest.phone
        })
      }
      setLoading(false)
    })

    return () => unsub()
  }, [phone])

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
    <div className="max-w-5xl mx-auto space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={\`/clinic/\${slug}/admin/patients\`}>
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
                        <span>{patientData.age ? \`\${patientData.age} سنة\` : patientData.dob}</span>
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
                <div key={appt.id} className={\`bg-white border rounded-2xl transition-all duration-300 \${isExpanded ? 'border-[#15B8A6] shadow-md' : 'border-[#E5EAF0] hover:border-slate-300'}\`}>
                  
                  {/* Visit Header (Clickable) */}
                  <div 
                    onClick={() => setExpandedVisitId(isExpanded ? null : appt.id)}
                    className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className={\`w-12 h-12 rounded-xl flex items-center justify-center font-black transition-colors \${isExpanded ? 'bg-[#15B8A6] text-white' : 'bg-slate-50 text-slate-600'}\`}>
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
                            <Link href={\`/clinic/\${slug}/admin/prescriptions?appointmentId=\${appt.id}&phone=\${phone}\`}>
                              <Button variant="outline" size="sm" className="h-8 text-xs font-bold border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                                {appt.drugs ? 'تعديل الروشتة' : 'كتابة روشتة جديدة'}
                              </Button>
                            </Link>
                          </div>
                        </div>

                        {appt.drugs && appt.drugs.length > 0 ? (
                          <div className="bg-white rounded-xl border border-indigo-100 overflow-hidden p-4">
                            <A4Prescription 
                              clinic={clinic}
                              patientName={patientData.name}
                              age={patientData.age || patientData.dob}
                              date={appt.date}
                              diagnosis={appt.diagnosis}
                              drugs={appt.drugs}
                              templateMode={clinic?.prescriptionTemplateUrl ? 'custom' : 'standard'}
                              topOffset={180}
                            />
                          </div>
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
