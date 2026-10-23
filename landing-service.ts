import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

export interface ContactNumberItem {
  id: string
  number: string
  whatsappNumber: string
  roleTitle: string
  isPrimary?: boolean
}

export interface FeatureItem {
  id: string
  iconName: string
  title: string
  description: string
  badge?: string
}

export interface ShowcaseSlideItem {
  id: string
  title: string
  subtitle: string
  category: string
  imageUrl: string
  highlights: string[]
}

export interface ClientPartnerItem {
  id: string
  name: string
  specialty: string
  city: string
  logoUrl?: string
  collaborationNote: string
}

export interface FeedbackItem {
  id: string
  authorName: string
  clinicName: string
  specialty: string
  rating: number
  comment: string
  createdAt: string
  approved: boolean
}

export interface TrialRequestItem {
  id?: string
  doctorName: string
  clinicName: string
  specialty: string
  phone: string
  email?: string
  notes?: string
  createdAt: string
  status: 'new' | 'contacted' | 'activated'
}

export interface LandingVisibilityConfig {
  showStats: boolean
  showFeatures: boolean
  showScreenshots: boolean
  showClients: boolean
  showFeedback: boolean
  allowClientFeedbackSubmission: boolean
  showContacts: boolean
  showFloatingWhatsapp: boolean
  showTrialBanner: boolean
}

export interface LandingPageConfig {
  heroBadge: string
  heroTitle: string
  heroHighlight: string
  heroSubtitle: string
  trialButtonText: string
  trialDaysCount: number
  demoButtonText: string
  patientPortalButtonText: string
  primaryWhatsapp: string
  footerText: string
  stats: { label: string; value: string }[]
  visibility: LandingVisibilityConfig
  features: FeatureItem[]
  screenshots: ShowcaseSlideItem[]
  clients: ClientPartnerItem[]
  feedbacks: FeedbackItem[]
  contacts: ContactNumberItem[]
}

export const DEFAULT_LANDING_CONFIG: LandingPageConfig = {
  heroBadge: 'الجيل الجديد من أنظمة تشغيل العيادات الذكية في مصر والعالم العربي',
  heroTitle: 'نظام يلا كلينك المتكامل',
  heroHighlight: 'لإدارة عيادتك بذكاء وسرعة فائقة',
  heroSubtitle: 'منصة سحابية شاملة تمنحك التحكم الكامل في ملفات المرضى، طابور الانتظار اللحظي، الروشتات الإلكترونية المطبوعة، الحسابات المالية، والمساعد الطبي بالذكاء الاصطناعي من أي جهاز.',
  trialButtonText: 'اطلب نسختك التجريبية مجاناً لمدة 7 أيام',
  trialDaysCount: 7,
  demoButtonText: 'معاينة لوحة الطبيب الآن',
  patientPortalButtonText: 'تجربة بوابة حجز المرضى',
  primaryWhatsapp: '201551007018',
  footerText: 'جميع الحقوق محفوظة لمنصة Yalla Clinic — تطوير YallaCodeX © 2026',
  stats: [
    { label: 'عيادة ومركز طبي متعاون', value: '+120' },
    { label: 'ملف وروشتة إلكترونية', value: '+85,000' },
    { label: 'دقة واستقرار النظام السحابي', value: '99.9%' },
    { label: 'فترة تجربة مجانية متكاملة', value: '7 أيام' }
  ],
  visibility: {
    showStats: true,
    showFeatures: true,
    showScreenshots: true,
    showClients: true,
    showFeedback: true,
    allowClientFeedbackSubmission: true,
    showContacts: true,
    showFloatingWhatsapp: true,
    showTrialBanner: true
  },
  features: [
    { id: 'feat-1', iconName: 'Users', title: 'ملفات المرضى والأرشيف الطبي الموحد', description: 'سجل طبي متكامل لكل مريض يشمل التاريخ المرضي، الزيارات السابقة، التحاليل، الأشعة، والمرفقات ببحث فوري.', badge: 'أساسي' },
    { id: 'feat-2', iconName: 'Calendar', title: 'تنظيم الحجوزات والدور اللحظي الذكي', description: 'إدارة طابور الانتظار لحظياً مع رابط خاص لكل مريض لمتابعة دوره ورقم الكشف الحالي مباشرة من هاتفه.', badge: 'تفاعل لحظي' },
    { id: 'feat-3', iconName: 'FileSignature', title: 'الروشتة الإلكترونية والطباعة الفورية A4', description: 'تصميم وطباعة روشتات احترافية بشعار وهوية عيادتك في ثوانٍ مع دعم رفع قالب الروشتة الخاص بك.', badge: 'طباعة ذكية' },
    { id: 'feat-4', iconName: 'Database', title: 'دليل الأدوية المصري والجرعات الجاهزة', description: 'قاعدة بيانات محدثة للأدوية بأسمائها التجارية والجرعات المقترحة للإكمال التلقائي السريع أثناء الكشف.', badge: 'قاعدة بيانات' },
    { id: 'feat-5', iconName: 'TrendingUp', title: 'الحسابات والتقارير المالية الدقيقة', description: 'متابعة يومية وشهرية لإيرادات الكشوفات، الإعادات، المصروفات، وصافي أرباح العيادة مع التصدير لملفات Excel و PDF.', badge: 'مالية وتقارير' },
    { id: 'feat-6', iconName: 'Bot', title: 'مساعد الذكاء الاصطناعي الطبي (AI Chatbot)', description: 'شات بوت ذكي قابل للتدريب ببيانات عيادتك للرد على استفسارات المرضى وحجز المواعيد على مدار الساعة.', badge: 'ذكاء اصطناعي' },
    { id: 'feat-7', iconName: 'Building2', title: 'إدارة الفروع المتعددة وحسابات المساعدين', description: 'ربط جميع فروع عيادتك في لوحة واحدة مع تخصيص صلاحيات دقيقة للأطباء والسكرتارية والاستقبال.', badge: 'تعدد الفروع' },
    { id: 'feat-8', iconName: 'Smartphone', title: 'يعمل على جميع الأجهزة بدون تعقيد', description: 'واجهة سريعة متوافقة مع الهواتف الذكية، التابلت، وأجهزة الكمبيوتر مع دعم العمل كتطبيق ويب تقدمي (PWA).', badge: 'سحابي بالكامل' }
  ],
  screenshots: [
    { id: 'shot-1', title: 'لوحة تحكم الطبيب وإدارة العيادة الشاملة', subtitle: 'متابعة إحصائيات اليوم، قائمة الانتظار اللحظية، والوصول السريع لملفات المرضى من شاشة واحدة.', category: 'لوحة الطبيب', imageUrl: '/icon.png', highlights: ['إحصائيات لحظية للكشوفات', 'نداء آلي للمريض التالي', 'بحث ذكي بالاسم أو رقم الهاتف'] },
    { id: 'shot-2', title: 'إصدار الروشتة الإلكترونية ودليل الأدوية الذكي', subtitle: 'كتابة الأدوية والجرعات بالإكمال التلقائي مع معاينة حية لقالب الروشتة المطبوعة A4.', category: 'الروشتة الإلكترونية', imageUrl: '/icon.png', highlights: ['قوالب روشتة مخصصة باسم العيادة', 'قاعدة بيانات الأدوية المصرية', 'أرشفة تلقائية في ملف المريض'] },
    { id: 'shot-3', title: 'بوابة المريض ومتابعة الدور اللحظي عبر الموبايل', subtitle: 'يحجز المريض موعده أونلاين ويتابع رقم الكشف الحالي وعدد المنتظرين أمامه لحظة بلحظة.', category: 'بوابة المرضى', imageUrl: '/icon.png', highlights: ['حجز مواعيد أونلاين بسهولة', 'تتبع مباشر لرقم الدور الحالي', 'شات بوت ذكي للرد على الاستفسارات'] },
    { id: 'shot-4', title: 'التقارير المالية وإدارة الفروع والحسابات', subtitle: 'تقارير تفصيلية للإيرادات والمصروفات وصافي الدخل لكل فرع ولكل طبيب بدقة متناهية.', category: 'المالية والفروع', imageUrl: '/icon.png', highlights: ['تصدير التقارير بصيغة Excel', 'فصل حسابات كل فرع بدقة', 'صلاحيات مخصصة للسكرتارية'] }
  ],
  clients: [
    { id: 'cli-1', name: 'مركز النخبة التخصصي', specialty: 'طب وجراحة العيون', city: 'القاهرة', collaborationNote: 'تعاون كامل في إدارة العيادات والروشتة الإلكترونية' },
    { id: 'cli-2', name: 'عيادات د. أحمد المنصوري', specialty: 'الباطنة والقلب والأوعية الدموية', city: 'الإسكندرية', collaborationNote: 'تشغيل نظام الدور اللحظي والأرشيف الطبي الموحد' },
    { id: 'cli-3', name: 'مجمع شفاء الطبي', specialty: 'متعدد التخصصات (3 فروع)', city: 'الجيزة', collaborationNote: 'ربط الفروع والحسابات المالية والمساعد الذكي AI' },
    { id: 'cli-4', name: 'عيادة د. سارة الكيلاني', specialty: 'طب الأطفال وحديثي الولادة', city: 'المنصورة', collaborationNote: 'إدارة الحجوزات أونلاين ومتابعة النمو والتطعيمات' },
    { id: 'cli-5', name: 'مركز دريم ديرما اند ليزر', specialty: 'الجلدية والتجميل والليزر', city: 'القاهرة الجديدة', collaborationNote: 'تنظيم الجلسات والملفات المصورة والتقارير المالية' },
    { id: 'cli-6', name: 'عيادات د. كريم عبد الرحمن', specialty: 'جراحة العظام والعمود الفقري', city: 'طنطا', collaborationNote: 'أرشفة الأشعة والروشتات الذكية ومتابعة المرضى' }
  ],
  feedbacks: [
    { id: 'fb-1', authorName: 'د. محمد الشافعي', clinicName: 'عيادة الشافعي للباطنة والقلب', specialty: 'استشاري الباطنة والقلب', rating: 5, comment: 'نظام يلا كلينك غيّر شكل العمل في العيادة تماماً، المرضى يتابعون دورهم من الموبايل والروشتة تطبع في ثوانٍ بدون أي أخطاء.', createdAt: '2026-10-10', approved: true },
    { id: 'fb-2', authorName: 'د. نهى عبد العزيز', clinicName: 'مركز لومينوس للجلدية والتجميل', specialty: 'أخصائية الجلدية والتجميل', rating: 5, comment: 'الحسابات المالية وتقارير الفروع أصبحت واضحة جداً، والدعم الفني متجاوب في أي وقت. تجربة ممتازة أنصح بها كل زميل.', createdAt: '2026-10-14', approved: true },
    { id: 'fb-3', authorName: 'د. طارق الجندي', clinicName: 'عيادات الجندي لطب الأطفال', specialty: 'استشاري طب الأطفال', rating: 5, comment: 'المساعد الذكي AI والبحث السريع في تاريخ المريض وفرا علينا أكثر من نصف وقت الكشف اليومي.', createdAt: '2026-10-18', approved: true }
  ],
  contacts: [
    { id: 'cnt-1', number: '01551007018', whatsappNumber: '201551007018', roleTitle: 'المبيعات والتعاقدات وطلب النسخة التجريبية', isPrimary: true },
    { id: 'cnt-2', number: '01551007018', whatsappNumber: '201551007018', roleTitle: 'الدعم الفني وخدمة العملاء', isPrimary: false }
  ]
}

const LANDING_DOC_REF = () => doc(db, 'site_settings', 'landing_page')

export async function getLandingPageConfig(): Promise<LandingPageConfig> {
  try {
    const snap = await getDoc(LANDING_DOC_REF())
    if (snap.exists()) {
      const data = snap.data() as Partial<LandingPageConfig>
      return { ...DEFAULT_LANDING_CONFIG, ...data, visibility: { ...DEFAULT_LANDING_CONFIG.visibility, ...(data.visibility || {}) } }
    }
    return DEFAULT_LANDING_CONFIG
  } catch (err) {
    return DEFAULT_LANDING_CONFIG
  }
}

export function subscribeToLandingPageConfig(callback: (config: LandingPageConfig) => void) {
  return onSnapshot(LANDING_DOC_REF(), (snap) => {
    if (snap.exists()) {
      const data = snap.data() as Partial<LandingPageConfig>
      callback({ ...DEFAULT_LANDING_CONFIG, ...data, visibility: { ...DEFAULT_LANDING_CONFIG.visibility, ...(data.visibility || {}) } })
    } else {
      callback(DEFAULT_LANDING_CONFIG)
    }
  }, () => callback(DEFAULT_LANDING_CONFIG))
}

export async function saveLandingPageConfig(config: LandingPageConfig): Promise<void> {
  await setDoc(LANDING_DOC_REF(), { ...config, updatedAt: new Date().toISOString() })
}

export async function submitClientFeedback(currentConfig: LandingPageConfig, newFeedback: Omit<FeedbackItem, 'id' | 'createdAt' | 'approved'>): Promise<FeedbackItem> {
  const item: FeedbackItem = { ...newFeedback, id: `fb-${Date.now()}`, createdAt: new Date().toISOString().split('T')[0], approved: true }
  const updatedFeedbacks = [item, ...(currentConfig.feedbacks || [])]
  await setDoc(LANDING_DOC_REF(), { ...currentConfig, feedbacks: updatedFeedbacks, updatedAt: new Date().toISOString() }, { merge: true })
  return item
}

export async function submitFreeTrialRequest(request: Omit<TrialRequestItem, 'id' | 'createdAt' | 'status'>): Promise<void> {
  await addDoc(collection(db, 'trial_requests'), { ...request, createdAt: new Date().toISOString(), status: 'new' })
}

export async function getFreeTrialRequests(): Promise<TrialRequestItem[]> {
  try {
    const q = query(collection(db, 'trial_requests'), orderBy('createdAt', 'desc'))
    const snap = await getDocs(q)
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as TrialRequestItem) }))
  } catch (err) {
    return []
  }
}
