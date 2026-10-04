'use client'

import { use, useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Activity, Clock, FileText, Phone, ArrowRight, Save, Plus } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'

export default function PatientProfilePage({ params }: { params: Promise<{ slug: string, patientId: string }> }) {
  const resolvedParams = use(params)
  const { slug, patientId } = resolvedParams
  const phone = decodeURIComponent(patientId) // ID is the phone number
  
  const [appointments, setAppointments] = useState<any[]>([])
  const [prescriptions, setPrescriptions] = useState<any[]>([])
  const [patientName, setPatientName] = useState('')
  const [loading, setLoading] = useState(true)
  const [editingDiagnosis, setEditingDiagnosis] = useState<string | null>(null)
  const [diagnosisText, setDiagnosisText] = useState('')

  useEffect(() => {
    const fetchPatientData = async () => {
      try {
        const clinicQ = query(collection(db, 'clinics'), where('slug', '==', slug))
        const clinicSnap = await getDocs(clinicQ)
        if (clinicSnap.empty) return
        const clinicDataId = clinicSnap.docs[0].id

        // Fetch all appointments for this phone
        const apptQ = query(collection(db, 'appointments'), where('clinic_id', '==', clinicDataId), where('phone', '==', phone))
        const apptSnap = await getDocs(apptQ)
        const appts: any[] = apptSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime())
        
        setAppointments(appts)
        if (appts.length > 0) setPatientName(appts[0].patientName)

        // Fetch all prescriptions for this phone
        const rxQ = query(collection(db, 'prescriptions'), where('clinic_id', '==', clinicDataId), where('patientPhone', '==', phone))
        const rxSnap = await getDocs(rxQ)
        const rxs = rxSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
        setPrescriptions(rxs)

      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchPatientData()
  }, [slug, phone])

  const saveDiagnosis = async (apptId: string) => {
    try {
      await updateDoc(doc(db, 'appointments', apptId), {
        diagnosis: diagnosisText
      })
      setAppointments(prev => prev.map(a => a.id === apptId ? { ...a, diagnosis: diagnosisText } : a))
      setEditingDiagnosis(null)
      toast.success('تم حفظ التشخيص بنجاح')
    } catch (error) {
      toast.error('حدث خطأ أثناء الحفظ')
    }
  }

  if (loading) return <div className="p-12 text-center text-slate-500">جاري تحميل الملف الطبي...</div>

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto" dir="rtl">
      <div className="flex items-center gap-4 mb-8">
        <Link href={`/clinic/${slug}/admin/patients`}>
          <Button variant="outline" size="icon" className="rounded-full h-10 w-10">
            <ArrowRight className="w-5 h-5 text-slate-600" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
            الملف الطبي الموحد
          </h1>
          <p className="text-slate-500 font-semibold">{patientName} • {phone}</p>
        </div>
      </div>

      <div className="flex justify-end mb-6">
        <Link href={`/clinic/${slug}/admin/prescriptions?patientName=${encodeURIComponent(patientName)}&patientPhone=${encodeURIComponent(phone)}`}>
          <Button className="font-bold rounded-xl shadow-md h-12 bg-primary">
            <Plus className="w-5 h-5 ml-2" />
            إنشاء روشتة جديدة لهذا المريض
          </Button>
        </Link>
      </div>

      <div className="space-y-8">
        {appointments.map((appt, idx) => {
          // Find matching prescription for this appointment (by closest date)
          const relatedRx = prescriptions.find(rx => rx.date === appt.date)
          
          return (
            <Card key={appt.id} className={`shadow-sm border-r-4 ${idx === 0 ? 'border-r-green-500 bg-white' : 'border-r-slate-300 bg-slate-50'}`}>
              <CardHeader className="pb-2 flex flex-col md:flex-row justify-between md:items-center">
                <div>
                  <CardTitle className="text-xl text-slate-800 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-slate-400" /> 
                    زيارة بتاريخ: <span dir="ltr">{appt.date}</span>
                    {idx === 0 && <Badge className="bg-green-100 text-green-800 border-none mr-2">أحدث زيارة</Badge>}
                  </CardTitle>
                  <CardDescription className="mt-1 font-semibold">{appt.serviceName}</CardDescription>
                </div>
                {appt.status === 'completed' && <Badge variant="outline" className="bg-slate-100 mt-2 md:mt-0">تم الكشف</Badge>}
              </CardHeader>
              
              <CardContent className="space-y-6 pt-4">
                {/* Diagnosis Section */}
                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                  <h4 className="font-bold text-blue-900 flex items-center gap-2 mb-3">
                    <Activity className="w-5 h-5" /> التشخيص والملاحظات الطبية
                  </h4>
                  
                  {editingDiagnosis === appt.id ? (
                    <div className="space-y-3">
                      <Textarea 
                        value={diagnosisText}
                        onChange={e => setDiagnosisText(e.target.value)}
                        placeholder="اكتب تفاصيل التشخيص والملاحظات هنا..."
                        className="min-h-[100px] bg-white text-right"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveDiagnosis(appt.id)} className="font-bold">
                          <Save className="w-4 h-4 ml-2" /> حفظ التشخيص
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingDiagnosis(null)}>
                          إلغاء
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="group relative">
                      <p className="text-slate-700 whitespace-pre-wrap min-h-[40px]">
                        {appt.diagnosis || <span className="text-slate-400 italic">لا يوجد تشخيص مسجل لهذه الزيارة</span>}
                      </p>
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => {
                          setDiagnosisText(appt.diagnosis || '')
                          setEditingDiagnosis(appt.id)
                        }}
                      >
                        تعديل التشخيص
                      </Button>
                    </div>
                  )}
                </div>

                {/* Prescription Section */}
                <div className="bg-slate-100/50 p-4 rounded-xl border border-slate-200">
                  <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-3">
                    <FileText className="w-5 h-5" /> الروشتة والأدوية المصروفة
                  </h4>
                  {relatedRx ? (
                    <div className="space-y-2">
                      {relatedRx.drugs?.map((drug: any, dIdx: number) => (
                        <div key={dIdx} className="bg-white p-3 rounded-lg shadow-sm border border-slate-100 flex justify-between">
                          <div className="font-bold text-primary">{drug.name}</div>
                          <div className="text-sm text-slate-600 font-medium">{drug.dosage} - {drug.duration}</div>
                        </div>
                      ))}
                      {(!relatedRx.drugs || relatedRx.drugs.length === 0) && (
                         <p className="text-sm text-slate-500">لم يتم إضافة أدوية في هذه الروشتة.</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 italic">لم يتم تحرير روشتة لهذه الزيارة.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
        
        {appointments.length === 0 && (
          <div className="text-center p-12 text-slate-500">
            لا توجد زيارات مسجلة لهذا المريض
          </div>
        )}
      </div>
    </div>
  )
}
