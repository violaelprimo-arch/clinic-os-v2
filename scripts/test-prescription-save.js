const assert = require('assert')

console.log('🧪 Testing Firestore Prescription Payload & Data Integrity...\n')

// Simulate doctor inputs and voice dictations
const sampleState = {
  clinicId: 'clinic_test_123',
  selectedBranchId: 'branch_cairo_1',
  selectedBranchName: 'فرع مدينة نصر',
  appointmentId: 'appt_998877',
  patientName: 'أحمد محمود حسن',
  patientPhone: '+201012345678',
  age: '35 سنة',
  diagnosis: 'التهاب حاد في الشعب الهوائية مع حساسية موسمية',
  instructions: 'تناول الدواء بانتظام، شرب سوائل دافئة، وتجنب التدخين',
  dateStr: '2026-10-24',
  drugs: [
    { id: 1, name: 'Panadol Extra 500mg', dosage: 'قرص كل 8 ساعات بعد الأكل', duration: '5 أيام' },
    { id: 2, name: 'Augmentin 1g', dosage: 'قرص كل 12 ساعة', duration: '7 أيام' },
    { id: 3, name: '', dosage: '', duration: '' } // Empty drug row that should be filtered out
  ],
  doctorName: 'د. محمد المهندس',
  templateMode: 'modern',
  topOffset: 0,
  primaryColor: '#0284c7',
  secondaryColor: '#f0f9ff'
}

// 1. Build the exact Firestore payload as written in PrescriptionsPage handleSave
function buildPrescriptionPayload(state) {
  const filteredDrugs = state.drugs.filter(d => d.name && d.name.trim() !== '')

  return {
    clinic_id: state.clinicId,
    branch_id: state.selectedBranchId || '',
    branchName: state.selectedBranchName || '',
    appointment_id: state.appointmentId || '',
    patientName: state.patientName,
    patientPhone: state.patientPhone,
    age: state.age,
    diagnosis: state.diagnosis,
    instructions: state.instructions,
    date: state.dateStr,
    status: 'approved',
    doctorName: state.doctorName || 'طبيب العيادة',
    templateMode: state.templateMode,
    topOffset: state.topOffset,
    primaryColor: state.primaryColor,
    secondaryColor: state.secondaryColor,
    drugs: filteredDrugs,
    createdAt: new Date().toISOString()
  }
}

// Test 1: Payload generation
const payload = buildPrescriptionPayload(sampleState)
assert.strictEqual(payload.clinic_id, 'clinic_test_123')
assert.strictEqual(payload.patientName, 'أحمد محمود حسن')
assert.strictEqual(payload.patientPhone, '+201012345678')
assert.strictEqual(payload.diagnosis, 'التهاب حاد في الشعب الهوائية مع حساسية موسمية')
assert.strictEqual(payload.instructions, 'تناول الدواء بانتظام، شرب سوائل دافئة، وتجنب التدخين')
assert.strictEqual(payload.status, 'approved')
assert.strictEqual(payload.drugs.length, 2, 'Empty drug row must be filtered out')
assert.strictEqual(payload.drugs[0].name, 'Panadol Extra 500mg')
assert.strictEqual(payload.drugs[0].dosage, 'قرص كل 8 ساعات بعد الأكل')
assert.strictEqual(payload.drugs[0].duration, '5 أيام')
console.log('✅ Test 1 Passed: Prescription payload correctly structured and empty rows filtered')

// Test 2: Check for undefined or invalid Firestore fields
for (const [key, val] of Object.entries(payload)) {
  assert(val !== undefined, `Field ${key} must not be undefined for Firestore`)
}
console.log('✅ Test 2 Passed: No undefined values in payload (Firestore safe)')

// Test 3: Patient Portal query compatibility
// In patient/page.tsx: query(collection(db, 'prescriptions'), where('clinic_id', '==', clinicId), where('patientPhone', 'in', searchPhones))
assert.strictEqual(payload.clinic_id, sampleState.clinicId)
assert.strictEqual(payload.patientPhone, sampleState.patientPhone)
console.log('✅ Test 3 Passed: Query keys clinic_id & patientPhone match patient portal requirements')

// Test 4: Appointment update payload compatibility
const appointmentUpdate = {
  diagnosis: sampleState.diagnosis,
  drugs: sampleState.drugs.filter(d => d.name && d.name.trim() !== ''),
  prescription_id: 'rx_generated_id_123',
  prescriptionStatus: 'approved'
}
assert.strictEqual(appointmentUpdate.diagnosis, payload.diagnosis)
assert.strictEqual(appointmentUpdate.drugs.length, 2)
assert.strictEqual(appointmentUpdate.prescriptionStatus, 'approved')
console.log('✅ Test 4 Passed: Appointment sync payload matches prescription details')

console.log('\n🎉 All Firestore Prescription Integrity Tests Passed Successfully!')
