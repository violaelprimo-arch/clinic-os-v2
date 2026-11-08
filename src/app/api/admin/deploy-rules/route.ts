import { NextRequest, NextResponse } from 'next/server'
import { getFirebaseServerCredentials, signServiceJwt } from '@/lib/server/firebase-rest'

// Content of hardened production firestore.rules
const FIRESTORE_RULES_SOURCE = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    function isAuthenticated() {
      return request.auth != null;
    }

    function isPlatformOwner() {
      return request.auth != null
        && request.auth.token.get('platformOwner', false) == true
        && request.auth.token.get('ownerEmail', '') == 'yallacodex@gmail.com'
        && request.auth.token.get('ownerUid', '') == request.auth.uid
        && request.auth.token.get('email_verified', false) == true;
    }

    function isClinicTenant(clinicId) {
      return isAuthenticated() && (
        isPlatformOwner() ||
        request.auth.token.get('clinic_id', '') == clinicId ||
        request.auth.token.get('clinicId', '') == clinicId ||
        request.auth.uid == clinicId
      );
    }

    function isClinicWritable(clinicId) {
      return isClinicTenant(clinicId)
        && exists(/databases/$(database)/documents/clinics/$(clinicId))
        && get(/databases/$(database)/documents/clinics/$(clinicId)).data.get('isActive', true) != false;
    }

    // Platform Owner & Site Settings
    match /site_settings/landing_page {
      allow get: if true;
      allow list, write: if isPlatformOwner();
    }
    match /site_settings/{settingId} {
      allow read, write: if isPlatformOwner();
    }
    match /landing_feedback/{id} { allow read, write: if isPlatformOwner(); }
    match /trial_requests/{id} { allow read, write: if isPlatformOwner(); }
    match /landing_inquiries/{id} { allow read, write: if isPlatformOwner(); }
    match /landing_rate_limits/{id} { allow read, write: if false; }
    match /owners/{ownerId} { allow read, write: if isPlatformOwner(); }
    match /settings/{settingId} { allow read, write: if isPlatformOwner(); }

    // Never allow a tenant to change owner-controlled subscription rights or
    // visibility policy directly from the browser SDK.
    function hasNoOwnerOnlyClinicChanges() {
      return !request.resource.data.diff(resource.data).affectedKeys().hasAny([
        'isActive', 'expirationDate', 'activationDate', 'hiddenTabs', 'hiddenSections',
        'packageName', 'packageId', 'packagePermissions', 'packagePrice', 'isPaid',
        'paymentStatus', 'paidAmount', 'branchesEnabled', 'maxBranches',
        'branchCreationAllowed', 'allowFinance', 'allowDrugs', 'allowPrescriptions',
        'allowCustomTemplate', 'allowOnlineBooking', 'allowTvScreen',
        'allowDoctorEditBranding', 'allowAnalytics', 'aiLockedByOwner',
        'doctorEmail', 'doctorPassword', 'doctorPasswordHash',
        'assistantEmail', 'assistantPassword', 'assistantPasswordHash',
        'platformOwner', 'ownerUid', 'slug'
      ]);
    }

    // Clinics Collection
    match /clinics/{clinicId} {
      allow read: if true;
      allow create: if isPlatformOwner();
      allow update: if isPlatformOwner() ||
        (isClinicWritable(clinicId) && hasNoOwnerOnlyClinicChanges());
      allow delete: if isPlatformOwner();
    }

    // Branches Collection (فروع العيادة)
    match /branches/{branchId} {
      allow read: if true;
      allow create: if isPlatformOwner();
      allow update: if isPlatformOwner() ||
        (isClinicWritable(resource.data.clinic_id)
          && request.resource.data.diff(resource.data).affectedKeys().hasOnly([
            'weeklySchedule', 'workingHours', 'isOpen', 'slotDuration',
            'maxDailyBookings', 'updatedAt'
          ]));
      allow delete: if isPlatformOwner();
    }

    // Appointments Collection (STRICT MULTI-TENANT ISOLATION - NO PUBLIC ACCESS)
    match /appointments/{apptId} {
      allow read: if isPlatformOwner()
        || (isAuthenticated() && isClinicTenant(resource.data.clinic_id));
      allow create: if isPlatformOwner()
        || isClinicWritable(request.resource.data.clinic_id);
      allow update, delete: if isPlatformOwner()
        || isClinicWritable(resource.data.clinic_id);
    }

    // Prescriptions Collection (الروشتات الطبية - NO PUBLIC ACCESS)
    match /prescriptions/{prescriptionId} {
      allow read: if isPlatformOwner()
        || (isAuthenticated() && isClinicTenant(resource.data.clinic_id));
      allow create: if isPlatformOwner()
        || isClinicWritable(request.resource.data.clinic_id);
      allow update, delete: if isPlatformOwner()
        || isClinicWritable(resource.data.clinic_id);
    }

    // Patient Accounts (حسابات وسجلات المرضى - NO PUBLIC ACCESS)
    match /patient_accounts/{accId} {
      allow read: if isPlatformOwner()
        || (isAuthenticated() && isClinicTenant(resource.data.clinic_id));
      allow create: if isPlatformOwner()
        || isClinicWritable(request.resource.data.clinic_id);
      allow update, delete: if isPlatformOwner()
        || isClinicWritable(resource.data.clinic_id);
    }

    // Notifications & Outbox (NO PUBLIC ACCESS)
    match /notifications/{notifId} {
      allow read: if isPlatformOwner()
        || (isAuthenticated() && isClinicTenant(resource.data.clinic_id));
      allow write: if isPlatformOwner()
        || isClinicWritable(request.resource.data.clinic_id);
    }
    match /notification_outbox/{outboxId} {
      allow read, write: if isPlatformOwner();
    }
    match /pushSubscriptions/{subId} {
      allow read: if isPlatformOwner();
      allow write: if request.resource.data.endpoint != null;
    }
    match /push_subscriptions/{subId} {
      allow read: if isPlatformOwner();
      allow write: if request.resource.data.endpoint != null;
    }
    match /push_outbox/{outboxId} {
      allow read, write: if isPlatformOwner();
    }

    // Daily counters for atomic sequential turns (NO PUBLIC READ/WRITE)
    match /clinic_daily_counters/{counterId} {
      allow read: if isPlatformOwner()
        || (isAuthenticated() && isClinicTenant(resource.data.clinicId));
      allow create: if isPlatformOwner()
        || isClinicWritable(request.resource.data.clinicId);
      allow update, delete: if isPlatformOwner()
        || isClinicWritable(resource.data.clinicId);
    }

    // System, Packages & Audit Logs
    match /packages/{pkgId} {
      allow read: if true;
      allow write: if isPlatformOwner();
    }
    match /platformSettings/{settingId} {
      allow read: if true;
      allow write: if isPlatformOwner();
    }
    match /system/{sysId} {
      allow read, write: if isPlatformOwner();
    }
    match /market_prices/{priceId} {
      allow read: if true;
      allow write: if isPlatformOwner();
    }
    match /audit_logs/{logId} {
      allow read: if isPlatformOwner();
      allow create: if isAuthenticated() || isPlatformOwner();
      allow update, delete: if false;
    }
  }
}
`

async function getFirebaseRulesAccessToken() {
  const { email } = getFirebaseServerCredentials()
  const now = Math.floor(Date.now() / 1000)

  const assertion = await signServiceJwt({
    iss: email,
    scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
    cache: 'no-store',
  })

  const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string; error_description?: string }
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(`Failed to acquire Google OAuth token: ${JSON.stringify(tokenData)}`)
  }
  return tokenData.access_token
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    const secret = req.headers.get('x-admin-key')
    if (secret !== 'yalla-secret-deploy-2026' && authHeader !== 'Bearer yalla-secret-deploy-2026') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { project } = getFirebaseServerCredentials()
    const accessToken = await getFirebaseRulesAccessToken()

    const releaseUrl = `https://firebaserules.googleapis.com/v1/projects/${encodeURIComponent(project)}/releases/cloud.firestore`
    const releaseRes = await fetch(releaseUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store'
    })
    const releaseData = (await releaseRes.json()) as any
    if (!releaseRes.ok) {
      return NextResponse.json({ error: 'Failed to get release', details: releaseData }, { status: 500 })
    }

    let rulesetData: any = null
    if (releaseData.rulesetName) {
      const rulesetUrl = `https://firebaserules.googleapis.com/v1/${releaseData.rulesetName}`
      const rulesetRes = await fetch(rulesetUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store'
      })
      rulesetData = await rulesetRes.json()
    }

    return NextResponse.json({
      success: true,
      project,
      release: releaseData,
      ruleset: rulesetData
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unknown error fetching rules' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    const secret = req.headers.get('x-admin-key')
    // Safe validation
    if (secret !== 'yalla-secret-deploy-2026' && authHeader !== 'Bearer yalla-secret-deploy-2026') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { project } = getFirebaseServerCredentials()
    const accessToken = await getFirebaseRulesAccessToken()

    // 1. Create Ruleset
    const rulesetUrl = `https://firebaserules.googleapis.com/v1/projects/${encodeURIComponent(project)}/rulesets`
    const createRes = await fetch(rulesetUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        source: {
          files: [
            {
              name: 'firestore.rules',
              content: FIRESTORE_RULES_SOURCE
            }
          ]
        }
      })
    })

    const createData = (await createRes.json()) as any
    if (!createRes.ok || !createData.name) {
      return NextResponse.json({
        error: 'Failed to create ruleset in Firebase Rules API',
        details: createData
      }, { status: 500 })
    }

    const rulesetName = createData.name

    // 2. Update Release (cloud.firestore)
    const releaseUrl = `https://firebaserules.googleapis.com/v1/projects/${encodeURIComponent(project)}/releases/cloud.firestore`
    const releaseRes = await fetch(releaseUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        release: {
          name: `projects/${project}/releases/cloud.firestore`,
          rulesetName
        }
      })
    })

    const releaseData = (await releaseRes.json()) as any
    if (!releaseRes.ok) {
      return NextResponse.json({
        error: 'Failed to release ruleset to cloud.firestore',
        details: releaseData
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      project,
      rulesetName,
      releaseData
    })
  } catch (error: any) {
    return NextResponse.json({
      error: error.message || 'Unknown error deploying rules'
    }, { status: 500 })
  }
}
