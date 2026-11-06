import assert from 'assert';

const BASE_URL = 'https://yalla-clinic.com';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

let passed = 0;
let failed = 0;
const results = [];

async function test(name, fn) {
  try {
    await fn();
    passed++;
    results.push({ name, status: 'PASS' });
    console.log(`  ✅ [PASS] ${name}`);
  } catch (err) {
    failed++;
    results.push({ name, status: 'FAIL', error: err.message });
    console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
  }
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text), headers: res.headers };
  } catch {
    return { status: res.status, raw: text, headers: res.headers };
  }
}

async function main() {
  console.log('='.repeat(80));
  console.log('🌟 COMPREHENSIVE LIVE END-TO-END QA TEST FOR YALLA CLINIC / CLINIC OS');
  console.log('='.repeat(80));

  const CLINICS = [
    { slug: 'karim', doctorName: 'د. كريم عبد الرحمن', doctorEmail: 'dr.karim@gmail.com', assistantEmail: 'sec.karim@gmail.com' },
    { slug: 'zizo', doctorName: 'د. أحمد عبد العزيز', doctorEmail: 'zizo@gmail.com', assistantEmail: 'zizo2@gmail.com' },
    { slug: 'dr-tarek-internal', doctorName: 'د. طارق', doctorEmail: 'dr.tarek@gmail.com', assistantEmail: 'sec.tarek@gmail.com' },
    { slug: 'dr-sara-eyes', doctorName: 'د. سارة خليل', doctorEmail: 'dr.sara@gmail.com', assistantEmail: 'sec.sara@gmail.com' },
    { slug: 'dr-nada-pediatrics', doctorName: 'د. ندى الشريف', doctorEmail: 'dr.nada@gmail.com', assistantEmail: 'sec.nada@gmail.com' }
  ];

  // ==========================================
  // SUITE 1: Public Pages & Subdomains
  // ==========================================
  console.log('\n--- SUITE 1: Public Pages, Subdomains & TV Screens ---');

  await test('Landing page (yalla-clinic.com) returns 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/`, { headers: { 'User-Agent': USER_AGENT } });
    assert.strictEqual(res.status, 200);
  });

  await test('Universal Login page (/login) returns 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/login`, { headers: { 'User-Agent': USER_AGENT } });
    assert.strictEqual(res.status, 200);
  });

  await test('Karim clinic subdomain booking page returns 200 OK', async () => {
    const res = await fetch('https://karim.yalla-clinic.com/clinic/karim', { headers: { 'User-Agent': USER_AGENT } });
    assert.strictEqual(res.status, 200);
  });

  await test('Karim clinic admin page returns 200 OK', async () => {
    const res = await fetch('https://karim.yalla-clinic.com/clinic/karim/admin', { headers: { 'User-Agent': USER_AGENT } });
    assert.strictEqual(res.status, 200);
  });

  await test('Karim waiting room TV page returns 200 OK', async () => {
    const res = await fetch('https://karim.yalla-clinic.com/clinic/karim/tv', { headers: { 'User-Agent': USER_AGENT } });
    assert.strictEqual(res.status, 200);
  });

  // ==========================================
  // SUITE 2: Multi-Tenant Clinic API & Live Queue
  // ==========================================
  console.log('\n--- SUITE 2: Multi-Tenant Clinic API & Live Queue (5 Clinics) ---');

  for (const c of CLINICS) {
    await test(`[${c.slug}] Settings endpoint returns active clinic profile`, async () => {
      const res = await fetchJson(`${BASE_URL}/api/clinic/${c.slug}/settings`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert(res.data.clinic, 'Clinic object must exist');
      assert.strictEqual(res.data.clinic.slug, c.slug);
      assert(res.data.clinic.doctorName || res.data.clinic.name, 'Name must exist');
      assert.strictEqual(res.data.clinic.isActive, true);
    });

    await test(`[${c.slug}] Live Queue endpoint returns queue numbers and status`, async () => {
      const res = await fetchJson(`${BASE_URL}/api/clinic/${c.slug}/queue`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert(typeof res.data.currentTurn === 'number', 'currentTurn must be number');
      assert(typeof res.data.totalWaiting === 'number', 'totalWaiting must be number');
    });

    await test(`[${c.slug}] Branches endpoint returns configured branches`, async () => {
      const res = await fetchJson(`${BASE_URL}/api/clinic/${c.slug}/branches`);
      assert.strictEqual(res.status, 200);
      assert(res.data.branches && Array.isArray(res.data.branches), 'Branches must be an array');
      assert(res.data.branches.length >= 1, 'Should have at least 1 branch');
    });
  }

  // ==========================================
  // SUITE 3: Role-Based Authentication (Doctor, Secretary, Security)
  // ==========================================
  console.log('\n--- SUITE 3: Role-Based Authentication (Doctor, Secretary, Security) ---');

  for (const c of CLINICS) {
    await test(`[Doctor Login] ${c.doctorEmail} authenticates successfully`, async () => {
      const res = await fetchJson(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: c.doctorEmail, password: 'password123' })
      });
      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.data || res.raw)}`);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.user.role, 'doctor');
      assert.strictEqual(res.data.user.slug, c.slug);
      assert(res.data.token, 'Must return session token');
      const setCookie = res.headers.get('set-cookie');
      assert(setCookie && setCookie.includes('clinic_session'), 'Must set clinic_session cookie');
    });

    await test(`[Secretary Login] ${c.assistantEmail} authenticates successfully`, async () => {
      const res = await fetchJson(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: c.assistantEmail, password: 'password123' })
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.user.role, 'assistant');
      assert.strictEqual(res.data.user.slug, c.slug);
      assert(res.data.token, 'Must return session token');
    });
  }

  await test('Reject invalid credentials with 401', async () => {
    const res = await fetchJson(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'dr.karim@gmail.com', password: 'wrong_password_999' })
    });
    assert.strictEqual(res.status, 401);
    assert(res.data.error, 'Must return error message');
  });

  await test('Anti-enumeration: Unknown email returns 401', async () => {
    const res = await fetchJson(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent-user-123@nowhere.com', password: 'password123' })
    });
    assert.strictEqual(res.status, 401);
    assert(res.data.error, 'Must return error message');
  });

  // ==========================================
  // SUITE 4: Patient Portal (Login, Registration & Phone Normalization)
  // ==========================================
  console.log('\n--- SUITE 4: Patient Portal (Login, Registration & Phone Normalization) ---');

  await test('Patient Login with normalized Egyptian phone (01011122233)', async () => {
    const res = await fetchJson(`${BASE_URL}/api/patient/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '01011122233', password: 'patient123' })
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert(res.data.token, 'Must issue patient token');
    assert.strictEqual(res.data.patient.name, 'أحمد محمود القاضي');
  });

  await test('Patient Login with +20 prefix (+201011122233)', async () => {
    const res = await fetchJson(`${BASE_URL}/api/patient/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+201011122233', password: 'patient123' })
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.patient.name, 'أحمد محمود القاضي');
  });

  await test('Patient Registration with new phone creates account & returns session', async () => {
    const testPhone = `010${Math.floor(10000000 + Math.random() * 90000000)}`;
    const res = await fetchJson(`${BASE_URL}/api/patient/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: testPhone,
        name: 'مريض تجريبي تلقائي',
        password: 'password123',
        clinicSlug: 'karim'
      })
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert(res.data.token, 'Must return patient token');
  });

  // ==========================================
  // SUITE 5: Live Booking & Queue Creation Flow
  // ==========================================
  console.log('\n--- SUITE 5: Live Booking & Queue Creation Flow ---');

  let newQueueNumber = null;
  await test('Public Booking API (/api/clinic/book) creates appointment for today Cairo', async () => {
    const cairoDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Cairo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());

    const res = await fetchJson(`${BASE_URL}/api/clinic/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clinicId: 'b2LvVyPnssx736ENZ7XI', // Karim clinic ID
        patientName: 'مريض فحص تجريبي حي',
        patientPhone: '01099887766',
        patientAge: 32,
        gender: 'male',
        date: cairoDate,
        serviceId: '1',
        paymentMethod: 'cash'
      })
    });
    assert.strictEqual(res.status, 200, `Booking failed: ${JSON.stringify(res.data || res.raw)}`);
    assert.strictEqual(res.data.success, true);
    assert(res.data.appointmentId, 'Must return appointmentId');
    assert(typeof res.data.queueNumber === 'number', 'Must assign queue number');
    newQueueNumber = res.data.queueNumber;
    console.log(`     Assigned Queue Number: #${newQueueNumber}`);
  });

  // ==========================================
  // Summary
  // ==========================================
  console.log('\n' + '='.repeat(80));
  console.log(`🎯 QA TEST EXECUTION FINISHED: ${passed} PASSED / ${failed} FAILED (Total: ${passed + failed})`);
  console.log('='.repeat(80));

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
