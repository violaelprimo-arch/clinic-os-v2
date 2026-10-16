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
    // Brand & App Identity
    'app_name': 'يلا كلينيك Yalla Clinic',
    'app_tagline': 'المنظومة السحابية الذكية لإدارة العيادات والمراكز الطبية',
    'copyright_notice': 'جميع الحقوق محفوظة YallaCodeX 2026',
    'copyright_text': 'جميع الحقوق محفوظة YallaCodeX 2026',

    // Topbar & Global Navigation
    'search_patient_placeholder': 'ابحث عن مريض بالاسم أو رقم الهاتف...',
    'booking_page': 'صفحة الحجز',
    'certified_doctor': 'طبيب معتمد',
    'assistant': 'مساعد العيادة',
    'notifications': 'الإشعارات',
    'no_notifications': 'لا توجد إشعارات جديدة',
    'dark_mode': 'الوضع الليلي',
    'light_mode': 'الوضع النهاري',
    'language': 'اللغة',
    'arabic': 'العربية',
    'english': 'English',
    'all_branches': 'جميع الفروع',
    'select_branch': 'اختر الفرع',
    'live': 'مباشر',
    'clinic_online': 'العيادة مفتوحة (أونلاين)',
    'clinic_offline': 'العيادة مغلقة (أوفلاين)',
    'open_clinic': 'فتح العيادة (بدء الحجز)',
    'close_clinic': 'إغلاق العيادة (إيقاف الحجز)',

    // Sidebar Navigation
    'nav_queue': 'لوحة اليوم',
    'nav_patients': 'سجل المرضى',
    'nav_prescriptions': 'الروشتات الطبية',
    'nav_drugs': 'دليل الأدوية',
    'nav_accounts': 'الحسابات',
    'nav_finance': 'التقارير المالية',
    'nav_branches': 'إدارة الفروع',
    'nav_ai_training': 'المساعد الذكي',
    'nav_settings': 'الإعدادات المتقدمة',
    'upgrade_account': 'ترقية الحساب / الباقات',
    'technical_support': 'تواصل مع الدعم الفني',
    'patient_booking_page': 'صفحة حجز المرضى',
    'logout': 'تسجيل الخروج',

    // Common Buttons & Actions
    'save': 'حفظ التعديلات',
    'save_changes': 'حفظ التغييرات',
    'cancel': 'إلغاء',
    'delete': 'حذف',
    'edit': 'تعديل',
    'add': 'إضافة',
    'add_new': 'إضافة جديد',
    'search': 'بحث',
    'filter': 'تصفية',
    'filter_all': 'الكل',
    'close': 'إغلاق',
    'confirm': 'تأكيد',
    'export_excel': 'تصدير إكسيل',
    'print': 'طباعة',
    'print_receipt': 'طباعة إيصال حراري',
    'print_prescription': 'طباعة روشتة معتمدة',
    'update': 'تحديث',
    'refresh': 'تحديث البيانات',
    'details': 'التفاصيل',
    'actions': 'الإجراءات',
    'view': 'عرض',
    'download': 'تحميل',
    'copy': 'نسخ',
    'copied': 'تم النسخ بنجاح',
    'status': 'الحالة',
    'price': 'السعر',
    'total': 'الإجمالي',
    'currency_egp': 'ج.م',
    'doctor_name': 'اسم الطبيب',
    'clinic_name': 'اسم العيادة',
    'loading': 'جاري التحميل...',
    'no_data': 'لا توجد بيانات متاحة حالياً',
    'all': 'الكل',
    'back': 'رجوع',
    'next': 'التالي',
    'previous': 'السابق',
    'date': 'التاريخ',
    'time': 'الوقت',
    'phone': 'رقم الهاتف',
    'address': 'العنوان',
    'notes': 'ملاحظات',

    // Dashboard & Queue Management
    'today_overview': 'لوحة تحكم اليوم',
    'today_bookings': 'إجمالي حجوزات اليوم',
    'patient_queue': 'طابور الدور والانتظار',
    'current_patient': 'المريض الحالي داخل العيادة',
    'current_patient_desc': 'الكشف جاري حالياً داخل غرفة الكشف',
    'next_patient': 'المريض التالي للدخول',
    'waiting_patients': 'مرضى في الانتظار',
    'completed_patients': 'كشوفات مكتملة',
    'start_exam': 'بدء الكشف',
    'complete_exam': 'إنهاء الكشف',
    'call_patient': 'استدعاء المريض',
    'skip': 'تخطي الدور',
    'no_show': 'لم يحضر',
    'waiting': 'في الانتظار',
    'in_progress': 'جاري الكشف',
    'completed': 'تم الكشف',
    'cancelled': 'تم الإلغاء',
    'skipped': 'تم التخطي',
    'ahead_count': 'مرضى في الانتظار قبلك',
    'estimated_wait': 'الوقت التقديري المتوقع',
    'average_exam_time': 'متوسط وقت الكشف',
    'min': 'دقيقة',
    'turn_number': 'دور رقم',
    'add_discount': 'تطبيق خصم',
    'discount': 'الخصم',
    'net_amount': 'المبلغ الصافي',
    'confirm_payment': 'تأكيد السداد',
    'whatsapp_reminder': 'تنبيه واتساب',
    'whatsapp_receipt': 'إرسال الإيصال واتساب',

    // Financial & Invoicing
    'collected': 'تم التحصيل',
    'pending_payment': 'في انتظار الدفع',
    'total_due': 'المبلغ المستحق',
    'payment_method': 'طريقة الدفع',
    'cash': 'كاش نقدي',
    'instapay': 'انستاباي InstaPay',
    'wallet': 'محفظة إلكترونية',
    'paid': 'مدفوع بالكامل',
    'unpaid': 'غير مسدد (آجل)',
    'invoice_number': 'رقم الفاتورة',
    'service_name': 'الخدمة / الكشف',
    'patient_name': 'اسم المريض',
    'financial_summary': 'الملخص المالي الشامل',
    'total_sales': 'إجمالي المبيعات',
    'total_operations': 'عدد العمليات والزيارات',
    'daily_breakdown': 'الإيرادات اليومية حسب الأسبوع',
    'payment_methods_distribution': 'توزيع طرق الدفع والتحصيل',
    'services_distribution': 'الخدمات الأكثر طلباً',
    'branches_performance': 'مقارنة أداء الفروع',

    // Patients Directory & Medical Records
    'patients_directory': 'دليل وملفات المرضى',
    'add_patient': 'إضافة مريض جديد',
    'patient_details': 'ملف المريض الطبي',
    'patient_age': 'العمر / السن',
    'gender': 'النوع',
    'male': 'ذكر',
    'female': 'أنثى',
    'national_id': 'الرقم القومي',
    'visits_count': 'عدد الزيارات',
    'last_visit': 'آخر زيارة',
    'medical_history': 'التاريخ المرضي',
    'vital_signs': 'العلامات الحيوية',
    'blood_pressure': 'ضغط الدم',
    'pulse': 'النبض',
    'weight': 'الوزن (كجم)',
    'temperature': 'الحرارة',
    'blood_sugar': 'السكر العشوائي',
    'doctor_notes': 'ملاحظات الطبيب التشخيصية',

    // Prescriptions Engine
    'prescriptions_engine': 'منظومة الروشتات الإلكترونية',
    'new_prescription': 'روشتة طبية جديدة',
    'diagnosis': 'التشخيص الطبي',
    'add_drug_to_rx': 'إضافة دواء للروشتة',
    'dosage': 'الجرعة',
    'frequency': 'عدد المرات',
    'duration': 'المدة',
    'rx_notes': 'تعليمات الاستخدام',
    'print_a4': 'طباعة روشتة A4',
    'print_a5': 'طباعة روشتة A5',

    // Drug Directory
    'drug_directory': 'دليل الأدوية والأسعار',
    'drug_name': 'اسم الدواء التجاري',
    'active_ingredient': 'المادة الفعالة',
    'manufacturer': 'الشركة المصنعة',
    'dosage_form': 'الشكل الدوائي',
    'current_price': 'السعر الرسمي',
    'last_updated_on': 'محدث بتاريخ',
    'add_custom_drug': 'إضافة دواء للعيادة',
    'sync_daily_prices': 'تحديث الأسعار اليومية',
    'sync_in_progress': 'جاري فحص وتحديث أسعار الأدوية...',
    'favorites': 'الأدوية المفضلة',
    'all_companies': 'جميع الشركات',
    'all_forms': 'جميع الأشكال الدوائية',

    // Multi-Branch Management
    'branches_management': 'إدارة فروع ومراكز العيادة',
    'add_new_branch': 'إضافة فرع جديد',
    'main_branch': 'الفرع الرئيسي',
    'branch_name': 'اسم الفرع',
    'branch_phone': 'هاتف الفرع',
    'branch_address': 'العنوان التفصيلي',
    'branch_city': 'المدينة / المحافظة',
    'branch_area': 'المنطقة',
    'branch_status': 'حالة الفرع',

    // AI Training
    'ai_bot_training': 'تدريب المساعد الذكي للعيادة',
    'ai_prompt_instructions': 'تعليمات الذكاء الاصطناعي وإجابات العيادة',
    'test_chat_simulator': 'اختبار محادثة المساعد الذكي',
    'send_message': 'إرسال رسالة تجريبية',
    'monthly_ai_usage': 'استهلاك الذكاء الاصطناعي الشهري',

    // Settings
    'clinic_settings': 'إعدادات العيادة والحساب',
    'doctor_profile': 'الملف التعريفي للطبيب',
    'specialty': 'التخصص الطبي',
    'consultation_duration': 'متوسط وقت الكشف المقدر',
    'working_schedule': 'جدول المواعيد الأسبوعي',
    'services_pricing': 'قائمة الخدمات والأسعار',
    'day_saturday': 'السبت',
    'day_sunday': 'الأحد',
    'day_monday': 'الاثنين',
    'day_tuesday': 'الثلاثاء',
    'day_wednesday': 'الأربعاء',
    'day_thursday': 'الخميس',
    'day_friday': 'الجمعة',

    // Platform Owner (Super Admin)
    'owner_dashboard_title': 'لوحة تحكم مالك المنصة Super Admin',
    'owner_dashboard_subtitle': 'إدارة اشتراكات العيادات، حسابات الدكاترة، والتحكم الشامل في المنظومة',
    'owner_super_admin': 'مالك المنصة Super Admin',
    'owner_phone': 'هاتف المالك',
    'owner_whatsapp': 'واتساب المالك',
    'total_clinics': 'إجمالي العيادات',
    'active_clinics': 'عيادات نشطة',
    'suspended_clinics': 'عيادات متوقفة',
    'total_branches': 'إجمالي الفروع',
    'expiring_subscriptions': 'اشتراكات تنتهي قريباً',
    'add_new_clinic': 'إضافة عيادة جديدة',
    'packages_control': 'باقات الاشتراك 💎',
    'financial_accounts': 'حسابات الدكاترة والتحصيل 💳',

    // Patient Website & Booking Flow
    'book_now': 'احجز موعد كشف الآن',
    'track_turn': 'متابعة دورك لحظياً',
    'staff_login': 'دخول الطاقم الطبي',
    'patient_portal': 'بوابة المريض',
    'exit_and_return_home': 'خروج والعودة للرئيسية',
    'booking_step_service': 'اختر الخدمة الطبية',
    'booking_step_patient': 'بيانات المريض',
    'booking_step_confirm': 'تأكيد الحجز وتوليد الدور',
    'required_for_prescription': 'مطلوب للروشتة الطبية',
  },
  en: {
    // Brand & App Identity
    'app_name': 'Yalla Clinic',
    'app_tagline': 'Intelligent Cloud Healthcare Operating System',
    'copyright_notice': '© 2026 Yalla Clinic. All Rights Reserved.',
    'copyright_text': 'All Rights Reserved YallaCodeX 2026',

    // Topbar & Global Navigation
    'search_patient_placeholder': 'Search patient by name or phone...',
    'booking_page': 'Booking Page',
    'certified_doctor': 'Doctor',
    'assistant': 'Clinic Assistant',
    'notifications': 'Notifications',
    'no_notifications': 'No new notifications',
    'dark_mode': 'Dark Mode',
    'light_mode': 'Light Mode',
    'language': 'Language',
    'arabic': 'العربية',
    'english': 'English',
    'all_branches': 'All Branches',
    'select_branch': 'Select Branch',
    'live': 'Live',
    'clinic_online': 'Clinic Open (Online)',
    'clinic_offline': 'Clinic Closed (Offline)',
    'open_clinic': 'Open Clinic (Enable Booking)',
    'close_clinic': 'Close Clinic (Disable Booking)',

    // Sidebar Navigation
    'nav_queue': "Today's Queue",
    'nav_patients': 'Patient Records',
    'nav_prescriptions': 'Prescriptions',
    'nav_drugs': 'Drug Directory',
    'nav_accounts': 'Accounts & Billing',
    'nav_finance': 'Financial Reports',
    'nav_branches': 'Branch Operations',
    'nav_ai_training': 'AI Assistant',
    'nav_settings': 'System Settings',
    'upgrade_account': 'Upgrade / Packages',
    'technical_support': 'Contact Support',
    'patient_booking_page': 'Patient Booking Page',
    'logout': 'Sign Out',

    // Common Buttons & Actions
    'save': 'Save Changes',
    'save_changes': 'Save Changes',
    'cancel': 'Cancel',
    'delete': 'Delete',
    'edit': 'Edit',
    'add': 'Add New',
    'add_new': 'Add New',
    'search': 'Search',
    'filter': 'Filter',
    'filter_all': 'All',
    'close': 'Close',
    'confirm': 'Confirm',
    'export_excel': 'Export Excel',
    'print': 'Print',
    'print_receipt': 'Print Thermal Receipt',
    'print_prescription': 'Print Certified Rx',
    'update': 'Update',
    'refresh': 'Refresh Data',
    'details': 'Details',
    'actions': 'Actions',
    'view': 'View',
    'download': 'Download',
    'copy': 'Copy',
    'copied': 'Copied to clipboard',
    'status': 'Status',
    'price': 'Price',
    'total': 'Total',
    'currency_egp': 'EGP',
    'doctor_name': 'Doctor Name',
    'clinic_name': 'Clinic Name',
    'loading': 'Loading...',
    'no_data': 'No data available',
    'all': 'All',
    'back': 'Back',
    'next': 'Next',
    'previous': 'Previous',
    'date': 'Date',
    'time': 'Time',
    'phone': 'Phone Number',
    'address': 'Address',
    'notes': 'Notes',

    // Dashboard & Queue Management
    'today_overview': "Today's Command Desk",
    'today_bookings': "Today's Total Bookings",
    'patient_queue': 'Live Waiting Queue',
    'current_patient': 'Current Patient in Consultation',
    'current_patient_desc': 'Examination currently in progress',
    'next_patient': 'Next Patient to Enter',
    'waiting_patients': 'Waiting Patients',
    'completed_patients': 'Completed Visits',
    'start_exam': 'Start Consultation',
    'complete_exam': 'Complete Consultation',
    'call_patient': 'Call Patient',
    'skip': 'Skip Turn',
    'no_show': 'No Show',
    'waiting': 'Waiting',
    'in_progress': 'In Progress',
    'completed': 'Completed',
    'cancelled': 'Cancelled',
    'skipped': 'Skipped',
    'ahead_count': 'Patients ahead in queue',
    'estimated_wait': 'Estimated wait time',
    'average_exam_time': 'Average Consultation Time',
    'min': 'mins',
    'turn_number': 'Ticket #',
    'add_discount': 'Apply Discount',
    'discount': 'Discount',
    'net_amount': 'Net Amount',
    'confirm_payment': 'Confirm Payment',
    'whatsapp_reminder': 'WhatsApp Alert',
    'whatsapp_receipt': 'Send Receipt via WhatsApp',

    // Financial & Invoicing
    'collected': 'Collected',
    'pending_payment': 'Pending Payment',
    'total_due': 'Total Due',
    'payment_method': 'Payment Method',
    'cash': 'Cash',
    'instapay': 'InstaPay',
    'wallet': 'E-Wallet',
    'paid': 'Paid in Full',
    'unpaid': 'Unpaid / Receivable',
    'invoice_number': 'Invoice #',
    'service_name': 'Service / Exam',
    'patient_name': 'Patient Name',
    'financial_summary': 'Financial Executive Summary',
    'total_sales': 'Total Sales',
    'total_operations': 'Total Visits & Procedures',
    'daily_breakdown': 'Weekly Revenue Distribution',
    'payment_methods_distribution': 'Payment Methods Distribution',
    'services_distribution': 'Most Requested Services',
    'branches_performance': 'Branch Performance Comparison',

    // Patients Directory & Medical Records
    'patients_directory': 'Patient Medical Records',
    'add_patient': 'New Patient File',
    'patient_details': 'Patient Profile',
    'patient_age': 'Age',
    'gender': 'Gender',
    'male': 'Male',
    'female': 'Female',
    'national_id': 'National ID',
    'visits_count': 'Total Visits',
    'last_visit': 'Last Visit',
    'medical_history': 'Medical History',
    'vital_signs': 'Vital Signs',
    'blood_pressure': 'Blood Pressure',
    'pulse': 'Pulse BPM',
    'weight': 'Weight (kg)',
    'temperature': 'Temperature °C',
    'blood_sugar': 'Random Blood Sugar',
    'doctor_notes': 'Clinical Diagnostic Notes',

    // Prescriptions Engine
    'prescriptions_engine': 'Digital Prescriptions Engine',
    'new_prescription': 'New Prescription',
    'diagnosis': 'Clinical Diagnosis',
    'add_drug_to_rx': 'Add Medication',
    'dosage': 'Dosage',
    'frequency': 'Frequency',
    'duration': 'Duration',
    'rx_notes': 'Instructions & Notes',
    'print_a4': 'Print A4 Document',
    'print_a5': 'Print A5 Document',

    // Drug Directory
    'drug_directory': 'Drug Directory & Prices',
    'drug_name': 'Brand Name',
    'active_ingredient': 'Active Ingredient',
    'manufacturer': 'Manufacturer',
    'dosage_form': 'Dosage Form',
    'current_price': 'Official Price',
    'last_updated_on': 'Updated on',
    'add_custom_drug': 'Add Clinic Drug',
    'sync_daily_prices': 'Sync Daily Prices',
    'sync_in_progress': 'Checking & verifying prices...',
    'favorites': 'Favorite Medicines',
    'all_companies': 'All Manufacturers',
    'all_forms': 'All Dosage Forms',

    // Multi-Branch Management
    'branches_management': 'Branch & Center Operations',
    'add_new_branch': 'Add New Branch',
    'main_branch': 'Main Branch',
    'branch_name': 'Branch Name',
    'branch_phone': 'Branch Phone',
    'branch_address': 'Physical Address',
    'branch_city': 'City / Governorate',
    'branch_area': 'Area / District',
    'branch_status': 'Operational Status',

    // AI Training
    'ai_bot_training': 'AI Medical Bot Knowledge',
    'ai_prompt_instructions': 'System Instructions & Clinic FAQ',
    'test_chat_simulator': 'Test AI Chat Simulator',
    'send_message': 'Send Test Prompt',
    'monthly_ai_usage': 'Monthly AI Token Usage',

    // Settings
    'clinic_settings': 'Clinic & Profile Settings',
    'doctor_profile': 'Doctor Public Profile',
    'specialty': 'Medical Specialty',
    'consultation_duration': 'Estimated Exam Duration',
    'working_schedule': 'Weekly Operating Schedule',
    'services_pricing': 'Services & Pricing Catalog',
    'day_saturday': 'Saturday',
    'day_sunday': 'Sunday',
    'day_monday': 'Monday',
    'day_tuesday': 'Tuesday',
    'day_wednesday': 'Wednesday',
    'day_thursday': 'Thursday',
    'day_friday': 'Friday',

    // Platform Owner (Super Admin)
    'owner_dashboard_title': 'Platform Owner Dashboard (Super Admin)',
    'owner_dashboard_subtitle': 'Clinic Subscriptions, Doctor Accounts & Enterprise Controls',
    'owner_super_admin': 'Platform Super Admin',
    'owner_phone': 'Owner Phone',
    'owner_whatsapp': 'Owner WhatsApp',
    'total_clinics': 'Total Clinics',
    'active_clinics': 'Active Clinics',
    'suspended_clinics': 'Suspended Clinics',
    'total_branches': 'Total Branches',
    'expiring_subscriptions': 'Expiring Subscriptions',
    'add_new_clinic': 'Add New Clinic',
    'packages_control': 'Subscription Packages 💎',
    'financial_accounts': 'Doctor Accounts & Settlement 💳',

    // Patient Website & Booking Flow
    'book_now': 'Book Consultation Now',
    'track_turn': 'Track Live Turn',
    'staff_login': 'Staff Portal',
    'patient_portal': 'Patient Portal',
    'exit_and_return_home': 'Exit & Return Home',
    'booking_step_service': 'Select Service',
    'booking_step_patient': 'Patient Details',
    'booking_step_confirm': 'Confirm & Generate Ticket',
    'required_for_prescription': 'Required for Prescription',
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
    if (typeof document === 'undefined') return
    const root = document.documentElement
    root.lang = lang
    const dir = lang === 'ar' ? 'rtl' : 'ltr'
    root.dir = dir
    if (dir === 'rtl') {
      root.classList.add('rtl')
      root.classList.remove('ltr')
    } else {
      root.classList.add('ltr')
      root.classList.remove('rtl')
    }
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
    // Fallback to Arabic dict if key missing in English
    if (translations.ar && translations.ar[key]) {
      return translations.ar[key]
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
