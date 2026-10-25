'use client'

import React from 'react'
import {
  Lock,
  Receipt,
  Pill,
  FileText,
  Sparkles,
  Palette,
  Bell,
  Bot,
  Building2,
  Calendar,
  ShieldAlert,
  ArrowRight,
  MessageSquare,
  Crown
} from 'lucide-react'
import { Button } from '@/components/ui/button'

export type FeatureKey =
  | 'finance'
  | 'drugs'
  | 'prescriptions'
  | 'customTemplate'
  | 'branding'
  | 'patientAlerts'
  | 'ai'
  | 'branches'
  | 'onlineBooking'

export interface FeatureMetadata {
  key: FeatureKey
  label: string
  shortLabel: string
  description: string
  category: 'clinical' | 'management' | 'marketing'
  icon: any
}

export const SYSTEM_FEATURES: Record<FeatureKey, FeatureMetadata> = {
  finance: {
    key: 'finance',
    label: 'الحسابات والتقارير المالية والأرباح',
    shortLabel: 'الحسابات والمالية',
    description: 'تسجيل وحساب الإيرادات والمصروفات اليومية والشهرية، تقارير الأرباح، وتصدير إكسيل المالي.',
    category: 'management',
    icon: Receipt
  },
  drugs: {
    key: 'drugs',
    label: 'دليل وأسعار الأدوية والبدائل',
    shortLabel: 'دليل الأدوية',
    description: 'قاعدة بيانات الأدوية المصرية والأسعار المحدثة دورياً مع البحث التلقائي والبدائل الطبية.',
    category: 'clinical',
    icon: Pill
  },
  prescriptions: {
    key: 'prescriptions',
    label: 'الروشتات الطبية الذكية وإرسالها',
    shortLabel: 'الروشتات الطبية',
    description: 'تحرير وطباعة الروشتات الإلكترونية وتصديرها PDF ومشاركتها مع المريض مباشرة.',
    category: 'clinical',
    icon: FileText
  },
  customTemplate: {
    key: 'customTemplate',
    label: 'قالب وتصميم روشتة مخصص (Custom A4)',
    shortLabel: 'تصميم روشتة مخصص',
    description: 'رفع واستخدام تصميم روشتة مخصص خاص بالعيادة للطباعة فوقه بدلاً من القالب الافتراضي.',
    category: 'clinical',
    icon: Sparkles
  },
  branding: {
    key: 'branding',
    label: 'سماح الطبيب بتعديل هوية العيادة والشعار',
    shortLabel: 'تعديل هوية العيادة',
    description: 'تمكين الطبيب من تعديل شعار العيادة والألوان الأساسية والثانوية والمطبوعات بنفسه.',
    category: 'management',
    icon: Palette
  },
  patientAlerts: {
    key: 'patientAlerts',
    label: 'تنبيهات المرضى التلقائية ورسائل واتساب',
    shortLabel: 'تنبيهات المرضى',
    description: 'إرسال إشعارات وتنبيهات مواعيد الكشف وتتبع الدور تلقائياً للمرضى على هواتفهم.',
    category: 'marketing',
    icon: Bell
  },
  ai: {
    key: 'ai',
    label: 'المساعد الذكي للعيادة (AI Chatbot)',
    shortLabel: 'الذكاء الاصطناعي',
    description: 'تفعيل الشات بوت الذكي وتدريبه للرد على أسئلة المرضى ومساعدتهم في الحجز التلقائي.',
    category: 'marketing',
    icon: Bot
  },
  branches: {
    key: 'branches',
    label: 'نظام إدارة الفروع والمراكز المتعددة',
    shortLabel: 'الفروع المتعددة',
    description: 'إمكانية إضافة أكثر من فرع طبي لنفس العيادة وتوزيع الحجوزات والسكرتارية عليها.',
    category: 'management',
    icon: Building2
  },
  onlineBooking: {
    key: 'onlineBooking',
    label: 'بوابة الحجز الذاتي للمرضى وتتبع الدور',
    shortLabel: 'الحجز وتتبع الدور',
    description: 'صفحة خاصة للمرضى لحجز المواعيد إلكترونياً ومتابعة رقم الدور بدقة دون انتظار.',
    category: 'marketing',
    icon: Calendar
  }
}

/**
 * Determine if a specific feature is enabled for a clinic.
 * Priority & Strict Rules:
 * 1. Global / Owner hard locks (e.g. aiLockedByOwner).
 * 2. If feature is disabled in the active package, it is strictly FALSE and completely hidden.
 * 3. If feature is explicitly disabled in clinic overrides, it is FALSE.
 * 4. Package permissions take precedence to ensure anything turned off in the package disappears completely.
 */
export function isClinicFeatureEnabled(
  clinic: any,
  feature: FeatureKey,
  clinicPackage?: any
): boolean {
  if (!clinic) return false

  // 1. Direct Owner Hard Locks
  if (feature === 'ai' && clinic.aiLockedByOwner === true) {
    return false
  }

  // 2. Identify active package (passed directly, or attached to clinic, or via packagePermissions)
  const pkg = clinicPackage || clinic.activePackage || clinic.packageData || null
  const perms = pkg || clinic.packagePermissions || null

  // 3. Strict Package-Level Disabling (If closed in the package, it is completely OFF)
  if (perms) {
    switch (feature) {
      case 'ai':
        if (perms.allowAi === false) return false
        break
      case 'branches':
        if (perms.allowBranches === false || (perms.maxBranches !== undefined && Number(perms.maxBranches) <= 1)) return false
        break
      case 'finance':
        if (perms.allowFinance === false) return false
        break
      case 'drugs':
        if (perms.allowDrugs === false) return false
        break
      case 'prescriptions':
        if (perms.allowPrescriptions === false) return false
        break
      case 'customTemplate':
        if (perms.allowCustomTemplate === false) return false
        break
      case 'branding':
        if (perms.allowBranding === false) return false
        break
      case 'patientAlerts':
        if (perms.allowPatientAlerts === false) return false
        break
      case 'onlineBooking':
        if (perms.allowOnlineBooking === false) return false
        break
    }
  }

  // 4. Direct explicit clinic overrides
  switch (feature) {
    case 'finance':
      if (clinic.allowFinance === false) return false
      break
    case 'drugs':
      if (clinic.allowDrugs === false) return false
      break
    case 'prescriptions':
      if (clinic.allowPrescriptions === false) return false
      break
    case 'customTemplate':
      if (clinic.allowCustomTemplate === false) return false
      break
    case 'branding':
      if (clinic.allowDoctorEditBranding === false) return false
      break
    case 'patientAlerts':
      if (clinic.allowPatientAlerts === false) return false
      break
    case 'ai':
      if (clinic.aiEnabled === false) return false
      break
    case 'branches':
      if (clinic.branchesEnabled === false) return false
      break
    case 'onlineBooking':
      if (clinic.allowOnlineBooking === false) return false
      break
  }

  // 5. If package explicitly enables it, return true
  if (perms) {
    switch (feature) {
      case 'finance':
        if (perms.allowFinance === true) return true
        break
      case 'drugs':
        if (perms.allowDrugs === true) return true
        break
      case 'prescriptions':
        if (perms.allowPrescriptions === true) return true
        break
      case 'customTemplate':
        if (perms.allowCustomTemplate === true) return true
        break
      case 'branding':
        if (perms.allowBranding === true) return true
        break
      case 'patientAlerts':
        if (perms.allowPatientAlerts === true) return true
        break
      case 'ai':
        if (perms.allowAi === true) return true
        break
      case 'branches':
        if (perms.allowBranches === true && Number(perms.maxBranches || 2) > 1) return true
        break
      case 'onlineBooking':
        if (perms.allowOnlineBooking === true) return true
        break
    }
  }

  // 6. Direct clinic positive overrides
  switch (feature) {
    case 'finance':
      if (clinic.allowFinance !== undefined) return Boolean(clinic.allowFinance)
      break
    case 'drugs':
      if (clinic.allowDrugs !== undefined) return Boolean(clinic.allowDrugs)
      break
    case 'prescriptions':
      if (clinic.allowPrescriptions !== undefined) return Boolean(clinic.allowPrescriptions)
      break
    case 'customTemplate':
      if (clinic.allowCustomTemplate !== undefined) return Boolean(clinic.allowCustomTemplate)
      break
    case 'branding':
      if (clinic.allowDoctorEditBranding !== undefined) return Boolean(clinic.allowDoctorEditBranding)
      break
    case 'patientAlerts':
      if (clinic.allowPatientAlerts !== undefined) return Boolean(clinic.allowPatientAlerts)
      break
    case 'ai':
      if (clinic.aiEnabled !== undefined) return Boolean(clinic.aiEnabled)
      break
    case 'branches':
      if (clinic.branchesEnabled !== undefined) return Boolean(clinic.branchesEnabled)
      break
    case 'onlineBooking':
      if (clinic.allowOnlineBooking !== undefined) return Boolean(clinic.allowOnlineBooking)
      break
  }

  // 7. Fallback defaults based on package tier name if no package document exists
  const pkgName = String(clinic.packageName || '').toLowerCase()
  const isBasic = pkgName.includes('أساس') || pkgName.includes('basic')

  if (isBasic) {
    if (feature === 'customTemplate') return false
    if (feature === 'branches') return false
    if (feature === 'finance') return false
    if (feature === 'patientAlerts') return false
    if (feature === 'ai') return false
  }

  return true
}

/**
 * Locked feature screen presented whenever doctor visits a disabled section directly.
 */
export function LockedFeatureScreen({
  featureKey,
  clinic,
  onRequestUpgrade
}: {
  featureKey: FeatureKey
  clinic: any
  onRequestUpgrade?: () => void
}) {
  const feat = SYSTEM_FEATURES[featureKey] || {
    label: 'هذه الميزة',
    shortLabel: 'الميزة',
    description: 'تم تقييد الوصول لهذه الميزة من قبل إدارة المنصة.',
    icon: Lock
  }

  const Icon = feat.icon || Lock
  const packageName = clinic?.packageName || 'الباقة الحالية'

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4 sm:p-6" dir="rtl">
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-3xl p-6 sm:p-9 text-center shadow-lg relative overflow-hidden space-y-6">
        {/* Decorative Top Accent */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-500 via-rose-500 to-amber-500"></div>

        {/* Locked Icon Badge */}
        <div className="w-20 h-20 rounded-3xl bg-amber-50 border-2 border-amber-200 flex items-center justify-center mx-auto text-amber-600 shadow-md relative">
          <Icon className="w-10 h-10" />
          <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-rose-500 rounded-full flex items-center justify-center text-white border-2 border-white shadow-xs">
            <Lock className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Main Content */}
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-50 text-rose-700 border border-rose-200">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>ميزة مقفولة ومقيدة في باقتك</span>
          </span>

          <h2 className="text-xl sm:text-2xl font-black text-[#182230]">
            قسم {feat.label} غير متاح حالياً
          </h2>

          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            هذه الميزة غير مفعلة في خطة اشتراك عيادتك الحالية{' '}
            <strong className="text-slate-800 font-black">({packageName})</strong>. تم إغلاق هذا القسم بواسطة إدارة المنصة.
          </p>
        </div>

        {/* Feature Value Box */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-right space-y-2">
          <span className="text-xs font-black text-slate-700 block">ماذا تقدم هذه الميزة للعيادة؟</span>
          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            {feat.description}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          {onRequestUpgrade && (
            <Button
              onClick={onRequestUpgrade}
              className="w-full sm:w-auto h-11 px-6 bg-[#15B8A6] hover:bg-[#0D9488] text-white text-xs font-black rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-105"
            >
              <Crown className="w-4 h-4 text-amber-200" />
              <span>ترقية الباقة وفتح الميزة فوراً</span>
            </Button>
          )}

          <a
            href={`/clinic/${clinic?.slug || 'demo'}/admin`}
            className="w-full sm:w-auto h-11 px-6 border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة إلى لوحة اليوم</span>
          </a>
        </div>

        {/* Footer Support Info */}
        <p className="text-[11px] text-slate-400">
          هل تعتقد أن هذا خطأ؟ تواصل مع إدارة المنصة لتفعيل الميزة أو ضبط صلاحيات حسابك.
        </p>
      </div>
    </div>
  )
}
