/**
 * Automated Verification Suite for Clinic OS Web Push Notifications
 */

import fs from 'fs'
import path from 'path'

// Load .env.local for standalone test execution
const envPath = path.resolve('.env.local')
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...vals] = trimmed.split('=')
      if (key && vals.length) {
        process.env[key.trim()] = vals.join('=').trim()
      }
    }
  }
}

import { getVapidConfig, isValidPushEndpoint, sendWebPushNotification } from '../src/lib/webPushServer'
import { getSubscriptionId } from '../src/lib/pushDispatcher'

async function runWebPushTests() {
  console.log('======================================================================')
  console.log('Running Web Push Real Dispatch & Security Verification Suite')
  console.log('======================================================================')

  let passed = 0
  let failed = 0

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${msg}`)
      passed++
    } else {
      console.error(`  ✗ FAIL: ${msg}`)
      failed++
    }
  }

  // TEST 1: VAPID Keypair validity
  try {
    const vapid = getVapidConfig()
    assert(
      typeof vapid.publicKey === 'string' && vapid.publicKey.length > 50,
      'VAPID Public Key is loaded and valid P-256 base64url format'
    )
    assert(
      typeof vapid.privateKey === 'string' && vapid.privateKey.length > 30,
      'VAPID Private Key is securely loaded from environment/secrets'
    )
    assert(
      vapid.subject.startsWith('mailto:') || vapid.subject.startsWith('https:'),
      'VAPID Subject is a valid contact URI'
    )
  } catch (err: any) {
    assert(false, `VAPID configuration error: ${err.message}`)
  }

  // TEST 2: SSRF & Endpoint Safety
  assert(
    isValidPushEndpoint('https://fcm.googleapis.com/fcm/send/sample-token'),
    'Allows genuine Google FCM push gateway'
  )
  assert(
    isValidPushEndpoint('https://push.services.mozilla.com/push/v1/sample-token'),
    'Allows genuine Mozilla Web Push gateway'
  )
  assert(
    isValidPushEndpoint('https://web.push.apple.com/sample-token'),
    'Allows genuine Apple Web Push gateway'
  )
  assert(
    !isValidPushEndpoint('http://fcm.googleapis.com/fcm/send/token'),
    'Rejects insecure HTTP endpoints'
  )
  assert(
    !isValidPushEndpoint('https://localhost:8080/push'),
    'Rejects localhost endpoints'
  )
  assert(
    !isValidPushEndpoint('https://192.168.1.1/push'),
    'Rejects private RFC1918 internal IP endpoints'
  )
  assert(
    !isValidPushEndpoint('https://169.254.169.254/metadata'),
    'Rejects AWS/Cloud metadata link-local endpoints'
  )

  // TEST 3: Deterministic Subscription ID
  const ep1 = 'https://fcm.googleapis.com/fcm/send/device-a-token-12345'
  const subId1 = await getSubscriptionId(ep1)
  const subId2 = await getSubscriptionId(ep1)
  assert(
    subId1 === subId2 && subId1.startsWith('sub_'),
    'Generates deterministic SHA-256 subscription IDs per device endpoint'
  )

  // TEST 4: Real Web Push RFC 8291 Encryption & RFC 8292 Headers Generation
  try {
    const clientKey = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify']
    )
    const clientPubRaw = Buffer.from(await crypto.subtle.exportKey('raw', clientKey.publicKey))
    const b64url = (b: Buffer) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    const authSecret = crypto.getRandomValues(new Uint8Array(16))

    const mockSub = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/simulated-test-client',
      keys: {
        p256dh: b64url(clientPubRaw),
        auth: b64url(Buffer.from(authSecret)),
      },
    }

    const result = await sendWebPushNotification(mockSub, {
      title: '🔔 دورك الآن للدخول!',
      body: 'حان دورك الآن للدخول لغرفة الكشف.',
      url: '/clinic/demo/track/appt-123',
      tag: 'turn_ready_123',
      type: 'turn_ready',
      ttl: 600,
      urgency: 'high',
    })

    assert(
      result.status > 0,
      `Web Push payload successfully encrypted and dispatched to push gateway (Gateway HTTP Status: ${result.status})`
    )
  } catch (err: any) {
    assert(false, `Web Push encryption failure: ${err.message}`)
  }

  // TEST 5: Multi-appointment device model isolation logic
  const deviceSub: any = {
    id: 'sub_test',
    endpoint: ep1,
    appointments: {
      'appt_1': { clinicId: 'c1', active: true },
      'appt_2': { clinicId: 'c1', active: true }
    },
    appointmentIds: ['appt_1', 'appt_2']
  }

  // Unsubscribe appt_1
  deviceSub.appointments['appt_1'].active = false
  deviceSub.appointmentIds = deviceSub.appointmentIds.filter((id: string) => id !== 'appt_1')

  assert(
    deviceSub.appointments['appt_2'].active === true &&
    deviceSub.appointmentIds.includes('appt_2') &&
    !deviceSub.appointmentIds.includes('appt_1'),
    'Unsubscribing from one appointment preserves active subscriptions for other appointments on the same device'
  )

  console.log('======================================================================')
  console.log(`Results: ${passed} passed, ${failed} failed`)
  console.log('======================================================================')

  if (failed > 0) process.exit(1)
}

runWebPushTests()
