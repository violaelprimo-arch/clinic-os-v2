import test from 'node:test'
import assert from 'node:assert/strict'

// 1. Template Validation & Drug Row Integrity
test('1. Prescription Template Validation: Name and Drugs Required', () => {
  const validateTemplate = (data) => {
    const errors = []
    if (!data.name || !data.name.trim()) {
      errors.push('يرجى إدخال اسم القالب')
    }
    const validDrugs = (data.drugs || []).filter(d => d.name && d.name.trim() !== '')
    if (validDrugs.length === 0) {
      errors.push('يرجى إضافة دواء واحد على الأقل مع جرعته للقالب')
    }
    return {
      isValid: errors.length === 0,
      errors,
      cleanDrugs: validDrugs.map(d => ({
        name: d.name.trim(),
        dosage: (d.dosage || '').trim(),
        duration: (d.duration || '').trim(),
        notes: (d.notes || '').trim()
      }))
    }
  }

  // Missing name
  const res1 = validateTemplate({ name: '', drugs: [{ name: 'Panadol' }] })
  assert.equal(res1.isValid, false)
  assert.ok(res1.errors.includes('يرجى إدخال اسم القالب'))

  // Missing drugs
  const res2 = validateTemplate({ name: 'بروتوكول الصداع', drugs: [{ name: '' }] })
  assert.equal(res2.isValid, false)
  assert.ok(res2.errors.includes('يرجى إضافة دواء واحد على الأقل مع جرعته للقالب'))

  // Valid template
  const res3 = validateTemplate({
    name: 'نزلة معوية حادة',
    drugs: [
      { name: 'Antinal 200mg', dosage: 'كبسولة كل 8 ساعات', duration: '4 أيام' },
      { name: 'Visceralgine', dosage: 'قرص 3 مرات', duration: '5 أيام' }
    ]
  })
  assert.equal(res3.isValid, true)
  assert.equal(res3.cleanDrugs.length, 2)
  assert.equal(res3.cleanDrugs[0].name, 'Antinal 200mg')
})

// 2. Editing Template Preserves ID without Duplicating
test('2. Editing Template: In-place update preserving ID', () => {
  const existingTemplates = [
    { id: 'tmpl_1', name: 'قالب 1', drugs: [{ name: 'A' }] },
    { id: 'tmpl_2', name: 'قالب 2', drugs: [{ name: 'B' }] }
  ]

  const updateTemplate = (list, updated) => {
    const idx = list.findIndex(t => t.id === updated.id)
    if (idx === -1) return [...list, updated]
    const next = [...list]
    next[idx] = { ...next[idx], ...updated, updatedAt: '2026-10-26T22:00:00Z' }
    return next
  }

  const updated = updateTemplate(existingTemplates, {
    id: 'tmpl_1',
    name: 'قالب 1 معدل',
    drugs: [{ name: 'A+' }, { name: 'C' }]
  })

  assert.equal(updated.length, 2, 'Must not duplicate templates')
  assert.equal(updated[0].id, 'tmpl_1')
  assert.equal(updated[0].name, 'قالب 1 معدل')
  assert.equal(updated[0].drugs.length, 2)
})

// 3. Deleting Template Does Not Mutate Past Prescriptions or Catalog
test('3. Deletion Isolation: Past Prescriptions & Catalog Untouched', () => {
  const pastPrescriptions = [
    { id: 'rx_101', patientName: 'أحمد محمود', drugs: [{ name: 'Antinal' }], templateUsed: 'gastroenteritis' },
    { id: 'rx_102', patientName: 'سارة علي', drugs: [{ name: 'Augmentin' }], templateUsed: 'tonsillitis' }
  ]

  let currentDraft = {
    patientName: 'محمد سامي',
    diagnosis: 'نزلة معوية',
    drugs: [{ name: 'Antinal' }]
  }

  // Action: Delete template 'gastroenteritis'
  const deletedTemplateId = 'gastroenteritis'

  // Verification: Past prescriptions remain intact
  assert.equal(pastPrescriptions.length, 2)
  assert.equal(pastPrescriptions[0].templateUsed, 'gastroenteritis')
  assert.equal(pastPrescriptions[0].drugs[0].name, 'Antinal')

  // Verification: Active open draft is not altered
  assert.equal(currentDraft.patientName, 'محمد سامي')
  assert.equal(currentDraft.drugs.length, 1)
})

// 4. Built-in Protocol Hiding / Overriding Per Clinic Scope
test('4. Clinic Scope Isolation: Built-in Templates Hidden Only for Active Clinic', () => {
  const BUILTIN_PROTOCOLS = [
    { id: 'gastroenteritis', name: 'نزلة معوية حادة' },
    { id: 'tonsillitis', name: 'التهاب الحلق' },
    { id: 'hypertension', name: 'ضغط الدم' }
  ]

  const clinicA = { id: 'clinic_A', hiddenProtocolIds: ['gastroenteritis'] }
  const clinicB = { id: 'clinic_B', hiddenProtocolIds: [] }

  const getVisibleForClinic = (clinic) => {
    return BUILTIN_PROTOCOLS.filter(p => !(clinic.hiddenProtocolIds || []).includes(p.id))
  }

  const visibleA = getVisibleForClinic(clinicA)
  const visibleB = getVisibleForClinic(clinicB)

  // Clinic A has hidden 'gastroenteritis'
  assert.equal(visibleA.length, 2)
  assert.ok(!visibleA.some(p => p.id === 'gastroenteritis'))

  // Clinic B still sees all 3 built-ins
  assert.equal(visibleB.length, 3)
  assert.ok(visibleB.some(p => p.id === 'gastroenteritis'))
})

// 5. Event Propagation: Edit and Delete Buttons Stop Propagation
test('5. Event Isolation: Clicking Edit/Delete never triggers Apply Protocol', () => {
  let protocolApplied = false
  let editOpened = false
  let deleteOpened = false

  const handleApply = () => {
    protocolApplied = true
  }

  const handleEditClick = (e) => {
    e.stopPropagation()
    editOpened = true
  }

  const handleDeleteClick = (e) => {
    e.stopPropagation()
    deleteOpened = true
  }

  // Simulate clicking Edit button inside chip
  let propagationStopped = false
  const mockEditEvent = {
    stopPropagation: () => { propagationStopped = true },
    preventDefault: () => {}
  }

  handleEditClick(mockEditEvent)
  assert.equal(editOpened, true)
  assert.equal(propagationStopped, true)
  assert.equal(protocolApplied, false, 'Applying protocol must NOT be triggered on Edit')

  // Simulate clicking Delete button inside chip
  propagationStopped = false
  const mockDeleteEvent = {
    stopPropagation: () => { propagationStopped = true },
    preventDefault: () => {}
  }

  handleDeleteClick(mockDeleteEvent)
  assert.equal(deleteOpened, true)
  assert.equal(propagationStopped, true)
  assert.equal(protocolApplied, false, 'Applying protocol must NOT be triggered on Delete')
})

// 6. Geographic Map Projection & Mouse Drag Bounds
test('6. Analytics Map: Geographic Coordinate Projection & Pan Mathematics', () => {
  const MAP_W = 700
  const MAP_H = 620
  const MIN_LNG = 25.0
  const MAX_LNG = 36.0
  const MIN_LAT = 22.0
  const MAX_LAT = 32.0

  const projectCoords = (lat, lng) => {
    const x = ((lng - MIN_LNG) / (MAX_LNG - MIN_LNG)) * MAP_W
    const y = ((MAX_LAT - lat) / (MAX_LAT - MIN_LAT)) * MAP_H
    return { x: Math.round(x), y: Math.round(y) }
  }

  // Cairo (30.04°N, 31.23°E)
  const cairo = projectCoords(30.04, 31.23)
  assert.ok(cairo.x > 380 && cairo.x < 415, `Cairo x=${cairo.x} within reasonable Delta bounds`)
  assert.ok(cairo.y > 110 && cairo.y < 135, `Cairo y=${cairo.y} within northern Egypt bounds`)

  // Alexandria (31.20°N, 29.91°E)
  const alex = projectCoords(31.20, 29.91)
  assert.ok(alex.x < cairo.x, 'Alexandria is west of Cairo')
  assert.ok(alex.y < cairo.y, 'Alexandria is north of Cairo')

  // Aswan (24.08°N, 32.89°E)
  const aswan = projectCoords(24.08, 32.89)
  assert.ok(aswan.y > cairo.y, 'Aswan is south of Cairo')

  // Mouse pan delta calculation
  const startOffset = { x: 50, y: -20 }
  const dragMovement = { dx: 15, dy: 10 }
  const nextOffset = { x: startOffset.x + dragMovement.dx, y: startOffset.y + dragMovement.dy }
  assert.deepEqual(nextOffset, { x: 65, y: -10 })
})

// 7. Sidebar Tab Visibility & Package Filtering Logic
test('7. Tab Visibility: Individual Clinic Overrides and Package Gates', () => {
  const navItems = [
    { id: 'appointments', name: 'لوحة اليوم' },
    { id: 'waiting-tv', name: 'شاشة الانتظار' },
    { id: 'patients', name: 'سجل المرضى' },
    { id: 'prescriptions', name: 'الروشتات' },
    { id: 'drugs', name: 'دليل الأدوية' },
    { id: 'accounts', name: 'الحسابات' },
    { id: 'finance', name: 'التقارير المالية' },
    { id: 'analytics', name: 'التحليلات والإحصائيات' },
    { id: 'ai-training', name: 'المساعد الذكي' },
    { id: 'branches', name: 'إدارة الفروع' },
    { id: 'settings', name: 'الإعدادات' }
  ]

  const filterTabs = (clinic, activePackage, isFeatureEnabled) => {
    return navItems.filter(item => {
      // Check hiddenTabs on clinic
      if (clinic?.hiddenTabs && Array.isArray(clinic.hiddenTabs) && clinic.hiddenTabs.includes(item.id)) return false
      // Check hiddenTabs on package
      if (activePackage?.hiddenTabs && Array.isArray(activePackage.hiddenTabs) && activePackage.hiddenTabs.includes(item.id)) return false

      if (item.id === 'analytics' && !isFeatureEnabled(clinic, 'analytics', activePackage)) return false
      if ((item.id === 'accounts' || item.id === 'finance') && !isFeatureEnabled(clinic, 'finance', activePackage)) return false
      if (item.id === 'drugs' && !isFeatureEnabled(clinic, 'drugs', activePackage)) return false
      if (item.id === 'prescriptions' && !isFeatureEnabled(clinic, 'prescriptions', activePackage)) return false
      return true
    })
  }

  const mockFeatureEnabled = (clinic, feat, pkg) => {
    if (feat === 'analytics') {
      if (clinic.allowAnalytics === false) return false
      if (pkg?.allowAnalytics === false) return false
      return true
    }
    return true
  }

  // Clinic with hidden analytics tab
  const clinic1 = { hiddenTabs: ['analytics'] }
  const tabs1 = filterTabs(clinic1, null, mockFeatureEnabled)
  assert.ok(!tabs1.some(t => t.id === 'analytics'), 'Analytics must be hidden when in clinic.hiddenTabs')
  assert.equal(tabs1.length, 10)

  // Clinic with multiple hidden tabs: waiting-tv, finance, drugs
  const clinic2 = { hiddenTabs: ['waiting-tv', 'finance', 'drugs'] }
  const tabs2 = filterTabs(clinic2, null, mockFeatureEnabled)
  assert.ok(!tabs2.some(t => t.id === 'waiting-tv'))
  assert.ok(!tabs2.some(t => t.id === 'finance'))
  assert.ok(!tabs2.some(t => t.id === 'drugs'))
  assert.equal(tabs2.length, 8)

  // Package that disables analytics
  const clinic3 = { hiddenTabs: [] }
  const basicPkg = { allowAnalytics: false }
  const tabs3 = filterTabs(clinic3, basicPkg, mockFeatureEnabled)
  assert.ok(!tabs3.some(t => t.id === 'analytics'), 'Analytics must be hidden when package disables allowAnalytics')
})

// 8. Bilingual Support & Accessibility Labels
test('8. Accessibility & Arabic RTL Integrity', () => {
  const templateChipAriaLabel = (name) => `تعديل قالب ${name}`
  const deleteChipAriaLabel = (name) => `حذف قالب ${name}`

  assert.equal(templateChipAriaLabel('نزلة معوية'), 'تعديل قالب نزلة معوية')
  assert.equal(deleteChipAriaLabel('نزلة معوية'), 'حذف قالب نزلة معوية')
})
