import { ReactNode } from 'react'
import { ShieldCheck, Phone, MessageSquare } from 'lucide-react'
import { ClinicLogo } from '@/components/clinic/ClinicLogo'

export default function OwnerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F6F8FB] font-sans text-[#182230]" dir="rtl">
      <header className="bg-[#0B1F33] text-white px-6 py-4 shadow-md sticky top-0 z-50 border-b border-[#132B45]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ClinicLogo size="md" variant="dark" />
            <div className="border-r border-[#1E3A5F] pr-3 mr-1">
              <span className="text-xs font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                لوحة المالك (Super Admin)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-bold text-slate-300">
            <div className="flex items-center gap-1.5 bg-[#0F243A] px-3 py-1.5 rounded-xl border border-[#1E3A5F]">
              <Phone className="w-3.5 h-3.5 text-[#15B8A6]" />
              <span>هاتف مالك المنصة:</span>
              <a href="tel:01551007018" className="font-mono text-white hover:text-[#15B8A6]">01551007018</a>
            </div>

            <a
              href="https://wa.me/201551007018"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>واتساب المالك</span>
            </a>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto p-4 md:p-8">
        {children}
      </main>
    </div>
  )
}
