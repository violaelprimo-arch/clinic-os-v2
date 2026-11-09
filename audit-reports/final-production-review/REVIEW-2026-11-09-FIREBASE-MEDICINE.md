# Yalla Clinic — Firebase + Security + Medicine Sync Review
Date: 2026-11-09 (Africa/Cairo)
Repository: violaelprimo-arch/clinic-os-v2
Review branch: fix/username-login-branch-operations-20261109
PR: https://github.com/violaelprimo-arch/clinic-os-v2/pull/7

## Implemented in the review branch

1. Doctor/assistant login accepts a username or email, with clinic ownership checks; passwords continue to be stored as salted hashes instead of plaintext.
2. Firebase custom tokens are minted after verification, scoped by `clinic_id` and `clinicRole`; login pages sign in with `signInWithCustomToken`.
3. Sensitive clinic Firestore documents are not directly readable by staff SDK clients. Staff-specific API returns allowlisted clinic metadata.
4. Admin dashboard/layout/booking page use authenticated server-side clinic profile reads.
5. Patient login, registration and tracking UI use sanitized clinic profile lookups where applicable.
6. Owner-side doctor/assistant username fields and responsive credential-form layout were added.
7. Branch opening/closing and management APIs were fixed; booking endpoint denies closed/archived branches. The owner branch manager has an open/close control.
8. DawaaGate sync separates targeted refresh metadata from the daily scheduled update; a Firestore transaction-based lease prevents concurrent ownership, and an empty/broken upstream response cannot be recorded as success.
9. Patient credential lookup is indexed and restricted to the requested clinic ID. A previous appointment is no longer accepted as evidence for creating a patient account with an arbitrary password.
10. Firestore Rules prohibit unauthenticated patient_account creation and restrict prescription writes to the doctor role. Emulator tests were extended.

## Evidence
- GitHub Actions validation run: https://github.com/violaelprimo-arch/clinic-os-v2/actions/runs/42595628812 — **success**.
- The run checks TypeScript, policy unit tests, Firestore rules with the emulator, Next production build and Cloudflare OpenNext bundling. It does **not** deploy.
- Firebase console observed `Email/Password` and `Google` providers enabled in project `clinic-os-d2d1b`.
- The live `https://yalla-clinic.com/login` screen still shows email-only login at the time of the browser inspection.

## Unverified / release blockers — MUST NOT CLAIM PRODUCTION-READY
1. No access from this Chat-mode connection to edit Firebase Console or view/deploy active Firestore Rules. Rules are only verified locally by emulator.
2. No evidence that the Cloudflare Worker version contains this branch, that its service account secrets are configured, or that the scheduled handler executed in production at 06:00 Cairo.
3. DawaaGate's source access authorization and completeness of the initial medicine catalog have not been established. Current incremental price updater scans a bounded number of the latest price-change pages; this is not a validated full-catalog refresh.
4. Username/email Google sign-in, session logout and cross-subdomain behavior require real Firebase Auth end-to-end tests.
5. Remaining patient medical record access and identity verification require end-to-end tests. A phone number alone does not prove ownership of private health records; OTP/recovery workflow has not been implemented.
6. Other clinic UI components may still need an audit for direct SDK access to restricted documents.
7. A real branch toggle/booking test and post-deployment drug price comparison against DawaaGate have not been performed.
8. Username and patient phone uniqueness currently depend on indexed lookups and application validation; high-concurrency registration and migration tests are still needed.

## Required deployment gate
- Set production Firebase/Cloudflare credentials through approved secret management; never commit private keys.
- Check authorized domains and Firebase token scopes; confirm provider behavior.
- Validate all routes against staging, including real doctor/assistant and patient accounts.
- Deploy Firebase rules and application code together only when dependent clients are migrated.
- Run a staged manual medicine sync and inspect persisted Firestore records before declaring update healthy.
- Verify Cairo-time scheduled event and retries through Cloudflare logs.
- Confirm rollback and data backup are available before merging this PR into master.

**Status: CODE REVIEW BUILD PASSED; PRODUCTION NOT DEPLOYED.**
