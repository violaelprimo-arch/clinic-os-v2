'use client'

import { use, useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Plus, Printer, Trash2, Search, FileSignature, MapPin, Phone, User as UserIcon } from 'lucide-react'
import { toast } from 'sonner'
import { db } from '@/lib/firebase'
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore'
import { useSearchParams } from 'next/navigation'

export default function PrescriptionsPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug
  const searchParams = useSearchParams()
  
  const [patientName, setPatientName] = useState(searchParams?.get('patientName') || '')
  const [patientPhone, setPatientPhone] = useState(searchParams?.get('patientPhone') || '')
  
  const [drugs, setDrugs] = useState([{ id: 1, name: '', dosage: '', duration: '' }])
  const [drugSearch, setDrugSearch] = useState('')
  const [commonDrugs] = useState([
    'Augmentin 1g', 'Panadol Advance', 'Brufen 400mg', 
    'Amoxil 500mg', 'Cataflam 50mg', 'Concor 5mg', 
    'Nexium 40mg', 'Zyrtec 10mg'
  ])

  const [clinic, setClinic] = useState<any>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [date] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    const fetchClinic = async () => {
      const q = query(collection(db, 'clinics'), where('slug', '==', slug))
      const snapshot = await getDocs(q)
      if (!snapshot.empty) {
        setClinic({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() })
      }
    }
    fetchClinic()
  }, [slug])

  const addDrug = () => {
    setDrugs([...drugs, { id: Date.now(), name: '', dosage: '', duration: '' }])
  }

  const removeDrug = (id: number) => {
    setDrugs(drugs.filter(d => d.id !== id))
  }

  const updateDrug = (id: number, field: string, value: string) => {
    setDrugs(drugs.map(d => d.id === id ? { ...d, [field]: value } : d))
  }

  const handleSave = async () => {
    if (!patientName.trim()) return toast.error('يجب إدخال اسم المريض')
    if (!patientPhone.trim()) return toast.error('يجب إدخال رقم هاتف المريض للربط بملفه')
    
    setIsSaving(true)
    try {
      await addDoc(collection(db, 'prescriptions'), {
        clinic_id: clinic?.id,
        patientName,
        patientPhone,
        date,
        drugs: drugs.filter(d => d.name.trim() !== ''),
        createdAt: new Date().toISOString()
      })
      toast.success('تم حفظ الروشتة وإضافتها لملف المريض بنجاح')
    } catch (error) {
      toast.error('حدث خطأ أثناء حفظ الروشتة')
    } finally {
      setIsSaving(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto" dir="rtl">
      
      {/* 1. Controller Section (Hidden on Print) */}
      <div className="print:hidden flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            <FileSignature className="w-6 h-6" /> إصدار روشتة طبية
          </h1>
          <p className="text-slate-500 mt-1">قم بتعبئة بيانات المريض والأدوية لتجهيز الروشتة للطباعة</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={handleSave} disabled={isSaving} className="font-bold">
            {isSaving ? 'جاري الحفظ...' : 'حفظ في ملف المريض'}
          </Button>
          <Button variant="outline" onClick={handlePrint} className="border-primary text-primary hover:bg-primary/10 font-bold">
            <Printer className="w-4 h-4 ml-2" /> طباعة الروشتة
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-12 gap-8 print:block">
        
        {/* 2. Form Editor (Hidden on Print) */}
        <div className="md:col-span-5 print:hidden space-y-6">
          <Card className="shadow-lg border-t-4 border-t-blue-500">
            <CardHeader className="bg-slate-50/50 border-b pb-4">
              <CardTitle className="text-lg">بيانات المريض</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="space-y-2">
                <Label>اسم المريض</Label>
                <Input value={patientName} onChange={e => setPatientName(e.target.value)} placeholder="اسم المريض ثلاثي" className="h-12 bg-slate-50" />
              </div>
              <div className="space-y-2">
                <Label>رقم الموبايل (للربط بالملف)</Label>
                <Input value={patientPhone} onChange={e => setPatientPhone(e.target.value)} placeholder="01xxxxxxxxx" className="h-12 bg-slate-50" dir="ltr" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-t-4 border-t-primary">
            <CardHeader className="bg-slate-50/50 border-b pb-4">
              <CardTitle className="text-lg">الأدوية (Rx)</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-6">
              {/* Quick Add */}
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input 
                  placeholder="ابحث عن دواء للإضافة السريعة..." 
                  value={drugSearch}
                  onChange={e => setDrugSearch(e.target.value)}
                  className="pr-10 bg-slate-50 border-primary/20 focus:border-primary"
                />
                {drugSearch && (
                  <div className="absolute w-full mt-1 bg-white border shadow-lg rounded-xl overflow-hidden z-10 max-h-48 overflow-y-auto">
                    {commonDrugs.filter(d => d.toLowerCase().includes(drugSearch.toLowerCase())).map(drug => (
                      <div 
                        key={drug} 
                        className="p-3 hover:bg-primary/10 cursor-pointer text-sm font-bold border-b last:border-none"
                        onClick={() => {
                          const emptyDrug = drugs.find(d => !d.name)
                          if (emptyDrug) {
                            updateDrug(emptyDrug.id, 'name', drug)
                          } else {
                            setDrugs([...drugs, { id: Date.now(), name: drug, dosage: '', duration: '' }])
                          }
                          setDrugSearch('')
                        }}
                      >
                        {drug}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Drugs List */}
              <div className="space-y-4">
                {drugs.map((drug, index) => (
                  <div key={drug.id} className="p-4 border rounded-xl bg-white shadow-sm space-y-3 relative group">
                    <div className="flex justify-between items-center mb-2">
                      <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">دواء {index + 1}</Badge>
                      {drugs.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => removeDrug(drug.id)} className="text-red-500 h-8 w-8 hover:bg-red-50">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-500">اسم الدواء</Label>
                      <Input value={drug.name} onChange={e => updateDrug(drug.id, 'name', e.target.value)} placeholder="مثال: Augmentin 1g" dir="ltr" className="font-bold h-10" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-xs text-slate-500">الجرعة</Label>
                        <Input value={drug.dosage} onChange={e => updateDrug(drug.id, 'dosage', e.target.value)} placeholder="قرص كل 12 ساعة" className="h-10 text-sm" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-slate-500">المدة</Label>
                        <Input value={drug.duration} onChange={e => updateDrug(drug.id, 'duration', e.target.value)} placeholder="لمدة 5 أيام" className="h-10 text-sm" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="outline" onClick={addDrug} className="w-full border-dashed border-2 border-slate-300 text-slate-600 hover:border-primary hover:text-primary">
                <Plus className="w-4 h-4 ml-2" /> إضافة دواء آخر
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* 3. Live Preview / Printable Area */}
        <div className="md:col-span-7 print:col-span-12 print:m-0 print:p-0">
          <div className="bg-white p-8 md:p-12 shadow-2xl rounded-xl min-h-[29.7cm] border border-slate-200 relative overflow-hidden print:shadow-none print:border-none print:rounded-none">
            
            {/* Watermark Logo */}
            {clinic?.heroImage && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none w-3/4 flex justify-center items-center">
                <img src={clinic.heroImage} className="w-full h-auto grayscale" alt="Watermark" />
              </div>
            )}

            {/* Header (Medical Letterhead) */}
            <div className="flex justify-between items-start border-b-2 pb-6 border-primary/20 mb-8">
              <div className="space-y-1 text-right max-w-[60%]">
                <h1 className="text-3xl font-black text-primary mb-1">{clinic?.clinicName || 'عيادة طبية'}</h1>
                <h2 className="text-xl font-bold text-slate-800">د. {clinic?.doctorName || 'اسم الطبيب'}</h2>
                <p className="text-sm text-slate-500 font-semibold mt-2">مستشار الطب المتخصص والعلاج المتقدم</p>
              </div>
              <div className="w-24 h-24 bg-primary/5 rounded-2xl flex items-center justify-center border-2 border-primary/20 overflow-hidden shrink-0">
                {clinic?.heroImage ? (
                  <img src={clinic.heroImage} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl font-black text-primary">{slug.charAt(0).toUpperCase()}</span>
                )}
              </div>
            </div>

            {/* Patient Info Row */}
            <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-100 mb-8 print:bg-transparent print:border-y print:border-x-0 print:rounded-none">
              <div className="flex items-center gap-3">
                <UserIcon className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500 font-bold mb-1">اسم المريض</p>
                  <p className="font-black text-lg text-slate-800">{patientName || '......................................................'}</p>
                </div>
              </div>
              <div className="text-left">
                <p className="text-xs text-slate-500 font-bold mb-1">التاريخ</p>
                <p className="font-bold text-slate-800 dir-ltr">{date}</p>
              </div>
            </div>

            {/* Rx Symbol */}
            <div className="text-5xl font-serif font-bold text-primary mb-8 italic pl-4 border-l-4 border-primary ml-4">
              Rx
            </div>

            {/* Drugs Render */}
            <div className="space-y-8 pr-12 min-h-[400px]">
              {drugs.map((drug, idx) => (
                <div key={drug.id} className="space-y-1 relative">
                  <div className="absolute -right-6 top-1 w-2 h-2 rounded-full bg-primary/40"></div>
                  <h3 className="text-xl font-bold text-slate-900 capitalize dir-ltr flex justify-between w-full">
                    <span>{drug.name || '............................................'}</span>
                  </h3>
                  <div className="flex gap-4 text-slate-600 font-medium mt-1">
                    <span className="bg-slate-50 px-3 py-1 rounded text-sm print:bg-transparent print:p-0">{drug.dosage || '................'}</span>
                    <span className="bg-slate-50 px-3 py-1 rounded text-sm print:bg-transparent print:p-0">{drug.duration || '................'}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="absolute bottom-8 left-8 right-8 border-t-2 border-primary/20 pt-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                    <MapPin className="w-4 h-4 text-primary" />
                    {clinic?.clinicAddress || 'العنوان غير مدرج'}
                  </div>
                </div>
                <div className="flex flex-col gap-2 items-end text-sm font-bold text-slate-700 dir-ltr">
                  {(clinic?.clinicPhones || [clinic?.clinicPhone]).map((p: string, i: number) => p && (
                    <div key={i} className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-primary" /> {p}
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
