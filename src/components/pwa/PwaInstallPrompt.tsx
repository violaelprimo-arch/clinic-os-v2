'use client'

import { useState, useEffect } from 'react'
import { Download, PlusSquare, Share, X, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { isRunningStandalone, isIosSafari } from '@/lib/pwaService'

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [showIosModal, setShowIosModal] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isRunningStandalone()) return // Already installed

    // Check dismissed
    const dismissed = sessionStorage.getItem('pwa_install_dismissed')
    if (dismissed) return

    // Android / Chrome beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowPrompt(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // For iOS Safari (show install prompt if not standalone)
    if (isIosSafari()) {
      setShowPrompt(true)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setShowPrompt(false)
      }
      setDeferredPrompt(null)
    } else if (isIosSafari()) {
      setShowIosModal(true)
    }
  }

  const handleDismiss = () => {
    sessionStorage.setItem('pwa_install_dismissed', 'true')
    setShowPrompt(false)
  }

  if (!showPrompt) return null

  return (
    <>
      {/* Floating or Top Install Banner on Mobile */}
      <div className="fixed bottom-16 sm:bottom-4 left-3 right-3 sm:left-auto sm:right-4 z-40 max-w-sm bg-[#0B1F33] text-white p-3 rounded-2xl shadow-2xl border border-[#1E3A5F] flex items-center justify-between gap-3 animate-in slide-in-from-bottom-5" dir="rtl">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#15B8A6] text-white flex items-center justify-center shrink-0 shadow-xs">
            <Download className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black truncate">تطبيق Clinic OS الطبي</p>
            <p className="text-[10px] text-slate-300 truncate">تثبيت التطبيق على شاشتك الرئيسية</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="sm"
            onClick={handleInstallClick}
            className="h-8 px-3 text-[11px] font-bold bg-[#15B8A6] hover:bg-[#0D9488] text-white rounded-xl shadow-xs cursor-pointer"
          >
            تثبيت
          </Button>
          <button
            onClick={handleDismiss}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* iOS Instructions Modal */}
      {showIosModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" dir="rtl">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 text-right border border-slate-200 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-sm text-[#182230]">تثبيت التطبيق على iPhone</h3>
              <button onClick={() => setShowIosModal(false)} className="text-slate-400 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              لتثبيت Clinic OS على شاشتك الرئيسية وتفعيل التنبيهات:
            </p>
            <ol className="text-xs space-y-2 text-slate-700 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <li className="flex items-center gap-2">
                <span>1. اضغط على زر المشاركة</span>
                <Share className="w-4 h-4 text-blue-500" />
                <span>في أسفل متصفح Safari.</span>
              </li>
              <li className="flex items-center gap-2">
                <span>2. مرر للأسفل واختر</span>
                <span className="font-bold text-[#15B8A6]">"إضافة إلى الصفحة الرئيسية"</span>
                <PlusSquare className="w-4 h-4 text-[#15B8A6]" />
              </li>
              <li>3. اضغط "إضافة (Add)" في أعلى اليمين.</li>
            </ol>
            <Button
              className="w-full h-10 text-xs font-bold bg-[#15B8A6] hover:bg-[#0D9488] text-white rounded-xl"
              onClick={() => setShowIosModal(false)}
            >
              فهمت، شكراً
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
