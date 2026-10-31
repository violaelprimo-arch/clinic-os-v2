## 2026-10-27T19:30:22Z

You are teamwork_preview_worker_m1, an implementation worker.
Working directory: e:\progict\clinic-os-v2\.agents\teamwork\teamwork_preview_worker_m1
Original request: e:\progict\clinic-os-v2\.agents\teamwork\ORIGINAL_REQUEST.md
Project plan: e:\progict\clinic-os-v2\PROJECT.md
Survey 1 report: e:\progict\clinic-os-v2\.agents\teamwork\teamwork_preview_explorer_survey_1\survey_report.md
Project root: e:\progict\clinic-os-v2

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE WRITE OWNERSHIP:
You own and may edit ONLY these files:
- `src/app/clinic/[slug]/admin/accounts/page.tsx`
- `src/app/clinic/[slug]/admin/patients/[patientId]/page.tsx`
- `src/components/clinic/ClinicPublicAccessGuard.tsx`
- `eslint.config.mjs`

INSTRUCTIONS:
1. First, read `e:\progict\clinic-os-v2\.agents\teamwork\ORIGINAL_REQUEST.md`, `e:\progict\clinic-os-v2\PROJECT.md`, and `e:\progict\clinic-os-v2\.agents\teamwork\teamwork_preview_explorer_survey_1\survey_report.md`.
2. Initialize `progress.md` in your working directory with a "Last visited: [timestamp]" header and update it after every step.
3. Implement the fixes for Requirement R1 & Acceptance Criteria C1:
   - In `src/app/clinic/[slug]/admin/accounts/page.tsx`:
     * Decouple heavy client libraries (`html2canvas`, `jspdf`, `exceljs`, `printService`) from top-level imports by loading them dynamically (`await import(...)`) inside export and print click handlers.
     * Use `next/dynamic` with `ssr: false` for `InvoiceView`.
     * Implement client-side table pagination (10 items per page) with page controls to avoid rendering thousands of DOM nodes simultaneously.
     * Add scoped date filtering / query limit to prevent unpaginated historic Firestore collection downloads.
   - In `src/app/clinic/[slug]/admin/patients/[patientId]/page.tsx`:
     * Implement `safeDecodePatientId(patientId: string): string` with try/catch and fallback for `%2B`, `+`, `%252B`, and malformed URI escapes to eliminate unhandled `URIError`.
     * Fix the appointments query on line 206 to include `where('clinic_id', '==', cData.id)` to enforce multi-tenant isolation!
     * Use `getPhoneSearchVariants` from `@/lib/countryPhoneHelper` to match phone variants (`+20...` vs `010...`).
     * Dynamically import document generators (`A4Prescription`, `pdfGenerator`, `printService`).
   - In `src/components/clinic/ClinicPublicAccessGuard.tsx`:
     * Fix pathname detection on clinic subdomains (`/admin`, `/admin/*`, `/login`, `/login/*`) so admin pages do not enter false redirect loops or show `<ClinicLoading />` on SSR.
   - In `eslint.config.mjs`:
     * Add `.agents/**`, `tests/**`, `scripts/**`, `.open-next/**` to `globalIgnores`.
     * Configure `@typescript-eslint/no-explicit-any: "warn"` to prevent heap OOM and build crashes.
4. Run verification commands:
   - `npx tsc --noEmit` (must pass with 0 errors)
   - `npm run build` (must pass with exit code 0)
   - `npx @opennextjs/cloudflare build` (must pass with exit code 0)
   - `npx eslint src/app/clinic/[slug]/admin/accounts/page.tsx src/app/clinic/[slug]/admin/patients/[patientId]/page.tsx`
5. Record all build and test command outputs in `handoff.md`.
6. Write `handoff.md` following the Handoff Protocol (Observation, Logic Chain, Caveats, Conclusion, Verification Method).
7. Send a message to orchestrator with your results when complete.
