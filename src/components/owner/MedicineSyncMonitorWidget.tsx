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
  Activity,
  AlertTriangle
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
  verifiedCount?: number
  durationMs?: number
}

interface LastSuccessData {
  cairoDate: string
  timestamp?: string
  lastSourceUpdateDate?: string
  addedCount?: number
  priceChangedCount?: number
  verifiedCount?: number
}

export function MedicineSyncMonitorWidget() {
  const { isRtl, dir } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [engineStatus, setEngineStatus] = useState<'RUNNING' | 'PARTIAL' | 'COMPLETED' | 'STALE' | 'FAILED' | 'IDLE'>('IDLE')
  const [lastSuccess, setLastSuccess] = useState<LastSuccessData | null>(null)
  const [recentLogs, setRecentLogs] = useState<SyncLogItem[]>([])
  const [currentCairoDate, setCurrentCairoDate] = useState<string>('')
  const [isRunning, setIsRunning] = useState(false)

  const fetchStatus = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/sync-daily-prices', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setEngineStatus(data.status || (data.isRunning ? 'RUNNING' : 'IDLE'))
        setLastSuccess(data.lastSuccess || null)
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
      toast.info(isRtl ? 'جاري بدء فحص وتحديث الأسعار من بوابة الدواء...' : 'Starting medicine price sync from DawaaGate...')

      const res = await fetch('/api/sync-daily-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pages: 3 })
      })

      const data = await res.json()
      if (res.ok && data.success && data.status === 'COMPLETED') {
        toast.success(
          data.message || (isRtl ? 'تمت مزامنة الأسعار بنجاح!' : 'Price sync completed successfully!')
        )
        await fetchStatus()
      } else if (res.ok && data.success) {
        toast.info(data.message || 'تم حفظ دفعة ويُستكمل الباقي تلقائيًا')
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

  // Determine true visual badge for engine health
  const getHealthBadge = () => {
    if (isRunning || engineStatus === 'RUNNING') {
      return {
        dotClass: 'bg-blue-500 animate-pulse',
        textClass: 'text-blue-600 dark:text-blue-400',
        label: isRtl ? 'قيد التنفيذ...' : 'Running...',
        desc: isRtl ? 'جاري جلب وتحديث الأسعار حالياً' : 'Sync actively running'
      }
    }
    if (engineStatus === 'COMPLETED') {
      return {
        dotClass: 'bg-emerald-500',
        textClass: 'text-emerald-600 dark:text-emerald-400',
        label: isRtl ? 'محدث اليوم بنجاح' : 'Updated Today',
        desc: isRtl ? 'تمت مزامنة الأسعار لتاريخ اليوم' : 'Verified current Cairo date'
      }
    }
    if (engineStatus === 'PARTIAL') return { dotClass: 'bg-amber-500 animate-pulse', textClass: 'text-amber-600', label: 'جارٍ الاستكمال', desc: 'الدفعات المحفوظة متاحة ويُستكمل الباقي تلقائيًا' }
    if (engineStatus === 'STALE') {
      return {
        dotClass: 'bg-amber-500',
        textClass: 'text-amber-600 dark:text-amber-400',
        label: isRtl ? 'بحاجة لمزامنة (STALE)' : 'Stale (Needs Sync)',
        desc: isRtl ? 'آخر نجاح يعود ليوم سابق' : 'Last success was earlier date'
      }
    }
    if (engineStatus === 'FAILED') {
      return {
        dotClass: 'bg-destructive',
        textClass: 'text-destructive',
        label: isRtl ? 'فشل آخر تشغيل (FAILED)' : 'Failed (Error)',
        desc: isRtl ? 'فشلت آخر محاولة مزامنة' : 'Last attempt encountered error'
      }
    }
    return {
      dotClass: 'bg-muted-foreground',
      textClass: 'text-muted-foreground',
      label: isRtl ? 'في انتظار أول تشغيل' : 'Pending First Run',
      desc: isRtl ? 'لم تسجل دورة سابقة' : 'No recorded execution yet'
    }
  }

  const health = getHealthBadge()

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
                ? 'مزامنة تلقائية يومية في تمام الساعة 06:00 صباحاً بتوقيت القاهرة عبر Cloudflare Worker Scheduled Handler'
                : 'Automated daily price sync at 06:00 AM Cairo Time via Cloudflare Worker Scheduled Handler'}
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
          <p className="text-[11px] text-muted-foreground">Cloudflare Scheduled Handler (0 3 / 0 4 UTC)</p>
        </div>

        {/* Latest Sync Date */}
        <div className="p-4 rounded-2xl bg-secondary/50 border border-border/60 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
            <Calendar className="w-3.5 h-3.5 text-emerald-500" />
            <span>{isRtl ? 'آخر مزامنة ناجحة' : 'Last Successful Sync'}</span>
          </div>
          <p className="text-base font-black text-foreground">
            {lastSuccess?.cairoDate || (isRtl ? 'لم تتم مزامنة بعد' : 'No sync recorded')}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {lastSuccess?.timestamp
              ? new Date(lastSuccess.timestamp).toLocaleTimeString('ar-EG', { timeZone: 'Africa/Cairo' }) + ' بتوقيت القاهرة'
              : 'بتوقيت القاهرة'}
          </p>
        </div>

        {/* Changes Count */}
        <div className="p-4 rounded-2xl bg-secondary/50 border border-border/60 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
            <Activity className="w-3.5 h-3.5 text-amber-500" />
            <span>{isRtl ? 'إحصائيات آخر تشغيل' : 'Latest Sync Impact'}</span>
          </div>
          <p className="text-base font-black text-foreground">
            {lastSuccess
              ? `+${lastSuccess.addedCount || 0} جديد | ${lastSuccess.priceChangedCount || 0} سعر محدث`
              : (isRtl ? 'في انتظار البيانات' : 'Awaiting data')}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {lastSuccess
              ? `${lastSuccess.verifiedCount || 0} دواء مطابق للسعر`
              : (isRtl ? 'من بوابة الدواء المصرية' : 'From DawaaGate')}
          </p>
        </div>

        {/* Sync Engine Health */}
        <div className="p-4 rounded-2xl bg-secondary/50 border border-border/60 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
            <span>{isRtl ? 'حالة محرك المزامنة' : 'Engine Health'}</span>
          </div>
          <div className="flex items-center gap-2 pt-0.5">
            <span className={`w-2.5 h-2.5 rounded-full ${health.dotClass}`}></span>
            <p className={`text-sm font-black ${health.textClass}`}>
              {health.label}
            </p>
          </div>
          <p className="text-[11px] text-muted-foreground">{health.desc}</p>
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
            {isRtl ? 'لا توجد عمليات مزامنة مسجلة حتى الآن.' : 'No sync logs recorded yet.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-right">
                  <th className="pb-2 font-bold px-2">{isRtl ? 'التاريخ' : 'Date'}</th>
                  <th className="pb-2 font-bold px-2">{isRtl ? 'المشغل' : 'Trigger'}</th>
                  <th className="pb-2 font-bold px-2">{isRtl ? 'الحالة' : 'Status'}</th>
                  <th className="pb-2 font-bold px-2">{isRtl ? 'جديد' : 'Added'}</th>
                  <th className="pb-2 font-bold px-2">{isRtl ? 'تحديث سعر' : 'Updated'}</th>
                  <th className="pb-2 font-bold px-2">{isRtl ? 'مطابق' : 'Verified'}</th>
                  <th className="pb-2 font-bold px-2">{isRtl ? 'المدة' : 'Duration'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {recentLogs.map((log) => (
                  <tr key={log.id || log.timestamp} className="hover:bg-secondary/30 transition-colors">
                    <td className="py-2.5 px-2 font-bold text-foreground">
                      {log.cairoDate || (log.timestamp ? log.timestamp.split('T')[0] : '-')}
                    </td>
                    <td className="py-2.5 px-2 text-muted-foreground">
                      <span className="px-2 py-0.5 rounded-full bg-secondary text-[11px] font-bold">
                        {log.triggeredBy === 'cron'
                          ? (isRtl ? 'تلقائي (Cron)' : 'Cron')
                          : (isRtl ? 'يدوي' : 'Manual')}
                      </span>
                    </td>
                    <td className="py-2.5 px-2">
                      {String(log.status).toUpperCase() === 'COMPLETED' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{isRtl ? 'ناجح' : 'Completed'}</span>
                        </span>
                      ) : String(log.status).toUpperCase() === 'PARTIAL' ? (
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold">
                          <Clock className="w-3 h-3" />
                          <span>{isRtl ? 'جارٍ الاستكمال' : 'Continuing'}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-destructive font-bold">
                          <AlertCircle className="w-3 h-3" />
                          <span>{isRtl ? 'فشل' : 'Failed'}</span>
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-foreground font-bold">+{log.addedCount || 0}</td>
                    <td className="py-2.5 px-2 text-foreground font-bold">{log.updatedCount || 0}</td>
                    <td className="py-2.5 px-2 text-foreground">{log.verifiedCount || 0}</td>
                    <td className="py-2.5 px-2 text-muted-foreground">
                      {log.durationMs ? `${(log.durationMs / 1000).toFixed(1)} ثانية` : '-'}
                    </td>
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
