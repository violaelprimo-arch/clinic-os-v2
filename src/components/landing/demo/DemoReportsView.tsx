'use client'

import React, { useState } from 'react'
import {
  TrendingUp,
  DollarSign,
  CreditCard,
  Banknote,
  PieChart,
  Calendar,
  Filter,
  ArrowUpRight,
  Sparkles,
  CheckCircle2,
  Clock,
  Layers,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { DemoClinicHookReturn } from './useDemoClinic'
import { useLanguage } from '@/context/LanguageContext'

interface DemoReportsViewProps {
  demo: DemoClinicHookReturn
}

export function DemoReportsView({ demo }: DemoReportsViewProps) {
  const { isRtl } = useLanguage()
  const copy = (ar: string, en: string) => (isRtl ? ar : en)

  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today')
  const [selectedServiceFilter, setSelectedServiceFilter] = useState<string>('all')

  // Multiplier for periods
  const multiplier = period === 'today' ? 1 : period === 'week' ? 6.2 : 24.5

  const baseRevenue = demo.totalRevenue
  const displayTotalRevenue = Math.round(baseRevenue * multiplier)
  const displayCashRevenue = Math.round(demo.cashRevenue * multiplier)
  const displayDigitalRevenue = Math.round(demo.digitalRevenue * multiplier)
  const displayPendingRevenue = period === 'today' ? demo.pendingRevenue : 0

  // Revenue by service
  const serviceStats = demo.services.map((srv) => {
    const visitsForService = demo.appointments.filter(
      (a) => a.serviceId === srv.id && a.paymentStatus === 'paid',
    ).length

    const rev = visitsForService * srv.price * multiplier
    const totalRev = displayTotalRevenue || 1
    const percent = Math.min(100, Math.round((rev / totalRev) * 100))

    return {
      service: srv,
      visitsCount: Math.round(visitsForService * multiplier),
      revenue: Math.round(rev),
      percentage: percent,
    }
  })

  // Hourly distribution bars
  const hourlyData = [
    { hour: '04:00 م', visits: 1, active: true },
    { hour: '05:00 م', visits: 2, active: true },
    { hour: '06:00 م', visits: 1, active: true },
    { hour: '07:00 م', visits: 0, active: false },
    { hour: '08:00 م', visits: 0, active: false },
  ]

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header & Period Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-black text-foreground">
            {copy('التقارير المالية وحركة الإيرادات', 'Financial Reports & Revenue Analytics')}
          </h3>
          <p className="text-xs text-muted-foreground">
            {copy(
              'أرقام حية مترابطة مع زيارات وحجوزات اليوم، تتغير تلقائيًا مع أي إجراء',
              'Real-time numbers connected with demo visits, updating automatically with every action',
            )}
          </p>
        </div>

        {/* Period Pills */}
        <div className="inline-flex rounded-xl border border-border bg-muted/40 p-1 text-xs">
          <button
            type="button"
            onClick={() => setPeriod('today')}
            className={`rounded-lg px-3 py-1.5 font-bold transition-all ${
              period === 'today'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {copy('اليوم', 'Today')}
          </button>
          <button
            type="button"
            onClick={() => setPeriod('week')}
            className={`rounded-lg px-3 py-1.5 font-bold transition-all ${
              period === 'week'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {copy('هذا الأسبوع', 'This Week')}
          </button>
          <button
            type="button"
            onClick={() => setPeriod('month')}
            className={`rounded-lg px-3 py-1.5 font-bold transition-all ${
              period === 'month'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {copy('هذا الشهر', 'This Month')}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-sm">
          <div className="flex items-center justify-between text-primary">
            <span className="text-xs font-bold">{copy('إجمالي التحصيل', 'Total Revenue')}</span>
            <DollarSign className="size-4" />
          </div>
          <strong className="mt-2 block text-2xl font-black text-primary">
            {displayTotalRevenue.toLocaleString()}{' '}
            <span className="text-xs font-normal text-muted-foreground">ج.م</span>
          </strong>
          <span className="mt-1 block text-[11px] text-muted-foreground">
            {period === 'today'
              ? copy(
                  `${demo.completedList.length} كشوفات مكتملة ومحصلة`,
                  `${demo.completedList.length} completed visits`,
                )
              : copy('إجمالي الفترة المحددة', 'Total for selected period')}
          </span>
        </div>

        <div className="rounded-2xl border border-border/80 bg-background/60 p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold">{copy('التحصيل النقدي', 'Cash Collections')}</span>
            <Banknote className="size-4 text-emerald-500" />
          </div>
          <strong className="mt-2 block text-2xl font-black text-foreground">
            {displayCashRevenue.toLocaleString()}{' '}
            <span className="text-xs font-normal text-muted-foreground">ج.م</span>
          </strong>
          <span className="mt-1 block text-[11px] text-muted-foreground">
            {Math.round(
              ((displayCashRevenue || 1) / (displayTotalRevenue || 1)) * 100,
            )}
            % {copy('من إجمالي الإيرادات', 'of total revenue')}
          </span>
        </div>

        <div className="rounded-2xl border border-border/80 bg-background/60 p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold">{copy('المحافظ والبطاقات', 'Digital & Cards')}</span>
            <CreditCard className="size-4 text-blue-500" />
          </div>
          <strong className="mt-2 block text-2xl font-black text-foreground">
            {displayDigitalRevenue.toLocaleString()}{' '}
            <span className="text-xs font-normal text-muted-foreground">ج.م</span>
          </strong>
          <span className="mt-1 block text-[11px] text-muted-foreground">
            {Math.round(
              ((displayDigitalRevenue || 0) / (displayTotalRevenue || 1)) * 100,
            )}
            % {copy('فودافون كاش وفيزا', 'Vodafone Cash & Visa')}
          </span>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 shadow-sm">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
            <span className="text-xs font-bold">{copy('مبالغ معلّقة', 'Pending Payments')}</span>
            <Clock className="size-4" />
          </div>
          <strong className="mt-2 block text-2xl font-black text-amber-600 dark:text-amber-400">
            {displayPendingRevenue.toLocaleString()}{' '}
            <span className="text-xs font-normal text-muted-foreground">ج.م</span>
          </strong>
          <span className="mt-1 block text-[11px] text-muted-foreground">
            {copy(
              `${demo.waitingList.length} مرضى بانتظار السداد`,
              `${demo.waitingList.length} patients awaiting settlement`,
            )}
          </span>
        </div>
      </div>

      {/* Two Column Layout: Service Breakdown & Hourly Flow */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Service Performance */}
        <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-black text-foreground">
                {copy('أداء الخدمات الطبية والإيراد', 'Services Performance')}
              </h4>
              <p className="text-[11px] text-muted-foreground">
                {copy('توزيع الدخل حسب نوع الكشف والخدمة', 'Revenue breakdown by service type')}
              </p>
            </div>
            <Layers className="size-4 text-muted-foreground" />
          </div>

          <div className="space-y-3 pt-2">
            {serviceStats.map((item) => (
              <div key={item.service.id} className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between font-bold">
                  <span className="text-foreground">{item.service.name}</span>
                  <span className="font-mono text-primary">
                    {item.revenue.toLocaleString()} ج.م
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>
                    {item.visitsCount} {copy('كشوفات', 'visits')}
                  </span>
                  <span>{item.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Hourly Distribution Visual Bars */}
        <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-black text-foreground">
                {copy('توزيع الزيارات بالساعات (اليوم)', 'Hourly Visits Distribution')}
              </h4>
              <p className="text-[11px] text-muted-foreground">
                {copy('أوقات الذروة وتدفق المرضى في العيادة', 'Clinic peak hours and patient flow')}
              </p>
            </div>
            <Clock className="size-4 text-muted-foreground" />
          </div>

          <div className="flex h-44 items-end justify-between gap-3 border-b border-border/80 pb-2 pt-6">
            {hourlyData.map((slot, i) => {
              const maxVisits = 3
              const heightPercent = Math.max(15, (slot.visits / maxVisits) * 100)

              return (
                <div key={i} className="flex flex-1 flex-col items-center gap-2 h-full justify-end">
                  <span className="font-mono text-[10px] font-bold text-primary">
                    {slot.visits > 0 ? `${slot.visits}` : ''}
                  </span>
                  <div
                    className={`w-full max-w-[40px] rounded-t-xl transition-all duration-500 ${
                      slot.active
                        ? 'bg-gradient-to-t from-primary to-cyan-500 shadow-md shadow-primary/20'
                        : 'bg-muted/40'
                    }`}
                    style={{ height: `${slot.visits > 0 ? heightPercent : 8}%` }}
                  />
                  <span className="font-mono text-[9px] text-muted-foreground whitespace-nowrap">
                    {slot.hour}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Sync Callout banner */}
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
            <span className="font-bold text-primary">
              {copy('💡 ترابط البيانات: ', '💡 Interconnected data: ')}
            </span>
            {copy(
              'عند إنهاء كشف أي مريض في لوحة التحكم وسداد رسومه، تضاف القيمة فوراً إلى هذا التقرير.',
              'When completing an examination in the dashboard, the revenue is instantly calculated here.',
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
