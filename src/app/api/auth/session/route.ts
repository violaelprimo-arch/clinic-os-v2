import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/auth-crypto'

export async function GET(req: NextRequest) {
  const token = req.cookies.get('clinic_session')?.value || req.headers.get('Authorization')?.replace('Bearer ', '')

  if (!token) {
    return NextResponse.json({ authenticated: false, error: 'NO_TOKEN' }, { status: 401 })
  }

  const result = await verifySessionToken(token)

  if (!result.valid) {
    return NextResponse.json({ authenticated: false, error: result.error }, { status: 401 })
  }

  return NextResponse.json({
    authenticated: true,
    user: result.payload
  })
}

export async function DELETE(req: NextRequest) {
  const response = NextResponse.json({ success: true, message: 'LOGGED_OUT' })
  response.cookies.delete('clinic_session')
  return response
}
