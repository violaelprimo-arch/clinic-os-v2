'use client'

import React from 'react'
import Link from 'next/link'
import { ClinicLogo } from '@/components/clinic/ClinicLogo'
import { ShieldCheck } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'
import { type LandingPageConfig } from '@/lib/landing-config'

interface LandingFooterProps {
  config: LandingPageConfig
}

export function LandingFooter({ config }: LandingFooterProps) {
  const { isRtl } = useLanguage()

  return (
    <footer className="border-t border-sky-100 dark:border-slate-800 bg-white/70 dark:bg-[#060e1c] text-slate-600 dark:text-slate-400 py-12 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Col 1: Brand Info */}
          <div className="md:col-span-2 space-y-3">
            <Link href="/" className="inline-block" dir="ltr">
              <ClinicLogo size="md" variant="auto" />
            </Link>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md leading-relaxed font-medium">
              {isRtl
                ? 'يلا كلينك: المنظومة السحابية المتكاملة لإدارة العيادات والمراكز الطبية. مصممة لتنظيم الحجوزات، الدور اللحظي، الروشتات، والملفات الطبية بأعلى معايير السرية والأمان.'
                : 'Yalla Clinic: The unified cloud clinic operating system. Effortlessly manage appointments, queues, EMR and A4 prescriptions.'}
            </p>
          </div>

          {/* Col 2: System Portals (بوابات النظام) */}
          <div className="space-y-2 text-xs">
            <h4 className="font-black text-slate-900 dark:text-white text-xs mb-3">
              {isRtl ? 'بوابات النظام' : 'System Portals'}
            </h4>
            <ul className="space-y-2.5">
              <li>
                <Link
                  href={config.loginUrl || '/clinic/zizo/login'}
                  className="hover:text-sky-600 dark:hover:text-sky-400 transition-colors font-medium flex items-center gap-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0"></span>
                  <span>{isRtl ? 'تسجيل دخول العيادة' : 'Clinic Login'}</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/clinic/zizo/tv"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-sky-600 dark:hover:text-sky-400 transition-colors font-medium flex items-center gap-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                  <span>{isRtl ? 'شاشة غرفة الانتظار (TV)' : 'Waiting Room Screen (TV)'}</span>
                </Link>
              </li>
              <li>
                <Link
                  href={config.patientUrl || '/clinic/zizo/patient'}
                  className="hover:text-sky-600 dark:hover:text-sky-400 transition-colors font-medium flex items-center gap-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shrink-0"></span>
                  <span>{isRtl ? 'بوابة المريض الذكية' : 'Smart Patient Portal'}</span>
                </Link>
              </li>
              <li>
                <a
                  href="#contact"
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(new CustomEvent('select-contact-type', { detail: 'complaint' }))
                    }
                  }}
                  className="hover:text-sky-600 dark:hover:text-sky-400 transition-colors font-medium flex items-center gap-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                  <span>{isRtl ? 'الاقتراحات والشكاوى' : 'Suggestions & Complaints'}</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Col 3: Quick Links (روابط سريعة) */}
          <div className="space-y-2 text-xs">
            <h4 className="font-black text-slate-900 dark:text-white text-xs mb-3">
              {isRtl ? 'روابط سريعة' : 'Quick Links'}
            </h4>
            <ul className="grid grid-cols-2 gap-2">
              <li>
                <a href="#features" className="hover:text-sky-600 dark:hover:text-sky-400 transition-colors">
                  {isRtl ? 'مميزات المنصة' : 'Features'}
                </a>
              </li>
              <li>
                <a href="#gallery" className="hover:text-sky-600 dark:hover:text-sky-400 transition-colors">
                  {isRtl ? 'معرض صور النظام' : 'Screenshots'}
                </a>
              </li>
              <li>
                <a href="#steps" className="hover:text-sky-600 dark:hover:text-sky-400 transition-colors">
                  {isRtl ? 'خطوات الاستخدام' : 'How It Works'}
                </a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-sky-600 dark:hover:text-sky-400 transition-colors">
                  {isRtl ? 'الباقات والأسعار' : 'Pricing Plans'}
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-sky-600 dark:hover:text-sky-400 transition-colors">
                  {isRtl ? 'الأسئلة الشائعة' : 'FAQ'}
                </a>
              </li>
              <li>
                <a href="#contact" className="hover:text-sky-600 dark:hover:text-sky-400 transition-colors">
                  {isRtl ? 'تواصل معنا' : 'Contact Us'}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 font-bold">
          <p>{isRtl ? config.footerText : config.english.footerText || config.footerText}</p>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>نظام سحابي آمن 100%</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
