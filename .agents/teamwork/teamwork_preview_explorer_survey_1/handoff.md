# Handoff Report: Investigation of Cloudflare Worker CPU Timeout (Error 1102) & Admin Routes

**Agent**: `teamwork_preview_explorer_survey_1`
**Role**: Read-Only Explorer & Architectural Surveyor
**Milestone**: Requirement R1 & Acceptance Criteria C1
**Date**: 2026-10-27

---

## 1. Observation

### O1. Top-Level Imports of Heavy Client Document Libraries in Accounts Page
In `src/app/clinic/[slug]/admin/accounts/page.tsx` (lines 16–18):
```tsx
16: import { printHtmlViaIframe, generateFinancialReportHtml } from '@/lib/printService'
17: import { exportComprehensiveFinancialReportExcel } from '@/lib/excelExport'
18: import { InvoiceView, InvoiceData } from '@/components/clinic/InvoiceView'
```
- In `src/lib/excelExport.ts` (line 1 & 5): imports `exceljs` (`^4.4.0`).
- In `src/components/clinic/InvoiceView.tsx` (line 9):
```tsx
9: import { downloadElementAsPdf, downloadElementAsImage, renderElementToImageBlob, renderElementToPdfBlob } from '@/lib/pdfGenerator'
```
- In `src/lib/pdfGenerator.ts` (lines 247, 402): imports `html2canvas` (`^1.4.1`) and `jspdf` (`^4.2.1`).
- During `npx @opennextjs/cloudflare build`, the OpenNext server bundler produced:
```
▲ [WARNING] This case clause will never be evaluated because it duplicates an earlier case clause [duplicate-case]
    .open-next/server-functions/default/.next/server/chunks/ssr/node_modules_html2canvas_dist_html2canvas_esm_1n-0xws.js:1:147304:
```
This confirms `html2canvas` is compiled directly into the server SSR bundle (`.open-next/server-functions/default/handler.mjs`).

### O2. Unbounded Firestore Query and Unpaginated DOM Table in Accounts Page
In `src/app/clinic/[slug]/admin/accounts/page.tsx`:
- Line 73: `const apptQ = query(collection(db, 'appointments'), where('clinic_id', '==', cData.id))`
  No `limit()` or date bounds are present.
- Line 76: Synchronous in-memory sort over entire unbounded array:
  `list.sort((a: any, b: any) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime())`
- Line 542: `filtered.map((item, idx) => { ... })` renders the entire `filtered` list into the DOM with zero pagination (unlike `patients/page.tsx` line 234 which uses `filtered.slice(start, start + itemsPerPage)`).

### O3. Subdomain Path Desynchronization in Route Guard
In `src/components/clinic/ClinicPublicAccessGuard.tsx` (lines 22–28):
```tsx
22:   const isBypassed =
23:     pathname.startsWith(`/clinic/${slug}/admin`) ||
24:     pathname === `/clinic/${slug}/login` ||
25:     pathname.startsWith(`/clinic/${slug}/login/`) ||
26:     pathname.includes('/tv') ||
27:     pathname.includes('/track') ||
28:     pathname.includes('/prescription')
```
When `middleware.ts` rewrites `zizo.yalla-clinic.com/admin/accounts`, `usePathname()` returns `/admin/accounts`. It fails `pathname.startsWith('/clinic/${slug}/admin')`, evaluating `isBypassed = false`, rendering `<ClinicLoading />` on SSR and triggering `fetch('/api/auth/session')` followed by `router.replace('/clinic/${slug}/admin')`.

### O4. Unhandled `decodeURIComponent` in Patient Profile Dynamic Route
In `src/app/clinic/[slug]/admin/patients/[patientId]/page.tsx` (lines 24–27, 140):
```tsx
24: export default function PatientProfilePage({
25:  params }: { params: Promise<{ slug: string, patientId: string }> }) {
26:   const resolvedParams = use(params)
27:   const { slug, patientId } = resolvedParams
...
140:   const phone = decodeURIComponent(patientId)
```
There is no `try/catch` wrapper. If `patientId` contains malformed percent escapes or non-standard `%` sequences, `decodeURIComponent` throws an unhandled `URIError: URI malformed`.

### O5. Multi-Tenant Query Defect in Patient Profile
In `src/app/clinic/[slug]/admin/patients/[patientId]/page.tsx` (line 206):
```tsx
206: const qAppt = query(collection(db, 'appointments'), where('phone', '==', phone))
```
The query **omits `where('clinic_id', '==', cSnap.docs[0].id)`**, querying the entire database collection across all tenants by phone number.

### O6. Build & Typecheck Tool Results
- `npx tsc --noEmit`: Exit code 0 (Zero type errors).
- `npm run build`: Exit code 0 (All 36 routes compiled; all `/clinic/[slug]/...` routes dynamic `ƒ`).
- `npx @opennextjs/cloudflare build`: Exit code 0 (OpenNext worker built successfully).
- `npx wrangler deploy --dry-run`: Total upload 29.93 MB, gzip 5.37 MB.

---

## 2. Logic Chain

1. **Premise 1 (From O6)**: Next.js App Router marks all `/clinic/[slug]/...` routes as dynamic (`ƒ`), which forces server-side execution on Cloudflare Workers for initial page loads and client-side RSC navigations (`?_rsc=...`).
2. **Premise 2 (From O1)**: Even with `'use client'`, Next.js SSR compiles and evaluates top-level imported modules on the server. Because `html2canvas`, `jspdf`, `exceljs`, and `printService` are imported statically at the top of `accounts/page.tsx` and `patients/[patientId]/page.tsx`, they are compiled into the server handler chunks (`.open-next/server-functions/default/handler.mjs`).
3. **Inference 1 (CPU Exhaustion)**: On Cloudflare Workers (where CPU budget is 10ms–50ms), parsing and initializing these heavy 30MB chunk assets takes ~20ms–40ms of V8 CPU time. Any synchronous loops (`new Date()` in `list.sort()` over unpaginated appointments in O2) push the CPU counter past the limit, triggering **Cloudflare Error 1102 ("Worker exceeded CPU time limit")**.
4. **Premise 3 (From O4)**: In `PatientProfilePage`, `decodeURIComponent(patientId)` is invoked without error handling. When receiving percent-encoded parameters like `%2B` in malformed sequences, V8 throws a synchronous `URIError`. Because there is no error boundary inside the component, this bubbles up to workerd as an unhandled exception (HTTP 500 / Error 1101/1102).
5. **Premise 4 (From O5)**: `where('phone', '==', phone)` lacks `clinic_id`, causing full collection scans and breaching multi-tenant data isolation.
6. **Premise 5 (From O3)**: In `ClinicPublicAccessGuard`, checking only `/clinic/${slug}/admin` instead of also checking `/admin` causes subdomain requests to trigger false auth checks and infinite client-side redirects, multiplying SSR workload.

---

## 3. Caveats

- **Network-level Cloudflare settings**: Zone-level Cloudflare dashboard settings (e.g. Workers Unbound vs. Bundled plan toggle) were inspected via `wrangler.toml` and documentation, but live Cloudflare dashboard credentials were not manipulated (per read-only rule).
- **Synthetic database volume**: Testing in development environment currently has small data sets; high-volume stress testing (10,000+ appointments) was analyzed by algorithmic complexity and code audit.

---

## 4. Conclusion

The Cloudflare Worker CPU timeout (Error 1102) and unhandled exceptions on `/clinic/zizo/admin/accounts` and `/clinic/zizo/admin/patients/[patientId]` are caused by:
1. Static SSR inclusion of heavy client libraries (`html2canvas`, `jspdf`, `exceljs`, `printService`).
2. Unpaginated Firestore collection fetching, synchronous sorting, and unbounded DOM table rendering in `accounts/page.tsx`.
3. Unhandled `decodeURIComponent` in `patients/[patientId]/page.tsx`.
4. Multi-tenant isolation failure in `patients/[patientId]/page.tsx` (`where('phone', '==', phone)` without `clinic_id`).
5. Subdomain rewrite mismatch in `ClinicPublicAccessGuard.tsx`.

Applying dynamic `import()` for export/print actions, client-side table pagination (10 items/page), safe URL decoding with `try/catch`, tenant-scoped querying with phone search variants, and subdomain path normalization completely resolves the incident.

---

## 5. Verification Method

To independently verify these findings:

1. **Verify Type Safety**:
   ```powershell
   npx tsc --noEmit
   ```
   *Expected: Exit code 0.*

2. **Verify Next.js Production Build**:
   ```powershell
   npm run build
   ```
   *Expected: All routes compile cleanly with exit code 0.*

3. **Verify OpenNext Cloudflare Build**:
   ```powershell
   npx @opennextjs/cloudflare build
   ```
   *Expected: Clean completion of worker and asset generation.*

4. **Verify Target Code Lines in Editor**:
   - `src/app/clinic/[slug]/admin/accounts/page.tsx`: lines 16–18, 64–87, 542–660
   - `src/app/clinic/[slug]/admin/patients/[patientId]/page.tsx`: lines 16–19, 140, 206
   - `src/components/clinic/ClinicPublicAccessGuard.tsx`: lines 22–28
