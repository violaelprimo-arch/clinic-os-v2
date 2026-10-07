'use client'

import { use, useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Receipt, DollarSign, Wallet, CreditCard, Banknote,
  Search, Filter, CheckCircle2, Clock, Printer, Download,
  ArrowUpRight, Users, Calendar
} from 'lucide-react'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, onSnapshot, updateDoc, doc } from 'firebase/firestore'
import { toast } from 'sonner'

export default function AccountsPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug

  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [methodFilter, setMethodFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const cQ = query(collection(db, 'clinics'), where('slug', '==', slug))
        const cSnap = await getDocs(cQ)
        if (cSnap.empty) return
        const cId = cSnap.docs[0].id

        const apptQ = query(collection(db, 'appointments'), where('clinic_id', '==', cId))
        const unsubscribe = onSnapshot(apptQ, (snapshot) => {
          const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
          list.sort((a: any, b: any) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime())
          setAppointments(list)
          setLoading(false)
        })
        return () => unsubscribe()
      } catch (err) {
        console.error(err)
        setLoading(false)
      }
    }
    fetchTransactions()
  }, [slug])

  const handleConfirmPayment = async (item: any) => {
    if (!item.id || isProcessing) return;
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, 'appointments', item.id), {
        paymentStatus: 'paid',
        confirmedAt: new Date().toISOString()
      });
      toast.success('تم تأكيد الدفع بنجاح وتسجيله في الحسابات');
    } catch (err) {
      toast.error('خطأ في تأكيد الدفع');
    } finally {
      setIsProcessing(false);
    }
  }

  const applyDiscount = async (item: any, discountAmount: number) => {
    if (!item.id || isProcessing) return;
    setIsProcessing(true);
    try {
      const currentPrice = Number(item.servicePrice) || 0;
      const newPrice = Math.max(0, currentPrice - discountAmount);
      await updateDoc(doc(db, 'appointments', item.id), {
        servicePrice: newPrice,
        discountApplied: discountAmount
      });
      toast.success('تم تطبيق الخصم بنجاح وتحديث الإجمالي');
    } catch (err) {
      toast.error('خطأ في تطبيق الخصم');
    } finally {
      setIsProcessing(false);
    }
  }

  // Aggregate metrics
  const metrics = useMemo(() => {
    let collected = 0
    let pending = 0
    let todayTotal = 0
    let cashTotal = 0
    let walletTotal = 0
    let instapayTotal = 0

    const todayStr = new Date().toISOString().split('T')[0]

    appointments.forEach((item) => {
      const price = Number(item.servicePrice) || 0
      const isPaid = item.paymentStatus === 'paid' || item.status === 'completed'

      if (isPaid) {
        collected += price
        if (item.paymentMethod === 'wallet') walletTotal += price
        else if (item.paymentMethod === 'instapay') instapayTotal += price
        else cashTotal += price
      } else {
        pending += price
      }

      if (item.date === todayStr) {
        todayTotal += price
      }
    })

    return {
      collected,
      pending,
      todayTotal,
      transactionsCount: appointments.length,
      cashTotal,
      walletTotal,
      instapayTotal
    }
  }, [appointments])

  // Filtered transactions
  const filtered = useMemo(() => {
    return appointments.filter(a => {
      const matchSearch =
        !search ||
        (a.patientName && a.patientName.includes(search)) ||
        (a.phone && a.phone.includes(search))
      const matchMethod = methodFilter === 'ALL' || a.paymentMethod === methodFilter
      const isPaid = a.paymentStatus === 'paid' || a.status === 'completed'
      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'paid' && isPaid) ||
        (statusFilter === 'pending' && !isPaid)
      return matchSearch && matchMethod && matchStatus
    })
  }, [appointments, search, methodFilter, statusFilter])

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto" dir="rtl">
      
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#182230] flex items-center gap-2">
            <Receipt className="w-6 h-6 text-[#15B8A6]" />
            الحسابات والمدفوعات
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            متابعة التحصيل اليومي، الفواتير، طرق الدفع المختلفة والمبالغ المستحقة
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => window.print()}
          className="h-10 text-xs font-bold border-[#E5EAF0] text-slate-700 hover:bg-slate-100 rounded-xl"
        >
          <Printer className="w-4 h-4 ml-1.5" />
          طباعة كشف الحساب
        </Button>
      </div>

      {/* 2. KPI Stat Cards (4 Cards Grid) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="medical-card p-5">
          <p className="text-xs font-bold text-slate-400 mb-1">إجمالي التحصيل</p>
          <h3 className="text-2xl font-black text-emerald-600">
            {metrics.collected.toLocaleString()} <span className="text-sm font-bold text-slate-500">ج.م</span>
          </h3>
          <span className="text-[11px] font-semibold text-emerald-600/80 mt-1 inline-block">مبالغ مستلمة</span>
        </div>

        <div className="medical-card p-5">
          <p className="text-xs font-bold text-slate-400 mb-1">مبالغ معلقة</p>
          <h3 className="text-2xl font-black text-amber-600">
            {metrics.pending.toLocaleString()} <span className="text-sm font-bold text-slate-500">ج.م</span>
          </h3>
          <span className="text-[11px] font-semibold text-amber-600/80 mt-1 inline-block">في انتظار التحصيل</span>
        </div>

        <div className="medical-card p-5">
          <p className="text-xs font-bold text-slate-400 mb-1">إجمالي اليوم</p>
          <h3 className="text-2xl font-black text-[#15B8A6]">
            {metrics.todayTotal.toLocaleString()} <span className="text-sm font-bold text-slate-500">ج.م</span>
          </h3>
          <span className="text-[11px] font-semibold text-[#15B8A6]/80 mt-1 inline-block">عمليات اليوم</span>
        </div>

        <div className="medical-card p-5">
          <p className="text-xs font-bold text-slate-400 mb-1">عدد المعاملات</p>
          <h3 className="text-2xl font-black text-[#2F80ED]">{metrics.transactionsCount}</h3>
          <span className="text-[11px] font-semibold text-[#2F80ED]/80 mt-1 inline-block">إجمالي الفواتير</span>
        </div>
      </div>

      {/* 3. Payment Methods Breakdown Pills */}
      <div className="medical-card p-4 flex flex-wrap items-center justify-between gap-4 bg-white">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <span>توزيع طرق الدفع:</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-green-50 text-emerald-800 text-xs font-bold border border-green-200">
            <Banknote className="w-4 h-4 text-emerald-600" />
            <span>كاش بالعيادة: {metrics.cashTotal.toLocaleString()} ج.م</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-50 text-purple-800 text-xs font-bold border border-purple-200">
            <CreditCard className="w-4 h-4 text-purple-600" />
            <span>انستاباي: {metrics.instapayTotal.toLocaleString()} ج.م</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-800 text-xs font-bold border border-blue-200">
            <Wallet className="w-4 h-4 text-blue-600" />
            <span>محفظة إلكترونية: {metrics.walletTotal.toLocaleString()} ج.م</span>
          </div>
        </div>
      </div>

      {/* 4. Filters & Search Bar */}
      <div className="medical-card p-4 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ابحث باسم المريض أو رقم الهاتف..."
            className="pr-10 h-10 text-sm bg-[#F6F8FB] border-[#E5EAF0] rounded-xl focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={methodFilter}
            onChange={e => setMethodFilter(e.target.value)}
            className="h-10 px-3 rounded-xl border border-[#E5EAF0] text-xs font-bold text-slate-700 bg-white"
          >
            <option value="ALL">كل طرق الدفع</option>
            <option value="cash">كاش</option>
            <option value="instapay">انستاباي</option>
            <option value="wallet">محفظة إلكترونية</option>
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="h-10 px-3 rounded-xl border border-[#E5EAF0] text-xs font-bold text-slate-700 bg-white"
          >
            <option value="ALL">كل الحالات</option>
            <option value="paid">تم الدفع</option>
            <option value="pending">معلق</option>
          </select>
        </div>
      </div>

      {/* 5. Transactions Table */}
      <div className="medical-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-[#F8FAFC] border-b border-[#E5EAF0] text-slate-400 text-xs font-bold select-none">
              <tr>
                <th className="py-3.5 px-4">رقم المعاملة</th>
                <th className="py-3.5 px-4">اسم المريض</th>
                <th className="py-3.5 px-4">الخدمة</th>
                <th className="py-3.5 px-4">التاريخ</th>
                <th className="py-3.5 px-4">طريقة الدفع</th>
                <th className="py-3.5 px-4 text-center">المبلغ</th>
                <th className="py-3.5 px-4 text-center">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5EAF0]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    جاري تحميل سجل المعاملات...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    لا توجد معاملات مطابقة للبحث.
                  </td>
                </tr>
              ) : (
                filtered.map((item, idx) => {
                  const isPaid = item.paymentStatus === 'paid' || item.status === 'completed'
                  return (
                    <tr key={item.id || idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-500 font-bold">
                        #{item.id ? item.id.substring(0, 6) : `TRX-${idx + 101}`}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-xs text-[#182230]">
                        {item.patientName || 'مريض'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-[#2F80ED] border border-blue-100">
                          {item.serviceName || 'كشف'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-500">
                        {item.date || 'اليوم'}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-medium text-slate-600">
                        {item.paymentMethod === 'instapay'
                          ? 'انستاباي'
                          : item.paymentMethod === 'wallet'
                          ? 'محفظة إلكترونية'
                          : 'كاش بالعيادة'}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-xs text-[#182230]">
                        {item.servicePrice || 250} ج.م
                      </td>
                      <td className="py-3.5 px-4 text-center flex items-center justify-center gap-2">
                        <Badge
                          className={`text-[10px] font-bold px-2 py-0.5 border-none ${
                            isPaid
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {isPaid ? 'مدفوع' : 'معلق'}
                        </Badge>
                        {!isPaid && (
                          <div className="flex flex-col gap-1">
                            <Button
                              size="sm"
                              disabled={isProcessing}
                              onClick={() => handleConfirmPayment(item)}
                              className="h-6 text-[10px] bg-[#15B8A6] hover:bg-[#0D9488] text-white px-2"
                            >
                              تأكيد الدفع
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isProcessing}
                              onClick={() => {
                                const val = prompt('أدخل قيمة الخصم (ج.م):');
                                if (val && !isNaN(Number(val))) {
                                  applyDiscount(item, Number(val));
                                }
                              }}
                              className="h-6 text-[10px] px-2"
                            >
                              خصم
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
