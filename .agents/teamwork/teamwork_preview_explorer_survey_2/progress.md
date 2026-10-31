# Progress - Survey 2 (Static Code Health + Queue & TV Voice Engine)

Last visited: 2026-10-27T19:28:15Z

## Status: Complete

- [x] Step 1: Log dispatch message and create BRIEFING.md
- [x] Step 2: Read and analyze `ORIGINAL_REQUEST.md`
- [x] Step 3: Static Code Analysis & Repo Health:
  - `npx tsc --noEmit` passed with 0 errors!
  - `npm run build` (`next build` Next.js 16.3.8) passed with code 0!
  - `npx @opennextjs/cloudflare build` passed with code 0 (`.open-next/worker.js` created)!
  - Deprecation: `src/middleware.ts` is deprecated in Next.js 16 in favor of `src/proxy.ts`.
  - ESLint OOM: `npm run lint` crashes with heap out of memory due to unignored `.agents/**`.
  - 0 broken internal imports across all 187 files.
  - 0 dead links; 6 orphan / unreferenced components detected.
- [x] Step 4: Investigate Queue Architecture:
  - Discovered TV screen queue desynchronization (`WaitingRoomTvClient.tsx:559` ignores `sortQueue` and urgent/emergency priorities).
  - Discovered un-numbered appointment creation (`admin/patients/page.tsx:304` uses raw `addDoc` without `queue_number`).
  - Identified race condition in dual `in_progress` status transitions in `AdminDashboard.tsx`.
  - Identified UTC vs Cairo date drift in `api/clinic/[slug]/queue/route.ts:25`.
- [x] Step 5: Investigate TV Waiting Room Screen & Voice Engine:
  - Discovered unbounded PCM memory cache (`ttsAudioCache`).
  - Discovered Web Audio node accumulation leak (compressor, masterGain, filters never disconnected on ended).
  - Discovered unmanaged AudioContext lifecycle across unmount.
  - Discovered unreliable patient recall trigger due to static `startedAt`.
- [x] Step 6: Formulate concrete remediation plans for R2 & R4 (C1, C3, C4).
- [x] Step 7: Author `survey_report.md`.
- [x] Step 8: Author `handoff.md` and notify orchestrator.
