'use client'

import { use, useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Save, Plus, Trash2, Palette, Phone, MapPin, Bot,
  Wallet, Users, Clock, Printer, ShieldCheck, Settings,
  CheckCircle2, Bell, Sparkles, Building2
} from 'lucide-react'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, updateDoc, doc, addDoc } from 'firebase/firestore'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { PremiumLanding } from '@/components/clinic/PremiumLanding'
import { MessageCircle } from 'lucide-react'

export default function ClinicSettings({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug

  const [activeTab, setActiveTab] = useState<'profile' | 'queue' | 'services' | 'payment' | 'staff' | 'print' | 'ai'>('profile')
  const [supportNumbers, setSupportNumbers] = useState<any[]>([])

  const [clinicId, setClinicId] = useState<string | null>(null)
  const [photoUrl, setPhotoUrl] = useState('')
  const [doctorName, setDoctorName] = useState('')
  const [doctorTitle, setDoctorTitle] = useState('د.')
  const [clinicName, setClinicName] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [heroSubtitle, setHeroSubtitle] = useState('')
  const [certificationTitle, setCertificationTitle] = useState('')
  const [certificationEntity, setCertificationEntity] = useState('')
  
  useEffect(() => {
    const fetchSupport = async () => {
      const snap = await getDocs(query(collection(db, 'platformSettings')));
      if (!snap.empty) {
        setSupportNumbers(snap.docs[0].data().supportNumbers || []);
      }
    }
    fetchSupport();
  }, [])
  const [primaryColor, setPrimaryColor] = useState('#15B8A6')
  const [averageVisitTime, setAverageVisitTime] = useState<number>(15)

  // Contacts & Location
  const [address, setAddress] = useState('')
  const [doctorPhone, setDoctorPhone] = useState('')
  const [clinicPhone, setClinicPhone] = useState('')
  const [mapsLink, setMapsLink] = useState('')
  const [phones, setPhones] = useState<string[]>(['01012345678'])

  // Services
  const [services, setServices] = useState<any[]>([
    { id: '1', name: 'كشف عادي', price: 250 },
    { id: '2', name: 'استشارة', price: 150 },
    { id: '3', name: 'كشف مستعجل', price: 400 },
    { id: '4', name: 'متابعة دورية', price: 100 }
  ])
  const [newServiceName, setNewServiceName] = useState('')
  const [newServicePrice, setNewServicePrice] = useState<number>(200)

  // Payment
  const [onlinePaymentEnabled, setOnlinePaymentEnabled] = useState(false)
  const [walletNumber, setWalletNumber] = useState('')
  const [instapayHandle, setInstapayHandle] = useState('')

  // Assistants & Permissions
  const [assistants, setAssistants] = useState<any[]>([])
  const [newAssistantEmail, setNewAssistantEmail] = useState('')
  const [newAssistantPassword, setNewAssistantPassword] = useState('')
  const [assistantPermissions, setAssistantPermissions] = useState<string[]>(['appointments'])

  // AI Config & Toggle
  const [aiEnabled, setAiEnabled] = useState(true)
  const [aiInstructions, setAiInstructions] = useState(
    'أنت مساعد ذكي لعيادة طبية. مهمتك الإجابة على استفسارات المرضى باختصار ولطف بناءً على مواعيد وخدمات العيادة.'
  )

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const [aiLockedByOwner, setAiLockedByOwner] = useState(false)

  // New Toggles Phase 1
  const [isClinicOpen, setIsClinicOpen] = useState(true)
  const [showPrices, setShowPrices] = useState(true)
  const [isWalletEnabled, setIsWalletEnabled] = useState(false)
  const [isInstapayEnabled, setIsInstapayEnabled] = useState(false)
  const [regularPerUrgent, setRegularPerUrgent] = useState<number>(2)
  const [urgentPerRegular, setUrgentPerRegular] = useState<number>(1)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const q = query(collection(db, 'clinics'), where('slug', '==', slug))
        const snapshot = await getDocs(q)
        if (!snapshot.empty) {
          const cDoc = snapshot.docs[0]
          setClinicId(cDoc.id)
          const data = cDoc.data()
          setPhotoUrl(data.heroImage || '')
          setClinicName(data.clinicName || '')
          setDoctorName(data.doctorName || '')
          setDoctorTitle(data.doctorTitle || 'د.')
          setSpecialty(data.specialty || '')
          setHeroSubtitle(data.heroSubtitle || '')
          setCertificationTitle(data.certificationTitle || '')
          setCertificationEntity(data.certificationEntity || '')
          setPrimaryColor(data.primaryColor || '#15B8A6')
          setAssistantPermissions(data.assistantPermissions || ['appointments'])
          setAverageVisitTime(data.averageVisitTime || 15)
          setAddress(data.clinicAddress || '')
          setDoctorPhone(data.doctorPhone || '')
          setClinicPhone(data.clinicPhone || (data.clinicPhones?.[0] || ''))
          setMapsLink(data.mapsLink || '')
          setPhones(data.clinicPhones?.length ? data.clinicPhones : [data.clinicPhone || ''])
          setAiEnabled(data.aiEnabled !== false)
          setAiLockedByOwner(data.aiLockedByOwner === true)
          setAiInstructions(data.aiInstructions || aiInstructions)
          setOnlinePaymentEnabled(data.onlinePaymentEnabled || false)
          setWalletNumber(data.walletNumber || '')
          setInstapayHandle(data.instapayHandle || '')
          setIsClinicOpen(data.isClinicOpen !== false) // default true
          setShowPrices(data.showPrices !== false) // default true
          setIsWalletEnabled(data.isWalletEnabled || false)
          setIsInstapayEnabled(data.isInstapayEnabled || false)
          setRegularPerUrgent(data.regularPerUrgent || 2)
          setUrgentPerRegular(data.urgentPerRegular || 1)
          setAssistants(data.assistants || [])
          if (data.services && data.services.length > 0) {
            setServices(data.services)
          }
        }
      } catch (err) {
        toast.error('حدث خطأ أثناء تحميل الإعدادات')
      } finally {
        setIsLoading(false)
      }
    }
    fetchSettings()
  }, [slug])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const rawPayload = {
        clinicName: clinicName || '',
        doctorName: doctorName || '',
        doctorTitle: doctorTitle || 'د.',
        specialty: specialty || '',
        heroSubtitle: heroSubtitle || '',
        certificationTitle: certificationTitle || '',
        certificationEntity: certificationEntity || '',
        services: services || [],
        primaryColor: primaryColor || '#15B8A6',
        assistantPermissions: assistantPermissions || [],
        averageVisitTime: Number(averageVisitTime) || 15,
        clinicAddress: address || '',
        clinicPhone: phones[0] || '',
        doctorPhone: doctorPhone || '',
        mapsLink: mapsLink || '',
        clinicPhones: phones.filter(p => typeof p === 'string' && p.trim() !== ''),
        onlinePaymentEnabled: Boolean(onlinePaymentEnabled),
        walletNumber: walletNumber || '',
        instapayHandle: instapayHandle || '',
        isClinicOpen,
        showPrices,
        isWalletEnabled,
        isInstapayEnabled,
        regularPerUrgent: Number(regularPerUrgent) || 2,
        urgentPerRegular: Number(urgentPerRegular) || 1,
        assistants: assistants || [],
        updatedAt: new Date().toISOString()
      }

      // Remove undefined values to prevent Firebase error
      const payload = Object.fromEntries(
        Object.entries(rawPayload).filter(([_, v]) => v !== undefined)
      )

      if (!clinicId) {
        const docRef = await addDoc(collection(db, 'clinics'), {
          slug,
          ...payload,
          isActive: true,
          createdAt: new Date().toISOString()
        })
        setClinicId(docRef.id)
      } else {
        await updateDoc(doc(db, 'clinics', clinicId), payload)
      }
      toast.success('تم حفظ كافة إعدادات العيادة بنجاح وتطبيقها فورياً')
    } catch (err: any) {
      console.error('Save Error:', err)
      toast.error('حدث خطأ أثناء الحفظ: ' + (err.message || ''))
    } finally {
      setIsSaving(false)
    }
  }

  const addService = () => {
    if (!newServiceName.trim()) return toast.error('يرجى كتابة اسم الخدمة')
    const newS = {
      id: String(Date.now()),
      name: newServiceName,
      price: Number(newServicePrice) || 0
    }
    setServices([...services, newS])
    setNewServiceName('')
    setNewServicePrice(200)
    toast.success('تمت إضافة الخدمة')
  }

  const removeService = (id: string) => {
    setServices(services.filter(s => s.id !== id))
    toast.info('تمت إزالة الخدمة')
  }

  const addAssistant = () => {
    if (!newAssistantEmail.trim() || !newAssistantPassword.trim()) {
      return toast.error('يرجى إدخال البريد الإلكتروني وكلمة المرور')
    }
    const newAss = {
      id: String(Date.now()),
      email: newAssistantEmail,
      password: newAssistantPassword
    }
    setAssistants([...assistants, newAss])
    setNewAssistantEmail('')
    setNewAssistantPassword('')
    toast.success('تمت إضافة المساعد')
  }

  const removeAssistant = (id: string) => {
    setAssistants(assistants.filter(a => a.id !== id))
  }

  const togglePermission = (permId: string) => {
    if (assistantPermissions.includes(permId)) {
      setAssistantPermissions(assistantPermissions.filter(p => p !== permId))
    } else {
      setAssistantPermissions([...assistantPermissions, permId])
    }
  }

  const baseTabs = [
    { id: 'profile', label: 'الهوية والبيانات', icon: Building2 },
    { id: 'queue', label: 'المواعيد والدور', icon: Clock },
    { id: 'services', label: 'الخدمات والأسعار', icon: ShieldCheck },
    { id: 'payment', label: 'طرق الدفع', icon: Wallet },
    { id: 'staff', label: 'المساعدين والصلاحيات', icon: Users }
  ]
  
  const tabs = aiLockedByOwner 
    ? baseTabs 
    : [...baseTabs, { id: 'ai', label: 'المساعد الذكي (AI Chatbot)', icon: Bot }]

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto" dir="rtl">
      
      {/* 1. Header with Title and Global Save CTA */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#182230] flex items-center gap-2">
            <Settings className="w-6 h-6 text-[#15B8A6]" />
            إعدادات العيادة المتقدمة
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            تخصيص الهوية البصرية، أسعار الخدمات، المساعدين، وبوابات الدفع الإلكتروني
          </p>
        </div>

        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="h-10 px-6 font-bold bg-[#15B8A6] hover:bg-[#0D9488] text-white rounded-xl text-xs shadow-md shadow-[#15B8A6]/20"
        >
          <Save className="w-4 h-4 ml-1.5" />
          {isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
        </Button>
      </div>

      {/* 2. Structured Settings Tabs */}
      <div className="flex border-b border-[#E5EAF0] gap-2 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 py-3 px-4 border-b-2 font-bold text-xs whitespace-nowrap transition-colors cursor-pointer ${
                isActive
                  ? 'border-[#15B8A6] text-[#15B8A6] bg-white rounded-t-xl'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* 3. Tab Contents */}
      
      {/* TAB 1: Profile & Visual Identity */}
      {activeTab === 'profile' && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Form Side */}
          <div className="medical-card p-6 space-y-5">
            <div className="pb-3 border-b border-[#E5EAF0]">
              <h3 className="font-bold text-sm text-[#182230]">البيانات العامة للعيادة</h3>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">اسم العيادة</Label>
              <Input
                value={clinicName}
                onChange={e => setClinicName(e.target.value)}
                placeholder="عيادة الأمل التخصصية"
                className="h-10 text-xs rounded-xl"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">اسم الطبيب المعالج</Label>
                <div className="flex gap-2">
                  <select
                    value={doctorTitle}
                    onChange={e => setDoctorTitle(e.target.value)}
                    className="h-10 text-xs rounded-xl border border-slate-200 px-2 bg-slate-50 w-24"
                  >
                    <option value="د.">د.</option>
                    <option value="أ.د.">أ.د.</option>
                    <option value="دكتورة">دكتورة</option>
                    <option value="استشاري">استشاري</option>
                    <option value="طبيب">طبيب</option>
                    <option value="">بدون لقب</option>
                  </select>
                  <Input
                    value={doctorName}
                    onChange={e => setDoctorName(e.target.value)}
                    placeholder="محمد علي"
                    className="h-10 text-xs rounded-xl flex-1"
                  />
                </div>
              </div>


              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">التخصص والمسمى</Label>
                <Input
                  value={specialty}
                  onChange={e => setSpecialty(e.target.value)}
                  placeholder="استشاري الطب الباطني والجهاز الهضمي"
                  className="h-10 text-xs rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">اللقب / الاعتماد (يظهر على صورة الطبيب)</Label>
                <Input
                  value={certificationTitle}
                  onChange={e => setCertificationTitle(e.target.value)}
                  placeholder="طبيب معتمد رسمياً"
                  className="h-10 text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">الجهة المانحة (النقابة / الزمالة)</Label>
                <Input
                  value={certificationEntity}
                  onChange={e => setCertificationEntity(e.target.value)}
                  placeholder="نقابة الأطباء المصرية"
                  className="h-10 text-xs rounded-xl"
                />
              </div>
            </div>

            <Label className="text-xs font-bold text-slate-600">نبذة تعريفية (تظهر للمرضى)</Label>
              <Textarea
                value={heroSubtitle}
                onChange={e => setHeroSubtitle(e.target.value)}
                placeholder="نقدم لك ولأسرتك رعاية طبية متكاملة..."
                className="text-xs rounded-xl h-24"
              />
            </div>

            
            <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">اللون الرئيسي للنظام</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={e => setPrimaryColor(e.target.value)}
                    className="w-10 h-10 rounded-xl cursor-pointer border-0 p-0"
                  />
                  <span className="font-mono text-sm text-slate-600">{primaryColor}</span>
                </div>
              </div>


            <div className="space-y-1.5 pt-2">
              <Label className="text-xs font-bold text-slate-600">حالة العيادة (مفتوحة / مغلقة)</Label>
              <div className="flex items-center gap-2">
                <Switch checked={isClinicOpen} onCheckedChange={setIsClinicOpen} />
                <span className="text-sm text-slate-600 font-bold">{isClinicOpen ? 'العيادة تستقبل حجوزات' : 'العيادة مغلقة حالياً'}</span>
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              <Label className="text-xs font-bold text-slate-600">إظهار أسعار الكشوفات للمرضى</Label>
              <div className="flex items-center gap-2">
                <Switch checked={showPrices} onCheckedChange={setShowPrices} />
                <span className="text-sm text-slate-600 font-bold">{showPrices ? 'الأسعار ظاهرة' : 'الأسعار مخفية'}</span>
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              <Label className="text-xs font-bold text-slate-600">عنوان العيادة التفصيلي</Label>
              <Input
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="شارع التسعين الشمالي، التجمع الخامس، القاهرة"
                className="h-10 text-xs rounded-xl"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs font-bold text-slate-600">أرقام هواتف العيادة (للحجز والواتساب)</Label>
                <div className="space-y-2">
                  {phones.map((p, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        value={p}
                        onChange={e => {
                          const newPhones = [...phones]
                          newPhones[idx] = e.target.value
                          setPhones(newPhones)
                        }}
                        placeholder="01012345678"
                        className="h-10 text-xs rounded-xl font-mono text-right"
                        dir="ltr"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setPhones(phones.filter((_, i) => i !== idx))}
                        className="text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    onClick={() => setPhones([...phones, ''])}
                    className="w-full border-dashed h-10 text-xs font-bold text-[#15B8A6] border-teal-200 hover:bg-teal-50"
                  >
                    <Plus className="w-4 h-4 ml-2" /> إضافة رقم آخر
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs font-bold text-slate-600">رابط موقع العيادة (Google Maps)</Label>
                <Input
                  value={mapsLink}
                  onChange={e => setMapsLink(e.target.value)}
                  placeholder="https://maps.google.com/..."
                  className="h-10 text-xs rounded-xl font-mono text-right"
                  dir="ltr"
                />
              </div>
            </div>
          </div>

          {/* Preview Side */}
          <div className="medical-card overflow-hidden bg-slate-50 relative flex flex-col hidden lg:flex border-4 border-slate-100">
            <div className="p-3 border-b border-slate-200 bg-white flex items-center justify-between shadow-sm z-10">
              <h3 className="font-bold text-sm text-[#182230] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                معاينة حية لصفحة المريض
              </h3>
              <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-bold">
                Live Preview
              </span>
            </div>
            
            <div className="flex-1 relative overflow-y-auto overflow-x-hidden no-scrollbar bg-white">
              <div className="absolute inset-0 origin-top" style={{ transform: 'scale(0.85)', width: '117%' }}>
                <PremiumLanding 
                  clinic={{
                    clinicName: clinicName || 'عيادة تجريبية',
                    doctorName: doctorName || 'طبيب',
                    doctorTitle: doctorTitle || 'د.',
                    specialty: specialty || 'تخصص',
                    heroSubtitle: heroSubtitle || '',
                    certificationTitle: certificationTitle || 'طبيب معتمد رسمياً',
                    certificationEntity: certificationEntity || 'نقابة الأطباء المصرية',
                    heroImage: photoUrl || '',
                    primaryColor: primaryColor || '#15B8A6',
                    clinicPhone: phones[0] || '01000000000',
                    clinicPhones: phones.filter(p => p.trim() !== ''),
                    clinicAddress: address || 'عنوان',
                    mapsLink: mapsLink || '',
                    services: services || [],
                    aiEnabled: aiEnabled
                  }} 
                  services={services || []} 
                />
              </div>
            </div>
          </div>
        </div>
      )}
      {/* TAB 2: Queue & Visit Duration */}
      {activeTab === 'queue' && (
        <div className="medical-card p-6 max-w-2xl space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-[#E5EAF0]">
            <Clock className="w-5 h-5 text-[#15B8A6]" />
            <h3 className="font-bold text-sm text-[#182230]">تنظيم المواعيد وسرعة الكشف</h3>
          </div>

          <div className="space-y-4">
            <div className="space-y-2 pb-4 border-b border-[#E5EAF0]">
              <Label className="text-xs font-bold text-slate-600">
                متوسط وقت الكشف المتوقع لكل مريض (بالدقائق)
              </Label>
              <Input
                type="number"
                value={averageVisitTime}
                onChange={e => setAverageVisitTime(Number(e.target.value))}
                className="h-10 text-sm rounded-xl max-w-xs font-bold"
                min={3}
                max={60}
              />
              <p className="text-[11px] text-slate-400">
                يُستخدم لحساب الوقت التقريبي المتبقي لشاشة تتبع دور المريض الذكية تلقائياً.
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-sm text-[#182230]">نظام دخول الطوارئ / الكشف المستعجل</h4>
              <p className="text-xs text-slate-500">يحدد كم كشف عادي يدخل بعده كشف مستعجل تلقائياً في شاشة الدور</p>
              
              <div className="grid grid-cols-2 gap-4 max-w-sm">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600">عدد الكشوفات العادية</Label>
                  <Input
                    type="number"
                    value={regularPerUrgent}
                    onChange={e => setRegularPerUrgent(Number(e.target.value))}
                    className="h-10 text-sm rounded-xl font-bold"
                    min={1}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-rose-600">يتبعها (كشف مستعجل)</Label>
                  <Input
                    type="number"
                    value={urgentPerRegular}
                    onChange={e => setUrgentPerRegular(Number(e.target.value))}
                    className="h-10 text-sm rounded-xl font-bold border-rose-200 bg-rose-50 text-rose-700"
                    min={1}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Services & Pricing */}
      {activeTab === 'services' && (
        <div className="medical-card p-6 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-[#E5EAF0]">
            <div>
              <h3 className="font-bold text-sm text-[#182230]">الخدمات والأسعار المعتمدة في العيادة</h3>
              <p className="text-xs text-slate-400">تظهر هذه الخدمات في نموذج حجز المرضى وشاشة دور اليوم</p>
            </div>
          </div>

          {/* Add New Service Form */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 space-y-1 w-full">
              <Label className="text-xs font-bold text-slate-600">اسم الخدمة</Label>
              <Input
                value={newServiceName}
                onChange={e => setNewServiceName(e.target.value)}
                placeholder="مثال: رسم قلب، متابعة سكر"
                className="h-10 text-xs rounded-xl bg-white"
              />
            </div>
            <div className="w-full sm:w-40 space-y-1">
              <Label className="text-xs font-bold text-slate-600">السعر (ج.م)</Label>
              <Input
                type="number"
                value={newServicePrice}
                onChange={e => setNewServicePrice(Number(e.target.value))}
                className="h-10 text-xs rounded-xl bg-white"
              />
            </div>
            <Button
              onClick={addService}
              className="h-10 px-5 text-xs font-bold bg-[#15B8A6] hover:bg-[#0D9488] text-white rounded-xl"
            >
              <Plus className="w-4 h-4 ml-1" />
              إضافة خدمة
            </Button>
          </div>

          {/* Existing Services List */}
          <div className="divide-y divide-[#E5EAF0]">
            {services.map((service) => (
              <div key={service.id} className="py-3.5 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs text-[#182230]">{service.name}</h4>
                  <span className="text-xs font-black text-emerald-600">{service.price} ج.م</span>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => removeService(service.id)}
                  className="text-slate-400 hover:text-rose-600"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: Payment Methods */}
      {activeTab === 'payment' && (
        <div className="medical-card p-6 max-w-2xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5EAF0]">
            <div>
              <h3 className="font-bold text-sm text-[#182230]">تفعيل الدفع الإلكتروني (Online Payment)</h3>
              <p className="text-xs text-slate-400">إتاحة الدفع عبر محفظة إلكترونية أو انستاباي أثناء حجز المريض</p>
            </div>
            <Switch
              checked={onlinePaymentEnabled}
              onCheckedChange={setOnlinePaymentEnabled}
            />
          </div>

          {onlinePaymentEnabled && (
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border">
                <div className="flex items-center gap-3">
                  <Switch checked={isWalletEnabled} onCheckedChange={setIsWalletEnabled} />
                  <div>
                    <p className="font-bold text-sm text-slate-800">تفعيل الدفع بالمحفظة الإلكترونية (فودافون كاش وغيرها)</p>
                  </div>
                </div>
              </div>
              {isWalletEnabled && (
                <div className="space-y-1.5 pl-14">
                  <Label className="text-xs font-bold text-slate-600">رقم المحفظة</Label>
                  <Input
                    value={walletNumber}
                    onChange={e => setWalletNumber(e.target.value)}
                    placeholder="010xxxxxxxx"
                    className="h-10 text-xs rounded-xl font-mono text-right"
                    dir="ltr"
                  />
                </div>
              )}

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border">
                <div className="flex items-center gap-3">
                  <Switch checked={isInstapayEnabled} onCheckedChange={setIsInstapayEnabled} />
                  <div>
                    <p className="font-bold text-sm text-slate-800">تفعيل الدفع عبر إنستاباي (InstaPay)</p>
                  </div>
                </div>
              </div>
              {isInstapayEnabled && (
                <div className="space-y-1.5 pl-14">
                  <Label className="text-xs font-bold text-slate-600">معرف إنستاباي (InstaPay Handle)</Label>
                  <Input
                    value={instapayHandle}
                    onChange={e => setInstapayHandle(e.target.value)}
                    placeholder="name@instapay"
                    className="h-10 text-xs rounded-xl font-mono text-right"
                    dir="ltr"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: Staff & Permissions */}
      {activeTab === 'staff' && (
        <div className="medical-card p-6 space-y-6">
          <div className="pb-3 border-b border-[#E5EAF0]">
            <h3 className="font-bold text-sm text-[#182230]">حسابات المساعدين والصلاحيات الممنوحة</h3>
            <p className="text-xs text-slate-400">إدارة حسابات الدخول لسكرتارية العيادة وتحديد الأقسام المتاحة لهم</p>
          </div>

          {/* Permissions Toggle Matrix */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
            <h4 className="text-xs font-black text-slate-700">الأقسام المصرح للمساعد بالوصول إليها:</h4>
            <div className="grid sm:grid-cols-3 gap-3">
              {[
                { id: 'appointments', label: 'دور اليوم والمواعيد' },
                { id: 'patients', label: 'سجل المرضى' },
                { id: 'prescriptions', label: 'الروشتات الطبية' },
                { id: 'drugs', label: 'دليل الأدوية' },
                { id: 'accounts', label: 'الحسابات اليومية' },
                { id: 'finance', label: 'التقارير المالية' },
              ].map(perm => (
                <label key={perm.id} className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={assistantPermissions.includes(perm.id)}
                    onChange={() => togglePermission(perm.id)}
                    className="rounded text-[#15B8A6] focus:ring-[#15B8A6]"
                  />
                  <span>{perm.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Add Assistant Form */}
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 space-y-1 w-full">
              <Label className="text-xs font-bold text-slate-600">بريد المساعد</Label>
              <Input
                type="email"
                value={newAssistantEmail}
                onChange={e => setNewAssistantEmail(e.target.value)}
                placeholder="assistant@clinic.com"
                className="h-10 text-xs rounded-xl"
              />
            </div>
            <div className="flex-1 space-y-1 w-full">
              <Label className="text-xs font-bold text-slate-600">كلمة المرور</Label>
              <Input
                type="password"
                value={newAssistantPassword}
                onChange={e => setNewAssistantPassword(e.target.value)}
                placeholder="••••••••"
                className="h-10 text-xs rounded-xl"
              />
            </div>
            <Button
              onClick={addAssistant}
              className="h-10 px-5 text-xs font-bold bg-[#15B8A6] hover:bg-[#0D9488] text-white rounded-xl"
            >
              <Plus className="w-4 h-4 ml-1" />
              إضافة مساعد
            </Button>
          </div>

          {/* Assistants List */}
          <div className="divide-y divide-[#E5EAF0]">
            {assistants.map((ass) => (
              <div key={ass.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-bold text-xs text-[#182230]">{ass.email}</p>
                  <span className="text-[10px] text-slate-400">صلاحية: مساعد عيادة</span>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => removeAssistant(ass.id)}
                  className="text-slate-400 hover:text-rose-600"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: Print Settings */}
      {activeTab === 'print' && (
        <div className="medical-card p-6 max-w-2xl space-y-4">
          <div className="pb-3 border-b border-[#E5EAF0]">
            <h3 className="font-bold text-sm text-[#182230]">إعدادات ورقة الروشتة المطبوعة (A4)</h3>
            <p className="text-xs text-slate-400">تخصيص الهامش والترويسة السفلية في الطباعة</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs text-slate-600 font-medium">
            <p className="font-bold text-[#182230]">تنسيق الطباعة المعتمد:</p>
            <p>✓ تم ضبط مقاس الطباعة القياسي A4 بما يتوافق مع جميع طابعات العيادات الحرارية والعادية.</p>
            <p>✓ يتم إخفاء أزرار التحكم والقوائم الجانبية تلقائياً أثناء أمر الطباعة.</p>
          </div>
        </div>
      )}

      {/* TAB 7: AI Assistant */}
      {activeTab === 'ai' && (
        <div className="medical-card p-6 max-w-3xl space-y-6 text-center">
          <div className="pb-3 border-b border-[#E5EAF0]">
            <h3 className="font-bold text-sm text-[#182230] flex items-center justify-center gap-2">
              <Bot className="w-5 h-5 text-[#15B8A6]" />
              إعدادات المساعد الذكي (AI Chatbot)
            </h3>
          </div>
          <div className="p-8 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4">
            <Bot className="w-16 h-16 text-slate-300 mx-auto" />
            <h4 className="text-lg font-black text-slate-700">هذه الخاصية تدار بواسطة الإدارة</h4>
            <p className="text-sm text-slate-500 font-medium">
              لا يمكنك تعديل إعدادات المساعد الذكي أو تفعيله بنفسك. يرجى التواصل مع فريق الدعم الفني للمنصة.
            </p>
            {supportNumbers.filter((n: any) => n.isActive).length > 0 ? (
              <div className="flex flex-wrap justify-center gap-3 pt-6">
                {supportNumbers.filter((n: any) => n.isActive).map((num: any, idx: number) => (
                  <a key={idx} href={`https://wa.me/20${num.phone.replace(/^0/, '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-5 py-2.5 bg-emerald-100 text-emerald-800 rounded-xl font-bold text-sm hover:bg-emerald-200 transition-colors shadow-sm">
                    <MessageCircle className="w-4 h-4" />
                    {num.label || 'الدعم الفني'} - {num.phone}
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-xs text-rose-500 font-bold pt-6">لا توجد أرقام دعم فني متاحة حالياً.</p>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
