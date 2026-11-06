import { NextResponse } from 'next/server'

// OTP mail is sent by the authenticated server-side reset flow. Direct public
// access used to allow arbitrary visitors to send mail to third parties.
export async function POST() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
