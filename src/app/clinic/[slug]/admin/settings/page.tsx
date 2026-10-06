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
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

export default function ClinicSettings({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug

  const [activeTab, setActiveTab] = useState<'profile' | 'queue' | 'services' | 'payment' | 'staff' | 'print' | 'ai'>('profile')

  const [clinicId, setClinicId] = useState<string | null>(null)
  const [photoUrl, setPhotoUrl] = useState('')
  const [doctorName, setDoctorName] = useState('')
  const [clinicName, setClinicName] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#15B8A6')
  const [averageVisitTime, setAverageVisitTime] = useState<number>(15)

  // Contacts
  const [address, setAddress] = useState('')
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

  // AI Config
  const [aiInstructions, setAiInstructions] = useState(
    'أنت مساعد ذكي لعيادة طبية. مهمتك الإجابة على استفسارات المرضى باختصار ولطف بناءً على مواعيد وخدمات العيادة.'
  )

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

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
          setClinicName(data.clinicName || 'عيادة الأمل التخصصية')
          setDoctorName(data.doctorName || 'د. محمد علي')
          setSpecialty(data.specialty || 'استشاري الطب الباطني والجهاز الهضمي')
          setPrimaryColor(data.primaryColor || '#15B8A6')
          setAssistantPermissions(data.assistantPermissions || ['appointments'])
          setAverageVisitTime(data.averageVisitTime || 15)
          setAddress(data.clinicAddress || 'شارع التسعين الشمالي، التجمع الخامس، القاهرة')
          setPhones(data.clinicPhones?.length ? data.clinicPhones : [data.clinicPhone || '01012345678'])
          setAiInstructions(data.aiInstructions || aiInstructions)
          setOnlinePaymentEnabled(data.onlinePaymentEnabled || false)
          setWalletNumber(data.walletNumber || '')
          setInstapayHandle(data.instapayHandle || '')
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
    if (!clinicId) return
    setIsSaving(true)
    try {
      await updateDoc(doc(db, 'clinics', clinicId), {
        clinicName,
        doctorName,
        specialty,
        heroImage: photoUrl,
        services,
        primaryColor,
        assistantPermissions,
        averageVisitTime: Number(averageVisitTime),
        clinicAddress: address,
        clinicPhones: phones.filter(p => p.trim() !== ''),
        aiInstructions,
        onlinePaymentEnabled,
        walletNumber,
        instapayHandle,
        assistants
      })
      toast.success('تم حفظ كافة إعدادات العيادة بنجاح')
    } catch (err) {
      toast.error('حدث خطأ أثناء الحفظ')
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

  const tabs = [
    { id: 'profile', label: 'الهوية والبيانات', icon: Building2 },
    { id: 'queue', label: 'المواعيد والطابور', icon: Clock },
    { id: 'services', label: 'الخدمات والأسعار', icon: ShieldCheck },
    { id: 'payment', label: 'طرق الدفع', icon: Wallet },
    { id: 'staff', label: 'المساعدين والصلاحيات', icon: Users },
    { id: 'print', label: 'الروشتة والطباعة', icon: Printer },
    { id: 'ai', label: 'المساعد الذكي', icon: Bot },
  ]

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
        <div className="grid md:grid-cols-12 gap-6">
          <div className="md:col-span-4 medical-card p-6 flex flex-col items-center space-y-5 text-center">
            <Avatar className="w-32 h-32 border-4 border-teal-50 shadow-md">
              <AvatarImage src={photoUrl} alt="Doctor" className="object-cover" />
              <AvatarFallback className="text-3xl font-black bg-teal-50 text-[#15B8A6]">ط</AvatarFallback>
            </Avatar>
            <div className="w-full space-y-1.5 text-right">
              <Label className="text-xs font-bold text-slate-600">رابط صورة الطبيب (URL)</Label>
              <Input
                value={photoUrl}
                onChange={e => setPhotoUrl(e.target.value)}
                placeholder="https://..."
                className="h-10 text-xs rounded-xl font-mono text-left"
                dir="ltr"
              />
            </div>
            <div className="w-full space-y-1.5 text-right">
              <Label className="text-xs font-bold text-slate-600">اللون الرئيسي للنظام</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={e => setPrimaryColor(e.target.value)}
                  className="w-10 h-10 rounded-xl cursor-pointer border border-[#E5EAF0] p-1 bg-white"
                />
                <span className="font-mono text-xs text-slate-600 font-bold">{primaryColor}</span>
              </div>
            </div>
          </div>

          <div className="md:col-span-8 medical-card p-6 space-y-4">
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
                <Input
                  value={doctorName}
                  onChange={e => setDoctorName(e.target.value)}
                  placeholder="د. محمد علي"
                  className="h-10 text-xs rounded-xl"
                />
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
              <Label className="text-xs font-bold text-slate-600">عنوان العيادة التفصيلي</Label>
              <Input
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="شارع التسعين الشمالي، التجمع الخامس، القاهرة"
                className="h-10 text-xs rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">أرقام هواتف التواصل (للمرضى والروشتة)</Label>
              <Input
                value={phones[0] || ''}
                onChange={e => setPhones([e.target.value])}
                placeholder="01012345678"
                className="h-10 text-xs rounded-xl font-mono text-right"
                dir="ltr"
              />
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

          <div className="space-y-2">
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
        </div>
      )}

      {/* TAB 3: Services & Pricing */}
      {activeTab === 'services' && (
        <div className="medical-card p-6 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-[#E5EAF0]">
            <div>
              <h3 className="font-bold text-sm text-[#182230]">الخدمات والأسعار المعتمدة في العيادة</h3>
              <p className="text-xs text-slate-400">تظهر هذه الخدمات في نموذج حجز المرضى وشاشة طابور اليوم</p>
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
              <p className="text-xs text-slate-400">إتاحة الدفع عبر فودافون كاش أو انستاباي أثناء حجز المريض</p>
            </div>
            <Switch
              checked={onlinePaymentEnabled}
              onCheckedChange={setOnlinePaymentEnabled}
            />
          </div>

          {onlinePaymentEnabled && (
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">رقم محفظة فودافون كاش (للتحويل)</Label>
                <Input
                  value={walletNumber}
                  onChange={e => setWalletNumber(e.target.value)}
                  placeholder="010xxxxxxxx"
                  className="h-10 text-xs rounded-xl font-mono text-right"
                  dir="ltr"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">عنوان الدفع اللحظي (InstaPay Handle)</Label>
                <Input
                  value={instapayHandle}
                  onChange={e => setInstapayHandle(e.target.value)}
                  placeholder="name@instapay"
                  className="h-10 text-xs rounded-xl font-mono text-right"
                  dir="ltr"
                />
              </div>
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
                { id: 'appointments', label: 'طابور اليوم والمواعيد' },
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
        <div className="medical-card p-6 max-w-3xl space-y-4">
          <div className="pb-3 border-b border-[#E5EAF0]">
            <h3 className="font-bold text-sm text-[#182230] flex items-center gap-2">
              <Bot className="w-5 h-5 text-[#15B8A6]" />
              تعليمات المساعد الذكي للعيادة (AI Prompt)
            </h3>
            <p className="text-xs text-slate-400">يقوم الذكاء الاصطناعي بالرد على استفسارات المرضى بناءً على هذه التوجيهات</p>
          </div>

          <Textarea
            value={aiInstructions}
            onChange={e => setAiInstructions(e.target.value)}
            className="min-h-[140px] text-xs rounded-xl bg-slate-50 border-[#E5EAF0] leading-relaxed"
          />
        </div>
      )}

    </div>
  )
}
