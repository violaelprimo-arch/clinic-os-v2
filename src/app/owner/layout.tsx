'use client'

import { ReactNode, useEffect, useState } from 'react'
import { OwnerNavigationContext, type OwnerTab } from '@/components/owner/OwnerNavigationContext'
import { Building, Users, Package, Plus, Bot, Menu, X, Sparkles, UserRound } from 'lucide-react'
import { ClinicLogo } from '@/components/clinic/ClinicLogo'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { auth } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { LanguageToggle } from '@/components/common/LanguageToggle'
import { TechnicalSupportButton } from '@/components/clinic/TechnicalSupportButton'
import { useLanguage } from '@/context/LanguageContext'

export default function OwnerLayout({ children }: { children: ReactNode }) {
  const { dir, isRtl } = useLanguage()
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [activeOwnerTab, setActiveOwnerTab] = useState<OwnerTab>('clinics')
  const [ownerPhotoUrl, setOwnerPhotoUrl] = useState<string | null>(null)

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setOwnerPhotoUrl(user?.photoURL || null)
    })
  }, [])

  const handleSelectTab = (tab: OwnerTab) => {
    setActiveOwnerTab(tab)
    setMobileDrawerOpen(false)
  }

  const navItems = [
    { id: 'clinics', label: isRtl ? 'إدارة العيادات والاشتراكات' : 'Clinics Management', icon: Building },
    { id: 'landing', label: isRtl ? 'الواجهة الرئيسية' : 'Main Landing Page', icon: Sparkles },
    { id: 'doctors', label: isRtl ? 'الأطباء والحجوزات' : 'Doctors & Bookings', icon: Users },
    { id: 'packages', label: isRtl ? 'الباقات والاشتراكات' : 'Packages & Plans', icon: Package },
    { id: 'add', label: isRtl ? 'إضافة عيادة جديدة' : 'Add New Clinic', icon: Plus },
    { id: 'settings', label: isRtl ? 'إعدادات AI المركزية' : 'AI Global Key', icon: Bot },
  ]

  return (
    <OwnerNavigationContext.Provider value={{ activeTab: activeOwnerTab, setActiveTab: setActiveOwnerTab }}>
    <div className="flex h-screen bg-background font-sans overflow-hidden text-foreground transition-colors duration-200" dir={dir}>

      {/* Ambient background glows for authentic glassmorphism */}
      <div className="fixed top-20 -right-20 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="fixed bottom-10 -left-20 w-80 h-80 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none -z-10" />

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-72 flex-col border-e border-border/50 bg-card/60 backdrop-blur-xl z-20 shadow-lg">
        
        {/* Brand Header */}
        <div className="p-6 border-b border-border/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ClinicLogo size="md" />
            <div>
              <span className="font-bold text-lg text-foreground tracking-tight flex items-center gap-1.5">
                Clinic OS <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary font-medium border border-primary/20">V2</span>
              </span>
              <p className="text-xs text-muted-foreground">
                {isRtl ? 'لوحة تحكم المالِك' : 'Super Admin Portal'}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 py-6 px-4 space-y-1.5 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            {isRtl ? 'القائمة الرئيسية' : 'Main Menu'}
          </div>

          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeOwnerTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => handleSelectTab(item.id as OwnerTab)}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl font-medium text-sm transition-all duration-200 text-start group ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
              >
                <Icon className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${
                  isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-primary'
                }`} />
                <span className="flex-1">{item.label}</span>
                {isActive && (
                  <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground animate-pulse" />
                )}
              </button>
            )
          })}
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-border/40 space-y-3 bg-muted/20">
          <div className="flex items-center justify-between px-2">
            <span className="text-xs font-medium text-muted-foreground">{isRtl ? 'المظهر واللغة' : 'Appearance'}</span>
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <LanguageToggle />
            </div>
          </div>

          <div className="pt-2 border-t border-border/30 flex items-center gap-3 px-2">
            <Avatar className="h-10 w-10 border-2 border-primary/25 bg-gradient-to-br from-primary/15 to-cyan-500/15 shadow-sm">
              <AvatarImage
                src={ownerPhotoUrl || undefined}
                alt={isRtl ? 'صورة مالك المنصة' : 'Platform owner profile'}
                referrerPolicy="no-referrer"
                className="object-cover object-center"
              />
              <AvatarFallback className="bg-transparent text-primary">
                <UserRound className="h-5 w-5" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-semibold text-foreground truncate">
                {isRtl ? 'المالك العام' : 'Super Admin'}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                yallacodex@gmail.com
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Container */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 border-b border-border/50 bg-card/70 backdrop-blur-md z-30">
          <div className="flex items-center gap-2">
            <ClinicLogo size="sm" />
            <span className="font-bold text-base text-foreground">Clinic OS Admin</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LanguageToggle />
            <button
              onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
              className="p-2 rounded-lg bg-muted/60 text-foreground"
            >
              {mobileDrawerOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </header>

        {/* Mobile Nav Drawer */}
        {mobileDrawerOpen && (
          <div className="md:hidden fixed inset-0 top-[65px] bg-background/95 backdrop-blur-xl z-40 p-6 flex flex-col justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                {isRtl ? 'تنقل اللوحة' : 'Navigation'}
              </p>
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = activeOwnerTab === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectTab(item.id as OwnerTab)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl font-medium text-base text-start ${
                      isActive
                        ? 'bg-primary text-primary-foreground font-semibold'
                        : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </div>

            <div className="pt-4 border-t border-border/40 text-center text-xs text-muted-foreground">
              Clinic OS v2 Owner Dashboard
            </div>
          </div>
        )}

        {/* Dynamic Page Content */}
        <main className="min-w-0 flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 xl:p-8 bg-gradient-to-b from-background via-background/95 to-muted/20">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>

      <TechnicalSupportButton />
    </div>
    </OwnerNavigationContext.Provider>
  )
}
