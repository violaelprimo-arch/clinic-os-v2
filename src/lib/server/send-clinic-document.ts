import { NextRequest, NextResponse } from 'next/server'
import { getCurrentClinicStaff } from './clinic-staff-access'
import { sameOriginMutation } from './push-access'
import { readDocument } from './firebase-rest'
import { getWpSenderConfig, sendWpSenderMessage } from './wp-sender'
import {
  reserveWpSenderUsage,
  DEFAULT_WHATSAPP_SETTINGS,
} from './whatsapp-scheduler'
import { formatToE164 } from './ycloud-service'
import {
  renderClinicMessage,
  messageDefaults,
} from '@/lib/clinic-message-templates'

export async function sendClinicDocument(
  req: NextRequest,
  slug: string,
  id: string,
  kind: 'invoice' | 'prescription',
  load: () => Promise<Response>,
) {
  const reply = (data: unknown, status = 200) =>
    NextResponse.json(data, {
      status,
      headers: { 'Cache-Control': 'private, no-store' },
    })
  if (!sameOriginMutation(req)) return reply({ error: 'INVALID_ORIGIN' }, 403)
  const staff = await getCurrentClinicStaff(req, slug)
  if (!staff) return reply({ manual: true })
  const prefs = await readDocument(`clinic_whatsapp_configs/${staff.clinicId}`)
  if (prefs?.[kind === 'invoice' ? 'sendInvoice' : 'sendPrescription'] !== true)
    return reply({ manual: true })
  const wp = getWpSenderConfig(staff.clinicId)
  if (!wp || wp.mode === 'off')
    return reply(
      { error: 'فعّل WP Sender للعيادة أو اختر المشاركة اليدوية من الإعدادات' },
      409,
    )
  const result = await load()
  if (!result.ok) return result
  const data = await result.json()
  const record = data[kind === 'invoice' ? 'invoice' : 'appointment']
  if (
    !['doctor', 'assistant'].includes(data.accessorRole) ||
    !data.shareToken ||
    data.clinic?.id !== staff.clinicId ||
    !record?.phone
  )
    return reply({ error: 'تعذر التحقق من المستند أو رقم المريض' }, 403)
  const recipient = formatToE164(record.phone)
  const link = new URL(
    `/clinic/${encodeURIComponent(slug)}/${kind}/${encodeURIComponent(id)}`,
    'https://yalla-clinic.com',
  )
  link.searchParams.set('token', data.shareToken)
  const message = renderClinicMessage(
    (prefs.templates as Partial<typeof messageDefaults> | undefined)?.[kind] ||
      messageDefaults[kind],
    record.patientName || '',
    data.clinic.clinicName || '',
    record.date || '',
  )
  if (
    !(await reserveWpSenderUsage(
      staff.clinicId,
      Number(
        (prefs.settings as { monthlyLimit?: number } | undefined)
          ?.monthlyLimit ?? DEFAULT_WHATSAPP_SETTINGS.monthlyLimit,
      ),
      new Date().toISOString(),
      wp.mode === 'mock',
    ))
  )
    return reply({ error: 'تم بلوغ الحد الشهري للرسائل' }, 429)
  try {
    const delivery = await sendWpSenderMessage(
      wp,
      recipient,
      message + '\n' + link.href,
    )
    return reply({ status: delivery.status })
  } catch {
    return reply(
      {
        error:
          'تعذر تأكيد إرسال المستند. راجع سجل WP Sender قبل إعادة المحاولة.',
      },
      502,
    )
  }
}
