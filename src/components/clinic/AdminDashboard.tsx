'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { LogOut, UserCheck, Play, Settings, User, MessageCircle, ArrowLeft, FileText } from 'lucide-react'
import Link from 'next/link'
import { auth, db } from '@/lib/firebase'
import { signOut } from 'firebase/auth'
import { collection, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export function AdminDashboard({ clinic }: { clinic: any }) {
  const [bookings, setBookings] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    if (!clinic?.id) return
    const today = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]
    const q = query(
      collection(db, 'appointments'),
      where('clinic_id', '==', clinic.id),
      where('date', '==', today)
    )
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
      data.sort((a: any, b: any) => (a.queue_number || 0) - (b.queue_number || 0))
      setBookings(data)
      setIsLoading(false)
    })
    return () => unsubscribe()
  }, [clinic?.id])

  const patternNormalCount = clinic?.patternNormalCount || 2;
  const patternConsultCount = clinic?.patternConsultCount || 1;

  const urgentAppts = bookings.filter(b => b.serviceType === 'urgent');
  const normalAppts = bookings.filter(b => (!b.serviceType || b.serviceType === 'normal'));
  const consultAppts = bookings.filter(b => b.serviceType === 'consult');

  const fullTimeline: any[] = [...urgentAppts];
  let nIdx = 0;
  let cIdx = 0;

  while (nIdx < normalAppts.length || cIdx < consultAppts.length) {
    for (let i = 0; i < patternNormalCount; i++) {
      if (nIdx < normalAppts.length) {
        fullTimeline.push(normalAppts[nIdx]);
        nIdx++;
      }
    }
    for (let i = 0; i < patternConsultCount; i++) {
      if (cIdx < consultAppts.length) {
        fullTimeline.push(consultAppts[cIdx]);
        cIdx++;
      }
    }
  }

  const orderedWaiting = fullTimeline.filter(b => b.status === 'waiting');
  const orderedCompleted = fullTimeline.filter(b => b.status === 'completed');
  
  const orderedBookings = [...orderedWaiting, ...orderedCompleted];
  const nextPatient = orderedWaiting.length > 0 ? orderedWaiting[0] : null;

  const handleNextPatient = async () => {
    if (!nextPatient) return
    if (isProcessing) return
    
    setIsProcessing(true)
    try {
      await updateDoc(doc(db, 'appointments', nextPatient.id), {
        status: 'completed',
        completedAt: new Date().toISOString()
      })
      toast.success(`تم دخول المريض: ${nextPatient.patientName}`)
    } catch (err) {
      toast.error('حدث خطأ. حاول مرة أخرى.')
    } finally {
      setIsProcessing(false)
    }
  }

  const sendWhatsApp = (phone: string, name: string) => {
    if (!phone) return
    let formattedPhone = phone.replace(/[^0-9]/g, '')
    if (formattedPhone.startsWith('0')) formattedPhone = '2' + formattedPhone
    const message = encodeURIComponent(`مرحباً ${name}،\nيرجى التوجه إلى عيادة ${clinic?.clinicName || 'الطبيب'} الآن. اقترب دورك للدخول للكشف.`)
    window.open(`https://wa.me/${formattedPhone}?text=${message}`, '_blank')
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100 gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="w-14 h-14 border-2 border-primary/20 shadow-sm hidden md:block">
            <AvatarImage src={clinic?.heroImage} alt="Doctor" className="object-cover" />
            <AvatarFallback className="bg-primary/10 text-primary">
              <User className="w-6 h-6" />
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold text-primary">لوحة تحكم الطاقم</h1>
            <p className="text-sm text-gray-500">{clinic?.clinicName || 'العيادة الذكية'} - دور اليوم ({bookings.length})</p>
          </div>
        </div>
      </header>

      <main className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <Card className="shadow-lg border-t-4 border-t-green-500 sticky top-24">
            <CardHeader className="bg-green-50/50 border-b">
              <CardTitle className="text-xl flex items-center gap-2 text-green-700">
                <Play className="w-5 h-5 fill-current" /> التحكم في الدور
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6 flex flex-col items-center text-center">
              <div>
                <p className="text-gray-500 mb-2 font-semibold">المريض المنتظر حالياً</p>
                <div className="text-6xl font-black text-slate-900 mb-2">
                  {nextPatient ? nextPatient.queue_number : '--'}
                </div>
                <h3 className="text-xl font-bold text-primary">{nextPatient ? nextPatient.patientName : 'لا يوجد مرضى في الانتظار'}</h3>
              </div>
              <Button 
                onClick={handleNextPatient} 
                disabled={!nextPatient || isProcessing}
                className="w-full h-16 text-xl font-bold bg-green-600 hover:bg-green-700 shadow-lg shadow-green-200 hover:scale-105 transition-all text-white"
              >
                المريض التالي <ArrowLeft className="w-6 h-6 mr-2" />
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2">
          <Card className="shadow-lg border-t-4 border-t-primary">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <UserCheck className="w-5 h-5" /> سجل المرضى لليوم
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-center py-8 text-gray-500">جاري التحميل...</p>
              ) : orderedBookings.length === 0 ? (
                <p className="text-center py-8 text-gray-500">لا توجد حجوزات اليوم.</p>
              ) : (
                <div className="space-y-4">
                  {orderedBookings.map((b: any) => (
                    <div key={b.id} className={`flex flex-col md:flex-row justify-between items-start md:items-center p-4 border rounded-xl transition-colors ${b.status === 'completed' ? 'bg-slate-50 opacity-60' : 'bg-white shadow-sm hover:shadow-md border-primary/20'}`}>
                      <div className="flex items-center gap-4 mb-4 md:mb-0">
                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-col shadow-sm ${b.status === 'waiting' ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'}`}>
                          <span className="text-[10px] font-bold opacity-80">الدور</span>
                          <span className="text-xl font-black leading-none">{b.queue_number}</span>
                        </div>
                        <div>
                          <h3 className="font-bold text-lg">{b.patientName}</h3>
                          <p className="text-sm text-gray-500">{b.serviceName} | {b.phone}</p>
                          {b.paymentMethod && (
                            <div className="flex flex-wrap gap-2 mt-1">
                              {b.paymentMethod === 'cash' ? (
                                <Badge variant="outline" className={`text-xs ${b.paymentStatus === 'paid' ? 'border-green-400 text-green-700 bg-green-50' : 'bg-slate-50 text-slate-600'}`}>
                                  {b.paymentStatus === 'paid' ? 'تم الدفع بالعيادة (نقدي)' : 'الدفع بالعيادة (نقدي)'}
                                </Badge>
                              ) : (
                                <>
                                  <Badge variant="secondary" className="text-xs bg-purple-50 text-purple-700 border border-purple-200">
                                    {b.paymentMethod === 'wallet' ? 'فودافون كاش' : 'انستاباي'}
                                  </Badge>
                                  <Badge variant="outline" className={`text-xs ${b.paymentStatus === 'paid' ? 'border-green-400 text-green-700 bg-green-50' : 'border-amber-400 text-amber-700 bg-amber-50'}`}>
                                    {b.paymentStatus === 'paid' ? 'تم الدفع (أونلاين)' : 'قيد المراجعة'}
                                  </Badge>
                                  {b.transferNumber && (
                                    <span className="text-xs text-slate-500 flex items-center font-bold font-mono bg-slate-100 px-2 rounded" dir="ltr">{b.transferNumber}</span>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                        <Badge variant="outline" className={`px-3 py-1 ${b.status === 'completed' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                          {b.status === 'waiting' ? 'في الانتظار' : 'تم الكشف'}
                        </Badge>
                        <Link href={`/clinic/${clinic.slug}/admin/prescriptions?patientName=${encodeURIComponent(b.patientName || '')}&patientPhone=${encodeURIComponent(b.phone || '')}`}>
                          <Button size="sm" variant="outline" className="text-indigo-600 border-indigo-200 hover:bg-indigo-50">
                            <FileText className="w-4 h-4 ml-1" /> كتابة روشتة
                          </Button>
                        </Link>
                        {b.status === 'waiting' && b.phone && (
                          <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => sendWhatsApp(b.phone, b.patientName)}>
                            <MessageCircle className="w-4 h-4 ml-1" /> تنبيه
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
