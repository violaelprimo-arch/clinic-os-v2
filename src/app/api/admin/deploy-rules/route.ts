import { NextRequest, NextResponse } from 'next/server'
import { getFirebaseServerCredentials, signServiceJwt, createDocument } from '@/lib/server/firebase-rest'
import { authenticateOwnerRequest } from '@/lib/server/owner-access'

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
        'doctorEmail', 'doctorUsername', 'doctorPassword', 'doctorPasswordHash',
        'assistantEmail', 'assistantUsername', 'assistantPassword', 'assistantPasswordHash',
        'platformOwner', 'ownerUid', 'slug'
      ]);
    }

    // Clinics Collection (STRICT MULTI-TENANT ISOLATION - NO PUBLIC CREDENTIAL EXPOSURE)
    match /clinics/{clinicId} {
      allow read: if isPlatformOwner()
        || (isAuthenticated() && isClinicTenant(clinicId));
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

    // Invoices Collection (الفواتير - NO PUBLIC ACCESS)
    match /invoices/{invoiceId} {
      allow read: if isPlatformOwner()
        || (isAuthenticated() && isClinicTenant(resource.data.clinic_id));
      allow create, update, delete: if isPlatformOwner()
        || isClinicWritable(resource.data.clinic_id);
    }

    // Patient Accounts Collection
    match /patient_accounts/{patientId} {
      allow read: if isPlatformOwner()
        || (isAuthenticated() && (
          request.auth.uid == patientId ||
          request.auth.token.get('phone', '') == resource.data.phone
        ));
      allow create: if true;
      allow update: if isPlatformOwner()
        || (isAuthenticated() && request.auth.uid == patientId);
      allow delete: if isPlatformOwner();
    }

    // Services Catalog (خدمات الكشف)
    match /services/{serviceId} {
      allow read: if true;
      allow write: if isPlatformOwner()
        || (isAuthenticated() && isClinicTenant(resource.data.clinic_id));
    }

    // Market Prices (دليل الأدوية والأسعار الرسمية)
    match /market_prices/{drugId} {
      allow read: if true;
      allow write: if isPlatformOwner();
    }

    // Sync Logs & Locks
    match /market_prices_sync_logs/{logId} {
      allow read, write: if isPlatformOwner();
    }
    match /sync_locks/{lockId} {
      allow read, write: if isPlatformOwner();
    }

    // Audit Logs
    match /audit_logs/{logId} {
      allow read, write: if isPlatformOwner();
    }

    // Default deny for all other collections
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
`

async function getFirebaseRulesAccessToken(): Promise<string> {
  const { email } = getFirebaseServerCredentials()
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iss: email,
    scope: 'https://www.googleapis.com/auth/firebase.rules',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  }

  const jwt = await signServiceJwt(payload)
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  })

  const tokenData = (await tokenRes.json()) as any
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(`Failed to acquire Google OAuth token: ${JSON.stringify(tokenData)}`)
  }
  return tokenData.access_token
}

export async function GET(req: NextRequest) {
  try {
    // Authenticate Platform Owner only
    await authenticateOwnerRequest(req)

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
    return NextResponse.json({ error: error.message || 'Unauthorized or error fetching rules' }, { status: error.status || 401 })
  }
}

export async function POST(req: NextRequest) {
  try {
    // Authenticate Platform Owner only
    const owner = await authenticateOwnerRequest(req)

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

    // Record deployment in audit_logs
    await createDocument('audit_logs', {
      action: 'deploy_rules',
      performedBy: owner.email || 'platform_owner',
      ownerUid: owner.uid,
      rulesetName,
      timestamp: new Date().toISOString()
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      project,
      rulesetName,
      releaseData
    })
  } catch (error: any) {
    return NextResponse.json({
      error: error.message || 'Unauthorized or error deploying rules'
    }, { status: error.status || 401 })
  }
}
