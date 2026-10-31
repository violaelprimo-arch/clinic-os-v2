## 2026-10-27T20:35:33Z
You are teamwork_preview_worker_m3, an implementation worker for Milestone M3.
Working directory: e:\progict\clinic-os-v2\.agents\teamwork\teamwork_preview_worker_m3
Original request: e:\progict\clinic-os-v2\.agents\teamwork\ORIGINAL_REQUEST.md
Project plan: e:\progict\clinic-os-v2\PROJECT.md
Survey 3 report: e:\progict\clinic-os-v2\.agents\teamwork\teamwork_preview_explorer_survey_3\survey_report.md
Project root: e:\progict\clinic-os-v2

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE WRITE OWNERSHIP:
You own and may edit ONLY these files:
- `firestore.rules`
- `src/app/clinic/[slug]/invoice/[invoiceId]/page.tsx`
- `src/app/clinic/[slug]/prescription/[appointmentId]/page.tsx`
- `src/app/clinic/[slug]/track/[appointmentId]/page.tsx`
- `src/app/clinic/[slug]/admin/accounts/page.tsx`

INSTRUCTIONS:
1. Read `ORIGINAL_REQUEST.md`, `PROJECT.md`, and `teamwork_preview_explorer_survey_3/survey_report.md`.
2. Initialize `progress.md` with "Last visited: [timestamp]" and keep it updated.
3. In `firestore.rules`:
   - Remove the open wildcard rule `match /{document=**} { allow read, write: if true; }`.
   - Protect `clinics`, `appointments`, `prescriptions`, `patient_accounts`, and `branches` with authenticated and tenant-scoped rules.
4. In `src/app/clinic/[slug]/invoice/[invoiceId]/page.tsx` and `src/app/clinic/[slug]/prescription/[appointmentId]/page.tsx`:
   - Eliminate IDOR: Verify `apptData.clinic_id === clinicData.id`. If mismatched, call `notFound()` to block cross-clinic data leakage.
5. In `src/app/clinic/[slug]/track/[appointmentId]/page.tsx`:
   - Eliminate queue data leakage: Instead of downloading all patient appointments to the client, compute and expose only the tracked appointment's position and wait time, hiding all other patients' names, phones, and services.
6. In `src/app/clinic/[slug]/admin/accounts/page.tsx`:
   - Preserve `originalPrice`: When applying a discount, store `originalPrice: item.originalPrice || currentPrice`.
   - Prevent float precision drift by rounding metrics to 2 decimal places (`Math.round(val * 100) / 100`).
7. Verify with `npx tsc --noEmit` and `npm run build`.
8. Document all findings and results in `handoff.md` and notify orchestrator when done.

## 2026-10-27T20:41:34Z
**Context**: Milestone M3 Write Ownership.
**Content**: Write ownership is APPROVED for `src/app/clinic/[slug]/admin/accounts/AccountsClient.tsx`. You may edit this file to implement the `originalPrice` preservation, 2-decimal financial rounding (`Math.round(val * 100) / 100`), and revenue formula alignment.
**Action**: Proceed with implementing the changes in `AccountsClient.tsx` and verify with `tsc` and `next build`.

