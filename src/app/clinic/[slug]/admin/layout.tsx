'use client'
import { DynamicTheme } from '@/components/DynamicTheme'
import { use, useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  FileText, Users, DollarSign, Calendar, Settings, Bot,
  LogOut, Receipt, Pill, Bell, Search, ExternalLink, Menu,
  X, CheckCircle, ChevronLeft, User, Building2, Sparkles, Clock, Crown
} from 'lucide-react'
import { db, auth } from '@/lib/firebase'
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { ClinicLogo } from '@/components/clinic/ClinicLogo'
import { ClinicLoading } from '@/components/clinic/ClinicLoading'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { BranchSelector } from '@/components/clinic/BranchSelector'
import { NotificationCenter } from '@/components/clinic/NotificationCenter'
import { TechnicalSupportButton } from '@/components/clinic/TechnicalSupportButton'
import { SubscriptionUpgradeModal } from '@/components/clinic/SubscriptionUpgradeModal'
import { isClinicFeatureEnabled, LockedFeatureScreen, FeatureKey } from '@/lib/featurePermissions'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { LanguageToggle } from '@/components/common/LanguageToggle'
import { useLanguage } from '@/context/LanguageContext'

export default function AdminLayout({
  children,
  params
}: {
  children: React.ReactNode,
  params: Promise<{ slug: string }>
}) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug
  const pathname = usePathname()
  const { t, language, dir, isRtl } = useLanguage()
  const [role, setRole] = useState<string | null>(null)
  const [sessionVerified, setSessionVerified] = useState(false)
  const [clinic, setClinic] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all')
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [packages, setPackages] = useState<any[]>([])
  // Default to false so packages / upgrade buttons never flash during load if hidden by owner
  const [showPackagesInClinics, setShowPackagesInClinics] = useState<boolean>(false)

  useEffect(() => {
    const saved = localStorage.getItem('clinic_selected_branch') || 'all'
    setSelectedBranchId(saved)

    const unsubPackages = onSnapshot(collection(db, 'packages'), (snap) => {
      setPackages(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })

    // Listen to unified public system/platformSettings first, fallback to platformSettings/main
    const unsubSettings = onSnapshot(
      doc(db, 'system', 'platformSettings'),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data()
          if (typeof data.showPackagesInClinics === 'boolean') {
            setShowPackagesInClinics(data.showPackagesInClinics)
            if (!data.showPackagesInClinics) {
              setShowUpgradeModal(false)
            }
          }
        }
      },
      () => {
        // Fallback listener
        onSnapshot(doc(db, 'platformSettings', 'main'), (fallbackSnap) => {
          if (fallbackSnap.exists()) {
            const data = fallbackSnap.data()
            if (typeof data.showPackagesInClinics === 'boolean') {
              setShowPackagesInClinics(data.showPackagesInClinics)
              if (!data.showPackagesInClinics) {
                setShowUpgradeModal(false)
              }
            }
          }
        }, () => {})
      }
    )

    return () => {
      unsubPackages()
      unsubSettings()
    }
  }, [])

  useEffect(() => {
    const handleOpenModal = () => {
      if (showPackagesInClinics) {
        setShowUpgradeModal(true)
      } else {
        setShowUpgradeModal(false)
      }
    }
    window.addEventListener('open_upgrade_modal', handleOpenModal)
    return () => window.removeEventListener('open_upgrade_modal', handleOpenModal)
  }, [showPackagesInClinics])

  const handleSelectBranch = (bId: string) => {
    // If assistant is locked to a specific branch, never permit switching
    const locked = typeof window !== 'undefined' ? localStorage.getItem('clinic_locked_branch') : null
    if (role === 'assistant' && locked) {
      bId = locked
    }
    setSelectedBranchId(bId)
    localStorage.setItem('clinic_selected_branch', bId)
    window.dispatchEvent(new CustomEvent('clinic_branch_changed', { detail: { branchId: bId } }))
  }

  useEffect(() => {
    const storedRole = localStorage.getItem('clinic_role') || 'doctor'
    setRole(storedRole)
    const locked = localStorage.getItem('clinic_locked_branch')
    if (storedRole === 'assistant' && locked) {
      setSelectedBranchId(locked)
      localStorage.setItem('clinic_selected_branch', locked)
    }

    // Block assistant from directly opening branches management page
    if (storedRole === 'assistant' && pathname.includes('/admin/branches')) {
      window.location.href = `/clinic/${slug}/admin`
      return
    }

    // Verify session token with server
    const token = localStorage.getItem('clinic_session_token')
    if (token) {
      fetch('/api/auth/session', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
        .then(res => res.json())
        .then(data => {
          if (data.authenticated && data.user?.role) {
            setRole(data.user.role)
            localStorage.setItem('clinic_role', data.user.role)
            if (data.user.role === 'assistant' && data.user.branchId) {
              setSelectedBranchId(data.user.branchId)
              localStorage.setItem('clinic_selected_branch', data.user.branchId)
              localStorage.setItem('clinic_locked_branch', data.user.branchId)
              if (data.user.branchName) {
                localStorage.setItem('clinic_locked_branch_name', data.user.branchName)
              }
            }
          }
        })
        .catch((error) => {
          console.error('Could not verify clinic session:', error)
        })
        .finally(() => setSessionVerified(true))
    } else {
      setSessionVerified(true)
    }

    const q = query(collection(db, 'clinics'), where('slug', '==', slug))
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const clinicData = snapshot.docs[0].data();
          if (clinicData.isActive === false || (clinicData.expirationDate && new Date(clinicData.expirationDate) < new Date())) {
            window.location.href = `/clinic/${slug}/login?error=subscription_ended`;
            return;
          }
          setClinic({ id: snapshot.docs[0].id, ...clinicData });
        } else if (slug === 'demo') {
          setClinic({
            clinicName: 'عيادة الأمل التخصصية',
            doctorName: 'أحمد محمود',
            specialty: 'استشاري جراحة العظام والمفاصل',
            primaryColor: '#087CF4',
            aiEnabled: true,
            assistantPermissions: ['appointments']
          })
        }
        setLoading(false)
      },
      (err) => {
        console.error(err)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [slug])

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileDrawerOpen(false)
  }, [pathname])

  const handleLogout = async () => {
    await signOut(auth)
    localStorage.removeItem('clinic_role')
    localStorage.removeItem('clinic_session_token')
    await fetch('/api/auth/session', { method: 'DELETE' }).catch(() => {})
    window.location.href = `/clinic/${slug}/login`
  }

  // Calculate days until expiration with sanitization for 5-digit years (e.g. 20266 -> 2026)
  const daysUntilExpiration = useMemo(() => {
    if (!clinic?.expirationDate) return null
    let expStr = String(clinic.expirationDate).trim()
    if (expStr.length > 10 && expStr.startsWith('20266')) {
      expStr = expStr.replace('20266', '2026')
    }
    const expTime = new Date(expStr).getTime()
    if (isNaN(expTime)) return null
    return Math.ceil((expTime - Date.now()) / (1000 * 3600 * 24))
  }, [clinic?.expirationDate])

  const localizedDate = useMemo(() => {
    try {
      const locale = language === 'ar' ? 'ar-EG' : 'en-US'
      return new Intl.DateTimeFormat(locale, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }).format(new Date())
    } catch (e) {
      return new Date().toLocaleDateString()
    }
  }, [language])

  const assistantPermissions = clinic?.assistantPermissions || ['appointments']
  const primaryColor = clinic?.primaryColor || '#087CF4'

  const navItems = [
    {
      id: 'appointments',
      name: t('nav_queue', 'لوحة اليوم'),
      href: `/clinic/${slug}/admin`,
      icon: Calendar,
      badge: t('live', 'مباشر')
    },
    {
      id: 'patients',
      name: t('nav_patients', 'سجل المرضى'),
      href: `/clinic/${slug}/admin/patients`,
      icon: Users
    },
    {
      id: 'prescriptions',
      name: t('nav_prescriptions', 'الروشتات الطبية'),
      href: `/clinic/${slug}/admin/prescriptions`,
      icon: FileText
    },
    {
      id: 'drugs',
      name: t('nav_drugs', 'دليل الأدوية'),
      href: `/clinic/${slug}/admin/drugs`,
      icon: Pill
    },
    {
      id: 'accounts',
      name: t('nav_accounts', 'الحسابات'),
      href: `/clinic/${slug}/admin/accounts`,
      icon: Receipt
    },
    {
      id: 'finance',
      name: t('nav_finance', 'التقارير المالية'),
      href: `/clinic/${slug}/admin/finance`,
      icon: DollarSign
    },
    {
      id: 'ai-training',
      name: t('nav_ai_training', 'المساعد الذكي'),
      href: `/clinic/${slug}/admin/ai-training`,
      icon: Bot
    },
    {
      id: 'branches',
      name: t('nav_branches', 'إدارة الفروع'),
      href: `/clinic/${slug}/admin/branches`,
      icon: Building2
    },
    ...(showPackagesInClinics ? [{
      id: 'packages',
      name: t('nav_packages', 'الباقات والاشتراك'),
      href: '#packages',
      icon: Crown,
      isAction: true,
      onClick: () => setShowUpgradeModal(true)
    }] : []),
    {
      id: 'settings',
      name: t('nav_settings', 'الإعدادات'),
      href: `/clinic/${slug}/admin/settings`,
      icon: Settings
    },
  ]

  // Find the active package for this clinic
  const activePackage = useMemo(() => {
    if (!clinic?.packageName) return null
    return packages.find(p => (clinic?.packageId && p.id === clinic.packageId) || p.name === clinic?.packageName) || clinic?.packageData || null
  }, [clinic?.packageName, packages])

  // Check feature permissions for this clinic
  const isFinanceEnabled = useMemo(() => isClinicFeatureEnabled(clinic, 'finance', activePackage), [clinic, activePackage])
  const isDrugsEnabled = useMemo(() => isClinicFeatureEnabled(clinic, 'drugs', activePackage), [clinic, activePackage])
  const isPrescriptionsEnabled = useMemo(() => isClinicFeatureEnabled(clinic, 'prescriptions', activePackage), [clinic, activePackage])
  const isAiEnabled = useMemo(() => isClinicFeatureEnabled(clinic, 'ai', activePackage), [clinic, activePackage])
  const isBranchesEnabled = useMemo(() => isClinicFeatureEnabled(clinic, 'branches', activePackage), [clinic, activePackage])

  // Route-level lock detector
  const currentLockedFeature = useMemo<FeatureKey | null>(() => {
    if (!clinic) return null
    if (pathname.includes('/admin/accounts') || pathname.includes('/admin/finance')) {
      if (!isFinanceEnabled) return 'finance'
    }
    if (pathname.includes('/admin/drugs')) {
      if (!isDrugsEnabled) return 'drugs'
    }
    if (pathname.includes('/admin/prescriptions')) {
      if (!isPrescriptionsEnabled) return 'prescriptions'
    }
    if (pathname.includes('/admin/branches')) {
      if (!isBranchesEnabled) return 'branches'
    }
    if (pathname.includes('/admin/ai-training')) {
      if (!isAiEnabled) return 'ai'
    }
    return null
  }, [pathname, clinic, isFinanceEnabled, isDrugsEnabled, isPrescriptionsEnabled, isBranchesEnabled, isAiEnabled])

  // Filter based on role, assistant permissions, and package feature locks
  const filteredNav = navItems.filter(item => {
    if ((item.id === 'accounts' || item.id === 'finance') && !isFinanceEnabled) return false
    if (item.id === 'drugs' && !isDrugsEnabled) return false
    if (item.id === 'prescriptions' && !isPrescriptionsEnabled) return false
    if (item.id === 'ai-training' && !isAiEnabled) return false
    if (item.id === 'branches' && !isBranchesEnabled) return false
    if (item.id === 'packages' && showPackagesInClinics === false) return false

    if (role === 'doctor') return true
    if (role === 'assistant') {
      if (item.id === 'packages' || item.id === 'branches') return false
      return assistantPermissions.includes(item.id)
    }
    return false
  })

  // Quick bottom nav shortcuts for mobile
  const bottomNavItems = [
    { id: 'dashboard', name: t('nav_queue', 'الرئيسية'), href: `/clinic/${slug}/admin`, icon: Calendar },
    ...(role === 'doctor' || assistantPermissions.includes('patients')
      ? [{ id: 'patients', name: t('nav_patients', 'المرضى'), href: `/clinic/${slug}/admin/patients`, icon: Users }]
      : []),
    ...(isPrescriptionsEnabled && (role === 'doctor' || assistantPermissions.includes('prescriptions'))
      ? [{ id: 'prescriptions', name: t('nav_prescriptions', 'الروشتات'), href: `/clinic/${slug}/admin/prescriptions`, icon: FileText }]
      : []),
    ...(isFinanceEnabled && (role === 'doctor' || assistantPermissions.includes('accounts') || assistantPermissions.includes('finance'))
      ? [{ id: 'accounts', name: t('nav_accounts', 'الحسابات'), href: `/clinic/${slug}/admin/accounts`, icon: Receipt }]
      : []),
    { id: 'more', name: t('actions', 'المزيد'), icon: Menu, isAction: true },
  ]

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    window.location.href = `/clinic/${slug}/admin/patients?search=${encodeURIComponent(searchQuery)}`
  }

  if (loading) {
    return <ClinicLoading fullScreen size="lg" label={t('loading', 'جاري تحميل نظام العيادة...')} />
  }

  return (
    <div className="flex h-screen bg-background font-sans overflow-hidden text-foreground print:block print:h-auto print:overflow-visible print:bg-white transition-colors duration-200" dir={dir}>
      <DynamicTheme color={primaryColor} />
      <style dangerouslySetInnerHTML={{ __html: `:root { --primary: ${primaryColor}; }` }} />

      {/* =========================================================================
          1. DESKTOP SIDEBAR (Theme-Aware: Clean White in Light / Deep Navy in Dark)
         ========================================================================= */}
      <aside className="w-68 bg-white/80 dark:bg-[#081226]/90 backdrop-blur-2xl text-sidebar-foreground hidden lg:flex flex-col border-e border-sidebar-border/80 dark:border-white/10 relative z-30 shrink-0 select-none shadow-xl print:hidden transition-colors duration-200">
        {/* Brand Header */}
        <div className="p-4 border-b border-sidebar-border/80 dark:border-white/10 bg-sidebar/50 backdrop-blur-sm">
          <Link href={`/clinic/${slug}/admin`} className="flex items-center gap-3">
            <ClinicLogo size="md" variant="auto" />
          </Link>

          {/* Doctor Profile Mini Card */}
          <div className="mt-3 p-3 rounded-2xl bg-secondary/50 dark:bg-[#0E2342]/70 border border-sidebar-border/80 dark:border-white/10 shadow-sm backdrop-blur-md transition-colors">
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10 rounded-2xl border-2 border-primary/40 shadow-sm shrink-0">
                <AvatarImage src={clinic?.heroImage} alt="Doctor" className="object-cover rounded-2xl" />
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm rounded-2xl">
                  <User className="w-5 h-5" />
                </AvatarFallback>
              </Avatar>
              <div className="overflow-hidden flex-1 text-start">
                <h3 className="font-bold text-xs text-foreground truncate">
                  {clinic?.doctorName ? `د. ${clinic.doctorName}` : (clinic?.clinicName || 'العيادة الطبية')}
                </h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-[10px] text-muted-foreground font-medium truncate">
                    {role === 'assistant' ? t('assistant', 'مساعد العيادة') : t('certified_doctor', 'طبيب معتمد')}
                  </span>
                </div>
              </div>
            </div>

            {/* Upgrade Account Button right under the doctor's name */}
            {showPackagesInClinics && (
              <button
                type="button"
                onClick={() => setShowUpgradeModal(true)}
                className="mt-2.5 w-full py-1.5 px-2.5 rounded-xl bg-gradient-to-r from-primary/15 via-primary/10 to-primary/5 hover:from-primary/20 hover:to-primary/10 border border-primary/25 text-primary flex items-center justify-between text-xs font-bold transition-all cursor-pointer shadow-2xs group active:scale-95"
              >
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary group-hover:rotate-12 transition-transform" />
                  {t('upgrade_account', 'ترقية الحساب / الباقات')}
                </span>
                <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-mono font-bold">
                  {clinic?.packageName || 'الأساسية'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1.5 py-3">
          {filteredNav.map((item) => {
            const Icon = item.icon
            const isActive = item.href ? pathname === item.href : false

            if ((item as any).isAction) {
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={(item as any).onClick}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all duration-200 cursor-pointer text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 font-bold active:scale-98 border border-amber-500/25 shadow-xs group"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4.5 h-4.5 text-amber-500 group-hover:scale-110 transition-transform" />
                    <span className="text-xs tracking-wide">{item.name}</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    {clinic?.packageName || t('upgrade', 'ترقية')}
                  </span>
                </button>
              )
            }

            return (
              <Link key={item.href} href={item.href} prefetch={true}>
                <div
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-[#0066FF] text-white font-bold shadow-[0_4px_20px_rgba(0,102,255,0.45)] border border-white/20 active:scale-95'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/70 dark:hover:bg-white/5 font-semibold active:scale-98'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4.5 h-4.5 ${isActive ? 'text-white' : 'text-primary/70 dark:text-muted-foreground'}`} />
                    <span className="text-xs tracking-wide">{item.name}</span>
                  </div>
                  {item.badge && !isActive && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      {item.badge}
                    </span>
                  )}
                </div>
              </Link>
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
          <TechnicalSupportButton variant="block" className="bg-secondary/60 dark:bg-[#0E2342]/70 text-foreground border-sidebar-border/80 dark:border-white/10 hover:bg-secondary hover:text-foreground rounded-xl" />
          {sessionVerified && role !== 'doctor' && <Link
            href={`/clinic/${slug}`}
            target="_blank"
            className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:text-primary hover:bg-secondary/70 dark:hover:bg-white/5 transition-colors"
          >
            <span className="flex items-center gap-2">
              <ExternalLink className="w-3.5 h-3.5 text-primary" />
              {t('patient_booking_page', 'صفحة الحجز للمرضى')}
            </span>
            <ChevronLeft className="w-3.5 h-3.5 rtl:rotate-0 ltr:rotate-180" />
          </Link>}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            {t('logout', 'تسجيل الخروج')}
          </button>
          <div className="pt-1.5 text-center text-[10px] text-muted-foreground/80 font-medium border-t border-sidebar-border/80 dark:border-white/10">
            {t('copyright_notice', 'جميع الحقوق محفوظة YallaCodeX 2026')}
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
            className={`fixed inset-y-0 ${isRtl ? 'right-0 border-l' : 'left-0 border-r'} w-72 bg-sidebar text-sidebar-foreground shadow-2xl flex flex-col z-50 p-4 border-sidebar-border`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-sidebar-border">
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

            {/* Mobile Doctor Profile */}
            <div className="mt-3 p-2.5 rounded-2xl bg-secondary/60 dark:bg-card-elevated border border-sidebar-border">
              <div className="flex items-center gap-2.5">
                <Avatar className="w-9 h-9 border border-primary/30 shadow-2xs shrink-0">
                  <AvatarImage src={clinic?.heroImage} alt="Doctor" className="object-cover" />
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                    <User className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="overflow-hidden flex-1 text-start">
                  <h3 className="font-bold text-xs text-foreground truncate">
                    {clinic?.doctorName ? `د. ${clinic.doctorName}` : (clinic?.clinicName || 'العيادة الطبية')}
                  </h3>
                  <span className="text-[10px] text-muted-foreground font-medium block truncate">
                    {role === 'assistant' ? t('assistant', 'مساعد العيادة') : t('certified_doctor', 'طبيب معتمد')}
                  </span>
                </div>
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto py-3 space-y-1">
              {filteredNav.map((item) => {
                const Icon = item.icon
                const isActive = item.href ? pathname === item.href : false

                if ((item as any).isAction) {
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setMobileDrawerOpen(false)
                        if ((item as any).onClick) (item as any).onClick()
                      }}
                      className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/25 font-bold cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-4.5 h-4.5 text-amber-500" />
                        <span className="text-xs font-bold">{item.name}</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20">
                        {clinic?.packageName || t('upgrade', 'ترقية')}
                      </span>
                    </button>
                  )
                }

                return (
                  <Link key={item.href} href={item.href} prefetch={true}>
                    <div
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all ${
                        isActive
                          ? 'yalla-gradient-btn font-bold shadow-md shadow-primary/25'
                          : 'text-muted-foreground hover:text-foreground hover:bg-secondary/70 dark:hover:bg-card-elevated'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-4.5 h-4.5" />
                        <span className="text-xs font-bold">{item.name}</span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </nav>

            <div className="pt-3 border-t border-sidebar-border space-y-2">
              <TechnicalSupportButton variant="block" className="bg-secondary/60 dark:bg-card-elevated text-foreground border-sidebar-border hover:bg-secondary" />
              {sessionVerified && role !== 'doctor' && <Link
                href={`/clinic/${slug}`}
                target="_blank"
                className="flex items-center justify-between px-3 py-2 text-xs font-bold text-primary bg-secondary/80 dark:bg-card-elevated rounded-xl border border-sidebar-border"
              >
                <span className="flex items-center gap-2">
                  <ExternalLink className="w-3.5 h-3.5" /> {t('patient_booking_page', 'صفحة حجز المرضى')}
                </span>
              </Link>}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-destructive hover:bg-destructive/10 rounded-xl"
              >
                <LogOut className="w-3.5 h-3.5" /> {t('logout', 'تسجيل الخروج')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          3. MAIN WORKSPACE AREA & TOPBAR
         ========================================================================= */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden print:h-auto print:overflow-visible print:block relative">
        {/* Subtle Ambient Background Orbs for Glassmorphism Depth */}
        <div className="fixed top-10 right-60 w-96 h-96 bg-primary/10 dark:bg-primary/20 rounded-full blur-[100px] pointer-events-none z-0 transform-gpu will-change-transform" />
        <div className="fixed bottom-10 left-20 w-96 h-96 bg-cyan-500/10 dark:bg-cyan-500/15 rounded-full blur-[120px] pointer-events-none z-0 transform-gpu will-change-transform" />

        {/* Sticky Topbar */}
        <header className="h-16 bg-card/80 backdrop-blur-md border-b border-border/80 px-4 md:px-8 flex items-center justify-between gap-4 z-20 shrink-0 print:hidden transition-colors duration-200">
          {/* Start side: Mobile Menu Button & Search */}
          <div className="flex items-center gap-3 flex-1 max-w-lg">
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="lg:hidden p-2 rounded-xl border border-border text-foreground hover:bg-secondary focus:outline-none"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Quick Search */}
            <form onSubmit={handleGlobalSearch} className="relative w-full max-w-md hidden sm:block">
              <Search className={`w-4 h-4 absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-muted-foreground`} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('search_patient_placeholder', 'ابحث عن مريض بالاسم أو رقم الهاتف...')}
                className={`w-full h-10 ${isRtl ? 'pr-9 pl-4' : 'pl-9 pr-4'} rounded-xl bg-secondary/50 hover:bg-secondary/70 focus:bg-background border border-border/70 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all`}
              />
            </form>
          </div>

          {/* End side: Date, Branch, Language, Theme, Notifications, Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Branch Selector */}
            {isBranchesEnabled && (
              <BranchSelector
              clinic={clinic}
              selectedBranchId={selectedBranchId}
              onSelectBranch={handleSelectBranch}
              role={role}
              lockedBranchId={role === 'assistant' ? (typeof window !== 'undefined' ? localStorage.getItem('clinic_locked_branch') : null) : null}
              />
            )}

            {/* Realtime Date Badge */}
            <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-background border border-border text-xs font-bold text-muted-foreground">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span>{localizedDate}</span>
            </div>

            {/* Language Toggle (AR / EN) */}
            <LanguageToggle />

            {/* Theme Toggle (Dark / Light) */}
            <ThemeToggle />

            {/* Link to Patient Page */}
            {sessionVerified && role !== 'doctor' && <Link
              href={`/clinic/${slug}`}
              target="_blank"
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-primary bg-secondary border border-primary/20 hover:bg-primary hover:text-white transition-all shadow-2xs"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {t('booking_page', 'صفحة الحجز')}
            </Link>}

            {/* Notification Center */}
            <NotificationCenter
              clinic={clinic}
              clinicId={clinic?.id}
              slug={slug}
              recipientTarget={clinic?.id || slug}
              recipientLabel={role === 'assistant' ? 'مساعد العيادة' : 'إدارة العيادة'}
              recipientType="staff"
              branchId={selectedBranchId !== 'all' ? selectedBranchId : undefined}
            />

            {/* User Avatar & Info */}
            <div className="flex items-center gap-2.5 ps-1">
              <Avatar className="w-9 h-9 border border-border">
                <AvatarImage src={clinic?.heroImage} alt="User" className="object-cover" />
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                  {clinic?.doctorName?.charAt(0) || 'ط'}
                </AvatarFallback>
              </Avatar>
              <div className="hidden xl:block text-start">
                <p className="text-xs font-bold text-foreground leading-tight">
                  {clinic?.doctorName ? `د. ${clinic.doctorName}` : 'الطبيب المسجل'}
                </p>
                <p className="text-[10px] text-muted-foreground font-mono">/clinic/{slug}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Expiration Notification if needed */}
        {(() => {
          if (!clinic?.expirationDate) return null;
          const days = daysUntilExpiration;
          if (days === null || days > 7) return null;
          if (days >= 0) {
            return (
              <div className="bg-rose-500 text-white p-2.5 text-center text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-xs shrink-0">
                <Bell className="w-4 h-4 animate-bounce shrink-0" />
                <span>تنبيه هام: اشتراك العيادة الخاص بك سينتهي خلال {days} أيام. يرجى تجديد الاشتراك.</span>
              </div>
            );
          }
          return (
            <div className="bg-red-600 text-white p-2.5 text-center text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-xs shrink-0">
              <Bell className="w-4 h-4" />
              تنبيه: لقد انتهى اشتراك العيادة! قد تتوقف بعض الخدمات، يرجى التجديد فوراً.
            </div>
          );
        })()}

        {/* Scrollable Page Body */}
        <main className="flex-1 overflow-y-auto bg-background pb-[calc(5rem+env(safe-area-inset-bottom,0px))] lg:pb-8 relative print:overflow-visible print:bg-white print:p-0">
          {currentLockedFeature ? (
            <LockedFeatureScreen
              featureKey={currentLockedFeature}
              clinic={clinic}
              onRequestUpgrade={showPackagesInClinics ? () => setShowUpgradeModal(true) : undefined}
            />
          ) : (
            children
          )}
        </main>

        {/* Mobile Bottom Nav */}
        <nav 
          className="lg:hidden fixed bottom-0 inset-x-0 bg-card/95 backdrop-blur-md border-t border-border px-3 z-40 flex justify-around items-center shadow-lg print:hidden transition-colors"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 8px) + 6px)', paddingTop: '6px' }}
        >
          {bottomNavItems.map((item: any) => {
            const Icon = item.icon
            const isActive = item.href ? pathname === item.href : false
            
            if (item.isAction) {
              return (
                <button
                  key={item.id}
                  onClick={() => setMobileDrawerOpen(true)}
                  className="flex-1 flex flex-col items-center justify-center py-1 text-muted-foreground hover:text-primary font-medium transition-colors"
                >
                  <Icon className="w-5 h-5 mb-0.5" />
                  <span className="text-[10px] font-bold">{item.name}</span>
                </button>
              )
            }

            return (
              <Link key={item.id} href={item.href || '#'} className="flex-1">
                <div
                  className={`flex flex-col items-center justify-center py-1 transition-all ${
                    isActive ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground font-medium'
                  }`}
                >
                  <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'scale-110' : ''}`} />
                  <span className="text-[10px]">{item.name}</span>
                </div>
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Subscription Upgrade Modal */}
      {showPackagesInClinics && (
        <SubscriptionUpgradeModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          clinic={clinic}
          packages={packages}
        />
      )}
    </div>
  )
}
