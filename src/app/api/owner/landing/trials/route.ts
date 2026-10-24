import { NextRequest, NextResponse } from 'next/server'
import { queryDocuments, writeDocument } from '@/lib/server/firebase-rest'
import {
  ApiError,
  apiFailure,
  readJson,
  requireOwner,
} from '@/lib/server/owner-access'
export async function GET(request: NextRequest) {
  try {
    await requireOwner(request)
    return NextResponse.json(
      { requests: await queryDocuments('trial_requests') },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    return apiFailure(error)
  }
}
export async function PATCH(request: NextRequest) {
  try {
    await requireOwner(request)
    const data = await readJson(request)
    if (
      typeof data.id !== 'string' ||
      !/^[\w-]{1,100}$/.test(data.id) ||
      !['new', 'contacted', 'activated'].includes(data.status)
    )
      throw new ApiError(400, 'INVALID_TRIAL', 'الطلب غير صالح.')
    await writeDocument(
      'trial_requests/' + data.id,
      { status: data.status },
      true,
    )
    return NextResponse.json({ success: true })
  } catch (error) {
    return apiFailure(error)
  }
}
