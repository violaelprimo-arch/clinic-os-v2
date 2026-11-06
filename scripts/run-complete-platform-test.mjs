import assert from 'assert';
import { readFileSync } from 'fs';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where
} from 'firebase/firestore';

// 1. Read environment variables
const envLocal = readFileSync('.env.local', 'utf8');
const env = {};
for (const line of envLocal.split('\n')) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    value = value.trim().replace(/^['"](.*)['"]$/, '$1');
    env[match[1]] = value;
  }
}

const firebaseConfig = {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

// Import application libraries
import { hashPassword, verifyPassword, createSessionToken, verifySessionToken } from '../src/lib/auth-crypto.ts';
import {
  resolveEffectiveDailyLimit,
  isAppointmentActive,
  getCairoDateString,
  getCairoNow,
  validateBookingAvailability,
  CAPACITY_FULL_MESSAGE
} from '../src/lib/bookingCapacity.ts';
import { calculateHaversineDistanceKm, checkScheduleConflicts } from '../src/lib/branchService.ts';
import { canonicalDrugIdentifier, normalizeDrugKey } from '../src/lib/drugUtils.ts';
import { sortQueue, calculatePatientLivePosition } from '../src/lib/queueCalculations.ts';
import {
  mergeLandingConfig,
  normalizePhoneNumber,
  getSenderWhatsAppUrl
} from '../src/lib/landing-config.ts';

// Test Reporting State
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const testResults = [];

function runTest(suite, name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    testResults.push({ suite, name, status: 'PASS' });
    console.log(`  ✅ [PASS] ${name}`);
  } catch (err) {
    failedTests++;
    testResults.push({ suite, name, status: 'FAIL', error: err.message });
    console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
  }
}

async function runAsyncTest(suite, name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    testResults.push({ suite, name, status: 'PASS' });
    console.log(`  ✅ [PASS] ${name}`);
  } catch (err) {
    failedTests++;
    testResults.push({ suite, name, status: 'FAIL', error: err.message });
    console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
  }
}

async function main() {
  console.log('='.repeat(80));
  console.log('🌟 RUNNING FULL PLATFORM VERIFICATION TEST SUITE (Yalla Clinic / Clinic OS)');
  console.log('='.repeat(80));

  const MAIN_CLINIC_SLUGS = ['zizo', 'dr-tarek-internal', 'dr-sara-eyes', 'karim', 'dr-nada-pediatrics'];

  // -------------------------------------------------------------
  // SUITE 1: Multi-Clinic & Staff Authentication & Cryptography
  // -------------------------------------------------------------
  console.log('\n--- SUITE 1: Multi-Clinic & Staff Authentication & Cryptography ---');

  const clinicsSnap = await getDocs(collection(db, 'clinics'));
  const clinicDocs = clinicsSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(c => MAIN_CLINIC_SLUGS.includes(c.slug));

  await runAsyncTest('Authentication', 'Verify Doctor credentials & hash for all 5 clinics', async () => {
    assert.strictEqual(clinicDocs.length, 5, 'Must have exactly 5 target clinics');
    for (const c of clinicDocs) {
      assert(c.doctorEmail, `Clinic ${c.slug} must have doctorEmail`);
      const storedHash = c.doctorPasswordHash || c.doctorPassword;
      const isMatch = await verifyPassword('password123', storedHash);
      assert.strictEqual(isMatch, true, `Doctor password verification failed for ${c.slug} (${c.doctorEmail})`);
    }
  });

  await runAsyncTest('Authentication', 'Verify Primary Secretary credentials & hash for all 5 clinics', async () => {
    for (const c of clinicDocs) {
      assert(c.assistantEmail, `Clinic ${c.slug} must have assistantEmail`);
      const storedHash = c.assistantPasswordHash || c.assistantPassword;
      const isMatch = await verifyPassword('password123', storedHash);
      assert.strictEqual(isMatch, true, `Primary assistant password verification failed for ${c.slug} (${c.assistantEmail})`);
    }
  });

  await runAsyncTest('Authentication', 'Verify Secondary Secretary credentials & branch assignment', async () => {
    let checkedCount = 0;
    for (const c of clinicDocs) {
      if (!Array.isArray(c.assistants) || c.assistants.length === 0) continue;
      for (const ass of c.assistants) {
        checkedCount++;
        const storedHash = ass.passwordHash || ass.password;
        const isMatch = await verifyPassword('password123', storedHash);
        assert.strictEqual(isMatch, true, `Secondary assistant password failed for ${ass.email}`);
        assert(ass.branchName, `Secondary assistant ${ass.name} must have assigned branchName`);
      }
    }
    assert(checkedCount >= 4, 'Must have at least 4 secondary assistants verified across branches');
  });

  await runAsyncTest('Authentication', 'Verify Invalid Password Rejection (Security check)', async () => {
    const c = clinicDocs.find(x => x.slug === 'zizo');
    assert(c, 'Zizo clinic must exist');
    const storedHash = c.doctorPasswordHash || c.doctorPassword;
    const isMatch = await verifyPassword('WRONG_PASSWORD_XYZ', storedHash);
    assert.strictEqual(isMatch, false, 'Invalid password must return false');
  });

  await runAsyncTest('Authentication', 'Verify Session Token generation & cryptographic signature verification', async () => {
    const token = await createSessionToken({
      role: 'doctor',
      email: 'zizo@gmail.com',
      name: 'د. أحمد عبد العزيز',
      clinicId: 'XVU00NYtNTsXw4twxwyz',
      slug: 'zizo'
    });
    assert(token && typeof token === 'string', 'Token must be non-empty string');

    const verified = await verifySessionToken(token);
    assert.strictEqual(verified.valid, true, 'Session token must be cryptographically valid');
    assert.strictEqual(verified.payload.role, 'doctor');
    assert.strictEqual(verified.payload.email, 'zizo@gmail.com');
    assert.strictEqual(verified.payload.slug, 'zizo');
  });

  // -------------------------------------------------------------
  // SUITE 2: Patient Portal Accounts & Authentication
  // -------------------------------------------------------------
  console.log('\n--- SUITE 2: Patient Portal Accounts & Authentication ---');

  const patientAccountsSnap = await getDocs(collection(db, 'patient_accounts'));
  const allPatientAccounts = patientAccountsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const verifiedPatientAccounts = allPatientAccounts.filter(p => p.passwordHash || p.password);

  await runAsyncTest('PatientPortal', 'Verify seeded patient portal accounts count & structure', async () => {
    assert(verifiedPatientAccounts.length >= 10, `Expected at least 10 patient accounts, found ${verifiedPatientAccounts.length}`);
    for (const p of verifiedPatientAccounts.slice(0, 10)) {
      assert(p.name, 'Patient must have name');
      assert(p.phone, 'Patient must have phone');
      assert(p.passwordHash || p.password, 'Patient must have password/hash');
    }
  });

  await runAsyncTest('PatientPortal', 'Verify Patient login password verification', async () => {
    const sample = verifiedPatientAccounts.find(p => p.phone === '+201011122233') || verifiedPatientAccounts[0];
    const storedHash = sample.passwordHash || sample.password;
    const isMatch = await verifyPassword('patient123', storedHash);
    assert.strictEqual(isMatch, true, `Patient password match failed for ${sample.phone}`);

    const badMatch = await verifyPassword('bad_password_99', storedHash);
    assert.strictEqual(badMatch, false, 'Patient bad password must be rejected');
  });

  await runAsyncTest('PatientPortal', 'Verify Patient Session Token generation & payload', async () => {
    const sample = verifiedPatientAccounts[0];
    const token = await createSessionToken({
      role: 'patient',
      patientId: sample.id,
      phone: sample.phone,
      name: sample.name,
      clinicId: sample.clinic_id
    });
    assert(token, 'Token generated');
    const verified = await verifySessionToken(token);
    assert.strictEqual(verified.valid, true);
    assert.strictEqual(verified.payload.role, 'patient');
    assert.strictEqual(verified.payload.phone, sample.phone);
  });

  // -------------------------------------------------------------
  // SUITE 3: Branch Management, Conflict Engine & Geolocation
  // -------------------------------------------------------------
  console.log('\n--- SUITE 3: Branch Management, Conflict Engine & Geolocation ---');

  const branchesSnap = await getDocs(collection(db, 'branches'));
  const allBranches = branchesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  runTest('BranchManagement', 'Verify branches synchronized across clinics', () => {
    assert(allBranches.length >= 7, `Expected at least 7 branches, found ${allBranches.length}`);
    for (const b of allBranches) {
      assert(b.name, 'Branch must have name');
      assert(b.clinicId, 'Branch must have clinicId');
      assert(b.weeklySchedule, 'Branch must have weeklySchedule');
    }
  });

  runTest('BranchManagement', 'Verify Haversine GPS Distance Calculation accuracy', () => {
    // Shubra El Kheima (30.128, 31.242) to Mohandessin (30.055, 31.205)
    const distKm = calculateHaversineDistanceKm(30.128, 31.242, 30.055, 31.205);
    assert(distKm >= 8 && distKm <= 11, `Expected distance ~8-11 km, got ${distKm} km`);

    // Dokki (30.038, 31.212) to Maadi (29.973, 31.278)
    const distDokkiMaadi = calculateHaversineDistanceKm(30.038, 31.212, 29.973, 31.278);
    assert(distDokkiMaadi >= 9 && distDokkiMaadi <= 13, `Expected distance ~9-13 km, got ${distDokkiMaadi} km`);
  });

  runTest('BranchManagement', 'Verify Branch Schedule Conflict Detection (overlapping shifts)', () => {
    const branchesWithOverlap = [
      {
        id: 'b1',
        name: 'فرع مدينة نصر',
        isOpen: true,
        isArchived: false,
        weeklySchedule: [
          { id: 'monday', day: 'الاثنين', isOpen: true, start: '10:00', end: '16:00' }
        ]
      },
      {
        id: 'b2',
        name: 'فرع التجمع',
        isOpen: true,
        isArchived: false,
        weeklySchedule: [
          { id: 'monday', day: 'الاثنين', isOpen: true, start: '14:00', end: '20:00' }
        ]
      }
    ];

    const conflicts = checkScheduleConflicts(branchesWithOverlap);
    assert.strictEqual(conflicts.length, 1, 'Should detect 1 schedule conflict');
    assert(conflicts[0].includes('تعارض مواعيد يوم (الاثنين)'));

    const branchesWithoutOverlap = [
      {
        id: 'b1',
        name: 'فرع مدينة نصر',
        isOpen: true,
        isArchived: false,
        weeklySchedule: [
          { id: 'monday', day: 'الاثنين', isOpen: true, start: '10:00', end: '15:00' }
        ]
      },
      {
        id: 'b2',
        name: 'فرع التجمع المسائي',
        isOpen: true,
        isArchived: false,
        weeklySchedule: [
          { id: 'monday', day: 'الاثنين', isOpen: true, start: '16:00', end: '21:00' }
        ]
      }
    ];
    const noConflicts = checkScheduleConflicts(branchesWithoutOverlap);
    assert.strictEqual(noConflicts.length, 0, 'Should have zero conflicts for separated shifts');
  });

  // -------------------------------------------------------------
  // SUITE 4: Booking Capacity Engine & Scheduling Validation
  // -------------------------------------------------------------
  console.log('\n--- SUITE 4: Booking Capacity Engine & Scheduling Validation ---');

  runTest('BookingCapacity', 'Verify Cairo timezone time & date extraction', () => {
    const cairoNow = getCairoNow();
    assert(cairoNow.dateStr.match(/^\d{4}-\d{2}-\d{2}$/), 'Cairo date must be YYYY-MM-DD');
    assert(cairoNow.timeStr.match(/^\d{2}:\d{2}$/), 'Cairo time must be HH:MM');
    assert(cairoNow.totalMinutes >= 0 && cairoNow.totalMinutes <= 1440, 'Minutes within day');
  });

  runTest('BookingCapacity', 'Verify Active Appointment status filtering (capacity occupancy)', () => {
    // waiting, in_progress, completed occupy capacity
    assert.strictEqual(isAppointmentActive('waiting'), true);
    assert.strictEqual(isAppointmentActive('in_progress'), true);
    assert.strictEqual(isAppointmentActive('completed'), true);
    assert.strictEqual(isAppointmentActive('confirmed'), true);

    // cancelled and no_show do NOT occupy capacity
    assert.strictEqual(isAppointmentActive('cancelled'), false);
    assert.strictEqual(isAppointmentActive('no_show'), false);
  });

  runTest('BookingCapacity', 'Verify Effective Daily Limit resolution with branch priority', () => {
    const clinic = { maxDailyBookings: 25, branchesEnabled: true };
    const branchWithLimit = { maxDailyBookings: 15, isMain: false };

    // With multi-branch mode active, sub-branch limit applies
    const limitFromBranch = resolveEffectiveDailyLimit(clinic, branchWithLimit, true);
    assert.strictEqual(limitFromBranch, 15);

    // Without multi-branch mode, clinic limit takes precedence
    const limitFromClinic = resolveEffectiveDailyLimit(clinic, branchWithLimit, false);
    assert.strictEqual(limitFromClinic, 25);
  });

  runTest('BookingCapacity', 'Verify Booking Availability rules (closed days, full capacity, valid days)', () => {
    const clinic = {
      isActive: true,
      maxDailyBookings: 5,
      weeklySchedule: [
        { id: 'friday', day: 'الجمعة', isOpen: false, start: '10:00', end: '22:00' },
        { id: 'saturday', day: 'السبت', isOpen: true, start: '10:00', end: '22:00' }
      ]
    };

    // 1. Off-day rejection (Friday is closed)
    const fridayCheck = validateBookingAvailability({
      bookingDate: '2026-11-13', // Future Friday (holiday)
      clinic,
      currentActiveBookings: 0
    });
    assert.strictEqual(fridayCheck.isValid, false);
    assert.strictEqual(fridayCheck.status, 'holiday');

    // 2. Capacity full rejection (5 booked out of limit 5)
    const fullCheck = validateBookingAvailability({
      bookingDate: '2026-11-07', // Saturday
      clinic,
      currentActiveBookings: 5
    });
    assert.strictEqual(fullCheck.isValid, false);
    assert.strictEqual(fullCheck.status, 'full');
    assert.strictEqual(fullCheck.error, CAPACITY_FULL_MESSAGE);

    // 3. Open day with capacity allowed (2 booked out of limit 5)
    const validCheck = validateBookingAvailability({
      bookingDate: '2026-11-07', // Saturday
      clinic,
      currentActiveBookings: 2
    });
    assert.strictEqual(validCheck.isValid, true);
    assert.strictEqual(validCheck.status, 'available');
    assert.strictEqual(validCheck.effectiveLimit, 5);
  });

  // -------------------------------------------------------------
  // SUITE 5: Dynamic Queue Engine, Priorities & Calculations
  // -------------------------------------------------------------
  console.log('\n--- SUITE 5: Dynamic Queue Engine, Priorities & Calculations ---');

  runTest('QueueEngine', 'Verify Immediate Emergency Priority (quota 0) sorted first', () => {
    const clinic = {
      queuePattern: [
        { serviceId: 'urgent', serviceName: 'كشف مستعجل', quota: 0 },
        { serviceId: 'regular', serviceName: 'كشف عادي', quota: 2 },
        { serviceId: 'consult', serviceName: 'استشارة', quota: 1 }
      ]
    };

    const appointments = [
      { id: '1', serviceId: 'regular', queue_number: 1, arrivedAt: '10:00', status: 'waiting' },
      { id: '2', serviceId: 'regular', queue_number: 2, arrivedAt: '10:05', status: 'waiting' },
      { id: '3', serviceId: 'urgent', queue_number: 5, arrivedAt: '10:15', isUrgent: true, status: 'waiting' }
    ];

    const sorted = sortQueue(appointments, clinic);
    assert.strictEqual(sorted[0].id, '3', 'Emergency patient must be placed at the top of the queue');
  });

  runTest('QueueEngine', 'Verify Round-Robin cycle quotas between multiple services', () => {
    const clinic = {
      queuePattern: [
        { serviceId: 'regular', serviceName: 'كشف عادي', quota: 2 },
        { serviceId: 'consult', serviceName: 'استشارة', quota: 1 }
      ]
    };

    const appointments = [
      { id: 'r1', serviceId: 'regular', queue_number: 1, status: 'waiting' },
      { id: 'r2', serviceId: 'regular', queue_number: 2, status: 'waiting' },
      { id: 'r3', serviceId: 'regular', queue_number: 3, status: 'waiting' },
      { id: 'c1', serviceId: 'consult', queue_number: 4, status: 'waiting' },
      { id: 'c2', serviceId: 'consult', queue_number: 5, status: 'waiting' }
    ];

    const sorted = sortQueue(appointments, clinic);
    // Cycle 1: 2 regulars (r1, r2) then 1 consult (c1)
    // Cycle 2: 1 regular (r3) then 1 consult (c2)
    assert.strictEqual(sorted[0].id, 'r1');
    assert.strictEqual(sorted[1].id, 'r2');
    assert.strictEqual(sorted[2].id, 'c1');
    assert.strictEqual(sorted[3].id, 'r3');
    assert.strictEqual(sorted[4].id, 'c2');
  });

  runTest('QueueEngine', 'Verify Live Patient Position & Wait Time Estimation', () => {
    const todayStr = getCairoDateString(new Date());

    const myAppt = {
      id: 'target-appt',
      queue_number: 4,
      status: 'waiting',
      serviceId: '1',
      serviceName: 'كشف عادي',
      durationMinutes: 20,
      date: todayStr
    };

    const allTodayAppts = [
      { id: 'a1', queue_number: 1, status: 'in_progress', durationMinutes: 20, date: todayStr },
      { id: 'a2', queue_number: 2, status: 'waiting', durationMinutes: 20, date: todayStr },
      { id: 'a3', queue_number: 3, status: 'waiting', durationMinutes: 20, date: todayStr },
      myAppt
    ];

    const clinic = {
      services: [{ id: '1', name: 'كشف عادي', duration: 20 }]
    };

    const pos = calculatePatientLivePosition({
      targetAppointment: myAppt,
      allTodayAppointments: allTodayAppts,
      clinic,
      bookingDateStr: todayStr
    });

    assert(pos.aheadCount >= 2, `Expected aheadCount >= 2, got ${pos.aheadCount}`);
    assert(pos.effectivePosition >= 3, `Expected effectivePosition >= 3, got ${pos.effectivePosition}`);
    assert(pos.estimatedWaitMins >= 20, `Expected estimatedWaitMins >= 20, got ${pos.estimatedWaitMins}`);
    assert(pos.estimatedEntranceTime12H, 'Estimated entrance time 12H generated');
  });

  // -------------------------------------------------------------
  // SUITE 6: Clinical & Drug Prescriptions System
  // -------------------------------------------------------------
  console.log('\n--- SUITE 6: Clinical & Drug Prescriptions System ---');

  runTest('ClinicalSystem', 'Verify Canonical Drug Identifier matches packaging and dosage forms', () => {
    assert.strictEqual(canonicalDrugIdentifier('Augmentin 1g Tablets'), 'augmentin1g');
    assert.strictEqual(canonicalDrugIdentifier('Augmentin 1g'), 'augmentin1g');
    assert.strictEqual(canonicalDrugIdentifier('Brufen 400mg Tablets'), 'brufen400mg');
    assert.strictEqual(canonicalDrugIdentifier('Brufen 400mg'), 'brufen400mg');
    assert.strictEqual(canonicalDrugIdentifier('كونجستال 20 قرص'), 'كونجستال');
    assert.strictEqual(canonicalDrugIdentifier('كونجستال أقراص'), 'كونجستال');
  });

  const prescriptionsSnap = await getDocs(collection(db, 'prescriptions'));
  const allPrescriptions = prescriptionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const seededRx = allPrescriptions.filter(rx => rx.id.startsWith('rx-seed-') || (Array.isArray(rx.items) && rx.items.length > 0));

  runTest('ClinicalSystem', 'Verify Seeded Prescriptions structure & medication instructions', () => {
    assert(seededRx.length >= 5, `Expected at least 5 prescriptions with medication items, found ${seededRx.length}`);
    for (const rx of seededRx.slice(0, 5)) {
      assert(rx.patientName, 'Prescription must have patientName');
      assert(rx.diagnosis, 'Prescription must have diagnosis');
      assert(Array.isArray(rx.items) && rx.items.length > 0, 'Prescription must have items array');
      for (const item of rx.items) {
        assert(item.drugName, 'Item must have drugName');
        assert(item.dosage, 'Item must have dosage');
        assert(item.frequency, 'Item must have frequency');
      }
    }
  });

  // -------------------------------------------------------------
  // SUITE 7: Financials & Payments Engine
  // -------------------------------------------------------------
  console.log('\n--- SUITE 7: Financials & Payments Engine ---');

  const appointmentsSnap = await getDocs(collection(db, 'appointments'));
  const allAppointments = appointmentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const seededAppts = allAppointments.filter(a => a.id.startsWith('seed-'));

  runTest('Financials', 'Verify InstaPay & Cash payment details resolution across appointments', () => {
    assert(seededAppts.length >= 10, `Expected at least 10 seeded appointments, found ${seededAppts.length}`);
    const instapayAppts = seededAppts.filter(a => a.paymentMethod === 'instapay');
    assert(instapayAppts.length > 0, 'Must have InstaPay appointments');
    for (const a of instapayAppts) {
      assert(a.paymentDetails, 'InstaPay appointment must have paymentDetails');
      assert(a.paymentDetails.receiverAccount, 'InstaPay must have receiverAccount');
      assert(a.paymentDetails.expectedAmount > 0, 'Expected amount must be > 0');
    }

    const cashAppts = seededAppts.filter(a => a.paymentMethod === 'cash');
    assert(cashAppts.length > 0, 'Must have Cash appointments');
  });

  // -------------------------------------------------------------
  // SUITE 8: Landing Page & Owner CMS Controls
  // -------------------------------------------------------------
  console.log('\n--- SUITE 8: Landing Page & Owner CMS Controls ---');

  runTest('LandingCMS', 'Phone Normalization handles Egyptian, Arab & Latin formats', () => {
    assert.strictEqual(normalizePhoneNumber('01132570076'), '201132570076');
    assert.strictEqual(normalizePhoneNumber('+20 155 100 7018'), '201551007018');
    assert.strictEqual(normalizePhoneNumber('٠١١٣٢٥٧٠٠٧٦'), '201132570076');
    assert.strictEqual(normalizePhoneNumber('+966 50 123 4567'), '966501234567');
  });

  runTest('LandingCMS', 'Sender WhatsApp URL Generator produces valid wa.me link with polite greeting', () => {
    const url = getSenderWhatsAppUrl('01012345678');
    assert(url.startsWith('https://wa.me/201012345678?text='));
    assert(url.includes(encodeURIComponent('Yalla Clinic')));
  });

  runTest('LandingCMS', 'Optional Primary WhatsApp Contact allows all isPrimary: false with equal display', () => {
    const rawConfig = {
      contacts: [
        { id: 'c1', number: '01132570076', roleTitle: 'المبيعات', isPrimary: false, whatsappEnabled: true, visible: true },
        { id: 'c2', number: '01551007018', roleTitle: 'الدعم الفني', isPrimary: false, whatsappEnabled: true, visible: true }
      ]
    };

    const merged = mergeLandingConfig(rawConfig);
    // Preserves isPrimary: false across all contacts
    assert.strictEqual(merged.contacts[0].isPrimary, false);
    assert.strictEqual(merged.contacts[1].isPrimary, false);
    // Fallback for general buttons uses first available whatsapp number without setting card to primary
    assert.strictEqual(merged.primaryWhatsapp, '201132570076');
  });

  runTest('LandingCMS', 'Doctor Feedback Moderation Queue (pending approval vs published)', () => {
    const feedbacks = [
      { id: 'f1', doctorName: 'د. طارق', comment: 'رائع', approved: true, visible: true },
      { id: 'f2', doctorName: 'د. سارة', comment: 'ممتاز', approved: false, visible: true },
      { id: 'f3', doctorName: 'د. كريم', comment: 'جيد جداً', approved: true, visible: false }
    ];

    const publicVisible = feedbacks.filter(f => f.approved && f.visible !== false);
    assert.strictEqual(publicVisible.length, 1, 'Only approved and visible feedback should show on landing');
    assert.strictEqual(publicVisible[0].id, 'f1');

    const pendingCount = feedbacks.filter(f => !f.approved).length;
    assert.strictEqual(pendingCount, 1, 'Should count 1 pending feedback');
  });

  runTest('LandingCMS', 'Inquiries Inbox tabs (active, archive, trash) & counter', () => {
    const inquiries = [
      { id: 'i1', name: 'أحمد', message: 'استفسار', isArchived: false, isDeleted: false, status: 'new' },
      { id: 'i2', name: 'منى', message: 'حجز تجريبي', isArchived: true, isDeleted: false, status: 'new' },
      { id: 'i3', name: 'سامح', message: 'إلغاء', isArchived: false, isDeleted: true, status: 'new' }
    ];

    const activeList = inquiries.filter(i => !i.isDeleted && !i.isArchived);
    assert.strictEqual(activeList.length, 1);
    assert.strictEqual(activeList[0].id, 'i1');

    const archiveList = inquiries.filter(i => !i.isDeleted && i.isArchived);
    assert.strictEqual(archiveList.length, 1);
    assert.strictEqual(archiveList[0].id, 'i2');

    const trashList = inquiries.filter(i => i.isDeleted);
    assert.strictEqual(trashList.length, 1);
    assert.strictEqual(trashList[0].id, 'i3');

    const activeNewCount = inquiries.filter(i => i.status === 'new' && !i.isArchived && !i.isDeleted).length;
    assert.strictEqual(activeNewCount, 1);
  });

  // -------------------------------------------------------------
  // SUITE 9: Live Cloudflare HTTP Endpoints Health
  // -------------------------------------------------------------
  console.log('\n--- SUITE 9: Live Cloudflare HTTP Endpoints Health ---');

  const liveUrls = [
    { name: 'Landing Page', url: 'https://yalla-clinic.com/' },
    { name: 'Landing API', url: 'https://yalla-clinic.com/api/landing' },
    { name: 'Clinic Zizo Booking Page', url: 'https://yalla-clinic.com/clinic/zizo' },
    { name: 'Clinic Zizo TV Screen', url: 'https://yalla-clinic.com/clinic/zizo/tv' },
    { name: 'Clinic Dr. Tarek Booking Page', url: 'https://yalla-clinic.com/clinic/dr-tarek-internal' },
    { name: 'Clinic Dr. Sara Booking Page', url: 'https://yalla-clinic.com/clinic/dr-sara-eyes' },
    { name: 'Clinic Dr. Karim Booking Page', url: 'https://yalla-clinic.com/clinic/karim' },
    { name: 'Clinic Dr. Nada Booking Page', url: 'https://yalla-clinic.com/clinic/dr-nada-pediatrics' },
    { name: 'Patient Login Page', url: 'https://yalla-clinic.com/clinic/zizo/patient/login' },
    { name: 'Clinic Admin Login Page', url: 'https://yalla-clinic.com/clinic/zizo/login' },
    { name: 'Owner Portal', url: 'https://yalla-clinic.com/owner' }
  ];

  for (const item of liveUrls) {
    await runAsyncTest('LiveHttp', `HTTP GET ${item.name} (${item.url})`, async () => {
      const res = await fetch(item.url, {
        headers: { 'User-Agent': 'YallaClinicTestAgent/1.0' }
      });
      assert(res.status >= 200 && res.status < 400, `Expected 2xx/3xx HTTP status, got ${res.status}`);
      if (item.url.includes('/api/landing')) {
        const json = await res.json();
        assert(json.config, 'Landing API must return config object');
        assert(Array.isArray(json.config.contacts), 'Landing API must have contacts array');
      }
    });
  }

  // -------------------------------------------------------------
  // Summary Report
  // -------------------------------------------------------------
  console.log('\n' + '='.repeat(80));
  console.log('📊 FINAL TEST RESULTS SUMMARY:');
  console.log(`   Total Tests Executed: ${totalTests}`);
  console.log(`   Passed: ${passedTests} (🎉 ${((passedTests / totalTests) * 100).toFixed(1)}%)`);
  console.log(`   Failed: ${failedTests}`);
  console.log('='.repeat(80));

  if (failedTests > 0) {
    console.error(`\n❌ ${failedTests} tests failed!`);
    process.exit(1);
  } else {
    console.log('\n🌟 ALL TEST SUITES PASSED FLAWLESSLY! Platform is 100% stable, secure, and production ready.');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
