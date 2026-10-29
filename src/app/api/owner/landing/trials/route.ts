import { NextRequest, NextResponse } from 'next/server'
import { queryDocuments, writeDocument } from '@/lib/server/firebase-rest'
import {
  ApiError,
  apiFailure,
  readJson,
  requireOwner,
} from '@/lib/server/owner-access'

const VALID_STATUSES = [
  'new',
  'reviewing',
  'approved',
  'rejected',
  'clinic_created',
  'contacted',
  'activated'
]

export async function GET(request: NextRequest) {
  try {
    await requireOwner(request)
    const requests = await queryDocuments('trial_requests')
    return NextResponse.json(
      { requests },
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
      !/^[\w-]{1,100}$/.test(data.id)
    ) {
      throw new ApiError(400, 'INVALID_TRIAL', 'معرف الطلب غير صالح.')
    }

    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString()
    }

    if (data.status) {
      if (!VALID_STATUSES.includes(data.status)) {
        throw new ApiError(400, 'INVALID_STATUS', 'حالة الطلب غير صالحة.')
      }
      updates.status = data.status
    }

    if (typeof data.internalNotes === 'string') {
      updates.internalNotes = data.internalNotes
    }

    if (typeof data.rejectionReason === 'string') {
      updates.rejectionReason = data.rejectionReason
    }

    if (typeof data.createdClinicId === 'string') {
      updates.createdClinicId = data.createdClinicId
    }

    if (typeof data.createdClinicSlug === 'string') {
      updates.createdClinicSlug = data.createdClinicSlug
    }

    await writeDocument(
      'trial_requests/' + data.id,
      updates,
      true,
    )

    return NextResponse.json({ success: true, updates })
  } catch (error) {
    return apiFailure(error)
  }
}
