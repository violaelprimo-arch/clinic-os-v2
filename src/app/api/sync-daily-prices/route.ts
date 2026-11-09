import { NextRequest, NextResponse } from 'next/server'
import { getClinicDoctorAccount } from '@/lib/server/clinic-credential-access'
import { isClinicSuspended } from '@/lib/clinicAccessPolicy'
import { getDrugSyncStatus, runDrugPriceSync } from '@/lib/server/drug-price-sync'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const noStore = { 'Cache-Control': 'no-store' }

async function verifyScheduledSecret(given: string | null) {
  const expected = process.env.DRUG_SYNC_SECRET
  if (!expected || expected.length < 32 || !given || given.length !== expected.length) return false
  const a = new TextEncoder().encode(given)
  const b = new TextEncoder().encode(expected)
  let mismatch = 0
  for (let i = 0; i < a.length; i++) mismatch |= a[i] ^ b[i]
  return mismatch === 0
}

// Read-only status. GET must never trigger a Firestore write or a web scrape.
export async function GET() {
  try {
    const status = await getDrugSyncStatus()
    return NextResponse.json({
      success: true,
      source: 'https://www.dawaagate.com',
      state: status.state || 'never',
      lastSuccessAt: status.lastSuccessAt || null,
      lastSuccessDate: status.lastSuccessDate || null,
      lastAttemptAt: status.lastAttemptAt || status.startedAt || null,
      updated_count: status.updated_count || 0,
      lastError: status.lastError || null,
      schedule: '06:00 Africa/Cairo (retry hourly until 09:00 on failure)',
    }, { headers: noStore })
  } catch {
    return NextResponse.json({ success: false, error: 'تعذر قراءة حالة المزامنة' }, { status: 503, headers: noStore })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const query = typeof body.q === 'string' ? body.q.trim() : ''
    if (query.length > 80) {
      return NextResponse.json({ success: false, error: 'نص البحث طويل جدًا' }, { status: 400 })
    }
    const scheduled = await verifyScheduledSecret(request.headers.get('x-drug-sync-secret'))
    if (!scheduled) {
      const slug = typeof body.slug === 'string' ? body.slug.trim() : ''
      if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(slug)) {
        return NextResponse.json({ success: false, error: 'معرف العيادة مطلوب للتحديث اليدوي' }, { status: 400 })
      }
      const account = await getClinicDoctorAccount(request, slug)
      if (!account.ok) {
        return NextResponse.json({ success: false, error: account.error }, { status: account.status })
      }
      if (isClinicSuspended(account.clinic)) {
        return NextResponse.json({ success: false, error: 'الاشتراك منتهي' }, { status: 403 })
      }
    }
    const output = await runDrugPriceSync({ mode: scheduled ? 'scheduled' : 'manual', query: scheduled ? '' : query })
    return NextResponse.json(output, { status: output.success ? 200 : 409, headers: noStore })
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'DRUG_SYNC_FAILED'
    const external = reason.startsWith('DAWAAGATE') || reason.startsWith('PARTIAL_SYNC')
    console.error('[drug-sync-api]', reason)
    return NextResponse.json({
      success: false,
      error: external
        ? 'تعذر قراءة أسعار صحيحة من مصدر الدواء حاليًا. لم يتم حذف البيانات القديمة؛ ستتم إعادة المحاولة تلقائيًا.'
        : 'فشل تحديث الأسعار. لم يتم تعديل قاعدة الأدوية الأساسية؛ راجع سجل المزامنة.',
      code: reason,
    }, { status: external ? 502 : 503, headers: noStore })
  }
}
