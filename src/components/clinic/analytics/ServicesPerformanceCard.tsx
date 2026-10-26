'use client'

import React from 'react'
import { Stethoscope, DollarSign, Users, Award, Tag } from 'lucide-react'

export interface ServicePerformanceItem {
  id: string
  name: string
  completedVisitsCount: number
  uniquePatientsCount: number
  totalRevenue: number
  averagePrice: number
  isArchived?: boolean
}

export interface ServicesPerformanceCardProps {
  services: ServicePerformanceItem[]
  totalRevenue: number
  isRtl?: boolean
  language?: string
}

export function ServicesPerformanceCard({
  services,
  totalRevenue,
  isRtl = true,
  language = 'ar'
}: ServicesPerformanceCardProps) {
  const sorted = [...services].sort((a, b) => b.totalRevenue - a.totalRevenue)

  return (
    <div className="ios-glass-card p-6 rounded-3xl border border-border/80 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/80">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-sm text-foreground flex items-center gap-2">
              <span>{language === 'en' ? 'Clinical Services Performance' : 'أداء الخدمات الطبية والإيرادات'}</span>
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {language === 'en'
                ? 'Completed visits, unique patients, and revenue contribution per service'
                : 'الزيارات المكتملة، عدد المرضى الفريدين، ومساهمة كل خدمة في الدخل'}
            </p>
          </div>
        </div>
      </div>

      {/* Services Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-start">
          <thead className="bg-secondary/70 text-muted-foreground font-bold border-b border-border/80">
            <tr>
              <th className="py-2.5 px-3 text-start">{language === 'en' ? 'Service Name' : 'اسم الخدمة الطبية'}</th>
              <th className="py-2.5 px-3 text-center">{language === 'en' ? 'Completed Visits' : 'الزيارات المكتملة'}</th>
              <th className="py-2.5 px-3 text-center">{language === 'en' ? 'Unique Patients' : 'المرضى الفريدين'}</th>
              <th className="py-2.5 px-3 text-center">{language === 'en' ? 'Total Revenue' : 'إجمالي الدخل'}</th>
              <th className="py-2.5 px-3 text-center">{language === 'en' ? 'Avg Ticket' : 'متوسط السعر'}</th>
              <th className="py-2.5 px-3 text-center">{language === 'en' ? 'Revenue Share' : 'الحصة'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map((s, idx) => {
              const sharePct = totalRevenue > 0 ? Math.round((s.totalRevenue / totalRevenue) * 1000) / 10 : 0
              return (
                <tr key={s.id || idx} className="hover:bg-muted/30 font-medium">
                  <td className="py-2.5 px-3 font-bold text-foreground flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-secondary text-muted-foreground text-[10px] font-black font-mono flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="truncate">{s.name}</span>
                    {s.isArchived && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground font-bold shrink-0">
                        {language === 'en' ? 'Archived' : 'مؤرشفة'}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold font-mono text-foreground">
                    {s.completedVisitsCount}
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold font-mono text-cyan-600 dark:text-cyan-400">
                    {s.uniquePatientsCount}
                  </td>
                  <td className="py-2.5 px-3 text-center font-black font-mono text-emerald-600 dark:text-emerald-400">
                    {s.totalRevenue.toLocaleString()} ج.م
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-muted-foreground">
                    {Math.round(s.averagePrice)} ج.م
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold font-mono text-primary">
                    {sharePct}%
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Footnote */}
      <div className="pt-2 border-t border-border/60 text-[10px] text-muted-foreground">
        💡 تم التمييز بين عدد مرات تقديم الخدمة وعدد المرضى الفريدين لضمان دقة نسب الإقبال وتكرار الجلسات.
      </div>
    </div>
  )
}
