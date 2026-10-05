'use client'

import { use, useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Plus, Printer, Trash2, Search, FileSignature, MapPin, Phone, User as UserIcon, Stethoscope, Activity } from 'lucide-react'
import { toast } from 'sonner'
import { db } from '@/lib/firebase'
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore'
import { useSearchParams } from 'next/navigation'
import { useEgyptianDrugs } from '@/hooks/useEgyptianDrugs'
import { doc, updateDoc } from 'firebase/firestore'
import { Star, Settings2, ShieldCheck, Pill } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Caveat } from 'next/font/google'

const caveat = Caveat({ subsets: ['latin'], weight: ['400', '700'] })

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
  const [date] = useState(new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0])
  const [todayPatients, setTodayPatients] = useState<any[]>([])

  const { drugs: pubDrugs, loading: loadingPubDrugs } = useEgyptianDrugs()

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

        // Fetch today's patients for auto-fill
        try {
          const today = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]
          const apptsQ = query(collection(db, 'appointments'), where('clinic_id', '==', cDoc.id), where('date', '==', today))
          const apptsSnap = await getDocs(apptsQ)
          const appts = apptsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any))
          
          setTodayPatients(appts)

          // Auto-fill logic (only if not passed via URL)
          if (!searchParams?.get('patientName')) {
            const completedAppts = appts.filter(a => a.status === 'completed' && a.completedAt)
            completedAppts.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
            
            if (completedAppts.length > 0) {
              setPatientName(completedAppts[0].patientName || '')
              setPatientPhone(completedAppts[0].phone || '')
            } else {
              const waitingAppts = appts.filter(a => a.status === 'waiting')
              if (waitingAppts.length > 0) {
                setPatientName(waitingAppts[0].patientName || '')
                setPatientPhone(waitingAppts[0].phone || '')
              }
            }
          }
        } catch(e) {}
      }
    }
    fetchClinic()
  }, [slug, searchParams])

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
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg">بيانات المريض</CardTitle>
                {todayPatients.length > 0 && (
                  <select 
                    className="text-sm border rounded p-1 bg-white"
                    onChange={(e) => {
                      if(e.target.value) {
                        const p = todayPatients.find(x => x.id === e.target.value)
                        if(p) {
                          setPatientName(p.patientName || '')
                          setPatientPhone(p.phone || '')
                        }
                      }
                    }}
                  >
                    <option value="">-- اختر من كشوفات اليوم --</option>
                    {todayPatients.map(p => (
                      <option key={p.id} value={p.id}>{p.patientName} ({p.queue_number})</option>
                    ))}
                  </select>
                )}
              </div>
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
                    placeholder={loadingPubDrugs ? "جاري تحميل قاعدة الأدوية (25,000+ دواء)..." : "ابحث عن الدواء في قاعدة البيانات (25,000+ دواء)..."}
                    value={drugSearch}
                    onChange={e => setDrugSearch(e.target.value)}
                    className="pr-10 bg-slate-50 border-primary/20 focus:border-primary h-12 text-lg font-bold"
                  />
                  {drugSearch && (
                    <div className="absolute w-full mt-1 bg-white border shadow-2xl rounded-xl overflow-hidden z-50 max-h-72 overflow-y-auto">
                      {(() => {
                        const publicDrugNames = pubDrugs.map(d => d.commercial_name_en);
                        const publicDrugNamesAr = pubDrugs.map(d => d.commercial_name_ar).filter(Boolean);
                        const searchList = [...new Set([...favoriteDrugs, ...customDrugs, ...publicDrugNames, ...publicDrugNamesAr])];
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
        <div className="md:col-span-7 print:col-span-12 print:m-0 print:p-0" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
          {(() => {
            const drugsPerPage = 5;
            const chunkedDrugs = [];
            const activeDrugs = drugs.filter(d => d.name.trim() !== '' || drugs.length === 1);
            for (let i = 0; i < activeDrugs.length; i += drugsPerPage) {
              chunkedDrugs.push(activeDrugs.slice(i, i + drugsPerPage));
            }
            if (chunkedDrugs.length === 0) chunkedDrugs.push([]);
            
            const rxColor = clinic?.rxColor || clinic?.primaryColor || '#1e3a8a';
            const rxLogo = clinic?.rxLogo || clinic?.heroImage || '';
            const rxDoctorName = clinic?.rxDoctorName || clinic?.doctorName || 'اسم الطبيب';
            const rxSpecialty = clinic?.rxSpecialty || clinic?.specialtySubtitle || 'التخصص';
            const rxFooterText = clinic?.rxFooterText || `العنوان: ${clinic?.clinicAddress || ''} | محمول: ${clinic?.clinicPhones?.[0] || ''}`;

            return chunkedDrugs.map((pageDrugs, pageIndex) => (
              <div key={pageIndex} className="mx-auto bg-white shadow-2xl w-[210mm] min-h-[297mm] relative overflow-hidden print:shadow-none print:w-full print:h-auto print:min-h-0 mb-8 print:mb-0 break-after-page print:break-inside-avoid print:!bg-white print:scale-100 origin-top flex flex-col border border-slate-200 print:border-none">
                <style dangerouslySetInnerHTML={{__html: `@page { size: A4; margin: 0; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }`}} />
                
                {/* SVG Header Curve Background */}
                <div className="absolute top-0 left-0 w-full h-48 z-0">
                  <svg viewBox="0 0 1440 320" className="w-full h-full -scale-x-100" preserveAspectRatio="none">
                    <path fill={rxColor} fillOpacity="1" d="M0,64L80,64C160,64,320,64,480,101.3C640,139,800,213,960,229.3C1120,245,1280,203,1360,181.3L1440,160L1440,0L1360,0C1280,0,1120,0,960,0C800,0,640,0,480,0C320,0,160,0,80,0L0,0Z"></path>
                  </svg>
                </div>

                {/* SVG Footer Curve Background */}
                <div className="absolute bottom-0 left-0 w-full h-32 z-0">
                  <svg viewBox="0 0 1440 320" className="w-full h-full -scale-x-100" preserveAspectRatio="none">
                    <path fill={rxColor} fillOpacity="1" d="M0,192L80,197.3C160,203,320,213,480,202.7C640,192,800,160,960,170.7C1120,181,1280,235,1360,261.3L1440,288L1440,320L1360,320C1280,320,1120,320,960,320C800,320,640,320,480,320C320,320,160,320,80,320L0,320Z"></path>
                  </svg>
                </div>

                {/* Watermark Logo */}
                {rxLogo && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.07] z-0 pointer-events-none grayscale">
                    <img src={rxLogo} alt="Watermark" className="w-96 h-96 object-contain" />
                  </div>
                )}

                <div className="relative z-10 flex-1 flex flex-col p-8 pt-12">
                  {/* Header Content */}
                  <div className="flex justify-between items-start mb-12">
                    {/* Doctor Details (Right) */}
                    <div className="text-right text-white pt-2 z-10 w-2/3">
                      <div className="text-sm font-bold opacity-90 mb-1">دكتور</div>
                      <h1 className="text-4xl font-black mb-2">{rxDoctorName}</h1>
                      <h2 className="text-lg font-bold opacity-90">{rxSpecialty}</h2>
                    </div>

                    {/* Logo (Left) */}
                    <div className="w-32 h-32 rounded-full bg-white p-2 shadow-lg border-4 flex items-center justify-center overflow-hidden z-10" style={{ borderColor: rxColor }}>
                      {rxLogo ? (
                        <img src={rxLogo} alt="Logo" className="w-full h-full object-contain" />
                      ) : (
                        <Activity className="w-12 h-12" style={{ color: rxColor }} />
                      )}
                    </div>
                  </div>

                  {/* Patient Info Table */}
                  <div className="w-full border-t-2 border-b-2 py-4 mb-8" style={{ borderColor: rxColor }}>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-end gap-2 text-lg">
                        <span className="font-bold" style={{ color: rxColor }}>الاسم :</span>
                        <span className="font-black flex-1 border-b-2 border-dotted pb-1 text-slate-800 border-slate-400">
                          {patientName || '\u00A0'}
                        </span>
                      </div>
                      <div className="flex items-end gap-2 text-lg">
                        <span className="font-bold" style={{ color: rxColor }}>التاريخ :</span>
                        <span className="font-bold flex-1 border-b-2 border-dotted pb-1 text-slate-800 border-slate-400 text-center" dir="ltr">
                          {date}
                        </span>
                      </div>
                      <div className="flex items-end gap-2 text-lg">
                        <span className="font-bold" style={{ color: rxColor }}>التشخيص :</span>
                        <span className="font-bold flex-1 border-b-2 border-dotted pb-1 text-slate-800 border-slate-400">
                          {'\u00A0'}
                        </span>
                      </div>
                      <div className="flex items-end gap-2 text-lg">
                        <span className="font-bold" style={{ color: rxColor }}>السن :</span>
                        <span className="font-bold flex-1 border-b-2 border-dotted pb-1 text-slate-800 border-slate-400 text-center">
                          {'\u00A0'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Rx Symbol */}
                  <div className="mb-6 flex" dir="ltr">
                    <div className={`text-6xl font-black ${caveat.className}`} style={{ color: rxColor }}>
                      Rx:
                    </div>
                  </div>

                  {/* Drugs List (Left to Right) */}
                  <div className="flex-1 px-8 space-y-8 z-10 pb-32" dir="ltr">
                    {pageDrugs.map((drug, idx) => (
                      <div key={drug.id || idx} className="pl-6 border-l-4" style={{ borderColor: `${rxColor}30` }}>
                        <h3 className={`text-4xl font-bold text-slate-900 capitalize w-full tracking-wide ${caveat.className}`}>
                          {drug.name || '\u00A0'}
                        </h3>
                        <div className="flex gap-4 text-slate-700 font-bold mt-2 text-lg">
                          <span>{drug.dosage || ''}</span>
                          {drug.duration && <span className="text-slate-300">|</span>}
                          <span>{drug.duration || ''}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer Content */}
                <div className="relative z-10 w-full pb-6 pt-16 px-8 mt-auto flex justify-between items-end">
                  <div className="text-xs text-white/70 text-right w-24">
                    {chunkedDrugs.length > 1 && (
                      <span>صفحة {pageIndex + 1} / {chunkedDrugs.length}</span>
                    )}
                  </div>
                  <div className="flex-1 font-bold text-sm tracking-wide px-4 text-center text-white" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                    {rxFooterText}
                  </div>
                  <div className="text-xs text-white/70 text-left w-24">
                    <span>Powered by Almaher</span>
                  </div>
                </div>

              </div>
            ));
          })()}
        </div>
      </div>
    </div>
  )
}
