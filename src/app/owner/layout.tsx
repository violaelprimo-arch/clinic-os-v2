import { ReactNode } from 'react'
import { ShieldCheck } from 'lucide-react'

export default function OwnerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 font-sans" dir="rtl">
      <header className="bg-slate-900 text-white p-4 shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center gap-2">
          <ShieldCheck className="w-8 h-8 text-amber-500" />
          <h1 className="text-xl font-bold">لوحة تحكم المالك (Super Admin)</h1>
        </div>
      </header>
      <main className="max-w-7xl mx-auto p-4 md:p-8">
        {children}
      </main>
    </div>
  )
}
