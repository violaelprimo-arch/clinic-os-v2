import type { LucideIcon } from 'lucide-react'
import {
  Building,
  Inbox,
  Users,
  Edit,
  Package,
  Sparkles,
  MessageSquare,
  Bot,
  Download,
} from 'lucide-react'
import type { OwnerTab } from './OwnerNavigationContext'

export interface OwnerNavItemConfig {
  id: OwnerTab | 'backup'
  labelAr: string
  labelEn: string
  icon: LucideIcon
  isAction?: boolean
  showBadge?: boolean
  activeClass?: string
  badgeBg?: string
}

export interface OwnerNavSectionConfig {
  id: string
  titleAr: string
  titleEn: string
  items: OwnerNavItemConfig[]
}

export const OWNER_NAVIGATION_SECTIONS: OwnerNavSectionConfig[] = [
  {
    id: 'overview',
    titleAr: 'نظرة عامة',
    titleEn: 'Overview',
    items: [
      {
        id: 'clinics',
        labelAr: 'إدارة العيادات والنظام',
        labelEn: 'Clinics Management',
        icon: Building,
      },
      {
        id: 'clinic-requests',
        labelAr: 'طلبات العيادات',
        labelEn: 'Clinic Requests',
        icon: Inbox,
        showBadge: true,
        badgeBg: 'bg-rose-500',
      },
    ],
  },
  {
    id: 'platform',
    titleAr: 'إدارة المنصة',
    titleEn: 'Platform Management',
    items: [
      {
        id: 'doctors',
        labelAr: 'حسابات الأطباء والمواعيد',
        labelEn: 'Doctors & Bookings',
        icon: Users,
      },
      {
        id: 'add',
        labelAr: 'تعديل بيانات العيادة',
        labelEn: 'Edit Clinic Details',
        icon: Edit,
      },
      {
        id: 'packages',
        labelAr: 'التحكم في الباقات والاشتراكات',
        labelEn: 'Packages & Plans',
        icon: Package,
      },
    ],
  },
  {
    id: 'marketing',
    titleAr: 'التسويق والتواصل',
    titleEn: 'Marketing & Communication',
    items: [
      {
        id: 'landing',
        labelAr: 'الواجهة الرئيسية واستطلاع الرأي',
        labelEn: 'Landing & Reviews',
        icon: Sparkles,
      },
      {
        id: 'whatsapp',
        labelAr: 'إدارة واتساب العيادات',
        labelEn: 'Clinic WhatsApp',
        icon: MessageSquare,
        activeClass: 'bg-emerald-600 text-white shadow-md shadow-emerald-500/30',
      },
    ],
  },
  {
    id: 'settings',
    titleAr: 'إعدادات المنصة',
    titleEn: 'Platform Settings',
    items: [
      {
        id: 'settings',
        labelAr: 'مفتاح AI المركزي',
        labelEn: 'AI Global Key',
        icon: Bot,
      },
      {
        id: 'backup',
        labelAr: 'نسخة احتياطية (JSON)',
        labelEn: 'Backup (JSON)',
        icon: Download,
        isAction: true,
      },
    ],
  },
]

export const ALL_OWNER_NAV_ITEMS: OwnerNavItemConfig[] = OWNER_NAVIGATION_SECTIONS.flatMap(
  (section) => section.items
)
