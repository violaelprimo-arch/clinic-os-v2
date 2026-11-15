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

    const senderPhone = String(config?.phoneNumber || clinic?.whatsappPhoneNumber || '').trim()
    if (!senderPhone) {
      return NextResponse.json(
        { error: 'رقم واتساب العيادة غير مرتبط أو غير متاح للإرسال' },
        { status: 400, headers: noStore }
      )
    }

    const formattedRecipient = formatToE164(testPhone)
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
