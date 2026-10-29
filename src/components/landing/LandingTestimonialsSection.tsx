'use client'

import React, { useState } from 'react'
import {
  Star,
  MessageSquarePlus,
  Building2,
  Quote,
  Sparkles,
  CheckCircle2,
  Loader2,
  X,
} from 'lucide-react'
import { type FeedbackItem, type ClientItem } from '@/lib/landing-config'
import { useLanguage } from '@/context/LanguageContext'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { toast } from 'sonner'

interface LandingTestimonialsSectionProps {
  feedbacks: FeedbackItem[]
  clients: ClientItem[]
  showFeedback: boolean
  showClients: boolean
}

export function LandingTestimonialsSection({
  feedbacks = [],
  clients = [],
  showFeedback = true,
  showClients = true,
}: LandingTestimonialsSectionProps) {
  const { isRtl } = useLanguage()
  const [modalOpen, setModalOpen] = useState(false)

  // Feedback form state
  const [authorName, setAuthorName] = useState('')
  const [clinicName, setClinicName] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const approvedFeedbacks = (feedbacks || []).filter(
    (f) => f.approved && f.visible !== false
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!authorName.trim() || !clinicName.trim() || !comment.trim()) {
      toast.error('يرجى ملء جميع الحقول المطلوبة')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/landing/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorName: authorName.trim(),
          clinicName: clinicName.trim(),
          specialty: specialty.trim() || 'طب عام',
          rating: Number(rating),
          comment: comment.trim(),
          website: honeypot,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'تعذر إرسال التقييم')
      }

      setSubmitted(true)
      toast.success('تم إرسال تقييمك بنجاح!')
    } catch (err: any) {
      console.error('Feedback submit error:', err)
      toast.error(err?.message || 'تعذر إرسال التقييم، يرجى المحاولة ثانيةً')
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setAuthorName('')
    setClinicName('')
    setSpecialty('')
    setRating(5)
    setComment('')
    setHoneypot('')
    setSubmitted(false)
  }

  return (
    <section id="testimonials" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-16">
      {/* 1. Partner Clinics / Logos */}
      {showClients && clients && clients.length > 0 && (
        <div className="space-y-6 text-center">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            {isRtl ? 'عيادات ومراكز طبية تثق في يلا كلينيك' : 'Trusted by Leading Clinics & Medical Centers'}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
            {clients.map((c) => (
              <div
                key={c.id}
                className="p-3 rounded-2xl bg-white dark:bg-[#081526] border border-sky-100 dark:border-slate-800 shadow-xs flex items-center gap-3 hover:scale-105 transition-transform"
              >
                {c.logoUrl ? (
                  <img
                    src={c.logoUrl}
                    alt={c.name}
                    className="w-10 h-10 rounded-xl object-contain"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950 text-sky-600 flex items-center justify-center font-black">
                    <Building2 className="w-5 h-5" />
                  </div>
                )}
                <div className="text-right">
                  <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block">
                    {isRtl ? c.name : c.nameEn || c.name}
                  </span>
                  {c.specialty && (
                    <span className="text-[10px] text-slate-400">
                      {isRtl ? c.specialty : c.specialtyEn || c.specialty}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Doctor Testimonials Section */}
      {showFeedback && (
        <div className="space-y-10">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-sky-100 dark:border-slate-800/80 pb-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800 text-xs font-black">
                <Quote className="w-3.5 h-3.5 text-sky-600" />
                <span>{isRtl ? 'تجارب حقيقية' : 'Doctor Reviews'}</span>
              </div>

              <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                {isRtl ? 'ماذا يقول الأطباء عن تجربة يلا كلينيك؟' : 'What Doctors Say About Yalla Clinic'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                {isRtl
                  ? 'آراء وتقييمات موثقة من أطباء واستشاريين يديرون عياداتهم عبر المنظومة'
                  : 'Verified experiences from doctors and consultants using Yalla Clinic OS daily'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                resetForm()
                setModalOpen(true)
              }}
              className="px-5 py-3 rounded-2xl bg-white dark:bg-[#081526] hover:bg-slate-50 dark:hover:bg-slate-800 border border-sky-200 dark:border-slate-700 text-sky-600 dark:text-sky-400 font-bold text-xs sm:text-sm shadow-xs flex items-center justify-center gap-2 transition-all hover:border-sky-400 cursor-pointer self-start sm:self-auto shrink-0"
            >
              <MessageSquarePlus className="w-4 h-4" />
              <span>{isRtl ? 'شارك تجربتك كطبيب / عيادة' : 'Share Your Experience'}</span>
            </button>
          </div>

          {approvedFeedbacks.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {approvedFeedbacks.map((f, idx) => {
                const delayClass = idx % 3 === 0 ? 'delay-75' : idx % 3 === 1 ? 'delay-150' : 'delay-225'
                return (
                  <div
                    key={f.id}
                    className={`landing-reveal ${delayClass} landing-card-glow p-6 rounded-3xl bg-white dark:bg-[#081526] border border-sky-100 dark:border-slate-800 shadow-sm space-y-4 flex flex-col justify-between hover:border-sky-300 dark:hover:border-slate-700 transition-all active:scale-[0.99]`}
                  >
                    <div className="space-y-3">
                      {/* Rating stars */}
                      <div className="flex items-center gap-1 text-amber-400">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`w-4 h-4 ${
                              i < f.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200 dark:text-slate-700'
                            }`}
                          />
                        ))}
                      </div>

                      <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                        "{f.comment}"
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-500 text-white flex items-center justify-center font-black text-sm shrink-0 overflow-hidden shadow-xs">
                        {f.avatarUrl ? (
                          <img src={f.avatarUrl} alt={f.authorName} className="w-full h-full object-cover" />
                        ) : (
                          <span>{f.authorName.charAt(0)}</span>
                        )}
                      </div>
                      <div>
                        <h4 className="font-black text-xs text-slate-900 dark:text-white">
                          {f.authorName}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {f.clinicName} {f.specialty ? `• ${f.specialty}` : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            /* Honest, Elegant Invitation Card when 0 reviews approved yet (Section NEVER disappears) */
            <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-br from-sky-500/5 via-sky-500/10 to-indigo-500/5 border border-sky-200/60 dark:border-slate-800 text-center space-y-4 max-w-2xl mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-sky-600/10 text-sky-600 dark:text-sky-400 flex items-center justify-center mx-auto">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                {isRtl
                  ? 'كن أول من يشارك تجربته مع منصة يلا كلينيك'
                  : 'Be the First to Share Your Experience with Yalla Clinic'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed">
                {isRtl
                  ? 'نعتز بشراكتنا مع الأطباء والمراكز الطبية. يسعدنا استقبال تقييمك وتجربتك المهنية في تنظيم وإدارة عيادتك معنا.'
                  : 'We value our partnerships with doctors and medical centers. Share your feedback and professional experience with us.'}
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    resetForm()
                    setModalOpen(true)
                  }}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-[#0066dc] to-[#00a8e8] text-white font-bold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all cursor-pointer inline-flex items-center gap-2"
                >
                  <MessageSquarePlus className="w-4 h-4" />
                  <span>{isRtl ? 'شارك تجربتك الآن كطبيب أو عيادة' : 'Submit Your Review Now'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SHARE EXPERIENCE MODAL */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#081526] border border-sky-100 dark:border-slate-800 space-y-4">
          <DialogHeader className="text-right">
            <DialogTitle className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
              {isRtl ? 'شارك تجربتك مع منصة يلا كلينيك' : 'Share Your Experience with Yalla Clinic'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              {isRtl
                ? 'رأيك يساعد زملاءك الأطباء ويساهم في تطوير المنصة باستمرار. يُنشر التقييم بعد اعتماده.'
                : 'Your feedback helps other doctors and helps us improve. Reviews are displayed upon approval.'}
            </DialogDescription>
          </DialogHeader>

          {submitted ? (
            <div className="py-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h4 className="font-black text-base text-slate-900 dark:text-white">
                شكرًا جزيلاً لمشاركتك!
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                تم استلام تقييمك ورأيك بنجاح. سيتم مراجعته واعتماده من إدارة المنصة ليظهر على الصفحة الرئيسية.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false)
                    setSubmitted(false)
                  }}
                  className="px-6 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
                >
                  إغلاق
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    اسم الطبيب / الاستشاري *
                  </label>
                  <input
                    type="text"
                    required
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    placeholder="د. أحمد مصطفى"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    اسم العيادة / المركز *
                  </label>
                  <input
                    type="text"
                    required
                    value={clinicName}
                    onChange={(e) => setClinicName(e.target.value)}
                    placeholder="عيادة الشفاء التخصصية"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  التخصص الطبي
                </label>
                <input
                  type="text"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  placeholder="استشاري الباطنة والقلب"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none focus:border-sky-500"
                />
              </div>

              {/* Star Rating Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  التقييم العام
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="p-1 cursor-pointer hover:scale-110 transition-transform"
                    >
                      <Star
                        className={`w-6 h-6 ${
                          star <= rating
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-200 dark:text-slate-700'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-xs font-bold text-slate-500 mr-2">
                    ({rating} من 5)
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  رأيك وتقييمك للتجربة *
                </label>
                <textarea
                  required
                  rows={4}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="شاركنا رأيك في تجربة استخدام النظام: حجز المواعيد، متابعة الدور، الروشتات، تنظيم العيادة..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none focus:border-sky-500 resize-none"
                />
              </div>

              {/* Honeypot field - hidden from real users */}
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                style={{ display: 'none' }}
                aria-hidden="true"
              />

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#0066dc] to-[#00a8e8] text-white text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-md"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>إرسال التقييم</span>
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}
