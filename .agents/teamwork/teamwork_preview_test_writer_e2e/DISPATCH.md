## 2026-10-27T19:30:22Z
You are teamwork_preview_test_writer_e2e, a specialized test writer.
Working directory: e:\progict\clinic-os-v2\.agents\teamwork\teamwork_preview_test_writer_e2e
Original request: e:\progict\clinic-os-v2\.agents\teamwork\ORIGINAL_REQUEST.md
Project plan: e:\progict\clinic-os-v2\PROJECT.md
Test infra: e:\progict\clinic-os-v2\TEST_INFRA.md
Survey 3 report: e:\progict\clinic-os-v2\.agents\teamwork\teamwork_preview_explorer_survey_3\survey_report.md
Project root: e:\progict\clinic-os-v2

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All tests must genuinely test real platform functionality. DO NOT create dummy tests, trivial assertions (like expect(true).toBe(true)), or mock away the actual business logic being tested.

EXCLUSIVE WRITE OWNERSHIP:
You own and may edit ONLY these files/directories:
- `playwright.config.ts`
- `tests/e2e/**`
- `tests/fixtures/**`
- `tests/helpers/**`
- `TEST_READY.md` (at project root)

INSTRUCTIONS:
1. First, read `e:\progict\clinic-os-v2\.agents\teamwork\ORIGINAL_REQUEST.md`, `e:\progict\clinic-os-v2\PROJECT.md`, `e:\progict\clinic-os-v2\TEST_INFRA.md`, and `e:\progict\clinic-os-v2\.agents\teamwork\teamwork_preview_explorer_survey_3\survey_report.md`.
2. Initialize `progress.md` in your working directory with a "Last visited: [timestamp]" header and update it after every step.
3. Design and implement the Playwright E2E automated test suite:
   - Configure `playwright.config.ts` to run E2E suites with base URL, Arabic locale (`ar-EG`), Cairo timezone (`Africa/Cairo`), and reasonable timeouts.
   - In `tests/fixtures/synthetic-data.ts`:
     * Create isolated synthetic clinic fixtures (`e2e-clinic-alpha` and `e2e-clinic-beta`) with setup and teardown helpers.
     * Ensure zero modification or deletion of live/production patient records.
   - Implement the test suites across the 4 personas and multi-tenant security:
     * `tests/e2e/01-owner.spec.ts`: Platform Owner (clinic provisioning, subscription management, doctor/branch assignment, suspension guards).
     * `tests/e2e/02-doctor.spec.ts`: Doctor (queue management, patient calling, medical file review, Rx clinical protocol selection, prescription PDF rendering, vital signs recording).
     * `tests/e2e/03-receptionist.spec.ts`: Receptionist (walk-in registration, appointment booking, queue status transitions [waiting, in_progress, skipped, priorityNext], invoice creation, discount application, thermal receipt).
     * `tests/e2e/04-patient.spec.ts`: Patient (public clinic booking, Egyptian mobile validation `01...`, date/service selection, live queue tracking, Google Maps directions).
     * `tests/e2e/05-multi-tenant-sec.spec.ts`: Multi-tenant security tests (cross-tenant data leakage blocked, patient ID with `%2B` resolves without 500/timeout, invoice/Rx IDOR blocked).
4. Verify tests follow the 4-tier methodology (Feature coverage, Boundary/Corner cases, Cross-feature interactions, Real-world scenarios).
5. Verify test syntax with `npx tsc --noEmit` and run a dry-run or verification of the test suite structure.
6. Create `TEST_READY.md` at project root `e:\progict\clinic-os-v2\TEST_READY.md` detailing runner commands and coverage summary table.
7. Record all outputs in `handoff.md`.
8. Send a message to orchestrator with your results when complete.
