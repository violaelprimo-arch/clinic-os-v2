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
import { ShiftClosingModal } from '@/components/clinic/ShiftClosingModal'
import { useLanguage } from '@/context/LanguageContext'

export default function FinancePage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug
  const { t, tDynamic, language, dir, isRtl } = useLanguage()

  const [clinic, setClinic] = useState<any>(null)
  const [branches, setBranches] = useState<any[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all')
  const [isShiftClosingOpen, setIsShiftClosingOpen] = useState(false)

  const formatLocalYMD = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const now = new Date()
  const firstDayOfMonth = formatLocalYMD(new Date(now.getFullYear(), now.getMonth(), 1))
  const lastDayOfMonth = formatLocalYMD(new Date(now.getFullYear(), now.getMonth() + 1, 0))

  const [fromDate, setFromDate] = useState(firstDayOfMonth)
  const [toDate, setToDate] = useState(lastDayOfMonth)
  const [report, setReport] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [weeklyData, setWeeklyData] = useState<any[]>([])
  const [timelineData, setTimelineData] = useState<any[]>([])
  const [chartViewMode, setChartViewMode] = useState<'weekly' | 'timeline'>('weekly')
  const [chartMetric, setChartMetric] = useState<'collected' | 'revenue'>('collected')
  const [hoveredNode, setHoveredNode] = useState<any | null>(null)
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

  // Generate Report with accurate weekly and daily timeline calculations
  const generateReport = async (overrideFrom?: string, overrideTo?: string) => {
    setIsLoading(true)
    try {
      const activeFrom = overrideFrom !== undefined ? overrideFrom : fromDate
      const activeTo = overrideTo !== undefined ? overrideTo : toDate

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
        const itemDate = d.data().date || (d.data().createdAt ? d.data().createdAt.split('T')[0] : '')
        if (!itemDate) return false
        if (activeFrom && itemDate < activeFrom) return false
        if (activeTo && itemDate > activeTo) return false
        return true
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

      let servicesMap: Record<string, number> = {}

      const weekDayKeys = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
      const arDaysMap: Record<string, string> = {
        'Saturday': 'السبت',
        'Sunday': 'الأحد',
        'Monday': 'الاثنين',
        'Tuesday': 'الثلاثاء',
        'Wednesday': 'الأربعاء',
        'Thursday': 'الخميس',
        'Friday': 'الجمعة'
      }

      const weeklyAgg: Record<string, { collected: number; revenue: number; count: number }> = {
        'Saturday': { collected: 0, revenue: 0, count: 0 },
        'Sunday': { collected: 0, revenue: 0, count: 0 },
        'Monday': { collected: 0, revenue: 0, count: 0 },
        'Tuesday': { collected: 0, revenue: 0, count: 0 },
        'Wednesday': { collected: 0, revenue: 0, count: 0 },
        'Thursday': { collected: 0, revenue: 0, count: 0 },
        'Friday': { collected: 0, revenue: 0, count: 0 }
      }

      const timelineMap: Record<string, { date: string; day: string; weekday: string; collected: number; revenue: number; count: number }> = {}

      const appts = filteredByBranch.map(d => {
        const data = d.data()
        const isCancelled = data.status === 'cancelled'
        const origPrice = isCancelled ? 0 : (Number(data.originalPrice || data.servicePrice) || 0)
        const price = isCancelled ? 0 : (Number(data.servicePrice) || origPrice)
        const disc = isCancelled ? 0 : (data.discount?.amount || (origPrice > price ? origPrice - price : 0))

        if (!isCancelled) {
          totalDiscounts += disc
          rev += origPrice
        }

        if (data.serviceName && !isCancelled) {
          servicesMap[data.serviceName] = (servicesMap[data.serviceName] || 0) + 1
        }

        const isPaid = (data.paymentStatus === 'paid' || data.status === 'completed') && !isCancelled

        if (isPaid) {
          coll += price
          if (data.paymentMethod === 'wallet') wllt += price
          else if (data.paymentMethod === 'instapay') inst += price
          else csh += price
        } else if (!isCancelled) {
          due += price
        }

        const itemDate = data.date || (data.createdAt ? data.createdAt.split('T')[0] : '')
        if (itemDate && !isCancelled) {
          const [yr, mo, da] = itemDate.split('-').map(Number)
          let dayKey = 'Saturday'
          let dateLabel = itemDate
          if (yr && mo && da) {
            const dObj = new Date(yr, mo - 1, da)
            const dIdx = dObj.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
            const daysArr = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
            dayKey = daysArr[dIdx]
            dateLabel = `${da}/${mo}`
          }

          if (weeklyAgg[dayKey]) {
            weeklyAgg[dayKey].revenue += origPrice
            weeklyAgg[dayKey].count += 1
            if (isPaid) {
              weeklyAgg[dayKey].collected += price
            }
          }

          if (!timelineMap[itemDate]) {
            timelineMap[itemDate] = {
              date: itemDate,
              day: dateLabel,
              weekday: arDaysMap[dayKey] || dayKey,
              collected: 0,
              revenue: 0,
              count: 0
            }
          }
          timelineMap[itemDate].revenue += origPrice
          timelineMap[itemDate].count += 1
          if (isPaid) {
            timelineMap[itemDate].collected += price
          }
        }

        return { id: d.id, ...data, netPrice: price, discountAmount: disc }
      })

      setReport(appts)
      setTotals({
        revenue: rev,
        patients: appts.filter((a: any) => a.status !== 'cancelled').length,
        collected: coll,
        due: due,
        discounts: totalDiscounts,
        cash: csh,
        instapay: inst,
        wallet: wllt
      })

      // Prepare Weekly Breakdown
      const newWeekly = weekDayKeys.map(k => ({
        key: k,
        day: arDaysMap[k],
        enDay: k,
        collected: weeklyAgg[k].collected,
        revenue: weeklyAgg[k].revenue,
        count: weeklyAgg[k].count
      }))
      setWeeklyData(newWeekly)

      // Prepare Chronological Timeline Breakdown
      const sortedDates = Object.keys(timelineMap).sort()
      const newTimeline = sortedDates.map(dateKey => {
        const item = timelineMap[dateKey]
        return {
          key: dateKey,
          date: dateKey,
          day: `${item.weekday} ${item.day}`,
          collected: item.collected,
          revenue: item.revenue,
          count: item.count
        }
      })
      setTimelineData(newTimeline)

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
      toast.success('تم تحديث التقرير والتحليلات المالية بنجاح')
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

  // Quick Preset Date Ranges
  const handlePreset = (preset: 'today' | 'week' | 'month' | 'prevMonth' | 'all') => {
    const d = new Date()
    let newFrom = ''
    let newTo = ''
    if (preset === 'today') {
      const today = formatLocalYMD(d)
      newFrom = today
      newTo = today
    } else if (preset === 'week') {
      const past = new Date()
      past.setDate(past.getDate() - 6)
      newFrom = formatLocalYMD(past)
      newTo = formatLocalYMD(d)
    } else if (preset === 'month') {
      newFrom = formatLocalYMD(new Date(d.getFullYear(), d.getMonth(), 1))
      newTo = formatLocalYMD(new Date(d.getFullYear(), d.getMonth() + 1, 0))
    } else if (preset === 'prevMonth') {
      newFrom = formatLocalYMD(new Date(d.getFullYear(), d.getMonth() - 1, 1))
      newTo = formatLocalYMD(new Date(d.getFullYear(), d.getMonth(), 0))
    } else if (preset === 'all') {
      newFrom = ''
      newTo = ''
    }
    setFromDate(newFrom)
    setToDate(newTo)
    generateReport(newFrom, newTo)
  }

  // Active Chart Data computed dynamically from metric & view mode
  const activeChartData = useMemo(() => {
    const rawList = chartViewMode === 'weekly' ? weeklyData : timelineData
    if (!rawList || rawList.length === 0) {
      if (chartViewMode === 'weekly') {
        const arDays = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة']
        return arDays.map((d, i) => ({
          key: `empty-${i}`,
          day: d,
          collected: 0,
          revenue: 0,
          count: 0,
          val: 0
        }))
      }
      return []
    }
    return rawList.map(item => ({
      ...item,
      val: chartMetric === 'collected' ? (item.collected || 0) : (item.revenue || 0)
    }))
  }, [chartViewMode, chartMetric, weeklyData, timelineData])

  // Chart Statistics (Peak Day, Average, Total)
  const chartStats = useMemo(() => {
    if (!activeChartData || activeChartData.length === 0) {
      return { peakDay: null, average: 0, total: 0 }
    }
    let total = 0
    let peak = activeChartData[0]
    activeChartData.forEach(item => {
      total += item.val || 0
      if ((item.val || 0) > (peak.val || 0)) {
        peak = item
      }
    })
    const avg = Math.round(total / (activeChartData.length || 1))
    return { peakDay: (peak?.val || 0) > 0 ? peak : null, average: avg, total }
  }, [activeChartData])

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
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto" dir={dir}>
      
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-primary" />
              {t('nav_finance', 'التقارير المالية والتحليلات')}
            </h1>
            {selectedBranchId && selectedBranchId !== 'all' && (
              <Badge variant="outline" className="text-primary bg-primary/10 border-primary/20 font-bold">
                <Building2 className={`w-3.5 h-3.5 ${isRtl ? 'ml-1' : 'mr-1'}`} />
                {tDynamic(branches.find(b => b.id === selectedBranchId)?.name) || (language === 'en' ? 'Selected Branch' : 'فرع محدد')}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {language === 'en' ? 'Accurate monitoring of daily and monthly revenue, branch analysis, service breakdown, and payment methods' : 'متابعة دقيقة للإيرادات اليومية والشهرية، تحليل الفروع، وتوزيع الخدمات وطرق الدفع'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Multi-Sheet Excel Export */}
          <Button
            variant="outline"
            onClick={handleExportExcel}
            className="h-10 text-xs font-bold border-border text-foreground hover:bg-secondary rounded-xl"
          >
            <FileSpreadsheet className={`w-4 h-4 ${isRtl ? 'ml-1.5' : 'mr-1.5'} text-emerald-500`} />
            {t('export_excel_full', 'تصدير إكسيل كامل (.xlsx)')}
          </Button>

          {/* Professional A4 Multi-page Print via Isolated Iframe */}
          <Button
            onClick={handlePrintFinancialReport}
            className="h-10 text-xs font-bold yalla-gradient-btn rounded-xl shadow-xs"
          >
            <Printer className={`w-4 h-4 ${isRtl ? 'ml-1.5' : 'mr-1.5'}`} />
            {t('print_a4_report', 'طباعة تقرير A4 معتمد')}
          </Button>
        </div>
      </div>

      {/* 2. Date & Branch Filter Bar (iOS Frosted Glass) */}
      <div className="ios-glass-card p-4 sm:p-5 border border-border/80 rounded-2xl shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div className="space-y-1">
            <Label className="text-xs font-bold text-muted-foreground">{t('from_date', 'من تاريخ')}</Label>
            <Input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="h-10 text-xs rounded-xl bg-background/80 border-border text-foreground"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-bold text-muted-foreground">{t('to_date', 'إلى تاريخ')}</Label>
            <Input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="h-10 text-xs rounded-xl bg-background/80 border-border text-foreground"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-bold text-muted-foreground">{t('filter_by_branch', 'تصفية حسب الفرع')}</Label>
            <select
              value={selectedBranchId}
              onChange={e => setSelectedBranchId(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-border text-xs font-bold text-foreground bg-background/80 focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">{t('all_branches', 'جميع الفروع')}</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{tDynamic(b.name)} {b.isMain ? (language === 'en' ? '(Main)' : '(الرئيسي)') : ''}</option>
              ))}
            </select>
          </div>

          <Button
            onClick={() => generateReport()}
            disabled={isLoading}
            className="w-full h-10 px-6 font-black yalla-gradient-btn rounded-xl text-xs shadow-md shadow-primary/25 cursor-pointer active:scale-95 transition-all"
          >
            {isLoading ? t('loading', 'جاري التحميل...') : t('update_report', 'تحديث التقرير')}
          </Button>
        </div>

        {/* Quick Date Presets Bar */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/60">
          <span className="text-[11px] font-bold text-muted-foreground ml-1 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-primary" />
            {language === 'en' ? 'Quick Range:' : 'فترات سريعة:'}
          </span>
          {[
            { id: 'today', label: language === 'en' ? 'Today' : 'اليوم' },
            { id: 'week', label: language === 'en' ? 'Last 7 Days' : 'آخر 7 أيام' },
            { id: 'month', label: language === 'en' ? 'This Month' : 'هذا الشهر' },
            { id: 'prevMonth', label: language === 'en' ? 'Last Month' : 'الشهر السابق' },
            { id: 'all', label: language === 'en' ? 'All Periods' : 'كل الفترات' }
          ].map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => handlePreset(p.id as any)}
              className="px-2.5 py-1 text-[11px] font-bold rounded-xl bg-secondary/80 hover:bg-primary/15 hover:text-primary border border-border/60 transition-all cursor-pointer active:scale-95"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. KPI 5 Summary Cards (Neon-Ringed Glass Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Total Revenue */}
        <div className="ios-glass-card p-5 border border-primary/25 rounded-3xl shadow-sm hover:border-primary/50 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-muted-foreground">{t('total_sales', 'إجمالي المبيعات')}</p>
            <div className="w-8 h-8 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-foreground mt-2 font-mono">
            {totals.revenue.toLocaleString()} <span className="text-xs font-bold text-muted-foreground">{t('currency_egp', 'ج.م')}</span>
          </h3>
          <span className="text-[11px] font-bold text-primary mt-1 inline-block">{t('total_value', 'القيمة الإجمالية')}</span>
        </div>

        {/* Card 2: Operations Count */}
        <div className="ios-glass-card p-5 border border-cyan-500/25 rounded-3xl shadow-sm hover:border-cyan-500/50 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-muted-foreground">{t('operations_count', 'عدد العمليات')}</p>
            <div className="w-8 h-8 rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-cyan-600 dark:text-cyan-400 mt-2 font-mono">{totals.patients}</h3>
          <span className="text-[11px] font-bold text-muted-foreground mt-1 inline-block">{t('registered_visit', 'زيارة مسجلة')}</span>
        </div>

        {/* Card 3: Collected */}
        <div className="ios-glass-card p-5 border border-emerald-500/25 rounded-3xl shadow-sm hover:border-emerald-500/50 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-muted-foreground">{t('collected', 'تم التحصيل')}</p>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2 font-mono">
            {totals.collected.toLocaleString()} <span className="text-xs font-bold text-muted-foreground">{t('currency_egp', 'ج.م')}</span>
          </h3>
          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-1 inline-block">{t('received_amounts', 'مبالغ مستلمة')}</span>
        </div>

        {/* Card 4: Due */}
        <div className="ios-glass-card p-5 border border-rose-500/25 rounded-3xl shadow-sm hover:border-rose-500/50 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-muted-foreground">{t('due_or_deferred', 'مستحق / آجل')}</p>
            <div className="w-8 h-8 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-2 font-mono">
            {totals.due.toLocaleString()} <span className="text-xs font-bold text-muted-foreground">{t('currency_egp', 'ج.م')}</span>
          </h3>
          <span className="text-[11px] font-bold text-rose-500 mt-1 inline-block">{t('due_amounts', 'بانتظار التحصيل')}</span>
        </div>

        {/* Card 5: Discounts */}
        <div className="ios-glass-card p-5 col-span-2 lg:col-span-1 border border-amber-500/25 rounded-3xl shadow-sm hover:border-amber-500/50 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-muted-foreground">{t('total_discounts', 'إجمالي الخصومات')}</p>
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2 font-mono">
            {totals.discounts.toLocaleString()} <span className="text-xs font-bold text-muted-foreground">{t('currency_egp', 'ج.م')}</span>
          </h3>
          <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 mt-1 inline-block">{language === 'en' ? 'Discounts Granted' : 'خصومات ممنوحة'}</span>
        </div>
      </div>

      {/* 4. VISUAL CHARTS & BREAKDOWNS (Deep Space Navy Glassmorphic Theme) */}
      <div className="grid lg:grid-cols-12 gap-6 items-start">
        
        {/* Daily / Weekly Revenue Area Curve Chart (7 cols - Matches Bottom-Right Wireframe) */}
        <div className="lg:col-span-7 ios-glass-card p-6 space-y-4 border border-border/80 rounded-3xl shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/80">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-black text-sm text-foreground flex items-center gap-2">
                  {t('daily_breakdown', 'منحنى الإيرادات والتحصيل')}
                </h3>
                <p className="text-[10px] text-muted-foreground">
                  {chartViewMode === 'weekly' 
                    ? (language === 'en' ? 'Weekly distribution (Sat - Fri)' : 'توزيع أيام الأسبوع (السبت - الجمعة)')
                    : (language === 'en' ? 'Daily chronological trajectory' : 'المسار الزمني اليومي بالتاريخ')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Peak Day Badge */}
              {chartStats.peakDay && (
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 flex items-center gap-1 shadow-xs">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  {language === 'en' ? 'Peak:' : 'أعلى يوم:'} {chartStats.peakDay.day} ({chartStats.peakDay.val.toLocaleString()} {t('currency_egp', 'ج.م')})
                </span>
              )}

              {/* Average Badge */}
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-xs">
                {language === 'en' ? 'Daily Avg:' : 'متوسط يومي:'} {chartStats.average.toLocaleString()} {t('currency_egp', 'ج.م')}
              </span>

              {/* View Mode Toggle */}
              <div className="inline-flex rounded-xl p-0.5 bg-secondary/80 border border-border">
                <button
                  type="button"
                  onClick={() => setChartViewMode('weekly')}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                    chartViewMode === 'weekly'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {language === 'en' ? 'Weekly' : 'أسبوعي'}
                </button>
                <button
                  type="button"
                  onClick={() => setChartViewMode('timeline')}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                    chartViewMode === 'timeline'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {language === 'en' ? 'Timeline' : 'زمني'}
                </button>
              </div>

              {/* Metric Toggle */}
              <div className="inline-flex rounded-xl p-0.5 bg-secondary/80 border border-border">
                <button
                  type="button"
                  onClick={() => setChartMetric('collected')}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                    chartMetric === 'collected'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {language === 'en' ? 'Collected' : 'المحصل'}
                </button>
                <button
                  type="button"
                  onClick={() => setChartMetric('revenue')}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                    chartMetric === 'revenue'
                      ? 'bg-cyan-600 text-white shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {language === 'en' ? 'Sales' : 'المبيعات'}
                </button>
              </div>
            </div>
          </div>

          {/* Glowing SVG Area Curve */}
          <div className="relative w-full h-64 pt-2">
            {(() => {
              const count = activeChartData.length || 7
              const maxVal = Math.max(...activeChartData.map(d => d.val || 0), 100)
              const width = 700
              const height = 190
              const paddingY = 28
              const chartH = height - paddingY * 2
              const colW = width / (count || 1)

              const points = activeChartData.map((d, i) => {
                // In RTL, column 0 (e.g. Saturday) is placed on the far right
                const x = isRtl
                  ? width - (i + 0.5) * colW
                  : (i + 0.5) * colW
                const normalizedY = maxVal > 0 ? (1 - (d.val || 0) / maxVal) : 1
                const y = paddingY + normalizedY * chartH
                return { x, y, ...d, index: i }
              })

              const sortedPoints = [...points].sort((a, b) => a.x - b.x)

              let pathD = ''
              let areaD = ''

              if (sortedPoints.length > 0) {
                pathD = `M ${sortedPoints[0].x} ${sortedPoints[0].y}`
                for (let i = 0; i < sortedPoints.length - 1; i++) {
                  const p0 = sortedPoints[i]
                  const p1 = sortedPoints[i + 1]
                  const cp1x = p0.x + (p1.x - p0.x) / 2
                  const cp1y = p0.y
                  const cp2x = p0.x + (p1.x - p0.x) / 2
                  const cp2y = p1.y
                  pathD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`
                }
                areaD = `${pathD} L ${sortedPoints[sortedPoints.length - 1].x} ${height} L ${sortedPoints[0].x} ${height} Z`
              }

              return (
                <div className="relative w-full h-full flex flex-col justify-between select-none">
                  {/* Floating Tooltip when hovering a node */}
                  {hoveredNode && (
                    <div
                      style={{
                        left: `${(hoveredNode.x / width) * 100}%`,
                        top: `${Math.max(4, (hoveredNode.y / height) * 100 - 32)}%`
                      }}
                      className="absolute -translate-x-1/2 -translate-y-full pointer-events-none z-30 transition-all duration-150"
                    >
                      <div className="bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-2xl border border-cyan-400/50 shadow-[0_12px_32px_rgba(0,240,255,0.3)] rounded-2xl px-3.5 py-2 text-white text-center min-w-[140px]">
                        <div className="text-[11px] font-black text-cyan-400 flex items-center justify-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {hoveredNode.day}
                        </div>
                        <div className="text-base font-black font-mono mt-0.5 text-white">
                          {(hoveredNode.val || 0).toLocaleString()} <span className="text-[10px] font-bold text-slate-300">ج.م</span>
                        </div>
                        <div className="text-[10px] text-slate-300 mt-0.5 flex items-center justify-center gap-1.5 font-bold">
                          <span>{hoveredNode.count || 0} كشف</span>
                          <span>•</span>
                          <span>محصل: {(hoveredNode.collected || 0).toLocaleString()} ج.م</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-44 overflow-visible" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="financeAreaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#00F0FF" stopOpacity="0.4" />
                        <stop offset="60%" stopColor="#0066FF" stopOpacity="0.12" />
                        <stop offset="100%" stopColor="#081226" stopOpacity="0.0" />
                      </linearGradient>
                      <linearGradient id="financeStrokeGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#00F0FF" />
                        <stop offset="100%" stopColor="#0066FF" />
                      </linearGradient>
                      <filter id="financeGlow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="3.5" result="glow" />
                        <feComposite in="SourceGraphic" in2="glow" operator="over" />
                      </filter>
                    </defs>

                    {/* Dotted Horizontal Currency Grid lines */}
                    {[0.25, 0.5, 0.75].map((pct, idx) => {
                      const gridY = paddingY + chartH * pct
                      const gridVal = Math.round(maxVal * (1 - pct))
                      return (
                        <g key={idx}>
                          <line
                            x1={10}
                            y1={gridY}
                            x2={width - 10}
                            y2={gridY}
                            stroke="currentColor"
                            className="text-border/30 dark:text-border/20"
                            strokeDasharray="4 4"
                            strokeWidth="1"
                          />
                          <text
                            x={isRtl ? 15 : width - 15}
                            y={gridY - 4}
                            textAnchor={isRtl ? 'start' : 'end'}
                            className="fill-muted-foreground/60 text-[9px] font-mono font-bold"
                          >
                            {gridVal.toLocaleString()} {t('currency_egp', 'ج.م')}
                          </text>
                        </g>
                      )
                    })}

                    {/* Vertical Guide Line on Hover */}
                    {hoveredNode && (
                      <line
                        x1={hoveredNode.x}
                        y1={paddingY}
                        x2={hoveredNode.x}
                        y2={height}
                        stroke="#00F0FF"
                        strokeDasharray="3 3"
                        strokeWidth="1.5"
                        className="opacity-70 animate-pulse"
                      />
                    )}

                    {/* Area Fill */}
                    {areaD && (
                      <path d={areaD} fill="url(#financeAreaGradient)" />
                    )}

                    {/* Stroke Spline */}
                    {pathD && (
                      <path
                        d={pathD}
                        fill="none"
                        stroke="url(#financeStrokeGradient)"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        filter="url(#financeGlow)"
                      />
                    )}

                    {/* Point Nodes */}
                    {points.map((p, idx) => {
                      const isHovered = hoveredNode?.index === p.index
                      return (
                        <g
                          key={idx}
                          className="cursor-pointer"
                          onMouseEnter={() => setHoveredNode(p)}
                          onMouseLeave={() => setHoveredNode(null)}
                        >
                          {/* Transparent hit area */}
                          <circle cx={p.x} cy={p.y} r="18" className="fill-transparent" />
                          
                          {/* Hover ring */}
                          {isHovered && (
                            <circle
                              cx={p.x}
                              cy={p.y}
                              r="12"
                              className="fill-cyan-400/25 animate-ping"
                            />
                          )}

                          {/* Point core */}
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r={isHovered ? 6.5 : 4.5}
                            className={`transition-all duration-150 ${
                              isHovered
                                ? 'fill-cyan-400 stroke-background stroke-2 shadow-lg'
                                : 'fill-background stroke-cyan-400 stroke-[2.5]'
                            }`}
                          />
                        </g>
                      )
                    })}
                  </svg>

                  {/* Dynamic Day / Date Columns Row */}
                  <div className="flex items-center justify-between px-1 pt-3 border-t border-border/60 gap-1.5 overflow-x-auto">
                    {activeChartData.map((item, i) => {
                      const isHovered = hoveredNode?.index === i
                      return (
                        <div
                          key={i}
                          onMouseEnter={() => {
                            const pt = points.find(p => p.index === i)
                            if (pt) setHoveredNode(pt)
                          }}
                          onMouseLeave={() => setHoveredNode(null)}
                          className={`flex-1 min-w-[50px] text-center p-2 rounded-2xl transition-all cursor-pointer border ${
                            isHovered
                              ? 'bg-primary/15 border-primary/40 shadow-sm -translate-y-1'
                              : 'bg-background/40 hover:bg-background/80 border-transparent'
                          }`}
                        >
                          <span className="text-[11px] font-bold text-muted-foreground block truncate">
                            {tDynamic(item.day)}
                          </span>
                          <span className="text-[11px] font-mono font-black text-foreground block mt-0.5">
                            {item.val ? item.val.toLocaleString() : '0'}
                          </span>
                          <span className="text-[9px] font-bold text-muted-foreground/80 block mt-0.5">
                            {item.count ? `${item.count} كشف` : '-'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}
          </div>
        </div>

        {/* Services & Payment Breakdowns (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Card: Payment Methods Breakdown */}
          <div className="ios-glass-card p-5 space-y-3 border border-border/80 rounded-3xl shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-border/80">
              <h3 className="font-black text-xs text-foreground">{t('payment_methods_distribution', 'طرق الدفع والتحصيل')}</h3>
              <span className="text-[10px] font-bold text-muted-foreground">{language === 'en' ? 'Amount & Percentage' : 'المبلغ والنسبة'}</span>
            </div>

            <div className="space-y-3 pt-1">
              {paymentsData.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">{language === 'en' ? 'No data available' : 'لا توجد بيانات كافية'}</p>
              ) : paymentsData.map((p, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-foreground">
                    <span>{tDynamic(p.name)}</span>
                    <span className="text-muted-foreground font-mono">
                      {p.amount?.toLocaleString()} {t('currency_egp', 'ج.م')} ({p.pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-secondary/80 overflow-hidden p-0.5">
                    <div style={{ width: `${Math.max(p.pct, 4)}%` }} className={`h-full ${p.color || 'bg-primary'} rounded-full shadow-xs`}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card: Most Requested Services */}
          <div className="ios-glass-card p-5 space-y-3 border border-border/80 rounded-3xl shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-border/80">
              <h3 className="font-black text-xs text-foreground">{t('services_distribution', 'الخدمات الأكثر طلباً')}</h3>
              <span className="text-[10px] font-bold text-muted-foreground">{language === 'en' ? 'Percentage' : 'النسبة المئوية'}</span>
            </div>

            <div className="space-y-2.5 pt-1">
              {servicesData.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">{language === 'en' ? 'No data available' : 'لا توجد بيانات كافية'}</p>
              ) : servicesData.map((s, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-foreground">
                    <span>{tDynamic(s.name)}</span>
                    <span className="text-primary font-black font-mono">{s.pct}%</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-secondary/80 overflow-hidden p-0.5">
                    <div style={{ width: `${Math.max(s.pct, 4)}%` }} className={`h-full ${s.color || 'bg-cyan-500'} rounded-full shadow-xs`}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* 5. BRANCHES COMPARISON TABLE (When multiple branches exist) */}
      {branchBreakdown.length > 0 && (
        <div className="ios-glass-card overflow-hidden border border-border/80 rounded-3xl shadow-sm">
          <div className="p-5 border-b border-border/80 flex items-center justify-between bg-secondary/30 backdrop-blur-sm">
            <div className="flex items-center gap-2.5">
              <Building2 className="w-5 h-5 text-primary" />
              <div>
                <h3 className="font-black text-base text-foreground">{t('branches_performance', 'مقارنة أداء الفروع')}</h3>
                <p className="text-xs text-muted-foreground">{language === 'en' ? 'Distribution of bookings, revenues, and collections across clinic branches' : 'توزيع الحجوزات والإيرادات والمتحصلات بين فروع العيادة'}</p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className={`w-full ${isRtl ? 'text-right' : 'text-left'} text-xs`}>
              <thead className="bg-secondary/40 border-b border-border/80 text-muted-foreground font-bold select-none">
                <tr>
                  <th className="py-3 px-4">{t('branch_name', 'اسم الفرع')}</th>
                  <th className="py-3 px-4 text-center">{t('operations_count', 'عدد الحجوزات')}</th>
                  <th className="py-3 px-4">{t('total_sales', 'إجمالي المبيعات')}</th>
                  <th className="py-3 px-4">{t('collected', 'المحصل')}</th>
                  <th className="py-3 px-4">{t('due_amounts', 'المستحق')}</th>
                  <th className="py-3 px-4 text-center">{language === 'en' ? 'Collection Rate' : 'نسبة التحصيل'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {branchBreakdown.map((b, idx) => {
                  const pct = b.revenue > 0 ? Math.round((b.collected / b.revenue) * 100) : 0
                  return (
                    <tr key={idx} className="hover:bg-secondary/30 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-foreground">{tDynamic(b.name)}</td>
                      <td className="py-3.5 px-4 text-center font-bold text-foreground font-mono">{b.bookingsCount}</td>
                      <td className="py-3.5 px-4 font-black text-foreground font-mono">{b.revenue.toLocaleString()} {t('currency_egp', 'ج.م')}</td>
                      <td className="py-3.5 px-4 font-bold text-emerald-600 dark:text-emerald-400 font-mono">{b.collected.toLocaleString()} {t('currency_egp', 'ج.م')}</td>
                      <td className="py-3.5 px-4 font-bold text-rose-600 dark:text-rose-400 font-mono">{b.due.toLocaleString()} {t('currency_egp', 'ج.م')}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-mono font-black border border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.2)]">
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

          {/* Shift Closing & Cash Reconciliation Modal */}
      {isShiftClosingOpen && (
        <ShiftClosingModal
          isOpen={true}
          onClose={() => setIsShiftClosingOpen(false)}
          clinic={clinic}
          appointments={report}
          selectedBranchId={selectedBranchId}
        />
      )}

    </div>
  )
}
