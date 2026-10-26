'use client'

import React, { use, useState, useEffect, useMemo, useRef } from 'react'
import {
  BarChart3, RefreshCw, AlertCircle, Calendar,
  Building2, Users, FileSpreadsheet, Printer, ShieldCheck
} from 'lucide-react'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore'
import { toast } from 'sonner'
import { useLanguage } from '@/context/LanguageContext'
import { ClinicLoading } from '@/components/clinic/ClinicLoading'
import {
  DateRange,
  PeriodComparison,
  getCairoDateString,
  getPresetDateRange,
  computePreviousPeriod,
  calculateDelta,
  computeAgeDistribution,
  normalizeArea,
  normalizeDiagnosis,
  computeAttendanceMetrics,
  computeTimingMetrics,
  computePeakTimesHeatmap,
  computeDataCompleteness,
  EGYPT_AREAS_COORDINATES
} from '@/lib/analyticsService'
import { AnalyticsFiltersBar } from '@/components/clinic/analytics/AnalyticsFiltersBar'
import { AnalyticsKpiCards } from '@/components/clinic/analytics/AnalyticsKpiCards'
import { AgeDistributionCard } from '@/components/clinic/analytics/AgeDistributionCard'
import { GeographicDistributionCard, AreaDataPoint } from '@/components/clinic/analytics/GeographicDistributionCard'
import { PaymentAnalyticsCard, PaymentMethodItem } from '@/components/clinic/analytics/PaymentAnalyticsCard'
import { DiagnosisTrendsCard } from '@/components/clinic/analytics/DiagnosisTrendsCard'
import { NewVsReturningCard } from '@/components/clinic/analytics/NewVsReturningCard'
import { AttendanceNoShowCard } from '@/components/clinic/analytics/AttendanceNoShowCard'
import { PeakTimesHeatmapCard } from '@/components/clinic/analytics/PeakTimesHeatmapCard'
import { WaitingDurationCard } from '@/components/clinic/analytics/WaitingDurationCard'
import { ServicesPerformanceCard, ServicePerformanceItem } from '@/components/clinic/analytics/ServicesPerformanceCard'
import { FinancialAnalysisCard, FinancialAnalysisData } from '@/components/clinic/analytics/FinancialAnalysisCard'
import { BranchComparisonCard, BranchComparisonItem } from '@/components/clinic/analytics/BranchComparisonCard'
import { DataCompletenessCard } from '@/components/clinic/analytics/DataCompletenessCard'
import { exportAnalyticsToExcel, printAnalyticsReport } from '@/lib/analyticsExportHelper'

export default function AnalyticsPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug
  const { t, language, isRtl, dir } = useLanguage()

  // State: Clinic & Permissions
  const [clinic, setClinic] = useState<any>(null)
  const [branches, setBranches] = useState<any[]>([])
  const [role, setRole] = useState<string>('doctor')
  const [assistantPermissions, setAssistantPermissions] = useState<string[]>([])
  const [lockedBranchId, setLockedBranchId] = useState<string | null>(null)
  const [isLoadingClinic, setIsLoadingClinic] = useState(true)

  // Filters State
  const [datePreset, setDatePreset] = useState<'today' | 'week' | 'month' | 'year' | 'custom'>('month')
  const [dateRange, setDateRange] = useState<DateRange>(() => getPresetDateRange('month'))
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all')
  const [selectedServiceId, setSelectedServiceId] = useState<string>('all')
  const [comparePrevious, setComparePrevious] = useState(true)

  // Data Loading State
  const [rawAppointments, setRawAppointments] = useState<any[]>([])
  const [rawPrescriptions, setRawPrescriptions] = useState<any[]>([])
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<string>('')
  const [heatmapMode, setHeatmapMode] = useState<'booked' | 'actual'>('booked')

  // Load User Role & Locked Branch from session
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedRole = localStorage.getItem('clinic_role') || 'doctor'
      setRole(storedRole)
      const locked = localStorage.getItem('clinic_locked_branch')
      if (storedRole === 'assistant' && locked) {
        setLockedBranchId(locked)
        setSelectedBranchId(locked)
      } else {
        const savedBranch = localStorage.getItem('clinic_selected_branch') || 'all'
        setSelectedBranchId(savedBranch)
      }

      const handleBranchChanged = (e: any) => {
        const bId = e.detail?.branchId || 'all'
        setSelectedBranchId(bId)
      }
      window.addEventListener('clinic_branch_changed', handleBranchChanged)
      return () => window.removeEventListener('clinic_branch_changed', handleBranchChanged)
    }
  }, [])

  // Preset Date Range Changer
  const handleSetPreset = (preset: 'today' | 'week' | 'month' | 'year' | 'custom') => {
    setDatePreset(preset)
    if (preset !== 'custom') {
      setDateRange(getPresetDateRange(preset))
    }
  }

  // Previous Period
  const comparison: PeriodComparison = useMemo(() => {
    return {
      currentPeriod: dateRange,
      previousPeriod: computePreviousPeriod(dateRange)
    }
  }, [dateRange])

  // Can user view finance?
  const canViewFinance = useMemo(() => {
    if (role === 'doctor' || role === 'owner') return true
    return assistantPermissions.includes('finance') || assistantPermissions.includes('accounts')
  }, [role, assistantPermissions])

  // 1. Fetch Clinic Profile & Branches
  useEffect(() => {
    const fetchClinic = async () => {
      try {
        const q = query(collection(db, 'clinics'), where('slug', '==', slug))
        const snap = await getDocs(q)
        if (!snap.empty) {
          const cData = { id: snap.docs[0].id, ...(snap.docs[0].data() as any) }
          setClinic(cData)
          setAssistantPermissions(cData.assistantPermissions || ['appointments'])

          // Fetch branches from branches collection
          const bQ = query(
            collection(db, 'branches'),
            where('clinicId', '==', cData.id)
          )
          const bSnap = await getDocs(bQ)
          const bList = bSnap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((b: any) => !b.isArchived)

          if (bList.length > 0) {
            setBranches(bList)
          } else if (Array.isArray(cData.branches) && cData.branches.length > 0) {
            setBranches(cData.branches.filter((b: any) => !b.isArchived))
          } else {
            setBranches([
              {
                id: 'main',
                name: cData.branchName || 'الفرع الرئيسي',
                isMain: true
              }
            ])
          }
        }
      } catch (err) {
        console.error('Error fetching clinic for analytics:', err)
      } finally {
        setIsLoadingClinic(false)
      }
    }
    fetchClinic()
  }, [slug])

  // 2. Real-time Subscription to Appointments & Prescriptions for this Clinic
  useEffect(() => {
    if (!clinic?.id) return

    setIsLoadingData(true)
    let unsubAppts: () => void = () => {}
    let unsubRx: () => void = () => {}

    try {
      const apptsQ = query(
        collection(db, 'appointments'),
        where('clinic_id', '==', clinic.id)
      )
      unsubAppts = onSnapshot(
        apptsQ,
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
          setRawAppointments(list)
          setIsLoadingData(false)
          setLastUpdated(
            new Intl.DateTimeFormat('ar-EG', {
              hour: 'numeric',
              minute: 'numeric',
              second: 'numeric',
              hour12: true,
              timeZone: 'Africa/Cairo'
            }).format(new Date())
          )
        },
        (err) => {
          console.error('Appointments snapshot error:', err)
          setIsLoadingData(false)
          toast.error('حدث خطأ أثناء تحميل بيانات المواعيد')
        }
      )

      const rxQ = query(
        collection(db, 'prescriptions'),
        where('clinic_id', '==', clinic.id)
      )
      unsubRx = onSnapshot(rxQ, (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
        setRawPrescriptions(list)
      })
    } catch (e) {
      console.error(e)
      setIsLoadingData(false)
    }

    return () => {
      unsubAppts()
      unsubRx()
    }
  }, [clinic?.id])

  // ==========================================================================
  // DATA FILTERING & ENGINE CALCULATIONS
  // ==========================================================================

  // Filter appointments for Current & Previous Periods
  const { currentPeriodAppts, previousPeriodAppts } = useMemo(() => {
    const isApptInBranch = (a: any) => {
      if (lockedBranchId) {
        const b = a.branch_id || a.branchId
        return b === lockedBranchId
      }
      if (!selectedBranchId || selectedBranchId === 'all') return true
      const b = a.branch_id || a.branchId
      if (b) return b === selectedBranchId
      return selectedBranchId === 'main'
    }

    const isApptInService = (a: any) => {
      if (!selectedServiceId || selectedServiceId === 'all') return true
      return a.serviceId === selectedServiceId || a.serviceName === selectedServiceId
    }

    const current: any[] = []
    const previous: any[] = []

    for (const a of rawAppointments) {
      if (!isApptInBranch(a)) continue
      if (!isApptInService(a)) continue

      const itemDate = a.date || (a.createdAt ? a.createdAt.split('T')[0] : '')
      if (!itemDate) continue

      if (itemDate >= dateRange.from && itemDate <= dateRange.to) {
        current.push(a)
      } else if (itemDate >= comparison.previousPeriod.from && itemDate <= comparison.previousPeriod.to) {
        previous.push(a)
      }
    }

    return { currentPeriodAppts: current, previousPeriodAppts: previous }
  }, [rawAppointments, dateRange, comparison.previousPeriod, selectedBranchId, selectedServiceId, lockedBranchId])

  // Completed Visits in Current Period
  const completedVisits = useMemo(() => {
    return currentPeriodAppts.filter((a) => a.status === 'completed')
  }, [currentPeriodAppts])

  const prevCompletedVisits = useMemo(() => {
    return previousPeriodAppts.filter((a) => a.status === 'completed')
  }, [previousPeriodAppts])

  // Deduplicated Unique Patients in Current Period
  const uniquePatientsList = useMemo(() => {
    // Group all current period visits by patient
    // Supports multiple family members sharing the same phone number (patientId or phone + name)
    const map = new Map<
      string,
      {
        id: string
        name: string
        phone: string
        age?: any
        dob?: string | null
        address?: string
        city?: string
        firstVisitDate: string
        firstCompletedVisit?: any
        residence?: any
      }
    >()

    // Sort visits by date ascending
    const sorted = [...currentPeriodAppts].sort((a, b) => {
      const dA = a.date || a.createdAt || ''
      const dB = b.date || b.createdAt || ''
      return dA.localeCompare(dB)
    })

    for (const a of sorted) {
      const patientKey =
        a.patientId ||
        (a.phone
          ? `${a.phone}__${(a.patientName || '').trim().toLowerCase()}`
          : a.id)
      if (!patientKey) continue

      if (!map.has(patientKey)) {
        map.set(patientKey, {
          id: patientKey,
          name: a.patientName || 'المريض',
          phone: a.phone || '',
          age: a.age || null,
          dob: a.dob || null,
          address: a.address || a.area || a.patientResidenceSnapshot?.areaNameAr || '',
          city: a.city || a.governorate || a.patientResidenceSnapshot?.cityNameAr || '',
          firstVisitDate: a.date || (a.createdAt ? a.createdAt.split('T')[0] : getCairoDateString()),
          firstCompletedVisit: a.status === 'completed' ? a : undefined,
          residence: a.patientResidenceSnapshot || a.residence || (a.address || a.city ? { address: a.address, city: a.city } : null)
        })
      } else {
        const existing = map.get(patientKey)!
        // If first completed visit is not yet recorded and this visit is completed, prioritize its historical snapshot
        if (!existing.firstCompletedVisit && a.status === 'completed') {
          existing.firstCompletedVisit = a
          if (a.patientResidenceSnapshot || a.residence) {
            existing.residence = a.patientResidenceSnapshot || a.residence
          }
        }
      }
    }

    return Array.from(map.values())
  }, [currentPeriodAppts])

  const prevUniquePatientsCount = useMemo(() => {
    const set = new Set<string>()
    for (const a of previousPeriodAppts) {
      const patientKey =
        a.patientId ||
        (a.phone
          ? `${a.phone}__${(a.patientName || '').trim().toLowerCase()}`
          : a.id)
      if (patientKey) set.add(patientKey)
    }
    return set.size
  }, [previousPeriodAppts])

  // 1. Age Distribution Analysis
  const ageAnalysis = useMemo(() => {
    return computeAgeDistribution(uniquePatientsList)
  }, [uniquePatientsList])

  // 2. Geographic Distribution Analysis
  const { geographicData, unrecordedAreaCount, unrecordedAreaPercentage, unmappedAreaCount } = useMemo(() => {
    const areaMap = new Map<string, AreaDataPoint>()
    let unrecorded = 0
    let unmapped = 0

    // Initialize map with known geocoded areas from authoritative dataset
    for (const reg of EGYPT_AREAS_COORDINATES) {
      areaMap.set(reg.id, {
        id: reg.id,
        nameAr: reg.nameAr,
        nameEn: reg.nameEn,
        governorateAr: reg.governorateAr,
        patientCount: 0,
        percentage: 0,
        isMapped: true,
        coords: { lat: reg.lat, lng: reg.lng }
      })
    }

    for (const p of uniquePatientsList) {
      // Use residence from first completed visit in period, falling back to profile residence
      const res = p.residence
      const normalized = normalizeArea(res)

      if (normalized.normalizedId === 'unrecorded') {
        unrecorded++
        continue
      }

      if (normalized.normalizedId === 'unmapped' || normalized.normalizedId === 'unmapped_custom') {
        unmapped++
        continue
      }

      const existing = areaMap.get(normalized.normalizedId)
      if (existing) {
        existing.patientCount++
      } else {
        unmapped++
      }
    }

    const totalMappedPatients = uniquePatientsList.length
    const list = Array.from(areaMap.values())
      .filter((a) => a.patientCount > 0)
      .map((a) => ({
        ...a,
        percentage: totalMappedPatients > 0 ? Math.round((a.patientCount / totalMappedPatients) * 1000) / 10 : 0
      }))
      .sort((a, b) => b.patientCount - a.patientCount)

    return {
      geographicData: list,
      unrecordedAreaCount: unrecorded,
      unrecordedAreaPercentage: totalMappedPatients > 0 ? Math.round((unrecorded / totalMappedPatients) * 1000) / 10 : 0,
      unmappedAreaCount: unmapped
    }
  }, [uniquePatientsList])

  // 3. Payment Methods & Financial Audit
  const { paymentMethods, financialSummary, totalConfirmedAmount, totalConfirmedCount } = useMemo(() => {
    const methodsConfig = [
      { id: 'cash', nameAr: 'كاش (نقدي بالعيادة)', nameEn: 'Cash', color: '#10B981' },
      { id: 'instapay', nameAr: 'انستاباي (InstaPay)', nameEn: 'InstaPay', color: '#087CF4' },
      { id: 'wallet', nameAr: 'محافظ إلكترونية (فودافون كاش)', nameEn: 'E-Wallet', color: '#8B5CF6' },
      { id: 'other', nameAr: 'وسائل أخرى / بنكية', nameEn: 'Other', color: '#F59E0B' }
    ]

    const agg: Record<string, {
      confirmedCount: number
      confirmedAmount: number
      pendingCount: number
      pendingAmount: number
      refundedCount: number
      refundedAmount: number
      patientsSet: Set<string>
    }> = {
      cash: { confirmedCount: 0, confirmedAmount: 0, pendingCount: 0, pendingAmount: 0, refundedCount: 0, refundedAmount: 0, patientsSet: new Set() },
      instapay: { confirmedCount: 0, confirmedAmount: 0, pendingCount: 0, pendingAmount: 0, refundedCount: 0, refundedAmount: 0, patientsSet: new Set() },
      wallet: { confirmedCount: 0, confirmedAmount: 0, pendingCount: 0, pendingAmount: 0, refundedCount: 0, refundedAmount: 0, patientsSet: new Set() },
      other: { confirmedCount: 0, confirmedAmount: 0, pendingCount: 0, pendingAmount: 0, refundedCount: 0, refundedAmount: 0, patientsSet: new Set() }
    }

    let totalConf = 0
    let totalConfCount = 0
    let totalPending = 0
    let totalPendingCount = 0
    let totalRef = 0
    let totalRefCount = 0
    let uncollected = 0

    for (const a of currentPeriodAppts) {
      if (a.status === 'cancelled') continue

      const rawMethod = (a.paymentMethod || 'cash').toLowerCase()
      const methodKey = rawMethod.includes('insta') ? 'instapay' : rawMethod.includes('wallet') ? 'wallet' : rawMethod.includes('cash') ? 'cash' : 'other'
      const price = Number(a.servicePrice) || 0
      const pId = a.phone || a.id

      if (a.paymentStatus === 'paid' || a.status === 'completed') {
        agg[methodKey].confirmedCount++
        agg[methodKey].confirmedAmount += price
        totalConf += price
        totalConfCount++
        if (pId) agg[methodKey].patientsSet.add(pId)
      } else if (a.paymentStatus === 'refunded') {
        agg[methodKey].refundedCount++
        agg[methodKey].refundedAmount += price
        totalRef += price
        totalRefCount++
      } else if (a.paymentStatus === 'pending_verification') {
        agg[methodKey].pendingCount++
        agg[methodKey].pendingAmount += price
        totalPending += price
        totalPendingCount++
      } else {
        // Unpaid
        uncollected += price
      }
    }

    const totalPatients = Math.max(1, uniquePatientsList.length)
    const items: PaymentMethodItem[] = methodsConfig.map((m) => {
      const data = agg[m.id]
      return {
        id: m.id,
        nameAr: m.nameAr,
        nameEn: m.nameEn,
        color: m.color,
        confirmedCount: data.confirmedCount,
        confirmedAmount: data.confirmedAmount,
        uniquePatientsCount: data.patientsSet.size,
        uniquePatientsPercentage: Math.round((data.patientsSet.size / totalPatients) * 1000) / 10,
        pendingCount: data.pendingCount,
        pendingAmount: data.pendingAmount,
        refundedCount: data.refundedCount,
        refundedAmount: data.refundedAmount
      }
    })

    const net = totalConf - totalRef
    const recordedExp = Number(clinic?.monthlyExpenses || 0)

    const finData: FinancialAnalysisData = {
      confirmedCollections: totalConf,
      uncollectedDue: uncollected,
      refunds: totalRef,
      recordedExpenses: recordedExp,
      netCollections: net,
      operatingSurplus: net - recordedExp
    }

    return {
      paymentMethods: items,
      financialSummary: finData,
      totalConfirmedAmount: totalConf,
      totalConfirmedCount: totalConfCount
    }
  }, [currentPeriodAppts, uniquePatientsList, clinic?.monthlyExpenses])

  // Previous Period Financials
  const prevNetCollections = useMemo(() => {
    let conf = 0
    let ref = 0
    for (const a of previousPeriodAppts) {
      if (a.status === 'cancelled') continue
      const price = Number(a.servicePrice) || 0
      if (a.paymentStatus === 'paid' || a.status === 'completed') {
        conf += price
      } else if (a.paymentStatus === 'refunded') {
        ref += price
      }
    }
    return conf - ref
  }, [previousPeriodAppts])

  // 4. Diagnosis Trends
  const { diagnosesList, confirmedDiagCount, unclassifiedDiagCount } = useMemo(() => {
    const diagMap = new Map<string, { name: string; key: string; patientSet: Set<string>; isUnclassified: boolean }>()
    let confCount = 0
    let unclassCount = 0

    // Combine diagnoses from completed visits and issued prescriptions
    for (const a of completedVisits) {
      const rawDiag = a.diagnosis || (a.drugs && a.drugs.length > 0 ? 'استشارة علاجية' : null)
      const normalized = normalizeDiagnosis(rawDiag)
      const pId = a.phone || a.id

      if (normalized.isUnclassified) {
        unclassCount++
      } else {
        confCount++
      }

      if (!diagMap.has(normalized.key)) {
        diagMap.set(normalized.key, {
          name: normalized.name,
          key: normalized.key,
          patientSet: new Set(),
          isUnclassified: normalized.isUnclassified
        })
      }
      if (pId) diagMap.get(normalized.key)!.patientSet.add(pId)
    }

    const totalVisitsCount = Math.max(1, completedVisits.length)
    const list = Array.from(diagMap.values())
      .map((d) => ({
        name: d.name,
        normalizedKey: d.key,
        patientCount: d.patientSet.size,
        percentage: Math.round((d.patientSet.size / totalVisitsCount) * 1000) / 10,
        isConfirmed: !d.isUnclassified,
        isUnclassified: d.isUnclassified
      }))
      .sort((a, b) => b.patientCount - a.patientCount)

    return { diagnosesList: list, confirmedDiagCount: confCount, unclassifiedDiagCount: unclassCount }
  }, [completedVisits])

  // 5. New vs. Returning Patients
  const { newPatientsCount, newPatientsPercentage, returningPatientsCount, returningPatientsPercentage } = useMemo(() => {
    let newCount = 0
    let retCount = 0

    const periodStart = dateRange.from

    for (const p of uniquePatientsList) {
      // Check if patient had any completed visit prior to periodStart across ALL appointments
      const hadPriorVisit = rawAppointments.some((a) => {
        const pKey = a.phone || a.patientId || a.id
        if (pKey !== p.id) return false
        if (a.status !== 'completed') return false
        const vDate = a.date || (a.createdAt ? a.createdAt.split('T')[0] : '')
        return vDate && vDate < periodStart
      })

      if (hadPriorVisit) {
        retCount++
      } else {
        newCount++
      }
    }

    const total = Math.max(1, uniquePatientsList.length)
    return {
      newPatientsCount: newCount,
      newPatientsPercentage: Math.round((newCount / total) * 1000) / 10,
      returningPatientsCount: retCount,
      returningPatientsPercentage: Math.round((retCount / total) * 1000) / 10
    }
  }, [uniquePatientsList, rawAppointments, dateRange.from])

  // 6. Attendance Metrics
  const attendanceMetrics = useMemo(() => {
    return computeAttendanceMetrics(currentPeriodAppts)
  }, [currentPeriodAppts])

  const prevAttendanceMetrics = useMemo(() => {
    return computeAttendanceMetrics(previousPeriodAppts)
  }, [previousPeriodAppts])

  // 7. Timing Metrics (Waiting & Consultation)
  const timingMetrics = useMemo(() => {
    return computeTimingMetrics(completedVisits)
  }, [completedVisits])

  // 8. Peak Times Heatmap
  const { cells: heatmapCells, maxDensity: heatmapMaxDensity, peakCell: heatmapPeakCell } = useMemo(() => {
    return computePeakTimesHeatmap(currentPeriodAppts, heatmapMode)
  }, [currentPeriodAppts, heatmapMode])

  // 9. Services Performance
  const servicesPerformance = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number; rev: number; patientSet: Set<string>; isArchived: boolean }>()

    for (const a of completedVisits) {
      const sId = a.serviceId || a.serviceName || 'كشف'
      const sName = a.serviceName || 'كشف عادي'
      const price = Number(a.servicePrice) || 0
      const pId = a.phone || a.id

      if (!map.has(sId)) {
        map.set(sId, {
          id: sId,
          name: sName,
          count: 0,
          rev: 0,
          patientSet: new Set(),
          isArchived: false
        })
      }
      const entry = map.get(sId)!
      entry.count++
      entry.rev += price
      if (pId) entry.patientSet.add(pId)
    }

    return Array.from(map.values()).map((s) => ({
      id: s.id,
      name: s.name,
      completedVisitsCount: s.count,
      uniquePatientsCount: s.patientSet.size,
      totalRevenue: s.rev,
      averagePrice: s.count > 0 ? s.rev / s.count : 0,
      isArchived: s.isArchived
    }))
  }, [completedVisits])

  // 10. Multi-Branch Comparison
  const branchComparison = useMemo(() => {
    if (branches.length <= 1) return []

    return branches.map((b) => {
      const branchAppts = currentPeriodAppts.filter((a) => {
        const bId = a.branch_id || a.branchId
        if (bId) return bId === b.id
        return b.isMain
      })

      const completed = branchAppts.filter((a) => a.status === 'completed')
      const pSet = new Set(branchAppts.map((a) => a.phone || a.id).filter(Boolean))
      let coll = 0
      for (const a of completed) {
        coll += Number(a.servicePrice) || 0
      }
      const timing = computeTimingMetrics(completed)
      const att = computeAttendanceMetrics(branchAppts)

      return {
        branchId: b.id,
        branchName: b.name,
        isMain: !!b.isMain,
        completedVisits: completed.length,
        uniquePatients: pSet.size,
        confirmedCollections: coll,
        avgWaitMins: timing.meanWaitingMinutes,
        attendanceRate: att.attendanceRate
      }
    })
  }, [branches, currentPeriodAppts])

  // 11. Data Completeness Report
  const completenessReport = useMemo(() => {
    return computeDataCompleteness(uniquePatientsList, completedVisits)
  }, [uniquePatientsList, completedVisits])

  // Incomplete items for review dialog
  const incompletePatients = useMemo(() => {
    return uniquePatientsList
      .filter((p) => {
        const missing: string[] = []
        if (!p.dob && (p.age === undefined || p.age === null || String(p.age).trim() === '')) {
          missing.push('العمر')
        }
        if (!p.city && !p.address) {
          missing.push('المنطقة السكنية')
        }
        return missing.length > 0
      })
      .map((p) => {
        const missing: string[] = []
        if (!p.dob && (p.age === undefined || p.age === null || String(p.age).trim() === '')) {
          missing.push('العمر')
        }
        if (!p.city && !p.address) {
          missing.push('المنطقة السكنية')
        }
        return {
          id: p.id,
          name: p.name,
          phone: p.phone,
          missingFields: missing
        }
      })
  }, [uniquePatientsList])

  const incompleteVisits = useMemo(() => {
    return completedVisits
      .filter((v) => {
        const missing: string[] = []
        if (!v.diagnosis || v.diagnosis.trim().length <= 1) {
          missing.push('التشخيص الطبي')
        }
        if (!v.startedAt || !v.completedAt) {
          missing.push('توقيتات الكشف')
        }
        return missing.length > 0
      })
      .map((v) => {
        const missing: string[] = []
        if (!v.diagnosis || v.diagnosis.trim().length <= 1) {
          missing.push('التشخيص الطبي')
        }
        if (!v.startedAt || !v.completedAt) {
          missing.push('توقيتات الكشف')
        }
        return {
          id: v.id,
          patientName: v.patientName || 'المريض',
          date: v.date || '',
          missingFields: missing
        }
      })
  }, [completedVisits])

  // Metric Deltas
  const uniquePatientsDelta = useMemo(() => {
    return comparePrevious ? calculateDelta(uniquePatientsList.length, prevUniquePatientsCount) : null
  }, [comparePrevious, uniquePatientsList.length, prevUniquePatientsCount])

  const completedVisitsDelta = useMemo(() => {
    return comparePrevious ? calculateDelta(completedVisits.length, prevCompletedVisits.length) : null
  }, [comparePrevious, completedVisits.length, prevCompletedVisits.length])

  const attendanceRateDelta = useMemo(() => {
    return comparePrevious ? calculateDelta(attendanceMetrics.attendanceRate, prevAttendanceMetrics.attendanceRate) : null
  }, [comparePrevious, attendanceMetrics.attendanceRate, prevAttendanceMetrics.attendanceRate])

  const netCollectionsDelta = useMemo(() => {
    return comparePrevious ? calculateDelta(financialSummary.netCollections, prevNetCollections) : null
  }, [comparePrevious, financialSummary.netCollections, prevNetCollections])

  // ==========================================================================
  // EXPORT HANDLERS
  // ==========================================================================

  const getExportPayload = () => {
    const activeBranchName =
      selectedBranchId === 'all'
        ? 'جميع الفروع'
        : branches.find((b) => b.id === selectedBranchId)?.name || 'الفرع المحدد'

    return {
      clinic,
      branchName: activeBranchName,
      dateRange,
      comparisonRange: comparePrevious ? comparison.previousPeriod : null,
      exportTime: new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' }),
      kpis: {
        uniquePatients: uniquePatientsList.length,
        completedVisits: completedVisits.length,
        attendanceRate: attendanceMetrics.attendanceRate,
        netCollections: financialSummary.netCollections,
        meanWaitMins: timingMetrics.meanWaitingMinutes,
        meanConsultMins: timingMetrics.meanConsultationMinutes,
        completenessScore: completenessReport.overallPercentage
      },
      ageAnalysis,
      geographicData,
      unrecordedAreaCount,
      paymentMethods,
      financialSummary,
      diagnoses: diagnosesList,
      services: servicesPerformance,
      attendanceMetrics,
      timingMetrics,
      canViewFinance
    }
  }

  const handleExportExcel = async () => {
    try {
      toast.info('جاري إعداد مصنف الإكسيل المعتمد للتحليلات...')
      await exportAnalyticsToExcel(getExportPayload())
      toast.success('تم تصدير ملف الإكسيل بنجاح!')
    } catch (err: any) {
      console.error(err)
      toast.error('حدث خطأ أثناء تصدير الإكسيل: ' + err.message)
    }
  }

  const handleExportPdf = () => {
    try {
      printAnalyticsReport(getExportPayload())
    } catch (err: any) {
      console.error(err)
      toast.error('حدث خطأ أثناء تحضير الطباعة: ' + err.message)
    }
  }

  // Loading Screen
  if (isLoadingClinic) {
    return <ClinicLoading fullScreen size="lg" label="جاري تحميل نظام التحليلات والإحصائيات..." />
  }

  return (
    <div className="space-y-6 pb-16 max-w-7xl mx-auto" dir={dir}>
      {/* 1. Page Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-black mb-1.5">
            <BarChart3 className="w-3.5 h-3.5" />
            <span>ClinicOS Analytics & Intelligence</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
            التحليلات والإحصائيات الطبية والتشغيلية
          </h1>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">
            مؤشرات أداء متكاملة تدعم اتخاذ القرارات السريرية، الإدارية، والمالية الدقيقة
          </p>
        </div>
      </div>

      {/* 2. Unified Filters Bar */}
      <AnalyticsFiltersBar
        datePreset={datePreset}
        setDatePreset={handleSetPreset}
        dateRange={dateRange}
        setDateRange={setDateRange}
        branches={branches}
        selectedBranchId={selectedBranchId}
        setSelectedBranchId={setSelectedBranchId}
        services={clinic?.services || []}
        selectedServiceId={selectedServiceId}
        setSelectedServiceId={setSelectedServiceId}
        comparePrevious={comparePrevious}
        setComparePrevious={setComparePrevious}
        comparison={comparison}
        isLoading={isLoadingData}
        onRefresh={() => {
          setIsLoadingData(true)
          setTimeout(() => setIsLoadingData(false), 400)
        }}
        onExportExcel={handleExportExcel}
        onExportPdf={handleExportPdf}
        lastUpdatedText={`آخر تحديث: ${lastUpdated || 'الآن'}`}
        isRtl={isRtl}
        language={language}
      />

      {/* 3. Top Core KPI Cards */}
      <AnalyticsKpiCards
        uniquePatients={uniquePatientsList.length}
        uniquePatientsDelta={uniquePatientsDelta}
        completedVisits={completedVisits.length}
        completedVisitsDelta={completedVisitsDelta}
        attendanceRate={attendanceMetrics.attendanceRate}
        attendanceRateDelta={attendanceRateDelta}
        netCollections={financialSummary.netCollections}
        netCollectionsDelta={netCollectionsDelta}
        avgWaitMins={timingMetrics.meanWaitingMinutes}
        avgConsultMins={timingMetrics.meanConsultationMinutes}
        validTimingCount={timingMetrics.validConsultationCount}
        completenessScore={completenessReport.overallPercentage}
        canViewFinance={canViewFinance}
        onOpenCompletenessModal={() => {}}
        isRtl={isRtl}
        language={language}
      />

      {/* 4. Geographic Distribution (Interactive Vector Map & Ranked Areas List) */}
      <GeographicDistributionCard
        areaData={geographicData}
        unrecordedCount={unrecordedAreaCount}
        unrecordedPercentage={unrecordedAreaPercentage}
        unmappedCount={unmappedAreaCount}
        totalPatients={uniquePatientsList.length}
        onOpenMissingLocationsModal={() => {}}
        isRtl={isRtl}
        language={language}
      />

      {/* 5. Age Distribution & Diagnosis Trends Grid (2 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Age Distribution Card */}
        <AgeDistributionCard
          ageAnalysis={ageAnalysis}
          totalPatients={uniquePatientsList.length}
          isRtl={isRtl}
          language={language}
        />

        {/* Diagnosis Trends Card */}
        <DiagnosisTrendsCard
          diagnoses={diagnosesList}
          totalClinicalVisits={completedVisits.length}
          confirmedCount={confirmedDiagCount}
          unclassifiedCount={unclassifiedDiagCount}
          isRtl={isRtl}
          language={language}
        />
      </div>

      {/* 6. Payment Methods & Financial Analysis Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Payment Analytics Card */}
        <PaymentAnalyticsCard
          methods={paymentMethods}
          totalConfirmedAmount={totalConfirmedAmount}
          totalConfirmedCount={totalConfirmedCount}
          totalPendingAmount={financialSummary.uncollectedDue}
          totalPendingCount={0}
          totalRefundedAmount={financialSummary.refunds}
          totalRefundedCount={0}
          netCollectionAmount={financialSummary.netCollections}
          totalPatientsCount={uniquePatientsList.length}
          canViewFinance={canViewFinance}
          isRtl={isRtl}
          language={language}
        />

        {/* Financial Analysis Card */}
        <FinancialAnalysisCard
          data={financialSummary}
          canViewFinance={canViewFinance}
          isRtl={isRtl}
          language={language}
        />
      </div>

      {/* 7. New vs. Returning Patients & Attendance/No-Show Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* New vs Returning Patients */}
        <NewVsReturningCard
          newPatientsCount={newPatientsCount}
          newPatientsPercentage={newPatientsPercentage}
          returningPatientsCount={returningPatientsCount}
          returningPatientsPercentage={returningPatientsPercentage}
          totalPatients={uniquePatientsList.length}
          isRtl={isRtl}
          language={language}
        />

        {/* Attendance, Cancellation & No-Show */}
        <AttendanceNoShowCard
          metrics={attendanceMetrics}
          isRtl={isRtl}
          language={language}
        />
      </div>

      {/* 8. Peak Times Heatmap */}
      <PeakTimesHeatmapCard
        cells={heatmapCells}
        maxDensity={heatmapMaxDensity}
        peakCell={heatmapPeakCell}
        mode={heatmapMode}
        setMode={setHeatmapMode}
        isRtl={isRtl}
        language={language}
      />

      {/* 9. Waiting & Consultation Duration */}
      <WaitingDurationCard
        metrics={timingMetrics}
        serviceBreakdown={servicesPerformance.map((s) => ({
          serviceName: s.name,
          meanWaitMins: timingMetrics.meanWaitingMinutes,
          meanConsultMins: timingMetrics.meanConsultationMinutes,
          visitsCount: s.completedVisitsCount
        }))}
        isRtl={isRtl}
        language={language}
      />

      {/* 10. Services Performance */}
      <ServicesPerformanceCard
        services={servicesPerformance}
        totalRevenue={financialSummary.confirmedCollections}
        isRtl={isRtl}
        language={language}
      />

      {/* 11. Multi-Branch Comparison (Renders only if clinic has >= 2 branches) */}
      <BranchComparisonCard
        branches={branchComparison}
        canViewFinance={canViewFinance}
        isRtl={isRtl}
        language={language}
      />

      {/* 12. Data Completeness & Quality Audit Card */}
      <DataCompletenessCard
        report={completenessReport}
        incompletePatients={incompletePatients}
        incompleteVisits={incompleteVisits}
        slug={slug}
        isRtl={isRtl}
        language={language}
      />
    </div>
  )
}
