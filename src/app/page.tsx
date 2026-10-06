import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ClinicLogo } from '@/components/clinic/ClinicLogo'
import {
  Calendar, Users, FileSignature, Receipt, Database,
  TrendingUp, ShieldCheck, Stethoscope, ArrowLeft,
  CheckCircle2, Smartphone, Monitor, Sparkles
} from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen bg-[#F6F8FB] font-sans flex flex-col justify-between text-[#182230]" dir="rtl">
      
      {/* Top Navbar */}
      <header className="border-b border-[#E5EAF0] bg-white/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <ClinicLogo size="md" variant="light" />
        <div className="flex items-center gap-3">
          <Link href="/clinic/demo">
            <Button variant="outline" className="h-10 text-xs font-bold border-[#E5EAF0] text-slate-700 rounded-xl">
              صفحة العيادة للمرضى
            </Button>
          </Link>
          <Link href="/clinic/demo/login">
            <Button className="h-10 px-5 text-xs font-black bg-[#15B8A6] hover:bg-[#0D9488] text-white rounded-xl shadow-md shadow-[#15B8A6]/20">
              دخول العيادة
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Hero Container */}
      <main className="max-w-6xl mx-auto px-4 py-16 sm:py-24 space-y-12 text-center">
        
        {/* Brand Splash Card (Matching Top Left Mockup in User Image) */}
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-50 border border-teal-200 text-[#0D9488] text-xs font-bold shadow-xs">
            <Sparkles className="w-3.5 h-3.5" />
            الجيل الجديد لأنظمة العيادات الطبية في مصر والعالم العربي
          </div>

          <div className="space-y-3">
            <h1 className="text-4xl sm:text-6xl font-black text-[#0B1F33] tracking-tight">
              نظام تشغيل العيادات الذكي
            </h1>
            <p className="text-base sm:text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed font-medium">
              منصة سحابية متكاملة لإدارة كشوفات المرضى، الدور اللحظي، الروشتات الإلكترونية، والحسابات المالية بدقة وسرعة فائقة.
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Link href="/clinic/demo/admin">
              <Button className="h-14 px-8 text-base font-black bg-[#15B8A6] hover:bg-[#0D9488] text-white rounded-2xl shadow-xl shadow-[#15B8A6]/30 hover:scale-105 transition-all">
                <Stethoscope className="w-5 h-5 ml-2" />
                تجربة لوحة تحكم الطبيب
              </Button>
            </Link>

            <Link href="/clinic/demo">
              <Button variant="outline" className="h-14 px-8 text-base font-bold border-[#E5EAF0] text-slate-700 hover:bg-slate-100 rounded-2xl bg-white shadow-xs hover:scale-105 transition-all">
                <Calendar className="w-5 h-5 ml-2 text-[#15B8A6]" />
                تجربة حجز مريض ومتابعة الدور
              </Button>
            </Link>
          </div>
        </div>

        {/* 6 Feature Pillars (Matching the Top-Left Poster from user's image) */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 pt-8">
          {[
            { icon: Users, title: 'ملفات المرضى', desc: 'سجل طبي موحد' },
            { icon: Calendar, title: 'تنظيم الدور', desc: 'دور لحظي ذكي' },
            { icon: Stethoscope, title: 'إدارة سهلة', desc: 'واجهة سريعة وبسيطة' },
            { icon: FileSignature, title: 'روشتات احترافية', desc: 'طباعة فورية A4' },
            { icon: TrendingUp, title: 'تقارير دقيقة', desc: 'إيرادات وتحليلات' },
            { icon: Smartphone, title: 'كل الأجهزة', desc: 'موبايل، تابلت، كمبيوتر' }
          ].map((pillar, idx) => {
            const Icon = pillar.icon
            return (
              <div
                key={idx}
                className="medical-card p-5 flex flex-col items-center justify-center text-center space-y-2.5 bg-white hover:border-[#15B8A6]/40 transition-all hover:scale-102"
              >
                <div className="w-12 h-12 rounded-2xl bg-teal-50 text-[#15B8A6] flex items-center justify-center">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="font-black text-xs text-[#182230]">{pillar.title}</h3>
                <p className="text-[10px] text-slate-400 font-semibold">{pillar.desc}</p>
              </div>
            )
          })}
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-[#E5EAF0] bg-white py-6 px-6 text-center text-xs text-slate-400">
        Clinic OS © {new Date().getFullYear()} — نظام تشغيل العيادات الذكي. صُمم وصُنع للعيادات الطبية باحترافية.
      </footer>
    </div>
  )
}
