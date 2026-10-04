'use client'

import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Calendar, PhoneCall, Star, ShieldCheck, Clock, Activity, HeartPulse, MapPin } from 'lucide-react'
import Link from 'next/link'
import { BookingForm } from './BookingForm'
import { AIChatWidget } from './AIChatWidget'
import { TrackTurnWidget } from './TrackTurnWidget'

export function PremiumLanding({ clinic, services }: { clinic: any, services: any[] }) {
  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  }

  const primaryColor = clinic?.primaryColor || '#0ea5e9' // Default Tailwind Sky-500

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans selection:bg-primary/20" dir="rtl">
      <style dangerouslySetInnerHTML={{__html: `:root { --primary: ${primaryColor}; }`}} />
      
      {/* Navbar - Glassmorphism */}
      <nav className="fixed w-full z-50 top-0 transition-all duration-300 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-4">
              <Avatar className="w-12 h-12 ring-2 ring-primary/20 shadow-sm transition-transform hover:scale-105">
                <AvatarImage src={clinic.heroImage || clinic.logo_url} alt={clinic.clinicName || clinic.name} />
                <AvatarFallback className="bg-primary/10 text-primary font-bold">{(clinic.clinicName || clinic.name || 'ع')?.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">{clinic.clinicName || clinic.name}</h1>
                <p className="text-xs font-medium text-primary">{clinic.doctorName ? `د. ${clinic.doctorName}` : clinic.specialty}</p>
              </div>
            </div>
            <div className="flex gap-2 md:gap-4">
              {clinic.clinicPhone && (
                <a 
                  href={`https://wa.me/${clinic.clinicPhone.replace(/[^0-9]/g, '').replace(/^0/, '20')}`} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="hidden md:flex"
                >
                  <Button variant="outline" className="rounded-full font-bold text-green-600 border-green-200 hover:bg-green-50 shadow-sm h-11 px-6">
                    <PhoneCall className="w-4 h-4 ml-2" />
                    استشارة واتساب
                  </Button>
                </a>
              )}
              {clinic.mapsLink && (
                <a href={clinic.mapsLink} target="_blank" rel="noopener noreferrer" className="hidden md:flex">
                  <Button variant="outline" className="rounded-full font-bold text-blue-600 border-blue-200 hover:bg-blue-50 shadow-sm h-11 px-6">
                    <MapPin className="w-4 h-4 ml-2" />
                    الموقع
                  </Button>
                </a>
              )}
              <Link href={`/clinic/${clinic.slug}/login`}>
                <Button className="rounded-full shadow-lg shadow-primary/25 h-11 px-6 font-bold hover:scale-105 transition-transform">
                  دخول الطاقم
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 overflow-hidden">
        {/* Decorative background blobs */}
        <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3">
          <div className="w-96 h-96 bg-primary/10 rounded-full blur-3xl mix-blend-multiply opacity-70 animate-blob"></div>
        </div>
        <div className="absolute top-0 left-0 -translate-y-12 -translate-x-1/3">
          <div className="w-96 h-96 bg-blue-200/50 rounded-full blur-3xl mix-blend-multiply opacity-70 animate-blob animation-delay-2000"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            
            {/* Text Content */}
            <motion.div 
              initial="hidden" 
              animate="visible" 
              variants={{
                hidden: { opacity: 0, x: 50 },
                visible: { opacity: 1, x: 0, transition: { duration: 0.8, staggerChildren: 0.2 } }
              }}
              className="space-y-8"
            >
              <motion.div variants={fadeIn} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                </span>
                الرعاية الطبية الأفضل في منطقتك
              </motion.div>
              
              <motion.h2 variants={fadeIn} className="text-5xl md:text-6xl font-black text-slate-900 leading-[1.2]">
                {clinic.heroTitle?.split(' ').slice(0, -2).join(' ') || 'صحتك تستحق'} <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-l from-primary to-blue-600">
                  {clinic.heroTitle?.split(' ').slice(-2).join(' ') || 'العناية الفائقة'}
                </span>
              </motion.h2>
              
              <motion.p variants={fadeIn} className="text-lg md:text-xl text-slate-600 max-w-lg leading-relaxed">
                {clinic.heroSubtitle || clinic.tagline || 'نقدم لك ولعائلتك رعاية صحية متكاملة تعتمد على أحدث التقنيات وأفضل الكوادر الطبية المتخصصة لضمان سلامتك وتوفير راحتك.'}
              </motion.p>
              
              <motion.div variants={fadeIn} className="flex flex-wrap gap-4 pt-4">
                <Button className="h-14 px-8 text-lg rounded-full shadow-xl shadow-primary/20 hover:shadow-2xl hover:scale-105 transition-all" onClick={() => document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' })}>
                  <Calendar className="w-5 h-5 ml-2" />
                  احجز موعدك الآن
                </Button>
                <Button variant="outline" className="h-14 px-8 text-lg rounded-full border-2 border-primary text-primary hover:bg-primary/5 hover:scale-105 transition-all" onClick={() => document.getElementById('track-turn')?.scrollIntoView({ behavior: 'smooth' })}>
                  <Clock className="w-5 h-5 ml-2" />
                  تابع دورك الآن
                </Button>
                <div className="flex items-center gap-2 text-slate-600 font-medium px-4 mt-2 md:mt-0">
                  <div className="flex -space-x-2 rtl:space-x-reverse">
                    {[1,2,3,4].map(i => (
                      <div key={i} className={`w-10 h-10 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500 z-${i}0`}>
                        <img src={`https://i.pravatar.cc/100?img=${i+10}`} alt="مريض" className="rounded-full" />
                      </div>
                    ))}
                  </div>
                  <span className="text-sm">+1000 مريض سعيد</span>
                </div>
              </motion.div>
            </motion.div>

            {/* Visual/Image Side */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8 }}
              className="relative hidden lg:block"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent rounded-3xl transform rotate-3 scale-105"></div>
              <img 
                src={clinic.heroImage || "https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=2000&auto=format&fit=crop"} 
                alt="Medical Team" 
                className="relative rounded-3xl shadow-2xl object-cover h-[500px] w-full"
              />
              
              {/* Floating Badge 1 */}
              <div className="absolute -right-8 top-12 bg-white p-4 rounded-2xl shadow-xl flex items-center gap-4 animate-bounce" style={{ animationDuration: '3s' }}>
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium">{clinic.badge1Title || 'أطباء معتمدون'}</p>
                  <p className="text-lg font-bold text-slate-900">{clinic.badge1Value || 'خبرة +15 سنة'}</p>
                </div>
              </div>

              {/* Floating Badge 2 */}
              <div className="absolute -left-8 bottom-24 bg-white p-4 rounded-2xl shadow-xl flex items-center gap-4 animate-bounce" style={{ animationDuration: '4s' }}>
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-500">
                  <Star className="w-6 h-6 fill-current" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium">{clinic.badge2Title || 'تقييم العيادة'}</p>
                  <p className="text-lg font-bold text-slate-900">{clinic.badge2Value || '4.9/5.0'}</p>
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </div>

      {/* Services Section */}
      <div className="bg-white py-24 border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h3 className="text-3xl font-bold text-slate-900 mb-4">خدماتنا الطبية</h3>
            <p className="text-slate-500 text-lg">نقدم مجموعة شاملة من الخدمات الطبية المتخصصة لنلبي كافة احتياجاتك الصحية.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {services.map((service, idx) => {
              const icons = [<Activity className="w-8 h-8"/>, <HeartPulse className="w-8 h-8"/>, <Clock className="w-8 h-8"/>]
              return (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                  key={service.id} 
                  className="group bg-slate-50 p-8 rounded-3xl border border-slate-100 hover:border-primary/30 hover:shadow-2xl hover:-translate-y-2 transition-all duration-300"
                >
                  <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-primary mb-6 group-hover:bg-primary group-hover:text-white transition-colors">
                    {icons[idx % icons.length]}
                  </div>
                  <h4 className="text-xl font-bold text-slate-900 mb-2">{service.name}</h4>
                  <p className="text-slate-500 mb-6 leading-relaxed">أفضل التشخيصات والمتابعة الدورية بأحدث الأجهزة لضمان الدقة والسرعة.</p>
                  <div className="flex items-center justify-between pt-4 border-t border-slate-200/60">
                    <span className="text-sm text-slate-500">سعر الخدمة</span>
                    <span className="text-lg font-black text-primary">{service.price} ج.م</span>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Booking Section */}
      <div id="booking" className="py-24 relative">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-slate-900 mb-4">احجز موعدك بسهولة</h3>
            <p className="text-slate-500">اختر الخدمة والوقت المناسب لك وسنقوم بتأكيد حجزك فوراً.</p>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <BookingForm clinic={clinic} services={services} />
            <div id="track-turn" className="mt-8">
              <TrackTurnWidget clinicId={clinic.id || clinic.slug} />
            </div>
          </motion.div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex justify-center items-center gap-2 mb-4 text-white opacity-90">
            <ShieldCheck className="w-6 h-6" />
            <span className="text-xl font-bold">منصة العيادة الذكية</span>
          </div>
          <p>© {new Date().getFullYear()} جميع الحقوق محفوظة. تطوير وتصميم مخصص للرعاية الصحية.</p>
        </div>
      </footer>
      <AIChatWidget clinic={clinic} />
    </div>
  )
}
