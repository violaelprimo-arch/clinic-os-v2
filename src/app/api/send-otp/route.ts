import { NextResponse } from 'next/server'

// OTP generation, recipient selection and delivery are server-only operations.
// Keep the historical public URL closed; it must not be an arbitrary mail relay.
export async function POST() {
  return NextResponse.json({ error: 'استخدم مسار استعادة كلمة المرور' }, { status: 410 })
}
