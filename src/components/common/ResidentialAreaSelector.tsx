'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  MapPin,
  Navigation,
  Loader2,
  Check,
  AlertCircle,
  HelpCircle,
  RotateCcw,
  Sparkles,
  ChevronDown,
  Edit3
} from 'lucide-react'
import {
  EGYPT_GOVERNORATES,
  getCities,
  getAreas,
  CUSTOM_AREA_ID,
  GovernorateItem,
  CityItem,
  AreaItem
} from '@/data/egyptGeographicData'

export interface ResidentialAreaValue {
  governorateId?: string
  governorateNameAr?: string
  governorateNameEn?: string
  cityId?: string
  cityNameAr?: string
  cityNameEn?: string
  areaId?: string
  areaNameAr?: string
  areaNameEn?: string
  customAreaName?: string
  source?: 'manual' | 'location_suggested' | 'staff_override'
}

export interface ResidentialAreaSelectorProps {
  value?: ResidentialAreaValue | null
  onChange: (val: ResidentialAreaValue | null) => void
  isRtl?: boolean
  language?: string
  disabled?: boolean
  showLocationButton?: boolean
  compact?: boolean
  defaultSource?: 'manual' | 'location_suggested' | 'staff_override'
}

export function ResidentialAreaSelector({
  value,
  onChange,
  isRtl = true,
  language = 'ar',
  disabled = false,
  showLocationButton = true,
  compact = false,
  defaultSource = 'manual'
}: ResidentialAreaSelectorProps) {
  const isEn = language === 'en'

  // Internal state reflecting selection
  const [governorateId, setGovernorateId] = useState<string>(value?.governorateId || '')
  const [cityId, setCityId] = useState<string>(value?.cityId || '')
  const [areaId, setAreaId] = useState<string>(value?.areaId || '')
  const [customAreaName, setCustomAreaName] = useState<string>(value?.customAreaName || '')
  const [source, setSource] = useState<'manual' | 'location_suggested' | 'staff_override'>(
    value?.source || defaultSource
  )

  // Geolocation UI states
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  const [locationNotice, setLocationNotice] = useState<string | null>(null)
  const [proposal, setProposal] = useState<{
    governorateId: string
    governorateNameAr: string
    governorateNameEn: string
    cityId: string
    cityNameAr: string
    cityNameEn: string
    areaId: string
    areaNameAr: string
    areaNameEn: string
    confidence: 'high' | 'medium' | 'low'
  } | null>(null)

  // Sync external changes
  useEffect(() => {
    if (value) {
      setGovernorateId(value.governorateId || '')
      setCityId(value.cityId || '')
      setAreaId(value.areaId || '')
      setCustomAreaName(value.customAreaName || '')
      if (value.source) setSource(value.source)
    }
  }, [value])

  // Cascading options
  const availableCities = useMemo(() => {
    return governorateId ? getCities(governorateId) : []
  }, [governorateId])

  const availableAreas = useMemo(() => {
    return governorateId && cityId ? getAreas(governorateId, cityId) : []
  }, [governorateId, cityId])

  // Emit changes to parent
  const emitChange = (
    newGovId: string,
    newCityId: string,
    newAreaId: string,
    newCustomName: string,
    newSource: 'manual' | 'location_suggested' | 'staff_override'
  ) => {
    if (!newGovId) {
      onChange(null)
      return
    }

    const gov = EGYPT_GOVERNORATES.find((g) => g.id === newGovId)
    const city = gov?.cities.find((c) => c.id === newCityId)
    const area = city?.areas.find((a) => a.id === newAreaId)

    const isCustom = newAreaId === CUSTOM_AREA_ID

    onChange({
      governorateId: newGovId,
      governorateNameAr: gov?.nameAr || '',
      governorateNameEn: gov?.nameEn || '',
      cityId: newCityId || '',
      cityNameAr: city?.nameAr || '',
      cityNameEn: city?.nameEn || '',
      areaId: newAreaId || '',
      areaNameAr: isCustom ? (newCustomName || 'أخرى') : (area?.nameAr || ''),
      areaNameEn: isCustom ? (newCustomName || 'Other') : (area?.nameEn || ''),
      customAreaName: isCustom ? (newCustomName || '') : '',
      source: newSource
    })
  }

  // Handle cascading changes
  const handleGovernorateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    setGovernorateId(val)
    setCityId('')
    setAreaId('')
    setCustomAreaName('')
    setProposal(null)
    setSource(defaultSource)
    emitChange(val, '', '', '', defaultSource)
  }

  const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    setCityId(val)
    setAreaId('')
    setCustomAreaName('')
    setProposal(null)
    setSource(defaultSource)
    emitChange(governorateId, val, '', '', defaultSource)
  }

  const handleAreaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    setAreaId(val)
    if (val !== CUSTOM_AREA_ID) {
      setCustomAreaName('')
    }
    setProposal(null)
    setSource(defaultSource)
    emitChange(governorateId, cityId, val, val === CUSTOM_AREA_ID ? customAreaName : '', defaultSource)
  }

  const handleCustomAreaNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setCustomAreaName(val)
    emitChange(governorateId, cityId, areaId, val, source)
  }

  // Handle single-shot geolocation
  const handleStartLocationDetection = () => {
    setLocationNotice(null)
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setLocationNotice(
        isEn
          ? 'Geolocation is not supported by your browser.'
          : 'المتصفح لا يدعم تحديد الموقع الجغرافي. يرجى اختيار منطقتك يدويًا.'
      )
      return
    }

    setShowLocationModal(true)
  }

  const handleExecuteLocation = () => {
    setShowLocationModal(false)
    setIsLocating(true)
    setLocationNotice(null)

    // Single-shot geolocation with timeout
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords

          // ZERO PII: Send ONLY coordinates
          const res = await fetch('/api/geo/reverse-geocode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat: latitude, lng: longitude })
          })

          const data = await res.json()
          if (data.success && data.proposal) {
            setProposal(data.proposal)
          } else {
            setLocationNotice(
              data.message ||
                (isEn
                  ? 'Could not automatically identify your area. Please select manually.'
                  : 'تعذر تحديد المنطقة تلقائيًا. يرجى اختيارها يدويًا من القوائم.')
            )
          }
        } catch {
          setLocationNotice(
            isEn
              ? 'Error connecting to location service. Please select manually.'
              : 'تعذر الاتصال بخدمة تحديد المنطقة. يرجى الاختيار يدويًا.'
          )
        } finally {
          setIsLocating(false)
        }
      },
      (err) => {
        setIsLocating(false)
        let msg = isEn
          ? 'Location access denied or unavailable. Please select your area manually.'
          : 'تم رفض إذن الموقع أو تعذر الوصول إليه. يمكنك اختيار منطقتك يدويًا دون أي مشكلة.'
        if (err.code === err.TIMEOUT) {
          msg = isEn
            ? 'Location request timed out. Please select your area manually.'
            : 'انتهت مهلة طلب الموقع. يرجى اختيار منطقتك يدويًا من القوائم.'
        }
        setLocationNotice(msg)
      },
      {
        enableHighAccuracy: false,
        timeout: 9000,
        maximumAge: 0
      }
    )
  }

  // User confirms the location proposal
  const handleConfirmProposal = () => {
    if (!proposal) return
    setGovernorateId(proposal.governorateId)
    setCityId(proposal.cityId)
    setAreaId(proposal.areaId)
    setCustomAreaName('')
    setSource('location_suggested')
    emitChange(
      proposal.governorateId,
      proposal.cityId,
      proposal.areaId,
      '',
      'location_suggested'
    )
    setProposal(null)
    setLocationNotice(null)
  }

  // User clicks modify/adjust proposal
  const handleAdjustProposal = () => {
    if (!proposal) return
    setGovernorateId(proposal.governorateId)
    setCityId(proposal.cityId)
    setAreaId(proposal.areaId)
    setSource('manual')
    emitChange(
      proposal.governorateId,
      proposal.cityId,
      proposal.areaId,
      '',
      'manual'
    )
    setProposal(null)
  }

  const handleClearAll = () => {
    setGovernorateId('')
    setCityId('')
    setAreaId('')
    setCustomAreaName('')
    setProposal(null)
    setLocationNotice(null)
    onChange(null)
  }

  return (
    <div className={`space-y-3 ${compact ? 'text-xs' : 'text-sm'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header and Location Button */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
          <span className="font-extrabold text-slate-800 dark:text-slate-100">
            {isEn ? 'Residential Area' : 'منطقة السكن'}
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
            {isEn ? 'Optional' : 'اختياري'}
          </span>
        </div>

        {showLocationButton && !disabled && (
          <button
            type="button"
            onClick={handleStartLocationDetection}
            disabled={isLocating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/40 dark:hover:bg-sky-900/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
          >
            {isLocating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Navigation className="w-3.5 h-3.5 text-sky-500" />
            )}
            <span>
              {isLocating
                ? isEn
                  ? 'Detecting...'
                  : 'جاري الاقتراح...'
                : isEn
                ? 'Suggest my area'
                : 'استخدم موقعي الحالي'}
            </span>
          </button>
        )}
      </div>

      {/* Upfront Permission Explanation Notice / Modal */}
      {showLocationModal && (
        <div className="p-3.5 rounded-2xl bg-sky-50/90 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 space-y-2.5 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-start gap-2.5">
            <div className="p-1.5 rounded-xl bg-sky-600 text-white shrink-0">
              <Navigation className="w-4 h-4" />
            </div>
            <div className="text-xs text-sky-950 dark:text-sky-100 leading-relaxed font-medium">
              <p className="font-bold text-sky-900 dark:text-sky-200 mb-0.5">
                {isEn ? 'Privacy Notice & Area Suggestion' : 'تنبيه الخصوصية واقتراح المنطقة:'}
              </p>
              <p>
                {isEn
                  ? 'We will use your current location once to suggest your area. Please make sure it is your residence, not your work or clinic.'
                  : 'سنستخدم موقعك الحالي لمرة واحدة لاقتراح المحافظة والحي. يرجى التأكد أنها منطقة سكنك وليست مكان عملك أو تواجدك المؤقت.'}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-1 border-t border-sky-200/60 dark:border-sky-800/60">
            <button
              type="button"
              onClick={() => setShowLocationModal(false)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800 cursor-pointer"
            >
              {isEn ? 'Cancel' : 'إلغاء'}
            </button>
            <button
              type="button"
              onClick={handleExecuteLocation}
              className="px-3 py-1.5 rounded-xl text-xs font-black bg-sky-600 hover:bg-sky-700 text-white shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isEn ? 'Suggest Area' : 'متابعة واقتراح المنطقة'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Proposal Card Requiring Visitor Confirmation */}
      {proposal && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2.5 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="font-black text-xs text-amber-900 dark:text-amber-200">
                {isEn ? 'Suggested Area from your location:' : 'اقتراح النظام بناءً على موقعك:'}
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300">
              {proposal.confidence === 'high'
                ? isEn
                  ? 'High Accuracy'
                  : 'دقة عالية'
                : isEn
                ? 'Approximate'
                : 'تقريبي'}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-amber-500/20 text-xs font-extrabold text-slate-800 dark:text-slate-100 flex items-center justify-between">
            <span>
              {proposal.governorateNameAr} &larr; {proposal.cityNameAr} &larr; {proposal.areaNameAr}
            </span>
          </div>

          <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
            {isEn
              ? 'Is this your residential area? You can confirm or adjust manually.'
              : 'هل هذه هي منطقة سكنك؟ يمكنك تأكيدها أو تعديلها يدويًا قبل الحفظ.'}
          </p>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={handleAdjustProposal}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 cursor-pointer flex items-center gap-1"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isEn ? 'Adjust Manually' : 'تعديل واختيار يدوي'}</span>
            </button>
            <button
              type="button"
              onClick={handleConfirmProposal}
              className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isEn ? 'Confirm Residence' : 'تأكيد منطقة السكن'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Gentle Notice / Rejection / Timeout banner */}
      {locationNotice && (
        <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
          <span>{locationNotice}</span>
        </div>
      )}

      {/* Cascading Searchable Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {/* 1. Governorate */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
            {isEn ? 'Governorate' : 'المحافظة'}
          </label>
          <div className="relative">
            <select
              value={governorateId}
              onChange={handleGovernorateChange}
              disabled={disabled}
              className="w-full h-10 px-3 pe-8 rounded-xl bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-slate-100 focus:border-sky-500 outline-none appearance-none cursor-pointer transition-all disabled:opacity-50"
            >
              <option value="">{isEn ? '-- Select Governorate --' : '-- اختر المحافظة --'}</option>
              {EGYPT_GOVERNORATES.map((g) => (
                <option key={g.id} value={g.id}>
                  {isEn ? g.nameEn : g.nameAr}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 absolute end-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* 2. City / Center */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
            {isEn ? 'City / Markaz' : 'المدينة أو المركز'}
          </label>
          <div className="relative">
            <select
              value={cityId}
              onChange={handleCityChange}
              disabled={disabled || !governorateId}
              className="w-full h-10 px-3 pe-8 rounded-xl bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-slate-100 focus:border-sky-500 outline-none appearance-none cursor-pointer transition-all disabled:opacity-50"
            >
              <option value="">
                {!governorateId
                  ? isEn
                    ? '-- Select Governorate first --'
                    : '-- اختر المحافظة أولاً --'
                  : isEn
                  ? '-- Select City/Markaz --'
                  : '-- اختر المدينة أو المركز --'}
              </option>
              {availableCities.map((c) => (
                <option key={c.id} value={c.id}>
                  {isEn ? c.nameEn : c.nameAr}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 absolute end-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* 3. District / Neighborhood */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
            {isEn ? 'District / Neighborhood' : 'الحي أو المنطقة'}
          </label>
          <div className="relative">
            <select
              value={areaId}
              onChange={handleAreaChange}
              disabled={disabled || !cityId}
              className="w-full h-10 px-3 pe-8 rounded-xl bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-slate-100 focus:border-sky-500 outline-none appearance-none cursor-pointer transition-all disabled:opacity-50"
            >
              <option value="">
                {!cityId
                  ? isEn
                    ? '-- Select City first --'
                    : '-- اختر المدينة أولاً --'
                  : isEn
                  ? '-- Select District --'
                  : '-- اختر الحي أو المنطقة --'}
              </option>
              {availableAreas.map((a) => (
                <option key={a.id} value={a.id}>
                  {isEn ? a.nameEn : a.nameAr}
                </option>
              ))}
              {cityId && (
                <option value={CUSTOM_AREA_ID}>
                  {isEn ? '✏️ Other / Not listed...' : '✏️ أخرى / غير موجودة بالقائمة...'}
                </option>
              )}
            </select>
            <ChevronDown className="w-4 h-4 absolute end-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Fallback Custom Area Input */}
      {areaId === CUSTOM_AREA_ID && (
        <div className="p-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1.5 animate-in fade-in duration-200">
          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200">
            {isEn
              ? 'Enter your area/neighborhood name:'
              : 'اكتب اسم الحي أو المنطقة السكنية:'}
          </label>
          <input
            type="text"
            value={customAreaName}
            onChange={handleCustomAreaNameChange}
            disabled={disabled}
            placeholder={
              isEn
                ? 'e.g. Ezbet El Nakhl, Al Qurein, etc.'
                : 'مثال: عزبة النخل، منشية البكري، حي الزهور...'
            }
            className="w-full h-9 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-slate-100 focus:border-sky-500 outline-none"
          />
          <p className="text-[10px] text-slate-500 dark:text-slate-400">
            {isEn
              ? 'This area will be saved and reviewed without fabricating fake coordinates on the map.'
              : 'سيتم حفظ هذه المنطقة لمراجعتها وتضمينها بالتحليلات دون اختراع موقع غير دقيق على الخريطة.'}
          </p>
        </div>
      )}

      {/* Status indicator when an area is selected */}
      {governorateId && (
        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
          <div className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-emerald-500" />
            <span>
              {source === 'location_suggested'
                ? isEn
                  ? 'Confirmed from suggested location'
                  : 'تم التأكيد بناءً على اقتراح الموقع'
                : source === 'staff_override'
                ? isEn
                  ? 'Updated by clinic staff'
                  : 'مسجلة بواسطة موظف العيادة'
                : isEn
                ? 'Manually selected'
                : 'اختيار يدوي'}
            </span>
          </div>

          <button
            type="button"
            onClick={handleClearAll}
            disabled={disabled}
            className="text-[10px] text-rose-500 hover:underline cursor-pointer"
          >
            {isEn ? 'Clear' : 'مسح التحديد'}
          </button>
        </div>
      )}
    </div>
  )
}
