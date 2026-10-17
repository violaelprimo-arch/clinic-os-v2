# Yalla Clinic — Functional Recovery Audit & Restoration Blueprint
**Date:** 2026-10-17  
**Target Environment:** Cloudflare Workers (OpenNext) + Next.js App Router + Firebase Firestore  
**Primary Objective:** Restore 100% functional integrity, real database connectivity, and business logic while strictly preserving the new Yalla Clinic visual identity and UI design.

---

## 1. Executive Summary & Root Cause Analysis

In commit `48210c43dadcf893d82004d14d6171da89207202` (*"Update YallaClinic UI across all 5 screens"*), a comprehensive frontend redesign was applied. While the visual aesthetic, typography, and theme styling met high design standards, the implementation inadvertently decoupled core screens from real backend services and database collections:

1. **Non-Existent Mock Endpoints:** Components attempted to invoke Next.js route handlers (`/api/patient/login`, `/api/patient/register`, `/api/clinic/book`, `/api/clinic/[slug]/queue`) that were never declared in `src/app/api`.
2. **Silent Failure & Hardcoded Fallbacks:** Network errors were caught silently and substituted with mock data (e.g., hardcoded `queueNumber: 6`, patient "محمد علي", phone "01012345678", fake prescriptions).
3. **Loss of Session State:** Patient portal bypassed authentication checks and relied on static HTML rather than authenticated Firestore queries scoped to `patient_accounts`, `appointments`, and `prescriptions`.
4. **Decoupled Real-Time Logic:** Queue calculations were replaced with synthetic decrements rather than listening to Firestore snapshots and running `calculatePatientLivePosition` with Cairo timezone triage.

---

## 2. Component-by-Component Breakage Matrix

| Component / Route | Commit Status | Defects Identified | Restoration Action |
| :--- | :--- | :--- | :--- |
| **`patient/login/page.tsx`** | Broken in `48210c4` | • Calls `/api/patient/login` & `/register`<br>• Swallows errors and always redirects<br>• No `localStorage` or session token saved<br>• No validation for duplicate phones or invalid ages | Restore client-side Firestore authentication against `patient_accounts` (with fallback to past `appointments` for returning patients), password verification, and session persistence in `patient_auth`. |
| **`BookingModal.tsx`** | Broken in `48210c4` | • Calls `/api/clinic/book`<br>• Falls back to hardcoded `queueNumber: 6`<br>• Uses hardcoded mock branches ("التجمع", "الشيخ زايد") instead of real Firestore branches<br>• Does not write to Firestore `appointments` or dispatch notifications | Wire modal directly to Firestore atomic appointment creation (`addDoc` or transaction), load dynamic clinic branches via `getClinicBranches`, calculate real sequential `queue_number`, handle online payments, and navigate to real tracking page. |
| **`patient/page.tsx`** | Broken in `48210c4` | • All patient cards, appointments, prescriptions, and invoices are hardcoded static data<br>• No Firestore subscription<br>• Cancel appointment button has no handler<br>• Rx download / view button does nothing | Integrate `patient_auth` session check, real-time listeners for `appointments` and `prescriptions`, dynamic tabs (مواعيدي, روشتاتي, فواتيري, ملفي الطبي), real cancellation handler, and PDF / Image prescription sharing. |
| **`PatientLiveTurn.tsx`** | Broken in `48210c4` | • Calls missing endpoint `/api/clinic/[slug]/queue`<br>• Displays static turn #6 and fake wait time<br>• Not synced with doctor's current examination status | Connect to Firestore `appointments` snapshot filtered by clinic and Cairo date, execute `calculatePatientLivePosition` from `lib/queueCalculations.ts`, and render the neon circular gauge with accurate dynamic progress. |
| **`PremiumLanding.tsx`** | Gaps in `48210c4` | • Dynamic doctor info & experience sometimes unbound<br>• No phone search modal to track existing appointments<br>• Branches hardcoded if empty | Wire live branch loading, integrate queue search modal by phone number, ensure all CTAs open the real `BookingModal` with preselected service and branch. |

---

## 3. Detailed Restoration Plan & Architecture

### Phase A: Authentication & Patient Session (`patient/login/page.tsx`)
1. Re-implement Firestore verification:
   - Query `clinics` by slug to obtain verified `clinicId`.
   - In Registration Mode: validate name, age (1–120), Egyptian mobile phone, and password (min 4 chars). Check uniqueness in `patient_accounts`. Create document with `createdAt: new Date().toISOString()`.
   - In Login Mode: look up `patient_accounts` by `clinic_id` + `phone`. If missing, check `appointments` for prior bookings and auto-activate account. Verify password with proper error toast.
   - On success: store `{ phone, name, age, clinic_id, clinicSlug }` in `localStorage.setItem('patient_auth', ...)` and push to `/clinic/${slug}/patient`.

### Phase B: Booking Modal Integration (`BookingModal.tsx`)
1. Dynamically load branches using `getClinicBranches(clinicId)` and `ensureClinicHasMainBranch(clinic)`.
2. Compute available calendar booking days according to active branch working days.
3. Replace `/api/clinic/book` fetch with direct, secure Firestore appointment creation:
   - Calculate queue number: query today's appointments for this branch/date and set `queue_number = count + 1`.
   - Determine `isUrgent` flag from service name or service ID.
   - Insert document into `appointments` collection with full payload (`patientName`, `phone`, `age`, `date`, `serviceId`, `serviceName`, `paymentMethod`, `paymentStatus`, `status: 'waiting'`).
   - Trigger `createClinicNotification` for both patient and clinic staff.
   - Set real success state with actual `appointmentId`, `queueNumber`, and redirect link to `/clinic/${slug}/track/${appointmentId}`.

### Phase C: Patient Portal Restoration (`patient/page.tsx`)
1. Read `patient_auth` on mount; redirect to `/clinic/${slug}/patient/login` if missing.
2. Synchronize clinic document and fetch real appointments (`where('clinic_id', '==', clinicId)`, `where('phone', '==', patientPhone)`).
3. Fetch approved prescriptions (`where('clinic_id', '==', clinicId)`, `where('patientPhone', '==', patientPhone)`).
4. Render 4 tabs with real dynamic data:
   - **مواعيدي (My Appointments):** Show upcoming and past appointments, live status badge (`waiting`, `in_progress`, `completed`, `cancelled`), button to open `PatientLiveTurn` or `/track/${appt.id}`, and working cancellation dialog.
   - **روشتاتي (My Prescriptions):** List doctor-approved prescriptions with medication items, dosages, instructions, and download/share buttons (`A4Prescription` modal + PDF generation).
   - **فواتيري (My Invoices):** Show financial receipts for completed appointments and online payments with `InvoiceView`.
   - **ملفي الطبي (Medical Profile):** Summary of medical history, allergies, chronic diseases, and past diagnoses.

### Phase D: Patient Live Turn Tracking (`PatientLiveTurn.tsx`)
1. Accept `clinicId` and `patientPhone` (or target appointment ID).
2. Query today's Cairo date appointments for this clinic.
3. Compute `calculatePatientLivePosition`:
   - Identify examining patient (`status === 'in_progress'`).
   - Determine dynamic position in line, count of patients ahead, and estimated wait minutes.
   - Render neon circular gauge with dynamic SVG stroke offset `(301.59 * (1 - progress))`.
   - Distinguish states: "حان دورك الآن • تفضل بالدخول", "في الانتظار", "تم الكشف الطبي بنجاح".

### Phase E: Verification & Zero-Defect QA
1. Compile with Next.js Turbopack (`npm run build`).
2. Verify TypeScript typing (`npx tsc --noEmit`).
3. Test end-to-end user journeys:
   - Registration -> Login -> Booking -> Queue Tracking -> Doctor Examination -> Rx Issuance -> Patient Portal Rx Download.
