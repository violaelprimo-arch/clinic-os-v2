# Project: Yalla Clinic SaaS Platform Debugging, Security Auditing & E2E Verification

## Architecture
- **Framework**: Next.js 16.3.8 (App Router, Turbopack, React 19)
- **Runtime Target**: Cloudflare Workers via OpenNext (`@opennextjs/cloudflare`)
- **Database / Backend**: Firebase Firestore, Cloudflare Worker API routes, Server Actions
- **State & Real-Time**: Firestore onSnapshot listeners, Web Audio API / Cloud TTS
- **Testing**: Playwright automated E2E browser testing, Jest unit tests, TypeScript (`tsc --noEmit`)

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Accounts Page CPU Fix | Eliminate Worker CPU 1102 timeout via dynamic imports of heavy export/print libraries, Firestore query date-scoping, and client table pagination | M1 | ORIGINAL_REQUEST §R1, C1 |
| 2 | Patient Profile Route Fix | Prevent `URIError` on percent-encoded patient IDs (e.g. `%2B`) with `safeDecodePatientId`, lazy load document generators, and fix phone search | M1 | ORIGINAL_REQUEST §R1, C1 |
| 3 | Subdomain Access Guard Fix | Fix `ClinicPublicAccessGuard` pathname check on subdomains to prevent SSR redirect loops | M1 | Survey Explorer 1 |
| 4 | Linter & Deprecation Hygiene | Fix ESLint heap OOM by ignoring `.agents/**`, align `@typescript-eslint/no-explicit-any`, and check Next.js 16 proxy convention | M1 | Survey Explorer 2 |
| 5 | Real-Time TV Queue Priority | Fix `WaitingRoomTvClient` sorting to respect `sortQueue` (urgent/emergency priority weights) matching doctor view | M2 | ORIGINAL_REQUEST §R4, C3 |
| 6 | Atomic Queue Numbering | Ensure walk-in registrations in `admin/patients` call `createAtomicAppointment` instead of un-numbered `addDoc` | M2 | Survey Explorer 2 |
| 7 | Concurrency & Queue Transitions | Prevent ghost `in_progress` records under concurrent doctor/receptionist actions with atomic transactions | M2 | ORIGINAL_REQUEST §R4, C3 |
| 8 | Queue Timezone Normalization | Align queue date filtering in `api/clinic/[slug]/queue` with Cairo timezone to avoid midnight UTC drift | M2 | Survey Explorer 2 |
| 9 | TV Voice Engine Memory Leak Fix | Fix unbounded PCM audio cache, disconnect Web Audio graph nodes onended, and close AudioContext on unmount | M2 | ORIGINAL_REQUEST §R4, C3 |
| 10 | TV Voice Recall Reliability | Ensure re-calling a patient triggers audio announcement even if `startedAt` was already set | M2 | Survey Explorer 2 |
| 11 | Firestore Security Rules Hardening | Remove open wildcard `match /{document=**} { allow read, write: if true; }`, enforce clinic tenant isolation and auth checks | M3 | ORIGINAL_REQUEST §R5, C2 |
| 12 | Patient History Tenant Isolation | Fix line 206 in `patients/[patientId]/page.tsx` to enforce `where('clinic_id', '==', cData.id)` to block cross-tenant leaks | M3 | ORIGINAL_REQUEST §R5, C2 |
| 13 | IDOR Prevention (Invoices/Rx) | Verify clinic tenant ownership on `/invoice/[invoiceId]` and `/prescription/[appointmentId]` before returning sensitive data | M3 | Survey Explorer 3 |
| 14 | Patient Queue Tracking Privacy | Limit `/track/[appointmentId]` data exposure to only the patient's individual ticket, not full clinic roster | M3 | Survey Explorer 3 |
| 15 | Financial Calculation Alignment | Unify revenue formula between `accounts` and `finance`, preserve `originalPrice` during discounts, prevent float drift | M3 | ORIGINAL_REQUEST §R5, C2 |
| 16 | E2E Test Suite (Tiers 1-4) | Comprehensive Playwright tests for Owner, Doctor, Receptionist, Patient with isolated synthetic clinic data | M-E2E | ORIGINAL_REQUEST §R3, C4 |
| 17 | Final E2E 100% Pass & Hardening | Execute full E2E test suite to 100% pass, followed by Tier 5 adversarial stress testing | M5 | ORIGINAL_REQUEST §R3, C4 |
| 18 | Arabic Technical Report | Author comprehensive Arabic engineering report with benchmarks, root causes, test matrices, and security findings | M4 | ORIGINAL_REQUEST §R6, C5 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Cloudflare CPU Timeout & Route Performance Fixes | Accounts page optimization, Patient route `%2B` safe decoding, Subdomain guard fix, ESLint fix | none | READY |
| M2 | Real-Time Queue Concurrency & TV Voice Engine | TV priority sorting, atomic queue numbering, concurrent transition safety, audio memory leak & Web Audio node cleanup | M1 | PLANNED |
| M3 | Multi-Tenant Security & Financial Data Integrity | Firestore rules hardening, patient history clinic_id enforcement, IDOR guards, tracking privacy, financial calculation alignment | M1 | PLANNED |
| M-E2E | E2E Testing Track | Independent opaque-box Playwright test suite (Tiers 1-4: Owner, Doctor, Receptionist, Patient) & TEST_READY.md | none | READY |
| M5 | Final E2E Verification & Adversarial Hardening | Pass 100% of E2E test suite (Tiers 1-4) + Tier 5 adversarial stress testing | M1, M2, M3, M-E2E | PLANNED |
| M4 | Comprehensive Arabic Technical Engineering Report | Detailed Arabic engineering report documenting all fixes, root cause benchmarks, test matrix, and release readiness | M1, M2, M3, M5 | PLANNED |

## Interface Contracts
### Route: `/clinic/[slug]/admin/accounts`
- Dynamic imports for: `jspdf`, `html2canvas`, `exceljs`, `printService`.
- Client-side pagination: `itemsPerPage = 10`, page controls, zero full-table DOM dumps.
- Server/SSR chunk: Pure lightweight RSC / client shell without document generation bundles.

### Route: `/clinic/[slug]/admin/patients/[patientId]`
- `safeDecodePatientId(patientId: string): string`: Multi-pass decode with `try/catch` and safe character mapping.
- Firestore queries: Always include `where('clinic_id', '==', cData.id)` and query `getPhoneSearchVariants(phone)`.

### TV Screen & Queue Management
- TV Waiting list order: Always compute priority score (emergency: 1000, urgent: 500, normal: 0) before sorting by queue number.
- Web Audio cleanup: Every `AudioBufferSourceNode` creation must register `source.onended = () => { filter.disconnect(); compressor.disconnect(); gainNode.disconnect(); source.disconnect(); }`.
- Audio cache: Max size 20 entries (LRU eviction).

### Multi-Tenant Security Contract
- No client-side query may omit `where('clinic_id', '==', cData.id)`.
- Public tracking route `/track/[appointmentId]` returns only `{ id, queue_number, status, estimated_wait }` for that specific appointment.

## Code Layout
- `src/app/clinic/[slug]/admin/accounts/page.tsx`: Clinic financial accounts page
- `src/app/clinic/[slug]/admin/patients/[patientId]/page.tsx`: Patient medical records & details
- `src/app/clinic/[slug]/admin/patients/page.tsx`: Patient directory & registration
- `src/app/clinic/[slug]/tv/WaitingRoomTvClient.tsx`: Waiting room display & audio announcer
- `src/app/clinic/[slug]/track/[appointmentId]/page.tsx`: Public queue tracking
- `src/app/invoice/[invoiceId]/page.tsx`: Invoice rendering
- `src/app/prescription/[appointmentId]/page.tsx`: Prescription rendering
- `src/lib/ClinicPublicAccessGuard.tsx`: Subdomain & public access routing guard
- `firestore.rules`: Firestore security rules
- `tests/e2e/`: Playwright E2E test suites and fixtures
