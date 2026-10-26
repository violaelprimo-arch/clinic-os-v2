'use client'

import React from 'react'
import { DollarSign, Wallet, CreditCard, RotateCcw, TrendingUp, AlertCircle, Lock } from 'lucide-react'

export interface FinancialAnalysisData {
  confirmedCollections: number
  uncollectedDue: number
  refunds: number
  recordedExpenses: number
  netCollections: number // confirmed - refunds
  operatingSurplus: number // netCollections - recordedExpenses
}

export interface FinancialAnalysisCardProps {
  data: FinancialAnalysisData
  canViewFinance: boolean
  isRtl?: boolean
  language?: string
}

export function FinancialAnalysisCard({
  data,
  canViewFinance,
  isRtl = true,
  language = 'ar'
}: FinancialAnalysisCardProps) {
  if (!canViewFinance) {
    return (
      <div className="ios-glass-card p-6 rounded-3xl border border-border/80 text-center space-y-3">
        <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 flex items-center justify-center mx-auto">
          <Lock className="w-5 h-5" />
        </div>
        <h3 className="font-black text-sm text-foreground">
          {language === 'en' ? 'Financial Analysis & Cashflow' : 'التحليل المالي والتدفقات النقدية'}
        </h3>
        <p className="text-xs text-muted-foreground">
          {language === 'en'
            ? 'Access to financial cashflow analysis is restricted to authorized roles.'
            : 'بيانات التحليل المالي والتدفق النقدي مقيدة ومخصصة لصلاحيات الإدارة المالية والطبيب.'}
        </p>
      </div>
    )
  }

  const {
    confirmedCollections,
    uncollectedDue,
    refunds,
    recordedExpenses,
    netCollections,
    operatingSurplus
  } = data

  const items = [
    {
      titleAr: 'التحصيل المؤكد المستلم',
      titleEn: 'Confirmed Collections',
      amount: confirmedCollections,
      subtextAr: 'إجمالي المقبوضات النقدية والإلكترونية المؤكدة',
      colorClass: 'text-emerald-600 dark:text-emerald-400',
      bgClass: 'bg-emerald-500/10'
    },
    {
      titleAr: 'مستحقات مؤجلة / بانتظار السداد',
      titleEn: 'Receivables / Due',
      amount: uncollectedDue,
      subtextAr: 'كشوفات غير مسددة أو بانتظار التحصيل',
      colorClass: 'text-amber-600 dark:text-amber-400',
      bgClass: 'bg-amber-500/10'
    },
    {
      titleAr: 'إجمالي المرتجعات',
      titleEn: 'Refunds Processed',
      amount: refunds,
      subtextAr: 'عمليات مسترجعة للمرضى',
      colorClass: 'text-rose-600 dark:text-rose-400',
      bgClass: 'bg-rose-500/10'
    },
    {
      titleAr: 'صافي التحصيل الفعلي',
      titleEn: 'Net Collections',
      amount: netCollections,
      subtextAr: 'التحصيل المؤكد بعد خصم المرتجعات',
      colorClass: 'text-primary',
      bgClass: 'bg-primary/10',
      isHero: true
    },
    {
      titleAr: 'المصروفات المسجلة بالعيادة',
      titleEn: 'Recorded Expenses',
      amount: recordedExpenses,
      subtextAr: 'إيجار، رواتب، مستلزمات وصيانة مسجلة',
      colorClass: 'text-slate-600 dark:text-slate-300',
      bgClass: 'bg-slate-500/10'
    },
    {
      titleAr: 'الفائض التشغيلي المسجل',
      titleEn: 'Operating Surplus',
      amount: operatingSurplus,
      subtextAr: 'الصافي بعد طرح المصروفات المسجلة',
      colorClass: operatingSurplus >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
      bgClass: operatingSurplus >= 0 ? 'bg-emerald-500/15' : 'bg-rose-500/15',
      isHero: true
    }
  ]

  return (
    <div className="ios-glass-card p-6 rounded-3xl border border-border/80 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border/80">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-sm text-foreground flex items-center gap-2">
              <span>{language === 'en' ? 'Comprehensive Financial Analysis' : 'التحليل المالي والتدفقات النقدية'}</span>
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {language === 'en'
                ? 'Operational cashflow, receivables, verified expenses, and operating surplus'
                : 'التدفقات النقدية، المديونيات، المصروفات المعتمدة، والفائض التشغيلي المسجل'}
            </p>
          </div>
        </div>
      </div>

      {/* Grid of 6 financial blocks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {items.map((it, idx) => (
          <div
            key={idx}
            className={`p-4 rounded-3xl border transition-all ${
              it.isHero
                ? 'border-primary/40 bg-card shadow-xs'
                : 'border-border/70 bg-card/60'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
              <span>{language === 'en' ? it.titleEn : it.titleAr}</span>
              <span className={`w-2.5 h-2.5 rounded-full ${it.bgClass}`} />
            </div>

            <div className="mt-2 font-mono">
              <span className={`text-2xl font-black ${it.colorClass}`}>
                {it.amount.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-muted-foreground ms-1">ج.م</span>
            </div>

            <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1 font-medium">
              {it.subtextAr}
            </p>
          </div>
        ))}
      </div>

      {/* Accounting Footnote */}
      <div className="pt-2 border-t border-border/60 text-[10px] text-muted-foreground leading-relaxed flex items-start gap-1.5">
        <AlertCircle className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
        <span>
          📌 <strong>تنويه محاسبي:</strong> يمثل &quot;الفائض التشغيلي&quot; الفرق بين التحصيل الفعلي المحصل والمصروفات المسجلة بنظام العيادة فقط خلال الفترة، ولا يمثل ميزانية أرباح عمومية شاملة في حال وجود التزامات أو إهلاكات خارج النظام.
        </span>
      </div>
    </div>
  )
}
