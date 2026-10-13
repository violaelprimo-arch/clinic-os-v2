import { db } from '@/lib/firebase'
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  orderBy,
  onSnapshot
} from 'firebase/firestore'
import { ClinicNotification } from '@/types/clinic'

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

    const docRef = await addDoc(collection(db, 'notifications'), {
      clinicId,
      branchId: branchId || null,
      recipientType,
      recipientTarget,
      title,
      body,
      type,
      eventId: eventId || null,
      appointmentId: appointmentId || null,
      isRead: false,
      createdAt: new Date().toISOString()
    })

    // Trigger browser Web Push or Notification API if permitted
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/favicon.ico',
          dir: 'rtl'
        })
      } catch (err) {
        console.warn('Web notification display error:', err)
      }
    }

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
 * Subscribes to real-time notifications for a recipient (patient phone or staff).
 */
export function subscribeToRecipientNotifications(
  recipientTarget: string,
  onUpdate: (notifications: ClinicNotification[]) => void
) {
  const q = query(
    collection(db, 'notifications'),
    where('recipientTarget', '==', recipientTarget)
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
      console.warn('Notification snapshot warning:', err)
    }
  )
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
 * Checks queue position for a waiting patient and triggers the 5-patient alert once.
 */
export async function checkAndTriggerQueuePositionAlert({
  appointment,
  waitingAheadCount,
  clinicId,
  branchName
}: {
  appointment: any
  waitingAheadCount: number
  clinicId: string
  branchName?: string
}): Promise<void> {
  if (!appointment?.id || !appointment?.phone) return

  // 1. Five patients remaining alert (triggered when count reaches 5 or fewer)
  if (waitingAheadCount <= 5 && waitingAheadCount > 0) {
    const eventId = `approaching_5_${appointment.id}`
    await createClinicNotification({
      clinicId,
      branchId: appointment.branch_id,
      recipientType: 'patient',
      recipientTarget: appointment.phone,
      title: 'اقترب دورك في الكشف',
      body: `متبقي أمامك ${waitingAheadCount} مرضى تقريباً في ${branchName || 'العيادة'}. يرجى التواجد بقاعة الانتظار.`,
      type: 'approaching_turn',
      eventId,
      appointmentId: appointment.id
    })
  }

  // 2. Turn ready alert
  if (appointment.status === 'in_progress') {
    const eventId = `turn_ready_${appointment.id}`
    await createClinicNotification({
      clinicId,
      branchId: appointment.branch_id,
      recipientType: 'patient',
      recipientTarget: appointment.phone,
      title: 'دورك الآن للدخول!',
      body: `حان دورك للدخول لغرفة الكشف الآن (#${appointment.queue_number}). نتمنى لك الشفاء العاجل.`,
      type: 'turn_ready',
      eventId,
      appointmentId: appointment.id
    })
  }
}
