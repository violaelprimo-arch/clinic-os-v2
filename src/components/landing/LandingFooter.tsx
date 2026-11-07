'use client'

import React from 'react'
import Link from 'next/link'
import { ClinicLogo } from '@/components/clinic/ClinicLogo'
import { ShieldCheck, Phone, MessageCircle } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'
import { type LandingPageConfig, normalizePhoneNumber } from '@/lib/landing-config'

interface LandingFooterProps {
  config: LandingPageConfig
}

export function LandingFooter({ config }: LandingFooterProps) {
  const { isRtl } = useLanguage()

  const activeContacts = React.useMemo(() => {
    const list = (config.contacts || []).filter((c) => c.visible !== false)
    if (list.length > 0) return list
    if (config.primaryWhatsapp) {
      return [
        {
          id: 'footer-default-primary',
          roleTitle: 'المبيعات والدعم الفني',
          roleTitleEn: 'Sales & Support',
          number: config.primaryWhatsapp,
          countryCode: '+20',
          whatsappNumber: normalizePhoneNumber(config.primaryWhatsapp),
          whatsappEnabled: true,
          visible: true,
          isPrimary: true,
        },
      ]
    }
    return []
  }, [config.contacts, config.primaryWhatsapp])

  return (
    <footer className="border-t border-sky-100 dark:border-slate-800 bg-white/70 dark:bg-[#060e1c] text-slate-600 dark:text-slate-400 py-12 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Col 1: Brand Info (2 cols on lg) */}
          <div className="lg:col-span-2 space-y-3">
            <Link href="/" className="inline-block" dir="ltr">
              <ClinicLogo size="md" variant="auto" />
            </Link>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md leading-relaxed font-medium">
              {isRtl
                ? 'يلا كلينك: المنظومة السحابية المتكاملة لإدارة العيادات والمراكز الطبية. مصممة لتنظيم الحجوزات، الدور اللحظي، الروشتات، والملفات الطبية بأعلى معايير السرية والأمان.'
                : 'Yalla Clinic: The unified cloud clinic operating system. Effortlessly manage appointments, queues, EMR and A4 prescriptions.'}
            </p>
          </div>

          {/* Col 2: Quick Links (روابط سريعة) */}
          <div className="space-y-2 text-xs">
            <h4 className="font-black text-slate-900 dark:text-white text-xs mb-3">
              {isRtl ? 'روابط سريعة' : 'Quick Links'}
            </h4>
            <ul className="grid grid-cols-2 gap-2.5">
              <li>
                <a href="#features" className="hover:text-primary transition-colors font-medium">
                  {isRtl ? 'مميزات المنصة' : 'Features'}
                </a>
              </li>
              <li>
                <a href="#gallery" className="hover:text-primary transition-colors font-medium">
                  {isRtl ? 'معرض الصور' : 'Screenshots'}
                </a>
              </li>
              <li>
                <a href="#steps" className="hover:text-primary transition-colors font-medium">
                  {isRtl ? 'خطوات البدء' : 'How It Works'}
                </a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-primary transition-colors font-medium">
                  {isRtl ? 'الباقات' : 'Pricing'}
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-primary transition-colors font-medium">
                  {isRtl ? 'الأسئلة الشائعة' : 'FAQ'}
                </a>
              </li>
              <li>
                <a href="#contact" className="hover:text-primary transition-colors font-medium">
                  {isRtl ? 'تواصل معنا' : 'Contact'}
                </a>
              </li>
            </ul>
          </div>

          {/* Col 3: Contact Numbers (أرقام التواصل والمساندة) */}
          <div className="space-y-2 text-xs">
            <h4 className="font-black text-slate-900 dark:text-white text-xs mb-3">
              {isRtl ? 'أرقام التواصل والمساندة' : 'Contact & Support'}
            </h4>
            <div className="space-y-2">
              {activeContacts.map((c) => {
                const cleanPhone = c.number || c.whatsappNumber || ''
                const cleanWa = c.whatsappNumber ? normalizePhoneNumber(c.whatsappNumber) : normalizePhoneNumber(cleanPhone)
                const waLink = cleanWa ? `https://wa.me/${cleanWa}` : null

                return (
                  <div
                    key={c.id}
                    className="p-2.5 rounded-xl bg-slate-50/90 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-slate-700 dark:text-slate-300 text-[11px] truncate">
                        {isRtl ? c.roleTitle : c.roleTitleEn || c.roleTitle}
                      </span>
                      {c.isPrimary && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-950 text-primary font-bold shrink-0">
                          {isRtl ? 'رئيسي' : 'Primary'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 font-semibold" dir="ltr">
                        {cleanPhone}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <a
                          href={`tel:${cleanPhone.replace(/\s+/g, '')}`}
                          className="p-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-primary hover:bg-sky-100 transition-colors"
                          title={isRtl ? 'اتصال هاتفي' : 'Phone Call'}
                        >
                          <Phone className="w-3 h-3" />
                        </a>
                        {c.whatsappEnabled && waLink && (
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 transition-colors"
                            title={isRtl ? 'محادثة واتساب' : 'WhatsApp'}
                          >
                            <MessageCircle className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 font-bold">
          <p>{isRtl ? config.footerText : config.english?.footerText || config.footerText}</p>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>نظام سحابي آمن 100%</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
