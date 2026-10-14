'use client'

import { use, useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Printer, TrendingUp, Users, Wallet, CreditCard,
  Banknote, Calendar, BarChart3, PieChart, ArrowUpRight,
  FileSpreadsheet, Building2, Filter, Percent, ArrowDownRight
} from 'lucide-react'
import { toast } from 'sonner'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'
import {
  printHtmlViaIframe,
  generateFinancialReportHtml,
  FinancialReportPrintData
} from '@/lib/printService'
import { exportComprehensiveFinancialReportExcel } from '@/lib/excelExport'

export default function FinancePage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug

  const [clinic, setClinic] = useState<any>(null)
  const [branches, setBranches] = useState<any[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all')

  const now = new Date()
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

  const [fromDate, setFromDate] = useState(firstDayOfMonth)
  const [toDate, setToDate] = useState(lastDayOfMonth)
  const [report, setReport] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [dailyData, setDailyData] = useState<any[]>([])
  const [servicesData, setServicesData] = useState<any[]>([])
  const [paymentsData, setPaymentsData] = useState<any[]>([])

  const [totals, setTotals] = useState({
    revenue: 0,
    patients: 0,
    collected: 0,
    due: 0,
    discounts: 0,
    cash: 0,
    instapay: 0,
    wallet: 0
  })

  // Listen to branch switcher
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('clinic_selected_branch') || 'all'
      setSelectedBranchId(saved)

      const handleBranchChanged = (e: any) => {
        const bId = e.detail?.branchId || 'all'
        setSelectedBranchId(bId)
      }
      window.addEventListener('clinic_branch_changed', handleBranchChanged)
      return () => {
        window.removeEventListener('clinic_branch_changed', handleBranchChanged)
      }
    }
  }, [])

  // Fetch clinic details & branches
  useEffect(() => {
    const fetchClinicInfo = async () => {
      try {
        const cQ = query(collection(db, 'clinics'), where('slug', '==', slug))
        const cSnap = await getDocs(cQ)
        if (!cSnap.empty) {
          const cData = { id: cSnap.docs[0].id, ...(cSnap.docs[0].data() as any) }
          setClinic(cData)

          // Fetch branches subcollection
          const bSnap = await getDocs(collection(db, 'clinics', cData.id, 'branches'))
          const bList = bSnap.docs.map(d => ({ id: d.id, ...d.data() }))
          setBranches(bList)
        }
      } catch (err) {
        console.error(err)
      }
    }
    fetchClinicInfo()
  }, [slug])

  // Generate Report
  const generateReport = async () => {
    setIsLoading(true)
    try {
      const cQ = query(collection(db, 'clinics'), where('slug', '==', slug))
      const cSnap = await getDocs(cQ)
      if (cSnap.empty) {
        setIsLoading(false)
        return toast.error('العيادة غير موجودة')
      }
      const cId = cSnap.docs[0].id

      const q = query(
        collection(db, 'appointments'),
        where('clinic_id', '==', cId)
      )
      const snapshot = await getDocs(q)
      
      const allAppts = snapshot.docs.filter(d => {
        const date = d.data().date
        if (!date) return false
        return date >= fromDate && date <= toDate
      })

      // Filter by selected branch if not 'all'
      const filteredByBranch = allAppts.filter(d => {
        if (!selectedBranchId || selectedBranchId === 'all') return true
        const bId = d.data().branch_id
        if (bId) return bId === selectedBranchId
        return selectedBranchId === 'main'
      })

      let rev = 0
      let csh = 0
      let wllt = 0
      let inst = 0
      let coll = 0
      let due = 0
      let totalDiscounts = 0

      let servicesMap: any = {}
      let daysMap: any = { 'Saturday': 0, 'Sunday': 0, 'Monday': 0, 'Tuesday': 0, 'Wednesday': 0, 'Thursday': 0, 'Friday': 0 }
      
      const appts = filteredByBranch.map(d => {
        const data = d.data()
        const origPrice = Number(data.originalPrice || data.servicePrice) || 0
        const price = Number(data.servicePrice) || origPrice
        const disc = data.discount?.amount || (origPrice > price ? origPrice - price : 0)

        totalDiscounts += disc
        rev += origPrice

        if (data.serviceName) {
          servicesMap[data.serviceName] = (servicesMap[data.serviceName] || 0) + 1
        }

        if (data.paymentStatus === 'paid' || data.status === 'completed') {
          coll += price
          if (data.paymentMethod === 'wallet') wllt += price
          else if (data.paymentMethod === 'instapay') inst += price
          else csh += price
          
          if (data.date) {
            const dateObj = new Date(data.date)
            const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' })
            if (daysMap[dayName] !== undefined) {
              daysMap[dayName] += price
            }
          }
        } else {
          due += price
        }
        return { id: d.id, ...data, netPrice: price, discountAmount: disc }
      })

      setReport(appts)
      setTotals({
        revenue: rev,
        patients: appts.length,
        collected: coll,
        due: due,
        discounts: totalDiscounts,
        cash: csh,
        instapay: inst,
        wallet: wllt
      })

      // Prepare Daily Chart
      const arDays: any = { 'Saturday': 'السبت', 'Sunday': 'الأحد', 'Monday': 'الاثنين', 'Tuesday': 'الثلاثاء', 'Wednesday': 'الأربعاء', 'Thursday': 'الخميس', 'Friday': 'الجمعة' }
      let maxDay = 1
      Object.values(daysMap).forEach((v: any) => { if (v > maxDay) maxDay = v })
      const newDaily = Object.keys(daysMap).map(k => ({
        day: arDays[k],
        val: daysMap[k],
        pct: (daysMap[k] / maxDay) * 100
      }))
      setDailyData(newDaily)

      // Prepare Services Chart
      let totalServices = 0
      Object.values(servicesMap).forEach((v: any) => totalServices += v)
      const colors = ['bg-[#087CF4]', 'bg-[#02CFF3]', 'bg-amber-500', 'bg-emerald-500', 'bg-purple-500']
      const newServices = Object.keys(servicesMap).map((k, idx) => ({
        name: k,
        pct: totalServices > 0 ? Math.round((servicesMap[k] / totalServices) * 100) : 0,
        color: colors[idx % colors.length]
      })).sort((a,b) => b.pct - a.pct)
      setServicesData(newServices)

      // Prepare Payments Chart
      const totalCollected = coll || 1
      setPaymentsData([
        { name: 'كاش بالعيادة', pct: Math.round((csh / totalCollected) * 100), color: 'bg-emerald-500', amount: csh },
        { name: 'InstaPay', pct: Math.round((inst / totalCollected) * 100), color: 'bg-purple-500', amount: inst },
        { name: 'محفظة إلكترونية', pct: Math.round((wllt / totalCollected) * 100), color: 'bg-blue-500', amount: wllt }
      ])
      toast.success('تم تحديث التقرير المالي بنجاح')
    } catch (err) {
      console.error(err)
      toast.error('حدث خطأ أثناء تحميل التقرير')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    generateReport()
  }, [slug, selectedBranchId])

  // Multi-branch Breakdown calculation
  const branchBreakdown = useMemo(() => {
    if (branches.length === 0) return []
    return branches.map(b => {
      const bAppts = report.filter(a => a.branch_id === b.id || (!a.branch_id && b.isMain))
      const bRev = bAppts.reduce((sum, a) => sum + (Number(a.originalPrice || a.servicePrice) || 0), 0)
      const bColl = bAppts.reduce((sum, a) => (a.paymentStatus === 'paid' || a.status === 'completed') ? sum + (Number(a.servicePrice) || 0) : sum, 0)
      const bDue = bRev - bColl
      return {
        name: b.name,
        bookingsCount: bAppts.length,
        revenue: bRev,
        collected: bColl,
        due: Math.max(0, bDue)
      }
    })
  }, [branches, report])

  // Print A4 Financial Report Handler via Isolated Iframe
  const handlePrintFinancialReport = () => {
    const selectedBranchObj = branches.find(b => b.id === selectedBranchId)
    const branchLabel = selectedBranchId === 'all' ? 'جميع الفروع' : (selectedBranchObj?.name || 'الفرع الرئيسي')

    const printData: FinancialReportPrintData = {
      clinicName: clinic?.clinicName || 'عيادتنا',
      branchLabel,
      clinicAddress: clinic?.address || '',
      clinicPhone: clinic?.clinicPhone || clinic?.doctorPhone || '',
      logoUrl: clinic?.logoUrl || '',
      fromDate,
      toDate,
      generatedAtCairo: new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' }),
      generatedBy: 'إدارة العيادة',
      totals: {
        revenue: totals.revenue,
        collected: totals.collected,
        due: totals.due,
        discounts: totals.discounts,
        cash: totals.cash,
        instapay: totals.instapay,
        wallet: totals.wallet,
        patientsCount: totals.patients
      },
      transactions: report.map(a => ({
        id: a.id,
        date: a.date || '',
        patientName: a.patientName || 'مريض',
        phone: a.phone || '',
        branchName: a.branchName || (branches.find(b => b.id === a.branch_id)?.name) || 'الفرع الرئيسي',
        serviceName: a.serviceName || 'كشف',
        price: Number(a.originalPrice || a.servicePrice) || 0,
        discount: a.discountAmount || 0,
        netPrice: a.netPrice || Number(a.servicePrice) || 0,
        paymentMethod: a.paymentMethod || 'cash',
        paymentStatus: a.paymentStatus || 'unpaid'
      })),
      branchesBreakdown: branchBreakdown
    }

    const html = generateFinancialReportHtml(printData)
    printHtmlViaIframe(html)
    toast.success('تم فتح نافذة طباعة التقرير المالي الشامل (A4)')
  }

  // Multi-Sheet Excel Export Handler
  const handleExportExcel = async () => {
    if (report.length === 0) {
      return toast.info('لا توجد بيانات مالية لتصديرها')
    }
    const selectedBranchObj = branches.find(b => b.id === selectedBranchId)
    const branchLabel = selectedBranchId === 'all' ? 'جميع الفروع' : (selectedBranchObj?.name || 'الفرع الرئيسي')

    await exportComprehensiveFinancialReportExcel({
      clinicName: clinic?.clinicName || 'العيادة',
      branchLabel,
      fromDate,
      toDate,
      appointments: report,
      branches: branchBreakdown,
      totals: {
        revenue: totals.revenue,
        collected: totals.collected,
        due: totals.due,
        cash: totals.cash,
        instapay: totals.instapay,
        wallet: totals.wallet,
        discounts: totals.discounts,
        patientsCount: totals.patients
      }
    })
    toast.success('تم تصدير ملف الإكسيل المالي متعدد الأوراق بنجاح')
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto" dir="rtl">
      
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-[#087CF4]" />
              التقارير المالية والتحليلات
            </h1>
            {selectedBranchId && selectedBranchId !== 'all' && (
              <Badge variant="outline" className="text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800 font-bold">
                <Building2 className="w-3.5 h-3.5 ml-1" />
                {branches.find(b => b.id === selectedBranchId)?.name || 'فرع محدد'}
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            متابعة دقيقة للإيرادات اليومية والشهرية، تحليل الفروع، وتوزيع الخدمات وطرق الدفع
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Multi-Sheet Excel Export */}
          <Button
            variant="outline"
            onClick={handleExportExcel}
            className="h-10 text-xs font-bold border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-900/30 rounded-xl"
          >
            <FileSpreadsheet className="w-4 h-4 ml-1.5 text-emerald-600" />
            تصدير إكسيل كامل (.xlsx)
          </Button>

          {/* Professional A4 Multi-page Print via Isolated Iframe */}
          <Button
            onClick={handlePrintFinancialReport}
            className="h-10 text-xs font-bold bg-[#087CF4] hover:bg-[#0668cc] text-white rounded-xl shadow-xs"
          >
            <Printer className="w-4 h-4 ml-1.5" />
            طباعة تقرير A4 معتمد
          </Button>
        </div>
      </div>

      {/* 2. Date & Branch Filter Bar */}
      <div className="medical-card p-4 bg-white dark:bg-[#0E2342] dark:border-[#254565]">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-600 dark:text-slate-300">من تاريخ</Label>
            <Input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="h-10 text-xs rounded-xl bg-[#F6F8FB] dark:bg-[#142D50] dark:border-[#254565] dark:text-white"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-600 dark:text-slate-300">إلى تاريخ</Label>
            <Input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="h-10 text-xs rounded-xl bg-[#F6F8FB] dark:bg-[#142D50] dark:border-[#254565] dark:text-white"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-600 dark:text-slate-300">تصفية حسب الفرع</Label>
            <select
              value={selectedBranchId}
              onChange={e => setSelectedBranchId(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-[#E5EAF0] dark:border-[#254565] text-xs font-bold text-slate-700 dark:text-slate-200 bg-[#F6F8FB] dark:bg-[#142D50] focus:bg-white dark:focus:bg-[#0E2342] focus:outline-none focus:ring-2 focus:ring-[#087CF4]/20"
            >
              <option value="all">جميع الفروع</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name} {b.isMain ? '(الرئيسي)' : ''}</option>
              ))}
            </select>
          </div>

          <Button
            onClick={generateReport}
            disabled={isLoading}
            className="w-full h-10 px-6 font-bold bg-[#087CF4] hover:bg-[#0668cc] text-white rounded-xl text-xs"
          >
            {isLoading ? 'جاري التحميل...' : 'تحديث التقرير'}
          </Button>
        </div>
      </div>

      {/* 3. KPI 5 Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Total Revenue */}
        <div className="medical-card p-5 bg-white dark:bg-[#0E2342] dark:border-[#254565]">
          <p className="text-xs font-bold text-slate-400 mb-1">إجمالي المبيعات</p>
          <h3 className="text-2xl font-black text-slate-900 dark:text-white">
            {totals.revenue.toLocaleString()} <span className="text-sm font-bold text-slate-500">ج.م</span>
          </h3>
          <span className="text-[11px] font-semibold text-[#087CF4] mt-1 inline-block">القيمة الإجمالية</span>
        </div>

        {/* Card 2: Operations Count */}
        <div className="medical-card p-5 bg-white dark:bg-[#0E2342] dark:border-[#254565]">
          <p className="text-xs font-bold text-slate-400 mb-1">عدد العمليات</p>
          <h3 className="text-2xl font-black text-[#087CF4]">{totals.patients}</h3>
          <span className="text-[11px] font-semibold text-slate-400 mt-1 inline-block">زيارة مسجلة</span>
        </div>

        {/* Card 3: Collected */}
        <div className="medical-card p-5 bg-white dark:bg-[#0E2342] dark:border-[#254565]">
          <p className="text-xs font-bold text-slate-400 mb-1">تم التحصيل</p>
          <h3 className="text-2xl font-black text-emerald-600">
            {totals.collected.toLocaleString()} <span className="text-sm font-bold text-slate-500">ج.م</span>
          </h3>
          <span className="text-[11px] font-semibold text-emerald-600 mt-1 inline-block">مبالغ مستلمة</span>
        </div>

        {/* Card 4: Due */}
        <div className="medical-card p-5 bg-white dark:bg-[#0E2342] dark:border-[#254565]">
          <p className="text-xs font-bold text-slate-400 mb-1">مستحق / آجل</p>
          <h3 className="text-2xl font-black text-rose-600">
            {totals.due.toLocaleString()} <span className="text-sm font-bold text-slate-500">ج.م</span>
          </h3>
          <span className="text-[11px] font-semibold text-rose-500 mt-1 inline-block">بانتظار التحصيل</span>
        </div>

        {/* Card 5: Discounts */}
        <div className="medical-card p-5 col-span-2 lg:col-span-1 bg-white dark:bg-[#0E2342] dark:border-[#254565]">
          <p className="text-xs font-bold text-slate-400 mb-1">إجمالي الخصومات</p>
          <h3 className="text-2xl font-black text-amber-600">
            {totals.discounts.toLocaleString()} <span className="text-sm font-bold text-slate-500">ج.م</span>
          </h3>
          <span className="text-[11px] font-semibold text-amber-600 mt-1 inline-block">خصومات ممنوحة</span>
        </div>
      </div>

      {/* 4. VISUAL CHARTS & BREAKDOWNS */}
      <div className="grid lg:grid-cols-12 gap-6 items-start">
        
        {/* Daily Revenue Bar Chart (7 cols) */}
        <div className="lg:col-span-7 medical-card p-6 space-y-4 bg-white dark:bg-[#0E2342] dark:border-[#254565]">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5EAF0] dark:border-[#254565]">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#087CF4]" />
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">الإيرادات اليومية حسب أيام الأسبوع</h3>
            </div>
            <span className="text-xs font-bold text-slate-400">
              متوسط يومي: {Math.round(totals.collected / 7).toLocaleString()} ج.م
            </span>
          </div>

          <div className="h-56 flex items-end justify-between gap-2 pt-6 pb-2 px-2">
            {dailyData.map((item, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                <div className="text-[10px] font-black text-slate-500 dark:text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  {item.val.toLocaleString()}
                </div>
                <div
                  style={{ height: `${item.pct}%` }}
                  className="w-full max-w-[36px] bg-[#087CF4] hover:bg-[#0668cc] rounded-t-lg transition-all relative group-hover:shadow-md group-hover:shadow-[#087CF4]/20"
                ></div>
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">{item.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Services & Payment Breakdowns (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Card: Payment Methods Breakdown with Amounts */}
          <div className="medical-card p-5 space-y-3 bg-white dark:bg-[#0E2342] dark:border-[#254565]">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5EAF0] dark:border-[#254565]">
              <h3 className="font-bold text-xs text-slate-900 dark:text-white">طرق الدفع والتحصيل</h3>
              <span className="text-[10px] font-bold text-slate-400">المبلغ والنسبة</span>
            </div>

            <div className="space-y-3 pt-1">
              {paymentsData.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">لا توجد بيانات كافية</p>
              ) : paymentsData.map((p, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-200">
                    <span>{p.name}</span>
                    <span className="text-slate-500 dark:text-slate-400">
                      {p.amount?.toLocaleString()} ج.م ({p.pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                    <div style={{ width: `${p.pct}%` }} className={`h-full ${p.color} rounded-full`}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card: Most Requested Services */}
          <div className="medical-card p-5 space-y-3 bg-white dark:bg-[#0E2342] dark:border-[#254565]">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5EAF0] dark:border-[#254565]">
              <h3 className="font-bold text-xs text-slate-900 dark:text-white">الخدمات الأكثر طلباً</h3>
              <span className="text-[10px] font-bold text-slate-400">النسبة المئوية</span>
            </div>

            <div className="space-y-2.5 pt-1">
              {servicesData.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">لا توجد بيانات كافية</p>
              ) : servicesData.map((s, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-200">
                    <span>{s.name}</span>
                    <span>{s.pct}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                    <div style={{ width: `${s.pct}%` }} className={`h-full ${s.color} rounded-full`}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* 5. BRANCHES COMPARISON TABLE (When multiple branches exist) */}
      {branchBreakdown.length > 0 && (
        <div className="medical-card overflow-hidden bg-white dark:bg-[#0E2342] dark:border-[#254565]">
          <div className="p-5 border-b border-[#E5EAF0] dark:border-[#254565] flex items-center justify-between bg-slate-50/50 dark:bg-[#142D50]/50">
            <div className="flex items-center gap-2.5">
              <Building2 className="w-5 h-5 text-[#087CF4]" />
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">مقارنة أداء الفروع</h3>
                <p className="text-xs text-slate-400">توزيع الحجوزات والإيرادات والمتحصلات بين فروع العيادة</p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#F8FAFC] dark:bg-[#142D50] border-b border-[#E5EAF0] dark:border-[#254565] text-slate-500 dark:text-slate-400 font-bold select-none">
                <tr>
                  <th className="py-3 px-4">اسم الفرع</th>
                  <th className="py-3 px-4 text-center">عدد الحجوزات</th>
                  <th className="py-3 px-4">إجمالي المبيعات</th>
                  <th className="py-3 px-4">المحصل</th>
                  <th className="py-3 px-4">المستحق</th>
                  <th className="py-3 px-4 text-center">نسبة التحصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EAF0] dark:divide-[#254565]">
                {branchBreakdown.map((b, idx) => {
                  const pct = b.revenue > 0 ? Math.round((b.collected / b.revenue) * 100) : 0
                  return (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">{b.name}</td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-800 dark:text-slate-200">{b.bookingsCount}</td>
                      <td className="py-3.5 px-4 font-black text-slate-900 dark:text-white">{b.revenue.toLocaleString()} ج.م</td>
                      <td className="py-3.5 px-4 font-bold text-emerald-600">{b.collected.toLocaleString()} ج.م</td>
                      <td className="py-3.5 px-4 font-bold text-rose-600">{b.due.toLocaleString()} ج.م</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 font-black border border-blue-200 dark:border-blue-800">
                          {pct}%
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  )
}
