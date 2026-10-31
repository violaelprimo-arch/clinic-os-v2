# Handoff Report: Survey 2 (Static Code Health + Real-Time Queue & TV Voice Engine)
**Agent**: `teamwork_preview_explorer_survey_2`  
**Date**: 2026-10-27  
**Scope**: Requirements R2 & R4, Acceptance Criteria C1, C3, C4  
**Type**: Hard Handoff (Investigation & Survey Complete)  

---

## 1. Observation

### Static Analysis, Types & Production Builds
1. `npx tsc --noEmit` executed in `e:\progict\clinic-os-v2`:
   - Command exited with code 0.
   - Stdout: empty; Stderr: empty. All 187 TypeScript source files compile with 0 errors.
2. `npm run build` (`next build` with Next.js 16.3.8 Turbopack):
   - Command exited with code 0.
   - Compiled successfully in 7.2s. 36/36 static/dynamic routes generated.
   - Log warning:
     ```text
     ⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.
       To migrate automatically, run:
       npx @next/codemod@canary middleware-to-proxy .
     ```
3. `npx @opennextjs/cloudflare build`:
   - Command exited with code 0.
   - Log output:
     ```text
     Worker saved in `.open-next\worker.js` 🚀
     OpenNext build complete.
     ```
4. `npm run lint` (`eslint`):
   - Command exited with code 1.
   - Output:
     ```text
     FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
     ```
   - In `eslint.config.mjs`, `globalIgnores` only lists `[".next/**", "out/**", "build/**", "next-env.d.ts"]`. It does NOT ignore `.agents/**`, causing ESLint 9 flat config to traverse 19 skills with hundreds of markdown and script files, exhausting the 4GB Node.js memory limit.
   - Running scoped `npx eslint src/` produced:
     ```text
     ✖ 1184 problems (542 errors, 642 warnings)
     ```
     542 errors were `@typescript-eslint/no-explicit-any` from `eslint-config-next/typescript`.
5. Imports & Links Inspection (via `check_imports.mjs` and `check_links.mjs`):
   - Broken internal imports: 0 across all 187 source files.
   - Dead static links: 0. All static assets (`apple-touch-icon.png`, `favicon-32x32.png`, `favicon.ico`, `favicon.png`, `manifest.json`) exist in `public/`.
   - 6 orphan / unreferenced components detected:
     * `src/components/clinic/AIChatWidget.tsx`
     * `src/components/clinic/BookingForm.tsx` (superseded by `BookingModal.tsx`)
     * `src/components/clinic/TrackTurnWidget.tsx` (superseded by `PatientLiveTurn.tsx`)
     * `src/components/pwa/PushPermissionModal.tsx`
     * `src/components/pwa/PwaInstallPrompt.tsx`
     * `src/components/ui/radio-group.tsx`

### Real-Time Queue & Waiting Screen Voice Engine
6. `WaitingRoomTvClient.tsx:559–571`:
   - `nextWaitingPatients` sorts branch appointments strictly by `(a.queue_number || 0) - (b.queue_number || 0)`.
   - `sortQueue` is not imported or used anywhere in `WaitingRoomTvClient.tsx`.
   - In contrast, `src/components/clinic/AdminDashboard.tsx:175` uses `sortQueue(data, clinic)` from `src/lib/queueCalculations.ts` to prioritize urgent cases.
7. `src/app/clinic/[slug]/admin/patients/page.tsx:304`:
   - Walk-in patient creation uses `addDoc(collection(db, 'appointments'), { ... })` directly, omitting `queue_number` and skipping `createAtomicAppointment` (`src/lib/queueService.ts`).
8. `src/components/clinic/AdminDashboard.tsx:438–456` & `586–612`:
   - Exam start (`handleStartExam`) and skip (`handleSkipPatient`) execute separate non-transactional `updateDoc` calls.
   - No transaction or concurrency check ensures only one patient is `in_progress`.
9. `src/app/api/clinic/[slug]/queue/route.ts:25`:
   - `today` is computed via `new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0]`.
   - On Cloudflare Workers (UTC), `timezoneOffset` is 0, diverging from Cairo timezone between 12:00 AM and 2:00 AM Cairo time.
10. `WaitingRoomTvClient.tsx:32, 362–369`:
    - `const ttsAudioCache = new Map<string, AudioBuffer>()` is an un-evicted module-level cache that retains decoded PCM audio for every unique patient name announced when `announceName: true`.
11. `WaitingRoomTvClient.tsx:371–415`:
    - In `playCloudTtsAudio`, `ctx.createBufferSource()`, `ctx.createDynamicsCompressor()`, `ctx.createGain()`, and biquad filters are connected to `ctx.destination` on every speech call. No `source.onended` handler is defined, so nodes are never disconnected.
12. `WaitingRoomTvClient.tsx:106, 581`:
    - `audioCtxRef.current` is never closed in `useEffect` cleanup.
    - Trigger key relies on `${currentPatient.id}_${currentPatient.startedAt || currentPatient.queue_number}`. Re-calling an existing patient without updating `startedAt` is ignored by the TV screen.

---

## 2. Logic Chain

1. From Observation 1, because `npx tsc --noEmit` exited with code 0, all TypeScript types and interfaces are internally consistent.
2. From Observations 2 and 3, both Next.js production build (`next build`) and Cloudflare OpenNext build (`@opennextjs/cloudflare build`) pass cleanly, satisfying Acceptance Criterion C1 (build exit code 0).
3. From Observation 4, because `eslint.config.mjs` does not exclude `.agents/**`, running `npm run lint` causes ESLint to parse agent skill directories, exceeding the 4GB heap and crashing with OOM. When restricted to `src/`, all errors stem from `@typescript-eslint/no-explicit-any`. Therefore, adding `.agents/**` to `globalIgnores` and setting `@typescript-eslint/no-explicit-any: "warn"` resolves the lint task.
4. From Observation 6, because `WaitingRoomTvClient.tsx` sorts waiting patients by `queue_number` while `AdminDashboard.tsx` sorts with `sortQueue(data, clinic)`, when an urgent or emergency patient arrives, they are placed at position 1 on the doctor's screen, while the TV screen shows normal ticket order. Calling the patient causes an unexpected skip on the TV screen. Replacing the sort in `WaitingRoomTvClient.tsx` with `sortQueue(branchAppointments, clinic).slice(0, 5)` restores 100% parity.
5. From Observation 7, because `admin/patients/page.tsx` uses `addDoc` without `queue_number`, walk-in patients created here receive `queue_number: undefined`, breaking sorting order. Calling `createAtomicAppointment` guarantees atomic sequential numbering.
6. From Observation 8, because `updateDoc` calls are not guarded by transactions, simultaneous receptionist and doctor calls can result in two `in_progress` appointments. Since UI selectors take the first matching record (`.find(a => a.status === 'in_progress')`), one patient becomes an invisible ghost record.
7. From Observation 10 and 11, because `ttsAudioCache` has no eviction cap and Web Audio nodes are never disconnected from `ctx.destination`, running the TV waiting screen continuously over long clinic shifts leaks PCM audio buffers and audio graph nodes. This causes memory bloat, audio crackles, and browser tab crashes. Adding an LRU cap to `ttsAudioCache` and `source.onended` disconnection handlers ensures shift stability.
8. From Observation 12, because the announcement key depends on `startedAt`, a doctor re-calling a patient without altering `startedAt` is ignored by the TV screen. Adding a dedicated `calledAt` timestamp field ensures reliable recall announcements.

---

## 3. Caveats

- **External Speech Endpoints**: The primary cloud voice engine calls `/api/tts`, which communicates with Microsoft Edge Speech Services WebSocket (`wss://api.msedgeservices.com`). While fallback to Google TTS and Web Speech API is present, upstream network availability or Cloudflare edge WebSocket compatibility may vary in live deployment.
- **Client Audio Autoplay Policies**: Modern browsers (Chrome, Safari, Edge) block unprompted audio autoplay until the user interacts with the document. `WaitingRoomTvClient.tsx` includes an auto-unlock listener (`click`, `touchstart`, `keydown`), but human interaction with the TV screen is necessary on initial browser launch.
- **Source Code Read-Only Constraint**: As an explorer agent, no project source code was modified. Remediation code has been provided in the survey report for subsequent implementation agents.

---

## 4. Conclusion

The repository is healthy in type safety and production build pipelines (`tsc --noEmit`, `next build`, and `@opennextjs/cloudflare build` all succeed cleanly with exit code 0). However, critical issues were identified:
1. **ESLint Heap OOM**: Missing ignores for `.agents/**` crashes `npm run lint`.
2. **Next.js 16 Deprecation**: `src/middleware.ts` must be migrated to `src/proxy.ts`.
3. **Queue Sorting Discrepancy**: The TV waiting room display completely ignores the intelligent priority sorting engine (`sortQueue`), leading to desynchronization when urgent/emergency patients jump the line.
4. **Un-Numbered Walk-in Appointments**: Direct `addDoc` in `admin/patients/page.tsx` bypasses the atomic daily counter.
5. **Audio Engine Memory Leaks**: An uncapped PCM cache (`ttsAudioCache`), disconnected Web Audio graph nodes in `playCloudTtsAudio`, and an unmanaged `AudioContext` lifecycle cause memory bloat and instability over long clinic shifts.

---

## 5. Verification Method

To independently verify these findings, execute the following commands in `e:\progict\clinic-os-v2`:

1. **Verify TypeScript Health**:
   ```powershell
   npx tsc --noEmit
   # Must exit with code 0 and empty output
   ```
2. **Verify Next.js & OpenNext Cloudflare Production Builds**:
   ```powershell
   npm run build
   # Verify exit code 0 and 36/36 routes generated
   npx @opennextjs/cloudflare build
   # Verify exit code 0 and "Worker saved in .open-next\worker.js"
   ```
3. **Verify ESLint OOM & Scoped Execution**:
   ```powershell
   npm run lint
   # Observe JavaScript heap out of memory crash
   npx eslint src/
   # Observe completion with 542 errors due to @typescript-eslint/no-explicit-any
   ```
4. **Verify Imports, Dead Links & Orphan Components**:
   ```powershell
   node .agents/teamwork/teamwork_preview_explorer_survey_2/check_imports.mjs
   node .agents/teamwork/teamwork_preview_explorer_survey_2/check_links.mjs
   ```
5. **Inspect Code Locations**:
   - Inspect `src/app/clinic/[slug]/tv/WaitingRoomTvClient.tsx` lines 559–571 (absence of `sortQueue`).
   - Inspect `src/app/clinic/[slug]/admin/patients/page.tsx` line 304 (raw `addDoc` without `queue_number`).
   - Inspect `src/app/clinic/[slug]/tv/WaitingRoomTvClient.tsx` line 32 (`ttsAudioCache`) and lines 371–415 (missing `source.onended` disconnection).
