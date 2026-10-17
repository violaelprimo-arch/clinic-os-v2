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
  Copy, CheckCircle, RefreshCw, ChevronLeft, Calendar, Download,
  FileSpreadsheet, Layers, Key, EyeOff, Package, Crown,
  Gem, Rocket, Stethoscope, Building2, Star, Award, Zap, X, Tag,
  Palette, Pill, Receipt, Bell, CreditCard
} from 'lucide-react'
import { db } from '@/lib/firebase'
import { collection, addDoc, getDocs, deleteDoc, updateDoc, doc, setDoc, onSnapshot } from 'firebase/firestore'
import { Switch } from '@/components/ui/switch'
import { motion, AnimatePresence } from 'framer-motion'
import { ClinicLogo } from '@/components/clinic/ClinicLogo'
import { SINGLE_CLINIC_SLUG } from '@/lib/single-clinic'
import { hashPassword } from '@/lib/auth-crypto'
import { recordAuditLog } from '@/lib/audit-logger'
import { createClinicNotification } from '@/lib/notificationService'
import { exportDoctorsExcel, exportExpiringSubscriptionsExcel } from '@/lib/excelExport'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'
import Link from 'next/link'
import { SYSTEM_FEATURES } from '@/lib/featurePermissions'
import { useLanguage } from '@/context/LanguageContext'
import { PhoneInputWithCountry } from '@/components/ui/PhoneInputWithCountry'
import { cleanPhoneForWhatsApp } from '@/lib/countryPhoneHelper'

function formatTime12(timeStr?: string): string {
  if (!timeStr) return ''
  const [hStr, mStr] = timeStr.split(':')
  let h = parseInt(hStr, 10)
  const m = mStr || '00'
  if (isNaN(h)) return timeStr
  const period = h >= 12 ? 'م' : 'ص'
  h = h % 12 || 12
  return `${h}:${m} ${period}`
}

function getLocalDate(): string {
  return new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]
}

function getDoctorScheduleSummary(weeklySchedule?: any[]): { summaryText: string; count: number } {
  if (!Array.isArray(weeklySchedule) || weeklySchedule.length === 0) {
    return { summaryText: 'السبت - الخميس (05:00 م - 10:00 م)', count: 6 }
  }
  const openDays = weeklySchedule.filter((s: any) => s.isOpen !== false)
  if (openDays.length === 0) {
    return { summaryText: 'مغلق طوال الأسبوع', count: 0 }
  }
  if (openDays.length === 7) {
    const first = openDays[0]
    return {
      summaryText: `يومياً (${first?.start ? formatTime12(first.start) : '05:00 م'} - ${first?.end ? formatTime12(first.end) : '10:00 م'})`,
      count: 7
    }
  }
  const first = openDays[0]
  return {
    summaryText: `${openDays.length} أيام (${first?.start ? formatTime12(first.start) : '05:00 م'} - ${first?.end ? formatTime12(first.end) : '10:00 م'})`,
    count: openDays.length
  }
}

function resolveDoctorNumericPrice(clinic: any, packagesList: any[] = []): number {
  if (clinic.packagePrice !== undefined && clinic.packagePrice !== null && clinic.packagePrice !== '') {
    const num = Number(clinic.packagePrice)
    if (!isNaN(num) && num > 0) return num
  }
  const pkg = packagesList.find(p => p.name === clinic.packageName)
  if (pkg && pkg.price) {
    const num = Number(pkg.price)
    if (!isNaN(num) && num > 0) return num
  }
  const pName = (clinic.packageName || '').toLowerCase()
  if (pName.includes('1800') || pName.includes('ماس') || pName.includes('diamond') || pName.includes('vip')) return 1800
  if (pName.includes('950') || pName.includes('احتراف') || pName.includes('pro')) return 950
  if (pName.includes('سنو') || pName.includes('annual')) return 9500
  return 450
}

function resolveDoctorPackagePrice(clinic: any, packagesList: any[]): string {
  if (clinic.packagePrice !== undefined && clinic.packagePrice !== null && clinic.packagePrice !== '') {
    return `${Number(clinic.packagePrice).toLocaleString('ar-EG')} ج.م`
  }
  const pkg = packagesList.find(p => p.name === clinic.packageName)
  if (pkg && pkg.price) {
    return `${Number(pkg.price).toLocaleString('ar-EG')} ج.م`
  }
  const pName = (clinic.packageName || '').toLowerCase()
  if (pName.includes('1800') || pName.includes('ماس') || pName.includes('diamond') || pName.includes('vip')) return '1,800 ج.م'
  if (pName.includes('950') || pName.includes('احتراف') || pName.includes('pro')) return '950 ج.م'
  if (pName.includes('سنو') || pName.includes('annual')) return '9,500 ج.م'
  return '450 ج.م'
}

function getDoctorExpirationInfo(expirationDate?: string, isActive?: boolean) {
  if (!expirationDate) {
    return {
      text: 'اشتراك مفتوح',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
      daysLeft: null,
      isExpired: false
    }
  }
  const exp = new Date(expirationDate)
  const now = new Date()
  const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (isActive === false) {
    return {
      text: 'الحساب موقوف',
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
      daysLeft: diffDays,
      isExpired: true
    }
  }
  if (diffDays < 0) {
    return {
      text: `منتهي (${Math.abs(diffDays)} يوم)`,
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
      daysLeft: diffDays,
      isExpired: true
    }
  }
  if (diffDays <= 7) {
    return {
      text: `ينتهي خلال ${diffDays} ${diffDays === 1 ? 'يوم' : 'أيام'}`,
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 font-bold animate-pulse',
      daysLeft: diffDays,
      isExpired: false
    }
  }
  return {
    text: `ساري (متبقي ${diffDays} يوم)`,
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold',
    daysLeft: diffDays,
    isExpired: false
  }
}

export default function OwnerDashboard() {
  const { dir, t, isRtl, language } = useLanguage()
  const [clinics, setClinics] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'clinics' | 'doctors' | 'packages' | 'add' | 'settings'>('clinics')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMode, setFilterMode] = useState<'all' | 'active' | 'inactive' | 'ai-on' | 'ai-off'>('all')

  // Synchronize tabs with the Super Admin sidebar in OwnerLayout
  useEffect(() => {
    const handleTabChange = (e: any) => {
      if (e.detail?.tab) setActiveTab(e.detail.tab)
    }
    window.addEventListener('owner_tab_change', handleTabChange)
    return () => window.removeEventListener('owner_tab_change', handleTabChange)
  }, [])

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('owner_tab_changed', { detail: { tab: activeTab } }))
  }, [activeTab])

  // Doctors Tab State
  const [doctorsSearchQuery, setDoctorsSearchQuery] = useState('')
  const [showPasswords, setShowPasswords] = useState<{ [id: string]: boolean }>({})
  const [scheduleModalClinic, setScheduleModalClinic] = useState<any | null>(null)
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'unpaid' | 'expiring_soon'>('all')

  // Payment Settlement Modal State (خانة تسديد حساب الدكتور والعيادة)
  const [paymentModalClinic, setPaymentModalClinic] = useState<any | null>(null)
  const [settleAmount, setSettleAmount] = useState<number | string>('')
  const [settleMethod, setSettleMethod] = useState<'instapay' | 'vodafone_cash' | 'cash' | 'bank_transfer' | 'other'>('instapay')
  const [settleDate, setSettleDate] = useState<string>(getLocalDate())
  const [settleNotes, setSettleNotes] = useState<string>('')
  const [isSubmittingPayment, setIsSubmittingPayment] = useState<boolean>(false)

  // Packages Management State
  const [packages, setPackages] = useState<any[]>([])
  const [showPackagesInClinics, setShowPackagesInClinics] = useState<boolean>(true)
  const [isTogglingPackagesVisibility, setIsTogglingPackagesVisibility] = useState<boolean>(false)
  const [packageCategoryFilter, setPackageCategoryFilter] = useState<'all' | 'monthly' | '3_months' | '6_months' | 'annual'>('all')
  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false)
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null)
  const [pkgName, setPkgName] = useState('')
  const [pkgSubtitle, setPkgSubtitle] = useState('')
  const [pkgLogoUrl, setPkgLogoUrl] = useState('')
  const [pkgIcon, setPkgIcon] = useState('crown')
  const [pkgColor, setPkgColor] = useState('#087CF4')
  const [pkgPrice, setPkgPrice] = useState<number | string>(450)
  const [pkgOriginalPrice, setPkgOriginalPrice] = useState<number | string>('')
  const [pkgDiscountBadge, setPkgDiscountBadge] = useState('')
  const [pkgCategory, setPkgCategory] = useState<'monthly' | '3_months' | '6_months' | 'annual'>('monthly')
  const [pkgPeriod, setPkgPeriod] = useState('شهري')
  const [pkgAiLimit, setPkgAiLimit] = useState<number | string>(100)
  const [pkgMaxBranches, setPkgMaxBranches] = useState<number | string>(1)
  const [pkgBadge, setPkgBadge] = useState('')
  const [pkgIsPopular, setPkgIsPopular] = useState(false)
  const [pkgFeatures, setPkgFeatures] = useState('')
  const [pkgNewFeatureInput, setPkgNewFeatureInput] = useState('')

  // Granular Package Feature Flags
  const [pkgAllowFinance, setPkgAllowFinance] = useState(true)
  const [pkgAllowDrugs, setPkgAllowDrugs] = useState(true)
  const [pkgAllowPrescriptions, setPkgAllowPrescriptions] = useState(true)
  const [pkgAllowCustomTemplate, setPkgAllowCustomTemplate] = useState(false)
  const [pkgAllowBranding, setPkgAllowBranding] = useState(true)
  const [pkgAllowPatientAlerts, setPkgAllowPatientAlerts] = useState(true)
  const [pkgAllowAi, setPkgAllowAi] = useState(true)
  const [pkgAllowBranches, setPkgAllowBranches] = useState(true)
  const [pkgAllowOnlineBooking, setPkgAllowOnlineBooking] = useState(true)

  // Clinic Package & AI Limits for active clinic
  const [packageName, setPackageName] = useState('الباقة الأساسية')
  const [aiResponsesLimit, setAiResponsesLimit] = useState<number | string>(100)
  const [aiResponsesCount, setAiResponsesCount] = useState<number>(0)
  const [isPaid, setIsPaid] = useState<boolean>(true)

  // Granular Clinic Feature Overrides
  const [allowFinance, setAllowFinance] = useState(true)
  const [allowDrugs, setAllowDrugs] = useState(true)
  const [allowPrescriptions, setAllowPrescriptions] = useState(true)
  const [allowCustomTemplate, setAllowCustomTemplate] = useState(true)
  const [allowPatientAlerts, setAllowPatientAlerts] = useState(true)
  const [allowOnlineBooking, setAllowOnlineBooking] = useState(true)

  // Edit mode
  const [editingId, setEditingId] = useState<string | null>(null)
  const [globalApiKey, setGlobalApiKey] = useState('')
  const [resendApiKey, setResendApiKey] = useState('')
  const [supportNumbers, setSupportNumbers] = useState<any[]>([{phone: '01551007018', label: 'دعم المنصة', isActive: true}])
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

  // Branch Limits (TASK 9)
  const [branchesEnabled, setBranchesEnabled] = useState(true)
  const [maxBranches, setMaxBranches] = useState<number>(1)
  const [branchCreationAllowed, setBranchCreationAllowed] = useState(true)

  // Clinic Branding (TASK 10)
  const [allowDoctorEditBranding, setAllowDoctorEditBranding] = useState(true)
  const [logoUrl, setLogoUrl] = useState('')
  const [thermalMonoLogoUrl, setThermalMonoLogoUrl] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#087CF4')
  const [secondaryColor, setSecondaryColor] = useState('#02CFF3')
  const [specialty, setSpecialty] = useState('')
  const [certificationTitle, setCertificationTitle] = useState('')
  const [clinicAddress, setClinicAddress] = useState('')

  // Landing page customization
  const [heroImage, setHeroImage] = useState('https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=2000&auto=format&fit=crop')
  const [heroTitle, setHeroTitle] = useState('صحتك تستحق العناية الفائقة')
  const [heroSubtitle, setHeroSubtitle] = useState('نقدم لك ولعائلتك رعاية صحية متكاملة تعتمد على أحدث التقنيات وأفضل الكوادر الطبية المتخصصة لضمان سلامتك وتوفير راحتك.')

  // Badges
  const [badge1Title, setBadge1Title] = useState('أطباء معتمدون')
  const [badge1Value, setBadge1Value] = useState('خبرة +15 سنة')
  const [badge2Title, setBadge2Title] = useState('تقييم العيادة')
  const [badge2Value, setBadge2Value] = useState('4.9/5.0')

  const [activationDate, setActivationDate] = useState(getLocalDate())
  const [expirationDate, setExpirationDate] = useState('')
  const [ownerMessage, setOwnerMessage] = useState('')
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
        if (configDoc) {
          if (configDoc.data().globalAiKey) setGlobalApiKey(configDoc.data().globalAiKey)
          if (configDoc.data().resendApiKey) setResendApiKey(configDoc.data().resendApiKey)
        }
        
        const pSnap = await getDocs(collection(db, 'platformSettings'))
        if (!pSnap.empty) {
          const pData = pSnap.docs[0].data()
          setSupportNumbers(pData.supportNumbers || [])
          if (typeof pData.showPackagesInClinics === 'boolean') {
            setShowPackagesInClinics(pData.showPackagesInClinics)
          }
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

    const unsubPackages = onSnapshot(
      collection(db, 'packages'),
      async (snap) => {
        if (snap.empty) {
          const defaultPkgs = [
            {
              name: 'الباقة الأساسية',
              subtitle: 'انطلاقة مثالية للعيادات الفردية',
              category: 'monthly',
              price: 450,
              originalPrice: 550,
              discountBadge: 'وفر 100 ج.م',
              period: 'شهري',
              aiResponsesLimit: 100,
              maxBranches: 1,
              isPopular: false,
              badge: 'العيادات الفردية',
              allowFinance: false,
              allowDrugs: true,
              allowPrescriptions: true,
              allowCustomTemplate: false,
              allowBranding: false,
              allowPatientAlerts: false,
              allowAi: true,
              allowBranches: false,
              allowOnlineBooking: true,
              features: [
                'روشتات ذكية غير محدودة (A4 / A5)',
                'تصدير PDF وصور عالية الدقة',
                'إرسال الروشتات والفواتير عبر واتساب',
                'بوابة الحجز الذاتي للمرضى وتتبع الدور',
                '100 رد شهري للمساعد الذكي AI',
                'إدارة فرع واحد وسكرتارية العيادة'
              ],
              createdAt: new Date().toISOString()
            },
            {
              name: 'الباقة الاحترافية',
              subtitle: 'الخيار الأكثر ترشيحاً لعيادات النخبة',
              category: 'monthly',
              price: 950,
              originalPrice: 1200,
              discountBadge: 'خصم 20% 🔥',
              period: 'شهري',
              aiResponsesLimit: 500,
              maxBranches: 3,
              isPopular: true,
              badge: 'الأكثر طلباً 🔥',
              allowFinance: true,
              allowDrugs: true,
              allowPrescriptions: true,
              allowCustomTemplate: true,
              allowBranding: true,
              allowPatientAlerts: true,
              allowAi: true,
              allowBranches: true,
              allowOnlineBooking: true,
              features: [
                'جميع مميزات الباقة الأساسية',
                'حتى 3 فروع طبية متكاملة',
                '500 رد شهري للمساعد الذكي AI',
                'قالب روشتة مخصص بهوية العيادة الفاخرة',
                'تنبيهات تلقائية للمرضى قبل موعد الكشف',
                'تقارير مالية وتصدير إكسيل متقدم',
                'دعم فني مخصص وأولوية في التحديثات'
              ],
              createdAt: new Date().toISOString()
            },
            {
              name: 'الباقة الماسية (VIP)',
              subtitle: 'للمراكز الطبية الكبرى والمستشفيات',
              category: 'monthly',
              price: 1800,
              originalPrice: 2200,
              discountBadge: 'عرض حصري ⭐',
              period: 'شهري',
              aiResponsesLimit: 2500,
              maxBranches: 10,
              isPopular: false,
              badge: 'المراكز الطبية الكبرى',
              allowFinance: true,
              allowDrugs: true,
              allowPrescriptions: true,
              allowCustomTemplate: true,
              allowBranding: true,
              allowPatientAlerts: true,
              allowAi: true,
              allowBranches: true,
              allowOnlineBooking: true,
              features: [
                'جميع مميزات الباقة الاحترافية',
                'فروع طبية غير محدودة',
                '2,500 رد شهري للمساعد الذكي AI',
                'ربط نطاق خاص فرعي باسم الدكتور',
                'تدريب مخصص للذكاء الاصطناعي على كافة التخصصات',
                'نسخ احتياطي يومي سحابي فوري',
                'دعم فني خاص على مدار 24/7'
              ],
              createdAt: new Date().toISOString()
            },
            {
              name: 'الباقة السنوية الشاملة (VIP)',
              subtitle: 'اشتراك سنوي كامل مع كافة الميزات وتوفير شهرين',
              category: 'annual',
              price: 9500,
              originalPrice: 11400,
              discountBadge: 'وفر 1,900 ج.م 🎁',
              period: 'سنوي',
              aiResponsesLimit: 5000,
              maxBranches: 5,
              isPopular: true,
              badge: 'أفضل قيمة سنوية 💎',
              allowFinance: true,
              allowDrugs: true,
              allowPrescriptions: true,
              allowCustomTemplate: true,
              allowBranding: true,
              allowPatientAlerts: true,
              allowAi: true,
              allowBranches: true,
              allowOnlineBooking: true,
              features: [
                'سنة كاملة اشتراك (احصل على شهرين مجاناً)',
                'جميع مميزات الباقة الاحترافية والماسية',
                'حتى 5 فروع طبية متكاملة',
                '5,000 رد شهري للمساعد الذكي AI',
                'دومين فرعي خاص + تصميم روشتة حصري مجاناً',
                'دعم فني ذو أولوية فائقة VIP وتدريب شامل للطاقم'
              ],
              createdAt: new Date().toISOString()
            }
          ]
          for (const p of defaultPkgs) {
            await addDoc(collection(db, 'packages'), p)
          }
        } else {
          setPackages(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        }
      }
    )

    const unsubSettings = onSnapshot(doc(db, 'platformSettings', 'main'), (docSnap) => {
      if (docSnap.exists()) {
        const pData = docSnap.data()
        if (typeof pData.showPackagesInClinics === 'boolean') {
          setShowPackagesInClinics(pData.showPackagesInClinics)
        }
      }
    })

    return () => {
      unsubClinics()
      unsubPackages()
      unsubSettings()
    }
  }, [])

  const handleExportDoctors = async () => {
    try {
      toast.info('جاري إعداد وتصدير كشف الحسابات والتحصيل الشامل...')
      await exportDoctorsExcel(clinics, packages)
      toast.success('تم تصدير كشف الحسابات والتحصيل بنجاح!')
    } catch (err: any) {
      toast.error('حدث خطأ أثناء تصدير الإكسيل: ' + err.message)
    }
  }

  const handleExportExpiring = async () => {
    try {
      toast.info('جاري إعداد شيت الاشتراكات التي أوشكت على الانتهاء...')
      await exportExpiringSubscriptionsExcel(clinics, packages)
      toast.success('تم تصدير شيت الاشتراكات التي قربت تخلص بنجاح!')
    } catch (err: any) {
      toast.error('حدث خطأ أثناء تصدير الإكسيل: ' + err.message)
    }
  }

  const handleOpenPaymentModal = (c: any) => {
    if (!c) return
    const numericPrice = resolveDoctorNumericPrice(c, packages)
    const paid = Number(c.paidAmount ?? (c.isPaid ? numericPrice : 0))
    const remaining = Math.max(0, numericPrice - paid)
    setPaymentModalClinic(c)
    // If not fully paid, suggest remaining amount; if already paid, suggest full price
    setSettleAmount(remaining > 0 ? remaining : numericPrice)
    setSettleMethod(c.paymentMethod || 'instapay')
    setSettleDate(c.paidAt ? c.paidAt.split('T')[0] : getLocalDate())
    setSettleNotes(c.paymentNotes || '')
  }

  const handleConfirmSettlement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!paymentModalClinic) return
    setIsSubmittingPayment(true)
    try {
      const numericPrice = resolveDoctorNumericPrice(paymentModalClinic, packages)
      const amount = Number(settleAmount) || 0
      const isFullyPaid = amount >= numericPrice

      const payload = {
        isPaid: isFullyPaid,
        paidAmount: amount,
        paymentStatus: isFullyPaid ? 'paid' : amount > 0 ? 'partial' : 'unpaid',
        paymentMethod: settleMethod,
        paidAt: settleDate,
        paymentNotes: settleNotes.trim(),
        updatedAt: new Date().toISOString()
      }

      await updateDoc(doc(db, 'clinics', paymentModalClinic.id), payload)

      // Send a notification to the clinic
      await createClinicNotification({
        clinicId: paymentModalClinic.id,
        recipientType: 'staff',
        recipientTarget: paymentModalClinic.id,
        title: 'تأكيد سداد اشتراك العيادة ✅',
        body: `تم تسجيل سداد اشتراك العيادة بقيمة ${amount.toLocaleString('ar-EG')} ج.م بنجاح عبر (${
          settleMethod === 'instapay' ? 'إنستاباي InstaPay' : settleMethod === 'vodafone_cash' ? 'فودافون كاش' : settleMethod === 'cash' ? 'نقداً (كاش)' : 'تحويل بنكي'
        }).`,
        type: 'system',
        eventId: `payment_settle_${paymentModalClinic.id}_${Date.now()}`
      }).catch(() => {})

      recordAuditLog({
        action: 'PAYMENT_CONFIRMED',
        actorName: 'مالك المنصة Super Admin',
        actorRole: 'owner',
        clinicId: paymentModalClinic.id,
        details: { clinicName: paymentModalClinic.clinicName, amount, method: settleMethod }
      })

      toast.success(`تم تسديد وتحديث حساب عيادة (${paymentModalClinic.clinicName || 'العيادة'}) بنجاح! ✅`)
      setPaymentModalClinic(null)
    } catch (err: any) {
      toast.error('حدث خطأ أثناء حفظ السداد: ' + err.message)
    } finally {
      setIsSubmittingPayment(false)
    }
  }

  const handleResetSettlement = async () => {
    if (!paymentModalClinic) return
    if (!confirm(`هل أنت متأكد من إلغاء سداد اشتراك عيادة (${paymentModalClinic.clinicName}) وتعيينها كغير مسددة؟`)) return
    setIsSubmittingPayment(true)
    try {
      const payload = {
        isPaid: false,
        paidAmount: 0,
        paymentStatus: 'unpaid',
        paymentMethod: '',
        paidAt: '',
        paymentNotes: '',
        updatedAt: new Date().toISOString()
      }
      await updateDoc(doc(db, 'clinics', paymentModalClinic.id), payload)
      toast.info(`تم إلغاء السداد وتعيين عيادة ${paymentModalClinic.clinicName} كغير مسددة ⚠️`)
      setPaymentModalClinic(null)
    } catch (err: any) {
      toast.error('حدث خطأ أثناء إلغاء السداد: ' + err.message)
    } finally {
      setIsSubmittingPayment(false)
    }
  }

  const handleTogglePaymentStatus = async (clinicId: string, currentIsPaid: boolean, price: number) => {
    try {
      const newPaid = !currentIsPaid
      await updateDoc(doc(db, 'clinics', clinicId), {
        isPaid: newPaid,
        paidAmount: newPaid ? price : 0,
        paymentStatus: newPaid ? 'paid' : 'unpaid',
        updatedAt: new Date().toISOString()
      })
      toast.success(newPaid ? 'تم تسجيل الاشتراك كمسدد بالكامل ✅' : 'تم تغيير حالة الاشتراك إلى غير مسدد ⚠️')
    } catch (err: any) {
      toast.error('حدث خطأ أثناء تحديث حالة السداد: ' + err.message)
    }
  }

  const handleResetAiCount = async (clinicId: string) => {
    if (!confirm('هل أنت متأكد من تصفير عداد ردود الذكاء الاصطناعي لهذه العيادة؟')) return
    try {
      await updateDoc(doc(db, 'clinics', clinicId), { aiResponsesCount: 0 })
      setAiResponsesCount(0)
      toast.success('تم تصفير عداد ردود الذكاء الاصطناعي بنجاح!')
    } catch (err: any) {
      toast.error('حدث خطأ أثناء تصفير العداد: ' + err.message)
    }
  }

  const AVAILABLE_PACKAGE_ICONS = [
    { id: 'crown', label: 'تاج ملكي', Icon: Crown },
    { id: 'sparkles', label: 'نجوم وابتكار', Icon: Sparkles },
    { id: 'zap', label: 'برق وسرعة', Icon: Zap },
    { id: 'gem', label: 'جوهرة VIP', Icon: Gem },
    { id: 'rocket', label: 'صاروخ انطلاق', Icon: Rocket },
    { id: 'shield', label: 'درع أمان', Icon: ShieldCheck },
    { id: 'stethoscope', label: 'طبي وسماعة', Icon: Stethoscope },
    { id: 'building', label: 'مراكز ومستشفيات', Icon: Building2 },
    { id: 'star', label: 'نجمة تميز', Icon: Star },
    { id: 'award', label: 'وسام معتمد', Icon: Award },
  ]

  const PACKAGE_THEME_COLORS = [
    { id: 'electric-blue', value: '#087CF4', label: 'أزرق يلا كلينيك' },
    { id: 'cyan', value: '#02CFF3', label: 'سماوي كهربائي' },
    { id: 'amber', value: '#F59E0B', label: 'ذهبي' },
    { id: 'purple', value: '#8B5CF6', label: 'بنفسجي' },
    { id: 'blue', value: '#2563EB', label: 'أزرق داكن' },
    { id: 'rose', value: '#E11D48', label: 'وردي' },
    { id: 'emerald', value: '#059669', label: 'زمردي' },
    { id: 'indigo', value: '#4F46E5', label: 'نيلي' },
    { id: 'slate', value: '#334155', label: 'فحمي' }
  ]

  const renderPackageIcon = (pkgOrData: { logoUrl?: string; icon?: string; color?: string; name?: string }, size: 'sm' | 'md' | 'lg' = 'md') => {
    const dim = size === 'lg' ? 'w-14 h-14' : size === 'sm' ? 'w-8 h-8' : 'w-11 h-11'
    const iconDim = size === 'lg' ? 'w-7 h-7' : size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'

    if (pkgOrData.logoUrl) {
      return (
        <div className={`${dim} rounded-2xl bg-white border border-slate-200 p-1 flex items-center justify-center shrink-0 shadow-xs overflow-hidden`}>
          <img src={pkgOrData.logoUrl} alt={pkgOrData.name || 'Package'} className="w-full h-full object-contain" />
        </div>
      )
    }

    const iconId = (pkgOrData.icon || 'crown').toLowerCase()
    let IconComp = Crown
    if (iconId === 'sparkles') IconComp = Sparkles
    else if (iconId === 'zap') IconComp = Zap
    else if (iconId === 'gem') IconComp = Gem
    else if (iconId === 'rocket') IconComp = Rocket
    else if (iconId === 'shield') IconComp = ShieldCheck
    else if (iconId === 'stethoscope') IconComp = Stethoscope
    else if (iconId === 'building') IconComp = Building2
    else if (iconId === 'star') IconComp = Star
    else if (iconId === 'award') IconComp = Award

    return (
      <div
        className={`${dim} rounded-2xl flex items-center justify-center shrink-0 text-white shadow-md`}
        style={{ backgroundColor: pkgOrData.color || '#087CF4' }}
      >
        <IconComp className={iconDim} />
      </div>
    )
  }

  const handlePackageLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('حجم لوجو الباقة كبير، يرجى اختيار صورة أقل من 2 ميجابايت')
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        setPkgLogoUrl(reader.result as string)
        toast.success('تم تحميل لوجو الباقة بنجاح!')
      }
      reader.readAsDataURL(file)
    }
  }

  const handleAddFeatureItem = () => {
    if (!pkgNewFeatureInput.trim()) return
    const currentList = pkgFeatures ? pkgFeatures.split('\n').filter(f => f.trim()) : []
    const updated = [...currentList, pkgNewFeatureInput.trim()].join('\n')
    setPkgFeatures(updated)
    setPkgNewFeatureInput('')
  }

  const handleRemoveFeatureItem = (index: number) => {
    const currentList = pkgFeatures.split('\n').filter(f => f.trim())
    currentList.splice(index, 1)
    setPkgFeatures(currentList.join('\n'))
  }

  const getPackageCycle = (p: any): 'monthly' | '3_months' | '6_months' | 'annual' => {
    const cat = (p?.category || '').toLowerCase()
    const period = (p?.period || '').toLowerCase()
    const name = (p?.name || '').toLowerCase()
    if (cat === 'annual' || cat === 'yearly' || period.includes('سنو') || name.includes('سنو') || period.includes('year')) return 'annual'
    if (cat === '6_months' || period.includes('6') || name.includes('6 شهور') || cat === 'semi_annual') return '6_months'
    if (cat === '3_months' || period.includes('3') || name.includes('3 شهور') || cat === 'quarterly') return '3_months'
    return 'monthly'
  }

  const handleToggleShowPackagesInClinics = async (checked: boolean) => {
    setIsTogglingPackagesVisibility(true)
    try {
      await setDoc(doc(db, 'platformSettings', 'main'), { showPackagesInClinics: checked }, { merge: true })
      setShowPackagesInClinics(checked)
      if (checked) {
        toast.success('تم تفعيل عرض الباقات والترقيات في لوحات العيادات بنجاح!')
      } else {
        toast.warning('تم إخفاء الباقات والترقيات من جميع العيادات بنجاح! لن تظهر للأطباء.')
      }
    } catch (err: any) {
      toast.error('حدث خطأ أثناء حفظ حالة عرض الباقات: ' + err.message)
    } finally {
      setIsTogglingPackagesVisibility(false)
    }
  }

  const handleOpenNewPackage = () => {
    setEditingPackageId(null)
    setPkgName('')
    setPkgSubtitle('')
    setPkgLogoUrl('')
    setPkgIcon('crown')
    setPkgColor('#087CF4')
    setPkgPrice(450)
    setPkgOriginalPrice('')
    setPkgDiscountBadge('')
    setPkgCategory('monthly')
    setPkgPeriod('شهري')
    setPkgAiLimit(100)
    setPkgMaxBranches(1)
    setPkgBadge('الأكثر طلباً وموصى بها 🔥')
    setPkgIsPopular(false)
    setPkgAllowFinance(true)
    setPkgAllowDrugs(true)
    setPkgAllowPrescriptions(true)
    setPkgAllowCustomTemplate(false)
    setPkgAllowBranding(true)
    setPkgAllowPatientAlerts(true)
    setPkgAllowAi(true)
    setPkgAllowBranches(true)
    setPkgAllowOnlineBooking(true)
    setPkgFeatures([
      'روشتات ذكية غير محدودة (A4 / A5)',
      'تصدير PDF وصور عالية الدقة للروشتة',
      'بوابة الحجز الذاتي للمرضى وتتبع الدور',
      'إشعارات وتنبيهات تلقائية قبل الكشف'
    ].join('\n'))
    setPkgNewFeatureInput('')
    setIsPackageModalOpen(true)
  }

  const handleEditPackage = (pkg: any) => {
    setEditingPackageId(pkg.id)
    setPkgName(pkg.name || '')
    setPkgSubtitle(pkg.subtitle || '')
    setPkgLogoUrl(pkg.logoUrl || '')
    setPkgIcon(pkg.icon || 'crown')
    setPkgColor(pkg.color || '#087CF4')
    setPkgPrice(pkg.price || 0)
    setPkgOriginalPrice(pkg.originalPrice || '')
    setPkgDiscountBadge(pkg.discountBadge || '')
    const detected = getPackageCycle(pkg)
    setPkgCategory(detected)
    setPkgPeriod(pkg.period || (detected === 'annual' ? 'سنوي' : detected === '6_months' ? '6 شهور' : detected === '3_months' ? '3 شهور' : 'شهري'))
    setPkgAiLimit(pkg.aiResponsesLimit || 100)
    setPkgMaxBranches(pkg.maxBranches || 1)
    setPkgBadge(pkg.badge || '')
    setPkgIsPopular(!!pkg.isPopular || !!pkg.isRecommended)
    setPkgAllowFinance(pkg.allowFinance !== false)
    setPkgAllowDrugs(pkg.allowDrugs !== false)
    setPkgAllowPrescriptions(pkg.allowPrescriptions !== false)
    setPkgAllowCustomTemplate(Boolean(pkg.allowCustomTemplate))
    setPkgAllowBranding(pkg.allowBranding !== false)
    setPkgAllowPatientAlerts(pkg.allowPatientAlerts !== false)
    setPkgAllowAi(pkg.allowAi !== false)
    setPkgAllowBranches(pkg.allowBranches !== false)
    setPkgAllowOnlineBooking(pkg.allowOnlineBooking !== false)
    setPkgFeatures(Array.isArray(pkg.features) ? pkg.features.join('\n') : '')
    setPkgNewFeatureInput('')
    setIsPackageModalOpen(true)
  }

  const handleSavePackage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pkgName.trim()) return toast.error('يرجى كتابة اسم الباقة')

    const featuresList = pkgFeatures
      .split('\n')
      .map(f => f.trim())
      .filter(f => f.length > 0)

    let finalCategory = pkgCategory
    if (pkgCategory === '3_months' || pkgPeriod?.includes('3') || pkgName.includes('3 شهور')) {
      finalCategory = '3_months'
    } else if (pkgCategory === '6_months' || pkgPeriod?.includes('6') || pkgName.includes('6 شهور')) {
      finalCategory = '6_months'
    } else if (pkgCategory === 'annual' || pkgPeriod?.includes('سنو') || pkgName.includes('سنو')) {
      finalCategory = 'annual'
    } else {
      finalCategory = 'monthly'
    }

    const defaultPeriod = finalCategory === 'annual'
      ? 'سنوي'
      : finalCategory === '6_months'
      ? '6 شهور'
      : finalCategory === '3_months'
      ? '3 شهور'
      : 'شهري'

    const pkgData = {
      name: pkgName.trim(),
      subtitle: pkgSubtitle.trim(),
      logoUrl: pkgLogoUrl.trim(),
      icon: pkgIcon || 'crown',
      color: pkgColor || '#087CF4',
      price: Number(pkgPrice) || 0,
      originalPrice: pkgOriginalPrice ? Number(pkgOriginalPrice) : 0,
      discountBadge: pkgDiscountBadge.trim(),
      category: finalCategory,
      period: pkgPeriod || defaultPeriod,
      aiResponsesLimit: Number(pkgAiLimit) || 100,
      maxBranches: Number(pkgMaxBranches) || 1,
      badge: pkgBadge.trim(),
      isPopular: pkgIsPopular,
      isRecommended: pkgIsPopular,
      allowFinance: pkgAllowFinance,
      allowDrugs: pkgAllowDrugs,
      allowPrescriptions: pkgAllowPrescriptions,
      allowCustomTemplate: pkgAllowCustomTemplate,
      allowBranding: pkgAllowBranding,
      allowPatientAlerts: pkgAllowPatientAlerts,
      allowAi: pkgAllowAi,
      allowBranches: pkgAllowBranches,
      allowOnlineBooking: pkgAllowOnlineBooking,
      features: featuresList,
      updatedAt: new Date().toISOString()
    }

    try {
      if (editingPackageId) {
        await updateDoc(doc(db, 'packages', editingPackageId), pkgData)
        toast.success('تم تحديث بيانات وهيكلة الباقة بنجاح!')
      } else {
        await addDoc(collection(db, 'packages'), {
          ...pkgData,
          createdAt: new Date().toISOString()
        })
        toast.success('تم إنشاء وتكوين الباقة الجديدة بنجاح!')
      }
      setIsPackageModalOpen(false)
      setEditingPackageId(null)
    } catch (err: any) {
      toast.error('حدث خطأ أثناء حفظ الباقة: ' + err.message)
    }
  }

  const handleDeletePackage = async (pkgId: string, pkgName: string) => {
    if (!confirm(`هل أنت متأكد من حذف باقة (${pkgName})؟`)) return
    try {
      await deleteDoc(doc(db, 'packages', pkgId))
      toast.success('تم حذف الباقة بنجاح')
    } catch (err: any) {
      toast.error('فشل حذف الباقة: ' + err.message)
    }
  }

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
      await setDoc(doc(db, 'system', 'config'), { globalAiKey: globalApiKey, resendApiKey }, { merge: true })
      await setDoc(doc(db, 'platformSettings', 'main'), { supportNumbers }, { merge: true })
      toast.success('تم حفظ إعدادات المنصة بنجاح!')
    } catch (err) {
      toast.error('حدث خطأ أثناء حفظ الإعدادات')
    } finally {
      setIsSavingGlobal(false)
    }
  }

  const handleExportBackup = async () => {
    try {
      toast.info('جاري تحضير النسخة الاحتياطية المشفرة...')
      const collectionsToExport = ['clinics', 'appointments', 'prescriptions', 'expenses', 'audit_logs']
      const backupData: Record<string, any> = {
        exportedAt: new Date().toISOString(),
        system: 'Yalla Clinic - Single Clinic System (zizo)',
        data: {}
      }

      for (const colName of collectionsToExport) {
        const snap = await getDocs(collection(db, colName))
        backupData.data[colName] = snap.docs.map(d => {
          const item = d.data()
          // Sanitize sensitive secrets and plain passwords
          if (colName === 'clinics') {
            const { doctorPassword, assistantPassword, aiApiKey, ...sanitized } = item
            return { id: d.id, ...sanitized }
          }
          return { id: d.id, ...item }
        })
      }

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `clinic_os_backup_${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)

      recordAuditLog({
        action: 'BACKUP_EXPORTED',
        actorName: 'مالك النظام Super Admin',
        actorRole: 'owner',
        clinicId: editingId || 'zizo',
        details: { collections: collectionsToExport }
      })

      toast.success('تم تصدير النسخة الاحتياطية وتأمينها بنجاح!')
    } catch (err: any) {
      toast.error('فشل تصدير النسخة الاحتياطية: ' + err.message)
    }
  }

  const handleAddOrUpdateClinic = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // 1. Multi-Tenant SaaS: validate slug uniqueness for new clinic
      const finalSlug = slug.trim() ? slug.trim().toLowerCase().replace(/\s+/g, '-') : `clinic-${Date.now().toString(36)}`
      if (!editingId && clinics.some(c => c.slug === finalSlug)) {
        toast.error('رابط العيادة (Slug) مستخدم بالفعل، يرجى اختيار رابط فريد آخر.')
        setIsLoading(false)
        return
      }

      // 2. Hash passwords securely
      const doctorPasswordHash = doctorPassword ? await hashPassword(doctorPassword) : ''
      const assistantPasswordHash = assistantPassword ? await hashPassword(assistantPassword) : ''

      const clinicData = {
        clinicName,
        doctorName,
        doctorPhone,
        clinicPhone,
        slug: finalSlug,
        mapsLink,
        doctorEmail,
        doctorPassword,
        doctorPasswordHash,
        assistantEmail,
        assistantPassword,
        assistantPasswordHash,
        aiApiKey,
        prescriptionTemplateUrl,
        aiEnabled: aiEnabled !== false,

        // Branch Limits & Multi-Branch Subscription (TASK 9)
        branchesEnabled: branchesEnabled !== false,
        maxBranches: Number(maxBranches) || 1,
        branchCreationAllowed: branchCreationAllowed !== false,

        // Clinic Branding & Customizations (TASK 10)
        allowDoctorEditBranding: allowDoctorEditBranding !== false,
        logoUrl: logoUrl || '',
        thermalMonoLogoUrl: thermalMonoLogoUrl || '',
        primaryColor: primaryColor || '#087CF4',
        secondaryColor: secondaryColor || '#02CFF3',
        specialty: specialty || '',
        certificationTitle: certificationTitle || '',
        clinicAddress: clinicAddress || '',

        // Granular Feature Flags (TASK: Lock/Unlock any feature on doctor)
        allowFinance: allowFinance !== false,
        allowDrugs: allowDrugs !== false,
        allowPrescriptions: allowPrescriptions !== false,
        allowCustomTemplate: allowCustomTemplate !== false,
        allowPatientAlerts: allowPatientAlerts !== false,
        allowOnlineBooking: allowOnlineBooking !== false,

        heroImage,
        heroTitle,
        heroSubtitle,
        badge1Title,
        badge1Value,
        badge2Title,
        badge2Value,
        activationDate,
        expirationDate: expirationDate ? expirationDate.replace(/^20266/, '2026') : '',
        ownerMessage,
        packageName: packageName || 'الباقة الأساسية',
        packagePrice: packages.find(p => p.name === packageName)?.price || (packageName?.includes('ماس') ? 1800 : packageName?.includes('احتراف') ? 950 : 450),
        isPaid: isPaid !== false,
        paidAmount: isPaid !== false ? (packages.find(p => p.name === packageName)?.price || (packageName?.includes('ماس') ? 1800 : packageName?.includes('احتراف') ? 950 : 450)) : 0,
        paymentStatus: isPaid !== false ? 'paid' : 'unpaid',
        aiResponsesLimit: Number(aiResponsesLimit) || 100,
        aiResponsesCount: Number(aiResponsesCount) || 0,
        isActive,
        updatedAt: new Date().toISOString()
      }

      if (editingId) {
        await updateDoc(doc(db, 'clinics', editingId), clinicData)
        if (ownerMessage && ownerMessage.trim()) {
          await createClinicNotification({
            clinicId: editingId,
            recipientType: 'staff',
            recipientTarget: editingId,
            title: 'رسالة إدارية من مالك المنصة 📢',
            body: ownerMessage.trim(),
            type: 'system',
            eventId: `owner_msg_${editingId}_${Date.now()}`
          })
        }
        recordAuditLog({
          action: 'SETTINGS_UPDATED',
          actorName: 'مالك المنصة Super Admin',
          actorRole: 'owner',
          clinicId: editingId,
          details: { clinicName, doctorName }
        })
        toast.success('تم تحديث بيانات وإعدادات العيادة بنجاح!')
        setEditingId(null)
      } else {
        const newDoc = await addDoc(collection(db, 'clinics'), { ...clinicData, createdAt: new Date().toISOString() })
        if (ownerMessage && ownerMessage.trim()) {
          await createClinicNotification({
            clinicId: newDoc.id,
            recipientType: 'staff',
            recipientTarget: newDoc.id,
            title: 'رسالة إدارية من مالك المنصة 📢',
            body: ownerMessage.trim(),
            type: 'system',
            eventId: `owner_msg_${newDoc.id}_${Date.now()}`
          })
        }
        recordAuditLog({
          action: 'SETTINGS_UPDATED',
          actorName: 'مالك المنصة Super Admin',
          actorRole: 'owner',
          clinicId: newDoc.id,
          details: { clinicName, doctorName }
        })
        toast.success('تم حفظ العيادة بكامل تفاصيلها بنجاح!')
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
      setBranchesEnabled(true)
      setMaxBranches(3)
      setBranchCreationAllowed(true)
      setAllowDoctorEditBranding(true)
      setAllowFinance(true)
      setAllowDrugs(true)
      setAllowPrescriptions(true)
      setAllowCustomTemplate(true)
      setAllowPatientAlerts(true)
      setAllowOnlineBooking(true)
      setLogoUrl('')
      setThermalMonoLogoUrl('')
      setPrimaryColor('#087CF4')
      setSecondaryColor('#02CFF3')
      setSpecialty('')
      setCertificationTitle('')
      setClinicAddress('')
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
    setBranchesEnabled(c.branchesEnabled !== false)
    setMaxBranches(c.maxBranches !== undefined ? c.maxBranches : 3)
    setBranchCreationAllowed(c.branchCreationAllowed !== false)
    setAllowDoctorEditBranding(c.allowDoctorEditBranding !== false)
    setAllowFinance(c.allowFinance !== false)
    setAllowDrugs(c.allowDrugs !== false)
    setAllowPrescriptions(c.allowPrescriptions !== false)
    setAllowCustomTemplate(c.allowCustomTemplate !== false)
    setAllowPatientAlerts(c.allowPatientAlerts !== false)
    setAllowOnlineBooking(c.allowOnlineBooking !== false)
    setLogoUrl(c.logoUrl || '')
    setThermalMonoLogoUrl(c.thermalMonoLogoUrl || '')
    setPrimaryColor(c.primaryColor || '#087CF4')
    setSecondaryColor(c.secondaryColor || '#02CFF3')
    setSpecialty(c.specialty || '')
    setCertificationTitle(c.certificationTitle || '')
    setClinicAddress(c.clinicAddress || '')
    setHeroImage(c.heroImage || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=2000&auto=format&fit=crop')
    setHeroTitle(c.heroTitle || 'صحتك تستحق العناية الفائقة')
    setHeroSubtitle(c.heroSubtitle || 'نقدم لك ولعائلتك رعاية صحية متكاملة تعتمد على أحدث التقنيات وأفضل الكوادر الطبية المتخصصة لضمان سلامتك وتوفير راحتك.')
    setBadge1Title(c.badge1Title || 'أطباء معتمدون')
    setBadge1Value(c.badge1Value || 'خبرة +15 سنة')
    setBadge2Title(c.badge2Title || 'تقييم العيادة')
    setBadge2Value(c.badge2Value || '4.9/5.0')
    setActivationDate(c.activationDate || getLocalDate())
    setExpirationDate(c.expirationDate || '')
    setOwnerMessage(c.ownerMessage || '')
    setPackageName(c.packageName || 'الباقة الأساسية')
    setAiResponsesLimit(c.aiResponsesLimit ?? 100)
    setAiResponsesCount(c.aiResponsesCount ?? 0)
    setIsActive(c.isActive !== false)
    setIsPaid(c.paidAmount !== undefined && c.paidAmount !== null ? Number(c.paidAmount) >= (Number(c.packagePrice) || 450) : c.isPaid !== false)

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
    setBranchesEnabled(true)
    setMaxBranches(3)
    setBranchCreationAllowed(true)
    setAllowDoctorEditBranding(true)
    setLogoUrl('')
    setThermalMonoLogoUrl('')
    setPrimaryColor('#087CF4')
    setSecondaryColor('#02CFF3')
    setSpecialty('')
    setCertificationTitle('')
    setClinicAddress('')
    setPackageName('الباقة الأساسية')
    setAiResponsesLimit(100)
    setAiResponsesCount(0)
    setIsPaid(true)
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
    setClinics(prev => prev.map(c => c.id === id ? { ...c, aiEnabled: nextAi, aiLockedByOwner: !nextAi } : c))
    try {
      await updateDoc(doc(db, 'clinics', id), { aiEnabled: nextAi, aiLockedByOwner: !nextAi })
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

  // Global Financial Statistics for Subscriptions
  const financialSummary = useMemo(() => {
    let totalDue = 0
    let totalCollected = 0
    let unpaidCount = 0
    let expiringSoonCount = 0
    const now = new Date()

    clinics.forEach(c => {
      const price = resolveDoctorNumericPrice(c, packages)
      totalDue += price
      const paid = Number(c.paidAmount ?? (c.isPaid ? price : 0))
      totalCollected += paid
      if (paid < price) unpaidCount++

      if (c.expirationDate) {
        const exp = new Date(c.expirationDate)
        const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        if (diffDays <= 7) expiringSoonCount++
      }
    })

    const totalRemaining = Math.max(0, totalDue - totalCollected)
    return {
      totalDue,
      totalCollected,
      totalRemaining,
      unpaidCount,
      expiringSoonCount
    }
  }, [clinics, packages])

  // Filtered doctors list for Doctors Tab
  const filteredDoctors = useMemo(() => {
    let list = clinics
    if (doctorsSearchQuery.trim()) {
      const q = doctorsSearchQuery.trim().toLowerCase()
      list = list.filter(c =>
        (c.doctorName || '').toLowerCase().includes(q) ||
        (c.clinicName || '').toLowerCase().includes(q) ||
        (c.specialty || '').toLowerCase().includes(q) ||
        (c.clinicPhone || '').includes(q) ||
        (c.doctorPhone || '').includes(q) ||
        (c.slug || '').toLowerCase().includes(q)
      )
    }

    if (paymentFilter === 'unpaid') {
      list = list.filter(c => {
        const price = resolveDoctorNumericPrice(c, packages)
        const paid = Number(c.paidAmount ?? (c.isPaid ? price : 0))
        return paid < price
      })
    } else if (paymentFilter === 'expiring_soon') {
      const now = new Date()
      list = list.filter(c => {
        if (!c.expirationDate) return false
        const exp = new Date(c.expirationDate)
        const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        return diffDays <= 7
      })
    }

    return list
  }, [clinics, doctorsSearchQuery, paymentFilter, packages])

  // KPI Metrics
  const totalClinics = clinics.length
  const activeClinicsCount = clinics.filter(c => c.isActive !== false).length
  const aiEnabledCount = clinics.filter(c => c.aiEnabled !== false).length
  const customTemplateCount = clinics.filter(c => !!c.prescriptionTemplateUrl).length

  return (
    <div className="space-y-8 font-sans pb-16 text-[#182230] dark:text-slate-100 transition-colors" dir={dir}>
      
      {/* 1. Header Overview & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#092145] dark:text-[#F3FAFF] flex items-center gap-2.5">
            <ShieldCheck className="w-8 h-8 text-[#087CF4]" />
            {t('owner_dashboard_title')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 dark:text-slate-400 mt-1">
            {t('owner_dashboard_subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadClinics}
            disabled={isRefreshing}
            className="h-10 text-xs font-bold rounded-xl border-[#DCE9F5] dark:border-[#254565] text-slate-700 dark:text-slate-200 hover:bg-[#F4FAFF] dark:hover:bg-[#0E2342]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ml-1.5 ${isRefreshing ? 'animate-spin text-[#087CF4]' : ''}`} />
            {t('refresh_data')}
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setEditingId(null)
              setActiveTab('add')
            }}
            className="h-10 px-4 text-xs font-black yalla-gradient-btn text-white rounded-xl shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4 ml-1.5" />
            {t('add_new_clinic')}
          </Button>
        </div>
      </div>

      {/* 2. KPI Metrics Cards (Apple Vision / iOS Glassmorphism) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Total Clinics */}
        <div className="ios-glass-card p-5 border border-border/80 rounded-3xl flex items-center gap-4 relative overflow-hidden group hover:border-primary/50 hover:-translate-y-1 hover:shadow-xl transition-all duration-300">
          <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-primary/25 to-primary/10 text-primary border border-primary/30 flex items-center justify-center shrink-0 shadow-md shadow-primary/20 group-hover:scale-105 transition-transform">
            <Building className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-muted-foreground block">{isRtl ? 'إجمالي العيادات' : 'Total Clinics'}</span>
            <span className="text-2xl sm:text-3xl font-black text-foreground font-mono">{totalClinics}</span>
          </div>
        </div>

        {/* Card 2: Active Clinics */}
        <div className="ios-glass-card p-5 border border-border/80 rounded-3xl flex items-center gap-4 relative overflow-hidden group hover:border-emerald-500/50 hover:-translate-y-1 hover:shadow-xl transition-all duration-300">
          <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-emerald-500/25 to-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-muted-foreground block">{isRtl ? 'العيادات النشطة' : 'Active Clinics'}</span>
            <span className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{activeClinicsCount}</span>
          </div>
        </div>

        {/* Card 3: AI Chatbot Enabled */}
        <div className="ios-glass-card p-5 border border-border/80 rounded-3xl flex items-center gap-4 relative overflow-hidden group hover:border-purple-500/50 hover:-translate-y-1 hover:shadow-xl transition-all duration-300">
          <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-purple-500/25 to-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0 shadow-md shadow-purple-500/20 group-hover:scale-105 transition-transform">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-muted-foreground block">{isRtl ? 'مفعل بها AI Chatbot' : 'AI Chatbot On'}</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-black text-purple-600 dark:text-purple-400 font-mono">{aiEnabledCount}</span>
              <span className="text-[11px] text-muted-foreground font-bold">{isRtl ? `من ${totalClinics}` : `of ${totalClinics}`}</span>
            </div>
          </div>
        </div>

        {/* Card 4: Custom Prescription Template */}
        <div className="ios-glass-card p-5 border border-border/80 rounded-3xl flex items-center gap-4 relative overflow-hidden group hover:border-cyan-500/50 hover:-translate-y-1 hover:shadow-xl transition-all duration-300">
          <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-cyan-500/25 to-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0 shadow-md shadow-cyan-500/20 group-hover:scale-105 transition-transform">
            <FileSignature className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-muted-foreground block">{isRtl ? 'روشتات مخصصة' : 'Custom Templates'}</span>
            <span className="text-2xl sm:text-3xl font-black text-cyan-600 dark:text-cyan-400 font-mono">{customTemplateCount}</span>
          </div>
        </div>

      </div>

      {/* 3. Navigation Tabs (iOS Segmented Pill Bar) */}
      <div className="p-1.5 rounded-2xl ios-glass-card border border-border/80 shadow-xs flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('clinics')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'clinics'
              ? 'bg-[#0066FF] text-white shadow-md shadow-blue-500/30'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>{isRtl ? 'إدارة العيادات والنظام' : 'Clinics Management'}</span>
        </button>

        <button
          onClick={() => setActiveTab('doctors')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'doctors'
              ? 'bg-[#0066FF] text-white shadow-md shadow-blue-500/30'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>{isRtl ? 'حسابات الأطباء والمواعيد' : 'Doctors & Bookings'}</span>
        </button>

        <button
          onClick={() => setActiveTab('packages')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'packages'
              ? 'bg-[#0066FF] text-white shadow-md shadow-blue-500/30'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>{isRtl ? 'التحكم في الباقات والاشتراكات' : 'Packages & Plans'}</span>
        </button>

        <button
          onClick={() => {
            if (clinics.length > 0) {
              handleEdit(clinics[0])
            } else {
              setActiveTab('add')
            }
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'add'
              ? 'bg-[#0066FF] text-white shadow-md shadow-blue-500/30'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
          }`}
        >
          <Edit className="w-4 h-4" />
          <span>{isRtl ? 'تعديل بيانات العيادة' : 'Edit Clinic Details'}</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'settings'
              ? 'bg-[#0066FF] text-white shadow-md shadow-blue-500/30'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>{isRtl ? 'مفتاح AI المركزي' : 'AI Global Key'}</span>
        </button>

        <button
          onClick={handleExportBackup}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer bg-secondary/80 hover:bg-secondary text-foreground border border-border shadow-2xs mr-auto whitespace-nowrap"
        >
          <Download className="w-4 h-4" />
          <span>{isRtl ? 'نسخة احتياطية (JSON)' : 'Backup (JSON)'}</span>
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
          <div className="ios-glass-card p-4 border border-border/80 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-3 shadow-xs">
            <div className="relative w-full md:w-96">
              <Search className={`w-4 h-4 absolute ${isRtl ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 text-muted-foreground`} />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={isRtl ? "ابحث بالاسم، الطبيب، الهاتف، أو الرابط slug..." : "Search by name, doctor, phone, or slug..."}
                className={`${isRtl ? 'pr-10' : 'pl-10'} h-10 text-xs bg-background/80 rounded-xl border-border/80 text-foreground`}
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
              {[
                { id: 'all', label: isRtl ? 'الكل' : 'All' },
                { id: 'active', label: isRtl ? 'النشطة' : 'Active' },
                { id: 'inactive', label: isRtl ? 'الموقوفة' : 'Inactive' },
                { id: 'ai-on', label: isRtl ? 'AI يعمل' : 'AI On' },
                { id: 'ai-off', label: isRtl ? 'AI مغلق' : 'AI Off' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilterMode(f.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    filterMode === f.id
                      ? 'bg-[#0066FF] text-white shadow-xs'
                      : 'bg-secondary/70 text-foreground hover:bg-secondary'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Clinics Data Table (Glassmorphism Translucent Container) */}
          <div className="ios-glass-card border border-border/80 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className={`w-full ${isRtl ? 'text-right' : 'text-left'} text-xs`}>
                <thead className="bg-secondary/40 text-muted-foreground font-bold border-b border-border/80 select-none">
                  <tr>
                    <th className="py-4 px-4">العيادة والطبيب</th>
                    <th className="py-4 px-4">روابط المنصة</th>
                    <th className="py-4 px-4 text-center">
                      <span className="flex items-center justify-center gap-1.5 text-purple-600 dark:text-purple-400">
                        <Bot className="w-4 h-4" />
                        <span>تشغيل / قفل AI Chatbot</span>
                      </span>
                    </th>
                    <th className="py-4 px-4 text-center">تصميم الروشتة</th>
                    <th className="py-4 px-4 text-center">باقة الفروع</th>
                    <th className="py-4 px-4 text-center">حالة الاشتراك</th>
                    <th className="py-4 px-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredClinics.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-muted-foreground">
                        {clinics.length === 0 ? 'لا توجد عيادات مسجلة حتى الآن.' : 'لا توجد نتائج تطابق بحثك.'}
                      </td>
                    </tr>
                  ) : (
                    filteredClinics.map((c) => {
                      const hasAi = c.aiEnabled !== false
                      const hasCustomTemplate = !!c.prescriptionTemplateUrl
                      return (
                        <tr key={c.id} className="hover:bg-muted/40 transition-colors">
                          
                          {/* Clinic Name & Doctor */}
                          <td className="py-4 px-4">
                            <div className="space-y-0.5">
                              <h4 className="font-black text-sm text-foreground">{c.clinicName}</h4>
                              <p className="text-muted-foreground font-semibold text-[11px]">
                                {c.doctorName ? `د. ${c.doctorName}` : 'طبيب العيادة'}
                              </p>
                              <div className="flex items-center gap-2 pt-1 font-mono text-[10px] text-muted-foreground/80">
                                <span>واتساب: {c.clinicPhone || '—'}</span>
                                {c.doctorPhone && <span>• شخصي: {c.doctorPhone}</span>}
                              </div>
                            </div>
                          </td>

                          {/* Quick Platform Links */}
                          <td className="py-4 px-4 space-y-2">
                            {/* Official Subdomain Badge with Copy */}
                            <div className="flex items-center justify-between gap-1 bg-teal-500/10 border border-teal-500/20 rounded-xl px-2.5 py-1 text-[11px] font-mono font-bold text-teal-700 dark:text-teal-300" dir="ltr">
                              <span className="truncate max-w-[170px]">{c.slug}.yalla-clinic.com</span>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(`https://${c.slug}.yalla-clinic.com`)
                                  toast.success('تم نسخ رابط العيادة المباشر!')
                                }}
                                className="p-0.5 hover:text-teal-900 dark:hover:text-teal-100 text-teal-600 dark:text-teal-400 rounded transition-colors cursor-pointer shrink-0"
                                title="نسخ الرابط المباشر"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap text-[11px]">
                              <a
                                href={`https://${c.slug}.yalla-clinic.com`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-primary font-bold hover:underline"
                                title="فتح صفحة الحجز المباشرة"
                              >
                                <span>الحجز</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                              <span className="text-muted-foreground/30">•</span>
                              <a
                                href={`https://${c.slug}.yalla-clinic.com/patient`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-cyan-600 dark:text-cyan-400 font-bold hover:underline"
                                title="فتح بوابة المرضى"
                              >
                                <span>المرضى</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                              <span className="text-muted-foreground/30">•</span>
                              <a
                                href={`https://${c.slug}.yalla-clinic.com/admin`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-foreground hover:text-primary font-bold hover:underline"
                                title="فتح لوحة تحكم الطبيب"
                              >
                                <span>اللوحة</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            </div>
                          </td>

                          {/* DEDICATED AI CHATBOT INSTANT TOGGLE (Apple iOS 18 Switch) */}
                          <td className="py-4 px-4 text-center">
                            <div className="flex flex-col items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => toggleClinicAi(c.id, hasAi)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out cursor-pointer ${
                                  hasAi
                                    ? 'bg-gradient-to-r from-blue-600 to-cyan-500 shadow-md shadow-blue-500/30'
                                    : 'bg-slate-300 dark:bg-slate-700'
                                }`}
                                title={isRtl ? "اضغط لتبديل حالة الذكاء الاصطناعي لهذه العيادة فوراً" : "Toggle AI Chatbot"}
                              >
                                <span
                                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out ${
                                    hasAi
                                      ? (isRtl ? '-translate-x-5' : 'translate-x-5')
                                      : (isRtl ? '-translate-x-0.5' : 'translate-x-0.5')
                                  }`}
                                />
                              </button>
                              
                              <span className={`text-[10px] font-bold ${hasAi ? 'text-cyan-600 dark:text-cyan-400' : 'text-muted-foreground'}`}>
                                {hasAi ? (isRtl ? 'مفعل بالعيادة ✓' : 'Active ✓') : (isRtl ? 'معطل ✗' : 'Disabled ✗')}
                              </span>
                            </div>
                          </td>

                          {/* Prescription Template */}
                          <td className="py-4 px-4 text-center">
                            {hasCustomTemplate ? (
                              <div className="flex flex-col items-center gap-1">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold">
                                  <FileSignature className="w-3 h-3" />
                                  <span>{isRtl ? 'تصميم مخصص' : 'Custom'}</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setPreviewTemplateModal(c.prescriptionTemplateUrl)}
                                  className="text-[10px] font-bold text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>{isRtl ? 'معاينة القالب' : 'Preview'}</span>
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-muted-foreground font-medium">{isRtl ? 'قالب قياسي A4' : 'Standard A4'}</span>
                            )}
                          </td>

                          {/* Multi-Branch Quota */}
                          <td className="py-4 px-4 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                c.branchesEnabled !== false
                                  ? 'bg-primary/10 text-primary border-primary/20'
                                  : 'bg-secondary text-muted-foreground border-border'
                              }`}>
                                {c.branchesEnabled !== false ? (isRtl ? `مفعلة (${c.maxBranches || 1} فروع)` : `Active (${c.maxBranches || 1} branches)`) : (isRtl ? 'معطلة (فرع واحد)' : 'Single branch')}
                              </span>
                              {c.branchCreationAllowed === false && (
                                <span className="text-[9px] text-amber-600 dark:text-amber-400 font-bold">{isRtl ? 'إنشاء الفروع مقفل' : 'Creation locked'}</span>
                              )}
                            </div>
                          </td>

                          {/* Subscription & Active Status (Wireframe Glowing Status Pill) */}
                          <td className="py-4 px-4 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <button
                                type="button"
                                onClick={() => toggleStatus(c.id, c.isActive !== false)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black cursor-pointer transition-all ${
                                  c.isActive !== false
                                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.25)] hover:bg-emerald-500/25'
                                    : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 shadow-[0_0_12px_rgba(244,63,94,0.25)] hover:bg-rose-500/25'
                                }`}
                                title={isRtl ? "اضغط لتبديل حالة العيادة" : "Click to toggle clinic status"}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${c.isActive !== false ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                                <span>{c.isActive !== false ? (isRtl ? 'نشط' : 'Active') : (isRtl ? 'منتهي' : 'Expired')}</span>
                              </button>
                              {c.expirationDate && (
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  {isRtl ? 'ينتهي:' : 'Exp:'} {c.expirationDate}
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
                                className="h-8 px-2.5 text-xs font-bold text-primary border-primary/25 hover:bg-primary/10 rounded-xl"
                              >
                                <Edit className="w-3.5 h-3.5 ml-1" />
                                تعديل
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => deleteClinic(c.id)}
                                className="h-8 w-8 text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 rounded-xl"
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

      {/* TAB: Doctors Accounts & Schedules */}
      {activeTab === 'doctors' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-5"
        >
          {/* 1. Grand Financial KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Total Due */}
            <div className="yalla-card p-5 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl border border-slate-700 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">المبلغ المستحق إجمالي (المطلوب)</span>
                <div className="w-9 h-9 rounded-2xl bg-white/10 flex items-center justify-center text-amber-400">
                  <Receipt className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-black font-mono tracking-tight text-amber-400">
                  {financialSummary.totalDue.toLocaleString('ar-EG')}
                </span>
                <span className="text-xs text-slate-400 font-bold">ج.م</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                إجمالي رسوم اشتراكات كافة العيادات والأطباء المسجلين ({clinics.length} عيادة)
              </p>
            </div>

            {/* Total Collected */}
            <div className="yalla-card p-5 bg-gradient-to-br from-emerald-900/90 to-teal-900 text-white rounded-3xl border border-emerald-700/50 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-200">المبلغ المحصل (اللي استلمته)</span>
                <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-300">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-black font-mono tracking-tight text-emerald-300">
                  {financialSummary.totalCollected.toLocaleString('ar-EG')}
                </span>
                <span className="text-xs text-emerald-200 font-bold">ج.م</span>
              </div>
              <p className="text-[11px] text-emerald-200/80 mt-1">
                المبالغ التي تم تحصيلها واستلامها بالفعل من الأطباء
              </p>
            </div>

            {/* Total Remaining - CLICKABLE to filter unpaid! */}
            <div
              onClick={() => {
                setPaymentFilter(paymentFilter === 'unpaid' ? 'all' : 'unpaid')
              }}
              className={`yalla-card p-5 rounded-3xl border shadow-md cursor-pointer transition-all transform hover:-translate-y-0.5 select-none relative overflow-hidden ${
                paymentFilter === 'unpaid'
                  ? 'bg-rose-950 text-white border-rose-500 ring-2 ring-rose-500 shadow-rose-900/40'
                  : 'bg-gradient-to-br from-rose-900/90 to-red-950 text-white border-rose-700/60 hover:border-rose-400'
              }`}
              title="انقر لتصفية وعرض من لم يسدد الاشتراك"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-rose-200">المبلغ المتبقي (غير المحصل)</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    paymentFilter === 'unpaid' ? 'bg-white text-rose-900' : 'bg-rose-500 text-white animate-pulse'
                  }`}>
                    {paymentFilter === 'unpaid' ? 'نشط الآن ✓' : 'اضغط للعرض 👆'}
                  </span>
                </div>
                <div className="w-9 h-9 rounded-2xl bg-rose-500/20 flex items-center justify-center text-rose-300">
                  <AlertCircle className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-black font-mono tracking-tight text-rose-300">
                  {financialSummary.totalRemaining.toLocaleString('ar-EG')}
                </span>
                <span className="text-xs text-rose-200 font-bold">ج.م</span>
              </div>
              <div className="flex items-center justify-between mt-1 text-[11px] text-rose-200">
                <span>
                  {financialSummary.unpaidCount > 0
                    ? `${financialSummary.unpaidCount} عيادات لم تسدد بعد`
                    : 'جميع الاشتراكات مسددة بالكامل'}
                </span>
                <span className="text-[10px] underline font-bold">
                  {paymentFilter === 'unpaid' ? '✕ إلغاء التصفية' : 'اضغط لمعرفة مين مدفعش ←'}
                </span>
              </div>
            </div>
          </div>

          {/* 2. Filter Pills Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-slate-100/80 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setPaymentFilter('all')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  paymentFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                جميع الأطباء ({clinics.length})
              </button>
              <button
                type="button"
                onClick={() => setPaymentFilter('unpaid')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  paymentFilter === 'unpaid'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-rose-700 hover:bg-rose-50'
                }`}
              >
                <span>غير المسددين (مين مدفعش)</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                  paymentFilter === 'unpaid' ? 'bg-rose-800 text-white' : 'bg-rose-100 text-rose-700'
                }`}>
                  {financialSummary.unpaidCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentFilter('expiring_soon')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  paymentFilter === 'expiring_soon'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-amber-800 hover:bg-amber-50'
                }`}
              >
                <span>اشتراكات قربت تخلص ⚠️</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                  paymentFilter === 'expiring_soon' ? 'bg-amber-800 text-white' : 'bg-amber-100 text-amber-800'
                }`}>
                  {financialSummary.expiringSoonCount}
                </span>
              </button>
            </div>

            {paymentFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setPaymentFilter('all')}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 underline cursor-pointer px-2"
              >
                إلغاء التصفية وعرض الكل
              </button>
            )}
          </div>

          {/* 3. Search and Dual Excel Export Bar */}
          <div className="yalla-card p-4 border border-border rounded-2xl flex flex-col lg:flex-row items-center justify-between gap-3 shadow-2xs">
            <div className="relative w-full lg:w-96">
              <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={doctorsSearchQuery}
                onChange={e => setDoctorsSearchQuery(e.target.value)}
                placeholder="ابحث باسم الطبيب، العيادة، التخصص، أو الهاتف..."
                className="pr-10 h-10 text-xs bg-background rounded-xl border-border text-foreground"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-between lg:justify-end">
              <Button
                onClick={() => {
                  const firstUnpaid = clinics.find(c => {
                    const price = resolveDoctorNumericPrice(c, packages)
                    const paid = Number(c.paidAmount ?? (c.isPaid ? price : 0))
                    return paid < price
                  })
                  handleOpenPaymentModal(firstUnpaid || clinics[0] || null)
                }}
                className="h-10 px-4 text-xs font-black bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-md cursor-pointer flex items-center gap-2"
                title="تسجيل عملية تسديد حساب أو تحصيل اشتراك من عيادة أو طبيب"
              >
                <CreditCard className="w-4 h-4" />
                <span>تسديد حساب عيادة / دكتور 💳</span>
              </Button>

              <Button
                onClick={handleExportExpiring}
                variant="outline"
                className="h-10 px-3.5 text-xs font-black border-amber-300 text-amber-800 hover:bg-amber-50 rounded-xl cursor-pointer flex items-center gap-1.5 shadow-2xs"
                title="تصدير شيت إكسيل احترافي خاص بالاشتراكات التي أوشكت على الانتهاء لمتابعة التجديد"
              >
                <Clock className="w-4 h-4 text-amber-600" />
                <span>شيت الاشتراكات التي قربت تخلص</span>
              </Button>

              <Button
                onClick={handleExportDoctors}
                className="h-10 px-4 text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md cursor-pointer flex items-center gap-2"
                title="تصدير شيت إكسيل مالي شامل يتضمن خانة المبالغ المستحقة والمحصلة والمتبقية لكل طبيب"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>تصدير كشف الحسابات والتحصيل الشامل</span>
              </Button>
            </div>
          </div>

          {/* Active Filter Notification Banner */}
          {paymentFilter === 'unpaid' && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-xs text-rose-800 font-bold">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>جاري عرض الأطباء والعيادات غير المسددين للاشتراك فقط ({filteredDoctors.length} عيادة)</span>
              </div>
              <button
                type="button"
                onClick={() => setPaymentFilter('all')}
                className="underline hover:text-rose-950 cursor-pointer"
              >
                عرض كافة الأطباء
              </button>
            </div>
          )}

          {paymentFilter === 'expiring_soon' && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between text-xs text-amber-900 font-bold">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                <span>جاري عرض الاشتراكات التي أوشكت على الانتهاء أو المنتهية ({filteredDoctors.length} عيادة)</span>
              </div>
              <button
                type="button"
                onClick={() => setPaymentFilter('all')}
                className="underline hover:text-amber-950 cursor-pointer"
              >
                عرض كافة الأطباء
              </button>
            </div>
          )}

          {/* 4. Doctors & Accounts Table */}
          <div className="yalla-card border border-border rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-secondary/60 text-muted-foreground font-bold border-b border-border">
                  <tr>
                    <th className="py-3.5 px-3 text-center">#</th>
                    <th className="py-3.5 px-4">اسم الدكتور</th>
                    <th className="py-3.5 px-4">العيادة</th>
                    <th className="py-3.5 px-4 text-center">تاريخ البدء</th>
                    <th className="py-3.5 px-4 text-center">متبقي على الانتهاء</th>
                    <th className="py-3.5 px-4 text-center">الباقة</th>
                    <th className="py-3.5 px-4 text-center">سعر الباقة</th>
                    <th className="py-3.5 px-4 text-center">تسديد الحساب وحالة السداد</th>
                    <th className="py-3.5 px-4">مواعيد العمل</th>
                    <th className="py-3.5 px-4 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5EAF0]">
                  {filteredDoctors.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        {paymentFilter === 'unpaid'
                          ? 'رائع! لا يوجد أطباء متأخرين عن السداد حالياً.'
                          : paymentFilter === 'expiring_soon'
                          ? 'لا توجد اشتراكات تنتهي قريباً.'
                          : clinics.length === 0
                          ? 'لا يوجد أطباء مسجلين حتى الآن.'
                          : 'لا توجد نتائج تطابق بحثك.'}
                      </td>
                    </tr>
                  ) : (
                    filteredDoctors.map((c, idx) => {
                      const schedInfo = getDoctorScheduleSummary(c.weeklySchedule)
                      const expInfo = getDoctorExpirationInfo(c.expirationDate, c.isActive)
                      const resolvedPrice = resolveDoctorPackagePrice(c, packages)
                      const numericPrice = resolveDoctorNumericPrice(c, packages)
                      const paid = Number(c.paidAmount ?? (c.isPaid ? numericPrice : 0))
                      const isFullyPaid = paid >= numericPrice
                      const primaryPhone = c.doctorPhone || c.clinicPhone || ''

                      return (
                        <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                          {/* # */}
                          <td className="py-3.5 px-3 text-center font-mono text-slate-400 font-bold">
                            {idx + 1}
                          </td>

                          {/* 1. Doctor Name */}
                          <td className="py-3.5 px-4 min-w-[190px]">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center font-black text-teal-700 text-sm shrink-0 shadow-2xs">
                                {c.doctorName ? c.doctorName.charAt(0) : 'ط'}
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-black text-sm text-[#182230] truncate">
                                  {c.doctorName ? `د. ${c.doctorName}` : 'طبيب العيادة'}
                                </h4>
                                <p className="text-[11px] text-slate-500 font-medium truncate">
                                  {c.specialty || 'طبيب عام'} {c.certificationTitle ? `• ${c.certificationTitle}` : ''}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* 2. Clinic Name & Phone */}
                          <td className="py-3.5 px-4 min-w-[190px]">
                            <div className="space-y-1">
                              <h4 className="font-bold text-xs text-[#182230] flex items-center gap-1.5">
                                <Building2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                                <span className="truncate">{c.clinicName}</span>
                              </h4>
                              {primaryPhone && (
                                <div className="flex items-center gap-2 text-[10px]">
                                  <span className="font-mono font-bold text-slate-700" dir="ltr">
                                    {primaryPhone}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(primaryPhone)
                                      toast.success('تم نسخ رقم الهاتف!')
                                    }}
                                    className="p-0.5 hover:text-teal-700 text-slate-400 cursor-pointer"
                                    title="نسخ الرقم"
                                  >
                                    <Copy className="w-2.5 h-2.5" />
                                  </button>
                                  <a
                                    href={`https://wa.me/${cleanPhoneForWhatsApp(primaryPhone)}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-0.5 text-emerald-600 hover:text-emerald-700 font-bold hover:underline"
                                  >
                                    <MessageSquare className="w-2.5 h-2.5" />
                                    <span>واتساب</span>
                                  </a>
                                </div>
                              )}
                              {c.clinicAddress && (
                                <p className="text-[10px] text-slate-400 flex items-center gap-1 truncate max-w-[190px]">
                                  <MapPin className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                  <span className="truncate">{c.clinicAddress}</span>
                                </p>
                              )}
                            </div>
                          </td>

                          {/* 3. Activation / Start Date */}
                          <td className="py-3.5 px-4 text-center min-w-[120px]">
                            <div className="space-y-0.5">
                              <span className="font-mono text-xs font-bold text-slate-700" dir="ltr">
                                {c.activationDate || '—'}
                              </span>
                              <p className="text-[10px] text-slate-400">تاريخ البدء</p>
                            </div>
                          </td>

                          {/* 4. Remaining Until Expiration */}
                          <td className="py-3.5 px-4 text-center min-w-[150px]">
                            <div className="flex flex-col items-center gap-1">
                              <span className={`px-2.5 py-1 rounded-xl text-[10px] border font-black shadow-2xs ${expInfo.badgeClass}`}>
                                {expInfo.text}
                              </span>
                              <span className="font-mono text-[10px] text-slate-400" dir="ltr">
                                {c.expirationDate ? `ينتهي: ${c.expirationDate}` : 'اشتراك مفتوح'}
                              </span>
                            </div>
                          </td>

                          {/* 5. Package Name */}
                          <td className="py-3.5 px-4 text-center min-w-[130px]">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-black bg-amber-50 text-amber-900 border border-amber-200 shadow-2xs">
                              <Crown className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>{c.packageName || 'الباقة الأساسية'}</span>
                            </div>
                          </td>

                          {/* 6. Package Price */}
                          <td className="py-3.5 px-4 text-center min-w-[110px]">
                            <span className="font-mono font-black text-xs text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 inline-block shadow-2xs">
                              {resolvedPrice}
                            </span>
                          </td>

                          {/* 7. Settle Account & Payment Status (خانة تسديد الحساب) */}
                          <td className="py-3.5 px-4 text-center min-w-[150px]">
                            {isFullyPaid ? (
                              <div className="inline-flex flex-col items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenPaymentModal(c)}
                                  className="px-2.5 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-black text-[11px] inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                                  title="اضغط لعرض أو تعديل تفاصيل السداد"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>تم السداد بالكامل ✅</span>
                                </button>
                                <span className="font-mono text-[10px] text-slate-500 font-bold">
                                  {paid} ج.م • اضغط للتعديل
                                </span>
                              </div>
                            ) : (
                              <div className="inline-flex flex-col items-center gap-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => handleOpenPaymentModal(c)}
                                  className="h-8 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md shadow-emerald-600/20 cursor-pointer flex items-center gap-1.5 transition-all hover:scale-105"
                                  title="تسديد حساب واشتراك هذه العيادة"
                                >
                                  <CreditCard className="w-3.5 h-3.5" />
                                  <span>تسديد الحساب 💳</span>
                                </Button>
                                <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                                  متبقي: {Math.max(0, numericPrice - paid)} ج.م 🛑
                                </span>
                              </div>
                            )}
                          </td>

                          {/* 8. Working Schedule */}
                          <td className="py-3.5 px-4 min-w-[160px]">
                            <div className="space-y-1">
                              <p className="text-[11px] font-bold text-slate-700">
                                {schedInfo.summaryText}
                              </p>
                              {schedInfo.count > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setScheduleModalClinic(c)}
                                  className="inline-flex items-center gap-1 text-[10px] text-teal-700 hover:text-teal-900 font-bold hover:underline cursor-pointer"
                                >
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>عرض تفاصيل الأيام ({schedInfo.count})</span>
                                </button>
                              )}
                            </div>
                          </td>

                          {/* 9. Actions */}
                          <td className="py-3.5 px-4 text-center min-w-[170px]">
                            <div className="flex items-center justify-center gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenPaymentModal(c)}
                                className="h-8 px-2.5 text-xs font-bold text-emerald-700 border-emerald-300 hover:bg-emerald-50 rounded-xl cursor-pointer"
                                title="تسجيل تسديد الحساب"
                              >
                                <CreditCard className="w-3.5 h-3.5 ml-1 text-emerald-600" />
                                تسديد
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEdit(c)}
                                className="h-8 px-2.5 text-xs font-bold text-blue-600 border-blue-200 hover:bg-blue-50 rounded-xl cursor-pointer"
                                title="تعديل العيادة"
                              >
                                <Edit className="w-3.5 h-3.5 ml-1" />
                                تعديل
                              </Button>
                              <a
                                href={`https://${c.slug}.yalla-clinic.com/admin`}
                                target="_blank"
                                rel="noreferrer"
                                className="h-8 px-2.5 inline-flex items-center gap-1 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
                                title="فتح لوحة تحكم الطبيب"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>لوحة الطبيب</span>
                              </a>
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

          {/* Weekly Schedule Details Modal */}
          <Dialog open={!!scheduleModalClinic} onOpenChange={() => setScheduleModalClinic(null)}>
            <DialogContent className="max-w-md p-6 rounded-3xl" dir="rtl">
              <DialogHeader className="text-right">
                <DialogTitle className="text-base font-black text-[#182230] flex items-center gap-2">
                  <Clock className="w-5 h-5 text-teal-600" />
                  <span>مواعيد عمل: {scheduleModalClinic?.clinicName}</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400">
                  الطبيب: {scheduleModalClinic?.doctorName ? `د. ${scheduleModalClinic.doctorName}` : 'طبيب العيادة'} {scheduleModalClinic?.specialty ? `(${scheduleModalClinic.specialty})` : ''}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2 py-3">
                {Array.isArray(scheduleModalClinic?.weeklySchedule) && scheduleModalClinic.weeklySchedule.length > 0 ? (
                  scheduleModalClinic.weeklySchedule.map((s: any, idx: number) => {
                    const isOpen = s.isOpen !== false
                    return (
                      <div
                        key={idx}
                        className={`flex items-center justify-between p-2.5 rounded-xl border text-xs ${
                          isOpen ? 'bg-teal-50/60 border-teal-200 text-teal-900 font-bold' : 'bg-slate-50 border-slate-200 text-slate-400'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${isOpen ? 'bg-teal-500' : 'bg-slate-300'}`} />
                          <span>{s.day || s.id}</span>
                        </div>
                        <div className="font-mono text-xs" dir="ltr">
                          {isOpen ? `${formatTime12(s.start)} - ${formatTime12(s.end)}` : 'عطلة مغلقة'}
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="text-center py-6 text-xs text-slate-400">
                    السبت إلى الخميس: 05:00 م - 10:00 م (الجدول الافتراضي)
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Payment Settlement Modal (نافذة تسديد حساب الدكتور أو العيادة) */}
          <Dialog open={!!paymentModalClinic} onOpenChange={(open) => !open && setPaymentModalClinic(null)}>
            <DialogContent className="max-w-lg p-6 rounded-3xl" dir="rtl">
              <DialogHeader className="text-right pb-3 border-b border-slate-100">
                <DialogTitle className="text-base font-black text-[#182230] flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <span>تسديد حساب الطبيب واشتراك العيادة 💳</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  تسجيل وتأكيد عملية سداد اشتراك المنصة لحساب العيادة وتحديث السجلات المالية
                </DialogDescription>
              </DialogHeader>

              {paymentModalClinic && (() => {
                const numericPrice = resolveDoctorNumericPrice(paymentModalClinic, packages)
                const currentPaid = Number(paymentModalClinic.paidAmount ?? (paymentModalClinic.isPaid ? numericPrice : 0))
                const remaining = Math.max(0, numericPrice - currentPaid)
                const isFullyPaid = currentPaid >= numericPrice

                return (
                  <form onSubmit={handleConfirmSettlement} className="space-y-4 pt-2">
                    {/* Switcher Dropdown to Select Any Clinic */}
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-700">العيادة المراد تسديد حسابها:</Label>
                      <select
                        value={paymentModalClinic.id}
                        onChange={e => {
                          const selected = clinics.find(c => c.id === e.target.value)
                          if (selected) handleOpenPaymentModal(selected)
                        }}
                        className="h-10 text-xs font-bold rounded-xl bg-slate-50 border border-slate-200 px-3 w-full focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 cursor-pointer"
                      >
                        {clinics.map(c => {
                          const p = resolveDoctorNumericPrice(c, packages)
                          const pd = Number(c.paidAmount ?? (c.isPaid ? p : 0))
                          const paidDone = pd >= p
                          return (
                            <option key={c.id} value={c.id}>
                              {c.clinicName} — د. {c.doctorName || 'طبيب'} ({paidDone ? 'مسدد بالكامل ✅' : `متبقي ${p - pd} ج.م 🛑`})
                            </option>
                          )
                        })}
                      </select>
                    </div>

                    {/* Summary KPI Pill */}
                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-black text-sm text-[#182230]">
                            {paymentModalClinic.clinicName}
                          </h4>
                          <p className="text-xs text-slate-500">
                            {paymentModalClinic.doctorName ? `د. ${paymentModalClinic.doctorName}` : 'طبيب العيادة'} {paymentModalClinic.specialty ? `• ${paymentModalClinic.specialty}` : ''}
                          </p>
                        </div>
                        <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-bold text-xs">
                          {paymentModalClinic.packageName || 'الباقة الأساسية'}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/60 text-center text-xs">
                        <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-2xs">
                          <span className="text-slate-400 block text-[10px] font-bold">المبلغ المطلوب</span>
                          <span className="font-mono font-black text-slate-800">{numericPrice} ج.م</span>
                        </div>
                        <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-2xs">
                          <span className="text-slate-400 block text-[10px] font-bold">المسدد حالياً</span>
                          <span className="font-mono font-black text-emerald-600">{currentPaid} ج.م</span>
                        </div>
                        <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-2xs">
                          <span className="text-slate-400 block text-[10px] font-bold">المبلغ المتبقي</span>
                          <span className={`font-mono font-black ${remaining > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                            {remaining} ج.م
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Settle Amount Field */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold text-slate-700">
                          المبلغ المراد سداده وتسجيله (ج.م) *
                        </Label>
                        <button
                          type="button"
                          onClick={() => setSettleAmount(numericPrice)}
                          className="text-[11px] font-bold text-emerald-600 hover:text-emerald-800 underline cursor-pointer"
                        >
                          تسديد المبلغ بالكامل ({numericPrice} ج.م)
                        </button>
                      </div>
                      <Input
                        type="number"
                        min="0"
                        step="10"
                        required
                        value={settleAmount}
                        onChange={e => setSettleAmount(e.target.value)}
                        className="h-11 font-mono font-black text-sm bg-white border-slate-200 text-left"
                        dir="ltr"
                        placeholder="أدخل المبلغ المسدد..."
                      />
                    </div>

                    {/* Payment Method & Date */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-700">طريقة التحصيل / الدفع</Label>
                        <select
                          value={settleMethod}
                          onChange={e => setSettleMethod(e.target.value as any)}
                          className="h-10 text-xs font-bold rounded-xl bg-white border border-slate-200 px-3 w-full focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 cursor-pointer"
                        >
                          <option value="instapay">إنستاباي (InstaPay)</option>
                          <option value="vodafone_cash">فودافون كاش / محفظة ذكية</option>
                          <option value="cash">نقداً (كاش Cash)</option>
                          <option value="bank_transfer">تحويل بنكي</option>
                          <option value="other">طريقة أخرى</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-700">تاريخ السداد</Label>
                        <Input
                          type="date"
                          value={settleDate}
                          onChange={e => setSettleDate(e.target.value)}
                          className="h-10 text-xs bg-white border-slate-200"
                        />
                      </div>
                    </div>

                    {/* Payment Notes or Transaction Reference */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700">ملاحظات أو رقم العملية / الإيصال (اختياري)</Label>
                      <Input
                        value={settleNotes}
                        onChange={e => setSettleNotes(e.target.value)}
                        placeholder="مثال: رقم تحويل انستاباي #123456، اسم المحول، إلخ..."
                        className="h-10 text-xs bg-white border-slate-200"
                      />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 gap-2">
                      <div className="flex items-center gap-2">
                        <Button
                          type="submit"
                          disabled={isSubmittingPayment}
                          className="h-11 px-6 text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{isSubmittingPayment ? 'جاري الحفظ...' : 'تأكيد وحفظ السداد ✅'}</span>
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setPaymentModalClinic(null)}
                          className="h-11 px-4 text-xs font-bold text-slate-500 rounded-xl"
                        >
                          إلغاء
                        </Button>
                      </div>

                      {isFullyPaid && (
                        <button
                          type="button"
                          onClick={handleResetSettlement}
                          disabled={isSubmittingPayment}
                          className="text-[11px] font-bold text-rose-600 hover:text-rose-800 underline cursor-pointer"
                        >
                          إلغاء السداد وتعيين كغير مسدد ⚠️
                        </button>
                      )}
                    </div>
                  </form>
                )
              })()}
            </DialogContent>
          </Dialog>
        </motion.div>
      )}

      {/* TAB: Packages Management */}
      {activeTab === 'packages' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          {/* Header & Add Button */}
          <div className="yalla-card p-6 border border-border rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
            <div>
              <h2 className="text-xl font-black text-foreground flex items-center gap-2">
                <Package className="w-6 h-6 text-amber-500" />
                التحكم في باقات واشتراكات المنصة
              </h2>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                أنشئ وعدل باقات الاشتراك مع تحديد الأسعار والعروض (بدل كذا)، وتصنيفها (شهرية / سنوية)، وتحديد عدد الفروع وحدود ردود المساعد الذكي AI. تظهر هذه الباقات تلقائياً للأطباء في لوحة العيادة تحت خانة «ترقية حسابك / الباقات».
              </p>
            </div>

            <Button
              onClick={handleOpenNewPackage}
              className="h-11 px-5 text-xs font-black bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-md cursor-pointer flex items-center gap-2 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة باقة جديدة</span>
            </Button>
          </div>

          {/* Master Switch: Toggle Package Visibility in Clinics */}
          <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-[#0A1128] text-white border border-indigo-500/30 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 backdrop-blur-xl">
            <div className="flex items-center gap-3.5">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border transition-all ${
                showPackagesInClinics
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 shadow-lg shadow-emerald-500/10'
                  : 'bg-rose-500/20 border-rose-500/40 text-rose-400 shadow-lg shadow-rose-500/10'
              }`}>
                {showPackagesInClinics ? <Crown className="w-6 h-6 animate-pulse" /> : <EyeOff className="w-6 h-6" />}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-black text-white">عرض باقات الاشتراك والترقية في لوحات العيادات</h3>
                  <Badge className={showPackagesInClinics ? 'bg-emerald-500 text-white font-black text-[10px] px-2.5 py-0.5' : 'bg-rose-500 text-white font-black text-[10px] px-2.5 py-0.5'}>
                    {showPackagesInClinics ? 'ظاهرة للأطباء ومفعلة ✓' : 'مخفية تماماً عن العيادات ✕'}
                  </Badge>
                </div>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  {showPackagesInClinics
                    ? 'الباقات معروضة حالياً للأطباء في الشريط الجانبي وتحت اسم الدكتور داخل لوحة العيادة للترقية الفورية.'
                    : 'تم إخفاء خانة الباقات وزر الترقية تماماً من جميع العيادات (لن تظهر أي باقة أو إمكانية ترقية للطبيب).'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 self-end sm:self-center bg-white/5 border border-white/10 px-4 py-2.5 rounded-2xl">
              <span className="text-xs font-bold text-slate-200">
                {showPackagesInClinics ? 'إخفاء من العيادات' : 'إظهار للعيادات'}
              </span>
              <Switch
                checked={showPackagesInClinics}
                onCheckedChange={handleToggleShowPackagesInClinics}
                disabled={isTogglingPackagesVisibility}
                className="data-[state=checked]:bg-emerald-500"
              />
            </div>
          </div>

          {/* Category Filter Switcher (جميع الباقات / شهرية / 3 شهور / 6 شهور / سنوية) */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-slate-100/80 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setPackageCategoryFilter('all')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  packageCategoryFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                جميع الباقات ({packages.length})
              </button>
              <button
                type="button"
                onClick={() => setPackageCategoryFilter('monthly')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  packageCategoryFilter === 'monthly'
                    ? 'bg-white text-teal-700 shadow-xs border border-teal-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <span>باقات شهرية</span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-teal-50 text-teal-700 font-mono font-bold">
                  {packages.filter(p => getPackageCycle(p) === 'monthly').length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setPackageCategoryFilter('3_months')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  packageCategoryFilter === '3_months'
                    ? 'bg-white text-cyan-700 shadow-xs border border-cyan-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <span>باقات 3 شهور</span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-cyan-50 text-cyan-700 font-mono font-bold">
                  {packages.filter(p => getPackageCycle(p) === '3_months').length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setPackageCategoryFilter('6_months')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  packageCategoryFilter === '6_months'
                    ? 'bg-white text-purple-700 shadow-xs border border-purple-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <span>باقات 6 شهور</span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-purple-50 text-purple-700 font-mono font-bold">
                  {packages.filter(p => getPackageCycle(p) === '6_months').length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setPackageCategoryFilter('annual')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  packageCategoryFilter === 'annual'
                    ? 'bg-white text-amber-700 shadow-xs border border-amber-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <span>باقات سنوية</span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800 font-mono font-bold">
                  {packages.filter(p => getPackageCycle(p) === 'annual').length}
                </span>
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-full">
                  وفر شهرين 🎁
                </span>
              </button>
            </div>

            <span className="text-[11px] text-slate-400 font-medium px-2">
              عرض {
                packages.filter(pkg => {
                  if (packageCategoryFilter === 'all') return true
                  return getPackageCycle(pkg) === packageCategoryFilter
                }).length
              } باقة
            </span>
          </div>

          {/* Packages Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {packages
              .filter(pkg => {
                if (packageCategoryFilter === 'all') return true
                return getPackageCycle(pkg) === packageCategoryFilter
              })
              .map(pkg => {
                const isPop = pkg.isPopular || pkg.isRecommended
                const isAnn = pkg.category === 'annual' || pkg.period?.includes('سنو') || pkg.name?.includes('سنو')
                const hasDiscount = Number(pkg.originalPrice) > Number(pkg.price)
                return (
                  <div
                    key={pkg.id}
                    className={`yalla-card relative border rounded-3xl p-6 flex flex-col justify-between transition-all hover:shadow-xl ${
                      isPop
                        ? 'border-primary shadow-lg ring-2 ring-primary/20'
                        : 'border-border shadow-xs'
                    }`}
                  >
                    {/* Recommended / Custom Badge */}
                    {(pkg.badge || isPop) && (
                      <div className="absolute -top-3.5 right-6 z-10">
                        <span className={`px-3.5 py-1 rounded-full text-[11px] font-black shadow-md flex items-center gap-1.5 ${
                          isPop
                            ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-teal-500 text-white'
                            : 'bg-slate-800 text-white'
                        }`}>
                          {isPop && <Sparkles className="w-3.5 h-3.5 text-amber-200" />}
                          <span>{pkg.badge || '⭐ موصى بها للعيادات'}</span>
                        </span>
                      </div>
                    )}

                    <div>
                      {/* Category Tag (باقة شهرية / باقة سنوية) */}
                      <div className="flex items-center justify-between mb-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isAnn
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-teal-50 text-teal-800 border border-teal-200'
                        }`}>
                          {isAnn ? '📅 باقة سنوية' : '🗓️ باقة شهرية'}
                        </span>
                        {hasDiscount && (
                          <span className="text-[10px] font-black text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                            عرض خاص 🔥
                          </span>
                        )}
                      </div>

                      {/* Package Logo & Name Header */}
                      <div className="flex items-start gap-3 mb-3 pt-1">
                        {renderPackageIcon(pkg, 'md')}
                        <div className="flex-1 overflow-hidden">
                          <h3 className="text-lg font-black text-[#182230] truncate">
                            {pkg.name}
                          </h3>
                          {pkg.subtitle && (
                            <p className="text-[11px] text-slate-500 font-medium leading-tight mt-0.5 line-clamp-2">
                              {pkg.subtitle}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Pricing Box with Discount (بدل كذا) */}
                      {hasDiscount ? (
                        <div className="my-3 py-2.5 px-3.5 rounded-2xl bg-gradient-to-br from-emerald-50/70 to-teal-50/40 border border-emerald-200/80 space-y-1" dir="rtl">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] text-slate-400 font-bold">بدل:</span>
                            <span className="text-sm font-bold text-slate-400 line-through font-mono">
                              {Number(pkg.originalPrice).toLocaleString()} ج.م
                            </span>
                            <span className="text-[10px] font-black bg-rose-500 text-white px-2 py-0.5 rounded-full shadow-2xs">
                              {pkg.discountBadge || `وفر ${(Number(pkg.originalPrice) - Number(pkg.price)).toLocaleString()} ج.م`}
                            </span>
                          </div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-black text-emerald-600 font-mono">
                              {Number(pkg.price).toLocaleString()}
                            </span>
                            <span className="text-xs font-bold text-slate-500">ج.م / {pkg.period || (isAnn ? 'سنوي' : 'شهري')}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-baseline gap-1 my-3 py-2 px-3 rounded-2xl bg-slate-50 border border-slate-100" dir="rtl">
                          <span className="text-3xl font-black text-slate-900 font-mono">{Number(pkg.price).toLocaleString()}</span>
                          <span className="text-xs font-bold text-slate-500">ج.م / {pkg.period || (isAnn ? 'سنوي' : 'شهري')}</span>
                        </div>
                      )}

                      {/* Highlights */}
                      <div className="grid grid-cols-2 gap-2 mb-4 p-3 rounded-2xl bg-slate-50/80 border border-slate-100 text-center">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold">ردود الذكاء الاصطناعي</span>
                          <span className="text-xs font-black text-purple-700 font-mono">
                            {pkg.aiResponsesLimit?.toLocaleString() || 100} رد
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold">عدد الفروع</span>
                          <span className="text-xs font-black text-blue-700 font-mono">
                            {pkg.maxBranches || 1} {pkg.maxBranches === 1 ? 'فرع' : 'فروع'}
                          </span>
                        </div>
                      </div>

                      {/* Features List */}
                      <div className="space-y-2 mb-6">
                        <span className="text-[11px] font-black text-slate-700 block">مميزات الباقة:</span>
                        {Array.isArray(pkg.features) && pkg.features.map((feat: string, idx: number) => (
                          <div key={idx} className="flex items-start gap-2 text-xs text-slate-600">
                            <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditPackage(pkg)}
                        className="flex-1 h-9 rounded-xl text-xs font-bold text-blue-600 border-blue-200 hover:bg-blue-50"
                      >
                        <Edit className="w-3.5 h-3.5 ml-1" />
                        تعديل الباقة
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeletePackage(pkg.id, pkg.name)}
                        className="h-9 px-3 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-50 hover:text-rose-700"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })}
          </div>

          {/* Add / Edit Package Modal with Full Customization */}
          <Dialog open={isPackageModalOpen} onOpenChange={setIsPackageModalOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6 sm:p-7 rounded-3xl" dir="rtl">
              <DialogHeader className="text-right">
                <DialogTitle className="text-lg font-black text-[#182230] flex items-center gap-2">
                  <Package className="w-5 h-5 text-amber-600" />
                  <span>{editingPackageId ? 'تخصيص وتعديل بيانات الباقة' : 'إنشاء وتخصيص باقة جديدة'}</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400">
                  تحكم كامل في لوجو الباقة، الألوان، تمييز الباقة الموصى بها (Recommended)، والاسم والوصف والمميزات.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSavePackage} className="space-y-6 pt-3">
                {/* 1. Basic Names & Tagline */}
                <div className="space-y-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <h4 className="text-xs font-black text-slate-800 flex items-center gap-2">
                    <Edit className="w-4 h-4 text-blue-600" />
                    <span>الأسماء والوصف الترويجي للباقة</span>
                  </h4>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700">اسم الباقة الأساسي *</Label>
                      <Input
                        value={pkgName}
                        onChange={e => setPkgName(e.target.value)}
                        placeholder="مثل: الباقة الاحترافية (Pro)"
                        required
                        className="h-10 text-xs rounded-xl bg-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700">الوصف أو الشعار الترويجي (Subtitle)</Label>
                      <Input
                        value={pkgSubtitle}
                        onChange={e => setPkgSubtitle(e.target.value)}
                        placeholder="مثل: الخيار الأكثر ترشيحاً لعيادات النخبة والمراكز الطبية"
                        className="h-10 text-xs rounded-xl bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Logo & Visual Identity */}
                <div className="space-y-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <h4 className="text-xs font-black text-slate-800 flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-500" />
                    <span>تخصيص لوجو وهوية الباقة</span>
                  </h4>

                  {/* Logo Upload or URL */}
                  <div className="grid sm:grid-cols-2 gap-3 items-center">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-700">رفع لوجو مخصص (صورة)</Label>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#E5EAF0] hover:bg-slate-100 cursor-pointer text-xs font-bold text-slate-700 transition-colors shadow-2xs">
                          <Upload className="w-4 h-4 text-[#087CF4]" />
                          <span>رفع لوجو صورة</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handlePackageLogoUpload}
                            className="hidden"
                          />
                        </label>
                        {pkgLogoUrl && (
                          <button
                            type="button"
                            onClick={() => setPkgLogoUrl('')}
                            className="text-[11px] font-bold text-rose-500 hover:text-rose-700 cursor-pointer"
                          >
                            إزالة اللوجو
                          </button>
                        )}
                      </div>
                      <Input
                        value={pkgLogoUrl}
                        onChange={e => setPkgLogoUrl(e.target.value)}
                        placeholder="أو الصق رابط صورة اللوجو (https://...)"
                        dir="ltr"
                        className="h-9 text-xs rounded-xl bg-white font-mono text-right"
                      />
                    </div>

                    {/* Live Preview Box */}
                    <div className="p-3 rounded-2xl bg-white border border-slate-200 flex items-center gap-3">
                      {renderPackageIcon({ logoUrl: pkgLogoUrl, icon: pkgIcon, color: pkgColor, name: pkgName }, 'lg')}
                      <div className="overflow-hidden">
                        <span className="text-[10px] text-slate-400 block font-bold">معاينة هوية الباقة:</span>
                        <h5 className="font-black text-sm text-[#182230] truncate">{pkgName || 'اسم الباقة'}</h5>
                        <span className="text-[10px] font-mono font-bold" style={{ color: pkgColor }}>
                          {pkgColor}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Icon Selector (used when no custom logo is uploaded) */}
                  <div className="space-y-2 pt-2 border-t border-slate-200">
                    <Label className="text-xs font-bold text-slate-700 block">
                      أو اختر أيقونة الباقة (عند عدم رفع صورة):
                    </Label>
                    <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                      {AVAILABLE_PACKAGE_ICONS.map(ic => {
                        const Icon = ic.Icon
                        const isSelected = pkgIcon === ic.id
                        return (
                          <button
                            key={ic.id}
                            type="button"
                            onClick={() => setPkgIcon(ic.id)}
                            className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-white border-[#087CF4] ring-2 ring-[#087CF4]/20 shadow-xs'
                                : 'bg-white/60 border-slate-200 hover:bg-white text-slate-600'
                            }`}
                            title={ic.label}
                          >
                            <Icon className={`w-4 h-4 ${isSelected ? 'text-[#087CF4]' : 'text-slate-500'}`} />
                            <span className="text-[9px] font-medium truncate max-w-[45px]">{ic.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Theme Color Selector */}
                  <div className="space-y-2 pt-2 border-t border-slate-200">
                    <Label className="text-xs font-bold text-slate-700 block">
                      لون ثيم الباقة (Theme Color):
                    </Label>
                    <div className="flex flex-wrap items-center gap-2">
                      {PACKAGE_THEME_COLORS.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setPkgColor(c.value)}
                          className={`w-7 h-7 rounded-xl transition-all cursor-pointer flex items-center justify-center border ${
                            pkgColor === c.value ? 'ring-2 ring-offset-2 ring-slate-400 scale-110 shadow-xs' : 'hover:scale-105'
                          }`}
                          style={{ backgroundColor: c.value }}
                          title={c.label}
                        >
                          {pkgColor === c.value && <Check className="w-3.5 h-3.5 text-white" />}
                        </button>
                      ))}
                      <div className="flex items-center gap-1.5 mr-auto">
                        <input
                          type="color"
                          value={pkgColor}
                          onChange={e => setPkgColor(e.target.value)}
                          className="w-7 h-7 rounded-lg cursor-pointer border border-slate-200 p-0.5 bg-white"
                        />
                        <span className="text-xs font-mono font-bold text-slate-600" dir="ltr">{pkgColor}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Recommended / Popular Settings */}
                <div className="space-y-3 p-4 rounded-2xl bg-amber-50/50 border border-amber-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        <span>تخصيص الباقة الموصى بها (Recommended / الأكثر طلباً)</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        عند التفعيل، تظهر الباقة للطبيب بإطار مميز وشارة براقة كخيار مقترح للعيادات
                      </p>
                    </div>
                    <Switch checked={pkgIsPopular} onCheckedChange={setPkgIsPopular} />
                  </div>

                  {pkgIsPopular && (
                    <div className="space-y-1.5 pt-2 border-t border-amber-200">
                      <Label className="text-xs font-bold text-slate-700">نص شارة التوصية (Badge Text)</Label>
                      <Input
                        value={pkgBadge}
                        onChange={e => setPkgBadge(e.target.value)}
                        placeholder="مثل: الأكثر طلباً وموصى بها 🔥 أو الخيار الأفضل 💎"
                        className="h-10 text-xs rounded-xl bg-white"
                      />
                    </div>
                  )}
                </div>

                {/* 4. Category, Pricing & Offers / Discounts */}
                <div className="space-y-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
                    <div>
                      <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                        <Tag className="w-4 h-4 text-emerald-600" />
                        <span>تصنيف الباقة والأسعار والعروض (عرض كذا بدل كذا)</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        حدد دورة الفوترة (شهرية، 3 شهور، 6 شهور، سنوية) وضع سعراً قبل الخصم ليظهر مشطوباً كعرض خاص
                      </p>
                    </div>

                    {/* Category Switcher Buttons (شهري / 3 شهور / 6 شهور / سنوي) */}
                    <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shrink-0 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          setPkgCategory('monthly')
                          setPkgPeriod('شهري')
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          pkgCategory === 'monthly'
                            ? 'bg-teal-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        باقة شهرية
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPkgCategory('3_months')
                          setPkgPeriod('3 شهور')
                          if (!pkgDiscountBadge) setPkgDiscountBadge('وفر 15%')
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          pkgCategory === '3_months'
                            ? 'bg-cyan-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <span>3 شهور</span>
                        <span className="text-[10px] bg-cyan-100 text-cyan-800 px-1 rounded font-bold">ربع سنوي</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPkgCategory('6_months')
                          setPkgPeriod('6 شهور')
                          if (!pkgDiscountBadge) setPkgDiscountBadge('وفر 25%')
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          pkgCategory === '6_months'
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <span>6 شهور</span>
                        <span className="text-[10px] bg-purple-100 text-purple-800 px-1 rounded font-bold">نصف سنوي</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPkgCategory('annual')
                          setPkgPeriod('سنوي')
                          if (!pkgDiscountBadge) setPkgDiscountBadge('وفر شهرين مجاناً 🎁')
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          pkgCategory === 'annual'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <span>سنوية</span>
                        <span className="text-[10px] bg-amber-400 text-slate-900 px-1 rounded font-bold">توفير</span>
                      </button>
                    </div>
                  </div>

                  {/* Pricing & Discount Inputs */}
                  <div className="grid sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700">سعر العرض المطلوب (ج.م) *</Label>
                      <Input
                        type="number"
                        min="0"
                        value={pkgPrice}
                        onChange={e => setPkgPrice(e.target.value)}
                        required
                        placeholder="مثال: 950"
                        className="h-10 text-xs font-mono font-bold rounded-xl bg-white"
                      />
                      <span className="text-[10px] text-slate-400">السعر النهائي الذي يدفعه الطبيب</span>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                        <span>السعر قبل الخصم (بدل كذا)</span>
                        <span className="text-[10px] text-emerald-600 font-bold">يظهر مشطوباً</span>
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        value={pkgOriginalPrice}
                        onChange={e => setPkgOriginalPrice(e.target.value)}
                        placeholder="مثال: 1200"
                        className="h-10 text-xs font-mono font-bold rounded-xl bg-white"
                      />
                      <span className="text-[10px] text-slate-400">اتركه فارغاً إن لم يكن هناك خصم</span>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700">نص شارة الخصم أو العرض</Label>
                      <Input
                        value={pkgDiscountBadge}
                        onChange={e => setPkgDiscountBadge(e.target.value)}
                        placeholder="مثل: وفر 250 ج.م أو خصم 20%"
                        className="h-10 text-xs rounded-xl bg-white"
                      />
                      <span className="text-[10px] text-slate-400">شارة مميزة تظهر بجانب السعر</span>
                    </div>
                  </div>

                  {/* Live Discount Preview Box if discount exists */}
                  {Number(pkgOriginalPrice) > Number(pkgPrice) && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-emerald-800">معاينة عرض السعر للطبيب:</span>
                        <span className="text-xs font-mono line-through text-slate-400">{Number(pkgOriginalPrice).toLocaleString()} ج.م</span>
                        <span className="text-xs font-bold text-slate-500">أصبح</span>
                        <span className="text-sm font-black font-mono text-emerald-700">{Number(pkgPrice).toLocaleString()} ج.م</span>
                      </div>
                      <span className="text-[10px] font-black bg-rose-500 text-white px-2 py-0.5 rounded-full shadow-2xs">
                        {pkgDiscountBadge || `توفير ${(Number(pkgOriginalPrice) - Number(pkgPrice)).toLocaleString()} ج.م`}
                      </span>
                    </div>
                  )}

                  {/* Period, AI Limits & Branches */}
                  <div className="grid sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700">دورة الفوترة النصية *</Label>
                      <Input
                        value={pkgPeriod}
                        onChange={e => setPkgPeriod(e.target.value)}
                        placeholder="شهري / سنوي"
                        required
                        className="h-10 text-xs rounded-xl bg-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700">حد ردود AI شهرياً</Label>
                      <Input
                        type="number"
                        min="0"
                        value={pkgAiLimit}
                        onChange={e => setPkgAiLimit(e.target.value)}
                        className="h-10 text-xs font-mono font-bold rounded-xl bg-white"
                        placeholder="500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700">الحد الأقصى للفروع</Label>
                      <Input
                        type="number"
                        min="1"
                        max="50"
                        value={pkgMaxBranches}
                        onChange={e => setPkgMaxBranches(e.target.value)}
                        className="h-10 text-xs font-mono font-bold rounded-xl bg-white"
                        placeholder="1"
                      />
                    </div>
                  </div>
                </div>

                {/* 5. Granular Feature Locks / Permissions */}
                <div className="space-y-3 p-4 rounded-2xl bg-amber-50/40 border border-amber-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-amber-600" />
                        <span>التحكم في تفعيل وقفل ميزات المنصة (Feature Permissions)</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        أي ميزة يتم إغلاقها هنا تُقفل تماماً على الطبيب وتختفي من القائمة وتُمنع من الفتح
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-bold text-amber-700 bg-white border-amber-300">
                      تحكم كامل للمالك
                    </Badge>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-2.5 pt-2">
                    {/* 1. Finance */}
                    <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                          <Receipt className="w-4 h-4" />
                        </div>
                        <div>
                          <Label className="text-xs font-bold text-slate-800 block cursor-pointer">
                            الحسابات والتقارير المالية
                          </Label>
                          <span className="text-[10px] text-slate-400 block">المصروفات والإيرادات وأرباح العيادة</span>
                        </div>
                      </div>
                      <Switch checked={pkgAllowFinance} onCheckedChange={setPkgAllowFinance} />
                    </div>

                    {/* 2. Drugs */}
                    <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                          <Pill className="w-4 h-4" />
                        </div>
                        <div>
                          <Label className="text-xs font-bold text-slate-800 block cursor-pointer">
                            دليل وأسعار الأدوية
                          </Label>
                          <span className="text-[10px] text-slate-400 block">البحث في الأدوية والأسعار اليومية والبدائل</span>
                        </div>
                      </div>
                      <Switch checked={pkgAllowDrugs} onCheckedChange={setPkgAllowDrugs} />
                    </div>

                    {/* 3. Prescriptions */}
                    <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                          <FileSignature className="w-4 h-4" />
                        </div>
                        <div>
                          <Label className="text-xs font-bold text-slate-800 block cursor-pointer">
                            الروشتات الطبية الذكية
                          </Label>
                          <span className="text-[10px] text-slate-400 block">تحرير وطباعة ومشاركة الروشتة للمريض</span>
                        </div>
                      </div>
                      <Switch checked={pkgAllowPrescriptions} onCheckedChange={setPkgAllowPrescriptions} />
                    </div>

                    {/* 4. Custom Template */}
                    <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                          <Label className="text-xs font-bold text-slate-800 block cursor-pointer">
                            تصميم وقالب روشتة مخصص
                          </Label>
                          <span className="text-[10px] text-slate-400 block">رفع تصميم مخصص للروشتة خاص بالعيادة</span>
                        </div>
                      </div>
                      <Switch checked={pkgAllowCustomTemplate} onCheckedChange={setPkgAllowCustomTemplate} />
                    </div>

                    {/* 5. Doctor Branding */}
                    <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                          <Eye className="w-4 h-4" />
                        </div>
                        <div>
                          <Label className="text-xs font-bold text-slate-800 block cursor-pointer">
                            تعديل هوية العيادة والألوان
                          </Label>
                          <span className="text-[10px] text-slate-400 block">سماح الطبيب بتغيير الشعار والألوان بنفسه</span>
                        </div>
                      </div>
                      <Switch checked={pkgAllowBranding} onCheckedChange={setPkgAllowBranding} />
                    </div>

                    {/* 6. Patient Alerts */}
                    <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                          <Bell className="w-4 h-4" />
                        </div>
                        <div>
                          <Label className="text-xs font-bold text-slate-800 block cursor-pointer">
                            تنبيهات المرضى وواتساب
                          </Label>
                          <span className="text-[10px] text-slate-400 block">إرسال رسائل تذكير الدور والمواعيد تلقائياً</span>
                        </div>
                      </div>
                      <Switch checked={pkgAllowPatientAlerts} onCheckedChange={setPkgAllowPatientAlerts} />
                    </div>

                    {/* 7. AI Chatbot */}
                    <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                          <Bot className="w-4 h-4" />
                        </div>
                        <div>
                          <Label className="text-xs font-bold text-slate-800 block cursor-pointer">
                            المساعد الذكي (AI Chatbot)
                          </Label>
                          <span className="text-[10px] text-slate-400 block">الشات بوت الطبي الذكي وتدريبه للعيادة</span>
                        </div>
                      </div>
                      <Switch checked={pkgAllowAi} onCheckedChange={setPkgAllowAi} />
                    </div>

                    {/* 8. Branches */}
                    <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <Label className="text-xs font-bold text-slate-800 block cursor-pointer">
                            إدارة الفروع المتعددة
                          </Label>
                          <span className="text-[10px] text-slate-400 block">إمكانية فتح أكثر من فرع طبي للعيادة</span>
                        </div>
                      </div>
                      <Switch checked={pkgAllowBranches} onCheckedChange={setPkgAllowBranches} />
                    </div>

                    {/* 9. Online Booking */}
                    <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between sm:col-span-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                          <Calendar className="w-4 h-4" />
                        </div>
                        <div>
                          <Label className="text-xs font-bold text-slate-800 block cursor-pointer">
                            بوابة الحجز الذاتي للمرضى وتتبع الدور
                          </Label>
                          <span className="text-[10px] text-slate-400 block">تفعيل رابط الحجز الإلكتروني للمرضى وتتبع الطابور الحي</span>
                        </div>
                      </div>
                      <Switch checked={pkgAllowOnlineBooking} onCheckedChange={setPkgAllowOnlineBooking} />
                    </div>
                  </div>
                </div>

                {/* 6. Features Bullet Points Customization */}
                <div className="space-y-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <h4 className="text-xs font-black text-slate-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>تخصيص نصوص مميزات الباقة</span>
                  </h4>

                  {/* Add New Feature Item Field */}
                  <div className="flex items-center gap-2">
                    <Input
                      value={pkgNewFeatureInput}
                      onChange={e => setPkgNewFeatureInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddFeatureItem()
                        }
                      }}
                      placeholder="اكتب ميزة جديدة واضغط إضافة (مثل: إرسال تنبيهات تلقائية للمرضى)"
                      className="h-10 text-xs rounded-xl bg-white flex-1"
                    />
                    <Button
                      type="button"
                      onClick={handleAddFeatureItem}
                      className="h-10 px-4 text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs shrink-0 cursor-pointer"
                    >
                      <Plus className="w-4 h-4 ml-1" />
                      إضافة ميزة
                    </Button>
                  </div>

                  {/* Features Chips / Items List */}
                  {pkgFeatures && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {pkgFeatures.split('\n').filter(f => f.trim()).map((feat, fIdx) => (
                        <span
                          key={fIdx}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 shadow-2xs"
                        >
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{feat}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveFeatureItem(fIdx)}
                            className="text-slate-400 hover:text-rose-500 rounded-full p-0.5 transition-colors cursor-pointer"
                            title="حذف هذه الميزة"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Direct Multi-line Textarea for Bulk Editing */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-200">
                    <Label className="text-[11px] font-bold text-slate-500">
                      أو تعديل قائمة المميزات مباشرة (سطر واحد لكل ميزة للنسخ واللصق السريع):
                    </Label>
                    <textarea
                      value={pkgFeatures}
                      onChange={e => setPkgFeatures(e.target.value)}
                      rows={4}
                      placeholder="روشتات ذكية غير محدودة&#10;تنبيهات للمرضى قبل الكشف&#10;تصدير إكسيل متقدم"
                      className="w-full text-xs rounded-xl border border-slate-200 p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#087CF4]/20 focus:border-[#087CF4]"
                    />
                  </div>
                </div>

                {/* Submit Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-slate-200">
                  <Button
                    type="submit"
                    className="flex-1 h-12 text-xs font-black bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-md cursor-pointer"
                  >
                    {editingPackageId ? 'حفظ كافة تعديلات الباقة' : 'إنشاء وحفظ الباقة في المنصة'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsPackageModalOpen(false)}
                    className="h-12 px-6 text-xs font-bold rounded-xl"
                  >
                    إلغاء
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
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
          <div className="yalla-card border border-border rounded-3xl p-6 sm:p-8 shadow-md">
            
            <div className="flex items-center justify-between pb-5 border-b border-border mb-6">
              <div>
                <h2 className="text-xl font-black text-foreground flex items-center gap-2">
                  {editingId ? <Edit className="w-5 h-5 text-primary" /> : <Building className="w-5 h-5 text-primary" />}
                  {editingId ? 'تعديل بيانات العيادة وإعداداتها' : 'إضافة وتكوين عيادة طبية جديدة'}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
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
                  <Building className="w-4 h-4 text-[#087CF4]" />
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
                    <Label className="text-xs font-bold text-slate-600 flex items-center justify-between">
                      <span>رابط العيادة الخاص (Subdomain) *</span>
                      <span className="text-[10px] text-[#087CF4] font-mono" dir="ltr">.yalla-clinic.com</span>
                    </Label>
                    <div className="flex items-center rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs focus-within:border-[#087CF4] focus-within:ring-2 focus-within:ring-[#087CF4]/20" dir="ltr">
                      <span className="px-2.5 text-xs text-slate-400 select-none bg-slate-50 border-r border-slate-200 py-2">
                        https://
                      </span>
                      <Input
                        value={slug}
                        onChange={e => setSlug(e.target.value.toLowerCase().trim().replace(/[^a-z0-9-]/g, ''))}
                        required
                        placeholder="اسم-الدكتور"
                        className="h-10 text-xs font-mono font-bold text-slate-800 border-none shadow-none focus-visible:ring-0 px-2"
                        disabled={!!editingId}
                      />
                      <span className="px-2.5 text-xs font-bold text-[#087CF4] select-none bg-[#087CF4]/10 border-l border-[#087CF4]/20 py-2">
                        .yalla-clinic.com
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-sans">
                      الرابط المباشر للعيادة: <strong className="text-[#087CF4] font-mono" dir="ltr">https://{slug || 'اسم-الدكتور'}.yalla-clinic.com</strong>
                    </p>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-bold text-slate-600">صورة الطبيب (Hero Image)</Label>
                    <Input
                      value={heroImage}
                      onChange={e => setHeroImage(e.target.value)}
                      placeholder="https://images.unsplash.com/..."
                      dir="ltr"
                      className="h-10 text-xs rounded-xl text-right font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Contact Info */}
              <div className="space-y-3">
                <h3 className="text-xs font-black text-slate-700 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-[#087CF4]" />
                  أرقام التواصل وموقع العيادة
                </h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-600">رقم تليفون الطبيب (شخصي)</Label>
                    <PhoneInputWithCountry
                      value={doctorPhone}
                      onChange={(fullNumber) => setDoctorPhone(fullNumber)}
                      size="sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-600">رقم العيادة (واتساب والحجز والروشتة) *</Label>
                    <PhoneInputWithCountry
                      value={clinicPhone}
                      onChange={(fullNumber) => setClinicPhone(fullNumber)}
                      required
                      size="sm"
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
                  <Sparkles className="w-4 h-4 text-[#087CF4]" />
                  تصميم الروشتة والتحكم في الذكاء الاصطناعي
                </h3>
                
                <div className="grid md:grid-cols-2 gap-6 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                  
                  {/* Prescription Image Upload */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-[#182230]">
                      <FileSignature className="w-5 h-5 text-[#087CF4]" />
                      <h4 className="font-bold text-xs">صورة تصميم ورقة الروشتة المطبوعة (A4 Template)</h4>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      يمكن للمالك رفع صورة من الجهاز مباشرة أو وضع رابط لتصميم الروشتة الخاص بالعيادة، ليتم طباعة بيانات الكشف والأدوية عليها تلقائياً.
                    </p>
                    
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#E5EAF0] hover:bg-slate-50 cursor-pointer text-xs font-bold text-slate-700 transition-colors shadow-2xs">
                        <Upload className="w-4 h-4 text-[#087CF4]" />
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

                      {/* AI Quota & Auto-Stop Controls */}
                      <div className="pt-3 border-t border-slate-100 space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-[11px] font-bold text-slate-800">
                            الحد الأقصى لعدد ردود المساعد الذكي (AI Responses Quota)
                          </Label>
                          {editingId && (
                            <button
                              type="button"
                              onClick={() => handleResetAiCount(editingId)}
                              className="text-[10px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-lg cursor-pointer transition-colors"
                            >
                              تصفير عداد الردود
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3 items-center">
                          <div>
                            <Input
                              type="number"
                              min="0"
                              value={aiResponsesLimit}
                              onChange={e => setAiResponsesLimit(Math.max(0, parseInt(e.target.value) || 0))}
                              className="h-9 text-xs font-mono font-bold rounded-lg"
                              placeholder="100"
                            />
                            <span className="text-[10px] text-slate-400">الحد الأقصى المسموح للعيادة</span>
                          </div>
                          <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-center">
                            <span className="text-[10px] text-slate-500 block font-medium">الردود المستهلكة:</span>
                            <span className="text-xs font-mono font-black text-purple-700">
                              {aiResponsesCount} / {aiResponsesLimit}
                            </span>
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-normal">
                          إذا وصل عدد ردود البوت إلى هذا الحد، سيتوقف المساعد الذكي تلقائياً عن الرد ويعتذر للمريض ويطلب منه التواصل هاتفياً، كما يتم إرسال إشعار فوري للطبيب في لوحة العيادة.
                        </p>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* Section 4: Multi-Branch Quota & Management (TASK 9) */}
              <div className="space-y-3">
                <h3 className="text-xs font-black text-slate-700 flex items-center gap-2">
                  <Building className="w-4 h-4 text-[#087CF4]" />
                  إدارة باقة الفروع والاشتراك (Multi-Branch Controls)
                </h3>
                <div className="p-5 rounded-2xl bg-blue-50/40 border border-blue-100 space-y-4">
                  <div className="grid md:grid-cols-3 gap-4">
                    {/* Toggle Branches Enabled */}
                    <div className="p-4 rounded-xl bg-white border border-slate-200 flex flex-col justify-between space-y-3">
                      <div>
                        <Label className="text-xs font-black text-slate-800 block">
                          تفعيل نظام الفروع المتعددة
                        </Label>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          إذا تم إيقافه، تعمل العيادة بنظام الفرع الواحد فقط
                        </p>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <span className={`text-[11px] font-bold ${branchesEnabled ? 'text-blue-600' : 'text-slate-400'}`}>
                          {branchesEnabled ? '● باقة فروع متعددة' : '○ فرع رئيسي فقط'}
                        </span>
                        <Switch checked={branchesEnabled} onCheckedChange={setBranchesEnabled} />
                      </div>
                    </div>

                    {/* Max Branches Allowed */}
                    <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2">
                      <Label className="text-xs font-black text-slate-800 block">
                        الحد الأقصى للفروع المسموحة (Branch Quota)
                      </Label>
                      <p className="text-[11px] text-slate-500">
                        العدد الإجمالي للفروع المسموح للعيادة بإنشائها
                      </p>
                      <Input
                        type="number"
                        min="1"
                        max="50"
                        value={maxBranches}
                        onChange={e => setMaxBranches(Math.max(1, parseInt(e.target.value) || 1))}
                        disabled={!branchesEnabled}
                        className="h-10 text-xs font-mono font-bold rounded-xl mt-1"
                      />
                    </div>

                    {/* Toggle Branch Creation Allowed */}
                    <div className="p-4 rounded-xl bg-white border border-slate-200 flex flex-col justify-between space-y-3">
                      <div>
                        <Label className="text-xs font-black text-slate-800 block">
                          سماح الطبيب بإنشاء فروع
                        </Label>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          السماح للطبيب بإنشاء فروع بنفسه من لوحة العيادة
                        </p>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <span className={`text-[11px] font-bold ${branchCreationAllowed ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {branchCreationAllowed ? '● مسموح للطبيب' : '○ محظور (بواسطة المالك فقط)'}
                        </span>
                        <Switch
                          checked={branchCreationAllowed}
                          onCheckedChange={setBranchCreationAllowed}
                          disabled={!branchesEnabled}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 5: Clinic Branding & Print Identity (TASK 10) */}
              <div className="space-y-3">
                <h3 className="text-xs font-black text-slate-700 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#087CF4]" />
                  هوية العيادة والمطبوعات (Branding & Print Identity)
                </h3>
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                  
                  {/* Doctor Permission Toggle */}
                  <div className="p-4 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                    <div>
                      <Label className="text-xs font-black text-slate-800 block">
                        السماح للطبيب بتعديل الهوية والألوان والشعار
                      </Label>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        عند الإيقاف، يقفل قسم الهوية في إعدادات العيادة ولا يمكن للطبيب تغيير الألوان أو الشعار
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-[11px] font-bold ${allowDoctorEditBranding ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {allowDoctorEditBranding ? '● مسموح للطبيب التعديل' : '○ مغلق (تحكم المالك حصراً)'}
                      </span>
                      <Switch
                        checked={allowDoctorEditBranding}
                        onCheckedChange={setAllowDoctorEditBranding}
                      />
                    </div>
                  </div>

                  {/* Specialty, Degree, and Address */}
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-600">التخصص الطبي (يظهر في ترويسة الروشتة)</Label>
                      <Input
                        value={specialty}
                        onChange={e => setSpecialty(e.target.value)}
                        placeholder="استشاري جراحة العظام والمفاصل"
                        className="h-10 text-xs rounded-xl bg-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-600">الدرجة والشهادات العلمية</Label>
                      <Input
                        value={certificationTitle}
                        onChange={e => setCertificationTitle(e.target.value)}
                        placeholder="دكتوراه جراحة العظام - زميل الكلية الملكية"
                        className="h-10 text-xs rounded-xl bg-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-600">عنوان المقر الرئيسي للعيادة</Label>
                      <Input
                        value={clinicAddress}
                        onChange={e => setClinicAddress(e.target.value)}
                        placeholder="القاهرة، التجمع الخامس، شارع التسعين"
                        className="h-10 text-xs rounded-xl bg-white"
                      />
                    </div>
                  </div>

                  {/* Logos & Colors */}
                  <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-600">رابط الشعار الملون (A4 / شاشات)</Label>
                      <Input
                        value={logoUrl}
                        onChange={e => setLogoUrl(e.target.value)}
                        dir="ltr"
                        placeholder="https://... logo.png"
                        className="h-10 text-xs rounded-xl bg-white text-right font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-600">رابط الشعار الأحادي (إيصالات 80mm حراري)</Label>
                      <Input
                        value={thermalMonoLogoUrl}
                        onChange={e => setThermalMonoLogoUrl(e.target.value)}
                        dir="ltr"
                        placeholder="https://... mono-logo.png"
                        className="h-10 text-xs rounded-xl bg-white text-right font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-600">اللون الأساسي (Primary Color)</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={primaryColor}
                          onChange={e => setPrimaryColor(e.target.value)}
                          className="w-10 h-10 rounded-xl cursor-pointer border border-slate-200 p-0.5 bg-white"
                        />
                        <Input
                          value={primaryColor}
                          onChange={e => setPrimaryColor(e.target.value)}
                          dir="ltr"
                          className="h-10 text-xs font-mono rounded-xl bg-white flex-1"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-600">اللون الثانوي (Secondary Color)</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={secondaryColor}
                          onChange={e => setSecondaryColor(e.target.value)}
                          className="w-10 h-10 rounded-xl cursor-pointer border border-slate-200 p-0.5 bg-white"
                        />
                        <Input
                          value={secondaryColor}
                          onChange={e => setSecondaryColor(e.target.value)}
                          dir="ltr"
                          className="h-10 text-xs font-mono rounded-xl bg-white flex-1"
                        />
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* Section 6: Login Accounts */}
              {!editingId && (
<div className="space-y-3">
                <h3 className="text-xs font-black text-slate-700 flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#087CF4]" />
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
)}

              {/* Section 5: Subscription & Active Status */}
              <div className="space-y-3">
                <h3 className="text-xs font-black text-slate-700 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#087CF4]" />
                  مدة الاشتراك وباقة العيادة
                </h3>
                <div className="grid md:grid-cols-5 gap-4 items-center bg-[#087CF4]/5 p-4 rounded-2xl border border-[#087CF4]/20">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-600">باقة الاشتراك المعتمدة</Label>
                    <select
                      value={packageName}
                      onChange={e => {
                        setPackageName(e.target.value)
                        const sel = packages.find(p => p.name === e.target.value)
                        if (sel) {
                          if (sel.aiResponsesLimit) setAiResponsesLimit(sel.aiResponsesLimit)
                          if (sel.maxBranches) setMaxBranches(sel.maxBranches)
                          if (sel.allowFinance !== undefined) setAllowFinance(sel.allowFinance)
                          if (sel.allowDrugs !== undefined) setAllowDrugs(sel.allowDrugs)
                          if (sel.allowPrescriptions !== undefined) setAllowPrescriptions(sel.allowPrescriptions)
                          if (sel.allowCustomTemplate !== undefined) setAllowCustomTemplate(sel.allowCustomTemplate)
                          if (sel.allowBranding !== undefined) setAllowDoctorEditBranding(sel.allowBranding)
                          if (sel.allowPatientAlerts !== undefined) setAllowPatientAlerts(sel.allowPatientAlerts)
                          if (sel.allowAi !== undefined) setAiEnabled(sel.allowAi)
                          if (sel.allowBranches !== undefined) setBranchesEnabled(sel.allowBranches)
                          if (sel.allowOnlineBooking !== undefined) setAllowOnlineBooking(sel.allowOnlineBooking)
                        }
                      }}
                      className="h-10 text-xs font-bold rounded-xl bg-white border border-slate-200 px-3 w-full focus:outline-none focus:ring-2 focus:ring-[#087CF4]/20 focus:border-[#087CF4] cursor-pointer"
                    >
                      {packages.map(p => (
                        <option key={p.id} value={p.name}>
                          {p.name} ({p.price} ج.م / {p.period || 'شهري'})
                        </option>
                      ))}
                      {packages.length === 0 && (
                        <>
                          <option value="الباقة الأساسية">الباقة الأساسية</option>
                          <option value="الباقة الاحترافية (Pro)">الباقة الاحترافية (Pro)</option>
                          <option value="الباقة الماسية (VIP)">الباقة الماسية (VIP)</option>
                        </>
                      )}
                    </select>
                  </div>
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
                      العيادة نشطة وجاهزة
                    </Label>
                    <Switch checked={isActive} onCheckedChange={setIsActive} />
                  </div>
                  <div className="pt-4 flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
                    <div>
                      <Label className="text-xs font-black text-slate-700 cursor-pointer block" onClick={() => setIsPaid(!isPaid)}>
                        سداد الاشتراك
                      </Label>
                      <span className={`text-[10px] font-bold block ${isPaid ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isPaid ? 'تم الدفع ✅' : 'غير مسدد 🛑'}
                      </span>
                    </div>
                    <Switch checked={isPaid} onCheckedChange={setIsPaid} />
                  </div>
                </div>

                <div className="space-y-1.5 mt-4">
                  <Label className="text-xs font-bold text-slate-600">رسالة إشعار (تظهر للطبيب في الجرس)</Label>
                  <Input
                    value={ownerMessage}
                    onChange={e => setOwnerMessage(e.target.value)}
                    placeholder="اكتب رسالة للتنبيه حول الاشتراك..."
                    className="h-10 text-xs bg-slate-50 border border-slate-200"
                  />
                </div>

                {/* Granular Clinic Feature Permissions & Lock Overrides */}
                <div className="space-y-3 p-5 rounded-2xl bg-slate-50 border border-slate-200 mt-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
                    <div>
                      <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-[#087CF4]" />
                        <span>التحكم الدقيق في صلاحيات وميزات هذه العيادة (Custom Feature Overrides)</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        تم أخذ الصلاحيات تلقائياً من الباقة المختارة أعلاه، ويمكنك تفعيل أو قفل أي ميزة محددة حصرياً لهذه العيادة
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-bold text-[#087CF4] bg-white border-[#087CF4]/20">
                      تخصيص الصلاحيات للعيادة
                    </Badge>
                  </div>

                  <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
                    {/* Finance */}
                    <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-emerald-600" />
                        <div>
                          <Label className="text-xs font-bold text-slate-800 block cursor-pointer">الحسابات والمالية</Label>
                          <span className="text-[9px] text-slate-400">إيرادات ومصروفات</span>
                        </div>
                      </div>
                      <Switch checked={allowFinance} onCheckedChange={setAllowFinance} />
                    </div>

                    {/* Drugs */}
                    <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Pill className="w-4 h-4 text-blue-600" />
                        <div>
                          <Label className="text-xs font-bold text-slate-800 block cursor-pointer">دليل وأسعار الأدوية</Label>
                          <span className="text-[9px] text-slate-400">قاعدة الأدوية والبدائل</span>
                        </div>
                      </div>
                      <Switch checked={allowDrugs} onCheckedChange={setAllowDrugs} />
                    </div>

                    {/* Prescriptions */}
                    <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileSignature className="w-4 h-4 text-teal-600" />
                        <div>
                          <Label className="text-xs font-bold text-slate-800 block cursor-pointer">الروشتة الذكية</Label>
                          <span className="text-[9px] text-slate-400">تحرير وطباعة ومشاركة</span>
                        </div>
                      </div>
                      <Switch checked={allowPrescriptions} onCheckedChange={setAllowPrescriptions} />
                    </div>

                    {/* Custom Template */}
                    <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-600" />
                        <div>
                          <Label className="text-xs font-bold text-slate-800 block cursor-pointer">قالب روشتة مخصص</Label>
                          <span className="text-[9px] text-slate-400">ورق مطبوع خاص بالعيادة</span>
                        </div>
                      </div>
                      <Switch checked={allowCustomTemplate} onCheckedChange={setAllowCustomTemplate} />
                    </div>

                    {/* Branding */}
                    <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Palette className="w-4 h-4 text-amber-600" />
                        <div>
                          <Label className="text-xs font-bold text-slate-800 block cursor-pointer">تعديل الطبيب للهوية</Label>
                          <span className="text-[9px] text-slate-400">تغيير اللوجو والألوان</span>
                        </div>
                      </div>
                      <Switch checked={allowDoctorEditBranding} onCheckedChange={setAllowDoctorEditBranding} />
                    </div>

                    {/* Patient Alerts */}
                    <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bell className="w-4 h-4 text-rose-600" />
                        <div>
                          <Label className="text-xs font-bold text-slate-800 block cursor-pointer">تنبيهات المرضى وواتساب</Label>
                          <span className="text-[9px] text-slate-400">رسائل وتذكيرات الدور</span>
                        </div>
                      </div>
                      <Switch checked={allowPatientAlerts} onCheckedChange={setAllowPatientAlerts} />
                    </div>

                    {/* AI */}
                    <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bot className="w-4 h-4 text-purple-600" />
                        <div>
                          <Label className="text-xs font-bold text-slate-800 block cursor-pointer">المساعد الذكي AI</Label>
                          <span className="text-[9px] text-slate-400">تشغيل الشات بوت الطبي</span>
                        </div>
                      </div>
                      <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} />
                    </div>

                    {/* Branches */}
                    <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-cyan-600" />
                        <div>
                          <Label className="text-xs font-bold text-slate-800 block cursor-pointer">الفروع المتعددة</Label>
                          <span className="text-[9px] text-slate-400">إدارة فروع العيادة</span>
                        </div>
                      </div>
                      <Switch checked={branchesEnabled} onCheckedChange={setBranchesEnabled} />
                    </div>

                    {/* Online Booking */}
                    <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between sm:col-span-2 md:col-span-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-emerald-600" />
                        <div>
                          <Label className="text-xs font-bold text-slate-800 block cursor-pointer">بوابة الحجز الذاتي للمرضى وتتبع الدور</Label>
                          <span className="text-[9px] text-slate-400">تفعيل رابط الحجز الإلكتروني للمرضى وتتبع الطابور الحي</span>
                        </div>
                      </div>
                      <Switch checked={allowOnlineBooking} onCheckedChange={setAllowOnlineBooking} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center gap-3 pt-3">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className={`flex-1 h-12 text-xs font-black text-white rounded-xl shadow-lg transition-all cursor-pointer ${
                    editingId ? 'bg-[#087CF4] hover:bg-[#0662C4]' : 'yalla-gradient-btn'
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
          <div className="yalla-card border border-border rounded-3xl p-6 sm:p-8 space-y-6 shadow-md">
            <div className="pb-4 border-b border-border">
              <h2 className="text-xl font-black text-foreground flex items-center gap-2">
                <Bot className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                المفتاح المركزي للذكاء الاصطناعي (OpenAI / Gemini)
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
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
            </div>

            <div className="space-y-3 pt-3">
              <Label className="text-xs font-bold text-slate-700">مفتاح إرسال الإيميلات (Resend API Key لرمز OTP)</Label>
              <Input
                type="password"
                value={resendApiKey}
                onChange={e => setResendApiKey(e.target.value)}
                dir="ltr"
                placeholder="re_..."
                className="h-11 text-xs font-mono rounded-xl bg-slate-50 border-[#E5EAF0] focus:bg-white text-right"
              />
              <p className="text-[11px] text-slate-400">
                يُستخدم لإرسال كود الـ OTP إلى جيميل الطبيب مباشرة عند طلب استعادة كلمة المرور (احصل عليه مجاناً من resend.com).
              </p>

            <div className="pb-4 mt-8 border-b border-[#E5EAF0]">
              <h2 className="text-xl font-black text-[#182230] flex items-center gap-2">
                <Phone className="w-6 h-6 text-emerald-600" />
                أرقام الدعم الفني للمنصة
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                هذه الأرقام تظهر للأطباء في لوحة التحكم الخاصة بهم للتواصل معكم (مثل قسم إعدادات الذكاء الاصطناعي).
              </p>
            </div>
            <div className="space-y-4 pt-4">
              {supportNumbers.map((num, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row gap-3 items-end p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                  <div className="space-y-1.5 w-full">
                    <Label className="text-xs font-bold text-slate-700">المسمى (مثل: دعم المنصة)</Label>
                    <Input value={num.label} onChange={e => {
                      const newNums = [...supportNumbers];
                      newNums[idx].label = e.target.value;
                      setSupportNumbers(newNums);
                    }} className="h-10 text-xs rounded-xl bg-white" />
                  </div>
                  <div className="space-y-1.5 w-full">
                    <Label className="text-xs font-bold text-slate-700">رقم الهاتف (واتساب)</Label>
                    <PhoneInputWithCountry
                      value={num.phone}
                      onChange={(fullNumber) => {
                        const newNums = [...supportNumbers];
                        newNums[idx].phone = fullNumber;
                        setSupportNumbers(newNums);
                      }}
                      size="sm"
                    />
                  </div>
                  <div className="flex items-center gap-3 w-full sm:w-auto h-10 px-2">
                    <Switch checked={num.isActive} onCheckedChange={checked => {
                      const newNums = [...supportNumbers];
                      newNums[idx].isActive = checked;
                      setSupportNumbers(newNums);
                    }} className="data-[state=checked]:bg-emerald-500" />
                    <span className="text-xs font-bold text-slate-600">{num.isActive ? 'متاح' : 'مخفي'}</span>
                    <Button variant="ghost" size="icon" onClick={() => {
                      setSupportNumbers(supportNumbers.filter((_, i) => i !== idx));
                    }} className="text-rose-500 hover:text-rose-600 hover:bg-rose-50">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button variant="outline" onClick={() => setSupportNumbers([...supportNumbers, {phone: '', label: '', isActive: true}])} className="w-full border-dashed h-12 text-xs font-bold text-[#087CF4] border-blue-200 dark:border-blue-900/40 hover:bg-blue-50 dark:hover:bg-blue-950/30">
                <Plus className="w-4 h-4 ml-2" /> إضافة رقم دعم جديد
              </Button>
            </div>

              <Button
                onClick={saveGlobalKey}
                disabled={isSavingGlobal}
                className="h-11 px-8 font-black text-xs bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-md cursor-pointer"
              >
                {isSavingGlobal ? 'جاري الحفظ...' : 'حفظ إعدادات المنصة'}
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
            className="bg-card rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl border border-border"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-black text-sm text-foreground flex items-center gap-2">
                <FileSignature className="w-4 h-4 text-primary" />
                معاينة تصميم ورقة الروشتة المعتمد للعيادة
              </h3>
              <button
                onClick={() => setPreviewTemplateModal(null)}
                className="text-slate-400 hover:text-slate-700 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[500px] overflow-auto rounded-xl border bg-slate-50 dark:bg-[#07162D] p-2 flex items-center justify-center">
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
                className="rounded-xl text-xs font-bold bg-[#087CF4] hover:bg-[#0662C4] text-white"
              >
                إغلاق المعاينة
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Platform Owner Footer */}
      <footer className="mt-12 pt-6 border-t border-[#E5EAF0] dark:border-[#1E3A5F] text-center text-xs text-slate-400 font-medium">
        جميع الحقوق محفوظة YallaCodeX 2026
      </footer>

    </div>
  )
}
