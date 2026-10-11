/**
 * Meta WhatsApp Cloud API Service & Notification Outbox Manager
 * Official WhatsApp Business Platform API implementation.
 */

import { collection, addDoc, getDocs, query, where, updateDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export type WhatsAppMessageType =
  | 'BOOKING_CONFIRMED'
  | 'FIVE_PATIENTS_AHEAD'
  | 'BOOKING_INVOICE'
  | 'PAYMENT_RECEIPT'
  | 'PRESCRIPTION_READY'

export interface WhatsAppPayload {
  to: string // international format e.g. 201012345678
  type: WhatsAppMessageType
  appointmentId: string
  patientName: string
  clinicName: string
  data: Record<string, any>
  idempotencyKey: string
  clinicId: string
}

export interface WhatsAppSendResult {
  success: boolean
  outboxId: string
  providerMessageId?: string
  status: 'sent' | 'failed' | 'mock_sent' | 'config_missing'
  error?: string
}

/**
 * Format local Egyptian numbers (010xxx) to E.164 (2010xxx).
 */
export function formatWhatsAppPhone(phone: string): string {
  let cleaned = String(phone || '').replace(/[^0-9]/g, '')
  if (cleaned.startsWith('0')) {
    cleaned = '2' + cleaned
  } else if (!cleaned.startsWith('20') && cleaned.length === 10) {
    cleaned = '20' + cleaned
  }
  return cleaned
}

/**
 * Send an automated WhatsApp notification via official Meta WhatsApp Business Cloud API.
 * Uses Durable Notification Outbox with Idempotency Key to strictly prevent duplicate messages.
 */
export async function sendWhatsAppNotification(payload: WhatsAppPayload): Promise<WhatsAppSendResult> {
  const recipient = formatWhatsAppPhone(payload.to)

  // 1. Idempotency check: verify if this exact notification event was already sent
  try {
    const existingQ = query(
      collection(db, 'notification_outbox'),
      where('idempotencyKey', '==', payload.idempotencyKey)
    )
    const existingSnap = await getDocs(existingQ)
    if (!existingSnap.empty) {
      const existingDoc = existingSnap.docs[0]
      const existingData = existingDoc.data()
      if (existingData.status === 'sent' || existingData.status === 'mock_sent') {
        return {
          success: true,
          outboxId: existingDoc.id,
          providerMessageId: existingData.providerMessageId,
          status: existingData.status
        }
      }
    }
  } catch (err) {
    console.warn('Idempotency check warning:', err)
  }

  // 2. Prepare message text and template data
  const messageBody = buildMessageContent(payload)

  // 3. Check Meta Cloud API credentials (from environment OR Firestore clinic settings)
  let accessToken = process.env.WHATSAPP_ACCESS_TOKEN || process.env.META_WHATSAPP_TOKEN
  let phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.META_PHONE_NUMBER_ID
  const apiVersion = process.env.WHATSAPP_API_VERSION || 'v21.0'

  if (!accessToken || !phoneNumberId) {
    try {
      const cQ = query(collection(db, 'clinics'), where('slug', '==', 'zizo'))
      const cSnap = await getDocs(cQ)
      if (!cSnap.empty) {
        const cData = cSnap.docs[0].data()
        accessToken = accessToken || cData.whatsappAccessToken
        phoneNumberId = phoneNumberId || cData.whatsappPhoneNumberId
      }
    } catch (e) {
      console.warn('Fallback fetching clinic WhatsApp credentials error:', e)
    }
  }

  // If credentials are still not configured, record in outbox as CONFIG_MISSING
  if (!accessToken || !phoneNumberId) {
    const outboxRef = await addDoc(collection(db, 'notification_outbox'), {
      appointmentId: payload.appointmentId,
      clinicId: payload.clinicId,
      recipient,
      type: payload.type,
      idempotencyKey: payload.idempotencyKey,
      body: messageBody,
      status: 'config_missing',
      errorMessage: 'Meta WhatsApp Cloud API credentials (WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID) not configured in environment or clinic settings.',
      createdAt: new Date().toISOString()
    })

    return {
      success: false,
      outboxId: outboxRef.id,
      status: 'config_missing',
      error: 'يرجى إدخال Phone Number ID و Access Token في تبويب إعدادات واتساب لحسابك على Meta.'
    }
  }

  // 4. Dispatch via Meta WhatsApp Cloud API
  try {
    const endpoint = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`
    
    // Meta Cloud API payload (text format or utility template)
    const requestBody = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipient,
      type: 'text',
      text: {
        preview_url: true,
        body: messageBody
      }
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    const result = await response.json()

    if (!response.ok) {
      const errorMsg = result.error?.message || `HTTP ${response.status}: Failed to dispatch WhatsApp message`
      
      const outboxRef = await addDoc(collection(db, 'notification_outbox'), {
        appointmentId: payload.appointmentId,
        clinicId: payload.clinicId,
        recipient,
        type: payload.type,
        idempotencyKey: payload.idempotencyKey,
        body: messageBody,
        status: 'failed',
        errorCode: result.error?.code || 'META_API_ERROR',
        errorMessage: errorMsg,
        createdAt: new Date().toISOString()
      })

      return {
        success: false,
        outboxId: outboxRef.id,
        status: 'failed',
        error: errorMsg
      }
    }

    const providerMessageId = result.messages?.[0]?.id || ''

    const outboxRef = await addDoc(collection(db, 'notification_outbox'), {
      appointmentId: payload.appointmentId,
      clinicId: payload.clinicId,
      recipient,
      type: payload.type,
      idempotencyKey: payload.idempotencyKey,
      body: messageBody,
      status: 'sent',
      providerMessageId,
      createdAt: new Date().toISOString(),
      sentAt: new Date().toISOString()
    })

    return {
      success: true,
      outboxId: outboxRef.id,
      providerMessageId,
      status: 'sent'
    }
  } catch (err: any) {
    const outboxRef = await addDoc(collection(db, 'notification_outbox'), {
      appointmentId: payload.appointmentId,
      clinicId: payload.clinicId,
      recipient,
      type: payload.type,
      idempotencyKey: payload.idempotencyKey,
      body: messageBody,
      status: 'failed',
      errorMessage: err.message || 'Network exception',
      createdAt: new Date().toISOString()
    })

    return {
      success: false,
      outboxId: outboxRef.id,
      status: 'failed',
      error: err.message
    }
  }
}

/**
 * Build standard message template body in Arabic.
 */
function buildMessageContent(payload: WhatsAppPayload): string {
  const { type, patientName, clinicName, data } = payload

  switch (type) {
    case 'BOOKING_CONFIRMED':
      return `أهلاً بحضرتك ${patientName}، تم تأكيد حجزك في عيادة ${clinicName}.

الاسم: ${patientName}
تاريخ الحجز: ${data.date || 'اليوم'}
نوع الكشف: ${data.serviceName || 'كشف'}
رقم الدور: ${data.queueNumber}
المبلغ المطلوب: ${data.price || 0} ج.م

يمكنك متابعة دورك لحظياً من خلال الرابط:
${data.trackUrl || ''}

نتمنى لك دوام الصحة والعافية.`

    case 'FIVE_PATIENTS_AHEAD':
      return `تنبيه من عيادة ${clinicName}

اقترب موعد دخولك للكشف يا ${patientName}.
متبقي أمامك ${data.remainingCount} مرضى تقريباً.
موعد دخولك المتوقع: ${data.estimatedTime || 'قريباً'}

يرجى الاستعداد والتوجه إلى العيادة الآن.
${data.mapsUrl ? `موقع العيادة:\n${data.mapsUrl}\n` : ''}
لمتابعة دورك مباشرة:
${data.trackUrl || ''}`

    case 'BOOKING_INVOICE':
      return `فاتورة حجز - عيادة ${clinicName}

مرحباً ${patientName}،
رقم الفاتورة: ${data.invoiceNumber || 'INV-001'}
الخدمة: ${data.serviceName}
المبلغ: ${data.price} ج.م
حالة الدفع: ${data.paymentStatus === 'paid' ? 'تم السداد' : 'في انتظار السداد بالعيادة'}

يمكنك مراجعة وطباعة الفاتورة من ملفك الطبي.`

    case 'PAYMENT_RECEIPT':
      return `إيصال استلام نقدية - عيادة ${clinicName}

مرحباً ${patientName}،
تم تأكيد استلام مبلغ ${data.price} ج.م بنجاح نظير (${data.serviceName}).
شكراً لزيارتكم.`

    case 'PRESCRIPTION_READY':
      return `مرحباً ${patientName}،

تم تجهيز روشتة زيارتك في عيادة ${clinicName}.
يمكنك الآن الاطلاع على الروشتة والأدوية وتحميلها من ملفك الطبي الآمن عبر الرابط:
${data.portalUrl || ''}

نتمنى لك الشفاء العاجل ودوام العافية.`

    default:
      return `إشعار من عيادة ${clinicName}`
  }
}
