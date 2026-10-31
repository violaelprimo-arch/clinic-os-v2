import { z } from 'zod'

const text = z.string().trim().max(4000)
const short = z.string().trim().max(250)
const id = z.string().min(1).max(100)
const image = z
  .string()
  .max(1000000)
  .refine(
    (v) => !v || /^https?:\/\//.test(v) || /^\/(?!\/)/.test(v),
    'استخدم رابط صورة صالح أو مسارًا داخل الموقع',
  )
  .default('')

const externalOrLocalLink = z
  .string()
  .max(500)
  .refine(
    (value) => !value || /^https?:\/\//.test(value) || /^\/(?!\/)/.test(value) || /^#[\w-]+$/.test(value),
    'استخدم رابط HTTPS أو مسارًا داخل الموقع أو قسمًا (#)',
  )
  .default('')

const link = z
  .string()
  .max(500)
  .refine((v) => !v || /^\/(?!\/)/.test(v) || /^https?:\/\//.test(v), 'الرابط غير صالح')
  .default('/clinic/zizo/login')

// 0. 3D Orbit Interactive Pillars Schema
const orbitCard = z.object({
  id: id.default(() => Math.random().toString(36).substring(2, 9)),
  title: short,
  titleEn: short.default(''),
  subtitle: short.default(''),
  subtitleEn: short.default(''),
  description: text.default(''),
  descriptionEn: text.default(''),
  iconName: short.default('CalendarCheck'),
  cardColor: short.default('#00a8e8'),
  glowColor: short.default('rgba(0, 168, 232, 0.45)'),
  textColor: short.default('#ffffff'),
  buttonText: short.default(''),
  buttonTextEn: short.default(''),
  buttonLink: externalOrLocalLink.default(''),
  order: z.number().int().default(0),
  visible: z.boolean().default(true),
  isDefaultActive: z.boolean().default(false),
})

// 1. Features Schema (Real clinical pillars for Doctor, Reception, Patient)
const feature = z.object({
  id,
  iconName: short.default('Calendar'),
  title: short,
  description: text,
  category: short.default('general'),
  badge: short.default(''),
  imageUrl: image.default(''),
  practicalBenefit: short.default(''),
  targetAudience: z.enum(['all', 'doctor', 'reception', 'patient']).default('all'),
  visible: z.boolean().default(true),
  titleEn: short.default(''),
  descriptionEn: text.default(''),
  badgeEn: short.default(''),
  practicalBenefitEn: short.default(''),
})

// 2. Screenshots / Gallery Schema
const screenshot = z.object({
  id,
  title: short,
  subtitle: text,
  category: short.default('النظام'),
  imageUrl: image,
  altText: short.default(''),
  highlights: z.array(short).max(12).default([]),
  visible: z.boolean().default(true),
  titleEn: short.default(''),
  subtitleEn: text.default(''),
  categoryEn: short.default('System'),
  highlightsEn: z.array(short).max(12).default([]),
})

// 3. How It Works Steps Schema
const stepItem = z.object({
  id,
  number: z.number().int().min(1).max(10),
  title: short,
  description: text,
  iconName: short.default('CheckCircle2'),
  visible: z.boolean().default(true),
  titleEn: short.default(''),
  descriptionEn: text.default(''),
  color: z.string().optional(),
})

// 4. Partner / Client Clinics Schema
const client = z.object({
  id,
  name: short,
  specialty: short.default(''),
  city: short.default(''),
  logoUrl: image.default(''),
  link: externalOrLocalLink.default(''),
  collaborationNote: text.default(''),
  visible: z.boolean().default(true),
  nameEn: short.default(''),
  specialtyEn: short.default(''),
})

// 5. Reviews / Testimonials Schema
const feedback = z.object({
  id,
  authorName: short.min(2),
  clinicName: short,
  specialty: short.default(''),
  rating: z.number().int().min(1).max(5).default(5),
  comment: text.min(3),
  avatarUrl: image.default(''),
  createdAt: z.string().max(40).default(() => new Date().toISOString()),
  approved: z.boolean().default(true),
  visible: z.boolean().default(true),
})

// 6. Pricing Packages Schema
const pricingPlan = z.object({
  id,
  name: short,
  price: short,
  period: short.default('شهرياً'),
  badge: short.default(''),
  features: z.array(short).default([]),
  popular: z.boolean().default(false),
  isFree: z.boolean().default(false),
  visible: z.boolean().default(true),
  nameEn: short.default(''),
  priceEn: short.default(''),
  periodEn: short.default('monthly'),
  featuresEn: z.array(short).default([]),
})

// 7. FAQ Schema
const faqItem = z.object({
  id,
  question: short,
  answer: text,
  category: short.default('عام'),
  visible: z.boolean().default(true),
  questionEn: short.default(''),
  answerEn: text.default(''),
})

// 8. Contact Numbers Schema
const contact = z.object({
  id,
  number: short.min(5),
  whatsappNumber: z.string().max(25).default(''),
  roleTitle: short,
  roleTitleEn: short.default(''),
  isPrimary: z.boolean().default(false),
  whatsappEnabled: z.boolean().default(true),
  visible: z.boolean().default(true),
})

// 9. Statistics Schema (Dual-Source: Automated Firestore metric or Documented Manual stat)
const statItem = z.object({
  id: id.default(() => Math.random().toString(36).substring(2, 9)),
  label: short,
  value: short,
  unit: short.default(''),
  iconName: short.default('TrendingUp'),
  sourceType: z.enum(['manual', 'automated']).default('manual'),
  autoMetricKey: z.enum(['clinics', 'doctors', 'visits', 'prescriptions']).optional().nullable(),
  sourceNote: text.default(''),
  visible: z.boolean().default(true),
  labelEn: short.default(''),
  valueEn: short.default(''),
})

export const DEFAULT_ENGLISH_TEXTS = {
  heroBadge: 'Smart Clinic Operating System',
  heroTitle: 'Your clinic organized.',
  heroHighlight: 'More time for your patients.',
  heroSubtitle:
    'A unified SaaS platform for doctors and clinics in Egypt and the MENA region. Seamlessly manage appointments, live queue tracking, patient EMR, A4 prescriptions, and finances in one place.',
  trialButtonText: 'Request Free Trial',
  galleryButtonText: 'View System Screenshots',
  demoButtonText: 'Interactive Tour',
  patientPortalButtonText: 'Patient Portal',
  loginButtonText: 'Clinic Login',
  footerText: '© 2026 Yalla Clinic — Developed by YallaCodeX. All rights reserved.',
  demoSectionTitle: 'Real System Screenshots',
  demoSectionSubtitle: 'Explore authentic interfaces of Yalla Clinic OS used by medical doctors every day.',
}

// English Localization Schema
const english = z.object({
  heroBadge: text.default(DEFAULT_ENGLISH_TEXTS.heroBadge),
  heroTitle: text.default(DEFAULT_ENGLISH_TEXTS.heroTitle),
  heroHighlight: text.default(DEFAULT_ENGLISH_TEXTS.heroHighlight),
  heroSubtitle: text.default(DEFAULT_ENGLISH_TEXTS.heroSubtitle),
  trialButtonText: short.default(DEFAULT_ENGLISH_TEXTS.trialButtonText),
  galleryButtonText: short.default(DEFAULT_ENGLISH_TEXTS.galleryButtonText),
  demoButtonText: short.default(DEFAULT_ENGLISH_TEXTS.demoButtonText),
  patientPortalButtonText: short.default(DEFAULT_ENGLISH_TEXTS.patientPortalButtonText),
  loginButtonText: short.default(DEFAULT_ENGLISH_TEXTS.loginButtonText),
  footerText: text.default(DEFAULT_ENGLISH_TEXTS.footerText),
  demoSectionTitle: short.default(DEFAULT_ENGLISH_TEXTS.demoSectionTitle),
  demoSectionSubtitle: text.default(DEFAULT_ENGLISH_TEXTS.demoSectionSubtitle),
})

export const DEFAULT_SECTION_ORDER = [
  'navbar',
  'hero',
  'stats',
  'features',
  'gallery',
  'steps',
  'testimonials',
  'partners',
  'pricing',
  'faq',
  'contact',
  'cta',
  'footer',
]

// Theme and Layout Settings Schemas
export const themeSettingsSchema = z.object({
  primaryColorPreset: z.enum(['emerald', 'teal', 'blue', 'indigo', 'cyan']).default('blue'),
  borderRadiusPreset: z.enum(['rounded-md', 'rounded-xl', 'rounded-2xl', 'rounded-3xl']).default('rounded-2xl'),
  motionLevel: z.enum(['subtle', 'normal', 'none', 'advanced']).default('subtle'),
  enableBackgroundAnimation: z.boolean().default(true),
  enable3DTilt: z.boolean().default(true),
  enableHero3D: z.boolean().default(true),
  enableCardGlow: z.boolean().default(true),
  motionSpeed: z.enum(['slow', 'normal', 'fast']).default('normal'),
  enableMobileMotion: z.boolean().default(true),
  enableSectionMotion: z.boolean().default(true),
  spacingPreset: z.enum(['compact', 'comfortable', 'spacious']).default('comfortable'),
  customPrimaryColor: z.string().optional(),
  customSecondaryColor: z.string().optional(),
  customAccentColor: z.string().optional(),
  customGlowColor: z.string().optional(),
  orbitRotationSpeed: z.enum(['slow', 'normal', 'fast']).default('normal'),
  cardGlowIntensity: z.enum(['subtle', 'medium', 'intense']).default('medium'),
  headingSizePreset: z.enum(['normal', 'large', 'display']).default('normal'),
})

export const sectionLayoutSchema = z.object({
  heroLayout: z.enum(['split', 'centered', 'card-preview']).default('split'),
  featuresLayout: z.enum(['grouped', 'grid', 'cards']).default('grouped'),
  galleryLayout: z.enum(['carousel', 'grid']).default('carousel'),
  pricingLayout: z.enum(['highlight-pro', 'grid']).default('highlight-pro'),
})

export const DEFAULT_THEME_SETTINGS = {
  primaryColorPreset: 'blue' as const,
  borderRadiusPreset: 'rounded-2xl' as const,
  motionLevel: 'subtle' as const,
  enableBackgroundAnimation: true,
  enable3DTilt: true,
  enableHero3D: true,
  enableCardGlow: true,
  motionSpeed: 'normal' as const,
  enableMobileMotion: true,
  enableSectionMotion: true,
  spacingPreset: 'comfortable' as const,
  customPrimaryColor: '#0066dc',
  customGlowColor: '#38bdf8',
  orbitRotationSpeed: 'normal' as const,
  cardGlowIntensity: 'medium' as const,
  headingSizePreset: 'normal' as const,
}

export const DEFAULT_LAYOUT_SETTINGS = {
  heroLayout: 'split' as const,
  featuresLayout: 'grouped' as const,
  galleryLayout: 'carousel' as const,
  pricingLayout: 'highlight-pro' as const,
}

// Main Landing Page Configuration Schema
export const landingConfigSchema = z.object({
  heroBadge: text,
  heroTitle: text,
  heroHighlight: text,
  heroSubtitle: text,
  heroImage: image.default(''),
  trialButtonText: short.default('طلب تجربة مجانية'),
  trialDaysCount: z.number().int().min(0).max(90).default(14),
  galleryButtonText: short.default('جولة في صور النظام'),
  demoButtonText: short.default('جولة بالنظام'),
  patientPortalButtonText: short.default('بوابة المريض'),
  loginButtonText: short.default('تسجيل الدخول للعيادة'),
  loginUrl: link,
  demoUrl: link,
  patientUrl: link,
  primaryWhatsapp: z.string().max(25).default('201551007018'),
  footerText: text,
  demoSectionTitle: short.default('معرض واجهات يلا كلينيك الحقيقية'),
  demoSectionSubtitle: text.default('استكشف صوراً حقيقية من شاشات النظام المستخدمة يومياً في إدارة العيادات والمراكز الطبية.'),
  english: english.default(DEFAULT_ENGLISH_TEXTS),
  sectionOrder: z.array(z.string()).default(DEFAULT_SECTION_ORDER),
  visibility: z.object({
    showNavbar: z.boolean().default(true),
    showHero: z.boolean().default(true),
    showStats: z.boolean().default(true),
    showFeatures: z.boolean().default(true),
    showScreenshots: z.boolean().default(true),
    showSteps: z.boolean().default(true),
    showClients: z.boolean().default(true),
    showFeedback: z.boolean().default(true),
    showPricing: z.boolean().default(true),
    showFaq: z.boolean().default(true),
    showContactForm: z.boolean().default(true),
    allowClientFeedbackSubmission: z.boolean().default(true),
    showContacts: z.boolean().default(true),
    showFloatingWhatsapp: z.boolean().default(true),
    showTrialBanner: z.boolean().default(false),
    showFooter: z.boolean().default(true),
  }),
  themeSettings: themeSettingsSchema.default(DEFAULT_THEME_SETTINGS),
  layoutSettings: sectionLayoutSchema.default(DEFAULT_LAYOUT_SETTINGS),
  orbitCards: z.array(orbitCard).default([]),
  gallerySettings: z.object({
    autoplay: z.boolean().default(true),
    intervalSeconds: z.number().min(2).max(20).default(6),
  }).default({ autoplay: true, intervalSeconds: 6 }),
  stats: z.array(statItem).default([]),
  features: z.array(feature).default([]),
  screenshots: z.array(screenshot).default([]),
  steps: z.array(stepItem).default([]),
  clients: z.array(client).default([]),
  feedbacks: z.array(feedback).default([]),
  pricingPlans: z.array(pricingPlan).default([]),
  faqItems: z.array(faqItem).default([]),
  contacts: z.array(contact).default([]),
})

export type LandingPageConfig = z.infer<typeof landingConfigSchema>
export type OrbitCardItem = z.infer<typeof orbitCard>
export type FeatureItem = z.infer<typeof feature>
export type ScreenshotItem = z.infer<typeof screenshot>
export type StepItem = z.infer<typeof stepItem>
export type FeedbackItem = z.infer<typeof feedback>
export type PricingPlanItem = z.infer<typeof pricingPlan>
export type FaqItem = z.infer<typeof faqItem>
export type ClientItem = z.infer<typeof client>
export type ContactItem = z.infer<typeof contact>
export type StatItem = z.infer<typeof statItem>
export type ThemeSettings = z.infer<typeof themeSettingsSchema>
export type SectionLayout = z.infer<typeof sectionLayoutSchema>

export type TrialRequestItem = {
  id: string
  requestNumber?: string
  doctorName: string
  clinicName: string
  specialty: string
  phone: string
  email: string
  governorate?: string
  city?: string
  address?: string
  expectedPatientsPerDay?: string
  notes: string
  createdAt: string
  status: 'new' | 'reviewing' | 'approved' | 'rejected' | 'clinic_created' | 'contacted' | 'activated'
}

export type LandingInquiryItem = {
  id: string
  type: 'suggestion' | 'complaint' | 'inquiry'
  name: string
  contact: string
  subject: string
  message: string
  createdAt: string
  status: 'new' | 'in_progress' | 'resolved' | 'closed'
  internalNotes?: string
}

export const DEFAULT_ORBIT_CARDS: OrbitCardItem[] = [
  {
    id: 'orbit-booking',
    title: 'حجز فوري ومتابعة الدور',
    titleEn: 'Instant Booking & Live Turn',
    subtitle: 'حجز بالهاتف بدون كلمات مرور',
    subtitleEn: 'Seamless Phone Booking',
    description: 'حجز فوري برقم الموبايل دون الحاجة لأكواد OTP أو حسابات معقدة، مع تتبع دقيق للدور والوقت التقديري للدخول من المنزل.',
    descriptionEn: 'Frictionless patient self-booking with real-time home queue tracking.',
    iconName: 'CalendarCheck',
    cardColor: '#00a8e8',
    glowColor: 'rgba(0, 168, 232, 0.45)',
    textColor: '#ffffff',
    buttonText: 'جرب الحجز الآن',
    buttonTextEn: 'Book Now',
    buttonLink: '#contact',
    order: 0,
    visible: true,
    isDefaultActive: true,
  },
  {
    id: 'orbit-tv',
    title: 'تلفزيون الانتظار والنداء الصوتي',
    titleEn: 'Waiting Room TV & Voice Call',
    subtitle: 'عرض ذكي على شاشات Smart TV',
    subtitleEn: 'Smart TV Queue Display',
    description: 'شاشة مخصصة لغرف الانتظار تعمل على أي تلفزيون سمارت، تعرض رقم الدور الحالي واسم المريض وغرفة الكشف مع تنبيه صوتي فوري.',
    descriptionEn: 'Real-time patient call screen designed for waiting room TVs with audio alerts.',
    iconName: 'Tv',
    cardColor: '#0284c7',
    glowColor: 'rgba(2, 132, 199, 0.45)',
    textColor: '#ffffff',
    buttonText: 'عرض الشاشة',
    buttonTextEn: 'View TV Screen',
    buttonLink: '/clinic/zizo/tv',
    order: 1,
    visible: true,
    isDefaultActive: false,
  },
  {
    id: 'orbit-emr',
    title: 'الملف الطبي الإلكتروني EMR',
    titleEn: 'Integrated Medical EMR',
    subtitle: 'سجل تراكمي للزيارات والتحاليل',
    subtitleEn: 'Complete Clinical History',
    description: 'ملف موحد لكل مريض يوثق التشخيصات السابقة، الفحوصات والتحاليل، والأدوية المزمنة، لسهولة المتابعة الطبية بضغطة واحدة.',
    descriptionEn: 'Unified patient records tracking previous diagnoses, labs, and chronic conditions.',
    iconName: 'FileText',
    cardColor: '#6366f1',
    glowColor: 'rgba(99, 102, 241, 0.45)',
    textColor: '#ffffff',
    buttonText: 'استعراض الملف',
    buttonTextEn: 'Explore EMR',
    buttonLink: '#features',
    order: 2,
    visible: true,
    isDefaultActive: false,
  },
  {
    id: 'orbit-rx',
    title: 'الروشتة الذكية وقوالب Rx',
    titleEn: 'Smart A4 Rx & Protocols',
    subtitle: 'دليل الأدوية وطباعة رسمية A4',
    subtitleEn: 'Drug Guide & Branded A4 Print',
    description: 'محرر روشتات متقدم مرتبط بدليل الأدوية المصري، مع بروتوكولات علاجية جاهزة بضغطة زر، وطباعة رسمية معتمدة بباركود وهوية العيادة.',
    descriptionEn: 'Advanced prescription generator with Egyptian drug directory and branded A4 print.',
    iconName: 'FileSignature',
    cardColor: '#10b981',
    glowColor: 'rgba(16, 185, 129, 0.45)',
    textColor: '#ffffff',
    buttonText: 'نموذج الروشتة',
    buttonTextEn: 'View Sample Rx',
    buttonLink: '#features',
    order: 3,
    visible: true,
    isDefaultActive: false,
  },
  {
    id: 'orbit-billing',
    title: 'الحسابات وتقفيل الوردية',
    titleEn: 'Daily Billing & Financials',
    subtitle: 'سندات قبض وكاش ومحافظ وانستاباي',
    subtitleEn: 'Multi-Payment Shift Closeout',
    description: 'تسجيل مدفوعات الكشوفات والخدمات، تتبع طرق الدفع، واستخراج تقارير تقفيل الوردية اليومية بدقة 100% بدون أي فروقات حسابية.',
    descriptionEn: 'Track service fees, payment methods (Cash/Wallet/InstaPay), and daily shift closure reports.',
    iconName: 'Receipt',
    cardColor: '#f59e0b',
    glowColor: 'rgba(245, 158, 11, 0.45)',
    textColor: '#ffffff',
    buttonText: 'الحسابات والتقارير',
    buttonTextEn: 'Financial Reports',
    buttonLink: '#features',
    order: 4,
    visible: true,
    isDefaultActive: false,
  },
]

// 7 Verified Clinical Features categorized for Doctor, Reception, and Patient
export const DEFAULT_CLINICAL_FEATURES: FeatureItem[] = [
  // Group 1: Doctor Workspace
  {
    id: 'emr-records',
    iconName: 'FileSignature',
    title: 'السجل الطبي المتكامل واسترجاع الزيارات',
    description: 'سجل تراكمي شامل لكل مريض يتضمن تاريخ التشخيصات السابقة، التحاليل والفحوصات، دون الحاجة للدفاتر الورقية المعرضة للتلف.',
    practicalBenefit: 'الرجوع الفوري لتاريخ زيارات المريض السابقة بنقرة واحدة.',
    category: 'doctor',
    targetAudience: 'doctor',
    badge: 'السجل الطبي للمريض',
    imageUrl: '',
    visible: true,
    titleEn: 'Comprehensive Patient EMR & Visit History',
    descriptionEn: 'Unified electronic medical records tracking diagnoses, labs, and past visits in one secure view.',
    practicalBenefitEn: 'Instant access to patient visit history in 1 click.',
    badgeEn: 'Patient EMR'
  },
  {
    id: 'rx-protocols',
    iconName: 'FileSignature',
    title: 'محرر الروشتات الإلكترونية وقوالب Rx الجاهزة',
    description: 'إدراج الأدوية والجرعات من دليل الأدوية المصري، مع بروتوكولات علاجية جاهزة بضغطة زر وطباعة روشتات A4 رسمية بباركود وهوية العيادة.',
    practicalBenefit: 'كتابة الروشتة في ثوانٍ وطباعتها بروتوكولياً دون أخطاء كتابية.',
    category: 'doctor',
    targetAudience: 'doctor',
    badge: 'الروشتة الإلكترونية A4',
    imageUrl: '',
    visible: true,
    titleEn: 'Digital Prescription & 1-Click Rx Protocols',
    descriptionEn: 'Dosages from built-in drug guide, 1-click protocols for common conditions, and branded A4 printing.',
    practicalBenefitEn: 'Write and print official prescriptions in seconds.',
    badgeEn: 'Digital Rx'
  },
  // Group 2: Reception & Admin
  {
    id: 'clinic-schedule-tv',
    iconName: 'Tv',
    title: 'تنظيم المواعيد وشاشة نداء المرضى (TV)',
    description: 'لوحة استدعاء متزامنة لشاشات الانتظار بالعيادة تعرض رقم الدور واسم المريض وغرفة الكشف بدقة متناهية ودون فوضى.',
    practicalBenefit: 'إنهاء تكدس الاستقبال واستدعاء المرضى آلياً على الشاشة.',
    category: 'reception',
    targetAudience: 'reception',
    badge: 'الاستقبال وشاشة TV',
    imageUrl: '',
    visible: true,
    titleEn: 'Appointment Control & Waiting Room TV Screen',
    descriptionEn: 'Real-time patient call screen designed for waiting room TVs, with effortless appointment schedule control.',
    practicalBenefitEn: 'Eliminate reception lobby chaos with real-time TV calling.',
    badgeEn: 'Reception & TV'
  },
  {
    id: 'finance-invoices',
    iconName: 'Receipt',
    title: 'سندات القبض وحسابات اليومية والتقارير',
    description: 'تسجيل دقيق لإيرادات الكشوفات والخدمات، وتتبع طرق الدفع (نقدي / محفظة / انستاباي)، واستخراج تقفيل الوردية اليومي في ملفات جاهزة للطباعة.',
    practicalBenefit: 'تقفيل الحسابات اليومية بدقة 100% ومنع أي فروقات مالية.',
    category: 'reception',
    targetAudience: 'reception',
    badge: 'الحسابات والمالية',
    imageUrl: '',
    visible: true,
    titleEn: 'Daily Billing, Invoices & Financial Reports',
    descriptionEn: 'Track service fees, payment methods (Cash/Wallet/InstaPay), and daily shift closure reports.',
    practicalBenefitEn: '100% accurate daily shift closeout with zero discrepancies.',
    badgeEn: 'Billing & Reports'
  },
  {
    id: 'multi-branch-team',
    iconName: 'Building2',
    title: 'إدارة الفروع وصلاحيات الاستقبال والمساعدين',
    description: 'تشغيل فروع العيادة المتعددة في شاشة واحدة، وتوزيع الصلاحيات بحيث يرى كل موظف فقط ما يخص عمله مع حماية تامة لسرية البيانات.',
    practicalBenefit: 'إدارة أكثر من عيادة وغرفة كشف في مكان واحد مع ضبط الصلاحيات.',
    category: 'reception',
    targetAudience: 'reception',
    badge: 'الفروع والصلاحيات',
    imageUrl: '',
    visible: true,
    titleEn: 'Multi-Branch Management & Staff Roles',
    descriptionEn: 'Manage multiple branches and schedules with dedicated role-based access for reception staff and doctors.',
    practicalBenefitEn: 'Multi-branch control with granular staff permission boundaries.',
    badgeEn: 'Branches & Roles'
  },
  // Group 3: Patient Experience
  {
    id: 'queue-booking',
    iconName: 'CalendarCheck',
    title: 'حجز مباشر برقم الموبايل دون تعقيد',
    description: 'صفحة حجز أنيقة وسريعة تتيح للمريض اختيار اليوم والموعد برقم الهاتف فقط، دون الحاجة لإنشاء حساب معقد أو كلمات سر مفقودة.',
    practicalBenefit: 'حجز فوري في أقل من 30 ثانية يقلل اتصالات الاستقبال الهاتفية.',
    category: 'patient',
    targetAudience: 'patient',
    badge: 'الحجز السريع',
    imageUrl: '',
    visible: true,
    titleEn: 'Frictionless Phone Booking for Patients',
    descriptionEn: 'Online appointment booking using phone numbers without complex account passwords.',
    practicalBenefitEn: 'Instant 30-second patient self-booking directly from mobile.',
    badgeEn: 'Easy Booking'
  },
  {
    id: 'live-turn-tracking',
    iconName: 'Clock',
    title: 'متابعة الدور الذكي والانتظار من المنزل',
    description: 'شاشة تتبع لحظية في بوابة المريض تعرض الترتيب الحالي بالعيادة ووقت الدخول المتوقع، ليتوجه المريض للعيادة في موعده تماماً.',
    practicalBenefit: 'متابعة الدور من المنزل والحضور في الموعد الفعلي دون الجلوس في الزحام.',
    category: 'patient',
    targetAudience: 'patient',
    badge: 'الدور المباشر',
    imageUrl: '',
    visible: true,
    titleEn: 'Live Queue Tracking & Home Wait',
    descriptionEn: 'Real-time patient turn tracker showing position and expected doctor entry time on mobile.',
    practicalBenefitEn: 'Patients track queue from home and arrive right on time.',
    badgeEn: 'Live Turn'
  }
]

// Default Steps (How It Works)
export const DEFAULT_STEPS: StepItem[] = [
  {
    id: 'step-1',
    number: 1,
    title: 'طلب التجربة وتجهيز حساب العيادة',
    description: 'سجّل بياناتك في دقيقة واحدة، وسيتولى فريقنا تجهيز حساب العيادة وتفعيل رابط الحجز الخاص بك مجاناً.',
    iconName: 'Rocket',
    visible: true,
    titleEn: 'Request Trial & Setup Clinic Account',
    descriptionEn: 'Submit your clinic info in 1 minute, and our team configures your clinic workspace immediately.'
  },
  {
    id: 'step-2',
    number: 2,
    title: 'إدخال الخدمات وتحديد مواعيد العمل',
    description: 'أضف خدمات الكشف والاستشارة، وأسعار الخدمات، وحدد مواعيد عمل الطبيب والفروع وصلاحيات الاستقبال بسهولة.',
    iconName: 'Settings',
    visible: true,
    titleEn: 'Configure Services & Schedules',
    descriptionEn: 'Add your services, consultation fees, weekly schedules, branches, and reception staff credentials.'
  },
  {
    id: 'step-3',
    number: 3,
    title: 'بدء استقبال المرضى وإصدار الروشتات',
    description: 'ابدأ يوم عملك الطبي: متابعة لحظية لترتيب المرضى، كتابة التشخيص، طباعة الروشتات الرسمية، وتتبع الحسابات والتقارير.',
    iconName: 'CheckCircle2',
    visible: true,
    titleEn: 'Start Seeing Patients & Issuing Rx',
    descriptionEn: 'Run your clinic day: real-time patient queue, clinical diagnosis, branded A4 prescriptions, and daily billing.'
  }
]

// Default Transparent Pricing Plans
export const DEFAULT_PRICING_PLANS: PricingPlanItem[] = [
  {
    id: 'basic-clinic',
    name: 'باقة العيادة الفردية',
    price: '450',
    period: 'شهرياً',
    badge: 'للعيادات المستقلة',
    popular: false,
    isFree: false,
    visible: true,
    features: [
      'حساب طبيب واحد + مستخدم استقبال',
      'حجز إلكتروني برقم الموبايل بدون OTP',
      'متابعة الدور اللحظي للمرضى (Live Turn)',
      'سجل طبي كامل وكتابة الروشتات A4',
      'دليل الأدوية المصري والجرعات',
      'سندات القبض والفواتير اليومية'
    ],
    nameEn: 'Solo Clinic Plan',
    priceEn: '450',
    periodEn: 'monthly',
    featuresEn: [
      '1 Doctor account + 1 Reception user',
      'Online booking with phone number',
      'Live Queue Tracking (Live Turn)',
      'Full patient EMR & A4 prescriptions',
      'Egyptian drug directory with dosages',
      'Daily billing and receipt printing'
    ]
  },
  {
    id: 'pro-clinic',
    name: 'باقة الاحتراف والنمو',
    price: '950',
    period: 'شهرياً',
    badge: 'الأكثر اختياراً',
    popular: true,
    isFree: false,
    visible: true,
    features: [
      'جميع مزايا الباقة الفردية بالكامل',
      'شاشة استدعاء المرضى التلفزيونية (TV Call Screen)',
      'قوالب الروشتات الجاهزة بنقرة واحدة (Rx Protocols)',
      'توزيع المرضى الجغرافي وخريطة الفروع',
      'تقارير مالية تفصيلية ومخططات بيانية',
      'دعم فني وأولوية التخصيص والتدريب'
    ],
    nameEn: 'Professional Growth Plan',
    priceEn: '950',
    periodEn: 'monthly',
    featuresEn: [
      'Everything in Solo Clinic Plan',
      'Waiting Room TV Call Screen',
      '1-Click Rx Protocols and templates',
      'Geographic patient analytics & Branch maps',
      'Advanced financial analytics & charts',
      'Priority technical support & staff training'
    ]
  },
  {
    id: 'centers-enterprise',
    name: 'باقة المراكز والفروع',
    price: '1800',
    period: 'شهرياً',
    badge: 'للمراكز الطبية',
    popular: false,
    isFree: false,
    visible: true,
    features: [
      'إدارة فروع متعددة في حساب واحد',
      'أطباء متعددو التخصصات وغرف كشف مستقلة',
      'صلاحيات متقدمة لإدارة الاستقبال والمحاسبة',
      'ربط شاشات تلفزيون متعددة لكل عيادة',
      'تصدير التقارير المالية لملفات Excel',
      'مدير حساب خاص وتدريب ميداني للفريق'
    ],
    nameEn: 'Medical Centers & Multi-Branch',
    priceEn: '1800',
    periodEn: 'monthly',
    featuresEn: [
      'Multi-branch management under one dashboard',
      'Multiple doctors and examination rooms',
      'Advanced role-based access for reception & finance',
      'Multiple Waiting Room TV displays',
      'Excel exports for finances & patient logs',
      'Dedicated account manager & staff onboarding'
    ]
  }
]

// Default FAQs
export const DEFAULT_FAQ_ITEMS: FaqItem[] = [
  {
    id: 'faq-1',
    question: 'هل يحتاج المريض إلى إنشاء حساب أو إدخال كود OTP للحجز؟',
    answer: 'لا، الحجز يتم برقم الموبايل فقط دون أي تعقيد أو انتظار أكواد OTP، مما يجعل تجربة الحجز فورية للمريض في أقل من 30 ثانية.',
    category: 'الحجز',
    visible: true,
    questionEn: 'Does a patient need to register or enter an OTP code to book?',
    answerEn: 'No, patients book directly using their phone number without OTP codes or passwords, completing booking in under 30 seconds.'
  },
  {
    id: 'faq-2',
    question: 'هل يمكن تشغيل شاشة نداء المرضى على تلفزيون غرفة الانتظار؟',
    answer: 'نعم، المنصة تدعم شاشة مخصصة لغرف الانتظار (Waiting Room TV) تُعرض على أي شاشة سمارت أو متصفح، وتُحدَّث تلقائياً بالدور الحالي واستدعاء المريض.',
    category: 'الاستقبال',
    visible: true,
    questionEn: 'Can the patient call screen run on a waiting room TV?',
    answerEn: 'Yes, Yalla Clinic includes a dedicated Waiting Room TV mode that works on any Smart TV or browser, updating queue numbers in real time.'
  },
  {
    id: 'faq-3',
    question: 'هل تتوفر طباعة الروشتة بصيغة A4 الرسمية؟',
    answer: 'نعم، الروشتات تُطبع بتنسيق A4 الطبي القياسي مع اسم العيادة وتفاصيل الطبيب والتشخيص، أو تُحفظ وتُشارك كملف PDF معتمد مع المريض.',
    category: 'الروشتة',
    visible: true,
    questionEn: 'Can prescriptions be printed in official A4 format?',
    answerEn: 'Yes, prescriptions are designed in standard medical A4 format with clinic branding, doctor credentials, and clean printable layout.'
  },
  {
    id: 'faq-4',
    question: 'هل يعمل النظام على أجهزة الكمبيوتر والموبايل معاً؟',
    answer: 'نعم، منصة Yalla Clinic سحابية بالكامل وتعمل بسلاسة من الكمبيوتر واللابتوب والتابلت والموبايل، دون الحاجة لتثبيت برامج معقدة على أجهزتك.',
    category: 'النظام',
    visible: true,
    questionEn: 'Does the system work on both computers and mobile phones?',
    answerEn: 'Yes, Yalla Clinic is a 100% cloud platform accessible from desktop computers, laptops, iPads, and mobile phones with full responsiveness.'
  },
  {
    id: 'faq-5',
    question: 'كيف أبدأ التجربة المجانية لعيادتي؟',
    answer: 'يمكنك الضغط على زر «طلب تجربة مجانية» وملء بيانات العيادة في دقيقة واحدة، وسيتواصل معك فريقنا لتسليمك حسابك التجريبي فوراً.',
    category: 'التجربة والاشتراك',
    visible: true,
    questionEn: 'How do I start a free trial for my clinic?',
    answerEn: 'Click the "Request Free Trial" button, fill in your clinic details in one minute, and our team will activate your workspace immediately.'
  }
]

// Default Real System Screenshots for the Image Gallery
export const DEFAULT_SCREENSHOTS: ScreenshotItem[] = [
  {
    id: 'dashboard',
    visible: true,
    title: 'لوحة تحكم الطبيب المباشرة',
    subtitle: 'متابعة قائمة الانتظار الحالية، الحجوزات اليومية، وأزرار النداء السريع في شاشة عمل موحدة.',
    category: 'لوحة الطبيب',
    imageUrl: '/brand/yalla-clinic/app-icon.png',
    altText: 'شاشة تحكم الطبيب ومتابعة كشوفات اليوم',
    highlights: ['كشوفات اليوم', 'نداء المريض بنقرة واحدة', 'الوصول الفوري للملف الطبي'],
    titleEn: 'Doctor Live Workspace',
    subtitleEn: 'Track current patient queue, daily appointments, and 1-click patient calling in one screen.',
    categoryEn: 'Doctor Workspace',
    highlightsEn: ['Today appointments', '1-Click call', 'Instant medical record access']
  },
  {
    id: 'prescription',
    visible: true,
    title: 'محرر الروشتات الطبية وقوالب Rx',
    subtitle: 'كتابة التشخيص، إدراج الأدوية بالجرعات من دليل الأدوية، وتطبيق البروتوكولات الجاهزة وطباعة A4.',
    category: 'الروشتة الإلكترونية',
    imageUrl: '/brand/yalla-clinic/app-icon.png',
    altText: 'محرر الروشتات وقوالب العلاج الجاهزة',
    highlights: ['قوالب بنقرة واحدة', 'دليل أدوية مدمج', 'طباعة A4 معتمدة'],
    titleEn: 'Prescription Editor & Rx Protocols',
    subtitleEn: 'Clinical diagnosis, drug dosages from built-in directory, 1-click protocols, and official A4 printing.',
    categoryEn: 'Digital Rx',
    highlightsEn: ['1-Click protocols', 'Integrated drug guide', 'Official A4 print']
  },
  {
    id: 'patient-portal',
    visible: true,
    title: 'بوابة المريض وتتبع الدور المباشر',
    subtitle: 'لوحة مخصصة للمريض لمتابعة رقم دوره لحظياً، واستعراض سجل زياراته وروشتاته وفواتيره المسددة.',
    category: 'بوابة المريض',
    imageUrl: '/brand/yalla-clinic/app-icon.png',
    altText: 'شاشة المريض وتتبع الدور والروشتات',
    highlights: ['تتبع الانتظار اللحظي', 'تحميل الروشتات PDF', 'سجل الفواتير وسندات السداد'],
    titleEn: 'Patient Portal & Live Turn',
    subtitleEn: 'Dedicated patient dashboard to monitor queue position, past visits, download prescriptions, and receipts.',
    categoryEn: 'Patient Portal',
    highlightsEn: ['Real-time queue tracking', 'Prescription PDF download', 'Invoice & payment history']
  },
  {
    id: 'waiting-tv',
    visible: true,
    title: 'شاشة استدعاء المرضى التلفزيونية (TV)',
    subtitle: 'واجهة عصرية لشاشات غرف الانتظار تُظهر رقم الدور الحالي، اسم المريض، ورقم غرفة الكشف بوضوح.',
    category: 'شاشة الانتظار TV',
    imageUrl: '/brand/yalla-clinic/app-icon.png',
    altText: 'شاشة تلفزيون غرفة الانتظار والنداء',
    highlights: ['عرض على أي Smart TV', 'تحديث لحظي للدور', 'تنظيم غرفة الانتظار'],
    titleEn: 'Waiting Room TV Call Screen',
    subtitleEn: 'Modern display for waiting room TVs showing active queue number, patient name, and doctor room.',
    categoryEn: 'Waiting Room TV',
    highlightsEn: ['Runs on any Smart TV', 'Instant queue sync', 'Zero crowded lobby']
  },
  {
    id: 'finance-reports',
    visible: true,
    title: 'التقارير المالية والحسابات اليومية',
    subtitle: 'مخططات الإيرادات، تفاصيل سداد الكشوفات (نقدي / محفظة / انستاباي)، وفواتير الخدمات لكل فرع.',
    category: 'الحسابات والتقارير',
    imageUrl: '/brand/yalla-clinic/app-icon.png',
    altText: 'شاشة الحسابات والتقارير المالية اليومية',
    highlights: ['حصر الإيراد اليومي والشهري', 'تتبع طرق الدفع', 'تقارير قابلة للطباعة'],
    titleEn: 'Financial Reports & Daily Billing',
    subtitleEn: 'Revenue charts, payment methods tracking (Cash / Wallet / InstaPay), and service invoices by branch.',
    categoryEn: 'Finance & Reports',
    highlightsEn: ['Daily & monthly revenue', 'Payment method breakdown', 'Printable reports']
  }
]

export const DEFAULT_LANDING_CONFIG: LandingPageConfig = {
  heroBadge: 'المنظومة السحابية المتكاملة لإدارة العيادات الطبية',
  heroTitle: 'عيادتك منظمة باحترافية.',
  heroHighlight: 'ووقتك مكرّس لمرضاك.',
  heroSubtitle:
    'يلا كلينك منصة طبية متكاملة للأطباء والمراكز الطبية: حجز سريع برقم الموبايل، متابعة الدور اللحظي، ملف إلكتروني للمريض، روشتات A4 معتمدة، وحسابات يومية منضبطة في مكان واحد.',
  heroImage: '',
  trialButtonText: 'طلب تجربة مجانية',
  trialDaysCount: 14,
  galleryButtonText: 'جولة في صور النظام',
  demoButtonText: 'طلب ديمو مجاني',
  patientPortalButtonText: 'تواصل مع الدعم الفني',
  loginButtonText: 'دخول العيادة',
  loginUrl: '/clinic/zizo/login',
  demoUrl: '/clinic/zizo',
  patientUrl: '/clinic/zizo/patient',
  primaryWhatsapp: '201551007018',
  footerText: 'جميع الحقوق محفوظة لمنصة Yalla Clinic — تشغيل وتطوير YallaCodeX © 2026',
  demoSectionTitle: 'معرض واجهات يلا كلينيك الحقيقية',
  demoSectionSubtitle: 'استكشف لقطات حقيقية من شاشات النظام المستخدمة يومياً في إدارة العيادات والمراكز الطبية.',
  english: {
    heroBadge: 'Smart Medical Clinic Operating System',
    heroTitle: 'Your clinic organized.',
    heroHighlight: 'More time for care.',
    heroSubtitle:
      'Appointments, live queues, patient EMR, official A4 prescriptions, and daily billing — unified in one intuitive cloud platform.',
    trialButtonText: 'Request Free Trial',
    galleryButtonText: 'View System Screenshots',
    demoButtonText: 'Request a free demo',
    patientPortalButtonText: 'Contact technical support',
    loginButtonText: 'Clinic login',
    footerText: '© 2026 Yalla Clinic — Developed by YallaCodeX. All rights reserved.',
    demoSectionTitle: 'Real Yalla Clinic Screenshots',
    demoSectionSubtitle: 'Explore authentic interfaces used daily by medical clinics and healthcare practitioners.',
  },
  sectionOrder: DEFAULT_SECTION_ORDER,
  themeSettings: DEFAULT_THEME_SETTINGS,
  layoutSettings: DEFAULT_LAYOUT_SETTINGS,
  visibility: {
    showNavbar: true,
    showHero: true,
    showStats: true,
    showFeatures: true,
    showScreenshots: true,
    showSteps: true,
    showClients: true,
    showFeedback: true,
    showPricing: true,
    showFaq: true,
    showContactForm: true,
    allowClientFeedbackSubmission: true,
    showContacts: true,
    showFloatingWhatsapp: true,
    showTrialBanner: false,
    showFooter: true,
  },
  orbitCards: DEFAULT_ORBIT_CARDS,
  gallerySettings: {
    autoplay: true,
    intervalSeconds: 6,
  },
  stats: [
    {
      id: 'stat-clinics',
      visible: true,
      label: 'عيادات ومراكز طبية مسجلة',
      value: '150',
      unit: '+',
      iconName: 'Building2',
      sourceType: 'manual',
      sourceNote: 'عيادات ومراكز طبية موثقة في المنظومة',
      labelEn: 'Registered Clinics & Centers',
      valueEn: '150+'
    },
    {
      id: 'stat-doctors',
      visible: true,
      label: 'أطباء واستشاريون معتمدون',
      value: '500',
      unit: '+',
      iconName: 'Users',
      sourceType: 'manual',
      sourceNote: 'أطباء يديرون كشوفاتهم وروشتاتهم عبر المنصة',
      labelEn: 'Verified Medical Doctors',
      valueEn: '500+'
    },
    {
      id: 'stat-visits',
      visible: true,
      label: 'كشوفات وزيارات منظمة',
      value: '25,000',
      unit: '+',
      iconName: 'TrendingUp',
      sourceType: 'manual',
      sourceNote: 'كشوفات وزيارات تم إدارتها بالكامل',
      labelEn: 'Organized Patient Visits',
      valueEn: '25,000+'
    },
    {
      id: 'stat-prescriptions',
      visible: true,
      label: 'روشتات طبية إلكترونية صادرة',
      value: '50,000',
      unit: '+',
      iconName: 'Award',
      sourceType: 'manual',
      sourceNote: 'روشتات A4 إلكترونية معتمدة للمرضى',
      labelEn: 'Digital Prescriptions Issued',
      valueEn: '50,000+'
    }
  ],
  features: DEFAULT_CLINICAL_FEATURES,
  screenshots: DEFAULT_SCREENSHOTS,
  steps: DEFAULT_STEPS,
  clients: [],
  feedbacks: [],
  pricingPlans: DEFAULT_PRICING_PLANS,
  faqItems: DEFAULT_FAQ_ITEMS,
  contacts: [
    {
      id: 'sales',
      visible: true,
      number: '01551007018',
      whatsappNumber: '201551007018',
      roleTitle: 'المبيعات والدعم الفني',
      roleTitleEn: 'Sales & technical support',
      isPrimary: true,
      whatsappEnabled: true,
    },
  ],
}

export function mergeLandingConfig(value: unknown): LandingPageConfig {
  const data = value && typeof value === 'object' ? (value as Partial<LandingPageConfig>) : {}

  const parsed = landingConfigSchema.safeParse({
    ...DEFAULT_LANDING_CONFIG,
    ...data,
    english: { ...DEFAULT_LANDING_CONFIG.english, ...(data.english || {}) },
    sectionOrder: Array.isArray(data.sectionOrder) && data.sectionOrder.length > 0
      ? data.sectionOrder
      : DEFAULT_SECTION_ORDER,
    themeSettings: {
      ...DEFAULT_LANDING_CONFIG.themeSettings,
      ...(data.themeSettings || {}),
    },
    layoutSettings: {
      ...DEFAULT_LANDING_CONFIG.layoutSettings,
      ...(data.layoutSettings || {}),
    },
    visibility: {
      ...DEFAULT_LANDING_CONFIG.visibility,
      ...(data.visibility || {}),
    },
    gallerySettings: {
      ...DEFAULT_LANDING_CONFIG.gallerySettings,
      ...(data.gallerySettings || {}),
    },
    stats: Array.isArray(data.stats) && data.stats.length > 0
      ? data.stats
      : DEFAULT_LANDING_CONFIG.stats,
    features: Array.isArray(data.features) && data.features.length > 0
      ? data.features.filter(f => f.id !== 'ai' && !f.title?.includes('الذكاء الاصطناعي'))
      : DEFAULT_CLINICAL_FEATURES,
    screenshots: Array.isArray(data.screenshots) && data.screenshots.length > 0
      ? data.screenshots
      : DEFAULT_SCREENSHOTS,
    steps: Array.isArray(data.steps) && data.steps.length > 0
      ? data.steps
      : DEFAULT_STEPS,
    pricingPlans: Array.isArray(data.pricingPlans) && data.pricingPlans.length > 0
      ? data.pricingPlans
      : DEFAULT_PRICING_PLANS,
    faqItems: Array.isArray(data.faqItems) && data.faqItems.length > 0
      ? data.faqItems
      : DEFAULT_FAQ_ITEMS,
  })

  return parsed.success ? parsed.data : structuredClone(DEFAULT_LANDING_CONFIG)
}

export function normalizePhoneNumber(value: string): string {
  if (!value) return ''
  // 1. Normalize Eastern Arabic (٠-٩) and Persian (۰-۹) numerals to standard ASCII (0-9)
  const normalized = value
    .replace(/[٠-٩]/g, (c) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)))
    .replace(/[۰-۹]/g, (c) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c)))
  // 2. Strip all non-digit characters except leading plus
  let digits = normalized.replace(/\D/g, '')
  // Strip leading 00 international prefix
  if (digits.startsWith('00')) {
    digits = digits.slice(2)
  }
  // 3. Fix common Egyptian typo: +20 010... -> 20010... -> 2010...
  if (/^2001[0125]\d{8}$/.test(digits)) {
    digits = '201' + digits.slice(4)
  }
  // 4. Standard Egyptian 11 digits: 010..., 011..., 012..., 015... -> prepend 2 -> 201xxxxxxxxx
  if (/^01[0125]\d{8}$/.test(digits)) {
    return '2' + digits
  }
  // 5. Egyptian 10 digits missing leading zero: 10..., 11..., 12..., 15... -> prepend 20 -> 201xxxxxxxxx
  if (/^1[0125]\d{8}$/.test(digits)) {
    return '20' + digits
  }
  // 6. Egyptian 12 digits: 201xxxxxxxxx -> already valid
  if (/^201[0125]\d{8}$/.test(digits)) {
    return digits
  }
  return digits
}

export function whatsappNumber(value: string): string {
  return normalizePhoneNumber(value)
}

export const feedbackSubmissionSchema = z.object({
  authorName: short.min(2),
  clinicName: short.min(2),
  specialty: short.default(''),
  rating: z.number().int().min(1).max(5),
  comment: text.min(5).max(2000),
  website: z.string().max(0).optional(),
})

export const trialSubmissionSchema = z.object({
  doctorName: z
    .string()
    .trim()
    .min(2, 'اسم الطبيب يجب أن يتكون من حرفين على الأقل')
    .max(100, 'اسم الطبيب طويل جداً'),
  clinicName: z
    .string()
    .trim()
    .min(2, 'اسم العيادة يجب أن يتكون من حرفين على الأقل')
    .max(100, 'اسم العيادة طويل جداً'),
  specialty: z
    .string()
    .nullish()
    .transform((val) => (val ? val.trim() : ''))
    .refine((val) => !val || val.length >= 2, {
      message: 'التخصص الطبي يجب أن يتكون من حرفين على الأقل (مثال: طب عام أو باطنة)',
    })
    .transform((val) => (val && val.length >= 2 ? val : 'طب عام')),
  phone: z
    .string()
    .trim()
    .transform((val) => normalizePhoneNumber(val))
    .refine((val) => /^[1-9]\d{7,14}$/.test(val), {
      message: 'رقم الهاتف غير صالح، يرجى كتابة رقم هاتف مصري صحيح (مثال: 01012345678) أو رقم دولي مع كود الدولة',
    }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('البريد الإلكتروني غير صالح (مثال: doctor@example.com)')
    .max(254, 'البريد الإلكتروني طويل جداً'),
  governorate: z
    .string()
    .nullish()
    .transform((val) => (val ? val.trim() : ''))
    .pipe(z.string().max(100)),
  city: z
    .string()
    .nullish()
    .transform((val) => (val ? val.trim() : ''))
    .pipe(z.string().max(100)),
  address: z
    .string()
    .nullish()
    .transform((val) => (val ? val.trim() : ''))
    .pipe(z.string().max(300)),
  expectedPatientsPerDay: z
    .string()
    .nullish()
    .transform((val) => (val ? val.trim() : ''))
    .pipe(z.string().max(50)),
  notes: z
    .string()
    .nullish()
    .transform((val) => (val ? val.trim() : ''))
    .pipe(z.string().max(2000)),
  website: z
    .string()
    .nullish()
    .transform((val) => (val ? val.trim() : '')),
})

export const inquirySubmissionSchema = z.object({
  type: z.enum(['suggestion', 'complaint', 'inquiry']),
  name: short.min(2),
  contact: short.min(5),
  subject: short.min(2),
  message: text.min(10).max(4000),
  website: z.string().max(0).optional(), // Honeypot anti-spam
})
