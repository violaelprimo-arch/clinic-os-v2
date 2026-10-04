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
import { EGYPTIAN_DRUGS } from '@/lib/egyptian-drugs'
import { doc, updateDoc } from 'firebase/firestore'
import { Star, Settings2, ShieldCheck, Pill } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

export default function PrescriptionsPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug
  const searchParams = useSearchParams()
  
  const [patientName, setPatientName] = useState(searchParams?.get('patientName') || '')
  const [patientPhone, setPatientPhone] = useState(searchParams?.get('patientPhone') || '')
  
  const [drugs, setDrugs] = useState([{ id: 1, name: '', dosage: '', duration: '' }])
  const [drugSearch, setDrugSearch] = useState('')
  const [favoriteDrugs, setFavoriteDrugs] = useState<string[]>([])
  const [customDrugs, setCustomDrugs] = useState<string[]>([])
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false)
  const [clinicId, setClinicId] = useState<string | null>(null)
  

  const [clinic, setClinic] = useState<any>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [date] = useState(new Date().toISOString().split('T')[0])

  
  useEffect(() => {
    const fetchClinic = async () => {
      const q = query(collection(db, 'clinics'), where('slug', '==', slug))
      const snapshot = await getDocs(q)
      if (!snapshot.empty) {
        const cDoc = snapshot.docs[0];
        const data = cDoc.data();
        setClinic({ id: cDoc.id, ...data });
        setClinicId(cDoc.id);
        if (data.favoriteDrugs) setFavoriteDrugs(data.favoriteDrugs);
        if (data.customDrugs) setCustomDrugs(data.customDrugs);
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


  const toggleFavorite = async (e: React.MouseEvent, drugName: string) => {
    e.stopPropagation();
    if (!clinicId) return;
    let newFavs = [...favoriteDrugs];
    if (newFavs.includes(drugName)) {
      newFavs = newFavs.filter(d => d !== drugName);
    } else {
      newFavs.push(drugName);
    }
    setFavoriteDrugs(newFavs);
    try {
      await updateDoc(doc(db, 'clinics', clinicId), { favoriteDrugs: newFavs });
      toast.success(newFavs.includes(drugName) ? 'تم الإضافة للمفضلة' : 'تم الإزالة من المفضلة');
    } catch (err) {
      toast.error('حدث خطأ أثناء حفظ المفضلة');
    }
  }

  
  const addCustomDrug = async (drugName: string) => {
    if (!clinicId || !drugName.trim()) return;
    const newCustom = [...new Set([...customDrugs, drugName])];
    const newFavs = [...new Set([...favoriteDrugs, drugName])];
    setCustomDrugs(newCustom);
    setFavoriteDrugs(newFavs);
    try {
      await updateDoc(doc(db, 'clinics', clinicId), { customDrugs: newCustom, favoriteDrugs: newFavs });
      toast.success('تمت إضافة الدواء لقاعدة البيانات والمفضلة');
      
      const emptyDrug = drugs.find(d => !d.name)
      if (emptyDrug) updateDrug(emptyDrug.id, 'name', drugName)
      else setDrugs([...drugs, { id: Date.now(), name: drugName, dosage: '', duration: '' }])
      
      setDrugSearch('');
    } catch (err) {
      toast.error('حدث خطأ أثناء الإضافة');
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
              <div className="flex gap-2 relative">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input 
                    placeholder="ابحث عن الدواء في قاعدة البيانات (أكثر من 300 دواء)..." 
                    value={drugSearch}
                    onChange={e => setDrugSearch(e.target.value)}
                    className="pr-10 bg-slate-50 border-primary/20 focus:border-primary h-12 text-lg font-bold"
                  />
                  {drugSearch && (
                    <div className="absolute w-full mt-1 bg-white border shadow-2xl rounded-xl overflow-hidden z-50 max-h-72 overflow-y-auto">
                      {(() => {
                        const searchList = [...new Set([...favoriteDrugs, ...customDrugs, ...EGYPTIAN_DRUGS])];
                        const filtered = searchList.filter(d => d.toLowerCase().includes(drugSearch.toLowerCase())).slice(0, 50);
                        const exactMatch = searchList.find(d => d.toLowerCase() === drugSearch.toLowerCase());
                        
                        return (
                          <>
                            {filtered.map(drug => {
                              const isFav = favoriteDrugs.includes(drug);
                              return (
                                <div 
                                  key={drug} 
                                  className="p-3 hover:bg-slate-50 cursor-pointer text-sm font-bold border-b last:border-none flex justify-between items-center"
                                  onClick={() => {
                                    const emptyDrug = drugs.find(d => !d.name)
                                    if (emptyDrug) updateDrug(emptyDrug.id, 'name', drug)
                                    else setDrugs([...drugs, { id: Date.now(), name: drug, dosage: '', duration: '' }])
                                    setDrugSearch('')
                                  }}
                                >
                                  <span dir="ltr" className={isFav ? 'text-primary' : 'text-slate-700'}>{drug}</span>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className={`h-8 w-8 rounded-full ${isFav ? 'text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50' : 'text-slate-300 hover:text-yellow-500 hover:bg-yellow-50'}`}
                                    onClick={(e) => toggleFavorite(e, drug)}
                                  >
                                    <Star className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                                  </Button>
                                </div>
                              )
                            })}
                            {!exactMatch && (
                              <div className="p-3 bg-slate-50 border-t flex justify-between items-center">
                                <span className="text-sm font-bold text-slate-500">غير موجود في القاعدة؟</span>
                                <Button size="sm" onClick={() => addCustomDrug(drugSearch)} className="h-8">
                                  <Plus className="w-4 h-4 ml-1" /> إضافة "{drugSearch}"
                                </Button>
                              </div>
                            )}
                          </>
                        )
                      })()}
                    </div>
                  )}
                </div>

                
                {/* Manage Favorites Dialog */}
                <Dialog open={isFavoritesOpen} onOpenChange={setIsFavoritesOpen}>
                  
                    <Button variant="outline" onClick={() => setIsFavoritesOpen(true)} className="h-12 border-primary/20 text-primary hover:bg-primary/5 px-6">
                      <Star className="w-5 h-5 ml-2 fill-primary" /> إدارة أدويتي
                    </Button>
                  
                  <DialogContent className="max-w-2xl" dir="rtl">
                    <DialogHeader>
                      <DialogTitle className="text-xl flex items-center gap-2 text-primary">
                        <Pill className="w-6 h-6 fill-primary/20 text-primary" /> إدارة الأدوية الخاصة بالعيادة
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 my-2">
                      <div className="bg-slate-50 p-4 rounded-xl border">
                        <Label className="font-bold text-primary mb-2 block">إضافة أدوية متعددة دفعة واحدة (Bulk Add)</Label>
                        <p className="text-sm text-slate-500 mb-2">انسخ أسماء الأدوية الخاصة بتخصصك من أي ملف (Excel أو Word) والصقها هنا، بحيث يكون كل دواء في سطر منفصل.</p>
                        <div className="flex gap-2">
                          <textarea 
                            id="bulkDrugsInput"
                            placeholder="مثال:
Amoxicillin 500mg
Panadol Extra
Brufen 400" 
                            className="w-full h-24 p-2 text-sm border rounded-md"
                            dir="ltr"
                          />
                          <Button 
                            className="h-24 px-8 font-bold"
                            onClick={async () => {
                              const textarea = document.getElementById('bulkDrugsInput') as HTMLTextAreaElement;
                              const lines = textarea.value.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                              if(lines.length === 0) return toast.error('الرجاء إدخال أدوية أولاً');
                              if(!clinicId) return;
                              
                              const newCustom = [...new Set([...customDrugs, ...lines])];
                              setCustomDrugs(newCustom);
                              try {
                                await updateDoc(doc(db, 'clinics', clinicId), { customDrugs: newCustom });
                                toast.success(`تم إضافة ${lines.length} دواء بنجاح!`);
                                textarea.value = '';
                              } catch(err) {
                                toast.error('حدث خطأ');
                              }
                            }}
                          >
                            حفظ <br/> الكل
                          </Button>
                        </div>
                      </div>

                      <div className="max-h-64 overflow-y-auto px-2">
                        <h4 className="font-bold mb-2">الأدوية المفضلة والخاصة بك ({favoriteDrugs.length + customDrugs.length})</h4>
                        {favoriteDrugs.length === 0 && customDrugs.length === 0 ? (
                          <p className="text-center text-slate-500 py-4">لا توجد أدوية خاصة بك حتى الآن.</p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {[...new Set([...favoriteDrugs, ...customDrugs])].map(drug => (
                              <div key={drug} className="flex justify-between items-center p-2 border rounded-xl bg-white hover:bg-slate-50 transition-colors">
                                <span className="font-bold text-sm text-primary truncate pl-2" dir="ltr">{drug}</span>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 w-8 shrink-0"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if(!clinicId) return;
                                    const newFavs = favoriteDrugs.filter(d => d !== drug);
                                    const newCustom = customDrugs.filter(d => d !== drug);
                                    setFavoriteDrugs(newFavs);
                                    setCustomDrugs(newCustom);
                                    await updateDoc(doc(db, 'clinics', clinicId), { favoriteDrugs: newFavs, customDrugs: newCustom });
                                    toast.success('تم الحذف');
                                  }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

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
