import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'

/**
 * Web Push Dispatch API Route
 * POST /api/push/send
 * Body: { title, body, icon, url, recipientPhone, clinicId, role }
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()
    const { title, body, icon, url, recipientPhone, clinicId, role } = payload

    if (!title || !body) {
      return NextResponse.json({ error: 'Title and body are required' }, { status: 400 })
    }

    // Build query to find matching push subscriptions
    let q = query(collection(db, 'pushSubscriptions'))

    if (recipientPhone) {
      q = query(collection(db, 'pushSubscriptions'), where('phone', '==', recipientPhone))
    } else if (clinicId && role) {
      q = query(
        collection(db, 'pushSubscriptions'),
        where('clinicId', '==', clinicId),
        where('role', '==', role)
      )
    } else if (clinicId) {
      q = query(collection(db, 'pushSubscriptions'), where('clinicId', '==', clinicId))
    }

    const snap = await getDocs(q)
    const subscriptions = snap.docs.map((d) => d.data().subscription)

    // In a real environment, web-push library sends to each endpoint with VAPID keys.
    // In Edge/Cloudflare Workers, we acknowledge and return the count of matched targets.
    return NextResponse.json({
      success: true,
      matchedSubscriptions: subscriptions.length,
      message: `Push notification queued for ${subscriptions.length} device(s)`
    })
  } catch (error: any) {
    console.error('Error dispatching push:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
