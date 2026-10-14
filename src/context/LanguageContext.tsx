'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

export type Language = 'ar' | 'en'

export interface LanguageContextType {
  language: Language
  dir: 'rtl' | 'ltr'
  isRtl: boolean
  setLanguage: (lang: Language) => void
  toggleLanguage: () => void
  t: (key: string, fallback?: string) => string
}

const translations: Record<Language, Record<string, string>> = {
  ar: {
    // Topbar & Global
    'app_name': 'نظام العيادات الذكي Yalla Clinic',
    'search_patient_placeholder': 'ابحث عن مريض بالاسم أو رقم الهاتف...',
    'booking_page': 'صفحة الحجز',
    'certified_doctor': 'طبيب معتمد',
    'notifications': 'الإشعارات',
    'dark_mode': 'الوضع الليلي',
    'light_mode': 'الوضع النهاري',
    'language': 'اللغة',
    'arabic': 'العربية',
    'english': 'English',
    'all_branches': 'جميع الفروع',
    'select_branch': 'اختر الفرع',
    'live': 'مباشر',

    // Sidebar Navigation
    'nav_queue': 'لوحة اليوم',
    'nav_patients': 'سجل المرضى',
    'nav_prescriptions': 'الروشتات الطبية',
    'nav_drugs': 'دليل الأدوية',
    'nav_accounts': 'الحسابات',
    'nav_finance': 'التقارير المالية',
    'nav_branches': 'الفروع والعيادات',
    'nav_ai_training': 'تدريب المساعد الذكي',
    'nav_settings': 'الإعدادات المتقدمة',
    'upgrade_account': 'ترقية حسابك / الباقات',
    'technical_support': 'تواصل مع الدعم الفني',
    'patient_booking_page': 'صفحة حجز المرضى',
    'logout': 'تسجيل الخروج',

    // General Actions & Common Buttons
    'save': 'حفظ التعديلات',
    'cancel': 'إلغاء',
    'delete': 'حذف',
    'edit': 'تعديل',
    'add': 'إضافة',
    'search': 'بحث',
    'filter': 'تصفية',
    'close': 'إغلاق',
    'confirm': 'تأكيد',
    'export_excel': 'تصدير إكسيل',
    'print': 'طباعة',
    'update': 'تحديث',
    'manual_sync': 'تحديث يدوي للأسعار',
    'add_new_drug': 'إضافة دواء جديد',
    'add_to_prescription': 'إضافة للروشتة',
    'all_companies': 'كل الشركات',
    'all_forms': 'كل الأشكال',
    'status': 'الحالة',
    'price': 'السعر',
    'currency_egp': 'ج.م',
    'doctor_name': 'اسم الطبيب',
    'clinic_name': 'اسم العيادة',
    'loading': 'جاري التحميل...',
    'no_data': 'لا توجد بيانات متاحة',
    'all': 'الكل',
    'back': 'رجوع',
    'next': 'التالي',
    'previous': 'السابق',

    // Queue & Exam
    'today_overview': 'لوحة اليوم',
    'patient_queue': 'طابور الدور والانتظار',
    'current_patient': 'المريض الحالي داخل العيادة',
    'next_patient': 'المريض التالي',
    'start_exam': 'بدء الكشف',
    'complete_exam': 'إنهاء الكشف',
    'skip': 'تخطي الدور',
    'no_show': 'لم يحضر',
    'waiting': 'في الانتظار',
    'in_progress': 'جاري الكشف',
    'completed': 'تم الكشف',
    'cancelled': 'تم الإلغاء',
    'ahead_count': 'مرضى أمامك بالعيادة',
    'estimated_wait': 'الوقت المتوقع للكشف',
    'min': 'دقيقة',

    // Financial & Invoicing
    'collected': 'تم التحصيل',
    'pending_payment': 'في انتظار الدفع',
    'total_due': 'المبلغ المستحق',
    'discount': 'خصم مطبق',
    'payment_method': 'طريقة الدفع',
    'cash': 'كاش نقدي',
    'instapay': 'انستاباي',
    'wallet': 'محفظة إلكترونية',
    'print_invoice': 'طباعة الفاتورة',
    'confirm_payment': 'تأكيد السداد',
    'paid': 'مسدد بالكامل',
    'unpaid': 'غير مسدد',

    // Drug Directory
    'drug_directory': 'دليل الأدوية المركزي',
    'drug_name': 'اسم الدواء',
    'active_ingredient': 'المادة الفعالة',
    'manufacturer': 'الشركة المصنعة',
    'dosage_form': 'الشكل الدوائي',
    'price_not_available': 'السعر غير متوفر حالياً',
    'last_updated_on': 'تم التحديث بتاريخ',
    'manual_drug_added_success': 'تم حفظ الدواء بنجاح في قاعدة بيانات العيادة',
    'sync_in_progress': 'جاري فحص وتحديث أسعار الأدوية...',
    'sync_success': 'تم فحص أحدث الأسعار ومطابقتها بنجاح',
    'drug_details': 'تفاصيل الدواء',
    'favorites': 'المفضلة',

    // Owner Dashboard
    'owner_dashboard_title': 'لوحة تحكم مالك المنصة (Super Admin)',
    'owner_dashboard_subtitle': 'إدارة اشتراكات العيادات، التحكم اللحظي في تفعيل الـ AI Chatbot، ورفع تصاميم الروشتات المخصصة',
    'owner_super_admin': 'لوحة المالك (Super Admin)',
    'owner_phone': 'هاتف مالك المنصة',
    'owner_whatsapp': 'واتساب المالك',
    'refresh_data': 'تحديث البيانات',
    'add_new_clinic': 'إضافة عيادة جديدة',
    'packages_control': 'إدارة وباقات الاشتراك 💎',
    'financial_accounts': 'حسابات الدكاترة والتحصيل 💳',
    'settle_account': 'تسديد الحساب',
    'total_clinics': 'إجمالي العيادات',
    'active_clinics': 'عيادات نشطة',
    'suspended_clinics': 'عيادات متوقفة',
    'total_branches': 'إجمالي الفروع',
    'expiring_subscriptions': 'اشتراكات قاربت على الانتهاء',

    // Public Landing Page
    'staff_login': 'دخول الطاقم',
    'patient_portal': 'بوابة المريض',
    'clinic_location': 'موقع العيادة',
    'whatsapp_consult': 'استشارة واتساب',
    'book_appointment': 'احجز موعد كشف الآن',
    'track_queue': 'متابعة دورك الآن',
    'copyright_notice': 'جميع الحقوق محفوظة © 2026 يلا كلينيك',
  },
  en: {
    // Topbar & Global
    'app_name': 'Yalla Clinic - Smart Medical System',
    'search_patient_placeholder': 'Search patient by name or phone...',
    'booking_page': 'Booking Page',
    'certified_doctor': 'Doctor',
    'notifications': 'Notifications',
    'dark_mode': 'Dark Mode',
    'light_mode': 'Light Mode',
    'language': 'Language',
    'arabic': 'العربية',
    'english': 'English',
    'all_branches': 'All Branches',
    'select_branch': 'Select Branch',
    'live': 'Live',

    // Sidebar Navigation
    'nav_queue': "Today's Overview",
    'nav_patients': 'Patient Records',
    'nav_prescriptions': 'Prescriptions',
    'nav_drugs': 'Drug Directory',
    'nav_accounts': 'Accounts & Billing',
    'nav_finance': 'Financial Reports',
    'nav_branches': 'Branch Management',
    'nav_ai_training': 'AI Bot Training',
    'nav_settings': 'System Settings',
    'upgrade_account': 'Upgrade / Packages',
    'technical_support': 'Contact Support',
    'patient_booking_page': 'Patient Booking Page',
    'logout': 'Sign Out',

    // General Actions & Common Buttons
    'save': 'Save Changes',
    'cancel': 'Cancel',
    'delete': 'Delete',
    'edit': 'Edit',
    'add': 'Add New',
    'search': 'Search',
    'filter': 'Filter',
    'close': 'Close',
    'confirm': 'Confirm',
    'export_excel': 'Export Excel',
    'print': 'Print',
    'update': 'Update',
    'manual_sync': 'Manual Price Sync',
    'add_new_drug': 'Add New Drug',
    'add_to_prescription': 'Add to Prescription',
    'all_companies': 'All Companies',
    'all_forms': 'All Forms',
    'status': 'Status',
    'price': 'Price',
    'currency_egp': 'EGP',
    'doctor_name': 'Doctor Name',
    'clinic_name': 'Clinic Name',
    'loading': 'Loading...',
    'no_data': 'No data available',
    'all': 'All',
    'back': 'Back',
    'next': 'Next',
    'previous': 'Previous',

    // Queue & Exam
    'today_overview': "Today's Overview",
    'patient_queue': 'Patient Queue',
    'current_patient': 'Current Patient in Exam',
    'next_patient': 'Next Patient',
    'start_exam': 'Start Examination',
    'complete_exam': 'Complete Examination',
    'skip': 'Skip Turn',
    'no_show': 'No Show',
    'waiting': 'Waiting',
    'in_progress': 'In Progress',
    'completed': 'Completed',
    'cancelled': 'Cancelled',
    'ahead_count': 'Patients ahead of you',
    'estimated_wait': 'Estimated waiting time',
    'min': 'mins',

    // Financial & Invoicing
    'collected': 'Collected',
    'pending_payment': 'Payment Pending',
    'total_due': 'Total Due',
    'discount': 'Discount Applied',
    'payment_method': 'Payment Method',
    'cash': 'Cash',
    'instapay': 'InstaPay',
    'wallet': 'E-Wallet',
    'print_invoice': 'Print Invoice',
    'confirm_payment': 'Confirm Payment',
    'paid': 'Paid in Full',
    'unpaid': 'Unpaid',

    // Drug Directory
    'drug_directory': 'Drug Directory',
    'drug_name': 'Drug Name',
    'active_ingredient': 'Active Ingredient',
    'manufacturer': 'Manufacturer',
    'dosage_form': 'Dosage Form',
    'price_not_available': 'Price not currently available',
    'last_updated_on': 'Updated on',
    'manual_drug_added_success': 'Drug successfully saved to clinic database',
    'sync_in_progress': 'Checking and updating prices...',
    'sync_success': 'Latest prices checked and verified',
    'drug_details': 'Drug Details',
    'favorites': 'Favorites',

    // Owner Dashboard
    'owner_dashboard_title': 'Platform Owner Dashboard (Super Admin)',
    'owner_dashboard_subtitle': 'Manage clinic subscriptions, AI limits, and custom prescription templates',
    'owner_super_admin': 'Super Admin Portal',
    'owner_phone': 'Owner Phone',
    'owner_whatsapp': 'Owner WhatsApp',
    'refresh_data': 'Refresh Data',
    'add_new_clinic': 'Add New Clinic',
    'packages_control': 'Subscription Packages 💎',
    'financial_accounts': 'Doctor Accounts & Billing 💳',
    'settle_account': 'Settle Payment',
    'total_clinics': 'Total Clinics',
    'active_clinics': 'Active Clinics',
    'suspended_clinics': 'Suspended Clinics',
    'total_branches': 'Total Branches',
    'expiring_subscriptions': 'Expiring Subscriptions',

    // Public Landing Page
    'staff_login': 'Staff Login',
    'patient_portal': 'Patient Portal',
    'clinic_location': 'Clinic Location',
    'whatsapp_consult': 'WhatsApp Consult',
    'book_appointment': 'Book Appointment Now',
    'track_queue': 'Track Your Turn',
    'copyright_notice': '© 2026 Yalla Clinic. All Rights Reserved.',
  }
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('ar')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const storedLang = localStorage.getItem('clinic_os_lang') as Language | null
    if (storedLang === 'en' || storedLang === 'ar') {
      setLanguageState(storedLang)
      applyLanguage(storedLang)
    } else {
      applyLanguage('ar')
    }
  }, [])

  const applyLanguage = (lang: Language) => {
    const root = document.documentElement
    root.lang = lang
    const dir = lang === 'ar' ? 'rtl' : 'ltr'
    root.dir = dir
  }

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem('clinic_os_lang', lang)
    applyLanguage(lang)
  }

  const toggleLanguage = () => {
    const next = language === 'ar' ? 'en' : 'ar'
    setLanguage(next)
  }

  const t = (key: string, fallback?: string): string => {
    const dict = translations[language] || translations.ar
    if (dict && dict[key]) {
      return dict[key]
    }
    return fallback || key
  }

  const dir: 'rtl' | 'ltr' = language === 'ar' ? 'rtl' : 'ltr'
  const isRtl = dir === 'rtl'

  return (
    <LanguageContext.Provider value={{ language, dir, isRtl, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
