import assert from 'node:assert/strict'
import { getClinicUrl } from '../src/lib/clinic-url.ts'
import { formatBookingWhatsAppMessage } from '../src/lib/whatsappShare.ts'

console.log('--- Testing WhatsApp Booking Confirmation Message & URLs ---')

// 1. Test Clinic A: Zizo (subdomain: zizo.yalla-clinic.com)
const clinicA = {
  slug: 'zizo',
  name: 'عيادة د. عبد العزيز',
  customDomain: undefined,
  appointmentId: 'appt_zizo_001',
  queueNumber: 12,
  patientName: 'أحمد محمود',
  price: 250,
  date: '2026-10-31',
  serviceName: 'كشف استشاري'
}

const trackUrlA = getClinicUrl(clinicA.slug, `/track/${clinicA.appointmentId}`, clinicA.customDomain)
const homepageUrlA = getClinicUrl(clinicA.slug, '', clinicA.customDomain)

assert.equal(homepageUrlA, 'https://zizo.yalla-clinic.com/', 'Clinic A homepage URL must be https://zizo.yalla-clinic.com/')
assert.ok(trackUrlA.includes(`/track/${clinicA.appointmentId}`), 'Track URL must include appointment track path')
assert.ok(!homepageUrlA.includes('/patient'), 'Homepage URL must NOT contain /patient')
assert.ok(!homepageUrlA.includes('/admin'), 'Homepage URL must NOT contain /admin')

const messageA = formatBookingWhatsAppMessage({
  clinicName: clinicA.name,
  patientName: clinicA.patientName,
  date: clinicA.date,
  serviceName: clinicA.serviceName,
  queueNumber: clinicA.queueNumber,
  price: clinicA.price,
  trackUrl: trackUrlA,
  clinicHomepageUrl: homepageUrlA,
})

console.log('\n[Generated WhatsApp Message for Clinic A]:')
console.log(messageA)

assert.ok(messageA.includes('لمتابعة دورك المباشر:'), 'Message must contain "لمتابعة دورك المباشر:"')
assert.ok(messageA.includes(trackUrlA), 'Message must contain tracking URL for Link 1')
assert.ok(messageA.includes('موقع العيادة والحجز:'), 'Message must contain "موقع العيادة والحجز:" for Link 2')
assert.ok(messageA.includes(homepageUrlA), 'Message must contain clinic homepage for Link 2')
assert.ok(!messageA.includes(`${homepageUrlA}patient`), 'Link 2 must NOT point to /patient')

// 2. Test Clinic B: Al-Amal with custom domain (alamal-med.com)
const clinicB = {
  slug: 'al-amal',
  name: 'مركز الأمل التخصصي',
  customDomain: 'alamal-med.com',
  appointmentId: 'appt_amal_889',
  queueNumber: 5,
  patientName: 'سارة إبراهيم',
  price: 350,
  date: '2026-10-31',
  serviceName: 'كشف عيون'
}

const trackUrlB = getClinicUrl(clinicB.slug, `/track/${clinicB.appointmentId}`, clinicB.customDomain)
const homepageUrlB = getClinicUrl(clinicB.slug, '', clinicB.customDomain)

assert.equal(homepageUrlB, 'https://alamal-med.com/', 'Clinic B homepage must use custom domain https://alamal-med.com/')
assert.equal(trackUrlB, `https://alamal-med.com/track/${clinicB.appointmentId}`, 'Track URL must use custom domain')

const messageB = formatBookingWhatsAppMessage({
  clinicName: clinicB.name,
  patientName: clinicB.patientName,
  date: clinicB.date,
  serviceName: clinicB.serviceName,
  queueNumber: clinicB.queueNumber,
  price: clinicB.price,
  trackUrl: trackUrlB,
  clinicHomepageUrl: homepageUrlB,
})

console.log('\n[Generated WhatsApp Message for Clinic B (Custom Domain)]:\n', messageB)

assert.ok(messageB.includes('موقع العيادة والحجز:'), 'Message B must contain "موقع العيادة والحجز:"')
assert.ok(messageB.includes('https://alamal-med.com/'), 'Message B must contain custom domain homepage')

// 3. Test Clinic C: Dr. Kareem (different subdomain, ensuring slug is NOT hardcoded)
const clinicC = {
  slug: 'dr-kareem',
  name: 'عيادة د. كريم',
  customDomain: undefined,
  appointmentId: 'appt_kareem_334',
  queueNumber: 1,
  patientName: 'محمد علي',
  price: 200,
  date: '2026-10-31',
  serviceName: 'كشف عام'
}

const homepageUrlC = getClinicUrl(clinicC.slug, '', clinicC.customDomain)
assert.equal(homepageUrlC, 'https://dr-kareem.yalla-clinic.com/', 'Clinic C homepage must be https://dr-kareem.yalla-clinic.com/')
assert.ok(!homepageUrlC.includes('zizo'), 'Slug must be dynamic and not hardcoded to zizo')

console.log('\nALL 3 CLINIC WHATSAPP TESTS PASSED WITH 100% SUCCESS!')
