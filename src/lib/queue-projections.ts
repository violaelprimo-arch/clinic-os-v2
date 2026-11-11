import {
  calculatePatientLivePosition,
  sortQueue,
} from './queueCalculations'
import { computeQueueWatermark, type QueueWatermark } from './queueSync'

export type QueueProjectionRole = 'staff' | 'tv' | 'patient'

export interface PublicClinicSummary {
  id: string
  slug?: string
  name?: string
  clinicName?: string
  doctorName?: string
  specialty?: string
  logoUrl?: string
  primaryColor?: string
  secondaryColor?: string
  averageVisitTime?: number
  workDays?: unknown
  bookingSchedule?: unknown
  services?: unknown
  branches?: unknown
  queueRules?: unknown
}

export function sanitizeClinicPublicSummary(
  clinic: Record<string, any> | null | undefined,
  clinicId: string,
): PublicClinicSummary | null {
  if (!clinic) return null
  return {
    id: clinicId || String(clinic.id || ''),
    slug: typeof clinic.slug === 'string' ? clinic.slug : undefined,
    name: clinic.clinicName || clinic.name,
    clinicName: clinic.clinicName || clinic.name,
    doctorName: clinic.doctorName,
    specialty: clinic.specialty,
    logoUrl: clinic.logoUrl,
    primaryColor: clinic.primaryColor,
    secondaryColor: clinic.secondaryColor,
    averageVisitTime: typeof clinic.averageVisitTime === 'number' ? clinic.averageVisitTime : undefined,
    workDays: clinic.workDays,
    bookingSchedule: clinic.bookingSchedule,
    services: clinic.services,
    branches: clinic.branches,
    queueRules: clinic.queueRules,
  }
}

export function filterAppointmentsForBranch<T extends Record<string, any>>(
  appointments: T[],
  branchId?: string | null,
): T[] {
  if (!branchId) return appointments
  return appointments.filter(
    (a) =>
      a.branch_id === branchId ||
      a.branchId === branchId ||
      a.branchName === branchId,
  )
}

function buildTvClinicFields(
  clinic: Record<string, any> | null | undefined,
  clinicId: string,
) {
  if (!clinic) return null
  return {
    id: clinicId,
    name: clinic.clinicName || clinic.name,
    doctorName: clinic.doctorName,
    specialty: clinic.specialty,
    logoUrl: clinic.logoUrl,
    primaryColor: clinic.primaryColor,
    secondaryColor: clinic.secondaryColor,
  }
}

export function buildStaffQueuePayload(params: {
  clinicId: string
  date: string
  branchId?: string | null
  appointments: Array<Record<string, any>>
  serverTime: string
  queueWatermark?: QueueWatermark
  revision?: number
  notificationsChanged?: boolean
}) {
  const filtered = filterAppointmentsForBranch(params.appointments, params.branchId)
  const queueWatermark =
    params.queueWatermark || computeQueueWatermark(filtered, params.serverTime)
  return {
    role: 'staff' as const,
    clinicId: params.clinicId,
    date: params.date,
    branchId: params.branchId || null,
    serverTime: params.serverTime,
    queueWatermark,
    revision: params.revision ?? 1,
    ...(params.notificationsChanged ? { notificationsChanged: true } : {}),
    appointments: filtered,
  }
}

export function buildTvQueuePayload(params: {
  clinicId: string
  clinic: Record<string, any> | null | undefined
  date: string
  branchId?: string | null
  appointments: Array<Record<string, any>>
  serverTime: string
  queueWatermark?: QueueWatermark
  revision?: number
}) {
  const dayAppts = params.appointments.filter((a) => !a.date || a.date === params.date)
  const branchAppts = filterAppointmentsForBranch(dayAppts, params.branchId)
  const inProgressAppt = branchAppts.find(
    (a) => a.status === 'in_progress' || a.status === 'examining',
  )
  const waitingAppts = sortQueue(branchAppts, params.clinic || undefined)
  const queueWatermark =
    params.queueWatermark || computeQueueWatermark(branchAppts, params.serverTime)

  const currentTurn =
    (inProgressAppt?.queue_number ?? inProgressAppt?.queueNumber) ||
    ((waitingAppts[0]?.queue_number ?? waitingAppts[0]?.queueNumber) ?? 1)
  const aheadCount = waitingAppts.length
  const avgMins = Number(params.clinic?.averageVisitTime) || 15

  return {
    role: 'tv' as const,
    clinicId: params.clinicId,
    date: params.date,
    branchId: params.branchId || null,
    serverTime: params.serverTime,
    queueWatermark,
    revision: params.revision ?? 1,
    currentTurn,
    aheadCount,
    waitMinutes: aheadCount * avgMins,
    totalWaiting: waitingAppts.length,
    isExamining: Boolean(inProgressAppt),
    clinic: buildTvClinicFields(params.clinic, params.clinicId),
    tvQueue: {
      totalWaitingCount: waitingAppts.length,
      currentPatient: inProgressAppt
        ? {
            id: String(inProgressAppt.id),
            queueNumber: inProgressAppt.queue_number ?? inProgressAppt.queueNumber,
            patientName: inProgressAppt.patientName,
            status: inProgressAppt.status,
            calledAt: inProgressAppt.calledAt,
            startedAt: inProgressAppt.startedAt,
            branchId: inProgressAppt.branch_id || inProgressAppt.branchId || null,
            branchName: inProgressAppt.branchName || '',
            serviceId: inProgressAppt.serviceId || '',
            serviceName: inProgressAppt.serviceName || 'كشف طبي',
          }
        : null,
      nextWaitingPatients: waitingAppts.slice(0, 10).map((a) => ({
        id: String(a.id),
        queueNumber: a.queue_number ?? a.queueNumber,
        patientName: a.patientName,
        status: a.status || 'waiting',
        branchId: a.branch_id || a.branchId || null,
        branchName: a.branchName || '',
        serviceId: a.serviceId || '',
        serviceName: a.serviceName || 'كشف طبي',
        priorityNext: Boolean(a.priorityNext),
        isUrgent: Boolean(a.isUrgent),
        createdAt: a.createdAt || null,
        requeuedAt: a.requeuedAt || null,
      })),
    },
    currentPatientExamining: inProgressAppt
      ? {
          queueNumber: inProgressAppt.queue_number ?? inProgressAppt.queueNumber,
          label: `مريض دور #${inProgressAppt.queue_number ?? inProgressAppt.queueNumber}`,
        }
      : null,
  }
}

export function sanitizePatientAppointmentRecord(
  appt: Record<string, any>,
  queueInfo: unknown,
  todayStr: string,
) {
  const apptDate = appt.date || todayStr
  const isToday = apptDate === todayStr
  const isFuture = apptDate > todayStr
  const isPast = apptDate < todayStr

  return {
    id: String(appt.id),
    clinic_id: appt.clinic_id || appt.clinicId,
    branch_id: appt.branch_id || appt.branchId || null,
    branchId: appt.branch_id || appt.branchId || null,
    branchName: appt.branchName || 'الفرع الرئيسي',
    queue_number: appt.queue_number ?? appt.queueNumber,
    queueNumber: appt.queue_number ?? appt.queueNumber,
    calledAt: appt.calledAt,
    startedAt: appt.startedAt,
    completedAt: appt.completedAt,
    skippedAt: appt.skippedAt,
    requeuedAt: appt.requeuedAt,
    noShowAt: appt.noShowAt,
    patientName: appt.patientName,
    phone: appt.phone || appt.patientPhone,
    serviceId: appt.serviceId,
    serviceName: appt.serviceName || 'كشف',
    servicePrice: appt.servicePrice,
    durationMinutes: appt.durationMinutes,
    date: appt.date,
    time: appt.time || 'حسب الدور',
    status: appt.status || 'waiting',
    paymentStatus: appt.paymentStatus || 'unpaid',
    priorityNext: Boolean(appt.priorityNext),
    isUrgent: Boolean(appt.isUrgent),
    isToday,
    isFuture,
    isPast,
    queueInfo,
  }
}

export function buildPatientTrackPayload(params: {
  clinicId: string
  clinic: Record<string, any> | null | undefined
  todayStr: string
  branchId?: string | null
  targetAppointmentId: string
  targetAppointment: Record<string, any> | null | undefined
  appointments: Array<Record<string, any>>
  serverTime: string
  queueWatermark?: QueueWatermark
  revision?: number
  notificationsChanged?: boolean
}) {
  const appt =
    params.targetAppointment ||
    params.appointments.find((a) => String(a.id) === params.targetAppointmentId) ||
    null

  const effectiveBranchId =
    params.branchId || appt?.branch_id || appt?.branchId || null
  const branchTodayAppts = filterAppointmentsForBranch(
    params.appointments.filter((a) => !a.date || a.date === params.todayStr),
    effectiveBranchId,
  )
  const inProgressAppt = branchTodayAppts.find(
    (a) => a.status === 'in_progress' || a.status === 'examining',
  )
  const waitingAppts = sortQueue(branchTodayAppts, params.clinic || undefined)

  let queueInfo: any = null
  let sanitizedAppointment: Record<string, any> | null = null

  if (appt) {
    const apptDate = appt.date || params.todayStr
    const isToday = apptDate === params.todayStr
    const isFuture = apptDate > params.todayStr

    if (isToday) {
      queueInfo = calculatePatientLivePosition({
        targetAppointmentId: String(appt.id),
        targetAppointment: appt,
        allTodayAppointments: branchTodayAppts,
        clinic: params.clinic || undefined,
      })
    } else if (isFuture) {
      queueInfo = calculatePatientLivePosition({
        targetAppointmentId: String(appt.id),
        targetAppointment: appt,
        allTodayAppointments: [],
        clinic: params.clinic || undefined,
        bookingDateStr: apptDate,
      })
    } else {
      queueInfo = {
        status: appt.status === 'completed' ? 'completed' : 'past',
        statusLabel:
          appt.status === 'completed' ? 'تم الكشف الطبي بنجاح' : 'حجز سابق',
        isCurrentTurn: false,
        isNextInLine: false,
        aheadCount: 0,
        effectivePosition: 0,
        estimatedWaitMins: 0,
        formattedWaitTime: 'منتهي',
        isPast: true,
      }
    }

    sanitizedAppointment = sanitizePatientAppointmentRecord(
      appt,
      queueInfo,
      params.todayStr,
    )
  }

  const queueWatermark =
    params.queueWatermark ||
    computeQueueWatermark(
      appt ? [...branchTodayAppts, appt] : branchTodayAppts,
      params.serverTime,
    )

  const currentTurn =
    (inProgressAppt?.queue_number ?? inProgressAppt?.queueNumber) ||
    ((waitingAppts[0]?.queue_number ?? waitingAppts[0]?.queueNumber) ?? 1)
  const aheadCount = queueInfo?.aheadCount ?? waitingAppts.length
  const waitMinutes = queueInfo?.estimatedWaitMins ?? aheadCount * 15

  return {
    role: 'patient' as const,
    clinicId: params.clinicId,
    date: params.todayStr,
    branchId: effectiveBranchId,
    appointmentId: params.targetAppointmentId,
    serverTime: params.serverTime,
    queueWatermark,
    revision: params.revision ?? 1,
    ...(params.notificationsChanged ? { notificationsChanged: true } : {}),
    currentTurn,
    aheadCount,
    waitMinutes,
    totalWaiting: waitingAppts.length,
    isExamining: Boolean(inProgressAppt),
    clinic: buildTvClinicFields(params.clinic, params.clinicId),
    currentPatientExamining: inProgressAppt
      ? {
          queueNumber: inProgressAppt.queue_number ?? inProgressAppt.queueNumber,
          label: `مريض دور #${inProgressAppt.queue_number ?? inProgressAppt.queueNumber}`,
        }
      : null,
    patientQueueInfo: queueInfo,
    patientAppointment: sanitizedAppointment,
  }
}
