'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'
import { useLanguage } from '@/context/LanguageContext'
import { ClinicLogo } from '@/components/clinic/ClinicLogo'
import { ClinicLocationMap } from '@/components/clinic/ClinicLocationMap'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { getClinicBranches, getWeeklyScheduleDisplayGroups, isClinicOpenNow } from '@/lib/branchService'
import { sanitizeAddress, safeImageUrl, resolveEffectiveLocation } from '@/lib/mapsHelper'
import { getClinicWebsiteUrl, getClinicTrackUrl, getClinicPatientPortalUrl } from '@/lib/clinicUrls'
import { displayDoctorName, normalizeBookingPageConfig } from '@/lib/booking-page-config'
import {
  Clock,
  Star,
  HeartHandshake,
  ShieldCheck,
  MapPin,
  Phone,
  Compass,
  CalendarCheck,
  User,
  Globe,
  Award,
  CheckCircle2,
  Stethoscope,
  Activity,
  FlaskConical,
  ArrowLeft,
  ArrowRight,
  Sparkles,
} from 'lucide-react'

// Dynamic lazy imports to isolate booking wizard and queue tracker from initial landing bundle
const BookingModal = dynamic(
  () => import('@/components/clinic/BookingModal').then((mod) => mod.BookingModal),
  { ssr: false }
)

const PatientLiveTurn = dynamic(
  () => import('@/components/clinic/PatientLiveTurn').then((mod) => mod.PatientLiveTurn),
  { ssr: false }
)

export function PremiumLanding({ clinic, services = [], isPreview = false }: { clinic: any; services: any[]; isPreview?: boolean }) {
  const { isRtl, dir, toggleLanguage } = useLanguage()
  const page = normalizeBookingPageConfig(clinic?.bookingPageConfig)
  const slug = clinic?.slug || ''
  const clinicWebsiteUrl = getClinicWebsiteUrl(slug)
  const patientPortalUrl = getClinicPatientPortalUrl(slug)
  const [bookingOpen, setBookingOpen] = useState(false)
  const [liveTurnOpen, setLiveTurnOpen] = useState(false)
  const [selectedService, setSelectedService] = useState<any>(null)
  const [loadedBranches, setLoadedBranches] = useState<any[]>([])
  const [selectedBranch, setSelectedBranch] = useState<any>(
    clinic?.branches?.[0] || { id: 'main', name: clinic?.clinicName || 'الفرع الرئيسي', address: clinic?.clinicAddress || '' }
  )

  // Preload booking modal bundle in browser cache on button hover / focus for instant opening
  const preloadBookingModal = useCallback(() => {
    import('@/components/clinic/BookingModal')
  }, [])

  const preloadLiveTurn = useCallback(() => {
    import('@/components/clinic/PatientLiveTurn')
  }, [])

  // Fetch real branches from Firestore on mount so user-uploaded branch images & details appear immediately
  useEffect(() => {
    if (!clinic?.id && !clinic?.slug) return
    const clinicId = clinic.id || clinic.slug
    let isMounted = true
    getClinicBranches(clinicId, clinic?.slug)
      .then((list) => {
        const active = list.filter((b: any) => !b.isArchived)
        if (active.length > 0 && isMounted) {
          const mapped = active.map((b: any) => ({
            ...b,
            image: b.image || b.imageUrl || clinic?.branchImage || 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=800&auto=format&fit=crop'
          }))
          setLoadedBranches(mapped)
          setSelectedBranch((prev: any) => {
            if (!prev || prev.id === 'main') return mapped[0]
            const found = mapped.find((b: any) => b.id === prev.id)
            return found || mapped[0]
          })
        }
      })
      .catch((e) => console.warn('Could not load branches in PremiumLanding:', e))
    return () => {
      isMounted = false
    }
  }, [clinic?.id, clinic?.slug, clinic?.branchImage])

  const handleOpenBooking = (service?: any, branch?: any) => {
    if (service) setSelectedService(service)
    if (branch) setSelectedBranch(branch)
    setBookingOpen(true)
  }

  const branches = loadedBranches.length > 0
    ? loadedBranches
    : clinic?.branches?.length
    ? clinic.branches.map((b: any) => ({
        ...b,
        image: b.image || b.imageUrl || clinic?.branchImage || 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=800&auto=format&fit=crop'
      }))
    : [
        {
          id: 'main',
          name: isRtl ? 'الفرع الرئيسي' : 'Main Branch',
          address: sanitizeAddress(clinic?.clinicAddress) || (isRtl ? 'مدينة نصر - القاهرة' : 'Nasr City - Cairo'),
          latitude: clinic?.latitude,
          longitude: clinic?.longitude,
          mapsLink: clinic?.mapsLink,
          image: clinic?.branchImage || 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=800&auto=format&fit=crop',
          available: true
        }
      ]

  // Doctor portrait strictly from doctor/hero photo, never from clinic building photo
  const rawDoctorImage = clinic?.heroImage || clinic?.doctorPhoto || ''
  const heroDoctorImage = rawDoctorImage
    ? safeImageUrl(rawDoctorImage)
    : 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=1000&auto=format&fit=crop'

  const serviceIcons = [Clock, MapPin, Stethoscope, ShieldCheck, FlaskConical, Activity]
  const trustIcons = [Clock, Star, HeartHandshake, ShieldCheck]
  const trustLabels = isRtl ? page.trustAr : page.trustEn
  const formattedDoctorName = displayDoctorName(clinic?.doctorName, clinic?.doctorTitle) || (isRtl ? 'د. أحمد عبد العزيز' : 'Dr. Ahmed Abdel Aziz')
  const currentLocation = resolveEffectiveLocation(selectedBranch, clinic)

  const primaryGradient = page.primaryColor
    ? { background: `linear-gradient(135deg, ${page.primaryColor}, ${page.secondaryColor || '#00a8e8'})` }
    : undefined

  return (
    <div dir={dir} className="min-h-screen flex flex-col bg-background text-foreground font-sans overflow-x-hidden">
      {/* Top Banner when in Live Settings Preview */}
      {isPreview && (
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white py-1.5 px-3 text-center text-xs font-black shadow-sm sticky top-0 z-50 flex items-center justify-center gap-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span>معاينة حية لصفحة حجز المريض — التعديلات تظهر فوراً قبل الحفظ ويمكنك تجربة الحجز بأمان</span>
        </div>
      )}

      {/* Header / Navbar */}
      <header className="sticky top-0 z-40 bg-card/90 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <motion.button
              whileHover={{ scale: 1.04, y: -1 }}
              whileTap={{ scale: 0.97 }}
              onMouseEnter={preloadBookingModal}
              onFocus={preloadBookingModal}
              onClick={() => handleOpenBooking()}
              style={primaryGradient}
              className="bg-gradient-to-r from-[#0066dc] to-[#00a8e8] hover:shadow-lg text-white font-bold px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 transition-all shrink-0 cursor-pointer shadow-sky-500/25 shadow-md"
            >
              <CalendarCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>{isRtl ? page.bookLabelAr : page.bookLabelEn}</span>
            </motion.button>

            {/* Patient Login & Register Button */}
            {page.showPatientPortal && (
              <Link
                href={patientPortalUrl}
                prefetch={true}
                className="bg-white/90 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:text-sky-600 dark:hover:text-sky-400 border border-slate-200 dark:border-slate-700 hover:border-sky-400 font-bold px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm flex items-center gap-1 sm:gap-1.5 shadow-xs transition-all shrink-0 cursor-pointer"
                title={isRtl ? 'تسجيل دخول المريض أو إنشاء حساب جديد' : 'Patient Login or Register'}
              >
                <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                <span className="hidden sm:inline">{isRtl ? page.portalLabelAr : page.portalLabelEn}</span>
                <span className="sm:hidden">{isRtl ? 'دخول' : 'Login'}</span>
              </Link>
            )}

            <div className="flex items-center gap-1 bg-slate-100/90 dark:bg-slate-800/90 p-0.5 sm:p-1 rounded-xl border border-slate-200/70 dark:border-slate-700 shrink-0">
              {/* Unified Theme Toggle */}
              <ThemeToggle className="!h-7 !w-7 sm:!h-8 sm:!w-8 !p-0 border-0 bg-transparent shadow-none" />
              <button
                onClick={toggleLanguage}
                className="px-1.5 sm:px-2 h-7 sm:h-8 rounded-lg bg-sky-500 text-white font-bold text-[11px] sm:text-xs flex items-center gap-1 hover:bg-sky-600 transition-all cursor-pointer"
                title="Switch Language"
                aria-label="Switch Language"
              >
                <span>{isRtl ? 'EN' : 'عربي'}</span>
                <Globe className="w-3 h-3" />
              </button>
            </div>
          </div>

          {page.showHeaderNavigation && (
            <nav className="hidden lg:flex items-center gap-6 text-sm font-bold text-slate-700 dark:text-slate-200">
              <a href="#hero" className="text-sky-600 dark:text-sky-400 py-1 border-b-2 border-sky-500">
                {isRtl ? 'الرئيسية' : 'Home'}
              </a>
              {page.showServices && (
                <a href="#services" className="hover:text-sky-600 dark:hover:text-sky-400 transition-colors py-1">
                  {isRtl ? page.servicesTitleAr : page.servicesTitleEn}
                </a>
              )}
              {page.showLocation && (
                <a href="#location" className="hover:text-sky-600 dark:hover:text-sky-400 transition-colors py-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-sky-500" />
                  <span>{isRtl ? page.locationTitleAr : page.locationTitleEn}</span>
                </a>
              )}
              {page.showBranches && (
                <a href="#branches" className="hover:text-sky-600 dark:hover:text-sky-400 transition-colors py-1">
                  {isRtl ? page.branchesTitleAr : page.branchesTitleEn}
                </a>
              )}
              {page.showContact && (
                <a href="#contact" className="hover:text-sky-600 dark:hover:text-sky-400 transition-colors py-1">
                  {isRtl ? 'تواصل' : 'Contact'}
                </a>
              )}
            </nav>
          )}

          <Link href={clinicWebsiteUrl} className="flex items-center shrink-0" dir="ltr" prefetch={true}>
            {clinic?.logoUrl ? (
              <img
                src={safeImageUrl(clinic.logoUrl)}
                alt={clinic?.clinicName || 'Clinic Logo'}
                className="h-9 sm:h-11 max-w-[150px] object-contain drop-shadow-sm"
              />
            ) : (
              <ClinicLogo size="md" variant="auto" />
            )}
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section
        id="hero"
        className="relative pt-10 pb-24 lg:pt-14 lg:pb-28 overflow-hidden bg-gradient-to-b from-[#e8f3ff] via-[#f5faff] to-white dark:from-[#071426] dark:via-[#0a1b33] dark:to-[#071222]"
      >
        {/* Animated background ambient blobs */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[350px] bg-gradient-to-tr from-sky-400/15 via-cyan-300/10 to-blue-600/10 rounded-full blur-3xl pointer-events-none animate-pulse" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
            {/* Visual Column: Trust Pills + Doctor Image */}
            <div className={`lg:col-span-6 ${page.heroLayout === 'copy_first' ? 'order-2 lg:order-2' : 'order-2 lg:order-1'}`}>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-5">
                {/* 4 Trust Pills with Floating Staggered Animation */}
                {page.showTrust && (
                  <div className="grid grid-cols-2 sm:flex sm:flex-col gap-2.5 sm:gap-3 z-20 justify-center w-full sm:w-auto">
                    {trustIcons.map((Icon, idx) => (
                      <motion.div
                        key={idx}
                        animate={{ y: [0, -5, 0] }}
                        transition={{ duration: 4 + idx * 0.6, repeat: Infinity, ease: 'easeInOut' }}
                        className="bg-white/90 dark:bg-slate-800/85 backdrop-blur-md border border-white dark:border-sky-500/20 shadow-md px-3 sm:px-4 py-2 sm:py-3 rounded-xl sm:rounded-2xl flex items-center justify-between gap-2 sm:gap-3 transition-all cursor-default"
                      >
                        <span className="font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm">{trustLabels[idx]}</span>
                        <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-sky-100 dark:bg-sky-900/60 text-sky-600 dark:text-sky-400 flex items-center justify-center shadow-xs shrink-0">
                          <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </span>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Doctor Visual with Breathing Aura & Float Badge */}
                {page.showDoctorPhoto && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className="relative group shrink-0"
                  >
                    {/* Pulsing ambient glow aura */}
                    <motion.div
                      animate={{ scale: [1, 1.05, 1], opacity: [0.35, 0.55, 0.35] }}
                      transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                      className="absolute -inset-3 bg-gradient-to-tr from-sky-400/40 via-cyan-300/30 to-blue-600/30 rounded-[36px] blur-xl"
                    />
                    <div className="relative w-56 sm:w-64 md:w-72 lg:w-80 rounded-[28px] sm:rounded-[32px] overflow-hidden border-4 border-white dark:border-slate-800 shadow-2xl bg-gradient-to-b from-sky-50 to-white dark:from-slate-800 dark:to-slate-900">
                      <img
                        src={heroDoctorImage}
                        alt={clinic?.doctorName || 'Doctor'}
                        fetchPriority="high"
                        decoding="async"
                        width={320}
                        height={384}
                        className="w-full h-72 sm:h-80 md:h-96 object-cover object-top group-hover:scale-105 transition-transform duration-700"
                      />
                      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-slate-950/85 via-slate-950/40 to-transparent"></div>
                      <div className="absolute bottom-2.5 right-2.5 left-2.5 flex flex-col gap-1 text-white text-xs font-bold px-3 py-2 rounded-xl bg-slate-900/80 backdrop-blur-md">
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 truncate">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="truncate">{formattedDoctorName}</span>
                          </span>
                          {page.showRating && (
                            <span className="text-amber-300 shrink-0 flex items-center gap-1">
                              <Star className="w-3 h-3 fill-amber-300 text-amber-300" />
                              <span>{clinic?.doctorRating || '4.9'}</span>
                            </span>
                          )}
                        </div>
                        {page.showExperience && (clinic?.certificationTitle || clinic?.certificationEntity || clinic?.experienceYears) && (
                          <div className="text-[10px] text-sky-200/90 font-medium flex items-center gap-1 pt-1 border-t border-white/10 truncate">
                            <Award className="w-3 h-3 text-sky-300 shrink-0" />
                            <span className="truncate">
                              {clinic?.experienceYears ? `${clinic.experienceYears} ${isRtl ? 'سنوات خبرة' : 'years exp.'}` : ''}
                              {clinic?.certificationTitle ? ` • ${clinic.certificationTitle}` : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Text / CTAs Column */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className={`lg:col-span-6 ${page.heroLayout === 'copy_first' ? 'order-1 lg:order-1' : 'order-1 lg:order-2'} text-center lg:text-start space-y-4 sm:space-y-6`}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 text-xs font-bold border border-sky-200 dark:border-sky-800 shadow-xs"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
                </span>
                <span>{isRtl ? page.badgeAr : page.badgeEn}</span>
              </motion.div>

              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-foreground leading-tight tracking-tight">
                <span className="block mb-1 sm:mb-2">{isRtl ? page.headlineAr : page.headlineEn}</span>
                <span className="bg-gradient-to-l from-slate-900 via-sky-800 to-sky-600 dark:from-white dark:via-sky-200 dark:to-sky-400 bg-clip-text text-transparent text-xl sm:text-2xl md:text-3xl lg:text-4xl block">
                  {clinic?.clinicName ? (isRtl ? `في ${clinic.clinicName}` : `At ${clinic.clinicName}`) : (isRtl ? `في عيادة ${formattedDoctorName}` : `At ${formattedDoctorName} Clinic`)}
                </span>
              </h1>

              <div className="space-y-1 sm:space-y-1.5">
                <p className="text-sm sm:text-base md:text-lg font-bold text-slate-700 dark:text-slate-200">
                  {clinic?.specialty || (isRtl ? 'استشاري الطب الباطني والجهاز الهضمي • علاج الحالات المتقدمة' : 'Consultant of Internal Medicine & Gastroenterology')}
                </p>
                <p className="text-xs sm:text-sm md:text-base text-muted-foreground leading-relaxed max-w-xl mx-auto lg:mx-0">
                  {clinic?.heroSubtitle || (isRtl ? 'رعاية متكاملة .. خبرة .. اهتمام بكل مريض' : 'Comprehensive Care .. Expertise .. Patient Attention')}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-2.5 sm:gap-3.5">
                <motion.button
                  whileHover={{ scale: 1.03, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  onMouseEnter={preloadBookingModal}
                  onFocus={preloadBookingModal}
                  onClick={() => handleOpenBooking()}
                  style={primaryGradient}
                  className="bg-gradient-to-r from-[#0066dc] to-[#00a8e8] hover:shadow-xl text-white font-extrabold px-5 sm:px-7 md:px-8 py-3 sm:py-3.5 md:py-4 rounded-full text-xs sm:text-sm md:text-base flex items-center gap-2 shadow-lg shadow-sky-600/30 transition-all cursor-pointer"
                >
                  <span>{isRtl ? page.bookLabelAr : page.bookLabelEn}</span>
                  {isRtl ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                </motion.button>

                {page.showQueueButton && (
                  <motion.button
                    whileHover={{ scale: 1.03, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    onMouseEnter={preloadLiveTurn}
                    onFocus={preloadLiveTurn}
                    onClick={() => setLiveTurnOpen(true)}
                    className="bg-white/95 dark:bg-slate-800/90 hover:bg-sky-50 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-extrabold px-4 sm:px-6 md:px-7 py-3 sm:py-3.5 md:py-4 rounded-full text-xs sm:text-sm md:text-base border border-slate-200 dark:border-slate-700 shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>{isRtl ? page.trackLabelAr : page.trackLabelEn}</span>
                  </motion.button>
                )}

                {page.showPatientPortal && (
                  <motion.div whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}>
                    <Link
                      href={patientPortalUrl}
                      prefetch={true}
                      className="bg-white/90 dark:bg-slate-800/90 hover:bg-sky-50 dark:hover:bg-slate-700 text-slate-800 dark:text-white hover:text-sky-600 font-extrabold px-4 sm:px-6 py-3 sm:py-3.5 md:py-4 rounded-full text-xs sm:text-sm md:text-base border border-slate-200 dark:border-slate-700 shadow-sm transition-all flex items-center gap-2"
                    >
                      <User className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                      <span>{isRtl ? page.portalLabelAr : page.portalLabelEn}</span>
                    </Link>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      {page.showServices && (
        <section id="services" className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
          <div className="bg-card text-card-foreground rounded-[28px] sm:rounded-[36px] p-6 sm:p-10 md:p-12 shadow-xl border border-border">
            <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-12">
              <h2 className="text-2xl sm:text-3xl font-black text-foreground">
                {isRtl ? page.servicesTitleAr : page.servicesTitleEn}
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-2">
                {isRtl
                  ? 'اختر الخدمة المطلوبة لحجز موعد مباشر أو الاستفسار عن تفاصيل الكشف'
                  : 'Select the required service for instant booking or check consultation details'}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-5">
              {(services.length > 0 ? services : [
                { id: '1', name: 'كشف عام', price: 250, duration: '15 دقيقة' },
                { id: '2', name: 'استشارة ومتابعة', price: 150, duration: '10 دقائق' },
                { id: '3', name: 'كشف مستعجل', price: 400, duration: 'فوري' },
                { id: '4', name: 'تحاليل طبية', price: 200, duration: '15 دقيقة' },
                { id: '5', name: 'تقييم غذائي', price: 200, duration: '20 دقيقة' }
              ]).map((srv, idx) => {
                const IconComp = serviceIcons[idx % serviceIcons.length]
                return (
                  <motion.div
                    key={srv.id || idx}
                    whileHover={{ y: -6, scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onMouseEnter={preloadBookingModal}
                    onClick={() => handleOpenBooking(srv)}
                    className="cursor-pointer rounded-2xl p-4 bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 hover:border-sky-400 hover:shadow-lg transition-all flex flex-col items-center text-center group"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-sky-100/90 dark:bg-sky-900/50 text-sky-600 dark:text-sky-400 group-hover:bg-sky-600 group-hover:text-white flex items-center justify-center mb-3 transition-all shadow-xs group-hover:shadow-md">
                      <IconComp className="w-6 h-6" />
                    </div>
                    <h3 className="font-extrabold text-slate-800 dark:text-white text-sm sm:text-base mb-1">{srv.name}</h3>
                    <p className="text-[11px] text-muted-foreground font-bold">
                      {clinic?.showPrices !== false && !clinic?.hidePrices && srv.price ? `${srv.price} ${isRtl ? 'ج.م' : 'EGP'}` : ''} {srv.duration ? `• ${srv.duration}` : ''}
                    </p>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* Interactive Clinic Location & Smart Navigation Map Section */}
      {page.showLocation && (
        <section id="location" className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="space-y-6"
          >
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 text-xs font-bold border border-sky-200 dark:border-sky-800 shadow-xs">
                  <MapPin className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                  <span>{isRtl ? 'الموقع الجغرافي ونظام الملاحة الذكي' : 'GPS Location & Smart Navigation'}</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-foreground mt-2">
                  {isRtl ? page.locationTitleAr : page.locationTitleEn}
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-2xl">
                  {isRtl
                    ? 'توجّه مباشرة إلى مقر العيادة عبر الملاحة الذكية واستعرض الفروع المتاحة وتفاصيل العنوان الدقيق المسجل في النظام.'
                    : 'Navigate directly to the clinic or check available branch locations and accurate address details.'}
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs font-bold text-muted-foreground">
                  {branches.length} {branches.length === 1 ? (isRtl ? 'فرع مسجل' : 'Branch Registered') : (isRtl ? 'فروع مسجلة' : 'Branches')}
                </span>
              </div>
            </div>

            {/* Location Map Embed (Strictly Accurate Pin Resolution) */}
            <ClinicLocationMap
              clinic={clinic}
              branches={branches}
              className="shadow-xl"
            />
          </motion.div>
        </section>
      )}

      {/* Branches & Clinic Info Section */}
      {(page.showBranches || page.showContact) && (
        <section id="branches" className="pb-16 sm:pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Main Info Card */}
            {page.showContact && (
              <div className={`${page.showBranches ? 'lg:col-span-4' : 'lg:col-span-12'} bg-card text-card-foreground rounded-[28px] p-6 sm:p-7 shadow-lg border border-border space-y-6`}>
                <div>
                  <h3 className="text-lg font-black text-foreground mb-1">
                    {selectedBranch?.name || clinic?.clinicName || (isRtl ? 'العيادة التخصصية' : 'Clinic')}
                  </h3>
                  <p className="text-xs text-sky-600 dark:text-sky-400 font-bold">
                    {formattedDoctorName}
                  </p>
                </div>

                <div className="space-y-3.5 text-sm">
                  <div className="flex items-start gap-3 text-muted-foreground">
                    <MapPin className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
                    <span className="text-xs leading-relaxed">{selectedBranch?.address || clinic?.clinicAddress || (isRtl ? 'العنوان الرئيسي' : 'Main Address')}</span>
                  </div>

                  {(selectedBranch?.phone || clinic?.clinicPhone) && (
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <Phone className="w-4 h-4 text-emerald-500 shrink-0" />
                      <a
                        href={`tel:${selectedBranch?.phone || clinic?.clinicPhone}`}
                        className="text-xs font-mono font-bold hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
                        dir="ltr"
                      >
                        {selectedBranch?.phone || clinic?.clinicPhone}
                      </a>
                    </div>
                  )}

                  {currentLocation.directionsUrl && (
                    <div className="pt-2">
                      <a
                        href={currentLocation.directionsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full py-3 px-4 rounded-2xl bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 font-bold text-sm border border-sky-200/80 dark:border-sky-800/70 flex items-center justify-center gap-2 transition-all"
                      >
                        <Compass className="w-4 h-4" />
                        <span>{isRtl ? 'الاتجاهات على الخريطة' : 'Get Directions'}</span>
                      </a>
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 pt-5">
                  <h3 className="text-base font-black text-foreground mb-3">
                    {isRtl ? 'مواعيد العمل' : 'Working Hours'}
                  </h3>
                  <div className="space-y-2 text-sm">
                    {getWeeklyScheduleDisplayGroups(selectedBranch?.weeklySchedule || clinic?.weeklySchedule, isRtl).map((grp, idx) => (
                      <div key={idx} className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                        <span className="font-bold text-slate-700 dark:text-slate-300">{grp.daysLabel}</span>
                        <span className={`font-extrabold text-xs ${grp.isOpen ? 'text-foreground' : 'text-rose-500 dark:text-rose-400'}`}>
                          {grp.hoursLabel}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Branches Cards */}
            {page.showBranches && (
              <div className={`${page.showContact ? 'lg:col-span-8' : 'lg:col-span-12'} space-y-4`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xl font-black text-foreground">
                    {isRtl ? page.branchesTitleAr : page.branchesTitleEn}
                  </h3>
                  <span className="text-xs text-slate-400 font-bold">
                    {branches.length} {isRtl ? 'فروع متاحة' : 'branches available'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  {branches.map((b: any, i: number) => {
                    const isOpen = clinic?.isClinicOpen !== false && isClinicOpenNow(b.weeklySchedule || clinic?.weeklySchedule)
                    return (
                      <motion.div
                        key={b.id || i}
                        whileHover={{ y: -8 }}
                        transition={{ duration: 0.2 }}
                        className="bg-card text-card-foreground rounded-[24px] overflow-hidden shadow-md hover:shadow-xl border border-border flex flex-col transition-all"
                      >
                        <div className="relative h-44 overflow-hidden bg-sky-100 dark:bg-slate-800">
                          {b.image && (
                            <img
                              src={b.image}
                              alt={b.name}
                              loading="lazy"
                              decoding="async"
                              className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                            />
                          )}
                          <span className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-[11px] font-bold text-white shadow flex items-center gap-1 ${isOpen ? 'bg-emerald-500' : 'bg-slate-600'}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            <span>{isOpen ? (isRtl ? 'مفتوح الآن' : 'Open Now') : (isRtl ? 'مغلق حاليًا' : 'Closed Now')}</span>
                          </span>
                        </div>
                        <div className="p-5 flex-1 flex flex-col justify-between text-center">
                          <div>
                            <h3 className="text-lg font-black text-foreground">{b.name}</h3>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{b.address || ''}</p>
                          </div>

                          <button
                            type="button"
                            onMouseEnter={preloadBookingModal}
                            onClick={() => handleOpenBooking(undefined, b)}
                            className="mt-4 w-full py-2.5 rounded-xl bg-sky-50 dark:bg-slate-800 text-sky-600 dark:text-sky-400 hover:bg-sky-500 hover:text-white font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <CalendarCheck className="w-3.5 h-3.5" />
                            <span>{isRtl ? 'حجز في هذا الفرع' : 'Book at this branch'}</span>
                          </button>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer id="contact" className="mt-auto bg-slate-900 text-white py-8 px-4 sm:px-6 lg:px-8 border-t border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-5 text-xs text-slate-400 text-center sm:text-right">
            <span>جميع الحقوق محفوظة 2026 YallaCodex</span>
            <span className="hidden sm:inline opacity-40">•</span>
            {page.showPatientPortal && (
              <Link
                href={patientPortalUrl}
                prefetch={true}
                className="text-sky-400 hover:text-sky-300 hover:underline font-bold transition-colors inline-flex items-center gap-1.5"
              >
                <User className="w-3.5 h-3.5" />
                <span>{isRtl ? 'بوابة المريض (تسجيل الدخول / إنشاء حساب)' : 'Patient Portal (Login / Register)'}</span>
              </Link>
            )}
          </div>
          <div dir="ltr" className="shrink-0">
            {clinic?.logoUrl ? (
              <img
                src={safeImageUrl(clinic.logoUrl)}
                alt={clinic?.clinicName || 'Clinic'}
                className="h-10 max-w-[150px] object-contain brightness-0 invert opacity-90"
              />
            ) : (
              <ClinicLogo size="md" variant="dark" />
            )}
          </div>
        </div>
      </footer>

      {/* Booking Modal with pre-loaded branches passed to eliminate lag */}
      {bookingOpen && (
        <BookingModal
          clinic={clinic}
          services={services}
          branches={branches}
          initialService={selectedService}
          initialBranch={selectedBranch}
          onClose={() => setBookingOpen(false)}
          isPreview={isPreview}
        />
      )}

      {/* Live Queue Turn Modal */}
      {liveTurnOpen && (
        <PatientLiveTurn
          clinic={clinic}
          slug={clinic?.slug}
          onClose={() => setLiveTurnOpen(false)}
        />
      )}
    </div>
  )
}
