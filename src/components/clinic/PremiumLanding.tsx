'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useLanguage } from '@/context/LanguageContext'
import { BookingModal } from '@/components/clinic/BookingModal'
import { PatientLiveTurn } from '@/components/clinic/PatientLiveTurn'
import { ClinicLogo } from '@/components/clinic/ClinicLogo'
import { ClinicLocationMap } from '@/components/clinic/ClinicLocationMap'
import { getClinicBranches, getWeeklyScheduleDisplayGroups, isClinicOpenNow } from '@/lib/branchService'
import { sanitizeAddress, safeImageUrl } from '@/lib/mapsHelper'
import { getClinicWebsiteUrl, getClinicTrackUrl, getClinicPatientPortalUrl } from '@/lib/clinicUrls'
import { normalizeBookingPageConfig, displayDoctorName } from '@/lib/booking-page-config'
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
  Sun,
  Moon,
  Globe,
  Award,
  CheckCircle2,
  Stethoscope,
  Activity,
  FlaskConical,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Navigation
} from 'lucide-react'

export function PremiumLanding({ clinic, services = [], isPreview = false }: { clinic: any; services: any[]; isPreview?: boolean }) {
  const { isRtl, dir, toggleLanguage, t } = useLanguage()
  const slug = clinic?.slug || ''
  const clinicWebsiteUrl = getClinicWebsiteUrl(slug)
  const patientPortalUrl = getClinicPatientPortalUrl(slug)

  // Parse booking page presentation config
  const cfg = normalizeBookingPageConfig(clinic?.bookingPageConfig)

  const [bookingOpen, setBookingOpen] = useState(false)
  const [liveTurnOpen, setLiveTurnOpen] = useState(false)
  const [selectedService, setSelectedService] = useState<any>(null)
  const [loadedBranches, setLoadedBranches] = useState<any[]>([])
  const [selectedBranch, setSelectedBranch] = useState<any>(
    clinic?.branches?.[0] || { id: 'main', name: clinic?.clinicName || 'الفرع الرئيسي', address: clinic?.clinicAddress || '' }
  )
  const [dark, setDark] = useState(false)

  // Fetch real branches from Firestore on mount
  useEffect(() => {
    if (!clinic?.id && !clinic?.slug) return
    const clinicId = clinic.id || clinic.slug
    let isMounted = true
    getClinicBranches(clinicId)
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

  const handleToggleDark = () => {
    setDark(!dark)
    document.documentElement.classList.toggle('dark')
  }

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
          address: sanitizeAddress(clinic?.clinicAddress) || '',
          latitude: clinic?.latitude,
          longitude: clinic?.longitude,
          mapsLink: clinic?.mapsLink,
          phone: clinic?.clinicPhone || '',
          image: clinic?.branchImage || 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=800&auto=format&fit=crop',
          isOpen: clinic?.isClinicOpen !== false
        }
      ]

  // Doctor portrait strictly from doctor/hero photo
  const rawDoctorImage = clinic?.heroImage || clinic?.doctorPhoto || ''
  const heroDoctorImage = rawDoctorImage
    ? safeImageUrl(rawDoctorImage)
    : 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=1000&auto=format&fit=crop'

  const formattedDoctorName = displayDoctorName(clinic?.doctorName, clinic?.doctorTitle)

  const serviceIcons = [Clock, MapPin, Stethoscope, ShieldCheck, FlaskConical, Activity]

  const trustLabels = isRtl ? cfg.trustAr : cfg.trustEn
  const trustIcons = [Clock, Star, HeartHandshake, ShieldCheck]

  const primaryCol = cfg.primaryColor || clinic?.primaryColor || '#087CF4'
  const secondaryCol = cfg.secondaryColor || clinic?.secondaryColor || '#0284C7'

  return (
    <div dir={dir} className="min-h-screen flex flex-col bg-[#f4f9ff] dark:bg-[#050d1a] text-slate-900 dark:text-slate-50 font-sans transition-colors overflow-x-hidden">
      {/* Top Banner when in Live Settings Preview */}
      {isPreview && (
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white py-1.5 px-3 text-center text-xs font-black shadow-sm sticky top-0 z-50 flex items-center justify-center gap-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span>معاينة حية لصفحة حجز المريض — التعديلات تظهر فوراً قبل الحفظ ويمكنك تجربة الحجز بأمان</span>
        </div>
      )}

      {/* Header / Navbar */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-[#081526]/90 backdrop-blur-xl border-b border-sky-100 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <motion.button
              whileHover={{ scale: 1.04, y: -1 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleOpenBooking()}
              style={{ background: `linear-gradient(135deg, ${primaryCol}, ${secondaryCol})` }}
              className="hover:shadow-lg text-white font-bold px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 transition-all shrink-0 cursor-pointer shadow-md"
            >
              <CalendarCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>{isRtl ? cfg.bookLabelAr : cfg.bookLabelEn}</span>
            </motion.button>

            {/* Patient Login & Register Button */}
            {cfg.showPatientPortal && (
              <Link
                href={patientPortalUrl}
                className="bg-white/90 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:text-primary dark:hover:text-primary border border-slate-200 dark:border-slate-700 hover:border-primary/50 font-bold px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm flex items-center gap-1 sm:gap-1.5 shadow-xs transition-all shrink-0 cursor-pointer"
                title={isRtl ? 'تسجيل دخول المريض أو إنشاء حساب جديد' : 'Patient Login or Register'}
              >
                <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary shrink-0" />
                <span className="hidden sm:inline">{isRtl ? cfg.portalLabelAr : cfg.portalLabelEn}</span>
                <span className="sm:hidden">{isRtl ? 'دخول' : 'Login'}</span>
              </Link>
            )}

            <div className="flex items-center gap-0.5 sm:gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 sm:p-1 rounded-xl border border-slate-200/70 dark:border-slate-700 shrink-0">
              <button
                onClick={handleToggleDark}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-slate-700 dark:text-amber-300 hover:bg-white dark:hover:bg-slate-700 transition-all cursor-pointer"
                title={dark ? 'Light Mode' : 'Dark Mode'}
              >
                {dark ? <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
              </button>
              <button
                onClick={toggleLanguage}
                className="px-1.5 sm:px-2 h-7 sm:h-8 rounded-lg text-white font-bold text-[11px] sm:text-xs flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                style={{ backgroundColor: primaryCol }}
                title="Switch Language"
              >
                <span>{isRtl ? 'EN' : 'عربي'}</span>
                <Globe className="w-3 h-3" />
              </button>
            </div>
          </div>

          {cfg.showHeaderNavigation && (
            <nav className="hidden lg:flex items-center gap-6 text-sm font-bold text-slate-700 dark:text-slate-200">
              <a href="#hero" className="text-primary py-1 border-b-2 border-primary">
                {isRtl ? 'الرئيسية' : 'Home'}
              </a>
              {cfg.showServices && (
                <a href="#services" className="hover:text-primary transition-colors py-1">
                  {isRtl ? 'الخدمات' : 'Services'}
                </a>
              )}
              {cfg.showLocation && (
                <a href="#location" className="hover:text-primary transition-colors py-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                  <span>{isRtl ? 'موقع العيادة' : 'Location'}</span>
                </a>
              )}
              {cfg.showBranches && (
                <a href="#branches" className="hover:text-primary transition-colors py-1">
                  {isRtl ? 'الفروع' : 'Branches'}
                </a>
              )}
              {cfg.showContact && (
                <a href="#contact" className="hover:text-primary transition-colors py-1">
                  {isRtl ? 'تواصل' : 'Contact'}
                </a>
              )}
            </nav>
          )}

          <Link href={clinicWebsiteUrl} className="flex items-center shrink-0" dir="ltr">
            <ClinicLogo size="md" variant="auto" />
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section
        id="hero"
        className="relative pt-10 pb-24 lg:pt-14 lg:pb-28 overflow-hidden bg-gradient-to-b from-[#e8f3ff] via-[#f5faff] to-white dark:from-[#071426] dark:via-[#0a1b33] dark:to-[#071222]"
      >
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[350px] bg-gradient-to-tr from-sky-400/15 via-cyan-300/10 to-blue-600/10 rounded-full blur-3xl pointer-events-none animate-pulse" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
            
            {/* Visual Column (Doctor Photo & Trust Badges) */}
            <div className={`lg:col-span-6 ${cfg.heroLayout === 'copy_first' ? 'order-2 lg:order-2' : 'order-2 lg:order-1'}`}>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-5">
                
                {/* 4 Trust Pills */}
                {cfg.showTrust && (
                  <div className="grid grid-cols-2 sm:flex sm:flex-col gap-2.5 sm:gap-3 z-20 justify-center w-full sm:w-auto">
                    {trustLabels.map((label, idx) => {
                      const Icon = trustIcons[idx % trustIcons.length]
                      return (
                        <motion.div
                          key={idx}
                          animate={{ y: [0, -5, 0] }}
                          transition={{ duration: 4 + idx * 0.6, repeat: Infinity, ease: 'easeInOut' }}
                          className="bg-white/90 dark:bg-slate-800/85 backdrop-blur-md border border-white dark:border-sky-500/20 shadow-md px-3 sm:px-4 py-2 sm:py-3 rounded-xl sm:rounded-2xl flex items-center justify-between gap-2 sm:gap-3 transition-all cursor-default"
                        >
                          <span className="font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm">{label}</span>
                          <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-sky-100 dark:bg-sky-900/60 text-primary flex items-center justify-center shadow-xs shrink-0">
                            <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </span>
                        </motion.div>
                      )
                    })}
                  </div>
                )}

                {/* Doctor Visual Photo */}
                {cfg.showDoctorPhoto && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className="relative group shrink-0"
                  >
                    <motion.div
                      animate={{ scale: [1, 1.05, 1], opacity: [0.35, 0.55, 0.35] }}
                      transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                      className="absolute -inset-3 bg-gradient-to-tr from-sky-400/40 via-cyan-300/30 to-blue-600/30 rounded-[36px] blur-xl"
                    />
                    <div className="relative w-56 sm:w-64 md:w-72 lg:w-80 rounded-[28px] sm:rounded-[32px] overflow-hidden border-4 border-white dark:border-slate-800 shadow-2xl bg-gradient-to-b from-sky-50 to-white dark:from-slate-800 dark:to-slate-900">
                      <img
                        src={heroDoctorImage}
                        alt={formattedDoctorName || 'Doctor'}
                        className="w-full h-72 sm:h-80 md:h-96 object-cover object-top group-hover:scale-105 transition-transform duration-700"
                      />
                      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-slate-950/85 via-slate-950/40 to-transparent"></div>
                      <div className="absolute bottom-2.5 right-2.5 left-2.5 flex flex-col gap-1 text-white text-xs font-bold px-3 py-2 rounded-xl bg-slate-900/80 backdrop-blur-md">
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 truncate">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="truncate">{formattedDoctorName || (isRtl ? 'د. الطبيب المعالج' : 'Doctor')}</span>
                          </span>
                          {cfg.showRating && clinic?.doctorRating && (
                            <span className="text-amber-300 shrink-0 flex items-center gap-1">
                              <Star className="w-3 h-3 fill-amber-300 text-amber-300" />
                              <span>{clinic.doctorRating}</span>
                            </span>
                          )}
                        </div>
                        {(clinic?.certificationTitle || clinic?.certificationEntity) && (
                          <div className="text-[10px] text-sky-200/90 font-medium flex items-center gap-1 pt-1 border-t border-white/10 truncate">
                            <Award className="w-3 h-3 text-sky-300 shrink-0" />
                            <span className="truncate">{clinic.certificationTitle || ''} {clinic.certificationEntity ? `• ${clinic.certificationEntity}` : ''}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Floating Years Experience Badge */}
                    {cfg.showExperience && clinic?.experienceYears && (
                      <motion.div
                        animate={{ y: [0, -6, 0] }}
                        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                        className="absolute top-3 -left-3 sm:top-4 sm:-left-4 z-30 bg-white/95 dark:bg-slate-800 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl border-2 border-white dark:border-slate-700 shadow-xl flex flex-col items-center justify-center backdrop-blur-xs"
                      >
                        <div className="flex items-center gap-1 text-primary font-extrabold text-base sm:text-xl leading-none">
                          <span>+{clinic.experienceYears}</span>
                          <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </div>
                        <span className="text-[10px] sm:text-[11px] font-bold text-slate-600 dark:text-slate-300 mt-0.5">
                          {isRtl ? 'سنوات خبرة' : 'Years Exp.'}
                        </span>
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </div>
            </div>

            {/* Text & CTA Column */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
              className={`lg:col-span-6 ${cfg.heroLayout === 'copy_first' ? 'order-1 lg:order-1' : 'order-1 lg:order-2'} text-center lg:text-right space-y-4 sm:space-y-5`}
            >
              <motion.div
                whileHover={{ scale: 1.03 }}
                className="inline-flex items-center gap-2 px-3.5 py-1 sm:py-1.5 rounded-full bg-sky-100/90 dark:bg-sky-900/50 border border-sky-200 dark:border-sky-700/60 text-sky-700 dark:text-sky-300 text-xs sm:text-sm font-bold shadow-xs cursor-default"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
                </span>
                <span>{isRtl ? cfg.badgeAr : cfg.badgeEn}</span>
              </motion.div>

              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white leading-tight tracking-tight">
                <span className="block mb-1 sm:mb-2">{isRtl ? cfg.headlineAr : cfg.headlineEn}</span>
                <span className="bg-gradient-to-l from-slate-900 via-sky-800 to-primary dark:from-white dark:via-sky-200 dark:to-primary bg-clip-text text-transparent text-xl sm:text-2xl md:text-3xl lg:text-4xl block">
                  {clinic?.clinicName ? (isRtl ? `في ${clinic.clinicName}` : `At ${clinic.clinicName}`) : ''}
                </span>
              </h1>

              <div className="space-y-1 sm:space-y-1.5">
                <p className="text-sm sm:text-base md:text-lg font-bold text-slate-700 dark:text-slate-200">
                  {clinic?.specialty || ''}
                </p>
                <p className="text-xs sm:text-sm md:text-base text-slate-500 dark:text-slate-400 leading-relaxed max-w-xl mx-auto lg:mx-0">
                  {clinic?.heroSubtitle || ''}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-2.5 sm:gap-3.5">
                <motion.button
                  whileHover={{ scale: 1.03, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleOpenBooking()}
                  style={{ background: `linear-gradient(135deg, ${primaryCol}, ${secondaryCol})` }}
                  className="hover:shadow-xl text-white font-extrabold px-5 sm:px-7 md:px-8 py-3 sm:py-3.5 md:py-4 rounded-full text-xs sm:text-sm md:text-base flex items-center gap-2 shadow-lg transition-all cursor-pointer shadow-primary/25"
                >
                  <span>{isRtl ? cfg.bookLabelAr : cfg.bookLabelEn}</span>
                  {isRtl ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                </motion.button>

                {cfg.showQueueButton && (
                  <motion.button
                    whileHover={{ scale: 1.03, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setLiveTurnOpen(true)}
                    className="bg-white/95 dark:bg-slate-800/90 hover:bg-sky-50 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-extrabold px-4 sm:px-6 md:px-7 py-3 sm:py-3.5 md:py-4 rounded-full text-xs sm:text-sm md:text-base border border-slate-200 dark:border-slate-700 shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>{isRtl ? cfg.trackLabelAr : cfg.trackLabelEn}</span>
                  </motion.button>
                )}

                {cfg.showPatientPortal && (
                  <motion.div whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}>
                    <Link
                      href={patientPortalUrl}
                      className="bg-white/90 dark:bg-slate-800/90 hover:bg-sky-50 dark:hover:bg-slate-700 text-slate-800 dark:text-white hover:text-primary font-extrabold px-4 sm:px-6 py-3 sm:py-3.5 md:py-4 rounded-full text-xs sm:text-sm md:text-base border border-slate-200 dark:border-slate-700 shadow-sm transition-all flex items-center gap-2"
                    >
                      <User className="w-4 h-4 text-primary" />
                      <span>{isRtl ? cfg.portalLabelAr : cfg.portalLabelEn}</span>
                    </Link>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      {cfg.showServices && (
        <section id="services" className="relative z-20 -mt-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
          <div className="bg-white dark:bg-[#081526] rounded-[28px] p-4 sm:p-6 shadow-xl border border-sky-100/80 dark:border-slate-800">
            <h3 className="text-base font-black text-slate-900 dark:text-white mb-4 px-2">
              {isRtl ? cfg.servicesTitleAr : cfg.servicesTitleEn}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
              {(services.length ? services : [
                { id: '1', name: isRtl ? 'كشف عادي' : 'Standard Examination', price: 250, duration: '15 دقيقة' },
                { id: '2', name: isRtl ? 'استشارة' : 'Consultation', price: 100, duration: '15 دقيقة' },
                { id: '3', name: isRtl ? 'كشف مستعجل' : 'Urgent Examination', price: 400, duration: 'فوري' }
              ]).map((srv, idx) => {
                const IconComp = serviceIcons[idx % serviceIcons.length]
                return (
                  <motion.div
                    key={srv.id || idx}
                    whileHover={{ y: -6, scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleOpenBooking(srv)}
                    className="cursor-pointer rounded-2xl p-4 bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 hover:border-primary/50 hover:shadow-lg transition-all flex flex-col items-center text-center group"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-sky-100/90 dark:bg-sky-900/50 text-primary group-hover:bg-primary group-hover:text-white flex items-center justify-center mb-3 transition-all shadow-xs group-hover:shadow-md">
                      <IconComp className="w-6 h-6" />
                    </div>
                    <h4 className="font-extrabold text-slate-800 dark:text-white text-sm group-hover:text-primary transition-colors">
                      {srv.name}
                    </h4>
                    {clinic?.hidePrices !== true && srv.price !== undefined && (
                      <p className="font-black text-xs text-primary mt-1">
                        {srv.price} {isRtl ? 'ج.م' : 'EGP'}
                      </p>
                    )}
                    {srv.duration && (
                      <span className="text-[10px] text-slate-400 font-medium mt-1">
                        {srv.duration}
                      </span>
                    )}
                  </motion.div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* Location Map Section */}
      {cfg.showLocation && (
        <section id="location" className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3">
              <div>
                <span className="text-xs font-black text-primary tracking-wider uppercase block">
                  {isRtl ? 'الموقع والملاحة' : 'Location & Navigation'}
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
                  {isRtl ? cfg.locationTitleAr : cfg.locationTitleEn}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
                  {isRtl
                    ? 'توجّه مباشرة إلى مقر العيادة عبر الملاحة الذكية واستعرض الفروع المتاحة وتفاصيل العنوان الدقيق المسجل في النظام.'
                    : 'Navigate directly to the clinic or check available branch locations and accurate address details.'}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5 text-primary" />
                  <span>{isRtl ? 'تحديث حي للاتجاهات' : 'Live Directions'}</span>
                </span>
              </div>
            </div>

            <ClinicLocationMap
              clinic={clinic}
              branches={branches}
              className="shadow-xl"
            />
          </motion.div>
        </section>
      )}

      {/* Branches & Clinic Info Section */}
      {(cfg.showBranches || cfg.showContact) && (
        <section id="branches" className="pb-16 sm:pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Clinic Info Card */}
            {cfg.showContact && (
              <div id="contact" className={`${cfg.showBranches ? 'lg:col-span-4' : 'lg:col-span-12'} order-2 lg:order-1`}>
                <div className="bg-white dark:bg-[#081526] rounded-[28px] p-6 shadow-lg border border-sky-100 dark:border-slate-800 space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-black text-slate-900 dark:text-white">
                        {isRtl ? 'معلومات التواصل' : 'Clinic Information'}
                      </h2>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                        clinic?.isClinicOpen !== false && isClinicOpenNow(selectedBranch?.weeklySchedule || clinic?.weeklySchedule)
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${clinic?.isClinicOpen !== false && isClinicOpenNow(selectedBranch?.weeklySchedule || clinic?.weeklySchedule) ? 'bg-emerald-500 animate-ping' : 'bg-rose-500'}`} />
                        <span>{clinic?.isClinicOpen !== false && isClinicOpenNow(selectedBranch?.weeklySchedule || clinic?.weeklySchedule) ? (isRtl ? 'مفتوح الآن' : 'Open Now') : (isRtl ? 'مغلق حالياً' : 'Closed Now')}</span>
                      </span>
                    </div>

                    <div className="space-y-3 text-sm">
                      {clinic?.clinicAddress && (
                        <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60">
                          <span className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-900/50 text-primary flex items-center justify-center shrink-0">
                            <MapPin className="w-4 h-4" />
                          </span>
                          <div className="font-bold text-slate-800 dark:text-slate-100">
                            {sanitizeAddress(clinic.clinicAddress)}
                          </div>
                        </div>
                      )}

                      {clinic?.clinicPhone && (
                        <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60">
                          <span className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-900/50 text-primary flex items-center justify-center shrink-0">
                            <Phone className="w-4 h-4" />
                          </span>
                          <a href={`tel:${clinic.clinicPhone}`} className="font-extrabold text-slate-800 dark:text-slate-100" dir="ltr">
                            {clinic.clinicPhone}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Working Hours */}
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-5">
                    <h3 className="text-base font-black text-slate-900 dark:text-white mb-3">
                      {isRtl ? 'مواعيد العمل' : 'Working Hours'}
                    </h3>
                    <div className="space-y-2 text-sm">
                      {getWeeklyScheduleDisplayGroups(selectedBranch?.weeklySchedule || clinic?.weeklySchedule, isRtl).map((grp, idx) => (
                        <div key={idx} className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                          <span className="font-bold text-slate-700 dark:text-slate-300">{grp.daysLabel}</span>
                          <span className={`font-extrabold text-xs ${grp.isOpen ? 'text-slate-900 dark:text-white' : 'text-rose-500 dark:text-rose-400'}`}>
                            {grp.hoursLabel}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Branches Cards */}
            {cfg.showBranches && (
              <div className={`${cfg.showContact ? 'lg:col-span-8' : 'lg:col-span-12'} order-1 lg:order-2`}>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mb-6">
                  {isRtl ? cfg.branchesTitleAr : cfg.branchesTitleEn}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                  {branches.map((b: any, i: number) => {
                    const isBranchOpen = b.isOpen !== false
                    return (
                      <motion.div
                        key={b.id || i}
                        whileHover={{ y: -6 }}
                        transition={{ duration: 0.2 }}
                        className="bg-white dark:bg-[#081526] rounded-[24px] overflow-hidden shadow-md hover:shadow-xl border border-sky-100/90 dark:border-slate-800 flex flex-col transition-all"
                      >
                        <div className="relative h-44 overflow-hidden bg-sky-100 dark:bg-slate-800">
                          {b.image && (
                            <img
                              src={b.image}
                              alt={b.name}
                              loading="lazy"
                              className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                            />
                          )}
                          <span className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-[11px] font-bold shadow flex items-center gap-1 ${
                            isBranchOpen ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full bg-white ${isBranchOpen ? 'animate-pulse' : ''}`} />
                            <span>{isBranchOpen ? (isRtl ? 'متاح للحجز' : 'Open') : (isRtl ? 'مغلق مؤقتاً' : 'Closed')}</span>
                          </span>
                        </div>
                        <div className="p-5 flex-1 flex flex-col justify-between text-center space-y-3">
                          <div>
                            <h3 className="text-base font-black text-slate-900 dark:text-white">{b.name}</h3>
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">{b.address}</p>
                          </div>
                          <motion.button
                            whileTap={{ scale: 0.96 }}
                            disabled={!isBranchOpen}
                            onClick={() => handleOpenBooking(undefined, b)}
                            className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs transition-all shadow-xs ${
                              isBranchOpen
                                ? 'bg-sky-50 hover:bg-primary text-primary hover:text-white dark:bg-slate-800 dark:text-sky-300 dark:hover:bg-primary dark:hover:text-white cursor-pointer border border-sky-200/80 dark:border-slate-700'
                                : 'bg-muted text-muted-foreground cursor-not-allowed border border-border opacity-70'
                            }`}
                          >
                            {isBranchOpen ? (isRtl ? 'حجز في هذا الفرع' : 'Book This Branch') : (isRtl ? 'الفرع مغلق حالياً' : 'Branch Closed')}
                          </motion.button>
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
      <footer className="bg-[#081526] text-white py-8 px-4 sm:px-6 lg:px-8 border-t border-slate-800 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-5 text-xs text-slate-400 text-center sm:text-right">
            <span>جميع الحقوق محفوظة 2026 Yalla Clinic</span>
            <span className="hidden sm:inline opacity-40">•</span>
            <Link
              href={patientPortalUrl}
              className="text-sky-400 hover:text-sky-300 hover:underline font-bold transition-colors inline-flex items-center gap-1.5"
            >
              <User className="w-3.5 h-3.5" />
              <span>{isRtl ? 'بوابة المريض (تسجيل الدخول / إنشاء حساب)' : 'Patient Portal (Login / Register)'}</span>
            </Link>
          </div>
          <div dir="ltr" className="shrink-0">
            <ClinicLogo size="md" variant="dark" />
          </div>
        </div>
      </footer>

      {/* Booking Modal */}
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
