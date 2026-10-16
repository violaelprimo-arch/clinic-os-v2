'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ClinicLogo } from '@/components/clinic/ClinicLogo'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { LanguageToggle } from '@/components/common/LanguageToggle'
import { useLanguage } from '@/context/LanguageContext'
import {
  Calendar, Users, FileSignature, Receipt, Database,
  TrendingUp, ShieldCheck, Stethoscope, ArrowLeft,
  CheckCircle2, Smartphone, Monitor, Sparkles
} from 'lucide-react'

export default function Home() {
  const { t, dir } = useLanguage()

  return (
    <div className="min-h-screen bg-background font-sans flex flex-col justify-between text-foreground transition-colors" dir={dir}>
      
      {/* Top Navbar */}
      <header className="border-b border-border bg-card/80 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <ClinicLogo size="md" />
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <LanguageToggle />
          <Link href="/clinic/demo">
            <Button variant="outline" className="h-10 text-xs font-bold border-border text-foreground rounded-xl">
              صفحة العيادة للمرضى
            </Button>
          </Link>
          <Link href="/clinic/demo/login">
            <Button className="h-10 px-5 text-xs font-black yalla-gradient-btn text-white rounded-xl shadow-xs">
              دخول العيادة
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Hero Container */}
      <main className="max-w-6xl mx-auto px-4 py-16 sm:py-24 space-y-12 text-center">
        
        {/* Brand Splash Card */}
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold shadow-xs">
            <Sparkles className="w-3.5 h-3.5" />
            الجيل الجديد لأنظمة العيادات الطبية في مصر والعالم العربي
          </div>

          <div className="space-y-3">
            <h1 className="text-4xl sm:text-6xl font-black text-foreground tracking-tight">
              نظام تشغيل العيادات الذكي
            </h1>
            <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed font-medium">
              منصة سحابية متكاملة لإدارة كشوفات المرضى، الدور اللحظي، الروشتات الإلكترونية، والحسابات المالية بدقة وسرعة فائقة.
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Link href="/clinic/demo/admin">
              <Button className="h-14 px-8 text-base font-black yalla-gradient-btn text-white rounded-2xl shadow-xl hover:scale-105 transition-all">
                <Stethoscope className="w-5 h-5 ml-2" />
                تجربة لوحة تحكم الطبيب والعيادة
              </Button>
            </Link>

            <Link href="/clinic/demo">
              <Button variant="outline" className="h-14 px-8 text-base font-bold border-border text-foreground hover:bg-muted/40 rounded-2xl bg-card shadow-xs hover:scale-105 transition-all">
                <Calendar className="w-5 h-5 ml-2 text-primary" />
                حجز مريض ومتابعة الدور
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
                className="yalla-card p-5 flex flex-col items-center justify-center text-center space-y-2.5 bg-card border border-border rounded-2xl hover:border-primary/40 transition-all hover:scale-102"
              >
                <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="font-black text-xs text-foreground">{pillar.title}</h3>
                <p className="text-[10px] text-muted-foreground font-semibold">{pillar.desc}</p>
              </div>
            )
          })}
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-6 px-6 text-center text-xs text-muted-foreground">
        جميع الحقوق محفوظة YallaCodeX 2026
      </footer>
    </div>
  )
}
