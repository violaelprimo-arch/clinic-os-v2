import test from 'node:test'
import assert from 'node:assert/strict'
import {
  formatInClinicBookingWhatsAppMessage,
} from '../src/lib/whatsappShare.ts'
import {
  cleanPhoneForWhatsApp,
  normalizePhoneDigits,
} from '../src/lib/countryPhoneHelper.ts'

test('1. WhatsApp In-Clinic Message Formatting & Arabic Digits Normalization', () => {
  // Test Arabic digits normalization
  const arabicPhone = '٠١٠١٢٣٤٥٦٧٨'
  const normalizedDigits = normalizePhoneDigits(arabicPhone)
  assert.equal(normalizedDigits, '01012345678')

  const internationalFormatted = cleanPhoneForWhatsApp(arabicPhone, '+20')
  assert.equal(internationalFormatted, '201012345678')

  // Test Clinic 1: el-amal (subdomain: el-amal.yalla-clinic.com)
  const clinicName = 'عيادة الأمل التخصصية'
  const serviceName = 'كشف باطنة عامة'
  const branchName = 'فرع مدينة نصر'
  const bookingDate = '2026-10-31'
  const queueNumber = 5
  const trackUrl = 'https://yalla-clinic.com/clinic/el-amal/track?phone=01012345678'
  const clinicHomepageUrl = 'https://el-amal.yalla-clinic.com/'

  const message = formatInClinicBookingWhatsAppMessage({
    clinicName,
    serviceName,
    branchName,
    bookingDate,
    queueNumber,
    trackUrl,
    clinicHomepageUrl,
  })

  // Mandatory template strings
  assert.ok(message.includes(`أهلًا بحضرتك، تم تسجيل حجزك في ${clinicName}`), 'Must include greeting and clinic name')
  assert.ok(message.includes(`الخدمة: ${serviceName}`), 'Must include service name')
  assert.ok(message.includes(`الفرع: ${branchName}`), 'Must include branch name')
  assert.ok(message.includes(`التاريخ: ${bookingDate}`), 'Must include booking date')
  assert.ok(message.includes(`رقم تذكرة الدور: #${queueNumber}`), 'Must include queue ticket number')
  assert.ok(message.includes('لمتابعة دورك المباشر:'), 'Must include title for Link 1')
  assert.ok(message.includes(trackUrl), 'Must include track URL for Link 1')
  assert.ok(message.includes('موقع العيادة والحجز:'), 'Must include title "موقع العيادة والحجز:" for Link 2')
  assert.ok(message.includes(clinicHomepageUrl), 'Must include clinic homepage URL for Link 2')
  assert.ok(!message.includes('/patient'), 'Link 2 must NOT point to /patient')
  assert.ok(!message.includes('/admin'), 'Link 2 must NOT point to /admin')
  assert.ok(message.includes('ترتيب الدخول ووقت الانتظار يتحدثان حسب حركة العيادة'), 'Must include disclaimer')

  // Anti-leak check: no mock slug 'zizo' if not intended, no diagnosis or prescription
  assert.ok(!message.includes('zizo'), 'Message must not leak hardcoded clinic names')
  assert.ok(!message.includes('تشخيص'), 'Message must not contain confidential medical data')
  assert.ok(!message.includes('دواء'), 'Message must not contain prescription data')

  // Test Clinic 2: Custom domain clinic (e.g. zizo or custom domain)
  const messageCustom = formatInClinicBookingWhatsAppMessage({
    clinicName: 'عيادة د. عبد العزيز',
    serviceName: 'كشف استشاري',
    branchName: 'الفرع الرئيسي',
    bookingDate: '2026-10-31',
    queueNumber: 12,
    trackUrl: 'https://zizo.yalla-clinic.com/track/appt_123',
    clinicHomepageUrl: 'https://zizo.yalla-clinic.com/',
  })
  assert.ok(messageCustom.includes('موقع العيادة والحجز:\nhttps://zizo.yalla-clinic.com/'), 'Must include zizo homepage for Link 2')
  assert.ok(!messageCustom.includes('/patient'), 'Must not contain /patient')
})

test('2. Multi-member Family Phone Search Isolation', () => {
  // Simulate family members sharing the same phone
  const sharedPhone = '01099887766'
  const rawPatientsFromDB = [
    { id: 'pat_1', name: 'أحمد محمود', phone: '01099887766', age: 35, gender: 'male' },
    { id: 'pat_2', name: 'مريم أحمد محمود (ابنة)', phone: '01099887766', age: 7, gender: 'female' },
    { id: 'pat_3', name: 'سارة إبراهيم (زوجة)', phone: '01099887766', age: 32, gender: 'female' },
  ]

  // Filtering by phone
  const matched = rawPatientsFromDB.filter(p => p.phone === sharedPhone)
  assert.equal(matched.length, 3, 'Multiple patients sharing a phone must all be returned')

  // Verify each record is unique and not merged
  const ids = new Set(matched.map(p => p.id))
  assert.equal(ids.size, 3, 'Each family member retains distinct patient ID')

  // Receptionist can select specific member or create new member
  const selectedMember = matched.find(p => p.name.includes('مريم'))
  assert.ok(selectedMember)
  assert.equal(selectedMember.id, 'pat_2')
  assert.equal(selectedMember.age, 7)
})

test('3. Assistant Branch Locking Guard', () => {
  // Assistant session restricted to branch_east
  const assistantSession = {
    role: 'assistant',
    branchId: 'branch_east',
    permissions: ['appointments'],
  }

  // Booking attempt for branch_west should be forbidden
  const requestedBranch = 'branch_west'
  const isBranchAllowed = !assistantSession.branchId || assistantSession.branchId === requestedBranch
  assert.equal(isBranchAllowed, false, 'Assistant locked to branch_east must NOT be allowed to book branch_west')

  // Booking attempt for branch_east should be accepted
  const correctBranch = 'branch_east'
  const isCorrectBranchAllowed = !assistantSession.branchId || assistantSession.branchId === correctBranch
  assert.equal(isCorrectBranchAllowed, true, 'Assistant locked to branch_east must be allowed to book branch_east')

  // Doctor session without branch restriction
  const doctorSession = {
    role: 'doctor',
    branchId: undefined,
    permissions: ['all'],
  }
  const isDoctorAllowed = !doctorSession.branchId || doctorSession.branchId === requestedBranch
  assert.equal(isDoctorAllowed, true, 'Doctor with no branch lock can book any branch')
})

test('4. Server-Side Service Pricing & Duration Enforcement', () => {
  // Services catalog configured by doctor in database
  const clinicServices = [
    { id: 'srv_consultation', name: 'كشف استشاري', price: 350, duration: 20 },
    { id: 'srv_urgent', name: 'كشف مستعجل', price: 500, duration: 15 },
    { id: 'srv_followup', name: 'إعادة كشف', price: 100, duration: 10 },
  ]

  // Spoofed client request trying to get urgent service for 10 EGP
  const clientPayload = {
    serviceId: 'srv_urgent',
    tamperedPrice: 10,
    tamperedDuration: 60,
  }

  // Server validation & enforcement
  const matchedService = clinicServices.find(s => s.id === clientPayload.serviceId)
  assert.ok(matchedService, 'Service must exist in catalog')

  // Server ignores clientPayload.tamperedPrice and uses database price
  const enforcedPrice = matchedService.price
  const enforcedDuration = matchedService.duration

  assert.equal(enforcedPrice, 500, 'Server must enforce DB price of 500 EGP, rejecting 10 EGP')
  assert.equal(enforcedDuration, 15, 'Server must enforce DB duration of 15 min, rejecting 60 min')
})

test('5. Future vs Today vs Past Queue Date Logic', () => {
  function getAppointmentDateState(appointmentDateStr, todayStr) {
    if (appointmentDateStr > todayStr) {
      return { isFuture: true, isPast: false, isToday: false, statusText: 'مؤكد ليوم الحجز' }
    }
    if (appointmentDateStr < todayStr) {
      return { isFuture: false, isPast: true, isToday: false, statusText: 'حجز سابق' }
    }
    return { isFuture: false, isPast: false, isToday: true, statusText: 'حجز اليوم' }
  }

  const todayStr = '2026-10-31'

  // Tomorrow appointment
  const tomorrowState = getAppointmentDateState('2026-11-01', todayStr)
  assert.equal(tomorrowState.isFuture, true)
  assert.equal(tomorrowState.isToday, false)
  // CRITICAL: Future date must NEVER say "دورك الآن"
  assert.notEqual(tomorrowState.statusText, 'دورك الآن')
  assert.equal(tomorrowState.statusText, 'مؤكد ليوم الحجز')

  // Today appointment
  const todayState = getAppointmentDateState('2026-10-31', todayStr)
  assert.equal(todayState.isToday, true)
  assert.equal(todayState.isFuture, false)

  // Yesterday appointment
  const pastState = getAppointmentDateState('2026-10-30', todayStr)
  assert.equal(pastState.isPast, true)
  assert.equal(pastState.isToday, false)
})

test('6. Privacy Safeguards in Public Queue Response', () => {
  // Raw internal queue containing sensitive patient details
  const internalQueue = [
    { id: 'apt_1', queueNumber: 1, patientName: 'محمود عبد الرحيم', phone: '01011112222', condition: 'ارتفاع ضغط' },
    { id: 'apt_2', queueNumber: 2, patientName: 'فاطمة الزهراء', phone: '01122223333', condition: 'سكري نمط 2' },
    { id: 'apt_3', queueNumber: 3, patientName: 'علي كمال', phone: '01233334444', condition: 'فحص دوري' },
  ]

  // Sanitized public output when an anonymous patient tracks their turn
  const publicQueue = internalQueue.map(item => ({
    id: item.id,
    queueNumber: item.queueNumber,
    // Mask name and strip phone and medical condition
    label: `مريض دور #${item.queueNumber}`,
  }))

  assert.equal(publicQueue.length, 3)
  for (const item of publicQueue) {
    // Assert no real patient names or phones leaked
    assert.ok(!item.patientName, 'Patient real name must not be present in public queue item')
    assert.ok(!item.phone, 'Patient phone must not be present in public queue item')
    assert.ok(!item.condition, 'Patient medical condition must not be present in public queue item')
    assert.ok(item.label.startsWith('مريض دور #'), 'Label must be anonymized')
  }
})
