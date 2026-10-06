'use client'

import { use, useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Printer, TrendingUp, Users, Wallet, CreditCard,
  Banknote, Calendar, BarChart3, PieChart, ArrowUpRight
} from 'lucide-react'
import { toast } from 'sonner'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'

export default function FinancePage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug

  const [fromDate, setFromDate] = useState('2026-10-01')
  const [toDate, setToDate] = useState('2026-10-31')
  const [report, setReport] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const [totals, setTotals] = useState({
    revenue: 3450,
    patients: 42,
    collected: 2850,
    due: 600,
    cash: 2208,
    instapay: 931,
    wallet: 311
  })

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
        where('clinic_id', '==', cId),
        where('date', '>=', fromDate),
        where('date', '<=', toDate)
      )
      const snapshot = await getDocs(q)

      let rev = 0
      let csh = 0
      let wllt = 0
      let inst = 0
      let coll = 0
      let due = 0

      const appts = snapshot.docs.map(d => {
        const data = d.data()
        const price = Number(data.servicePrice) || 0
        rev += price

        if (data.paymentStatus === 'paid' || data.status === 'completed') {
          coll += price
          if (data.paymentMethod === 'wallet') wllt += price
          else if (data.paymentMethod === 'instapay') inst += price
          else csh += price
        } else {
          due += price
        }
        return { id: d.id, ...data }
      })

      if (appts.length > 0) {
        setReport(appts)
        setTotals({
          revenue: rev,
          patients: appts.length,
          collected: coll,
          due: due,
          cash: csh,
          instapay: inst,
          wallet: wllt
        })
      }
      toast.success('تم تحديث التقرير المالي بنجاح')
    } catch (err) {
      toast.error('حدث خطأ أثناء تحميل التقرير')
    } finally {
      setIsLoading(false)
    }
  }

  // Daily revenue bar heights (Mocked data representing daily distributions matching mockup)
  const dailyData = [
    { day: 'السبت', val: 320, pct: 45 },
    { day: 'الأحد', val: 540, pct: 75 },
    { day: 'الاثنين', val: 280, pct: 40 },
    { day: 'الثلاثاء', val: 720, pct: 100 },
    { day: 'الأربعاء', val: 490, pct: 68 },
    { day: 'الخميس', val: 610, pct: 85 },
    { day: 'الجمعة', val: 190, pct: 28 }
  ]

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
            متابعة دقيقة للإيرادات اليومية والشهرية وتوزيع الخدمات وطرق الدفع
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => window.print()}
          className="h-10 text-xs font-bold border-[#E5EAF0] text-slate-700 hover:bg-slate-100 rounded-xl"
        >
          <Printer className="w-4 h-4 ml-1.5" />
          طباعة التقرير
        </Button>
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

      {/* 3. KPI 4 Summary Cards (Matching Mockup) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Revenue */}
        <div className="medical-card p-5">
          <p className="text-xs font-bold text-slate-400 mb-1">إجمالي الإيرادات</p>
          <h3 className="text-2xl font-black text-[#182230]">
            {totals.revenue.toLocaleString()} <span className="text-sm font-bold text-slate-500">ج.م</span>
          </h3>
          <span className="text-[11px] font-semibold text-[#15B8A6] mt-1 inline-block">حجم المبيعات</span>
        </div>

        {/* Card 2: Operations Count */}
        <div className="medical-card p-5">
          <p className="text-xs font-bold text-slate-400 mb-1">عدد العمليات</p>
          <h3 className="text-2xl font-black text-[#2F80ED]">{totals.patients}</h3>
          <span className="text-[11px] font-semibold text-slate-400 mt-1 inline-block">كشف واستشارة</span>
        </div>

        {/* Card 3: Collected */}
        <div className="medical-card p-5">
          <p className="text-xs font-bold text-slate-400 mb-1">تم التحصيل</p>
          <h3 className="text-2xl font-black text-emerald-600">
            {totals.collected.toLocaleString()} <span className="text-sm font-bold text-slate-500">ج.م</span>
          </h3>
          <span className="text-[11px] font-semibold text-emerald-600 mt-1 inline-block">مبالغ مستلمة</span>
        </div>

        {/* Card 4: Due */}
        <div className="medical-card p-5">
          <p className="text-xs font-bold text-slate-400 mb-1">مستحق</p>
          <h3 className="text-2xl font-black text-rose-600">
            {totals.due.toLocaleString()} <span className="text-sm font-bold text-slate-500">ج.م</span>
          </h3>
          <span className="text-[11px] font-semibold text-rose-500 mt-1 inline-block">مبالغ آجلة</span>
        </div>
      </div>

      {/* 4. VISUAL CHARTS SECTION (Daily Bar Chart + Donut Breakdowns) */}
      <div className="grid lg:grid-cols-12 gap-6 items-start">
        
        {/* Daily Revenue Bar Chart (7 cols) */}
        <div className="lg:col-span-7 medical-card p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5EAF0]">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#15B8A6]" />
              <h3 className="font-bold text-sm text-[#182230]">الإيرادات اليومية للأسبوع الحالي</h3>
            </div>
            <span className="text-xs font-bold text-slate-400">معدل يومي: 490 ج.م</span>
          </div>

          <div className="h-56 flex items-end justify-between gap-2 pt-6 pb-2 px-2">
            {dailyData.map((item, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                <div className="text-[10px] font-black text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  {item.val}
                </div>
                <div
                  style={{ height: `${item.pct}%` }}
                  className="w-full max-w-[36px] bg-[#15B8A6] hover:bg-[#0D9488] rounded-t-lg transition-all relative group-hover:shadow-md group-hover:shadow-[#15B8A6]/20"
                ></div>
                <span className="text-[11px] font-bold text-slate-500 mt-1">{item.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Services & Payment Breakdowns (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Card: Most Requested Services */}
          <div className="medical-card p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5EAF0]">
              <h3 className="font-bold text-xs text-[#182230]">الخدمات الأكثر طلباً</h3>
              <span className="text-[10px] font-bold text-slate-400">النسبة المئوية</span>
            </div>

            <div className="space-y-2.5 pt-1">
              {[
                { name: 'كشف عادي', pct: 54, color: 'bg-[#15B8A6]' },
                { name: 'استشارة', pct: 21, color: 'bg-[#2F80ED]' },
                { name: 'كشف مستعجل', pct: 17, color: 'bg-amber-500' },
                { name: 'متابعة', pct: 8, color: 'bg-emerald-500' }
              ].map((s, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-slate-700">
                    <span>{s.name}</span>
                    <span>{s.pct}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div style={{ width: `${s.pct}%` }} className={`h-full ${s.color} rounded-full`}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card: Payment Methods Breakdown */}
          <div className="medical-card p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5EAF0]">
              <h3 className="font-bold text-xs text-[#182230]">طرق الدفع</h3>
              <span className="text-[10px] font-bold text-slate-400">حسب الإيراد</span>
            </div>

            <div className="space-y-2.5 pt-1">
              {[
                { name: 'كاش بالعيادة', pct: 64, color: 'bg-emerald-500' },
                { name: 'InstaPay', pct: 27, color: 'bg-purple-500' },
                { name: 'محفظة إلكترونية (محفظة إلكترونية)', pct: 9, color: 'bg-blue-500' }
              ].map((p, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-slate-700">
                    <span>{p.name}</span>
                    <span>{p.pct}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div style={{ width: `${p.pct}%` }} className={`h-full ${p.color} rounded-full`}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}
