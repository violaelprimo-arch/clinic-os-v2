# BRIEFING — 2026-10-27T20:36:00Z

## Mission
Implement Milestone M3: Security hardening (firestore.rules, IDOR checks, queue leakage prevention) and financial accuracy fixes (originalPrice preservation, float rounding).

## 🔒 My Identity
- Archetype: preview_worker
- Roles: implementer, qa
- Working directory: e:\progict\clinic-os-v2\.agents\teamwork\teamwork_preview_worker_m3
- Original parent: 1532b7ff-1f79-4216-b672-256a18948df1
- Milestone: M3

## 🔒 Key Constraints
- Exclusive write ownership:
  - `firestore.rules`
  - `src/app/clinic/[slug]/invoice/[invoiceId]/page.tsx`
  - `src/app/clinic/[slug]/prescription/[appointmentId]/page.tsx`
  - `src/app/clinic/[slug]/track/[appointmentId]/page.tsx`
  - `src/app/clinic/[slug]/admin/accounts/page.tsx`
  - `src/app/clinic/[slug]/admin/accounts/AccountsClient.tsx` (approved 2026-10-27T20:41:34Z)
- No cheating, no fake mocks, genuine verification only.


## Current Parent
- Conversation ID: 1532b7ff-1f79-4216-b672-256a18948df1
- Updated: 2026-10-27T20:36:00Z

## Task Summary
- **What to build**:
  - Secure Firestore rules removing wildcard allow read, write: if true. Protect clinics, appointments, prescriptions, patient_accounts, branches with auth & tenant scoping.
  - Fix IDOR in invoice & prescription pages by checking `apptData.clinic_id === clinicData.id`, returning `notFound()` if mismatch.
  - Fix queue data leakage in track page by not exposing other patients' sensitive fields (names, phones, services) and calculating only position and wait time.
  - Fix admin accounts page: preserve `originalPrice` on discount application, round metrics to 2 decimal places to prevent float drift.
- **Success criteria**: TypeScript typecheck passes, Next.js build passes, zero IDOR/leakage.
- **Interface contracts**: PROJECT.md

## Change Tracker
- **Files modified**: None yet
- **Build status**: Untested
- **Pending issues**: None

## Quality Status
- **Build/test result**: Pending
- **Lint status**: Pending
- **Tests added/modified**: Pending

## Loaded Skills
- None
