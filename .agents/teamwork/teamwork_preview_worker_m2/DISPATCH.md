## 2026-10-27T20:35:33Z

You are teamwork_preview_worker_m2, an implementation worker for Milestone M2.
Working directory: e:\progict\clinic-os-v2\.agents\teamwork\teamwork_preview_worker_m2
Original request: e:\progict\clinic-os-v2\.agents\teamwork\ORIGINAL_REQUEST.md
Project plan: e:\progict\clinic-os-v2\PROJECT.md
Survey 2 report: e:\progict\clinic-os-v2\.agents\teamwork\teamwork_preview_explorer_survey_2\survey_report.md
Project root: e:\progict\clinic-os-v2

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE WRITE OWNERSHIP:
You own and may edit ONLY these files:
- `src/app/clinic/[slug]/tv/WaitingRoomTvClient.tsx`
- `src/app/clinic/[slug]/admin/patients/page.tsx`
- `src/components/clinic/AdminDashboard.tsx`
- `src/app/api/clinic/[slug]/queue/route.ts`

INSTRUCTIONS:
1. Read `ORIGINAL_REQUEST.md`, `PROJECT.md`, and `teamwork_preview_explorer_survey_2/survey_report.md`.
2. Initialize `progress.md` with "Last visited: [timestamp]" and keep it updated.
3. In `src/app/clinic/[slug]/tv/WaitingRoomTvClient.tsx`:
   - TV Queue Priority: In `nextWaitingPatients`, use `sortQueue(branchAppointments, clinic)` from `@/lib/queueCalculations` so urgent and emergency patients jump to the head of the TV list matching the doctor's view.
   - Audio Memory Leaks:
     * Implement a capped/LRU AudioBuffer cache (max 25 entries) for `ttsAudioCache` instead of unbounded growth.
     * Attach `source.onended = () => { try { source.disconnect(); warmthFilter?.disconnect(); clarityFilter?.disconnect(); compressor?.disconnect(); masterGain?.disconnect(); } catch (e) {} }` in `playCloudTtsAudio`.
     * Attach onended disconnect cleanup in `playChimeSound`.
     * Close `audioCtxRef.current` in the `useEffect` cleanup hook.
   - Recall Reliability: Update `currentCallKey` to `${currentPatient.id}_${currentPatient.calledAt || currentPatient.startedAt || currentPatient.queue_number}` so doctor clicking recall triggers an audio re-announcement.
4. In `src/app/clinic/[slug]/admin/patients/page.tsx:304`:
   - Replace raw `addDoc` walk-in registration with `createAtomicAppointment` from `@/lib/queueService` to ensure a guaranteed sequential `queue_number`.
5. In `src/components/clinic/AdminDashboard.tsx`:
   - Ensure patient call/recall actions set `calledAt: new Date().toISOString()`.
6. In `src/app/api/clinic/[slug]/queue/route.ts:25`:
   - Align date calculation to Cairo timezone using `new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date())`.
7. Verify with `npx tsc --noEmit` and `npm run build`.
8. Document all findings and results in `handoff.md` and notify orchestrator when done.
