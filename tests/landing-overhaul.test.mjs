import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_LANDING_CONFIG,
  DEFAULT_SECTION_ORDER,
  landingConfigSchema,
  inquirySubmissionSchema,
  mergeLandingConfig,
  DEFAULT_CLINICAL_FEATURES,
  DEFAULT_SCREENSHOTS,
  DEFAULT_STEPS,
  DEFAULT_PRICING_PLANS,
  DEFAULT_FAQ_ITEMS,
} from '../src/lib/landing-config.ts'

test('DEFAULT_SECTION_ORDER contains exactly 13 manageable sections in required order', () => {
  const expectedSections = [
    'navbar',
    'hero',
    'stats',
    'features',
    'gallery',
    'steps',
    'testimonials',
    'partners',
    'pricing',
    'faq',
    'contact',
    'cta',
    'footer',
  ]
  assert.deepEqual(DEFAULT_SECTION_ORDER, expectedSections)
  assert.equal(DEFAULT_SECTION_ORDER.length, 13)
  assert.deepEqual(DEFAULT_LANDING_CONFIG.sectionOrder, expectedSections)
})

test('Default clinical features are organized into Doctor, Reception, and Patient groups with practical benefits', () => {
  assert.ok(DEFAULT_CLINICAL_FEATURES.length >= 5)
  const audiences = new Set(DEFAULT_CLINICAL_FEATURES.map((f) => f.targetAudience))
  assert.ok(audiences.has('doctor'), 'Must have features tailored for doctor')
  assert.ok(audiences.has('reception'), 'Must have features tailored for reception')
  assert.ok(audiences.has('patient'), 'Must have features tailored for patient')

  for (const feature of DEFAULT_CLINICAL_FEATURES) {
    assert.ok(!feature.id.includes('ai'), `Feature ID ${feature.id} must not refer to fake AI`)
    assert.ok(!feature.title.includes('ذكاء اصطناعي'), `Feature title must not make fake AI claims`)
    assert.ok(!feature.description.includes('ذكاء اصطناعي'), `Feature description must not make fake AI claims`)
    assert.ok(!feature.titleEn.toLowerCase().includes('artificial intelligence'))
    assert.ok(feature.practicalBenefit.length > 5, 'Every feature must describe a practical clinical benefit')
    assert.equal(feature.visible, true, 'Default features must be visible by default')
  }
})

test('Visibility is explicit and defaults to true when missing in legacy data', () => {
  // Simulating legacy data without visible property
  const legacyConfig = {
    heroTitle: 'عيادتك منظمة',
    features: [
      {
        id: 'legacy-feature',
        title: 'ميزة قديمة',
        description: 'وصف قديم دون حقل الظهور',
      },
    ],
    screenshots: [
      {
        id: 'legacy-shot',
        title: 'صورة قديمة',
        subtitle: 'وصف قديم',
        imageUrl: '/brand/yalla-clinic/app-icon.png',
      },
    ],
  }

  const merged = mergeLandingConfig(legacyConfig)
  assert.equal(merged.features[0].visible, true, 'Missing visible property must default to true')
  assert.equal(merged.screenshots[0].visible, true, 'Missing visible property must default to true')
  assert.equal(merged.visibility.showHero, true, 'Section visibility defaults to true')
  assert.equal(merged.visibility.showFeatures, true, 'Section visibility defaults to true')

  // Simulating explicit owner hiding: must NOT be overwritten!
  const customHiddenConfig = {
    visibility: {
      showHero: false,
      showPricing: false,
    },
    features: [
      {
        id: 'hidden-feature',
        title: 'ميزة مخفية يدوياً',
        description: 'أخفاها المالك بنفسه',
        visible: false,
      },
    ],
  }

  const mergedHidden = mergeLandingConfig(customHiddenConfig)
  assert.equal(mergedHidden.visibility.showHero, false, 'Owner-saved hidden section must stay false')
  assert.equal(mergedHidden.visibility.showPricing, false, 'Owner-saved hidden section must stay false')
  assert.equal(mergedHidden.features[0].visible, false, 'Owner-saved hidden item must stay false')
})

test('Sections are never automatically hidden due to sparse items', () => {
  // Empty features, empty stats, empty screenshots
  const sparseConfig = {
    features: [],
    stats: [],
    screenshots: [],
    visibility: {
      showStats: true,
      showFeatures: true,
      showScreenshots: true,
    },
  }

  const merged = mergeLandingConfig(sparseConfig)
  assert.equal(merged.visibility.showStats, true, 'Section must not auto-hide due to empty items')
  assert.equal(merged.visibility.showFeatures, true, 'Section must not auto-hide due to empty items')
  assert.equal(merged.visibility.showScreenshots, true, 'Section must not auto-hide due to empty items')
})

test('Theme and motion settings schema supports subtle, normal, and none motion levels', () => {
  const cfg = {
    ...DEFAULT_LANDING_CONFIG,
    themeSettings: {
      primaryColorPreset: 'teal',
      borderRadiusPreset: 'rounded-xl',
      motionLevel: 'none',
      spacingPreset: 'spacious',
    },
  }
  const parsed = landingConfigSchema.safeParse(cfg)
  assert.ok(parsed.success)
  if (parsed.success) {
    assert.equal(parsed.data.themeSettings.motionLevel, 'none')
    assert.equal(parsed.data.themeSettings.primaryColorPreset, 'teal')
  }
})

test('Default screenshots gallery contains authentic system interfaces', () => {
  assert.ok(DEFAULT_SCREENSHOTS.length >= 5)
  const ids = DEFAULT_SCREENSHOTS.map((s) => s.id)
  assert.ok(ids.includes('dashboard'))
  assert.ok(ids.includes('prescription'))
  assert.ok(ids.includes('patient-portal'))
  assert.ok(ids.includes('waiting-tv'))
  assert.ok(ids.includes('finance-reports'))
})

test('Default pricing and FAQ items are well structured and validated', () => {
  assert.ok(DEFAULT_PRICING_PLANS.length >= 3)
  assert.ok(DEFAULT_FAQ_ITEMS.length >= 4)
  const parsed = landingConfigSchema.safeParse(DEFAULT_LANDING_CONFIG)
  assert.ok(parsed.success, 'DEFAULT_LANDING_CONFIG should successfully pass schema validation')
})

test('Inquiries submission schema validates suggestion, complaint, and inquiry types', () => {
  const validSuggestion = {
    type: 'suggestion',
    name: 'د. أحمد محمود',
    contact: '01000000000',
    subject: 'إضافة تقرير مالي جديد',
    message: 'نرجو إضافة تقرير لمصروفات العيادة اليومية بجانب الإيرادات',
  }
  assert.ok(inquirySubmissionSchema.safeParse(validSuggestion).success)

  const validComplaint = {
    type: 'complaint',
    name: 'د. فاطمة علي',
    contact: 'fatima@example.com',
    subject: 'بطء خفيف في تحميل شاشة الاستقبال',
    message: 'شاشة الاستقبال استغرقت بضع ثوان في التحميل اليوم صباحا',
  }
  assert.ok(inquirySubmissionSchema.safeParse(validComplaint).success)

  const validInquiry = {
    type: 'inquiry',
    name: 'د. سارة عادل',
    contact: '01111111111',
    subject: 'استفسار عن دعم شاشات التلفزيون',
    message: 'هل شاشة النداء تعمل على شاشات سامسونج سمارت بدون جهاز إضافي؟',
  }
  assert.ok(inquirySubmissionSchema.safeParse(validInquiry).success)

  // Rejection of invalid types
  assert.equal(
    inquirySubmissionSchema.safeParse({ ...validInquiry, type: 'random_spam' }).success,
    false,
  )

  // Rejection of honeypot filled
  assert.equal(
    inquirySubmissionSchema.safeParse({ ...validInquiry, website: 'http://spam-bot.xyz' }).success,
    false,
  )

  // Rejection of short message
  assert.equal(
    inquirySubmissionSchema.safeParse({ ...validInquiry, message: 'قصير' }).success,
    false,
  )
})

test('Dual-source stats schema supports automated metrics and documented manual stats without fake claims', () => {
  // 1. Verify default stats have zero fake 99.9% uptime or 30s booking claims
  for (const st of DEFAULT_LANDING_CONFIG.stats) {
    assert.notEqual(st.value, '99.9', 'Must not have unmeasured 99.9% claim')
    assert.notEqual(st.value, '30', 'Must not have unmeasured 30s claim')
    assert.ok(st.sourceType === 'automated' || st.sourceType === 'manual')
    if (st.sourceType === 'automated') {
      assert.ok(['clinics', 'doctors', 'visits', 'prescriptions'].includes(st.autoMetricKey))
    }
  }

  // 2. Validate custom manual stat with documented source note
  const customConfig = {
    ...DEFAULT_LANDING_CONFIG,
    stats: [
      {
        id: 'st-1',
        label: 'استشارات تخصصية معتمدة',
        value: '500',
        unit: '+',
        iconName: 'Award',
        sourceType: 'manual',
        sourceNote: 'إحصائية موثقة من سجلات مراكز القاهرة والجيزة',
        visible: true,
      },
      {
        id: 'st-2',
        label: 'عيادات مشتركة',
        value: '12',
        unit: 'عيادة',
        iconName: 'Building2',
        sourceType: 'automated',
        autoMetricKey: 'clinics',
        visible: true,
      },
    ],
  }
  const parsed = landingConfigSchema.safeParse(customConfig)
  assert.ok(parsed.success, 'Dual-source stats should validate cleanly')
})

test('Theme settings schema supports 3D scene, tilt, card glow, motion speed, and mobile animation toggles', () => {
  const customThemeConfig = {
    ...DEFAULT_LANDING_CONFIG,
    themeSettings: {
      primaryColorPreset: 'blue',
      borderRadiusPreset: 'rounded-2xl',
      motionLevel: 'advanced',
      enableBackgroundAnimation: true,
      enable3DTilt: true,
      enableHero3D: true,
      enableCardGlow: true,
      motionSpeed: 'fast',
      enableMobileMotion: true,
      enableSectionMotion: true,
      spacingPreset: 'comfortable',
    },
  }
  const parsed = landingConfigSchema.safeParse(customThemeConfig)
  assert.ok(parsed.success)
  if (parsed.success) {
    assert.equal(parsed.data.themeSettings.enable3DTilt, true)
    assert.equal(parsed.data.themeSettings.enableBackgroundAnimation, true)
    assert.equal(parsed.data.themeSettings.enableHero3D, true)
    assert.equal(parsed.data.themeSettings.enableCardGlow, true)
    assert.equal(parsed.data.themeSettings.motionSpeed, 'fast')
    assert.equal(parsed.data.themeSettings.enableMobileMotion, true)
    assert.equal(parsed.data.themeSettings.enableSectionMotion, true)
    assert.equal(parsed.data.themeSettings.motionLevel, 'advanced')
  }
})
