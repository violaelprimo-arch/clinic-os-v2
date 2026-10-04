'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Plus, Trash2, Building, Image as ImageIcon, MapPin, TextSelect, FileEdit, Lock, ShieldAlert, CheckCircle, XCircle, Edit } from 'lucide-react'
import { db } from '@/lib/firebase'
import { collection, addDoc, getDocs, deleteDoc, updateDoc, doc } from 'firebase/firestore'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'

export default function OwnerDashboard() {
  const [clinics, setClinics] = useState<any[]>([])
  
  // Edit mode
  const [editingId, setEditingId] = useState<string | null>(null)

  // Comprehensive form state
  const [clinicName, setClinicName] = useState('')
  const [doctorName, setDoctorName] = useState('')
  const [doctorPhone, setDoctorPhone] = useState('')
  const [clinicPhone, setClinicPhone] = useState('')
  const [slug, setSlug] = useState('')
  const [mapsLink, setMapsLink] = useState('')
  const [doctorEmail, setDoctorEmail] = useState('')
  const [doctorPassword, setDoctorPassword] = useState('')
  const [assistantEmail, aiApiKey, setAssistantEmail] = useState(''); const [aiApiKey, setAiApiKey] = useState('');
  const [assistantPassword, setAssistantPassword] = useState('')
  const [heroImage, setHeroImage] = useState('https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=2000&auto=format&fit=crop')
  const [heroTitle, setHeroTitle] = useState('صحتك تستحق العناية الفائقة')
  const [heroSubtitle, setHeroSubtitle] = useState('نقدم لك ولعائلتك رعاية صحية متكاملة تعتمد على أحدث التقنيات وأفضل الكوادر الطبية المتخصصة لضمان سلامتك وتوفير راحتك.')
  
  // Badges state
  const [badge1Title, setBadge1Title] = useState('أطباء معتمدون')
  const [badge1Value, setBadge1Value] = useState('خبرة +15 سنة')
  const [badge2Title, setBadge2Title] = useState('تقييم العيادة')
  const [badge2Value, setBadge2Value] = useState('4.9/5.0')

  const [activationDate, setActivationDate] = useState(new Date().toISOString().split('T')[0])
  const [expirationDate, setExpirationDate] = useState('')
  const [isActive, setIsActive] = useState(true)

  const [isLoading, setIsLoading] = useState(false)

  const loadClinics = async () => {
    const snap = await getDocs(collection(db, 'clinics'))
    setClinics(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  }

  useEffect(() => {
    loadClinics()
  }, [])

  const handleAddOrUpdateClinic = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
    try {
      const clinicData = {
        clinicName,
        doctorName,
        doctorPhone,
        clinicPhone,
        slug,
        mapsLink,
        doctorEmail,
        doctorPassword, 
        assistantEmail, aiApiKey,
        assistantPassword,
        heroImage,
        heroTitle,
        heroSubtitle,
        badge1Title,
        badge1Value,
        badge2Title,
        badge2Value,
        activationDate,
        expirationDate,
        isActive,
        updatedAt: new Date().toISOString()
      }
      
      if (editingId) {
        await updateDoc(doc(db, 'clinics', editingId), clinicData)
        toast.success('تم تحديث بيانات العيادة بنجاح!')
        setEditingId(null)
      } else {
        await addDoc(collection(db, 'clinics'), { ...clinicData, createdAt: new Date().toISOString() })
        toast.success('تم إضافة العيادة بكامل تفاصيلها بنجاح!')
      }
      
      // Reset form
      setClinicName('')
      setDoctorName('')
      setDoctorPhone('')
      setClinicPhone('')
      setSlug('')
      setMapsLink('')
      setDoctorEmail('')
      setDoctorPassword('')
      setAssistantEmail(''); setAiApiKey('');
      setAssistantPassword('')
      setHeroImage('https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=2000&auto=format&fit=crop')
      setHeroTitle('صحتك تستحق العناية الفائقة')
      setHeroSubtitle('نقدم لك ولعائلتك رعاية صحية متكاملة تعتمد على أحدث التقنيات وأفضل الكوادر الطبية المتخصصة لضمان سلامتك وتوفير راحتك.')
      setBadge1Title('أطباء معتمدون')
      setBadge1Value('خبرة +15 سنة')
      setBadge2Title('تقييم العيادة')
      setBadge2Value('4.9/5.0')
      
      loadClinics()
    } catch (err: any) {
      toast.error('حدث خطأ أثناء حفظ البيانات: ' + err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = (c: any) => {
    setEditingId(c.id)
    setClinicName(c.clinicName || '')
    setDoctorName(c.doctorName || '')
    setDoctorPhone(c.doctorPhone || '')
    setClinicPhone(c.clinicPhone || '')
    setSlug(c.slug || '')
    setMapsLink(c.mapsLink || '')
    setDoctorEmail(c.doctorEmail || '')
    setDoctorPassword(c.doctorPassword || '')
    setAssistantEmail(c.assistantEmail || ''); setAiApiKey(c.aiApiKey || '');
    setAssistantPassword(c.assistantPassword || '')
    setHeroImage(c.heroImage || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=2000&auto=format&fit=crop')
    setHeroTitle(c.heroTitle || 'صحتك تستحق العناية الفائقة')
    setHeroSubtitle(c.heroSubtitle || 'نقدم لك ولعائلتك رعاية صحية متكاملة تعتمد على أحدث التقنيات وأفضل الكوادر الطبية المتخصصة لضمان سلامتك وتوفير راحتك.')
    setBadge1Title(c.badge1Title || 'أطباء معتمدون')
    setBadge1Value(c.badge1Value || 'خبرة +15 سنة')
    setBadge2Title(c.badge2Title || 'تقييم العيادة')
    setBadge2Value(c.badge2Value || '4.9/5.0')
    setActivationDate(c.activationDate || new Date().toISOString().split('T')[0])
    setExpirationDate(c.expirationDate || '')
    setIsActive(c.isActive !== false)

    window.scrollTo({ top: 0, behavior: 'smooth' })
    toast.info('جاري تعديل بيانات العيادة. يمكنك تعديل الحقول ثم الضغط على "تحديث".')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setClinicName('')
    setDoctorName('')
    setSlug('')
    //... could reset all, but reloading is easier
    toast.info('تم إلغاء التعديل')
  }

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'clinics', id), { isActive: !currentStatus })
      toast.success(currentStatus ? 'تم إيقاف العيادة مؤقتاً' : 'تم تفعيل العيادة')
      loadClinics()
    } catch (err) {
      toast.error('حدث خطأ أثناء التحديث')
    }
  }

  const deleteClinic = async (id: string) => {
    if(confirm('تحذير: سيتم حذف العيادة نهائياً من قاعدة البيانات! هل أنت متأكد؟')) {
      try {
        await deleteDoc(doc(db, 'clinics', id))
        toast.success('تم حذف العيادة نهائياً')
        if (editingId === id) cancelEdit()
        loadClinics()
      } catch (err) {
        toast.error('حدث خطأ أثناء الحذف')
      }
    }
  }

  return (
    <div className="space-y-8" dir="rtl">
      <Card className={`shadow-2xl border-t-4 overflow-hidden transition-all ${editingId ? 'border-t-blue-500 ring-2 ring-blue-500/20' : 'border-t-amber-500'}`}>
        <CardHeader className={`${editingId ? 'bg-blue-50' : 'bg-slate-50'} border-b transition-colors`}>
          <CardTitle className="text-2xl flex items-center gap-2">
            {editingId ? <Edit className="w-6 h-6 text-blue-500" /> : <Building className="w-6 h-6 text-amber-500" />} 
            {editingId ? 'تعديل بيانات العيادة' : 'إضافة عيادة جديدة وتكوين النظام'}
          </CardTitle>
          <CardDescription>
            {editingId ? 'أنت الآن تقوم بتعديل العيادة المحددة. اضغط "تحديث" لحفظ التغييرات.' : 'تحكم كامل في بيانات العيادة، الصلاحيات، الصور، والاشتراكات.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleAddOrUpdateClinic} className="space-y-8">
            
            {/* Section 1: Basic Info */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold flex items-center gap-2 text-slate-700 border-b pb-2"><FileEdit className="w-5 h-5"/> البيانات الأساسية</h3>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2"><Label>اسم الطبيب</Label><Input value={doctorName} onChange={e => setDoctorName(e.target.value)} required placeholder="د. أحمد محمد" /></div>
                <div className="space-y-2"><Label>اسم العيادة</Label><Input value={clinicName} onChange={e => setClinicName(e.target.value)} required placeholder="عيادة الشفاء" /></div>
                <div className="space-y-2"><Label>الرابط (Slug)</Label><Input value={slug} onChange={e => setSlug(e.target.value)} required placeholder="ahmed-clinic" dir="ltr" className="text-right" disabled={!!editingId} /></div>
              </div>
            </div>

            {/* Section 2: Contact Info */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold flex items-center gap-2 text-slate-700 border-b pb-2"><MapPin className="w-5 h-5"/> أرقام التواصل والموقع</h3>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2"><Label>رقم تليفون الطبيب (شخصي)</Label><Input value={doctorPhone} onChange={e => setDoctorPhone(e.target.value)} dir="ltr" className="text-right" /></div>
                <div className="space-y-2"><Label>رقم العيادة (واتساب الحجز)</Label><Input value={clinicPhone} onChange={e => setClinicPhone(e.target.value)} required dir="ltr" className="text-right" /></div>
                <div className="space-y-2"><Label>رابط جوجل ماب (Location)</Label><Input value={mapsLink} onChange={e => setMapsLink(e.target.value)} dir="ltr" className="text-right" placeholder="https://maps.google.com/..." /></div>
              </div>
            </div>

            {/* Section 3: Authentication & Accounts */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold flex items-center gap-2 text-slate-700 border-b pb-2"><Lock className="w-5 h-5"/> حسابات الدخول (الطبيب والمساعدين)</h3>
              <div className="grid md:grid-cols-2 gap-8 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="space-y-4">
                  <h4 className="font-bold text-primary">حساب الطبيب (صلاحيات كاملة)</h4>
                  <div className="space-y-2"><Label>الإيميل</Label><Input type="email" value={doctorEmail} onChange={e => setDoctorEmail(e.target.value)} required dir="ltr" className="text-right" /></div>
                  <div className="space-y-2"><Label>الباسورد</Label><Input value={doctorPassword} onChange={e => setDoctorPassword(e.target.value)} required minLength={6} dir="ltr" className="text-right" /></div>
                </div>
                <div className="space-y-4">
                  <h4 className="font-bold text-green-600">حساب المساعد (صلاحيات محدودة - مستقبلاً)</h4>
                  <div className="space-y-2"><Label>إيميل المساعد</Label><Input type="email" value={assistantEmail} onChange={e => setAssistantEmail(e.target.value)} dir="ltr" className="text-right" /></div>
                  <div className="space-y-2"><Label>باسورد المساعد</Label><Input value={assistantPassword} onChange={e => setAssistantPassword(e.target.value)} minLength={6} dir="ltr" className="text-right" /></div>
                </div>
              </div>
            </div>

            {/* Section 4: Content & UI Customization */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold flex items-center gap-2 text-slate-700 border-b pb-2"><ImageIcon className="w-5 h-5"/> تخصيص واجهة المرضى (Landing Page)</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>رابط صورة الغلاف الرئيسية (Hero Image URL)</Label>
                  <Input value={heroImage} onChange={e => setHeroImage(e.target.value)} dir="ltr" className="text-right" placeholder="https://..." />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>العنوان الرئيسي العريض</Label>
                    <Input value={heroTitle} onChange={e => setHeroTitle(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>نبذة عن الطبيب (النص التعريفي)</Label>
                    <Textarea value={heroSubtitle} onChange={e => setHeroSubtitle(e.target.value)} rows={3} />
                  </div>
                </div>
                
                {/* Badges Settings */}
                <div className="bg-white border rounded-xl p-4 space-y-4">
                  <h4 className="font-bold text-slate-700">تخصيص الشارات العائمة (Floating Badges)</h4>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-3 bg-green-50/50 p-4 rounded-lg border border-green-100">
                      <p className="text-sm font-bold text-green-700">الشارة الأولى (الخضراء)</p>
                      <div className="space-y-1"><Label>العنوان الصغير</Label><Input value={badge1Title} onChange={e => setBadge1Title(e.target.value)} placeholder="أطباء معتمدون" /></div>
                      <div className="space-y-1"><Label>القيمة البارزة</Label><Input value={badge1Value} onChange={e => setBadge1Value(e.target.value)} placeholder="خبرة +15 سنة" /></div>
                    </div>
                    <div className="space-y-3 bg-amber-50/50 p-4 rounded-lg border border-amber-100">
                      <p className="text-sm font-bold text-amber-700">الشارة الثانية (الصفراء)</p>
                      <div className="space-y-1"><Label>العنوان الصغير</Label><Input value={badge2Title} onChange={e => setBadge2Title(e.target.value)} placeholder="تقييم العيادة" /></div>
                      <div className="space-y-1"><Label>القيمة البارزة</Label><Input value={badge2Value} onChange={e => setBadge2Value(e.target.value)} placeholder="4.9/5.0" /></div>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Section 5: Subscription & Status */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold flex items-center gap-2 text-slate-700 border-b pb-2"><ShieldAlert className="w-5 h-5"/> حالة الاشتراك والتفعيل</h3>
              <div className="grid md:grid-cols-3 gap-4 items-center bg-amber-50/50 p-4 rounded-xl border border-amber-100">
                <div className="space-y-2"><Label>تاريخ التفعيل (البداية)</Label><Input type="date" value={activationDate} onChange={e => setActivationDate(e.target.value)} /></div>
                <div className="space-y-2"><Label>تاريخ الانتهاء</Label><Input type="date" value={expirationDate} onChange={e => setExpirationDate(e.target.value)} placeholder="اختياري" /></div>
                <div className="space-y-2 flex flex-col justify-center pt-6">
                  <div className="flex items-center gap-2">
                    <Switch checked={isActive} onCheckedChange={setIsActive} />
                    <Label className="font-bold cursor-pointer" onClick={() => setIsActive(!isActive)}>العيادة مفعلة وتعمل الآن</Label>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <Button type="submit" className={`flex-1 h-14 text-xl font-bold text-white rounded-xl shadow-lg ${editingId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-amber-600 hover:bg-amber-700'}`} disabled={isLoading}>
                {editingId ? <Edit className="w-6 h-6 ml-2" /> : <Plus className="w-6 h-6 ml-2" />}
                {isLoading ? 'جاري المعالجة...' : editingId ? 'تحديث بيانات العيادة' : 'حفظ وإضافة العيادة للنظام'}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={cancelEdit} className="h-14 px-8 text-lg font-bold rounded-xl" disabled={isLoading}>
                  إلغاء التعديل
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Clinics List */}
      <Card>
        <CardHeader>
          <CardTitle>العيادات المسجلة وإدارة الاشتراكات</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right border-collapse">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="p-4 border-b">اسم العيادة / الطبيب</th>
                  <th className="p-4 border-b">الرابط</th>
                  <th className="p-4 border-b">الاشتراك</th>
                  <th className="p-4 border-b">الحالة</th>
                  <th className="p-4 border-b">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {clinics.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-500">لا يوجد عيادات مضافة حتى الآن.</td>
                  </tr>
                ) : (
                  clinics.map(c => (
                    <tr key={c.id} className={`border-b last:border-0 hover:bg-slate-50 transition-colors ${editingId === c.id ? 'bg-blue-50/50' : ''}`}>
                      <td className="p-4">
                        <div className="font-bold text-slate-900">{c.clinicName}</div>
                        <div className="text-xs text-gray-500">د. {c.doctorName}</div>
                      </td>
                      <td className="p-4 dir-ltr text-right space-y-1">
                        <div>
                          <a href={`/clinic/${c.slug}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-bold text-sm">صفحة المريض</a>
                        </div>
                        <div>
                          <a href={`/clinic/${c.slug}/login`} target="_blank" rel="noreferrer" className="text-amber-600 hover:underline text-xs">بوابة الطاقم</a>
                        </div>
                      </td>
                      <td className="p-4 text-xs space-y-1">
                        <div>بدأ: {c.activationDate}</div>
                        <div className="text-red-500">ينتهي: {c.expirationDate || 'مفتوح'}</div>
                      </td>
                      <td className="p-4">
                        {c.isActive ? (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-none">مفعل</Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-none">موقوف</Badge>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(c)} className="text-blue-600 border-blue-200 hover:bg-blue-50">
                            <Edit className="w-4 h-4 ml-1" />
                            تعديل
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => toggleStatus(c.id, c.isActive)} className={c.isActive ? "text-amber-600 border-amber-200 hover:bg-amber-50" : "text-green-600 border-green-200 hover:bg-green-50"}>
                            {c.isActive ? <XCircle className="w-4 h-4 ml-1" /> : <CheckCircle className="w-4 h-4 ml-1" />}
                            {c.isActive ? 'إيقاف مؤقت' : 'تفعيل'}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => deleteClinic(c.id)} className="text-red-600 border-red-200 hover:bg-red-50">
                            <Trash2 className="w-4 h-4 ml-1" />
                            حذف نهائي
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
