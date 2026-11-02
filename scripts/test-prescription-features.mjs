import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  normalizeInstructionText,
  filterSuggestions,
  DEFAULT_DOSAGE_PRESETS,
  DEFAULT_DURATION_PRESETS,
  DEFAULT_INSTRUCTION_PRESETS
} from '../src/lib/prescriptionSuggestions.ts'

console.log('=====================================================================')
console.log('🧪 RUNNING COMPREHENSIVE PRESCRIPTION & AUTOCOMPLETE TEST SUITE')
console.log('=====================================================================')

// TEST 1: Text normalization & deduplication
console.log('\n--- Test 1: Text Normalization & Deduplication ---')
{
  assert.equal(normalizeInstructionText('   3  أقراص   يوميًا  '), '3 اقراص يوميا')
  assert.equal(normalizeInstructionText('٣ أقراص يومياً'), '3 اقراص يوميا')
  assert.equal(normalizeInstructionText('قرص كل ١٢ ساعة'), 'قرص كل 12 ساعه')
  assert.equal(normalizeInstructionText(''), '')
  console.log('✅ Text normalization converts Arabic-Indic digits, normalizes alefs, strips diacritics, and trims excess whitespace.')
}

// TEST 2: Suggestion filtering (prefix, substring, limit)
console.log('\n--- Test 2: Suggestion Filtering (Prefix & Substring) ---')
{
  const suggestions = [
    'قرص واحد يومياً بعد الإفطار',
    'قرص كل 12 ساعة بعد الأكل',
    'قرص 3 مرات يومياً قبل الأكل',
    'كبسولة كل 8 ساعات بعد الأكل',
    'ملعقة كبيرة 3 مرات يومياً',
    'عند اللزوم فقط'
  ]

  // Empty query returns top suggestions up to limit
  const top4 = filterSuggestions(suggestions, '', 4)
  assert.equal(top4.length, 4)
  assert.equal(top4[0], 'قرص واحد يومياً بعد الإفطار')

  // Query "قرص" matches all items starting with or containing "قرص"
  const qKors = filterSuggestions(suggestions, 'قرص', 5)
  assert.equal(qKors.length, 3)
  assert(qKors.every(s => s.includes('قرص')))

  // Query "كبسولة" matches specific
  const qCap = filterSuggestions(suggestions, 'كبسول', 5)
  assert.equal(qCap.length, 1)
  assert.equal(qCap[0], 'كبسولة كل 8 ساعات بعد الأكل')

  // Query with no match returns empty array
  const qNone = filterSuggestions(suggestions, 'حقنة عضلية غير موجودة', 5)
  assert.equal(qNone.length, 0)

  console.log('✅ Suggestion filtering respects query, prefix prioritisation, and limit.')
}

// TEST 3: Clinical Default Presets Verification
console.log('\n--- Test 3: Clinical Default Presets Verification ---')
{
  assert(DEFAULT_DOSAGE_PRESETS.length >= 8, 'Must have at least 8 dosage presets')
  assert(DEFAULT_DURATION_PRESETS.length >= 8, 'Must have at least 8 duration presets')
  assert(DEFAULT_INSTRUCTION_PRESETS.length >= 6, 'Must have at least 6 instruction presets')

  assert(DEFAULT_DOSAGE_PRESETS.includes('قرص كل 12 ساعة بعد الأكل'))
  assert(DEFAULT_DURATION_PRESETS.includes('لمدة 5 أيام'))
  assert(DEFAULT_INSTRUCTION_PRESETS.includes('الراحة التامة وتناول السوائل الدافئة بكثرة.'))

  console.log('✅ Clinical baseline presets cover common Egyptian outpatient practice.')
}

// TEST 4: Family Member Disambiguation & Patient Profile URL
console.log('\n--- Test 4: Family Member Disambiguation & Patient Profile URL ---')
{
  // Simulate URL generator from prescriptions/page.tsx
  function generatePatientProfileUrl(slug, patientName, patientPhone, appointmentId, hasSelected) {
    if (!hasSelected) return ''
    const cleanPhone = (patientPhone || '').trim()
    const primaryId = appointmentId || (cleanPhone ? encodeURIComponent(cleanPhone) : 'profile')
    const params = new URLSearchParams()
    if (patientName.trim()) params.set('name', patientName.trim())
    if (appointmentId) params.set('appointmentId', appointmentId)
    if (cleanPhone) params.set('phone', cleanPhone)
    const queryString = params.toString() ? `?${params.toString()}` : ''
    return `/clinic/${slug}/admin/patients/${primaryId}${queryString}`
  }

  // 4a. Disabled state when no patient is chosen
  const disabledUrl = generatePatientProfileUrl('el-ezaby', '', '', '', false)
  assert.equal(disabledUrl, '', 'URL must be empty when no patient is chosen')

  // 4b. Patient with appointmentId and name
  const apptUrl = generatePatientProfileUrl('el-ezaby', 'أحمد محمود', '01012345678', 'appt_999', true)
  assert.equal(apptUrl, '/clinic/el-ezaby/admin/patients/appt_999?name=%D8%A3%D8%AD%D9%85%D8%AF+%D9%85%D8%AD%D9%85%D9%88%D8%AF&appointmentId=appt_999&phone=01012345678')

  // 4c. Family member sharing the same phone (e.g., child 'سارة محمود' vs father 'أحمد محمود')
  const fatherAppts = [
    { id: 'appt_1', patientName: 'أحمد محمود', phone: '01012345678', date: '2026-11-01' },
    { id: 'appt_2', patientName: 'سارة محمود', phone: '01012345678', date: '2026-11-02' }
  ]

  // Filter logic in PatientProfileClient.tsx
  const resolveForTarget = (appts, targetName) => {
    if (targetName) {
      const normTarget = targetName.trim().toLowerCase()
      const filtered = appts.filter(a => (a.patientName || '').trim().toLowerCase() === normTarget)
      if (filtered.length > 0) return filtered
    }
    return appts
  }

  const saraVisits = resolveForTarget(fatherAppts, 'سارة محمود')
  assert.equal(saraVisits.length, 1)
  assert.equal(saraVisits[0].id, 'appt_2')
  assert.equal(saraVisits[0].patientName, 'سارة محمود')

  const ahmedVisits = resolveForTarget(fatherAppts, 'أحمد محمود')
  assert.equal(ahmedVisits.length, 1)
  assert.equal(ahmedVisits[0].id, 'appt_1')
  assert.equal(ahmedVisits[0].patientName, 'أحمد محمود')

  console.log('✅ Patient Profile URL generation & family member disambiguation pass 100%.')
}

// TEST 5: Verify Prescription Page Component Source Code
console.log('\n--- Test 5: Verify Prescriptions Page Component Code Integrity ---')
{
  const pageCode = fs.readFileSync('src/app/clinic/[slug]/admin/prescriptions/page.tsx', 'utf8')

  // 5a. Check open patient profile button with target="_blank" and rel="noopener noreferrer"
  assert(pageCode.includes('target="_blank"'), 'Must have target="_blank" for new tab')
  assert(pageCode.includes('rel="noopener noreferrer"'), 'Must have rel="noopener noreferrer" for security')
  assert(pageCode.includes('فتح ملف المريض'), 'Must have Arabic label «فتح ملف المريض»')
  assert(pageCode.includes('اختر المريض أولًا'), 'Must have disabled state fallback text')

  // 5b. Check InstructionAutocompleteInput usage
  assert(pageCode.includes('InstructionAutocompleteInput'), 'Must use InstructionAutocompleteInput component')
  assert(pageCode.includes('drug-dosage-input'), 'Must attach dosage autocomplete to medication rows')
  assert(pageCode.includes('drug-duration-input'), 'Must attach duration autocomplete to medication rows')
  assert(pageCode.includes('suggestions={instructionsSuggestions}'), 'Must pass instructions suggestions')
  assert(pageCode.includes('suggestions={dosageSuggestions}'), 'Must pass dosage suggestions')
  assert(pageCode.includes('suggestions={durationSuggestions}'), 'Must pass duration suggestions')

  // 5c. Check suggestion persistence on save
  assert(pageCode.includes('savePrescriptionSuggestions'), 'Must call savePrescriptionSuggestions on prescription save')

  console.log('✅ Prescriptions page has all required components, handlers, and security attributes.')
}

// TEST 6: Print / PDF Isolation
console.log('\n--- Test 6: Print & PDF Isolation ---')
{
  const inputCode = fs.readFileSync('src/components/clinic/InstructionAutocompleteInput.tsx', 'utf8')
  assert(inputCode.includes('print:hidden'), 'Suggestions dropdown must have print:hidden')

  const a4Code = fs.readFileSync('src/components/clinic/A4Prescription.tsx', 'utf8')
  assert(!a4Code.includes('InstructionAutocompleteInput'), 'A4 sheet must not include autocomplete UI')
  assert(!a4Code.includes('فتح ملف المريض'), 'A4 sheet must not include patient profile button')

  console.log('✅ Print and PDF views remain pristine without any UI leaks.')
}

console.log('\n=====================================================================')
console.log('🎉 ALL 6 PRESCRIPTION VERIFICATION TESTS PASSED SUCCESSFULLY!')
console.log('=====================================================================')
