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
    const list = await queryDocuments('landing_inquiries').catch(() => [])
    const inquiries = list.sort((a: any, b: any) =>
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    )
    return NextResponse.json({ inquiries }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return apiFailure(error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireOwner(request)
    const data = await readJson(request)

    if (typeof data.id !== 'string' || !/^[\w-]{1,100}$/.test(data.id)) {
      throw new ApiError(400, 'INVALID_ID', 'معرف الرسالة غير صالح.')
    }

    const updates: Record<string, any> = {}

    if (data.status) {
      if (!['new', 'in_progress', 'resolved', 'closed'].includes(data.status)) {
        throw new ApiError(400, 'INVALID_STATUS', 'حالة الرسالة غير صالحة.')
      }
      updates.status = data.status
    }

    if (data.internalNotes !== undefined) {
      updates.internalNotes = String(data.internalNotes || '').slice(0, 2000)
    }

    await writeDocument('landing_inquiries/' + data.id, updates, true)

    return NextResponse.json({ success: true })
  } catch (error) {
    return apiFailure(error)
  }
}
