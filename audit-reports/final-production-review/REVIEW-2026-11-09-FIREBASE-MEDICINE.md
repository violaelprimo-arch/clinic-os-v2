# Yalla Clinic release verification — 2026-11-09

## Implemented
- Username or email/password account resolution, doctor/assistant roles, Firebase custom-token bridge per origin, signed-cookie logout across subdomains, and credential-version revocation.
- Safe staff clinic profiles, operational-page migration away from credential-bearing Firestore documents, tenant-bound writes and doctor-only prescription modifications.
- Owner form username/email/password fields for existing and new clinics, responsive credential cards, localized refresh and expiration labels.
- Real branch open/close controls, persisted operational fields, input validation, canonical tenant reads; closed and archived branches denied by booking service.
- DawaaGate table dates and JSON-LD @graph parsing, correct 165 EGP Planchoren fixture, distinct package identities, price history, batched writes, resumable checkpoints, correct partial status and scheduled Cairo-time retries.
- Targeted price refresh does not mark the daily update complete. Failures preserve last valid prices.
- Atomic conditional Firestore leases, tested against eight simultaneous contenders and expired-owner takeover. Legacy HTTP rules deployment retired.
- Password recovery accepts the configured username/email, stores expiring one-use OTP hashes, and uses a server-only email sender. No recovery emails were sent during testing.
- Assistant settings hash new passwords, preserve omitted private hashes, reject duplicate identities and refresh the current doctor's session after account revocation. The emulator covers a save/edit/login round trip.
- Cloudflare Worker build uses Node 22+ and the correct OpenNext/scheduled Worker entry, with a complete dry-run validation.

## Automated evidence
- 36 access, capacity, branch identity and in-clinic booking policy tests passed.
- 10 source parser and Firebase credential tests passed.
- 3 assistant-credential normalization tests passed.
- 16 integration tests passed against a disposable Firestore emulator: tenant permissions, revocation, eight-way lease contention, real batch writes, username/email sign-in, cross-origin session recovery, partial medicine batches and fail-safe source failure.
- OpenNext production bundle and complete Wrangler dry-run passed before the final release upload; final GitHub checks and deployment are recorded on PR #7.
- Public source inspected on 2026-11-09: Planchoren 30 capsules current price 165 EGP (old price 150 EGP); the bundled 27,606-item catalog contains 150 EGP and requires the live overlay.

## Rollout and recovery
- Apply application code and versioned Firestore rules together; retain the prior Cloudflare Worker version and Firebase rules revision for rollback.
- This changes account metadata only when the owner or account holder explicitly changes credentials. Existing passwords are never reset during deployment.
- Source sync is incremental over a seven-day overlap on the first v2 run and since the last verified cycle afterward; a PARTIAL result is not full completion. The bundled catalog is retained.
- Full historical recrawling of the external source is not represented as completed.
- UI tests after deployment must verify the active Worker, owner clinic form, reversible demo-branch toggling, session bootstrap, source price overlay, and cron configuration.
- Native Google consent/password flows require the account holder when browser sign-in prompts require personal authentication. No credentials or patient data belong in reports.

## Live rollout evidence
- PRs #7 and #8 merged. Cloudflare successfully built and deployed commit `4733aa10a482d8ace5e724f59eaf7da8764a1a29`; Worker version `e4bbf596-b376-4e35-aa61-5d70d8217f82` became active on 2026-11-09 at 19:57 UTC. Cairo and Inter font assets are bundled locally after the clean Cloudflare build exposed an upstream font-resolver failure.
- Versioned Firestore rules published in project `clinic-os-d2d1b` at 21:57 Cairo. The staged editor text was compared exactly with the tested repository file before publishing.
- Live HTTP checks passed: sanitized public clinic profile (200), anonymous staff profile/session denied (401), forged cron headers denied (401), raw private clinic document denied (403).
- The first live manual sync persisted 71 additions and four price changes, then returned PARTIAL with cursor page 4. Full daily completion is not claimed for an unfinished batch.
- Demo branch close persisted after a full page reload; reopening succeeded and restored its original availability. No patient appointments or real account passwords were changed.
- Owner dashboard loaded under the deployed rules and displayed localized names/dates. The doctor demo tab requested a new login; the account holder was asked to sign in personally for the remaining live doctor-session check.
