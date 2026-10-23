# Landing page CMS and platform owner login

This change adds the public landing page, draft preview and owner CMS to the existing Firebase project. It does not migrate the clinic data to another provider. Existing clinic, doctor and patient routes remain in place.

## Required deployment settings

Keep the existing NEXT_PUBLIC_FIREBASE_* settings. Configure these **server secrets** on the Cloudflare Worker (Settings → Variables and Secrets), and in a local `.env.local` when developing:

- `FIREBASE_CLIENT_EMAIL`: service account email for this Firebase project.
- `FIREBASE_PRIVATE_KEY`: matching PEM private key; actual newlines and escaped `\n` are accepted.
- `FIREBASE_PROJECT_ID`: defaults to `NEXT_PUBLIC_FIREBASE_PROJECT_ID`.
- `FIREBASE_STORAGE_BUCKET`: defaults to `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`.
- `OWNER_SESSION_SECRET`: a unique random secret, at least 32 characters; no built-in fallback. An existing private `AUTH_SECRET` of sufficient length can also be used.

The service account needs Firestore data access and permission to create objects in the chosen Storage bucket. Firebase Authentication must be enabled for custom-token sign-in. Keep these credentials off GitHub and out of any `NEXT_PUBLIC_` variable. The REST integration uses Web Crypto and fetch to support Cloudflare Workers without the Firestore Node gRPC/eval path.

Without server credentials the public page displays its default marketing content. Forms return an explicit unavailable error; they do not pretend to save. Owner login and protected CMS writes fail closed. The feature must be configured before merging to a production deployment that depends on `/owner`.

## Owner account

The only platform owner email accepted by the new flow is `yallacodex@gmail.com`.

Lookup order:

1. Firestore document `owners/yallacodex@gmail.com`.
2. `owners/platform`.
3. `settings/global`.

Set `email` or `ownerEmail` to the exact owner email. Supply `ownerPasswordHash` (or `passwordHash`). Existing `ownerPassword` values and hashes made by the existing application verifier remain readable for compatibility; do not create new plaintext passwords.

For a new owner record, run `node scripts/owner-password-hash.mjs` in a local interactive terminal. It prompts for a password without echoing it and prints only a salted PBKDF2 hash. Save that value as `ownerPasswordHash` in the private owner document using Firebase Console. This script does not modify the database or reset an existing account. Never use a doctor or assistant record as the platform owner's credentials.

A successful login issues a signed HttpOnly `owner_session` cookie and a Firebase custom token with server-issued `platformOwner` and `ownerEmail` claims. Firebase sign-in enables the existing owner dashboard's direct Firestore operations. An unauthenticated request never mounts the owner dashboard and does not start clinic/settings listeners.

## Firestore rules and index

The changes in `firestore.rules` grant the platform-owner claim access to administrative collections and allow public **get** access to `site_settings/landing_page`. Visitor feedback and trial requests are readable only by the platform owner. New writes are validated by server routes. Review and merge these additions into the actual deployed rules rather than replacing unrelated production rules blindly.

The repository's existing demo clinic/patient rules are retained. They already contain broad public permissions and require a separate tenant-security review before production use. Gating `/owner` does not harden all pre-existing clinic endpoints.

The approved-review query needs the composite index in `firestore.indexes.json`. Deploy that index to the existing Firebase project, for example using Firebase CLI:

```
firebase deploy --only firestore:indexes --config firebase.landing.json --project YOUR_EXISTING_PROJECT_ID
```

Merge this index into the project's existing index manifest if managed elsewhere. Enable a Firestore TTL policy on `landing_rate_limits.expiresAt` to remove expired rate-limit markers automatically. These documents contain a one-way salted request key and expiry, not raw IP addresses.

## CMS workflow

- Open `/owner`, log in, select **الواجهة الرئيسية / Landing page**.
- Edit Arabic and English content, statistics, features, screenshots, partners and contacts. Uploads accept JPG/PNG/WebP up to 5 MB and go to the `landing/` folder in Firebase Storage. Previously uploaded images are not deleted automatically when removed from a draft.
- Preview desktop (1280 px) and mobile (390 px) with the actual page renderer. Drafts are passed only to a same-origin iframe and stay unpublished until **حفظ ونشر** succeeds. Preview forms are disabled.
- Visibility changes are part of the draft. Visitors receive published updates through the Firestore settings listener, with an HTTP polling fallback. Requests and moderated reviews are kept in separate collections.
- Reviews submitted by visitors always start with `approved: false`. Approval, hide and delete actions are immediate moderation actions. Only approved reviews are returned by the public API.
- Trial requests save contact details and `status: new`, plus the configured number of trial days. They do not automatically create a clinic or start its subscription. The owner contacts the doctor and activates the clinic using the existing workflow.
- The inbox shows the latest 200 reviews and trial requests. Older records are retained in Firestore.
- Default partner and review lists are empty. Add genuine entries through the CMS. The built-in SVG product views are illustrative and contain no real patient records.

## Verification

- `npm run test:landing`: server route tests with an isolated Firestore/OAuth fixture, session forgery/role isolation, CSRF, review moderation, persistent submission rate limiting, validation and phone normalization.
- `npm run test:landing:browser`: public page, Arabic/English, mobile/desktop, forms, authenticated CMS draft/preview/save and failure states with isolated HTTP fixtures.
- `npx tsc --noEmit` and `npm run build`.

The tests use no production patient records and do not prove that the production service-account permissions or owner record have been configured. Verify those settings on a preview deployment before merging. Pushing source to GitHub does not itself deploy Firestore rules or indexes.
