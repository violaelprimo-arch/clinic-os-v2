import { NextRequest, NextResponse } from 'next/server'
import { OWNER_COOKIE } from '@/lib/owner-session'
import { requireOwner, apiFailure, assertSameOrigin } from '@/lib/server/owner-access'

export async function GET(request: NextRequest) {
  try {
    const owner = await requireOwner(request)
    return NextResponse.json({ owner }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return apiFailure(error)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    assertSameOrigin(request)
    const response = NextResponse.json({ success: true })
    response.cookies.set(OWNER_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 0,
    })
    return response
  } catch (error) {
    return apiFailure(error)
  }
}
