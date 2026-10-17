'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/context/LanguageContext'
import { BookingModal } from '@/components/clinic/BookingModal'
import { PatientLiveTurn } from '@/components/clinic/PatientLiveTurn'
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
  ArrowRight
} from 'lucide-react'

export function PremiumLanding({ clinic, services = [] }: { clinic: any; services: any[] }) {
  const { isRtl, dir, toggleLanguage, t } = useLanguage()
  const [bookingOpen, setBookingOpen] = useState(false)
  const [liveTurnOpen, setLiveTurnOpen] = useState(false)
  const [selectedService, setSelectedService] = useState<any>(null)
  const [selectedBranch, setSelectedBranch] = useState<any>(
    clinic?.branches?.[0] || { id: 'main', name: clinic?.clinicName || 'الفرع الرئيسي', address: clinic?.clinicAddress || '' }
  )
  const [dark, setDark] = useState(false)

  const handleToggleDark = () => {
    setDark(!dark)
    document.documentElement.classList.toggle('dark')
  }

  const handleOpenBooking = (service?: any, branch?: any) => {
    if (service) setSelectedService(service)
    if (branch) setSelectedBranch(branch)
    setBookingOpen(true)
  }

  const branches = clinic?.branches?.length
    ? clinic.branches
    : [
        {
          id: 'main',
          name: isRtl ? 'الفرع الرئيسي' : 'Main Branch',
          address: clinic?.clinicAddress || (isRtl ? 'مدينة نصر - القاهرة' : 'Nasr City - Cairo'),
          image: clinic?.branchImage || 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=800&auto=format&fit=crop',
          available: true
        }
      ]

  const serviceIcons = [Clock, MapPin, Stethoscope, ShieldCheck, FlaskConical, Activity]

  return (
    <div dir={dir} className="min-h-screen flex flex-col bg-[#f4f9ff] dark:bg-[#050d1a] text-slate-900 dark:text-slate-50 font-sans transition-colors">
      {/* Header / Navbar */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-[#081526]/90 backdrop-blur-xl border-b border-sky-100 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => handleOpenBooking()}
              className="bg-gradient-to-r from-[#0066dc] to-[#00a8e8] hover:shadow-lg hover:-translate-y-0.5 text-white font-bold px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm flex items-center gap-2 transition-all shrink-0 cursor-pointer"
            >
              <CalendarCheck className="w-4 h-4" />
              <span>{isRtl ? 'حجز موعد الآن' : 'Book Now'}</span>
            </button>

            {/* Patient Login & Register Button */}
            <Link
              href={`/clinic/${clinic?.slug || 'zizo'}/patient/login`}
              className="bg-white/90 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:text-sky-600 dark:hover:text-sky-400 border border-slate-200 dark:border-slate-700 hover:border-sky-400 font-bold px-3.5 py-2.5 rounded-xl text-xs sm:text-sm flex items-center gap-1.5 shadow-xs transition-all shrink-0 cursor-pointer"
              title={isRtl ? 'تسجيل دخول المريض أو إنشاء حساب جديد' : 'Patient Login or Register'}
            >
              <User className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
              <span>{isRtl ? 'دخول / حساب جديد' : 'Login / Register'}</span>
            </Link>

            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/70 dark:border-slate-700 shrink-0">
              <button
                onClick={handleToggleDark}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-700 dark:text-amber-300 hover:bg-white dark:hover:bg-slate-700 transition-all cursor-pointer"
              >
                {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button
                onClick={toggleLanguage}
                className="px-2 h-8 rounded-lg bg-sky-500 text-white font-bold text-xs flex items-center gap-1 hover:bg-sky-600 transition-all cursor-pointer"
              >
                <span>{isRtl ? 'EN' : 'عربي'}</span>
                <Globe className="w-3 h-3" />
              </button>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-7 text-sm font-bold text-slate-700 dark:text-slate-200">
            <a href="#hero" className="text-sky-600 dark:text-sky-400 py-1 border-b-2 border-sky-500">
              {isRtl ? 'الرئيسية' : 'Home'}
            </a>
            <a href="#services" className="hover:text-sky-600 dark:hover:text-sky-400 transition-colors py-1">
              {isRtl ? 'الخدمات' : 'Services'}
            </a>
            <a href="#branches" className="hover:text-sky-600 dark:hover:text-sky-400 transition-colors py-1">
              {isRtl ? 'العيادة' : 'Clinic'}
            </a>
            <a href="#contact" className="hover:text-sky-600 dark:hover:text-sky-400 transition-colors py-1">
              {isRtl ? 'تواصل' : 'Contact'}
            </a>
          </nav>

          <Link href={`/clinic/${clinic?.slug || 'zizo'}`} className="flex items-center gap-1 text-2xl sm:text-3xl font-extrabold tracking-tight" dir="ltr">
            <span className="bg-gradient-to-r from-sky-600 to-cyan-500 bg-clip-text text-transparent">yalla</span>
            <span className="text-slate-400 dark:text-slate-300 font-semibold">clinic</span>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section
        id="hero"
        className="relative pt-10 pb-24 lg:pt-14 lg:pb-28 overflow-hidden bg-gradient-to-b from-[#e8f3ff] via-[#f5faff] to-white dark:from-[#071426] dark:via-[#0a1b33] dark:to-[#071222]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Visual Column: Trust Pills + Doctor Image */}
            <div className="lg:col-span-6 order-2 lg:order-1">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-5">
                <div className="flex flex-row flex-wrap sm:flex-col gap-3 z-20 justify-center">
                  {[
                    { label: isRtl ? 'دقة في المواعيد' : 'Punctual Appointments', Icon: Clock },
                    { label: isRtl ? 'تقييمات حقيقية' : 'Verified Reviews', Icon: Star },
                    { label: isRtl ? 'خدمة متميزة' : 'Premium Care', Icon: HeartHandshake },
                    { label: isRtl ? 'خصوصية وأمان' : 'Privacy & Security', Icon: ShieldCheck }
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-white/90 dark:bg-slate-800/85 backdrop-blur-md border border-white dark:border-sky-500/20 shadow-md px-4 py-3 rounded-2xl flex items-center justify-between gap-3 min-w-[170px] hover:-translate-x-1 transition-transform"
                    >
                      <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">{item.label}</span>
                      <span className="w-8 h-8 rounded-xl bg-sky-100 dark:bg-sky-900/60 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                        <item.Icon className="w-4 h-4" />
                      </span>
                    </div>
                  ))}
                </div>

                <div className="relative group">
                  <div className="absolute -inset-3 bg-gradient-to-tr from-sky-400/30 via-cyan-300/20 to-blue-600/25 rounded-[36px] blur-xl"></div>
                  <div className="relative w-64 sm:w-72 md:w-80 rounded-[32px] overflow-hidden border-4 border-white dark:border-slate-800 shadow-2xl bg-gradient-to-b from-sky-50 to-white dark:from-slate-800 dark:to-slate-900">
                    <img
                      src={clinic?.heroImage || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=1000&auto=format&fit=crop'}
                      alt={clinic?.doctorName || 'Doctor'}
                      className="w-full h-80 sm:h-96 object-cover object-top group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-slate-950/85 via-slate-950/40 to-transparent"></div>
                    <div className="absolute bottom-3 right-3 left-3 flex flex-col gap-1 text-white text-xs font-bold px-3 py-2 rounded-xl bg-slate-900/80 backdrop-blur-md">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 truncate">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="truncate">{clinic?.doctorTitle ? clinic.doctorTitle + ' ' : ''}{clinic?.doctorName || (isRtl ? 'د. أحمد عبد العزيز' : 'Dr. Ahmed Abdel Aziz')}</span>
                        </span>
                        <span className="text-amber-300 shrink-0">★ {clinic?.doctorRating || '4.9'}</span>
                      </div>
                      {(clinic?.certificationTitle || clinic?.certificationEntity) && (
                        <div className="text-[10px] text-sky-200/90 font-medium flex items-center gap-1 pt-1 border-t border-white/10 truncate">
                          <Award className="w-3 h-3 text-sky-300 shrink-0" />
                          <span className="truncate">{clinic.certificationTitle || ''} {clinic.certificationEntity ? `• ${clinic.certificationEntity}` : ''}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="absolute -bottom-3 -left-4 z-30 bg-white/95 dark:bg-slate-800 px-4 py-2.5 rounded-2xl border-2 border-white dark:border-slate-700 shadow-xl flex flex-col items-center justify-center">
                    <div className="flex items-center gap-1 text-sky-600 dark:text-sky-400 font-extrabold text-xl leading-none">
                      <span>+{clinic?.experienceYears ?? 10}</span>
                      <Award className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mt-0.5">
                      {isRtl ? 'سنوات خبرة' : 'Years Exp.'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Text & CTA Column */}
            <div className="lg:col-span-6 order-1 lg:order-2 text-center lg:text-right space-y-5">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-sky-100/90 dark:bg-sky-900/50 border border-sky-200 dark:border-sky-700/60 text-sky-700 dark:text-sky-300 text-xs sm:text-sm font-bold">
                <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping"></span>
                <span>{clinic?.heroBadge || (isRtl ? 'رعاية صحية أفضل.. بخطوة أسهل' : 'Better Healthcare.. In One Easy Step')}</span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white leading-tight">
                <span className="block mb-2">{isRtl ? 'احجز موعدك الآن' : 'Book Your Appointment'}</span>
                <span className="bg-gradient-to-l from-slate-900 via-sky-800 to-sky-600 dark:from-white dark:via-sky-200 dark:to-sky-400 bg-clip-text text-transparent">
                  {clinic?.clinicName ? (isRtl ? `في ${clinic.clinicName}` : `At ${clinic.clinicName}`) : (isRtl ? 'في عيادة د. أحمد عبد العزيز' : 'At Dr. Ahmed Abdel Aziz Clinic')}
                </span>
              </h1>

              <div className="space-y-1.5">
                <p className="text-base sm:text-lg font-bold text-slate-700 dark:text-slate-200">
                  {clinic?.specialty || (isRtl ? 'استشاري الطب الباطني والجهاز الهضمي • علاج الحالات المتقدمة' : 'Consultant of Internal Medicine & Gastroenterology')}
                </p>
                <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 leading-relaxed">
                  {clinic?.heroSubtitle || (isRtl ? 'رعاية متكاملة .. خبرة .. اهتمام بكل مريض' : 'Comprehensive Care .. Expertise .. Patient Attention')}
                </p>
              </div>

              <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-3 sm:gap-3.5">
                <button
                  onClick={() => handleOpenBooking()}
                  style={clinic?.primaryColor ? { background: `linear-gradient(135deg, ${clinic.primaryColor}, #00a8e8)` } : undefined}
                  className="bg-gradient-to-r from-[#0066dc] to-[#00a8e8] hover:shadow-xl hover:-translate-y-0.5 text-white font-extrabold px-7 sm:px-8 py-3.5 sm:py-4 rounded-full text-sm sm:text-base flex items-center gap-2.5 shadow-lg transition-all cursor-pointer"
                >
                  <span>{isRtl ? 'حجز موعد الآن' : 'Book Appointment'}</span>
                  {isRtl ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                </button>

                <button
                  onClick={() => setLiveTurnOpen(true)}
                  className="bg-white/95 dark:bg-slate-800/90 hover:bg-sky-50 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-extrabold px-6 sm:px-7 py-3.5 sm:py-4 rounded-full text-sm sm:text-base border border-slate-200 dark:border-slate-700 shadow-sm transition-all flex items-center gap-2.5 cursor-pointer"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  <span>{isRtl ? 'تابع دورك' : 'Track Queue'}</span>
                </button>

                <Link
                  href={`/clinic/${clinic?.slug || 'zizo'}/patient/login`}
                  className="bg-white/90 dark:bg-slate-800/90 hover:bg-sky-50 dark:hover:bg-slate-700 text-slate-800 dark:text-white hover:text-sky-600 font-extrabold px-6 py-3.5 sm:py-4 rounded-full text-sm sm:text-base border border-slate-200 dark:border-slate-700 shadow-sm transition-all flex items-center gap-2"
                >
                  <User className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  <span>{isRtl ? 'بوابة المريض / تسجيل الدخول' : 'Patient Portal / Login'}</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Strip */}
      <section id="services" className="relative z-20 -mt-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="bg-white dark:bg-[#081526] rounded-[28px] p-4 sm:p-6 shadow-xl border border-sky-100/80 dark:border-slate-800">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
            {(services.length ? services : [
              { id: '1', name: 'كشف عادي', price: 300, duration: '15 دقيقة' },
              { id: '2', name: 'متابعة دورية', price: 150, duration: '15 دقيقة' },
              { id: '3', name: 'استشارات متخصصة', price: 250, duration: '20 دقيقة' },
              { id: '4', name: 'تحاليل طبية', price: 200, duration: '15 دقيقة' },
              { id: '5', name: 'تقييم غذائي', price: 200, duration: '20 دقيقة' }
            ]).map((srv, idx) => {
              const IconComp = serviceIcons[idx % serviceIcons.length]
              return (
                <div
                  key={srv.id || idx}
                  onClick={() => handleOpenBooking(srv)}
                  className="cursor-pointer rounded-2xl p-4 bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 hover:border-sky-400 hover:-translate-y-1.5 hover:shadow-lg transition-all flex flex-col items-center text-center group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-sky-100/90 dark:bg-sky-900/50 text-sky-600 dark:text-sky-400 group-hover:bg-sky-600 group-hover:text-white flex items-center justify-center mb-3 transition-all">
                    <IconComp className="w-6 h-6" />
                  </div>
                  <h3 className="font-extrabold text-slate-800 dark:text-white text-sm sm:text-base mb-1">{srv.name}</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {clinic?.showPrices !== false && !clinic?.hidePrices && srv.price ? `${srv.price} ${isRtl ? 'ج.م' : 'EGP'}` : ''} {srv.duration ? `• ${srv.duration}` : ''}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Branches & Clinic Info */}
      <section id="branches" className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Clinic Info Card */}
          <div id="contact" className="lg:col-span-4 order-2 lg:order-1">
            <div className="bg-white dark:bg-[#081526] rounded-[28px] p-6 shadow-lg border border-sky-100 dark:border-slate-800 space-y-6">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    {isRtl ? 'معلومات العيادة' : 'Clinic Information'}
                  </h2>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                    clinic?.isClinicOpen !== false
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${clinic?.isClinicOpen !== false ? 'bg-emerald-500 animate-ping' : 'bg-rose-500'}`}></span>
                    <span>{clinic?.isClinicOpen !== false ? (isRtl ? 'مفتوح الآن' : 'Open Now') : (isRtl ? 'مغلق حالياً' : 'Closed Now')}</span>
                  </span>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60">
                    <span className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                      <MapPin className="w-4 h-4" />
                    </span>
                    <div className="font-bold text-slate-800 dark:text-slate-100">
                      {clinic?.clinicAddress || (isRtl ? 'مدينة نصر - القاهرة' : 'Nasr City - Cairo')}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60">
                    <span className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                      <Phone className="w-4 h-4" />
                    </span>
                    <a href={`tel:${clinic?.clinicPhone || '01551007018'}`} className="font-extrabold text-slate-800 dark:text-slate-100" dir="ltr">
                      {clinic?.clinicPhone || '01551007018'}
                    </a>
                  </div>

                  {clinic?.locationUrl && (
                    <a
                      href={clinic.locationUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-3 px-4 rounded-2xl bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 font-bold text-sm border border-sky-200/80 dark:border-sky-800/70 flex items-center justify-center gap-2 transition-all"
                    >
                      <Compass className="w-4 h-4" />
                      <span>{isRtl ? 'الاتجاهات على الخريطة' : 'Get Directions'}</span>
                    </a>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-5">
                <h3 className="text-base font-black text-slate-900 dark:text-white mb-3">
                  {isRtl ? 'مواعيد العمل' : 'Working Hours'}
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                    <span className="font-bold text-slate-700 dark:text-slate-300">{isRtl ? 'السبت - الخميس' : 'Sat - Thu'}</span>
                    <span className="font-extrabold text-slate-900 dark:text-white text-xs">9:00 ص - 10:00 م</span>
                  </div>
                  <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                    <span className="font-bold text-slate-700 dark:text-slate-300">{isRtl ? 'الجمعة' : 'Friday'}</span>
                    <span className="font-extrabold text-slate-900 dark:text-white text-xs">4:00 م - 9:00 م</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Branches Cards */}
          <div className="lg:col-span-8 order-1 lg:order-2">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mb-6">
              {isRtl ? 'فروع العيادة' : 'Clinic Branches'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {branches.map((b: any, i: number) => (
                <div
                  key={b.id || i}
                  className="bg-white dark:bg-[#081526] rounded-[24px] overflow-hidden shadow-md border border-sky-100/90 dark:border-slate-800 flex flex-col hover:-translate-y-1.5 transition-all"
                >
                  <div className="relative h-44 overflow-hidden bg-sky-100 dark:bg-slate-800">
                    {b.image && <img src={b.image} alt={b.name} className="w-full h-full object-cover" />}
                    <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500 text-white shadow">
                      {isRtl ? 'متاح اليوم' : 'Available Today'}
                    </span>
                  </div>
                  <div className="p-5 flex-1 flex flex-col justify-between text-center">
                    <div>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white">{b.name}</h3>
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">{b.address}</p>
                    </div>
                    <button
                      onClick={() => handleOpenBooking(undefined, b)}
                      className="mt-4 w-full py-2.5 px-4 rounded-xl bg-sky-50 hover:bg-sky-500 text-sky-700 hover:text-white dark:bg-slate-800 dark:text-sky-300 dark:hover:bg-sky-500 dark:hover:text-white font-bold text-sm border border-sky-200/80 dark:border-slate-700 transition-all"
                    >
                      {isRtl ? 'حجز في هذا الفرع' : 'Book This Branch'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#081526] text-white py-8 px-4 sm:px-6 lg:px-8 border-t border-slate-800 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-5 text-xs text-slate-400 text-center sm:text-right">
            <span>جميع الحقوق محفوظة 2026 YallaCodex</span>
            <span className="hidden sm:inline opacity-40">•</span>
            <Link
              href={`/clinic/${clinic?.slug || 'zizo'}/patient/login`}
              className="text-sky-400 hover:text-sky-300 hover:underline font-bold transition-colors inline-flex items-center gap-1.5"
            >
              <User className="w-3.5 h-3.5" />
              <span>{isRtl ? 'بوابة المريض (تسجيل الدخول / إنشاء حساب)' : 'Patient Portal (Login / Register)'}</span>
            </Link>
          </div>
          <div className="text-2xl font-extrabold tracking-tight" dir="ltr">
            <span className="text-sky-400">yalla</span>
            <span className="text-slate-300 font-semibold">clinic</span>
          </div>
        </div>
      </footer>

      {/* Booking Modal */}
      {bookingOpen && (
        <BookingModal
          clinic={clinic}
          services={services}
          initialService={selectedService}
          initialBranch={selectedBranch}
          onClose={() => setBookingOpen(false)}
        />
      )}

      {/* Live Queue Turn Modal */}
      {liveTurnOpen && (
        <PatientLiveTurn
          clinic={clinic}
          onClose={() => setLiveTurnOpen(false)}
        />
      )}
    </div>
  )
}
