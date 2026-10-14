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
  Gem, Rocket, Stethoscope, Building2, Star, Award, Zap, X
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
import { exportDoctorsExcel } from '@/lib/excelExport'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'
import Link from 'next/link'

export default function OwnerDashboard() {
  const [clinics, setClinics] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'clinics' | 'doctors' | 'packages' | 'add' | 'settings'>('clinics')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMode, setFilterMode] = useState<'all' | 'active' | 'inactive' | 'ai-on' | 'ai-off'>('all')

  // Doctors Tab State
  const [doctorsSearchQuery, setDoctorsSearchQuery] = useState('')
  const [showPasswords, setShowPasswords] = useState<{ [id: string]: boolean }>({})

  // Packages Management State
  const [packages, setPackages] = useState<any[]>([])
  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false)
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null)
  const [pkgName, setPkgName] = useState('')
  const [pkgSubtitle, setPkgSubtitle] = useState('')
  const [pkgLogoUrl, setPkgLogoUrl] = useState('')
  const [pkgIcon, setPkgIcon] = useState('crown')
  const [pkgColor, setPkgColor] = useState('#15B8A6')
  const [pkgPrice, setPkgPrice] = useState<number | string>(450)
  const [pkgPeriod, setPkgPeriod] = useState('شهري')
  const [pkgAiLimit, setPkgAiLimit] = useState<number | string>(100)
  const [pkgMaxBranches, setPkgMaxBranches] = useState<number | string>(1)
  const [pkgBadge, setPkgBadge] = useState('')
  const [pkgIsPopular, setPkgIsPopular] = useState(false)
  const [pkgFeatures, setPkgFeatures] = useState('')
  const [pkgNewFeatureInput, setPkgNewFeatureInput] = useState('')

  // Clinic Package & AI Limits for active clinic
  const [packageName, setPackageName] = useState('الباقة الأساسية')
  const [aiResponsesLimit, setAiResponsesLimit] = useState<number | string>(100)
  const [aiResponsesCount, setAiResponsesCount] = useState<number>(0)

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
  const [primaryColor, setPrimaryColor] = useState('#15B8A6')
  const [secondaryColor, setSecondaryColor] = useState('#2F80ED')
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

  const getLocalDate = () => new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]
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
          setSupportNumbers(pSnap.docs[0].data().supportNumbers || [])
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
              price: 450,
              period: 'شهري',
              aiResponsesLimit: 100,
              maxBranches: 1,
              isPopular: false,
              badge: 'العيادات الفردية',
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
              price: 950,
              period: 'شهري',
              aiResponsesLimit: 500,
              maxBranches: 3,
              isPopular: true,
              badge: 'الأكثر طلباً 🔥',
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
              price: 1800,
              period: 'شهري',
              aiResponsesLimit: 2500,
              maxBranches: 10,
              isPopular: false,
              badge: 'المراكز الطبية الكبرى',
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

    return () => {
      unsubClinics()
      unsubPackages()
    }
  }, [])

  const handleExportDoctors = async () => {
    try {
      toast.info('جاري إعداد وتصدير ملف الإكسيل الشامل لبيانات الأطباء والمواعيد...')
      await exportDoctorsExcel(clinics)
      toast.success('تم تصدير ملف الإكسيل بنجاح!')
    } catch (err: any) {
      toast.error('حدث خطأ أثناء تصدير الإكسيل: ' + err.message)
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
    { id: 'teal', value: '#15B8A6', label: 'تركواز' },
    { id: 'amber', value: '#F59E0B', label: 'ذهبي' },
    { id: 'purple', value: '#8B5CF6', label: 'بنفسجي' },
    { id: 'blue', value: '#2563EB', label: 'أزرق' },
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
        style={{ backgroundColor: pkgOrData.color || '#15B8A6' }}
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

  const handleOpenNewPackage = () => {
    setEditingPackageId(null)
    setPkgName('')
    setPkgSubtitle('')
    setPkgLogoUrl('')
    setPkgIcon('crown')
    setPkgColor('#15B8A6')
    setPkgPrice(450)
    setPkgPeriod('شهري')
    setPkgAiLimit(100)
    setPkgMaxBranches(1)
    setPkgBadge('الأكثر طلباً وموصى بها 🔥')
    setPkgIsPopular(false)
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
    setPkgColor(pkg.color || '#15B8A6')
    setPkgPrice(pkg.price || 0)
    setPkgPeriod(pkg.period || 'شهري')
    setPkgAiLimit(pkg.aiResponsesLimit || 100)
    setPkgMaxBranches(pkg.maxBranches || 1)
    setPkgBadge(pkg.badge || '')
    setPkgIsPopular(!!pkg.isPopular || !!pkg.isRecommended)
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

    const pkgData = {
      name: pkgName.trim(),
      subtitle: pkgSubtitle.trim(),
      logoUrl: pkgLogoUrl.trim(),
      icon: pkgIcon || 'crown',
      color: pkgColor || '#15B8A6',
      price: Number(pkgPrice) || 0,
      period: pkgPeriod || 'شهري',
      aiResponsesLimit: Number(pkgAiLimit) || 100,
      maxBranches: Number(pkgMaxBranches) || 1,
      badge: pkgBadge.trim(),
      isPopular: pkgIsPopular,
      isRecommended: pkgIsPopular,
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
        system: 'Clinic OS V2 - Single Clinic System (zizo)',
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
        primaryColor: primaryColor || '#15B8A6',
        secondaryColor: secondaryColor || '#2F80ED',
        specialty: specialty || '',
        certificationTitle: certificationTitle || '',
        clinicAddress: clinicAddress || '',

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
      setLogoUrl('')
      setThermalMonoLogoUrl('')
      setPrimaryColor('#15B8A6')
      setSecondaryColor('#2F80ED')
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
    setLogoUrl(c.logoUrl || '')
    setThermalMonoLogoUrl(c.thermalMonoLogoUrl || '')
    setPrimaryColor(c.primaryColor || '#15B8A6')
    setSecondaryColor(c.secondaryColor || '#2F80ED')
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
    setPrimaryColor('#15B8A6')
    setSecondaryColor('#2F80ED')
    setSpecialty('')
    setCertificationTitle('')
    setClinicAddress('')
    setPackageName('الباقة الأساسية')
    setAiResponsesLimit(100)
    setAiResponsesCount(0)
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

  // Filtered doctors list for Doctors Tab
  const filteredDoctors = useMemo(() => {
    if (!doctorsSearchQuery.trim()) return clinics
    const q = doctorsSearchQuery.trim().toLowerCase()
    return clinics.filter(c =>
      (c.doctorName || '').toLowerCase().includes(q) ||
      (c.clinicName || '').toLowerCase().includes(q) ||
      (c.specialty || '').toLowerCase().includes(q) ||
      (c.clinicPhone || '').includes(q) ||
      (c.doctorPhone || '').includes(q) ||
      (c.doctorEmail || '').toLowerCase().includes(q) ||
      (c.slug || '').toLowerCase().includes(q)
    )
  }, [clinics, doctorsSearchQuery])

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
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'clinics'
              ? 'bg-[#0B1F33] text-white shadow-md'
              : 'text-slate-500 hover:text-[#182230] hover:bg-slate-100'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>إدارة العيادات والنظام</span>
        </button>

        <button
          onClick={() => setActiveTab('doctors')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'doctors'
              ? 'bg-teal-600 text-white shadow-md'
              : 'text-slate-500 hover:text-[#182230] hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>حسابات الأطباء والمواعيد</span>
        </button>

        <button
          onClick={() => setActiveTab('packages')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'packages'
              ? 'bg-amber-600 text-white shadow-md'
              : 'text-slate-500 hover:text-[#182230] hover:bg-slate-100'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>التحكم في الباقات والاشتراكات</span>
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
              ? 'bg-[#15B8A6] text-white shadow-md shadow-[#15B8A6]/20'
              : 'text-slate-500 hover:text-[#182230] hover:bg-slate-100'
          }`}
        >
          <Edit className="w-4 h-4" />
          <span>تعديل بيانات العيادة</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'settings'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-slate-500 hover:text-[#182230] hover:bg-slate-100'
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>مفتاح AI المركزي</span>
        </button>

        <button
          onClick={handleExportBackup}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer bg-slate-800 hover:bg-slate-900 text-white shadow-md mr-auto whitespace-nowrap"
        >
          <Download className="w-4 h-4" />
          <span>نسخة احتياطية (JSON)</span>
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
                    <th className="py-4 px-4 text-center">باقة الفروع</th>
                    <th className="py-4 px-4 text-center">حالة الاشتراك</th>
                    <th className="py-4 px-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5EAF0]">
                  {filteredClinics.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
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
                          <td className="py-4 px-4 space-y-2">
                            {/* Official Subdomain Badge with Copy */}
                            <div className="flex items-center justify-between gap-1 bg-teal-50 border border-teal-200 rounded-lg px-2 py-1 text-[11px] font-mono font-bold text-teal-800" dir="ltr">
                              <span className="truncate max-w-[170px]">{c.slug}.yalla-clinic.com</span>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(`https://${c.slug}.yalla-clinic.com`)
                                  toast.success('تم نسخ رابط العيادة المباشر!')
                                }}
                                className="p-0.5 hover:text-teal-950 text-teal-600 rounded transition-colors cursor-pointer shrink-0"
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
                                className="inline-flex items-center gap-1 text-[#15B8A6] font-bold hover:underline"
                                title="فتح صفحة الحجز المباشرة"
                              >
                                <span>الحجز</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                              <span className="text-slate-300">•</span>
                              <a
                                href={`https://${c.slug}.yalla-clinic.com/patient`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[#2F80ED] font-bold hover:underline"
                                title="فتح بوابة المرضى"
                              >
                                <span>المرضى</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                              <span className="text-slate-300">•</span>
                              <a
                                href={`https://${c.slug}.yalla-clinic.com/admin`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-slate-700 font-bold hover:underline"
                                title="فتح لوحة تحكم الطبيب"
                              >
                                <span>اللوحة</span>
                                <ExternalLink className="w-2.5 h-2.5" />
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

                          {/* Multi-Branch Quota */}
                          <td className="py-4 px-4 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                c.branchesEnabled !== false
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : 'bg-slate-100 text-slate-500 border-slate-200'
                              }`}>
                                {c.branchesEnabled !== false ? `مفعلة (${c.maxBranches || 1} فروع)` : 'معطلة (فرع واحد)'}
                              </span>
                              {c.branchCreationAllowed === false && (
                                <span className="text-[9px] text-amber-600 font-bold">إنشاء الفروع مقفل</span>
                              )}
                            </div>
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

      {/* TAB: Doctors Accounts & Schedules */}
      {activeTab === 'doctors' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-4"
        >
          {/* Top Control Bar with Search and Excel Export */}
          <div className="medical-card p-4 bg-white border border-[#E5EAF0] rounded-2xl flex flex-col md:flex-row items-center justify-between gap-3 shadow-2xs">
            <div className="relative w-full md:w-96">
              <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={doctorsSearchQuery}
                onChange={e => setDoctorsSearchQuery(e.target.value)}
                placeholder="ابحث باسم الطبيب، العيادة، التخصص، الهاتف، أو الإيميل..."
                className="pr-10 h-10 text-xs bg-slate-50 rounded-xl border-[#E5EAF0] focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
              <span className="text-xs font-bold text-slate-500">
                إجمالي الأطباء: <strong className="text-[#182230]">{filteredDoctors.length}</strong>
              </span>

              <Button
                onClick={handleExportDoctors}
                className="h-10 px-4 text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md cursor-pointer flex items-center gap-2"
                title="تصدير جدول إكسيل منسق بكافة بيانات الأطباء ومواعيد العمل وحسابات الدخول"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>تصدير إكسيل الأطباء والمواعيد</span>
              </Button>
            </div>
          </div>

          {/* Doctors Table */}
          <div className="medical-card bg-white border border-[#E5EAF0] rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-[#F8FAFC] text-slate-500 font-bold border-b border-[#E5EAF0]">
                  <tr>
                    <th className="py-4 px-4">بيانات الطبيب والعيادة</th>
                    <th className="py-4 px-4">مواعيد العمل الأسبوعية</th>
                    <th className="py-4 px-4">حساب دخول الطبيب (Doctor)</th>
                    <th className="py-4 px-4">حساب المساعد (Assistant)</th>
                    <th className="py-4 px-4 text-center">الباقة والاشتراك</th>
                    <th className="py-4 px-4 text-center">استهلاك ردود AI</th>
                    <th className="py-4 px-4 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5EAF0]">
                  {filteredDoctors.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        {clinics.length === 0 ? 'لا يوجد أطباء مسجلين حتى الآن.' : 'لا توجد نتائج تطابق بحثك.'}
                      </td>
                    </tr>
                  ) : (
                    filteredDoctors.map(c => {
                      const schedule = Array.isArray(c.weeklySchedule) && c.weeklySchedule.length > 0
                        ? c.weeklySchedule.filter((s: any) => s.isOpen !== false)
                        : null
                      const aiUsed = c.aiResponsesCount || 0
                      const aiLimit = c.aiResponsesLimit !== undefined ? c.aiResponsesLimit : 100
                      const aiExceeded = aiUsed >= aiLimit
                      const isPasswordVisible = !!showPasswords[c.id]

                      return (
                        <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                          {/* Doctor & Clinic Details */}
                          <td className="py-4 px-4 min-w-[200px]">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center font-black text-teal-700 text-xs shrink-0">
                                  {c.doctorName ? c.doctorName.charAt(0) : 'ط'}
                                </div>
                                <div>
                                  <h4 className="font-black text-sm text-[#182230]">
                                    {c.doctorName ? `د. ${c.doctorName}` : 'طبيب العيادة'}
                                  </h4>
                                  <p className="text-[11px] font-bold text-teal-700">{c.clinicName}</p>
                                </div>
                              </div>
                              <p className="text-[10px] text-slate-500 font-medium">
                                {c.specialty || 'تخصص عام'} {c.certificationTitle ? `• ${c.certificationTitle}` : ''}
                              </p>
                              {c.clinicAddress && (
                                <p className="text-[10px] text-slate-400 flex items-center gap-1">
                                  <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span className="truncate max-w-[220px]">{c.clinicAddress}</span>
                                </p>
                              )}
                              <div className="flex items-center gap-2 pt-1 font-mono text-[10px] text-slate-500" dir="ltr">
                                <span>هاتف: {c.clinicPhone || '—'}</span>
                                {c.doctorPhone && <span>• شخصي: {c.doctorPhone}</span>}
                              </div>
                            </div>
                          </td>

                          {/* Working Schedule */}
                          <td className="py-4 px-4 min-w-[220px]">
                            <div className="space-y-1">
                              {schedule && schedule.length > 0 ? (
                                <div className="flex flex-wrap gap-1 max-w-xs">
                                  {schedule.map((s: any, idx: number) => (
                                    <span
                                      key={idx}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-teal-50 text-teal-800 border border-teal-200 text-[10px] font-bold font-mono"
                                    >
                                      <span>{s.day}:</span>
                                      <span dir="ltr">{s.start} - {s.end}</span>
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-[11px] text-slate-500 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200 inline-block font-medium">
                                  السبت - الخميس: 05:00 م - 10:00 م (افتراضي)
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Doctor Login */}
                          <td className="py-4 px-4 min-w-[200px]">
                            <div className="space-y-1.5 p-2 rounded-xl bg-slate-50 border border-slate-200">
                              <div className="flex items-center justify-between gap-1 text-[11px]">
                                <span className="text-slate-400 font-bold">الإيميل:</span>
                                <span className="font-mono text-slate-700 font-medium truncate max-w-[130px]" dir="ltr">
                                  {c.doctorEmail || 'doctor@clinic.com'}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-1 text-[11px] pt-1 border-t border-slate-200">
                                <span className="text-slate-400 font-bold">المرور:</span>
                                <div className="flex items-center gap-1">
                                  <span className="font-mono font-bold text-slate-800" dir="ltr">
                                    {isPasswordVisible ? (c.doctorPassword || '123456') : '••••••••'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setShowPasswords(p => ({ ...p, [c.id]: !p[c.id] }))}
                                    className="p-1 hover:text-teal-700 text-slate-400 cursor-pointer"
                                    title={isPasswordVisible ? 'إخفاء' : 'إظهار'}
                                  >
                                    {isPasswordVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(c.doctorPassword || '123456')
                                      toast.success('تم نسخ كلمة مرور الطبيب!')
                                    }}
                                    className="p-1 hover:text-teal-700 text-slate-400 cursor-pointer"
                                    title="نسخ كلمة المرور"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Assistant Login */}
                          <td className="py-4 px-4 min-w-[200px]">
                            <div className="space-y-1.5 p-2 rounded-xl bg-slate-50 border border-slate-200">
                              <div className="flex items-center justify-between gap-1 text-[11px]">
                                <span className="text-slate-400 font-bold">الإيميل:</span>
                                <span className="font-mono text-slate-700 font-medium truncate max-w-[130px]" dir="ltr">
                                  {c.assistantEmail || 'assistant@clinic.com'}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-1 text-[11px] pt-1 border-t border-slate-200">
                                <span className="text-slate-400 font-bold">المرور:</span>
                                <div className="flex items-center gap-1">
                                  <span className="font-mono font-bold text-slate-800" dir="ltr">
                                    {isPasswordVisible ? (c.assistantPassword || '123456') : '••••••••'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(c.assistantPassword || '123456')
                                      toast.success('تم نسخ كلمة مرور المساعد!')
                                    }}
                                    className="p-1 hover:text-teal-700 text-slate-400 cursor-pointer"
                                    title="نسخ كلمة المرور"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Package & Subscription */}
                          <td className="py-4 px-4 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-1">
                                <Crown className="w-3 h-3 text-amber-600" />
                                <span>{c.packageName || 'الباقة الأساسية'}</span>
                              </span>
                              <span className="text-[10px] font-mono text-slate-400">
                                {c.expirationDate ? `ينتهي: ${c.expirationDate}` : 'اشتراك مفتوح'}
                              </span>
                              <span className={`text-[9px] font-bold ${c.isActive !== false ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {c.isActive !== false ? '● حساب نشط' : '○ موقوف'}
                              </span>
                            </div>
                          </td>

                          {/* AI Response Quota */}
                          <td className="py-4 px-4 text-center min-w-[150px]">
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-[10px] font-mono font-bold">
                                <span className={aiExceeded ? 'text-rose-600' : 'text-purple-700'}>
                                  {aiUsed} / {aiLimit}
                                </span>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                                  aiExceeded ? 'bg-rose-100 text-rose-700 font-black' : 'bg-purple-100 text-purple-700'
                                }`}>
                                  {aiExceeded ? 'تجاوز الحد (معطل)' : `${Math.round((aiUsed / Math.max(1, aiLimit)) * 100)}%`}
                                </span>
                              </div>
                              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all ${aiExceeded ? 'bg-rose-500' : 'bg-purple-600'}`}
                                  style={{ width: `${Math.min(100, Math.round((aiUsed / Math.max(1, aiLimit)) * 100))}%` }}
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => handleResetAiCount(c.id)}
                                className="text-[9px] text-teal-600 hover:text-teal-800 hover:underline font-bold cursor-pointer"
                              >
                                تصفير العداد
                              </button>
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-4 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEdit(c)}
                                className="h-8 px-2.5 text-xs font-bold text-blue-600 border-blue-200 hover:bg-blue-50 rounded-xl"
                                title="تعديل العيادة"
                              >
                                <Edit className="w-3.5 h-3.5 ml-1" />
                                تعديل
                              </Button>
                              <a
                                href={`https://${c.slug}.yalla-clinic.com/admin`}
                                target="_blank"
                                rel="noreferrer"
                                className="h-8 px-2.5 inline-flex items-center gap-1 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold"
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
          <div className="medical-card p-6 bg-white border border-[#E5EAF0] rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
            <div>
              <h2 className="text-xl font-black text-[#182230] flex items-center gap-2">
                <Package className="w-6 h-6 text-amber-600" />
                التحكم في باقات واشتراكات المنصة
              </h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                أنشئ وعدل باقات الاشتراك مع تحديد عدد الفروع وحدود ردود المساعد الذكي AI. تظهر هذه الباقات تلقائياً للأطباء في لوحة العيادة تحت خانة «ترقية حسابك / الباقات».
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

          {/* Packages Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {packages.map(pkg => {
              const isPop = pkg.isPopular || pkg.isRecommended
              return (
                <div
                  key={pkg.id}
                  className={`medical-card relative bg-white border rounded-3xl p-6 flex flex-col justify-between transition-all hover:shadow-xl ${
                    isPop
                      ? 'border-[#15B8A6] shadow-lg ring-2 ring-[#15B8A6]/20'
                      : 'border-[#E5EAF0] shadow-sm'
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

                    <div className="flex items-baseline gap-1 my-3 py-2 px-3 rounded-2xl bg-slate-50 border border-slate-100" dir="rtl">
                      <span className="text-3xl font-black text-slate-900 font-mono">{pkg.price}</span>
                      <span className="text-xs font-bold text-slate-500">ج.م / {pkg.period || 'شهري'}</span>
                    </div>

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
                          <Upload className="w-4 h-4 text-[#15B8A6]" />
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
                                ? 'bg-white border-[#15B8A6] ring-2 ring-[#15B8A6]/20 shadow-xs'
                                : 'bg-white/60 border-slate-200 hover:bg-white text-slate-600'
                            }`}
                            title={ic.label}
                          >
                            <Icon className={`w-4 h-4 ${isSelected ? 'text-[#15B8A6]' : 'text-slate-500'}`} />
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

                {/* 4. Pricing & Limits */}
                <div className="grid sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">السعر (ج.م) *</Label>
                    <Input
                      type="number"
                      min="0"
                      value={pkgPrice}
                      onChange={e => setPkgPrice(e.target.value)}
                      required
                      className="h-10 text-xs font-mono font-bold rounded-xl bg-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">دورة الفوترة *</Label>
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

                {/* 5. Features Customization */}
                <div className="space-y-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <h4 className="text-xs font-black text-slate-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>تخصيص مميزات الباقة</span>
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
                      className="w-full text-xs rounded-xl border border-slate-200 p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#15B8A6]/20 focus:border-[#15B8A6]"
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
                    <Label className="text-xs font-bold text-slate-600 flex items-center justify-between">
                      <span>رابط العيادة الخاص (Subdomain) *</span>
                      <span className="text-[10px] text-teal-600 font-mono" dir="ltr">.yalla-clinic.com</span>
                    </Label>
                    <div className="flex items-center rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs focus-within:border-[#15B8A6] focus-within:ring-2 focus-within:ring-[#15B8A6]/20" dir="ltr">
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
                      <span className="px-2.5 text-xs font-bold text-teal-700 select-none bg-teal-50 border-l border-teal-200 py-2">
                        .yalla-clinic.com
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-sans">
                      الرابط المباشر للعيادة: <strong className="text-teal-700 font-mono" dir="ltr">https://{slug || 'اسم-الدكتور'}.yalla-clinic.com</strong>
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
                  <Building className="w-4 h-4 text-[#15B8A6]" />
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
                  <Sparkles className="w-4 h-4 text-[#15B8A6]" />
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
)}

              {/* Section 5: Subscription & Active Status */}
              <div className="space-y-3">
                <h3 className="text-xs font-black text-slate-700 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#15B8A6]" />
                  مدة الاشتراك وباقة العيادة
                </h3>
                <div className="grid md:grid-cols-4 gap-4 items-center bg-teal-50/40 p-4 rounded-2xl border border-teal-100">
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
                        }
                      }}
                      className="h-10 text-xs font-bold rounded-xl bg-white border border-slate-200 px-3 w-full focus:outline-none focus:ring-2 focus:ring-[#15B8A6]/20 focus:border-[#15B8A6] cursor-pointer"
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
                    <Input value={num.phone} onChange={e => {
                      const newNums = [...supportNumbers];
                      newNums[idx].phone = e.target.value;
                      setSupportNumbers(newNums);
                    }} className="h-10 text-xs font-mono text-right rounded-xl bg-white" dir="ltr" />
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
              <Button variant="outline" onClick={() => setSupportNumbers([...supportNumbers, {phone: '', label: '', isActive: true}])} className="w-full border-dashed h-12 text-xs font-bold text-[#15B8A6] border-teal-200 hover:bg-teal-50">
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

      {/* Platform Owner Footer */}
      <footer className="mt-12 pt-6 border-t border-[#E5EAF0] text-center text-xs text-slate-400 font-medium">
        جميع الحقوق محفوظة © {new Date().getFullYear()} Clinic OS
      </footer>

    </div>
  )
}
