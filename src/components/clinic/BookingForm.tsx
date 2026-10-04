'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
  const [selectedService, setSelectedService] = useState<string>(services[0]?.id || '')
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [isBooking, setIsBooking] = useState(false)
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

      const docRef = await addDoc(collection(db, 'appointments'), {
        clinic_id: clinic.id,
        patientName: name,
        phone,
        service_id: selectedService,
        serviceName: services.find(s => s.id === selectedService)?.name || 'كشف',
        date: selectedDate,
        queue_number: myQueueNumber,
        status: 'waiting',
        createdAt: new Date().toISOString()
      })
      
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
          <div className="space-y-2">
            <Label>الخدمة المطلوبة</Label>
            <Select value={selectedService} onValueChange={(v) => v && setSelectedService(v)} required>
              <SelectTrigger dir="rtl" className="h-12 text-right">
                <SelectValue placeholder="اختر الخدمة" />
              </SelectTrigger>
              <SelectContent dir="rtl">
                {services.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    {service.name} - {service.price} ج.م
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>تاريخ الكشف</Label>
            <Input 
              type="date" 
              required 
              min={new Date().toISOString().split('T')[0]} 
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="h-12 text-right"
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
