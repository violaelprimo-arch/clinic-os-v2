'use client'

import React, { useState, useEffect } from 'react'
import {
  Pill,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  Database,
  ExternalLink,
  Calendar,
  Sparkles,
  ShieldCheck,
  Activity
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useLanguage } from '@/context/LanguageContext'

interface SyncLogItem {
  id?: string
  timestamp?: string
  cairoDate?: string
  status?: string
  triggeredBy?: string
  addedCount?: number
  updatedCount?: number
  unchangedCount?: number
  totalProcessed?: number
  durationMs?: number
  error?: string
}

export function MedicineSyncMonitorWidget() {
  const { isRtl, dir } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [latestSync, setLatestSync] = useState<SyncLogItem | null>(null)
  const [recentLogs, setRecentLogs] = useState<SyncLogItem[]>([])
  const [currentCairoDate, setCurrentCairoDate] = useState<string>('')
  const [isRunning, setIsRunning] = useState(false)

  const fetchStatus = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/sync-daily-prices', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setLatestSync(data.latestSync || null)
        setRecentLogs(Array.isArray(data.recentLogs) ? data.recentLogs : [])
        setCurrentCairoDate(data.currentCairoDate || '')
        setIsRunning(Boolean(data.isRunning))
      }
    } catch (err) {
      console.warn('Error fetching medicine sync status:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  const handleManualSync = async () => {
    try {
      setIsSyncing(true)
      toast.info(isRtl ? 'جاري بدء مزامنة الأسعار من بوابة الدواء DawaaGate...' : 'Starting medicine price sync from DawaaGate...')

      const res = await fetch('/api/sync-daily-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true, pages: 3 })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(
          data.message || (isRtl ? 'تمت مزامنة الأسعار بنجاح!' : 'Price sync completed successfully!')
        )
        await fetchStatus()
      } else {
        toast.error(data.message || data.error || (isRtl ? 'تعذر إتمام المزامنة' : 'Sync failed'))
      }
    } catch (err: any) {
      toast.error(isRtl ? `خطأ أثناء المزامنة: ${err.message}` : `Sync error: ${err.message}`)
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="yalla-card border border-border rounded-3xl p-6 sm:p-8 space-y-6 shadow-md bg-card text-card-foreground" dir={dir}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0">
            <Pill className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-foreground flex items-center gap-2">
              <span>{isRtl ? 'مزامنة دليل الأدوية والأسعار الرسمية' : 'Medicine Catalog & Price Sync'}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                DawaaGate.com
              </span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isRtl
                ? 'مزامنة تلقائية يومية في تمام الساعة 06:00 صباحاً بتوقيت القاهرة عبر Cloudflare Cron Triggers'
                : 'Automated daily price sync at 06:00 AM Cairo Time via Cloudflare Cron Triggers'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchStatus}
            disabled={loading || isSyncing}
            className="h-9 px-3 rounded-xl text-xs font-bold border-border"
            title={isRtl ? 'تحديث البيانات' : 'Refresh'}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>

          <Button
            type="button"
            onClick={handleManualSync}
            disabled={isSyncing || isRunning}
            className="h-9 px-4 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm cursor-pointer flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing || isRunning ? 'animate-spin' : ''}`} />
            <span>{isSyncing || isRunning ? (isRtl ? 'جاري المزامنة...' : 'Syncing...') : (isRtl ? 'تشغيل المزامنة الآن' : 'Sync Now')}</span>
          </Button>
        </div>
      </div>

      {/* Sync Status Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Next Scheduled Sync */}
        <div className="p-4 rounded-2xl bg-secondary/50 border border-border/60 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span>{isRtl ? 'الموعد المجدول القادم' : 'Next Scheduled Sync'}</span>
          </div>
          <p className="text-base font-black text-foreground">06:00 ص بتوقيت مصر</p>
          <p className="text-[11px] text-muted-foreground">Cloudflare Cron Trigger (0 3 / 0 4 UTC)</p>
        </div>

        {/* Latest Sync Date */}
        <div className="p-4 rounded-2xl bg-secondary/50 border border-border/60 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
            <Calendar className="w-3.5 h-3.5 text-emerald-500" />
            <span>{isRtl ? 'آخر مزامنة ناجحة' : 'Last Successful Sync'}</span>
          </div>
          <p className="text-base font-black text-foreground">
            {latestSync?.cairoDate || currentCairoDate || 'محدث اليوم'}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {latestSync?.timestamp ? new Date(latestSync.timestamp).toLocaleTimeString('ar-EG') : 'بتوقيت القاهرة'}
          </p>
        </div>

        {/* Changes Count */}
        <div className="p-4 rounded-2xl bg-secondary/50 border border-border/60 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
            <Activity className="w-3.5 h-3.5 text-amber-500" />
            <span>{isRtl ? 'إحصائيات آخر تشغيل' : 'Latest Sync Impact'}</span>
          </div>
          <p className="text-base font-black text-foreground">
            {latestSync ? `+${latestSync.addedCount || 0} جديد | ${latestSync.updatedCount || 0} محدث` : 'مطابق للأسعار الرسمية'}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {latestSync ? `${latestSync.unchangedCount || 0} دواء بدون تغيير` : 'من بوابة الدواء المصرية'}
          </p>
        </div>

        {/* Sync Engine Health */}
        <div className="p-4 rounded-2xl bg-secondary/50 border border-border/60 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
            <span>{isRtl ? 'حالة محرك المزامنة' : 'Engine Health'}</span>
          </div>
          <div className="flex items-center gap-2 pt-0.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
              {isRunning ? (isRtl ? 'قيد التنفيذ...' : 'Running...') : (isRtl ? 'نشط ومنتظم' : 'Active & Healthy')}
            </p>
          </div>
          <p className="text-[11px] text-muted-foreground">{isRtl ? 'قفل موزع ضد التكرار (Lock Protected)' : 'Distributed Lock Protected'}</p>
        </div>
      </div>

      {/* Sync Execution History */}
      <div className="space-y-3 pt-2">
        <h3 className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
          <Database className="w-3.5 h-3.5" />
          <span>{isRtl ? 'سجل عمليات المزامنة الأخيرة (Audit Log)' : 'Recent Sync Operations (Audit Log)'}</span>
        </h3>

        {recentLogs.length === 0 ? (
          <div className="p-4 rounded-2xl bg-secondary/30 border border-border text-center text-xs text-muted-foreground">
            {isRtl ? 'لا توجد سجلات مزامنة سابقة بعد.' : 'No sync history recorded yet.'}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-xs text-right" dir={dir}>
              <thead className="bg-secondary/60 text-muted-foreground font-bold border-b border-border">
                <tr>
                  <th className="p-3 text-right">{isRtl ? 'التاريخ والوقت' : 'Date & Time'}</th>
                  <th className="p-3 text-right">{isRtl ? 'المشغّل' : 'Triggered By'}</th>
                  <th className="p-3 text-right">{isRtl ? 'الحالة' : 'Status'}</th>
                  <th className="p-3 text-right">{isRtl ? 'جديد' : 'Added'}</th>
                  <th className="p-3 text-right">{isRtl ? 'محدث' : 'Updated'}</th>
                  <th className="p-3 text-right">{isRtl ? 'مطابق' : 'Unchanged'}</th>
                  <th className="p-3 text-right">{isRtl ? 'المدة' : 'Duration'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {recentLogs.map((log, idx) => (
                  <tr key={log.id || idx} className="hover:bg-secondary/20 transition-colors">
                    <td className="p-3 font-medium text-foreground">
                      {log.timestamp ? new Date(log.timestamp).toLocaleString('ar-EG') : log.cairoDate}
                    </td>
                    <td className="p-3 text-muted-foreground font-mono">
                      {log.triggeredBy === 'cron' ? 'Cloudflare Cron' : log.triggeredBy === 'manual_owner' ? 'Owner UI' : 'Doctor UI'}
                    </td>
                    <td className="p-3">
                      {log.status === 'completed' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" /> {isRtl ? 'مكتمل' : 'Completed'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full">
                          <AlertCircle className="w-3 h-3" /> {isRtl ? 'فشل' : 'Failed'}
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-bold text-emerald-600 dark:text-emerald-400">+{log.addedCount ?? 0}</td>
                    <td className="p-3 font-bold text-amber-600 dark:text-amber-400">{log.updatedCount ?? 0}</td>
                    <td className="p-3 text-muted-foreground">{log.unchangedCount ?? 0}</td>
                    <td className="p-3 text-muted-foreground font-mono">{log.durationMs ? `${(log.durationMs / 1000).toFixed(1)}s` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
