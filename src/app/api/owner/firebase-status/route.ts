import { NextRequest, NextResponse } from 'next/server'
import {
  getFirebaseServerCredentials, readDocument,
} from '@/lib/server/firebase-rest'
import { apiFailure, requireOwner } from '@/lib/server/owner-access'

export const dynamic = 'force-dynamic'
const expectedProject = 'clinic-os-d2d1b'
const noStore = { 'Cache-Control': 'private, no-store' }

/**
 * Owner-only live diagnostics for the server-side Firebase connection.
 * Never return Firebase service-account private keys, Google access tokens,
 * patient details, configuration secrets or internal Firestore data.
 * A successful read of a missing settings document (404) also proves that
 * the authenticated Firestore REST request completed.
 */
export async function GET(request: NextRequest) {
  try {
    await requireOwner(request)
    let projectId = ''
    try {
      projectId = getFirebaseServerCredentials().project
    } catch (error) {
      const type = error instanceof Error ? error.message : ''
      const code = ['FIREBASE_SERVER_NOT_CONFIGURED',
        'FIREBASE_SERVICE_ACCOUNT_INVALID',
        'FIREBASE_PROJECT_MISMATCH',
        'FIREBASE_SERVICE_ACCOUNT_MISMATCH'].includes(type)
        ? type : 'FIREBASE_SERVER_CONFIGURATION_ERROR'
      return NextResponse.json({
        success: false, projectId: expectedProject,
        credentialsConfigured: false, firestoreReachable: false, code,
      }, { status: 503, headers: noStore })
    }
    if (projectId !== expectedProject) {
      return NextResponse.json({
        success: false, projectId, credentialsConfigured: true,
        firestoreReachable: false, code: 'WRONG_FIREBASE_PROJECT',
      }, { status: 503, headers: noStore })
    }
    try {
      await readDocument('system/platformSettings')
    } catch (error) {
      const type = error instanceof Error ? error.message : ''
      const code = type === 'FIREBASE_SERVICE_AUTH_FAILED'
        ? 'SERVICE_ACCOUNT_AUTH_FAILED'
        : 'FIRESTORE_READ_FAILED'
      return NextResponse.json({
        success: false, projectId, credentialsConfigured: true,
        firestoreReachable: false, code,
      }, { status: 503, headers: noStore })
    }
    return NextResponse.json({
      success: true, projectId, credentialsConfigured: true,
      firestoreReachable: true,
      note: 'Server-side Firestore connectivity verified. Browser SDK permissions and Firestore index readiness require separate checks.',
    }, { headers: noStore })
  } catch (error) {
    return apiFailure(error)
  }
}
