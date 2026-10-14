'use client'

import { ReactNode } from 'react'
import { Phone, MessageSquare } from 'lucide-react'
import { ClinicLogo } from '@/components/clinic/ClinicLogo'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { LanguageToggle } from '@/components/common/LanguageToggle'
import { useLanguage } from '@/context/LanguageContext'

export default function OwnerLayout({ children }: { children: ReactNode }) {
  const { dir, t } = useLanguage()

  return (
    <div className="min-h-screen bg-[#F4FAFF] dark:bg-[#07162D] font-sans text-[#092145] dark:text-[#F3FAFF] transition-colors flex flex-col justify-between" dir={dir}>
      <div>
        <header className="bg-[#061A38] text-white px-4 sm:px-6 py-3.5 shadow-md sticky top-0 z-50 border-b border-[#254565]">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ClinicLogo size="md" variant="dark" />
              <div className="rtl:border-r ltr:border-l border-[#142D50] rtl:pr-3 rtl:mr-1 ltr:pl-3 ltr:ml-1">
                <span className="text-xs font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                  {t('owner_super_admin')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-4 text-xs font-bold text-slate-300">
              <div className="hidden md:flex items-center gap-1.5 bg-[#0E2342] px-3 py-1.5 rounded-xl border border-[#254565]">
                <Phone className="w-3.5 h-3.5 text-[#02CFF3]" />
                <span>{t('owner_phone')}:</span>
                <a href="tel:01551007018" className="font-mono text-white hover:text-[#02CFF3] transition-colors">01551007018</a>
              </div>

              <a
                href="https://wa.me/201551007018"
                target="_blank"
                rel="noreferrer"
                className="hidden sm:flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>{t('owner_whatsapp')}</span>
              </a>

              <div className="flex items-center gap-2 rtl:border-r ltr:border-l border-[#254565] rtl:pr-2 rtl:mr-1 ltr:pl-2 ltr:ml-1">
                <LanguageToggle />
                <ThemeToggle />
              </div>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto p-4 md:p-8">
          {children}
        </main>
      </div>

      <footer className="border-t border-[#DCE9F5] dark:border-[#254565] py-6 text-center text-xs text-[#7387A3] bg-white/50 dark:bg-[#07162D]/50 backdrop-blur-sm">
        <p className="font-medium">
          {t('copyright_text', 'جميع الحقوق محفوظة YallaCodeX 2026')}
        </p>
      </footer>
    </div>
  )
}
