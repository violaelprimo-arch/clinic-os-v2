'use client'

import React, { useState, useEffect } from 'react'
import { ShieldCheck, Phone, KeyRound, Loader2, AlertCircle, ArrowRight, RefreshCw, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { useLanguage } from '@/context/LanguageContext'

interface PatientRecordVerificationProps {
  slug: string
  recordId: string
  recordType: 'prescription' | 'invoice'
  maskedPhone?: string
  clinicName?: string
  onVerified: () => void
}

export function PatientRecordVerificationModal({
  slug,
  recordId,
  recordType,
  maskedPhone = '',
  clinicName = 'Yalla Clinic',
  onVerified
}: PatientRecordVerificationProps) {
  const { t, isRtl, dir } = useLanguage()

  const [phoneInput, setPhoneInput] = useState('')
  const [codeInput, setCodeInput] = useState('')
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [challengeToken, setChallengeToken] = useState('')
  const [demoCode, setDemoCode] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(0)

  useEffect(() => {
    let timer: NodeJS.Timeout
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(c => c - 1), 1000)
    }
    return () => clearTimeout(timer)
  }, [countdown])

  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!phoneInput.trim()) {
      setErrorMessage(isRtl ? 'يرجى إدخال رقم الهاتف المسجل' : 'Please enter your registered phone number')
      return
    }

    setLoading(true)
    setErrorMessage('')

    try {
      const res = await fetch('/api/patient/record-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'request-otp',
          slug,
          recordId,
          recordType,
          phone: phoneInput.trim()
        })
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        setErrorMessage(data.error || (isRtl ? 'تعذر إرسال رمز التحقق، يرجى التأكد من رقم الهاتف' : 'Failed to send verification code'))
        setLoading(false)
        return
      }

      setChallengeToken(data.challengeToken)
      if (data.demoCode) {
        setDemoCode(data.demoCode)
      }
      setStep('otp')
      setCountdown(60)
      toast.success(isRtl ? 'تم إرسال رمز التحقق بنجاح' : 'Verification code sent successfully')
    } catch (err: any) {
      setErrorMessage(isRtl ? 'حدث خطأ في الاتصال بالخادم، يرجى المحاولة مرة أخرى' : 'Network error, please try again')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!codeInput.trim()) {
      setErrorMessage(isRtl ? 'يرجى إدخال رمز التحقق المكون من 6 أرقام' : 'Please enter the 6-digit verification code')
      return
    }

    setLoading(true)
    setErrorMessage('')

    try {
      const res = await fetch('/api/patient/record-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify-otp',
          slug,
          recordId,
          recordType,
          code: codeInput.trim(),
          challengeToken
        })
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        setErrorMessage(data.error || (isRtl ? 'رمز التحقق غير صحيح، يرجى المحاولة مرة أخرى' : 'Invalid verification code'))
        setLoading(false)
        return
      }

      toast.success(isRtl ? 'تم تأكيد الهوية بنجاح، جاري فتح المستند...' : 'Identity verified, opening document...')
      onVerified()
    } catch (err: any) {
      setErrorMessage(isRtl ? 'حدث خطأ أثناء التحقق، يرجى المحاولة مرة أخرى' : 'Verification error, please try again')
    } finally {
      setLoading(false)
    }
  }

  const titleText = recordType === 'prescription'
    ? (isRtl ? 'الروشتة الطبية محمية' : 'Protected Medical Prescription')
    : (isRtl ? 'الفاتورة الإلكترونية محمية' : 'Protected Electronic Invoice')

  const descText = recordType === 'prescription'
    ? (isRtl ? 'حفاظاً على سرية بياناتك الطبية، يُرجى تأكيد رقم هاتفك المسجل بالعيادة لفتح الروشتة.' : 'To protect your medical privacy, please confirm your registered phone number.')
    : (isRtl ? 'حفاظاً على سرية بياناتك المالية، يُرجى تأكيد رقم هاتفك المسجل بالعيادة لفتح الفاتورة.' : 'To protect your billing privacy, please confirm your registered phone number.')

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4" dir={dir}>
      <div className="w-full max-w-md bg-card border border-border rounded-3xl p-6 sm:p-8 text-center space-y-6 shadow-xl relative overflow-hidden">
        
        {/* Header Icon */}
        <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-inner">
          <ShieldCheck className="w-8 h-8" />
        </div>

        {/* Title & Description */}
        <div className="space-y-2">
          <div className="text-xs font-bold text-primary px-3 py-1 bg-primary/10 rounded-full inline-block">
            {clinicName}
          </div>
          <h2 className="text-lg font-black text-foreground">
            {titleText}
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {descText}
          </p>
          {maskedPhone && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-muted text-[11px] font-mono text-foreground font-bold">
              <Phone className="w-3.5 h-3.5 text-primary" />
              <span>{isRtl ? 'الرقم المسجل:' : 'Registered:'} {maskedPhone}</span>
            </div>
          )}
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2 text-right">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="flex-1 font-medium">{errorMessage}</span>
          </div>
        )}

        {/* Step 1: Enter Phone Number */}
        {step === 'phone' && (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div className="space-y-1.5 text-right">
              <label className="text-xs font-bold text-foreground">
                {isRtl ? 'رقم الهاتف المسجل لدى العيادة:' : 'Registered Phone Number:'}
              </label>
              <div className="relative" dir="ltr">
                <Input
                  type="tel"
                  placeholder="01012345678"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  className="h-11 px-3.5 text-sm font-mono text-center rounded-xl border-border bg-background focus:ring-2 focus:ring-primary"
                  autoFocus
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                {isRtl ? 'أدخل رقم الموبايل الذي قمت بالحجز به في العيادة' : 'Enter the phone number used during booking'}
              </p>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 yalla-gradient-btn text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              ) : (
                <>
                  <KeyRound className={`w-4 h-4 ${isRtl ? 'ml-1.5' : 'mr-1.5'}`} />
                  {isRtl ? 'إرسال رمز التحقق' : 'Send Verification Code'}
                </>
              )}
            </Button>
          </form>
        )}

        {/* Step 2: Enter OTP Code */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="space-y-1.5 text-right">
              <div className="flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => { setStep('phone'); setErrorMessage(''); }}
                  className="text-[11px] text-primary hover:underline font-bold inline-flex items-center gap-1"
                >
                  <ArrowRight className="w-3 h-3 rtl:rotate-0 ltr:rotate-180" />
                  <span>{isRtl ? 'تغيير الرقم' : 'Change Phone'}</span>
                </button>
                <label className="text-xs font-bold text-foreground">
                  {isRtl ? 'رمز التحقق (OTP):' : 'Verification Code (OTP):'}
                </label>
              </div>

              <div className="relative" dir="ltr">
                <Input
                  type="text"
                  maxLength={6}
                  placeholder="• • • • • •"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, ''))}
                  className="h-12 px-3 text-lg font-mono tracking-widest text-center rounded-xl border-border bg-background focus:ring-2 focus:ring-primary font-black"
                  autoFocus
                />
              </div>

              {/* Demo Helper Pill */}
              {demoCode && (
                <div
                  onClick={() => setCodeInput(demoCode)}
                  className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center justify-between cursor-pointer hover:bg-emerald-500/20 transition-colors"
                >
                  <span className="text-[11px] font-bold">
                    {isRtl ? 'رمز تجريبي للاختبار السريع (اضغط للتعبئة):' : 'Demo Test Code (click to autofill):'}
                  </span>
                  <span className="font-mono font-black text-sm bg-background px-2 py-0.5 rounded border border-emerald-500/30">
                    {demoCode}
                  </span>
                </div>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 yalla-gradient-btn text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              ) : (
                <>
                  <CheckCircle2 className={`w-4 h-4 ${isRtl ? 'ml-1.5' : 'mr-1.5'}`} />
                  {isRtl ? 'تأكيد وفتح الروشتة' : 'Verify & Open'}
                </>
              )}
            </Button>

            {/* Resend Code Button */}
            <div className="pt-1">
              <Button
                type="button"
                variant="ghost"
                disabled={countdown > 0 || loading}
                onClick={() => handleRequestOtp()}
                className="text-xs text-muted-foreground hover:text-foreground h-8"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${countdown > 0 ? '' : 'text-primary'} ${isRtl ? 'ml-1' : 'mr-1'}`} />
                {countdown > 0
                  ? (isRtl ? `إعادة الإرسال بعد ${countdown} ثانية` : `Resend in ${countdown}s`)
                  : (isRtl ? 'إعادة إرسال رمز التحقق' : 'Resend Code')}
              </Button>
            </div>
          </form>
        )}

      </div>
    </div>
  )
}
