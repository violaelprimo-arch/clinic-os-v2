This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## WP Sender booking notifications

The owner dashboard displays the WP Sender mode for each configured clinic and
uses the existing reminder settings and test-message action. Default reminder
offsets for new settings are 24 and 2 hours. Saved clinic rules take precedence.
For a queue-based booking, the first configured shift start is the reminder
anchor. If the clinic has no configured start time, only the confirmation is
scheduled. Reminders already in the past are skipped.

1. Deploy the Firestore indexes using
   `firebase deploy --only firestore:indexes --project clinic-os-d2d1b`.
   Wait for the `whatsapp_jobs` index on `status` and `scheduledAt` to be ready.
2. Store `WPSENDER_CLINICS_JSON` as a Cloudflare Worker secret on `clinic-os-v2`.
   Key it by the Firestore clinic document ID. For a first test use
   `{"CLINIC_ID":{"mode":"mock","senderNumber":"201000000000"}}`. Use an
   international sender number for each clinic. Mock mode never contacts WP Sender.
3. Deploy the Worker with `WPSENDER_LIVE_ENABLED = "false"`. In the owner
   WhatsApp panel, verify the clinic shows WP Sender mock mode. Use **رسالة اختبار**
   and make a consented test booking. The confirmation job should reach
   `mock_sent` and the two future reminders should have the corresponding due times.
4. After activating the Sender subscription and pairing the clinic's number by
   QR in WP Sender, update that clinic's secret entry to
   `{"mode":"live","senderNumber":"201000000000","apiKey":"REPLACE_ME"}`.
   Keep the key in the secret. Set `WPSENDER_LIVE_ENABLED = "true"` in the Worker
   deployment settings and use **رسالة اختبار** with a test number to check delivery.
   Mark a clinic `off` in the secret to stop its WP Sender messages.

The WP Sender API's acceptance is recorded as `accepted`. Delivery is verified
on the receiving phone or in WP Sender. Real jobs are never replayed after an
uncertain send response. Existing mock jobs cannot become live sends. Clinics
without a WP Sender entry continue to use the existing YCloud configuration.

Doctors can open **ربط الواتساب** from clinic administration to edit message
templates and choose WP Sender delivery for the prescription and invoice share
buttons. To allow QR pairing, add the clinic's dedicated WP Sender session ID
as `sessionId` and its API credential as `apiKey` in its existing
`WPSENDER_CLINICS_JSON` entry. QR loading works independently of the live-send
switch. The QR image is fetched by the server for the authenticated doctor.
Mock sends and live sends have independent monthly counters, including the
owner test action. A slot records a dispatch attempt.
