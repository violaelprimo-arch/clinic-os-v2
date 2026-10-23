'use client'
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState, type FormEvent, type ComponentType } from 'react'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import {
  Users,
  Calendar,
  FileSignature,
  Database,
  TrendingUp,
  Bot,
  Building2,
  Smartphone,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Phone,
  Star,
  Sparkles,
  Pause,
  Play,
  ShieldCheck,
  Gift,
  LoaderCircle,
} from 'lucide-react'
import { ClinicLogo } from '@/components/clinic/ClinicLogo'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { LanguageToggle } from '@/components/common/LanguageToggle'
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
  submitClientFeedback,
  submitFreeTrialRequest,
} from '@/lib/landing-service'
import { whatsappNumber, type LandingPageConfig } from '@/lib/landing-config'
import './landing.css'
const icons: Record<string, ComponentType<{ className?: string }>> = {
  Users,
  Calendar,
  FileSignature,
  Database,
  TrendingUp,
  Bot,
  Building2,
  Smartphone,
  Sparkles,
  ShieldCheck,
}
export function LandingPageContent({
  config,
  isPreview = false,
}: {
  config: LandingPageConfig
  isPreview?: boolean
}) {
  const { isRtl, dir } = useLanguage(),
    reduced = useReducedMotion()
  const copy = (ar: string, en: string) => (isRtl ? ar : en)
  const headline = (key: keyof LandingPageConfig['english']) =>
    isRtl ? String(config[key]) : config.english[key] || String(config[key])
  const [slide, setSlide] = useState(0),
    [paused, setPaused] = useState(false),
    [trialOpen, setTrialOpen] = useState(false)
  const [feedbackBusy, setFeedbackBusy] = useState(false),
    [feedbackMessage, setFeedbackMessage] = useState(''),
    [feedbackError, setFeedbackError] = useState('')
  const [rating, setRating] = useState(5),
    [trialBusy, setTrialBusy] = useState(false),
    [trialMessage, setTrialMessage] = useState(''),
    [trialError, setTrialError] = useState(''),
    [trialWhatsApp, setTrialWhatsApp] = useState('')
  const screenshots = config.screenshots,
    index = screenshots.length ? slide % screenshots.length : 0,
    current = screenshots[index]
  const primary =
    config.contacts.find((c) => c.isPrimary && c.whatsappEnabled) ||
    config.contacts.find((c) => c.whatsappEnabled)
  const number = whatsappNumber(
    primary?.whatsappNumber || config.primaryWhatsapp,
  )
  const whatsapp = number ? `https://wa.me/${number}` : ''
  const move = (offset: number) =>
    setSlide(
      (value) => (value + offset + screenshots.length) % screenshots.length,
    )
  useEffect(() => {
    if (paused || reduced || screenshots.length < 2) return
    const timer = setInterval(() => {
      if (!document.hidden)
        setSlide((value) => (value + 1) % screenshots.length)
    }, 6500)
    return () => clearInterval(timer)
  }, [screenshots.length, paused, reduced])
  const reveal = {
    initial: reduced ? (false as const) : { opacity: 1, y: 12 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.12 },
    transition: { duration: 0.45 },
  }
  const previewLink = (event: React.MouseEvent) => {
    if (isPreview) event.preventDefault()
  }
  async function sendFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isPreview) return
    const form = event.currentTarget,
      values = new FormData(form)
    setFeedbackBusy(true)
    setFeedbackMessage('')
    setFeedbackError('')
    try {
      await submitClientFeedback({
        authorName: String(values.get('authorName')),
        clinicName: String(values.get('clinicName')),
        specialty: String(values.get('specialty') || ''),
        comment: String(values.get('comment')),
        rating,
        website: String(values.get('website') || ''),
      })
      form.reset()
      setRating(5)
      setFeedbackMessage(
        copy(
          'شكرًا لرأيك! وصل للمراجعة، وسيظهر بعد موافقة الإدارة.',
          'Thank you! Your review has been received and will appear after approval.',
        ),
      )
    } catch (error) {
      setFeedbackError(
        error instanceof Error
          ? error.message
          : copy(
              'تعذر إرسال الرأي. حاول مرة أخرى.',
              'Could not submit your review. Please retry.',
            ),
      )
    } finally {
      setFeedbackBusy(false)
    }
  }
  async function sendTrial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isPreview) return
    const form = event.currentTarget,
      values = new FormData(form)
    setTrialBusy(true)
    setTrialMessage('')
    setTrialError('')
    const data = {
      doctorName: String(values.get('doctorName')),
      clinicName: String(values.get('clinicName')),
      specialty: String(values.get('specialty')),
      phone: String(values.get('phone')),
      email: String(values.get('email')),
      notes: String(values.get('notes') || ''),
      website: String(values.get('website') || ''),
    }
    try {
      await submitFreeTrialRequest(data)
      setTrialMessage(
        copy(
          'تم تسجيل طلبك. هنتواصل معاك لتجهيز التجربة.',
          'Your request is saved. Our team will contact you to arrange the trial.',
        ),
      )
      const url = whatsapp
        ? whatsapp +
          '?text=' +
          encodeURIComponent(
            copy(
              `مرحبًا، سجلت طلب تجربة يلا كلينك لمدة ${config.trialDaysCount} أيام.\nالطبيب: ${data.doctorName}\nالعيادة: ${data.clinicName}\nالتخصص: ${data.specialty}\nالهاتف: ${data.phone}`,
              `Hello, I submitted a ${config.trialDaysCount}-day Yalla Clinic trial request.\nDoctor: ${data.doctorName}\nClinic: ${data.clinicName}\nSpecialty: ${data.specialty}\nPhone: ${data.phone}`,
            ),
          )
        : ''
      setTrialWhatsApp(url)
      form.reset()
      if (values.get('openWhatsapp') === 'on' && url)
        window.location.assign(url)
    } catch (error) {
      setTrialError(
        error instanceof Error
          ? error.message
          : copy(
              'تعذر إرسال الطلب. حاول مرة أخرى.',
              'Could not submit your request. Please retry.',
            ),
      )
    } finally {
      setTrialBusy(false)
    }
  }
  return (
    <div
      className="landing-page min-h-screen bg-background text-foreground"
      dir={dir}
    >
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-4 lg:px-8">
          <Link href="/" aria-label="Yalla Clinic" onClick={previewLink}>
            <ClinicLogo size="md" />
          </Link>
          <nav
            aria-label={copy('روابط الصفحة', 'Page navigation')}
            className="hidden items-center gap-6 text-sm font-bold text-muted-foreground lg:flex"
          >
            {config.visibility.showFeatures && (
              <a href="#features">{copy('المميزات', 'Features')}</a>
            )}
            {config.visibility.showScreenshots && (
              <a href="#showcase">{copy('جولة في النظام', 'Product tour')}</a>
            )}
            {config.visibility.showFeedback && (
              <a href="#reviews">{copy('آراء العملاء', 'Reviews')}</a>
            )}
            {config.visibility.showContacts && (
              <a href="#contact">{copy('تواصل معنا', 'Contact')}</a>
            )}
          </nav>
          <div className="flex items-center gap-2">
            <LanguageToggle variant="icon" />
            <ThemeToggle />
            <Link
              href={config.loginUrl}
              onClick={previewLink}
              className="hidden rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold sm:block"
            >
              {headline('loginButtonText')}
            </Link>
            {config.visibility.showTrialBanner && (
              <Button
                className="h-10 rounded-xl px-4 text-xs"
                onClick={() => setTrialOpen(true)}
              >
                {headline('trialButtonText')}
                <ArrowUpRight className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </header>
      <main>
        <section className="landing-hero relative overflow-hidden border-b border-border/60">
          <div className="landing-grid pointer-events-none absolute inset-0 opacity-40" />
          <div className="pointer-events-none absolute -top-40 start-0 size-[500px] rounded-full bg-primary/10 blur-[120px]" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-14 lg:grid-cols-[1.05fr_1fr] lg:px-8 lg:pb-24 lg:pt-24">
            <motion.div {...reveal} className="space-y-7">
              <p className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-xs font-bold text-primary">
                <span className="size-2 rounded-full bg-primary" />
                {headline('heroBadge')}
              </p>
              <h1 className="text-[clamp(2.6rem,5.3vw,4.8rem)] font-black leading-[1.22] tracking-tight">
                {headline('heroTitle')}
                <span className="mt-2 block text-primary">
                  {headline('heroHighlight')}
                </span>
              </h1>
              <p className="max-w-xl text-base leading-8 text-muted-foreground sm:text-lg sm:leading-9">
                {headline('heroSubtitle')}
              </p>
              <div className="flex flex-wrap gap-3">
                {config.visibility.showTrialBanner && (
                  <Button
                    size="lg"
                    className="h-13 rounded-2xl px-6 shadow-lg shadow-primary/20"
                    onClick={() => setTrialOpen(true)}
                  >
                    {headline('trialButtonText')}
                    <ArrowUpRight />
                  </Button>
                )}
                <a
                  href="#showcase"
                  className="flex items-center gap-2 rounded-2xl border border-border bg-card px-5 py-3 font-bold text-sm"
                >
                  <Play className="size-4 text-primary" />
                  {copy('شوف النظام من جوه', 'Take a product tour')}
                </a>
              </div>
              {config.visibility.showTrialBanner && (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Gift className="size-4 text-primary" />
                  {copy(
                    `تجربة مجانية لمدة ${config.trialDaysCount} أيام · نتواصل معاك لتجهيز عيادتك`,
                    `${config.trialDaysCount}-day free trial · Our team helps set up your clinic`,
                  )}
                </p>
              )}
              <div className="flex flex-wrap gap-5 border-t border-border/80 pt-5 text-xs font-bold text-muted-foreground">
                <span className="flex gap-2">
                  <Check className="size-4 text-primary" />
                  {copy(
                    'الدكتور والاستقبال في نفس الصورة',
                    'One view for doctors and reception',
                  )}
                </span>
                <span className="flex gap-2">
                  <Check className="size-4 text-primary" />
                  {copy('تجربة مناسبة للموبايل', 'Designed for mobile')}
                </span>
              </div>
            </motion.div>
            <motion.div {...reveal} className="relative min-w-0 py-6">
              <div className="absolute inset-0 rounded-full bg-gradient-to-bl from-primary/15 to-cyan-400/10 blur-3xl" />
              <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-2 shadow-2xl shadow-primary/10 sm:rotate-[-2deg]">
                <div className="mb-2 flex items-center justify-between px-4 py-3 text-[10px] text-muted-foreground">
                  <span className="font-bold">YALLA CLINIC / WORKSPACE</span>
                  <span className="flex gap-1">
                    <i className="size-2 rounded-full bg-rose-300" />
                    <i className="size-2 rounded-full bg-amber-300" />
                    <i className="size-2 rounded-full bg-emerald-300" />
                  </span>
                </div>
                <img
                  src={screenshots[0]?.imageUrl || '/landing/dashboard.svg'}
                  alt={copy(
                    'عرض توضيحي للوحة يلا كلينك',
                    'Illustrative Yalla Clinic workspace',
                  )}
                  width="1000"
                  height="720"
                  className="aspect-[1.4] w-full rounded-2xl object-contain bg-secondary/30"
                />
              </div>
              <div className="absolute -bottom-1 end-2 rounded-2xl border border-border bg-card p-4 shadow-xl sm:-end-4">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600">
                    <CheckCircle2 className="size-5" />
                  </span>
                  <span>
                    <strong className="block text-sm">
                      {copy(
                        'كل خطوة متصلة باللي بعدها',
                        'Every step, connected',
                      )}
                    </strong>
                    <span className="text-[11px] text-muted-foreground">
                      {copy(
                        'حجز ← كشف ← روشتة ← متابعة',
                        'Booking → Visit → Prescription → Follow-up',
                      )}
                    </span>
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
          {config.visibility.showStats && config.stats.length > 0 && (
            <div className="relative mx-auto grid max-w-7xl grid-cols-2 gap-7 border-t border-border px-5 py-8 sm:grid-cols-4 lg:px-8">
              {config.stats.map((stat, i) => (
                <div key={i}>
                  <strong className="block text-2xl font-black text-primary sm:text-3xl">
                    {!isRtl && stat.valueEn ? stat.valueEn : stat.value}
                  </strong>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {!isRtl && stat.labelEn ? stat.labelEn : stat.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
        {config.visibility.showClients && config.clients.length > 0 && (
          <section
            aria-label={copy('شركاء النجاح', 'Our partners')}
            className="overflow-hidden border-b border-border py-10"
          >
            <p className="mb-7 text-center text-xs font-bold tracking-wide text-muted-foreground">
              {copy(
                'عيادات ومراكز تشاركنا الرحلة',
                'Clinics and centers sharing the journey',
              )}
            </p>
            <div className="landing-marquee" dir="ltr">
              <div className="landing-marquee-track">
                {[0, 1].map((duplicate) => (
                  <div
                    key={duplicate}
                    className="flex shrink-0 items-center gap-10 pe-10"
                    aria-hidden={duplicate === 1}
                  >
                    {config.clients.map((client) => (
                      <div
                        key={client.id}
                        className="flex min-w-44 items-center gap-3"
                        dir={dir}
                      >
                        {client.logoUrl ? (
                          <img
                            src={client.logoUrl}
                            alt=""
                            className="size-12 rounded-xl object-contain"
                            loading="lazy"
                          />
                        ) : (
                          <Building2 className="size-9 text-primary/60" />
                        )}
                        <div>
                          <p className="text-sm font-black">
                            {!isRtl && client.nameEn
                              ? client.nameEn
                              : client.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {!isRtl && client.specialtyEn
                              ? client.specialtyEn
                              : client.specialty}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
        {config.visibility.showFeatures && (
          <section
            id="features"
            className="mx-auto max-w-7xl px-5 py-20 lg:px-8"
          >
            <motion.div
              {...reveal}
              className="mb-10 flex flex-wrap items-end justify-between gap-5"
            >
              <div>
                <p className="landing-eyebrow">
                  {copy(
                    'يومك أبسط، عيادتك أقوى',
                    'A simpler day. A stronger clinic.',
                  )}
                </p>
                <h2 className="landing-title">
                  {copy(
                    'كل أدواتك. في مكان واحد.',
                    'All your tools. One workspace.',
                  )}
                </h2>
              </div>
              <p className="max-w-sm text-sm leading-7 text-muted-foreground">
                {copy(
                  'أدوات مترابطة تساعد فريقك يركز في الخدمة، من غير التنقل بين أنظمة مختلفة.',
                  'Connected tools help your team focus on care, with less switching between systems.',
                )}
              </p>
            </motion.div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {config.features.map((feature, i) => {
                const Icon = icons[feature.iconName] || Sparkles
                return (
                  <motion.article
                    {...reveal}
                    key={feature.id}
                    whileHover={reduced ? undefined : { y: -5 }}
                    className="group rounded-3xl border border-border bg-card p-6 transition-shadow hover:shadow-xl hover:shadow-primary/5"
                  >
                    <div className="mb-8 flex items-center justify-between">
                      <span className="grid size-12 place-items-center rounded-2xl bg-primary/8 text-primary">
                        <Icon className="size-6" />
                      </span>
                      <span className="text-xs font-mono text-muted-foreground/50">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                    </div>
                    <p className="mb-2 text-[10px] font-bold text-primary">
                      {!isRtl && feature.badgeEn
                        ? feature.badgeEn
                        : feature.badge}
                    </p>
                    <h3 className="mb-3 text-base font-black">
                      {!isRtl && feature.titleEn
                        ? feature.titleEn
                        : feature.title}
                    </h3>
                    <p className="text-sm leading-7 text-muted-foreground">
                      {!isRtl && feature.descriptionEn
                        ? feature.descriptionEn
                        : feature.description}
                    </p>
                  </motion.article>
                )
              })}
            </div>
          </section>
        )}
        {config.visibility.showScreenshots && current && (
          <section
            id="showcase"
            className="border-y border-border bg-secondary/25 py-20"
          >
            <div className="mx-auto max-w-7xl px-5 lg:px-8">
              <motion.div {...reveal} className="mb-10 text-center">
                <p className="landing-eyebrow">
                  {copy('جولة في التجربة', 'Meet your next workspace')}
                </p>
                <h2 className="landing-title">
                  {copy(
                    'شوف التفاصيل اللي بتفرق.',
                    'See the details that matter.',
                  )}
                </h2>
              </motion.div>
              <div
                className="mb-7 flex flex-wrap justify-center gap-2"
                role="tablist"
                aria-label={copy('شاشات النظام', 'Product views')}
              >
                {screenshots.map((shot, i) => (
                  <button
                    id={'shot-tab-' + i}
                    key={shot.id}
                    role="tab"
                    aria-selected={index === i}
                    aria-controls="showcase-panel"
                    tabIndex={index === i ? 0 : -1}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                        e.preventDefault()
                        const next =
                          (i +
                            (e.key === 'ArrowRight' ? 1 : -1) +
                            screenshots.length) %
                          screenshots.length
                        setSlide(next)
                        document.getElementById('shot-tab-' + next)?.focus()
                      }
                    }}
                    onClick={() => {
                      setSlide(i)
                      setPaused(true)
                    }}
                    className={`rounded-xl border px-4 py-3 text-xs font-bold ${index === i ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground'}`}
                  >
                    {!isRtl && shot.categoryEn
                      ? shot.categoryEn
                      : shot.category}
                  </button>
                ))}
              </div>
              <div
                id="showcase-panel"
                role="tabpanel"
                aria-labelledby={'shot-tab-' + index}
                className="grid items-center gap-8 rounded-3xl border border-border bg-card p-5 sm:p-8 lg:grid-cols-[1.5fr_1fr]"
              >
                <img
                  key={current.id}
                  src={current.imageUrl}
                  alt={
                    !isRtl && current.titleEn ? current.titleEn : current.title
                  }
                  width="1000"
                  height="720"
                  loading="lazy"
                  className="aspect-[1.4] w-full rounded-2xl border border-border object-contain bg-secondary/20"
                />
                <div className="space-y-5">
                  <span className="text-xs font-mono text-primary">
                    {String(index + 1).padStart(2, '0')} /{' '}
                    {String(screenshots.length).padStart(2, '0')}
                  </span>
                  <h3 className="text-2xl font-black leading-relaxed">
                    {!isRtl && current.titleEn
                      ? current.titleEn
                      : current.title}
                  </h3>
                  <p className="text-sm leading-7 text-muted-foreground">
                    {!isRtl && current.subtitleEn
                      ? current.subtitleEn
                      : current.subtitle}
                  </p>
                  <ul className="space-y-3">
                    {(!isRtl && current.highlightsEn.length
                      ? current.highlightsEn
                      : current.highlights
                    ).map((highlight, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="size-4 shrink-0 text-primary" />
                        {highlight}
                      </li>
                    ))}
                  </ul>
                  <div className="flex gap-2 pt-3">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        move(-1)
                        setPaused(true)
                      }}
                      aria-label={copy('الشاشة السابقة', 'Previous view')}
                    >
                      <ChevronRight />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setPaused((v) => !v)}
                      aria-label={
                        paused
                          ? copy('تشغيل العرض', 'Play slideshow')
                          : copy('إيقاف العرض', 'Pause slideshow')
                      }
                    >
                      {paused ? <Play /> : <Pause />}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        move(1)
                        setPaused(true)
                      }}
                      aria-label={copy('الشاشة التالية', 'Next view')}
                    >
                      <ChevronLeft />
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {copy(
                      'صور توضيحية للتجربة؛ تتاح الأدوات وفق إعدادات العيادة والباقات.',
                      'Illustrative product views. Tools depend on your clinic setup and plan.',
                    )}
                  </p>
                </div>
              </div>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link
                  href={config.demoUrl}
                  onClick={previewLink}
                  className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
                >
                  {headline('demoButtonText')}
                </Link>
                <Link
                  href={config.patientUrl}
                  onClick={previewLink}
                  className="rounded-xl border border-border bg-card px-5 py-3 text-sm font-bold"
                >
                  {headline('patientPortalButtonText')}
                </Link>
              </div>
            </div>
          </section>
        )}
        {config.visibility.showFeedback && (
          <section
            id="reviews"
            className="mx-auto max-w-7xl px-5 py-20 lg:px-8"
          >
            <motion.div {...reveal} className="mb-10">
              <p className="landing-eyebrow">
                {copy('مساحة لصوتكم', 'Your experience matters')}
              </p>
              <h2 className="landing-title">
                {copy(
                  'تجربتك بتخلّينا نطوّر.',
                  'Your feedback helps us improve.',
                )}
              </h2>
            </motion.div>
            <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
              <div className="grid content-start gap-4 sm:grid-cols-2">
                {config.feedbacks.filter((review) => review.approved).length ? (
                  config.feedbacks
                    .filter((review) => review.approved)
                    .map((review) => (
                      <article
                        key={review.id}
                        className="rounded-3xl border border-border bg-card p-6"
                      >
                        <div
                          className="mb-4 flex gap-1"
                          aria-label={`${review.rating}/5`}
                        >
                          {Array.from({ length: 5 }, (_, i) => (
                            <Star
                              key={i}
                              className={`size-4 ${i < review.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`}
                            />
                          ))}
                        </div>
                        <blockquote className="mb-6 text-sm leading-8">
                          “{review.comment}”
                        </blockquote>
                        <p className="text-sm font-black">
                          {review.authorName}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {review.clinicName}
                        </p>
                      </article>
                    ))
                ) : (
                  <div className="col-span-full flex min-h-52 flex-col items-center justify-center rounded-3xl border border-dashed border-border p-8 text-center">
                    <MessageCircle className="mb-4 size-9 text-primary/50" />
                    <p className="font-bold">
                      {copy(
                        'شاركنا تجربتك مع يلا كلينك',
                        'Share your Yalla Clinic experience',
                      )}
                    </p>
                    <p className="mt-2 text-xs leading-6 text-muted-foreground">
                      {copy(
                        'آراء العملاء المنشورة بعد مراجعتها هتظهر هنا.',
                        'Approved customer reviews will appear here.',
                      )}
                    </p>
                  </div>
                )}
              </div>
              {config.visibility.allowClientFeedbackSubmission && (
                <form
                  onSubmit={sendFeedback}
                  className="rounded-3xl border border-border bg-card p-6 sm:p-8"
                >
                  <h3 className="mb-5 text-lg font-black">
                    {copy('قول لنا رأيك', 'Tell us what you think')}
                  </h3>
                  <fieldset className="mb-5">
                    <legend className="mb-2 text-xs font-bold">
                      {copy('تقييمك', 'Your rating')} *
                    </legend>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <button
                          type="button"
                          key={value}
                          aria-label={copy(
                            `${value} من 5 نجوم`,
                            `${value} out of 5 stars`,
                          )}
                          aria-pressed={rating === value}
                          onClick={() => setRating(value)}
                          className="rounded-lg p-1.5 focus-visible:outline-2 focus-visible:outline-primary"
                        >
                          <Star
                            className={`size-7 ${value <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`}
                          />
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="landing-label">
                      {copy('الاسم', 'Name')} *
                      <input
                        name="authorName"
                        required
                        minLength={2}
                        maxLength={250}
                        autoComplete="name"
                        className="landing-input"
                      />
                    </label>
                    <label className="landing-label">
                      {copy('اسم العيادة', 'Clinic name')} *
                      <input
                        name="clinicName"
                        required
                        minLength={2}
                        maxLength={250}
                        className="landing-input"
                      />
                    </label>
                  </div>
                  <label className="landing-label mt-4">
                    {copy('التخصص (اختياري)', 'Specialty (optional)')}
                    <input
                      name="specialty"
                      maxLength={250}
                      className="landing-input"
                    />
                  </label>
                  <label className="landing-label mt-4">
                    {copy('رأيك في التجربة', 'Your experience')} *
                    <textarea
                      name="comment"
                      required
                      minLength={5}
                      maxLength={2000}
                      rows={3}
                      className="landing-input h-auto py-3"
                    />
                  </label>
                  <input
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                    className="hidden"
                  />
                  <p className="mb-4 mt-3 text-[11px] leading-6 text-muted-foreground">
                    {copy(
                      'يظهر اسمك واسم العيادة ورأيك بعد مراجعة الإدارة. لا تضف بيانات مرضى.',
                      'Your name, clinic and review are published after moderation. Do not include patient information.',
                    )}
                  </p>
                  {feedbackError && (
                    <p role="alert" className="mb-3 text-sm text-destructive">
                      {feedbackError}
                    </p>
                  )}
                  {feedbackMessage && (
                    <p role="status" className="mb-3 text-sm text-emerald-600">
                      {feedbackMessage}
                    </p>
                  )}
                  <Button
                    type="submit"
                    disabled={isPreview || feedbackBusy}
                    className="h-11 w-full"
                  >
                    {feedbackBusy && <LoaderCircle className="animate-spin" />}
                    {isPreview
                      ? copy(
                          'النموذج معطل في البروفة',
                          'Form disabled in preview',
                        )
                      : copy('إرسال الرأي للمراجعة', 'Submit for review')}
                  </Button>
                </form>
              )}
            </div>
          </section>
        )}
        {config.visibility.showTrialBanner && (
          <section className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
            <motion.div
              {...reveal}
              className="relative overflow-hidden rounded-[2rem] bg-[#07264a] px-7 py-12 text-white sm:px-12"
            >
              <div className="absolute -end-20 -top-20 size-80 rounded-full bg-cyan-400/20 blur-3xl" />
              <div className="relative flex flex-wrap items-center justify-between gap-8">
                <div className="max-w-2xl">
                  <p className="mb-3 text-xs font-bold text-cyan-200">
                    YALLA CLINIC / {copy('خطوتك الجاية', 'YOUR NEXT STEP')}
                  </p>
                  <h2 className="text-2xl font-black leading-relaxed sm:text-4xl">
                    {copy(
                      'جاهز تشوف الفرق في عيادتك؟',
                      'Ready to see the difference in your clinic?',
                    )}
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-white/65">
                    {copy(
                      `اطلب تجربة مجانية لمدة ${config.trialDaysCount} أيام، وفريقنا يتواصل معاك لترتيب البداية.`,
                      `Request a ${config.trialDaysCount}-day free trial. Our team will help you get started.`,
                    )}
                  </p>
                </div>
                <Button
                  onClick={() => setTrialOpen(true)}
                  className="h-13 rounded-2xl bg-white px-7 font-black text-[#07264a] hover:bg-cyan-50"
                >
                  {headline('trialButtonText')}
                  <ArrowUpRight />
                </Button>
              </div>
            </motion.div>
          </section>
        )}
        {config.visibility.showContacts && (
          <section
            id="contact"
            className="mx-auto max-w-7xl px-5 py-20 lg:px-8"
          >
            <div className="mb-9">
              <p className="landing-eyebrow">{copy('نتكلم؟', 'Let’s talk')}</p>
              <h2 className="landing-title">
                {copy('فريقنا قريب منك.', 'We’re here to help.')}
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {config.contacts.map((contact) => {
                const wa = whatsappNumber(
                  contact.whatsappNumber || contact.number,
                )
                return (
                  <article
                    key={contact.id}
                    className="rounded-3xl border border-border bg-card p-6"
                  >
                    <span className="mb-5 grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
                      <Phone className="size-5" />
                    </span>
                    <h3 className="text-sm font-bold">
                      {!isRtl && contact.roleTitleEn
                        ? contact.roleTitleEn
                        : contact.roleTitle}
                      {contact.isPrimary && (
                        <span className="ms-2 rounded-full bg-primary/10 px-2 py-1 text-[9px] text-primary">
                          {copy('الرقم الرئيسي', 'Primary')}
                        </span>
                      )}
                    </h3>
                    <p
                      className="my-4 text-start text-2xl font-black"
                      dir="ltr"
                    >
                      {contact.number}
                    </p>
                    <div className="flex gap-3 text-xs font-bold">
                      <a
                        onClick={previewLink}
                        href={'tel:+' + whatsappNumber(contact.number)}
                        className="flex items-center gap-2 rounded-xl border border-border px-4 py-3"
                      >
                        <Phone className="size-4" />
                        {copy('اتصال', 'Call')}
                      </a>
                      {contact.whatsappEnabled && wa && (
                        <a
                          onClick={previewLink}
                          href={'https://wa.me/' + wa}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-emerald-700 dark:text-emerald-400"
                        >
                          <MessageCircle className="size-4" />
                          {copy('واتساب', 'WhatsApp')}
                        </a>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        )}
      </main>
      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5 px-5 py-8 text-xs text-muted-foreground lg:px-8">
          <ClinicLogo size="sm" />
          <p>{headline('footerText')}</p>
          <Link
            href="/owner"
            onClick={previewLink}
            className="flex items-center gap-2 hover:text-primary"
          >
            <ShieldCheck className="size-4" />
            {copy('إدارة المنصة', 'Platform administration')}
          </Link>
        </div>
      </footer>
      {config.visibility.showFloatingWhatsapp && whatsapp && (
        <a
          href={whatsapp}
          onClick={previewLink}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={copy('تواصل عبر واتساب', 'Contact us on WhatsApp')}
          className="fixed bottom-5 end-5 z-40 grid size-14 place-items-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/25 transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-600"
        >
          <MessageCircle className="size-7" />
        </a>
      )}
      <Dialog
        open={trialOpen && config.visibility.showTrialBanner}
        onOpenChange={setTrialOpen}
      >
        <DialogContent
          className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"
          dir={dir}
        >
          <DialogHeader>
            <DialogTitle className="text-xl font-black">
              {copy(
                `جرّب يلا كلينك ${config.trialDaysCount} أيام مجانًا`,
                `Try Yalla Clinic free for ${config.trialDaysCount} days`,
              )}
            </DialogTitle>
            <DialogDescription>
              {copy(
                'سجّل بيانات التواصل. يبدأ حساب التجربة بعد تجهيز العيادة وتفعيلها.',
                'Leave your contact details. The trial starts once your clinic is set up and activated.',
              )}
            </DialogDescription>
          </DialogHeader>
          {trialMessage ? (
            <div className="space-y-5 py-5">
              <CheckCircle2 className="size-12 text-emerald-600" />
              <p role="status" className="text-sm leading-7">
                {trialMessage}
              </p>
              {trialWhatsApp && (
                <a
                  href={trialWhatsApp}
                  onClick={previewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white"
                >
                  <MessageCircle className="size-4" />
                  {copy('متابعة الطلب على واتساب', 'Continue on WhatsApp')}
                </a>
              )}
            </div>
          ) : (
            <form onSubmit={sendTrial} className="space-y-4">
              {(
                [
                  ['doctorName', copy('اسم الطبيب', 'Doctor name'), 'text'],
                  ['clinicName', copy('اسم العيادة', 'Clinic name'), 'text'],
                  ['specialty', copy('التخصص', 'Specialty'), 'text'],
                  [
                    'phone',
                    copy('رقم الموبايل / واتساب', 'Mobile / WhatsApp'),
                    'tel',
                  ],
                  ['email', copy('البريد الإلكتروني', 'Email'), 'email'],
                ] as const
              ).map(([name, label, type]) => (
                <label key={name} className="landing-label">
                  {label} *
                  <input
                    name={name}
                    type={type}
                    required
                    minLength={2}
                    maxLength={250}
                    dir={type === 'tel' || type === 'email' ? 'ltr' : undefined}
                    autoComplete={
                      type === 'tel'
                        ? 'tel'
                        : type === 'email'
                          ? 'email'
                          : undefined
                    }
                    className="landing-input"
                  />
                </label>
              ))}
              <label className="landing-label">
                {copy('ملاحظات (اختياري)', 'Notes (optional)')}
                <textarea
                  name="notes"
                  rows={2}
                  maxLength={2000}
                  className="landing-input h-auto py-3"
                />
              </label>
              <input
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="hidden"
              />
              {whatsapp && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input name="openWhatsapp" type="checkbox" />
                  {copy(
                    'فتح واتساب بعد حفظ الطلب',
                    'Open WhatsApp after saving the request',
                  )}
                </label>
              )}
              {trialError && (
                <p role="alert" className="text-sm text-destructive">
                  {trialError}
                </p>
              )}
              <Button
                type="submit"
                disabled={trialBusy || isPreview}
                className="h-12 w-full"
              >
                {trialBusy && <LoaderCircle className="animate-spin" />}
                {isPreview
                  ? copy('النموذج معطل في البروفة', 'Form disabled in preview')
                  : copy('إرسال طلب التجربة', 'Submit trial request')}
              </Button>
              <p className="text-[10px] leading-6 text-muted-foreground">
                {copy(
                  'نستخدم بياناتك للتواصل بخصوص الطلب فقط. لا تضف أي بيانات طبية.',
                  'We use these details to contact you about your request. Do not include medical information.',
                )}
              </p>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
