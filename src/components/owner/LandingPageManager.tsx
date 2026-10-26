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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/context/LanguageContext'
import {
  DEFAULT_LANDING_CONFIG,
  landingConfigSchema,
  whatsappNumber,
  type LandingPageConfig,
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
    showScreenshots: 'معرض الصور',
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
  ['screenshots', 'الصور'],
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
  const shots: Field[] = [
    { key: translated('title'), label: 'العنوان' },
    { key: translated('category'), label: 'اسم التبويب' },
    { key: translated('subtitle'), label: 'الوصف', type: 'textarea' },
    { key: 'imageUrl', label: 'الصورة', type: 'image' },
    {
      key: translated('highlights'),
      label: 'النقاط البارزة (كل نقطة في سطر)',
      type: 'textarea',
    },
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
            <div className="rounded-3xl border border-border bg-card p-5 space-y-4">
              <div>
                <h3 className="text-base font-black text-foreground">
                  {translated('إعدادات الديمو التفاعلي (الصفحة الرئيسية)', 'Interactive Demo Settings')}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {translated(
                    'تخصيص عنوان ووصف قسم العرض التفاعلي بالصفحة الرئيسية:',
                    'Customize the title and subtitle of the interactive demo on the homepage:'
                  )}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-muted-foreground">{translated('عنوان القسم بالعربية', 'Title (Arabic)')}</label>
                  <input
                    className="landing-input"
                    value={config.demoSectionTitle || ''}
                    placeholder="جرّب يلا كلينيك بنفسك"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('demoSectionTitle', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-muted-foreground">{translated('العنوان بالإنجليزية (اختياري)', 'Title (English)')}</label>
                  <input
                    className="landing-input"
                    dir="ltr"
                    value={config.english?.demoSectionTitle || ''}
                    placeholder="Try Yalla Clinic Yourself"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      set('english', {
                        ...config.english,
                        demoSectionTitle: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="block text-xs font-bold text-muted-foreground">{translated('وصف القسم بالعربية', 'Description (Arabic)')}</label>
                  <textarea
                    rows={2}
                    className="landing-input h-auto py-2"
                    value={config.demoSectionSubtitle || ''}
                    placeholder="استكشف واجهات يلا كلينيك الحقيقية: تحكّم في الدور، واكتب الروشتة..."
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => set('demoSectionSubtitle', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="block text-xs font-bold text-muted-foreground">{translated('الوصف بالإنجليزية (اختياري)', 'Description (English)')}</label>
                  <textarea
                    rows={2}
                    className="landing-input h-auto py-2"
                    dir="ltr"
                    value={config.english?.demoSectionSubtitle || ''}
                    placeholder="Explore real Yalla Clinic interfaces: manage live queues, write prescriptions..."
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      set('english', {
                        ...config.english,
                        demoSectionSubtitle: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            </div>

            <ListEditor
              title="صور النظام القديمة (أرشيف)"
              fields={shots}
              items={config.screenshots}
              onChange={(items) => set('screenshots', items)}
              create={() => ({
                id: crypto.randomUUID(),
                title: '',
                subtitle: '',
                category: '',
                imageUrl: '',
                highlights: [],
                titleEn: '',
                subtitleEn: '',
                categoryEn: '',
                highlightsEn: [],
              })}
            />
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
