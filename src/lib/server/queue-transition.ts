import 'server-only'
import {
  readDocument,
  queryDocumentsByFields,
  commitDocumentPatches,
} from '@/lib/server/firebase-rest'
import { createServerNotification } from '@/lib/server/clinic-notifications'
import {
  buildPushTag,
  dispatchPatientPushNotification,
  getApproachingEventId,
  getTurnReadyEventId,
} from '@/lib/pushDispatcher'
import { getCairoDateString } from '@/lib/bookingCapacity'
import { sortQueue } from '@/lib/queueCalculations'
import { computeQueueWatermark, QueueWatermark } from '@/lib/queueSync'
import { scheduleBackgroundTask, WaitUntilFn } from '@/lib/server/background-task'

export type QueueTransitionAction =
  | 'start'
  | 'complete'
  | 'skip'
  | 'recall'
  | 'requeue'
  | 'no_show'

export interface QueueTransitionStaff {
  clinicId: string
  user: {
    role?: string
    branchId?: string | null
  }
}

export interface QueueTransitionDeps {
  readDocument: typeof readDocument
  queryDocumentsByFields: typeof queryDocumentsByFields
  commitDocumentPatches: typeof commitDocumentPatches
  createServerNotification: typeof createServerNotification
  dispatchPatientPushNotification: typeof dispatchPatientPushNotification
  scheduleBackgroundTask: typeof scheduleBackgroundTask
  waitUntil?: WaitUntilFn | null
  now?: () => number
  getToday?: () => string
}

const defaultDeps: QueueTransitionDeps = {
  readDocument,
  queryDocumentsByFields,
  commitDocumentPatches,
  createServerNotification,
  dispatchPatientPushNotification,
  scheduleBackgroundTask,
  now: () => Date.now(),
  getToday: getCairoDateString,
}

const inClinic = (a: Record<string, any>, clinicId: string) =>
  (a.clinic_id || a.clinicId) === clinicId
const branch = (a: Record<string, any>) => String(a.branch_id || a.branchId || '')
const queueNumber = (a: Record<string, any>) => Number(a.queue_number || a.queueNumber || 0)

async function sendCalledPatient(
  clinicId: string,
  slug: string,
  appt: Record<string, any>,
  calledAction: 'start' | 'skip' | 'recall',
  calledAt: string,
  deps: QueueTransitionDeps,
) {
  const eventId = getTurnReadyEventId(appt, calledAction, calledAt)
  const tagSalt =
    calledAction === 'recall'
      ? calledAt.replace(/[^0-9]/g, '').slice(-8)
      : String(appt.requeuedAt || appt.skippedAt || appt.noShowAt || '0')
  const recipientPhone = String(appt.phone || appt.patientPhone || '').trim()
  const tasks: Promise<unknown>[] = [
    deps.dispatchPatientPushNotification({
      clinicId,
      appointmentId: String(appt.id),
      type: 'turn_ready',
      title: 'حان دورك الآن للدخول!',
      body: `رقم دورك #${queueNumber(appt)}. يرجى التوجه لغرفة الكشف.`,
      url: `/clinic/${slug}/track/${appt.id}`,
      tag: buildPushTag('turn_ready', String(appt.id), tagSalt),
      eventId,
      urgency: 'high',
      ttl: 600,
    }),
  ]
  if (recipientPhone) {
    tasks.push(
      deps.createServerNotification({
        clinicId,
        branchId: branch(appt),
        recipientType: 'patient',
        recipientTarget: recipientPhone,
        type: 'turn_ready',
        title: 'حان دورك الآن للدخول!',
        body: `رقم دورك #${queueNumber(appt)}. يرجى التوجه لغرفة الكشف.`,
        appointmentId: String(appt.id),
        eventId,
      }),
    )
  }
  await Promise.allSettled(tasks)
}

async function alertWaitingPatients(
  clinicId: string,
  slug: string,
  entries: Record<string, any>[],
  currentId: string,
  clinic: Record<string, any> | null,
  deps: QueueTransitionDeps,
) {
  const waiting = sortQueue(entries.filter((a) => a.id !== currentId), clinic)
  const batches: Promise<unknown>[] = []
  for (let i = 0; i < waiting.length && i < 5; i++) {
    const appt = waiting[i]
    const ahead = i + 1 // Includes current person in examination.
    const eventId = getApproachingEventId(appt, ahead)
    const recipientPhone = String(appt.phone || appt.patientPhone || '').trim()
    if (recipientPhone) {
      batches.push(
        deps.createServerNotification({
          clinicId,
          branchId: branch(appt),
          recipientType: 'patient',
          recipientTarget: recipientPhone,
          title: ahead === 1 ? 'أنت المريض التالي للدخول!' : `اقترب دورك: متبقي ${ahead}`,
          body: `متبقي أمامك ${ahead} في الانتظار، يرجى الاستعداد.`,
          type: 'approaching_turn',
          eventId,
          appointmentId: String(appt.id),
        }),
      )
    }
    batches.push(
      deps.dispatchPatientPushNotification({
        clinicId,
        appointmentId: String(appt.id),
        type: 'approaching_turn',
        title: ahead === 1 ? 'أنت المريض التالي للدخول!' : `اقترب دورك: متبقي ${ahead}`,
        body: 'يرجى مراجعة صفحة متابعة الدور والاستعداد للحضور.',
        url: `/clinic/${slug}/track/${appt.id}`,
        tag: buildPushTag('approaching_turn', String(appt.id), String(ahead)),
        eventId,
        urgency: 'high',
        ttl: 300,
      }),
    )
  }
  const results = await Promise.allSettled(batches)
  for (const result of results) {
    if (result.status === 'rejected') {
      console.warn(
        '[queue-transition] Notification delivery failed:',
        result.reason instanceof Error ? result.reason.message : 'UNKNOWN',
      )
    }
  }
}

export type QueueTransitionResponse =
  | {
      ok: true
      status: 200
      body: {
        success: true
        action: QueueTransitionAction
        date: string
        serverTime: string
        updatedIds: string[]
        calledId: string | null
        updatedAppointments: Record<string, any>[]
        appointments: Record<string, any>[]
        queueWatermark: QueueWatermark
      }
    }
  | {
      ok: false
      status: 400 | 403 | 404 | 409 | 503
      error: string
    }

/**
 * Commit a clinic queue transition atomically, return the authoritative updated queue immediately,
 * and schedule patient Web Push + notification writes in the background without blocking UI updates.
 */
export async function executeQueueTransition(
  {
    slug,
    staff,
    appointmentId,
    action,
  }: {
    slug: string
    staff: QueueTransitionStaff
    appointmentId: string
    action: QueueTransitionAction
  },
  customDeps: Partial<QueueTransitionDeps> = {},
): Promise<QueueTransitionResponse> {
  const deps: QueueTransitionDeps = { ...defaultDeps, ...customDeps }
  const id = String(appointmentId || '')
  if (
    !/^[A-Za-z0-9_-]{1,128}$/.test(id) ||
    !(['start', 'complete', 'skip', 'recall', 'requeue', 'no_show'] as string[]).includes(action)
  ) {
    return { ok: false, status: 400, error: 'INVALID_QUEUE_TRANSITION' }
  }

  const nowMs = deps.now ? deps.now() : Date.now()
  const now = new Date(nowMs).toISOString()
  const today = deps.getToday ? deps.getToday() : getCairoDateString()

  // Load appointment, today's clinic queue, and clinic doc in one parallel batch.
  const [appt, records, clinicDoc] = await Promise.all([
    deps.readDocument(`appointments/${id}`),
    deps.queryDocumentsByFields(
      'appointments',
      { clinic_id: staff.clinicId, date: today },
      500,
    ),
    deps.readDocument(`clinics/${staff.clinicId}`).catch(() => null),
  ])

  if (!appt || !inClinic(appt, staff.clinicId)) {
    return { ok: false, status: 404, error: 'APPOINTMENT_NOT_IN_CLINIC' }
  }
  if (!appt.date || String(appt.date) !== today) {
    return { ok: false, status: 409, error: 'QUEUE_TRANSITION_REQUIRES_TODAY' }
  }

  const sameBranch = (records as Record<string, any>[]).filter(
    (a) => branch(a) === branch(appt),
  )
  if (!sameBranch.some((a) => a.id === id)) {
    return { ok: false, status: 409, error: 'APPOINTMENT_QUEUE_UNAVAILABLE' }
  }
  if (
    staff.user.role === 'assistant' &&
    staff.user.branchId &&
    staff.user.branchId !== branch(appt)
  ) {
    return { ok: false, status: 403, error: 'BRANCH_ACCESS_DENIED' }
  }

  const currentStatus = String(appt.status || 'waiting')
  const patches: Array<{ path: string; data: Record<string, unknown> }> = []
  let called: Record<string, any> | null = null
  let calledTime = ''
  let calledAction: 'start' | 'skip' | 'recall' = 'start'

  if (action === 'start') {
    if (!['waiting', 'skipped', 'no_show', 'in_progress', 'examining'].includes(currentStatus)) {
      return { ok: false, status: 409, error: 'PATIENT_NOT_AVAILABLE_FOR_CALL' }
    }
    for (const prev of sameBranch.filter(
      (a) => a.id !== id && ['in_progress', 'examining'].includes(String(a.status)),
    )) {
      patches.push({
        path: `appointments/${prev.id}`,
        data: {
          status: 'completed',
          completedAt: now,
          updatedAt: now,
          ...(prev.startedAt
            ? {
                durationMinutes: Math.max(
                  1,
                  Math.round((nowMs - Date.parse(String(prev.startedAt))) / 60000),
                ),
              }
            : {}),
        },
      })
    }
    patches.push({
      path: `appointments/${id}`,
      data: {
        status: 'in_progress',
        startedAt: appt.startedAt || now,
        calledAt: now,
        arrivedAt: appt.arrivedAt || now,
        paymentStatus: 'paid',
        updatedAt: now,
      },
    })
    called = { ...appt, id }
    calledTime = now
    calledAction = 'start'
  } else if (action === 'skip') {
    if (['completed', 'cancelled'].includes(currentStatus)) {
      return { ok: false, status: 409, error: 'PATIENT_ALREADY_FINISHED' }
    }
    patches.push({
      path: `appointments/${id}`,
      data: { status: 'skipped', skippedAt: now, priorityNext: false, updatedAt: now },
    })
    const next = sortQueue(sameBranch.filter((a) => a.id !== id), clinicDoc)[0]
    if (next) {
      patches.push({
        path: `appointments/${next.id}`,
        data: {
          status: 'in_progress',
          startedAt: next.startedAt || now,
          calledAt: now,
          arrivedAt: next.arrivedAt || now,
          paymentStatus: 'paid',
          priorityNext: false,
          updatedAt: now,
        },
      })
      called = next
      calledTime = now
      calledAction = 'skip'
    }
  } else if (action === 'complete') {
    if (!['in_progress', 'examining'].includes(currentStatus)) {
      return { ok: false, status: 409, error: 'PATIENT_NOT_IN_EXAM' }
    }
    const durationMinutes = appt.startedAt
      ? Math.max(1, Math.round((nowMs - Date.parse(String(appt.startedAt))) / 60000))
      : null
    patches.push({
      path: `appointments/${id}`,
      data: {
        status: 'completed',
        completedAt: now,
        updatedAt: now,
        ...(durationMinutes ? { durationMinutes } : {}),
      },
    })
  } else if (action === 'recall') {
    if (!['in_progress', 'examining'].includes(currentStatus)) {
      return { ok: false, status: 409, error: 'PATIENT_NOT_CALLED' }
    }
    patches.push({
      path: `appointments/${id}`,
      data: { calledAt: now, updatedAt: now },
    })
    called = { ...appt, id }
    calledTime = now
    calledAction = 'recall'
  } else if (action === 'requeue') {
    if (!['skipped', 'no_show', 'waiting'].includes(currentStatus)) {
      return { ok: false, status: 409, error: 'PATIENT_CANNOT_BE_REQUEUED' }
    }
    patches.push({
      path: `appointments/${id}`,
      data: {
        status: 'waiting',
        priorityNext: true,
        requeuedAt: now,
        updatedAt: now,
      },
    })
  } else {
    if (['completed', 'cancelled'].includes(currentStatus)) {
      return { ok: false, status: 409, error: 'PATIENT_ALREADY_FINISHED' }
    }
    patches.push({
      path: `appointments/${id}`,
      data: { status: 'no_show', noShowAt: now, priorityNext: false, updatedAt: now },
    })
  }

  await deps.commitDocumentPatches(patches)

  // Materialize committed state locally in memory so the API responds immediately
  // without waiting for external FCM/Push gateways or a second Firestore query.
  const patchById = new Map<string, Record<string, unknown>>()
  for (const patch of patches) {
    const docId = patch.path.split('/').pop()
    if (docId) patchById.set(docId, patch.data)
  }

  const updatedAppointments: Record<string, any>[] = []
  const mergedRecords = (records as Record<string, any>[]).map((record) => {
    const patch = patchById.get(String(record.id))
    if (!patch) return record
    const updated = { ...record, ...patch }
    updatedAppointments.push(updated)
    return updated
  })

  const permitted = mergedRecords.filter(
    (a) =>
      inClinic(a, staff.clinicId) &&
      a.date === today &&
      (staff.user.role !== 'assistant' ||
        !staff.user.branchId ||
        branch(a) === staff.user.branchId),
  )

  const queueWatermark = computeQueueWatermark(permitted, now, now)

  if (called) {
    const pending = sameBranch.filter(
      (a) => a.id !== called!.id && (a.status === 'waiting' || !a.status),
    )
    const calledSnapshot = called
    deps.scheduleBackgroundTask(
      () =>
        Promise.allSettled([
          sendCalledPatient(staff.clinicId, slug, calledSnapshot, calledAction, calledTime, deps),
          alertWaitingPatients(staff.clinicId, slug, pending, String(calledSnapshot.id), clinicDoc, deps),
        ]),
      'queue-transition-notify',
      deps.waitUntil,
    )
  }

  return {
    ok: true,
    status: 200,
    body: {
      success: true,
      action,
      date: today,
      serverTime: now,
      updatedIds: Array.from(patchById.keys()),
      calledId: called ? String(called.id) : null,
      updatedAppointments,
      appointments: permitted,
      queueWatermark,
    },
  }
}
