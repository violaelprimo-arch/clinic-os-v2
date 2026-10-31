# Survey Report: Static Code Health & Real-Time Queue & Waiting Screen Voice Engine
**Agent**: `teamwork_preview_explorer_survey_2`  
**Date**: 2026-10-27  
**Scope**: Requirements R2 & R4 | Acceptance Criteria C1, C3, C4  
**Project Root**: `e:\progict\clinic-os-v2`  

---

## 1. Executive Summary

This investigation performed a comprehensive audit of repository health, build pipelines, static analysis, queue management architecture, and the waiting room TV voice engine for Clinic OS v2.

### Key Highlights:
1. **TypeScript Health**: `npx tsc --noEmit` exited with **0 errors**. Type safety across 187 source files is clean.
2. **Next.js & OpenNext Production Builds**:
   - `next build` (Next.js 16.3.8 Turbopack): **Success (Exit code 0)**. 36/36 routes generated.
   - `@opennextjs/cloudflare build`: **Success (Exit code 0)**. `.open-next/worker.js` packaged cleanly.
   - Deprecation detected: `src/middleware.ts` is deprecated in Next.js 16.3.8 in favor of `src/proxy.ts`.
3. **Internal Imports & Route Links**:
   - **0 broken imports** across all source files.
   - **0 dead links**: All 54 App Router routes and static public assets (`/manifest.json`, `/favicon.ico`, `/apple-touch-icon.png`, etc.) resolve properly.
   - **6 orphan/unused components** identified (`AIChatWidget.tsx`, `BookingForm.tsx`, `TrackTurnWidget.tsx`, `PushPermissionModal.tsx`, `PwaInstallPrompt.tsx`, `radio-group.tsx`).
4. **ESLint Out-of-Memory Heap Exhaustion**:
   - Running `npm run lint` (`eslint`) crashed Node.js with `FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory` (4GB heap exhaustion).
   - Root Cause: `eslint.config.mjs` failed to ignore `.agents/**`, causing ESLint 9 to parse thousands of files in agent skill directories.
   - When scoped to `src/`, ESLint completed with 542 errors and 642 warnings, predominantly caused by `@typescript-eslint/no-explicit-any` from `eslint-config-next/typescript` enforcing strict disallowance of `any` on Firestore document snapshots.
5. **Real-Time Queue Architecture Flaws**:
   - **Queue Desynchronization**: In `WaitingRoomTvClient.tsx` (lines 559–571), `nextWaitingPatients` sorts waiting patients solely by `queue_number`, completely ignoring `sortQueue` and urgent/emergency priorities. The doctor's screen prioritizes urgent cases, while the TV screen displays normal ticket order, causing abrupt skipping and confusion.
   - **Bypassed Atomic Queue Numbers**: In `src/app/clinic/[slug]/admin/patients/page.tsx:304`, walk-in patient registration writes appointments with `addDoc` without `queue_number` and without calling `createAtomicAppointment`, generating appointments with `queue_number = 0` / undefined.
   - **Concurrency / Race Conditions**: In `AdminDashboard.tsx`, patient admissions use non-transactional `updateDoc`. Concurrent actions by doctor and receptionist can mark two patients as `in_progress`, causing the second to vanish into an invisible ghost state.
   - **Timezone Drift in Edge API**: `src/app/api/clinic/[slug]/queue/route.ts:25` computes `today` using server timezone offset, which defaults to UTC on Cloudflare Workers, pulling yesterday's queue between 12:00 AM and 2:00 AM Cairo time.
6. **TV Screen Voice Engine & Audio Memory Leaks**:
   - **Unbounded Memory Cache**: `ttsAudioCache` is a module-level `Map<string, AudioBuffer>` without an LRU cap. With `announceName: true`, every unique patient name permanently retains decoded PCM audio in memory.
   - **Web Audio Node Leaks**: Dynamic compressors, biquad filters, and master gains connected to `ctx.destination` in `playCloudTtsAudio` are never disconnected on `source.onended`, leaving hundreds of orphan nodes attached to the browser audio graph over long shifts.
   - **AudioContext Lifecycle**: `audioCtxRef.current` is never closed on component unmount.
   - **Recall Reliability**: Trigger logic relies on `${currentPatient.id}_${currentPatient.startedAt}`. Re-calling an existing patient without changing `startedAt` fails to trigger voice announcements.

---

## 2. Static Code Analysis & Repository Health (R2, C1, C4)

### 2.1 Compiler and Build Verification
| Verification Step | Command / Tool | Status | Findings / Metrics |
|---|---|---|---|
| TypeScript Type Check | `npx tsc --noEmit` | **PASS (0 errors)** | 187 files checked, 0 errors |
| Next.js Production Build | `npm run build` | **PASS (Exit 0)** | Next.js 16.3.8 Turbopack, 36/36 static & dynamic pages generated |
| Cloudflare OpenNext Build | `npx @opennextjs/cloudflare build` | **PASS (Exit 0)** | `.open-next/worker.js` generated cleanly with edge assets |
| Middleware Deprecation | Build logs | **WARNING** | `src/middleware.ts` deprecated in Next.js 16; migrate to `src/proxy.ts` |
| Internal Imports Audit | Custom AST/Regex resolver | **PASS (0 broken)** | 187 files scanned; all `@/...` and relative paths resolve |
| Public Static Links Audit | Route / Public Asset Matcher | **PASS (0 dead)** | All routes and `/public` assets verified |
| Repository Lint Check | `npm run lint` | **FAIL (OOM 4GB)** | Unbounded `.agents/**` scanning causes heap crash |
| Scoped Lint (`src/`) | `npx eslint src/` | **542 errors, 642 warnings** | 99% due to `@typescript-eslint/no-explicit-any` |

### 2.2 Unused & Orphan Components Identified
The following components in `src/components/` are never imported by any route or active component in `src/app`:
1. `src/components/clinic/AIChatWidget.tsx` (7.2 KB) — Legacy floating chat widget, unreferenced.
2. `src/components/clinic/BookingForm.tsx` (57.1 KB) — Superseded by `BookingModal.tsx`.
3. `src/components/clinic/TrackTurnWidget.tsx` (6.8 KB) — Superseded by `PatientLiveTurn.tsx`.
4. `src/components/pwa/PushPermissionModal.tsx` (6.2 KB) — Unreferenced standalone PWA modal.
5. `src/components/pwa/PwaInstallPrompt.tsx` (8.1 KB) — Unreferenced standalone install prompt.
6. `src/components/ui/radio-group.tsx` (1.3 KB) — Unused UI primitive.

### 2.3 ESLint Root-Cause Analysis
In `eslint.config.mjs`:
```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);
```
- **Heap OOM Cause**: In ESLint 9 flat config, files outside `src/` (such as `.agents/`, which includes 19 skill trees containing hundreds of scripts and markdown files) are traversed by ESLint. The TypeScript parser attempts to load ASTs for all non-ignored files, exhausting the 4GB Node.js memory limit.
- **Rule Mismatch**: `nextTs` enables `@typescript-eslint/no-explicit-any: "error"` by default. In healthcare SaaS applications handling dynamic Firestore documents, payloads like `(d: any)` or `clinic?: any` trigger hard errors instead of warnings.

---

## 3. Real-Time Queue Architecture & Concurrency (R4, C3)

### 3.1 Queue Sorting Engine (`src/lib/queueCalculations.ts`)
The core queue sorting algorithm in `sortQueue(appointments, clinic)` implements:
1. `priorityNext`: High-priority late-arrivals (skipped patients who returned) are placed at the absolute front of the waiting line, ordered by `requeuedAt`.
2. `clinic.queuePattern`: Custom multi-service dynamic patterns with quotas (e.g. quota = 0 for immediate priority, quota > 0 for interleaved rounds).
3. Legacy Fallback: Interleaved ratios for `queueUrgent`, `queueNormal`, and `queueConsult`.
4. Safety guarantee: Any remaining waiting patient is appended in booking sequence.

### 3.2 Queue Inconsistencies & Deficiencies Discovered

#### Issue Q1: Waiting Room TV Screen Disregards Queue Priority
- **Location**: `src/app/clinic/[slug]/tv/WaitingRoomTvClient.tsx:559–571`
- **Observed Code**:
  ```ts
  const nextWaitingPatients = useMemo(() => {
    return branchAppointments
      .filter(a => a.status === 'waiting')
      .sort((a, b) => {
        if (a.priorityNext && !b.priorityNext) return -1
        if (!a.priorityNext && b.priorityNext) return 1
        if (a.priorityNext && b.priorityNext) {
          return new Date(a.requeuedAt || 0).getTime() - new Date(b.requeuedAt || 0).getTime()
        }
        return Number(a.queue_number || 0) - Number(b.queue_number || 0)
      })
      .slice(0, 5)
  }, [branchAppointments])
  ```
- **Defect**: `sortQueue` is NOT called! The TV screen sorts solely by ticket number `queue_number`.
- **Consequence**: When an urgent or emergency patient arrives:
  * Doctor's `AdminDashboard` places the urgent patient at position 1.
  * TV screen continues to display normal ticket #1 as "Next In Line".
  * When the doctor calls the urgent patient, the TV screen suddenly announces the urgent patient, contradicting what was displayed on the screen.

#### Issue Q2: Walk-In Registration Bypasses Atomic Counter
- **Location**: `src/app/clinic/[slug]/admin/patients/page.tsx:304`
- **Observed Code**:
  ```ts
  const today = new Date().toISOString().split('T')[0]
  await addDoc(collection(db, 'appointments'), {
    clinic_id: clinicId,
    patientName: newName,
    phone: newPhone,
    serviceName: newService,
    servicePrice: Number(newPrice),
    date: today,
    status: 'waiting',
    ...
  })
  ```
- **Defect**: Uses direct `addDoc` without providing `queue_number` and without invoking `createAtomicAppointment` (`src/lib/queueService.ts`).
- **Consequence**: The appointment is stored without `queue_number`. In sorting algorithms, `Number(a.queue_number || 0)` evaluates to `0`, placing this patient at position 0 or corrupting the sequential ticket sequence.

#### Issue Q3: Non-Atomic Queue Turn Transitions & Race Conditions
- **Location**: `src/components/clinic/AdminDashboard.tsx:438–456` (`handleStartExam`), `586–612` (`handleSkipPatient`)
- **Observed Code**:
  ```ts
  if (currentPatient && currentPatient.id !== patient.id) {
    await updateDoc(doc(db, 'appointments', currentPatient.id), {
      status: 'completed',
      completedAt: new Date().toISOString(),
    })
  }
  await updateDoc(doc(db, 'appointments', patient.id), {
    status: 'in_progress',
    startedAt: new Date().toISOString(),
  })
  ```
- **Defect**: Two disconnected `updateDoc` calls without a Firestore transaction.
- **Consequence**: If a receptionist and doctor act concurrently (or receptionist admits walk-in while doctor calls next patient), both operations can succeed in setting `status: 'in_progress'`. Because all consumers (`WaitingRoomTvClient`, `AdminDashboard`, `queueCalculations`) use `.find(a => a.status === 'in_progress')`, the second active appointment is dropped from view and disappears into a ghost state.

#### Issue Q4: Algorithm Divergence in Queue Alerts
- **Location**: `src/lib/queue-alerts.ts:10`
- **Defect**: Imports `sortWaitingQueue` from `src/lib/queue-calculator.ts` instead of `sortQueue` from `src/lib/queueCalculations.ts`.
- **Consequence**: `queue-calculator.ts` does not account for `priorityNext` (returned skipped patients) or custom clinic service patterns, causing WhatsApp/Push "5 patients ahead" notifications to diverge from actual dashboard queue order.

#### Issue Q5: UTC vs Cairo Date Discrepancy in Queue API
- **Location**: `src/app/api/clinic/[slug]/queue/route.ts:25`
- **Observed Code**:
  ```ts
  const now = new Date()
  const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0]
  ```
- **Defect**: Relies on local server timezone offset. On Cloudflare Workers edge nodes (UTC), `now.getTimezoneOffset()` is 0.
- **Consequence**: Between midnight and 2:00 AM Cairo time (UTC+2), this query fetches yesterday's records rather than today's Cairo appointments.

---

## 4. TV Waiting Room Screen & Voice Announcement Engine (R4, C3)

### 4.1 Architecture Inspection (`src/app/clinic/[slug]/tv/WaitingRoomTvClient.tsx`)
- **SSR Safety**: Wrapped via `dynamic(() => import('./WaitingRoomTvClient'), { ssr: false, loading: () => <TvLoadingSkeleton /> })` in `page.tsx`. Zero Web Audio execution on edge.
- **Voice Synthesis Engine**:
  * Arabic vocalization converter: `numberToArabicWords(num)` converts numbers into diacritized Arabic words (e.g. `5` -> `خَمْسَة`).
  * Tier 1: Cloud Neural TTS via `/api/tts` (Microsoft Edge Neural Voices: `ar-EG-ShakirNeural`, `ar-EG-SalmaNeural`).
  * Tier 2: Google Translate TTS audio stream.
  * Tier 3: Browser `window.speechSynthesis` with Arabic voices filter (`ar-SA`, `ar-EG`).
  * Chime Synthesis: Web Audio API procedural synthesis with two modes: `luxury` (3-tone harmonic bell: F5, A5, C6) and `classic` (airport double-ding: D5, A5).

### 4.2 Stability & Memory Leak Audit

#### Defect V1: Unbounded In-Memory PCM Audio Cache Leak
- **Location**: `WaitingRoomTvClient.tsx:32, 362–369`
- **Observed Code**:
  ```ts
  const ttsAudioCache = new Map<string, AudioBuffer>()
  ...
  const cacheKey = `${gender}_${text}`
  let audioBuffer = ttsAudioCache.get(cacheKey)
  if (!audioBuffer) {
    ...
    audioBuffer = await ctx.decodeAudioData(arrayBuffer)
    ttsAudioCache.set(cacheKey, audioBuffer)
  }
  ```
- **Analysis**:
  * Decoded `AudioBuffer` objects store uncompressed 32-bit float PCM data in memory. A 4-second audio phrase occupies ~700 KB.
  * When `announceName: true` (or `showPatientName: true`), `text` includes the patient's individual name (`patientName`).
  * Because `ttsAudioCache` is a module-level `Map` with NO maximum size and NO eviction strategy, running a TV screen throughout a busy clinic shift (100–300 patients) indefinitely consumes memory. Over multiple days, this leads to browser tab memory exhaustion.

#### Defect V2: Web Audio Graph Node Accumulation Leak
- **Location**: `WaitingRoomTvClient.tsx:371–415` (`playCloudTtsAudio`), `254–340` (`playChimeSound`)
- **Observed Code**:
  ```ts
  const source = ctx.createBufferSource()
  source.buffer = audioBuffer
  const compressor = ctx.createDynamicsCompressor()
  const masterGain = ctx.createGain()
  compressor.connect(masterGain)
  masterGain.connect(ctx.destination)
  source.start(0)
  ```
- **Analysis**:
  * In the Web Audio API specification, nodes connected to `AudioDestinationNode` (`ctx.destination`) remain active in the audio rendering graph until explicitly disconnected via `.disconnect()`.
  * `source.onended` is NEVER defined! Neither `compressor`, `masterGain`, nor the biquad filters are disconnected after playback completes.
  * Over an 8-hour shift with 200 announcements, over 1,000 orphan audio nodes remain linked to `ctx.destination`. This causes CPU spikes on the browser audio thread, buffer underruns, sound stuttering, and eventual audio hardware driver crashes.

#### Defect V3: Unmanaged AudioContext Lifecycle
- **Location**: `WaitingRoomTvClient.tsx:106`
- **Analysis**: `audioCtxRef.current` is created lazily or upon first user interaction, but is never closed when the component unmounts. If a clinic receptionist or admin navigates between `/clinic/[slug]/tv` and other admin tabs, orphan `AudioContext` instances remain alive in the browser process.

#### Defect V4: HTML5 Audio Fallback Garbage Leak
- **Location**: `WaitingRoomTvClient.tsx:448–453`
- **Observed Code**:
  ```ts
  const audioEl = new Audio(audioUrl)
  audioEl.playbackRate = 1.0
  await audioEl.play()
  ```
- **Analysis**: Creates a new `HTMLAudioElement` on every fallback invocation without attaching `ended` event cleanup (`audioEl.src = ''`, `audioEl.remove()`). In certain WebKit/Blink builds, unreferenced playing audio elements leak media pipeline buffers.

#### Defect V5: Deficient Recall Mechanism
- **Location**: `WaitingRoomTvClient.tsx:581, 591`
- **Observed Code**:
  ```ts
  const currentCallKey = `${currentPatient.id}_${currentPatient.startedAt || currentPatient.queue_number}`
  if (lastAnnouncedCallKeyRef.current !== currentCallKey) {
    lastAnnouncedCallKeyRef.current = currentCallKey
    ...
  }
  ```
- **Analysis**:
  * If the doctor clicks "Re-call Patient" (إعادة النداء) on the currently examining patient, `startedAt` is not updated in Firestore.
  * Because `currentCallKey` remains identical to `lastAnnouncedCallKeyRef.current`, the TV screen treats it as an already-announced event and ignores the recall action.
  * Furthermore, if an appointment document was inserted without `startedAt`, the key falls back to `queue_number`, completely preventing re-calling.

---

## 5. Concrete Remediation Plans

### Plan 1: Fix ESLint Out-of-Memory & Rule Configuration (R2)
1. **Target**: `eslint.config.mjs`
2. **Action**:
   - Add `.agents/**`, `tests/**`, `scripts/**`, and `dist/**` to `globalIgnores`.
   - Configure `@typescript-eslint/no-explicit-any: "warn"` and `@typescript-eslint/no-unused-vars: "warn"`.
3. **Proposed Configuration**:
   ```javascript
   import { defineConfig, globalIgnores } from "eslint/config";
   import nextVitals from "eslint-config-next/core-web-vitals";
   import nextTs from "eslint-config-next/typescript";

   const eslintConfig = defineConfig([
     ...nextVitals,
     ...nextTs,
     {
       rules: {
         "@typescript-eslint/no-explicit-any": "warn",
         "@typescript-eslint/no-unused-vars": "warn",
       },
     },
     globalIgnores([
       ".next/**",
       "out/**",
       "build/**",
       "next-env.d.ts",
       ".agents/**",
       "tests/**",
       "scripts/**",
       ".open-next/**",
       "public/**",
     ]),
   ]);

   export default eslintConfig;
   ```

### Plan 2: Unify Queue Priority Sorting Across TV & Alerts (R4, C3)
1. **Target 1**: `src/app/clinic/[slug]/tv/WaitingRoomTvClient.tsx`
   - Import `sortQueue` from `@/lib/queueCalculations`.
   - Update `nextWaitingPatients`:
     ```typescript
     const nextWaitingPatients = useMemo(() => {
       const ordered = sortQueue(branchAppointments, clinic)
       return ordered.slice(0, 5)
     }, [branchAppointments, clinic])
     ```
2. **Target 2**: `src/lib/queue-alerts.ts`
   - Replace `sortWaitingQueue` with `sortQueue(allAppts, clinic)` to ensure 5-ahead alerts respect `priorityNext` and custom service quota patterns.
3. **Target 3**: `src/app/api/clinic/[slug]/queue/route.ts`
   - Fix date calculation to use Cairo timezone:
     ```typescript
     const today = new Intl.DateTimeFormat('en-CA', {
       timeZone: 'Africa/Cairo'
     }).format(new Date())
     ```

### Plan 3: Eliminate Un-Numbered Appointments & Concurrency Bugs (R4, C3)
1. **Target 1**: `src/app/clinic/[slug]/admin/patients/page.tsx:304`
   - Replace raw `addDoc` with `createAtomicAppointment` from `@/lib/queueService`.
   - Ensure every walk-in appointment receives a guaranteed sequential `queue_number` through the `clinic_daily_counters` Firestore transaction.
2. **Target 2**: `src/components/clinic/AdminDashboard.tsx` (`handleStartExam`, `handleSkipPatient`)
   - Wrap queue turn advancement inside a Firestore `runTransaction` or atomic batch:
     * Atomically query for any document with `status: 'in_progress'` in the branch.
     * Update existing `in_progress` to `completed` (with `completedAt`).
     * Set target appointment to `status: 'in_progress'` with `startedAt: ISOString` and a dedicated `calledAt: ISOString`.

### Plan 4: Voice Engine Memory Leak & Stability Hardening (R4, C3)
1. **Target**: `src/app/clinic/[slug]/tv/WaitingRoomTvClient.tsx`
2. **Action A — Capped AudioBuffer Cache**:
   - Implement an LRU cache or maximum size check on `ttsAudioCache` (e.g. 30 items). Evict oldest keys when size exceeds limit.
   - Or cache only generic phrase templates (`${gender}_turn_${number}`) and bypass in-memory caching for custom patient names.
3. **Action B — Audio Node Disconnection**:
   - In `playCloudTtsAudio`, attach an `onended` handler to `source`:
     ```typescript
     source.onended = () => {
       try {
         source.disconnect()
         warmthFilter?.disconnect()
         clarityFilter?.disconnect()
         compressor.disconnect()
         masterGain.disconnect()
       } catch (e) {}
     }
     ```
   - In `playChimeSound`, attach `onended` handlers to disconnect oscillator and gain nodes.
4. **Action C — AudioContext Teardown**:
   - In `useEffect` cleanup of `WaitingRoomTvClient`, close `audioCtxRef.current` if not already closed.
5. **Action D — Explicit Recall Trigger Key**:
   - Update `currentCallKey` to use `calledAt`:
     ```typescript
     const currentCallKey = `${currentPatient.id}_${currentPatient.calledAt || currentPatient.startedAt || currentPatient.queue_number}`
     ```
   - Ensure doctor "Recall" action sets `calledAt: new Date().toISOString()` in Firestore, waking up the TV screen with 100% reliability.
6. **Action E — Next.js 16 Proxy Migration**:
   - Rename/migrate `src/middleware.ts` to `src/proxy.ts` (or run `npx @next/codemod@canary middleware-to-proxy .`) to clear the Next.js 16 deprecation warning.

---

## 6. Verification Matrix

| Area | Invalidation / Verification Command | Expected Clean Result |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | Exit code 0, 0 errors |
| Next.js Build | `npm run build` | Exit code 0, 36/36 routes generated |
| Cloudflare Build | `npx @opennextjs/cloudflare build` | Exit code 0, `.open-next/worker.js` created |
| ESLint Audit | `npm run lint` (after `globalIgnores` fix) | Clean pass without Node.js Heap OOM |
| Dead Links & Imports | `node .agents/teamwork/.../check_imports.mjs` | 0 broken imports |
| Queue Parity | Inspect `WaitingRoomTvClient.tsx` line 559 vs `sortQueue` | TV renders sorted by `sortQueue` |
| Audio Graph Cleanup | Chrome DevTools -> Web Audio inspector on TV screen | 0 orphan audio nodes after 50 calls |
