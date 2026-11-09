import { NextResponse } from 'next/server'

// Security rules are deployed from the versioned firestore.rules artifact.
// A legacy HTTP endpoint must never republish an obsolete inline copy.
export async function GET() {
  return NextResponse.json({ error: 'هذا المسار متقاعد. قواعد الأمان تُنشر من الإعدادات المعتمدة.' }, { status: 410 })
}
export const POST = GET
