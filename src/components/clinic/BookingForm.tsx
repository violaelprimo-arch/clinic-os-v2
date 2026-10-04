'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { toast } from 'sonner'
import { db } from '@/lib/firebase'
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore'

export function BookingForm({ 
  clinic, 
  services 
}: { 
  clinic: any
  services: any[]
}) {
  const getLocalDate = () => {
    const d = new Date()
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0]
  }

  const [selectedService, setSelectedService] = useState<string>(services[0]?.id || '')
  const [selectedDate, setSelectedDate] = useState<string>(getLocalDate())
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [isBooking, setIsBooking] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [transferNumber, setTransferNumber] = useState('')
  const [successInfo, setSuccessInfo] = useState<{ queueNumber: number, trackingId: string } | null>(null)

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault()

    setIsBooking(true)
    try {
      const q = query(
        collection(db, 'appointments'),
        where('clinic_id', '==', clinic.id),
        where('date', '==', selectedDate)
      )
      
      const querySnapshot = await getDocs(q)
      const currentQueueLength = querySnapshot.size
      const myQueueNumber = currentQueueLength + 1

      
      const serviceDetail = services.find(s => s.id === selectedService)
      
      let payStatus = 'pending'
      if (paymentMethod === 'wallet' || paymentMethod === 'instapay') payStatus = 'review'

      const newAppt = {
        clinic_id: clinic.id || clinic.slug,
        patientName: name,
        phone,
        serviceId: selectedService,
        serviceName: serviceDetail?.name || 'كشف',
        serviceType: serviceDetail?.type || 'normal',
        servicePrice: serviceDetail?.price || 0,
        date: selectedDate,
        queue_number: myQueueNumber,
        status: 'waiting',
        paymentMethod,
        paymentStatus: payStatus,
        transferNumber: paymentMethod === 'wallet' ? transferNumber : '',
        createdAt: new Date().toISOString()
      }
      const docRef = await addDoc(collection(db, 'appointments'), newAppt)

      
      setSuccessInfo({ queueNumber: myQueueNumber, trackingId: docRef.id })
      toast.success(`تم الحجز! دورك: ${myQueueNumber}`)
    } catch (error) {
      toast.error('حدث خطأ أثناء الحجز، يرجى المحاولة مرة أخرى.')
      setIsBooking(false)
    }
  }

  if (successInfo) {
    return (
      <Card className="shadow-2xl border-t-4 border-t-green-500 text-center py-8">
        <CardHeader>
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl font-black">
            {successInfo.queueNumber}
          </div>
          <CardTitle className="text-2xl text-green-700 mb-2">تم الحجز بنجاح!</CardTitle>
          <CardDescription className="text-lg">رقم دورك في العيادة هو {successInfo.queueNumber}</CardDescription>
        </CardHeader>
        <CardContent>
          <a href={`/clinic/${clinic.slug}/track/${successInfo.trackingId}`} target="_blank" rel="noreferrer">
            <Button className="w-full h-14 text-lg font-bold bg-primary hover:bg-primary/90 text-white rounded-xl">
              تابع دورك مباشرة من هنا
            </Button>
          </a>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-2xl border-t-4 border-t-primary backdrop-blur-sm bg-white/90">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold text-slate-900">احجز موعدك الآن</CardTitle>
        <CardDescription>أدخل بياناتك وسيتم تحديد دورك تلقائياً</CardDescription>
      </CardHeader>
      <form onSubmit={handleBooking}>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label>الخدمة المطلوبة</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {services.map((service) => (
                <div
                  key={service.id}
                  onClick={() => setSelectedService(service.id)}
                  className={`cursor-pointer rounded-xl border-2 p-3 text-center transition-all ${selectedService === service.id ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 bg-white text-slate-600 hover:border-primary/50 hover:bg-slate-50'}`}
                >
                  <p className="font-bold text-sm mb-1">{service.name}</p>
                  <p className="text-xs font-black">{service.price} ج.م</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>تاريخ الكشف</Label>
            <Input 
              type="date" 
              required 
              min={getLocalDate()} 
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="h-12 text-right font-bold"
              dir="rtl"
            />
          </div>

          <div className="space-y-2">
            <Label>الاسم الثلاثي</Label>
            <Input 
              placeholder="مثال: أحمد محمد محمود" 
              required 
              value={name}
              onChange={e => setName(e.target.value)}
              className="h-12"
            />
          </div>

          <div className="space-y-2">
            <Label>رقم الموبايل (واتساب)</Label>
            <Input 
              placeholder="01xxxxxxxxx" 
              type="tel" 
              required 
              dir="ltr"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="h-12 text-right"
            />
          </div>

          {/* Payment Section */}
          {clinic.onlinePaymentEnabled && (
            <div className="space-y-4 pt-4 border-t">
              <Label className="text-lg font-bold">طريقة الدفع</Label>
              <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Label className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer">
                  <RadioGroupItem value="cash" className="sr-only" />
                  <span className="font-bold">نقدي في العيادة</span>
                </Label>
                
                {clinic.walletNumber && (
                  <Label className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer">
                    <RadioGroupItem value="wallet" className="sr-only" />
                    <span className="font-bold text-center">محفظة إلكترونية<br/>(فودافون كاش)</span>
                  </Label>
                )}

                {clinic.instapayHandle && (
                  <Label className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer">
                    <RadioGroupItem value="instapay" className="sr-only" />
                    <span className="font-bold text-center">انستاباي<br/>(InstaPay)</span>
                  </Label>
                )}
              </RadioGroup>

              {paymentMethod === 'wallet' && (
                <div className="bg-blue-50 p-4 rounded-xl space-y-3">
                  <p className="font-bold text-blue-800">برجاء التحويل على رقم المحفظة التالي: <span className="text-xl" dir="ltr">{clinic.walletNumber}</span></p>
                  <div className="space-y-2">
                    <Label>رقم الموبايل الذي تم التحويل منه</Label>
                    <Input value={transferNumber} onChange={e => setTransferNumber(e.target.value)} required placeholder="01xxxxxxxxx" dir="ltr" className="bg-white" />
                  </div>
                </div>
              )}

              {paymentMethod === 'instapay' && (
                <div className="bg-purple-50 p-4 rounded-xl">
                  <p className="font-bold text-purple-800">برجاء التحويل على حساب انستاباي التالي: <span className="text-xl" dir="ltr">{clinic.instapayHandle}</span></p>
                  <p className="text-sm mt-2 text-purple-600">سيتم مراجعة الدفع وتأكيد حجزك فور وصول التحويل.</p>
                </div>
              )}
            </div>
          )}

        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full h-14 text-lg font-bold bg-slate-900 hover:bg-primary text-white rounded-xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-1" disabled={isBooking}>
            {isBooking ? 'جاري تأكيد الحجز...' : 'تأكيد الحجز والحصول على الدور'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
