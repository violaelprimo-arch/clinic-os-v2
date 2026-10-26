'use client'
/* eslint-disable @next/next/no-img-element */
import {
  cloneElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
} from 'react'
import {
  Save,
  Plus,
  Trash2,
  Monitor,
  Smartphone,
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
  Pencil,
  ArrowUp,
  ArrowDown,
  Upload,
  Image as ImageIcon,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useLanguage } from '@/context/LanguageContext'
import {
  DEFAULT_LANDING_CONFIG,
  landingConfigSchema,
  whatsappNumber,
  type LandingPageConfig,
  type ScreenshotItem,
  type FeedbackItem,
  type TrialRequestItem,
} from '@/lib/landing-config'
import {
  getLandingPageConfig,
  saveLandingPageConfig,
  getFreeTrialRequests,
  getClientFeedback,
  landingApi,
} from '@/lib/landing-service'
import '@/components/landing/landing.css'

type Field = {
  key: string
  label: string
  type?: 'text' | 'number' | 'textarea' | 'image' | 'checkbox'
}
function FieldEditor({
  label,
  children,
}: {
  label: string
  children: ReactElement<{ id?: string }>
}) {
  const id = useId()
  return (
    <div className="landing-label">
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, { id })}
    </div>
  )
}
function ImageEditor({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <input
        aria-label="رابط الصورة"
        type="text"
        dir="ltr"
        className="landing-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://…"
      />
      <p className="text-xs leading-6 text-muted-foreground">
        ضع رابط HTTPS مباشرًا للصورة. تأكد أن الصورة متاحة للجميع دون تسجيل
        دخول.
      </p>
      {value && (
        <img
          src={value}
          alt="معاينة الصورة"
          referrerPolicy="no-referrer"
          className="h-24 max-w-full rounded-xl border border-border object-contain"
        />
      )}
    </div>
  )
}
function ListEditor<T extends object>({
  items,
  fields,
  onChange,
  create,
  title,
}: {
  items: T[]
  fields: Field[]
  onChange: (items: T[]) => void
  create: () => T
  title: string
}) {
  const change = (index: number, key: string, value: unknown) =>
    onChange(
      items.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
    )
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-black">{title}</h3>
        <Button
          variant="outline"
          onClick={() => onChange([...items, create()])}
        >
          <Plus />
          إضافة
        </Button>
      </div>
      {items.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          لا توجد عناصر. أضف أول عنصر من الزر أعلاه.
        </p>
      )}
      {items.map((item, index) => (
        <article
          key={String((item as Record<string, unknown>).id || index)}
          className="space-y-4 rounded-2xl border border-border bg-card p-5"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-primary">
              {title} · {index + 1}
            </span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                disabled={index === 0}
                onClick={() => {
                  const next = [...items]
                  ;[next[index - 1], next[index]] = [
                    next[index],
                    next[index - 1],
                  ]
                  onChange(next)
                }}
              >
                ↑<span className="sr-only">نقل لأعلى</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={index === items.length - 1}
                onClick={() => {
                  const next = [...items]
                  ;[next[index], next[index + 1]] = [
                    next[index + 1],
                    next[index],
                  ]
                  onChange(next)
                }}
              >
                ↓<span className="sr-only">نقل لأسفل</span>
              </Button>
              <Button
                variant="destructive"
                size="icon-sm"
                aria-label={`حذف ${title} ${index + 1}`}
                onClick={() => onChange(items.filter((_, i) => i !== index))}
              >
                <Trash2 />
              </Button>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((field) => {
              const value = (item as Record<string, unknown>)[field.key]
              return (
                <div
                  key={field.key}
                  className={
                    field.type === 'textarea' || field.type === 'image'
                      ? 'sm:col-span-2'
                      : ''
                  }
                >
                  {field.type === 'image' ? (
                    <div className="landing-label">
                      {field.label}
                      <ImageEditor
                        value={String(value || '')}
                        onChange={(v) => change(index, field.key, v)}
                      />
                    </div>
                  ) : (
                    <FieldEditor label={field.label}>
                      {field.type === 'textarea' ? (
                        <textarea
                          className="landing-input h-auto py-3"
                          rows={3}
                          maxLength={4000}
                          value={
                            Array.isArray(value)
                              ? value.join('\n')
                              : String(value || '')
                          }
                          onChange={(e) =>
                            change(
                              index,
                              field.key,
                              Array.isArray(value)
                                ? e.target.value.split('\n')
                                : e.target.value,
                            )
                          }
                        />
                      ) : field.type === 'checkbox' ? (
                        <input
                          type="checkbox"
                          checked={Boolean(value)}
                          onChange={(e) =>
                            change(index, field.key, e.target.checked)
                          }
                          className="size-5 accent-primary"
                        />
                      ) : (
                        <input
                          className="landing-input"
                          type={field.type || 'text'}
                          value={String(value ?? '')}
                          onChange={(e) =>
                            change(
                              index,
                              field.key,
                              field.type === 'number'
                                ? Number(e.target.value)
                                : e.target.value,
                            )
                          }
                          maxLength={250}
                        />
                      )}
                    </FieldEditor>
                  )}
                </div>
              )
            })}
          </div>
        </article>
      ))}
    </div>
  )
}
function LivePreview({
  config,
  initialDevice = 'desktop',
}: {
  config: LandingPageConfig
  initialDevice?: 'desktop' | 'mobile'
}) {
  const frame = useRef<HTMLIFrameElement>(null),
    box = useRef<HTMLDivElement>(null)
  const [device, setDevice] = useState<'desktop' | 'mobile'>(initialDevice),
    [width, setWidth] = useState(700)
  const target = device === 'desktop' ? 1280 : 390,
    previewHeight = device === 'desktop' ? 850 : 700,
    scale = Math.min(1, width / target)

  const send = () => {
    frame.current?.contentWindow?.postMessage(
      { type: 'landing-draft', config },
      location.origin,
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
    const ready = (event: MessageEvent) => {
      if (
        event.origin === location.origin &&
        event.source === frame.current?.contentWindow &&
        event.data?.type === 'landing-preview-ready'
      )
        send()
    }
    window.addEventListener('message', ready)
    return () => window.removeEventListener('message', ready)
  }, [config])

  return (
    <section className="rounded-3xl border border-border bg-secondary/25 p-3 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-black">بروفة مباشرة</h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            تعديلات غير منشورة · النماذج معطلة في المعاينة
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={device === 'desktop' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDevice('desktop')}
          >
            <Monitor className="h-4 w-4" />
            كمبيوتر
          </Button>
          <Button
            variant={device === 'mobile' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDevice('mobile')}
          >
            <Smartphone className="h-4 w-4" />
            موبايل
          </Button>
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
          className="relative mx-auto overflow-hidden rounded-2xl border-2 border-border bg-background shadow-md transition-all duration-200"
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
const visibilityLabels = {
    showStats: 'الأرقام والإحصائيات',
    showFeatures: 'المميزات',
    showScreenshots: 'معرض صور المنصة',
    showClients: 'شريط العملاء',
    showFeedback: 'آراء العملاء',
    allowClientFeedbackSubmission: 'نموذج إرسال الرأي',
    showContacts: 'أرقام التواصل',
    showFloatingWhatsapp: 'واتساب العائم',
  } satisfies Record<
    Exclude<keyof LandingPageConfig['visibility'], 'showTrialBanner'>,
    string
  >
const tabs = [
  ['hero', 'النصوص والإحصائيات'],
  ['features', 'المميزات'],
  ['screenshots', 'صور استعراض المنصة'],
  ['clients', 'العملاء'],
  ['feedback', 'استطلاع الآراء'],
  ['contacts', 'التواصل'],
  ['trials', 'طلبات التواصل'],
] as const
type Tab = (typeof tabs)[number][0]
export function LandingPageManager() {
  const { isRtl } = useLanguage()
  const [config, setConfig] = useState<LandingPageConfig>(
      structuredClone(DEFAULT_LANDING_CONFIG),
    ),
    [saved, setSaved] = useState(''),
    [loaded, setLoaded] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]),
    [trials, setTrials] = useState<TrialRequestItem[]>([])
  const [tab, setTab] = useState<Tab>('hero'),
    [language, setLanguage] = useState<'ar' | 'en'>('ar'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('')
  const [inboxError, setInboxError] = useState('')
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false)
  const [screenshotModalOpen, setScreenshotModalOpen] = useState(false)
  const [editingScreenshotIndex, setEditingScreenshotIndex] = useState<number | null>(null)
  const [screenshotDraft, setScreenshotDraft] = useState<ScreenshotItem | null>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAddScreenshot = () => {
    setScreenshotDraft({
      id: crypto.randomUUID(),
      title: '',
      subtitle: '',
      category: '',
      imageUrl: '',
      highlights: [''],
      titleEn: '',
      subtitleEn: '',
      categoryEn: '',
      highlightsEn: [''],
      isVisible: true,
      altText: '',
      altTextEn: '',
    })
    setEditingScreenshotIndex(null)
    setScreenshotModalOpen(true)
  }

  const handleEditScreenshot = (index: number) => {
    const item = config.screenshots[index]
    setScreenshotDraft({
      ...item,
      highlights: Array.isArray(item.highlights) && item.highlights.length ? [...item.highlights] : [''],
      highlightsEn: Array.isArray(item.highlightsEn) && item.highlightsEn.length ? [...item.highlightsEn] : [''],
      isVisible: item.isVisible !== false,
      altText: item.altText || '',
      altTextEn: item.altTextEn || '',
    })
    setEditingScreenshotIndex(index)
    setScreenshotModalOpen(true)
  }

  const handleDeleteScreenshot = (index: number) => {
    const item = config.screenshots[index]
    const name = item.category || item.title || `الشاشة رقم ${index + 1}`
    if (!confirm(`هل أنت متأكد من حذف «${name}» من المعرض؟`)) return
    const next = config.screenshots.filter((_, i) => i !== index)
    set('screenshots', next)
  }

  const handleToggleVisibility = (index: number) => {
    const next = config.screenshots.map((s, i) =>
      i === index ? { ...s, isVisible: s.isVisible === false } : s,
    )
    set('screenshots', next)
  }

  const handleMoveScreenshot = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= config.screenshots.length) return
    const next = [...config.screenshots]
    const temp = next[index]
    next[index] = next[targetIndex]
    next[targetIndex] = temp
    set('screenshots', next)
  }

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      alert('حجم الصورة كبير، الحد الأقصى المسموح 5 ميجابايت')
      return
    }
    setIsUploadingImage(true)
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setScreenshotDraft((prev) => (prev ? { ...prev, imageUrl: dataUrl } : null))
      setIsUploadingImage(false)
    }
    reader.onerror = () => {
      alert('تعذر قراءة ملف الصورة')
      setIsUploadingImage(false)
    }
    reader.readAsDataURL(file)
  }

  const handleSaveScreenshotDraft = () => {
    if (!screenshotDraft) return
    if (!screenshotDraft.category.trim()) {
      alert('يرجى كتابة اسم التبويب')
      return
    }
    if (!screenshotDraft.title.trim()) {
      alert('يرجى كتابة عنوان العرض')
      return
    }
    if (!screenshotDraft.imageUrl.trim()) {
      alert('يرجى إدخال رابط الصورة أو رفع صورة')
      return
    }

    const cleanHighlights = (screenshotDraft.highlights || []).map((h) => h.trim()).filter(Boolean)
    const cleanHighlightsEn = (screenshotDraft.highlightsEn || []).map((h) => h.trim()).filter(Boolean)

    const finalItem: ScreenshotItem = {
      ...screenshotDraft,
      highlights: cleanHighlights,
      highlightsEn: cleanHighlightsEn,
    }

    let next: ScreenshotItem[]
    if (editingScreenshotIndex === null) {
      next = [...config.screenshots, finalItem]
    } else {
      next = config.screenshots.map((s, i) => (i === editingScreenshotIndex ? finalItem : s))
    }
    set('screenshots', next)
    setScreenshotModalOpen(false)
    setScreenshotDraft(null)
    setEditingScreenshotIndex(null)
  }
  const dirty = loaded && saved !== JSON.stringify(config)
  const set = <K extends keyof LandingPageConfig>(
    key: K,
    value: LandingPageConfig[K],
  ) => setConfig((current) => ({ ...current, [key]: value }))
  async function loadInbox() {
    const results = await Promise.allSettled([
      getClientFeedback(),
      getFreeTrialRequests(),
    ])
    const failures: string[] = []
    if (results[0].status === 'fulfilled') setFeedback(results[0].value)
    else failures.push('تعذر تحميل الآراء: ' + results[0].reason.message)
    if (results[1].status === 'fulfilled') setTrials(results[1].value)
    else failures.push('تعذر تحميل طلبات التواصل: ' + results[1].reason.message)
    setInboxError(failures.join(' — '))
  }
  useEffect(() => {
    let cancelled = false
    getLandingPageConfig()
      .then((value) => {
        if (!cancelled) {
          const safeValue = {
            ...value,
            visibility: { ...value.visibility, showTrialBanner: false },
          }
          setConfig(safeValue)
          setSaved(JSON.stringify(safeValue))
          setLoaded(true)
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message)
      })
    void Promise.allSettled([getClientFeedback(), getFreeTrialRequests()]).then(
      (results) => {
        if (cancelled) return
        if (results[0].status === 'fulfilled') setFeedback(results[0].value)
        if (results[1].status === 'fulfilled') setTrials(results[1].value)
        const failures = results.filter(
          (result) => result.status === 'rejected',
        )
        if (failures.length)
          setInboxError(
            'تعذر تحميل بعض البيانات الواردة. استخدم زر التحديث لإعادة المحاولة.',
          )
      },
    )

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const targetSubtab = params.get('section') || params.get('subtab')
      if (targetSubtab && tabs.some(([id]) => id === targetSubtab)) {
        setTab(targetSubtab as Tab)
      }
    }

    return () => {
      cancelled = true
    }
  }, [])
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  async function save() {
    setError('')
    setMessage('')
    const parsed = landingConfigSchema.safeParse(config)
    if (!parsed.success) {
      setError(
        'راجع الحقول: ' +
          parsed.error.issues
            .slice(0, 4)
            .map((issue) => issue.path.join('.') + ' — ' + issue.message)
            .join('، '),
      )
      return
    }
    setBusy(true)
    try {
      await saveLandingPageConfig(parsed.data)
      setSaved(JSON.stringify(config))
      setMessage('تم حفظ ونشر التعديلات على الصفحة الرئيسية.')
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'تعذر الحفظ. التعديلات ما زالت موجودة في البروفة.',
      )
    } finally {
      setBusy(false)
    }
  }
  async function moderate(
    action: 'approve' | 'hide' | 'delete',
    item: FeedbackItem,
  ) {
    if (action === 'delete' && !confirm('حذف هذا الرأي؟')) return
    setBusy(true)
    setError('')
    try {
      await landingApi(
        '/api/owner/landing/feedback',
        action === 'delete' ? 'DELETE' : 'PATCH',
        { id: item.id, approved: action === 'approve' },
      )
      await loadInbox()
      setMessage('تم تحديث الرأي المنشور.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحديث الرأي.')
    } finally {
      setBusy(false)
    }
  }
  const translated = (arKey: string, enKey?: string) =>
    language === 'en' ? enKey || arKey + 'En' : arKey
  const features: Field[] = [
    {
      key: 'iconName',
      label:
        'الأيقونة: Users / Calendar / FileSignature / Database / TrendingUp / Bot / Building2 / Smartphone',
    },
    { key: translated('badge'), label: 'الشارة' },
    { key: translated('title'), label: 'العنوان' },
    { key: translated('description'), label: 'الوصف', type: 'textarea' },
  ]
  return (
    <div className="space-y-5" dir="rtl">
      <div className="sticky top-2 z-20 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/80 bg-card/95 p-4 shadow-lg shadow-black/5 backdrop-blur-xl sm:p-5">
        <div>
          <h2 className="text-xl font-black">
            {isRtl ? 'إدارة الواجهة الرئيسية' : 'Landing page management'}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {dirty
              ? 'تعديلات غير محفوظة'
              : loaded
                ? 'المحتوى المحفوظ محمّل'
                : 'جارٍ تحميل الإعدادات…'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="xl:hidden"
            onClick={() => setMobilePreviewOpen(true)}
          >
            <Eye />
            عرض المعاينة
          </Button>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 rounded-xl border border-border px-3 text-xs"
          >
            فتح الموقع
            <ArrowUpRight className="size-4" />
          </a>
          <Button
            onClick={save}
            disabled={!loaded || busy}
            className="h-11 rounded-xl px-5"
          >
            {busy ? <LoaderCircle className="animate-spin" /> : <Save />}
            حفظ ونشر
          </Button>
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-2xl border border-destructive/25 bg-destructive/5 p-4 text-sm leading-7 text-destructive"
        >
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-2xl bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-400"
        >
          <CheckCircle2 className="size-4" />
          {message}
        </p>
      )}
      {!loaded && error && (
        <Button variant="outline" onClick={() => location.reload()}>
          <RefreshCw />
          إعادة المحاولة
        </Button>
      )}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)] xl:items-start">
      <fieldset
        disabled={!loaded || busy}
        className="min-w-0 space-y-6 disabled:opacity-60"
      >
        <section className="rounded-3xl border border-border bg-card p-5">
          <h3 className="mb-4 text-sm font-black">
            إظهار الأقسام وإخفاؤها (تُنشر عند الحفظ)
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
            {(
              Object.keys(
                visibilityLabels,
              ) as Exclude<
                keyof LandingPageConfig['visibility'],
                'showTrialBanner'
              >[]
            ).map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={config.visibility[key]}
                onClick={() =>
                  set('visibility', {
                    ...config.visibility,
                    [key]: !config.visibility[key],
                  })
                }
                className={`flex items-center justify-between gap-2 rounded-xl border p-3 text-xs font-bold ${config.visibility[key] ? 'border-primary/30 bg-primary/5 text-primary' : 'border-border text-muted-foreground'}`}
              >
                {visibilityLabels[key]}
                {config.visibility[key] ? (
                  <Eye className="size-4" />
                ) : (
                  <EyeOff className="size-4" />
                )}
              </button>
            ))}
          </div>
        </section>
        <div className="flex gap-2 overflow-x-auto pb-2" aria-label="أقسام محرر الواجهة">
          {tabs.map(([id, label]) => {
            const pendingFeedbackCount = feedback.filter((f) => !f.approved).length
            return (
              <Button
                key={id}
                size="sm"
                variant={tab === id ? 'default' : 'outline'}
                onClick={() => setTab(id)}
                className="relative gap-1.5"
              >
                <span>{label}</span>
                {id === 'trials' && trials.length > 0 && (
                  <span className="rounded-full bg-primary/20 text-primary px-1.5 py-0.5 text-[10px] font-black">
                    {trials.length}
                  </span>
                )}
                {id === 'feedback' && feedback.length > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                      pendingFeedbackCount > 0
                        ? 'bg-amber-500 text-white animate-pulse'
                        : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                    }`}
                  >
                    {pendingFeedbackCount > 0 ? `${pendingFeedbackCount} بانتظار الموافقة` : feedback.length}
                  </span>
                )}
              </Button>
            )
          })}
        </div>
        {tab !== 'trials' && (
          <div className="flex items-center gap-3 text-xs font-bold">
            <span>لغة المحتوى:</span>
            <Button
              size="sm"
              variant={language === 'ar' ? 'default' : 'outline'}
              onClick={() => setLanguage('ar')}
            >
              العربية
            </Button>
            <Button
              size="sm"
              variant={language === 'en' ? 'default' : 'outline'}
              onClick={() => setLanguage('en')}
            >
              English
            </Button>
            <span className="text-muted-foreground">
              النص الإنجليزي الفارغ يستخدم النص العربي.
            </span>
          </div>
        )}
        {tab === 'hero' && (
          <section className="space-y-6 rounded-3xl border border-border bg-card p-5">
            <h3 className="font-black">النصوص الرئيسية</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ['heroBadge', 'الشارة العلوية'],
                  ['heroTitle', 'العنوان الرئيسي'],
                  ['heroHighlight', 'العنوان المميز'],
                  ['heroSubtitle', 'وصف المنصة'],
                  ['loginButtonText', 'زر الدخول'],
                  ['footerText', 'الحقوق أسفل الصفحة'],
                ] as const
              ).map(([key, label]) => (
                <FieldEditor label={label} key={key}>
                  <textarea
                    rows={key === 'heroSubtitle' ? 3 : 2}
                    maxLength={key.includes('Button') ? 250 : 4000}
                    className="landing-input h-auto py-3"
                    value={
                      language === 'en' ? config.english[key] : config[key]
                    }
                    onChange={(e) =>
                      language === 'en'
                        ? set('english', {
                            ...config.english,
                            [key]: e.target.value,
                          })
                        : set(key, e.target.value)
                    }
                  />
                </FieldEditor>
              ))}
              <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 sm:col-span-2">
                <p className="text-xs font-black text-primary">
                  أزرار الواجهة الرئيسية
                </p>
                <p className="mt-1 text-xs leading-6 text-muted-foreground">
                  طلب ديمو مجاني · تواصل مع الدعم الفني
                </p>
              </div>
              {(
                [
                  ['loginUrl', 'رابط الدخول'],
                ] as const
              ).map(([key, label]) => (
                <FieldEditor label={label} key={key}>
                  <input
                    className="landing-input"
                    dir="ltr"
                    value={config[key]}
                    onChange={(e) => set(key, e.target.value)}
                  />
                </FieldEditor>
              ))}
            </div>
            <ListEditor
              title="الإحصائيات"
              items={config.stats}
              onChange={(items) => set('stats', items)}
              fields={[
                { key: translated('label'), label: 'العنوان' },
                { key: translated('value'), label: 'القيمة' },
              ]}
              create={() => ({
                label: '',
                value: '',
                labelEn: '',
                valueEn: '',
              })}
            />
            <p className="text-xs text-muted-foreground">
              انشر أرقامًا موثقة فقط. القيم الافتراضية تصف أدوات النظام وليست
              أعداد عملاء أو ضمانات توافر.
            </p>
          </section>
        )}
        {tab === 'features' && (
          <ListEditor
            title="المميزات"
            fields={features}
            items={config.features}
            onChange={(items) => set('features', items)}
            create={() => ({
              id: crypto.randomUUID(),
              iconName: 'Sparkles',
              title: '',
              description: '',
              badge: '',
              titleEn: '',
              descriptionEn: '',
              badgeEn: '',
            })}
          />
        )}
        {tab === 'screenshots' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-border bg-card p-5 shadow-sm">
              <div>
                <h3 className="text-base font-black text-foreground">
                  {translated('صور استعراض المنصة', 'Platform Showcase Screens')}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {translated(
                    'إدارة شاشات المنصة المعروضة في الصفحة الرئيسية: إضافة شاشات جديدة، تعديل النصوص والصور، تغيير الترتيب، أو إخفاء عناصر مؤقتًا.',
                    'Manage showcase screenshots on the homepage: add screens, edit content, reorder, or toggle visibility.',
                  )}
                </p>
              </div>
              <Button
                onClick={handleAddScreenshot}
                className="gap-2 h-10 rounded-xl font-bold shrink-0 shadow-sm"
              >
                <Plus className="size-4" />
                <span>{translated('إضافة صورة جديدة', 'Add New Screen')}</span>
              </Button>
            </div>

            {config.screenshots.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border bg-card/60 p-12 text-center space-y-4">
                <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <ImageIcon className="size-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">
                    {translated('لا توجد صور في المعرض حاليًا', 'No screenshots in gallery currently')}
                  </h4>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {translated(
                      'أضف أول شاشة للبدء في استعراض واجهات المنصة للزوار.',
                      'Add your first screen to start showcasing platform views to visitors.',
                    )}
                  </p>
                </div>
                <Button onClick={handleAddScreenshot} variant="outline" className="gap-2">
                  <Plus className="size-4" />
                  <span>{translated('إضافة أول صورة', 'Add First Screen')}</span>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {config.screenshots.map((shot, index) => {
                  const isVisible = shot.isVisible !== false
                  const titleText =
                    (!isRtl && shot.titleEn ? shot.titleEn : shot.title) ||
                    translated('بدون عنوان', 'Untitled')
                  const categoryText =
                    (!isRtl && shot.categoryEn ? shot.categoryEn : shot.category) ||
                    translated('بدون تبويب', 'Uncategorized')
                  const highlightsCount = (
                    (!isRtl && shot.highlightsEn && shot.highlightsEn.length
                      ? shot.highlightsEn
                      : shot.highlights) || []
                  ).length

                  return (
                    <article
                      key={shot.id || index}
                      className={`group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border p-4 transition-all duration-150 ${
                        isVisible
                          ? 'border-border bg-card hover:border-primary/40 shadow-sm'
                          : 'border-border/60 bg-muted/30 opacity-75'
                      }`}
                    >
                      {/* Left: Thumbnail & Details */}
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        {/* Order Badge */}
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-mono font-bold text-muted-foreground">
                          #{index + 1}
                        </span>

                        {/* Thumbnail */}
                        <div className="relative size-16 shrink-0 overflow-hidden rounded-xl border border-border bg-secondary/30 flex items-center justify-center">
                          {shot.imageUrl ? (
                            <img
                              src={shot.imageUrl}
                              alt={titleText}
                              className="h-full w-full object-contain p-1"
                              onError={(e) => {
                                ;(e.currentTarget as HTMLElement).style.display = 'none'
                              }}
                            />
                          ) : (
                            <ImageIcon className="size-6 text-muted-foreground/40" />
                          )}
                        </div>

                        {/* Info */}
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                              {categoryText}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                isVisible
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {isVisible ? (
                                <>
                                  <Eye className="size-3" />
                                  <span>{translated('ظاهر بالصفحة', 'Visible')}</span>
                                </>
                              ) : (
                                <>
                                  <EyeOff className="size-3" />
                                  <span>{translated('مخفي', 'Hidden')}</span>
                                </>
                              )}
                            </span>
                            {highlightsCount > 0 && (
                              <span className="text-[10px] text-muted-foreground font-medium">
                                • {highlightsCount} {translated('مميزات', 'highlights')}
                              </span>
                            )}
                          </div>
                          <h4 className="truncate text-sm font-bold text-foreground">
                            {titleText}
                          </h4>
                          {shot.subtitle && (
                            <p className="truncate text-xs text-muted-foreground">
                              {!isRtl && shot.subtitleEn ? shot.subtitleEn : shot.subtitle}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                        {/* Move Up */}
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={index === 0}
                          onClick={() => handleMoveScreenshot(index, 'up')}
                          className="size-8 text-muted-foreground hover:text-foreground disabled:opacity-30"
                          title={translated('تحريك لأعلى', 'Move Up')}
                          aria-label={translated('تحريك لأعلى', 'Move Up')}
                        >
                          <ArrowUp className="size-4" />
                        </Button>

                        {/* Move Down */}
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={index === config.screenshots.length - 1}
                          onClick={() => handleMoveScreenshot(index, 'down')}
                          className="size-8 text-muted-foreground hover:text-foreground disabled:opacity-30"
                          title={translated('تحريك لأسفل', 'Move Down')}
                          aria-label={translated('تحريك لأسفل', 'Move Down')}
                        >
                          <ArrowDown className="size-4" />
                        </Button>

                        {/* Visibility Toggle */}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleVisibility(index)}
                          className={`size-8 ${
                            isVisible
                              ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                          title={
                            isVisible
                              ? translated('إخفاء من الزوار', 'Hide')
                              : translated('إظهار للزوار', 'Show')
                          }
                          aria-label={
                            isVisible
                              ? translated('إخفاء من الزوار', 'Hide')
                              : translated('إظهار للزوار', 'Show')
                          }
                        >
                          {isVisible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                        </Button>

                        {/* Edit */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditScreenshot(index)}
                          className="gap-1.5 h-8 px-2.5 text-xs font-bold"
                        >
                          <Pencil className="size-3.5" />
                          <span>{translated('تعديل', 'Edit')}</span>
                        </Button>

                        {/* Delete */}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteScreenshot(index)}
                          className="size-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                          title={translated('حذف', 'Delete')}
                          aria-label={translated('حذف', 'Delete')}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}

            {/* Add / Edit Screenshot Modal Dialog */}
            <Dialog open={screenshotModalOpen} onOpenChange={setScreenshotModalOpen}>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-6" dir="rtl">
                <DialogHeader>
                  <DialogTitle className="text-lg font-black">
                    {editingScreenshotIndex === null
                      ? translated('إضافة شاشة جديدة لمعرض المنصة', 'Add New Screen to Showcase')
                      : translated('تعديل شاشة المعرض', 'Edit Showcase Screen')}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    {translated(
                      'أدخل تفاصيل الشاشة، اسم التبويب، الصورة، ونقاط المميزات التوضيحية.',
                      'Enter screen details, tab category, image URL or upload, and feature highlights.',
                    )}
                  </DialogDescription>
                </DialogHeader>

                {screenshotDraft && (
                  <div className="space-y-6 pt-4">
                    {/* Tab & Title Row */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-foreground">
                          {translated('اسم التبويب (بالعربية)', 'Tab Category (Arabic)')} *
                        </label>
                        <input
                          className="landing-input"
                          value={screenshotDraft.category}
                          placeholder="مثال: لوحة الطبيب، الروشتة، بوابة المريض..."
                          onChange={(e) =>
                            setScreenshotDraft((d) =>
                              d ? { ...d, category: e.target.value } : null,
                            )
                          }
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-foreground">
                          {translated('اسم التبويب (بالإنجليزية)', 'Tab Category (English)')}
                        </label>
                        <input
                          className="landing-input"
                          dir="ltr"
                          value={screenshotDraft.categoryEn || ''}
                          placeholder="e.g. Doctor workspace, Prescriptions..."
                          onChange={(e) =>
                            setScreenshotDraft((d) =>
                              d ? { ...d, categoryEn: e.target.value } : null,
                            )
                          }
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-foreground">
                          {translated('عنوان العرض (بالعربية)', 'Display Title (Arabic)')} *
                        </label>
                        <input
                          className="landing-input"
                          value={screenshotDraft.title}
                          placeholder="مثال: صورة واضحة ليوم العيادة"
                          onChange={(e) =>
                            setScreenshotDraft((d) =>
                              d ? { ...d, title: e.target.value } : null,
                            )
                          }
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-foreground">
                          {translated('عنوان العرض (بالإنجليزية)', 'Display Title (English)')}
                        </label>
                        <input
                          className="landing-input"
                          dir="ltr"
                          value={screenshotDraft.titleEn || ''}
                          placeholder="e.g. A clear view of your clinic day"
                          onChange={(e) =>
                            setScreenshotDraft((d) =>
                              d ? { ...d, titleEn: e.target.value } : null,
                            )
                          }
                        />
                      </div>

                      <div className="space-y-1.5 sm:col-span-2">
                        <label className="block text-xs font-bold text-foreground">
                          {translated('الوصف (بالعربية)', 'Description (Arabic)')}
                        </label>
                        <textarea
                          rows={2}
                          className="landing-input h-auto py-2"
                          value={screenshotDraft.subtitle}
                          placeholder="مثال: الحجوزات والدور والإجراءات المهمة في مساحة واحدة."
                          onChange={(e) =>
                            setScreenshotDraft((d) =>
                              d ? { ...d, subtitle: e.target.value } : null,
                            )
                          }
                        />
                      </div>

                      <div className="space-y-1.5 sm:col-span-2">
                        <label className="block text-xs font-bold text-foreground">
                          {translated('الوصف (بالإنجليزية)', 'Description (English)')}
                        </label>
                        <textarea
                          rows={2}
                          className="landing-input h-auto py-2"
                          dir="ltr"
                          value={screenshotDraft.subtitleEn || ''}
                          placeholder="e.g. Appointments, queue and important actions in one workspace."
                          onChange={(e) =>
                            setScreenshotDraft((d) =>
                              d ? { ...d, subtitleEn: e.target.value } : null,
                            )
                          }
                        />
                      </div>
                    </div>

                    {/* Image Input & File Upload */}
                    <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold text-foreground">
                          {translated('رابط وصورة الشاشة', 'Screen Image & URL')} *
                        </label>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleImageFileUpload}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isUploadingImage}
                          onClick={() => fileInputRef.current?.click()}
                          className="gap-1.5 text-xs font-bold"
                        >
                          {isUploadingImage ? (
                            <LoaderCircle className="animate-spin size-3.5" />
                          ) : (
                            <Upload className="size-3.5" />
                          )}
                          <span>{translated('رفع صورة من جهازك', 'Upload Image File')}</span>
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <input
                          type="text"
                          dir="ltr"
                          className="landing-input"
                          value={screenshotDraft.imageUrl}
                          placeholder="https://... أو /landing/dashboard.svg"
                          onChange={(e) =>
                            setScreenshotDraft((d) =>
                              d ? { ...d, imageUrl: e.target.value } : null,
                            )
                          }
                        />
                        <p className="text-[11px] text-muted-foreground">
                          {translated(
                            'يمكنك إدخال رابط HTTPS مباشر، أو مسار داخلي مثل /landing/dashboard.svg، أو النقر على «رفع صورة» لاختيار ملف من جهازك.',
                            'Enter a direct HTTPS URL, local path like /landing/dashboard.svg, or click upload to select an image from your device.',
                          )}
                        </p>
                      </div>

                      {/* Alt text fields */}
                      <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t border-border/60">
                        <div className="space-y-1">
                          <label className="block text-[11px] font-bold text-muted-foreground">
                            {translated('النص البديل للصورة (بالعربية)', 'Alt Text (Arabic)')}
                          </label>
                          <input
                            className="landing-input text-xs"
                            value={screenshotDraft.altText || ''}
                            placeholder="وصف مختصر لمحتوى الصورة لدعم محركات البحث والوصول"
                            onChange={(e) =>
                              setScreenshotDraft((d) =>
                                d ? { ...d, altText: e.target.value } : null,
                              )
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[11px] font-bold text-muted-foreground">
                            {translated('النص البديل للصورة (بالإنجليزية)', 'Alt Text (English)')}
                          </label>
                          <input
                            className="landing-input text-xs"
                            dir="ltr"
                            value={screenshotDraft.altTextEn || ''}
                            placeholder="Short image description for SEO and accessibility"
                            onChange={(e) =>
                              setScreenshotDraft((d) =>
                                d ? { ...d, altTextEn: e.target.value } : null,
                              )
                            }
                          />
                        </div>
                      </div>
                    </div>

                    {/* Feature Highlights List */}
                    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-bold text-foreground">
                            {translated(
                              'نقاط المميزات المعروضة بجانب الصورة',
                              'Feature Highlights Bullet Points',
                            )}
                          </h4>
                          <p className="text-[11px] text-muted-foreground">
                            {translated(
                              'تظهر هذه النقاط بجانب صورة الشاشة مع علامات صح خضراء.',
                              'These bullet points appear next to the screenshot card with checkmarks.',
                            )}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setScreenshotDraft((d) =>
                              d
                                ? {
                                    ...d,
                                    highlights: [...(d.highlights || []), ''],
                                    highlightsEn: [...(d.highlightsEn || []), ''],
                                  }
                                : null,
                            )
                          }}
                          className="gap-1 text-xs font-bold"
                        >
                          <Plus className="size-3.5" />
                          <span>{translated('إضافة ميزة', 'Add Highlight')}</span>
                        </Button>
                      </div>

                      <div className="space-y-2">
                        {(screenshotDraft.highlights || []).map((highlight, hIndex) => (
                          <div key={hIndex} className="flex items-center gap-2">
                            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-secondary text-[10px] font-mono font-bold text-muted-foreground">
                              {hIndex + 1}
                            </span>
                            <input
                              className="landing-input flex-1 text-xs py-1.5"
                              value={highlight}
                              placeholder={`الميزة ${hIndex + 1} (بالعربية)`}
                              onChange={(e) => {
                                const next = [...(screenshotDraft.highlights || [])]
                                next[hIndex] = e.target.value
                                setScreenshotDraft((d) =>
                                  d ? { ...d, highlights: next } : null,
                                )
                              }}
                            />
                            <input
                              className="landing-input flex-1 text-xs py-1.5"
                              dir="ltr"
                              value={(screenshotDraft.highlightsEn || [])[hIndex] || ''}
                              placeholder={`Highlight ${hIndex + 1} (English)`}
                              onChange={(e) => {
                                const next = [...(screenshotDraft.highlightsEn || [])]
                                next[hIndex] = e.target.value
                                setScreenshotDraft((d) =>
                                  d ? { ...d, highlightsEn: next } : null,
                                )
                              }}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={hIndex === 0}
                              onClick={() => {
                                const nextH = [...(screenshotDraft.highlights || [])]
                                const nextHEn = [...(screenshotDraft.highlightsEn || [])]
                                ;[nextH[hIndex - 1], nextH[hIndex]] = [
                                  nextH[hIndex],
                                  nextH[hIndex - 1],
                                ]
                                ;[nextHEn[hIndex - 1], nextHEn[hIndex]] = [
                                  nextHEn[hIndex],
                                  nextHEn[hIndex - 1],
                                ]
                                setScreenshotDraft((d) =>
                                  d
                                    ? {
                                        ...d,
                                        highlights: nextH,
                                        highlightsEn: nextHEn,
                                      }
                                    : null,
                                )
                              }}
                              className="size-7 text-muted-foreground hover:text-foreground disabled:opacity-20"
                            >
                              <ArrowUp className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={
                                hIndex === (screenshotDraft.highlights || []).length - 1
                              }
                              onClick={() => {
                                const nextH = [...(screenshotDraft.highlights || [])]
                                const nextHEn = [...(screenshotDraft.highlightsEn || [])]
                                ;[nextH[hIndex + 1], nextH[hIndex]] = [
                                  nextH[hIndex],
                                  nextH[hIndex + 1],
                                ]
                                ;[nextHEn[hIndex + 1], nextHEn[hIndex]] = [
                                  nextHEn[hIndex],
                                  nextHEn[hIndex + 1],
                                ]
                                setScreenshotDraft((d) =>
                                  d
                                    ? {
                                        ...d,
                                        highlights: nextH,
                                        highlightsEn: nextHEn,
                                      }
                                    : null,
                                )
                              }}
                              className="size-7 text-muted-foreground hover:text-foreground disabled:opacity-20"
                            >
                              <ArrowDown className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                const nextH = (screenshotDraft.highlights || []).filter(
                                  (_, i) => i !== hIndex,
                                )
                                const nextHEn = (screenshotDraft.highlightsEn || []).filter(
                                  (_, i) => i !== hIndex,
                                )
                                setScreenshotDraft((d) =>
                                  d
                                    ? {
                                        ...d,
                                        highlights: nextH,
                                        highlightsEn: nextHEn,
                                      }
                                    : null,
                                )
                              }}
                              className="size-7 text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Visibility Switch */}
                    <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
                      <div>
                        <strong className="block text-xs font-bold text-foreground">
                          {translated('حالة الظهور في الصفحة الرئيسية', 'Visibility on Homepage')}
                        </strong>
                        <span className="text-[11px] text-muted-foreground">
                          {translated(
                            'عند إلغاء التفعيل، سيتم إخفاء الشاشة وتبويبها من الزوار تلقائيًا.',
                            'When unchecked, this screen and its tab will be hidden from visitors.',
                          )}
                        </span>
                      </div>
                      <label className="relative inline-flex cursor-pointer items-center">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={screenshotDraft.isVisible !== false}
                          onChange={(e) =>
                            setScreenshotDraft((d) =>
                              d ? { ...d, isVisible: e.target.checked } : null,
                            )
                          }
                        />
                        <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                      </label>
                    </div>

                    {/* Live Preview Panel */}
                    <div className="rounded-2xl border border-border bg-secondary/20 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-foreground flex items-center gap-1.5">
                          <Sparkles className="size-3.5 text-primary" />
                          <span>
                            {translated(
                              'معاينة حية لشكل الشاشة في الموقع',
                              'Live Preview on Homepage',
                            )}
                          </span>
                        </h4>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          Tab: {screenshotDraft.category || '—'}
                        </span>
                      </div>

                      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                        <div className="flex items-center justify-between border-b border-border/50 pb-2">
                          <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                            {screenshotDraft.category ||
                              translated('اسم التبويب', 'Tab Category')}
                          </span>
                          <span className="text-xs font-mono font-bold text-primary">
                            01 / {Math.max(config.screenshots.length, 1)}
                          </span>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-[1.2fr_1fr] items-center">
                          <div className="relative aspect-[1.4] w-full overflow-hidden rounded-xl border border-border bg-secondary/30 flex items-center justify-center">
                            {screenshotDraft.imageUrl ? (
                              <img
                                src={screenshotDraft.imageUrl}
                                alt={
                                  screenshotDraft.altText ||
                                  screenshotDraft.title ||
                                  'Preview'
                                }
                                className="h-full w-full object-contain p-2"
                              />
                            ) : (
                              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                <ImageIcon className="size-8 opacity-40" />
                                <span className="text-[11px]">
                                  {translated('معاينة الصورة هنا', 'Image preview here')}
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="space-y-2">
                            <h3 className="text-base font-black text-foreground">
                              {screenshotDraft.title ||
                                translated('عنوان العرض يظهر هنا', 'Display title appears here')}
                            </h3>
                            <p className="text-xs text-muted-foreground leading-5">
                              {screenshotDraft.subtitle ||
                                translated(
                                  'وصف الشاشة التفصيلي يظهر هنا ليوضح للمستخدمين فائدة هذه الواجهة.',
                                  'Detailed description appears here.',
                                )}
                            </p>
                            {(screenshotDraft.highlights || []).filter(Boolean).length >
                              0 && (
                              <ul className="space-y-1.5 pt-1">
                                {(screenshotDraft.highlights || [])
                                  .filter(Boolean)
                                  .map((h, i) => (
                                    <li
                                      key={i}
                                      className="flex items-center gap-1.5 text-xs text-foreground/90"
                                    >
                                      <CheckCircle2 className="size-3.5 text-primary shrink-0" />
                                      <span>{h}</span>
                                    </li>
                                  ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Modal Actions */}
                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setScreenshotModalOpen(false)}
                      >
                        {translated('إلغاء', 'Cancel')}
                      </Button>
                      <Button
                        type="button"
                        onClick={handleSaveScreenshotDraft}
                        className="font-bold px-5"
                      >
                        {editingScreenshotIndex === null
                          ? translated('إضافة الشاشة', 'Add Screen')
                          : translated('تحديث الشاشة', 'Update Screen')}
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        )}
        {tab === 'clients' && (
          <ListEditor
            title="العملاء المتعاونون"
            fields={[
              { key: 'name', label: translated('اسم العميل', 'Client name') },
              { key: 'nameEn', label: 'الاسم بالإنجليزية (اختياري)' },
              { key: 'logoUrl', label: 'الشعار', type: 'image' },
              { key: 'link', label: 'رابط الموقع (اختياري)' },
              {
                key: 'collaborationNote',
                label: 'وصف اختياري',
                type: 'textarea',
              },
            ]}
            items={config.clients}
            onChange={(items) => set('clients', items)}
            create={() => ({
              id: crypto.randomUUID(),
              name: '',
              specialty: '',
              city: '',
              logoUrl: '',
              link: '',
              collaborationNote: '',
              nameEn: '',
              specialtyEn: '',
            })}
          />
        )}
        {tab === 'contacts' && (
          <section className="space-y-5">
            <FieldEditor label="واتساب احتياطي بالرمز الدولي">
              <input
                dir="ltr"
                className="landing-input"
                value={config.primaryWhatsapp}
                onChange={(e) => set('primaryWhatsapp', e.target.value)}
              />
            </FieldEditor>
            <ListEditor
              title="أرقام التواصل"
              fields={[
                {
                  key: translated('roleTitle'),
                  label: 'وظيفة الرقم / القسم',
                },
                { key: 'number', label: 'رقم الاتصال' },
                {
                  key: 'whatsappNumber',
                  label: 'رقم واتساب بالرمز الدولي',
                },
                {
                  key: 'whatsappEnabled',
                  label: 'يدعم واتساب',
                  type: 'checkbox',
                },
              ]}
              items={config.contacts}
              onChange={(items) => set('contacts', items)}
              create={() => ({
                id: crypto.randomUUID(),
                number: '',
                roleTitle: '',
                roleTitleEn: '',
                whatsappNumber: '',
                isPrimary: false,
                whatsappEnabled: true,
              })}
            />
            <FieldEditor label="الرقم الرئيسي للواتساب">
              <select
                className="landing-input"
                value={config.contacts.find((c) => c.isPrimary)?.id || ''}
                onChange={(e) =>
                  set(
                    'contacts',
                    config.contacts.map((c) => ({
                      ...c,
                      isPrimary: c.id === e.target.value,
                    })),
                  )
                }
              >
                <option value="">استخدام أول رقم واتساب متاح</option>
                {config.contacts
                  .filter((c) => c.whatsappEnabled)
                  .map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.roleTitle} — {c.number}
                    </option>
                  ))}
              </select>
            </FieldEditor>
          </section>
        )}
        {tab === 'feedback' && (
          <section className="space-y-6">
            {/* 1. آراء واستطلاعات الزوار الواردة عبر نموذج "قول لنا رأيك" */}
            <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 space-y-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <MessageSquare className="size-5 text-primary" />
                    <h3 className="font-black text-lg">آراء واستطلاعات الزوار الواردة من الموقع</h3>
                    {feedback.filter((i) => !i.approved).length > 0 && (
                      <span className="rounded-full bg-amber-500 text-white text-xs px-2.5 py-0.5 font-bold shadow-xs animate-pulse">
                        {feedback.filter((i) => !i.approved).length} بانتظار الموافقة
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    الآراء والتقييمات التي أرسلها الأطباء والزوار عبر نموذج «قول لنا رأيك». اضغط «موافقة ونشر» لإظهار الرأي فورًا على الصفحة الرئيسية، أو «إخفاء» أو «حذف».
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void loadInbox()}
                  disabled={busy}
                  className="gap-2 shrink-0 font-bold"
                >
                  <RefreshCw className={`size-4 ${busy ? 'animate-spin' : ''}`} />
                  تحديث الآراء
                </Button>
              </div>

              {inboxError && (
                <div role="alert" className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-bold">
                  {inboxError}
                </div>
              )}

              {!feedback.length && (
                <div className="text-center py-10 border border-dashed border-border rounded-2xl bg-secondary/20">
                  <MessageSquare className="size-8 mx-auto text-muted-foreground mb-2 opacity-50" />
                  <p className="text-sm font-bold text-muted-foreground">
                    لا توجد آراء أو استطلاعات واردة حاليًا.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                    عندما يقوم أي دكتور أو زائر بإرسال رأيه عبر نموذج «قول لنا رأيك» على الواجهة الرئيسية للموقع، سيصل رأيه هنا فورًا لتتمكن من الموافقة عليه ونشره أو حذفه.
                  </p>
                </div>
              )}

              <div className="grid gap-4">
                {feedback.map((item) => (
                  <article
                    key={item.id}
                    className={`space-y-4 rounded-2xl border p-5 transition-all ${
                      item.approved
                        ? 'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/30 dark:bg-emerald-950/20'
                        : 'border-amber-200 dark:border-amber-800/60 bg-amber-50/40 dark:bg-amber-950/20 shadow-sm'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <strong className="text-base font-black text-foreground">
                            {item.authorName}
                          </strong>
                          {item.clinicName && (
                            <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-lg border border-primary/20">
                              عيادة: {item.clinicName}
                            </span>
                          )}
                          {item.specialty && (
                            <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-lg">
                              التخصص: {item.specialty}
                            </span>
                          )}
                        </div>

                        {/* Star Rating Visualization */}
                        <div className="flex items-center gap-1 text-amber-500 pt-0.5" dir="ltr">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`size-4 ${
                                star <= Number(item.rating || 5)
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-slate-300 dark:text-slate-700'
                              }`}
                            />
                          ))}
                          <span className="text-xs font-bold text-muted-foreground ms-1">
                            ({item.rating}/5)
                          </span>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div>
                        {item.approved ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                            <CheckCircle2 className="size-3.5 text-emerald-600" />
                            منشور على الموقع
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800 animate-pulse">
                            بانتظار موافقة الإدارة (مخفي حاليًا)
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-card border border-border/80 text-sm leading-relaxed text-foreground whitespace-pre-wrap font-sans">
                      &quot;{item.comment}&quot;
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/50">
                      <span className="text-[11px] text-muted-foreground">
                        تاريخ الإرسال: {item.createdAt ? new Date(item.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'غير محدد'}
                      </span>

                      <div className="flex items-center gap-2">
                        {item.approved ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void moderate('hide', item)}
                            disabled={busy}
                            className="text-xs font-bold gap-1.5 text-muted-foreground hover:text-foreground"
                          >
                            <EyeOff className="size-3.5" />
                            إلغاء النشر (إخفاء)
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => void moderate('approve', item)}
                            disabled={busy}
                            className="text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                          >
                            <Check className="size-3.5" />
                            موافقة ونشر على الموقع
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => void moderate('delete', item)}
                          disabled={busy}
                          className="text-xs font-bold gap-1.5"
                        >
                          <Trash2 className="size-3.5" />
                          رفض وحذف
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            {/* 2. شهادات وآراء يضيفها المالك يدويًا */}
            <div className="pt-4 border-t border-border">
              <ListEditor
                title="شهادات وآراء يضيفها المالك يدويًا"
                fields={[
                  { key: 'authorName', label: 'الاسم' },
                  { key: 'clinicName', label: 'العيادة' },
                  { key: 'rating', label: 'التقييم (١–٥)', type: 'number' },
                  { key: 'comment', label: 'الرأي', type: 'textarea' },
                  {
                    key: 'approved',
                    label: 'ظاهر على الموقع',
                    type: 'checkbox',
                  },
                ]}
                items={config.feedbacks}
                onChange={(items) => set('feedbacks', items)}
                create={() => ({
                  id: crypto.randomUUID(),
                  authorName: '',
                  clinicName: '',
                  specialty: '',
                  rating: 5,
                  comment: '',
                  approved: false,
                  createdAt: new Date().toISOString(),
                })}
              />
            </div>
          </section>
        )}
        {tab === 'trials' && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black">طلبات التواصل الواردة</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  آخر ٢٠٠ طلب · تفعيل العيادة يتم من قسم العيادات بعد التواصل.
                </p>
              </div>
              <Button variant="outline" onClick={() => void loadInbox()}>
                <RefreshCw />
                تحديث
              </Button>
            </div>
            {inboxError && (
              <p role="alert" className="text-sm text-destructive">
                {inboxError}
              </p>
            )}
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full min-w-[700px] text-start text-xs">
                <thead className="bg-secondary">
                  <tr>
                    {[
                      'الطبيب والعيادة',
                      'التخصص',
                      'التواصل',
                      'التاريخ',
                      'الحالة',
                      'واتساب',
                    ].map((title) => (
                      <th key={title} className="p-4 text-start">
                        {title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {trials.map((item) => (
                    <tr key={item.id} className="border-t border-border">
                      <td className="p-4 font-bold">
                        {item.doctorName}
                        <span className="mt-1 block font-normal text-muted-foreground">
                          {item.clinicName}
                        </span>
                        {item.notes && (
                          <p className="mt-2 max-w-56 font-normal">
                            {item.notes}
                          </p>
                        )}
                      </td>
                      <td className="p-4">{item.specialty}</td>
                      <td className="p-4" dir="ltr">
                        <a href={'tel:+' + whatsappNumber(item.phone)}>
                          {item.phone}
                        </a>
                        <a href={'mailto:' + item.email} className="mt-1 block">
                          {item.email}
                        </a>
                      </td>
                      <td className="p-4">
                        {new Date(item.createdAt).toLocaleDateString('ar-EG')}
                      </td>
                      <td className="p-4">
                        <select
                          aria-label={'حالة طلب ' + item.doctorName}
                          className="landing-input"
                          value={item.status}
                          onChange={async (e) => {
                            setBusy(true)
                            try {
                              await landingApi(
                                '/api/owner/landing/trials',
                                'PATCH',
                                { id: item.id, status: e.target.value },
                              )
                              await loadInbox()
                            } catch (error) {
                              setError(
                                error instanceof Error
                                  ? error.message
                                  : 'تعذر تحديث الطلب.',
                              )
                            } finally {
                              setBusy(false)
                            }
                          }}
                        >
                          <option value="new">جديد</option>
                          <option value="contacted">تم التواصل</option>
                          <option value="activated">تم التفعيل</option>
                        </select>
                      </td>
                      <td className="p-4">
                        <a
                          href={'https://wa.me/' + whatsappNumber(item.phone)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-600 underline"
                        >
                          تواصل
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!trials.length && (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  لا توجد طلبات مسجلة حتى الآن.
                </p>
              )}
            </div>
          </section>
        )}
      </fieldset>
      <aside className="hidden min-w-0 xl:sticky xl:top-4 xl:block xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto">
        <LivePreview config={config} />
      </aside>
      </div>
      {mobilePreviewOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-background/90 p-3 backdrop-blur-sm xl:hidden">
          <div className="mx-auto flex max-w-2xl items-center justify-between pb-3">
            <h3 className="font-black">معاينة الواجهة</h3>
            <Button
              variant="outline"
              aria-label="إغلاق المعاينة"
              onClick={() => setMobilePreviewOpen(false)}
            >
              <X />
              إغلاق
            </Button>
          </div>
          <div className="mx-auto max-w-2xl">
            <LivePreview config={config} initialDevice="mobile" />
          </div>
        </div>
      )}
    </div>
  )
}
