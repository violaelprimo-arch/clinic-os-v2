'use client'

import React, { useState } from 'react'
import {
  MessageSquare,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  AlertTriangle,
  Lightbulb,
  Phone,
  MessageCircle,
  Clock,
  ShieldCheck
} from 'lucide-react'
import { submitLandingInquiry } from '@/lib/landing-service'
import { whatsappNumber, type ContactItem } from '@/lib/landing-config'
import { toast } from 'sonner'
import { useLanguage } from '@/context/LanguageContext'

interface LandingContactSectionProps {
  contacts: ContactItem[]
  primaryWhatsapp?: string
}

export function LandingContactSection({
  contacts = [],
  primaryWhatsapp = '201551007018',
}: LandingContactSectionProps) {
  const { isRtl } = useLanguage()

  const [type, setType] = useState<'suggestion' | 'complaint' | 'inquiry'>('inquiry')
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [honeypot, setHoneypot] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim() || !contact.trim() || !subject.trim() || !message.trim()) {
      toast.error('يرجى ملء جميع الحقول المطلوبة')
      return
    }

    setIsSubmitting(true)
    try {
      await submitLandingInquiry({
        type,
        name: name.trim(),
        contact: contact.trim(),
        subject: subject.trim(),
        message: message.trim(),
        website: honeypot
      })

      setIsSuccess(true)
      setName('')
      setContact('')
      setSubject('')
      setMessage('')
      toast.success('تم إرسال رسالتك بنجاح وسيتم الرد عليك في أقرب وقت.')
    } catch (err: any) {
      console.error('Contact submit error:', err)
      toast.error(err?.message || 'تعذر إرسال الرسالة، يرجى المحاولة ثانيةً')
    } finally {
      setIsSubmitting(false)
    }
  }

  const primaryContact =
    contacts.find((c) => c.isPrimary && c.whatsappEnabled) ||
    contacts.find((c) => c.whatsappEnabled)
  const rawNumber = primaryContact?.whatsappNumber || primaryWhatsapp
  const cleanWa = whatsappNumber(rawNumber)
  const waHref = cleanWa ? `https://wa.me/${cleanWa}` : 'https://wa.me/201551007018'

  return (
    <section id="contact" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800 text-xs font-black">
          <MessageSquare className="w-3.5 h-3.5" />
          <span>{isRtl ? 'تواصل مباشر مع الإدارة' : 'Direct Management Contact'}</span>
        </div>

        <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
          {isRtl ? 'الاقتراحات والشكاوى والاستفسارات' : 'Suggestions, Complaints & Inquiries'}
        </h2>

        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 font-medium">
          {isRtl
            ? 'صوتك مسموع مباشرة لدى إدارة المنصة. نتعامل مع كل رسالة بخصوصية وسرية تامة لتحسين تجربة عيادتك.'
            : 'Your message reaches platform management directly with complete privacy.'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left/Right Info Cards (5 cols) */}
        <div className="lg:col-span-5 space-y-4 landing-reveal delay-75">
          <div className="p-6 rounded-3xl bg-white dark:bg-[#081526] border border-sky-100 dark:border-slate-800 shadow-sm space-y-4 landing-card-glow">
            <h3 className="font-black text-slate-900 dark:text-white text-base">
              {isRtl ? 'قنوات الدعم الفني والمبيعات' : 'Direct Support Channels'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
              {isRtl
                ? 'فريق الدعم الفني جاهز لمساعدتك في تجهيز عيادتك وتدريب السكرتارية والرد على استفساراتك اليومية.'
                : 'Our support team is available to assist your clinic onboarding and staff.'}
            </p>

            <div className="pt-2 space-y-3">
              <a
                href={waHref}
                target="_blank"
                rel="noreferrer"
                className="landing-btn-press w-full py-3.5 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md hover:opacity-95 transition-all cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>{isRtl ? 'محادثة فورية عبر واتساب' : 'Chat on WhatsApp'}</span>
              </a>

              {contacts.map((c) => (
                <div
                  key={c.id}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block">
                      {isRtl ? c.roleTitle : c.roleTitleEn || c.roleTitle}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]" dir="ltr">
                      {c.number}
                    </span>
                  </div>
                  <a
                    href={`tel:${c.number}`}
                    className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 hover:bg-sky-100 transition-colors"
                    title="اتصال هاتفي"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </a>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 text-[11px] text-slate-400">
              <Clock className="w-3.5 h-3.5 text-sky-500 shrink-0" />
              <span>أوقات العمل والدعم: السبت إلى الخميس (09:00 ص - 10:00 م)</span>
            </div>
          </div>
        </div>

        {/* Form Container (7 cols) */}
        <div className="lg:col-span-7 landing-reveal delay-150">
          <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#081526] border border-sky-100 dark:border-slate-800 shadow-xl space-y-6 landing-card-glow">
            {isSuccess ? (
              <div className="p-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-sm">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  تم استلام رسالتك بنجاح!
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed">
                  شكراً لتواصلك مع إدارة Yalla Clinic. تم تسجيل طلبك في صندوق وارد الإدارة وستتم مراجعته والتواصل معك عند الحاجة.
                </p>
                <button
                  type="button"
                  onClick={() => setIsSuccess(false)}
                  className="px-6 py-2.5 rounded-xl bg-sky-600 text-white font-bold text-xs hover:bg-sky-500 transition-colors cursor-pointer"
                >
                  إرسال رسالة أخرى
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Type Selection Tabs */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                    نوع الرسالة
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'inquiry', label: 'استفسار عام', Icon: HelpCircle },
                      { id: 'suggestion', label: 'اقتراح تطوير', Icon: Lightbulb },
                      { id: 'complaint', label: 'شكوى أو بلاغ', Icon: AlertTriangle },
                    ].map(({ id, label, Icon }) => {
                      const active = type === id
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setType(id as any)}
                          className={`py-2.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                            active
                              ? 'bg-sky-50 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400 border-sky-300 dark:border-sky-700 shadow-xs'
                              : 'bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Sender Name & Contact */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      الاسم الكامل <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="د. أحمد محمود"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      رقم الموبايل أو البريد <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      placeholder="010XXXXXXXX أو بريد إلكتروني"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-sky-500"
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    عنوان الرسالة <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="موضوع الاستفسار أو الاقتراح..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-sky-500"
                  />
                </div>

                {/* Message Details */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    تفاصيل الرسالة <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="اكتب استفسارك أو اقتراحك أو تفاصيل الشكوى بوضوح..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-sky-500 resize-none leading-relaxed"
                  />
                </div>

                {/* Honeypot field (hidden from users) */}
                <input
                  type="text"
                  name="website"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                  className="hidden"
                  aria-hidden="true"
                />

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#0066dc] to-[#00a8e8] text-white font-black text-xs sm:text-sm shadow-md hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>جاري إرسال الرسالة...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>إرسال الرسالة إلى إدارة المنصة</span>
                      </>
                    )}
                  </button>
                </div>

                <p className="text-[11px] text-slate-400 text-center flex items-center justify-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>جميع البيانات والشكاوى سرية وتصل للإدارة العامة مباشرة.</span>
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
