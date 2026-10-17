'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MapPin,
  Navigation,
  Phone,
  MessageCircle,
  Clock,
  Copy,
  ExternalLink,
  Building2,
  CheckCircle2,
  Sparkles,
  Share2,
  Calendar,
  Compass,
  Check,
  Layers,
  Map as MapIcon,
  Maximize2
} from 'lucide-react'
import { toast } from 'sonner'
import { getClinicBranches, formatWeeklyScheduleSummary, isClinicOpenNow, DEFAULT_WEEKLY_SCHEDULE } from '@/lib/branchService'
import { resolveEffectiveLocation, isPlaceholderAddress, sanitizeAddress } from '@/lib/mapsHelper'
import { InteractiveClinicMap } from '@/components/clinic/InteractiveClinicMap'

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

  // Default fallback branches if no branches in database
  const defaultBranches = [
    {
      id: 'main',
      name: 'الفرع الرئيسي',
      address: clinic?.clinicAddress || 'شارع النصر - مدينة نصر - القاهرة',
      latitude: clinic?.latitude || 30.0521,
      longitude: clinic?.longitude || 31.3422,
      mapsLink: clinic?.mapsLink || 'https://maps.google.com/?q=Nasr+City+Cairo',
      phone: clinic?.clinicPhone || '01012345678',
      whatsapp: clinic?.whatsappNumber || clinic?.clinicPhone || '01012345678',
      workingHours: clinic?.workingHours || formatWeeklyScheduleSummary(clinic?.weeklySchedule, true) || 'السبت - الخميس: 9:00 ص - 10:00 م',
      weeklySchedule: clinic?.weeklySchedule || DEFAULT_WEEKLY_SCHEDULE,
      landmark: 'بجوار محطة المترو والبنك الأهلي • متوفر أماكن انتظار سيارات',
      isOpen: true,
      isMain: true
    }
  ]

  const initialList = propBranches && propBranches.length > 0 ? propBranches : defaultBranches
  const [branches, setBranches] = useState<any[]>(initialList)
  const [selectedBranch, setSelectedBranch] = useState<any>(() => {
    if (activeBranchName) {
      const match = initialList.find((b: any) => b.name?.includes(activeBranchName))
      if (match) return match
    }
    if (patientUpcomingAppt?.branchName) {
      const match = initialList.find((b: any) => b.name?.includes(patientUpcomingAppt.branchName))
      if (match) return match
    }
    return initialList[0]
  })
  const [isCopied, setIsCopied] = useState<boolean>(false)
  const [mapViewMode, setMapViewMode] = useState<'interactive' | 'iframe'>('interactive')
  const [asyncResolvedCoords, setAsyncResolvedCoords] = useState<{ lat: number; lng: number } | null>(null)

  // Load branches from Firestore if not provided as prop
  useEffect(() => {
    if (propBranches && propBranches.length > 0) {
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
          const mapped = active.map((b: any) => {
            const rawAddr = sanitizeAddress(b.address || clinic?.clinicAddress || '')
            const addr = !isPlaceholderAddress(rawAddr) ? rawAddr : sanitizeAddress(clinic?.clinicAddress) || 'مقر العيادة'
            return {
              ...b,
              address: addr,
              latitude: b.latitude || clinic?.latitude,
              longitude: b.longitude || clinic?.longitude,
              mapsLink: b.mapsLink || clinic?.mapsLink || `https://maps.google.com/?q=${encodeURIComponent(addr)}`,
              phone: b.phone || clinic?.clinicPhone || '01012345678',
              whatsapp: b.whatsapp || clinic?.whatsappNumber || b.phone || clinic?.clinicPhone || '01012345678',
              workingHours: b.workingHours || clinic?.workingHours || formatWeeklyScheduleSummary(b.weeklySchedule || clinic?.weeklySchedule, true),
              weeklySchedule: b.weeklySchedule || clinic?.weeklySchedule || DEFAULT_WEEKLY_SCHEDULE,
              landmark: b.landmark || 'متاح أماكن انتظار سيارات بالخارج'
            }
          })
          setBranches(mapped)

          // Select matching branch from patient's appointment, or first branch
          const match = mapped.find(
            (b: any) =>
              (activeBranchName && b.name?.includes(activeBranchName)) ||
              (patientUpcomingAppt?.branchName && b.name?.includes(patientUpcomingAppt.branchName))
          )
          setSelectedBranch(match || mapped[0])
          return
        }
      } catch (e) {
        console.warn('Could not load branches in ClinicLocationMap:', e)
      }

      if (isMounted) {
        setBranches(defaultBranches)
        const match = defaultBranches.find(
          (b) =>
            (activeBranchName && b.name?.includes(activeBranchName)) ||
            (patientUpcomingAppt?.branchName && b.name?.includes(patientUpcomingAppt.branchName))
        )
        setSelectedBranch(match || defaultBranches[0])
      }
    }

    load()
    return () => {
      isMounted = false
    }
  }, [clinicId, activeBranchName, patientUpcomingAppt?.branchName, propBranches])

  // Current active branch data
  const current = selectedBranch || branches[0] || defaultBranches[0]

  // Resolve location using multi-tier hierarchy
  const effective = resolveEffectiveLocation(current, clinic)
  const effectiveLat = asyncResolvedCoords?.lat ?? effective.lat ?? 30.1294522
  const effectiveLng = asyncResolvedCoords?.lng ?? effective.lng ?? 31.2485622
  const effectiveAddress = effective.address
  const effectiveDirectionsUrl = effective.directionsUrl
  const effectiveMapsLink = effective.mapsLink

  // Attempt async resolution if coordinates are completely missing
  useEffect(() => {
    if (effective.lat !== null && effective.lng !== null) {
      setAsyncResolvedCoords(null)
      return
    }

    let isMounted = true
    const resolveAsync = async () => {
      try {
        const queryParam = current?.mapsLink || clinic?.mapsLink
        const addrParam = effectiveAddress
        const res = await fetch(
          `/api/resolve-maps-coords?${queryParam ? `url=${encodeURIComponent(queryParam)}` : `address=${encodeURIComponent(addrParam)}`}`
        )
        const data = await res.json()
        if (data.success && typeof data.lat === 'number' && typeof data.lng === 'number' && isMounted) {
          setAsyncResolvedCoords({ lat: data.lat, lng: data.lng })
        }
      } catch (e) {}
    }

    resolveAsync()
    return () => {
      isMounted = false
    }
  }, [current?.mapsLink, clinic?.mapsLink, effectiveAddress, effective.lat, effective.lng])

  // Safe Google Maps Embed Query for iFrame fallback
  const iframeEmbedUrl = `https://maps.google.com/maps?q=${effectiveLat},${effectiveLng}&t=&z=16&ie=UTF8&iwloc=&output=embed`

  const handleCopyAddress = () => {
    if (!effectiveAddress) return
    navigator.clipboard.writeText(effectiveAddress)
    setIsCopied(true)
    toast.success('تم نسخ عنوان العيادة إلى الحافظة بنجاح')
    setTimeout(() => setIsCopied(false), 2000)
  }

  const handleShareLocation = async () => {
    const text = `📍 موقع ${clinic?.clinicName || 'العيادة'}:\n${current?.name || 'الفرع الرئيسي'} - ${effectiveAddress}\nرابط خرائط جوجل:\n${effectiveMapsLink}`
    if (navigator.share) {
      try {
        await navigator.share({
          title: `موقع ${clinic?.clinicName || 'العيادة'}`,
          text: text,
          url: effectiveMapsLink
        })
      } catch (e) {}
    } else {
      navigator.clipboard.writeText(text)
      toast.success('تم نسخ تفاصيل الموقع ورابط الخريطة لمشاركتها')
    }
  }

  const cleanPhone = (current?.phone || clinic?.clinicPhone || '01012345678').replace(/[^0-9]/g, '')
  const whatsappNum = (current?.whatsapp || clinic?.whatsappNumber || cleanPhone).replace(/^0+/, '20')

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className={`space-y-4 ${className}`}
    >
      {/* Top Header Card with Floating Glow */}
      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#0066dc] via-[#007fe8] to-[#00b4d8] text-white p-5 shadow-xl shadow-sky-600/15">
        {/* Subtle decorative circles */}
        <div className="absolute -top-12 -left-12 w-44 h-44 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full bg-cyan-300/20 blur-xl pointer-events-none" />

        <div className="relative z-10 flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-[11px] font-bold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
              </span>
              <span>نظام الملاحة الذكي للعيادة (GPS مباشر)</span>
            </div>
            <h3 className="text-lg font-black tracking-tight pt-1">
              {clinic?.clinicName || 'عيادة الطبيب المعالج'}
            </h3>
            <p className="text-xs text-sky-100/90 font-medium leading-relaxed">
              توجّه مباشرة إلى العيادة عبر نظام الملاحة المباشر أو تواصل مع الاستقبال للاستفسار عن المسار.
            </p>
          </div>

          <motion.div
            whileHover={{ scale: 1.08, rotate: 6 }}
            className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center shrink-0 shadow-inner"
          >
            <Compass className="w-6 h-6 text-white" />
          </motion.div>
        </div>

        {/* Current appointment branch alert if available */}
        {patientUpcomingAppt && (
          <div className="mt-3.5 pt-3 border-t border-white/20 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-300 animate-pulse" />
              <span className="font-bold">فرع حجزك القادم:</span>
              <span className="font-extrabold bg-white/20 px-2 py-0.5 rounded-md">
                {patientUpcomingAppt.branchName || 'الفرع الرئيسي'}
              </span>
            </div>
            <span className="text-[11px] text-sky-100 font-mono" dir="ltr">
              {patientUpcomingAppt.date}
            </span>
          </div>
        )}
      </div>

      {/* Branch Selection Pills (if multi-branch) */}
      {branches.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {branches.map((b) => {
            const isSelected = selectedBranch?.id === b.id || selectedBranch?.name === b.name
            const isPatientBranch =
              patientUpcomingAppt?.branchName && b.name?.includes(patientUpcomingAppt.branchName)

            return (
              <motion.button
                key={b.id || b.name}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setSelectedBranch(b)
                }}
                className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer border ${
                  isSelected
                    ? 'bg-sky-600 text-white border-sky-600 shadow-md shadow-sky-600/25 ring-2 ring-sky-400/30'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-sky-50 dark:hover:bg-slate-700'
                }`}
              >
                <Building2 className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-sky-600'}`} />
                <span>{b.name}</span>
                {isPatientBranch && (
                  <span className="text-[9px] bg-amber-400 text-slate-900 px-1.5 py-0.2 rounded-full font-extrabold mr-1">
                    حجزك
                  </span>
                )}
              </motion.button>
            )
          })}
        </div>
      )}

      {/* Interactive Map Frame Card */}
      <div className="relative rounded-[28px] overflow-hidden bg-slate-900 border border-sky-200 dark:border-slate-700 shadow-lg">
        {/* Map Top Bar with Mode Switcher */}
        <div className="bg-slate-950/90 backdrop-blur-md px-4 py-2.5 flex items-center justify-between border-b border-white/10 z-10 relative flex-wrap gap-2">
          <div className="flex items-center gap-2 truncate">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
            <span className="text-xs font-bold text-white truncate">
              موقع: {current?.name || 'مقر العيادة'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-white/10 text-[10px]">
              <button
                type="button"
                onClick={() => setMapViewMode('interactive')}
                className={`px-2 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                  mapViewMode === 'interactive'
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                خريطة تفاعلية (سكرول)
              </button>
              <button
                type="button"
                onClick={() => setMapViewMode('iframe')}
                className={`px-2 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                  mapViewMode === 'iframe'
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                إطار Google
              </button>
            </div>

            <a
              href={effectiveMapsLink}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] font-bold text-sky-400 hover:text-sky-300 flex items-center gap-1 transition-colors shrink-0"
            >
              <span>تكبير</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Map Render Mode */}
        {mapViewMode === 'interactive' ? (
          <InteractiveClinicMap
            key={`map-${current?.id || current?.name || 'main'}-${effectiveLat}-${effectiveLng}`}
            lat={effectiveLat}
            lng={effectiveLng}
            clinicName={clinic?.clinicName || 'عيادة الطبيب'}
            branchName={current?.name}
            address={effectiveAddress}
            directionsUrl={effectiveDirectionsUrl}
            googleMapsUrl={effectiveMapsLink}
            height="h-72 sm:h-80"
          />
        ) : (
          <div className="relative w-full h-72 sm:h-80 bg-slate-950">
            <iframe
              title={`خريطة موقع ${current?.name}`}
              src={iframeEmbedUrl}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen={false}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="w-full h-full"
            />
          </div>
        )}
      </div>

      {/* Branch Detailed Information Card */}
      <motion.div
        layout
        className="p-5 rounded-[28px] bg-white dark:bg-slate-800/90 border border-sky-100 dark:border-slate-700 shadow-sm space-y-4"
      >
        {/* Address Row with Copy */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-700/70">
          <div className="flex items-start gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 mt-0.5">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-400 block">العنوان الدقيق:</span>
              <p className="text-xs font-black text-slate-800 dark:text-white leading-relaxed mt-0.5">
                {effectiveAddress}
              </p>
              {current?.landmark && (
                <span className="inline-block text-[10px] text-sky-600 dark:text-sky-400 font-bold mt-1 bg-sky-50 dark:bg-sky-950/60 px-2 py-0.5 rounded-md">
                  💡 {current.landmark}
                </span>
              )}
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleCopyAddress}
            className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-sky-100 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
            title="نسخ العنوان"
          >
            {isCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </motion.button>
        </div>

        {/* Working Hours Row */}
        {(() => {
          const effectiveSchedule = current?.weeklySchedule || clinic?.weeklySchedule
          const isOpenNow = isClinicOpenNow(effectiveSchedule)
          const scheduleSummary = current?.workingHours || formatWeeklyScheduleSummary(effectiveSchedule, true)

          return (
            <div className="flex items-start gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-700/70">
              <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                <Clock className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400">مواعيد العمل واستقبال المرضى:</span>
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                    isOpenNow
                      ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/70 border-emerald-200 dark:border-emerald-800'
                      : 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/70 border-amber-200 dark:border-amber-800'
                  }`}>
                    {isOpenNow ? 'متاح ومفتوح الآن' : 'مغلق حالياً'}
                  </span>
                </div>
                <p className="text-xs font-black text-slate-800 dark:text-white mt-1">
                  {scheduleSummary}
                </p>
              </div>
            </div>
          )
        })()}

        {/* Quick Contact & Action Buttons */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          {/* 1. Directions */}
          <motion.a
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.96 }}
            href={effectiveDirectionsUrl}
            target="_blank"
            rel="noreferrer"
            className="py-2.5 px-2 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-extrabold flex flex-col items-center justify-center gap-1 shadow-sm transition-all text-center"
          >
            <Navigation className="w-4 h-4" />
            <span>الاتجاهات (GPS)</span>
          </motion.a>

          {/* 2. WhatsApp Location */}
          <motion.a
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.96 }}
            href={`https://wa.me/${whatsappNum}?text=${encodeURIComponent(
              `مرحباً، أود الاستفسار عن تفاصيل الوصول وموقع العيادة (${current?.name || 'العيادة'}) - العنوان: ${effectiveAddress}`
            )}`}
            target="_blank"
            rel="noreferrer"
            className="py-2.5 px-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-extrabold flex flex-col items-center justify-center gap-1 shadow-sm transition-all text-center"
          >
            <MessageCircle className="w-4 h-4" />
            <span>لوكيشن واتساب</span>
          </motion.a>

          {/* 3. Call Reception */}
          <motion.a
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.96 }}
            href={`tel:${cleanPhone}`}
            className="py-2.5 px-2 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white text-[11px] font-extrabold flex flex-col items-center justify-center gap-1 transition-all text-center"
          >
            <Phone className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <span>اتصال بالاستقبال</span>
          </motion.a>
        </div>

        {/* Share Location Button */}
        <button
          type="button"
          onClick={handleShareLocation}
          className="w-full py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
        >
          <Share2 className="w-3.5 h-3.5 text-sky-500" />
          <span>مشاركة لوكيشن العيادة عبر التطبيقات</span>
        </button>
      </motion.div>
    </motion.div>
  )
}
