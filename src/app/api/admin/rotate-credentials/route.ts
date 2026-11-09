import { NextRequest, NextResponse } from 'next/server'
import { readDocument, writeDocument, createDocument } from '@/lib/server/firebase-rest'
import { hashPassword } from '@/lib/auth-crypto'
import { authenticateOwnerRequest, assertSameOrigin } from '@/lib/server/owner-access'

export const dynamic = 'force-dynamic'

function generateSecureRandomPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, b => b.toString(36).padStart(2, '0')).join('').slice(0, 16) + '!Aa1'
}

/**
 * Administrative Credential Rotation Route:
 * Disabled in production by default. Does not perform mass shared-password overwrites
 * or heuristic deletion of patient appointments.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Permanently disabled in production unless explicit staging flag is enabled
    if (process.env.NODE_ENV === 'production' && process.env.ENABLE_ADMIN_ROTATION_API !== 'true') {
      return NextResponse.json(
        { error: 'تم تعطيل مسار تدوير بيانات الاعتماد في بيئة الإنتاج لحماية الحسابات والبيانات.' },
        { status: 403 }
      )
    }

    // 2. CSRF Verification
    assertSameOrigin(req)

    // 3. Authenticate Platform Owner only
    const owner = await authenticateOwnerRequest(req)

    const body = await req.json().catch(() => ({}))
    const targetClinicId = typeof body.clinicId === 'string' ? body.clinicId.trim() : null

    if (!targetClinicId) {
      return NextResponse.json(
        { error: 'يجب تحديد معرف العيادة المستهدفة (clinicId) لمنع التغيير الجماعي غير المقصود.' },
        { status: 400 }
      )
    }

    const doc = await readDocument(`clinics/${targetClinicId}`)
    if (!doc) {
      return NextResponse.json({ error: 'العيادة المحددة غير موجودة' }, { status: 404 })
    }

    // Require unique explicit password per account
    const doctorPass = body.doctorPassword || generateSecureRandomPassword()
    const doctorHash = await hashPassword(doctorPass)
    const now = new Date().toISOString()

    await writeDocument(`clinics/${targetClinicId}`, {
      doctorPassword: null,
      doctorPasswordHash: doctorHash,
      passwordLastChangedAt: now,
      mustChangePassword: true,
      updatedAt: now
    }, true)

    // Record credential rotation in audit_logs
    await createDocument('audit_logs', {
      action: 'rotate_credentials_single',
      performedBy: owner.email || 'platform_owner',
      ownerUid: owner.uid,
      targetClinicId,
      timestamp: now
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      timestamp: now,
      clinicId: targetClinicId,
      message: 'تم تحديث كلمة مرور العيادة المستهدفة بنجاح ووضع علامة طلب تغيير كلمة المرور.'
    })
  } catch (error: any) {
    return NextResponse.json({
      error: error.message || 'Unauthorized or failed to rotate credentials'
    }, { status: error.status || 401 })
  }
}
