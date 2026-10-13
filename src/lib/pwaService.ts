/**
 * PWA Service & Push Notification Manager for Clinic OS V2
 * Handles:
 * - Service Worker registration
 * - Push subscription with VAPID
 * - Storage of subscriptions in Firestore
 * - Detection of iOS Safari Home Screen mode
 */

import { db } from '@/lib/firebase'
import { collection, addDoc, query, where, getDocs, updateDoc, doc } from 'firebase/firestore'

// Public VAPID Key for Web Push (standard applicationServerKey)
export const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

/**
 * Registers the Service Worker if supported.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null
  }
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    return reg
  } catch (error) {
    console.warn('Service worker registration failed:', error)
    return null
  }
}

/**
 * Checks if the user is running the app as an installed standalone PWA.
 */
export function isRunningStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  )
}

/**
 * Checks if the current browser is iOS Safari (requires "Add to Home Screen" for Web Push).
 */
export function isIosSafari(): boolean {
  if (typeof window === 'undefined') return false
  const ua = window.navigator.userAgent
  const isIos = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream
  const isWebKit = /WebKit/.test(ua)
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua)
  return isIos && isWebKit && isSafari
}

/**
 * Subscribes user to Web Push and saves subscription to Firestore.
 */
export async function subscribeToPush({
  clinicId,
  phone,
  appointmentId,
  role = 'patient'
}: {
  clinicId?: string
  phone?: string
  appointmentId?: string
  role?: 'patient' | 'staff'
}): Promise<{ success: boolean; subscription?: PushSubscription; error?: string }> {
  if (typeof window === 'undefined') return { success: false, error: 'no_window' }
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { success: false, error: 'unsupported' }
  }

  try {
    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()

    if (!sub) {
      const convertedKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey as unknown as BufferSource
      })
    }

    if (!sub) {
      return { success: false, error: 'subscription_failed' }
    }

    const subJson = sub.toJSON()

    // Save or update subscription in Firestore
    if (subJson.endpoint) {
      try {
        const q = query(
          collection(db, 'pushSubscriptions'),
          where('endpoint', '==', subJson.endpoint)
        )
        const snap = await getDocs(q)

        const payload = {
          endpoint: subJson.endpoint,
          keys: subJson.keys || null,
          clinicId: clinicId || null,
          phone: phone || null,
          appointmentId: appointmentId || null,
          role,
          userAgent: navigator.userAgent,
          updatedAt: new Date().toISOString()
        }

        if (snap.empty) {
          await addDoc(collection(db, 'pushSubscriptions'), {
            ...payload,
            createdAt: new Date().toISOString()
          })
        } else {
          await updateDoc(doc(db, 'pushSubscriptions', snap.docs[0].id), payload)
        }
      } catch (err) {
        console.warn('Error saving push subscription to Firestore:', err)
      }
    }

    return { success: true, subscription: sub }
  } catch (err: any) {
    console.error('Error during push subscription:', err)
    return { success: false, error: err.message || 'permission_denied' }
  }
}
