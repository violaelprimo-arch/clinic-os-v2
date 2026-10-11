/**
 * Queue Alerts Reconciler
 * Automatically dispatches the "FIVE_PATIENTS_AHEAD" WhatsApp notification
 * strictly without any human click by doctor or assistant.
 * Enforces strict idempotency per appointment.
 */

import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { sortWaitingQueue, calculateWaitTime, QueuePatient } from '@/lib/queue-calculator'
import { sendWhatsAppNotification } from '@/lib/whatsapp'

export async function checkAndSendFiveAheadAlerts(
  clinicId: string,
  clinicSlug: string,
  clinicName: string,
  mapsLink: string = '',
  regularPerUrgent: number = 2,
  urgentPerRegular: number = 1
): Promise<{ triggeredCount: number }> {
  try {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Cairo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date())

    const q = query(
      collection(db, 'appointments'),
      where('clinic_id', '==', clinicId),
      where('date', '==', today)
    )

    const snap = await getDocs(q)
    if (snap.empty) return { triggeredCount: 0 }

    const allAppts = snap.docs.map(d => ({ id: d.id, ...d.data() } as any))

    const currentPatient = allAppts.find(a => a.status === 'in_progress') || null
    const waitingPatients = allAppts.filter(a => a.status === 'waiting')

    if (waitingPatients.length === 0) return { triggeredCount: 0 }

    // Order waiting patients using clinic priority & interleaving algorithm
    const orderedWaiting = sortWaitingQueue(waitingPatients, regularPerUrgent, urgentPerRegular)

    let triggeredCount = 0

    // Evaluate each waiting patient's position
    for (let index = 0; index < orderedWaiting.length; index++) {
      const patient = orderedWaiting[index]
      const peopleAhead = index

      // Trigger condition: 5 or fewer patients ahead, has phone, and has not yet received the 5-ahead alert
      if (peopleAhead <= 5 && !patient.fivePatientsAlertSent && patient.status === 'waiting' && patient.phone) {
        const idempotencyKey = `5_ahead_${patient.id}`

        // Calculate entrance estimate
        const estimate = calculateWaitTime(patient.id, orderedWaiting, currentPatient)

        // Optimistically mark as sent in Firestore to prevent concurrent duplicate dispatch
        await updateDoc(doc(db, 'appointments', patient.id), {
          fivePatientsAlertSent: true,
          fivePatientsAlertSentAt: new Date().toISOString()
        })

        // Dispatch WhatsApp notification
        try {
          const origin = typeof window !== 'undefined' ? window.location.origin : ''
          await sendWhatsAppNotification({
            to: patient.phone,
            type: 'FIVE_PATIENTS_AHEAD',
            appointmentId: patient.id,
            patientName: patient.patientName || 'المريض',
            clinicName: clinicName || 'العيادة',
            clinicId,
            idempotencyKey,
            data: {
              remainingCount: peopleAhead,
              estimatedTime: estimate.estimatedEntranceTime,
              mapsUrl: mapsLink || '',
              trackUrl: `${origin}/clinic/${clinicSlug}/track/${patient.id}`
            }
          })
          triggeredCount++
        } catch (dispatchErr) {
          console.warn('Failed to send 5-ahead WhatsApp alert for patient:', patient.id, dispatchErr)
        }
      }
    }

    return { triggeredCount }
  } catch (err) {
    console.error('Queue alert reconciliation error:', err)
    return { triggeredCount: 0 }
  }
}
