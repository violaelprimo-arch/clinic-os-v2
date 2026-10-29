'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { Menu, X, ArrowLeft, ArrowRight, UserCheck, ShieldCheck } from 'lucide-react'
import { ClinicLogo } from '@/components/clinic/ClinicLogo'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { LanguageToggle } from '@/components/common/LanguageToggle'
import { useLanguage } from '@/context/LanguageContext'
import { type LandingPageConfig } from '@/lib/landing-config'

interface LandingNavbarProps {
  config: LandingPageConfig
  onOpenTrial: () => void
}

export function LandingNavbar({ config, onOpenTrial }: LandingNavbarProps) {
  const { isRtl } = useLanguage()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      setIsScrolled(window.scrollY > 15)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const vis = config.visibility

  // Generate navigation links dynamically based strictly on enabled sections
  const navLinks = [
    vis.showFeatures && { href: '#features', label: isRtl ? 'المميزات' : 'Features' },
    vis.showScreenshots && { href: '#gallery', label: isRtl ? 'معرض النظام' : 'Screenshots' },
    vis.showSteps && { href: '#steps', label: isRtl ? 'خطوات الاستخدام' : 'How It Works' },
    vis.showPricing && { href: '#pricing', label: isRtl ? 'الباقات' : 'Pricing' },
    vis.showFeedback && { href: '#testimonials', label: isRtl ? 'آراء الأطباء' : 'Testimonials' },
    vis.showFaq && { href: '#faq', label: isRtl ? 'الأسئلة الشائعة' : 'FAQ' },
    vis.showContactForm && { href: '#contact', label: isRtl ? 'تواصل معنا' : 'Contact' },
  ].filter(Boolean) as Array<{ href: string; label: string }>

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-200 ${
        isScrolled
          ? 'bg-white/95 dark:bg-[#081526]/95 backdrop-blur-md border-b border-sky-200/80 dark:border-slate-800 shadow-sm'
          : 'bg-white/80 dark:bg-[#081526]/80 backdrop-blur-md border-b border-sky-100/50 dark:border-slate-800/50 shadow-none'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* Logo and Brand */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center shrink-0" dir="ltr">
            <ClinicLogo size="md" variant="auto" />
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-sky-50 dark:hover:bg-slate-800/60 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        {/* Action Controls & Buttons */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1">
            <ThemeToggle />
            <LanguageToggle />
          </div>

          {/* Clinic Login button */}
          <Link
            href={config.loginUrl || '/clinic/zizo/login'}
            className="landing-btn-press px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 font-bold text-xs transition-colors"
          >
            {isRtl ? config.loginButtonText || 'دخول العيادة' : config.english.loginButtonText || 'Clinic Login'}
          </Link>

          {/* Free Trial Button */}
          <button
            type="button"
            onClick={onOpenTrial}
            className="landing-btn-press hidden sm:flex px-4 py-2 rounded-xl bg-gradient-to-r from-[#0066dc] to-[#00a8e8] text-white font-black text-xs shadow-sm hover:opacity-95 transition-all items-center gap-1.5 cursor-pointer"
          >
            <span>{isRtl ? config.trialButtonText || 'طلب تجربة' : config.english.trialButtonText || 'Free Trial'}</span>
            {isRtl ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
          </button>

          {/* Mobile menu toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((o) => !o)}
            className="landing-btn-press lg:hidden p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors cursor-pointer"
            aria-label="القائمة"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white dark:bg-[#081526] border-b border-sky-100 dark:border-slate-800 p-4 space-y-3 shadow-xl">
          <nav className="flex flex-col space-y-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-slate-800 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <LanguageToggle />
            </div>

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false)
                onOpenTrial()
              }}
              className="px-4 py-2 rounded-xl bg-sky-600 text-white font-black text-xs shadow-sm"
            >
              {isRtl ? config.trialButtonText || 'طلب تجربة' : 'Free Trial'}
            </button>
          </div>
        </div>
      )}
    </header>
  )
}
