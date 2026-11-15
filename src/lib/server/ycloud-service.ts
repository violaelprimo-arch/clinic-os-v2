import 'server-only'
import crypto from 'node:crypto'
import { cleanPhoneForWhatsApp } from '@/lib/countryPhoneHelper'

export interface YCloudEmbeddedSignupLinkResponse {
  url: string
  id?: string
  expiresAt?: string
}

export interface YCloudPhoneNumberItem {
  id: string
  wabaId: string
  phoneNumber: string
  verifiedName?: string
  codeVerificationStatus?: string
  qualityRating?: string
  status?: string
}

export interface YCloudSendMessageResult {
  id: string
  wamid?: string
  status: 'accepted' | 'sent' | 'delivered' | 'read' | 'failed' | 'mock_sent'
  conversationId?: string
  price?: number
  currency?: string
}

export interface YCloudTemplateParameter {
  type: 'text'
  text: string
}

export interface YCloudTemplatePayload {
  from: string
  to: string
  type: 'template'
  template: {
    name: string
    language: {
      code: string
    }
    components: Array<{
      type: 'body' | 'header' | 'button'
      sub_type?: 'url' | 'quick_reply'
      index?: string | number
      parameters: YCloudTemplateParameter[]
    }>
  }
}

/**
 * Format any phone number into standard international E.164 with leading '+'
 * (e.g. 01012345678 -> +201012345678, +96650... -> +96650...)
 */
export function formatToE164(phone: string, defaultCountryCode = '+20'): string {
  if (!phone) return ''
  const cleaned = cleanPhoneForWhatsApp(phone, defaultCountryCode)
  // Ensure leading '+'
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`
}

/**
 * Get active YCloud API key from environment
 */
export function getYCloudApiKey(): string {
  return (process.env.YCLOUD_API_KEY || '').trim()
}

/**
 * Get active YCloud Webhook secret from environment
 */
export function getYCloudWebhookSecret(): string {
  return (process.env.YCLOUD_WEBHOOK_SECRET || '').trim()
}

/**
 * Generate YCloud Partner Embedded Signup link for a specific clinic.
 * Endpoint: POST https://api.ycloud.com/v2/partner/embeddedSignup/links
 */
export async function createEmbeddedSignupLink(params: {
  partnerCustomerId: string
  locale?: string
}): Promise<YCloudEmbeddedSignupLinkResponse> {
  const { partnerCustomerId, locale = 'en_US' } = params
  if (!partnerCustomerId || partnerCustomerId.trim() === '') {
    throw new Error('partnerCustomerId is required to generate embedded signup link')
  }

  const apiKey = getYCloudApiKey()
  if (!apiKey) {
    console.warn('[YCloud] YCLOUD_API_KEY not set. Returning simulated onboarding link for testing.')
    return {
      url: `https://business.facebook.com/wa/manage/embedded-signup/?partner_customer_id=${encodeURIComponent(partnerCustomerId)}&onboarding_type=WHATSAPP_BUSINESS_APP&locale=${encodeURIComponent(locale)}&mode=simulation`,
      id: `sim_link_${partnerCustomerId}_${Date.now()}`
    }
  }

  const response = await fetch('https://api.ycloud.com/v2/partner/embeddedSignup/links', {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      partnerCustomerId: partnerCustomerId.trim(),
      onboardingType: 'WHATSAPP_BUSINESS_APP',
      locale
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`[YCloud] Create embedded signup link error (${response.status}):`, errorText)
    throw new Error(`YCloud onboarding link creation failed [${response.status}]: ${errorText}`)
  }

  const data = await response.json()
  return {
    url: data.url,
    id: data.id,
    expiresAt: data.expiresAt
  }
}

/**
 * List phone numbers associated with a WhatsApp Business Account (WABA).
 * Endpoint: GET https://api.ycloud.com/v2/whatsapp/phoneNumbers?filter.wabaId={wabaId}
 */
export async function listWabaPhoneNumbers(wabaId: string): Promise<YCloudPhoneNumberItem[]> {
  if (!wabaId || wabaId.trim() === '') return []

  const apiKey = getYCloudApiKey()
  if (!apiKey) {
    return [
      {
        id: `mock_pn_${wabaId}`,
        wabaId,
        phoneNumber: '+201000000000',
        verifiedName: 'عيادة ديمو (تجريبي)',
        status: 'CONNECTED',
        qualityRating: 'GREEN'
      }
    ]
  }

  const url = `https://api.ycloud.com/v2/whatsapp/phoneNumbers?filter.wabaId=${encodeURIComponent(wabaId.trim())}&limit=20`
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-API-Key': apiKey,
      'Accept': 'application/json'
    }
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.warn(`[YCloud] listWabaPhoneNumbers warning (${response.status}):`, errorText)
    return []
  }

  const data = await response.json()
  return (data.items || []) as YCloudPhoneNumberItem[]
}

/**
 * Send an approved WhatsApp Utility Template Message using YCloud API.
 * Endpoint: POST https://api.ycloud.com/v2/whatsapp/messages
 */
export async function sendWhatsAppTemplateMessage(params: {
  from: string
  to: string
  templateName: string
  languageCode?: string
  bodyVariables: string[]
}): Promise<YCloudSendMessageResult> {
  const { from, to, templateName, languageCode = 'ar', bodyVariables } = params

  const cleanFrom = formatToE164(from)
  const cleanTo = formatToE164(to)

  if (!cleanFrom || !cleanTo) {
    throw new Error('Both sender (from) and recipient (to) phone numbers in E.164 format are required')
  }

  const payload: YCloudTemplatePayload = {
    from: cleanFrom,
    to: cleanTo,
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: languageCode
      },
      components: [
        {
          type: 'body',
          parameters: bodyVariables.map((val) => ({
            type: 'text',
            text: String(val || '')
          }))
        }
      ]
    }
  }

  const apiKey = getYCloudApiKey()
  if (!apiKey) {
    console.log('[YCloud] No API Key set. Simulating message send:', payload)
    return {
      id: `mock_msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      wamid: `wamid.mock_${Date.now()}`,
      status: 'mock_sent',
      price: 0.038,
      currency: 'USD'
    }
  }

  const response = await fetch('https://api.ycloud.com/v2/whatsapp/messages', {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`[YCloud] Send template message failed (${response.status}):`, errorText)
    throw new Error(`YCloud send message failed [${response.status}]: ${errorText}`)
  }

  const data = await response.json()
  return {
    id: data.id,
    wamid: data.wamid,
    status: data.status || 'accepted',
    conversationId: data.conversation?.id,
    price: data.pricing?.cost,
    currency: data.pricing?.currency
  }
}

/**
 * Verify YCloud Webhook Signature using HMAC-SHA256
 * Format of header: YCloud-Signature: t={timestamp},s={signature}
 * Signed string: `${timestamp}.${rawBody}`
 */
export function verifyYCloudWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): { valid: boolean; timestamp?: number; error?: string } {
  if (!signatureHeader || !secret) {
    return { valid: false, error: 'MISSING_SIGNATURE_OR_SECRET' }
  }

  const parts = signatureHeader.split(',')
  const tPart = parts.find((p) => p.trim().startsWith('t='))
  const sPart = parts.find((p) => p.trim().startsWith('s='))

  if (!tPart || !sPart) {
    return { valid: false, error: 'INVALID_SIGNATURE_HEADER_FORMAT' }
  }

  const timestampStr = tPart.trim().substring(2)
  const receivedSig = sPart.trim().substring(2)

  const timestamp = parseInt(timestampStr, 10)
  if (isNaN(timestamp)) {
    return { valid: false, error: 'INVALID_TIMESTAMP' }
  }

  // Tolerance check (5 minutes = 300 seconds)
  const nowSec = Math.floor(Date.now() / 1000)
  if (Math.abs(nowSec - timestamp) > 300) {
    return { valid: false, timestamp, error: 'TIMESTAMP_OUT_OF_TOLERANCE' }
  }

  const signedPayload = `${timestampStr}.${rawBody}`
  const computedSig = crypto
    .createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex')

  const receivedBuf = Buffer.from(receivedSig, 'hex')
  const computedBuf = Buffer.from(computedSig, 'hex')

  if (receivedBuf.length !== computedBuf.length) {
    return { valid: false, timestamp, error: 'SIGNATURE_LENGTH_MISMATCH' }
  }

  const isMatch = crypto.timingSafeEqual(receivedBuf, computedBuf)
  return { valid: isMatch, timestamp, error: isMatch ? undefined : 'SIGNATURE_MISMATCH' }
}
