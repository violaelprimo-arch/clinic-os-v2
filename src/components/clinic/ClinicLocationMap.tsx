'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  MapPin,
  Navigation,
  Phone,
  MessageCircle,
  Copy,
  ExternalLink,
  Building2,
  CheckCircle2,
  Share2,
  Calendar,
  Compass,
  Check,
  Clock,
  AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'
import { getClinicBranches, formatWeeklyScheduleSummary, isClinicOpenNow, DEFAULT_WEEKLY_SCHEDULE } from '@/lib/branchService'
import { resolveEffectiveLocation, isPlaceholderAddress, sanitizeAddress, extractCoordsFromLink, isValidCoords } from '@/lib/mapsHelper'

export interface ClinicLocationMapProps {
  clinic: any
  activeBranchName?: string
  patientUpcomingAppt?: any
  branches?: any[]
  className?: string
}

export function ClinicLocationMap({
  clinic,
  activeBranchName,
  patientUpcomingAppt,
  branches: propBranches,
  className = ''
}: ClinicLocationMapProps) {
  const clinicId = clinic?.id || clinic?.slug || 'demo'

  const [branches, setBranches] = useState<any[]>(propBranches || [])
  const [selectedBranch, setSelectedBranch] = useState<any>(null)
  const [isCopied, setIsCopied] = useState<boolean>(false)
  const [resolvedLink, setResolvedLink] = useState<{ url: string; lat: number; lng: number } | null>(null)
  const [isResolving, setIsResolving] = useState<boolean>(false)

  // Load branches from Firestore or use props
  useEffect(() => {
    if (Array.isArray(propBranches)) {
      setBranches(propBranches)
      const match = propBranches.find(
        (b: any) =>
          (activeBranchName && b.name?.includes(activeBranchName)) ||
          (patientUpcomingAppt?.branchName && b.name?.includes(patientUpcomingAppt.branchName))
      )
      setSelectedBranch(match || propBranches[0])
      return
    }

    let isMounted = true
    const load = async () => {
      try {
        const dbBranches = await getClinicBranches(clinicId).catch(() => [])
        const active = dbBranches.filter((b: any) => !b.isArchived)
        if (active.length > 0 && isMounted) {
          setBranches(active)
          const match = active.find(
            (b: any) =>
              (activeBranchName && b.name?.includes(activeBranchName)) ||
              (patientUpcomingAppt?.branchName && b.name?.includes(patientUpcomingAppt.branchName))
          )
          setSelectedBranch(match || active[0])
          return
        }
      } catch (e) {
        console.warn('Could not load branches in ClinicLocationMap:', e)
      }

      // If no database branches, use clinic's main profile directly (NO fake placeholders)
      if (isMounted) {
        const fallback = {
          id: 'main',
          name: clinic?.clinicName || 'المقر الرئيسي',
          address: sanitizeAddress(clinic?.clinicAddress || clinic?.address) || '',
          latitude: clinic?.latitude || null,
          longitude: clinic?.longitude || null,
          mapsLink: clinic?.mapsLink || '',
          phone: clinic?.clinicPhone || '',
          whatsapp: clinic?.whatsappNumber || clinic?.clinicPhone || '',
          workingHours: clinic?.workingHours || formatWeeklyScheduleSummary(clinic?.weeklySchedule, true) || '',
          weeklySchedule: clinic?.weeklySchedule || DEFAULT_WEEKLY_SCHEDULE,
          isOpen: clinic?.isClinicOpen !== false,
          isMain: true
        }
        setBranches([fallback])
        setSelectedBranch(fallback)
      }
    }

    load()
    return () => {
      isMounted = false
    }
  }, [clinicId, activeBranchName, patientUpcomingAppt?.branchName, propBranches, clinic?.clinicAddress, clinic?.clinicPhone, clinic?.mapsLink])

  // Current selected branch
  const current = selectedBranch || branches[0] || null

  // The selected branch's Google Maps link is the authority for the pin.
  // A link for the main clinic must never be silently reused for another branch.
  const effective = resolveEffectiveLocation(current, clinic)
  const targetMapsLink: string =
    current?.mapsLink || ((current?.isMain || !current) ? (clinic?.mapsLink || '') : '')
  const directLinkCoords = targetMapsLink ? extractCoordsFromLink(targetMapsLink) : null
  const resolvedForCurrentLink = resolvedLink?.url === targetMapsLink ? resolvedLink : null
  // The owner can explicitly verify stored coordinates from their branch editor.
  // Never use coordinates from an outdated link after the map URL changes.
  const confirmedStoredCoords =
    current?.locationVerified === true &&
    String(current?.verifiedMapsLink || '') === String(targetMapsLink || '') &&
    isValidCoords(Number(current?.latitude), Number(current?.longitude))
      ? { lat: Number(current.latitude), lng: Number(current.longitude) }
      : null

  // Do not display outdated manually entered coordinates while a short Google
  // Maps URL points to an unverified destination. This was the wrong-pin bug.
  const effectiveLat = targetMapsLink
    ? (directLinkCoords?.lat ?? resolvedForCurrentLink?.lat ?? confirmedStoredCoords?.lat ?? null)
    : effective.lat
  const effectiveLng = targetMapsLink
    ? (directLinkCoords?.lng ?? resolvedForCurrentLink?.lng ?? confirmedStoredCoords?.lng ?? null)
    : effective.lng
  const effectiveAddress = effective.address
  const effectiveMapsLink = targetMapsLink || effective.mapsLink
  const hasExactCoords = effectiveLat !== null && effectiveLng !== null
  const effectiveDirectionsUrl = targetMapsLink ||
    (hasExactCoords
      ? `https://www.google.com/maps/dir/?api=1&destination=${effectiveLat},${effectiveLng}`
      : effective.directionsUrl)

  useEffect(() => {
    if (!targetMapsLink || directLinkCoords) {
      setResolvedLink(null)
      setIsResolving(false)
      return
    }

    let alive = true
    setResolvedLink(null)
    setIsResolving(true)
    fetch(`/api/resolve-maps-coords?url=${encodeURIComponent(targetMapsLink)}`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error('Location not verified')
        return res.json()
      })
      .then((data) => {
        if (alive && data.success && Number.isFinite(data.lat) && Number.isFinite(data.lng)) {
          setResolvedLink({ url: targetMapsLink, lat: data.lat, lng: data.lng })
        }
      })
      .catch(() => { /* No misleading guessed map pin on failure */ })
      .finally(() => { if (alive) setIsResolving(false) })
    return () => { alive = false }
  }, [targetMapsLink, directLinkCoords?.lat, directLinkCoords?.lng])

  // Show the exact pin when verified. Otherwise show a clearly labelled
  // address-search map preview; never call the approximate result a verified pin.
  const canSearchAddress = !!effectiveAddress &&
    !isPlaceholderAddress(effectiveAddress)
  const iframeEmbedUrl = hasExactCoords
    ? `https://maps.google.com/maps?q=${effectiveLat},${effectiveLng}&t=&z=16&ie=UTF8&iwloc=&output=embed`
    : canSearchAddress
      ? `https://maps.google.com/maps?q=${encodeURIComponent([effectiveAddress, current?.city || current?.governorate || 'مصر'].filter(Boolean).join('، '))}&output=embed`
      : null

  const handleCopyAddress = () => {
    if (!effectiveAddress) return
    navigator.clipboard.writeText(effectiveAddress)
    setIsCopied(true)
    toast.success('تم نسخ عنوان الفرع إلى الحافظة بنجاح')
    setTimeout(() => setIsCopied(false), 2000)
  }

  const handleShareLocation = async () => {
    const text = `📍 موقع ${clinic?.clinicName || 'العيادة'}:\n${current?.name || 'الفرع الرئيسي'}${effectiveAddress ? ` - ${effectiveAddress}` : ''}\nرابط خرائط جوجل:\n${effectiveMapsLink}`
    if (navigator.share) {
      try {
        await navigator.share({
          title: `موقع ${clinic?.clinicName || 'العيادة'} - ${current?.name || ''}`,
          text: text,
          url: effectiveMapsLink
        })
      } catch (e) {}
    } else {
      navigator.clipboard.writeText(text)
      toast.success('تم نسخ تفاصيل الموقع ورابط الخريطة لمشاركتها')
    }
  }

  const branchPhone = current?.phone || clinic?.clinicPhone || ''
  const cleanPhone = branchPhone.replace(/[^0-9]/g, '')
  const whatsappNum = (current?.whatsapp || clinic?.whatsappNumber || cleanPhone).replace(/^0+/, '20')

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className={`space-y-4 font-sans ${className}`}
      dir="rtl"
    >
      {/* Top Header Card */}
      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#0066dc] via-[#007fe8] to-[#00b4d8] text-white p-5 sm:p-6 shadow-xl shadow-sky-600/15">
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-[11px] font-bold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
              </span>
              <span>نظام الملاحة وموقع العيادة المعتمد</span>
            </div>
            <h3 className="text-lg sm:text-xl font-black tracking-tight pt-1">
              {clinic?.clinicName || 'عيادة الطبيب المعالج'}
            </h3>
            <p className="text-xs text-sky-100/90 font-medium leading-relaxed max-w-xl">
              توجّه مباشرة إلى مقر العيادة عبر الملاحة الذكية، أو تواصل مع الاستقبال للاستفسار عن أقرب مسار.
            </p>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            {effectiveMapsLink && (
              <a
                href={effectiveMapsLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-sky-700 hover:bg-sky-50 font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                <Compass className="w-4 h-4 text-sky-600" />
                <span>فتح خرائط Google</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-60" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Multi-Branch Selector Tabs (if more than 1 branch) */}
      {branches.length > 1 && (
        <div className="bg-white dark:bg-[#081526] p-2.5 rounded-2xl border border-sky-100 dark:border-slate-800 shadow-xs flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-xs font-bold text-muted-foreground px-2 flex items-center gap-1.5 shrink-0">
            <Building2 className="w-3.5 h-3.5 text-primary" />
            اختر الفرع:
          </span>
          {branches.map((b) => {
            const isSelected = current?.id === b.id
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  setSelectedBranch(b)
                  setResolvedLink(null)
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-primary text-white shadow-md shadow-primary/20 scale-[1.02]'
                    : 'bg-muted/50 hover:bg-muted text-foreground border border-border/60'
                }`}
              >
                <span>{b.name}</span>
                {b.isMain && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${isSelected ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>
                    رئيسي
                  </span>
                )}
                {b.isOpen === false && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-rose-500/20 text-rose-500 font-bold">
                    مغلق
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Main Location Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left Column: Interactive Map Frame (7 cols) */}
        <div className="lg:col-span-7 rounded-[26px] overflow-hidden border border-border bg-card shadow-lg flex flex-col min-h-[360px] relative">
          {iframeEmbedUrl ? (
            <>
            {!hasExactCoords && (
              <div className="p-2 bg-amber-50 text-amber-800 text-[11px] text-center border-b border-amber-200">
                معاينة بحث بالعنوان فقط، وليست دبوساً مؤكداً. يرجى من المالك تأكيد إحداثيات الفرع.
              </div>
            )}
            <iframe
              src={iframeEmbedUrl}
              className="w-full flex-1 min-h-[360px] border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title={`موقع ${current?.name || clinic?.clinicName || 'العيادة'}`}
            />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3 bg-muted/30">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <MapPin className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-foreground">{isResolving ? 'جارٍ التحقق من رابط خرائط Google...' : 'لم يتم التأكد من موقع الدبوس بدقة'}</h4>
                <p className="text-xs text-muted-foreground max-w-sm">
                  {effectiveAddress ? `العنوان المسجل: ${effectiveAddress}` : 'يمكنك التواصل مع العيادة للاستفسار عن العنوان الدقيق.'}
                </p>
              </div>
              {effectiveMapsLink && (
                <a
                  href={effectiveMapsLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold shadow-xs hover:bg-primary/90"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>فتح في تطبيق خرائط جوجل</span>
                </a>
              )}
            </div>
          )}

          {/* Map Footer Bar with verified coordinates badge */}
          <div className="p-3 bg-card/95 backdrop-blur-md border-t border-border flex items-center justify-between text-xs gap-2">
            <div className="flex items-center gap-2 text-muted-foreground min-w-0">
              <MapPin className="w-4 h-4 text-primary shrink-0" />
              <span className="font-bold text-foreground truncate">
                {current?.name || 'الفرع الرئيسي'}: {effectiveAddress}
              </span>
            </div>
            {hasExactCoords && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] shrink-0 border border-emerald-500/20">
                <CheckCircle2 className="w-3 h-3" />
                إحداثيات موقع محددة
              </span>
            )}
          </div>
        </div>

        {/* Right Column: Branch Contact & Navigation Card (5 cols) */}
        <div className="lg:col-span-5 rounded-[26px] border border-border bg-card p-5 sm:p-6 shadow-lg flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            {/* Header info */}
            <div className="space-y-1 pb-3 border-b border-border">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-black text-base text-foreground">
                  {current?.name || 'الفرع الرئيسي'}
                </h4>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                  current?.isOpen !== false && isClinicOpenNow(current?.weeklySchedule || clinic?.weeklySchedule)
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${current?.isOpen !== false && isClinicOpenNow(current?.weeklySchedule || clinic?.weeklySchedule) ? 'bg-emerald-500 animate-ping' : 'bg-rose-500'}`} />
                  <span>
                    {current?.isOpen !== false && isClinicOpenNow(current?.weeklySchedule || clinic?.weeklySchedule)
                      ? 'مفتوح لاستقبال الحالات'
                      : 'مغلق حالياً'}
                  </span>
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {current?.governorate || clinic?.governorate || 'القاهرة'} {current?.city ? `• ${current.city}` : ''}
              </p>
            </div>

            {/* Address */}
            <div className="p-3.5 rounded-2xl bg-muted/40 border border-border space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-bold text-muted-foreground block">العنوان بالتفصيل:</span>
                    <span className="text-xs font-bold text-foreground leading-relaxed block">
                      {effectiveAddress}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyAddress}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted shrink-0 transition-colors"
                  title="نسخ العنوان"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Schedule */}
            {current?.workingHours && (
              <div className="p-3.5 rounded-2xl bg-muted/40 border border-border flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="text-[11px] font-bold text-muted-foreground block">مواعيد العمل الأسبوعية:</span>
                  <span className="text-xs font-bold text-foreground leading-relaxed block">
                    {current.workingHours}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-2.5 pt-2">
            <div className="grid grid-cols-2 gap-2">
              {effectiveDirectionsUrl && (
                <a
                  href={effectiveDirectionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-primary text-white font-bold text-xs shadow-md shadow-primary/20 hover:bg-primary/90 transition-all cursor-pointer"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>الاتجاهات للفرع</span>
                </a>
              )}
              <button
                type="button"
                onClick={handleShareLocation}
                className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-secondary text-foreground font-bold text-xs border border-border hover:bg-secondary/80 transition-all cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5 text-primary" />
                <span>مشاركة الموقع</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {branchPhone && (
                <a
                  href={`tel:${branchPhone}`}
                  className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-card border border-border text-foreground hover:bg-muted font-bold text-xs transition-all"
                  dir="ltr"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{branchPhone}</span>
                </a>
              )}
              {whatsappNum && (
                <a
                  href={`https://wa.me/${whatsappNum}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-bold text-xs transition-all"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>واتساب الفرع</span>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
