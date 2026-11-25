import { NextRequest, NextResponse } from 'next/server'
import { getCurrentClinicStaff } from '@/lib/server/clinic-staff-access'
import { sameOriginMutation } from '@/lib/server/push-access'
import { readDocument, writeDocument } from '@/lib/server/firebase-rest'
import { messageDefaults } from '@/lib/clinic-message-templates'
import { getWpSenderConfig } from '@/lib/server/wp-sender'

type Context = { params: Promise<{ slug: string }> }
const response = (data: unknown, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  })

function pairing(id: string) {
  const entries = JSON.parse(process.env.WPSENDER_CLINICS_JSON || '{}')
  const entry = entries[id]
  if (!entry?.apiKey || !/^[\w-]{1,80}$/.test(String(entry.sessionId || '')))
    return null
  if (
    Object.values(entries).filter(
      (e: any) => String(e.sessionId) === String(entry.sessionId),
    ).length !== 1
  )
    return null
  return entry
}

export async function GET(req: NextRequest, { params }: Context) {
  const staff = await getCurrentClinicStaff(req, (await params).slug)
  if (staff?.user.role !== 'doctor')
    return response({ error: 'الدخول بحساب الدكتور مطلوب' }, 403)
  const entry = pairing(staff.clinicId)
  if (req.nextUrl.searchParams.has('qr')) {
    if (!entry)
      return response(
        { error: 'يلزم تخصيص جلسة WP Sender لهذه العيادة من حساب المالك.' },
        409,
      )
    const upstream = await fetch(
      `https://backendapi.wpsenderx.com/api/whatsapp-session/${entry.sessionId}/qr?output=image`,
      {
        headers: { 'X-API-Key': entry.apiKey },
        redirect: 'error',
        cache: 'no-store',
        signal: AbortSignal.timeout(12000),
      },
    )
    if (
      !upstream.ok ||
      !upstream.headers.get('content-type')?.startsWith('image/png')
    )
      return response(
        { error: 'تعذر تحميل الكود. راجع اتصال الجلسة والاشتراك.' },
        502,
      )
    return new Response(upstream.body, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  }
  const doc = await readDocument(`clinic_whatsapp_configs/${staff.clinicId}`)
  return response({
    templates: {
      ...messageDefaults,
      ...(doc?.templates as Partial<typeof messageDefaults> | undefined),
    },
    prescription: doc?.sendPrescription === true,
    invoice: doc?.sendInvoice === true,
    qrReady: Boolean(entry),
    mode: getWpSenderConfig(staff.clinicId)?.mode || 'off',
  })
}

export async function POST(req: NextRequest, { params }: Context) {
  if (!sameOriginMutation(req))
    return response({ error: 'INVALID_ORIGIN' }, 403)
  const staff = await getCurrentClinicStaff(req, (await params).slug)
  if (staff?.user.role !== 'doctor')
    return response({ error: 'الدخول بحساب الدكتور مطلوب' }, 403)
  const data = await req.json()
  const templates: Record<string, string> = {}
  for (const key of Object.keys(messageDefaults)) {
    const value = data.templates?.[key]
    if (typeof value !== 'string' || !value.trim() || value.length > 1000)
      return response({ error: 'اكتب نصًا من ١ إلى ١٠٠٠ حرف لكل رسالة' }, 400)
    templates[key] = value.trim()
  }
  await writeDocument(
    `clinic_whatsapp_configs/${staff.clinicId}`,
    {
      templates,
      sendPrescription: data.prescription === true,
      sendInvoice: data.invoice === true,
    },
    true,
  )
  return response({ success: true })
}
