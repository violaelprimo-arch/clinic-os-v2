import test from 'node:test'
import assert from 'node:assert/strict'
import {
  landingConfigSchema,
  DEFAULT_LANDING_CONFIG,
  mergeLandingConfig,
} from '../src/lib/landing-config.ts'

test('Stats manual control verification', async (t) => {
  await t.test('Default stats must be manual mode with realistic marketing figures', () => {
    assert.ok(Array.isArray(DEFAULT_LANDING_CONFIG.stats))
    assert.equal(DEFAULT_LANDING_CONFIG.stats.length, 4)

    for (const stat of DEFAULT_LANDING_CONFIG.stats) {
      assert.equal(stat.sourceType, 'manual', `Stat ${stat.id} must default to manual mode`)
      assert.ok(stat.value, `Stat ${stat.id} must have a non-empty value`)
      assert.ok(stat.label, `Stat ${stat.id} must have a non-empty label`)
    }

    const clinicStat = DEFAULT_LANDING_CONFIG.stats.find((s) => s.id === 'stat-clinics')
    assert.equal(clinicStat?.value, '150')
    assert.equal(clinicStat?.unit, '+')

    const doctorStat = DEFAULT_LANDING_CONFIG.stats.find((s) => s.id === 'stat-doctors')
    assert.equal(doctorStat?.value, '500')
    assert.equal(doctorStat?.unit, '+')

    const visitStat = DEFAULT_LANDING_CONFIG.stats.find((s) => s.id === 'stat-visits')
    assert.equal(visitStat?.value, '25,000')

    const rxStat = DEFAULT_LANDING_CONFIG.stats.find((s) => s.id === 'stat-prescriptions')
    assert.equal(rxStat?.value, '50,000')
  })

  await t.test('Manual stats with custom numbers and symbols validate seamlessly', () => {
    const customStats = [
      {
        id: 'st-custom-1',
        label: 'عيادات تخصصية معتمدة',
        value: '220',
        unit: 'مركز',
        iconName: 'Building2',
        sourceType: 'manual',
        sourceNote: 'إحصائية معتمدة من إدارة المنظومة',
        visible: true,
        labelEn: 'Accredited Centers',
        valueEn: '220 Centers',
      },
      {
        id: 'st-custom-2',
        label: 'نسبة رضا المرضى',
        value: '98.5',
        unit: '%',
        iconName: 'Award',
        sourceType: 'manual',
        sourceNote: 'استبيانات رضاء المرضى 2026',
        visible: true,
      },
    ]

    const config = {
      ...DEFAULT_LANDING_CONFIG,
      stats: customStats,
    }

    const parsed = landingConfigSchema.safeParse(config)
    assert.equal(parsed.success, true)
    assert.equal(parsed.data.stats[0].value, '220')
    assert.equal(parsed.data.stats[0].unit, 'مركز')
    assert.equal(parsed.data.stats[1].value, '98.5')
    assert.equal(parsed.data.stats[1].unit, '%')
  })

  await t.test('mergeLandingConfig preserves owner manual stats without reverting to automated', () => {
    const manualConfig = {
      stats: [
        {
          id: 'stat-clinics',
          label: 'عياداتنا الحصرية',
          value: '350',
          unit: '+',
          iconName: 'Building2',
          sourceType: 'manual',
          sourceNote: 'سجل العيادات الفعلي',
          visible: true,
        },
      ],
    }

    const merged = mergeLandingConfig(manualConfig)
    assert.equal(merged.stats[0].value, '350')
    assert.equal(merged.stats[0].sourceType, 'manual')
    assert.equal(merged.stats[0].label, 'عياداتنا الحصرية')
  })
})
