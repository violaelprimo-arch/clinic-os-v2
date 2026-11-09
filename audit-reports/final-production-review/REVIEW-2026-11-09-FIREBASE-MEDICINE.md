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
