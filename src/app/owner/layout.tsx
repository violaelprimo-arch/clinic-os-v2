'use client'

import { ReactNode, useEffect, useState, useRef, useCallback } from 'react'
import {
  OwnerNavigationContext,
  type OwnerTab,
} from '@/components/owner/OwnerNavigationContext'
import {
  OWNER_NAVIGATION_SECTIONS,
} from '@/components/owner/OwnerNavigationConfig'
import { Menu, X, UserRound } from 'lucide-react'
import { ClinicLogo } from '@/components/clinic/ClinicLogo'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { auth, db } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, query, onSnapshot } from 'firebase/firestore'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { LanguageToggle } from '@/components/common/LanguageToggle'
import { TechnicalSupportButton } from '@/components/clinic/TechnicalSupportButton'
import { useLanguage } from '@/context/LanguageContext'
import { toast } from 'sonner'

export default function OwnerLayout({ children }: { children: ReactNode }) {
  const { dir, isRtl } = useLanguage()
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [activeOwnerTab, setActiveOwnerTab] = useState<OwnerTab>('clinics')
  const [newRequestsCount, setNewRequestsCount] = useState<number>(0)
  const [ownerPhotoUrl, setOwnerPhotoUrl] = useState<string | null>(null)

  const exportBackupRef = useRef<(() => void | Promise<void>) | null>(null)
  const editClinicRef = useRef<(() => void) | null>(null)

  const registerExportBackup = useCallback((fn: (() => void | Promise<void>) | null) => {
    exportBackupRef.current = fn
  }, [])

  const triggerExportBackup = useCallback(() => {
    if (exportBackupRef.current) {
      exportBackupRef.current()
    } else {
      toast.info(isRtl ? 'جاري تحضير النسخة الاحتياطية المشفرة...' : 'Preparing encrypted backup...')
    }
  }, [isRtl])

  const registerEditClinic = useCallback((fn: (() => void) | null) => {
    editClinicRef.current = fn
  }, [])

  const triggerEditClinic = useCallback(() => {
    if (editClinicRef.current) {
      editClinicRef.current()
    } else {
      setActiveOwnerTab('add')
    }
  }, [])

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setOwnerPhotoUrl(user?.photoURL || null)
      if (user) {
        try {
          const q = query(collection(db, 'trial_requests'))
          const unsub = onSnapshot(
            q,
            (snap) => {
              const count = snap.docs.filter((d) => d.data()?.status === 'new').length
              setNewRequestsCount(count)
            },
            () => {
              // Ignore snapshot error
            }
          )
          return () => unsub()
        } catch {
          // ignore error
        }
      }
    })
  }, [])

  const handleSelectTab = (tab: OwnerTab) => {
    setActiveOwnerTab(tab)
    setMobileDrawerOpen(false)
  }

  const contextValue = {
    activeTab: activeOwnerTab,
    setActiveTab: setActiveOwnerTab,
    newRequestsCount,
    setNewRequestsCount,
    triggerExportBackup,
    registerExportBackup,
    triggerEditClinic,
    registerEditClinic,
  }

  return (
    <OwnerNavigationContext.Provider value={contextValue}>
      <div className="flex h-dvh min-h-0 overflow-hidden bg-background font-sans text-foreground transition-colors duration-200" dir={dir}>

        {/* Ambient background glows for authentic glassmorphism */}
        <div className="fixed top-20 -right-20 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none -z-10" />
        <div className="fixed bottom-10 -left-20 w-80 h-80 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none -z-10" />

        {/* Desktop Sidebar */}
        <aside className="z-20 hidden h-full w-72 shrink-0 flex-col overflow-hidden border-e border-border/50 bg-card/75 shadow-xl backdrop-blur-xl md:flex">
          
          {/* Brand Header */}
          <div className="shrink-0 border-b border-border/50 bg-gradient-to-br from-primary/5 via-transparent to-cyan-500/5 p-5">
            <div className="flex min-w-0 flex-col items-start gap-2">
              <ClinicLogo size="md" className="max-w-full" />
              <div className="min-w-0">
                <span className="flex items-center gap-2 text-base font-black tracking-tight text-foreground">
                  Clinic OS <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">V2</span>
                </span>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isRtl ? 'لوحة تحكم المالِك' : 'Super Admin Portal'}
                </p>
              </div>
            </div>
          </div>

          {/* Grouped Navigation Items (4 Sections) */}
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4 no-scrollbar">
            {OWNER_NAVIGATION_SECTIONS.map((section) => (
              <div key={section.id} className="space-y-1">
                <div className="px-3 pt-2 pb-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground/70 flex items-center justify-between">
                  <span>{isRtl ? section.titleAr : section.titleEn}</span>
                </div>

                <div className="space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon

                    // 1. JSON Backup Action Item
                    if (item.isAction) {
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={triggerExportBackup}
                          className="group flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-start text-xs font-bold transition-all duration-200 text-muted-foreground hover:text-foreground hover:bg-muted/70 active:scale-[0.98] cursor-pointer"
                        >
                          <Icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-transform duration-200 group-hover:scale-110" />
                          <span className="flex-1 truncate">{isRtl ? item.labelAr : item.labelEn}</span>
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/50">
                            JSON
                          </span>
                        </button>
                      )
                    }

                    // 2. Edit Clinic Details Tab / Action
                    if (item.id === 'add') {
                      const isActive = activeOwnerTab === 'add'
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={triggerEditClinic}
                          className={`group flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-start text-xs font-bold transition-all duration-200 hover:translate-x-0.5 cursor-pointer ${
                            isActive
                              ? 'bg-[#0066FF] text-white shadow-md shadow-blue-500/25'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                          }`}
                        >
                          <Icon className={`w-4 h-4 transition-transform duration-200 group-hover:scale-110 ${
                            isActive ? 'text-white' : 'text-muted-foreground group-hover:text-primary'
                          }`} />
                          <span className="flex-1 truncate">{isRtl ? item.labelAr : item.labelEn}</span>
                          {isActive && (
                            <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                          )}
                        </button>
                      )
                    }

                    // 3. Standard Navigation Tab
                    const isActive = activeOwnerTab === item.id
                    const activeBg = item.activeClass || 'bg-[#0066FF] text-white shadow-md shadow-blue-500/25'

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectTab(item.id as OwnerTab)}
                        className={`group flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-start text-xs font-bold transition-all duration-200 hover:translate-x-0.5 cursor-pointer ${
                          isActive
                            ? activeBg
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                        }`}
                      >
                        <Icon className={`w-4 h-4 transition-transform duration-200 group-hover:scale-110 ${
                          isActive
                            ? 'text-white'
                            : item.id === 'whatsapp'
                            ? 'text-emerald-500'
                            : 'text-muted-foreground group-hover:text-primary'
                        }`} />
                        <span className="flex-1 truncate">{isRtl ? item.labelAr : item.labelEn}</span>
                        {item.showBadge && newRequestsCount > 0 && (
                          <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-[10px] font-black rounded-full bg-rose-500 text-white shadow-xs animate-pulse">
                            {newRequestsCount}
                          </span>
                        )}
                        {isActive && !item.showBadge && (
                          <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Sidebar Footer */}
          <div className="shrink-0 space-y-3 border-t border-border/50 bg-muted/30 p-4">
            <div className="flex items-center justify-between px-2">
              <span className="text-xs font-medium text-muted-foreground">{isRtl ? 'المظهر واللغة' : 'Appearance'}</span>
              <div className="flex items-center gap-1">
                <ThemeToggle />
                <LanguageToggle />
              </div>
            </div>

            <TechnicalSupportButton
              variant="block"
              className="h-10 min-w-0 justify-center px-2 text-[11px] sm:text-xs"
            />

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
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          
          {/* Mobile Header */}
          <header className="z-30 flex shrink-0 items-center justify-between border-b border-border/50 bg-card/85 p-3 backdrop-blur-md md:hidden">
            <div className="flex items-center gap-2">
              <ClinicLogo size="sm" className="max-w-[120px]" />
              <span className="hidden font-bold text-sm text-foreground sm:inline">Clinic OS</span>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <LanguageToggle />
              <button
                onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
                className="p-2 rounded-lg bg-muted/60 text-foreground cursor-pointer"
                aria-label={isRtl ? 'فتح القائمة' : 'Open menu'}
              >
                {mobileDrawerOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </header>

          {/* Mobile Nav Drawer */}
          {mobileDrawerOpen && (
            <div className="fixed inset-0 z-50 flex flex-col bg-background/95 p-4 backdrop-blur-xl md:hidden">
              <div className="mb-4 flex shrink-0 items-center justify-between border-b border-border/50 pb-3">
                <ClinicLogo size="sm" className="max-w-[140px]" />
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  aria-label={isRtl ? 'إغلاق القائمة' : 'Close navigation'}
                  className="rounded-xl border border-border p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
                >
                  <X className="size-5" />
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1 py-2 no-scrollbar">
                {OWNER_NAVIGATION_SECTIONS.map((section) => (
                  <div key={section.id} className="space-y-1">
                    <div className="px-3 py-1 text-[11px] font-black uppercase tracking-wider text-muted-foreground/70">
                      {isRtl ? section.titleAr : section.titleEn}
                    </div>

                    <div className="space-y-1">
                      {section.items.map((item) => {
                        const Icon = item.icon

                        // Action: JSON Backup
                        if (item.isAction) {
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                setMobileDrawerOpen(false)
                                triggerExportBackup()
                              }}
                              className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl font-bold text-sm text-start text-muted-foreground hover:bg-muted cursor-pointer"
                            >
                              <Icon className="w-4 h-4 text-muted-foreground" />
                              <span className="flex-1">{isRtl ? item.labelAr : item.labelEn}</span>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted border border-border/50">
                                JSON
                              </span>
                            </button>
                          )
                        }

                        // Action: Edit Clinic Details
                        if (item.id === 'add') {
                          const isActive = activeOwnerTab === 'add'
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                setMobileDrawerOpen(false)
                                triggerEditClinic()
                              }}
                              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl font-bold text-sm text-start cursor-pointer ${
                                isActive
                                  ? 'bg-[#0066FF] text-white shadow-md'
                                  : 'text-muted-foreground hover:bg-muted'
                              }`}
                            >
                              <Icon className="w-4 h-4" />
                              <span className="flex-1">{isRtl ? item.labelAr : item.labelEn}</span>
                            </button>
                          )
                        }

                        // Standard Tab
                        const isActive = activeOwnerTab === item.id
                        const activeBg = item.activeClass || 'bg-[#0066FF] text-white shadow-md'

                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleSelectTab(item.id as OwnerTab)}
                            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl font-bold text-sm text-start cursor-pointer ${
                              isActive
                                ? activeBg
                                : 'text-muted-foreground hover:bg-muted'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                            <span className="flex-1">{isRtl ? item.labelAr : item.labelEn}</span>
                            {item.showBadge && newRequestsCount > 0 && (
                              <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-[10px] font-black rounded-full bg-rose-500 text-white">
                                {newRequestsCount}
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="shrink-0 space-y-3 border-t border-border/40 pt-4">
                <TechnicalSupportButton variant="block" />
                <p className="text-center text-xs text-muted-foreground">
                  Clinic OS v2 Owner Dashboard
                </p>
              </div>
            </div>
          )}

          {/* Dynamic Page Content */}
          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-gradient-to-b from-background via-background/95 to-muted/20 p-3 sm:p-4 md:p-6 xl:p-8">
            <div className="mx-auto w-full max-w-[1440px] space-y-6">
              {children}
            </div>
          </main>
        </div>

      </div>
    </OwnerNavigationContext.Provider>
  )
}
