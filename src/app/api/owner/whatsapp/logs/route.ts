import { NextRequest, NextResponse } from 'next/server'
import { authenticateOwnerRequest, assertSameOrigin, apiFailure } from '@/lib/server/owner-access'
import { queryDocuments, queryDocumentsByField, readDocument, writeDocument } from '@/lib/server/firebase-rest'
import {
  retryWhatsAppJobById,
  drainPendingWhatsAppJobs,
  requeueWaitingJobsForClinic,
  getClinicWhatsAppConfig,
} from '@/lib/server/whatsapp-scheduler'
import { checkWpSenderSessionHealth, sendWpSenderMessage } from '@/lib/server/wp-sender'

export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'no-store' }

export async function GET(req: NextRequest) {
  try {
    await authenticateOwnerRequest(req)
    const clinicId = req.nextUrl.searchParams.get('clinicId')?.trim() || ''
    const statusFilter = req.nextUrl.searchParams.get('status')?.trim() || ''

    const jobsRaw = clinicId
      ? await queryDocumentsByField('whatsapp_jobs', 'clinicId', clinicId, 120).catch(() => [])
      : await queryDocuments('whatsapp_jobs').catch(() => [])

    const sorted = jobsRaw
      .sort((a: any, b: any) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))
    const filtered = statusFilter ? sorted.filter((j: any) => j.status === statusFilter) : sorted

    const stats = {
      total: jobsRaw.length,
      queued: jobsRaw.filter((j: any) => j.status === 'queued' || j.status === 'pending').length,
      waiting_for_connection: jobsRaw.filter((j: any) => j.status === 'waiting_for_connection').length,
      processing: jobsRaw.filter((j: any) => j.status === 'processing').length,
      sent: jobsRaw.filter((j: any) => j.status === 'sent').length,
      delivered: jobsRaw.filter((j: any) => j.status === 'delivered').length,
      failed: jobsRaw.filter((j: any) => j.status === 'failed').length,
      uncertain: jobsRaw.filter((j: any) => j.status === 'uncertain').length,
      cancelled: jobsRaw.filter((j: any) => j.status === 'cancelled').length,
      expired: jobsRaw.filter((j: any) => j.status === 'expired').length,
    }

    return NextResponse.json(
      {
        stats,
        jobs: filtered.slice(0, 100),
      },
      { headers: noStore },
    )
  } catch (err) {
    return apiFailure(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const owner = await authenticateOwnerRequest(req)
    assertSameOrigin(req)
    const body = await req.json().catch(() => ({}))
    const action = String(body?.action || '')

    if (action === 'retry_job') {
      const jobId = String(body?.jobId || '').trim()
      if (!jobId) {
        return NextResponse.json({ error: 'معرف الرسالة مطلوب' }, { status: 400, headers: noStore })
      }
      const res = await retryWhatsAppJobById(jobId, owner.uid, {
        allowUncertainRetry: body?.allowUncertainRetry === true,
      })
      return NextResponse.json({ success: res.outcome === 'sent', result: res }, { headers: noStore })
    }

    if (action === 'cancel_job') {
      const jobId = String(body?.jobId || '').trim()
      if (!jobId) {
        return NextResponse.json({ error: 'معرف الرسالة مطلوب' }, { status: 400, headers: noStore })
      }
      const job = await readDocument(`whatsapp_jobs/${jobId}`)
      if (!job) {
        return NextResponse.json({ error: 'الرسالة غير موجودة' }, { status: 404, headers: noStore })
      }
      if (job.status === 'sent' || job.status === 'delivered') {
        return NextResponse.json({ error: 'لا يمكن إلغاء رسالة تم إرسالها بالفعل' }, { status: 400, headers: noStore })
      }
      const now = new Date().toISOString()
      await writeDocument(
        `whatsapp_jobs/${jobId}`,
        {
          status: 'cancelled',
          lastError: 'CANCELLED_BY_OWNER',
          updatedAt: now,
          cancelledBy: owner.uid,
        },
        true,
      )
      return NextResponse.json({ success: true, jobId }, { headers: noStore })
    }

    if (action === 'test_preview') {
      const phone = String(body?.phone || '').trim()
      const message = String(body?.message || '').trim()
      const clinicId = String(body?.clinicId || '').trim() || 'clinic-demo'
      if (!phone || !message) {
        return NextResponse.json({ error: 'رقم الهاتف ونص الرسالة مطلوبان' }, { status: 400, headers: noStore })
      }
      const res = await sendWpSenderMessage({
        clinicId,
        phone,
        message,
      }).catch((err: any) => ({
        ok: false,
        error: err?.message || 'SEND_ERROR',
        mode: 'off',
      }))
      return NextResponse.json({ success: res.ok, result: res }, { headers: noStore })
    }

    if (action === 'drain_due') {
      const res = await drainPendingWhatsAppJobs(30)
      return NextResponse.json({ success: true, result: res }, { headers: noStore })
    }

    if (action === 'recheck_clinic') {
      const clinicId = String(body?.clinicId || '').trim()
      if (!clinicId) return NextResponse.json({ error: 'معرف العيادة مطلوب' }, { status: 400, headers: noStore })
      const cfg = await getClinicWhatsAppConfig(clinicId)
      const health = await checkWpSenderSessionHealth(clinicId, { persistedStatus: cfg?.sessionStatus })
      let resumed: any = null
      if (health.connected) {
        resumed = await requeueWaitingJobsForClinic(clinicId, { drainImmediately: true })
      }
      return NextResponse.json({ success: health.connected, health, resumed }, { headers: noStore })
    }

    return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400, headers: noStore })
  } catch (err) {
    return apiFailure(err)
  }
}
