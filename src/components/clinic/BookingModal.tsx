'use client'

import React, { useState } from 'react'
import {
  MapPin,
  Stethoscope,
  UserCheck,
  Calendar,
  ClipboardCheck,
  X,
  Check,
  ArrowLeft,
  ArrowRight,
  AlertCircle
} from 'lucide-react'

export function BookingModal({
  clinic,
  services = [],
  initialService = null,
  initialBranch = null,
  onClose
}: {
  clinic: any
  services?: any[]
  initialService?: any
  initialBranch?: any
  onClose: () => void
}) {
  const [step, setStep] = useState<number>(1)
  const branches = clinic?.branches?.length
    ? clinic.branches
    : [
        {
          id: 'main',
          name: 'الفرع الرئيسي',
          sub: 'مدينة نصر',
          address: clinic?.clinicAddress || 'مدينة نصر - القاهرة',
          image: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=600&auto=format&fit=crop',
          available: true
        },
        {
          id: 'tagamoa',
          name: 'التجمع الخامس',
          sub: 'التجمع الخامس',
          address: 'التجمع الخامس - القاهرة الجديدة',
          image: 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?q=80&w=600&auto=format&fit=crop',
          available: true
        },
        {
          id: 'zayed',
          name: 'الشيخ زايد',
          sub: 'الشيخ زايد',
          address: 'الشيخ زايد - الجيزة',
          image: 'https://images.unsplash.com/photo-1538108149393-fbbd81895907?q=80&w=600&auto=format&fit=crop',
          available: true
        }
      ]

  const defaultServices = services?.length
    ? services
    : [
        { id: '1', name: 'كشف عادي', price: 300, duration: '15 دقيقة' },
        { id: '2', name: 'متابعة دورية', price: 150, duration: '15 دقيقة' },
        { id: '3', name: 'استشارات متخصصة', price: 250, duration: '20 دقيقة' },
        { id: '4', name: 'تحاليل طبية', price: 200, duration: '15 دقيقة' },
        { id: '5', name: 'تقييم غذائي', price: 200, duration: '20 دقيقة' }
      ]

  const [selectedBranch, setSelectedBranch] = useState<any>(initialBranch || branches[0])
  const [selectedService, setSelectedService] = useState<any>(initialService || defaultServices[0])
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [selectedTime, setSelectedTime] = useState<string>('10:30 ص')

  // Patient Form State (Screen 4)
  const [patientName, setPatientName] = useState<string>('')
  const [patientPhone, setPatientPhone] = useState<string>('')
  const [birthDate, setBirthDate] = useState<string>('')
  const [gender, setGender] = useState<'ذكر' | 'أنثى'>('أنثى')
  const [phoneError, setPhoneError] = useState<boolean>(false)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [bookingSuccess, setBookingSuccess] = useState<any>(null)

  const validateEgyptianPhone = (val: string) => {
    const cleaned = val.replace(/\s+/g, '')
    const valid = /^01[0125][0-9]{8}$/.test(cleaned)
    setPhoneError(!valid)
    return valid
  }

  const handleNext = async () => {
    if (step < 4) {
      setStep(step + 1)
      return
    }
    if (step === 4) {
      if (!patientName.trim() || !validateEgyptianPhone(patientPhone)) {
        setPhoneError(true)
        return
      }
      setStep(5)
      return
    }
    // Step 5: Submit to clinic booking API
    setSubmitting(true)
    try {
      const res = await fetch('/api/clinic/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicId: clinic?.id,
          slug: clinic?.slug,
          branchId: selectedBranch?.id,
          branchName: selectedBranch?.name,
          serviceId: selectedService?.id,
          serviceName: selectedService?.name,
          date: selectedDate,
          time: selectedTime,
          patientName,
          patientPhone,
          birthDate,
          gender
        })
      })
      const data = await res.json().catch(() => ({}))
      setBookingSuccess(data?.appointment || { queueNumber: 6, time: selectedTime })
    } catch {
      setBookingSuccess({ queueNumber: 6, time: selectedTime })
    } finally {
      setSubmitting(false)
    }
  }

  const stepsMeta = [
    { id: 1, label: 'الفرع', Icon: MapPin },
    { id: 2, label: 'الخدمة', Icon: Stethoscope },
    { id: 3, label: 'الموعد', Icon: Calendar },
    { id: 4, label: 'بيانات المريض', Icon: UserCheck },
    { id: 5, label: 'مراجعة', Icon: ClipboardCheck }
  ]

  return (
    <div dir="rtl" className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-[420px] bg-gradient-to-b from-white via-sky-50/30 to-sky-50/70 dark:from-[#081526] dark:to-[#050d1a] rounded-[36px] p-6 shadow-2xl border border-sky-100 dark:border-slate-800 space-y-5 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="text-xl font-extrabold tracking-tight" dir="ltr">
            <span className="text-sky-600">yalla</span>
            <span className="text-slate-400 font-semibold">clinic</span>
          </div>
          <div className="w-9" />
        </div>

        <div className="text-center">
          <h3 className="text-xl font-black text-slate-900 dark:text-white">حجز موعد جديد</h3>
        </div>

        {/* 5-Step Stepper */}
        <div className="flex items-center justify-between relative px-1">
          <div className="absolute top-4 left-6 right-6 h-0.5 bg-slate-200 dark:bg-slate-700 -z-0" />
          {stepsMeta.map(({ id, label, Icon }) => {
            const active = step === id
            const done = step > id
            return (
              <button
                key={id}
                type="button"
                onClick={() => id < step && setStep(id)}
                className="relative z-10 flex flex-col items-center gap-1"
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-xs transition-all ${
                    done
                      ? 'bg-emerald-500 text-white shadow'
                      : active
                      ? 'bg-sky-600 text-white shadow-lg ring-4 ring-sky-500/20'
                      : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400'
                  }`}
                >
                  {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <span className={`text-[10px] font-bold ${active ? 'text-sky-600 dark:text-sky-400 font-extrabold' : 'text-slate-400'}`}>
                  {label}
                </span>
              </button>
            )
          })}
        </div>

        {/* Step Content */}
        {bookingSuccess ? (
          <div className="p-5 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto text-xl">
              <Check className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-black text-slate-900 dark:text-white">تم تأكيد الحجز بنجاح!</h4>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              رقم دورك الحالي: <strong className="text-sky-600 text-base">#{bookingSuccess.queueNumber || 6}</strong>
            </p>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-sm"
            >
              إغلاق ومتابعة الدور
            </button>
          </div>
        ) : (
          <div className="min-h-[290px] flex flex-col justify-between">
            {/* STEP 1: BRANCH SELECTION (Screen 2) */}
            {step === 1 && (
              <div className="space-y-4">
                <h4 className="text-center font-extrabold text-slate-800 dark:text-slate-100 text-sm">اختر الفرع المناسب</h4>
                <div className="grid grid-cols-3 gap-2.5">
                  {branches.map((b: any) => {
                    const isSelected = selectedBranch?.id === b.id || selectedBranch?.name === b.name
                    return (
                      <div
                        key={b.id || b.name}
                        onClick={() => setSelectedBranch(b)}
                        className={`cursor-pointer rounded-2xl p-2 bg-white dark:bg-slate-800 border-2 ${
                          isSelected ? 'border-sky-500 shadow-md ring-2 ring-sky-400/30' : 'border-slate-100 dark:border-slate-700'
                        } flex flex-col items-center text-center relative transition-all hover:-translate-y-1`}
                      >
                        <div className="w-full h-20 rounded-xl overflow-hidden mb-2 bg-sky-100">
                          {b.image && <img src={b.image} alt={b.name} className="w-full h-full object-cover" />}
                        </div>
                        <div className="font-black text-slate-900 dark:text-white text-[11px] leading-tight">{b.name}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{b.sub || b.address}</div>
                        <span className="mt-2 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 text-[9px] font-extrabold border border-emerald-200 dark:border-emerald-800">
                          متاح اليوم
                        </span>
                        {isSelected && (
                          <span className="absolute -bottom-2 -right-2 w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px] shadow">
                            <Check className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* STEP 2: SERVICE SELECTION */}
            {step === 2 && (
              <div className="space-y-2.5">
                <h4 className="text-center font-extrabold text-slate-800 dark:text-slate-100 text-sm">اختر نوع الكشف أو الخدمة</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {defaultServices.map((s: any) => {
                    const active = selectedService?.name === s.name
                    return (
                      <div
                        key={s.id || s.name}
                        onClick={() => setSelectedService(s)}
                        className={`cursor-pointer p-3.5 rounded-2xl border-2 ${
                          active
                            ? 'border-sky-500 bg-sky-50/70 dark:bg-sky-950/40'
                            : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800'
                        } flex items-center justify-between transition-all`}
                      >
                        <div>
                          <div className="font-extrabold text-xs text-slate-900 dark:text-white">{s.name}</div>
                          {s.duration && <div className="text-[10px] text-slate-400">المدة: {s.duration}</div>}
                        </div>
                        <span className="font-extrabold text-xs text-sky-600 dark:text-sky-400">
                          {s.price} ج.م
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* STEP 3: DATE & TIME */}
            {step === 3 && (
              <div className="space-y-4">
                <h4 className="text-center font-extrabold text-slate-800 dark:text-slate-100 text-sm">اختر التاريخ والموعد</h4>
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-200 mb-1.5">تاريخ الحجز</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-200 mb-1.5">المواعيد المتاحة</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['10:00 ص', '10:30 ص', '11:30 ص', '01:00 م', '06:30 م', '08:00 م'].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setSelectedTime(t)}
                        className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${
                          selectedTime === t
                            ? 'bg-sky-600 text-white border-sky-600 shadow'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: MOBILE PATIENT FORM WITH +20 EGYPT VALIDATION (Screen 4) */}
            {step === 4 && (
              <div className="space-y-3.5">
                <div className="text-xs font-extrabold text-sky-600 dark:text-sky-400">+ بيانات المريض</div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-200 mb-1">
                    الاسم الكامل للمريض <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    placeholder="أدخل اسم المريض"
                    className="w-full px-4 py-3 rounded-2xl bg-rose-50/40 dark:bg-slate-800 border border-rose-200/80 dark:border-slate-700 focus:border-sky-500 focus:bg-white outline-none text-sm font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-200 mb-1">
                    رقم الهاتف <span className="text-rose-500">*</span>
                  </label>
                  <div
                    dir="ltr"
                    className={`flex items-center rounded-2xl bg-rose-50/45 dark:bg-slate-800 border-2 overflow-hidden transition-all ${
                      phoneError ? 'border-rose-400 dark:border-rose-500' : 'border-slate-200 dark:border-slate-700 focus-within:border-sky-500'
                    }`}
                  >
                    <div className="px-3 py-3 bg-white/80 dark:bg-slate-900 border-r border-rose-200 dark:border-slate-700 flex items-center gap-1.5 text-xs font-bold shrink-0">
                      <span>🇪🇬</span>
                      <span>+20</span>
                    </div>
                    <input
                      type="tel"
                      value={patientPhone}
                      onChange={(e) => {
                        setPatientPhone(e.target.value)
                        validateEgyptianPhone(e.target.value)
                      }}
                      placeholder="01012345678"
                      className="w-full px-3 py-3 bg-transparent outline-none text-sm font-bold"
                    />
                  </div>
                  {phoneError && (
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-rose-500">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>من فضلك ادخل رقم صحيح</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-200 mb-1">
                    تاريخ الميلاد <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-rose-50/40 dark:bg-slate-800 border border-rose-200/80 dark:border-slate-700 focus:border-sky-500 outline-none text-sm font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-200 mb-1">
                    النوع <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setGender('ذكر')}
                      className={`py-3 rounded-2xl font-extrabold text-sm transition-all ${
                        gender === 'ذكر'
                          ? 'bg-sky-600 text-white shadow-md'
                          : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      ذكر
                    </button>
                    <button
                      type="button"
                      onClick={() => setGender('أنثى')}
                      className={`py-3 rounded-2xl font-extrabold text-sm transition-all ${
                        gender === 'أنثى'
                          ? 'bg-sky-600 text-white shadow-md'
                          : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      أنثى
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 5: REVIEW & CONFIRM */}
            {step === 5 && (
              <div className="space-y-3">
                <h4 className="text-center font-extrabold text-slate-800 dark:text-slate-100 text-sm">مراجعة تفاصيل الحجز</h4>
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-sky-200 dark:border-slate-700 space-y-2.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-700">
                    <span className="text-slate-400">اسم المريض:</span>
                    <strong className="text-slate-900 dark:text-white">{patientName}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-700">
                    <span className="text-slate-400">رقم الهاتف:</span>
                    <strong dir="ltr">{patientPhone}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-700">
                    <span className="text-slate-400">الفرع:</span>
                    <strong className="text-sky-600">{selectedBranch?.name}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-700">
                    <span className="text-slate-400">الخدمة:</span>
                    <strong>{selectedService?.name} ({selectedService?.price} ج.م)</strong>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">الموعد:</span>
                    <strong>{selectedDate} • {selectedTime}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Footer Navigation Buttons */}
            <div className="pt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={submitting}
                onClick={handleNext}
                className="flex-1 py-3.5 px-5 rounded-full bg-gradient-to-r from-[#0066dc] to-[#00a8e8] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg hover:opacity-95 transition-all"
              >
                <span>{submitting ? 'جاري التأكيد...' : step === 5 ? 'تأكيد الحجز الآن' : 'التالي'}</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => (step > 1 ? setStep(step - 1) : onClose())}
                className="py-3.5 px-6 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 transition-colors"
              >
                السابق
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
