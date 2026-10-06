'use client'

import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Calendar, PhoneCall, Star, ShieldCheck, Clock,
  Activity, HeartPulse, MapPin, CheckCircle2, Award,
  Sparkles, ArrowLeft, Stethoscope, ChevronDown, UserCheck
} from 'lucide-react'
import Link from 'next/link'
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
  const primaryColor = clinic?.primaryColor || '#15B8A6'

  const defaultServices = services.length > 0 ? services : [
    { id: '1', name: 'كشف عادي', price: 250, desc: 'كشف طبي شامل مع تشخيص دقيق', duration: 'حوالي 15 دقيقة' },
    { id: '2', name: 'استشارة', price: 150, desc: 'استشارة تخصصية ومراجعة تحاليل', duration: 'حوالي 10 دقائق' },
    { id: '3', name: 'كشف مستعجل', price: 400, desc: 'أولوية فورية في الطابور والدخول', duration: 'كشف فوري مباشر' },
    { id: '4', name: 'متابعة', price: 100, desc: 'متابعة لحالة سابقة وتعديل الجرعات', duration: 'حوالي 10 دقائق' },
  ]

  const scrollToBooking = () => {
    document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' })
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
                  {clinic?.clinicName || 'عيادة د. محمد علي'}
                </h1>
                <p className="text-[10px] font-bold text-[#15B8A6]">
                  {clinic?.doctorName ? `د. ${clinic.doctorName}` : (clinic?.specialty || 'استشاري الطب الباطني')}
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

              {clinic?.mapsLink && (
                <a
                  href={clinic.mapsLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden md:flex"
                >
                  <Button
                    variant="outline"
                    className="rounded-xl text-xs font-bold text-[#2F80ED] border-blue-200 hover:bg-blue-50 h-9 px-3.5"
                  >
                    <MapPin className="w-3.5 h-3.5 ml-1.5" />
                    موقع العيادة
                  </Button>
                </a>
              )}

              <Link href={`/clinic/${clinic?.slug}/login`}>
                <Button className="rounded-xl text-xs font-black bg-[#0B1F33] hover:bg-[#132B45] text-white h-9 px-4 shadow-sm">
                  دخول الطاقم
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* 2. DOCTOR HERO SECTION (Matching Top Right Screen in Mockup) */}
      <section className="pt-28 pb-12 sm:pt-36 sm:pb-16 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Main Hero Card Container */}
          <div className="medical-card bg-gradient-to-br from-[#0B1F33] via-[#0F2840] to-[#0B1F33] text-white rounded-3xl p-6 sm:p-12 relative overflow-hidden shadow-2xl">
            {/* Ambient Background Glows */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#15B8A6]/20 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#2F80ED]/20 rounded-full blur-3xl pointer-events-none"></div>

            <div className="grid lg:grid-cols-12 gap-8 items-center relative z-10">
              
              {/* Doctor Details (Right side in RTL) */}
              <div className="lg:col-span-7 space-y-6 text-right">
                
                {/* Live Availability Badge */}
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  العيادة متاحة للحجز واستقبال المرضى اليوم
                </div>

                <div className="space-y-2">
                  <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
                    {clinic?.doctorName ? `د. ${clinic.doctorName}` : 'د. محمد علي'}
                  </h1>
                  <p className="text-base sm:text-lg text-teal-300 font-bold">
                    {clinic?.specialty || 'استشاري الطب المتخصص وعلاج الحالات المتقدمة'}
                  </p>
                </div>

                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
                  {clinic?.heroSubtitle ||
                    'نقدم لك ولأسرتك رعاية طبية متكاملة بأحدث المعايير السريرية مع نظام إلكتروني ذكي لتنظيم الأدوار ومتابعة حالتك بدون انتظار طويل.'}
                </p>

                {/* Rating & Patients stats */}
                <div className="flex flex-wrap items-center gap-4 pt-1">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-xs text-xs font-bold text-amber-300 border border-white/10">
                    <Star className="w-4 h-4 fill-amber-300 text-amber-300" />
                    <span>4.9 (140 تقييم موثق)</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                    <UserCheck className="w-4 h-4 text-[#15B8A6]" />
                    <span>+1,200 حالة تم علاجها</span>
                  </div>
                </div>

                {/* Action CTA Buttons matching Mockup */}
                <div className="flex flex-wrap gap-3 pt-3">
                  <Button
                    onClick={scrollToBooking}
                    className="h-12 px-8 text-sm font-black bg-[#15B8A6] hover:bg-[#0D9488] text-white rounded-xl shadow-lg shadow-[#15B8A6]/30 transition-all cursor-pointer"
                  >
                    <Calendar className="w-4 h-4 ml-2" />
                    احجز موعدك الآن
                  </Button>

                  <Button
                    variant="outline"
                    onClick={scrollToBooking}
                    className="h-12 px-6 text-xs font-bold border-white/20 text-white hover:bg-white/10 rounded-xl"
                  >
                    تتبع حجزك مباشرة
                  </Button>
                </div>
              </div>

              {/* Doctor Visual / Avatar Card (Left side in RTL) */}
              <div className="lg:col-span-5 flex justify-center">
                <div className="relative w-64 h-80 sm:w-72 sm:h-96 rounded-3xl overflow-hidden shadow-2xl border-4 border-white/20">
                  <img
                    src={
                      clinic?.heroImage ||
                      'https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=1000&auto=format&fit=crop'
                    }
                    alt="Doctor"
                    className="w-full h-full object-cover object-top"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0B1F33]/80 via-transparent to-transparent"></div>
                  
                  {/* Floating Verified Badge */}
                  <div className="absolute bottom-4 inset-x-4 p-3 rounded-2xl bg-white/95 backdrop-blur-md text-[#182230] flex items-center gap-3 shadow-lg">
                    <div className="w-9 h-9 rounded-xl bg-teal-50 text-[#15B8A6] flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-black">طبيب معتمد رسمياً</p>
                      <p className="text-[10px] text-slate-500 font-semibold">نقابة الأطباء المصرية</p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

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
                    onClick={scrollToBooking}
                    className="h-9 px-4 text-xs font-bold bg-[#15B8A6] hover:bg-[#0D9488] text-white rounded-xl shadow-xs"
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

          <BookingForm clinic={clinic} services={defaultServices} />
        </div>
      </section>

      {/* 6. CLINIC FOOTER & LOCATION */}
      <footer className="bg-white border-t border-[#E5EAF0] py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-right">
          <div className="space-y-1">
            <ClinicLogo size="sm" variant="light" />
            <p className="text-xs text-slate-400">
              {clinic?.clinicAddress || 'شارع التسعين الشمالي، التجمع الخامس، القاهرة'}
            </p>
          </div>

          <div className="text-xs text-slate-400 font-medium">
            جميع الحقوق محفوظة © {new Date().getFullYear()} Clinic OS — نظام تشغيل العيادات الذكي
          </div>
        </div>
      </footer>

      {/* 7. FLOATING AI ASSISTANT WIDGET */}
      <AIChatWidget clinic={clinic} />
    </div>
  )
}
