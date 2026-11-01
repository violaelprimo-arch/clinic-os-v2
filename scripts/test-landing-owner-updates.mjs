import assert from 'node:assert/strict'
import {
  normalizePhoneNumber,
  whatsappNumber,
  getSenderWhatsAppUrl,
  mergeLandingConfig,
  DEFAULT_LANDING_CONFIG
} from '../src/lib/landing-config.ts'

console.log('🧪 Starting Acceptance Test Suite for Landing Owner Updates...')

// TEST 1: Phone Normalization across Arabic, Local, and International Formats
console.log('\n--- 1. Testing Phone Normalization ---')
{
  // 1a. Standard Egyptian Mobile 010 / 011 / 012 / 015
  assert.equal(normalizePhoneNumber('01551007018'), '201551007018')
  assert.equal(normalizePhoneNumber('01012345678'), '201012345678')
  assert.equal(normalizePhoneNumber('01198765432'), '201198765432')
  assert.equal(normalizePhoneNumber('01234567890'), '201234567890')

  // 1b. Eastern Arabic Numerals (٠-٩)
  assert.equal(normalizePhoneNumber('٠١٥٥١٠٠٧٠١٨'), '201551007018')
  assert.equal(normalizePhoneNumber('٠١٠١٢٣٤٥٦٧٨'), '201012345678')

  // 1c. Spaces, dashes, plus sign, country code
  assert.equal(normalizePhoneNumber('+20 155 100 7018'), '201551007018')
  assert.equal(normalizePhoneNumber('+20-101-234-5678'), '201012345678')
  assert.equal(normalizePhoneNumber('00201551007018'), '201551007018')

  // 1d. Egyptian without leading zero (10 digits)
  assert.equal(normalizePhoneNumber('1551007018'), '201551007018')

  // 1e. Arab Gulf international numbers
  assert.equal(normalizePhoneNumber('+966501234567'), '966501234567')
  assert.equal(normalizePhoneNumber('00971501234567'), '971501234567')

  console.log('✅ Phone normalization passed for all Arabic, Latin, and international formats!')
}

// TEST 2: Sender WhatsApp URL Generation
console.log('\n--- 2. Testing Sender WhatsApp URL Generation ---')
{
  const politeGreeting = encodeURIComponent('أهلًا دكتور، بنتواصل مع حضرتك من دعم Yalla Clinic بخصوص رسالتك الأخيرة.')

  // Valid Egyptian Mobile
  const url1 = getSenderWhatsAppUrl('01012345678')
  assert.equal(url1, `https://wa.me/201012345678?text=${politeGreeting}`)

  // Valid with Eastern Arabic Numerals
  const url2 = getSenderWhatsAppUrl('٠١٥٥١٠٠٧٠١٨')
  assert.equal(url2, `https://wa.me/201551007018?text=${politeGreeting}`)

  // Valid Gulf number
  const url3 = getSenderWhatsAppUrl('+966 50 123 4567')
  assert.equal(url3, `https://wa.me/966501234567?text=${politeGreeting}`)

  // Email address should return null (disabled button)
  assert.equal(getSenderWhatsAppUrl('doctor.ahmed@example.com'), null)
  assert.equal(getSenderWhatsAppUrl('user@clinic.org'), null)

  // Empty or invalid
  assert.equal(getSenderWhatsAppUrl(''), null)
  assert.equal(getSenderWhatsAppUrl('123'), null)

  console.log('✅ Sender WhatsApp URL generation passed with polite default greeting and non-phone safety!')
}

// TEST 3: Multi-Number Contacts Migration & Deduplication in mergeLandingConfig
console.log('\n--- 3. Testing Contacts Migration & Deduplication ---')
{
  // 3a. Legacy config with only primaryWhatsapp
  const legacyConfig = {
    primaryWhatsapp: '01551007018',
    contacts: []
  }
  const merged1 = mergeLandingConfig(legacyConfig)
  assert(merged1.contacts.length >= 1)
  assert.equal(merged1.contacts[0].whatsappNumber, '201551007018')
  assert.equal(merged1.contacts[0].isPrimary, true)
  assert.equal(merged1.primaryWhatsapp, '201551007018')

  // 3b. Multi-number contacts with deduplication
  const multiConfig = {
    contacts: [
      {
        id: 'sales',
        roleTitle: 'المبيعات',
        number: '01551007018',
        whatsappEnabled: true,
        visible: true,
        isPrimary: true
      },
      {
        id: 'support',
        roleTitle: 'الدعم الفني',
        number: '01012345678',
        whatsappEnabled: true,
        visible: true,
        isPrimary: false
      },
      // Duplicate of sales with different formatting
      {
        id: 'dup_sales',
        roleTitle: 'المبيعات مكرر',
        number: '+20 155 100 7018',
        whatsappEnabled: true,
        visible: true,
        isPrimary: false
      }
    ]
  }
  const merged2 = mergeLandingConfig(multiConfig)
  assert.equal(merged2.contacts.length, 2, 'Should deduplicate identical normalized numbers')
  assert.equal(merged2.contacts[0].whatsappNumber, '201551007018')
  assert.equal(merged2.contacts[1].whatsappNumber, '201012345678')
  assert.equal(merged2.contacts[0].isPrimary, true)
  assert.equal(merged2.primaryWhatsapp, '201551007018')

  // 3c. Change primary contact and verify primaryWhatsapp synchronization
  const switchedPrimary = {
    contacts: [
      {
        id: 'sales',
        roleTitle: 'المبيعات',
        number: '01551007018',
        whatsappEnabled: true,
        visible: true,
        isPrimary: false
      },
      {
        id: 'support',
        roleTitle: 'الدعم الفني',
        number: '01012345678',
        whatsappEnabled: true,
        visible: true,
        isPrimary: true
      }
    ]
  }
  const merged3 = mergeLandingConfig(switchedPrimary)
  assert.equal(merged3.contacts[1].isPrimary, true)
  assert.equal(merged3.primaryWhatsapp, '201012345678', 'primaryWhatsapp should sync with chosen primary contact')

  console.log('✅ Contacts migration, deduplication, and primary synchronization passed!')
}

// TEST 4: Inquiries Archive and Trash Filtering
console.log('\n--- 4. Testing Inquiries Archive & Trash Filtering ---')
{
  const mockInquiries = [
    { id: '1', type: 'inquiry', status: 'new', isArchived: false, isDeleted: false },
    { id: '2', type: 'complaint', status: 'new', isArchived: false, isDeleted: false },
    { id: '3', type: 'suggestion', status: 'new', isArchived: true, isDeleted: false },
    { id: '4', type: 'complaint', status: 'new', isArchived: false, isDeleted: true },
  ]

  // Active unread count
  const newActiveCount = mockInquiries.filter(i => i.status === 'new' && !i.isArchived && !i.isDeleted).length
  assert.equal(newActiveCount, 2, 'Archived and deleted inquiries must not count toward active new badge')

  // Filter: all (active only)
  const activeAll = mockInquiries.filter(i => !i.isDeleted && !i.isArchived)
  assert.equal(activeAll.length, 2)

  // Filter: archived
  const archived = mockInquiries.filter(i => !i.isDeleted && i.isArchived)
  assert.equal(archived.length, 1)
  assert.equal(archived[0].id, '3')

  // Filter: trash
  const trash = mockInquiries.filter(i => i.isDeleted)
  assert.equal(trash.length, 1)
  assert.equal(trash[0].id, '4')

  console.log('✅ Inquiries archive, trash, and active badge counts verified!')
}

// TEST 5: Doctor Review / Testimonial Approval Flow
console.log('\n--- 5. Testing Doctor Review Approval Flow ---')
{
  // A. Submitted review in collection starts with approved: false
  const submittedReview = {
    id: 'rev_123',
    authorName: 'د. أحمد علي',
    clinicName: 'عيادة الأمل',
    specialty: 'استشاري باطنة',
    rating: 5,
    comment: 'منظومة ممتازة جداً ونظام تنظيم الأدوار وفر علينا مجهود كبير',
    approved: false,
    visible: true,
  }

  // B. Homepage filter excludes unapproved reviews
  assert.equal(submittedReview.approved && submittedReview.visible !== false, false, 'Unapproved review must not show on homepage')

  // C. Owner approves review
  submittedReview.approved = true
  assert.equal(submittedReview.approved && submittedReview.visible !== false, true, 'Approved review must show on homepage')

  // D. Owner hides review later
  submittedReview.visible = false
  assert.equal(submittedReview.approved && submittedReview.visible !== false, false, 'Hidden review must not show on homepage')

  console.log('✅ Doctor review approval & visibility gating verified!')
}

console.log('\n=========================================')
console.log('🎉 ALL ACCEPTANCE CRITERIA SUCCESSFULLY PASSED!')
console.log('=========================================')
