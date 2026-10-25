'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { MessageCircle, ChevronDown, Check, Loader2, Globe, Laptop } from 'lucide-react'
import {
  getSavedWhatsAppTarget,
  saveWhatsAppTarget,
  formatEgyptianPhoneForWhatsApp
} from '@/lib/whatsappShare'
import { useLanguage } from '@/context/LanguageContext'

export interface WhatsAppShareButtonProps {
  onSend: (target: 'web' | 'app') => any
  phone?: string
  label?: string
  loading?: boolean
  disabled?: boolean
  size?: 'sm' | 'default' | 'lg'
  variant?: 'emerald' | 'default' | 'outline'
  className?: string
  title?: string
  showPhoneBadge?: boolean
}

export function WhatsAppShareButton({
  onSend,
  phone = '',
  label,
  loading = false,
  disabled = false,
  size = 'default',
  variant = 'emerald',
  className = '',
  title,
  showPhoneBadge = true
}: WhatsAppShareButtonProps) {
  const { t, isRtl } = useLanguage()
  const [targetMode, setTargetMode] = useState<'web' | 'app'>('web')
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setTargetMode(getSavedWhatsAppTarget())
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleSelectModeAndSend = (mode: 'web' | 'app') => {
    setTargetMode(mode)
    saveWhatsAppTarget(mode)
    setIsOpen(false)
    onSend(mode)
  }

  const handlePrimaryClick = () => {
    onSend(targetMode)
  }

  const defaultLabel = label || t('send_whatsapp_pdf_btn', isRtl ? 'إرسال واتساب (PDF)' : 'Send WhatsApp (PDF)')
  const defaultTitle = title || (isRtl ? 'إرسال عبر واتساب إلى رقم المريض المسجل' : 'Send via WhatsApp to registered patient phone')

  const heightClass = size === 'sm' ? 'h-8 text-xs' : size === 'lg' ? 'h-11 text-sm' : 'h-9 text-xs'
  const primaryBg = variant === 'outline'
    ? 'border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
    : 'bg-[#25D366] hover:bg-[#128C7E] text-white shadow-xs'
  const chevronBg = variant === 'outline'
    ? 'border-y border-e border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
    : 'bg-[#1ebe5d] hover:bg-[#0e7468] text-white'

  return (
    <div ref={menuRef} className={`relative inline-flex items-center ${className}`}>
      {/* Primary Action Button */}
      <Button
        type="button"
        size={size === 'sm' ? 'sm' : 'default'}
        disabled={disabled || loading}
        onClick={handlePrimaryClick}
        className={`${heightClass} font-bold ${primaryBg} rounded-s-xl rounded-e-none transition-all active:scale-[0.98] cursor-pointer flex items-center gap-1.5`}
        title={defaultTitle}
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <MessageCircle className="w-4 h-4" />
        )}
        <span>{defaultLabel}</span>
        {showPhoneBadge && phone && (
          <span className="text-[10px] bg-black/15 px-1.5 py-0.5 rounded-md font-mono font-normal" dir="ltr">
            {formatEgyptianPhoneForWhatsApp(phone).slice(-8)}
          </span>
        )}
      </Button>

      {/* Target Selector Dropdown Toggle */}
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setIsOpen(!isOpen)}
        className={`${heightClass} px-2 ${chevronBg} rounded-e-xl rounded-s-none transition-all border-s border-white/20 flex items-center justify-center cursor-pointer`}
        title={isRtl ? 'تحديد وجهة الإرسال (واتساب ويب أو تطبيق واتساب)' : 'Select WhatsApp destination (Web or App)'}
      >
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Target Selection Menu */}
      {isOpen && (
        <div
          className={`absolute top-full ${isRtl ? 'end-0' : 'start-0'} mt-1.5 w-60 bg-card text-card-foreground border border-border rounded-2xl shadow-2xl p-1.5 z-50 space-y-1 animate-in fade-in-50 zoom-in-95`}
        >
          <div className="px-2.5 py-1 text-[10px] font-bold text-muted-foreground border-b border-border">
            {isRtl ? 'اختر طريقة فتح واتساب:' : 'Select WhatsApp Mode:'}
          </div>

          {/* WhatsApp Web Option */}
          <button
            type="button"
            onClick={() => handleSelectModeAndSend('web')}
            className={`w-full text-start px-2.5 py-2 text-xs rounded-xl flex items-center justify-between transition-colors cursor-pointer ${
              targetMode === 'web'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black'
                : 'hover:bg-muted font-bold text-foreground'
            }`}
          >
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-500" />
              <span>{isRtl ? 'واتساب ويب (WhatsApp Web)' : 'WhatsApp Web'}</span>
            </div>
            {targetMode === 'web' && <Check className="w-3.5 h-3.5 text-emerald-500" />}
          </button>

          {/* WhatsApp Desktop / Mobile App Option */}
          <button
            type="button"
            onClick={() => handleSelectModeAndSend('app')}
            className={`w-full text-start px-2.5 py-2 text-xs rounded-xl flex items-center justify-between transition-colors cursor-pointer ${
              targetMode === 'app'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black'
                : 'hover:bg-muted font-bold text-foreground'
            }`}
          >
            <div className="flex items-center gap-2">
              <Laptop className="w-4 h-4 text-emerald-500" />
              <span>{isRtl ? 'تطبيق واتساب (WhatsApp App)' : 'WhatsApp Desktop App'}</span>
            </div>
            {targetMode === 'app' && <Check className="w-3.5 h-3.5 text-emerald-500" />}
          </button>
        </div>
      )}
    </div>
  )
}
