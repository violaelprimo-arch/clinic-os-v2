'use client'

import { ReactNode, useState } from 'react'
import { OwnerNavigationContext, type OwnerTab } from '@/components/owner/OwnerNavigationContext'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Phone, MessageSquare, ShieldCheck, Building, Users,
  Package, Plus, Bot, Download, Menu, X, ChevronLeft,
  Sparkles, ExternalLink, RefreshCw
} from 'lucide-react'
import { ClinicLogo } from '@/components/clinic/ClinicLogo'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { LanguageToggle } from '@/components/common/LanguageToggle'
import { TechnicalSupportButton } from '@/components/clinic/TechnicalSupportButton'
import { useLanguage } from '@/context/LanguageContext'

export default function OwnerLayout({ children }: { children: ReactNode }) {
  const { dir, t, isRtl, language } = useLanguage()
  const pathname = usePathname()
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [activeOwnerTab, setActiveOwnerTab] = useState<OwnerTab>('clinics')

  const handleSelectTab = (tab: 'clinics' | 'doctors' | 'packages' | 'add' | 'settings' | 'landing') => {
    setActiveOwnerTab(tab)
    setMobileDrawerOpen(false)
  }

  const navItems = [
    { id: 'landing', label: isRtl ? 'الواجهة الرئيسية' : 'Landing page', icon: Sparkles },
    { id: 'clinics', label: isRtl ? 'إدارة العيادات والنظام' : 'Clinics Management', icon: Building },
    { id: 'doctors', label: isRtl ? 'حسابات الأطباء والمواعيد' : 'Doctors & Bookings', icon: Users },
    { id: 'packages', label: isRtl ? 'الباقات والاشتراكات' : 'Packages & Plans', icon: Package },
    { id: 'add', label: isRtl ? 'إضافة عيادة جديدة' : 'Add New Clinic', icon: Plus },
    { id: 'settings', label: isRtl ? 'مفتاح AI المركزي' : 'AI Global Key', icon: Bot },
  ]

  return (
    <OwnerNavigationContext.Provider value={{ activeTab: activeOwnerTab, setActiveTab: setActiveOwnerTab }}>
    <div className="flex h-screen bg-background font-sans overflow-hidden text-foreground transition-colors duration-200" dir={dir}>
      
      {/* Ambient background glows for authentic glassmorphism */}
      <div className="fixed top-20 -right-20 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="fixed bottom-10 -left-20 w-80 h-80 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none -z-10" />

      {/* =========================================================================
          1. DESKTOP SUPER ADMIN SIDEBAR (Wireframe Bottom-Left Match)
         ========================================================================= */}
      <aside className="w-68 bg-white/80 dark:bg-[#081226]/90 backdrop-blur-2xl text-sidebar-foreground hidden lg:flex flex-col border-e border-sidebar-border/80 dark:border-white/10 relative z-30 shrink-0 select-none shadow-xl transition-colors duration-200">
        
        {/* Brand Header */}
        <div className="p-4 border-b border-sidebar-border/80 dark:border-white/10 bg-sidebar/50 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <ClinicLogo size="md" variant="auto" />
          </div>

          {/* Super Admin Mini Profile Card */}
          <div className="mt-3 p-3 rounded-2xl bg-secondary/50 dark:bg-[#0E2342]/70 border border-sidebar-border/80 dark:border-white/10 shadow-sm backdrop-blur-md transition-colors">
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10 rounded-2xl border-2 border-primary/40 shadow-sm shrink-0">
                <AvatarFallback className="bg-primary/15 text-primary font-bold text-sm rounded-2xl">
                  <ShieldCheck className="w-5 h-5" />
                </AvatarFallback>
              </Avatar>
              <div className="overflow-hidden flex-1 text-start">
                <h3 className="font-bold text-xs text-foreground truncate">
                  {isRtl ? 'مالك المنصة' : 'Super Admin'}
                </h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-[10px] text-muted-foreground font-medium truncate">
                    yallacodex@gmail.com
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-2.5 pt-2 border-t border-border/60 flex items-center justify-between text-[11px] font-mono">
              <span className="text-muted-foreground">{isRtl ? 'الهاتف:' : 'Phone:'}</span>
              <a href="tel:01551007018" className="text-primary font-bold hover:underline">01551007018</a>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1.5 py-3">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeOwnerTab === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectTab(item.id as any)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-[#0066FF] text-white font-bold shadow-[0_4px_20px_rgba(0,102,255,0.45)] border border-white/20 active:scale-95'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/70 dark:hover:bg-white/5 font-semibold active:scale-98'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4.5 h-4.5 ${isActive ? 'text-white' : 'text-primary/70 dark:text-muted-foreground'}`} />
                  <span className="text-xs tracking-wide">{item.label}</span>
                </div>
                {isActive && <ChevronLeft className={`w-3.5 h-3.5 ${isRtl ? '' : 'rotate-180'} text-white/80`} />}
              </button>
            )
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-sidebar-border/80 dark:border-white/10 bg-sidebar/50 space-y-2">
          <div className="flex items-center justify-between px-2 py-1.5 rounded-xl bg-secondary/50 dark:bg-[#0E2342]/70 border border-sidebar-border/80 dark:border-white/10">
            <span className="text-[10px] font-bold text-muted-foreground">{language === 'ar' ? 'المظهر واللغة:' : 'Theme & Lang:'}</span>
            <div className="flex items-center gap-1.5">
              <LanguageToggle variant="icon" />
              <ThemeToggle />
            </div>
          </div>

          <a
            href="https://wa.me/201551007018"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5" />
              {isRtl ? 'واتساب الدعم الفني' : 'WhatsApp Support'}
            </span>
            <span className="text-[10px] font-mono">01551007018</span>
          </a>

          <div className="pt-1.5 text-center text-[10px] text-muted-foreground/80 font-medium border-t border-sidebar-border/80 dark:border-white/10">
            {t('copyright_text', 'جميع الحقوق محفوظة YallaCodeX 2026')}
          </div>
        </div>
      </aside>

      {/* =========================================================================
          2. MOBILE DRAWER OVERLAY
         ========================================================================= */}
      {mobileDrawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={() => setMobileDrawerOpen(false)}
        >
          <div
            className={`fixed inset-y-0 ${isRtl ? 'right-0 border-l' : 'left-0 border-r'} w-72 bg-card text-foreground shadow-2xl flex flex-col z-50 p-4 border-border`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <ClinicLogo size="md" variant="auto" />
              <div className="flex items-center gap-1.5">
                <LanguageToggle variant="icon" />
                <ThemeToggle />
                <button
                  onClick={() => setMobileDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto space-y-1.5 py-4">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = activeOwnerTab === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectTab(item.id as any)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#0066FF] text-white font-bold shadow-md'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4.5 h-4.5" />
                      <span className="text-xs">{item.label}</span>
                    </div>
                  </button>
                )
              })}
            </nav>

            <div className="pt-3 border-t border-border space-y-2">
              <a
                href="https://wa.me/201551007018"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 p-2 rounded-xl text-xs font-bold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20"
              >
                <MessageSquare className="w-4 h-4" />
                <span>{isRtl ? 'تواصل مع الدعم الفني' : 'Contact Support'}</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          3. MAIN CONTENT WORKSPACE & TOPBAR
         ========================================================================= */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Mobile Header */}
        <header className="lg:hidden bg-card/90 backdrop-blur-md px-4 py-3 border-b border-border flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="p-2 rounded-xl border border-border text-foreground hover:bg-secondary transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <ClinicLogo size="sm" variant="auto" />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              {t('owner_super_admin')}
            </span>
            <ThemeToggle />
          </div>
        </header>

        {/* Scrollable Main Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

    </div>
    </OwnerNavigationContext.Provider>
  )
}
