'use client'

import React from 'react'
import { Building2, Users, CheckCircle2, Wallet, Clock, TrendingUp } from 'lucide-react'

export interface BranchComparisonItem {
  branchId: string
  branchName: string
  isMain: boolean
  completedVisits: number
  uniquePatients: number
  confirmedCollections: number
  avgWaitMins: number | null
  attendanceRate: number
}

export interface BranchComparisonCardProps {
  branches: BranchComparisonItem[]
  canViewFinance: boolean
  isRtl?: boolean
  language?: string
}

export function BranchComparisonCard({
  branches,
  canViewFinance,
  isRtl = true,
  language = 'ar'
}: BranchComparisonCardProps) {
  if (branches.length <= 1) {
    return null // Only display multi-branch comparison when there are at least 2 branches
  }

  return (
    <div className="ios-glass-card p-6 rounded-3xl border border-border/80 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border/80">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-sm text-foreground flex items-center gap-2">
              <span>{language === 'en' ? 'Branch-by-Branch Performance Comparison' : 'مقارنة الأداء والتشغيل بين الفروع'}</span>
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {language === 'en'
                ? 'Standardized comparison across permitted branches for the same time window'
                : 'مقارنة موحدة تشمل الزيارات والمرضى والتحصيل ومعدل الانتظار لنفس الفترة'}
            </p>
          </div>
        </div>
      </div>

      {/* Comparative Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-start">
          <thead className="bg-secondary/70 text-muted-foreground font-bold border-b border-border/80">
            <tr>
              <th className="py-2.5 px-3 text-start">الفرع</th>
              <th className="py-2.5 px-3 text-center">الزيارات المكتملة</th>
              <th className="py-2.5 px-3 text-center">المرضى الفريدين</th>
              <th className="py-2.5 px-3 text-center">التحصيل المؤكد</th>
              <th className="py-2.5 px-3 text-center">متوسط الانتظار</th>
              <th className="py-2.5 px-3 text-center">نسبة الحضور</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {branches.map((b) => (
              <tr key={b.branchId} className="hover:bg-muted/30 font-medium">
                <td className="py-2.5 px-3 font-bold text-foreground flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>{b.branchName}</span>
                  {b.isMain && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-bold shrink-0">
                      الرئيسي
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-center font-bold font-mono text-foreground">
                  {b.completedVisits}
                </td>
                <td className="py-2.5 px-3 text-center font-bold font-mono text-cyan-600 dark:text-cyan-400">
                  {b.uniquePatients}
                </td>
                <td className="py-2.5 px-3 text-center font-black font-mono text-emerald-600 dark:text-emerald-400">
                  {canViewFinance ? `${b.confirmedCollections.toLocaleString()} ج.م` : '••••••'}
                </td>
                <td className="py-2.5 px-3 text-center font-mono text-muted-foreground">
                  {b.avgWaitMins !== null ? `${b.avgWaitMins} دقيقة` : '—'}
                </td>
                <td className="py-2.5 px-3 text-center font-black font-mono text-primary">
                  {b.attendanceRate}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footnote */}
      <div className="pt-2 border-t border-border/60 text-[10px] text-muted-foreground">
        ✓ تُعرض فقط الفروع المسموح للمستخدم حالياً باستعراضها وفق قيود حسابه.
      </div>
    </div>
  )
}
