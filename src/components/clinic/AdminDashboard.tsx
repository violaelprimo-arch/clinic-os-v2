'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Calendar, Users, Clock, CheckCircle2, DollarSign,
  Play, MessageCircle, ArrowLeft, ArrowRight, UserCheck,
  UserX, SkipForward, FileSignature, Phone, Filter,
  Sparkles, AlertCircle, ChevronDown, RefreshCw
} from 'lucide-react'
import Link from 'next/link'
import { db } from '@/lib/firebase'
import { collection, query, where, onSnapshot, updateDoc, doc, Timestamp } from 'firebase/firestore'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export function AdminDashboard({ clinic }: { clinic: any }) {
  const [bookings, setBookings] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [serviceFilter, setServiceFilter] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (!clinic?.id) return
    const today = new Date().toISOString().split('T')[0]
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

  // Categorize bookings
  const currentPatient = useMemo(() => {
    return bookings.find(b => b.status === 'in_progress') || null
  }, [bookings])

  const waitingPatients = useMemo(() => {
    return bookings.filter(b => b.status === 'waiting')
  }, [bookings])

  const nextPatient = useMemo(() => {
    return waitingPatients.length > 0 ? waitingPatients[0] : null
  }, [waitingPatients])

  const completedPatients = useMemo(() => {
    return bookings.filter(b => b.status === 'completed')
  }, [bookings])

  // Calculate totals
  const totalRevenue = useMemo(() => {
    return bookings.reduce((sum, b) => sum + (Number(b.servicePrice) || 0), 0)
  }, [bookings])

  // Filtered queue for table
  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      const matchesService = serviceFilter === 'ALL' || b.serviceId === serviceFilter || b.serviceName === serviceFilter
      const matchesSearch = !searchQuery ||
        (b.patientName && b.patientName.includes(searchQuery)) ||
        (b.phone && b.phone.includes(searchQuery))
      return matchesService && matchesSearch
    })
  }, [bookings, serviceFilter, searchQuery])

  // Action Handlers
  const handleStartExam = async (patient: any) => {
    if (!patient || isProcessing) return
    setIsProcessing(true)
    try {
      // If someone is currently in progress, complete them first or switch
      if (currentPatient && currentPatient.id !== patient.id) {
        await updateDoc(doc(db, 'appointments', currentPatient.id), {
          status: 'completed',
          completedAt: new Date().toISOString()
        })
      }

      await updateDoc(doc(db, 'appointments', patient.id), {
        status: 'in_progress',
        startedAt: new Date().toISOString()
      })
      toast.success(`بدأ كشف المريض: ${patient.patientName}`)
    } catch (err) {
      toast.error('حدث خطأ أثناء بدء الكشف.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCompleteExam = async (patientId: string, patientName: string) => {
    if (isProcessing) return
    setIsProcessing(true)
    try {
      await updateDoc(doc(db, 'appointments', patientId), {
        status: 'completed',
        completedAt: new Date().toISOString()
      })
      toast.success(`تم إنهاء كشف: ${patientName}`)
    } catch (err) {
      toast.error('حدث خطأ أثناء إنهاء الكشف.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSkipPatient = async (patientId: string) => {
    if (isProcessing) return
    setIsProcessing(true)
    try {
      await updateDoc(doc(db, 'appointments', patientId), {
        status: 'skipped'
      })
      toast.info('تم تخطي دور المريض مؤقتاً.')
    } catch (err) {
      toast.error('حدث خطأ أثناء تخطي المريض.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleNoShow = async (patientId: string) => {
    if (isProcessing) return
    setIsProcessing(true)
    try {
      await updateDoc(doc(db, 'appointments', patientId), {
        status: 'no_show'
      })
      toast.warning('تم تسجيل المريض: لم يحضر')
    } catch (err) {
      toast.error('حدث خطأ أثناء تسجيل الغياب.')
    } finally {
      setIsProcessing(false)
    }
  }

  const sendWhatsApp = (phone: string, name: string) => {
    if (!phone) return
    let formattedPhone = phone.replace(/[^0-9]/g, '')
    if (formattedPhone.startsWith('0')) formattedPhone = '2' + formattedPhone
    const message = encodeURIComponent(
      `مرحباً ${name}،\nيرجى التوجه إلى عيادة ${clinic?.clinicName || 'الطبيب'} الآن. اقترب دورك للدخول للكشف.\nنتمنى لك دوام الصحة والعافية.`
    )
    window.open(`https://wa.me/${formattedPhone}?text=${message}`, '_blank')
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_progress':
        return <Badge className="bg-[#15B8A6] text-white hover:bg-[#15B8A6] border-none font-bold px-3 py-1">بالداخل</Badge>
      case 'waiting':
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200 font-bold px-3 py-1">في الانتظار</Badge>
      case 'completed':
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200 font-bold px-3 py-1">تم الكشف</Badge>
      case 'skipped':
        return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 border-slate-200 font-bold px-3 py-1">تخطي</Badge>
      case 'no_show':
        return <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 border-rose-200 font-bold px-3 py-1">لم يحضر</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto" dir="rtl">
      
      {/* 1. TOP STATS CARDS (4 Cards Grid matching Mockup) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Bookings */}
        <div className="medical-card p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 mb-1">إجمالي الحجوزات</p>
            <h3 className="text-3xl font-black text-[#182230]">{bookings.length}</h3>
            <span className="text-[11px] font-semibold text-slate-400 mt-1 inline-block">حجز مسجل اليوم</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-[#15B8A6]">
            <Calendar className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Waiting */}
        <div className="medical-card p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 mb-1">في الانتظار</p>
            <h3 className="text-3xl font-black text-amber-600">{waitingPatients.length}</h3>
            <span className="text-[11px] font-semibold text-amber-600/80 mt-1 inline-block">بانتظار الدخول</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-500">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Completed */}
        <div className="medical-card p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 mb-1">تم الكشف</p>
            <h3 className="text-3xl font-black text-[#2F80ED]">{completedPatients.length}</h3>
            <span className="text-[11px] font-semibold text-[#2F80ED]/80 mt-1 inline-block">زيارات مكتملة</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2F80ED]">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Total Revenue */}
        <div className="medical-card p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 mb-1">إجمالي الإيرادات</p>
            <h3 className="text-3xl font-black text-emerald-600">
              {totalRevenue.toLocaleString()} <span className="text-base font-bold text-slate-500">ج.م</span>
            </h3>
            <span className="text-[11px] font-semibold text-emerald-600/80 mt-1 inline-block">تحصيل اليوم</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-500">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 2. MAIN WORKSPACE (Queue Table & Live Patient Control Panels) */}
      <div className="grid lg:grid-cols-12 gap-6 items-start">
        
        {/* RIGHT COLUMN: Today Queue Table (8 cols on lg) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="medical-card overflow-hidden">
            {/* Header with Title and Filter Dropdown */}
            <div className="p-5 border-b border-[#E5EAF0] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-[#15B8A6] flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#182230]">طابور اليوم</h2>
                  <p className="text-xs text-slate-400">قائمة المرضى والمواعيد المسجلة لتاريخ اليوم</p>
                </div>
              </div>

              {/* Service Filter */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative">
                  <select
                    value={serviceFilter}
                    onChange={(e) => setServiceFilter(e.target.value)}
                    className="h-9 pr-8 pl-3 rounded-xl bg-white border border-[#E5EAF0] text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#15B8A6]/20 focus:border-[#15B8A6] cursor-pointer appearance-none"
                  >
                    <option value="ALL">كل الخدمات</option>
                    {clinic?.services?.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                    {!clinic?.services?.length && (
                      <>
                        <option value="كشف عادي">كشف عادي</option>
                        <option value="استشارة">استشارة</option>
                        <option value="كشف مستعجل">كشف مستعجل</option>
                      </>
                    )}
                  </select>
                  <Filter className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Patients List Table */}
            <div className="p-0">
              {isLoading ? (
                <div className="py-16 text-center text-slate-400">
                  <div className="w-8 h-8 border-2 border-[#15B8A6] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                  جاري تحميل الطابور...
                </div>
              ) : filteredBookings.length === 0 ? (
                <div className="py-16 text-center text-slate-400 space-y-3">
                  <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                    <Calendar className="w-8 h-8" />
                  </div>
                  <h4 className="font-bold text-base text-slate-700">لا توجد حجوزات مسجلة اليوم</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    يمكن للمرضى حجز المواعيد عبر رابط العيادة المباشر، أو يمكنك إضافة موعد يدوي.
                  </p>
                  <Link href={`/clinic/${clinic.slug}`} target="_blank">
                    <Button variant="outline" size="sm" className="mt-2 text-xs font-bold border-[#15B8A6] text-[#15B8A6]">
                      فتح صفحة الحجز
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-[#E5EAF0]">
                  {filteredBookings.map((b) => {
                    const isCurrent = b.status === 'in_progress'
                    return (
                      <div
                        key={b.id}
                        className={`p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors ${
                          isCurrent
                            ? 'bg-[#E6FFFA]/50 border-r-4 border-r-[#15B8A6]'
                            : b.status === 'completed'
                            ? 'bg-slate-50/60 opacity-75'
                            : 'hover:bg-slate-50/80 bg-white'
                        }`}
                      >
                        {/* Right Part: Queue Number & Patient Details */}
                        <div className="flex items-center gap-3.5 flex-1 min-w-0">
                          {/* Queue Number Badge */}
                          <div
                            className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center shrink-0 font-black shadow-xs ${
                              isCurrent
                                ? 'bg-[#15B8A6] text-white ring-2 ring-[#15B8A6]/20'
                                : b.status === 'completed'
                                ? 'bg-slate-100 text-slate-500'
                                : 'bg-[#0B1F33] text-white'
                            }`}
                          >
                            <span className="text-[9px] font-bold opacity-80 leading-none">#</span>
                            <span className="text-base leading-tight font-black">{b.queue_number || '--'}</span>
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-bold text-sm text-[#182230] truncate">{b.patientName}</h3>
                              {/* Service Pill */}
                              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-[#2F80ED] border border-blue-100">
                                {b.serviceName || 'كشف'}
                              </span>
                              {b.servicePrice && (
                                <span className="text-[11px] font-bold text-slate-500">
                                  {b.servicePrice} ج.م
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                              <span className="font-mono text-slate-500">{b.phone}</span>
                              {b.createdAt && (
                                <span>{new Date(b.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Left Part: Status & Action Buttons */}
                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                          {getStatusBadge(b.status)}

                          {/* WhatsApp alert button */}
                          {b.status === 'waiting' && b.phone && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2.5 text-xs font-bold text-emerald-600 border-emerald-200 hover:bg-emerald-50 rounded-xl"
                              onClick={() => sendWhatsApp(b.phone, b.patientName)}
                              title="إرسال تنبيه عبر واتساب"
                            >
                              <MessageCircle className="w-3.5 h-3.5 ml-1" />
                              تنبيه
                            </Button>
                          )}

                          {/* Start exam button if waiting */}
                          {b.status === 'waiting' && (
                            <Button
                              size="sm"
                              className="h-8 px-3 text-xs font-bold bg-[#15B8A6] hover:bg-[#0D9488] text-white rounded-xl shadow-xs"
                              onClick={() => handleStartExam(b)}
                              disabled={isProcessing}
                            >
                              دخول
                            </Button>
                          )}

                          {/* Rx Shortcut */}
                          <Link href={`/clinic/${clinic.slug}/admin/prescriptions?patientName=${encodeURIComponent(b.patientName)}&patientPhone=${encodeURIComponent(b.phone)}`}>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2 text-slate-400 hover:text-[#15B8A6] hover:bg-teal-50 rounded-xl"
                              title="كتابة روشتة"
                            >
                              <FileSignature className="w-4 h-4" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* LEFT COLUMN: Live Turn Control Panels (4 cols on lg) */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* Panel 1: Current Patient (المريض الحالي) */}
          <div className="medical-card border-t-4 border-t-[#15B8A6] p-5 space-y-4 relative overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5EAF0]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#15B8A6] animate-ping"></span>
                <h3 className="font-bold text-sm text-[#182230]">المريض الحالي</h3>
              </div>
              <Badge className="bg-[#E6FFFA] text-[#0D9488] border-none font-bold text-xs">بالداخل الآن</Badge>
            </div>

            {currentPatient ? (
              <div className="space-y-4 text-center">
                <div className="w-16 h-16 rounded-2xl bg-teal-50 border-2 border-teal-200 text-[#15B8A6] flex items-center justify-center mx-auto text-2xl font-black shadow-xs">
                  #{currentPatient.queue_number}
                </div>

                <div>
                  <h4 className="text-xl font-black text-[#182230]">{currentPatient.patientName}</h4>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{currentPatient.phone}</p>
                  <div className="inline-block mt-2 px-3 py-1 rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                    {currentPatient.serviceName} • {currentPatient.servicePrice} ج.م
                  </div>
                </div>

                {currentPatient.startedAt && (
                  <p className="text-xs font-semibold text-[#15B8A6] bg-teal-50 py-1.5 px-3 rounded-lg">
                    بدأ الكشف: {new Date(currentPatient.startedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}

                {/* Actions Grid */}
                <div className="grid grid-cols-1 gap-2 pt-2">
                  <Button
                    className="w-full h-11 bg-[#15B8A6] hover:bg-[#0D9488] text-white font-bold rounded-xl shadow-md shadow-[#15B8A6]/20 transition-all text-sm"
                    onClick={() => handleCompleteExam(currentPatient.id, currentPatient.patientName)}
                    disabled={isProcessing}
                  >
                    <CheckCircle2 className="w-4 h-4 ml-1.5" />
                    إنهاء الكشف
                  </Button>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 text-xs font-bold text-slate-600 rounded-xl"
                      onClick={() => handleSkipPatient(currentPatient.id)}
                      disabled={isProcessing}
                    >
                      <SkipForward className="w-3.5 h-3.5 ml-1" />
                      تخطي
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 text-xs font-bold text-rose-600 border-rose-200 hover:bg-rose-50 rounded-xl"
                      onClick={() => handleNoShow(currentPatient.id)}
                      disabled={isProcessing}
                    >
                      <UserX className="w-3.5 h-3.5 ml-1" />
                      لم يحضر
                    </Button>
                  </div>

                  <Link href={`/clinic/${clinic.slug}/admin/prescriptions?patientName=${encodeURIComponent(currentPatient.patientName)}&patientPhone=${encodeURIComponent(currentPatient.phone)}`}>
                    <Button
                      variant="ghost"
                      className="w-full h-9 text-xs font-bold text-[#15B8A6] hover:bg-teal-50 rounded-xl mt-1"
                    >
                      <FileSignature className="w-4 h-4 ml-1.5" />
                      إصدار روشتة للمريض الآن
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                  <UserCheck className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-slate-500">لا يوجد مريض داخل غرفة الكشف حالياً</p>
                {nextPatient && (
                  <Button
                    size="sm"
                    className="bg-[#15B8A6] hover:bg-[#0D9488] text-white font-bold rounded-xl"
                    onClick={() => handleStartExam(nextPatient)}
                    disabled={isProcessing}
                  >
                    إدخال المريض التالي #{nextPatient.queue_number}
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Panel 2: Next Patient (المريض التالي) */}
          <div className="medical-card border-t-4 border-t-blue-500 p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5EAF0]">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                <h3 className="font-bold text-sm text-[#182230]">المريض التالي في الدور</h3>
              </div>
              <Badge className="bg-blue-50 text-blue-700 border-none font-bold text-xs">في الانتظار</Badge>
            </div>

            {nextPatient ? (
              <div className="space-y-4 text-center">
                <div className="flex items-center justify-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center text-xl font-black">
                    #{nextPatient.queue_number}
                  </div>
                  <div className="text-right">
                    <h4 className="font-black text-base text-[#182230]">{nextPatient.patientName}</h4>
                    <p className="text-xs text-slate-400 font-mono">{nextPatient.phone}</p>
                    <span className="text-[11px] font-semibold text-blue-600">{nextPatient.serviceName}</span>
                  </div>
                </div>

                <Button
                  className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl shadow-md shadow-emerald-600/20 text-base"
                  onClick={() => handleStartExam(nextPatient)}
                  disabled={isProcessing}
                >
                  دخول المريض
                  <ArrowLeft className="w-5 h-5 mr-2" />
                </Button>

                {nextPatient.phone && (
                  <button
                    onClick={() => sendWhatsApp(nextPatient.phone, nextPatient.patientName)}
                    className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center justify-center gap-1.5 mx-auto"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    إرسال إشعار استدعاء عبر واتساب
                  </button>
                )}
              </div>
            ) : (
              <div className="py-6 text-center text-slate-400 text-xs">
                لا يوجد مرضى آخرين في الانتظار.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
