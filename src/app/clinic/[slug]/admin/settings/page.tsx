'use client'

import { use, useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Save, Plus, Trash2, Palette, Phone, MapPin, Bot,
  Wallet, Users, Clock, Printer, ShieldCheck, Settings, Lock,
  CheckCircle2, Bell, Sparkles, Building2, Copy, ExternalLink,
  Monitor, Smartphone, User
} from 'lucide-react'
import { isClinicFeatureEnabled } from '@/lib/featurePermissions'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, updateDoc, doc, addDoc } from 'firebase/firestore'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { PremiumLanding } from '@/components/clinic/PremiumLanding'
import { MessageCircle } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'
import { extractCoordsFromLink } from '@/lib/mapsHelper'

export default function ClinicSettings({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug
  const { t, tDynamic, dir, isRtl, language } = useLanguage()

  const [activeTab, setActiveTab] = useState<'profile' | 'branding' | 'queue' | 'services' | 'payment' | 'staff' | 'print' | 'ai' | 'security'>('profile')
  const [logoUrl, setLogoUrl] = useState('')
  const [thermalMonoLogoUrl, setThermalMonoLogoUrl] = useState('')
  const [slogan, setSlogan] = useState('')
  const [receiptHeaderNote, setReceiptHeaderNote] = useState('')
  const [receiptFooterNote, setReceiptFooterNote] = useState('يرجى الاحتفاظ بالإيصال للاستشارة - نتمنى لكم الشفاء العاجل')
  const [reportHeaderNote, setReportHeaderNote] = useState('')
  const [secondaryColor, setSecondaryColor] = useState('#2F80ED')
  const [supportNumbers, setSupportNumbers] = useState<any[]>([]);
  const [newDoctorEmail, setNewDoctorEmail] = useState('');
  const [newDoctorPassword, setNewDoctorPassword] = useState('');
  const [newDoctorPasswordConfirm, setNewDoctorPasswordConfirm] = useState('');
  const [currentRole, setCurrentRole] = useState('')
  const [allowDoctorEditBranding, setAllowDoctorEditBranding] = useState(true)
  const [clinic, setClinic] = useState<any>(null)

  const [clinicId, setClinicId] = useState<string | null>(null)
  const [photoUrl, setPhotoUrl] = useState('')
  const [branchImage, setBranchImage] = useState('')
  const [doctorName, setDoctorName] = useState('')
  const [doctorTitle, setDoctorTitle] = useState('د.')
  const [clinicName, setClinicName] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [heroSubtitle, setHeroSubtitle] = useState('')
  const [certificationTitle, setCertificationTitle] = useState('')
  const [certificationEntity, setCertificationEntity] = useState('')
  const [experienceYears, setExperienceYears] = useState<number | string>(10)
  const [doctorRating, setDoctorRating] = useState('4.9')
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop')
  
  useEffect(() => {
    setCurrentRole(localStorage.getItem('clinic_role') || 'doctor');
    const fetchSupport = async () => {
      const snap = await getDocs(query(collection(db, 'platformSettings')));
      if (!snap.empty) {
        setSupportNumbers(snap.docs[0].data().supportNumbers || []);
      }
    }
    fetchSupport();
  }, [])
  const [primaryColor, setPrimaryColor] = useState('#087CF4')
  const [averageVisitTime, setAverageVisitTime] = useState<number>(15)
  const [maxDailyBookings, setMaxDailyBookings] = useState<number>(0)
  const [allowPatientMedicalView, setAllowPatientMedicalView] = useState(false)
  const [hidePrices, setHidePrices] = useState(false)
  const [weeklySchedule, setWeeklySchedule] = useState([
    { day: 'السبت', isOpen: true, start: '09:00', end: '22:00', id: 'saturday' },
    { day: 'الأحد', isOpen: true, start: '09:00', end: '22:00', id: 'sunday' },
    { day: 'الاثنين', isOpen: true, start: '09:00', end: '22:00', id: 'monday' },
    { day: 'الثلاثاء', isOpen: true, start: '09:00', end: '22:00', id: 'tuesday' },
    { day: 'الأربعاء', isOpen: true, start: '09:00', end: '22:00', id: 'wednesday' },
    { day: 'الخميس', isOpen: true, start: '09:00', end: '22:00', id: 'thursday' },
    { day: 'الجمعة', isOpen: false, start: '09:00', end: '22:00', id: 'friday' }
  ])
  const [queueNormal, setQueueNormal] = useState(2)
  const [queueConsult, setQueueConsult] = useState(1)
  const [queueUrgent, setQueueUrgent] = useState(0)

  // Contacts & Location
  const [address, setAddress] = useState('')
  const [doctorPhone, setDoctorPhone] = useState('')
  const [clinicPhone, setClinicPhone] = useState('')
  const [mapsLink, setMapsLink] = useState('')
  const [latitude, setLatitude] = useState<string>('')
  const [longitude, setLongitude] = useState<string>('')
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
          setClinic({ id: cDoc.id, ...data })
          setPhotoUrl(data.heroImage || '')
          setBranchImage(data.branchImage || '')
          setClinicName(data.clinicName || '')
          setDoctorName(data.doctorName || '')
          setDoctorTitle(data.doctorTitle || 'د.')
          setSpecialty(data.specialty || '')
          setHeroSubtitle(data.heroSubtitle || '')
          setCertificationTitle(data.certificationTitle || '')
          setCertificationEntity(data.certificationEntity || '')
          setExperienceYears(data.experienceYears !== undefined ? data.experienceYears : 10)
          setDoctorRating(data.doctorRating || '4.9')
          setLogoUrl(data.logoUrl || '')
          setThermalMonoLogoUrl(data.thermalMonoLogoUrl || '')
          setSlogan(data.slogan || '')
          setReceiptHeaderNote(data.receiptHeaderNote || '')
          if (data.receiptFooterNote) setReceiptFooterNote(data.receiptFooterNote)
          setReportHeaderNote(data.reportHeaderNote || '')
          setSecondaryColor(data.secondaryColor || '#02CFF3')
          setPrimaryColor(data.primaryColor || '#087CF4')
          setAssistantPermissions(data.assistantPermissions || ['appointments'])
          setAverageVisitTime(data.averageVisitTime || 15)
          setMaxDailyBookings(data.maxDailyBookings || 0)
          if (data.weeklySchedule && Array.isArray(data.weeklySchedule)) {
            setWeeklySchedule(data.weeklySchedule)
          }
          setAllowPatientMedicalView(data.allowPatientMedicalView !== false)
          setHidePrices(data.hidePrices === true)
          setAllowDoctorEditBranding(data.allowDoctorEditBranding !== false)
        
        
        
          setAddress(data.clinicAddress || '')
          setDoctorPhone(data.doctorPhone || '')
          setClinicPhone(data.clinicPhone || (data.clinicPhones?.[0] || ''))
          setMapsLink(data.mapsLink || '')
          setLatitude(data.latitude ? String(data.latitude) : '')
          setLongitude(data.longitude ? String(data.longitude) : '')
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
          setQueueNormal(data.queueNormal ?? 3)
        setQueueConsult(data.queueConsult ?? 2)
        setQueueUrgent(data.queueUrgent ?? 1)
          
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

  const canEditBranding = isClinicFeatureEnabled(clinic, 'branding') && allowDoctorEditBranding !== false
  const canUseAi = isClinicFeatureEnabled(clinic, 'ai') && !aiLockedByOwner


  const handleSave = async () => {
    if (newDoctorPassword) {
      if (newDoctorPassword.length < 6) {
        toast.error('يجب ألا تقل كلمة المرور الجديدة عن 6 خانات')
        return
      }
      if (newDoctorPassword !== newDoctorPasswordConfirm) {
        toast.error('كلمتا المرور غير متطابقتين، يرجى التأكد من تطابق كلمة المرور وتأكيدها')
        return
      }
    }
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
        heroImage: photoUrl || '',
        branchImage: branchImage || '',
        experienceYears: Number(experienceYears) || 10,
        doctorRating: doctorRating || '4.9',
        ...(canEditBranding ? {
          logoUrl: logoUrl || '',
          thermalMonoLogoUrl: thermalMonoLogoUrl || '',
          slogan: slogan || '',
          receiptHeaderNote: receiptHeaderNote || '',
          receiptFooterNote: receiptFooterNote || '',
          reportHeaderNote: reportHeaderNote || '',
          secondaryColor: secondaryColor || '#02CFF3',
          primaryColor: primaryColor || '#087CF4',
        } : {}),
        services: services || [],
        assistantPermissions: assistantPermissions || [],
        averageVisitTime: Number(averageVisitTime) || 15,
        maxDailyBookings: Number(maxDailyBookings) || 0,
      allowPatientMedicalView,
      hidePrices,
      weeklySchedule,
        clinicAddress: address || '',
        clinicPhone: phones[0] || '',
        doctorPhone: doctorPhone || '',
        mapsLink: mapsLink || '',
        latitude: latitude ? parseFloat(latitude) : undefined,
        longitude: longitude ? parseFloat(longitude) : undefined,
        clinicPhones: phones.filter(p => typeof p === 'string' && p.trim() !== ''),
        onlinePaymentEnabled: Boolean(onlinePaymentEnabled),
        walletNumber: walletNumber || '',
        instapayHandle: instapayHandle || '',
        isClinicOpen,
        showPrices,
        ...(newDoctorEmail ? { doctorEmail: newDoctorEmail } : {}),
        ...(newDoctorPassword ? { doctorPassword: newDoctorPassword } : {}),
        isWalletEnabled,
        isInstapayEnabled,
        queueNormal: Number(queueNormal) ?? 3,
      queueConsult: Number(queueConsult) ?? 2,
      queueUrgent: Number(queueUrgent) ?? 1,
        
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
      toast.success('تم حفظ كافة إعدادات العيادة بنجاح وتطبيقها فورياً');
      if (newDoctorEmail || newDoctorPassword) {
        toast.info('تم تغيير بيانات الدخول، يرجى تسجيل الدخول مجدداً.');
        setTimeout(() => {
          localStorage.removeItem('clinic_role');
          window.location.href = `/clinic/${slug}/login`;
        }, 2000);
      }
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
    { id: 'security', label: t('tab_security', 'الأمان والحساب'), icon: Lock },
    { id: 'profile', label: t('tab_profile', 'الهوية والبيانات'), icon: Building2 },
    { id: 'branding', label: t('tab_branding', 'هوية العيادة والطباعة'), icon: Palette },
    { id: 'queue', label: t('tab_queue', 'المواعيد والدور'), icon: Clock },
    { id: 'services', label: t('tab_services', 'الخدمات والأسعار'), icon: ShieldCheck },
    { id: 'payment', label: t('tab_payment', 'طرق الدفع'), icon: Wallet },
    { id: 'staff', label: t('tab_staff', 'المساعدين والصلاحيات'), icon: Users }
  ]
  
  const tabs = !canUseAi 
    ? baseTabs 
    : [...baseTabs, { id: 'ai', label: t('tab_ai', 'المساعد الذكي (AI Chatbot)'), icon: Bot }]

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto" dir={dir}>
      
      {/* 1. Header with Title and Global Save CTA */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
            <Settings className="w-6 h-6 text-primary" />
            {t('nav_settings', 'إعدادات العيادة المتقدمة')}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('settings_subtitle', 'تخصيص الهوية البصرية، أسعار الخدمات، المساعدين، وبوابات الدفع الإلكتروني')}
          </p>
        </div>

        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="h-10 px-6 font-bold yalla-gradient-btn text-white rounded-xl text-xs shadow-md"
        >
          <Save className={`w-4 h-4 ${isRtl ? 'ml-1.5' : 'mr-1.5'}`} />
          {isSaving ? t('saving', 'جاري الحفظ...') : t('save_changes', 'حفظ التعديلات')}
        </Button>
      </div>

      {/* 2. Structured Settings Tabs */}
      <div className="flex border-b border-border gap-2 overflow-x-auto no-scrollbar">
        {tabs.filter(t => t.id !== 'security' || currentRole === 'doctor').map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 py-3 px-4 border-b-2 font-bold text-xs whitespace-nowrap transition-colors cursor-pointer ${
                isActive
                  ? 'border-primary text-primary bg-card rounded-t-xl'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* 3. Tab Contents */}

      {/* TAB SECURITY */}
      {activeTab === 'security' && currentRole === 'doctor' && (
        <div className="yalla-card p-6 max-w-2xl space-y-5 border border-border">
          <div className="pb-3 border-b border-border">
            <h3 className="font-bold text-sm text-foreground">{t('doctor_account_settings', 'إعدادات حساب الطبيب')}</h3>
            <p className="text-xs text-muted-foreground">{t('doctor_account_desc', 'يمكنك هنا تغيير البريد الإلكتروني وكلمة المرور الخاصة بك. هذه البيانات لا تظهر لمالك المنصة.')}</p>
          </div>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">{t('new_doctor_email', 'البريد الإلكتروني الجديد')}</Label>
              <Input
                type="email"
                value={newDoctorEmail}
                onChange={e => setNewDoctorEmail(e.target.value)}
                placeholder="doctor@clinic.com"
                className="h-10 text-xs rounded-xl text-left"
                dir="ltr"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">{t('new_doctor_password', 'كلمة المرور الجديدة')}</Label>
              <Input
                type="password"
                value={newDoctorPassword}
                onChange={e => setNewDoctorPassword(e.target.value)}
                placeholder="••••••••"
                className="h-10 text-xs rounded-xl text-left"
                dir="ltr"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">{t('confirm_new_password', 'تأكيد كلمة المرور الجديدة')}</Label>
              <Input
                type="password"
                value={newDoctorPasswordConfirm}
                onChange={e => setNewDoctorPasswordConfirm(e.target.value)}
                placeholder="••••••••"
                className="h-10 text-xs rounded-xl text-left"
                dir="ltr"
              />
              {newDoctorPassword && newDoctorPasswordConfirm && newDoctorPassword !== newDoctorPasswordConfirm && (
                <p className="text-[11px] font-bold text-rose-500">{t('passwords_not_matching', 'كلمتا المرور غير متطابقتين')}</p>
              )}
            </div>
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-bold rounded-xl">
              {t('security_logout_notice', 'تنبيه: سيتم تسجيل خروجك بعد الحفظ وستحتاج لتسجيل الدخول بالبيانات الجديدة.')}
            </div>
          </div>
        </div>
      )}

      
      {/* TAB BRANDING: Clinic Branding & Thermal Printing */}
      {activeTab === 'branding' && (
        <div className="grid lg:grid-cols-12 gap-6 items-start">
          {/* Settings Form (7 cols) */}
          <div className="lg:col-span-7 yalla-card p-6 space-y-6">
            <div className="pb-3 border-b border-border">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <Palette className="w-5 h-5 text-primary" />
                {t('branding_settings_title', 'إعدادات هوية العيادة والطباعة الحرارية')}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {t('branding_settings_desc', 'تخصيص الشعار الملون، شعار الفواتير الحرارية 80mm أحادي اللون، ألوان الهوية، ونصوص التذييل')}
              </p>
            </div>

            {!canEditBranding && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs flex items-start gap-3">
                <Lock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold">{t('branding_locked_title', 'تعديل هوية العيادة مقفول')}</h4>
                  <p className="leading-relaxed opacity-90">
                    {t('branding_locked_desc', 'ميزة تخصيص الهوية البصرية (الشعارات، الألوان، ونصوص الفواتير) مقفولة في باقة اشتراك عيادتك الحالية أو تم تقييدها من قبل إدارة المنصة Super Admin. لتعديلها يرجى الترقية أو التواصل مع الدعم.')}
                  </p>
                </div>
              </div>
            )}

            <fieldset disabled={!canEditBranding} className={`space-y-6 ${!canEditBranding ? 'opacity-60 pointer-events-none' : ''}`}>
              {/* Logos Section */}
              <div className="space-y-4">
                <h4 className="font-bold text-xs text-foreground pb-1 border-b border-border">{t('clinic_logos', 'شعارات العيادة')}</h4>

                {/* Standard Colored Logo */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">{t('standard_logo_url', 'رابط الشعار الملون (Standard Color Logo)')}</Label>
                  <Input
                    value={logoUrl}
                    onChange={e => setLogoUrl(e.target.value)}
                    placeholder="https://example.com/logo.png"
                    className="h-10 text-xs rounded-xl text-left font-mono"
                    dir="ltr"
                  />
                  <p className="text-[11px] text-muted-foreground">{t('standard_logo_hint', 'يظهر في صفحة الحجز، التقارير المالية A4، ولوحة التحكم.')}</p>
                </div>

                {/* Monochrome Thermal Receipt Logo */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">{t('thermal_mono_logo_url', 'شعار الفاتورة الحرارية 80mm (أحادي اللون 1-Bit Mono)')}</Label>
                  <Input
                    value={thermalMonoLogoUrl}
                    onChange={e => setThermalMonoLogoUrl(e.target.value)}
                    placeholder="https://example.com/thermal-logo-mono.png"
                    className="h-10 text-xs rounded-xl text-left font-mono"
                    dir="ltr"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {t('thermal_mono_logo_hint', 'لوجو أسود وأبيض عالي التباين بدون تدرجات رمادية للحصول على أعلى دقة طباعة على ورق 80mm الحراري.')}
                  </p>
                </div>
              </div>

              {/* Colors Section */}
              <div className="space-y-4 pt-2">
                <h4 className="font-bold text-xs text-foreground pb-1 border-b border-border">{t('brand_colors', 'ألوان الهوية البصرية')}</h4>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground">{t('primary_color', 'اللون الأساسي (Primary)')}</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={primaryColor}
                        onChange={e => setPrimaryColor(e.target.value)}
                        className="w-10 h-10 rounded-xl cursor-pointer border border-border p-0.5 bg-background shrink-0"
                      />
                      <Input
                        value={primaryColor}
                        onChange={e => setPrimaryColor(e.target.value)}
                        className="h-10 text-xs rounded-xl font-mono text-left"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground">{t('secondary_color', 'اللون الثانوي (Secondary)')}</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={secondaryColor}
                        onChange={e => setSecondaryColor(e.target.value)}
                        className="w-10 h-10 rounded-xl cursor-pointer border border-border p-0.5 bg-background shrink-0"
                      />
                      <Input
                        value={secondaryColor}
                        onChange={e => setSecondaryColor(e.target.value)}
                        className="h-10 text-xs rounded-xl font-mono text-left"
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Slogan & Notes Section */}
              <div className="space-y-4 pt-2">
                <h4 className="font-bold text-xs text-foreground pb-1 border-b border-border">{t('texts_and_slogans', 'النصوص والشعارات')}</h4>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">{t('clinic_slogan', 'شعار العيادة اللفظي (Slogan / Tagline)')}</Label>
                  <Input
                    value={slogan}
                    onChange={e => setSlogan(e.target.value)}
                    placeholder={t('slogan_placeholder', 'رعايتكم أولويتنا وراحتكم هدفنا')}
                    className="h-10 text-xs rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">{t('receipt_subtitle', 'نص رأس الفاتورة الحرارية (Receipt Subtitle)')}</Label>
                  <Input
                    value={receiptHeaderNote}
                    onChange={e => setReceiptHeaderNote(e.target.value)}
                    placeholder={t('receipt_subtitle_placeholder', 'مثال: عيادة تخصصية - استشاري جراحة')}
                    className="h-10 text-xs rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">{t('receipt_footer_note', 'تذييل الفاتورة الحرارية (Footer Note)')}</Label>
                  <Textarea
                    value={receiptFooterNote}
                    onChange={e => setReceiptFooterNote(e.target.value)}
                    rows={2}
                    placeholder={t('receipt_footer_placeholder', 'يرجى الاحتفاظ بالإيصال للاستشارة - نتمنى لكم الشفاء العاجل')}
                    className="text-xs rounded-xl"
                  />
                </div>
              </div>
            </fieldset>
          </div>

          {/* Live Preview Side (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Preview 1: Thermal Receipt 80mm Simulation */}
            <div className="yalla-card p-5 space-y-3 bg-muted/40 border border-border">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <h4 className="font-bold text-xs text-foreground flex items-center gap-1.5">
                  <Printer className="w-4 h-4 text-muted-foreground" />
                  {t('thermal_preview_title', 'معاينة الفاتورة الحرارية (80mm Thermal Preview)')}
                </h4>
                <Badge variant="outline" className="text-[10px] font-mono">80mm ESC/POS</Badge>
              </div>

              {/* Thermal Paper Simulation */}
              <div className="bg-white p-5 rounded-xl shadow-xs border border-slate-200 text-center font-mono text-xs space-y-2.5 max-w-[290px] mx-auto text-slate-900" dir={dir}>
                {thermalMonoLogoUrl || logoUrl ? (
                  <img
                    src={thermalMonoLogoUrl || logoUrl}
                    alt="Thermal Logo"
                    className="w-14 h-14 object-contain mx-auto filter grayscale contrast-200"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full border-2 border-dashed border-slate-400 flex items-center justify-center mx-auto text-[10px] font-bold">
                    LOGO
                  </div>
                )}
                <div>
                  <h5 className="font-black text-sm text-[#182230]">{clinicName || t('clinic_name', 'العيادة')}</h5>
                  <p className="text-[10px] text-slate-600 font-bold">{receiptHeaderNote || `${doctorTitle} ${doctorName || t('doctor', 'الطبيب')}`}</p>
                </div>

                {/* Prominent Large Queue Number At Top */}
                <div className="bg-slate-900 text-white rounded-xl py-2 px-3 text-center my-2 shadow-xs">
                  <div className="text-[9.5px] font-bold text-slate-300">{t('queue_ticket_label', 'رقم الدور في الكشف')}</div>
                  <div className="text-3xl font-black tracking-wider font-mono"># 3</div>
                </div>

                <div className="border-t border-dashed border-slate-400 my-2"></div>
                <div className={`text-[11px] space-y-1.5 ${isRtl ? 'text-right' : 'text-left'}`}>
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t('receipt_number', 'رقم الإيصال:')}</span>
                    <span className="font-bold font-mono">#INV-2026-0042</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t('date', 'التاريخ:')}</span>
                    <span className="font-mono">{new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date())}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t('patient', 'المريض:')}</span>
                    <span className="font-bold">{isRtl ? 'أحمد محمد علي' : 'Ahmed Mohamed Ali'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t('service', 'الخدمة:')}</span>
                    <span className="font-bold">{t('normal_consultation', 'كشف عيادة عادي')}</span>
                  </div>
                  <div className="flex justify-between items-center font-black text-xs pt-1.5 border-t border-slate-200">
                    <span>{t('amount_due', 'المبلغ المطلوب:')}</span>
                    <span className="text-sm font-black text-[#087CF4]">300 {t('currency_egp', 'ج.م')}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold">
                    <span>{t('payment_status', 'حالة الدفع:')}</span>
                    <span>{t('paid_in_full_check', 'تم السداد بالكامل ✓')}</span>
                  </div>
                </div>
                <div className="border-t border-dashed border-slate-400 my-2"></div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  {receiptFooterNote || t('receipt_footer_placeholder', 'يرجى الاحتفاظ بالإيصال للاستشارة - نتمنى لكم الشفاء العاجل')}
                </p>
              </div>
            </div>

            {/* Preview 2: Colored Digital Brand Card */}
            <div className="yalla-card p-5 space-y-3">
              <h4 className="font-bold text-xs text-foreground">{t('digital_brand_preview', 'معاينة الهوية الرقمية الملونة')}</h4>
              <div
                style={{ backgroundColor: primaryColor }}
                className="p-5 rounded-2xl text-white text-center space-y-2 shadow-md"
              >
                {logoUrl && (
                  <img
                    src={logoUrl}
                    alt="Logo Preview"
                    className="w-12 h-12 rounded-xl object-cover bg-white p-1 mx-auto shadow-xs"
                  />
                )}
                <h4 className="font-black text-base">{clinicName || t('clinic_name', 'العيادة')}</h4>
                <p className="text-xs opacity-90">{slogan || t('slogan_placeholder', 'رعايتكم أولويتنا وراحتكم هدفنا')}</p>
                <div className="pt-2 flex justify-center gap-2">
                  <span
                    style={{ backgroundColor: secondaryColor }}
                    className="text-[10px] font-bold px-3 py-1 rounded-full text-white"
                  >
                    {doctorTitle} {doctorName || t('doctor', 'الطبيب')}
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}


      {/* TAB 1: Profile & Visual Identity */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6 items-start">
            {/* Form Side */}
            <div className="yalla-card p-6 space-y-5">
              <div className="pb-3 border-b border-border">
                <h3 className="font-bold text-sm text-foreground">{t('general_clinic_data', 'البيانات العامة للعيادة')}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{t('general_clinic_desc', 'تخصيص بيانات الطبيب والعيادة التي تظهر للمرضى في الصفحة الرئيسية')}</p>
              </div>

              {/* Doctor Photo Section */}
              <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-3">
                <Label className="text-xs font-bold text-foreground flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  {t('doctor_photo_label', 'صورة الطبيب (تظهر في الواجهة الرئيسية والمعاينة الحية)')}
                </Label>
                <div className="flex items-center gap-4">
                  <div className="relative w-16 h-16 rounded-2xl overflow-hidden border-2 border-primary/30 shadow-xs shrink-0 bg-muted">
                    <img
                      src={photoUrl || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=400&auto=format&fit=crop'}
                      alt="Doctor Preview"
                      className="w-full h-full object-cover object-top"
                    />
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <Input
                      value={photoUrl}
                      onChange={e => setPhotoUrl(e.target.value)}
                      placeholder="https://example.com/doctor-photo.jpg"
                      className="h-10 text-xs rounded-xl font-mono text-left"
                      dir="ltr"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      {t('doctor_photo_hint', 'ضع رابط مباشر لصورة الطبيب (PNG أو JPG). تنعكس فوراً في المعاينة الحية.')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Clinic Facility / Main Branch Photo Section */}
              <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-foreground flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-primary" />
                    <span>{t('clinic_branch_photo_label', 'صورة مبنى العيادة / الفرع الرئيسي (تظهر في شاشة حجز المريض والخرائط)')}</span>
                  </Label>
                  {branchImage && (
                    <button
                      type="button"
                      onClick={() => setBranchImage('')}
                      className="text-[10px] text-rose-500 hover:underline font-bold cursor-pointer"
                    >
                      {t('clear_photo', 'إزالة')}
                    </button>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="relative w-28 h-20 rounded-2xl overflow-hidden border-2 border-primary/30 shadow-xs shrink-0 bg-slate-900">
                    <img
                      src={branchImage || 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=400&auto=format&fit=crop'}
                      alt="Clinic Facility Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 w-full space-y-2">
                    <Input
                      value={branchImage}
                      onChange={e => setBranchImage(e.target.value)}
                      placeholder="https://images.unsplash.com/photo-..."
                      className="h-10 text-xs rounded-xl font-mono text-left"
                      dir="ltr"
                    />
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground font-bold flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-500" />
                        <span>صور مقترحة:</span>
                      </span>
                      {[
                        { label: 'مستشفى حديث', url: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=800&auto=format&fit=crop' },
                        { label: 'مركز طبي راقي', url: 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?q=80&w=800&auto=format&fit=crop' },
                        { label: 'عيادة خاصة', url: 'https://images.unsplash.com/photo-1538108149393-fbbd81895907?q=80&w=800&auto=format&fit=crop' }
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setBranchImage(preset.url)}
                          className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-colors cursor-pointer"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground">{t('clinic_name', 'اسم العيادة')}</Label>
                <Input
                  value={clinicName}
                  onChange={e => setClinicName(e.target.value)}
                  placeholder={t('clinic_name', 'عيادة د. أحمد عبد العزيز')}
                  className="h-10 text-xs rounded-xl"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">{t('treating_doctor_name', 'اسم الطبيب المعالج')}</Label>
                  <div className="flex gap-2">
                    <select
                      value={doctorTitle}
                      onChange={e => setDoctorTitle(e.target.value)}
                      className="h-10 text-xs rounded-xl border border-border px-2 bg-background text-foreground w-24 shrink-0"
                    >
                      <option value="د.">{tDynamic('د.')}</option>
                      <option value="أ.د.">{tDynamic('أ.د.')}</option>
                      <option value="دكتورة">{tDynamic('دكتورة')}</option>
                      <option value="استشاري">{tDynamic('استشاري')}</option>
                      <option value="طبيب">{tDynamic('طبيب')}</option>
                      <option value="">{tDynamic('بدون لقب')}</option>
                    </select>
                    <Input
                      value={doctorName}
                      onChange={e => setDoctorName(e.target.value)}
                      placeholder={t('doctor', 'أحمد عبد العزيز')}
                      className="h-10 text-xs rounded-xl flex-1"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">{t('specialty_and_title', 'التخصص والمسمى')}</Label>
                  <Input
                    value={specialty}
                    onChange={e => setSpecialty(e.target.value)}
                    placeholder={t('specialty', 'استشاري الطب الباطني والجهاز الهضمي')}
                    className="h-10 text-xs rounded-xl"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">{t('certification_title_label', 'اللقب / الاعتماد (يظهر على صورة الطبيب)')}</Label>
                  <Input
                    value={certificationTitle}
                    onChange={e => setCertificationTitle(e.target.value)}
                    placeholder={t('certified_doctor', 'طبيب معتمد رسمياً')}
                    className="h-10 text-xs rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">{t('certification_entity_label', 'الجهة المانحة (النقابة / الزمالة)')}</Label>
                  <Input
                    value={certificationEntity}
                    onChange={e => setCertificationEntity(e.target.value)}
                    placeholder="Egyptian Medical Syndicate"
                    className="h-10 text-xs rounded-xl"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">{t('experience_years_label', 'سنوات الخبرة (تظهر في البادج العائم على الصورة)')}</Label>
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    value={experienceYears}
                    onChange={e => setExperienceYears(e.target.value)}
                    placeholder="10"
                    className="h-10 text-xs rounded-xl font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">{t('doctor_rating_label', 'تقييم الطبيب (يظهر على كارت الطبيب)')}</Label>
                  <Input
                    value={doctorRating}
                    onChange={e => setDoctorRating(e.target.value)}
                    placeholder="4.9"
                    className="h-10 text-xs rounded-xl font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground">{t('doctor_bio_label', 'نبذة تعريفية (تظهر للمرضى في الواجهة)')}</Label>
                <Textarea
                  value={heroSubtitle}
                  onChange={e => setHeroSubtitle(e.target.value)}
                  placeholder="نقدم لك ولأسرتك رعاية صحية متكاملة تعتمد على أحدث التقنيات وأفضل الكوادر الطبية المتخصصة..."
                  className="text-xs rounded-xl h-24 leading-relaxed"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground">{t('system_primary_color', 'اللون الرئيسي للنظام')}</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={e => setPrimaryColor(e.target.value)}
                    className="w-10 h-10 rounded-xl cursor-pointer border border-border p-0.5 bg-background shrink-0"
                  />
                  <Input
                    value={primaryColor}
                    onChange={e => setPrimaryColor(e.target.value)}
                    className="h-10 w-32 font-mono text-xs rounded-xl text-left"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 pt-1">
                <div className="space-y-1.5 p-3 rounded-xl bg-muted/30 border border-border">
                  <Label className="text-xs font-bold text-muted-foreground">{t('clinic_status_toggle', 'حالة العيادة (مفتوحة / مغلقة)')}</Label>
                  <div className="flex items-center gap-2 pt-1">
                    <Switch checked={isClinicOpen} onCheckedChange={setIsClinicOpen} />
                    <span className="text-xs text-foreground font-bold">{isClinicOpen ? t('clinic_open_accepting', 'العيادة تستقبل حجوزات') : t('clinic_closed_now', 'العيادة مغلقة حالياً')}</span>
                  </div>
                </div>

                <div className="space-y-1.5 p-3 rounded-xl bg-muted/30 border border-border">
                  <Label className="text-xs font-bold text-muted-foreground">{t('show_prices_to_patients', 'إظهار أسعار الكشوفات للمرضى')}</Label>
                  <div className="flex items-center gap-2 pt-1">
                    <Switch checked={showPrices} onCheckedChange={setShowPrices} />
                    <span className="text-xs text-foreground font-bold">{showPrices ? t('prices_visible', 'الأسعار ظاهرة') : t('prices_hidden', 'الأسعار مخفية')}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 pt-2">
                <Label className="text-xs font-bold text-muted-foreground">{t('detailed_clinic_address', 'عنوان العيادة التفصيلي')}</Label>
                <Input
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="شارع التسعين الشمالي، التجمع الخامس، القاهرة"
                  className="h-10 text-xs rounded-xl"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs font-bold text-muted-foreground">{t('clinic_phone_numbers', 'أرقام هواتف العيادة (للحجز والواتساب)')}</Label>
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
                          className={`h-10 text-xs rounded-xl font-mono ${isRtl ? 'text-right' : 'text-left'}`}
                          dir="ltr"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setPhones(phones.filter((_, i) => i !== idx))}
                          className="text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      onClick={() => setPhones([...phones, ''])}
                      className="w-full border-dashed h-10 text-xs font-bold text-primary border-primary/30 hover:bg-primary/5 cursor-pointer"
                    >
                      <Plus className={`w-4 h-4 ${isRtl ? 'ml-2' : 'mr-2'}`} /> {t('add_another_phone', 'إضافة رقم آخر')}
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5 col-span-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-muted-foreground">{t('google_maps_link', 'رابط موقع العيادة (Google Maps)')}</Label>
                    <span className="text-[10px] text-sky-500 font-bold">استخراج تلقائي للإحداثيات 📍</span>
                  </div>
                  <Input
                    value={mapsLink}
                    onChange={e => {
                      const val = e.target.value
                      setMapsLink(val)
                      const coords = extractCoordsFromLink(val)
                      if (coords) {
                        setLatitude(String(coords.lat))
                        setLongitude(String(coords.lng))
                      } else if (val.includes('maps.app.goo.gl') || val.includes('goo.gl')) {
                        fetch(`/api/resolve-maps-coords?url=${encodeURIComponent(val)}`)
                          .then((res) => res.json())
                          .then((data) => {
                            if (data.success && data.lat && data.lng) {
                              setLatitude(String(data.lat))
                              setLongitude(String(data.lng))
                              toast.success('تم استخراج إحداثيات العيادة تلقائياً من الرابط المختصر')
                            }
                          })
                          .catch(() => {})
                      }
                    }}
                    placeholder="https://maps.google.com/..."
                    className={`h-10 text-xs rounded-xl font-mono ${isRtl ? 'text-right' : 'text-left'}`}
                    dir="ltr"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 col-span-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-muted-foreground">Latitude (خط العرض)</Label>
                    <Input
                      value={latitude}
                      onChange={(e) => setLatitude(e.target.value)}
                      placeholder="30.1294"
                      className="h-10 text-xs rounded-xl font-mono"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-muted-foreground">Longitude (خط الطول)</Label>
                    <Input
                      value={longitude}
                      onChange={(e) => setLongitude(e.target.value)}
                      placeholder="31.2485"
                      className="h-10 text-xs rounded-xl font-mono"
                      dir="ltr"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Preview Side */}
            <div className="yalla-card overflow-hidden bg-slate-100/70 dark:bg-slate-900/40 relative flex flex-col hidden lg:flex border border-border sticky top-20 h-[calc(100vh-120px)] min-h-[700px] shadow-sm">
              <div className="p-3 border-b border-border bg-card flex items-center justify-between shadow-xs z-10 gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <h3 className="font-bold text-xs sm:text-sm text-foreground">
                    {t('patient_live_preview', 'معاينة حية لصفحة المريض')}
                  </h3>
                </div>
                
                <div className="flex items-center gap-2">
                  {/* Device Switcher */}
                  <div className="flex items-center bg-muted p-1 rounded-xl border border-border">
                    <button
                      type="button"
                      onClick={() => setPreviewDevice('desktop')}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        previewDevice === 'desktop'
                          ? 'bg-background text-primary shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      title="معاينة شاشة الكمبيوتر"
                    >
                      <Monitor className="w-3.5 h-3.5" />
                      <span>كمبيوتر</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewDevice('mobile')}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        previewDevice === 'mobile'
                          ? 'bg-background text-primary shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      title="معاينة شاشة الموبايل"
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>موبايل</span>
                    </button>
                  </div>

                  {/* Open in new tab */}
                  <a
                    href={`/clinic/${slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-muted transition-colors flex items-center gap-1 text-xs font-bold"
                    title={t('open_live_page', 'فتح صفحة العيادة')}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
              
              {/* Scrollable Preview Area */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar bg-slate-100/80 dark:bg-slate-950 p-3 sm:p-4 flex flex-col items-center">
                {previewDevice === 'desktop' ? (
                  /* Desktop Browser Frame Simulator */
                  <div className="w-full flex flex-col items-center">
                    {/* Browser Bar */}
                    <div className="w-full max-w-[580px] bg-slate-200 dark:bg-slate-800 rounded-t-xl px-3 py-1.5 flex items-center gap-2 border border-border border-b-0">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block"></span>
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span>
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block"></span>
                      </div>
                      <div className="flex-1 bg-white/70 dark:bg-slate-900/70 text-[10px] text-muted-foreground rounded-md px-3 py-0.5 text-center truncate font-mono" dir="ltr">
                        yallaclinic.com/clinic/{slug}
                      </div>
                    </div>

                    {/* Scaled Desktop Viewport */}
                    <div className="w-full overflow-hidden flex justify-center rounded-b-xl border border-border bg-white shadow-xl">
                      <div
                        style={{
                          width: '1100px',
                          transform: 'scale(0.52)',
                          transformOrigin: 'top center',
                          marginBottom: '-48%'
                        }}
                        className="shrink-0 pointer-events-auto select-none"
                      >
                        <PremiumLanding 
                          key={`desk-${clinicName}-${doctorName}-${specialty}-${primaryColor}-${photoUrl}-${experienceYears}-${doctorRating}-${isClinicOpen}-${showPrices}-${heroSubtitle}`}
                          clinic={{
                            slug,
                            clinicName: clinicName || t('clinic_name', 'عيادة الأمل التخصصية'),
                            doctorName: doctorName || 'Ahmed Abdelaziz',
                            doctorTitle: doctorTitle || 'د.',
                            specialty: specialty || 'Consultant of Internal Medicine',
                            heroSubtitle: heroSubtitle || '',
                            certificationTitle: certificationTitle || '',
                            certificationEntity: certificationEntity || '',
                            experienceYears: Number(experienceYears) || 10,
                            doctorRating: doctorRating || '4.9',
                            heroImage: photoUrl || '',
                            branchImage: branchImage || '',
                            logoUrl: logoUrl || '',
                            primaryColor: primaryColor || '#087CF4',
                            clinicPhone: phones[0] || '01012345678',
                            clinicPhones: phones.filter(p => typeof p === 'string' && p.trim() !== ''),
                            clinicAddress: address || '90th St, New Cairo',
                            mapsLink: mapsLink || '',
                            latitude: latitude ? parseFloat(latitude) : undefined,
                            longitude: longitude ? parseFloat(longitude) : undefined,
                            isClinicOpen: isClinicOpen !== false,
                            showPrices: showPrices !== false,
                            hidePrices: !showPrices,
                            services: services || [],
                            aiEnabled: aiEnabled
                          }} 
                          services={services || []} 
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Mobile Phone Frame Simulator */
                  <div className="w-[360px] max-w-full my-auto rounded-[38px] border-4 border-slate-800 dark:border-slate-700 shadow-2xl overflow-hidden bg-background flex flex-col shrink-0">
                    {/* iPhone Dynamic Island */}
                    <div className="h-7 bg-slate-900 flex items-center justify-between px-6 text-white text-[10px] font-bold shrink-0">
                      <span>9:41</span>
                      <div className="w-20 h-3.5 bg-black rounded-full" />
                      <span>5G 100%</span>
                    </div>
                    {/* Screen Content */}
                    <div className="h-[580px] overflow-y-auto no-scrollbar">
                      <PremiumLanding 
                        key={`mob-${clinicName}-${doctorName}-${specialty}-${primaryColor}-${photoUrl}-${experienceYears}-${doctorRating}-${isClinicOpen}-${showPrices}-${heroSubtitle}`}
                        clinic={{
                          slug,
                          clinicName: clinicName || t('clinic_name', 'عيادة الأمل التخصصية'),
                          doctorName: doctorName || 'Ahmed Abdelaziz',
                          doctorTitle: doctorTitle || 'د.',
                          specialty: specialty || 'Consultant of Internal Medicine',
                          heroSubtitle: heroSubtitle || '',
                          certificationTitle: certificationTitle || '',
                          certificationEntity: certificationEntity || '',
                          experienceYears: Number(experienceYears) || 10,
                          doctorRating: doctorRating || '4.9',
                          heroImage: photoUrl || '',
                          branchImage: branchImage || '',
                          logoUrl: logoUrl || '',
                          primaryColor: primaryColor || '#087CF4',
                          clinicPhone: phones[0] || '01012345678',
                          clinicPhones: phones.filter(p => typeof p === 'string' && p.trim() !== ''),
                          clinicAddress: address || '90th St, New Cairo',
                          mapsLink: mapsLink || '',
                          latitude: latitude ? parseFloat(latitude) : undefined,
                          longitude: longitude ? parseFloat(longitude) : undefined,
                          isClinicOpen: isClinicOpen !== false,
                          showPrices: showPrices !== false,
                          hidePrices: !showPrices,
                          services: services || [],
                          aiEnabled: aiEnabled
                        }} 
                        services={services || []} 
                      />
                    </div>
                    {/* Home Bar Indicator */}
                    <div className="h-4 bg-background flex items-center justify-center shrink-0">
                      <div className="w-28 h-1 bg-slate-400 dark:bg-slate-600 rounded-full" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* TAB 2: Queue & Visit Duration */}
      {activeTab === 'queue' && (
        <div className="yalla-card p-6 max-w-2xl space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            <Clock className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-sm text-foreground">{t('queue_organization_speed', 'تنظيم المواعيد وسرعة الكشف')}</h3>
          </div>

          <div className="space-y-4">
            <div className="space-y-2 pb-4 border-b border-border">
              <Label className="text-xs font-bold text-muted-foreground">
                {t('avg_visit_time_mins', 'متوسط وقت الكشف المتوقع لكل مريض (بالدقائق)')}
              </Label>
              <Input
                type="number"
                value={averageVisitTime}
                onChange={e => setAverageVisitTime(Number(e.target.value))}
                className="h-10 text-sm rounded-xl max-w-xs font-bold"
                min={3}
                max={60}
              />
              <p className="text-[11px] text-muted-foreground">
                {t('avg_visit_time_hint', 'يُستخدم لحساب الوقت التقريبي المتبقي لشاشة تتبع دور المريض الذكية تلقائياً.')}
              </p>
            </div>

            <div className="space-y-2 pb-4 border-b border-border">
              <Label className="text-xs font-bold text-muted-foreground">
                {t('max_daily_bookings_label', 'الحد الأقصى لعدد الكشوفات يومياً')}
              </Label>
              <Input
                type="number"
                value={maxDailyBookings || ''}
                onChange={e => setMaxDailyBookings(Number(e.target.value) || 0)}
                placeholder={t('max_daily_bookings_placeholder', 'مثال: 50 (أو 0 لعدد غير محدود)')}
                className="h-10 text-sm rounded-xl max-w-xs font-bold"
                min={0}
                max={500}
              />
              <p className="text-[11px] text-muted-foreground">
                {t('max_daily_bookings_hint', 'عند اكتمال هذا العدد من الحجوزات في أي يوم، يتم إغلاق الحجز لذلك اليوم تلقائياً وإتاحة اليوم التالي للمرضى.')}
              </p>
            </div>

            <div className="space-y-4 pt-4 border-t border-border">
              <h4 className="font-bold text-sm text-foreground">{t('weekly_operating_hours', 'مواعيد العمل الأسبوعية')}</h4>
              <p className="text-xs text-muted-foreground">{t('weekly_operating_desc', 'تحديد أيام العمل ومواعيد استقبال المرضى')}</p>
              <div className="space-y-3">
                {weeklySchedule.map((day, idx) => (
                  <div key={day.id} className="flex items-center justify-between p-3 bg-muted/40 border border-border rounded-xl">
                    <div className="flex items-center gap-3 w-32">
                      <Switch
                        checked={day.isOpen}
                        onCheckedChange={(val) => {
                          const newS = [...weeklySchedule];
                          newS[idx].isOpen = val;
                          setWeeklySchedule(newS);
                        }}
                      />
                      <span className="text-xs font-bold text-foreground">{tDynamic(day.day)}</span>
                    </div>
                    {day.isOpen && (
                      <div className="flex items-center gap-2">
                        <Input
                          type="time"
                          value={day.start}
                          onChange={(e) => {
                            const newS = [...weeklySchedule];
                            newS[idx].start = e.target.value;
                            setWeeklySchedule(newS);
                          }}
                          className="h-9 text-xs w-28"
                        />
                        <span className="text-xs text-muted-foreground">{t('to_time', 'إلى')}</span>
                        <Input
                          type="time"
                          value={day.end}
                          onChange={(e) => {
                            const newS = [...weeklySchedule];
                            newS[idx].end = e.target.value;
                            setWeeklySchedule(newS);
                          }}
                          className="h-9 text-xs w-28"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-border">
              <h4 className="font-bold text-sm text-foreground">{t('queue_ordering_pattern', 'نظام ترتيب الأدوار (نمط الدخول)')}</h4>
              <p className="text-xs text-muted-foreground">{t('queue_ordering_desc', 'حدد عدد الحالات التي تدخل بالترتيب قبل إعادة الدورة. اكتب (0) للمستعجل ليدخل فوراً قبل أي خدمة أخرى.')}</p>
              
              <div className="grid grid-cols-3 gap-4 max-w-lg">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-rose-500">{t('urgent_consultation', 'كشف مستعجل')}</Label>
                  <Input
                    type="number"
                    value={queueUrgent}
                    onChange={e => setQueueUrgent(Number(e.target.value))}
                    className="h-10 text-sm rounded-xl font-bold border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                    min={0}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">{t('normal_consultation', 'كشف عادي')}</Label>
                  <Input
                    type="number"
                    value={queueNormal}
                    onChange={e => setQueueNormal(Number(e.target.value))}
                    className="h-10 text-sm rounded-xl font-bold"
                    min={0}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-primary">{t('consultation', 'استشارة')}</Label>
                  <Input
                    type="number"
                    value={queueConsult}
                    onChange={e => setQueueConsult(Number(e.target.value))}
                    className="h-10 text-sm rounded-xl font-bold border-primary/30 bg-primary/10 text-primary"
                    min={0}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Services & Pricing */}
      {activeTab === 'services' && (
        <div className="yalla-card p-6 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-border">
            <div>
              <h3 className="font-bold text-sm text-foreground">{t('services_catalog_title', 'الخدمات والأسعار المعتمدة في العيادة')}</h3>
              <p className="text-xs text-muted-foreground">{t('services_catalog_desc', 'تظهر هذه الخدمات في نموذج حجز المرضى وشاشة دور اليوم')}</p>
            </div>
          </div>

          {/* Add New Service Form */}
          <div className="p-4 rounded-xl bg-muted/40 border border-border flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 space-y-1 w-full">
              <Label className="text-xs font-bold text-muted-foreground">{t('service_name', 'اسم الخدمة')}</Label>
              <Input
                value={newServiceName}
                onChange={e => setNewServiceName(e.target.value)}
                placeholder={t('service_name_placeholder', 'مثال: رسم قلب، متابعة سكر')}
                className="h-10 text-xs rounded-xl bg-background"
              />
            </div>
            <div className="w-full sm:w-40 space-y-1">
              <Label className="text-xs font-bold text-muted-foreground">{t('service_price_egp', 'السعر (ج.م)')}</Label>
              <Input
                type="number"
                value={newServicePrice}
                onChange={e => setNewServicePrice(Number(e.target.value))}
                className="h-10 text-xs rounded-xl bg-background"
              />
            </div>
            <Button
              onClick={addService}
              className="h-10 px-5 text-xs font-bold yalla-gradient-btn text-white rounded-xl shadow-xs"
            >
              <Plus className={`w-4 h-4 ${isRtl ? 'ml-1' : 'mr-1'}`} />
              {t('add_service', 'إضافة خدمة')}
            </Button>
          </div>

          {/* Existing Services List */}
          <div className="divide-y divide-border">
            {services.map((service) => (
              <div key={service.id} className="py-3.5 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs text-foreground">{tDynamic(service.name)}</h4>
                  <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">{service.price} {t('currency_egp', 'ج.م')}</span>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => removeService(service.id)}
                  className="text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10"
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
        <div className="yalla-card p-6 max-w-2xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div>
              <h3 className="font-bold text-sm text-foreground">{t('enable_online_payment', 'تفعيل الدفع الإلكتروني (Online Payment)')}</h3>
              <p className="text-xs text-muted-foreground">{t('online_payment_desc', 'إتاحة الدفع عبر محفظة إلكترونية أو انستاباي أثناء حجز المريض')}</p>
            </div>
            <Switch
              checked={onlinePaymentEnabled}
              onCheckedChange={setOnlinePaymentEnabled}
            />
          </div>

          {onlinePaymentEnabled && (
            <div className="space-y-4 pt-4 border-t border-border">
              <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl border border-border">
                <div className="flex items-center gap-3">
                  <Switch checked={isWalletEnabled} onCheckedChange={setIsWalletEnabled} />
                  <div>
                    <p className="font-bold text-sm text-foreground">{t('enable_e_wallet', 'تفعيل الدفع بالمحفظة الإلكترونية (فودافون كاش وغيرها)')}</p>
                  </div>
                </div>
              </div>
              {isWalletEnabled && (
                <div className={`space-y-1.5 ${isRtl ? 'pr-14' : 'pl-14'}`}>
                  <Label className="text-xs font-bold text-muted-foreground">{t('wallet_number', 'رقم المحفظة')}</Label>
                  <Input
                    value={walletNumber}
                    onChange={e => setWalletNumber(e.target.value)}
                    placeholder="010xxxxxxxx"
                    className={`h-10 text-xs rounded-xl font-mono ${isRtl ? 'text-right' : 'text-left'}`}
                    dir="ltr"
                  />
                </div>
              )}

              <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl border border-border">
                <div className="flex items-center gap-3">
                  <Switch checked={isInstapayEnabled} onCheckedChange={setIsInstapayEnabled} />
                  <div>
                    <p className="font-bold text-sm text-foreground">{t('enable_instapay', 'تفعيل الدفع عبر إنستاباي (InstaPay)')}</p>
                  </div>
                </div>
              </div>
              {isInstapayEnabled && (
                <div className={`space-y-1.5 ${isRtl ? 'pr-14' : 'pl-14'}`}>
                  <Label className="text-xs font-bold text-muted-foreground">{t('instapay_handle', 'معرف إنستاباي (InstaPay Handle)')}</Label>
                  <Input
                    value={instapayHandle}
                    onChange={e => setInstapayHandle(e.target.value)}
                    placeholder="name@instapay"
                    className={`h-10 text-xs rounded-xl font-mono ${isRtl ? 'text-right' : 'text-left'}`}
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
        <div className="yalla-card p-6 space-y-6">
          <div className="pb-3 border-b border-border">
            <h3 className="font-bold text-sm text-foreground">{t('staff_accounts_permissions', 'حسابات المساعدين والصلاحيات الممنوحة')}</h3>
            <p className="text-xs text-muted-foreground">{t('staff_accounts_desc', 'إدارة حسابات الدخول لسكرتارية العيادة وتحديد الأقسام المتاحة لهم')}</p>
          </div>

          {/* Permissions Toggle Matrix */}
          <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-3">
            <h4 className="text-xs font-black text-foreground">{t('authorized_sections', 'الأقسام المصرح للمساعد بالوصول إليها:')}</h4>
            <div className="grid sm:grid-cols-3 gap-3">
              {[
                { id: 'appointments', label: t('nav_queue', 'دور اليوم والمواعيد') },
                { id: 'patients', label: t('nav_patients', 'سجل المرضى') },
                { id: 'prescriptions', label: t('nav_prescriptions', 'الروشتات الطبية') },
                { id: 'drugs', label: t('nav_drugs', 'دليل الأدوية') },
                { id: 'accounts', label: t('nav_accounts', 'الحسابات اليومية') },
                { id: 'finance', label: t('nav_finance', 'التقارير المالية') },
              ].map(perm => (
                <label key={perm.id} className="flex items-center gap-2 text-xs font-bold text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={assistantPermissions.includes(perm.id)}
                    onChange={() => togglePermission(perm.id)}
                    className="rounded text-primary focus:ring-primary"
                  />
                  <span>{perm.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Add Assistant Form */}
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 space-y-1 w-full">
              <Label className="text-xs font-bold text-muted-foreground">{t('assistant_email', 'بريد المساعد')}</Label>
              <Input
                type="email"
                value={newAssistantEmail}
                onChange={e => setNewAssistantEmail(e.target.value)}
                placeholder="assistant@clinic.com"
                className="h-10 text-xs rounded-xl"
              />
            </div>
            <div className="flex-1 space-y-1 w-full">
              <Label className="text-xs font-bold text-muted-foreground">{t('assistant_password', 'كلمة المرور')}</Label>
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
              className="h-10 px-5 text-xs font-bold yalla-gradient-btn text-white rounded-xl shadow-xs"
            >
              <Plus className={`w-4 h-4 ${isRtl ? 'ml-1' : 'mr-1'}`} />
              {t('add_assistant', 'إضافة مساعد')}
            </Button>
          </div>

          {/* Assistants List */}
          <div className="divide-y divide-border">
            {assistants.map((ass) => (
              <div key={ass.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-bold text-xs text-foreground">{ass.email}</p>
                  <span className="text-[10px] text-muted-foreground">{t('assistant_role_tag', 'صلاحية: مساعد عيادة')}</span>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => removeAssistant(ass.id)}
                  className="text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10"
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
        <div className="yalla-card p-6 max-w-2xl space-y-4">
          <div className="pb-3 border-b border-border">
            <h3 className="font-bold text-sm text-foreground">{t('print_settings_title', 'إعدادات ورقة الروشتة المطبوعة (A4)')}</h3>
            <p className="text-xs text-muted-foreground">{t('print_settings_desc', 'تخصيص الهامش والترويسة السفلية في الطباعة')}</p>
          </div>
          <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2 text-xs text-foreground font-medium">
            <p className="font-bold text-foreground">{t('print_format_approved', 'تنسيق الطباعة المعتمد:')}</p>
            <p>✓ {t('print_bullet_1', 'تم ضبط مقاس الطباعة القياسي A4 بما يتوافق مع جميع طابعات العيادات الحرارية والعادية.')}</p>
            <p>✓ {t('print_bullet_2', 'يتم إخفاء أزرار التحكم والقوائم الجانبية تلقائياً أثناء أمر الطباعة.')}</p>
          </div>
        </div>
      )}

      {/* TAB 7: AI Assistant */}
      {activeTab === 'ai' && (
        <div className="yalla-card p-6 max-w-3xl space-y-6 text-center">
          <div className="pb-3 border-b border-border">
            <h3 className="font-bold text-sm text-foreground flex items-center justify-center gap-2">
              <Bot className="w-5 h-5 text-primary" />
              {t('ai_chatbot_settings', 'إعدادات المساعد الذكي (AI Chatbot)')}
            </h3>
          </div>
          <div className="p-8 rounded-2xl bg-muted/40 border border-border space-y-4">
            <Bot className="w-16 h-16 text-muted-foreground/60 mx-auto" />
            <h4 className="text-lg font-black text-foreground">{t('ai_managed_by_platform', 'هذه الخاصية تدار بواسطة الإدارة')}</h4>
            <p className="text-sm text-muted-foreground font-medium">
              {t('ai_managed_desc', 'لا يمكنك تعديل إعدادات المساعد الذكي أو تفعيله بنفسك. يرجى التواصل مع فريق الدعم الفني للمنصة.')}
            </p>
            {supportNumbers.filter((n: any) => n.isActive).length > 0 ? (
              <div className="flex flex-wrap justify-center gap-3 pt-6">
                {supportNumbers.filter((n: any) => n.isActive).map((num: any, idx: number) => (
                  <a key={idx} href={`https://wa.me/20${num.phone.replace(/^0/, '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-xl font-bold text-sm hover:bg-emerald-500/20 transition-colors shadow-xs">
                    <MessageCircle className="w-4 h-4" />
                    {num.label || t('technical_support', 'الدعم الفني')} - {num.phone}
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-xs text-rose-500 font-bold pt-6">{t('no_support_numbers', 'لا توجد أرقام دعم فني متاحة حالياً.')}</p>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
