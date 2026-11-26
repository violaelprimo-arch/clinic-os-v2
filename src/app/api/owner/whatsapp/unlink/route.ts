import { NextRequest, NextResponse } from 'next/server'
import { authenticateOwnerRequest, readJson, apiFailure } from '@/lib/server/owner-access'
import { writeDocument, queryDocumentsByField } from '@/lib/server/firebase-rest'
import { unlinkWpSenderSession } from '@/lib/server/wp-sender'

export const dynamic = 'force-dynamic'

const noStore = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Content-Type': 'application/json',
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate Platform Owner
    await authenticateOwnerRequest(req)

    const body = await readJson(req)
    const clinicId = String(body?.clinicId || '').trim()

    if (!clinicId) {
      return NextResponse.json({ error: 'clinicId مطلوب' }, { status: 400, headers: noStore })
    }

    // 2. Unlink live session via WP Sender
    await unlinkWpSenderSession(clinicId).catch(() => null)

    const now = new Date().toISOString()

    // 3. Clear WhatsApp configuration on clinic_whatsapp_configs
    await writeDocument(
      `clinic_whatsapp_configs/${clinicId}`,
      {
        status: 'not_linked',
        sessionStatus: 'disconnected',
        connected: false,
        disconnectedAt: now,
        lastSyncAt: now,
        lastError: 'تم إلغاء الربط بواسطة مالك المنصة',
      },
      true,
    )

    // 4. Cancel any pending jobs for this clinic
    try {
      const pendingJobs = await queryDocumentsByField('whatsapp_jobs', 'clinicId', clinicId, 100)
      for (const job of pendingJobs) {
        if (job.status === 'pending' || job.status === 'queued' || job.status === 'waiting_for_connection') {
          await writeDocument(
            `whatsapp_jobs/${job.id}`,
            {
              status: 'cancelled',
              lastError: 'CLINIC_UNLINKED',
              updatedAt: now,
            },
            true,
          ).catch(() => {})
        }
      }
    } catch (e) {
      console.warn('[WhatsApp Unlink] Job cancellation warning:', e)
    }

    return NextResponse.json(
      { success: true, message: 'تم إلغاء ربط رقم واتساب للعيادة بنجاح' },
      { status: 200, headers: noStore },
    )
  } catch (err) {
    return apiFailure(err)
  }
}
