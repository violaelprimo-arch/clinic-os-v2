import { z } from 'zod'

const text = z.string().trim().max(4000)
const short = z.string().trim().max(250)
const id = z.string().min(1).max(100)
const image = z
  .string()
  .max(1000000)
  .refine(
    (v) => !v || /^https:\/\//.test(v) || /^\/(?!\/)/.test(v) || /^data:image\//.test(v),
    'استخدم رابط صورة HTTPS أو مسارًا داخل الموقع أو صورة مرفوعة',
  )
const externalOrLocalLink = z
  .string()
  .max(500)
  .refine(
    (value) => !value || /^https:\/\//.test(value) || /^\/(?!\/)/.test(value),
    'استخدم رابط HTTPS أو مسارًا داخل الموقع',
  )
const link = z
  .string()
  .max(500)
  .refine((v) => /^\/(?!\/)/.test(v), 'الرابط يجب أن يكون داخل الموقع')
const feature = z.object({
  id,
  iconName: short,
  title: short,
  description: text,
  badge: short.default(''),
  titleEn: short.default(''),
  descriptionEn: text.default(''),
  badgeEn: short.default(''),
})
const screenshot = z.object({
  id,
  title: short,
  subtitle: text,
  category: short,
  imageUrl: image,
  highlights: z.array(short).max(20).default([]),
  titleEn: short.default(''),
  subtitleEn: text.default(''),
  categoryEn: short.default(''),
  highlightsEn: z.array(short).max(20).default([]),
  isVisible: z.boolean().default(true),
  altText: z.string().max(300).default(''),
  altTextEn: z.string().max(300).default(''),
})
const client = z.object({
  id,
  name: short,
  specialty: short.default(''),
  city: short.default(''),
  logoUrl: image.default(''),
  link: externalOrLocalLink.default(''),
  collaborationNote: text.default(''),
  nameEn: short.default(''),
  specialtyEn: short.default(''),
})
const feedback = z.object({
  id,
  authorName: short.min(2),
  clinicName: short,
  specialty: short.default(''),
  rating: z.number().int().min(1).max(5),
  comment: text.min(3),
  createdAt: z.string().max(40),
  approved: z.boolean(),
})
const contact = z.object({
  id,
  number: short.min(5),
  whatsappNumber: z.string().max(25).default(''),
  roleTitle: short,
  roleTitleEn: short.default(''),
  isPrimary: z.boolean().default(false),
  whatsappEnabled: z.boolean().default(true),
})
const english = z.object({
  heroBadge: text,
  heroTitle: text,
  heroHighlight: text,
  heroSubtitle: text,
  trialButtonText: short,
  demoButtonText: short,
  patientPortalButtonText: short,
  loginButtonText: short,
  footerText: text,
  demoSectionTitle: short.default(''),
  demoSectionSubtitle: text.default(''),
})
export const landingConfigSchema = z.object({
  heroBadge: text,
  heroTitle: text,
  heroHighlight: text,
  heroSubtitle: text,
  trialButtonText: short,
  trialDaysCount: z.number().int().min(0).max(90),
  demoButtonText: short,
  patientPortalButtonText: short,
  loginButtonText: short,
  loginUrl: link,
  demoUrl: link,
  patientUrl: link,
  primaryWhatsapp: z.string().max(25),
  footerText: text,
  demoSectionTitle: short.default(''),
  demoSectionSubtitle: text.default(''),
  english,
  stats: z
    .array(
      z.object({
        label: short,
        value: short,
        labelEn: short.default(''),
        valueEn: short.default(''),
      }),
    )
    .max(20),
  visibility: z.object({
    showStats: z.boolean(),
    showFeatures: z.boolean(),
    showScreenshots: z.boolean(),
    showClients: z.boolean(),
    showFeedback: z.boolean(),
    allowClientFeedbackSubmission: z.boolean(),
    showContacts: z.boolean(),
    showFloatingWhatsapp: z.boolean(),
    showTrialBanner: z.boolean(),
  }),
  features: z.array(feature).max(100),
  screenshots: z.array(screenshot).max(100),
  clients: z.array(client).max(300),
  feedbacks: z.array(feedback).max(200),
  contacts: z.array(contact).max(500),
})
export type LandingPageConfig = z.infer<typeof landingConfigSchema>
export type ScreenshotItem = z.infer<typeof screenshot>
export type FeedbackItem = z.infer<typeof feedback>
export type TrialRequestItem = {
  id: string
  doctorName: string
  clinicName: string
  specialty: string
  phone: string
  email: string
  notes: string
  createdAt: string
  status: 'new' | 'contacted' | 'activated'
}
export const DEFAULT_LANDING_CONFIG: LandingPageConfig = {
  heroBadge: 'مساحة واحدة لكل تفاصيل عيادتك',
  heroTitle: 'عيادتك منظمة.',
  heroHighlight: 'ووقتك للمرضى.',
  heroSubtitle:
    'يلا كلينك يجمع الحجوزات والدور وملفات المرضى والروشتات والحسابات في تجربة واحدة، من أول حجز لآخر متابعة.',
  trialButtonText: '',
  trialDaysCount: 0,
  demoButtonText: 'طلب ديمو مجاني',
  patientPortalButtonText: 'تواصل مع الدعم الفني',
  loginButtonText: 'دخول العيادة',
  loginUrl: '/clinic/zizo/login',
  demoUrl: '/clinic/zizo',
  patientUrl: '/clinic/zizo',
  primaryWhatsapp: '201551007018',
  footerText:
    'جميع الحقوق محفوظة لمنصة Yalla Clinic — تطوير YallaCodeX © 2026',
  demoSectionTitle: 'جرّب يلا كلينيك بنفسك',
  demoSectionSubtitle:
    'استكشف واجهات يلا كلينيك الحقيقية: تحكّم في الدور، واكتب الروشتة، وجرّب حجز المريض ومتابعة التقارير في تجربة حية وتفاعلية بالكامل.',
  english: {
    heroBadge: 'One workspace. Every part of your clinic.',
    heroTitle: 'An organized clinic.',
    heroHighlight: 'More time for care.',
    heroSubtitle:
      'Appointments, live queues, patient records, prescriptions and finances — connected in one experience, from first booking to follow-up.',
    trialButtonText: '',
    demoButtonText: 'Request a free demo',
    patientPortalButtonText: 'Contact technical support',
    loginButtonText: 'Clinic login',
    footerText:
      '© 2026 Yalla Clinic. Developed by YallaCodeX. All rights reserved.',
    demoSectionTitle: 'Try Yalla Clinic Yourself',
    demoSectionSubtitle:
      'Explore real Yalla Clinic interfaces: manage live queues, write prescriptions, test patient booking, and monitor finances in a fully interactive demo.',
  },
  stats: [],
  visibility: {
    showStats: false,
    showFeatures: true,
    showScreenshots: true,
    showClients: false,
    showFeedback: false,
    allowClientFeedbackSubmission: true,
    showContacts: true,
    showFloatingWhatsapp: true,
    showTrialBanner: false,
  },
  features: [
    {
      id: 'records',
      iconName: 'Users',
      title: 'كل مريض، ملف متكامل',
      description:
        'تاريخ الزيارات والتشخيص والأدوية والمرفقات في سجل واحد يسهل الرجوع إليه.',
      badge: 'السجل الطبي',
      titleEn: 'Every patient. One complete record.',
      descriptionEn:
        'Visit history, diagnoses, medication and attachments in one accessible record.',
      badgeEn: 'Patient records',
    },
    {
      id: 'queue',
      iconName: 'Calendar',
      title: 'دور واضح للجميع',
      description:
        'نظّم الحجوزات وتحركات الدور، وخلّي المريض يتابع دوره من هاتفه.',
      badge: 'الحجز والدور',
      titleEn: 'A clearer queue for everyone',
      descriptionEn:
        'Manage appointments and queue progress while patients follow their turn on their phone.',
      badgeEn: 'Appointments & queue',
    },
    {
      id: 'rx',
      iconName: 'FileSignature',
      title: 'روشتة بهوية عيادتك',
      description:
        'اكتب العلاج، راجع الروشتة واطبعها بقالبك الخاص، مع أرشفة الزيارة.',
      badge: 'الروشتة الإلكترونية',
      titleEn: 'Prescriptions with your identity',
      descriptionEn:
        'Write treatment, preview and print a branded prescription, then archive the visit.',
      badgeEn: 'Digital prescriptions',
    },
    {
      id: 'drugs',
      iconName: 'Database',
      title: 'الأدوية أقرب لإيدك',
      description:
        'ابحث في دليل الأدوية داخل النظام وأضف الدواء والجرعة إلى الروشتة بسهولة.',
      badge: 'دليل الأدوية',
      titleEn: 'Medication at your fingertips',
      descriptionEn:
        'Search the medication directory and add medication and dosage to prescriptions.',
      badgeEn: 'Medication directory',
    },
    {
      id: 'finance',
      iconName: 'TrendingUp',
      title: 'حسابات تقدر تتابعها',
      description:
        'تابع الإيرادات والمدفوعات والمصروفات والتقارير في فترة زمنية تختارها.',
      badge: 'التقارير والمالية',
      titleEn: 'Finances you can follow',
      descriptionEn:
        'Review revenue, payments, expenses and reports for your chosen date range.',
      badgeEn: 'Finance & reporting',
    },
    {
      id: 'ai',
      iconName: 'Bot',
      title: 'مساعد يعرف عيادتك',
      description:
        'درّب مساعد الاستفسارات على معلومات عيادتك وخدماتها ومواعيدها حسب باقتك.',
      badge: 'المساعد الذكي',
      titleEn: 'An assistant that knows your clinic',
      descriptionEn:
        'Configure an enquiries assistant with your clinic information, services and hours, according to your plan.',
      badgeEn: 'AI enquiries assistant',
    },
    {
      id: 'branches',
      iconName: 'Building2',
      title: 'فروعك تحت عينك',
      description:
        'إدارة للفروع ومواعيد كل فرع، مع صلاحيات للدكتور والاستقبال والمساعدين.',
      badge: 'الفروع والفريق',
      titleEn: 'Keep your branches connected',
      descriptionEn:
        'Manage branch schedules and role-specific access for doctors and reception staff.',
      badgeEn: 'Branches & team',
    },
    {
      id: 'devices',
      iconName: 'Smartphone',
      title: 'مكتبك معاك',
      description:
        'استخدم النظام من الكمبيوتر أو التابلت أو الموبايل بواجهة متجاوبة.',
      badge: 'من أي جهاز',
      titleEn: 'Your workspace, wherever you are',
      descriptionEn:
        'Use a responsive workspace on desktop, tablet and mobile.',
      badgeEn: 'Across devices',
    },
  ],
  screenshots: [
    {
      id: 'dashboard',
      title: 'صورة واضحة ليوم العيادة',
      subtitle: 'الحجوزات والدور والإجراءات المهمة في مساحة واحدة.',
      category: 'لوحة الطبيب',
      imageUrl: '/landing/dashboard.svg',
      highlights: ['حجوزات اليوم', 'متابعة الدور', 'وصول سريع للملفات'],
      titleEn: 'A clear view of your clinic day',
      subtitleEn: 'Appointments, queue and important actions in one workspace.',
      categoryEn: 'Doctor workspace',
      highlightsEn: [
        'Today’s bookings',
        'Queue progress',
        'Quick record access',
      ],
      isVisible: true,
      altText: 'شاشة لوحة الطبيب وإدارة الدور في يلا كلينيك',
      altTextEn: 'Yalla Clinic doctor workspace and queue overview',
    },
    {
      id: 'prescription',
      title: 'من التشخيص للروشتة',
      subtitle: 'تفاصيل الزيارة والعلاج ومعاينة الطباعة بجوار بعض.',
      category: 'الروشتة',
      imageUrl: '/landing/prescription.svg',
      highlights: ['تشخيص الزيارة', 'الأدوية والجرعات', 'معاينة الطباعة'],
      titleEn: 'From diagnosis to prescription',
      subtitleEn: 'Visit details, treatment and a print preview side by side.',
      categoryEn: 'Prescriptions',
      highlightsEn: ['Visit diagnosis', 'Medication & dosage', 'Print preview'],
      isVisible: true,
      altText: 'شاشة تحرير الروشتة الإلكترونية وطباعتها',
      altTextEn: 'Digital prescription editor and print preview',
    },
    {
      id: 'patient',
      title: 'رحلة أسهل للمريض',
      subtitle: 'حجز ومتابعة للدور من الموبايل.',
      category: 'بوابة المريض',
      imageUrl: '/landing/patient.svg',
      highlights: ['اختيار الخدمة', 'حجز بالموبايل', 'متابعة الدور'],
      titleEn: 'An easier patient journey',
      subtitleEn: 'Book and follow queue progress from a phone.',
      categoryEn: 'Patient portal',
      highlightsEn: ['Choose a service', 'Book on mobile', 'Follow your turn'],
      isVisible: true,
      altText: 'شاشة بوابة المريض وحجز المواعيد وتتبع الدور',
      altTextEn: 'Patient portal for booking and live queue tracking',
    },
    {
      id: 'finance',
      title: 'راجع أرقامك براحتك',
      subtitle: 'تابع الحسابات واختار الفرع والفترة المناسبة.',
      category: 'التقارير',
      imageUrl: '/landing/finance.svg',
      highlights: ['طرق الدفع', 'تقارير الفترات', 'بيانات كل فرع'],
      titleEn: 'Your numbers, at a glance',
      subtitleEn: 'Review finances by branch and date range.',
      categoryEn: 'Reports',
      highlightsEn: [
        'Payment methods',
        'Date-range reports',
        'Branch insights',
      ],
      isVisible: true,
      altText: 'شاشة التقارير المالية والإحصائيات للفروع',
      altTextEn: 'Financial reports and clinic analytics',
    },
  ],
  clients: [],
  feedbacks: [],
  contacts: [
    {
      id: 'sales',
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
  const data =
    value && typeof value === 'object'
      ? (value as Partial<LandingPageConfig>)
      : {}

  // Filter out old mock stats so nothing appears that the user didn't add
  let customStats = Array.isArray(data.stats) ? data.stats : []
  const isOldMockStats = customStats.length === 3 &&
    customStats.some(s => s.value === '4' && (s.label?.includes('بوابات') || s.labelEn?.includes('portals'))) &&
    customStats.some(s => s.value === '3' && (s.label?.includes('طرق دفع') || s.labelEn?.includes('payment'))) &&
    customStats.some(s => s.value === '8' && (s.label?.includes('أدوات') || s.labelEn?.includes('workflow')))

  if (isOldMockStats) {
    customStats = []
  }

  const hasApprovedFeedbacks = Array.isArray(data.feedbacks) && data.feedbacks.some(f => f.approved)
  const hasClients = Array.isArray(data.clients) && data.clients.length > 0

  const resolvedLoginUrl = (data.loginUrl && data.loginUrl !== '/clinic/demo/login')
    ? data.loginUrl
    : '/clinic/zizo/login'

  const parsed = landingConfigSchema.safeParse({
    ...DEFAULT_LANDING_CONFIG,
    ...data,
    screenshots: Array.isArray(data.screenshots)
      ? data.screenshots
      : DEFAULT_LANDING_CONFIG.screenshots,
    stats: customStats,
    loginUrl: resolvedLoginUrl,
    demoUrl: data.demoUrl && data.demoUrl !== '/clinic/demo/admin' ? data.demoUrl : '/clinic/zizo',
    patientUrl: data.patientUrl && data.patientUrl !== '/clinic/demo' ? data.patientUrl : '/clinic/zizo',
    english: { ...DEFAULT_LANDING_CONFIG.english, ...data.english },
    visibility: {
      ...DEFAULT_LANDING_CONFIG.visibility,
      ...data.visibility,
      showStats: customStats.length > 0 && data.visibility?.showStats === true,
      showClients: hasClients && data.visibility?.showClients === true,
      showFeedback: hasApprovedFeedbacks && data.visibility?.showFeedback === true,
    },
  })
  return parsed.success ? parsed.data : structuredClone(DEFAULT_LANDING_CONFIG)
}
export function whatsappNumber(value: string): string {
  const normalized = value
    .replace(/[٠-٩]/g, (c) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)))
    .replace(/[۰-۹]/g, (c) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c)))
  const digits = normalized.replace(/\D/g, '').replace(/^00/, '')
  return /^01\d{9}$/.test(digits) ? '2' + digits : digits
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
  doctorName: short.min(2),
  clinicName: short.min(2),
  specialty: short.min(2),
  phone: z
    .string()
    .transform(whatsappNumber)
    .pipe(z.string().regex(/^[1-9]\d{7,14}$/)),
  email: z.string().trim().email().max(254),
  notes: text.max(2000).default(''),
  website: z.string().max(0).optional(),
})
