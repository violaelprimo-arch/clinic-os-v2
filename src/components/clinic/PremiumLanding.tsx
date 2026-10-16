'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Calendar, PhoneCall, Star, ShieldCheck, Clock,
  Activity, HeartPulse, MapPin, CheckCircle2, Award,
  Sparkles, ArrowLeft, Stethoscope, ChevronDown, UserCheck,
  Navigation, ExternalLink, FileText, Phone, MessageCircle,
  Search, Loader2, AlertCircle, X, Check, ArrowRight
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { BookingForm } from './BookingForm'
import { BookingModal } from './BookingModal'
import { AIChatWidget } from './AIChatWidget'
import { ClinicLogo } from './ClinicLogo'
import { isClinicFeatureEnabled } from '@/lib/featurePermissions'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { LanguageToggle } from '@/components/common/LanguageToggle'
import { useLanguage } from '@/context/LanguageContext'

function formatTime12(timeStr?: string) {
  if (!timeStr) return ''
  const [hStr, mStr] = timeStr.split(':')
  const h = Number(hStr)
  const m = Number(mStr)
  if (isNaN(h)) return timeStr
  const period = h >= 12 ? 'م' : 'ص'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  const minute = m !== undefined && m !== 0 ? `:${String(m).padStart(2, '0')}` : ':00'
  return `${hour12}${minute} ${period}`
}

export function PremiumLanding({
  clinic,
  services = []
}: {
  clinic: any
  services: any[]
}) {
  const router = useRouter()
  const { dir, t, isRtl } = useLanguage()
  const primaryColor = clinic?.primaryColor || '#087CF4'

  const [bookingModalOpen, setBookingModalOpen] = useState(false)
  const [modalServiceId, setModalServiceId] = useState<string | null>(null)
  const [trackModalOpen, setTrackModalOpen] = useState(false)
  const [trackPhone, setTrackPhone] = useState('')
  const [isSearchingQueue, setIsSearchingQueue] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [preselectedServiceId, setPreselectedServiceId] = useState<string | null>(null)

  const defaultServices = services.length > 0 ? services : [
    { id: '1', name: isRtl ? 'كشف عادي' : 'Standard Consultation', price: 250, desc: isRtl ? 'كشف طبي شامل مع تشخيص دقيق' : 'Comprehensive diagnostic examination', duration: isRtl ? 'حوالي 15 دقيقة' : 'Approx 15 mins' },
    { id: '2', name: isRtl ? 'استشارة' : 'Specialist Consultation', price: 150, desc: isRtl ? 'استشارة تخصصية ومراجعة تحاليل' : 'Specialist consultation and lab review', duration: isRtl ? 'حوالي 10 دقائق' : 'Approx 10 mins' },
    { id: '3', name: isRtl ? 'كشف مستعجل' : 'Urgent Consultation', price: 400, desc: isRtl ? 'أولوية فورية في الدور والدخول' : 'Immediate queue priority entry', duration: isRtl ? 'كشف فوري مباشر' : 'Immediate entry' },
    { id: '4', name: isRtl ? 'متابعة' : 'Follow-up', price: 100, desc: isRtl ? 'متابعة لحالة سابقة وتعديل الجرعات' : 'Follow-up and dosage adjustments', duration: isRtl ? 'حوالي 10 دقائق' : 'Approx 10 mins' },
  ]

  const isOnlineBookingEnabled = isClinicFeatureEnabled(clinic, 'onlineBooking') && clinic?.allowOnlineBooking !== false

  const handleOpenBookingModal = (serviceId?: string) => {
    if (!isOnlineBookingEnabled) {
      toast.info(isRtl ? `الحجز الإلكتروني المباشر غير متاح حالياً لهذه العيادة. يرجى التواصل هاتفياً لتسجيل موعدك عبر الرقم: ${clinic?.clinicPhone || clinic?.doctorPhone || 'أرقام العيادة'}` : `Online booking is unavailable. Please call the clinic to book: ${clinic?.clinicPhone || clinic?.doctorPhone || 'Clinic phones'}`)
      return
    }
    if (serviceId) setModalServiceId(serviceId)
    setBookingModalOpen(true)
  }

  const scrollToBooking = () => {
    document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSelectService = (serviceId: string) => {
    handleOpenBookingModal(serviceId)
  }

  const handleTrackQueueSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!trackPhone.trim()) {
      toast.error(isRtl ? 'يرجى إدخال رقم الهاتف المسجل بالحجز' : 'Please enter your registered booking phone number')
      return
    }

    setIsSearchingQueue(true)
    setSearchError('')

    try {
      const q = query(
        collection(db, 'appointments'),
        where('clinic_id', '==', clinic?.id || clinic?.slug),
        where('phone', '==', trackPhone.trim())
      )
      const snap = await getDocs(q)
      if (snap.empty) {
        setSearchError(isRtl ? 'لم يتم العثور على حجز نشط بهذا الرقم في العيادة اليوم.' : 'No active booking found for this phone number today.')
      } else {
        const sorted = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as any))
          .sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime())
        const targetAppt = sorted.find(a => a.status === 'waiting' || a.status === 'in_progress') || sorted[0]
        toast.success(isRtl ? `تم العثور على حجزك (دور رقم ${targetAppt.queue_number || '1'})` : `Booking found (Queue Ticket #${targetAppt.queue_number || '1'})`)
        setTrackModalOpen(false)
        router.push(`/clinic/${clinic?.slug}/track/${targetAppt.id}`)
      }
    } catch (err) {
      console.error(err)
      toast.error(isRtl ? 'حدث خطأ أثناء الاستعلام، يرجى المحاولة ثانيةً' : 'An error occurred during inquiry, please try again')
    } finally {
      setIsSearchingQueue(false)
    }
  }

  return (
    <div className="min-h-screen bg-background font-sans text-foreground transition-colors" dir={dir}>
      <style dangerouslySetInnerHTML={{ __html: `:root { --primary: ${primaryColor}; }` }} />

      {/* 1. TOP NAVBAR */}
      <nav className="fixed w-full z-50 top-0 bg-card/90 backdrop-blur-md border-b border-border shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-18">
            {/* Brand Logo & Doctor Snippet */}
            <div className="flex items-center gap-3">
              <ClinicLogo size="sm" variant="light" showSubtitle={false} />
              <div className="hidden sm:block rtl:border-r ltr:border-l border-border rtl:pr-3 ltr:pl-3">
                <h1 className="text-sm font-black text-foreground">
                  {clinic?.clinicName || `${isRtl ? 'عيادة' : 'Clinic'} ${clinic?.doctorTitle || (isRtl ? 'د.' : 'Dr.')} ${isRtl ? 'الطبيب' : 'Physician'}`}
                </h1>
                <p className="text-[10px] font-bold text-primary">
                  {clinic?.doctorName ? `${clinic?.doctorTitle || (isRtl ? 'د.' : 'Dr.')} ${clinic.doctorName}` : (clinic?.specialty || (isRtl ? 'استشاري الطب الباطني' : 'Consultant Physician'))}
                </p>
              </div>
            </div>

            {/* Navbar CTAs */}
            <div className="flex items-center gap-2 sm:gap-3">
              {clinic?.clinicPhone && (
                <a
                  href={`https://wa.me/${clinic.clinicPhone.replace(/[^0-9]/g, '').replace(/^0/, '20')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden lg:flex"
                >
                  <Button
                    variant="outline"
                    className="rounded-xl text-xs font-bold text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 h-9 px-3"
                  >
                    <PhoneCall className="w-3.5 h-3.5 rtl:ml-1.5 ltr:mr-1.5" />
                    {t('whatsapp_consult', 'استشارة واتساب')}
                  </Button>
                </a>
              )}

              <a href="#location" className="hidden md:flex">
                <Button
                  variant="outline"
                  className="rounded-xl text-xs font-bold text-primary border-primary/30 hover:bg-primary/10 h-9 px-3"
                >
                  <MapPin className="w-3.5 h-3.5 rtl:ml-1.5 ltr:mr-1.5" />
                  {t('clinic_location', 'موقع العيادة')}
                </Button>
              </a>

              {/* Patient Portal CTA Button */}
              <Link href={`/clinic/${clinic?.slug}/patient/login`} className="hidden sm:inline-flex">
                <Button
                  variant="outline"
                  className="rounded-xl text-xs font-bold text-primary border-primary/30 hover:bg-primary/10 h-9 px-3"
                >
                  <UserCheck className="w-3.5 h-3.5 rtl:ml-1.5 ltr:mr-1.5" />
                  {t('patient_portal', 'بوابة المريض')}
                </Button>
              </Link>

              <Link href={`/clinic/${clinic?.slug}/login`}>
                <Button className="rounded-xl text-xs font-black yalla-gradient-btn text-white h-9 px-3.5 shadow-sm">
                  {t('staff_login', 'دخول الفريق')}
                </Button>
              </Link>

              <div className="flex items-center gap-1.5 rtl:border-r ltr:border-l border-border rtl:pr-2 ltr:pl-2">
                <LanguageToggle />
                <ThemeToggle />
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* 2. DOCTOR HERO SECTION */}
      <section className="pt-28 pb-12 sm:pt-36 sm:pb-16 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Main Hero Card Container with Smooth Entrance */}
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="yalla-card bg-gradient-to-br from-[#061A38] via-[#0E2342] to-[#07162D] text-white rounded-3xl p-6 sm:p-12 relative overflow-hidden shadow-2xl shadow-primary/15 border border-white/20"
          >
            {/* Ambient Background Glows */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#087CF4]/25 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#00F0FF]/20 rounded-full blur-3xl pointer-events-none"></div>

            <div className="grid lg:grid-cols-12 gap-8 items-center relative z-10">
              
              {/* Doctor Details (Start side) */}
              <div className="lg:col-span-7 space-y-6 text-start">
                
                {/* Live Availability Badge */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/35 text-xs font-bold shadow-xs"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  {t('clinic_available_today', 'العيادة متاحة للحجز واستقبال المرضى اليوم')}
                </motion.div>

                <div className="space-y-2">
                  <motion.h1
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight"
                  >
                    {clinic?.doctorName ? `${clinic?.doctorTitle || (isRtl ? 'د.' : 'Dr.')} ${clinic.doctorName}` : `${clinic?.doctorTitle || (isRtl ? 'د.' : 'Dr.')} ${isRtl ? 'الطبيب' : 'Physician'}`}
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="text-base sm:text-lg text-teal-300 font-bold"
                  >
                    {clinic?.specialty || (isRtl ? 'استشاري الطب المتخصص وعلاج الحالات المتقدمة' : 'Consultant Physician & Advanced Care')}
                  </motion.p>
                </div>

                <motion.p
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl font-medium"
                >
                  {clinic?.heroSubtitle ||
                    (isRtl
                      ? 'نقدم لك ولأسرتك رعاية طبية متكاملة بأحدث المعايير السريرية مع نظام إلكتروني ذكي لتنظيم الأدوار ومتابعة حالتك بدون انتظار طويل.'
                      : 'Delivering holistic healthcare to you and your family with clinical excellence and smart queue management.')}
                </motion.p>

                {/* Rating & Patients stats */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="flex flex-wrap items-center gap-4 pt-1"
                >
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-xs text-xs font-bold text-amber-300 border border-white/10 shadow-xs">
                    <Star className="w-4 h-4 fill-amber-300 text-amber-300" />
                    <span>{clinic?.badge2Value ? `${clinic.badge2Value} (${t('verified_rating', 'تقييم موثق')})` : `4.9 (140 ${t('verified_rating', 'تقييم موثق')})`}</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                    <UserCheck className="w-4 h-4 text-cyan-400" />
                    <span>{clinic?.badge1Value || `+1,200 ${t('cases_treated', 'حالة تم علاجها')}`}</span>
                  </div>
                </motion.div>

                {/* Action CTA Buttons */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 pt-3 w-full"
                >
                  {/* Button 1: Book Appointment */}
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.03, y: -1 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => handleOpenBookingModal()}
                    className="h-12 px-8 w-full sm:w-auto justify-center text-xs sm:text-sm font-black yalla-gradient-btn text-white rounded-xl shadow-lg shadow-primary/35 flex items-center gap-2 cursor-pointer transition-all"
                  >
                    <Calendar className="w-4 h-4 mx-1 text-white" />
                    {t('book_now_btn', 'احجز موعدك الآن')}
                  </motion.button>

                  {/* Button 2: Track Queue */}
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.03, y: -1 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => {
                      setSearchError('')
                      setTrackModalOpen(true)
                    }}
                    className="h-12 px-7 w-full sm:w-auto justify-center text-xs sm:text-sm font-black bg-white/10 hover:bg-white/20 text-white border border-white/25 backdrop-blur-md rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-all"
                  >
                    <Clock className="w-4 h-4 mx-1 text-cyan-300" />
                    {t('track_live_turn', 'تتبع دورك في الدور المباشر')}
                  </motion.button>

                  {/* Button 3: Patient Portal */}
                  <Link href={`/clinic/${clinic?.slug}/patient/login`} className="w-full sm:w-auto">
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.03, y: -1 }}
                      whileTap={{ scale: 0.96 }}
                      className="h-12 px-6 w-full sm:w-auto justify-center text-xs sm:text-sm font-bold bg-[#132B45]/80 hover:bg-[#1a385a] text-teal-200 border border-teal-500/40 rounded-xl shadow-sm flex items-center gap-2 cursor-pointer transition-all"
                    >
                      <UserCheck className="w-4 h-4 mx-1 text-cyan-400" />
                      {t('patient_portal_btn', 'بوابة المريض (كشوفاتك السابقة)')}
                    </motion.button>
                  </Link>
                </motion.div>
              </div>

              {/* Doctor Visual / Avatar Card (Left side in RTL) */}
              <div className="lg:col-span-5 flex justify-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  className="relative w-64 h-80 sm:w-72 sm:h-96 rounded-3xl overflow-hidden shadow-2xl border-4 border-white/25 group"
                >
                  <img
                    src={
                      clinic?.heroImage ||
                      'https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=1000&auto=format&fit=crop'
                    }
                    alt="Doctor"
                    className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0B1F33]/85 via-transparent to-transparent"></div>
                  
                  {/* Floating Verified Badge */}
                  <motion.div
                    animate={{ y: [0, -4, 0] }}
                    transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                    className="absolute bottom-4 inset-x-4 p-3 rounded-2xl bg-card/95 backdrop-blur-md text-foreground flex items-center gap-3 shadow-xl border border-border"
                  >
                    <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-foreground">{clinic?.certificationTitle || (isRtl ? 'طبيب معتمد رسمياً' : 'Certified Physician')}</p>
                      <p className="text-[10px] text-muted-foreground font-semibold">{clinic?.certificationEntity || (isRtl ? 'نقابة الأطباء المصرية' : 'Medical Syndicate')}</p>
                    </div>
                  </motion.div>
                </motion.div>
              </div>

            </div>
          </motion.div>

          {/* 3. Feature Highlights Pills Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6">
            {[
              { icon: Activity, title: t('continuous_care', 'متابعة مستمرة'), desc: t('continuous_care_desc', 'تواصل دائم لحالتك') },
              { icon: Award, title: t('modern_devices', 'أحدث الأجهزة'), desc: t('modern_devices_desc', 'دقة تشخيصية عالية') },
              { icon: HeartPulse, title: t('integrated_care', 'رعاية متكاملة'), desc: t('integrated_care_desc', 'خدمات طبية شاملة') },
              { icon: ShieldCheck, title: t('clinical_excellence', 'خبرة طبية عالية'), desc: t('clinical_excellence_desc', 'أعلى المعايير السريرية') },
            ].map((feature, idx) => {
              const Icon = feature.icon
              return (
                <div
                  key={idx}
                  className="yalla-card p-4 sm:p-5 flex items-center gap-3.5 bg-card border-border hover:border-primary/50 hover:-translate-y-1 hover:shadow-xl transition-all duration-300 rounded-2xl group relative overflow-hidden shadow-xs"
                >
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20 text-primary flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300 shadow-2xs">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs text-foreground">{feature.title}</h4>
                    <p className="text-[10px] text-muted-foreground font-medium mt-0.5">{feature.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>

        </div>
      </section>

      {/* 4. AVAILABLE SERVICES SECTION */}
      <section className="py-12 bg-secondary/20 border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-black text-foreground">
              {t('available_medical_services', 'الخدمات الطبية المتاحة')}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {t('services_subtitle', 'اختر الخدمة الطبية المناسبة واطلع على الأسعار المعتمدة مع إمكانية الحجز الفوري')}
            </p>
          </div>

          {/* Services Cards Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {defaultServices.map((service) => (
              <div
                key={service.id}
                className="yalla-card p-5 flex flex-col justify-between space-y-4 hover:shadow-lg transition-all border border-border rounded-2xl group bg-card"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                      {service.duration || (isRtl ? '15 دقيقة' : '15 mins')}
                    </span>
                    <Stethoscope className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>

                  <h3 className="font-black text-base text-foreground">{service.name}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed min-h-[36px]">
                    {service.desc || (isRtl ? 'خدمة طبية شاملة بالعيادة مع تشخيص متكامل' : 'Comprehensive clinical examination')}
                  </p>
                </div>

                <div className={`pt-3 border-t border-border flex items-center ${clinic?.showPrices === false ? 'justify-end' : 'justify-between'}`}>
                  {clinic?.showPrices !== false && (
                    <div>
                      <span className="text-[10px] font-bold text-muted-foreground block">{t('cost_label', 'التكلفة')}</span>
                      <span className="text-lg font-black text-primary font-mono" dir="ltr">
                        {Number(service.price).toLocaleString(isRtl ? 'ar-EG' : 'en-US')} <span className="text-xs font-bold text-muted-foreground">{t('egp', 'ج.م')}</span>
                      </span>
                    </div>
                  )}

                  <Button
                    size="sm"
                    onClick={() => handleSelectService(service.id)}
                    className="h-9 px-4 text-xs font-bold bg-primary hover:bg-primary-hover text-white rounded-xl shadow-xs cursor-pointer transition-all hover:scale-105 active:scale-95"
                  >
                    {t('book_now_service', 'احجز الآن')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. BOOKING FORM SECTION */}
      <section id="booking" className="py-16 bg-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-foreground">
              {t('book_new_appointment', 'حجز موعد جديد بالعيادة')}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {t('booking_subtext', 'اختر الخدمة وسيقوم النظام بتحديد رقم دورك ووقت الدخول المتوقع')}
            </p>
          </div>

          <BookingForm
            clinic={clinic}
            services={defaultServices}
            preselectedServiceId={preselectedServiceId}
          />
        </div>
      </section>

      {/* 6. CLINIC LOCATION & DIRECT CONTACT SECTION */}
      <section id="location" className="py-16 bg-card border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20">
              <MapPin className="w-3.5 h-3.5" />
              <span>{t('location_and_contact', 'موقع العيادة والتواصل')}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-foreground">
              {t('visit_or_contact_us', 'تفضل بزيارتنا أو تواصل معنا مباشرة')}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {t('contact_desc', 'نحن هنا لخدمتك والإجابة على جميع استفساراتك، يمكنك زيارة موقعنا أو الاتصال المباشر')}
            </p>
          </div>

          <div className="grid lg:grid-cols-12 gap-8 items-stretch">
            
            {/* Contact Information Cards (7 cols in RTL) */}
            <div className="lg:col-span-7 space-y-4">
              
              {/* Address Card */}
              <div className="yalla-card p-5 flex items-start gap-4 bg-card border border-border">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <MapPin className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-foreground">{t('clinic_address', 'عنوان العيادة')}</h4>
                  <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                    {clinic?.clinicAddress || 'شارع التسعين الشمالي، التجمع الخامس، القاهرة'}
                  </p>
                  {clinic?.mapsLink && (
                    <a
                      href={clinic.mapsLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline pt-1"
                    >
                      <span>{t('open_google_maps', 'فتح الموقع على خرائط Google')}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>

              {/* Clinic Phone & WhatsApp Card */}
              <div className="yalla-card p-5 flex items-start gap-4 bg-card border border-border">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <PhoneCall className="w-6 h-6" />
                </div>
                <div className="space-y-2 flex-1">
                  <div>
                    <h4 className="font-bold text-sm text-foreground">{t('clinic_phones', 'هاتف العيادة والحجز')}</h4>
                    <p className="text-xs text-muted-foreground">{t('for_inquiries', 'للحجز والاستفسار عن المواعيد والأدوار')}</p>
                  </div>
                  <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3">
                    {(clinic?.clinicPhones?.length ? clinic.clinicPhones : [clinic?.clinicPhone || '01012345678']).map((phone: string, idx: number) => (
                      <div key={idx} className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-black text-foreground dir-ltr bg-secondary px-3 py-1 rounded-xl border border-border">
                          {phone}
                        </span>
                        {phone && (
                          <a
                            href={`https://wa.me/${phone.replace(/[^0-9]/g, '').replace(/^0/, '20')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold border border-emerald-500/20 transition-colors"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>{t('whatsapp', 'واتساب')}</span>
                          </a>
                        )}
                        {phone && (
                          <a
                            href={`tel:${phone}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold border border-primary/20 transition-colors"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>{t('call', 'اتصال')}</span>
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Doctor Phone Card (if present) */}
              {clinic?.doctorPhone && (
                <div className="yalla-card p-5 flex items-start gap-4 bg-card border border-border">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Stethoscope className="w-6 h-6" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <div>
                      <h4 className="font-bold text-sm text-foreground">{t('doctor_phone', 'هاتف الطبيب المعالج')}</h4>
                      <p className="text-xs text-muted-foreground">{t('emergency_only', 'للحالات الطارئة والتواصل الطبي المباشر')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-black text-foreground dir-ltr bg-secondary px-3 py-1 rounded-xl border border-border">
                        {clinic.doctorPhone}
                      </span>
                      <a
                        href={`tel:${clinic.doctorPhone}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold border border-primary/20 transition-colors"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>{t('call_doctor', 'اتصال بالطبيب')}</span>
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Patient Portal Card */}
              <div className="yalla-card p-5 bg-primary/5 border border-primary/20 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-primary" />
                    {t('patient_portal', 'بوابة المريض الإلكترونية')}
                  </h4>
                  <p className="text-xs text-muted-foreground font-medium">
                    {t('patient_portal_desc', 'سجل دخولك برقم الهاتف للاطلاع على روشتاتك وكشوفاتك السابقة وتتبع دورك')}
                  </p>
                </div>
                <Link href={`/clinic/${clinic?.slug}/patient/login`}>
                  <Button className="h-10 px-5 text-xs font-bold bg-primary hover:bg-primary-hover text-white rounded-xl shadow-xs whitespace-nowrap">
                    {t('enter_portal', 'دخول البوابة')}
                  </Button>
                </Link>
              </div>

            </div>

            {/* Map / Directions Interactive Card (5 cols in RTL) */}
            <div className="lg:col-span-5 flex flex-col">
              <div className="yalla-card p-6 flex-1 flex flex-col justify-between bg-gradient-to-b from-[#061A38] to-[#07162D] text-white rounded-3xl overflow-hidden relative shadow-xl border border-white/10">
                <div className="space-y-4 relative z-10">
                  <div className="w-12 h-12 rounded-2xl bg-primary/20 text-primary border border-primary/30 flex items-center justify-center">
                    <Navigation className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">{t('quick_directions', 'الوصول السريع للعيادة')}</h3>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      {t('directions_desc', 'انقر على الزر أدناه لفتح موقع العيادة مباشرة عبر تطبيق خرائط Google لتوجيهك بنظام الملاحة GPS خطوة بخطوة.')}
                    </p>
                  </div>
                  
                  <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-teal-300">
                      <Clock className="w-4 h-4" />
                      <span>{t('work_hours_title', 'مواعيد الحضور والعمل:')}</span>
                    </div>
                    {clinic?.weeklySchedule && clinic.weeklySchedule.filter((d: any) => d.isOpen).length > 0 ? (
                      <div className="space-y-1.5 text-xs text-slate-200 max-h-40 overflow-y-auto no-scrollbar">
                        {clinic.weeklySchedule.filter((d: any) => d.isOpen).map((d: any) => (
                          <div key={d.id} className="flex justify-between items-center text-[11px] border-b border-white/5 pb-0.5">
                            <span className="font-bold text-white">{d.day}:</span>
                            <span className="font-mono text-teal-200" dir="ltr">
                              {formatTime12(d.start)} — {formatTime12(d.end)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-200">
                        {t('default_hours', 'يومياً من السبت إلى الخميس (من 2:00 ظهراً حتى 10:00 مساءً)')}
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-6 relative z-10 space-y-3">
                  <a
                    href={clinic?.mapsLink || 'https://maps.google.com'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full"
                  >
                    <Button className="w-full h-12 font-black text-xs bg-primary hover:bg-primary-hover text-white rounded-xl shadow-lg">
                      <Navigation className="w-4 h-4 ml-2" />
                      {t('open_google_maps_btn', 'فتح الاتجاهات على خرائط Google')}
                    </Button>
                  </a>

                  <p className="text-[11px] text-center text-slate-400">
                    {t('parking_available', 'متاح مواقف سيارات خاصة واستراحة مجهزة للمرضى')}
                  </p>
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 7. CLINIC FOOTER */}
      <footer className="bg-card border-t border-border py-12 text-card-foreground">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          
          <div className="grid md:grid-cols-4 gap-8 pb-8 border-b border-border">
            {/* Col 1: Clinic Info */}
            <div className="md:col-span-2 space-y-3">
              <ClinicLogo size="sm" variant="light" />
              <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
                {clinic?.clinicName || 'العيادة'} — {t('clinic_footer_desc', 'رعاية صحية متكاملة مدعومة بأحدث التقنيات الطبية ونظام إدارة ذكي للأدوار والروشتات.')}
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
                <MapPin className="w-3.5 h-3.5 text-primary" />
                {clinic?.clinicAddress || 'شارع التسعين الشمالي، التجمع الخامس، القاهرة'}
              </p>
            </div>

            {/* Col 2: Quick Links */}
            <div className="space-y-2.5">
              <h4 className="font-bold text-xs text-foreground">{t('quick_links', 'روابط سريعة')}</h4>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li>
                  <button onClick={scrollToBooking} className="hover:text-primary cursor-pointer">
                    {t('book_new_exam', 'حجز كشف جديد')}
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => {
                      setSearchError('')
                      setTrackModalOpen(true)
                    }}
                    className="hover:text-primary cursor-pointer"
                  >
                    {t('track_live_turn', 'تتبع دورك في الدور المباشر')}
                  </button>
                </li>
                <li>
                  <Link href={`/clinic/${clinic?.slug}/patient/login`} className="hover:text-primary">
                    {t('patient_portal', 'بوابة المريض الإلكترونية')}
                  </Link>
                </li>
                <li>
                  <a href="#location" className="hover:text-primary">
                    {t('location_and_contact', 'موقع العيادة والتواصل')}
                  </a>
                </li>
                <li>
                  <Link href={`/clinic/${clinic?.slug}/login`} className="hover:text-primary">
                    {t('staff_login', 'تسجيل دخول الكادر الطبي')}
                  </Link>
                </li>
              </ul>
            </div>

            {/* Col 3: Clinic Direct Contact & Working Hours */}
            <div className="space-y-2.5">
              <h4 className="font-bold text-xs text-foreground">{t('work_hours_title', 'مواعيد العمل والتواصل')}</h4>
              <div className="p-3.5 rounded-xl bg-secondary border border-border space-y-2">
                <div className="space-y-0.5">
                  <span className="text-[11px] font-bold text-muted-foreground block">{t('clinic_phone_label', 'هاتف العيادة والحجز:')}</span>
                  <span className="font-mono text-xs font-black text-primary block" dir="ltr">
                    {clinic?.clinicPhone || '01012345678'}
                  </span>
                </div>
                <div className="pt-1.5 border-t border-border space-y-1">
                  {clinic?.weeklySchedule && clinic.weeklySchedule.filter((d: any) => d.isOpen).length > 0 ? (
                    clinic.weeklySchedule.filter((d: any) => d.isOpen).map((d: any) => (
                      <div key={d.id} className="flex justify-between items-center text-[10px] text-muted-foreground">
                        <span className="font-bold text-foreground">{d.day}:</span>
                        <span className="font-mono text-muted-foreground" dir="ltr">
                          {formatTime12(d.start)} — {formatTime12(d.end)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <span className="text-[10px] text-muted-foreground block">
                      {t('default_hours', 'السبت إلى الخميس: 2:00 م — 10:00 م')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground font-medium">
            <div>
              {t('copyright_text', 'جميع الحقوق محفوظة YallaCodeX 2026')}
            </div>
            <div className="flex items-center gap-3">
              <Link href={`/clinic/${clinic?.slug}/login`} className="hover:text-foreground">
                {t('staff_login', 'دخول الكادر الطبي')}
              </Link>
              <span>•</span>
              <Link href={`/clinic/${clinic?.slug}/patient/login`} className="hover:text-primary">
                {t('patient_portal', 'بوابة المريض')}
              </Link>
            </div>
          </div>

        </div>
      </footer>

      {/* 8. FLOATING AI ASSISTANT WIDGET */}
      <AIChatWidget clinic={clinic} />

      {/* 9. LIVE QUEUE TRACKER MODAL */}
      <AnimatePresence>
        {trackModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md" dir={dir}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.25 }}
              className="bg-card text-card-foreground rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-border space-y-6 relative overflow-hidden"
            >
              {/* Top Close Button */}
              <button
                type="button"
                onClick={() => setTrackModalOpen(false)}
                className="absolute top-5 rtl:left-5 ltr:right-5 w-8 h-8 rounded-full bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Modal Header */}
              <div className="rtl:text-right ltr:text-left space-y-1.5 pt-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{t('live_queue_badge', 'دور العيادة المباشر')}</span>
                </div>
                <h3 className="text-xl font-black text-foreground">{t('track_modal_title', 'استعلام وتتبع دورك في الكشف')}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t('track_modal_desc', 'أدخل رقم الهاتف الذي قمت بالحجز به في العيادة لمعرفة دورك اللحظي والوقت المتبقي لدخولك.')}
                </p>
              </div>

              {/* Search Form */}
              <form onSubmit={handleTrackQueueSearch} className="space-y-4">
                <div className="space-y-1.5 rtl:text-right ltr:text-left">
                  <label className="text-xs font-bold text-foreground">{t('registered_phone', 'رقم الهاتف المسجل في الحجز')}</label>
                  <div className="relative">
                    <Input
                      type="tel"
                      value={trackPhone}
                      onChange={e => {
                        setTrackPhone(e.target.value)
                        setSearchError('')
                      }}
                      placeholder="01012345678"
                      className="h-12 text-sm font-mono text-center rounded-xl bg-background border border-input text-foreground focus:ring-2 focus:ring-primary pr-10"
                      dir="ltr"
                      autoFocus
                    />
                    <Phone className="w-4 h-4 text-muted-foreground absolute rtl:right-3.5 ltr:left-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {searchError && (
                  <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                      <span>{searchError}</span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setTrackModalOpen(false)
                        scrollToBooking()
                      }}
                      className="w-full h-8 text-xs font-bold border-destructive/30 text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer"
                    >
                      <Calendar className="w-3.5 h-3.5 ml-1" />
                      {t('book_new_exam', 'احجز كشفاً الآن')}
                    </Button>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    type="submit"
                    disabled={isSearchingQueue || !trackPhone.trim()}
                    className="w-full h-12 font-black text-xs bg-primary hover:bg-primary-hover text-white rounded-xl shadow-md cursor-pointer"
                  >
                    {isSearchingQueue ? (
                      <>
                        <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                        {t('searching_booking', 'جاري البحث عن الحجز...')}
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4 ml-1.5" />
                        {t('view_queue_position', 'عرض موقعي في الدور')}
                      </>
                    )}
                  </Button>
                </div>
              </form>

              {/* Bottom Quick Help */}
              <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                <span className="text-[11px]">{t('no_previous_booking', 'ليس لديك حجز مسبق؟')}</span>
                <button
                  type="button"
                  onClick={() => {
                    setTrackModalOpen(false)
                    scrollToBooking()
                  }}
                  className="text-xs font-bold text-primary hover:underline cursor-pointer"
                >
                  {t('book_now_btn', 'احجز كشفك الآن')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 9. PREMIUM BOOKING MODAL */}
      <BookingModal
        isOpen={bookingModalOpen}
        onClose={() => setBookingModalOpen(false)}
        clinic={clinic}
        services={defaultServices}
        initialServiceId={modalServiceId}
      />
    </div>
  )
}
