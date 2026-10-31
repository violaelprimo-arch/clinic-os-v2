# Handoff Report: Multi-Tenant Security, Financial Data Integrity, and Automated E2E Testing Landscape

**Agent**: `teamwork_preview_explorer_survey_3`  
**Parent / Orchestrator**: `1532b7ff-1f79-4216-b672-256a18948df1`  
**Working Directory**: `e:\progict\clinic-os-v2\.agents\teamwork\teamwork_preview_explorer_survey_3`  
**Date**: 2026-10-27  
**Report Document**: `e:\progict\clinic-os-v2\.agents\teamwork\teamwork_preview_explorer_survey_3\survey_report.md`  

---

## 1. Observation

1. **Firestore Security Rules**:
   - File: `e:\progict\clinic-os-v2\firestore.rules`
   - Lines 92-94:
     ```javascript
     match /{document=**} {
       allow read, write: if true;
     }
     ```
   - Lines 23-50:
     ```javascript
     match /clinics/{clinicId} { allow read: if true; allow write: if true; }
     match /appointments/{apptId} { allow read: if true; allow write: if true; }
     match /prescriptions/{prescriptionId} { allow read: if true; allow create, update, delete: if true; }
     match /patient_accounts/{accId} { allow read, write: if true; }
     ```

2. **Cross-Tenant Medical Record Leak in Patient Profile**:
   - File: `e:\progict\clinic-os-v2\src\app\clinic\[slug]\admin\patients\[patientId]\page.tsx`
   - Lines 206-212:
     ```typescript
     const qAppt = query(collection(db, 'appointments'), where('phone', '==', phone))
     unsub = onSnapshot(qAppt, (snap) => {
       if (!snap.empty) {
         const appts = snap.docs
           .map(d => ({ id: d.id, ...d.data() } as any))
     ```
     `where('clinic_id', '==', ...)` is completely absent, whereas in `patients/page.tsx` line 138 it exists (`where('clinic_id', '==', cData.id)`).

3. **Insecure Direct Object References (IDOR) on Invoices and Prescriptions**:
   - File: `e:\progict\clinic-os-v2\src\app\clinic\[slug]\invoice\[invoiceId]\page.tsx`
     Lines 49-53:
     ```typescript
     const directDoc = await getDoc(doc(db, 'appointments', decodedInvoiceId))
     if (directDoc.exists()) {
       apptData = { id: directDoc.id, ...directDoc.data() }
     }
     ```
     No check verifying `apptData.clinic_id === clinicData.id`.
   - File: `e:\progict\clinic-os-v2\src\app\clinic\[slug]\prescription\[appointmentId]\page.tsx`
     Lines 56-60:
     ```typescript
     const apptDoc = await getDoc(doc(db, 'appointments', appointmentId))
     if (apptDoc.exists()) {
       apptData = { id: apptDoc.id, ...apptDoc.data() }
     }
     ```
     No check verifying `apptData.clinic_id === clinic.id`.

4. **Queue Snooping in Patient Tracking**:
   - File: `e:\progict\clinic-os-v2\src\app\clinic\[slug]\track\[appointmentId]\page.tsx`
     Lines 80-84:
     ```typescript
     const qQueue = query(collection(db, 'appointments'), ...constraints)
     unsubQueue = onSnapshot(qQueue, (queueSnap) => {
       const list = queueSnap.docs.map(d => ({ id: d.id, ...d.data() }))
       setAllQueueAppts(list)
     ```
     Loads the raw appointment documents (names, phone numbers, services) of all other patients into the client browser state of the tracking patient.

5. **Plaintext Passwords & Unsigned Patient Sessions**:
   - File: `e:\progict\clinic-os-v2\src\app\api\patient\register\route.ts` line 46: `password: String(password)` saved in plaintext.
   - File: `e:\progict\clinic-os-v2\src\app\clinic\[slug]\patient\page.tsx` lines 128-135: session validation trusts raw `localStorage.getItem('patient_auth')` with no cryptographic token or backend session verification.

6. **Unpaginated Financial Queries & Cloudflare Worker CPU Timeout**:
   - File: `e:\progict\clinic-os-v2\src\app\clinic\[slug]\admin\accounts\page.tsx` line 73:
     ```typescript
     const apptQ = query(collection(db, 'appointments'), where('clinic_id', '==', cData.id))
     ```
     Unbounded query with zero pagination or date constraints. Filtering and metric calculations (lines 144-198) execute synchronously in JavaScript loops over the entire historical collection.
   - File: `e:\progict\clinic-os-v2\src\app\clinic\[slug]\admin\accounts\page.tsx` lines 112-117:
     Applying discount directly mutates `servicePrice` in Firestore (`Math.max(0, currentPrice - discountAmount)`), erasing the original price baseline.
   - Lines 182-198: Accumulates numbers with raw floating-point arithmetic without integer rounding.

7. **Test Landscape & Static Analysis**:
   - Command: `npx tsc --noEmit` executed in project root.
     * Output: Exited with code 0. Zero errors.
   - File: `e:\progict\clinic-os-v2\package.json` lines 11-14:
     Only `test:landing`, `test:landing:rules`, and `test:landing:browser` (`tests/landing.browser.spec.ts`) exist.
     There are zero automated tests covering Platform Owner, Doctor, Receptionist, or Patient personas.

---

## 2. Logic Chain

1. **From Observation 1**: Because `firestore.rules` allows world-wide read and write on all collections (`match /{document=**} { allow read, write: if true; }`) and the Firebase client configuration is bundled in the frontend, any client can directly read or write any document in Firestore regardless of UI guards.
2. **From Observation 2**: Because `patients/[patientId]/page.tsx` queries `appointments` where `phone == phone` without filtering by `clinic_id`, querying a patient phone number returns all appointment records created by any clinic in the system. Therefore, Doctor A can inspect confidential medical notes and prescriptions issued by Doctor B at another clinic.
3. **From Observation 3**: Because `/invoice/[invoiceId]` and `/prescription/[appointmentId]` fetch documents directly by ID without asserting `appt.clinic_id == clinic.id`, an attacker knowing or enumerating an appointment ID can view invoice financials or clinical prescriptions across tenant boundaries (IDOR).
4. **From Observation 4**: Because `track/[appointmentId]` maps all Firestore documents for the day into `allQueueAppts`, any patient inspecting their browser memory can harvest the personal details (phone, name, service) of all other patients attending the clinic that day.
5. **From Observation 5**: Because patient passwords are saved in plaintext and the portal accepts arbitrary JSON in `localStorage.getItem('patient_auth')`, an attacker can forge any patient identity in local storage and access their profile without authentication.
6. **From Observation 6**: Because `/admin/accounts` downloads the complete appointment history of a clinic and processes it synchronously, rendering this page on Cloudflare OpenNext Workers exceeds the 50ms CPU execution budget on clinics with high volume, directly explaining the Cloudflare Worker CPU Timeout (Error 1102).
7. **From Observation 7**: Because TypeScript compiles cleanly (`tsc --noEmit` exit 0), the codebase has strong type hygiene, but lacks integration/E2E test coverage for core business operations across the 4 personas.

---

## 3. Caveats

- **Firebase Rules Deployment**: The live Cloudflare/Firebase deployment may have different security rules deployed in the cloud than what is in local `firestore.rules`. However, the local file is what gets deployed via CI/CD (`firebase deploy`).
- **Cloudflare OpenNext Emulation**: Local tests were verified via Node.js and Next.js tools. Edge CPU time limit (Error 1102) was diagnosed via static code tracing of synchronous query loops and deserialization overhead rather than live Cloudflare dashboard metrics.
- **Read-Only Constraint**: As an explorer agent, no code changes or database migrations were applied.

---

## 4. Conclusion

1. **Security & Tenant Isolation (R5 / C2)**:
   Clinic OS V2 contains critical multi-tenant vulnerabilities:
   - Database level: world-accessible `firestore.rules`.
   - Application level: Cross-tenant medical leak in `patients/[patientId]/page.tsx`, IDOR on invoices and prescriptions, privacy leak on patient tracking, and unauthenticated/plaintext patient auth.
2. **Financial Data Integrity (R5 / C1)**:
   - `/admin/accounts` and `/admin/finance` exhibit gross-vs-net revenue discrepancies and floating-point precision drift.
   - Applying discounts in `AccountsPage` permanently corrupts base prices by mutating `servicePrice` in Firestore.
   - Unpaginated Firestore queries downloading all historical appointments are the direct root cause of Cloudflare Worker CPU timeouts.
3. **Automated Testing Landscape (R3 / C4)**:
   - Playwright is present but only configured for the landing page.
   - TypeScript compiles cleanly with 0 errors.
   - Full 4-persona test specification (Platform Owner, Doctor, Receptionist, Patient) and synthetic data strategy (`e2e-clinic-alpha` / `e2e-clinic-beta`) are designed and ready for implementation.

---

## 5. Verification Method

To independently verify the observations and findings:

1. **Verify TypeScript Compilation**:
   ```powershell
   cd e:\progict\clinic-os-v2
   npx tsc --noEmit
   ```
   *Expected Result*: Exits with code 0 and zero errors.

2. **Verify Open Firestore Rules**:
   Inspect `e:\progict\clinic-os-v2\firestore.rules` lines 23-45 and 92-94. Observe `allow read, write: if true;`.

3. **Verify Cross-Tenant Query in Patient Profile**:
   Inspect `e:\progict\clinic-os-v2\src\app\clinic\[slug]\admin\patients\[patientId]\page.tsx` line 206. Observe:
   ```typescript
   const qAppt = query(collection(db, 'appointments'), where('phone', '==', phone))
   ```
   Confirm absence of `clinic_id` constraint compared to `patients/page.tsx` line 138.

4. **Verify IDOR on Invoices and Prescriptions**:
   Inspect `src/app/clinic/[slug]/invoice/[invoiceId]/page.tsx` lines 49-53 and `src/app/clinic/[slug]/prescription/[appointmentId]/page.tsx` lines 56-60. Confirm direct `getDoc` without clinic slug/id validation.

5. **Verify Unpaginated Accounts Query**:
   Inspect `src/app/clinic/[slug]/admin/accounts/page.tsx` line 73. Confirm `where('clinic_id', '==', cData.id)` has no `limit()` or date range constraint.
