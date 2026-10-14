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
  ArrowRight
} from 'lucide-react'
import { openManualWhatsAppChat } from '@/lib/whatsappShare'

interface PackageItem {
  id?: string
  name: string
  code?: string
  price: number | string
  period?: string
  aiResponsesLimit?: number
  maxBranches?: number
  features?: string[]
  isPopular?: boolean
  badge?: string
  color?: string
}

interface SubscriptionUpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  clinic: any
  packages?: PackageItem[]
  supportPhone?: string
}

const DEFAULT_PACKAGES: PackageItem[] = [
  {
    name: 'الباقة الأساسية',
    code: 'basic',
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
    code: 'pro',
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
    ]
  },
  {
    name: 'الباقة الماسية (VIP)',
    code: 'vip',
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

  const handleRequestUpgrade = (pkg: PackageItem) => {
    const msg = `مرحباً، أرغب في ترقية / تجديد اشتراك عيادتي عبر منصة Clinic OS:
- العيادة: ${clinic?.clinicName || 'العيادة الطبية'}
- الطبيب: د. ${clinic?.doctorName || ''}
- الباقة المطلوبة: ${pkg.name}
- السعر: ${pkg.price} ج.م / ${pkg.period || 'شهري'}
- كود العيادة (Slug): ${clinic?.slug || ''}

يرجى تزويدي بطرق الدفع الإلكتروني المتاحة (انستا باي / فودافون كاش / بنك) لتأكيد التفعيل فورا. شكرا!`

    openManualWhatsAppChat({
      phone: supportPhone,
      message: msg
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-5 sm:p-7 bg-white rounded-3xl" dir="rtl">
        <DialogHeader className="text-right space-y-1.5 pb-3 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-teal-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black text-[#182230]">
                  ترقية الحساب وباقات اشتراك Clinic OS
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  اختر الباقة المناسبة لتوسيع إمكانيات عيادتك وزيادة رصيد الذكاء الاصطناعي والفروع
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Current Subscription Status Bar */}
        <div className="my-3 p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-[#0B1F33] text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-300 font-bold">الباقة الحالية:</span>
              <Badge className="bg-[#15B8A6] text-white font-black text-xs px-2.5 py-0.5">
                {clinic?.packageName || 'الباقة الأساسية'}
              </Badge>
              {isExpired ? (
                <Badge variant="destructive" className="font-bold text-xs">
                  منتهي الصلاحية
                </Badge>
              ) : (
                <Badge className="bg-amber-400 text-slate-900 font-black text-xs">
                  متبقي {daysLeft} يوم
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              تاريخ انتهاء الاشتراك الحالي: <span className="text-white font-mono font-bold" dir="ltr">{clinic?.expirationDate || 'غير محدد'}</span>
            </p>
          </div>

          {/* AI Quota Meter */}
          <div className="w-full md:w-64 bg-[#0F243A] p-3 rounded-xl border border-white/10 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-bold flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5 text-purple-400" />
                استهلاك الذكاء الاصطناعي:
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
                    : 'bg-[#15B8A6]'
                }`}
                style={{ width: `${aiPercent}%` }}
              />
            </div>
            {aiCount >= aiLimit && (
              <span className="text-[10px] text-rose-300 font-bold block">
                ⚠️ انتهى رصيد الردود! المساعد معطل حالياً.
              </span>
            )}
          </div>
        </div>

        {/* Available Packages Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {activePackages.map((pkg, idx) => {
            const isPop = pkg.isPopular
            return (
              <div
                key={idx}
                className={`rounded-2xl p-5 flex flex-col justify-between transition-all duration-300 relative border ${
                  isPop
                    ? 'bg-white border-[#15B8A6] shadow-xl shadow-teal-500/10 ring-2 ring-[#15B8A6]/20'
                    : 'bg-[#F8FAFC] border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Popular / Feature Tag */}
                {pkg.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className={`px-3 py-0.5 rounded-full text-[11px] font-black shadow-xs ${
                      isPop ? 'bg-[#15B8A6] text-white' : 'bg-slate-800 text-white'
                    }`}>
                      {pkg.badge}
                    </span>
                  </div>
                )}

                <div>
                  <div className="pt-2 text-center border-b border-slate-100 pb-4">
                    <h4 className="text-lg font-black text-[#182230]">{pkg.name}</h4>
                    <div className="mt-2 flex items-baseline justify-center gap-1">
                      <span className="text-3xl font-black text-[#15B8A6] font-mono">{pkg.price}</span>
                      <span className="text-xs font-bold text-slate-500">ج.م / {pkg.period || 'شهري'}</span>
                    </div>
                  </div>

                  {/* Highlights Specs */}
                  <div className="py-3 space-y-2 border-b border-slate-100 text-xs">
                    <div className="flex items-center justify-between text-slate-600 font-bold">
                      <span className="flex items-center gap-1.5">
                        <Bot className="w-4 h-4 text-purple-600" />
                        ردود المساعد الذكي AI:
                      </span>
                      <span className="text-purple-700 font-black font-mono">
                        {pkg.aiResponsesLimit ? `${pkg.aiResponsesLimit} رد` : 'غير محدود'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600 font-bold">
                      <span className="flex items-center gap-1.5">
                        <Building className="w-4 h-4 text-[#2F80ED]" />
                        الفروع المسموح بها:
                      </span>
                      <span className="text-[#2F80ED] font-black font-mono">
                        {pkg.maxBranches ? `${pkg.maxBranches} فرع` : 'فرع واحد'}
                      </span>
                    </div>
                  </div>

                  {/* Features List */}
                  <ul className="py-3.5 space-y-2 text-xs">
                    {(pkg.features || []).map((feat, fIdx) => (
                      <li key={fIdx} className="flex items-start gap-2 text-slate-600 leading-snug">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
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
                        ? 'bg-[#15B8A6] hover:bg-[#0D9488] text-white shadow-teal-500/20'
                        : 'bg-slate-900 hover:bg-slate-800 text-white'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4 ml-1.5" />
                    طلب الترقية الآن (واتساب)
                  </Button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Support Help Footer */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#15B8A6]" />
            <span>تفعيل فوري بعد التحويل وإرسال إيصال الدفع</span>
          </div>
          <div className="flex items-center gap-1 font-bold text-slate-700">
            <span>للاستفسارات والاشتراكات السنوية:</span>
            <span className="font-mono text-[#15B8A6] font-black" dir="ltr">{supportPhone}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
