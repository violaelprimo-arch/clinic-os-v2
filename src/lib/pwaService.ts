/**
 * PWA Service & Web Push Manager for Yalla Clinic
 * Handles:
 * - Service Worker registration
 * - Push subscription with P-256 VAPID
 * - Verification and synchronization with server
 * - Detection of iOS Safari Home Screen standalone mode
 */

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
 * Checks if current device is iOS (iPhone/iPad/iPod).
 */
export function isIosDevice(): boolean {
  if (typeof window === 'undefined') return false
  const ua = window.navigator.userAgent
  const isIos = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream
  const isMacWithTouch = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1
  return isIos || isMacWithTouch
}

/**
 * Checks full browser push capabilities.
 */
export function getPushCapabilityStatus(): {
  supported: boolean
  isHttps: boolean
  hasServiceWorker: boolean
  hasPushManager: boolean
  hasNotification: boolean
  permission: NotificationPermission | 'unsupported'
  isIos: boolean
  isStandalone: boolean
} {
  if (typeof window === 'undefined') {
    return {
      supported: false,
      isHttps: false,
      hasServiceWorker: false,
      hasPushManager: false,
      hasNotification: false,
      permission: 'unsupported',
      isIos: false,
      isStandalone: false,
    }
  }

  const isHttps =
    window.location.protocol === 'https:' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'

  const hasServiceWorker = 'serviceWorker' in navigator
  const hasPushManager = 'PushManager' in window
  const hasNotification = 'Notification' in window
  const isIos = isIosDevice()
  const isStandalone = isRunningStandalone()

  const supported = isHttps && hasServiceWorker && hasPushManager && hasNotification
  const permission = hasNotification ? Notification.permission : 'unsupported'

  return {
    supported,
    isHttps,
    hasServiceWorker,
    hasPushManager,
    hasNotification,
    permission,
    isIos,
    isStandalone,
  }
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
 * Fetches the active VAPID public key from the server API if needed.
 */
export async function fetchServerVapidKey(): Promise<string> {
  const response = await fetch('/api/push/vapid-public-key', {
    cache: 'no-store', credentials: 'same-origin',
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || typeof data.publicKey !== 'string' || data.publicKey.length < 60) {
    throw new Error('VAPID_KEY_NOT_CONFIGURED')
  }
  return data.publicKey
}

/**
 * Subscribes user to Web Push and saves subscription securely to server.
 * Returns success only after registration AND server save succeed.
 */
function getPushClaim(appointmentId?: string) {
  if (typeof window === 'undefined' || !appointmentId) return ''
  try { return localStorage.getItem(`yalla_push_claim_${appointmentId}`) || '' }
  catch { return '' }
}

/** The subscription is active only if the server confirms its saved record. */
export async function getRegisteredPushStatus({
  clinicId, appointmentId, role = 'patient',
}: {
  clinicId?: string
  appointmentId?: string
  role?: 'patient' | 'staff'
}): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return false
  try {
    const registration = await navigator.serviceWorker.getRegistration('/')
    const sub = await registration?.pushManager.getSubscription()
    if (!sub || !clinicId) return false
    const response = await fetch('/api/push/status', {
      method: 'POST', cache: 'no-store', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: sub.endpoint, clinicId, appointmentId, role,
        pushClaim: getPushClaim(appointmentId),
      }),
    })
    const data = await response.json().catch(() => ({}))
    return response.ok && data.registered === true
  } catch { return false }
}

export async function subscribeToPush({
  clinicId,
  phone,
  appointmentId,
  role = 'patient',
}: {
  clinicId?: string
  phone?: string
  appointmentId?: string
  role?: 'patient' | 'staff'
}): Promise<{
  success: boolean
  subscription?: PushSubscription
  error?: string
}> {
  if (typeof window === 'undefined') return { success: false, error: 'no_window' }

  const status = getPushCapabilityStatus()
  if (!status.supported) {
    if (status.isIos && !status.isStandalone) {
      return { success: false, error: 'ios_requires_home_screen' }
    }
    return { success: false, error: 'unsupported' }
  }

  try {
    // 1. Request notification permission on user interaction
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      return { success: false, error: 'permission_denied' }
    }

    // 2. Ensure Service Worker is registered and active
    const reg = (await registerServiceWorker()) || undefined

    if (!reg) {
      return { success: false, error: 'service_worker_unavailable' }
    }

    await navigator.serviceWorker.ready

    // 3. After VAPID rotation, old subscriptions cannot be used to receive
    // messages. Explicit reactivation re-subscribes with the current key.
    let sub = await reg.pushManager.getSubscription()
    const vapidKey = await fetchServerVapidKey()
    const convertedKey = urlBase64ToUint8Array(vapidKey)
    if (sub?.options.applicationServerKey) {
      const oldKey = new Uint8Array(sub.options.applicationServerKey)
      if (oldKey.length !== convertedKey.length ||
          oldKey.some((byte, i) => byte !== convertedKey[i])) {
        await sub.unsubscribe()
        sub = null
      }
    }
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey as unknown as BufferSource,
      })
    }

    if (!sub) {
      return { success: false, error: 'subscription_failed' }
    }

    // 4. Register subscription on the server API
    const subJson = sub.toJSON()
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: subJson,
        clinicId,
        appointmentId,
        patientPhone: phone,
        role,
        pushClaim: getPushClaim(appointmentId),
        userAgent: navigator.userAgent,
      }),
    })

    const result = await response.json().catch(() => ({}))
    if (!response.ok || result.success !== true) {
      return {
        success: false,
        error: result.error || `Server error HTTP ${response.status}`,
      }
    }
    const persisted = await getRegisteredPushStatus({ clinicId, appointmentId, role })
    if (!persisted) return { success: false, error: 'SERVER_REGISTRATION_NOT_CONFIRMED' }
    return { success: true, subscription: sub }
  } catch (err: any) {
    console.error('Error during push subscription:', err)
    return { success: false, error: err.message || 'subscription_error' }
  }
}

/**
 * Unsubscribes current device from a specific appointment or deactivates it.
 */
export async function unsubscribeFromPush({
  appointmentId, clinicId, role = 'patient',
}: {
  appointmentId?: string
  clinicId?: string
  role?: 'patient' | 'staff'
}): Promise<{ success: boolean; error?: string }> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return { success: false, error: 'unsupported' }
  }

  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (!sub) return { success: true }

    const res = await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        appointmentId, clinicId, role,
        pushClaim: getPushClaim(appointmentId),
      }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return { success: false, error: data.error }
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Dispatches a real test push notification to this device.
 */
export async function sendDeviceTestPush({
  appointmentId, clinicSlug, clinicId, role = 'patient',
}: {
  appointmentId?: string
  clinicSlug?: string
  clinicId?: string
  role?: 'patient' | 'staff'
}): Promise<{ success: boolean; message?: string; error?: string }> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return { success: false, error: 'غير مدعوم في هذا المتصفح' }
  }

  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (!sub) {
      return { success: false, error: 'لا يوجد اشتراك نشط. يرجى تفعيل التنبيهات أولاً.' }
    }

    const res = await fetch('/api/push/test', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        appointmentId, clinicSlug, clinicId, role,
        pushClaim: getPushClaim(appointmentId),
      }),
    })

    const data = await res.json().catch(() => ({}))
    if (res.ok && data.success) {
      return { success: true, message: data.message }
    } else {
      return { success: false, error: data.error || 'فشل إرسال الإشعار التجريبي' }
    }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export const isIosSafari = isIosDevice
