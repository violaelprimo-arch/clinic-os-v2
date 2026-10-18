import { db } from '@/lib/firebase'
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  onSnapshot
} from 'firebase/firestore'
import { ClinicNotification } from '@/types/clinic'
import { getPhoneSearchVariants } from './countryPhoneHelper'

let sharedAudioCtx: any = null

function getAudioContext() {
  if (typeof window === 'undefined') return null
  try {
    if (!sharedAudioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      if (AudioContextClass) {
        sharedAudioCtx = new AudioContextClass()
      }
    }
    if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {})
    }
    return sharedAudioCtx
  } catch (e) {
    return null
  }
}

if (typeof window !== 'undefined') {
  const unlock = () => {
    getAudioContext()
    window.removeEventListener('click', unlock)
    window.removeEventListener('touchstart', unlock)
    window.removeEventListener('keydown', unlock)
  }
  window.addEventListener('click', unlock, { once: true, passive: true })
  window.addEventListener('touchstart', unlock, { once: true, passive: true })
  window.addEventListener('keydown', unlock, { once: true, passive: true })
}

/**
 * Web Audio API synthesizer chime (zero external file dependency, 100% reliable)
 */
export function playNotificationSound(type: 'turn_ready' | 'chime' | 'urgent' = 'chime') {
  if (typeof window === 'undefined') return
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    if (type === 'turn_ready' || type === 'urgent') {
      // High-impact medical 3-tone chime (Fa - La - Do)
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(523.25, now) // C5
      osc.frequency.setValueAtTime(659.25, now + 0.15) // E5
      osc.frequency.setValueAtTime(783.99, now + 0.3) // G5

      gain.gain.setValueAtTime(0.35, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.8)
    } else {
      // Gentle 2-tone pleasant notification chime
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(659.25, now) // E5
      osc.frequency.setValueAtTime(880.00, now + 0.12) // A5

      gain.gain.setValueAtTime(0.25, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.5)
    }
  } catch (e) {
    // AudioContext autoplay fallback
  }
}

/**
 * Creates an in-site notification with deduplication via eventId.
 */
export async function createClinicNotification({
  clinicId,
  branchId,
  recipientType,
  recipientTarget,
  title,
  body,
  type,
  eventId,
  appointmentId
}: Omit<ClinicNotification, 'id' | 'isRead' | 'createdAt'>): Promise<string | null> {
  try {
    // Check if notification with this eventId already exists to prevent duplicate spam
    if (eventId) {
      const q = query(
        collection(db, 'notifications'),
        where('eventId', '==', eventId)
      )
      const existingSnap = await getDocs(q)
      if (!existingSnap.empty) {
        return null // Already sent
      }
    }

    const targetClean = recipientType === 'patient' && recipientTarget
      ? recipientTarget.trim().replace(/\s+/g, '')
      : recipientTarget

    const docRef = await addDoc(collection(db, 'notifications'), {
      clinicId,
      branchId: branchId || null,
      recipientType,
      recipientTarget: targetClean,
      title,
      body,
      type,
      eventId: eventId || null,
      appointmentId: appointmentId || null,
      isRead: false,
      createdAt: new Date().toISOString()
    })

    return docRef.id
  } catch (err) {
    console.error('Error creating notification:', err)
    return null
  }
}

/**
 * Requests browser push notification permission from the user.
 */
export async function requestBrowserNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false
  }
  if (Notification.permission === 'granted') {
    return true
  }
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission()
    return permission === 'granted'
  }
  return false
}

/**
 * Subscribes to real-time notifications for a recipient (patient phone).
 * Strictly filters by recipientType === 'patient' and phone variants.
 */
export function subscribeToRecipientNotifications(
  recipientTarget: string,
  onUpdate: (notifications: ClinicNotification[]) => void
) {
  if (!recipientTarget) return () => {}
  const cleanPhone = recipientTarget.trim().replace(/\s+/g, '')
  const phoneVariants = getPhoneSearchVariants(cleanPhone)
  const searchPhones = Array.from(new Set([cleanPhone, ...phoneVariants])).filter(Boolean).slice(0, 10)

  const q = query(
    collection(db, 'notifications'),
    where('recipientType', '==', 'patient'),
    where('recipientTarget', 'in', searchPhones)
  )

  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any)
      })) as ClinicNotification[]
      // Sort newest first
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      onUpdate(list)
    },
    (err) => {
      console.warn('Patient notification snapshot warning:', err)
    }
  )
}

/**
 * Comprehensive real-time subscription for Clinic Doctor / Staff bell.
 * Strictly filters by recipientType in ['staff', 'doctor'] and optional branchId.
 */
export function subscribeToClinicStaffNotifications(
  clinicId: string,
  slug: string,
  onUpdate: (notifications: ClinicNotification[]) => void,
  branchId?: string
) {
  const notificationsMap = new Map<string, ClinicNotification>()
  const unsubscribers: (() => void)[] = []

  // 1. Listen by clinicId
  if (clinicId) {
    const q1 = query(
      collection(db, 'notifications'),
      where('clinicId', '==', clinicId),
      where('recipientType', 'in', ['staff', 'doctor'])
    )
    unsubscribers.push(
      onSnapshot(q1, (snap) => {
        snap.docs.forEach((d) => {
          notificationsMap.set(d.id, { id: d.id, ...(d.data() as any) })
        })
        emitList()
      }, (e) => console.warn('q1 warn:', e))
    )
  }

  // 2. Listen by slug if different
  if (slug && slug !== clinicId) {
    const q2 = query(
      collection(db, 'notifications'),
      where('clinicId', '==', slug),
      where('recipientType', 'in', ['staff', 'doctor'])
    )
    unsubscribers.push(
      onSnapshot(q2, (snap) => {
        snap.docs.forEach((d) => {
          notificationsMap.set(d.id, { id: d.id, ...(d.data() as any) })
        })
        emitList()
      }, (e) => console.warn('q2 warn:', e))
    )
  }

  function emitList() {
    let list = Array.from(notificationsMap.values())
      // Only staff/doctor notifications
      .filter((n) => n.recipientType === 'staff' || n.recipientType === 'doctor')

    // Branch isolation if selected
    if (branchId && branchId !== 'all') {
      list = list.filter((n) => !n.branchId || n.branchId === branchId)
    }

    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    onUpdate(list)
  }

  return () => {
    unsubscribers.forEach((u) => u())
  }
}

/**
 * Marks a notification as read.
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      isRead: true
    })
  } catch (err) {
    console.error('Error marking notification as read:', err)
  }
}

/**
 * Checks queue position for a waiting patient and triggers alerts:
 * 1. Reminder notifications when 5 or fewer turns remain (countdown for 5, 4, 3, 2, 1).
 * 2. Notification on every patient entry to the examination room.
 * 3. Urgent turn ready alert when it's the patient's turn.
 */
export async function checkAndTriggerQueuePositionAlert({
  appointment,
  waitingAheadCount,
  clinicId,
  branchName,
  currentExaminingQueueNumber
}: {
  appointment: any
  waitingAheadCount: number
  clinicId: string
  branchName?: string
  currentExaminingQueueNumber?: number | string
}): Promise<void> {
  if (!appointment?.id || !appointment?.phone) return

  // 1. Reminder starting from when 5 turns remain (fires for 5, 4, 3, 2, 1)
  if (waitingAheadCount <= 5 && waitingAheadCount > 0 && appointment.status === 'waiting') {
    const eventId = `approaching_${waitingAheadCount}_${appointment.id}`
    let title = `تنبيه: اقترب دورك (متبقي ${waitingAheadCount} أدوار)`
    let body = `متبقي أمامك ${waitingAheadCount} مرضى في انتظار الكشف. يرجى التواجد بقاعة انتظار العيادة.`
    
    if (waitingAheadCount === 1) {
      title = '⚡ أنت المريض التالي للدخول!'
      body = 'متبقي مريض واحد فقط أمامك. استعد للدخول مباشرة لمقابلة الطبيب.'
    } else if (waitingAheadCount === 2) {
      title = 'تنبيه: متبقي دوران فقط'
      body = 'متبقي مريضان فقط قبل دورك. يرجى التواجد الآن أمام غرفة الكشف.'
    }

    await createClinicNotification({
      clinicId,
      branchId: appointment.branch_id,
      recipientType: 'patient',
      recipientTarget: appointment.phone,
      title,
      body,
      type: 'approaching_turn',
      eventId,
      appointmentId: appointment.id
    })
  }

  // 2. Notification on patient entry
  if (
    currentExaminingQueueNumber !== undefined &&
    currentExaminingQueueNumber !== null &&
    appointment.status === 'waiting'
  ) {
    const entryEventId = `pat_entered_${currentExaminingQueueNumber}_for_${appointment.id}`
    await createClinicNotification({
      clinicId,
      branchId: appointment.branch_id,
      recipientType: 'patient',
      recipientTarget: appointment.phone,
      title: 'حركة الدور: دخول مريض لغرفة الكشف',
      body: `دخل الآن المريض رقم #${currentExaminingQueueNumber} لغرفة الكشف. دورك رقم #${appointment.queue_number || ''} (متبقي أمامك ${waitingAheadCount} مرضى).`,
      type: 'system',
      eventId: entryEventId,
      appointmentId: appointment.id
    })
  }

  // 3. Turn ready alert
  if (appointment.status === 'in_progress' || waitingAheadCount === 0) {
    const eventId = `turn_ready_${appointment.id}`
    await createClinicNotification({
      clinicId,
      branchId: appointment.branch_id,
      recipientType: 'patient',
      recipientTarget: appointment.phone,
      title: 'دورك الآن للدخول!',
      body: `حان دورك للدخول لغرفة الكشف الآن (#${appointment.queue_number || ''}). يرجى الدخول مباشرة.`,
      type: 'turn_ready',
      eventId,
      appointmentId: appointment.id
    })

    // Sound chime and vibration for patient
    playNotificationSound('turn_ready')
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([200, 100, 200])
      } catch (e) {}
    }
  }
}
