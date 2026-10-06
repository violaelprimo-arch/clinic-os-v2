'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Plus, Trash2, Building, Image as ImageIcon, MapPin,
  FileEdit, Lock, ShieldAlert, CheckCircle, XCircle, Edit,
  Bot, FileSignature, Phone, MessageSquare, Sparkles, Upload
} from 'lucide-react'
import { db } from '@/lib/firebase'
import { collection, addDoc, getDocs, deleteDoc, updateDoc, doc, setDoc } from 'firebase/firestore'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { motion } from 'framer-motion'

export default function OwnerDashboard() {
  const [clinics, setClinics] = useState<any[]>([])

  // Edit mode
  const [editingId, setEditingId] = useState<string | null>(null)
  const [globalApiKey, setGlobalApiKey] = useState('')
  const [isSavingGlobal, setIsSavingGlobal] = useState(false)

  // Clinic fields
  const [clinicName, setClinicName] = useState('')
  const [doctorName, setDoctorName] = useState('')
  const [doctorPhone, setDoctorPhone] = useState('')
  const [clinicPhone, setClinicPhone] = useState('')
  const [slug, setSlug] = useState('')
  const [mapsLink, setMapsLink] = useState('')
  const [doctorEmail, setDoctorEmail] = useState('')
  const [doctorPassword, setDoctorPassword] = useState('')
  const [assistantEmail, setAssistantEmail] = useState('')
  const [assistantPassword, setAssistantPassword] = useState('')
  const [aiApiKey, setAiApiKey] = useState('')
  
  // NEW: Prescription design image & AI Toggle
  const [prescriptionTemplateUrl, setPrescriptionTemplateUrl] = useState('')
  const [aiEnabled, setAiEnabled] = useState(true)

  // Landing page customization
  const [heroImage, setHeroImage] = useState('https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=2000&auto=format&fit=crop')
  const [heroTitle, setHeroTitle] = useState('صحتك تستحق العناية الفائقة')
  const [heroSubtitle, setHeroSubtitle] = useState('نقدم لك ولعائلتك رعاية صحية متكاملة تعتمد على أحدث التقنيات وأفضل الكوادر الطبية المتخصصة لضمان سلامتك وتوفير راحتك.')

  // Badges
  const [badge1Title, setBadge1Title] = useState('أطباء معتمدون')
  const [badge1Value, setBadge1Value] = useState('خبرة +15 سنة')
  const [badge2Title, setBadge2Title] = useState('تقييم العيادة')
  const [badge2Value, setBadge2Value] = useState('4.9/5.0')

  const getLocalDate = () => new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]
  const [activationDate, setActivationDate] = useState(getLocalDate())
  const [expirationDate, setExpirationDate] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [isLoading, setIsLoading] = useState(false)

  const loadClinics = async () => {
    const snap = await getDocs(collection(db, 'clinics'))
    setClinics(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  }

  useEffect(() => {
    const fetchGlobal = async () => {
      try {
        const snap = await getDocs(collection(db, 'system'))
        const configDoc = snap.docs.find(d => d.id === 'config')
        if (configDoc && configDoc.data().globalAiKey) {
          setGlobalApiKey(configDoc.data().globalAiKey)
        }
      } catch (err) {}
    }
    fetchGlobal()
    loadClinics()
  }, [])

  const handlePrescriptionUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        toast.error('حجم الصورة كبير، يرجى اختيار صورة أقل من 3 ميجابايت')
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        setPrescriptionTemplateUrl(reader.result as string)
        toast.success('تم تحميل صورة تصميم الروشتة بنجاح!')
      }
      reader.readAsDataURL(file)
    }
  }

  const saveGlobalKey = async () => {
    setIsSavingGlobal(true)
    try {
      await setDoc(doc(db, 'system', 'config'), { globalAiKey: globalApiKey }, { merge: true })
      toast.success('تم حفظ مفتاح الذكاء الاصطناعي المركزي بنجاح!')
    } catch (err) {
      toast.error('حدث خطأ أثناء حفظ المفتاح المركزي')
    }
    setIsSavingGlobal(false)
  }

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
        assistantEmail,
        assistantPassword,
        aiApiKey,
        prescriptionTemplateUrl,
        aiEnabled: aiEnabled !== false,
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
      setAssistantEmail('')
      setAssistantPassword('')
      setAiApiKey('')
      setPrescriptionTemplateUrl('')
      setAiEnabled(true)
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
    setAssistantEmail(c.assistantEmail || '')
    setAssistantPassword(c.assistantPassword || '')
    setAiApiKey(c.aiApiKey || '')
    setPrescriptionTemplateUrl(c.prescriptionTemplateUrl || '')
    setAiEnabled(c.aiEnabled !== false)
    setHeroImage(c.heroImage || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=2000&auto=format&fit=crop')
    setHeroTitle(c.heroTitle || 'صحتك تستحق العناية الفائقة')
    setHeroSubtitle(c.heroSubtitle || 'نقدم لك ولعائلتك رعاية صحية متكاملة تعتمد على أحدث التقنيات وأفضل الكوادر الطبية المتخصصة لضمان سلامتك وتوفير راحتك.')
    setBadge1Title(c.badge1Title || 'أطباء معتمدون')
    setBadge1Value(c.badge1Value || 'خبرة +15 سنة')
    setBadge2Title(c.badge2Title || 'تقييم العيادة')
    setBadge2Value(c.badge2Value || '4.9/5.0')
    setActivationDate(c.activationDate || getLocalDate())
    setExpirationDate(c.expirationDate || '')
    setIsActive(c.isActive !== false)

    window.scrollTo({ top: 0, behavior: 'smooth' })
    toast.info('جاري تعديل بيانات العيادة.')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setClinicName('')
    setDoctorName('')
    setSlug('')
    setPrescriptionTemplateUrl('')
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

  const toggleClinicAi = async (id: string, currentAi: boolean) => {
    try {
      const nextAi = !currentAi
      await updateDoc(doc(db, 'clinics', id), { aiEnabled: nextAi })
      toast.success(nextAi ? 'تم تفعيل المساعد الذكي AI لهذه العيادة' : 'تم تعطيل وإخفاء المساعد الذكي AI عن العيادة')
      loadClinics()
    } catch (err) {
      toast.error('حدث خطأ أثناء تعديل حالة الذكاء الاصطناعي')
    }
  }

  const deleteClinic = async (id: string) => {
    if (confirm('تحذير: سيتم حذف العيادة نهائياً من قاعدة البيانات! هل أنت متأكد؟')) {
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
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-8"
      dir="rtl"
    >
      {/* 1. Global AI Key Config Card */}
      <Card className="border-t-4 border-t-purple-500 shadow-xl bg-white rounded-2xl">
        <CardHeader className="bg-purple-50/50 pb-4">
          <CardTitle className="text-xl font-black text-purple-800 flex items-center gap-2">
            <Bot className="w-5 h-5 text-purple-600" />
            إعدادات النظام المركزية للذكاء الاصطناعي (OpenAI / Gemini)
          </CardTitle>
          <CardDescription>
            المفتاح المركزي الذي يشغل الذكاء الاصطناعي لكافة العيادات المشتركة التي يسمح لها المالك بذلك.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              type="password"
              value={globalApiKey}
              onChange={e => setGlobalApiKey(e.target.value)}
              dir="ltr"
              className="text-right border-purple-200 focus:border-purple-500 font-mono h-11 rounded-xl"
              placeholder="sk-proj-..."
            />
          </div>
          <Button
            onClick={saveGlobalKey}
            disabled={isSavingGlobal}
            className="bg-purple-600 hover:bg-purple-700 h-11 px-6 font-bold rounded-xl text-white"
          >
            {isSavingGlobal ? 'جاري الحفظ...' : 'حفظ المفتاح المركزي'}
          </Button>
        </CardContent>
      </Card>

      {/* 2. Add / Edit Clinic Form */}
      <Card className={`shadow-xl border-t-4 rounded-2xl overflow-hidden bg-white ${
        editingId ? 'border-t-blue-500 ring-2 ring-blue-500/20' : 'border-t-[#15B8A6]'
      }`}>
        <CardHeader className={`${editingId ? 'bg-blue-50/60' : 'bg-teal-50/50'} border-b pb-4`}>
          <CardTitle className="text-xl font-black flex items-center gap-2 text-[#182230]">
            {editingId ? <Edit className="w-5 h-5 text-blue-500" /> : <Building className="w-5 h-5 text-[#15B8A6]" />}
            {editingId ? 'تعديل بيانات العيادة والروشتة والذكاء الاصطناعي' : 'إضافة عيادة جديدة وتكوين النظام'}
          </CardTitle>
          <CardDescription>
            تحكم كامل في بيانات العيادة، رفع تصميم الروشتة المطبوعة، فتح أو قفل الذكاء الاصطناعي، وإدارة الاشتراك.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleAddOrUpdateClinic} className="space-y-8">
            
            {/* Section 1: Basic Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-black text-slate-800 border-b border-slate-200 pb-2 flex items-center gap-2">
                <FileEdit className="w-4 h-4 text-[#15B8A6]" />
                البيانات الأساسية
              </h3>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600">اسم الطبيب</Label>
                  <Input value={doctorName} onChange={e => setDoctorName(e.target.value)} required placeholder="د. أحمد محمد" className="h-10 text-xs rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600">اسم العيادة</Label>
                  <Input value={clinicName} onChange={e => setClinicName(e.target.value)} required placeholder="عيادة الشفاء التخصصية" className="h-10 text-xs rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600">الرابط (Slug)</Label>
                  <Input value={slug} onChange={e => setSlug(e.target.value)} required placeholder="ahmed-clinic" dir="ltr" className="h-10 text-xs rounded-xl text-right font-mono" disabled={!!editingId} />
                </div>
              </div>
            </div>

            {/* Section 2: Contact Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-black text-slate-800 border-b border-slate-200 pb-2 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#15B8A6]" />
                أرقام التواصل والموقع
              </h3>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600">رقم تليفون الطبيب (شخصي)</Label>
                  <Input value={doctorPhone} onChange={e => setDoctorPhone(e.target.value)} dir="ltr" className="h-10 text-xs rounded-xl text-right font-mono" placeholder="010xxxxxxxx" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600">رقم العيادة (واتساب الحجز والروشتة)</Label>
                  <Input value={clinicPhone} onChange={e => setClinicPhone(e.target.value)} required dir="ltr" className="h-10 text-xs rounded-xl text-right font-mono" placeholder="01xxxxxxxxx" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600">رابط موقع العيادة (Google Maps)</Label>
                  <Input value={mapsLink} onChange={e => setMapsLink(e.target.value)} dir="ltr" className="h-10 text-xs rounded-xl text-right" placeholder="https://maps.google.com/..." />
                </div>
              </div>
            </div>

            {/* Section 3: Prescription Template & AI Feature Controls */}
            <div className="space-y-4">
              <h3 className="text-sm font-black text-slate-800 border-b border-slate-200 pb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#15B8A6]" />
                تخصيص الروشتة وميزة الذكاء الاصطناعي (AI Controls)
              </h3>
              <div className="grid md:grid-cols-2 gap-6 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                {/* 1. Prescription Design Upload / URL */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[#182230]">
                    <FileSignature className="w-5 h-5 text-[#15B8A6]" />
                    <h4 className="font-bold text-xs">صورة تصميم ورقة الروشتة المطبوعة (A4 Template)</h4>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    يمكن للمالك رفع صورة من الجهاز مباشرة أو وضع رابط لتصميم الروشتة الخاص بالعيادة، ليتم طباعة بيانات الكشف والأدوية عليها تلقائياً.
                  </p>
                  
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#E5EAF0] hover:bg-slate-50 cursor-pointer text-xs font-bold text-slate-700 transition-colors shadow-2xs">
                      <Upload className="w-4 h-4 text-[#15B8A6]" />
                      <span>رفع صورة من جهازك</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePrescriptionUpload}
                        className="hidden"
                      />
                    </label>
                    <span className="text-[10px] text-slate-400">أو الصق رابط:</span>
                  </div>

                  <Input
                    value={prescriptionTemplateUrl}
                    onChange={e => setPrescriptionTemplateUrl(e.target.value)}
                    dir="ltr"
                    placeholder="https://... رابط صورة الروشتة المخصصة"
                    className="h-10 text-xs rounded-xl bg-white text-right"
                  />

                  {prescriptionTemplateUrl && (
                    <div className="p-3 border rounded-xl bg-white space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-500 font-bold">معاينة تصميم الروشتة المعتمد:</span>
                        <button
                          type="button"
                          onClick={() => setPrescriptionTemplateUrl('')}
                          className="text-[10px] text-rose-500 hover:text-rose-700 font-bold"
                        >
                          إزالة الصورة
                        </button>
                      </div>
                      <div className="max-h-40 overflow-hidden rounded-lg border bg-slate-50 flex items-center justify-center p-2">
                        <img src={prescriptionTemplateUrl} alt="Prescription Template Preview" className="max-h-36 rounded-md object-contain shadow-xs" />
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. AI Feature Enable/Disable */}
                <div className="space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-[#182230]">
                      <Bot className="w-5 h-5 text-purple-600" />
                      <h4 className="font-bold text-xs">قفل / فتح المساعد الذكي (AI Assistant) للعيادة</h4>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      عند قفل هذه الميزة، تختفي خانة تدريب المساعد الذكي والفقاعة العائمة تماماً من لوحة تحكم الطبيب وصفحة المرضى.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold block text-slate-800">
                        {aiEnabled ? 'المساعد الذكي مفعل لهذه العيادة' : 'المساعد الذكي معطل ومخفي'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {aiEnabled ? 'تظهر خانة AI في القائمة الجانبية وصفحة المرضى' : 'تمت إزالة خانة AI من العيادة بالكامل'}
                      </span>
                    </div>
                    <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 4: Logins */}
            <div className="space-y-4">
              <h3 className="text-sm font-black text-slate-800 border-b border-slate-200 pb-2 flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#15B8A6]" />
                حسابات الدخول للطبيب والمساعد
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <h4 className="font-bold text-xs text-[#15B8A6]">حساب الطبيب الرئيسي</h4>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-600">البريد الإلكتروني</Label>
                    <Input type="email" value={doctorEmail} onChange={e => setDoctorEmail(e.target.value)} required dir="ltr" className="h-10 text-xs rounded-xl text-right" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-600">كلمة المرور</Label>
                    <Input type="password" value={doctorPassword} onChange={e => setDoctorPassword(e.target.value)} required minLength={6} dir="ltr" className="h-10 text-xs rounded-xl text-right" />
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <h4 className="font-bold text-xs text-emerald-600">حساب المساعد</h4>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-600">البريد الإلكتروني</Label>
                    <Input type="email" value={assistantEmail} onChange={e => setAssistantEmail(e.target.value)} dir="ltr" className="h-10 text-xs rounded-xl text-right" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-600">كلمة المرور</Label>
                    <Input type="password" value={assistantPassword} onChange={e => setAssistantPassword(e.target.value)} minLength={6} dir="ltr" className="h-10 text-xs rounded-xl text-right" />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 5: Subscription Dates & Active Status */}
            <div className="space-y-4">
              <h3 className="text-sm font-black text-slate-800 border-b border-slate-200 pb-2 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                حالة التفعيل والاشتراك
              </h3>
              <div className="grid md:grid-cols-3 gap-4 items-center bg-amber-50/50 p-4 rounded-xl border border-amber-100">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-600">تاريخ التفعيل</Label>
                  <Input type="date" value={activationDate} onChange={e => setActivationDate(e.target.value)} className="h-10 text-xs rounded-xl bg-white" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-600">تاريخ الانتهاء</Label>
                  <Input type="date" value={expirationDate} onChange={e => setExpirationDate(e.target.value)} className="h-10 text-xs rounded-xl bg-white" />
                </div>
                <div className="pt-5 flex items-center gap-2">
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                  <Label className="text-xs font-bold text-slate-700 cursor-pointer" onClick={() => setIsActive(!isActive)}>
                    العيادة نشطة ومفعلة للعمل
                  </Label>
                </div>
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={isLoading}
                className={`flex-1 h-12 text-sm font-black text-white rounded-xl shadow-lg ${
                  editingId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-[#15B8A6] hover:bg-[#0D9488]'
                }`}
              >
                {editingId ? <Edit className="w-4 h-4 ml-1.5" /> : <Plus className="w-4 h-4 ml-1.5" />}
                {isLoading ? 'جاري الحفظ...' : editingId ? 'تحديث وحفظ بيانات العيادة' : 'إضافة وتفعيل العيادة في المنصة'}
              </Button>
              {editingId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={cancelEdit}
                  className="h-12 px-6 text-xs font-bold rounded-xl"
                  disabled={isLoading}
                >
                  إلغاء التعديل
                </Button>
              )}
            </div>

          </form>
        </CardContent>
      </Card>

      {/* 3. Clinics Management Table */}
      <Card className="shadow-lg border border-[#E5EAF0] rounded-2xl overflow-hidden bg-white">
        <CardHeader className="bg-slate-50/80 border-b pb-4">
          <CardTitle className="text-lg font-black text-[#182230]">العيادات المسجلة وإدارة الخدمات</CardTitle>
          <CardDescription>قائمة بجميع العيادات على المنصة مع التحكم في الاشتراك، الروشتات، والذكاء الاصطناعي</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-[#F8FAFC] text-slate-400 text-xs font-bold border-b border-[#E5EAF0]">
                <tr>
                  <th className="py-3.5 px-4">العيادة / الطبيب</th>
                  <th className="py-3.5 px-4">الروابط السريعة</th>
                  <th className="py-3.5 px-4 text-center">الذكاء الاصطناعي</th>
                  <th className="py-3.5 px-4 text-center">الروشتة</th>
                  <th className="py-3.5 px-4 text-center">الحالة</th>
                  <th className="py-3.5 px-4 text-center">إجراءات المالك</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EAF0]">
                {clinics.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      لا توجد عيادات مسجلة حتى الآن.
                    </td>
                  </tr>
                ) : (
                  clinics.map(c => {
                    const hasAi = c.aiEnabled !== false
                    return (
                      <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-xs text-[#182230]">{c.clinicName}</p>
                          <span className="text-[11px] text-slate-400">د. {c.doctorName} • {c.clinicPhone}</span>
                        </td>

                        <td className="py-3.5 px-4 text-xs space-y-0.5">
                          <div>
                            <a href={`/clinic/${c.slug}`} target="_blank" rel="noreferrer" className="text-[#15B8A6] font-bold hover:underline">
                              صفحة المريض
                            </a>
                          </div>
                          <div>
                            <a href={`/clinic/${c.slug}/patient`} target="_blank" rel="noreferrer" className="text-[#2F80ED] font-bold hover:underline">
                              بوابة المريض
                            </a>
                          </div>
                          <div>
                            <a href={`/clinic/${c.slug}/login`} target="_blank" rel="noreferrer" className="text-slate-500 hover:underline">
                              دخول الطاقم
                            </a>
                          </div>
                        </td>

                        {/* AI Status & Quick Toggle */}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => toggleClinicAi(c.id, hasAi)}
                            className="cursor-pointer"
                            title="اضغط للتبديل الفوري للذكاء الاصطناعي"
                          >
                            <Badge className={`text-[10px] font-bold border-none ${
                              hasAi ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-400'
                            }`}>
                              {hasAi ? 'AI مفعل' : 'AI معطل'}
                            </Badge>
                          </button>
                        </td>

                        {/* Prescription Template */}
                        <td className="py-3.5 px-4 text-center">
                          {c.prescriptionTemplateUrl ? (
                            <Badge className="bg-teal-50 text-[#0D9488] border-teal-200 text-[10px] font-bold">
                              تصميم مخصص
                            </Badge>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-semibold">قالب قياسي</span>
                          )}
                        </td>

                        {/* Active Status */}
                        <td className="py-3.5 px-4 text-center">
                          <Badge className={`text-[10px] font-bold border-none ${
                            c.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {c.isActive ? 'مفعل' : 'موقوف'}
                          </Badge>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(c)}
                              className="h-8 px-2.5 text-xs font-bold text-blue-600 border-blue-200 hover:bg-blue-50 rounded-lg"
                            >
                              <Edit className="w-3.5 h-3.5 ml-1" />
                              تعديل
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => toggleStatus(c.id, c.isActive)}
                              className="h-8 px-2.5 text-xs font-bold rounded-lg"
                            >
                              {c.isActive ? 'إيقاف' : 'تفعيل'}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => deleteClinic(c.id)}
                              className="h-8 w-8 text-rose-500 hover:bg-rose-50 rounded-lg"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
