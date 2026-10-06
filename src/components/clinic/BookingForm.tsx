'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle2, Clock, Users, ArrowRight, ArrowLeft,
  Calendar, Phone, User, ShieldCheck, MapPin, Sparkles,
  Zap, CreditCard, Wallet, Banknote
} from 'lucide-react'
import { toast } from 'sonner'
import { db } from '@/lib/firebase'
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore'
import Link from 'next/link'

export function BookingForm({
  clinic,
  services = [],
  defaultName = '',
  defaultPhone = '',
  preselectedServiceId = null
}: {
  clinic: any
  services?: any[]
  defaultName?: string
  defaultPhone?: string
  preselectedServiceId?: string | null
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [name, setName] = useState(defaultName)
  const [phone, setPhone] = useState(defaultPhone)
  const [age, setAge] = useState('')
  
  // Available services fallback
  const availableServices = services.length > 0 ? services : [
    { id: '1', name: 'كشف عادي', price: 250, desc: 'كشف طبي عام شامل', duration: 'حوالي 15 دقيقة' },
    { id: '2', name: 'استشارة', price: 150, desc: 'استشارة ومتابعة سريعة', duration: 'حوالي 10 دقائق' },
    { id: '3', name: 'كشف مستعجل', price: 400, desc: 'أولوية فورية في الطابور', duration: 'كشف فوري مباشر' },
    { id: '4', name: 'متابعة', price: 100, desc: 'متابعة لحالة كشف سابقة', duration: 'حوالي 10 دقائق' }
  ]

  const [selectedServiceId, setSelectedServiceId] = useState<string>(
    preselectedServiceId || availableServices[0]?.id || '1'
  )

  useEffect(() => {
    if (preselectedServiceId) {
      setSelectedServiceId(preselectedServiceId)
    }
  }, [preselectedServiceId])
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'instapay' | 'wallet'>('cash')
  const [transferNumber, setTransferNumber] = useState('')
  const [isBooking, setIsBooking] = useState(false)
  const [successInfo, setSuccessInfo] = useState<{ queueNumber: number, trackingId: string, aheadCount: number } | null>(null)

  const selectedService = availableServices.find(s => s.id === selectedServiceId) || availableServices[0]

  // Step 1 Validation
  const handleNextStep1 = () => {
    if (!name.trim()) return toast.error('يرجى إدخال اسم المريض')
    if (!phone.trim() || phone.length < 10) return toast.error('يرجى إدخال رقم هاتف صحيح')
    setStep(2)
  }

  // Step 2 Validation
  const handleNextStep2 = () => {
    setStep(3)
  }

  // Final Booking Submit
  const handleBooking = async () => {
    setIsBooking(true)
    try {
      const q = query(
        collection(db, 'appointments'),
        where('clinic_id', '==', clinic.id || clinic.slug),
        where('date', '==', selectedDate)
      )

      const querySnapshot = await getDocs(q)
      const currentQueueLength = querySnapshot.size
      const myQueueNumber = currentQueueLength + 1

      // Count waiting ahead
      let waitingCount = 0
      querySnapshot.docs.forEach(docSnap => {
        if (docSnap.data().status === 'waiting') waitingCount++
      })

      const newAppt = {
        clinic_id: clinic.id || clinic.slug,
        patientName: name,
        phone,
        age: age || null,
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        servicePrice: selectedService.price || 0,
        date: selectedDate,
        queue_number: myQueueNumber,
        status: 'waiting',
        paymentMethod,
        paymentStatus: paymentMethod === 'cash' ? 'pending' : 'paid',
        transferNumber: paymentMethod !== 'cash' ? transferNumber : '',
        createdAt: new Date().toISOString()
      }

      const docRef = await addDoc(collection(db, 'appointments'), newAppt)

      setSuccessInfo({
        queueNumber: myQueueNumber,
        trackingId: docRef.id,
        aheadCount: waitingCount
      })
      toast.success(`تم تسجيل حجزك بنجاح! دورك: ${myQueueNumber}`)
    } catch (error) {
      toast.error('حدث خطأ أثناء إتمام الحجز، يرجى المحاولة ثانيةً.')
    } finally {
      setIsBooking(false)
    }
  }

  // 1. SUCCESS SCREEN (Matching Top Center Screen 3 in Mockup)
  if (successInfo) {
    return (
      <div className="medical-card p-6 sm:p-8 max-w-lg mx-auto text-center space-y-6 shadow-2xl bg-white border border-[#E5EAF0] rounded-3xl" dir="rtl">
        {/* Success Icon */}
        <div className="w-20 h-20 bg-teal-50 border-4 border-teal-100 text-[#15B8A6] rounded-full flex items-center justify-center mx-auto shadow-md">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <div>
          <h2 className="text-2xl font-black text-[#182230]">تم تسجيل حجزك بنجاح</h2>
          <p className="text-xs text-slate-400 mt-1">مرحباً {name}، تم إدراجك في قائمة كشوفات اليوم</p>
        </div>

        {/* Big Queue Number Card */}
        <div className="bg-[#F8FAFC] border border-[#E5EAF0] rounded-3xl p-6 space-y-2">
          <p className="text-xs font-bold text-slate-400">رقمك في الدور</p>
          <div className="text-6xl font-black text-[#15B8A6] tracking-tight">
            {successInfo.queueNumber}
          </div>
        </div>

        {/* Estimation Details Grid */}
        <div className="grid grid-cols-2 gap-3 text-right">
          <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E5EAF0] space-y-1">
            <span className="text-[11px] font-bold text-slate-400">موعدك المتوقع</span>
            <p className="text-sm font-black text-[#182230]">08:35 م</p>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E5EAF0] space-y-1">
            <span className="text-[11px] font-bold text-slate-400">وقت الانتظار المتوقع</span>
            <p className="text-sm font-black text-[#15B8A6]">حوالي 42 دقيقة</p>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold flex items-center justify-center gap-2">
          <Users className="w-4 h-4 text-amber-600" />
          <span>يوجد {successInfo.aheadCount || 3} مرضى قبلك في الدور</span>
        </div>

        {/* Action CTAs */}
        <div className="space-y-2.5 pt-2">
          <Link
            href={`/clinic/${clinic.slug}/track/${successInfo.trackingId}`}
            className="block w-full"
          >
            <Button className="w-full h-12 text-sm font-black bg-[#15B8A6] hover:bg-[#0D9488] text-white rounded-xl shadow-lg shadow-[#15B8A6]/25">
              تابع الحجز والدور مباشرة
            </Button>
          </Link>

          {clinic.mapsLink ? (
            <a href={clinic.mapsLink} target="_blank" rel="noreferrer" className="block w-full">
              <Button variant="outline" className="w-full h-11 text-xs font-bold border-[#E5EAF0] text-slate-700 hover:bg-slate-50 rounded-xl">
                <MapPin className="w-4 h-4 ml-1.5 text-[#15B8A6]" />
                فتح موقع العيادة عبر الخرائط
              </Button>
            </a>
          ) : (
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="w-full h-11 text-xs font-bold border-[#E5EAF0] text-slate-700 rounded-xl"
            >
              حجز موعد جديد
            </Button>
          )}
        </div>
      </div>
    )
  }

  // 2. MULTI-STEP BOOKING FORM
  return (
    <div className="medical-card p-6 sm:p-8 max-w-lg mx-auto bg-white border border-[#E5EAF0] shadow-xl rounded-3xl space-y-6" dir="rtl">
      
      {/* Stepper Header (1: البيانات -> 2: نوع الكشف -> 3: التأكيد) */}
      <div className="border-b border-[#E5EAF0] pb-5">
        <div className="flex items-center justify-between text-center relative px-2">
          {/* Progress Connecting Line */}
          <div className="absolute top-4 inset-x-8 h-0.5 bg-slate-200 -z-0">
            <div
              className="h-full bg-[#15B8A6] transition-all duration-300"
              style={{ width: step === 1 ? '0%' : step === 2 ? '50%' : '100%' }}
            ></div>
          </div>

          {/* Stepper Points */}
          {[
            { num: 1, label: 'البيانات' },
            { num: 2, label: 'نوع الكشف' },
            { num: 3, label: 'التأكيد' }
          ].map(s => {
            const isCompleted = step > s.num
            const isCurrent = step === s.num
            return (
              <div key={s.num} className="flex flex-col items-center relative z-10">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                    isCurrent
                      ? 'bg-[#15B8A6] text-white ring-4 ring-teal-100 shadow-md'
                      : isCompleted
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white border-2 border-slate-300 text-slate-400'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                </div>
                <span className={`text-[11px] font-bold mt-1.5 ${isCurrent ? 'text-[#15B8A6]' : 'text-slate-400'}`}>
                  {s.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* STEP 1: Basic Information */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="font-bold text-base text-[#182230]">البيانات الأساسية</h3>
            <p className="text-xs text-slate-400">أدخل بيانات المريض للتواصل وتنظيم الدور</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">رقم الهاتف (واتساب)</Label>
            <Input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="01012345678"
              type="tel"
              className="h-12 text-sm font-mono text-right rounded-xl bg-[#F6F8FB] border-[#E5EAF0] focus:bg-white"
              dir="ltr"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">اسم المريض</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="مثال: محمد أحمد"
              className="h-12 text-sm rounded-xl bg-[#F6F8FB] border-[#E5EAF0] focus:bg-white"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">السن (اختياري)</Label>
            <Input
              value={age}
              onChange={e => setAge(e.target.value)}
              placeholder="25"
              type="number"
              className="h-12 text-sm rounded-xl bg-[#F6F8FB] border-[#E5EAF0] focus:bg-white"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">تاريخ الحجز</Label>
            <Input
              type="date"
              value={selectedDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={e => setSelectedDate(e.target.value)}
              className="h-12 text-sm rounded-xl bg-[#F6F8FB] border-[#E5EAF0] focus:bg-white"
            />
          </div>

          <Button
            onClick={handleNextStep1}
            className="w-full h-12 text-sm font-black bg-[#15B8A6] hover:bg-[#0D9488] text-white rounded-xl shadow-md shadow-[#15B8A6]/20 mt-2"
          >
            التالي
            <ArrowLeft className="w-4 h-4 mr-2" />
          </Button>
        </div>
      )}

      {/* STEP 2: Choose Service Type (Matching Screen 2 in Mockup) */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="font-bold text-base text-[#182230]">اختر نوع الكشف</h3>
            <p className="text-xs text-slate-400">حدد الخدمة المطلوبة لمعرفة مدة الانتظار والتكلفة</p>
          </div>

          <div className="space-y-3">
            {availableServices.map((service) => {
              const isSelected = selectedServiceId === service.id
              return (
                <div
                  key={service.id}
                  onClick={() => setSelectedServiceId(service.id)}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'border-[#15B8A6] bg-teal-50/40 shadow-sm'
                      : 'border-[#E5EAF0] hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        isSelected ? 'border-[#15B8A6] bg-[#15B8A6]' : 'border-slate-300'
                      }`}
                    >
                      {isSelected && <div className="w-2 h-2 rounded-full bg-white"></div>}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-sm text-[#182230]">{service.name}</h4>
                        {service.name.includes('مستعجل') && (
                          <Badge className="bg-amber-100 text-amber-800 border-none text-[10px] font-bold">
                            أولوية في الدور
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {service.desc || 'كشف طبي معتمد'} • {service.duration || 'حوالي 15 دقيقة'}
                      </p>
                    </div>
                  </div>

                  <span className="text-sm font-black text-[#15B8A6] shrink-0">
                    {service.price} ج.م
                  </span>
                </div>
              )
            })}
          </div>

          <div className="flex gap-2.5 pt-2">
            <Button
              onClick={handleNextStep2}
              className="flex-1 h-12 text-sm font-black bg-[#15B8A6] hover:bg-[#0D9488] text-white rounded-xl shadow-md shadow-[#15B8A6]/20"
            >
              التالي
              <ArrowLeft className="w-4 h-4 mr-2" />
            </Button>
            <Button
              variant="outline"
              onClick={() => setStep(1)}
              className="h-12 px-5 text-xs font-bold border-[#E5EAF0] text-slate-700 rounded-xl"
            >
              رجوع
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: Confirmation & Payment */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="font-bold text-base text-[#182230]">تأكيد الحجز وطريقة الدفع</h3>
            <p className="text-xs text-slate-400">راجع تفاصيل الموعد قبل الاعتماد</p>
          </div>

          {/* Booking Summary Box */}
          <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E5EAF0] space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-400 font-bold">المريض:</span>
              <span className="font-bold text-[#182230]">{name} ({phone})</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-400 font-bold">الخدمة:</span>
              <span className="font-bold text-[#182230]">{selectedService.name}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-400 font-bold">تاريخ الكشف:</span>
              <span className="font-bold font-mono text-[#182230]">{selectedDate}</span>
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-slate-600 font-bold">الإجمالي المستحق:</span>
              <span className="font-black text-base text-[#15B8A6]">{selectedService.price} ج.م</span>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-2">
            <Label className="text-xs font-bold text-slate-600">اختر طريقة السداد</Label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`p-3 rounded-xl border text-center transition-all ${
                  paymentMethod === 'cash'
                    ? 'border-[#15B8A6] bg-teal-50 text-[#15B8A6] font-black'
                    : 'border-[#E5EAF0] bg-white text-slate-600 font-bold'
                }`}
              >
                <Banknote className="w-5 h-5 mx-auto mb-1" />
                <span className="text-xs">كاش بالعيادة</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('instapay')}
                className={`p-3 rounded-xl border text-center transition-all ${
                  paymentMethod === 'instapay'
                    ? 'border-[#15B8A6] bg-teal-50 text-[#15B8A6] font-black'
                    : 'border-[#E5EAF0] bg-white text-slate-600 font-bold'
                }`}
              >
                <CreditCard className="w-5 h-5 mx-auto mb-1" />
                <span className="text-xs">انستاباي</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('wallet')}
                className={`p-3 rounded-xl border text-center transition-all ${
                  paymentMethod === 'wallet'
                    ? 'border-[#15B8A6] bg-teal-50 text-[#15B8A6] font-black'
                    : 'border-[#E5EAF0] bg-white text-slate-600 font-bold'
                }`}
              >
                <Wallet className="w-5 h-5 mx-auto mb-1" />
                <span className="text-xs">فودافون كاش</span>
              </button>
            </div>
          </div>

          {paymentMethod !== 'cash' && (
            <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <Label className="text-xs font-bold text-slate-600">رقم المحفظة / المعاملة المحول منها</Label>
              <Input
                value={transferNumber}
                onChange={e => setTransferNumber(e.target.value)}
                placeholder="010xxxxxxxx"
                className="h-10 text-xs bg-white rounded-lg"
              />
            </div>
          )}

          <div className="flex gap-2.5 pt-2">
            <Button
              onClick={handleBooking}
              disabled={isBooking}
              className="flex-1 h-12 text-sm font-black bg-[#15B8A6] hover:bg-[#0D9488] text-white rounded-xl shadow-lg shadow-[#15B8A6]/25"
            >
              {isBooking ? 'جاري تأكيد الحجز...' : 'تأكيد الحجز النهائي'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setStep(2)}
              className="h-12 px-5 text-xs font-bold border-[#E5EAF0] text-slate-700 rounded-xl"
            >
              رجوع
            </Button>
          </div>
        </div>
      )}

    </div>
  )
}
