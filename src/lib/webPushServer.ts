import {
  buildPushPayload,
  type PushSubscription as WebPushSubscription,
} from '@block65/webcrypto-web-push'

export interface VapidConfig {
  subject: string
  publicKey: string
  privateKey: string
}

export interface WebPushSendResult {
  success: boolean
  status: number
  gone?: boolean
  retryAfter?: number | null
  error?: string
}

/**
 * Returns active VAPID keys for Web Push.
 * Priority: Environment Variables -> Cloudflare Secrets -> Project-Generated Permanent Keys.
 */
export function getVapidConfig(): VapidConfig {
  const publicKey =
    process.env.VAPID_PUBLIC_KEY ||
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    'BCa73xOIycmAG3s96I_I5ra3_cPw7yeV97Wh8hh01Gb24_CsLZYnDH04cJS5MTLr2irpKgc_VlCLgSpqakLmX-Y'

  const privateKey =
    process.env.VAPID_PRIVATE_KEY ||
    'FSkeN1Vr-hVLRluYn_jMY2ixfMF-GZKBBw94Kyih2o4'

  const subject =
    process.env.VAPID_SUBJECT ||
    'mailto:support@yalla-clinic.com'

  if (!publicKey || !privateKey) {
    throw new Error('VAPID credentials missing. Cannot dispatch Web Push notifications.')
  }

  return { subject, publicKey, privateKey }
}

/**
 * Validates that the endpoint is a genuine public Web Push gateway
 * to prevent SSRF and internal loopback exploits.
 */
export function isValidPushEndpoint(endpoint: string): boolean {
  if (!endpoint || typeof endpoint !== 'string') return false
  try {
    const url = new URL(endpoint)
    if (url.protocol !== 'https:') return false

    const host = url.hostname.toLowerCase()

    // Disallow loopback, link-local, and private RFC1918 addresses
    if (
      host === 'localhost' ||
      host.endsWith('.local') ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('169.254.')
    ) {
      return false
    }

    // Must match standard trusted browser push gateways
    const allowedGateways = [
      'fcm.googleapis.com',
      'push.services.mozilla.com',
      'updates.push.services.mozilla.com',
      'notify.windows.com',
      'push.apple.com',
    ]

    const matchesKnownGateway = allowedGateways.some(
      (gw) => host === gw || host.endsWith('.' + gw)
    )

    return matchesKnownGateway
  } catch {
    return false
  }
}

/**
 * Dispatches a standard encrypted Web Push notification using RFC 8291 / RFC 8292.
 * Native Web Crypto + fetch ensure 100% compatibility with Cloudflare Workers (workerd) and Node.js.
 */
export async function sendWebPushNotification(
  subscription: {
    endpoint: string
    keys: {
      p256dh: string
      auth: string
    }
  },
  payload: {
    title: string
    body: string
    icon?: string
    badge?: string
    url?: string
    tag?: string
    type?: string
    appointmentId?: string
    ttl?: number
    urgency?: 'low' | 'normal' | 'high'
  }
): Promise<WebPushSendResult> {
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return {
      success: false,
      status: 400,
      error: 'Invalid subscription object: missing endpoint or encryption keys',
    }
  }

  if (!isValidPushEndpoint(subscription.endpoint)) {
    return {
      success: false,
      status: 400,
      error: 'Invalid or disallowed push service endpoint',
    }
  }

  const vapid = getVapidConfig()

  const pushSub: WebPushSubscription = {
    endpoint: subscription.endpoint,
    expirationTime: null,
    keys: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  }

  const notificationData = {
    title: payload.title,
    body: payload.body,
    icon: payload.icon || '/brand/yalla-clinic/app-icon.png',
    badge: payload.badge || '/favicon-32x32.png',
    url: payload.url || '/',
    tag: payload.tag || `yalla-alert-${Date.now()}`,
    type: payload.type || 'general',
    appointmentId: payload.appointmentId || '',
    timestamp: Date.now(),
  }

  const ttl = payload.ttl && payload.ttl > 0 ? payload.ttl : 3600 // Default 1 hour
  const urgency = payload.urgency || (payload.type === 'turn_ready' ? 'high' : 'normal')

  try {
    const { headers, body } = await buildPushPayload(
      {
        data: notificationData,
        options: {
          ttl,
          urgency,
          topic: payload.tag?.slice(0, 32),
        },
      },
      pushSub,
      vapid
    )

    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers,
      body,
    })

    if (response.status === 201 || response.status === 200 || response.status === 202) {
      return {
        success: true,
        status: response.status,
      }
    }

    if (response.status === 404 || response.status === 410) {
      // 404 Not Found or 410 Gone: The subscription has expired or user revoked permission
      return {
        success: false,
        status: response.status,
        gone: true,
        error: 'Push subscription expired or revoked by user',
      }
    }

    if (response.status === 429) {
      const retryHeader = response.headers.get('retry-after')
      const retryAfter = retryHeader ? parseInt(retryHeader, 10) || 60 : 60
      return {
        success: false,
        status: 429,
        retryAfter,
        error: 'Push gateway rate limit reached',
      }
    }

    const errText = await response.text().catch(() => '')
    return {
      success: false,
      status: response.status,
      error: `Push gateway error HTTP ${response.status}: ${errText.slice(0, 200)}`,
    }
  } catch (err: any) {
    return {
      success: false,
      status: 500,
      error: err?.message || 'Network error dispatching push notification',
    }
  }
}
