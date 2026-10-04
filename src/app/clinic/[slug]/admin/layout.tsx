'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { FileText, Users, DollarSign, Calendar, Settings, Bot } from 'lucide-react'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'

export default function AdminLayout({
  children,
  params
}: {
  children: React.ReactNode,
  params: Promise<{ slug: string }>
}) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug
  const [role, setRole] = useState<string | null>(null)
  const [clinic, setClinic] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const storedRole = localStorage.getItem('clinic_role') || 'doctor'
    setRole(storedRole)

    const fetchClinic = async () => {
      try {
        const q = query(collection(db, 'clinics'), where('slug', '==', slug))
        const snapshot = await getDocs(q)
        if (!snapshot.empty) setClinic(snapshot.docs[0].data())
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchClinic()
  }, [slug])

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div></div>

  const assistantPermissions = clinic?.assistantPermissions || ['appointments']
  const primaryColor = clinic?.primaryColor || '#0ea5e9' // Default Tailwind Sky-500

  const allLinks = [
    { id: 'appointments', name: 'الطابور والمواعيد', href: `/clinic/${slug}/admin`, icon: <Calendar className="w-5 h-5" /> },
    { id: 'patients', name: 'سجل المرضى', href: `/clinic/${slug}/admin/patients`, icon: <Users className="w-5 h-5" /> },
    { id: 'prescriptions', name: 'الروشتات الطبية', href: `/clinic/${slug}/admin/prescriptions`, icon: <FileText className="w-5 h-5" /> },
    { id: 'finance', name: 'التقارير المالية', href: `/clinic/${slug}/admin/finance`, icon: <DollarSign className="w-5 h-5" /> },
    { id: 'ai-training', name: 'تدريب الذكاء الاصطناعي', href: `/clinic/${slug}/admin/ai-training`, icon: <Bot className="w-5 h-5" /> },
    { id: 'settings', name: 'إعدادات العيادة', href: `/clinic/${slug}/admin/settings`, icon: <Settings className="w-5 h-5" /> },
  ]

  // Filter based on role and dynamic permissions
  const links = allLinks.filter(l => {
    if (role === 'doctor') return true
    if (role === 'assistant') return assistantPermissions.includes(l.id)
    return false
  })

  return (
    <div className="flex h-screen bg-[#F8FAFC] font-sans" dir="rtl">
      {/* Inject dynamic CSS variable for Primary Color globally for this dashboard */}
      <style dangerouslySetInnerHTML={{__html: `:root { --primary: ${primaryColor}; }`}} />
      
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 shadow-2xl hidden md:flex flex-col transition-all duration-300 relative z-20">
        <div className="p-6 text-center border-b border-slate-800 bg-slate-950/50">
          <div className="w-20 h-20 bg-primary/20 rounded-2xl mx-auto mb-4 flex items-center justify-center text-primary shadow-lg shadow-primary/10 overflow-hidden">
            {clinic?.heroImage ? (
              <img src={clinic.heroImage} alt="Clinic Logo" className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl font-black text-white">{slug.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <h2 className="text-xl font-bold text-white tracking-wide">{clinic?.clinicName || 'عيادة طبية'}</h2>
          <p className="text-xs text-primary mt-1 mb-2">/clinic/{slug}</p>
          <div className="inline-block px-3 py-1 rounded-full bg-slate-800 text-xs font-bold text-slate-400 border border-slate-700">
            الصلاحية: {role === 'assistant' ? 'مساعد' : 'طبيب'}
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {links.map((link) => (
            <Link key={link.href} href={link.href}>
              <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-primary/20 hover:text-white transition-all group cursor-pointer border border-transparent hover:border-primary/20">
                <div className="text-primary group-hover:scale-110 transition-transform">
                  {link.icon}
                </div>
                <span className="font-bold text-sm tracking-wide">{link.name}</span>
              </div>
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative z-10 scroll-smooth">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl mix-blend-multiply opacity-70 pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-300/10 rounded-full blur-3xl mix-blend-multiply opacity-50 pointer-events-none translate-y-1/3 -translate-x-1/3"></div>
        
        {/* Mobile Nav */}
        <div className="md:hidden bg-white p-4 border-b flex overflow-x-auto gap-2 whitespace-nowrap sticky top-0 z-30 shadow-sm">
          {links.map(link => (
            <Link key={link.href} href={link.href}>
              <div className="flex items-center gap-2 p-2 px-4 rounded-full bg-slate-50 text-slate-700 hover:bg-primary hover:text-white border border-slate-100 text-sm font-bold transition-colors">
                {link.icon}
                {link.name}
              </div>
            </Link>
          ))}
        </div>
        
        {children}
      </main>
    </div>
  )
}
