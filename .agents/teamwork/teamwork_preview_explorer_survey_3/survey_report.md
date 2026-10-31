# Comprehensive Survey & Audit Report: Multi-Tenant Security, Financial Integrity, and Automated E2E Testing Landscape

**Project**: Clinic OS V2 (Yalla Clinic SaaS)  
**Investigation Date**: 2026-10-27  
**Explorer Agent**: `teamwork_preview_explorer_survey_3`  
**Scope**: Requirements R3 & R5; Acceptance Criteria C2 & C4  
**Integrity Mode**: Read-Only Source Code Analysis & Architecture Survey  

---

## 1. Executive Summary

This investigation was conducted to perform a comprehensive security, architecture, and testing audit of **Clinic OS V2**, focusing on:
1. **Multi-Tenant Security & Session Isolation**: How tenant boundaries (`clinic_id` / slug) are enforced across routing middleware, client components, server actions, REST APIs, and Firestore security rules.
2. **Financial Data Integrity**: Evaluating financial calculations in `/admin/accounts`, `/admin/finance`, invoices, thermal receipts, and Excel exports, with specific focus on floating-point precision, query scoping, and root causes for Cloudflare Worker CPU timeouts (Error 1102).
3. **Automated E2E Testing Landscape**: Evaluating the existing Playwright / `node:test` framework, verifying TypeScript integrity (`tsc --noEmit`), and architecting an end-to-end testing matrix covering the 4 core platform personas (Platform Owner, Doctor, Receptionist, Patient) with isolated synthetic data fixtures.

### Key Audit Findings Overview

| Category | Severity | Summary of Observation |
| :--- | :--- | :--- |
| **Firestore Security Rules** | **CRITICAL** | `firestore.rules` contains `match /{document=**} { allow read, write: if true; }`. Collections (`clinics`, `appointments`, `prescriptions`, `patient_accounts`) are world-readable and world-writable. |
| **Patient Profile IDOR / Leak** | **CRITICAL** | `src/app/clinic/[slug]/admin/patients/[patientId]/page.tsx` line 206 queries `where('phone', '==', phone)` globally without `clinic_id`, leaking medical history and prescriptions across different clinics. |
| **Public Invoice & Rx IDOR** | **HIGH** | `/clinic/[slug]/invoice/[invoiceId]` and `/clinic/[slug]/prescription/[appointmentId]` directly retrieve documents by ID without verifying if the appointment belongs to the requested clinic slug. |
| **Queue Privacy Leak** | **HIGH** | `/clinic/[slug]/track/[appointmentId]` subscribes to the entire day's clinic queue, loading names, phone numbers, and services of all other patients into the tracking patient's client state. |
| **Patient Auth & Passwords** | **HIGH** | `patient_accounts` stores plaintext passwords. Portal authentication relies entirely on unverified `localStorage.getItem('patient_auth')` with no cryptographic session signature. |
| **Financial Query CPU Timeout** | **HIGH** | `/clinic/[slug]/admin/accounts` and `/clinic/[slug]/admin/finance` query all historical appointments for a clinic without pagination or DB date indexing, causing Cloudflare Worker CPU timeouts. |
| **Financial Precision & Mutation** | **MEDIUM** | Standard IEEE-754 float arithmetic used without integer cent rounding. Applying a discount permanently mutates `servicePrice` in Firestore, corrupting original price references. |
| **E2E Testing Coverage** | **MEDIUM** | Existing Playwright suite only covers the static landing page (`landing.browser.spec.ts`). Zero automated E2E tests exist for Platform Owner, Doctor, Receptionist, or Patient personas. |

---

## 2. Multi-Tenant Security & Session Isolation (Requirement R5 & Criterion C2)

### 2.1 Database Security Rules (`firestore.rules`)
An inspection of `e:\progict\clinic-os-v2\firestore.rules` reveals a severe security misconfiguration. While lines 5-11 define an `isPlatformOwner()` helper:
```javascript
function isPlatformOwner() {
  return request.auth != null
    && request.auth.token.platformOwner == true
    && request.auth.token.ownerEmail == 'yallacodex@gmail.com'
    && request.auth.token.ownerUid == request.auth.uid
    && request.auth.token.email_verified == true;
}
```
That helper is only applied to `/site_settings/landing_page`, `/landing_feedback/{id}`, and `/trial_requests/{id}`. For all multi-tenant collections:
- `clinics`: `allow read: if true; allow write: if true;` (lines 23-26)
- `appointments`: `allow read: if true; allow write: if true;` (lines 29-32)
- `prescriptions`: `allow read: if true; allow create, update, delete: if true;` (lines 35-40)
- `patient_accounts`: `allow read, write: if true;` (lines 43-45)
- `branches`: `allow read, write: if true;` (lines 48-50)
- Fallback wildcard (lines 92-94):
  ```javascript
  match /{document=**} {
    allow read, write: if true;
  }
  ```
**Impact**: Because the Firebase client config (`apiKey`, `projectId`) is embedded in client bundles (`src/lib/firebase.ts`), any unauthenticated user or script can directly read, alter, or drop any document in Firestore without invoking Next.js middleware or server endpoints.

---

### 2.2 Middleware & Subdomain Routing Analysis (`src/middleware.ts`)
Inspection of `src/middleware.ts`:
- **Scanner Probe Drop**: Lines 12-28 immediately return 404 for paths matching `wp-`, `wlwmanifest`, `xmlrpc`, `.php`, `.env`, `.git`.
- **Static Assets Bypass**: Skips `/_next`, `/api`, `/icons`, etc.
- **Subdomain Extraction & Rewriting**:
  * `owner.yalla-clinic.com` -> rewrites to `/owner` (line 69).
  * `[slug].yalla-clinic.com` -> rewrites to `/clinic/[slug]` (line 90) and attaches header `x-clinic-slug`.
- **Vulnerability**: `src/middleware.ts` executes **zero session verification** and **zero cookie authentication** for protected routes. Anyone navigating to `/clinic/any-slug/admin` or `/owner` is rewritten directly without authentication gatekeeping at the edge.

---

### 2.3 Session Authorization & Role-Based Access Control (RBAC)

#### A. Platform Owner RBAC
- **Architecture**:
  * Uses HMAC SHA-256 signed sessions stored in the `owner_session` HTTP-only cookie (`src/lib/owner-session.ts`).
  * Sign-in requires Firebase Auth using `yallacodex@gmail.com` and exchanges an ID token at `/api/auth/owner-login` (`src/app/api/auth/owner-login/route.ts`).
  * Frontend is gated by `<OwnerAccessGate>` (`src/components/owner/OwnerAccessGate.tsx`).
- **Deficiency**: While the API routes (`/api/owner/landing/...`) verify the cookie via `src/lib/server/owner-access.ts`, the actual Owner Dashboard (`src/app/owner/OwnerDashboardClient.tsx`) performs direct client-side Firestore calls (`addDoc(collection(db, 'clinics'), ...)`). Because `firestore.rules` is open, the gate only guards the UI, not the underlying database operations.

#### B. Clinic Staff (Doctor & Receptionist / Assistant)
- **Authentication**:
  * `POST /api/auth/login` (`src/app/api/auth/login/route.ts`) checks `email` and `password` against the clinic document's `doctorEmail`/`doctorPasswordHash` or `assistantEmail`/`assistantPasswordHash` (or secondary assistants array).
  * On success, issues a signed session token via `createSessionToken` (`src/lib/auth-crypto.ts`) using `AUTH_SECRET` and sets `clinic_session` cookie as well as returning JSON token.
- **Guard Weakness in Admin Layout** (`src/app/clinic/[slug]/admin/layout.tsx`):
  * Lines 117-118:
    ```typescript
    const storedRole = localStorage.getItem('clinic_role') || 'doctor'
    setRole(storedRole)
    ```
    If `clinic_role` is not set in `localStorage`, it **defaults to `'doctor'`**.
  * Lines 132-159: If `clinic_session_token` is present in `localStorage`, it queries `/api/auth/session`. However, if the token is missing or if the request fails, the layout executes:
    ```typescript
    .finally(() => setSessionVerified(true))
    ```
    It **never redirects unauthenticated users** to `/clinic/${slug}/login`! The admin page renders `{children}` regardless of authentication state.
  * Clinic staff RBAC (Doctor vs Assistant) is strictly checked only in navigation filtering (e.g. hiding tabs or blocking direct access to `/admin/branches` via `if (storedRole === 'assistant')`).

#### C. Patient Authentication & Session
- **Authentication**:
  * `POST /api/patient/login` (`src/app/api/patient/login/route.ts`):
    - Matches phone in `patient_accounts` where `clinic_id == clinicId`.
    - If `user.password` is empty/missing, authentication unconditionally succeeds (line 34).
    - If user exists in `appointments` but not `patient_accounts`, it registers a new account on the fly and saves `password` in **plaintext** (`addDoc(collection(db, 'patient_accounts'), { password, ... })`).
    - Issues **no JWT, no cookie, and no signature**. Returns raw JSON object `{ success: true, patient: { ... } }`.
- **Portal Authorization** (`src/app/clinic/[slug]/patient/page.tsx`):
  * Lines 128-137:
    ```typescript
    const raw = localStorage.getItem('patient_auth')
    if (raw) authData = JSON.parse(raw)
    if (!authData || !authData.phone) {
      router.push(`/clinic/${slug}/patient/login`)
      return
    }
    ```
  * Any user can set `localStorage.setItem('patient_auth', JSON.stringify({ phone: '<target-victim-phone>', clinic_id: '<clinicId>' }))` and gain complete access to view past appointments, medical prescriptions, and invoices.

---

### 2.4 Cross-Tenant Data Leaks & Insecure Direct Object References (IDOR)

#### Vulnerability 1: Cross-Tenant Medical History Leak in Patient Profile
- **File**: `src/app/clinic/[slug]/admin/patients/[patientId]/page.tsx`
- **Location**: Line 206
- **Code**:
  ```typescript
  const qAppt = query(collection(db, 'appointments'), where('phone', '==', phone))
  unsub = onSnapshot(qAppt, (snap) => { ... })
  ```
- **Analysis**:
  The query searches the entire global `appointments` collection by patient phone number, **omitting `where('clinic_id', '==', clinic.id)`**.
- **Cross-Tenant Leak**:
  If a patient visits Clinic A and Clinic B, Doctor A opening `/clinic/clinic-a/admin/patients/[patientPhone]` will see all past visits, diagnoses, prescribed medications, and vital signs recorded by Doctor B at Clinic B.

#### Vulnerability 2: IDOR on Electronic Invoices
- **File**: `src/app/clinic/[slug]/invoice/[invoiceId]/page.tsx`
- **Location**: Lines 49-53
- **Code**:
  ```typescript
  const directDoc = await getDoc(doc(db, 'appointments', decodedInvoiceId))
  if (directDoc.exists()) {
    apptData = { id: directDoc.id, ...directDoc.data() }
  }
  ```
- **Analysis**:
  The route accepts any `invoiceId` (appointment ID). It fetches the document directly and renders patient name, phone number, service name, and amount paid without verifying that `apptData.clinic_id === clinicData.id`.
- **Impact**: Visiting `/clinic/clinic-a/invoice/<appointmentId-from-clinic-b>` exposes Clinic B's patient financial record.

#### Vulnerability 3: IDOR on Electronic Medical Prescriptions
- **File**: `src/app/clinic/[slug]/prescription/[appointmentId]/page.tsx`
- **Location**: Lines 56-77
- **Code**:
  ```typescript
  const apptDoc = await getDoc(doc(db, 'appointments', appointmentId))
  if (apptDoc.exists()) {
    apptData = { id: apptDoc.id, ...apptDoc.data() }
  }
  ```
- **Analysis**:
  Direct document fetch by ID with zero verification that `apptData.clinic_id === clinic.id`.
- **Impact**: Anyone with an appointment ID can view confidential diagnoses, drug regimens, patient age, and phone number across any clinic slug.

#### Vulnerability 4: Queue Tracking Data Leak (Waiting Room Snooping)
- **File**: `src/app/clinic/[slug]/track/[appointmentId]/page.tsx`
- **Location**: Lines 75-84
- **Code**:
  ```typescript
  const constraints: any[] = [
    where('clinic_id', '==', apptData.clinic_id),
    where('date', '==', todayDate)
  ]
  const qQueue = query(collection(db, 'appointments'), ...constraints)
  unsubQueue = onSnapshot(qQueue, (queueSnap) => {
    const list = queueSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    setAllQueueAppts(list)
  })
  ```
- **Analysis**:
  When a patient tracks their single appointment, the client component subscribes to the clinic's entire appointment collection for that date.
- **Privacy Leak**:
  The full array `allQueueAppts` (including other patients' names, phone numbers, payment statuses, and services) is loaded directly into the patient's client browser state.

---

### 2.5 Unauthenticated / Unprotected Public API Endpoints

1. **`POST /api/ai-train`** (`src/app/api/ai-train/route.ts`):
   - No session authentication or origin verification.
   - Any external client can POST prompts and consume the platform owner's OpenAI API quota (`gpt-4o-mini`).
2. **`POST /api/chat`** (`src/app/api/chat/route.ts`):
   - Accepts client-supplied `clinicId` and increments `aiResponsesCount`. An attacker can specify a competitor's `clinicId` in a loop and exhaust their AI response limit.
   - Accepts unvalidated client-supplied `aiKnowledge`, enabling prompt injection.
3. **`POST /api/whatsapp/send`** (`src/app/api/whatsapp/send/route.ts`):
   - No authentication or role check. Anyone can trigger outbound WhatsApp notifications to arbitrary phone numbers.
4. **`POST /api/push/send`** (`src/app/api/push/send/route.ts`):
   - Dispatches Web Push notifications without checking session authorization.
5. **`POST /api/clinic/book`** (`src/app/api/clinic/book/route.ts`):
   - Fails to check `clinic.isActive === false` or `clinic.expirationDate`. Suspended clinics can still receive bookings via direct API calls.

---

## 3. Financial Data Integrity & Cloudflare Worker CPU Limits (Requirements R1, R5 & Criterion C1)

### 3.1 Financial Calculation Logic in `/admin/accounts` and `/admin/finance`

#### In `/clinic/[slug]/admin/accounts/page.tsx`:
Lines 182-197 calculate metrics over filtered appointments:
```typescript
filtered.forEach((item) => {
  const price = Number(item.servicePrice) || 0
  const isPaid = item.paymentStatus === 'paid' || item.status === 'completed'
  totalDiscounts += Number(item.discountApplied) || 0

  if (isPaid) {
    collected += price
    if (item.paymentMethod === 'wallet') walletTotal += price
    else if (item.paymentMethod === 'instapay') instapayTotal += price
    else cashTotal += price
  } else {
    pending += price
  }
  periodTotal += price
})
```
#### Discrepancy with `/clinic/[slug]/admin/finance/page.tsx`:
In `finance/page.tsx` (lines 182-189):
```typescript
const origPrice = isCancelled ? 0 : (Number(data.originalPrice || data.servicePrice) || 0)
const price = isCancelled ? 0 : (Number(data.servicePrice) || origPrice)
const disc = isCancelled ? 0 : (data.discount?.amount || (origPrice > price ? origPrice - price : 0))

if (!isCancelled) {
  totalDiscounts += disc
  rev += origPrice  // In Finance, rev = GROSS before discount
}
```
- In `accounts/page.tsx`, `periodTotal` sums `servicePrice` (which is **NET** after discount).
- In `finance/page.tsx`, `revenue` sums `origPrice` (which is **GROSS** before discount).
- This creates conflicting financial reports for the same clinic over identical date ranges.

---

### 3.2 Floating-Point Precision
All financial metrics are accumulated using native JavaScript `Number` addition:
- `collected += price`, `rev += origPrice`, `totalDiscounts += disc`.
- In JavaScript, IEEE-754 binary floating-point math causes drift:
  * `250 - 37.5 = 212.5`
  * Repeated addition of fractional amounts (e.g. 15% discount on 250 EGP or 33.33 EGP) results in values such as `1249.9999999999998`.
- In `AccountsPage.tsx` line 333: `metrics.collected.toLocaleString()` formats these values. When precision drift occurs, the UI displays fractional decimal artifacts unless rounded.
- **Remediation**: Use integer-cent storage (piasters / cents: `Math.round(val * 100)`) or wrap sums in `Math.round(total * 100) / 100`.

---

### 3.3 Mutation Hazard: Discount Application Mutates `servicePrice`
In `AccountsPage.tsx` lines 112-117:
```typescript
const currentPrice = Number(item.servicePrice) || 0
const newPrice = Math.max(0, currentPrice - discountAmount)
await updateDoc(doc(db, 'appointments', item.id), {
  servicePrice: newPrice,
  discountApplied: (Number(item.discountApplied) || 0) + discountAmount
})
```
- `servicePrice` is permanently overwritten with `newPrice` in Firestore.
- Because `originalPrice` is not preserved in `AccountsPage`, a subsequent discount application will treat the already-discounted price as the base price.
- In contrast, `AdminDashboard.tsx` (line 404) properly writes `originalPrice: origPrice` alongside `servicePrice: newPrice`. This inconsistency causes database records to have divergent schemas depending on whether a discount was applied from the Dashboard or from Accounts.

---

### 3.4 Root Cause of Cloudflare Worker CPU Timeout (Error 1102)

#### Incident Analysis on `GET /clinic/zizo/admin/accounts`:
1. **Unpaginated & Unbounded Firestore Query**:
   `AccountsPage.tsx` line 73:
   ```typescript
   const apptQ = query(collection(db, 'appointments'), where('clinic_id', '==', cData.id))
   ```
   This retrieves **every appointment document ever created** for the clinic. If clinic `zizo` has accumulated thousands of appointments, all documents are downloaded simultaneously.
2. **Synchronous In-Memory Filtering and Metric Loops**:
   Once retrieved, `AccountsPage` executes multiple synchronous filtering and sorting passes:
   * Sorting the entire array by date/creation time in memory (line 76).
   * In-memory `.filter()` across search, payment method, payment status, fromDate, toDate, and branch (lines 144-169).
   * Metric calculation loop iterating over the filtered array (lines 182-198).
3. **Cloudflare Worker Runtime Constraints**:
   Cloudflare Workers operate with a strict **50ms CPU execution slice** (or 10-30s wall-clock time).
   When Next.js Server Components (RSC) or SSR render this page on Cloudflare OpenNext, parsing hundreds of Firestore document JSON payloads, deserializing objects, and executing complex JS aggregation loops within a single synchronous tick exhausts the CPU allocation, triggering **Error 1102 (Worker Exceeded CPU Time Limit)**.
4. **URL Percent-Encoding CPU Hang on `GET /clinic/zizo/admin/patients/[patientId]`**:
   When `patientId` contains encoded characters (e.g. `%2B2010...` for `+2010...`), URL decoding discrepancies occur. When combined with the unindexed global query `where('phone', '==', phone)` (line 206), Firestore performs collection-wide scanning, while the client renders heavy PDF preview elements (`A4Prescription`) and WhatsApp formatters synchronously, causing the worker event loop to starve.

---

## 4. Automated E2E Testing Landscape & Test Strategy (Requirement R3 & Criterion C4)

### 4.1 Current State Analysis
- **Existing Framework**:
  * Playwright `@playwright/test` v1.63.0 is installed.
  * Configuration: `playwright.landing.config.ts`.
  * Test file: `tests/landing.browser.spec.ts` (431 lines).
  * Scope: Strictly tests the public landing page, interactive hero preview, and owner review moderation.
- **Coverage Gap**:
  * There are **zero automated browser tests** covering clinic administrative workflows, queue operations, doctor examinations, receptionist billing, or patient booking portals.
- **TypeScript Health**:
  * Running `npx tsc --noEmit` exits with **code 0 and 0 errors**, satisfying Criterion C4.

---

### 4.2 Multi-Tenant Synthetic Data Strategy & Sandboxing

To test multi-tenant security without modifying or risking production data (Criterion C2: *"No production data or live patient records are altered or deleted"*), the test architecture must establish two completely isolated synthetic clinics:

```
┌────────────────────────────────────────────────────────┐
│                   SYNTHETIC TEST ENVIRONMENT           │
├──────────────────────────┬─────────────────────────────┤
│ Tenant Alpha             │ Tenant Beta                 │
│ Slug: e2e-clinic-alpha   │ Slug: e2e-clinic-beta       │
│ ID: synth-clinic-alpha   │ ID: synth-clinic-beta       │
│ Doctor: dr.alpha@test    │ Doctor: dr.beta@test        │
│ Staff: staff.alpha@test  │ Staff: staff.beta@test      │
└──────────────────────────┴─────────────────────────────┘
```

#### Test Data Management Principles:
1. **Deterministic Prefixing**: All synthetic documents must use identifiable prefixes (`synth-clinic-*`, `synth-appt-*`, `synth-patient-*`).
2. **Automated Teardown**: An automated test harness fixture (`tests/fixtures/synthetic-data.ts`) creates the test clinics and appointments before test execution and deletes all documents prefixed with `synth-` in `afterAll()`.
3. **Network Mocking / Local Emulation**: Utilize Playwright's `page.route()` interception or the Firebase Firestore Emulator (`firebase.json` port 8080) so tests can execute without requiring production Firebase credentials or incurring network billing.

---

### 4.3 Detailed Specification for the 4 User Personas

```
                     ┌─────────────────────────┐
                     │     PLATFORM OWNER      │
                     │  - Clinic Provisioning  │
                     │  - Plan & Doctor Config │
                     │  - Suspension Switch    │
                     └────────────┬────────────┘
                                  │ Configures
                                  ▼
                     ┌─────────────────────────┐
                     │      CLINIC SYSTEM      │
                     └─────┬─────────────┬─────┘
          Operates         │             │         Operates
     ┌─────────────────────┘             └─────────────────────┐
     ▼                                                         ▼
┌──────────────┐                                       ┌──────────────┐
│    DOCTOR    │                                       │ RECEPTIONIST │
│ - Queue Call │                                       │ - Walk-in    │
│ - Rx Protocol│                                       │ - Booking    │
│ - Vitals/PDF │                                       │ - Payments   │
└──────┬───────┘                                       └──────┬───────┘
       │                                                      │
       │                   ┌──────────────┐                   │
       └──────────────────►│   PATIENT    │◄──────────────────┘
                           │ - Public Book│
                           │ - Live Track │
                           │ - Directions │
                           └──────────────┘
```

#### Persona 1: Platform Owner
- **Scope**: Super admin platform governance and multi-tenant control.
- **Automated Test Flow**:
  1. Navigate to `/owner` (intercepted Firebase Auth session for `yallacodex@gmail.com`).
  2. Verify access to Clinics tab; assert list of active clinics renders.
  3. Execute **Add New Clinic**: fill Clinic Name, Doctor Name, Doctor Email, Doctor Password, Slug (`synth-clinic-gamma`), and Package.
  4. Edit Clinic Subscription: change package to Enterprise, update expiration date.
  5. Test **Suspension Guard**:
     * Toggle clinic status to Inactive (`isActive: false`).
     * Open new browser context and navigate to `/clinic/synth-clinic-gamma`.
     * Assert page displays "Clinic Not Found" / suspended screen.
     * Attempt `POST /api/clinic/book` for `synth-clinic-gamma` and assert booking is blocked.

#### Persona 2: Doctor
- **Scope**: Clinical examination, queue triage, and prescription generation.
- **Automated Test Flow**:
  1. Navigate to `/clinic/e2e-clinic-alpha/login` and log in with doctor credentials.
  2. Assert redirection to `/clinic/e2e-clinic-alpha/admin` (Queue Dashboard).
  3. Inspect waiting queue: verify sorting by priority (Urgent cases positioned ahead of Normal cases).
  4. **Call Next Patient**: click "بدء الكشف" on waiting patient `#1`.
     * Assert patient card transitions to "في غرفة الكشف" (`in_progress`).
     * Assert TV screen and notification events trigger.
  5. **Review Patient Medical Record**: click patient name to open `/clinic/e2e-clinic-alpha/admin/patients/[patientId]`.
     * Verify historical appointments display.
     * Record Vital Signs: input BP `120/80`, Heart Rate `72`, Temp `37.0`, Glucose `95`, Weight `75`. Click save and assert toast success.
  6. **Rx Protocol & Prescription Generation**:
     * Open Prescriptions tab `/clinic/e2e-clinic-alpha/admin/prescriptions`.
     * Click clinical protocol picker and select "نزلة معوية حادة (Gastroenteritis)".
     * Assert diagnosis and drug rows (Antinal, Visceralgine, Gast-Reg) are automatically populated.
     * Verify PDF generation preview: assert A4 canvas contains clinic logo, doctor name, and formatted Rx sheet.
  7. **Complete Examination**: click "إنهاء الكشف"; assert status updates to `completed` and duration is recorded.

#### Persona 3: Receptionist (Clinic Assistant)
- **Scope**: Front desk operations, walk-in registration, queue re-ordering, and billing.
- **Automated Test Flow**:
  1. Navigate to `/clinic/e2e-clinic-alpha/login` and log in with assistant credentials.
  2. Assert locked branch constraints (assistant cannot open unauthorized branches or platform packages).
  3. **Walk-In Registration**: navigate to `/admin/patients`, click "إضافة مريض جديد".
     * Enter Name: "محمود حسن", Phone: "01012345678", Age: "34", Service: "كشف عادي".
     * Submit and assert patient added to today's queue with sequential ticket number.
  4. **Queue Status Transitions**:
     * Mark patient as "تخطي الدور" (`skipped`); assert patient moves to skipped section while preserving ticket number.
     * Call next waiting patient into room.
     * Later, restore skipped patient with "إعادة للدور التالي مباشرة" (`priorityNext: true`); assert patient jumps to the top of waiting queue.
  5. **Invoice & Financial Collection**:
     * Open patient payment modal; select payment method: "كاش" (Cash) or "انستاباي" (InstaPay).
     * Apply a discount: 50 EGP; assert new total is updated accurately.
     * Confirm payment; assert payment status updates to `paid`.
     * Click print thermal receipt (80mm); assert thermal receipt HTML structure is generated.

#### Persona 4: Patient
- **Scope**: Public self-service booking, tracking, and location navigation.
- **Automated Test Flow**:
  1. Navigate to public clinic landing `/clinic/e2e-clinic-alpha`.
  2. Open Booking Modal:
     * **Step 1 (Branch)**: Select "الفرع الرئيسي".
     * **Step 2 (Service)**: Select "كشف عادي" (250 EGP).
     * **Step 3 (Date)**: Select available date slot; assert daily quota counter reflects capacity.
     * **Step 4 (Patient Details)**:
       - Enter Name: "سارة أحمد".
       - Test Mobile Validation: input invalid number `"12345"`; assert validation error appears.
       - Enter valid Egyptian mobile `"01123456789"`; assert error clears.
       - Input Age: `"28"`, Gender: `"أنثى"`.
     * **Step 5 (Payment)**: Select "الدفع بالعيادة (كاش)".
     * **Step 6 (Confirmation)**: Submit booking; assert confirmation modal appears displaying assigned ticket number (e.g. `#3`) and estimated wait time.
  3. **Live Queue Tracking**:
     * Click "متابعة الدور مباشرة" to open `/clinic/e2e-clinic-alpha/track/[appointmentId]`.
     * Assert patient's current position and number of waiting patients ahead are displayed.
  4. **Patient Portal & Navigation**:
     * Log in to `/clinic/e2e-clinic-alpha/patient`.
     * Click "موقع العيادة" (Location tab); assert Google Maps coordinates, branch address, and "فتح في خرائط Google" button render correctly.

---

### 4.4 Proposed Test Infrastructure Architecture

```
tests/
├── e2e/
│   ├── 01-owner.spec.ts          # Persona 1: Platform Owner suite
│   ├── 02-doctor.spec.ts         # Persona 2: Doctor queue & Rx suite
│   ├── 03-receptionist.spec.ts   # Persona 3: Receptionist & billing suite
│   ├── 04-patient.spec.ts        # Persona 4: Public booking & tracking suite
│   └── 05-multi-tenant-sec.spec.ts # Multi-tenant isolation & IDOR tests
├── fixtures/
│   ├── synthetic-clinics.ts      # Deterministic clinic definitions (Alpha & Beta)
│   ├── synthetic-auth.ts         # Auth tokens, session cookies, local storage mocks
│   └── synthetic-appointments.ts  # Pre-seeded appointments & medical records
├── helpers/
│   ├── queue-actions.ts          # Playwright helper commands for queue triage
│   └── print-verifier.ts         # Iframe print & PDF blob inspection helper
└── playwright.config.ts          # Unified multi-persona Playwright config
```

#### Proposed `playwright.config.ts`:
```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'ar-EG',
    timezoneId: 'Africa/Cairo',
  },
  projects: [
    {
      name: 'Chromium E2E',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Patient E2E',
      use: { ...devices['iPhone 14'] },
      testMatch: '04-patient.spec.ts',
    },
  ],
})
```

---

## 5. Technical Recommendations & Prioritized Remediation Matrix

| Priority | Component | Issue | Proposed Fix |
| :--- | :--- | :--- | :--- |
| **P0** | `firestore.rules` | Open wildcard write rule (`allow read, write: if true`) | Restrict writes to authenticated users with clinic match: `request.auth != null && resource.data.clinic_id == request.auth.token.clinic_id`. |
| **P0** | `patients/[patientId]/page.tsx` | Cross-tenant medical history leak | Add `where('clinic_id', '==', clinic.id)` to line 206 `query(collection(db, 'appointments'))`. |
| **P0** | `invoice/[invoiceId]/page.tsx` & `prescription/[appointmentId]/page.tsx` | Direct document IDOR without clinic check | Validate `if (apptData.clinic_id !== clinicData.id) return notFound()`. |
| **P0** | `track/[appointmentId]/page.tsx` | Full clinic queue leaked to patient browser | Fetch only queue count / aggregate stats instead of downloading all raw appointment documents to client. |
| **P1** | `/admin/accounts/page.tsx` & `/admin/finance/page.tsx` | Cloudflare Worker CPU timeout (Error 1102) | Add Firestore date range constraints (`where('date', '>=', fromDate)`) and limit initial query to 50 items with pagination. |
| **P1** | `AccountsPage.tsx` | Base price corrupted on discount | Store original price in `originalPrice` before mutating `servicePrice`, matching `AdminDashboard` schema. |
| **P1** | `AccountsPage.tsx` | Floating-point accumulation drift | Wrap all financial sums in `Math.round(val * 100) / 100` or format with fixed decimals. |
| **P1** | `src/app/api/patient/login/route.ts` | Plaintext passwords & unsigned sessions | Hash patient passwords using Web Crypto SHA-256 (`src/lib/auth-crypto.ts`) and issue signed session tokens. |
| **P2** | `/api/chat`, `/api/ai-train`, `/api/whatsapp/send`, `/api/push/send` | Unauthenticated public endpoints | Add session middleware or clinic API key verification to prevent API quota drain and abuse. |
| **P2** | `tests/e2e/` | Lack of E2E coverage for 4 personas | Implement Playwright suites for Platform Owner, Doctor, Receptionist, and Patient personas using isolated synthetic data. |

---

*Report prepared by `teamwork_preview_explorer_survey_3`.*
