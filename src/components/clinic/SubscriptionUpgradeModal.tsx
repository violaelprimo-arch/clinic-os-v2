'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Sparkles,
  CheckCircle2,
  Bot,
  Building,
  Calendar,
  MessageSquare,
  ShieldCheck,
  Zap,
  Clock,
  ArrowRight,
  Crown,
  Gem,
  Rocket,
  Stethoscope,
  Building2,
  Star,
  Award,
  Check
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { openManualWhatsAppChat } from '@/lib/whatsappShare'
import { useLanguage } from '@/context/LanguageContext'
import { isClinicFeatureEnabled } from '@/lib/featurePermissions'

export interface PackageItem {
  id?: string
  name: string
  subtitle?: string
  code?: string
  category?: 'monthly' | '3_months' | '6_months' | 'annual' | 'yearly' | string
  price: number | string
  priceMonthly?: number | string
  price6Months?: number | string
  priceYearly?: number | string
  originalPrice?: number | string
  discountBadge?: string
  period?: string
  aiResponsesLimit?: number
  maxBranches?: number
  features?: string[]
  isPopular?: boolean
  isRecommended?: boolean
  badge?: string
  color?: string
  allowAi?: boolean
  allowBranches?: boolean
  allowFinance?: boolean
  allowDrugs?: boolean
  allowPrescriptions?: boolean
  allowOnlineBooking?: boolean
  logoUrl?: string
  icon?: string
}

interface SubscriptionUpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  clinic: any
  packages?: PackageItem[]
  supportPhone?: string
}

function renderPackageLogo(pkg: PackageItem) {
  if (pkg.logoUrl) {
    return (
      <div className="w-12 h-12 rounded-2xl bg-white/80 dark:bg-white/10 border border-slate-200/80 dark:border-white/10 p-1.5 flex items-center justify-center mx-auto mb-2.5 shadow-sm">
        <img src={pkg.logoUrl} alt={pkg.name} className="w-full h-full object-contain" />
      </div>
    )
  }

  const iconName = (pkg.icon || '').toLowerCase()
  let IconComp = Crown
  if (iconName === 'sparkles') IconComp = Sparkles
  else if (iconName === 'zap') IconComp = Zap
  else if (iconName === 'gem' || iconName === 'diamond') IconComp = Gem
  else if (iconName === 'rocket') IconComp = Rocket
  else if (iconName === 'shield' || iconName === 'shieldcheck') IconComp = ShieldCheck
  else if (iconName === 'stethoscope') IconComp = Stethoscope
  else if (iconName === 'building' || iconName === 'building2') IconComp = Building2
  else if (iconName === 'star') IconComp = Star
  else if (iconName === 'award') IconComp = Award

  const color = pkg.color || (pkg.isPopular || pkg.isRecommended ? '#087CF4' : '#64748B')

  return (
    <div
      className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-2.5 text-white shadow-md transition-transform group-hover:scale-105"
      style={{ backgroundColor: color }}
    >
      <IconComp className="w-6 h-6" />
    </div>
  )
}

const DEFAULT_PACKAGES: PackageItem[] = [
  {
    name: 'الباقة الأساسية',
    subtitle: 'انطلاقة مثالية للعيادات الفردية',
    code: 'basic',
    category: 'monthly',
    icon: 'stethoscope',
    color: '#0284C7',
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
    ]
  },
  {
    name: 'باقة الـ 3 شهور (Quarterly)',
    subtitle: 'الاشتراك الفصلي المثالي مع وفر 15%',
    code: 'quarterly',
    category: '3_months',
    icon: 'zap',
    color: '#06B6D4',
    price: 1200,
    originalPrice: 1350,
    discountBadge: 'وفر 150 ج.م 🔥',
    period: '3 شهور',
    aiResponsesLimit: 350,
    maxBranches: 2,
    isPopular: false,
    badge: 'خطة 3 شهور',
    features: [
      'جميع مميزات الباقة الأساسية',
      'صلاحية 3 شهور متواصلة للعيادة',
      '350 رد فصلي للمساعد الذكي AI',
      'حتى فرعين طبيين متكاملين',
      'تقارير دورية شاملة للإيرادات'
    ]
  },
  {
    name: 'باقة الـ 6 شهور (Semi-Annual)',
    subtitle: 'الخيار نصف السنوي الأكثر توفيراً واستقراراً',
    code: 'semi_annual',
    category: '6_months',
    icon: 'gem',
    color: '#8B5CF6',
    price: 2400,
    originalPrice: 2700,
    discountBadge: 'وفر 300 ج.م 🔥',
    period: '6 شهور',
    aiResponsesLimit: 800,
    maxBranches: 3,
    isPopular: false,
    badge: 'خطة 6 شهور 💎',
    features: [
      'جميع مميزات الباقة الاحترافية لنصف عام',
      '800 رد للمساعد الذكي AI',
      'حتى 3 فروع طبية متكاملة',
      'قالب روشتة مخصص بهوية العيادة',
      'تنبيهات تلقائية عبر واتساب',
      'أولوية في الدعم الفني والتحديثات'
    ]
  },
  {
    name: 'الباقة الاحترافية',
    subtitle: 'الخيار الأكثر ترشيحاً لعيادات النخبة',
    code: 'pro',
    category: 'monthly',
    icon: 'crown',
    color: '#087CF4',
    price: 950,
    originalPrice: 1200,
    discountBadge: 'وفر 250 ج.م 🔥',
    period: 'شهري',
    aiResponsesLimit: 500,
    maxBranches: 3,
    isPopular: true,
    isRecommended: true,
    badge: 'الأكثر طلباً وموصى بها 🔥',
    features: [
      'جميع مميزات الباقة الأساسية',
      'حتى 3 فروع طبية متكاملة',
      '500 رد شهري للمساعد الذكي AI',
      'قالب روشتة مخصص بهوية العيادة الفاخرة',
      'تنبيهات تلقائية للمرضى قبل موعد الكشف',
      'تقارير مالية وتصدير إكسيل متقدم',
      'دعم فني مخصص وأولوية في التحديثات'
    ]
  },
  {
    name: 'الباقة الماسية (VIP)',
    subtitle: 'حل شامل للمراكز الطبية الكبرى والمستشفيات',
    code: 'vip',
    category: 'monthly',
    icon: 'gem',
    color: '#8B5CF6',
    price: 1800,
    originalPrice: 2200,
    discountBadge: 'وفر 400 ج.م 💎',
    period: 'شهري',
    aiResponsesLimit: 2500,
    maxBranches: 10,
    isPopular: false,
    badge: 'المراكز الطبية الكبرى 💎',
    features: [
      'جميع مميزات الباقة الاحترافية',
      'فروع طبية غير محدودة',
      '2,500 رد شهري للمساعد الذكي AI',
      'ربط نطاق خاص فرعي باسم الدكتور',
      'تدريب مخصص للذكاء الاصطناعي على كافة التخصصات',
      'نسخ احتياطي يومي سحابي فوري',
      'دعم فني خاص على مدار 24/7'
    ]
  },
  {
    name: 'الباقة السنوية الشاملة',
    subtitle: 'وفر شهرين مجاناً مع خطة السداد السنوي للعيادة',
    code: 'annual_pro',
    category: 'yearly',
    icon: 'award',
    color: '#059669',
    price: 9500,
    originalPrice: 11400,
    discountBadge: 'وفر 1,900 ج.م (شهرين مجاناً 🎁)',
    period: 'سنوي',
    aiResponsesLimit: 1200,
    maxBranches: 5,
    isPopular: false,
    badge: 'أفضل توفير سنوي 🌟',
    features: [
      'جميع مميزات الباقة الاحترافية لعام كامل',
      'اشتراك 12 شهر بسعر 10 شهور فقط',
      'حتى 5 فروع طبية متكاملة',
      '1,200 رد شهري للمساعد الذكي AI',
      'دومين ونطاق خاص مجاني بالكامل',
      'أولوية مطلقة في الدعم الفني والتحديثات'
    ]
  }
]

export function SubscriptionUpgradeModal({
  isOpen,
  onClose,
  clinic,
  packages = [],
  supportPhone = '01551007018'
}: SubscriptionUpgradeModalProps) {
  const { t, isRtl, dir } = useLanguage()
  const [activeCycle, setActiveCycle] = useState<'monthly' | '6_months' | 'yearly'>('monthly')
  const activePackages = packages && packages.length > 0 ? packages : DEFAULT_PACKAGES

  // Expiration Days Calculation
  const now = new Date()
  let daysLeft = 0
  let isExpired = false
  if (clinic?.expirationDate) {
    const exp = new Date(clinic.expirationDate)
    daysLeft = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (daysLeft < 0) isExpired = true
  }

  // Strict AI Feature Gating Check for Clinic
  const isClinicAiEnabled = isClinicFeatureEnabled(clinic, 'ai')
  const aiLimit = isClinicAiEnabled ? Number(clinic?.aiResponsesLimit ?? 100) : 0
  const aiCount = Number(clinic?.aiResponsesCount ?? 0)
  const aiPercent = isClinicAiEnabled && aiLimit > 0 ? Math.min(100, Math.round((aiCount / aiLimit) * 100)) : 0

  // Helper to normalize clinic package name
  const currentClinicPkgName = (clinic?.packageName || '').trim().toLowerCase()

  // Packages list (showing all packages with dynamic 3-cycle price)
  const filteredPackages = activePackages

  const handleRequestUpgrade = (pkg: PackageItem) => {
    const monthly = Number(pkg.priceMonthly || pkg.price) || 0
    const sixMonths = Number(pkg.price6Months) || Math.round(monthly * 6 * 0.9)
    const yearly = Number(pkg.priceYearly) || Math.round(monthly * 10)

    const activePrice = activeCycle === 'yearly'
      ? yearly
      : activeCycle === '6_months'
      ? sixMonths
      : monthly

    const cycleNameAr = activeCycle === 'yearly' ? 'سنوي (12 شهر - وفر شهرين 🎁)' : activeCycle === '6_months' ? 'نصف سنوي (6 شهور - وفر 10% 🔥)' : 'شهري'
    const cycleNameEn = activeCycle === 'yearly' ? 'Annual (12 Months)' : activeCycle === '6_months' ? 'Semi-Annual (6 Months)' : 'Monthly'

    const msg = isRtl
      ? `مرحباً، أرغب في ترقية / تجديد اشتراك عيادتي عبر منصة Yalla Clinic:
- العيادة: ${clinic?.clinicName || 'العيادة الطبية'}
- الطبيب: د. ${clinic?.doctorName || ''}
- الباقة المطلوبة: ${pkg.name}
- خطة الفوترة: ${cycleNameAr}
- السعر: ${activePrice.toLocaleString()} ج.م
- كود العيادة (Slug): ${clinic?.slug || ''}

يرجى تزويدي بطرق الدفع الإلكتروني المتاحة (انستا باي / فودافون كاش / بنك) لتأكيد التفعيل فوراً. شكراً!`
      : `Hello, I would like to upgrade / renew my clinic subscription on Yalla Clinic:
- Clinic: ${clinic?.clinicName || 'Clinic'}
- Doctor: Dr. ${clinic?.doctorName || ''}
- Selected Package: ${pkg.name}
- Billing Cycle: ${cycleNameEn}
- Price: ${activePrice.toLocaleString()} EGP
- Clinic Slug: ${clinic?.slug || ''}

Please provide available payment methods to confirm activation. Thank you!`

    openManualWhatsAppChat({
      phone: supportPhone,
      message: msg
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      {/* Expanded Dialog Width with sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl to guarantee wide, spacious rendering */}
      <DialogContent
        className="w-[96vw] sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[92vh] overflow-y-auto p-5 sm:p-8 bg-card/90 backdrop-blur-2xl text-card-foreground rounded-3xl border border-border/80 shadow-2xl relative overflow-hidden"
        dir={dir}
      >
        {/* Animated Moving Ambient Glow Orbs (خلفية متحركة فائقة الجمال) */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
          <motion.div
            animate={{
              x: [0, 80, -40, 0],
              y: [0, -60, 40, 0],
              scale: [1, 1.25, 0.9, 1],
              opacity: [0.25, 0.45, 0.3, 0.25]
            }}
            transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-gradient-to-br from-cyan-500/35 to-blue-600/30 blur-3xl"
          />
          <motion.div
            animate={{
              x: [0, -70, 50, 0],
              y: [0, 50, -40, 0],
              scale: [1, 1.2, 0.85, 1],
              opacity: [0.2, 0.4, 0.25, 0.2]
            }}
            transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
            className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-gradient-to-tr from-purple-600/35 to-pink-500/25 blur-3xl"
          />
          <motion.div
            animate={{
              x: [0, 60, -50, 0],
              y: [0, -40, 60, 0],
              scale: [0.9, 1.15, 1, 0.9],
              opacity: [0.15, 0.3, 0.2, 0.15]
            }}
            transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
            className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-gradient-to-r from-emerald-500/25 to-teal-500/25 blur-3xl"
          />
          <div className="absolute inset-0 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.08] dark:opacity-[0.14]" />
        </div>
        <DialogHeader className={`${isRtl ? 'text-right' : 'text-left'} space-y-1.5 pb-4 border-b border-border`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 via-primary to-cyan-400 text-white flex items-center justify-center shadow-lg shadow-primary/25">
                <Crown className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                  {isRtl ? 'باقات الاشتراك وترقية العيادة' : 'Clinic Subscription & Upgrade Packages'}
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm text-muted-foreground font-medium">
                  {isRtl ? 'اختر الخطة والمدة المناسبة لتطوير عيادتك وزيادة رصيد الذكاء الاصطناعي والفروع' : 'Select the best plan & cycle to empower your clinic, AI quota, and branches'}
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Current Subscription Status Bar */}
        <div className="my-3 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-[#0A1B33] to-[#081226] text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl border border-white/10">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-300 font-bold">
                {isRtl ? 'الباقة الحالية:' : 'Current Plan:'}
              </span>
              <Badge className="bg-emerald-500 text-white font-black text-xs px-3 py-1 shadow-sm flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{clinic?.packageName || (isRtl ? 'الباقة الأساسية' : 'Standard Plan')}</span>
              </Badge>
              {isExpired ? (
                <Badge variant="destructive" className="font-bold text-xs px-2.5 py-0.5">
                  {isRtl ? 'منتهي الصلاحية' : 'Expired'}
                </Badge>
              ) : (
                <Badge className="bg-amber-400 text-slate-900 font-black text-xs px-2.5 py-0.5 shadow-sm">
                  {isRtl ? `متبقي ${daysLeft} يوم` : `${daysLeft} days remaining`}
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              {isRtl ? 'تاريخ انتهاء الاشتراك الحالي: ' : 'Current expiry date: '}{' '}
              <span className="text-white font-mono font-bold" dir="ltr">{clinic?.expirationDate || (isRtl ? 'غير محدد' : 'Unspecified')}</span>
            </p>
          </div>

          {/* AI Quota Meter / Disabled Indicator */}
          {isClinicAiEnabled ? (
            <div className="w-full md:w-72 bg-[#0E2342]/90 p-3.5 rounded-2xl border border-white/10 space-y-1.5 shadow-inner">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-bold flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-cyan-400" />
                  {isRtl ? 'استهلاك الذكاء الاصطناعي:' : 'AI Usage:'}
                </span>
                <span className="font-mono font-bold text-cyan-300 text-[11px]" dir="ltr">
                  {aiCount} / {aiLimit}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    aiPercent >= 100
                      ? 'bg-rose-500'
                      : aiPercent >= 80
                      ? 'bg-amber-400'
                      : 'bg-primary'
                  }`}
                  style={{ width: `${aiPercent}%` }}
                />
              </div>
              {aiCount >= aiLimit && (
                <span className="text-[10px] text-rose-300 font-bold block">
                  {isRtl ? '⚠️ انتهى رصيد الردود! المساعد معطل حالياً.' : '⚠️ Quota reached! AI assistant paused.'}
                </span>
              )}
            </div>
          ) : (
            <div className="w-full md:w-80 bg-gradient-to-br from-rose-950/40 via-[#0A1B33] to-[#081226] p-3.5 rounded-2xl border border-rose-500/30 space-y-1 shadow-inner">
              <div className="flex items-center justify-between text-xs">
                <span className="text-rose-300 font-bold flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-rose-400" />
                  {isRtl ? 'المساعد الذكي AI:' : 'AI Assistant:'}
                </span>
                <span className="text-[10px] font-black text-rose-300 bg-rose-500/20 border border-rose-500/40 px-2.5 py-0.5 rounded-full">
                  {isRtl ? '🚫 معطل في باقتك' : '🚫 Disabled in plan'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                {isRtl
                  ? 'باقتك الحالية لا تتضمن ميزة المساعد الذكي. يمكنك ترقية الباقة لتفعيله.'
                  : 'Your current plan does not include the AI assistant. Upgrade to activate.'}
              </p>
            </div>
          )}
        </div>

        {/* Billing Cycle 3-Plan Switcher (شهري - 6 شهور - سنوي) */}
        <div className="flex items-center justify-center my-4 overflow-x-auto pb-1">
          <div className="p-1 rounded-2xl bg-secondary/80 dark:bg-card-elevated border border-border flex items-center gap-1 shadow-inner">
            <button
              type="button"
              onClick={() => setActiveCycle('monthly')}
              className={`relative px-5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeCycle === 'monthly'
                  ? 'text-teal-950 dark:text-teal-200 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {activeCycle === 'monthly' && (
                <motion.div
                  layoutId="clinicActiveCyclePill"
                  className="absolute inset-0 bg-white dark:bg-teal-950 border border-teal-200 dark:border-teal-700 rounded-xl shadow-sm -z-10"
                  transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                />
              )}
              <span>🗓️ {isRtl ? 'شهرياً' : 'Monthly'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveCycle('6_months')}
              className={`relative px-5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeCycle === '6_months'
                  ? 'text-purple-950 dark:text-purple-200 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {activeCycle === '6_months' && (
                <motion.div
                  layoutId="clinicActiveCyclePill"
                  className="absolute inset-0 bg-white dark:bg-purple-950 border border-purple-200 dark:border-purple-700 rounded-xl shadow-sm -z-10"
                  transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                />
              )}
              <span>📦 {isRtl ? '6 شهور' : '6 Months'}</span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300">
                {isRtl ? 'وفر 10% 🔥' : 'Save 10%'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveCycle('yearly')}
              className={`relative px-5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeCycle === 'yearly'
                  ? 'text-amber-950 dark:text-amber-200 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {activeCycle === 'yearly' && (
                <motion.div
                  layoutId="clinicActiveCyclePill"
                  className="absolute inset-0 bg-white dark:bg-amber-950 border border-amber-200 dark:border-amber-700 rounded-xl shadow-sm -z-10"
                  transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                />
              )}
              <span>👑 {isRtl ? 'سنوياً' : 'Annual'}</span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-400 text-slate-900 shadow-2xs">
                {isRtl ? 'وفر شهرين مجاناً 🎁' : 'Save 2 Mo'}
              </span>
            </button>
          </div>
        </div>

        {/* Available Packages Grid (Apple Glassmorphism Layout with Motion) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
          {filteredPackages.map((pkg, idx) => {
            const isPop = pkg.isPopular || pkg.isRecommended
            const monthly = Number(pkg.priceMonthly || pkg.price) || 0
            const sixMonths = Number(pkg.price6Months) || Math.round(monthly * 6 * 0.9)
            const yearly = Number(pkg.priceYearly) || Math.round(monthly * 10)

            const activePrice = activeCycle === 'yearly'
              ? yearly
              : activeCycle === '6_months'
              ? sixMonths
              : monthly

            const cycleLabel = activeCycle === 'yearly'
              ? (isRtl ? 'سنوياً' : 'yearly')
              : activeCycle === '6_months'
              ? (isRtl ? 'لكل 6 شهور' : 'for 6 mo')
              : (isRtl ? 'شهرياً' : 'monthly')

            const equivalentMonthly = activeCycle === 'yearly'
              ? Math.round(yearly / 12)
              : activeCycle === '6_months'
              ? Math.round(sixMonths / 6)
              : monthly

            // Exact Active Package Detection
            const pkgNameNormalized = (pkg.name || '').trim().toLowerCase()
            const cleanStr = (s: string) => s.replace(/^(الباقة|باقة)\s+/, '').trim().toLowerCase()
            const isCurrentPlan = currentClinicPkgName !== '' && (
              pkgNameNormalized === currentClinicPkgName ||
              cleanStr(pkgNameNormalized) === cleanStr(currentClinicPkgName) ||
              (pkg.code && clinic?.packageCode && pkg.code.toLowerCase() === String(clinic.packageCode).toLowerCase())
            )

            return (
              <motion.div
                key={pkg.id || idx}
                whileHover={{ y: -6, scale: 1.01 }}
                transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                className={`rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 relative border group ${
                  isCurrentPlan
                    ? 'bg-gradient-to-b from-emerald-500/10 via-card to-card border-emerald-500/80 shadow-xl shadow-emerald-500/15 ring-2 ring-emerald-500/40'
                    : isPop
                    ? 'bg-gradient-to-b from-primary/10 via-card to-card border-primary shadow-xl shadow-primary/20 ring-2 ring-primary/40'
                    : 'bg-card border-border hover:border-primary/40 hover:shadow-lg'
                }`}
              >
                {/* Active Plan or Popular Badge on Top */}
                {isCurrentPlan ? (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap">
                    <span className="px-3.5 py-1 rounded-full text-xs font-black shadow-md flex items-center gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white ring-2 ring-background">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{isRtl ? 'باقتك الحالية (نشطة)' : 'Current Active Plan'}</span>
                    </span>
                  </div>
                ) : (pkg.badge && pkg.badge.trim()) ? (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap">
                    <span className={`px-3.5 py-1 rounded-full text-[11px] font-black shadow-md flex items-center gap-1.5 ${
                      isPop
                        ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-primary text-white ring-2 ring-background'
                        : 'bg-slate-800 text-white'
                    }`}>
                      {isPop && <Sparkles className="w-3.5 h-3.5 text-amber-200" />}
                      <span>{pkg.badge.trim()}</span>
                    </span>
                  </div>
                ) : null}

                <div>
                  {/* Header: Logo, Name, Subtitle */}
                  <div className="pt-2 text-center border-b border-border pb-4">
                    {renderPackageLogo(pkg)}
                    <h4 className="text-lg font-black text-foreground">{pkg.name}</h4>
                    {pkg.subtitle && (
                      <p className="text-[11px] text-muted-foreground font-medium mt-1 leading-normal max-w-xs mx-auto">
                        {pkg.subtitle}
                      </p>
                    )}

                    {/* Dynamic Pricing Box with Smooth Motion Flip */}
                    <div className="mt-4 p-4 rounded-2xl bg-secondary/60 dark:bg-card-elevated/90 border border-border/80 backdrop-blur-md space-y-1.5 shadow-inner">
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={`${pkg.id || idx}-${activeCycle}`}
                          initial={{ opacity: 0, y: 8, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -8, scale: 0.96 }}
                          transition={{ duration: 0.2 }}
                          className="flex items-baseline justify-center gap-1.5"
                        >
                          <span className="text-3xl sm:text-4xl font-black text-primary font-mono tracking-tight drop-shadow-xs">
                            {activePrice.toLocaleString()}
                          </span>
                          <span className="text-xs font-bold text-muted-foreground">
                            {isRtl ? 'ج.م' : 'EGP'} / {cycleLabel}
                          </span>
                        </motion.div>
                      </AnimatePresence>
                      {activeCycle !== 'monthly' && (
                        <span className="inline-block text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                          ({isRtl ? `يعادل ${equivalentMonthly.toLocaleString()} ج.م شهرياً` : `${equivalentMonthly.toLocaleString()} EGP/month`})
                        </span>
                      )}

                      {/* 3 Comparative Prices Pills */}
                      <div className="pt-2 mt-2 border-t border-border grid grid-cols-3 gap-1 text-[9px] text-center">
                        <div className={`p-1 rounded-lg border ${
                          activeCycle === 'monthly' ? 'bg-teal-50 dark:bg-teal-950 border-teal-300 font-bold text-teal-800 dark:text-teal-200' : 'bg-background/80 border-border text-muted-foreground'
                        }`}>
                          <span className="block opacity-75">🗓️ {isRtl ? 'شهري' : 'Mo'}</span>
                          <span className="font-mono font-bold">{monthly.toLocaleString()}</span>
                        </div>
                        <div className={`p-1 rounded-lg border ${
                          activeCycle === '6_months' ? 'bg-purple-50 dark:bg-purple-950 border-purple-300 font-bold text-purple-800 dark:text-purple-200' : 'bg-background/80 border-border text-muted-foreground'
                        }`}>
                          <span className="block opacity-75">📦 {isRtl ? '6 شهور' : '6 Mo'}</span>
                          <span className="font-mono font-bold">{sixMonths.toLocaleString()}</span>
                        </div>
                        <div className={`p-1 rounded-lg border ${
                          activeCycle === 'yearly' ? 'bg-amber-50 dark:bg-amber-950 border-amber-300 font-bold text-amber-800 dark:text-amber-200' : 'bg-background/80 border-border text-muted-foreground'
                        }`}>
                          <span className="block opacity-75">👑 {isRtl ? 'سنوي' : 'Yr'}</span>
                          <span className="font-mono font-bold">{yearly.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Highlights Specs: AI + Branches with Strict Feature Gating */}
                  <div className="py-3 space-y-2 border-b border-border/80 text-xs">
                    <div className="flex items-center justify-between text-muted-foreground font-bold">
                      <span className="flex items-center gap-1.5">
                        <Bot className="w-4 h-4 text-purple-500" />
                        {isRtl ? 'ردود المساعد الذكي AI:' : 'AI Responses:'}
                      </span>
                      {pkg.allowAi === false ? (
                        <span className="text-rose-600 dark:text-rose-400 font-black text-xs flex items-center gap-1">
                          <span>🚫</span>
                          <span>{isRtl ? 'معطل تماماً' : 'Disabled'}</span>
                        </span>
                      ) : (
                        <span className="text-purple-600 dark:text-purple-400 font-black font-mono">
                          {pkg.aiResponsesLimit ? `${Number(pkg.aiResponsesLimit).toLocaleString()} ${isRtl ? 'رد' : 'replies'}` : (isRtl ? 'غير محدود' : 'Unlimited')}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-muted-foreground font-bold">
                      <span className="flex items-center gap-1.5">
                        <Building className="w-4 h-4 text-primary" />
                        {isRtl ? 'الفروع المسموح بها:' : 'Allowed Branches:'}
                      </span>
                      <span className="text-primary font-black font-mono">
                        {pkg.allowBranches === false || Number(pkg.maxBranches) <= 1
                          ? (isRtl ? 'فرع رئيسي فقط' : '1 Main Branch')
                          : `${pkg.maxBranches} ${isRtl ? 'فروع' : 'Branches'}`}
                      </span>
                    </div>
                  </div>

                  {/* Features List */}
                  <ul className="py-3.5 space-y-2 text-xs">
                    {(pkg.features || []).map((feat, fIdx) => (
                      <li key={fIdx} className="flex items-start gap-2 text-muted-foreground leading-snug">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Action Button: Current Plan vs Upgrade CTA */}
                <div className="pt-3">
                  {isCurrentPlan ? (
                    <Button
                      disabled
                      className="w-full h-11 rounded-xl text-xs font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 cursor-default flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span>{isRtl ? 'أنت مشترك في هذه الباقة حالياً' : 'Your Current Active Plan'}</span>
                    </Button>
                  ) : (
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        onClick={() => handleRequestUpgrade(pkg)}
                        className={`w-full h-12 rounded-2xl text-xs font-black shadow-lg cursor-pointer transition-all relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/25 before:to-transparent ${
                          isPop
                            ? 'yalla-gradient-btn text-white shadow-primary/30'
                            : 'bg-gradient-to-r from-primary to-blue-600 hover:from-primary/95 hover:to-blue-700 text-white shadow-primary/20'
                        }`}
                      >
                        <MessageSquare className={`w-4 h-4 ${isRtl ? 'ml-2' : 'mr-2'}`} />
                        <span>{isRtl ? 'طلب الترقية الآن (واتساب)' : 'Upgrade via WhatsApp'}</span>
                      </Button>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Support Help Footer */}
        <div className="mt-5 pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>{isRtl ? 'تفعيل وترقية فورية بعد التحويل وإرسال إيصال الدفع' : 'Instant activation upon transfer and receipt'}</span>
          </div>
          <div className="flex items-center gap-1 font-bold text-foreground">
            <span>{isRtl ? 'للاستفسارات والاشتراكات المخصصة:' : 'Inquiries & Custom Billing:'}</span>
            <span className="font-mono text-primary font-black" dir="ltr">{supportPhone}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
