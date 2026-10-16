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
    <div className="min-h-screen bg-background font-sans text-foreground transition-colors flex flex-col justify-between" dir={dir}>
      <div>
        <header className="bg-card text-foreground px-4 sm:px-6 py-3.5 shadow-xs sticky top-0 z-50 border-b border-border">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ClinicLogo size="md" variant="auto" />
              <div className="rtl:border-r ltr:border-l border-border rtl:pr-3 rtl:mr-1 ltr:pl-3 ltr:ml-1">
                <span className="text-xs font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                  {t('owner_super_admin')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-4 text-xs font-bold text-muted-foreground">
              <div className="hidden md:flex items-center gap-1.5 bg-secondary px-3 py-1.5 rounded-xl border border-border">
                <Phone className="w-3.5 h-3.5 text-primary" />
                <span>{t('owner_phone')}:</span>
                <a href="tel:01551007018" className="font-mono text-foreground hover:text-primary transition-colors">01551007018</a>
              </div>

              <a
                href="https://wa.me/201551007018"
                target="_blank"
                rel="noreferrer"
                className="hidden sm:flex items-center gap-1 text-emerald-500 hover:text-emerald-600 transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>{t('owner_whatsapp')}</span>
              </a>

              <div className="flex items-center gap-2 rtl:border-r ltr:border-l border-border rtl:pr-2 rtl:mr-1 ltr:pl-2 ltr:ml-1">
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

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground bg-card/60 backdrop-blur-sm">
        <p className="font-medium">
          {t('copyright_text', 'جميع الحقوق محفوظة YallaCodeX 2026')}
        </p>
      </footer>
    </div>
  )
}
