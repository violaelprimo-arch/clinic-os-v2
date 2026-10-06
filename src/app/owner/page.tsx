'use client'

import { useState, useEffect, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Plus, Trash2, Building, MapPin, FileEdit, CheckCircle2,
  XCircle, Edit, Bot, FileSignature, Phone, MessageSquare,
  Sparkles, Upload, Search, ExternalLink, Power, Check,
  AlertCircle, Eye, ShieldCheck, Clock, Users, ArrowUpRight,
  Copy, CheckCircle, RefreshCw, ChevronLeft, Calendar
} from 'lucide-react'
import { db } from '@/lib/firebase'
import { collection, addDoc, getDocs, deleteDoc, updateDoc, doc, setDoc, onSnapshot } from 'firebase/firestore'
import { Switch } from '@/components/ui/switch'
import { motion, AnimatePresence } from 'framer-motion'
import { ClinicLogo } from '@/components/clinic/ClinicLogo'
import Link from 'next/link'

export default function OwnerDashboard() {
  const [clinics, setClinics] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'clinics' | 'add' | 'settings'>('clinics')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMode, setFilterMode] = useState<'all' | 'active' | 'inactive' | 'ai-on' | 'ai-off'>('all')

  // Edit mode
  const [editingId, setEditingId] = useState<string | null>(null)
  const [globalApiKey, setGlobalApiKey] = useState('')
  const [isSavingGlobal, setIsSavingGlobal] = useState(false)
  const [previewTemplateModal, setPreviewTemplateModal] = useState<string | null>(null)

  // Clinic form fields
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
  
  // Custom Prescription Template & AI Toggle
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
  const [isRefreshing, setIsRefreshing] = useState(false)

  const loadClinics = async () => {
    setIsRefreshing(true)
    try {
      const snap = await getDocs(collection(db, 'clinics'))
      setClinics(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (err) {
      console.error(err)
    } finally {
      setIsRefreshing(false)
    }
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

    const unsubClinics = onSnapshot(
      collection(db, 'clinics'),
      (snap) => {
        setClinics(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        setIsRefreshing(false)
      },
      (err) => {
        console.error(err)
        setIsRefreshing(false)
      }
    )

    return () => unsubClinics()
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
    } finally {
      setIsSavingGlobal(false)
    }
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
      setActiveTab('clinics')
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

    setActiveTab('add')
    window.scrollTo({ top: 0, behavior: 'smooth' })
    toast.info('جاري تعديل بيانات عيادة: ' + (c.clinicName || ''))
  }

  const cancelEdit = () => {
    setEditingId(null)
    setClinicName('')
    setDoctorName('')
    setSlug('')
    setPrescriptionTemplateUrl('')
    setAiEnabled(true)
    setActiveTab('clinics')
    toast.info('تم إلغاء التعديل')
  }

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'clinics', id), { isActive: !currentStatus })
      toast.success(currentStatus ? 'تم إيقاف العيادة مؤقتاً' : 'تم تفعيل العيادة للعمل')
      loadClinics()
    } catch (err) {
      toast.error('حدث خطأ أثناء التحديث')
    }
  }

  // Instant AI toggle with optimistic update & immediate Firestore persist
  const toggleClinicAi = async (id: string, currentAi: boolean) => {
    const nextAi = !currentAi
    // Optimistic UI update
    setClinics(prev => prev.map(c => c.id === id ? { ...c, aiEnabled: nextAi } : c))
    try {
      await updateDoc(doc(db, 'clinics', id), { aiEnabled: nextAi })
      toast.success(
        nextAi
          ? 'تم تفعيل AI Chatbot للعيادة بنجاح (سيظهر المساعد في لوحة العيادة وصفحة الحجز)'
          : 'تم تعطيل AI Chatbot عن العيادة (تم حذف المساعد من القائمة والإعدادات فوراً)'
      )
    } catch (err) {
      toast.error('حدث خطأ أثناء تعديل حالة الذكاء الاصطناعي')
      loadClinics()
    }
  }

  const deleteClinic = async (id: string) => {
    if (confirm('تحذير نهائي: هل أنت متأكد من حذف هذه العيادة نهائياً من قاعدة البيانات؟')) {
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

  // Filtered clinics list
  const filteredClinics = useMemo(() => {
    return clinics.filter(c => {
      const matchesSearch =
        (c.clinicName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.doctorName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.slug || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.clinicPhone || '').includes(searchQuery)

      if (!matchesSearch) return false

      if (filterMode === 'active') return c.isActive !== false
      if (filterMode === 'inactive') return c.isActive === false
      if (filterMode === 'ai-on') return c.aiEnabled !== false
      if (filterMode === 'ai-off') return c.aiEnabled === false

      return true
    })
  }, [clinics, searchQuery, filterMode])

  // KPI Metrics
  const totalClinics = clinics.length
  const activeClinicsCount = clinics.filter(c => c.isActive !== false).length
  const aiEnabledCount = clinics.filter(c => c.aiEnabled !== false).length
  const customTemplateCount = clinics.filter(c => !!c.prescriptionTemplateUrl).length

  return (
    <div className="space-y-8 font-sans pb-16 text-[#182230]" dir="rtl">
      
      {/* 1. Header Overview & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#182230] flex items-center gap-2.5">
            <ShieldCheck className="w-8 h-8 text-[#15B8A6]" />
            لوحة تحكم مالك المنصة (Super Admin)
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            إدارة اشتراكات العيادات، التحكم اللحظي في تفعيل الـ AI Chatbot، ورفع تصاميم الروشتات المخصصة
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadClinics}
            disabled={isRefreshing}
            className="h-10 text-xs font-bold rounded-xl border-[#E5EAF0] text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ml-1.5 ${isRefreshing ? 'animate-spin text-[#15B8A6]' : ''}`} />
            تحديث البيانات
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setEditingId(null)
              setActiveTab('add')
            }}
            className="h-10 px-4 text-xs font-black bg-[#15B8A6] hover:bg-[#0D9488] text-white rounded-xl shadow-md shadow-[#15B8A6]/20 cursor-pointer"
          >
            <Plus className="w-4 h-4 ml-1.5" />
            إضافة عيادة جديدة
          </Button>
        </div>
      </div>

      {/* 2. KPI Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Total Clinics */}
        <div className="medical-card p-5 bg-white border border-[#E5EAF0] rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-[#15B8A6] flex items-center justify-center shrink-0">
            <Building className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 block">إجمالي العيادات</span>
            <span className="text-2xl font-black text-[#182230] font-mono">{totalClinics}</span>
          </div>
        </div>

        {/* Card 2: Active Clinics */}
        <div className="medical-card p-5 bg-white border border-[#E5EAF0] rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 block">العيادات النشطة</span>
            <span className="text-2xl font-black text-emerald-600 font-mono">{activeClinicsCount}</span>
          </div>
        </div>

        {/* Card 3: AI Chatbot Enabled */}
        <div className="medical-card p-5 bg-white border border-[#E5EAF0] rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 block">مفعل بها AI Chatbot</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-purple-700 font-mono">{aiEnabledCount}</span>
              <span className="text-[10px] text-slate-400 font-bold">من {totalClinics}</span>
            </div>
          </div>
        </div>

        {/* Card 4: Custom Prescription Template */}
        <div className="medical-card p-5 bg-white border border-[#E5EAF0] rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#2F80ED] flex items-center justify-center shrink-0">
            <FileSignature className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 block">قوالب روشتات مخصصة</span>
            <span className="text-2xl font-black text-[#2F80ED] font-mono">{customTemplateCount}</span>
          </div>
        </div>

      </div>

      {/* 3. Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E5EAF0] pb-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('clinics')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
            activeTab === 'clinics'
              ? 'bg-[#0B1F33] text-white shadow-md'
              : 'text-slate-500 hover:text-[#182230] hover:bg-slate-100'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>إدارة العيادات والتحكم المباشر ({clinics.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('add')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
            activeTab === 'add'
              ? 'bg-[#15B8A6] text-white shadow-md shadow-[#15B8A6]/20'
              : 'text-slate-500 hover:text-[#182230] hover:bg-slate-100'
          }`}
        >
          {editingId ? <Edit className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          <span>{editingId ? 'تعديل بيانات العيادة' : 'إضافة عيادة جديدة'}</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
            activeTab === 'settings'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-slate-500 hover:text-[#182230] hover:bg-slate-100'
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>مفتاح الذكاء الاصطناعي المركزي</span>
        </button>
      </div>

      {/* 4. TAB 1: Clinics List with Instant AI Toggle */}
      {activeTab === 'clinics' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-4"
        >
          {/* Search and Filters Strip */}
          <div className="medical-card p-4 bg-white border border-[#E5EAF0] rounded-2xl flex flex-col md:flex-row items-center justify-between gap-3 shadow-2xs">
            <div className="relative w-full md:w-96">
              <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="ابحث بالاسم، الطبيب، الهاتف، أو الرابط slug..."
                className="pr-10 h-10 text-xs bg-slate-50 rounded-xl border-[#E5EAF0] focus:bg-white"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
              {[
                { id: 'all', label: 'الكل' },
                { id: 'active', label: 'النشطة' },
                { id: 'inactive', label: 'الموقوفة' },
                { id: 'ai-on', label: 'AI يعمل' },
                { id: 'ai-off', label: 'AI مغلق' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilterMode(f.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    filterMode === f.id
                      ? 'bg-[#15B8A6] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Clinics Data Table */}
          <div className="medical-card bg-white border border-[#E5EAF0] rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-[#F8FAFC] text-slate-500 font-bold border-b border-[#E5EAF0]">
                  <tr>
                    <th className="py-4 px-4">العيادة والطبيب</th>
                    <th className="py-4 px-4">روابط المنصة</th>
                    <th className="py-4 px-4 text-center">
                      <span className="flex items-center justify-center gap-1.5 text-purple-700">
                        <Bot className="w-4 h-4" />
                        <span>تشغيل / قفل AI Chatbot</span>
                      </span>
                    </th>
                    <th className="py-4 px-4 text-center">تصميم الروشتة</th>
                    <th className="py-4 px-4 text-center">حالة الاشتراك</th>
                    <th className="py-4 px-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5EAF0]">
                  {filteredClinics.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        {clinics.length === 0 ? 'لا توجد عيادات مسجلة حتى الآن.' : 'لا توجد نتائج تطابق بحثك.'}
                      </td>
                    </tr>
                  ) : (
                    filteredClinics.map((c) => {
                      const hasAi = c.aiEnabled !== false
                      const hasCustomTemplate = !!c.prescriptionTemplateUrl
                      return (
                        <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                          
                          {/* Clinic Name & Doctor */}
                          <td className="py-4 px-4">
                            <div className="space-y-0.5">
                              <h4 className="font-black text-sm text-[#182230]">{c.clinicName}</h4>
                              <p className="text-slate-500 font-semibold text-[11px]">
                                {c.doctorName ? `د. ${c.doctorName}` : 'طبيب العيادة'}
                              </p>
                              <div className="flex items-center gap-2 pt-1 font-mono text-[10px] text-slate-400">
                                <span>واتساب: {c.clinicPhone || '—'}</span>
                                {c.doctorPhone && <span>• شخصي: {c.doctorPhone}</span>}
                              </div>
                            </div>
                          </td>

                          {/* Quick Platform Links */}
                          <td className="py-4 px-4 space-y-1">
                            <div>
                              <a
                                href={`/clinic/${c.slug}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[#15B8A6] font-bold hover:underline"
                              >
                                <span>صفحة الحجز</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                            <div>
                              <a
                                href={`/clinic/${c.slug}/patient`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[#2F80ED] font-bold hover:underline"
                              >
                                <span>بوابة المريض</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                            <div>
                              <a
                                href={`/clinic/${c.slug}/admin`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-slate-600 font-bold hover:underline"
                              >
                                <span>لوحة العيادة</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          </td>

                          {/* DEDICATED AI CHATBOT INSTANT TOGGLE BUTTON */}
                          <td className="py-4 px-4 text-center">
                            <div className="flex flex-col items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => toggleClinicAi(c.id, hasAi)}
                                className={`px-3 py-1.5 rounded-xl font-black text-[11px] transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                                  hasAi
                                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                                    : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                                }`}
                                title="اضغط لتبديل حالة الذكاء الاصطناعي لهذه العيادة فوراً"
                              >
                                <Power className={`w-3.5 h-3.5 ${hasAi ? 'text-white' : 'text-slate-400'}`} />
                                <span>{hasAi ? 'AI شغال (اضغط للقفل)' : 'AI مغلق (اضغط للتشغيل)'}</span>
                              </button>
                              
                              <span className={`text-[10px] font-bold ${hasAi ? 'text-purple-600' : 'text-slate-400'}`}>
                                {hasAi ? 'ظاهر بالعيادة والموقع ✓' : 'مخفي تماماً من العيادة ✗'}
                              </span>
                            </div>
                          </td>

                          {/* Prescription Template */}
                          <td className="py-4 px-4 text-center">
                            {hasCustomTemplate ? (
                              <div className="flex flex-col items-center gap-1">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-teal-50 text-[#0D9488] border border-teal-200 text-[10px] font-bold">
                                  <FileSignature className="w-3 h-3" />
                                  <span>تصميم مخصص</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setPreviewTemplateModal(c.prescriptionTemplateUrl)}
                                  className="text-[10px] font-bold text-[#15B8A6] hover:underline flex items-center gap-0.5 cursor-pointer"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>معاينة القالب</span>
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-medium">قالب قياسي A4</span>
                            )}
                          </td>

                          {/* Subscription & Active Status */}
                          <td className="py-4 px-4 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <button
                                type="button"
                                onClick={() => toggleStatus(c.id, c.isActive !== false)}
                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                                  c.isActive !== false
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                                }`}
                              >
                                {c.isActive !== false ? '● نشطة ومفعلة' : '○ موقوفة مؤقتاً'}
                              </button>
                              {c.expirationDate && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  ينتهي: {c.expirationDate}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Action Buttons */}
                          <td className="py-4 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEdit(c)}
                                className="h-8 px-2.5 text-xs font-bold text-blue-600 border-blue-200 hover:bg-blue-50 rounded-xl"
                              >
                                <Edit className="w-3.5 h-3.5 ml-1" />
                                تعديل
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => deleteClinic(c.id)}
                                className="h-8 w-8 text-rose-500 hover:bg-rose-50 hover:text-rose-700 rounded-xl"
                                title="حذف العيادة"
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
          </div>
        </motion.div>
      )}

      {/* 5. TAB 2: Add or Edit Clinic Form */}
      {activeTab === 'add' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          <div className="medical-card bg-white border border-[#E5EAF0] rounded-3xl p-6 sm:p-8 shadow-md">
            
            <div className="flex items-center justify-between pb-5 border-b border-[#E5EAF0] mb-6">
              <div>
                <h2 className="text-xl font-black text-[#182230] flex items-center gap-2">
                  {editingId ? <Edit className="w-5 h-5 text-blue-600" /> : <Building className="w-5 h-5 text-[#15B8A6]" />}
                  {editingId ? 'تعديل بيانات العيادة وإعداداتها' : 'إضافة وتكوين عيادة طبية جديدة'}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  تحكم كامل في هوية العيادة، أرقام التواصل، رفع تصميم الروشتة، وتفعيل الذكاء الاصطناعي
                </p>
              </div>

              {editingId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={cancelEdit}
                  className="rounded-xl text-xs font-bold"
                >
                  إلغاء التعديل
                </Button>
              )}
            </div>

            <form onSubmit={handleAddOrUpdateClinic} className="space-y-8">
              
              {/* Section 1: Basic Info */}
              <div className="space-y-3">
                <h3 className="text-xs font-black text-slate-700 flex items-center gap-2">
                  <Building className="w-4 h-4 text-[#15B8A6]" />
                  البيانات الأساسية للعيادة
                </h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-600">اسم الطبيب المعالج *</Label>
                    <Input
                      value={doctorName}
                      onChange={e => setDoctorName(e.target.value)}
                      required
                      placeholder="د. أحمد محمد"
                      className="h-10 text-xs rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-600">اسم العيادة *</Label>
                    <Input
                      value={clinicName}
                      onChange={e => setClinicName(e.target.value)}
                      required
                      placeholder="عيادة الشفاء التخصصية"
                      className="h-10 text-xs rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-600">رابط العيادة (Slug) *</Label>
                    <Input
                      value={slug}
                      onChange={e => setSlug(e.target.value)}
                      required
                      placeholder="ahmed-clinic"
                      dir="ltr"
                      className="h-10 text-xs rounded-xl text-right font-mono"
                      disabled={!!editingId}
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Contact Info */}
              <div className="space-y-3">
                <h3 className="text-xs font-black text-slate-700 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-[#15B8A6]" />
                  أرقام التواصل وموقع العيادة
                </h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-600">رقم تليفون الطبيب (شخصي)</Label>
                    <Input
                      value={doctorPhone}
                      onChange={e => setDoctorPhone(e.target.value)}
                      dir="ltr"
                      className="h-10 text-xs rounded-xl text-right font-mono"
                      placeholder="010xxxxxxxx"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-600">رقم العيادة (واتساب والحجز والروشتة) *</Label>
                    <Input
                      value={clinicPhone}
                      onChange={e => setClinicPhone(e.target.value)}
                      required
                      dir="ltr"
                      className="h-10 text-xs rounded-xl text-right font-mono"
                      placeholder="01xxxxxxxxx"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-600">رابط موقع العيادة (Google Maps)</Label>
                    <Input
                      value={mapsLink}
                      onChange={e => setMapsLink(e.target.value)}
                      dir="ltr"
                      className="h-10 text-xs rounded-xl text-right"
                      placeholder="https://maps.google.com/..."
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Custom Prescription Template Upload & AI Controls */}
              <div className="space-y-3">
                <h3 className="text-xs font-black text-slate-700 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#15B8A6]" />
                  تصميم الروشتة والتحكم في الذكاء الاصطناعي
                </h3>
                
                <div className="grid md:grid-cols-2 gap-6 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                  
                  {/* Prescription Image Upload */}
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
                            className="text-[10px] text-rose-500 hover:text-rose-700 font-bold cursor-pointer"
                          >
                            إزالة الصورة
                          </button>
                        </div>
                        <div className="max-h-36 overflow-hidden rounded-lg border bg-slate-50 flex items-center justify-center p-2">
                          <img
                            src={prescriptionTemplateUrl}
                            alt="Prescription Template Preview"
                            className="max-h-32 rounded-md object-contain shadow-xs"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* AI Feature Toggle Switch */}
                  <div className="space-y-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-[#182230]">
                        <Bot className="w-5 h-5 text-purple-600" />
                        <h4 className="font-bold text-xs">زر تشغيل / تعطيل المساعد الذكي (AI Chatbot) للعيادة</h4>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                        عند قفل هذه الميزة، تختفي خانة تدريب المساعد الذكي والفقاعة العائمة تماماً من لوحة تحكم الطبيب وصفحة المرضى، ولن تظهر كخانة بالعيادة.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-xs font-black text-slate-800 block">
                            حالة الذكاء الاصطناعي لهذه العيادة:
                          </Label>
                          <span className={`text-[11px] font-bold ${aiEnabled ? 'text-purple-600' : 'text-slate-400'}`}>
                            {aiEnabled ? '● مفعل ويعمل بالعيادة' : '○ معطل ومحذوف من القائمة'}
                          </span>
                        </div>
                        <Switch
                          checked={aiEnabled}
                          onCheckedChange={setAiEnabled}
                        />
                      </div>

                      <div className="pt-2 border-t border-slate-100">
                        <Label className="text-[11px] font-bold text-slate-500">مفتاح API مخصص للعيادة (اختياري)</Label>
                        <Input
                          type="password"
                          value={aiApiKey}
                          onChange={e => setAiApiKey(e.target.value)}
                          dir="ltr"
                          placeholder="اتركه فارغاً لاستخدام المفتاح المركزي"
                          className="h-9 text-xs font-mono rounded-lg mt-1"
                        />
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* Section 4: Login Accounts */}
              <div className="space-y-3">
                <h3 className="text-xs font-black text-slate-700 flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#15B8A6]" />
                  حسابات دخول الكادر الطبي
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <span className="text-xs font-black text-slate-700 block">حساب الطبيب (مسؤول العيادة)</span>
                    <Input
                      type="email"
                      value={doctorEmail}
                      onChange={e => setDoctorEmail(e.target.value)}
                      placeholder="doctor@clinic.com"
                      className="h-10 text-xs rounded-xl bg-white"
                    />
                    <Input
                      type="password"
                      value={doctorPassword}
                      onChange={e => setDoctorPassword(e.target.value)}
                      placeholder="كلمة المرور"
                      className="h-10 text-xs rounded-xl bg-white"
                    />
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <span className="text-xs font-black text-slate-700 block">حساب مساعد العيادة (السكرتارية)</span>
                    <Input
                      type="email"
                      value={assistantEmail}
                      onChange={e => setAssistantEmail(e.target.value)}
                      placeholder="assistant@clinic.com"
                      className="h-10 text-xs rounded-xl bg-white"
                    />
                    <Input
                      type="password"
                      value={assistantPassword}
                      onChange={e => setAssistantPassword(e.target.value)}
                      placeholder="كلمة المرور"
                      className="h-10 text-xs rounded-xl bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Section 5: Subscription & Active Status */}
              <div className="space-y-3">
                <h3 className="text-xs font-black text-slate-700 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#15B8A6]" />
                  مدة الاشتراك وحالة العيادة
                </h3>
                <div className="grid md:grid-cols-3 gap-4 items-center bg-teal-50/40 p-4 rounded-2xl border border-teal-100">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-600">تاريخ التفعيل</Label>
                    <Input
                      type="date"
                      value={activationDate}
                      onChange={e => setActivationDate(e.target.value)}
                      className="h-10 text-xs rounded-xl bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-600">تاريخ الانتهاء</Label>
                    <Input
                      type="date"
                      value={expirationDate}
                      onChange={e => setExpirationDate(e.target.value)}
                      className="h-10 text-xs rounded-xl bg-white"
                    />
                  </div>
                  <div className="pt-4 flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
                    <Label className="text-xs font-black text-slate-700 cursor-pointer" onClick={() => setIsActive(!isActive)}>
                      العيادة نشطة وجاهزة لاستقبال المرضى
                    </Label>
                    <Switch checked={isActive} onCheckedChange={setIsActive} />
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center gap-3 pt-3">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className={`flex-1 h-12 text-xs font-black text-white rounded-xl shadow-lg transition-all cursor-pointer ${
                    editingId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-[#15B8A6] hover:bg-[#0D9488]'
                  }`}
                >
                  {editingId ? <Edit className="w-4 h-4 ml-1.5" /> : <Plus className="w-4 h-4 ml-1.5" />}
                  {isLoading ? 'جاري الحفظ...' : editingId ? 'تحديث وحفظ كافة بيانات العيادة' : 'إضافة العيادة وتفعيلها في المنصة'}
                </Button>

                {editingId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={cancelEdit}
                    className="h-12 px-6 text-xs font-bold rounded-xl"
                  >
                    إلغاء
                  </Button>
                )}
              </div>

            </form>
          </div>
        </motion.div>
      )}

      {/* 6. TAB 3: Global System Settings */}
      {activeTab === 'settings' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-6 max-w-3xl"
        >
          <div className="medical-card bg-white border border-[#E5EAF0] rounded-3xl p-6 sm:p-8 space-y-6 shadow-md">
            <div className="pb-4 border-b border-[#E5EAF0]">
              <h2 className="text-xl font-black text-[#182230] flex items-center gap-2">
                <Bot className="w-6 h-6 text-purple-600" />
                المفتاح المركزي للذكاء الاصطناعي (OpenAI / Gemini)
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                يشغل المساعد الذكي لكافة العيادات التي يقوم المالك بتفعيل ميزة الـ AI لها تلقائياً.
              </p>
            </div>

            <div className="space-y-3">
              <Label className="text-xs font-bold text-slate-700">مفتاح الـ API المركزي (API Key)</Label>
              <Input
                type="password"
                value={globalApiKey}
                onChange={e => setGlobalApiKey(e.target.value)}
                dir="ltr"
                placeholder="AIzaSy... أو sk-proj-..."
                className="h-11 text-xs font-mono rounded-xl bg-slate-50 border-[#E5EAF0] focus:bg-white text-right"
              />
              <p className="text-[11px] text-slate-400">
                يتم حفظ المفتاح بأمان تام واستخدامه في الرد على استفسارات المرضى حول مواعيد وكشوفات العيادات المسموح لها.
              </p>

              <Button
                onClick={saveGlobalKey}
                disabled={isSavingGlobal}
                className="h-11 px-8 font-black text-xs bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-md cursor-pointer"
              >
                {isSavingGlobal ? 'جاري الحفظ...' : 'حفظ المفتاح المركزي'}
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* 7. Modal for Previewing Uploaded Prescription Template */}
      {previewTemplateModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPreviewTemplateModal(null)}
        >
          <div
            className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E5EAF0]">
              <h3 className="font-black text-sm text-[#182230] flex items-center gap-2">
                <FileSignature className="w-4 h-4 text-[#15B8A6]" />
                معاينة تصميم ورقة الروشتة المعتمد للعيادة
              </h3>
              <button
                onClick={() => setPreviewTemplateModal(null)}
                className="text-slate-400 hover:text-slate-700 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[500px] overflow-auto rounded-xl border bg-slate-50 p-2 flex items-center justify-center">
              <img
                src={previewTemplateModal}
                alt="Prescription Template Preview"
                className="max-h-[460px] object-contain rounded-lg shadow-sm"
              />
            </div>

            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => setPreviewTemplateModal(null)}
                className="rounded-xl text-xs font-bold bg-[#15B8A6] text-white"
              >
                إغلاق المعاينة
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
