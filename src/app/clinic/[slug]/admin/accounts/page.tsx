'use client'

import { use, useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Receipt, DollarSign, Wallet, CreditCard, Banknote,
  Search, Filter, CheckCircle2, Clock, Printer, Download,
  ArrowUpRight, Users, Calendar, Eye, FileSpreadsheet, X
} from 'lucide-react'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, onSnapshot, updateDoc, doc } from 'firebase/firestore'
import { toast } from 'sonner'
import { printHtmlViaIframe, generateFinancialReportHtml } from '@/lib/printService'
import { exportComprehensiveFinancialReportExcel } from '@/lib/excelExport'
import { InvoiceView, InvoiceData } from '@/components/clinic/InvoiceView'
import { formatCairo12Hour } from '@/lib/queue-calculator'
import { useLanguage } from '@/context/LanguageContext'

export default function AccountsPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug
  const { t, tDynamic, language, dir, isRtl } = useLanguage()

  const [clinic, setClinic] = useState<any>(null)
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [methodFilter, setMethodFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceData | null>(null)

  const todayCairoStr = useMemo(() => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date())
  }, [])

  const setDatePreset = (preset: 'today' | 'week' | 'month' | 'all') => {
    if (preset === 'today') {
      setFromDate(todayCairoStr)
      setToDate(todayCairoStr)
    } else if (preset === 'week') {
      const d = new Date()
      d.setDate(d.getDate() - 7)
      const weekAgo = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(d)
      setFromDate(weekAgo)
      setToDate(todayCairoStr)
    } else if (preset === 'month') {
      const d = new Date()
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      setFromDate(`${year}-${month}-01`)
      setToDate(todayCairoStr)
    } else {
      setFromDate('')
      setToDate('')
    }
  }

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

  // Confirm payment with audit trail
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

  // Record discount with previous price preserved
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

  const [selectedBranchId, setSelectedBranchId] = useState<string>('all')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('clinic_selected_branch') || 'all'
      setSelectedBranchId(saved)

      const handleBranchChanged = (e: any) => {
        const bId = e.detail?.branchId || 'all'
        setSelectedBranchId(bId)
      }
      window.addEventListener('clinic_branch_changed', handleBranchChanged)
      return () => window.removeEventListener('clinic_branch_changed', handleBranchChanged)
    }
  }, [])

  // Filtered transactions (with search, method, status, date range, and branch)
  const filtered = useMemo(() => {
    return appointments.filter(a => {
      // Branch filter
      if (selectedBranchId && selectedBranchId !== 'all') {
        const apptBranch = a.branch_id || a.branchId
        const isMainBranchSelected = selectedBranchId === 'main' || clinic?.branches?.find((b: any) => b.isMain)?.id === selectedBranchId
        const belongsToBranch = apptBranch ? apptBranch === selectedBranchId : isMainBranchSelected
        if (!belongsToBranch) return false
      }

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

      const itemDate = a.date || (a.createdAt ? a.createdAt.split('T')[0] : '')
      const matchFrom = !fromDate || (itemDate && itemDate >= fromDate)
      const matchTo = !toDate || (itemDate && itemDate <= toDate)

      return matchSearch && matchMethod && matchStatus && matchFrom && matchTo
    })
  }, [appointments, selectedBranchId, clinic, search, methodFilter, statusFilter, fromDate, toDate])

  // Aggregate metrics for filtered data
  const metrics = useMemo(() => {
    let collected = 0
    let pending = 0
    let periodTotal = 0
    let cashTotal = 0
    let walletTotal = 0
    let instapayTotal = 0
    let totalDiscounts = 0

    filtered.forEach((item) => {
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

      periodTotal += price
    })

    return {
      collected,
      pending,
      periodTotal,
      transactionsCount: filtered.length,
      cashTotal,
      walletTotal,
      instapayTotal,
      totalDiscounts
    }
  }, [filtered])

  // Clean isolated A4 Financial Statement Print (XP-80C & A4 separation)
  const handlePrintFinancialReport = () => {
    const effectiveFrom = fromDate || (filtered.length > 0 ? filtered[filtered.length - 1].date : todayCairoStr)
    const effectiveTo = toDate || todayCairoStr

    const html = generateFinancialReportHtml({
      clinicName: clinic?.clinicName || 'Yalla Clinic',
      doctorName: clinic?.doctorName,
      branchLabel: 'جميع الفروع',
      clinicAddress: clinic?.clinicAddress,
      clinicPhone: clinic?.clinicPhone,
      logoUrl: clinic?.logoUrl,
      fromDate: effectiveFrom,
      toDate: effectiveTo,
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
        patientsCount: filtered.length
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

  // Export Formatted Multi-Sheet Excel
  const handleExportExcel = async () => {
    if (filtered.length === 0) {
      return toast.info('لا توجد معاملات لتصديرها في النطاق المحدد')
    }
    const effectiveFrom = fromDate || (filtered.length > 0 ? filtered[filtered.length - 1].date : todayCairoStr)
    const effectiveTo = toDate || todayCairoStr

    await exportComprehensiveFinancialReportExcel({
      clinicName: clinic?.clinicName || 'Yalla Clinic',
      branchLabel: 'جميع الفروع',
      fromDate: effectiveFrom,
      toDate: effectiveTo,
      appointments: filtered,
      totals: {
        revenue: metrics.collected + metrics.pending,
        collected: metrics.collected,
        due: metrics.pending,
        cash: metrics.cashTotal,
        instapay: metrics.instapayTotal,
        wallet: metrics.walletTotal,
        discounts: metrics.totalDiscounts,
        patientsCount: filtered.length
      }
    })
    toast.success('تم تصدير التقرير المالي المنسق (Excel) بنجاح')
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto" dir={dir}>
      
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
            <Receipt className="w-6 h-6 text-primary" />
            {t('nav_accounts', 'الحسابات والتقارير المالية')}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {language === 'en' ? 'Track collections, invoices, financial records, and date-range exports' : 'متابعة التحصيل، الفواتير، التقارير المالية وتصدير الحسابات بالتاريخ'}
          </p>
        </div>

        {/* Action Buttons: Excel + PDF Export */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={handleExportExcel}
            className="h-10 text-xs font-bold border-border text-foreground hover:bg-secondary rounded-xl flex items-center gap-1.5"
          >
            <FileSpreadsheet className={`w-4 h-4 ${isRtl ? 'ml-1' : 'mr-1'} text-emerald-500`} />
            {t('export_excel', 'تصدير إكسيل (Excel)')}
          </Button>

          <Button
            variant="outline"
            onClick={handlePrintFinancialReport}
            className="h-10 text-xs font-bold border-border text-foreground hover:bg-secondary rounded-xl flex items-center gap-1.5"
          >
            <Printer className={`w-4 h-4 ${isRtl ? 'ml-1' : 'mr-1'}`} />
            {t('print_patients_report', 'طباعة تقرير مالي (A4 / PDF)')}
          </Button>
        </div>
      </div>

      {/* 2. KPI Stat Cards (4 Cards Grid) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="yalla-card p-5 border border-border">
          <p className="text-xs font-bold text-muted-foreground mb-1">{t('collected', 'إجمالي التحصيل الفعلي')}</p>
          <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {metrics.collected.toLocaleString()} <span className="text-sm font-bold text-muted-foreground">{t('currency_egp', 'ج.م')}</span>
          </h3>
          <span className="text-[11px] font-semibold text-emerald-600/80 dark:text-emerald-400/80 mt-1 inline-block">{language === 'en' ? 'Fully Paid Amounts' : 'مبالغ مسددة بالكامل'}</span>
        </div>

        <div className="yalla-card p-5 border border-border">
          <p className="text-xs font-bold text-muted-foreground mb-1">{t('due_amounts', 'المبالغ المعلقة (الآجلة)')}</p>
          <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400">
            {metrics.pending.toLocaleString()} <span className="text-sm font-bold text-muted-foreground">{t('currency_egp', 'ج.م')}</span>
          </h3>
          <span className="text-[11px] font-semibold text-amber-600/80 dark:text-amber-400/80 mt-1 inline-block">{language === 'en' ? 'Awaiting Collection' : 'في انتظار التحصيل'}</span>
        </div>

        <div className="yalla-card p-5 border border-border">
          <p className="text-xs font-bold text-muted-foreground mb-1">
            {fromDate || toDate ? (language === 'en' ? 'Period Revenue' : 'إجمالي إيراد الفترة') : t('total_sales', 'إجمالي إيراد العمليات')}
          </p>
          <h3 className="text-2xl font-black text-primary">
            {metrics.periodTotal.toLocaleString()} <span className="text-sm font-bold text-muted-foreground">{t('currency_egp', 'ج.م')}</span>
          </h3>
          <span className="text-[11px] font-semibold text-primary/80 mt-1 inline-block">
            {fromDate || toDate ? (language === 'en' ? 'By Date Filter' : 'حسب الفرز الزمني') : (language === 'en' ? 'All Operations' : 'كافة العمليات')}
          </span>
        </div>

        <div className="yalla-card p-5 border border-border">
          <p className="text-xs font-bold text-muted-foreground mb-1">{t('total_discounts', 'الخصومات الممنوحة')}</p>
          <h3 className="text-2xl font-black text-rose-600 dark:text-rose-400">
            {metrics.totalDiscounts.toLocaleString()} <span className="text-sm font-bold text-muted-foreground">{t('currency_egp', 'ج.م')}</span>
          </h3>
          <span className="text-[11px] font-semibold text-muted-foreground mt-1 inline-block">
            {language === 'en' ? `Out of ${metrics.transactionsCount} transactions` : `من إجمالي ${metrics.transactionsCount} معاملة`}
          </span>
        </div>
      </div>

      {/* Date Range Filter Bar */}
      <div className="yalla-card p-4 space-y-3 border border-border">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-foreground">
            <Calendar className="w-4 h-4 text-primary" />
            <span>{t('filter_by_date_range', 'فرز المعاملات والتقارير بالتاريخ (من / إلى):')}</span>
          </div>

          {/* Quick presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setDatePreset('all')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                !fromDate && !toDate ? 'yalla-gradient-btn text-white shadow-xs' : 'bg-secondary text-foreground hover:bg-secondary/80'
              }`}
            >
              {t('all_filter', 'الكل')}
            </button>
            <button
              type="button"
              onClick={() => setDatePreset('today')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                fromDate === todayCairoStr && toDate === todayCairoStr ? 'yalla-gradient-btn text-white shadow-xs' : 'bg-secondary text-foreground hover:bg-secondary/80'
              }`}
            >
              {t('today_filter', 'اليوم')}
            </button>
            <button
              type="button"
              onClick={() => setDatePreset('week')}
              className="px-3 py-1 text-xs font-bold rounded-lg bg-secondary text-foreground hover:bg-secondary/80 transition-colors cursor-pointer"
            >
              {t('last_7_days', 'آخر 7 أيام')}
            </button>
            <button
              type="button"
              onClick={() => setDatePreset('month')}
              className="px-3 py-1 text-xs font-bold rounded-lg bg-secondary text-foreground hover:bg-secondary/80 transition-colors cursor-pointer"
            >
              {t('this_month', 'هذا الشهر')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-border items-center">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground shrink-0">{t('from_date', 'من تاريخ')}:</span>
            <Input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="h-9 text-xs bg-background border-border text-foreground rounded-xl font-mono"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground shrink-0">{t('to_date', 'إلى تاريخ')}:</span>
            <Input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="h-9 text-xs bg-background border-border text-foreground rounded-xl font-mono"
            />
          </div>

          {(fromDate || toDate) && (
            <div className="sm:col-span-2 flex items-center justify-end gap-2">
              <span className="text-xs text-primary font-semibold bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20">
                {t('filtered_label', 'مفلتر')}: {fromDate || (language === 'en' ? 'Start' : 'البداية')} ⬅ {toDate || (language === 'en' ? 'Today' : 'اليوم')} ({filtered.length} {language === 'en' ? 'transactions' : 'معاملة'})
              </span>
              <button
                type="button"
                onClick={() => { setFromDate(''); setToDate(''); }}
                className="h-9 px-3 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                {t('clear_filter', 'إلغاء الفرز')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3. Payment Methods Breakdown Pills */}
      <div className="yalla-card p-4 flex flex-wrap items-center justify-between gap-4 border border-border">
        <div className="flex items-center gap-2 text-xs font-bold text-foreground">
          <span>{t('payment_methods_distribution', 'توزيع طرق السداد الفعلي')}:</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/20">
            <Banknote className="w-4 h-4 text-emerald-500" />
            <span>{t('cash_clinic', 'كاش بالعيادة')}: {metrics.cashTotal.toLocaleString()} {t('currency_egp', 'ج.م')}</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-bold border border-purple-500/20">
            <CreditCard className="w-4 h-4 text-purple-500" />
            <span>{t('instapay', 'انستاباي')}: {metrics.instapayTotal.toLocaleString()} {t('currency_egp', 'ج.م')}</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-xs font-bold border border-primary/20">
            <Wallet className="w-4 h-4 text-primary" />
            <span>{t('wallet', 'محفظة إلكترونية')}: {metrics.walletTotal.toLocaleString()} {t('currency_egp', 'ج.م')}</span>
          </div>
        </div>
      </div>

      {/* 4. Filters & Search Bar */}
      <div className="yalla-card p-4 flex flex-col sm:flex-row items-center justify-between gap-3 border border-border">
        <div className="relative w-full sm:w-80">
          <Search className={`w-4 h-4 absolute ${isRtl ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 text-muted-foreground`} />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={language === 'en' ? 'Search by patient name or phone...' : 'ابحث باسم المريض أو رقم الهاتف...'}
            className={`${isRtl ? 'pr-10' : 'pl-10'} h-10 text-sm bg-background border-border text-foreground rounded-xl`}
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={methodFilter}
            onChange={e => setMethodFilter(e.target.value)}
            className="h-10 px-3 rounded-xl border border-border text-xs font-bold text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="ALL">{t('all_methods', 'كل طرق الدفع')}</option>
            <option value="cash">{t('cash', 'كاش')}</option>
            <option value="instapay">{t('instapay', 'انستاباي')}</option>
            <option value="wallet">{t('wallet', 'محفظة إلكترونية')}</option>
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="h-10 px-3 rounded-xl border border-border text-xs font-bold text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="ALL">{t('all_statuses', 'كل الحالات')}</option>
            <option value="paid">{t('paid', 'تم السداد')}</option>
            <option value="pending">{t('unpaid', 'في انتظار السداد')}</option>
          </select>
        </div>
      </div>

      {/* 5. Transactions Table */}
      <div className="yalla-card overflow-hidden border border-border">
        <div className="overflow-x-auto">
          <table className={`w-full ${isRtl ? 'text-right' : 'text-left'} text-sm`}>
            <thead className="bg-secondary/60 border-b border-border text-muted-foreground text-xs font-bold select-none">
              <tr>
                <th className="py-3.5 px-4">{language === 'en' ? 'TRX ID' : 'رقم المعاملة'}</th>
                <th className="py-3.5 px-4">{t('patient_col', 'اسم المريض')}</th>
                <th className="py-3.5 px-4">{t('service_type', 'الخدمة')}</th>
                <th className="py-3.5 px-4">{t('date', 'التاريخ')}</th>
                <th className="py-3.5 px-4">{t('payment_method', 'طريقة الدفع')}</th>
                <th className="py-3.5 px-4 text-center">{t('price', 'المبلغ')}</th>
                <th className="py-3.5 px-4 text-center">{t('status', 'الحالة')}</th>
                <th className={`py-3.5 px-4 ${isRtl ? 'text-left' : 'text-right'}`}>{t('actions', 'إجراءات')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    {language === 'en' ? 'Loading transactions ledger...' : 'جاري تحميل سجل المعاملات...'}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    {language === 'en' ? 'No transactions match your search.' : 'لا توجد معاملات مطابقة للبحث.'}
                  </td>
                </tr>
              ) : (
                filtered.map((item, idx) => {
                  const isPaid = item.paymentStatus === 'paid' || item.status === 'completed'
                  return (
                    <tr key={item.id || idx} className="hover:bg-secondary/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-xs text-muted-foreground font-bold">
                        #{item.id ? item.id.substring(0, 6) : `TRX-${idx + 101}`}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-xs text-foreground">
                        {item.patientName || (language === 'en' ? 'Patient' : 'مريض')}
                        {item.branchName && (
                          <span className="block text-[10px] text-muted-foreground font-normal">
                            {language === 'en' ? `Branch: ${tDynamic(item.branchName)}` : `فرع ${item.branchName}`}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                          {tDynamic(item.serviceName || 'كشف')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-muted-foreground">
                        {item.date || (language === 'en' ? 'Today' : 'اليوم')}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-medium text-foreground">
                        {tDynamic(
                          item.paymentMethod === 'instapay'
                            ? 'انستاباي'
                            : item.paymentMethod === 'wallet'
                            ? 'محفظة إلكترونية'
                            : 'كاش بالعيادة'
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-xs text-foreground">
                        <div>{item.servicePrice || 250} {t('currency_egp', 'ج.م')}</div>
                        {item.discountApplied > 0 && (
                          <span className="text-[10px] text-rose-500 block">
                            ({language === 'en' ? 'Disc. -' : 'خصم -'}{item.discountApplied})
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <Badge
                          className={`text-[10px] font-bold px-2.5 py-0.5 border-none ${
                            isPaid
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {isPaid ? t('paid', 'تم السداد') : t('unpaid', 'في انتظار التأكيد')}
                        </Badge>
                      </td>
                      <td className={`py-3.5 px-4 ${isRtl ? 'text-left' : 'text-right'}`}>
                        <div className={`flex items-center ${isRtl ? 'justify-end' : 'justify-end'} gap-1.5`}>
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
                                appointmentId: item.id,
                                queueNumber: item.queue_number
                              })
                            }}
                            className="h-7 px-2 text-[11px] text-muted-foreground hover:text-primary gap-1"
                            title={language === 'en' ? 'View & Print Invoice' : 'عرض وطباعة الفاتورة'}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            {language === 'en' ? 'Invoice' : 'فاتورة'}
                          </Button>

                          {!isPaid && (
                            <>
                              <Button
                                size="sm"
                                disabled={isProcessing}
                                onClick={() => handleConfirmPayment(item)}
                                className="h-7 text-[11px] yalla-gradient-btn text-white px-2.5 rounded-lg shadow-2xs"
                              >
                                {t('confirm', 'تأكيد')}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isProcessing}
                                onClick={() => {
                                  const val = prompt(language === 'en' ? 'Enter discount value (EGP):' : 'أدخل قيمة الخصم (ج.م):')
                                  if (val && !isNaN(Number(val))) {
                                    applyDiscount(item, Number(val))
                                  }
                                }}
                                className="h-7 text-[11px] px-2 text-rose-600 dark:text-rose-400 border-rose-500/20 hover:bg-rose-500/10 rounded-lg"
                              >
                                {language === 'en' ? 'Discount' : 'خصم'}
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

      {/* Invoice Modal for Selected Transaction */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-border text-foreground rounded-3xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <InvoiceView
              invoice={selectedInvoice}
              isPatientView={false}
              slug={slug}
              onClose={() => setSelectedInvoice(null)}
            />
          </div>
        </div>
      )}

      {/* Standardized Copyright Footer */}
      <footer className="text-center text-xs text-muted-foreground pt-6 border-t border-border">
        {language === 'en' ? 'All rights reserved YallaCodeX 2026' : 'جميع الحقوق محفوظة YallaCodeX 2026'}
      </footer>
    </div>
  )
}
