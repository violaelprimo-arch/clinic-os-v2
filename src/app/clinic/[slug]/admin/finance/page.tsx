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
  Download, Plus, Trash2, Receipt, AlertCircle, FileSpreadsheet
} from 'lucide-react'
import { toast } from 'sonner'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { cairoDate } from '@/lib/clinic-domain'
import { recordAuditLog } from '@/lib/audit-logger'

export default function FinancePage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug

  // Default to current month in Cairo time
  const todayCairo = cairoDate(new Date())
  const [yearStr, monthStr] = todayCairo.split('-')
  const defaultFrom = `${yearStr}-${monthStr}-01`
  const defaultTo = `${yearStr}-${monthStr}-31`

  const [fromDate, setFromDate] = useState(defaultFrom)
  const [toDate, setToDate] = useState(defaultTo)
  const [report, setReport] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [clinicId, setClinicId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Add Expense Dialog State
  const [isExpenseOpen, setIsExpenseOpen] = useState(false)
  const [expenseTitle, setExpenseTitle] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseCategory, setExpenseCategory] = useState<'salaries' | 'rent' | 'supplies' | 'maintenance' | 'other'>('supplies')
  const [isAddingExpense, setIsAddingExpense] = useState(false)

  // Real financial metrics
  const [totals, setTotals] = useState({
    revenue: 0,
    patients: 0,
    collected: 0,
    due: 0,
    discounts: 0,
    refunds: 0,
    paidCount: 0,
    unpaidCount: 0,
    cash: 0,
    instapay: 0,
    wallet: 0
  })

  // Dynamic breakdowns
  const [serviceBreakdown, setServiceBreakdown] = useState<Array<{ name: string; count: number; pct: number }>>([])
  const [paymentBreakdown, setPaymentBreakdown] = useState<Array<{ name: string; amount: number; pct: number; color: string }>>([])
  const [dailyRevenue, setDailyRevenue] = useState<Array<{ date: string; day: string; amount: number; pct: number }>>([])

  const fetchExpenses = async (cId: string) => {
    try {
      const q = query(
        collection(db, 'expenses'),
        where('clinic_id', '==', cId)
      )
      const snap = await getDocs(q)
      const allExpenses = snap.docs.map(d => ({ id: d.id, ...d.data() } as any))
      const filtered = allExpenses.filter(e => {
        if (!e.date) return true
        return e.date >= fromDate && e.date <= toDate
      })
      setExpenses(filtered)
    } catch (e) {
      console.warn('Failed to fetch expenses:', e)
    }
  }

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
      setClinicId(cId)

      await fetchExpenses(cId)

      // Query appointments by clinic without composite index requirement
      let apptDocs: any[] = []
      try {
        const q = query(
          collection(db, 'appointments'),
          where('clinic_id', '==', cId)
        )
        const snapshot = await getDocs(q)
        apptDocs = snapshot.docs
      } catch (err) {
        console.warn('Fallback querying appointments by slug:', err)
        const q = query(
          collection(db, 'appointments'),
          where('clinic_id', '==', slug)
        )
        const snapshot = await getDocs(q)
        apptDocs = snapshot.docs
      }

      // Filter date range in-memory (No Firebase composite index needed)
      const filteredDocs = apptDocs.filter(d => {
        const dDate = d.data()?.date
        if (!dDate) return false
        return dDate >= fromDate && dDate <= toDate
      })

      let rev = 0
      let csh = 0
      let wllt = 0
      let inst = 0
      let coll = 0
      let due = 0
      let disc = 0
      let refunds = 0
      let paidCount = 0
      let unpaidCount = 0

      const serviceCountMap = new Map<string, number>()
      const dayAmountMap = new Map<string, number>()

      const appts = filteredDocs.map(d => {
        const data = d.data()
        const price = Number(data.servicePrice) || 0
        const itemDiscount = Number(data.discountApplied) || 0
        disc += itemDiscount
        rev += price

        const isPaid = data.paymentStatus === 'paid'
        if (isPaid) {
          coll += price
          paidCount++
          if (data.paymentMethod === 'wallet') wllt += price
          else if (data.paymentMethod === 'instapay') inst += price
          else csh += price
        } else {
          due += price
          unpaidCount++
        }

        // Service aggregation
        const sName = data.serviceName || 'كشف عام'
        serviceCountMap.set(sName, (serviceCountMap.get(sName) || 0) + 1)

        // Day aggregation
        const apptDate = data.date || todayCairo
        dayAmountMap.set(apptDate, (dayAmountMap.get(apptDate) || 0) + (isPaid ? price : 0))

        return { id: d.id, ...data }
      })

      setReport(appts)
      setTotals({
        revenue: rev,
        patients: appts.length,
        collected: coll,
        due,
        discounts: disc,
        refunds,
        paidCount,
        unpaidCount,
        cash: csh,
        instapay: inst,
        wallet: wllt
      })

      // Calculate service percentages
      if (appts.length > 0) {
        const sBreak = Array.from(serviceCountMap.entries()).map(([name, count]) => ({
          name,
          count,
          pct: Math.round((count / appts.length) * 100)
        }))
        setServiceBreakdown(sBreak)
      } else {
        setServiceBreakdown([])
      }

      // Calculate payment method breakdown
      if (coll > 0) {
        setPaymentBreakdown([
          { name: 'كاش بالعيادة', amount: csh, pct: Math.round((csh / coll) * 100), color: 'bg-emerald-500' },
          { name: 'انستاباي (InstaPay)', amount: inst, pct: Math.round((inst / coll) * 100), color: 'bg-purple-500' },
          { name: 'محفظة إلكترونية', amount: wllt, pct: Math.round((wllt / coll) * 100), color: 'bg-blue-500' }
        ])
      } else {
        setPaymentBreakdown([])
      }

      // Calculate daily distribution for the last 7 days or date range
      const dayList: Array<{ date: string; day: string; amount: number; pct: number }> = []
      let maxDayVal = 1
      dayAmountMap.forEach(v => {
        if (v > maxDayVal) maxDayVal = v
      })

      dayAmountMap.forEach((val, dateKey) => {
        let dayName = dateKey
        try {
          dayName = new Intl.DateTimeFormat('ar-EG', { weekday: 'short', timeZone: 'Africa/Cairo' }).format(new Date(dateKey))
        } catch {}
        dayList.push({
          date: dateKey,
          day: dayName,
          amount: val,
          pct: Math.max(10, Math.round((val / maxDayVal) * 100))
        })
      })

      setDailyRevenue(dayList.slice(-7))

      toast.success('تم تحديث التقرير المالي بناءً على البيانات الفعلية')
    } catch (err: any) {
      console.error('generateReport error:', err)
      toast.error('حدث خطأ أثناء تحميل التقرير: ' + (err?.message || ''))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    generateReport()
  }, [slug])

  // Total expenses
  const totalExpenses = useMemo(() => {
    return expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
  }, [expenses])

  // Net Cashflow Formula: المقبوضات الفعلية - المصروفات المسددة - المبالغ المستردة
  const netCashFlow = useMemo(() => {
    return totals.collected - totalExpenses - totals.refunds
  }, [totals.collected, totalExpenses, totals.refunds])

  const handleAddExpense = async () => {
    if (!expenseTitle.trim()) return toast.error('يرجى إدخال وصف المصروف')
    const amt = Number(expenseAmount)
    if (!amt || amt <= 0) return toast.error('يرجى إدخال مبلغ صحيح')
    if (!clinicId) return toast.error('معرف العيادة غير متوفر')

    setIsAddingExpense(true)
    try {
      await addDoc(collection(db, 'expenses'), {
        clinic_id: clinicId,
        title: expenseTitle.trim(),
        amount: amt,
        category: expenseCategory,
        date: todayCairo,
        createdAt: new Date().toISOString()
      })

      recordAuditLog({
        action: 'EXPENSE_RECORDED',
        actorName: 'الطبيب / الإدارة',
        actorRole: 'doctor',
        clinicId,
        details: { title: expenseTitle, amount: amt, category: expenseCategory }
      })

      toast.success('تم تسجيل المصروف بنجاح')
      setIsExpenseOpen(false)
      setExpenseTitle('')
      setExpenseAmount('')
      if (clinicId) fetchExpenses(clinicId)
    } catch (e) {
      toast.error('فشل حفظ المصروف')
    } finally {
      setIsAddingExpense(false)
    }
  }

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المصروف؟')) return
    try {
      await deleteDoc(doc(db, 'expenses', id))
      toast.success('تم حذف المصروف')
      if (clinicId) fetchExpenses(clinicId)
    } catch (e) {
      toast.error('حدث خطأ أثناء الحذف')
    }
  }

  // Export CSV
  const exportCSV = () => {
    if (report.length === 0) return toast.info('لا توجد معاملات لتصديرها في هذه الفترة')
    const headers = 'رقم المعاملة,اسم المريض,رقم الهاتف,الخدمة,التاريخ,طريقة الدفع,المبلغ,حالة الدفع\n'
    const rows = report.map(r => 
      `"${r.id || ''}","${r.patientName || ''}","${r.phone || ''}","${r.serviceName || ''}","${r.date || ''}","${r.paymentMethod || 'cash'}","${r.servicePrice || 0}","${r.paymentStatus || 'pending'}"`
    ).join('\n')

    const blob = new Blob(['\uFEFF' + headers + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `financial_report_${fromDate}_to_${toDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('تم تصدير كشف الحساب بنجاح بصيغة CSV')
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto" dir="rtl">
      
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-black text-[#182230] flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-[#15B8A6]" />
            التقارير المالية والتحليلات
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            متابعة دقيقة وفعلية للإيرادات والمصروفات وصافي التدفق النقدي
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={exportCSV}
            className="h-10 text-xs font-bold border-[#E5EAF0] text-slate-700 hover:bg-slate-100 rounded-xl flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-4 h-4 ml-1 text-[#15B8A6]" />
            تصدير كشف حساب CSV
          </Button>

          <Button
            variant="outline"
            onClick={() => window.print()}
            className="h-10 text-xs font-bold border-[#E5EAF0] text-slate-700 hover:bg-slate-100 rounded-xl"
          >
            <Printer className="w-4 h-4 ml-1.5" />
            طباعة التقرير
          </Button>
        </div>
      </div>

      {/* 2. Date Filter Bar */}
      <div className="medical-card p-4 print:hidden bg-white">
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1 space-y-1 w-full">
            <Label className="text-xs font-bold text-slate-600">من تاريخ</Label>
            <Input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="h-10 text-xs rounded-xl bg-[#F6F8FB]"
            />
          </div>

          <div className="flex-1 space-y-1 w-full">
            <Label className="text-xs font-bold text-slate-600">إلى تاريخ</Label>
            <Input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="h-10 text-xs rounded-xl bg-[#F6F8FB]"
            />
          </div>

          <Button
            onClick={generateReport}
            disabled={isLoading}
            className="w-full sm:w-auto h-10 px-6 font-bold bg-[#15B8A6] hover:bg-[#0D9488] text-white rounded-xl text-xs"
          >
            {isLoading ? 'جاري التحميل...' : 'تحديث التقرير'}
          </Button>
        </div>
      </div>

      {/* 3. KPI Summary Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Revenue */}
        <div className="medical-card p-5">
          <p className="text-xs font-bold text-slate-400 mb-1">إجمالي الحجوزات</p>
          <h3 className="text-2xl font-black text-[#182230]">
            {totals.revenue.toLocaleString()} <span className="text-sm font-bold text-slate-500">ج.م</span>
          </h3>
          <span className="text-[11px] font-semibold text-[#15B8A6] mt-1 inline-block">
            {totals.patients} كشف مسجل
          </span>
        </div>

        {/* Card 2: Actual Collected */}
        <div className="medical-card p-5">
          <p className="text-xs font-bold text-slate-400 mb-1">تم التحصيل الفعلي</p>
          <h3 className="text-2xl font-black text-emerald-600">
            {totals.collected.toLocaleString()} <span className="text-sm font-bold text-slate-500">ج.م</span>
          </h3>
          <span className="text-[11px] font-semibold text-emerald-600/80 mt-1 inline-block">
            {totals.paidCount} عملية مؤكدة
          </span>
        </div>

        {/* Card 3: Due / Outstanding */}
        <div className="medical-card p-5">
          <p className="text-xs font-bold text-slate-400 mb-1">مستحق في الانتظار</p>
          <h3 className="text-2xl font-black text-amber-600">
            {totals.due.toLocaleString()} <span className="text-sm font-bold text-slate-500">ج.م</span>
          </h3>
          <span className="text-[11px] font-semibold text-amber-600/80 mt-1 inline-block">
            {totals.unpaidCount} غير محصل
          </span>
        </div>

        {/* Card 4: Net Cash Flow */}
        <div className="medical-card p-5 bg-gradient-to-br from-teal-50/60 to-white border-teal-200">
          <p className="text-xs font-bold text-teal-800 mb-1">صافي التدفق النقدي</p>
          <h3 className={`text-2xl font-black ${netCashFlow >= 0 ? 'text-[#15B8A6]' : 'text-rose-600'}`}>
            {netCashFlow.toLocaleString()} <span className="text-sm font-bold text-slate-500">ج.م</span>
          </h3>
          <span className="text-[10px] font-semibold text-slate-500 mt-1 inline-block">
            (المقبوضات - المصروفات)
          </span>
        </div>
      </div>

      {/* 4. EXPENSES & DETAILED CHARTS */}
      <div className="grid lg:grid-cols-12 gap-6 items-start">
        
        {/* Left: Expenses Section (7 cols) */}
        <div className="lg:col-span-7 medical-card p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5EAF0]">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-rose-500" />
              <h3 className="font-bold text-sm text-[#182230]">
                مصروفات العيادة ({totalExpenses.toLocaleString()} ج.م)
              </h3>
            </div>

            <Dialog open={isExpenseOpen} onOpenChange={setIsExpenseOpen}>
              <DialogTrigger className="h-8 text-xs font-bold bg-rose-500 hover:bg-rose-600 text-white rounded-lg px-3 flex items-center cursor-pointer">
                <Plus className="w-3.5 h-3.5 ml-1" />
                تسجيل مصروف
              </DialogTrigger>
              <DialogContent dir="rtl" className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-sm font-bold">تسجيل مصروف جديد</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 pt-2">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-600">بند المصروف</Label>
                    <Input
                      placeholder="مثال: فاتورة كهرباء، مستلزمات طبية، شاش وقطن..."
                      value={expenseTitle}
                      onChange={e => setExpenseTitle(e.target.value)}
                      className="h-10 text-xs rounded-xl"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-600">المبلغ (ج.م)</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={expenseAmount}
                        onChange={e => setExpenseAmount(e.target.value)}
                        className="h-10 text-xs rounded-xl font-bold"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-600">التصنيف</Label>
                      <select
                        value={expenseCategory}
                        onChange={e => setExpenseCategory(e.target.value as any)}
                        className="h-10 px-3 w-full rounded-xl border border-[#E5EAF0] text-xs font-bold bg-white text-slate-700"
                      >
                        <option value="supplies">مستلزمات طبية</option>
                        <option value="salaries">رواتب وأجور</option>
                        <option value="rent">إيجار ومرافق</option>
                        <option value="maintenance">صيانة</option>
                        <option value="other">مصروفات أخرى</option>
                      </select>
                    </div>
                  </div>

                  <Button
                    onClick={handleAddExpense}
                    disabled={isAddingExpense}
                    className="w-full h-10 mt-2 bg-[#15B8A6] hover:bg-[#0D9488] text-white font-bold text-xs rounded-xl"
                  >
                    {isAddingExpense ? 'جاري الحفظ...' : 'تأكيد وحفظ المصروف'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Expenses Table */}
          {expenses.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              لا توجد مصروفات مسجلة في هذه الفترة الزمنية.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-60 overflow-y-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-[#E5EAF0]">
                  <tr>
                    <th className="py-2.5 px-3">البند</th>
                    <th className="py-2.5 px-3">التصنيف</th>
                    <th className="py-2.5 px-3">التاريخ</th>
                    <th className="py-2.5 px-3 text-left">المبلغ</th>
                    <th className="py-2.5 px-2 text-center">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5EAF0]">
                  {expenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-bold text-slate-800">{exp.title}</td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {exp.category === 'salaries' ? 'رواتب' : exp.category === 'rent' ? 'إيجار' : exp.category === 'maintenance' ? 'صيانة' : 'مستلزمات'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-400">{exp.date}</td>
                      <td className="py-2.5 px-3 text-left font-mono font-bold text-rose-600">
                        {exp.amount} ج.م
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <button
                          onClick={() => handleDeleteExpense(exp.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right: Dynamic Breakdowns (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Card: Most Requested Services */}
          <div className="medical-card p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5EAF0]">
              <h3 className="font-bold text-xs text-[#182230]">الخدمات الأكثر طلباً</h3>
              <span className="text-[10px] font-bold text-slate-400">النسبة الفعلية</span>
            </div>

            {serviceBreakdown.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">لا توجد بيانات خدمات في هذه الفترة</p>
            ) : (
              <div className="space-y-2.5 pt-1">
                {serviceBreakdown.map((s, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs font-bold text-slate-700">
                      <span>{s.name} ({s.count})</span>
                      <span>{s.pct}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div style={{ width: `${s.pct}%` }} className="h-full bg-[#15B8A6] rounded-full"></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card: Payment Methods Breakdown */}
          <div className="medical-card p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5EAF0]">
              <h3 className="font-bold text-xs text-[#182230]">طرق التحصيل الفعلية</h3>
              <span className="text-[10px] font-bold text-slate-400">حسب الإيراد</span>
            </div>

            {paymentBreakdown.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">لا توجد مبالغ محصلة في هذه الفترة</p>
            ) : (
              <div className="space-y-2.5 pt-1">
                {paymentBreakdown.map((p, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs font-bold text-slate-700">
                      <span>{p.name} ({p.amount.toLocaleString()} ج.م)</span>
                      <span>{p.pct}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div style={{ width: `${p.pct}%` }} className={`h-full ${p.color} rounded-full`}></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  )
}
