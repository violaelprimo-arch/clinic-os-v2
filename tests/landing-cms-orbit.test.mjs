import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_ORBIT_CARDS,
  DEFAULT_LANDING_CONFIG,
  landingConfigSchema,
} from '../src/lib/landing-config.ts'

test('TASK 1 & 2: Orbit 3D Cards Schema and Structure', async (t) => {
  await t.test('Orbit cards default items exist and validate against schema', () => {
    assert.ok(DEFAULT_ORBIT_CARDS.length >= 3, 'Must have at least 3 default orbit cards')
    const config = structuredClone(DEFAULT_LANDING_CONFIG)
    const result = landingConfigSchema.safeParse(config)
    assert.equal(result.success, true, 'DEFAULT_LANDING_CONFIG with orbitCards must pass schema')
  })

  await t.test('All orbit cards have AR/EN titles, subtitles, and valid colors', () => {
    DEFAULT_ORBIT_CARDS.forEach((card, idx) => {
      assert.ok(card.id, `Card #${idx} must have an id`)
      assert.ok(card.title, `Card #${idx} must have an Arabic title`)
      assert.ok(card.titleEn, `Card #${idx} must have an English title`)
      assert.ok(card.cardColor, `Card #${idx} must have a cardColor`)
      assert.ok(card.glowColor, `Card #${idx} must have a glowColor`)
      assert.ok(card.iconName, `Card #${idx} must have an iconName`)
    })
  })

  await t.test('Exactly one orbit card is default active initially', () => {
    const defaultActives = DEFAULT_ORBIT_CARDS.filter((c) => c.isDefaultActive)
    assert.equal(defaultActives.length, 1, 'Exactly one card should be default active')
  })
})

test('TASK 3: Statistics Dual Source Schema & Counter Logic', async (t) => {
  await t.test('Stats items support automated metrics and manual mode', () => {
    const config = structuredClone(DEFAULT_LANDING_CONFIG)
    config.stats = [
      {
        id: 'stat-auto',
        label: 'عيادات مسجلة',
        value: '1',
        unit: '+',
        iconName: 'Building2',
        sourceType: 'automated',
        autoMetricKey: 'clinics',
        visible: true,
        labelEn: 'Clinics',
      },
      {
        id: 'stat-manual',
        label: 'نسبة الجاهزية',
        value: '99.9',
        unit: '%',
        iconName: 'ShieldCheck',
        sourceType: 'manual',
        sourceNote: 'إحصائية توثيقية من فريق المنظومة',
        visible: true,
        labelEn: 'Uptime',
      },
    ]
    const parsed = landingConfigSchema.safeParse(config)
    assert.equal(parsed.success, true)
    assert.equal(parsed.data.stats[0].sourceType, 'automated')
    assert.equal(parsed.data.stats[1].sourceType, 'manual')
    assert.equal(parsed.data.stats[1].value, '99.9')
  })
})

test('TASK 4: Dynamic Steps Builder Flexibility', async (t) => {
  await t.test('Supports custom step counts (e.g. 5 steps) with auto-renumbering', () => {
    const config = structuredClone(DEFAULT_LANDING_CONFIG)
    config.steps = [
      { id: 's1', number: 1, title: 'الخطوة 1', description: 'وصف 1', iconName: 'Rocket', visible: true, titleEn: 'S1', descriptionEn: 'D1' },
      { id: 's2', number: 2, title: 'الخطوة 2', description: 'وصف 2', iconName: 'Settings', visible: true, titleEn: 'S2', descriptionEn: 'D2' },
      { id: 's3', number: 3, title: 'الخطوة 3', description: 'وصف 3', iconName: 'Users', visible: true, titleEn: 'S3', descriptionEn: 'D3' },
      { id: 's4', number: 4, title: 'الخطوة 4', description: 'وصف 4', iconName: 'Stethoscope', visible: true, titleEn: 'S4', descriptionEn: 'D4' },
      { id: 's5', number: 5, title: 'الخطوة 5', description: 'وصف 5', iconName: 'CheckCircle2', visible: true, titleEn: 'S5', descriptionEn: 'D5' },
    ]
    const parsed = landingConfigSchema.safeParse(config)
    assert.equal(parsed.success, true, '5 steps must be valid')
    assert.equal(parsed.data.steps.length, 5)
  })
})

test('TASK 5: Pricing Plans Schema Validity', async (t) => {
  await t.test('Pricing plans include required attributes', () => {
    const plans = DEFAULT_LANDING_CONFIG.pricingPlans
    assert.ok(plans.length >= 2, 'Must have default plans')
    plans.forEach((plan) => {
      assert.ok(plan.id, 'Plan must have an id')
      assert.ok(plan.name, 'Plan must have a name')
      assert.ok(plan.price, 'Plan must have a price')
      assert.ok(Array.isArray(plan.features), 'Plan must have features array')
    })
  })
})

test('TASK 7: Appearance & Motion Theme Tokens', async (t) => {
  await t.test('Theme settings include all motion levels and custom color tokens', () => {
    const theme = DEFAULT_LANDING_CONFIG.themeSettings
    assert.ok(['none', 'subtle', 'normal', 'advanced'].includes(theme.motionLevel))
    assert.equal(typeof theme.enable3DTilt, 'boolean')
    assert.equal(typeof theme.enableBackgroundAnimation, 'boolean')
    assert.equal(typeof theme.enableHero3D, 'boolean')
    assert.equal(typeof theme.enableCardGlow, 'boolean')
    assert.ok(['slow', 'normal', 'fast'].includes(theme.motionSpeed))
    assert.ok(theme.customPrimaryColor, 'Must have custom primary color')
    assert.ok(theme.customGlowColor, 'Must have custom glow color')
  })
})
