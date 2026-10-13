'use client'

import { useState, useEffect } from 'react'
import { db } from '@/lib/firebase'
import { collection, getDocs } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import {
  Headphones, Phone, MessageSquare, X, ShieldCheck, CheckCircle2, ChevronLeft
} from 'lucide-react'
import { formatEgyptianPhoneForWhatsApp } from '@/lib/whatsappShare'

export interface SupportNumber {
  phone: string
  label?: string
  department?: string
  isActive?: boolean
}

export function TechnicalSupportButton({
  variant = 'compact',
  className = ''
}: {
  variant?: 'compact' | 'pill' | 'block' | 'floating'
  className?: string
}) {
  const [supportNumbers, setSupportNumbers] = useState<SupportNumber[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSupport = async () => {
      try {
        const snap = await getDocs(collection(db, 'platformSettings'))
        if (!snap.empty) {
          const data = snap.docs[0].data()
          const rawNumbers: SupportNumber[] = data.supportNumbers || []
          const activeOnly = rawNumbers.filter(n => n.isActive !== false && n.phone)
          setSupportNumbers(activeOnly.length > 0 ? activeOnly : [{ phone: '01551007018', label: 'فريق الدعم الفني', isActive: true }])
        } else {
          setSupportNumbers([{ phone: '01551007018', label: 'فريق الدعم الفني', isActive: true }])
        }
      } catch (e) {
        setSupportNumbers([{ phone: '01551007018', label: 'فريق الدعم الفني', isActive: true }])
      } finally {
        setLoading(false)
      }
    }
    fetchSupport()
  }, [])

  const handleClick = () => {
    if (supportNumbers.length === 1) {
      const single = supportNumbers[0]
      const formatted = formatEgyptianPhoneForWhatsApp(single.phone)
      const url = `https://wa.me/${formatted}?text=${encodeURIComponent('مرحباً، أحتاج إلى مساعدة من فريق الدعم الفني لمنصة Clinic OS.')}`
      window.open(url, '_blank')
    } else {
      setIsOpen(true)
    }
  }

  const openWhatsApp = (phone: string) => {
    const formatted = formatEgyptianPhoneForWhatsApp(phone)
    const url = `https://wa.me/${formatted}?text=${encodeURIComponent('مرحباً، أحتاج إلى مساعدة من فريق الدعم الفني لمنصة Clinic OS.')}`
    window.open(url, '_blank')
  }

  return (
    <>
      {variant === 'pill' ? (
        <button
          onClick={handleClick}
          type="button"
          className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 hover:bg-teal-50 hover:text-[#0D9488] border border-slate-200 transition-all ${className}`}
        >
          <Headphones className="w-3.5 h-3.5 text-[#15B8A6]" />
          <span>تواصل مع الدعم الفني</span>
        </button>
      ) : variant === 'block' ? (
        <Button
          onClick={handleClick}
          variant="outline"
          type="button"
          className={`w-full h-11 text-xs font-bold border-[#E5EAF0] text-slate-700 hover:bg-teal-50 hover:text-[#0D9488] rounded-xl flex items-center justify-center gap-2 ${className}`}
        >
          <Headphones className="w-4 h-4 text-[#15B8A6]" />
          <span>تواصل مع الدعم الفني</span>
        </Button>
      ) : (
        <button
          onClick={handleClick}
          type="button"
          className={`inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#15B8A6] transition-colors ${className}`}
        >
          <Headphones className="w-3.5 h-3.5 text-[#15B8A6]" />
          <span>تواصل مع الدعم الفني</span>
        </button>
      )}

      {/* Support Numbers Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-teal-50 text-[#15B8A6] flex items-center justify-center">
                  <Headphones className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-[#182230]">الدعم الفني — Clinic OS</h3>
                  <p className="text-[10px] text-slate-400">يسعدنا تقديم المساعدة على مدار الساعة</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              {supportNumbers.map((num, i) => (
                <div
                  key={i}
                  className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <span className="font-bold text-xs text-[#182230] block">
                      {num.label || num.department || 'الدعم الفني للمنصة'}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500 block" dir="ltr">
                      {num.phone}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <a
                      href={`tel:${num.phone}`}
                      className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-[#15B8A6] hover:border-[#15B8A6] transition-colors"
                      title="اتصال هاتفي"
                    >
                      <Phone className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => openWhatsApp(num.phone)}
                      className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 hover:bg-emerald-100 transition-colors"
                      title="مراسلة عبر واتساب"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 text-center text-[10px] text-slate-400 border-t border-slate-100">
              جميع الحقوق محفوظة © {new Date().getFullYear()} Clinic OS
            </div>
          </div>
        </div>
      )}
    </>
  )
}
