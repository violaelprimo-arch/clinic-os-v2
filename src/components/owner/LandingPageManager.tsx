'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  Save,
  Plus,
  Trash2,
  Monitor,
  Smartphone,
  Tablet,
  Undo2,
  Sparkles,
  X,
  Eye,
  EyeOff,
  RefreshCw,
  ArrowUpRight,
  LoaderCircle,
  CheckCircle2,
  ExternalLink,
  Star,
  Check,
  MessageSquare,
  Layers,
  ArrowUp,
  ArrowDown,
  Layout,
  HelpCircle,
  DollarSign,
  Rocket,
  Image as ImageIcon,
  AlertTriangle,
  Lightbulb,
  FileText,
  Clock,
  Phone,
  Tag
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { MediaUploader } from '@/components/common/MediaUploader'
import { useLanguage } from '@/context/LanguageContext'
import {
  DEFAULT_LANDING_CONFIG,
  DEFAULT_SECTION_ORDER,
  type LandingPageConfig,
  type ScreenshotItem,
  type FeatureItem,
  type StepItem,
  type PricingPlanItem,
  type FaqItem,
  type FeedbackItem,
  type ClientItem,
  type ContactItem,
  type StatItem,
  type LandingInquiryItem,
  type TrialRequestItem,
} from '@/lib/landing-config'
import {
  getLandingPageConfig,
  saveLandingPageConfig,
  getFreeTrialRequests,
  getLandingInquiries,
  updateLandingInquiry,
} from '@/lib/landing-service'
import { toast } from 'sonner'
import '@/components/landing/landing.css'

const sectionLabels: Record<string, string> = {
  navbar: 'القائمة الرئيسية والتنقل (Navbar)',
  hero: 'القسم الرئيسي (Hero)',
  stats: 'الإحصائيات والأرقام (Stats)',
  features: 'مميزات المنصة (Features)',
  gallery: 'معرض واجهات وصور النظام (Gallery Carousel)',
  steps: 'خطوات بدء الاستخدام (How It Works)',
  testimonials: 'آراء الأطباء والعملاء (Testimonials)',
  partners: 'شعارات العيادات المتعاونة (Clients & Logos)',
  pricing: 'الباقات والأسعار (Pricing)',
  faq: 'الأسئلة الشائعة (FAQ Accordion)',
  contact: 'نموذج الاقتراحات والشكاوى والاستفسارات (Contact Form)',
  cta: 'دعوة التجربة والاشتراك (CTA Banner)',
  footer: 'الفوتر وحقوق النشر (Footer)',
}

const sectionVisibilityKeys: Record<string, keyof LandingPageConfig['visibility']> = {
  navbar: 'showNavbar',
  hero: 'showHero',
  stats: 'showStats',
  features: 'showFeatures',
  gallery: 'showScreenshots',
  steps: 'showSteps',
  testimonials: 'showFeedback',
  partners: 'showClients',
  pricing: 'showPricing',
  faq: 'showFaq',
  contact: 'showContactForm',
  cta: 'showTrialBanner',
  footer: 'showFooter',
}

function LivePreview({
  config,
  initialDevice = 'desktop',
  onSelectSection,
}: {
  config: LandingPageConfig
  initialDevice?: 'desktop' | 'tablet' | 'mobile'
  onSelectSection?: (sectionId: string) => void
}) {
  const frame = useRef<HTMLIFrameElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>(initialDevice)
  const [width, setWidth] = useState(700)

  const target = device === 'desktop' ? 1280 : device === 'tablet' ? 768 : 390
  const previewHeight = device === 'desktop' ? 850 : device === 'tablet' ? 850 : 720
  const scale = Math.min(1, width / target)

  const send = () => {
    frame.current?.contentWindow?.postMessage(
      { type: 'landing-draft', config },
      location.origin
    )
  }

  useEffect(() => {
    if (box.current?.clientWidth) {
      setWidth(box.current.clientWidth)
    }
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width
      if (w && w > 0) setWidth(w)
    })
    if (box.current) observer.observe(box.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    send()
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== location.origin) return
      if (event.data?.type === 'landing-preview-ready') {
        send()
      } else if (event.data?.type === 'section-selected' && event.data?.sectionId) {
        onSelectSection?.(event.data.sectionId)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [config, onSelectSection])

  return (
    <section className="space-y-4 rounded-3xl border border-sky-100 dark:border-slate-800 bg-white dark:bg-[#081526] p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-black text-slate-900 dark:text-white">
            معاينة حية وتفاعلية
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            شاهد كيف ستظهر الواجهة للزوار على الكمبيوتر والموبايل قبل النشر
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
            <button
              type="button"
              onClick={() => setDevice('desktop')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                device === 'desktop'
                  ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-xs'
                  : 'text-slate-500'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>كمبيوتر</span>
            </button>
            <button
              type="button"
              onClick={() => setDevice('tablet')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                device === 'tablet'
                  ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-xs'
                  : 'text-slate-500'
              }`}
            >
              <Tablet className="w-3.5 h-3.5" />
              <span>تابلت</span>
            </button>
            <button
              type="button"
              onClick={() => setDevice('mobile')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                device === 'mobile'
                  ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-xs'
                  : 'text-slate-500'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>موبايل</span>
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open('/landing-preview', '_blank')}
            title="فتح المعاينة في نافذة جديدة"
          >
            <ExternalLink className="h-4 w-4" />
            نافذة جديدة
          </Button>
        </div>
      </div>

      <div ref={box} className="w-full min-w-0 overflow-hidden">
        <div
          dir="ltr"
          className="relative mx-auto overflow-hidden rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-background shadow-md transition-all duration-200"
          style={{ width: target * scale, height: previewHeight * scale }}
        >
          <iframe
            ref={frame}
            src="/landing-preview"
            title="بروفة الواجهة الرئيسية"
            onLoad={send}
            className="border-0 bg-background"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: target,
              height: previewHeight,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              display: 'block',
            }}
          />
        </div>
      </div>
    </section>
  )
}

const cmsTabs = [
  ['order', 'ترتيب الأقسام والظهور', Layout],
  ['theme', 'المظهر العام والحركة', Sparkles],
  ['hero', 'القسم الرئيسي Hero', Monitor],
  ['gallery', 'معرض صور النظام', ImageIcon],
  ['features', 'مميزات المنصة', Layers],
  ['steps', 'خطوات الاستخدام', Rocket],
  ['pricing', 'الباقات والأسعار', DollarSign],
  ['faq', 'الأسئلة الشائعة', HelpCircle],
  ['inbox', 'صندوق الشكاوى والاقتراحات', MessageSquare],
  ['testimonials', 'الآراء والعملاء', Star],
  ['stats', 'الإحصائيات', CheckCircle2],
  ['contacts', 'التواصل والفوتر', Phone],
  ['trials', 'طلبات التجربة', FileText],
] as const

type CmsTab = (typeof cmsTabs)[number][0]

export function LandingPageManager() {
  const { isRtl } = useLanguage()
  const [config, setConfig] = useState<LandingPageConfig>(structuredClone(DEFAULT_LANDING_CONFIG))
  const [savedJson, setSavedJson] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [activeTab, setActiveTab] = useState<CmsTab>('order')
  const [busy, setBusy] = useState(false)

  // Inquiries Inbox
  const [inquiries, setInquiries] = useState<LandingInquiryItem[]>([])
  const [inquiriesFilter, setInquiriesFilter] = useState<'all' | 'suggestion' | 'complaint' | 'inquiry'>('all')
  const [trials, setTrials] = useState<TrialRequestItem[]>([])

  const isDirty = loaded && savedJson !== JSON.stringify(config)

  const setConfigField = <K extends keyof LandingPageConfig>(key: K, value: LandingPageConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  // Load configuration and data
  useEffect(() => {
    const load = async () => {
      try {
        const loadedCfg = await getLandingPageConfig()
        setConfig(loadedCfg)
        setSavedJson(JSON.stringify(loadedCfg))
      } catch (e) {
        console.warn('Using default landing config:', e)
      } finally {
        setLoaded(true)
      }

      try {
        const inqs = await getLandingInquiries()
        setInquiries(inqs || [])
      } catch (e) {}

      try {
        const trs = await getFreeTrialRequests()
        setTrials(trs || [])
      } catch (e) {}
    }
    load()
  }, [])

  const handleSaveAndPublish = async () => {
    setBusy(true)
    try {
      await saveLandingPageConfig(config)
      setSavedJson(JSON.stringify(config))
      toast.success('تم نشر وتحديث الصفحة الرئيسية بنجاح! 🚀')
    } catch (err: any) {
      console.error('Save error:', err)
      toast.error(err?.message || 'حدث خطأ أثناء الحفظ')
    } finally {
      setBusy(false)
    }
  }

  // Section Reordering Logic
  const moveSection = (index: number, direction: 'up' | 'down') => {
    const list = [...(config.sectionOrder || DEFAULT_SECTION_ORDER)]
    const targetIdx = direction === 'up' ? index - 1 : index + 1
    if (targetIdx < 0 || targetIdx >= list.length) return
    const temp = list[index]
    list[index] = list[targetIdx]
    list[targetIdx] = temp
    setConfigField('sectionOrder', list)
  }

  const toggleSectionVisibility = (sectionKey: string, enabled: boolean) => {
    const visKey = sectionVisibilityKeys[sectionKey]
    if (!visKey) return
    setConfig((prev) => ({
      ...prev,
      visibility: {
        ...prev.visibility,
        [visKey]: enabled,
      },
    }))
  }

  // Unread inquiries count
  const newInquiriesCount = inquiries.filter((i) => i.status === 'new').length
  const newTrialsCount = trials.filter((t) => t.status === 'new').length

  const filteredInquiries = inquiries.filter((i) =>
    inquiriesFilter === 'all' ? true : i.type === inquiriesFilter
  )

  const handleInquiryStatusChange = async (id: string, newStatus: string) => {
    try {
      await updateLandingInquiry(id, { status: newStatus })
      setInquiries((prev) =>
        prev.map((i) => (i.id === id ? { ...i, status: newStatus as any } : i))
      )
      toast.success('تم تحديث حالة الرسالة')
    } catch (e) {
      toast.error('تعذر تحديث الحالة')
    }
  }

  const handleInquiryNotesChange = async (id: string, notes: string) => {
    try {
      await updateLandingInquiry(id, { internalNotes: notes })
      setInquiries((prev) =>
        prev.map((i) => (i.id === id ? { ...i, internalNotes: notes } : i))
      )
    } catch (e) {}
  }

  return (
    <div dir="rtl" className="space-y-6">
      {/* Top Header & Save/Publish Toolbar */}
      <div className="p-5 rounded-3xl bg-white dark:bg-[#081526] border border-sky-100 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>إدارة الواجهة الرئيسية لمنصة Yalla Clinic</span>
            {isDirty && (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-[10px] font-bold">
                تعديلات غير منشورة
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            تحكم كامل في نصوص وأقسام وصور وباقات الموقع مع رفع فوري للملفات دون الحاجة لروابط
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isDirty && (
            <button
              type="button"
              onClick={() => {
                if (confirm('هل أنت متأكد من التراجع عن جميع التعديلات غير المنشورة؟')) {
                  setConfig(JSON.parse(savedJson))
                }
              }}
              className="px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
            >
              تراجع
            </button>
          )}

          <Button
            type="button"
            disabled={busy}
            onClick={handleSaveAndPublish}
            className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-[#0066dc] to-[#00a8e8] text-white font-black text-xs shadow-md hover:opacity-95 transition-all cursor-pointer flex items-center gap-2"
          >
            {busy ? (
              <>
                <LoaderCircle className="w-4 h-4 animate-spin" />
                <span>جاري النشر...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>حفظ ونشر التعديلات فوراً</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="bg-white dark:bg-[#081526] p-2 rounded-2xl border border-sky-100 dark:border-slate-800 shadow-sm overflow-x-auto no-scrollbar flex items-center gap-1.5">
        {cmsTabs.map(([id, label, Icon]) => {
          const active = activeTab === id
          const badgeCount = id === 'inbox' ? newInquiriesCount : id === 'trials' ? newTrialsCount : 0

          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`shrink-0 py-2.5 px-3.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                active
                  ? 'bg-sky-50 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400 font-black shadow-xs border border-sky-200 dark:border-sky-800'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
              {badgeCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-mono">
                  {badgeCount}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Main CMS Layout (Form on right/left + Live Preview below/side) */}
      <div className="space-y-6">

        {/* TAB 1: SECTIONS ORDER AND VISIBILITY */}
        {activeTab === 'order' && (
          <section className="p-6 rounded-3xl bg-white dark:bg-[#081526] border border-sky-100 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  ترتيب وإظهار أقسام الصفحة الرئيسية (13 قسماً)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  استخدم الأسهم لإعادة ترتيب الأقسام، والمفاتيح لإظهار أو إخفاء أي قسم. القسم المخفي لا يترك أي فراغ ويختفي من القائمة تلقائياً.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfigField('sectionOrder', DEFAULT_SECTION_ORDER)}
                className="text-xs font-bold text-sky-600 hover:underline cursor-pointer"
              >
                استعادة الترتيب الافتراضي
              </button>
            </div>

            <div className="space-y-2 pt-2">
              {(config.sectionOrder || DEFAULT_SECTION_ORDER).map((secKey, idx) => {
                const label = sectionLabels[secKey] || secKey
                const visKey = sectionVisibilityKeys[secKey]
                const isEnabled = visKey ? Boolean(config.visibility[visKey]) : true

                return (
                  <div
                    key={secKey}
                    className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                      isEnabled
                        ? 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                        : 'bg-slate-100/50 dark:bg-slate-900/40 border-dashed border-slate-200 dark:border-slate-800 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-lg bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 font-mono font-bold text-xs flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        {label}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Up/Down reordering buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveSection(idx, 'up')}
                          className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-sky-50 disabled:opacity-30 cursor-pointer"
                          title="تحريك لأعلى"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === (config.sectionOrder || DEFAULT_SECTION_ORDER).length - 1}
                          onClick={() => moveSection(idx, 'down')}
                          className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-sky-50 disabled:opacity-30 cursor-pointer"
                          title="تحريك لأسفل"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Visibility Switch */}
                      {visKey && (
                        <div className="flex items-center gap-2 pr-2 border-r border-slate-200 dark:border-slate-700">
                          <Switch
                            checked={isEnabled}
                            onCheckedChange={(checked) => toggleSectionVisibility(secKey, checked)}
                          />
                          <span className="text-xs font-bold text-slate-500">
                            {isEnabled ? 'ظاهر' : 'مخفي'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* TAB: THEME & 3D MOTION SETTINGS */}
        {activeTab === 'theme' && (
          <section className="p-6 rounded-3xl bg-white dark:bg-[#081526] border border-sky-100 dark:border-slate-800 shadow-sm space-y-6">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                إعدادات المظهر والحركة والتأثيرات ثلاثية الأبعاد (3D & Motion)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                تحكم كامل في حركات الخلفية وتأثير التفاعل ثلاثي الأبعاد 3D Tilt وسرعة الانتقالات
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Motion Level */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  مستوى الحركة العامة (Motion Level)
                </label>
                <select
                  value={config.themeSettings?.motionLevel || 'subtle'}
                  onChange={(e) => {
                    const val = e.target.value as 'none' | 'subtle' | 'advanced'
                    setConfig((prev) => ({
                      ...prev,
                      themeSettings: { ...prev.themeSettings, motionLevel: val },
                    }))
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border text-xs"
                >
                  <option value="none">بدون حركة (none) — أقصى ثبات وأداء</option>
                  <option value="subtle">حركة هادئة وانسيابية (subtle) — الافتراضي المتوازن</option>
                  <option value="advanced">حركة متقدمة وتفاعل أعمق (advanced)</option>
                </select>
                <p className="text-[11px] text-slate-400">
                  يراعي النظام تلقائيًا تفضيلات المستخدم (prefers-reduced-motion) ويخفض التأثيرات على الموبايل.
                </p>
              </div>

              {/* Primary Brand Color Preset */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  لون الهوية الرئيسي (Primary Accent)
                </label>
                <select
                  value={config.themeSettings?.primaryColorPreset || 'blue'}
                  onChange={(e) => {
                    const val = e.target.value as any
                    setConfig((prev) => ({
                      ...prev,
                      themeSettings: { ...prev.themeSettings, primaryColorPreset: val },
                    }))
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border text-xs"
                >
                  <option value="blue">أزرق يلا كلينيك الرسمي (#0066dc)</option>
                  <option value="cyan">سيان سماوي (Cyan)</option>
                  <option value="indigo">نيلي طبي (Indigo)</option>
                  <option value="teal">تيل صحي (Teal)</option>
                  <option value="emerald">زمردي (Emerald)</option>
                </select>
              </div>

              {/* 3D Tilt Toggle */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    تفعيل التفاعل ثلاثي الأبعاد مع الماوس (3D Tilt)
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    انحناء البطاقات وشاشات النظام بزاوية 3D وإضاءة لمعان ديناميكية عند تحريك المؤشر
                  </p>
                </div>
                <Switch
                  checked={config.themeSettings?.enable3DTilt !== false}
                  onCheckedChange={(checked) => {
                    setConfig((prev) => ({
                      ...prev,
                      themeSettings: { ...prev.themeSettings, enable3DTilt: checked },
                    }))
                  }}
                />
              </div>

              {/* Animated Background Mesh Toggle */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    تفعيل حركة الخلفية المتدرجة (Animated Background)
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    طبقات إضاءة ناعمة بألوان الأزرق والسيان والشبكة الهندسية تتحرك في الخلفية
                  </p>
                </div>
                <Switch
                  checked={config.themeSettings?.enableBackgroundAnimation !== false}
                  onCheckedChange={(checked) => {
                    setConfig((prev) => ({
                      ...prev,
                      themeSettings: { ...prev.themeSettings, enableBackgroundAnimation: checked },
                    }))
                  }}
                />
              </div>

              {/* 3D Hero Scene Toggle */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    تشغيل المشهد ثلاثي الأبعاد 3D (Clinic Pillars 3D Scene)
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    عرض مجسم 3D متفاعل في الواجهة يعبر عن اتصال وظائف العيادة الخمس ومسارات التدفق
                  </p>
                </div>
                <Switch
                  checked={config.themeSettings?.enableHero3D !== false}
                  onCheckedChange={(checked) => {
                    setConfig((prev) => ({
                      ...prev,
                      themeSettings: { ...prev.themeSettings, enableHero3D: checked },
                    }))
                  }}
                />
              </div>

              {/* Card Depth & Edge Glow Toggle */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    تأثيرات توهج البطاقات والعمق (Card Glow & Depth)
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    إضاءة حواف البطاقات وانعكاسات زجاجية ناعمة عند تحريك المؤشر
                  </p>
                </div>
                <Switch
                  checked={config.themeSettings?.enableCardGlow !== false}
                  onCheckedChange={(checked) => {
                    setConfig((prev) => ({
                      ...prev,
                      themeSettings: { ...prev.themeSettings, enableCardGlow: checked },
                    }))
                  }}
                />
              </div>

              {/* Motion Speed Preset */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  سرعة الحركة والتنقل (Motion Speed)
                </label>
                <select
                  value={config.themeSettings?.motionSpeed || 'normal'}
                  onChange={(e) => {
                    const val = e.target.value as 'slow' | 'normal' | 'fast'
                    setConfig((prev) => ({
                      ...prev,
                      themeSettings: { ...prev.themeSettings, motionSpeed: val },
                    }))
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border text-xs"
                >
                  <option value="slow">هادئ وبطيء (Slow) — استرخاء وراحة بصرية</option>
                  <option value="normal">متوازن وطبيعي (Normal) — الافتراضي الموصى به</option>
                  <option value="fast">سريع وحيوي (Fast) — استجابة فورية</option>
                </select>
              </div>

              {/* Mobile Motion Optimization */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    تفعيل الحركة على أجهزة الموبايل
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    تشغيل تأثيرات الحركة المتوازنة لشاشات الهواتف والتابلت مع ترشيد البطارية
                  </p>
                </div>
                <Switch
                  checked={config.themeSettings?.enableMobileMotion !== false}
                  onCheckedChange={(checked) => {
                    setConfig((prev) => ({
                      ...prev,
                      themeSettings: { ...prev.themeSettings, enableMobileMotion: checked },
                    }))
                  }}
                />
              </div>

              {/* Section Entrance Motion */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    حركة الظهور التتابعي للأقسام (Section Scroll-Reveal)
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    ظهور ناعم متتابع للبطاقات والعناصر أثناء تمرير الصفحة مع الحفاظ الدائم على وضوح المحتوى
                  </p>
                </div>
                <Switch
                  checked={config.themeSettings?.enableSectionMotion !== false}
                  onCheckedChange={(checked) => {
                    setConfig((prev) => ({
                      ...prev,
                      themeSettings: { ...prev.themeSettings, enableSectionMotion: checked },
                    }))
                  }}
                />
              </div>
            </div>
          </section>
        )}

        {/* TAB 2: HERO SECTION */}
        {activeTab === 'hero' && (
          <section className="p-6 rounded-3xl bg-white dark:bg-[#081526] border border-sky-100 dark:border-slate-800 shadow-sm space-y-5">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                محتوى وصورة القسم الرئيسي (Hero)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                العنوان الرئيسي والوصف والصورة ونصوص الأزرار الموجهة للأطباء
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  الشارة العلوية (Badge)
                </label>
                <input
                  type="text"
                  value={config.heroBadge}
                  onChange={(e) => setConfigField('heroBadge', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  العنوان الأول
                </label>
                <input
                  type="text"
                  value={config.heroTitle}
                  onChange={(e) => setConfigField('heroTitle', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  الكلمة المميزة الملونة
                </label>
                <input
                  type="text"
                  value={config.heroHighlight}
                  onChange={(e) => setConfigField('heroHighlight', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-sky-600 font-bold"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  الوصف التوضيحي للعيادات
                </label>
                <textarea
                  rows={3}
                  value={config.heroSubtitle}
                  onChange={(e) => setConfigField('heroSubtitle', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs leading-relaxed"
                />
              </div>

              {/* Real System Image Upload from Device */}
              <div className="sm:col-span-2">
                <MediaUploader
                  label="صورة شاشة النظام في واجهة الهيرو (رفع من الجهاز)"
                  hint="اختر لقطة شاشة حقيقية لنظام العيادة من جهازك. يتم الرفع إلى التخزين السحابي وحفظ الرابط تلقائياً."
                  value={config.heroImage || ''}
                  folder="hero"
                  maxSizeMB={5}
                  onChange={(url) => setConfigField('heroImage', url)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  نص زر طلب التجربة الأساسي
                </label>
                <input
                  type="text"
                  value={config.trialButtonText}
                  onChange={(e) => setConfigField('trialButtonText', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  نص زر جولة الصور الثانوي
                </label>
                <input
                  type="text"
                  value={config.galleryButtonText}
                  onChange={(e) => setConfigField('galleryButtonText', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  مدة التجربة المجانية (أيام)
                </label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={config.trialDaysCount}
                  onChange={(e) => setConfigField('trialDaysCount', Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  رابط زر دخول العيادة
                </label>
                <input
                  type="text"
                  value={config.loginUrl}
                  onChange={(e) => setConfigField('loginUrl', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                  dir="ltr"
                />
              </div>
            </div>
          </section>
        )}

        {/* TAB 3: SYSTEM GALLERY (DYNAMIC SCREENSHOTS & CAROUSEL SETTINGS) */}
        {activeTab === 'gallery' && (
          <section className="p-6 rounded-3xl bg-white dark:bg-[#081526] border border-sky-100 dark:border-slate-800 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  معرض صور واجهات النظام (System Screenshots Carousel)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  أضف وعدّل لقطات شاشات النظام الحقيقية، مع رفع الملفات مباشرة من جهازك ودعم Lightbox التكبير التلقائي
                </p>
              </div>

              <Button
                type="button"
                onClick={() => {
                  const newShot: ScreenshotItem = {
                    id: 'shot_' + Date.now(),
                    title: 'لقطة شاشة جديدة',
                    subtitle: 'وصف مختصر للوظيفة بالعيادة',
                    category: 'النظام',
                    imageUrl: '',
                    altText: 'شاشة النظام',
                    highlights: ['ميزة 1', 'ميزة 2'],
                    visible: true,
                    titleEn: '',
                    subtitleEn: '',
                    categoryEn: '',
                    highlightsEn: []
                  }
                  setConfigField('screenshots', [...config.screenshots, newShot])
                }}
                className="rounded-xl bg-sky-600 text-white font-bold text-xs"
              >
                <Plus className="w-4 h-4 ml-1" />
                <span>إضافة لقطة شاشة</span>
              </Button>
            </div>

            {/* Carousel Speed & Autoplay Settings */}
            <div className="p-4 rounded-2xl bg-sky-50/60 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Switch
                  checked={config.gallerySettings?.autoplay ?? true}
                  onCheckedChange={(checked) =>
                    setConfigField('gallerySettings', {
                      ...config.gallerySettings,
                      autoplay: checked,
                    })
                  }
                />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  تشغيل التحريك التلقائي للمعرض
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  سرعة التبديل: {config.gallerySettings?.intervalSeconds || 6} ثوانٍ
                </span>
                <input
                  type="range"
                  min={3}
                  max={15}
                  step={1}
                  value={config.gallerySettings?.intervalSeconds || 6}
                  onChange={(e) =>
                    setConfigField('gallerySettings', {
                      ...config.gallerySettings,
                      intervalSeconds: Number(e.target.value),
                    })
                  }
                  className="w-28 accent-sky-600 cursor-pointer"
                />
              </div>
            </div>

            {/* Screenshots List */}
            <div className="space-y-4">
              {config.screenshots.map((shot, idx) => (
                <div
                  key={shot.id || idx}
                  className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-sky-600 dark:text-sky-400">
                        صورة #{idx + 1}: {shot.title}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Switch
                          checked={shot.visible !== false}
                          onCheckedChange={(checked) => {
                            const arr = [...config.screenshots]
                            arr[idx].visible = checked
                            setConfigField('screenshots', arr)
                          }}
                        />
                        <span className="text-[11px] font-bold text-slate-500">
                          {shot.visible !== false ? 'ظاهرة بالمعرض' : 'مخفية'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => {
                          const arr = [...config.screenshots]
                          ;[arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]
                          setConfigField('screenshots', arr)
                        }}
                        className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 border flex items-center justify-center text-xs disabled:opacity-30 cursor-pointer"
                        title="تحريك لأعلى"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={idx === config.screenshots.length - 1}
                        onClick={() => {
                          const arr = [...config.screenshots]
                          ;[arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]
                          setConfigField('screenshots', arr)
                        }}
                        className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 border flex items-center justify-center text-xs disabled:opacity-30 cursor-pointer"
                        title="تحريك لأسفل"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm('هل تريد حذف هذه الصورة من المعرض؟')) {
                            setConfigField(
                              'screenshots',
                              config.screenshots.filter((_, i) => i !== idx)
                            )
                          }
                        }}
                        className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center text-xs hover:bg-rose-100 cursor-pointer"
                        title="حذف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        عنوان الشاشة
                      </label>
                      <input
                        type="text"
                        value={shot.title}
                        onChange={(e) => {
                          const arr = [...config.screenshots]
                          arr[idx].title = e.target.value
                          setConfigField('screenshots', arr)
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        التصنيف (مثال: لوحة الطبيب / الروشتة / شاشة TV)
                      </label>
                      <input
                        type="text"
                        value={shot.category}
                        onChange={(e) => {
                          const arr = [...config.screenshots]
                          arr[idx].category = e.target.value
                          setConfigField('screenshots', arr)
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border text-xs"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        الوصف المختصر
                      </label>
                      <input
                        type="text"
                        value={shot.subtitle}
                        onChange={(e) => {
                          const arr = [...config.screenshots]
                          arr[idx].subtitle = e.target.value
                          setConfigField('screenshots', arr)
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border text-xs"
                      />
                    </div>

                    {/* MediaUploader for this screenshot */}
                    <div className="sm:col-span-2">
                      <MediaUploader
                        label="ملف صورة الشاشة (رفع من الجهاز)"
                        value={shot.imageUrl}
                        folder="screenshots"
                        maxSizeMB={5}
                        onChange={(url) => {
                          const arr = [...config.screenshots]
                          arr[idx].imageUrl = url
                          setConfigField('screenshots', arr)
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* TAB 4: FEATURES */}
        {activeTab === 'features' && (
          <section className="p-6 rounded-3xl bg-white dark:bg-[#081526] border border-sky-100 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  مميزات المنصة الطبية (5 ركائز سريرية حقيقية)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  مزايا فعلية تعمل بالنظام دون وعود وهمية أو ادعاءات ذكاء اصطناعي غير منفذة
                </p>
              </div>
              <Button
                type="button"
                onClick={() => {
                  const newF: FeatureItem = {
                    id: 'feat_' + Date.now(),
                    iconName: 'CheckCircle2',
                    title: 'ميزة جديدة',
                    description: 'وصف تفصيلي للوظيفة في العيادة',
                    category: 'doctor',
                    badge: 'خاصية',
                    imageUrl: '',
                    practicalBenefit: 'الفائدة العملية للميزة',
                    targetAudience: 'doctor',
                    visible: true,
                    titleEn: '',
                    descriptionEn: '',
                    badgeEn: '',
                    practicalBenefitEn: ''
                  }
                  setConfigField('features', [...config.features, newF])
                }}
                className="rounded-xl bg-sky-600 text-white font-bold text-xs"
              >
                <Plus className="w-4 h-4 ml-1" />
                <span>إضافة ميزة</span>
              </Button>
            </div>

            <div className="space-y-3">
              {config.features.map((feat, idx) => (
                <div
                  key={feat.id || idx}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-sky-600">
                        ميزة #{idx + 1}: {feat.title}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Switch
                          checked={feat.visible !== false}
                          onCheckedChange={(checked) => {
                            const arr = [...config.features]
                            arr[idx].visible = checked
                            setConfigField('features', arr)
                          }}
                        />
                        <span className="text-[11px] font-bold text-slate-500">
                          {feat.visible !== false ? 'ظاهرة' : 'مخفية'}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setConfigField('features', config.features.filter((_, i) => i !== idx))
                      }}
                      className="text-xs text-rose-500 hover:underline cursor-pointer"
                    >
                      حذف
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">
                        عنوان الميزة
                      </label>
                      <input
                        type="text"
                        value={feat.title}
                        onChange={(e) => {
                          const arr = [...config.features]
                          arr[idx].title = e.target.value
                          setConfigField('features', arr)
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">
                        الشارة الفرعية (Badge)
                      </label>
                      <input
                        type="text"
                        value={feat.badge || ''}
                        onChange={(e) => {
                          const arr = [...config.features]
                          arr[idx].badge = e.target.value
                          setConfigField('features', arr)
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">
                        الفئة المستهدفة
                      </label>
                      <select
                        value={feat.targetAudience || 'all'}
                        onChange={(e) => {
                          const arr = [...config.features]
                          arr[idx].targetAudience = e.target.value as any
                          setConfigField('features', arr)
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border text-xs font-bold"
                      >
                        <option value="doctor">🩺 للطبيب والعيادة</option>
                        <option value="reception">📋 للاستقبال والإدارة</option>
                        <option value="patient">📱 لتجربة المريض</option>
                        <option value="all">الكل (عامة)</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">
                        الفائدة العملية المباشرة للميزة (Practical Benefit)
                      </label>
                      <input
                        type="text"
                        placeholder="مثال: متابعة الدور من المنزل والرجوع الفوري لتاريخ زيارات المريض"
                        value={feat.practicalBenefit || ''}
                        onChange={(e) => {
                          const arr = [...config.features]
                          arr[idx].practicalBenefit = e.target.value
                          setConfigField('features', arr)
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border text-xs"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">
                        الوصف
                      </label>
                      <textarea
                        rows={2}
                        value={feat.description}
                        onChange={(e) => {
                          const arr = [...config.features]
                          arr[idx].description = e.target.value
                          setConfigField('features', arr)
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border text-xs"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* TAB 5: HOW IT WORKS STEPS */}
        {activeTab === 'steps' && (
          <section className="p-6 rounded-3xl bg-white dark:bg-[#081526] border border-sky-100 dark:border-slate-800 shadow-sm space-y-5">
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              خطوات بدء الاستخدام (How It Works)
            </h3>

            <div className="space-y-4">
              {config.steps.map((st, idx) => (
                <div key={st.id || idx} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border space-y-3">
                  <span className="text-xs font-bold text-sky-600 font-mono">
                    الخطوة 0{st.number || idx + 1}
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">العنوان</label>
                      <input
                        type="text"
                        value={st.title}
                        onChange={(e) => {
                          const arr = [...config.steps]
                          arr[idx].title = e.target.value
                          setConfigField('steps', arr)
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">الوصف</label>
                      <input
                        type="text"
                        value={st.description}
                        onChange={(e) => {
                          const arr = [...config.steps]
                          arr[idx].description = e.target.value
                          setConfigField('steps', arr)
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border text-xs"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* TAB 6: PRICING PLANS */}
        {activeTab === 'pricing' && (
          <section className="p-6 rounded-3xl bg-white dark:bg-[#081526] border border-sky-100 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  باقات الاشتراك والأسعار
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  تعديل أسماء الباقات ومزاياها وقيم الاشتراك المعروضة
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {config.pricingPlans.map((plan, idx) => (
                <div key={plan.id || idx} className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-sky-600">
                      باقة: {plan.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold text-slate-500 flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={plan.popular}
                          onChange={(e) => {
                            const arr = [...config.pricingPlans]
                            arr[idx].popular = e.target.checked
                            setConfigField('pricingPlans', arr)
                          }}
                        />
                        <span>تمييز كباقة مفضلة (Popular)</span>
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">اسم الباقة</label>
                      <input
                        type="text"
                        value={plan.name}
                        onChange={(e) => {
                          const arr = [...config.pricingPlans]
                          arr[idx].name = e.target.value
                          setConfigField('pricingPlans', arr)
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">السعر (ج.م)</label>
                      <input
                        type="text"
                        value={plan.price}
                        onChange={(e) => {
                          const arr = [...config.pricingPlans]
                          arr[idx].price = e.target.value
                          setConfigField('pricingPlans', arr)
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">الدورية (مثال: شهرياً)</label>
                      <input
                        type="text"
                        value={plan.period}
                        onChange={(e) => {
                          const arr = [...config.pricingPlans]
                          arr[idx].period = e.target.value
                          setConfigField('pricingPlans', arr)
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      المزايا (اكتب كل ميزة في سطر منفصل)
                    </label>
                    <textarea
                      rows={4}
                      value={(plan.features || []).join('\n')}
                      onChange={(e) => {
                        const arr = [...config.pricingPlans]
                        arr[idx].features = e.target.value.split('\n').filter((s) => s.trim().length > 0)
                        setConfigField('pricingPlans', arr)
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border text-xs leading-relaxed"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* TAB 7: FAQ */}
        {activeTab === 'faq' && (
          <section className="p-6 rounded-3xl bg-white dark:bg-[#081526] border border-sky-100 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  الأسئلة الشائعة (FAQ Accordion)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  إضافة وتعديل الأسئلة وإجاباتها بسهولة دون تعديل الكود
                </p>
              </div>
              <Button
                type="button"
                onClick={() => {
                  const newFaq: FaqItem = {
                    id: 'faq_' + Date.now(),
                    question: 'سؤال جديد؟',
                    answer: 'إجابة توضيحية مفصلة...',
                    category: 'عام',
                    visible: true,
                    questionEn: '',
                    answerEn: ''
                  }
                  setConfigField('faqItems', [...config.faqItems, newFaq])
                }}
                className="rounded-xl bg-sky-600 text-white font-bold text-xs"
              >
                <Plus className="w-4 h-4 ml-1" />
                <span>إضافة سؤال</span>
              </Button>
            </div>

            <div className="space-y-3">
              {config.faqItems.map((faq, idx) => (
                <div key={faq.id || idx} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-sky-600">
                      سؤال #{idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setConfigField('faqItems', config.faqItems.filter((_, i) => i !== idx))
                      }}
                      className="text-xs text-rose-500 hover:underline cursor-pointer"
                    >
                      حذف
                    </button>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">السؤال</label>
                    <input
                      type="text"
                      value={faq.question}
                      onChange={(e) => {
                        const arr = [...config.faqItems]
                        arr[idx].question = e.target.value
                        setConfigField('faqItems', arr)
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">الإجابة</label>
                    <textarea
                      rows={2}
                      value={faq.answer}
                      onChange={(e) => {
                        const arr = [...config.faqItems]
                        arr[idx].answer = e.target.value
                        setConfigField('faqItems', arr)
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border text-xs leading-relaxed"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* TAB 8: INBOX (SUGGESTIONS & COMPLAINTS) */}
        {activeTab === 'inbox' && (
          <section className="p-6 rounded-3xl bg-white dark:bg-[#081526] border border-sky-100 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-sky-600" />
                  <span>صندوق وارد الشكاوى والاقتراحات والاستفسارات</span>
                  {newInquiriesCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-xs font-mono">
                      {newInquiriesCount} رسائل جديدة
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  رسائل الزوار والأطباء عبر نموذج التواصل. هذه الرسائل سرية للإدارة فقط ولا تظهر بالواجهة.
                </p>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
                {[
                  { id: 'all', label: 'الكل' },
                  { id: 'inquiry', label: 'استفسارات' },
                  { id: 'suggestion', label: 'اقتراحات' },
                  { id: 'complaint', label: 'شكاوى' },
                ].map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setInquiriesFilter(id as any)}
                    className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                      inquiriesFilter === id
                        ? 'bg-white dark:bg-slate-700 text-sky-600 shadow-xs'
                        : 'text-slate-500'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {filteredInquiries.length === 0 ? (
              <div className="p-10 text-center text-slate-400 text-xs space-y-2">
                <MessageSquare className="w-8 h-8 mx-auto opacity-40" />
                <p>لا توجد رسائل واردة في هذا التصنيف حالياً</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredInquiries.map((inq) => {
                  const isNew = inq.status === 'new'
                  return (
                    <div
                      key={inq.id}
                      className={`p-5 rounded-2xl border space-y-3 transition-colors ${
                        isNew
                          ? 'bg-sky-50/40 dark:bg-sky-950/30 border-sky-300 dark:border-sky-800'
                          : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                              inq.type === 'complaint'
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                                : inq.type === 'suggestion'
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
                            }`}
                          >
                            {inq.type === 'complaint'
                              ? 'شكوى'
                              : inq.type === 'suggestion'
                              ? 'اقتراح'
                              : 'استفسار'}
                          </span>
                          <h4 className="font-black text-sm text-slate-900 dark:text-white">
                            {inq.subject}
                          </h4>
                        </div>

                        <div className="flex items-center gap-2">
                          <select
                            value={inq.status || 'new'}
                            onChange={(e) => handleInquiryStatusChange(inq.id, e.target.value)}
                            className="text-xs font-bold rounded-lg px-2 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600"
                          >
                            <option value="new">جديد</option>
                            <option value="in_progress">قيد المتابعة</option>
                            <option value="resolved">تم الحل</option>
                            <option value="closed">مغلق</option>
                          </select>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {new Date(inq.createdAt || Date.now()).toLocaleDateString('ar-EG')}
                          </span>
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                        {inq.message}
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-xs text-slate-500">
                        <div>
                          <span>المرسل: </span>
                          <strong className="text-slate-800 dark:text-slate-200">{inq.name}</strong>
                          <span className="mx-2">•</span>
                          <span>التواصل: </span>
                          <strong className="font-mono" dir="ltr">{inq.contact}</strong>
                        </div>

                        {/* Internal Notes input */}
                        <div className="flex-1 max-w-sm">
                          <input
                            type="text"
                            placeholder="ملاحظات داخلية للمالك..."
                            defaultValue={inq.internalNotes || ''}
                            onBlur={(e) => handleInquiryNotesChange(inq.id, e.target.value)}
                            className="w-full px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 border text-[11px]"
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {/* TAB 9: TESTIMONIALS & CLIENT LOGOS */}
        {activeTab === 'testimonials' && (
          <section className="p-6 rounded-3xl bg-white dark:bg-[#081526] border border-sky-100 dark:border-slate-800 shadow-sm space-y-6">
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              آراء الأطباء وشعارات العيادات المتعاونة
            </h3>

            {/* Testimonials */}
            <div className="space-y-4">
              {config.feedbacks.filter((f) => f.approved && f.visible !== false).length === 0 && (
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold">تنبيه: لا توجد آراء أطباء معتمدة معروضة حاليًا للزوار</strong>
                    <span>
                      القسم معروض في الصفحة الرئيسية مع بطاقة دعوة للأطباء لمشاركة تقييماتهم. يمكنك إضافة رأي معتمد من الزر أدناه، أو اعتماد الآراء الواردة من نموذج الموقع.
                    </span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                  شهادات وآراء الأطباء (تظهر فقط بعد موافقة الإدارة)
                </h4>
                <Button
                  type="button"
                  onClick={() => {
                    const newFb: FeedbackItem = {
                      id: 'fb_' + Date.now(),
                      authorName: 'د. اسم الطبيب',
                      clinicName: 'اسم العيادة',
                      specialty: 'التخصص',
                      rating: 5,
                      comment: 'رأي الطبيب وتجربته مع المنصة...',
                      avatarUrl: '',
                      createdAt: new Date().toISOString(),
                      approved: true,
                      visible: true
                    }
                    setConfigField('feedbacks', [...config.feedbacks, newFb])
                  }}
                  className="rounded-xl bg-sky-600 text-white font-bold text-xs"
                >
                  <Plus className="w-4 h-4 ml-1" />
                  <span>إضافة رأي</span>
                </Button>
              </div>

              {config.feedbacks.map((fb, idx) => (
                <div key={fb.id || idx} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-sky-600">رأي #{idx + 1}</span>
                      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={fb.approved}
                          onChange={(e) => {
                            const arr = [...config.feedbacks]
                            arr[idx].approved = e.target.checked
                            setConfigField('feedbacks', arr)
                          }}
                        />
                        <span>موافق عليه للنشر (Approved)</span>
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConfigField('feedbacks', config.feedbacks.filter((_, i) => i !== idx))}
                      className="text-xs text-rose-500 hover:underline"
                    >
                      حذف
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">اسم الطبيب</label>
                      <input
                        type="text"
                        value={fb.authorName}
                        onChange={(e) => {
                          const arr = [...config.feedbacks]
                          arr[idx].authorName = e.target.value
                          setConfigField('feedbacks', arr)
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">اسم العيادة</label>
                      <input
                        type="text"
                        value={fb.clinicName}
                        onChange={(e) => {
                          const arr = [...config.feedbacks]
                          arr[idx].clinicName = e.target.value
                          setConfigField('feedbacks', arr)
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">التقييم (1-5)</label>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={fb.rating}
                        onChange={(e) => {
                          const arr = [...config.feedbacks]
                          arr[idx].rating = Number(e.target.value)
                          setConfigField('feedbacks', arr)
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">نص الرأي</label>
                    <textarea
                      rows={2}
                      value={fb.comment}
                      onChange={(e) => {
                        const arr = [...config.feedbacks]
                        arr[idx].comment = e.target.value
                        setConfigField('feedbacks', arr)
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border text-xs"
                    />
                  </div>

                  {/* Photo Uploader for Doctor Review */}
                  <MediaUploader
                    label="صورة الطبيب (اختياري - رفع من الجهاز)"
                    value={fb.avatarUrl || ''}
                    folder="testimonials"
                    maxSizeMB={2}
                    onChange={(url) => {
                      const arr = [...config.feedbacks]
                      arr[idx].avatarUrl = url
                      setConfigField('feedbacks', arr)
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Partner Clinic Logos */}
            <div className="pt-6 border-t space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                  شعارات العيادات المتعاونة (Partner Logos)
                </h4>
                <Button
                  type="button"
                  onClick={() => {
                    const newC: ClientItem = {
                      id: 'cli_' + Date.now(),
                      name: 'عيادة جديدة',
                      specialty: '',
                      city: '',
                      logoUrl: '',
                      link: '',
                      collaborationNote: '',
                      visible: true,
                      nameEn: '',
                      specialtyEn: ''
                    }
                    setConfigField('clients', [...config.clients, newC])
                  }}
                  className="rounded-xl bg-sky-600 text-white font-bold text-xs"
                >
                  <Plus className="w-4 h-4 ml-1" />
                  <span>إضافة شعار</span>
                </Button>
              </div>

              <div className="space-y-3">
                {config.clients.map((cli, idx) => (
                  <div key={cli.id || idx} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-sky-600">عيادة #{idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => setConfigField('clients', config.clients.filter((_, i) => i !== idx))}
                        className="text-xs text-rose-500 hover:underline"
                      >
                        حذف
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1">اسم العيادة / المركز</label>
                        <input
                          type="text"
                          value={cli.name}
                          onChange={(e) => {
                            const arr = [...config.clients]
                            arr[idx].name = e.target.value
                            setConfigField('clients', arr)
                          }}
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1">التخصص أو المدينة</label>
                        <input
                          type="text"
                          value={cli.specialty || ''}
                          onChange={(e) => {
                            const arr = [...config.clients]
                            arr[idx].specialty = e.target.value
                            setConfigField('clients', arr)
                          }}
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border text-xs"
                        />
                      </div>
                    </div>

                    {/* Logo Uploader */}
                    <MediaUploader
                      label="شعار العيادة (رفع ملف من الجهاز)"
                      value={cli.logoUrl || ''}
                      folder="clients"
                      maxSizeMB={3}
                      onChange={(url) => {
                        const arr = [...config.clients]
                        arr[idx].logoUrl = url
                        setConfigField('clients', arr)
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* TAB 10: STATS (Dual-Source: Automated Firestore or Documented Manual) */}
        {activeTab === 'stats' && (
          <section className="p-6 rounded-3xl bg-white dark:bg-[#081526] border border-sky-100 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  الإحصائيات والأرقام (Stats)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  إحصائيات موثقة: ربط مباشر بقاعدة البيانات، أو أرقام يدوية موثقة بسند المصدر مع عد تصاعدي
                </p>
              </div>
              <Button
                type="button"
                onClick={() => {
                  const newStat: StatItem = {
                    id: 'stat_' + Date.now(),
                    label: 'إحصائية جديدة',
                    value: '1',
                    unit: '+',
                    iconName: 'TrendingUp',
                    sourceType: 'manual',
                    sourceNote: 'إحصائية موثقة من إدارة النظام',
                    visible: true,
                    labelEn: '',
                    valueEn: '',
                  }
                  setConfigField('stats', [...config.stats, newStat])
                }}
                className="rounded-xl bg-sky-600 text-white font-bold text-xs"
              >
                <Plus className="w-4 h-4 ml-1" />
                <span>إضافة إحصائية</span>
              </Button>
            </div>

            <div className="space-y-4">
              {config.stats.map((st, idx) => (
                <div
                  key={st.id || idx}
                  className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-sky-600">بطاقة #{idx + 1}</span>
                      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={st.visible !== false}
                          onChange={(e) => {
                            const arr = [...config.stats]
                            arr[idx].visible = e.target.checked
                            setConfigField('stats', arr)
                          }}
                        />
                        <span>إظهار في الصفحة</span>
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConfigField('stats', config.stats.filter((_, i) => i !== idx))}
                      className="text-xs text-rose-500 hover:underline"
                    >
                      حذف
                    </button>
                  </div>

                  {/* Source Type Selector */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-white dark:bg-slate-900 border">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        مصدر الإحصائية
                      </label>
                      <select
                        value={st.sourceType || 'manual'}
                        onChange={(e) => {
                          const arr = [...config.stats]
                          arr[idx].sourceType = e.target.value as 'manual' | 'automated'
                          if (arr[idx].sourceType === 'automated' && !arr[idx].autoMetricKey) {
                            arr[idx].autoMetricKey = 'clinics'
                          }
                          setConfigField('stats', arr)
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border text-xs"
                      >
                        <option value="automated">تلقائي من قاعدة البيانات (محدث وحي)</option>
                        <option value="manual">إحصائية يدوية موثقة</option>
                      </select>
                    </div>

                    {st.sourceType === 'automated' ? (
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                          المقياس البرمجي
                        </label>
                        <select
                          value={st.autoMetricKey || 'clinics'}
                          onChange={(e) => {
                            const arr = [...config.stats]
                            arr[idx].autoMetricKey = e.target.value as any
                            setConfigField('stats', arr)
                          }}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border text-xs"
                        >
                          <option value="clinics">عدد العيادات والمراكز المسجلة</option>
                          <option value="doctors">عدد الأطباء المعتمدين</option>
                          <option value="visits">عدد الكشوفات والزيارات المكتملة</option>
                          <option value="prescriptions">عدد الروشتات الإلكترونية الصادرة</option>
                        </select>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                          ملاحظة المصدر (سند الإحصائية)
                        </label>
                        <input
                          type="text"
                          value={st.sourceNote || ''}
                          placeholder="مثال: إحصائية موثقة من إدارة النظام"
                          onChange={(e) => {
                            const arr = [...config.stats]
                            arr[idx].sourceNote = e.target.value
                            setConfigField('stats', arr)
                          }}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border text-xs"
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">العنوان بالعربية</label>
                      <input
                        type="text"
                        value={st.label}
                        onChange={(e) => {
                          const arr = [...config.stats]
                          arr[idx].label = e.target.value
                          setConfigField('stats', arr)
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">
                        {st.sourceType === 'automated' ? 'قيمة احتياطية' : 'القيمة الرقمية'}
                      </label>
                      <input
                        type="text"
                        value={st.value}
                        onChange={(e) => {
                          const arr = [...config.stats]
                          arr[idx].value = e.target.value
                          setConfigField('stats', arr)
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">الوحدة (مثال: + أو %)</label>
                      <input
                        type="text"
                        value={st.unit || ''}
                        onChange={(e) => {
                          const arr = [...config.stats]
                          arr[idx].unit = e.target.value
                          setConfigField('stats', arr)
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border text-xs"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* TAB 11: CONTACTS & FOOTER */}
        {activeTab === 'contacts' && (
          <section className="p-6 rounded-3xl bg-white dark:bg-[#081526] border border-sky-100 dark:border-slate-800 shadow-sm space-y-5">
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              أرقام التواصل والفوتر
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  رقم واتساب الرئيسي (مع كود الدولة 20)
                </label>
                <input
                  type="text"
                  value={config.primaryWhatsapp}
                  onChange={(e) => setConfigField('primaryWhatsapp', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border text-xs font-mono"
                  dir="ltr"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  نص حقوق الملكية في الفوتر
                </label>
                <input
                  type="text"
                  value={config.footerText}
                  onChange={(e) => setConfigField('footerText', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border text-xs"
                />
              </div>
            </div>
          </section>
        )}

        {/* TAB 12: TRIALS INBOX */}
        {activeTab === 'trials' && (
          <section className="p-6 rounded-3xl bg-white dark:bg-[#081526] border border-sky-100 dark:border-slate-800 shadow-sm space-y-5">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-sky-600" />
              <span>طلبات التجربة المجانية الواردة ({trials.length})</span>
            </h3>

            {trials.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-8">لا توجد طلبات تجربة واردة حالياً</p>
            ) : (
              <div className="space-y-3">
                {trials.map((tr) => (
                  <div key={tr.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <strong className="text-sm font-black text-slate-900 dark:text-white">
                        {tr.doctorName} — {tr.clinicName}
                      </strong>
                      <span className="font-mono text-slate-400">
                        {new Date(tr.createdAt || Date.now()).toLocaleDateString('ar-EG')}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-slate-600 dark:text-slate-300">
                      <span>التخصص: {tr.specialty}</span>
                      <span>الهاتف: <strong className="font-mono" dir="ltr">{tr.phone}</strong></span>
                      <span>البريد: <strong className="font-mono" dir="ltr">{tr.email}</strong></span>
                    </div>
                    {tr.notes && (
                      <p className="p-2 rounded-xl bg-white dark:bg-slate-900 border text-slate-700 dark:text-slate-300">
                        {tr.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* PERSISTENT LIVE PREVIEW COMPONENT */}
        <LivePreview config={config} />
      </div>
    </div>
  )
}
