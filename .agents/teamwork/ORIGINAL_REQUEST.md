# Original User Request

## 2026-10-27T19:12:34Z

Autonomous full-system debugging, CPU timeout repair, security auditing, and end-to-end verification for the Yalla Clinic healthcare SaaS platform.

Working directory: e:\progict\clinic-os-v2
Integrity mode: development

## Requirements

### R1. Root-Cause Analysis and Fix for Cloudflare Worker CPU Incident
Resolve the `Worker exceeded CPU time limit` (Error 1102 / unhandled exception) affecting:
- `GET /clinic/zizo/admin/accounts` (and RSC variants like `?_rsc=...`)
- `GET /clinic/zizo/admin/patients/[patientId]` (specifically handling URL/percent-encoded IDs like `%2B`)
Identify expensive synchronous loops, redundant SSR/RSC data fetches, unpaginated Firestore queries, or recursive rendering. Implement permanent code-level optimizations without simply bumping CPU limits or breaking tenant isolation.

### R2. Complete Repository Audit & Static Code Analysis
Perform full repository inspection, detect unused/broken components and dead links, ensure TypeScript compilation (`tsc --noEmit`) passes with zero errors, eliminate ESLint warnings where critical, and guarantee both Next.js production build (`next build`) and OpenNext/Cloudflare build succeed cleanly.

### R3. Automated Role-Based End-to-End Testing (Playwright / Browser Automation)
Execute comprehensive automated browser testing across all user personas using isolated synthetic data:
- Platform Owner: Clinic creation, subscription management, doctor/branch assignment, suspension guards.
- Doctor: Queue management, patient calling, medical file review, Rx protocols, prescription PDF generation, and vital signs saving.
- Receptionist: Walk-in registration, appointment booking, queue status transitions, invoice/receipt flows.
- Patient: Public booking, mobile validation, live queue tracking, Google Maps directions.

### R4. Real-Time Queue & Waiting Screen Voice Engine Validation
Stress-test queue operations under concurrency (normal, urgent, emergency priority re-sorting, skip, no-show, simultaneous receptionist/doctor actions). Validate the waiting room display (`/tv`) and voice announcement queue against audio memory leaks, loop triggers, and long-shift stability.

### R5. Security, Multi-Tenant Isolation & Financial Data Integrity
Audit database queries, security rules, and session authorization to prevent cross-tenant data leaks, privilege escalation, or unauthorized access to patient medical histories and financial transactions. Verify that all financial calculations (`/admin/accounts`) derive accurately from authorized clinic records.

### R6. Final Arabic Technical Report
Generate a detailed engineering report in Arabic documenting: overall health summary, CPU incident root cause and benchmarks, discovered issues and fixes table, files modified, test matrix results (Playwright/Jest), security findings, and staging release readiness.

## Acceptance Criteria

### C1. Cloudflare CPU & Runtime Stability
- [ ] `/clinic/[slug]/admin/accounts` loads directly and via client-side RSC navigation within safe Cloudflare Worker CPU limits.
- [ ] `/clinic/[slug]/admin/patients/[patientId]` (including patient IDs with `%2B` or encoded characters) resolves and renders correctly without CPU timeout.
- [ ] Next.js production build (`npm run build`) and Cloudflare OpenNext build exit with code 0.

### C2. Multi-Tenant Security & Data Integrity
- [ ] Tenant data isolation is strictly enforced; synthetic queries across distinct clinic slugs are blocked.
- [ ] Sensitive medical notes and financial records are accessible only to authenticated and authorized clinic staff.
- [ ] No production data or live patient records are altered or deleted during testing.

### C3. Queue System & TV Call Screen
- [ ] Emergency and urgent patients jump queue priority correctly without duplicate positions or queue corruption.
- [ ] Waiting room TV screen runs in browser test without infinite re-renders, runaway audio triggers, or memory leaks.

### C4. Automated Test Verification
- [ ] Playwright E2E test suite executes and passes for Owner, Doctor, Receptionist, and Patient workflows.
- [ ] Zero TypeScript errors reported by `npx tsc --noEmit`.

### C5. Documentation & Delivery
- [ ] Complete Arabic technical report generated as specified in Phase 20.

## 2026-10-27T20:32:51Z

[Update from Lead Architect]
The server was restarted, but the root causes have been diagnosed, repaired, and deployed directly to production Cloudflare Workers (Version: db6f1044-3092-467e-9cbb-9c9b23740791):

1. Cloudflare Error 1102 (Worker exceeded CPU time limit):
   - Root Cause A: Root page (`src/app/page.tsx`) had `force-dynamic` and executed expensive RSA PKCS8 SubtleCrypto key imports + Google token signing + Firestore queries on EVERY request. Removed `force-dynamic`, served default config with client hydration, and cached `cachedPrivateKey` in `src/lib/server/firebase-rest.ts`.
   - Root Cause B: Heavy administrative components (`accounts`, `patients/[patientId]`, `prescriptions`, `tv`, `analytics`) were executing heavy SSR. Created lightweight dynamic client wrappers (`AccountsClient`, `PatientProfileClient`, `WaitingRoomTvClient`, `AnalyticsClient`) with `ssr: false`, dropping SSR CPU to <0.1ms.
   - Root Cause C: Removed unused `pdfGenerator` and `whatsappShare` imports from prescriptions page.

2. Owner Login issue (`Unexpected token '<', "<!DOCTYPE "... is not valid JSON`):
   - Root Cause: When `/api/auth/owner-login` failed, Cloudflare or the Worker returned an HTML error page. `response.json()` in `OwnerAccessGate.tsx` threw a JSON parsing error on `<!DOCTYPE`.
   - Cause of failure in route: `enforceSubmissionLimit` synchronously invoked Firestore REST writes on edge; `verifyFirebaseOwnerIdToken` strictly required `claims.platformOwner === true` which is not present in standard Firebase client tokens; and `assertSameOrigin` strictly compared protocol/origin causing mismatches behind reverse proxies.
   - Fixes: Made rate limiting non-blocking; relaxed missing custom claims while strictly verifying `localId === ownerUid` against Google Identity Toolkit `accounts:lookup`; enhanced `assertSameOrigin`; and protected `exchangeFirebaseToken` against non-JSON responses.

Live verification results:
- https://yalla-clinic.com -> HTTP 200
- https://yalla-clinic.com/owner -> HTTP 200
- https://zizo.yalla-clinic.com/clinic/zizo/admin/accounts -> HTTP 200
- https://zizo.yalla-clinic.com/clinic/zizo/admin/patients/01012345678 -> HTTP 200
- POST /api/auth/owner-login -> HTTP 401 with clean JSON response.

Please resume Milestone M2 (Queue priority & TV voice engine), M3 (Security audit & financial validation), M5 (Playwright E2E test runs), and assemble the Final Arabic Technical Engineering Report (M4).
