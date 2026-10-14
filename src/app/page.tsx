import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ClinicLogo } from '@/components/clinic/ClinicLogo'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { LanguageToggle } from '@/components/common/LanguageToggle'
import {
  Calendar, Users, FileSignature, Receipt, Database,
  TrendingUp, ShieldCheck, Stethoscope, ArrowLeft,
  CheckCircle2, Smartphone, Monitor, Sparkles
} from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--surface-page,#F4FAFF)] font-sans flex flex-col justify-between text-[#182230] dark:text-[#F3FAFF] transition-colors" dir="rtl">
      
      {/* Top Navbar */}
      <header className="border-b border-[#E5EAF0] dark:border-[#1E3A5F] bg-white/80 dark:bg-[#07162D]/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <ClinicLogo size="md" />
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <LanguageToggle />
          <Link href="/clinic/demo">
            <Button variant="outline" className="h-10 text-xs font-bold border-[#E5EAF0] dark:border-[#254565] text-slate-700 dark:text-slate-200 rounded-xl">
              صفحة العيادة للمرضى
            </Button>
          </Link>
          <Link href="/clinic/demo/login">
            <Button className="h-10 px-5 text-xs font-black bg-[#087CF4] hover:bg-[#0769D1] text-white rounded-xl shadow-md shadow-[#087CF4]/20">
              دخول العيادة
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Hero Container */}
      <main className="max-w-6xl mx-auto px-4 py-16 sm:py-24 space-y-12 text-center">
        
        {/* Brand Splash Card */}
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-[#087CF4] dark:text-[#02CFF3] text-xs font-bold shadow-xs">
            <Sparkles className="w-3.5 h-3.5" />
            الجيل الجديد لأنظمة العيادات الطبية في مصر والعالم العربي
          </div>

          <div className="space-y-3">
            <h1 className="text-4xl sm:text-6xl font-black text-[#061A38] dark:text-[#F3FAFF] tracking-tight">
              نظام تشغيل العيادات الذكي
            </h1>
            <p className="text-base sm:text-xl text-slate-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed font-medium">
              منصة سحابية متكاملة لإدارة كشوفات المرضى، الدور اللحظي، الروشتات الإلكترونية، والحسابات المالية بدقة وسرعة فائقة.
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Link href="/clinic/demo/admin">
              <Button className="h-14 px-8 text-base font-black bg-[#087CF4] hover:bg-[#0769D1] text-white rounded-2xl shadow-xl shadow-[#087CF4]/30 hover:scale-105 transition-all">
                <Stethoscope className="w-5 h-5 ml-2" />
                تجربة لوحة تحكم الطبيب
              </Button>
            </Link>

            <Link href="/clinic/demo">
              <Button variant="outline" className="h-14 px-8 text-base font-bold border-[#E5EAF0] dark:border-[#254565] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl bg-white dark:bg-[#0E2342] shadow-xs hover:scale-105 transition-all">
                <Calendar className="w-5 h-5 ml-2 text-[#087CF4]" />
                تجربة حجز مريض ومتابعة الدور
              </Button>
            </Link>
          </div>
        </div>

        {/* 6 Feature Pillars */}
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
                className="medical-card p-5 flex flex-col items-center justify-center text-center space-y-2.5 bg-white dark:bg-[#0E2342] border border-[#E5EAF0] dark:border-[#254565] rounded-2xl hover:border-[#087CF4]/40 transition-all hover:scale-102"
              >
                <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-[#087CF4] flex items-center justify-center">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="font-black text-xs text-[#182230] dark:text-[#F3FAFF]">{pillar.title}</h3>
                <p className="text-[10px] text-slate-400 font-semibold">{pillar.desc}</p>
              </div>
            )
          })}
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-[#E5EAF0] dark:border-[#1E3A5F] bg-white dark:bg-[#0B1F33] py-6 px-6 text-center text-xs text-slate-400">
        جميع الحقوق محفوظة YallaCodeX 2026
      </footer>
    </div>
  )
}
