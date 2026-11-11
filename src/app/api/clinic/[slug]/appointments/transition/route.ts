import { NextRequest, NextResponse } from 'next/server'
import { getCurrentClinicStaff } from '@/lib/server/clinic-staff-access'
import {
  readDocument, queryDocumentsByFields, commitDocumentPatches,
} from '@/lib/server/firebase-rest'
import { createServerNotification } from '@/lib/server/clinic-notifications'
import { dispatchPatientPushNotification } from '@/lib/pushDispatcher'
import { getCairoDateString } from '@/lib/bookingCapacity'
import { sameOriginMutation } from '@/lib/server/push-access'

export const dynamic = 'force-dynamic'
type Action = 'start' | 'complete' | 'skip' | 'recall' | 'requeue' | 'no_show'

const inClinic = (a: Record<string, any>, clinicId: string) =>
  (a.clinic_id || a.clinicId) === clinicId
const branch = (a: Record<string, any>) => String(a.branch_id || a.branchId || '')
const queueNumber = (a: Record<string, any>) => Number(a.queue_number || a.queueNumber || 0)
const stamp = () => new Date().toISOString()

async function sendCalledPatient(clinicId: string, slug: string, appt: Record<string, any>, calledAt: string) {
  const eventId = `turn_ready_${appt.id}_${calledAt}`
  const tasks = [
    createServerNotification({
      clinicId, branchId: branch(appt), recipientType: 'patient',
      recipientTarget: String(appt.phone || appt.patientPhone || ''),
      type: 'turn_ready', title: 'حان دورك الآن للدخول!',
      body: `رقم دورك #${queueNumber(appt)}. يرجى التوجه لغرفة الكشف.`,
      appointmentId: String(appt.id), eventId,
    }),
    dispatchPatientPushNotification({
      clinicId, appointmentId: String(appt.id), type: 'turn_ready',
      title: 'حان دورك الآن للدخول!',
      body: `رقم دورك #${queueNumber(appt)}. يرجى التوجه لغرفة الكشف.`,
      url: `/clinic/${slug}/track/${appt.id}`,
      eventId, urgency: 'high', ttl: 600,
    }),
  ]
  await Promise.allSettled(tasks)
}

async function alertWaitingPatients(
  clinicId: string, slug: string, entries: Record<string, any>[], currentId: string,
) {
  const waiting = entries.filter(a => a.status === 'waiting' && a.id !== currentId)
    .sort((a,b) => queueNumber(a)-queueNumber(b))
  const batches: Promise<unknown>[] = []
  for (let i = 0; i < waiting.length && i < 5; i++) {
    const appt = waiting[i]
    const ahead = i + 1 // Includes current person in examination.
    const eventId = `approaching_${appt.id}_${ahead}`
    batches.push(createServerNotification({
      clinicId, branchId: branch(appt), recipientType: 'patient',
      recipientTarget: String(appt.phone || appt.patientPhone || ''),
      title: ahead === 1 ? 'أنت المريض التالي للدخول!' : `اقترب دورك: متبقي ${ahead}`,
      body: `متبقي أمامك ${ahead} في الانتظار، يرجى الاستعداد.`,
      type: 'approaching_turn', eventId, appointmentId: String(appt.id),
    }))
    batches.push(dispatchPatientPushNotification({
      clinicId, appointmentId: String(appt.id), type: 'approaching_turn',
      title: ahead === 1 ? 'أنت المريض التالي للدخول!' : `اقترب دورك: متبقي ${ahead}`,
      body: 'يرجى مراجعة صفحة متابعة الدور والاستعداد للحضور.',
      url: `/clinic/${slug}/track/${appt.id}`,
      eventId, ttl: 300,
    }))
  }
  const results = await Promise.allSettled(batches)
  for (const result of results) {
    if (result.status === 'rejected') {
      console.warn('[queue-transition] Notification delivery failed:',
        result.reason instanceof Error ? result.reason.message : 'UNKNOWN')
    }
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    if (!sameOriginMutation(req)) {
      return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 })
    }
    const { slug } = await params
    const staff = await getCurrentClinicStaff(req, slug)
    if (!staff) return NextResponse.json({ error: 'STAFF_SESSION_REQUIRED' }, { status: 401 })
    const data = await req.json().catch(() => ({}))
    const id = String(data.appointmentId || '')
    const action = String(data.action || '') as Action
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(id) ||
        !(['start','complete','skip','recall','requeue','no_show'] as string[]).includes(action)) {
      return NextResponse.json({ error: 'INVALID_QUEUE_TRANSITION' }, { status: 400 })
    }
    const appt = await readDocument(`appointments/${id}`)
    if (!appt || !inClinic(appt, staff.clinicId)) {
      return NextResponse.json({ error: 'APPOINTMENT_NOT_IN_CLINIC' }, { status: 404 })
    }
    const now = stamp()
    const today = getCairoDateString()
    if (!appt.date || String(appt.date) !== today) {
      return NextResponse.json({ error: 'QUEUE_TRANSITION_REQUIRES_TODAY' }, { status: 409 })
    }
    const records = await queryDocumentsByFields('appointments', {
      clinic_id: staff.clinicId, date: today,
    }, 250)
    const sameBranch = records.filter(a => branch(a) === branch(appt)) as Record<string, any>[]
    if (!sameBranch.some(a => a.id === id)) {
      return NextResponse.json({ error: 'APPOINTMENT_QUEUE_UNAVAILABLE' }, { status: 409 })
    }
    if (staff.user.role === 'assistant' && staff.user.branchId &&
        staff.user.branchId !== branch(appt)) {
      return NextResponse.json({ error: 'BRANCH_ACCESS_DENIED' }, { status: 403 })
    }
    const patches: Array<{path:string; data:Record<string,unknown>}> = []
    let called: Record<string, any> | null = null
    let calledTime = ''
    if (action === 'start') {
      if (!['waiting','skipped','no_show','in_progress','examining'].includes(String(appt.status || 'waiting'))) {
        return NextResponse.json({ error: 'PATIENT_NOT_AVAILABLE_FOR_CALL' }, { status: 409 })
      }
      for (const prev of sameBranch.filter(a => a.id !== id &&
          ['in_progress','examining'].includes(String(a.status)))) {
        patches.push({ path: `appointments/${prev.id}`,
          data: { status: 'completed', completedAt: now,
            ...(prev.startedAt ? {durationMinutes: Math.max(1, Math.round((Date.now()-Date.parse(String(prev.startedAt)))/60000))}: {}) } })
      }
      patches.push({ path: `appointments/${id}`, data: {
        status:'in_progress', startedAt: appt.startedAt || now, calledAt: now,
        arrivedAt: appt.arrivedAt || now, paymentStatus: 'paid',
      } })
      called = appt; calledTime = now
    } else if (action === 'skip') {
      patches.push({ path: `appointments/${id}`,
        data: { status: 'skipped', skippedAt: now, priorityNext:false } })
      const next = sameBranch.filter(a => a.id !== id && a.status === 'waiting')
        .sort((a,b) => queueNumber(a)-queueNumber(b))[0]
      if (next) {
        patches.push({ path: `appointments/${next.id}`, data: {
          status:'in_progress', startedAt:now, calledAt:now, arrivedAt:next.arrivedAt || now,
          paymentStatus:'paid', priorityNext:false,
        }})
        called = next; calledTime = now
      }
    } else if (action === 'complete') {
      if (!['in_progress','examining'].includes(String(appt.status))) {
        return NextResponse.json({ error: 'PATIENT_NOT_IN_EXAM' }, { status: 409 })
      }
      const durationMinutes = appt.startedAt
        ? Math.max(1, Math.round((Date.now()-Date.parse(String(appt.startedAt)))/60000)) : null
      patches.push({ path: `appointments/${id}`, data: {
        status: 'completed', completedAt: now, ...(durationMinutes ? { durationMinutes } : {}),
      }})
    } else if (action === 'recall') {
      if (!['in_progress','examining'].includes(String(appt.status))) {
        return NextResponse.json({ error: 'PATIENT_NOT_CALLED' }, { status: 409 })
      }
      patches.push({ path: `appointments/${id}`, data: { calledAt: now } })
      called = appt; calledTime = now
    } else if (action === 'requeue') {
      patches.push({ path: `appointments/${id}`, data: {
        status: 'waiting', priorityNext: true, requeuedAt:now,
      }})
    } else {
      patches.push({ path: `appointments/${id}`, data: { status:'no_show', noShowAt:now } })
    }
    await commitDocumentPatches(patches)

    // Booking state has already committed: delivery errors never undo a visit.
    // The client may display a non-blocking delivery warning separately.
    if (called && String(called.phone || called.patientPhone || '')) {
      await sendCalledPatient(staff.clinicId, slug, called, calledTime)
      const pending = sameBranch.filter(a => a.id !== called!.id && a.status === 'waiting')
      await alertWaitingPatients(staff.clinicId, slug, pending, called.id)
    }
    return NextResponse.json({
      success: true, action, updatedIds: patches.map(p => p.path.split('/').pop()),
      calledId: called?.id || null,
    }, { headers: {'Cache-Control':'no-store'} })
  } catch (error) {
    console.error('[queue-transition] Failed:', error instanceof Error ? error.message : 'UNKNOWN')
    return NextResponse.json({ error:'QUEUE_TRANSITION_FAILED' }, { status:503 })
  }
}
