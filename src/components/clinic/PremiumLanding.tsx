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
import { AIChatWidget } from './AIChatWidget'
import { ClinicLogo } from './ClinicLogo'

export function PremiumLanding({
  clinic,
  services = []
}: {
  clinic: any
  services: any[]
}) {
  const router = useRouter()
  const primaryColor = clinic?.primaryColor || '#15B8A6'

  const [trackModalOpen, setTrackModalOpen] = useState(false)
  const [trackPhone, setTrackPhone] = useState('')
  const [isSearchingQueue, setIsSearchingQueue] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [preselectedServiceId, setPreselectedServiceId] = useState<string | null>(null)

  const defaultServices = services.length > 0 ? services : [
    { id: '1', name: 'كشف عادي', price: 250, desc: 'كشف طبي شامل مع تشخيص دقيق', duration: 'حوالي 15 دقيقة' },
    { id: '2', name: 'استشارة', price: 150, desc: 'استشارة تخصصية ومراجعة تحاليل', duration: 'حوالي 10 دقائق' },
    { id: '3', name: 'كشف مستعجل', price: 400, desc: 'أولوية فورية في الدور والدخول', duration: 'كشف فوري مباشر' },
    { id: '4', name: 'متابعة', price: 100, desc: 'متابعة لحالة سابقة وتعديل الجرعات', duration: 'حوالي 10 دقائق' },
  ]

  const scrollToBooking = () => {
    document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSelectService = (serviceId: string) => {
    setPreselectedServiceId(serviceId)
    scrollToBooking()
  }

  const handleTrackQueueSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!trackPhone.trim()) {
      toast.error('يرجى إدخال رقم الهاتف المسجل بالحجز')
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
        setSearchError('لم يتم العثور على حجز نشط بهذا الرقم في العيادة اليوم.')
      } else {
        const sorted = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as any))
          .sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime())
        const targetAppt = sorted.find(a => a.status === 'waiting' || a.status === 'in_progress') || sorted[0]
        toast.success(`تم العثور على حجزك (دور رقم ${targetAppt.queue_number || '1'})`)
        setTrackModalOpen(false)
        router.push(`/clinic/${clinic?.slug}/track/${targetAppt.id}`)
      }
    } catch (err) {
      console.error(err)
      toast.error('حدث خطأ أثناء الاستعلام، يرجى المحاولة ثانيةً')
    } finally {
      setIsSearchingQueue(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F6F8FB] font-sans text-[#182230]" dir="rtl">
      <style dangerouslySetInnerHTML={{ __html: `:root { --primary: ${primaryColor}; }` }} />

      {/* 1. TOP NAVBAR */}
      <nav className="fixed w-full z-50 top-0 bg-white/90 backdrop-blur-md border-b border-[#E5EAF0] shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-18">
            {/* Brand Logo & Doctor Snippet */}
            <div className="flex items-center gap-3">
              <ClinicLogo size="sm" variant="light" showSubtitle={false} />
              <div className="hidden sm:block border-r border-slate-200 pr-3">
                <h1 className="text-sm font-black text-[#182230]">
                  {clinic?.clinicName || `عيادة ${clinic?.doctorTitle || 'د.'} محمد علي`}
                </h1>
                <p className="text-[10px] font-bold text-[#15B8A6]">
                  {clinic?.doctorName ? `${clinic?.doctorTitle || 'د.'} ${clinic.doctorName}` : (clinic?.specialty || 'استشاري الطب الباطني')}
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
                  className="hidden md:flex"
                >
                  <Button
                    variant="outline"
                    className="rounded-xl text-xs font-bold text-emerald-600 border-emerald-200 hover:bg-emerald-50 h-9 px-3.5"
                  >
                    <PhoneCall className="w-3.5 h-3.5 ml-1.5" />
                    استشارة واتساب
                  </Button>
                </a>
              )}

              <a href="#location" className="hidden sm:flex">
                <Button
                  variant="outline"
                  className="rounded-xl text-xs font-bold text-[#2F80ED] border-blue-200 hover:bg-blue-50 h-9 px-3.5"
                >
                  <MapPin className="w-3.5 h-3.5 ml-1.5" />
                  موقع العيادة
                </Button>
              </a>

              {/* Patient Portal CTA Button */}
              <Link href={`/clinic/${clinic?.slug}/patient/login`}>
                <Button
                  variant="outline"
                  className="rounded-xl text-xs font-bold text-[#15B8A6] border-[#15B8A6]/30 hover:bg-[#15B8A6]/10 h-9 px-3.5"
                >
                  <UserCheck className="w-3.5 h-3.5 ml-1.5" />
                  بوابة المريض
                </Button>
              </Link>

              <Link href={`/clinic/${clinic?.slug}/login`}>
                <Button className="rounded-xl text-xs font-black bg-[#0B1F33] hover:bg-[#132B45] text-white h-9 px-4 shadow-sm border border-[#0B1F33]/20">
                  دخول الطاقم
                </Button>
              </Link>
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
            className="medical-card bg-gradient-to-br from-[#0B1F33] via-[#0F2840] to-[#0B1F33] text-white rounded-3xl p-6 sm:p-12 relative overflow-hidden shadow-2xl border border-white/10"
          >
            {/* Ambient Background Glows */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#15B8A6]/20 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#2F80ED]/20 rounded-full blur-3xl pointer-events-none"></div>

            <div className="grid lg:grid-cols-12 gap-8 items-center relative z-10">
              
              {/* Doctor Details (Right side in RTL) */}
              <div className="lg:col-span-7 space-y-6 text-right">
                
                {/* Live Availability Badge */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  العيادة متاحة للحجز واستقبال المرضى اليوم
                </motion.div>

                <div className="space-y-2">
                  <motion.h1
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight"
                  >
                    {clinic?.doctorName ? `${clinic?.doctorTitle || 'د.'} ${clinic.doctorName}` : `${clinic?.doctorTitle || 'د.'} محمد علي`}
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="text-base sm:text-lg text-teal-300 font-bold"
                  >
                    {clinic?.specialty || 'استشاري الطب المتخصص وعلاج الحالات المتقدمة'}
                  </motion.p>
                </div>

                <motion.p
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl"
                >
                  {clinic?.heroSubtitle ||
                    'نقدم لك ولأسرتك رعاية طبية متكاملة بأحدث المعايير السريرية مع نظام إلكتروني ذكي لتنظيم الأدوار ومتابعة حالتك بدون انتظار طويل.'}
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
                    <span>{clinic?.badge2Value ? `${clinic.badge2Value} (تقييم موثق)` : '4.9 (140 تقييم موثق)'}</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                    <UserCheck className="w-4 h-4 text-[#15B8A6]" />
                    <span>{clinic?.badge1Value || '+1,200 حالة تم علاجها'}</span>
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
                    whileHover={{ scale: 1.04, y: -2 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={scrollToBooking}
                    className="h-12 px-7 w-full sm:w-auto justify-center text-xs sm:text-sm font-black bg-[#15B8A6] hover:bg-[#0D9488] text-white rounded-xl shadow-lg shadow-[#15B8A6]/35 flex items-center gap-2 cursor-pointer transition-all"
                  >
                    <Calendar className="w-4 h-4 ml-1 text-white" />
                    احجز موعدك الآن
                  </motion.button>

                  {/* Button 2: Track Queue (High contrast, pure white background with dark navy text) */}
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.04, y: -2 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => {
                      setSearchError('')
                      setTrackModalOpen(true)
                    }}
                    className="h-12 px-6 w-full sm:w-auto justify-center text-xs sm:text-sm font-black bg-white hover:bg-slate-100 text-[#0B1F33] rounded-xl shadow-md shadow-black/15 flex items-center gap-2 cursor-pointer transition-all border border-white"
                  >
                    <Clock className="w-4 h-4 ml-1 text-[#15B8A6]" />
                    تتبع دورك مباشرة
                  </motion.button>

                  {/* Button 3: Patient Portal */}
                  <Link href={`/clinic/${clinic?.slug}/patient/login`} className="w-full sm:w-auto">
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.04, y: -2 }}
                      whileTap={{ scale: 0.96 }}
                      className="h-12 px-6 w-full sm:w-auto justify-center text-xs sm:text-sm font-bold bg-[#132B45] hover:bg-[#1a385a] text-teal-200 border border-teal-500/40 rounded-xl shadow-sm flex items-center gap-2 cursor-pointer transition-all"
                    >
                      <UserCheck className="w-4 h-4 ml-1 text-[#15B8A6]" />
                      بوابة المريض (كشوفاتك السابقة)
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
                  className="relative w-64 h-80 sm:w-72 sm:h-96 rounded-3xl overflow-hidden shadow-2xl border-4 border-white/20 group"
                >
                  <img
                    src={
                      clinic?.heroImage ||
                      'https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=1000&auto=format&fit=crop'
                    }
                    alt="Doctor"
                    className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0B1F33]/80 via-transparent to-transparent"></div>
                  
                  {/* Floating Verified Badge */}
                  <motion.div
                    animate={{ y: [0, -4, 0] }}
                    transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                    className="absolute bottom-4 inset-x-4 p-3 rounded-2xl bg-white/95 backdrop-blur-md text-[#182230] flex items-center gap-3 shadow-xl"
                  >
                    <div className="w-9 h-9 rounded-xl bg-teal-50 text-[#15B8A6] flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-black">{clinic?.certificationTitle || 'طبيب معتمد رسمياً'}</p>
                      <p className="text-[10px] text-slate-500 font-semibold">{clinic?.certificationEntity || 'نقابة الأطباء المصرية'}</p>
                    </div>
                  </motion.div>
                </motion.div>
              </div>

            </div>
          </motion.div>

          {/* 3. Feature Highlights Pills Row (Matching Mockup) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6">
            {[
              { icon: Activity, title: 'متابعة مستمرة', desc: 'تواصل دائم لحالتك' },
              { icon: Award, title: 'أحدث الأجهزة', desc: 'دقة تشخيصية عالية' },
              { icon: HeartPulse, title: 'رعاية متكاملة', desc: 'خدمات طبية شاملة' },
              { icon: ShieldCheck, title: 'خبرة طبية عالية', desc: 'أعلى المعايير السريرية' },
            ].map((feature, idx) => {
              const Icon = feature.icon
              return (
                <div
                  key={idx}
                  className="medical-card p-4 flex items-center gap-3 bg-white hover:border-[#15B8A6]/40 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#15B8A6] flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-[#182230]">{feature.title}</h4>
                    <p className="text-[10px] text-slate-400 font-medium">{feature.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>

        </div>
      </section>

      {/* 4. AVAILABLE SERVICES SECTION (الخدمات المتاحة) */}
      <section className="py-12 bg-white border-y border-[#E5EAF0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-black text-[#182230]">
              الخدمات الطبية المتاحة
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              اختر الخدمة الطبية المناسبة واطلع على الأسعار المعتمدة مع إمكانية الحجز الفوري
            </p>
          </div>

          {/* Services Cards Grid (Matching Mockup) */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {defaultServices.map((service) => (
              <div
                key={service.id}
                className="medical-card p-5 flex flex-col justify-between space-y-4 hover:shadow-lg transition-all border border-[#E5EAF0] rounded-2xl group"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-teal-50 text-[#15B8A6]">
                      {service.duration || '15 دقيقة'}
                    </span>
                    <Stethoscope className="w-4 h-4 text-slate-400 group-hover:text-[#15B8A6] transition-colors" />
                  </div>

                  <h3 className="font-black text-base text-[#182230]">{service.name}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed min-h-[36px]">
                    {service.desc || 'خدمة طبية شاملة بالعيادة مع تشخيص متكامل'}
                  </p>
                </div>

                <div className="pt-3 border-t border-[#E5EAF0] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block">التكلفة</span>
                    <span className="text-lg font-black text-[#15B8A6]">
                      {service.price} <span className="text-xs font-bold text-slate-500">ج.م</span>
                    </span>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => handleSelectService(service.id)}
                    className="h-9 px-4 text-xs font-bold bg-[#15B8A6] hover:bg-[#0D9488] text-white rounded-xl shadow-xs cursor-pointer transition-all hover:scale-105 active:scale-95"
                  >
                    احجز الآن
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. BOOKING FORM SECTION */}
      <section id="booking" className="py-16 bg-[#F6F8FB]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-[#182230]">
              حجز موعد جديد بالعيادة
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              اختر الخدمة وسيقوم النظام بتحديد رقم دورك ووقت الدخول المتوقع
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
      <section id="location" className="py-16 bg-white border-t border-[#E5EAF0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 text-[#15B8A6] text-xs font-bold border border-teal-100">
              <MapPin className="w-3.5 h-3.5" />
              <span>موقع العيادة والتواصل</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#182230]">
              تفضل بزيارتنا أو تواصل معنا مباشرة
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              نحن هنا لخدمتك والإجابة على جميع استفساراتك، يمكنك زيارة موقعنا أو الاتصال المباشر
            </p>
          </div>

          <div className="grid lg:grid-cols-12 gap-8 items-stretch">
            
            {/* Contact Information Cards (7 cols in RTL) */}
            <div className="lg:col-span-7 space-y-4">
              
              {/* Address Card */}
              <div className="medical-card p-5 flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-teal-50 text-[#15B8A6] flex items-center justify-center shrink-0">
                  <MapPin className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-[#182230]">عنوان العيادة</h4>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    {clinic?.clinicAddress || 'شارع التسعين الشمالي، التجمع الخامس، القاهرة'}
                  </p>
                  {clinic?.mapsLink && (
                    <a
                      href={clinic.mapsLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#15B8A6] hover:underline pt-1"
                    >
                      <span>فتح الموقع على خرائط Google</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>

              {/* Clinic Phone & WhatsApp Card */}
              <div className="medical-card p-5 flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <PhoneCall className="w-6 h-6" />
                </div>
                <div className="space-y-2 flex-1">
                  <div>
                    <h4 className="font-bold text-sm text-[#182230]">هاتف العيادة والحجز</h4>
                    <p className="text-xs text-slate-400">للحجز والاستفسار عن المواعيد والأدوار</p>
                  </div>
                  <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3">
                    {(clinic?.clinicPhones?.length ? clinic.clinicPhones : [clinic?.clinicPhone || '01012345678']).map((phone: string, idx: number) => (
                      <div key={idx} className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-black text-slate-800 dir-ltr bg-slate-50 px-3 py-1 rounded-xl border border-slate-200">
                          {phone}
                        </span>
                        {phone && (
                          <a
                            href={`https://wa.me/${phone.replace(/[^0-9]/g, '').replace(/^0/, '20')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-bold border border-emerald-200 transition-colors"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>واتساب</span>
                          </a>
                        )}
                        {phone && (
                          <a
                            href={`tel:${phone}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold border border-blue-200 transition-colors"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>اتصال</span>
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Doctor Phone Card (if present) */}
              {clinic?.doctorPhone && (
                <div className="medical-card p-5 flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#2F80ED] flex items-center justify-center shrink-0">
                    <Stethoscope className="w-6 h-6" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <div>
                      <h4 className="font-bold text-sm text-[#182230]">هاتف الطبيب المعالج</h4>
                      <p className="text-xs text-slate-400">للحالات الطارئة والتواصل الطبي المباشر</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-black text-slate-800 dir-ltr bg-slate-50 px-3 py-1 rounded-xl border border-slate-200">
                        {clinic.doctorPhone}
                      </span>
                      <a
                        href={`tel:${clinic.doctorPhone}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-50 text-[#2F80ED] hover:bg-blue-100 text-xs font-bold border border-blue-200 transition-colors"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>اتصال بالطبيب</span>
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Patient Portal Card */}
              <div className="medical-card p-5 bg-gradient-to-r from-teal-50/70 to-blue-50/70 border-teal-200 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-[#182230] flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-[#15B8A6]" />
                    بوابة المريض الإلكترونية
                  </h4>
                  <p className="text-xs text-slate-500 font-medium">
                    سجل دخولك برقم الهاتف للاطلاع على روشتاتك وكشوفاتك السابقة وتتبع دورك
                  </p>
                </div>
                <Link href={`/clinic/${clinic?.slug}/patient/login`}>
                  <Button className="h-10 px-5 text-xs font-bold bg-[#15B8A6] hover:bg-[#0D9488] text-white rounded-xl shadow-xs whitespace-nowrap">
                    دخول البوابة
                  </Button>
                </Link>
              </div>

            </div>

            {/* Map / Directions Interactive Card (5 cols in RTL) */}
            <div className="lg:col-span-5 flex flex-col">
              <div className="medical-card p-6 flex-1 flex flex-col justify-between bg-gradient-to-b from-[#0B1F33] to-[#081827] text-white rounded-3xl overflow-hidden relative shadow-xl">
                <div className="space-y-4 relative z-10">
                  <div className="w-12 h-12 rounded-2xl bg-[#15B8A6]/20 text-[#15B8A6] border border-[#15B8A6]/30 flex items-center justify-center">
                    <Navigation className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">الوصول السريع للعيادة</h3>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      انقر على الزر أدناه لفتح موقع العيادة مباشرة عبر تطبيق خرائط Google لتوجيهك بنظام الملاحة GPS خطوة بخطوة.
                    </p>
                  </div>
                  
                  <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 space-y-1">
                    <div className="flex items-center gap-2 text-xs font-bold text-teal-300">
                      <Clock className="w-4 h-4" />
                      <span>مواعيد الحضور والعمل:</span>
                    </div>
                    <p className="text-xs text-slate-200">
                      يومياً من السبت إلى الخميس (من 2:00 ظهراً حتى 10:00 مساءً)
                    </p>
                  </div>
                </div>

                <div className="pt-6 relative z-10 space-y-3">
                  <a
                    href={clinic?.mapsLink || 'https://maps.google.com'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full"
                  >
                    <Button className="w-full h-12 font-black text-xs bg-[#15B8A6] hover:bg-[#0D9488] text-white rounded-xl shadow-lg shadow-[#15B8A6]/30">
                      <Navigation className="w-4 h-4 ml-2" />
                      فتح الاتجاهات على خرائط Google
                    </Button>
                  </a>

                  <p className="text-[11px] text-center text-slate-400">
                    متاح مواقف سيارات خاصة واستراحة مجهزة للمرضى
                  </p>
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 7. CLINIC FOOTER WITH PLATFORM OWNER CONTACT */}
      <footer className="bg-white border-t border-[#E5EAF0] py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          
          <div className="grid md:grid-cols-4 gap-8 pb-8 border-b border-[#E5EAF0]">
            {/* Col 1: Clinic Info */}
            <div className="md:col-span-2 space-y-3">
              <ClinicLogo size="sm" variant="light" />
              <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
                {clinic?.clinicName || 'عيادة د. محمد علي'} — رعاية صحية متكاملة مدعومة بأحدث التقنيات الطبية ونظام إدارة ذكي للأدوار والروشتات.
              </p>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 pt-1">
                <MapPin className="w-3.5 h-3.5 text-[#15B8A6]" />
                {clinic?.clinicAddress || 'شارع التسعين الشمالي، التجمع الخامس، القاهرة'}
              </p>
            </div>

            {/* Col 2: Quick Links */}
            <div className="space-y-2.5">
              <h4 className="font-bold text-xs text-[#182230]">روابط سريعة</h4>
              <ul className="space-y-1.5 text-xs text-slate-500">
                <li>
                  <button onClick={scrollToBooking} className="hover:text-[#15B8A6] cursor-pointer">
                    حجز كشف جديد
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => {
                      setSearchError('')
                      setTrackModalOpen(true)
                    }}
                    className="hover:text-[#15B8A6] cursor-pointer"
                  >
                    تتبع دورك في الدور المباشر
                  </button>
                </li>
                <li>
                  <Link href={`/clinic/${clinic?.slug}/patient/login`} className="hover:text-[#15B8A6]">
                    بوابة المريض الإلكترونية
                  </Link>
                </li>
                <li>
                  <a href="#location" className="hover:text-[#15B8A6]">
                    موقع العيادة والتواصل
                  </a>
                </li>
                <li>
                  <Link href={`/clinic/${clinic?.slug}/login`} className="hover:text-[#15B8A6]">
                    تسجيل دخول الكادر الطبي
                  </Link>
                </li>
              </ul>
            </div>

            {/* Col 3: Clinic Direct Contact & Working Hours */}
            <div className="space-y-2.5">
              <h4 className="font-bold text-xs text-[#182230]">مواعيد العمل والتواصل</h4>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="space-y-0.5">
                  <span className="text-[11px] font-bold text-slate-500 block">هاتف العيادة والحجز:</span>
                  <span className="font-mono text-xs font-black text-[#15B8A6] block" dir="ltr">
                    {clinic?.clinicPhone || '01012345678'}
                  </span>
                </div>
                <div className="pt-1.5 border-t border-slate-200/60">
                  <span className="text-[10px] text-slate-400 block">
                    السبت إلى الخميس: 2:00 م — 10:00 م
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400 font-medium">
            <div>
              جميع الحقوق محفوظة © {new Date().getFullYear()} {clinic?.clinicName || 'العيادة الطبية'}
            </div>
            <div className="flex items-center gap-3">
              <Link href={`/clinic/${clinic?.slug}/login`} className="hover:text-slate-600">
                دخول الكادر الطبي
              </Link>
              <span>•</span>
              <Link href={`/clinic/${clinic?.slug}/patient/login`} className="hover:text-[#15B8A6]">
                بوابة المريض
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.25 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-[#E5EAF0] space-y-6 relative overflow-hidden"
            >
              {/* Top Close Button */}
              <button
                type="button"
                onClick={() => setTrackModalOpen(false)}
                className="absolute top-5 left-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Modal Header */}
              <div className="text-right space-y-1.5 pt-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 text-[#15B8A6] text-xs font-bold border border-teal-100">
                  <Clock className="w-3.5 h-3.5" />
                  <span>دور العيادة المباشر</span>
                </div>
                <h3 className="text-xl font-black text-[#182230]">استعلام وتتبع دورك في الكشف</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  أدخل رقم الهاتف الذي قمت بالحجز به في {clinic?.clinicName || 'العيادة'} لمعرفة دورك اللحظي والوقت المتبقي لدخولك.
                </p>
              </div>

              {/* Search Form */}
              <form onSubmit={handleTrackQueueSearch} className="space-y-4">
                <div className="space-y-1.5 text-right">
                  <label className="text-xs font-bold text-slate-700">رقم الهاتف المسجل في الحجز</label>
                  <div className="relative">
                    <Input
                      type="tel"
                      value={trackPhone}
                      onChange={e => {
                        setTrackPhone(e.target.value)
                        setSearchError('')
                      }}
                      placeholder="01012345678"
                      className="h-12 text-sm font-mono text-center rounded-xl bg-slate-50 border-[#E5EAF0] focus:bg-white pr-10"
                      dir="ltr"
                      autoFocus
                    />
                    <Phone className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {searchError && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
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
                      className="w-full h-8 text-xs font-bold border-rose-300 text-rose-700 hover:bg-rose-100/60 rounded-lg cursor-pointer"
                    >
                      <Calendar className="w-3.5 h-3.5 ml-1" />
                      احجز كشفاً الآن
                    </Button>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    type="submit"
                    disabled={isSearchingQueue || !trackPhone.trim()}
                    className="w-full h-12 font-black text-xs bg-[#15B8A6] hover:bg-[#0D9488] text-white rounded-xl shadow-md shadow-[#15B8A6]/20 cursor-pointer"
                  >
                    {isSearchingQueue ? (
                      <>
                        <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                        جاري البحث عن الحجز...
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4 ml-1.5" />
                        عرض موقعي في الدور
                      </>
                    )}
                  </Button>
                </div>
              </form>

              {/* Bottom Quick Help */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="text-[11px]">ليس لديك حجز مسبق؟</span>
                <button
                  type="button"
                  onClick={() => {
                    setTrackModalOpen(false)
                    scrollToBooking()
                  }}
                  className="text-xs font-bold text-[#15B8A6] hover:underline cursor-pointer"
                >
                  احجز كشفك الآن
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
