'use client'
import { DynamicTheme } from '@/components/DynamicTheme'
import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  FileText, Users, DollarSign, Calendar, Settings, Bot,
  LogOut, Receipt, Pill, Bell, Search, ExternalLink, Menu,
  X, CheckCircle, ChevronLeft, User
} from 'lucide-react'
import { db, auth } from '@/lib/firebase'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { ClinicLogo } from '@/components/clinic/ClinicLogo'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

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
  const [role, setRole] = useState<string | null>(null)
  const [clinic, setClinic] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const storedRole = localStorage.getItem('clinic_role') || 'doctor'
    setRole(storedRole)

    const q = query(collection(db, 'clinics'), where('slug', '==', slug))
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          setClinic({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() })
        } else if (slug === 'demo') {
          setClinic({
            clinicName: 'العيادة التخصصية',
            doctorName: 'الطبيب',
            specialty: 'استشاري الطب الباطني',
            primaryColor: '#15B8A6',
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
    window.location.href = `/clinic/${slug}`
  }

  // Get current Arabic formatted date
  const daysUntilExpiration = clinic?.expirationDate 
    ? Math.ceil((new Date(clinic.expirationDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24))
    : null;

  const todayArabic = new Intl.DateTimeFormat('ar-EG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date())

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F8FB] flex flex-col items-center justify-center gap-4" dir="rtl">
        <ClinicLogo size="lg" variant="light" />
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
          <div className="w-5 h-5 border-2 border-[#15B8A6] border-t-transparent rounded-full animate-spin"></div>
          جاري تحميل نظام العيادة...
        </div>
      </div>
    )
  }

  const assistantPermissions = clinic?.assistantPermissions || ['appointments']
  const primaryColor = clinic?.primaryColor || '#15B8A6'

  const navItems = [
    {
      id: 'appointments',
      name: 'لوحة اليوم',
      href: `/clinic/${slug}/admin`,
      icon: Calendar,
      badge: 'مباشر'
    },
    {
      id: 'patients',
      name: 'سجل المرضى',
      href: `/clinic/${slug}/admin/patients`,
      icon: Users
    },
    {
      id: 'prescriptions',
      name: 'الروشتات الطبية',
      href: `/clinic/${slug}/admin/prescriptions`,
      icon: FileText
    },
    {
      id: 'drugs',
      name: 'دليل الأدوية',
      href: `/clinic/${slug}/admin/drugs`,
      icon: Pill
    },
    {
      id: 'accounts',
      name: 'الحسابات',
      href: `/clinic/${slug}/admin/accounts`,
      icon: Receipt
    },
    {
      id: 'finance',
      name: 'التقارير المالية',
      href: `/clinic/${slug}/admin/finance`,
      icon: DollarSign
    },
    {
      id: 'ai-training',
      name: 'المساعد الذكي',
      href: `/clinic/${slug}/admin/ai-training`,
      icon: Bot
    },
    {
      id: 'settings',
      name: 'الإعدادات',
      href: `/clinic/${slug}/admin/settings`,
      icon: Settings
    },
  ]

  // Filter based on role and permissions
  const filteredNav = navItems.filter(item => {
    if (item.id === 'ai-training' && (clinic?.aiEnabled === false || clinic?.aiLockedByOwner === true)) return false
    if (role === 'doctor') return true
    if (role === 'assistant') return assistantPermissions.includes(item.id)
    return false
  })

  // Quick bottom nav shortcuts for mobile
  const bottomNavItems = [
    { name: 'الرئيسية', href: `/clinic/${slug}/admin`, icon: Calendar },
    { name: 'المرضى', href: `/clinic/${slug}/admin/patients`, icon: Users },
    { name: 'الروشتات', href: `/clinic/${slug}/admin/prescriptions`, icon: FileText },
    { name: 'الحسابات', href: `/clinic/${slug}/admin/accounts`, icon: Receipt },
    { name: 'المزيد', href: `/clinic/${slug}/admin/settings`, icon: Settings },
  ]

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    window.location.href = `/clinic/${slug}/admin/patients?search=${encodeURIComponent(searchQuery)}`
  }

  return (
    <div className="flex h-screen bg-[#F6F8FB] font-sans overflow-hidden text-[#182230]" dir="rtl">
      {/* Dynamic Primary Color injection */}
      <DynamicTheme color={primaryColor} />
      <style dangerouslySetInnerHTML={{ __html: `:root { --primary: ${primaryColor}; }` }} />

      {/* 1. DESKTOP SIDEBAR */}
      <aside className="w-64 bg-[#0B1F33] text-slate-300 hidden lg:flex flex-col border-l border-[#132B45] relative z-30 shrink-0 select-none shadow-xl">
        {/* Brand Header */}
        <div className="p-5 border-b border-[#132B45] bg-[#081827]/80">
          <Link href={`/clinic/${slug}/admin`} className="flex items-center gap-3">
            <ClinicLogo size="md" variant="dark" />
          </Link>

          {/* Doctor Profile Mini Card */}
          <div className="mt-4 p-3 rounded-xl bg-[#0F243A] border border-[#1E3A5F] flex items-center gap-3">
            <Avatar className="w-10 h-10 border border-[#15B8A6]/40 shadow-sm shrink-0">
              <AvatarImage src={clinic?.heroImage} alt="Doctor" className="object-cover" />
              <AvatarFallback className="bg-[#15B8A6]/20 text-[#15B8A6] font-bold text-sm">
                <User className="w-5 h-5" />
              </AvatarFallback>
            </Avatar>
            <div className="overflow-hidden flex-1">
              <h3 className="font-bold text-sm text-white truncate">
                {clinic?.doctorName ? `د. ${clinic.doctorName}` : (clinic?.clinicName || 'العيادة الطبية')}
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-[11px] text-slate-400 font-medium truncate">
                  {role === 'assistant' ? 'مساعد العيادة' : 'طبيب معتمد'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1.5 py-4">
          {filteredNav.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-[#15B8A6] text-white shadow-md shadow-[#15B8A6]/25 font-bold'
                      : 'text-slate-300 hover:text-white hover:bg-[#132B45] font-medium'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                    <span className="text-sm tracking-wide">{item.name}</span>
                  </div>
                  {item.badge && !isActive && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      {item.badge}
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-[#132B45] bg-[#081827]/80 space-y-2">
          <Link
            href={`/clinic/${slug}`}
            target="_blank"
            className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-[#15B8A6] hover:bg-[#0F243A] transition-colors"
          >
            <span className="flex items-center gap-2">
              <ExternalLink className="w-3.5 h-3.5 text-[#15B8A6]" />
              صفحة الحجز للمرضى
            </span>
            <ChevronLeft className="w-3.5 h-3.5" />
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* 2. MOBILE DRAWER OVERLAY */}
      {mobileDrawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={() => setMobileDrawerOpen(false)}
        >
          <div
            className="fixed inset-y-0 right-0 w-72 bg-[#0B1F33] text-slate-300 shadow-2xl flex flex-col z-50 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-[#132B45]">
              <ClinicLogo size="md" variant="dark" />
              <button
                onClick={() => setMobileDrawerOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto py-4 space-y-1">
              {filteredNav.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <Link key={item.href} href={item.href}>
                    <div
                      className={`flex items-center justify-between px-3.5 py-3 rounded-xl transition-all ${
                        isActive
                          ? 'bg-[#15B8A6] text-white font-bold'
                          : 'text-slate-300 hover:text-white hover:bg-[#132B45]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-5 h-5" />
                        <span className="text-sm font-semibold">{item.name}</span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </nav>

            <div className="pt-4 border-t border-[#132B45] space-y-2">
              <Link
                href={`/clinic/${slug}`}
                target="_blank"
                className="flex items-center justify-between px-3 py-2 text-xs font-bold text-[#15B8A6] bg-[#0F243A] rounded-lg"
              >
                <span className="flex items-center gap-2">
                  <ExternalLink className="w-4 h-4" /> صفحة حجز المرضى
                </span>
              </Link>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-rose-400 hover:bg-rose-500/10 rounded-lg"
              >
                <LogOut className="w-4 h-4" /> تسجيل الخروج
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. MAIN WORKSPACE AREA */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Sticky Topbar */}
        <header className="h-16 bg-white border-b border-[#E5EAF0] px-4 md:px-8 flex items-center justify-between gap-4 z-20 shrink-0">
          {/* Right side: Mobile Menu Button & Search */}
          <div className="flex items-center gap-3 flex-1 max-w-lg">
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="lg:hidden p-2 rounded-xl border border-[#E5EAF0] text-slate-700 hover:bg-slate-50 focus:outline-none"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Quick Search */}
            <form onSubmit={handleGlobalSearch} className="relative w-full max-w-md hidden sm:block">
              <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن مريض بالاسم أو رقم الهاتف..."
                className="w-full h-10 pr-10 pl-4 rounded-xl bg-[#F6F8FB] border border-[#E5EAF0] text-sm text-[#182230] placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#15B8A6]/20 focus:border-[#15B8A6] transition-all"
              />
            </form>
          </div>

          {/* Left side: Date, Clinic Public Link, Notifications, Profile */}
          <div className="flex items-center gap-3 md:gap-5">
            {/* Realtime Date Badge */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#F6F8FB] border border-[#E5EAF0] text-xs font-semibold text-slate-600">
              <Calendar className="w-3.5 h-3.5 text-[#15B8A6]" />
              <span>{todayArabic}</span>
            </div>

            {/* Link to Patient Page */}
            <Link
              href={`/clinic/${slug}`}
              target="_blank"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-[#15B8A6] bg-[#E6FFFA] border border-[#15B8A6]/20 hover:bg-[#15B8A6] hover:text-white transition-all shadow-xs"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              صفحة الحجز
            </Link>

            {/* Notification Bell */}
            <button
              onClick={() => {
                if (clinic?.ownerMessage) {
                  toast.info(clinic.ownerMessage, { duration: 10000 });
                } else {
                  toast.info('لا توجد إشعارات جديدة حالياً');
                }
              }}
              className="relative p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            >
              <Bell className="w-5 h-5" />
              {clinic?.ownerMessage ? (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white animate-pulse"></span>
              ) : (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#15B8A6] ring-2 ring-white"></span>
              )}
            </button>

            {/* User Avatar & Info */}
            <div className="flex items-center gap-2.5 pl-1">
              <Avatar className="w-9 h-9 border border-[#E5EAF0]">
                <AvatarImage src={clinic?.heroImage} alt="User" className="object-cover" />
                <AvatarFallback className="bg-[#E6FFFA] text-[#0D9488] font-bold text-xs">
                  {clinic?.doctorName?.charAt(0) || 'ط'}
                </AvatarFallback>
              </Avatar>
              <div className="hidden xl:block text-right">
                <p className="text-xs font-bold text-[#182230] leading-tight">
                  {clinic?.doctorName ? `د. ${clinic.doctorName}` : 'الطبيب المسجل'}
                </p>
                <p className="text-[10px] text-slate-400 font-medium">/clinic/{slug}</p>
              </div>
            </div>
          </div>
        </header>

        {/* SUBSCRIPTION BANNER */}
        {(() => {
          if (!clinic?.expirationDate) return null;
          const days = daysUntilExpiration;
          if (days === null || days > 3) return null;
          if (days >= 0) {
            return (
              <div className="bg-rose-500 text-white p-2.5 text-center text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm shrink-0">
                <Bell className="w-4 h-4" />
                تنبيه هام: اشتراك العيادة الخاص بك سينتهي خلال {days} أيام. يرجى التواصل مع الإدارة لتجديد الاشتراك.
              </div>
            );
          }
          return (
            <div className="bg-red-600 text-white p-2.5 text-center text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm shrink-0">
              <Bell className="w-4 h-4" />
              تنبيه: لقد انتهى اشتراك العيادة! قد تتوقف بعض الخدمات، يرجى التجديد فوراً.
            </div>
          );
        })()}

        {/* Scrollable Page Body */}
        <main className="flex-1 overflow-y-auto bg-[#F6F8FB] pb-20 lg:pb-8 relative">
          {children}
        </main>

        {/* 4. MOBILE BOTTOM NAVIGATION (Fixed at bottom for phones) */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-[#E5EAF0] px-3 py-2 z-40 flex justify-around items-center shadow-lg">
          {bottomNavItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link key={item.name} href={item.href} className="flex-1">
                <div
                  className={`flex flex-col items-center justify-center py-1 transition-all ${
                    isActive ? 'text-[#15B8A6] font-bold' : 'text-slate-400 hover:text-slate-600 font-medium'
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
    </div>
  )
}
