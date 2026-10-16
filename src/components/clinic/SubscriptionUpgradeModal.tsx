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
  Award
} from 'lucide-react'
import { openManualWhatsAppChat } from '@/lib/whatsappShare'
import { toast } from 'sonner'
import { db } from '@/lib/firebase'
import { updateDoc, doc } from 'firebase/firestore'
import { useLanguage } from '@/context/LanguageContext'

export interface PackageItem {
  id?: string
  name: string
  subtitle?: string
  code?: string
  category?: 'monthly' | 'annual' | string
  price: number | string
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
      <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200/80 p-1.5 flex items-center justify-center mx-auto mb-2.5 shadow-xs">
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
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'monthly' | 'yearly'>('all')
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

  // AI Usage
  const aiLimit = Number(clinic?.aiResponsesLimit ?? 100)
  const aiCount = Number(clinic?.aiResponsesCount ?? 0)
  const aiPercent = Math.min(100, Math.round((aiCount / Math.max(1, aiLimit)) * 100))

  // Filter packages by selected category (monthly / yearly)
  const filteredPackages = activePackages.filter(p => {
    if (selectedCategory === 'all') return true
    const period = (p.period || '').toLowerCase()
    const cat = (p.category || '').toLowerCase()
    const name = (p.name || '').toLowerCase()
    if (selectedCategory === 'monthly') {
      return period.includes('شهر') || cat.includes('شهر') || period.includes('month') || (!period.includes('سنو') && !cat.includes('سنو') && !period.includes('year'))
    }
    if (selectedCategory === 'yearly') {
      return period.includes('سنو') || cat.includes('سنو') || name.includes('سنو') || period.includes('year') || cat.includes('annual')
    }
    return true
  })

  const handleRequestUpgrade = (pkg: PackageItem) => {
    const discountInfo = pkg.originalPrice && Number(pkg.originalPrice) > Number(pkg.price)
      ? (isRtl ? ` (عرض خاص: ${pkg.price} بدل ${pkg.originalPrice} ج.م)` : ` (Special offer: ${pkg.price} instead of ${pkg.originalPrice} EGP)`)
      : ''

    const msg = isRtl
      ? `مرحباً، أرغب في ترقية / تجديد اشتراك عيادتي عبر منصة Yalla Clinic:
- العيادة: ${clinic?.clinicName || 'العيادة الطبية'}
- الطبيب: د. ${clinic?.doctorName || ''}
- الباقة المطلوبة: ${pkg.name}${discountInfo}
- السعر: ${pkg.price} ج.م / ${pkg.period || 'شهري'}
- كود العيادة (Slug): ${clinic?.slug || ''}

يرجى تزويدي بطرق الدفع الإلكتروني المتاحة (انستا باي / فودافون كاش / بنك) لتأكيد التفعيل فورا. شكرا!`
      : `Hello, I would like to upgrade / renew my clinic subscription on Yalla Clinic:
- Clinic: ${clinic?.clinicName || 'Clinic'}
- Doctor: Dr. ${clinic?.doctorName || ''}
- Selected Package: ${pkg.name}${discountInfo}
- Price: ${pkg.price} EGP / ${pkg.period || 'monthly'}
- Clinic Slug: ${clinic?.slug || ''}

Please provide available payment methods to confirm activation. Thank you!`

    openManualWhatsAppChat({
      phone: supportPhone,
      message: msg
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[96vw] max-w-5xl max-h-[92vh] overflow-y-auto p-5 sm:p-7 bg-card text-card-foreground rounded-3xl border border-border" dir={dir}>
        <DialogHeader className={`${isRtl ? 'text-right' : 'text-left'} space-y-1.5 pb-3 border-b border-border`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-teal-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black text-foreground">
                  {isRtl ? 'ترقية الحساب وباقات اشتراك Yalla Clinic' : 'Account Upgrade & Subscription Packages'}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {isRtl ? 'اختر الباقة المناسبة لتوسيع إمكانيات عيادتك وزيادة رصيد الذكاء الاصطناعي والفروع' : 'Choose the best plan to expand your clinic capabilities, branches, and AI quota'}
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Current Subscription Status Bar */}
        <div className="my-3 p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-[#0B1F33] text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-300 font-bold">
                {isRtl ? 'الباقة الحالية:' : 'Current Plan:'}
              </span>
              <Badge className="bg-primary text-white font-black text-xs px-2.5 py-0.5">
                {clinic?.packageName || (isRtl ? 'الباقة الأساسية' : 'Standard Plan')}
              </Badge>
              {isExpired ? (
                <Badge variant="destructive" className="font-bold text-xs">
                  {isRtl ? 'منتهي الصلاحية' : 'Expired'}
                </Badge>
              ) : (
                <Badge className="bg-amber-400 text-slate-900 font-black text-xs">
                  {isRtl ? `متبقي ${daysLeft} يوم` : `${daysLeft} days remaining`}
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              {isRtl ? 'تاريخ انتهاء الاشتراك الحالي: ' : 'Current expiry date: '}{' '}
              <span className="text-white font-mono font-bold" dir="ltr">{clinic?.expirationDate || (isRtl ? 'غير محدد' : 'Unspecified')}</span>
            </p>
          </div>

          {/* AI Quota Meter */}
          <div className="w-full md:w-64 bg-[#0F243A] p-3 rounded-xl border border-white/10 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-bold flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5 text-purple-400" />
                {isRtl ? 'استهلاك الذكاء الاصطناعي:' : 'AI Usage:'}
              </span>
              <span className="font-mono font-bold text-teal-300 text-[11px]" dir="ltr">
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
        </div>

        {/* Category Filter Pills (باقات شهرية - باقات سنوية) */}
        <div className="flex items-center justify-center my-3">
          <div className="p-1 rounded-2xl bg-muted border border-border flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {isRtl ? `جميع الباقات (${activePackages.length})` : `All Plans (${activePackages.length})`}
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('monthly')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                selectedCategory === 'monthly'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {isRtl ? 'باقات شهرية' : 'Monthly Plans'}
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('yearly')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedCategory === 'yearly'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>{isRtl ? 'باقات سنوية' : 'Annual Plans'}</span>
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-amber-400 text-slate-900">
                {isRtl ? 'وفر شهرين 🎁' : 'Save 2 Months 🎁'}
              </span>
            </button>
          </div>
        </div>

        {/* Available Packages Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
          {filteredPackages.map((pkg, idx) => {
            const isPop = pkg.isPopular || pkg.isRecommended
            const hasDiscount = pkg.originalPrice && Number(pkg.originalPrice) > Number(pkg.price)

            return (
              <div
                key={idx}
                className={`rounded-3xl p-5 sm:p-6 flex flex-col justify-between transition-all duration-300 relative border group ${
                  isPop
                    ? 'bg-card border-primary shadow-xl shadow-primary/15 ring-2 ring-primary/30'
                    : 'bg-card border-border hover:border-border/80'
                }`}
              >
                {/* Popular / Recommended Tag */}
                {(pkg.badge || isPop) && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap">
                    <span className={`px-3.5 py-1 rounded-full text-[11px] font-black shadow-md flex items-center gap-1.5 ${
                      isPop
                        ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-primary text-white ring-2 ring-background'
                        : 'bg-slate-800 text-white'
                    }`}>
                      {isPop && <Sparkles className="w-3.5 h-3.5 text-amber-200 animate-spin" />}
                      <span>{pkg.badge || (isRtl ? '⭐ موصى بها للعيادات' : '⭐ Recommended')}</span>
                    </span>
                  </div>
                )}

                <div>
                  <div className="pt-2 text-center border-b border-border pb-4">
                    {renderPackageLogo(pkg)}
                    <h4 className="text-lg font-black text-foreground">{pkg.name}</h4>
                    {pkg.subtitle && (
                      <p className="text-[11px] text-muted-foreground font-medium mt-1 leading-normal max-w-xs mx-auto">
                        {pkg.subtitle}
                      </p>
                    )}

                    {/* Pricing with Discount Support */}
                    <div className="mt-3 flex flex-col items-center justify-center">
                      {hasDiscount ? (
                        <div className="space-y-1 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-xs text-muted-foreground line-through font-mono font-bold">
                              {pkg.originalPrice} {isRtl ? 'ج.م' : 'EGP'}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/10 text-rose-600 border border-rose-500/20">
                              {pkg.discountBadge || (isRtl ? `وفر ${Number(pkg.originalPrice) - Number(pkg.price)} ج.م` : `Save ${Number(pkg.originalPrice) - Number(pkg.price)} EGP`)}
                            </span>
                          </div>
                          <div className="flex items-baseline justify-center gap-1">
                            <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{pkg.price}</span>
                            <span className="text-xs font-bold text-muted-foreground">{isRtl ? 'ج.م' : 'EGP'} / {pkg.period || (isRtl ? 'شهري' : 'monthly')}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-baseline justify-center gap-1">
                          <span className="text-3xl font-black text-primary font-mono">{pkg.price}</span>
                          <span className="text-xs font-bold text-muted-foreground">{isRtl ? 'ج.م' : 'EGP'} / {pkg.period || (isRtl ? 'شهري' : 'monthly')}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Highlights Specs */}
                  <div className="py-3 space-y-2 border-b border-border text-xs">
                    <div className="flex items-center justify-between text-muted-foreground font-bold">
                      <span className="flex items-center gap-1.5">
                        <Bot className="w-4 h-4 text-purple-500" />
                        {isRtl ? 'ردود المساعد الذكي AI:' : 'AI Responses:'}
                      </span>
                      <span className="text-purple-600 dark:text-purple-400 font-black font-mono">
                        {pkg.aiResponsesLimit ? `${pkg.aiResponsesLimit} ${isRtl ? 'رد' : 'replies'}` : (isRtl ? 'غير محدود' : 'Unlimited')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-muted-foreground font-bold">
                      <span className="flex items-center gap-1.5">
                        <Building className="w-4 h-4 text-primary" />
                        {isRtl ? 'الفروع المسموح بها:' : 'Allowed Branches:'}
                      </span>
                      <span className="text-primary font-black font-mono">
                        {pkg.maxBranches ? `${pkg.maxBranches} ${isRtl ? 'فرع' : 'branch(es)'}` : (isRtl ? 'فرع واحد' : '1 Branch')}
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

                {/* Upgrade Button */}
                <div className="pt-3">
                  <Button
                    onClick={() => handleRequestUpgrade(pkg)}
                    className={`w-full h-11 rounded-xl text-xs font-black shadow-md cursor-pointer transition-all ${
                      isPop
                        ? 'yalla-gradient-btn text-white'
                        : 'bg-primary/90 hover:bg-primary text-white'
                    }`}
                  >
                    <MessageSquare className={`w-4 h-4 ${isRtl ? 'ml-1.5' : 'mr-1.5'}`} />
                    {isRtl ? 'طلب الترقية الآن (واتساب)' : 'Upgrade via WhatsApp'}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Support Help Footer */}
        <div className="mt-4 pt-3 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span>{isRtl ? 'تفعيل فوري بعد التحويل وإرسال إيصال الدفع' : 'Instant activation upon transfer and receipt'}</span>
          </div>
          <div className="flex items-center gap-1 font-bold text-foreground">
            <span>{isRtl ? 'للاستفسارات والاشتراكات السنوية:' : 'Inquiries & Annual Billing:'}</span>
            <span className="font-mono text-primary font-black" dir="ltr">{supportPhone}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
