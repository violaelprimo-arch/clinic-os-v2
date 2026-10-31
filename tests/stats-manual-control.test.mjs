import test from 'node:test'
import assert from 'node:assert/strict'
import {
  landingConfigSchema,
  DEFAULT_LANDING_CONFIG,
  mergeLandingConfig,
} from '../src/lib/landing-config.ts'

test('Stats manual control verification', async (t) => {
  await t.test('Default stats must be manual mode with realistic marketing figures and descriptions', () => {
    assert.ok(Array.isArray(DEFAULT_LANDING_CONFIG.stats))
    assert.equal(DEFAULT_LANDING_CONFIG.stats.length, 4)

    for (const stat of DEFAULT_LANDING_CONFIG.stats) {
      assert.equal(stat.sourceType, 'manual', `Stat ${stat.id} must default to manual mode`)
      assert.ok(stat.value, `Stat ${stat.id} must have a non-empty value`)
      assert.ok(stat.label, `Stat ${stat.id} must have a non-empty label`)
      assert.ok(stat.description, `Stat ${stat.id} must have a description`)
      assert.ok(stat.descriptionEn, `Stat ${stat.id} must have an English description`)
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
        description: 'وصف تفصيلي للعيادات',
        descriptionEn: 'Detailed clinic description',
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
        description: 'أعلى تقييمات في الرعاية الصحية',
        descriptionEn: 'Highest satisfaction in healthcare',
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
    assert.equal(parsed.data.stats[0].description, 'وصف تفصيلي للعيادات')
    assert.equal(parsed.data.stats[0].descriptionEn, 'Detailed clinic description')
    assert.equal(parsed.data.stats[1].value, '98.5')
    assert.equal(parsed.data.stats[1].unit, '%')
  })

  await t.test('Zero value is treated as a valid value and never overwritten by fallback', () => {
    const zeroStat = [
      {
        id: 'st-zero',
        label: 'شكاوى معلقة',
        value: '0',
        unit: '',
        iconName: 'CheckCircle2',
        sourceType: 'manual',
        description: 'لا توجد أي شكاوى معلقة اليوم',
        descriptionEn: 'Zero pending complaints today',
        visible: true,
      },
      {
        id: 'st-zero-num',
        label: 'أوقات الانتظار غير المبررة',
        value: 0,
        unit: 'دقيقة',
        iconName: 'Clock',
        sourceType: 'manual',
        visible: true,
      },
    ]

    const config = {
      ...DEFAULT_LANDING_CONFIG,
      stats: zeroStat,
    }

    const parsed = landingConfigSchema.safeParse(config)
    assert.equal(parsed.success, true)
    assert.equal(parsed.data.stats[0].value, '0')
    assert.equal(parsed.data.stats[1].value, '0')
    assert.equal(parsed.data.stats[0].visible, true)
    assert.equal(parsed.data.stats[1].visible, true)
  })

  await t.test('Large numbers with commas and decimals are strictly preserved', () => {
    const numbersConfig = {
      ...DEFAULT_LANDING_CONFIG,
      stats: [
        {
          id: 'large-1',
          label: 'إجمالي السجلات',
          value: '1,250,000',
          unit: '+',
          visible: true,
        },
        {
          id: 'decimal-1',
          label: 'متوسط سرعة الاستجابة',
          value: '99.98',
          unit: '%',
          visible: true,
        },
      ],
    }

    const parsed = landingConfigSchema.safeParse(numbersConfig)
    assert.equal(parsed.success, true)
    assert.equal(parsed.data.stats[0].value, '1,250,000')
    assert.equal(parsed.data.stats[1].value, '99.98')
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
          description: 'العيادات المعتمدة في النظام',
          visible: true,
        },
      ],
    }

    const merged = mergeLandingConfig(manualConfig)
    assert.equal(merged.stats[0].value, '350')
    assert.equal(merged.stats[0].sourceType, 'manual')
    assert.equal(merged.stats[0].label, 'عياداتنا الحصرية')
    assert.equal(merged.stats[0].description, 'العيادات المعتمدة في النظام')
  })

  await t.test('Section visibility showStats is preserved independently of values', () => {
    const configHidden = {
      ...DEFAULT_LANDING_CONFIG,
      visibility: {
        ...DEFAULT_LANDING_CONFIG.visibility,
        showStats: false,
      },
    }
    const parsedHidden = landingConfigSchema.safeParse(configHidden)
    assert.equal(parsedHidden.success, true)
    assert.equal(parsedHidden.data.visibility.showStats, false)

    const configVisible = {
      ...DEFAULT_LANDING_CONFIG,
      visibility: {
        ...DEFAULT_LANDING_CONFIG.visibility,
        showStats: true,
      },
    }
    const parsedVisible = landingConfigSchema.safeParse(configVisible)
    assert.equal(parsedVisible.success, true)
    assert.equal(parsedVisible.data.visibility.showStats, true)
  })
})
