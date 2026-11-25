import { NextRequest, NextResponse } from 'next/server'
import { authenticateOwnerRequest, readJson, apiFailure } from '@/lib/server/owner-access'
import { readDocument } from '@/lib/server/firebase-rest'
import {
  sendWhatsAppTemplateMessage,
  formatToE164
} from '@/lib/server/ycloud-service'
import {
  formatArabicDate,
  formatArabicTime
} from '@/lib/server/whatsapp-scheduler'

import { getWpSenderConfig, sendWpSenderMessage } from '@/lib/server/wp-sender'

export const dynamic = 'force-dynamic'

const noStore = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Content-Type': 'application/json'
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate Platform Owner
    await authenticateOwnerRequest(req)

    const body = await readJson(req)
    const clinicId = String(body?.clinicId || '').trim()
    const testPhone = String(body?.testPhone || '').trim()

    if (!clinicId || !testPhone) {
      return NextResponse.json(
        { error: 'معرف العيادة ورقم الهاتف التجريبي مطلوبان' },
        { status: 400, headers: noStore }
      )
    }

    const config = await readDocument(`clinic_whatsapp_configs/${clinicId}`)
    const clinic = await readDocument(`clinics/${clinicId}`)

    const wp = getWpSenderConfig(clinicId)
    const formattedRecipient = formatToE164(testPhone)
    if (wp) {
      if (!clinic || wp.mode === 'off') {
        return NextResponse.json({ error: 'إرسال WP Sender غير مفعّل لهذه العيادة' }, { status: 400, headers: noStore })
      }
      try {
        const result = await sendWpSenderMessage(wp, formattedRecipient, 'رسالة اختبار من Yalla Clinic.')
        return NextResponse.json({
          success: true,
          messageId: result.id,
          status: result.status,
          recipient: formattedRecipient
        }, { headers: noStore })
      } catch {
        return NextResponse.json({ error: 'تعذر اختبار WP Sender. راجع حالة الرقم والاشتراك ومفتاح الربط.' }, { status: 502, headers: noStore })
      }
    }

    const senderPhone = String(config?.phoneNumber || clinic?.whatsappPhoneNumber || '').trim()
    if (!senderPhone) {
      return NextResponse.json(
        { error: 'رقم واتساب العيادة غير مرتبط أو غير متاح للإرسال' },
        { status: 400, headers: noStore }
      )
    }

    const clinicName = String(config?.businessName || clinic?.name || 'عيادة تجريبية')
    const todayStr = new Date().toISOString().split('T')[0]
    const arabicDate = formatArabicDate(todayStr)
    const arabicTime = formatArabicTime('10:00 AM')
    const trackUrl = `https://yalla-clinic.com/clinic/${clinic?.slug || 'demo'}/track/test`

    // Send test utility template: booking_confirmation
    const result = await sendWhatsAppTemplateMessage({
      from: senderPhone,
      to: formattedRecipient,
      templateName: 'booking_confirmation',
      bodyVariables: ['مريض تجريبي', clinicName, arabicDate, arabicTime, trackUrl]
    })

    return NextResponse.json(
      {
        success: true,
        messageId: result.id,
        wamid: result.wamid,
        status: result.status,
        recipient: formattedRecipient,
        sender: senderPhone
      },
      { status: 200, headers: noStore }
    )
  } catch (err: any) {
    return apiFailure(err)
  }
}
