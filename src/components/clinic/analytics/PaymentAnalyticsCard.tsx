'use client'

import React, { useState } from 'react'
import {
  Wallet, Banknote, CreditCard, ArrowRightLeft,
  CheckCircle2, Clock, AlertCircle, RotateCcw, Eye
} from 'lucide-react'

export interface PaymentMethodItem {
  id: string
  nameAr: string
  nameEn: string
  color: string
  confirmedCount: number
  confirmedAmount: number
  uniquePatientsCount: number
  uniquePatientsPercentage: number
  pendingCount: number
  pendingAmount: number
  refundedCount: number
  refundedAmount: number
}

export interface PaymentAnalyticsCardProps {
  methods: PaymentMethodItem[]
  totalConfirmedAmount: number
  totalConfirmedCount: number
  totalPendingAmount: number
  totalPendingCount: number
  totalRefundedAmount: number
  totalRefundedCount: number
  netCollectionAmount: number
  totalPatientsCount: number
  canViewFinance: boolean
  isRtl?: boolean
  language?: string
}

export function PaymentAnalyticsCard({
  methods,
  totalConfirmedAmount,
  totalConfirmedCount,
  totalPendingAmount,
  totalPendingCount,
  totalRefundedAmount,
  totalRefundedCount,
  netCollectionAmount,
  totalPatientsCount,
  canViewFinance,
  isRtl = true,
  language = 'ar'
}: PaymentAnalyticsCardProps) {
  const [metricMode, setMetricMode] = useState<'amount' | 'count'>('amount')
  const [hoveredMethod, setHoveredMethod] = useState<PaymentMethodItem | null>(null)
  const [showTable, setShowTable] = useState(false)

  if (!canViewFinance) {
    return (
      <div className="ios-glass-card p-6 rounded-3xl border border-border/80 text-center space-y-3">
        <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 flex items-center justify-center mx-auto">
          <Wallet className="w-5 h-5" />
        </div>
        <h3 className="font-black text-sm text-foreground">
          {language === 'en' ? 'Payment Analytics' : 'تحليل طرق الدفع والتحصيل'}
        </h3>
        <p className="text-xs text-muted-foreground">
          {language === 'en'
            ? 'Financial payment analytics are restricted to Doctor and Finance roles.'
            : 'بيانات التحصيل وطرق الدفع مخصصة لصلاحيات الطبيب والإدارة المالية فقط.'}
        </p>
      </div>
    )
  }

  // SVG Donut calculation
  const size = 200
  const strokeWidth = 24
  const radius = (size - strokeWidth) / 2
  const center = size / 2
  const circumference = 2 * Math.PI * radius

  const totalBase = metricMode === 'amount' ? Math.max(1, totalConfirmedAmount) : Math.max(1, totalConfirmedCount)
  let accumulatedPct = 0

  return (
    <div className="ios-glass-card p-6 rounded-3xl border border-border/80 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/80">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-sm text-foreground flex items-center gap-2">
              <span>{language === 'en' ? 'Payment Methods & Collections' : 'تحليل وسائل الدفع والتحصيل'}</span>
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {language === 'en'
                ? 'Cash, InstaPay, E-Wallets with confirmed vs pending audits'
                : 'كاش، انستاباي، المحافظ الإلكترونية مع تدقيق المؤكد والمعلق'}
            </p>
          </div>
        </div>

        {/* Controls: Mode Toggle & Table Button */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Toggle Count vs Amount */}
          <div className="inline-flex rounded-xl p-0.5 bg-secondary/80 border border-border">
            <button
              type="button"
              onClick={() => setMetricMode('amount')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                metricMode === 'amount'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {language === 'en' ? 'By Revenue (EGP)' : 'حسب القيمة (ج.م)'}
            </button>
            <button
              type="button"
              onClick={() => setMetricMode('count')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                metricMode === 'count'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {language === 'en' ? 'By Count' : 'حسب عدد العمليات'}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowTable(!showTable)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-secondary hover:bg-secondary/80 text-foreground border border-border/70 transition-all cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-primary" />
            <span>{showTable ? (language === 'en' ? 'Show Chart' : 'عرض الرسم') : (language === 'en' ? 'Detailed Table' : 'جدول التفاصيل')}</span>
          </button>
        </div>
      </div>

      {/* 4 Financial Audit Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Confirmed Collections */}
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-start">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
            <span className="text-[11px] font-bold">{language === 'en' ? 'Confirmed Collections:' : 'التحصيل المؤكد:'}</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <span className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1 block">
            {totalConfirmedAmount.toLocaleString()} <span className="text-xs font-bold">ج.م</span>
          </span>
          <span className="text-[10px] text-muted-foreground block font-bold">
            {totalConfirmedCount} {language === 'en' ? 'transactions' : 'عملية مؤكدة'}
          </span>
        </div>

        {/* Pending / Verification */}
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-start">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
            <span className="text-[11px] font-bold">{language === 'en' ? 'Pending Verification:' : 'بانتظار التأكيد:'}</span>
            <Clock className="w-4 h-4" />
          </div>
          <span className="text-lg font-black font-mono text-amber-600 dark:text-amber-400 mt-1 block">
            {totalPendingAmount.toLocaleString()} <span className="text-xs font-bold">ج.م</span>
          </span>
          <span className="text-[10px] text-muted-foreground block font-bold">
            {totalPendingCount} {language === 'en' ? 'not counted as revenue' : 'عملية (لا تحتسب إيراد)'}
          </span>
        </div>

        {/* Refunds */}
        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-start">
          <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
            <span className="text-[11px] font-bold">{language === 'en' ? 'Refunds Processed:' : 'المرتجعات:'}</span>
            <RotateCcw className="w-4 h-4" />
          </div>
          <span className="text-lg font-black font-mono text-rose-600 dark:text-rose-400 mt-1 block">
            {totalRefundedAmount.toLocaleString()} <span className="text-xs font-bold">ج.م</span>
          </span>
          <span className="text-[10px] text-muted-foreground block font-bold">
            {totalRefundedCount} {language === 'en' ? 'refunded' : 'عملية مسترجعة'}
          </span>
        </div>

        {/* Net Collections */}
        <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/20 text-start">
          <div className="flex items-center justify-between text-primary">
            <span className="text-[11px] font-bold">{language === 'en' ? 'Net Collections:' : 'صافي التحصيل:'}</span>
            <Wallet className="w-4 h-4" />
          </div>
          <span className="text-lg font-black font-mono text-primary mt-1 block">
            {netCollectionAmount.toLocaleString()} <span className="text-xs font-bold">ج.م</span>
          </span>
          <span className="text-[10px] text-muted-foreground block font-bold">
            {language === 'en' ? 'Confirmed minus Refunds' : 'المؤكد بعد خصم المرتجع'}
          </span>
        </div>
      </div>

      {/* Main Display: Donut + Method Badges OR Table */}
      {!showTable ? (
        <div className="flex flex-col md:flex-row items-center justify-around gap-6 pt-2">
          {/* Donut Visual */}
          <div className="relative w-[200px] h-[200px] shrink-0 select-none">
            <svg width={size} height={size} className="transform -rotate-90">
              <circle
                cx={center}
                cy={center}
                r={radius}
                stroke="#334155"
                strokeWidth={strokeWidth}
                fill="none"
                opacity="0.15"
              />

              {totalConfirmedCount > 0 &&
                methods.map((m) => {
                  const val = metricMode === 'amount' ? m.confirmedAmount : m.confirmedCount
                  const slicePct = totalBase > 0 ? (val / totalBase) * 100 : 0
                  const strokeDasharray = `${(slicePct / 100) * circumference} ${circumference}`
                  const strokeDashoffset = -((accumulatedPct / 100) * circumference)
                  accumulatedPct += slicePct

                  const isHovered = hoveredMethod?.id === m.id

                  return (
                    <circle
                      key={m.id}
                      cx={center}
                      cy={center}
                      r={radius}
                      stroke={m.color}
                      strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                      strokeDasharray={strokeDasharray}
                      strokeDashoffset={strokeDashoffset}
                      fill="none"
                      className="cursor-pointer transition-all duration-200"
                      onMouseEnter={() => setHoveredMethod(m)}
                      onMouseLeave={() => setHoveredMethod(null)}
                    />
                  )
                })}
            </svg>

            {/* Donut Center */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
              {hoveredMethod ? (
                <>
                  <span className="text-xs font-black" style={{ color: hoveredMethod.color }}>
                    {hoveredMethod.nameAr}
                  </span>
                  <span className="text-sm font-black font-mono text-foreground mt-0.5">
                    {metricMode === 'amount'
                      ? `${hoveredMethod.confirmedAmount.toLocaleString()} ج.م`
                      : `${hoveredMethod.confirmedCount} عملية`}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-bold">
                    {hoveredMethod.uniquePatientsCount} مريض
                  </span>
                </>
              ) : (
                <>
                  <span className="text-base font-black font-mono text-foreground">
                    {metricMode === 'amount' ? `${totalConfirmedAmount.toLocaleString()}` : totalConfirmedCount}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-bold">
                    {metricMode === 'amount' ? 'ج.م مؤكد' : 'عملية مؤكدة'}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Methods Breakdown List */}
          <div className="w-full max-w-md space-y-2">
            {methods.map((m) => {
              const val = metricMode === 'amount' ? m.confirmedAmount : m.confirmedCount
              const pct = totalBase > 0 ? Math.round((val / totalBase) * 1000) / 10 : 0
              const isHovered = hoveredMethod?.id === m.id

              return (
                <div
                  key={m.id}
                  onMouseEnter={() => setHoveredMethod(m)}
                  onMouseLeave={() => setHoveredMethod(null)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isHovered ? 'bg-muted/80 border-primary shadow-xs' : 'bg-card border-border/70 hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
                    <div>
                      <span className="text-xs font-black text-foreground block">
                        {language === 'en' ? m.nameEn : m.nameAr}
                      </span>
                      <span className="text-[10px] text-muted-foreground block font-bold">
                        {m.uniquePatientsCount} {language === 'en' ? 'unique pts' : 'مريض فريد'} ({m.uniquePatientsPercentage}%)
                      </span>
                    </div>
                  </div>

                  <div className="text-end font-mono">
                    <span className="text-xs font-black text-foreground block">
                      {m.confirmedAmount.toLocaleString()} ج.م
                    </span>
                    <span className="text-[10px] text-muted-foreground block font-bold">
                      {m.confirmedCount} {language === 'en' ? 'txns' : 'عملية'} ({pct}%)
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        /* Detailed Table View */
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start">
            <thead className="bg-secondary/70 text-muted-foreground font-bold border-b border-border/80">
              <tr>
                <th className="py-2.5 px-3 text-start">{language === 'en' ? 'Method' : 'وسيلة الدفع'}</th>
                <th className="py-2.5 px-3 text-center">{language === 'en' ? 'Confirmed Txns' : 'العمليات المؤكدة'}</th>
                <th className="py-2.5 px-3 text-center">{language === 'en' ? 'Confirmed Amount' : 'المبلغ المؤكد'}</th>
                <th className="py-2.5 px-3 text-center">{language === 'en' ? 'Unique Patients' : 'مرضى فريدين'}</th>
                <th className="py-2.5 px-3 text-center">{language === 'en' ? 'Pending Txns' : 'عمليات معلقة'}</th>
                <th className="py-2.5 px-3 text-center">{language === 'en' ? 'Refunded' : 'المرتجعات'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {methods.map((m) => (
                <tr key={m.id} className="hover:bg-muted/30">
                  <td className="py-2.5 px-3 font-bold flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.color }} />
                    <span>{language === 'en' ? m.nameEn : m.nameAr}</span>
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold font-mono">{m.confirmedCount}</td>
                  <td className="py-2.5 px-3 text-center font-black font-mono text-emerald-600">
                    {m.confirmedAmount.toLocaleString()} ج.م
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono">
                    {m.uniquePatientsCount} ({m.uniquePatientsPercentage}%)
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-amber-600">
                    {m.pendingCount > 0 ? `${m.pendingCount} (${m.pendingAmount.toLocaleString()} ج.م)` : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-rose-600">
                    {m.refundedCount > 0 ? `${m.refundedCount} (${m.refundedAmount.toLocaleString()} ج.م)` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footnote on Non-exclusive patient counts */}
      <div className="pt-2 border-t border-border/60 text-[10px] text-muted-foreground flex flex-wrap items-center justify-between gap-2">
        <span>
          💡 {language === 'en'
            ? 'Patients may use more than one payment method across visits; sum of patient counts can exceed 100%.'
            : 'قد يستخدم المريض أكثر من وسيلة دفع في زيارات مختلفة؛ لذا قد يتجاوز مجموع نسب المرضى 100%.'}
        </span>
        <span className="font-bold text-emerald-600 dark:text-emerald-400">
          ✓ {language === 'en' ? 'Audited against verified transactions' : 'تم التدقيق وفق القيود المؤكدة'}
        </span>
      </div>
    </div>
  )
}
