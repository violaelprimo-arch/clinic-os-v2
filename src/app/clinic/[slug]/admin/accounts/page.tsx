'use client'

import { use, useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Receipt, DollarSign, Wallet, CreditCard, Banknote,
  Search, Filter, CheckCircle2, Clock, Printer, Download,
  ArrowUpRight, Users, Calendar, Eye
} from 'lucide-react'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, onSnapshot, updateDoc, doc } from 'firebase/firestore'
import { toast } from 'sonner'
import { printHtmlViaIframe, generateFinancialReportHtml } from '@/lib/printService'
import { InvoiceView, InvoiceData } from '@/components/clinic/InvoiceView'
import { formatCairo12Hour } from '@/lib/queue-calculator'

export default function AccountsPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug

  const [clinic, setClinic] = useState<any>(null)
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [methodFilter, setMethodFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceData | null>(null)

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const cQ = query(collection(db, 'clinics'), where('slug', '==', slug))
        const cSnap = await getDocs(cQ)
        if (cSnap.empty) return
        const cData = { id: cSnap.docs[0].id, ...cSnap.docs[0].data() }
        setClinic(cData)

        const apptQ = query(collection(db, 'appointments'), where('clinic_id', '==', cData.id))
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

  // TASK 14: Confirm payment with audit trail
  const handleConfirmPayment = async (item: any) => {
    if (!item.id || isProcessing) return
    setIsProcessing(true)
    try {
      await updateDoc(doc(db, 'appointments', item.id), {
        paymentStatus: 'paid',
        confirmedAt: new Date().toISOString(),
        confirmedBy: clinic?.doctorName || 'إدارة العيادة'
      })
      toast.success('تم تأكيد استلام الدفعة بنجاح وتسجيلها في الحسابات')
    } catch (err) {
      toast.error('خطأ في تأكيد الدفع')
    } finally {
      setIsProcessing(false)
    }
  }

  // TASK 14: Record discount with previous price preserved
  const applyDiscount = async (item: any, discountAmount: number) => {
    if (!item.id || isProcessing) return
    setIsProcessing(true)
    try {
      const currentPrice = Number(item.servicePrice) || 0
      const newPrice = Math.max(0, currentPrice - discountAmount)
      await updateDoc(doc(db, 'appointments', item.id), {
        servicePrice: newPrice,
        discountApplied: (Number(item.discountApplied) || 0) + discountAmount
      })
      toast.success('تم تطبيق الخصم وتحديث الإجمالي المالي')
    } catch (err) {
      toast.error('خطأ في تطبيق الخصم')
    } finally {
      setIsProcessing(false)
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
    let totalDiscounts = 0

    const todayStr = new Date().toISOString().split('T')[0]

    appointments.forEach((item) => {
      const price = Number(item.servicePrice) || 0
      const isPaid = item.paymentStatus === 'paid' || item.status === 'completed'
      totalDiscounts += Number(item.discountApplied) || 0

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
      instapayTotal,
      totalDiscounts
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

  // TASK 13: Clean isolated A4 Financial Statement Print (XP-80C & A4 separation)
  const handlePrintFinancialReport = () => {
    const html = generateFinancialReportHtml({
      clinicName: clinic?.clinicName || 'Clinic OS',
      doctorName: clinic?.doctorName,
      branchLabel: 'جميع الفروع',
      clinicAddress: clinic?.clinicAddress,
      clinicPhone: clinic?.clinicPhone,
      logoUrl: clinic?.logoUrl,
      fromDate: appointments.length > 0 ? appointments[appointments.length - 1].date : new Date().toISOString().split('T')[0],
      toDate: new Date().toISOString().split('T')[0],
      generatedAtCairo: new Intl.DateTimeFormat('ar-EG', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Africa/Cairo'
      }).format(new Date()),
      generatedBy: clinic?.doctorName || 'إدارة العيادة',
      totals: {
        revenue: metrics.collected + metrics.pending,
        collected: metrics.collected,
        due: metrics.pending,
        discounts: metrics.totalDiscounts,
        cash: metrics.cashTotal,
        instapay: metrics.instapayTotal,
        wallet: metrics.walletTotal,
        patientsCount: appointments.length
      },
      transactions: filtered.map(a => ({
        id: a.id,
        date: a.date,
        patientName: a.patientName,
        phone: a.phone,
        branchName: a.branchName,
        serviceName: a.serviceName || 'كشف',
        price: Number(a.servicePrice) + (Number(a.discountApplied) || 0),
        discount: Number(a.discountApplied) || 0,
        netPrice: Number(a.servicePrice) || 0,
        paymentMethod:
          a.paymentMethod === 'instapay'
            ? 'انستاباي'
            : a.paymentMethod === 'wallet'
            ? 'محفظة'
            : 'كاش',
        paymentStatus: a.paymentStatus === 'paid' || a.status === 'completed' ? 'paid' : 'pending'
      }))
    })
    printHtmlViaIframe(html, 'a4')
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto" dir="rtl">
      
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#182230] flex items-center gap-2">
            <Receipt className="w-6 h-6 text-[#15B8A6]" />
            الحسابات والتقارير المالية
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            متابعة التحصيل اليومي، الفواتير، التدفقات النقدية والخصومات المعتمدة
          </p>
        </div>

        {/* TASK 13: Clean A4 Statement Print Button */}
        <Button
          variant="outline"
          onClick={handlePrintFinancialReport}
          className="h-10 text-xs font-bold border-[#E5EAF0] text-slate-700 hover:bg-slate-100 rounded-xl flex items-center gap-1.5"
        >
          <Printer className="w-4 h-4 ml-1" />
          طباعة تقرير الحسابات (A4)
        </Button>
      </div>

      {/* 2. KPI Stat Cards (4 Cards Grid) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="medical-card p-5">
          <p className="text-xs font-bold text-slate-400 mb-1">إجمالي التحصيل الفعلي</p>
          <h3 className="text-2xl font-black text-emerald-600">
            {metrics.collected.toLocaleString()} <span className="text-sm font-bold text-slate-500">ج.م</span>
          </h3>
          <span className="text-[11px] font-semibold text-emerald-600/80 mt-1 inline-block">مبالغ مسددة بالكامل</span>
        </div>

        <div className="medical-card p-5">
          <p className="text-xs font-bold text-slate-400 mb-1">المبالغ المعلقة (الآجلة)</p>
          <h3 className="text-2xl font-black text-amber-600">
            {metrics.pending.toLocaleString()} <span className="text-sm font-bold text-slate-500">ج.م</span>
          </h3>
          <span className="text-[11px] font-semibold text-amber-600/80 mt-1 inline-block">في انتظار التحصيل</span>
        </div>

        <div className="medical-card p-5">
          <p className="text-xs font-bold text-slate-400 mb-1">إجمالي إيراد اليوم</p>
          <h3 className="text-2xl font-black text-[#15B8A6]">
            {metrics.todayTotal.toLocaleString()} <span className="text-sm font-bold text-slate-500">ج.م</span>
          </h3>
          <span className="text-[11px] font-semibold text-[#15B8A6]/80 mt-1 inline-block">عمليات اليوم</span>
        </div>

        <div className="medical-card p-5">
          <p className="text-xs font-bold text-slate-400 mb-1">الخصومات الممنوحة</p>
          <h3 className="text-2xl font-black text-rose-600">
            {metrics.totalDiscounts.toLocaleString()} <span className="text-sm font-bold text-slate-500">ج.م</span>
          </h3>
          <span className="text-[11px] font-semibold text-slate-400 mt-1 inline-block">
            من إجمالي {metrics.transactionsCount} معاملة
          </span>
        </div>
      </div>

      {/* 3. Payment Methods Breakdown Pills */}
      <div className="medical-card p-4 flex flex-wrap items-center justify-between gap-4 bg-white">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <span>توزيع طرق السداد الفعلي:</span>
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
            <option value="paid">تم السداد</option>
            <option value="pending">في انتظار السداد</option>
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
                <th className="py-3.5 px-4 text-left">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5EAF0]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    جاري تحميل سجل المعاملات...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
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
                        {item.branchName && (
                          <span className="block text-[10px] text-slate-400 font-normal">
                            فرع {item.branchName}
                          </span>
                        )}
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
                        <div>{item.servicePrice || 250} ج.م</div>
                        {item.discountApplied > 0 && (
                          <span className="text-[10px] text-rose-500 block">
                            (خصم -{item.discountApplied})
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <Badge
                          className={`text-[10px] font-bold px-2.5 py-0.5 border-none ${
                            isPaid
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {isPaid ? 'تم السداد' : 'في انتظار التأكيد'}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-left">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View & Print Single Invoice */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedInvoice({
                                invoiceNumber: item.invoiceNumber || `INV-${item.id?.slice(0, 8) || idx}`,
                                clinicName: clinic?.clinicName || 'العيادة',
                                doctorName: clinic?.doctorName,
                                branchName: item.branchName,
                                clinicAddress: clinic?.clinicAddress,
                                clinicPhone: clinic?.clinicPhone,
                                patientName: item.patientName,
                                patientPhone: item.phone,
                                date: item.date,
                                cairoTime: formatCairo12Hour(new Date(item.createdAt || Date.now())),
                                serviceName: item.serviceName || 'كشف',
                                servicePrice: Number(item.servicePrice) + (Number(item.discountApplied) || 0),
                                discount: Number(item.discountApplied) || 0,
                                netTotal: Number(item.servicePrice) || 0,
                                paymentMethod: item.paymentMethod || 'cash',
                                paymentStatus: isPaid ? 'paid' : 'pending',
                                transferNumber: item.transferNumber,
                                appointmentId: item.id
                              })
                            }}
                            className="h-7 px-2 text-[11px] text-slate-600 hover:text-[#15B8A6]"
                            title="عرض وطباعة الفاتورة"
                          >
                            <Eye className="w-3.5 h-3.5 ml-1" />
                            فاتورة
                          </Button>

                          {!isPaid && (
                            <>
                              <Button
                                size="sm"
                                disabled={isProcessing}
                                onClick={() => handleConfirmPayment(item)}
                                className="h-7 text-[11px] bg-[#15B8A6] hover:bg-[#0D9488] text-white px-2.5 rounded-lg"
                              >
                                تأكيد
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isProcessing}
                                onClick={() => {
                                  const val = prompt('أدخل قيمة الخصم (ج.م):')
                                  if (val && !isNaN(Number(val))) {
                                    applyDiscount(item, Number(val))
                                  }
                                }}
                                className="h-7 text-[11px] px-2 text-rose-600 border-rose-200 hover:bg-rose-50 rounded-lg"
                              >
                                خصم
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Modal for Selected Transaction (Staff View: has 80mm thermal print & PDF) */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <InvoiceView
              invoice={selectedInvoice}
              isPatientView={false}
              onClose={() => setSelectedInvoice(null)}
            />
          </div>
        </div>
      )}

      {/* TASK 12: Standardized Copyright Footer */}
      <footer className="text-center text-xs text-slate-400 pt-6 border-t border-slate-100">
        جميع الحقوق محفوظة © {new Date().getFullYear()} Clinic OS
      </footer>
    </div>
  )
}
