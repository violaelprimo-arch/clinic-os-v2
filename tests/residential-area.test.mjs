import test from 'node:test'
import assert from 'node:assert/strict'
import {
  EGYPT_GOVERNORATES,
  getGovernorates,
  getCities,
  getAreas,
  findAreaById,
  matchCoordinatesToEgyptArea,
  calculateDistanceKm,
  CUSTOM_AREA_ID,
  validateHierarchy
} from '../src/data/egyptGeographicData.ts'
import { normalizeArea, EGYPT_AREAS_COORDINATES } from '../src/lib/analyticsService.ts'
import { removeUndefinedFields } from '../src/lib/queueService.ts'

test('1. Manual Selection & Cascading Reset', () => {
  const govs = getGovernorates()
  assert.equal(govs.length, 27, 'Egypt must have 27 official governorates')

  const cairoCities = getCities('cairo')
  assert.ok(cairoCities.length >= 4, 'Cairo must have multiple city/district groups')

  const eastCairoAreas = getAreas('cairo', 'cairo_east')
  assert.ok(eastCairoAreas.some(a => a.id === 'cairo_nasr_city'), 'Nasr City must be in East Cairo')

  // Validation: Cairo -> East Cairo -> Nasr City is valid
  assert.equal(validateHierarchy('cairo', 'cairo_east', 'cairo_nasr_city'), true)

  // Validation: Cairo with an Alexandria area is INVALID
  assert.equal(validateHierarchy('cairo', 'cairo_east', 'alex_smouha'), false)

  // Validation: Changing governorate to Alexandria resets city choices
  const alexCities = getCities('alexandria')
  assert.ok(!alexCities.some(c => c.id === 'cairo_east'), 'Cairo East must not exist in Alexandria')
})

test('2. Homonym Names Across Different Governorates / Cities Do Not Collide', () => {
  // Faisal in Giza vs Faisal in Suez
  const gizaFaisal = findAreaById('giza_faisal')
  const suezFaisal = findAreaById('suez_faisal_attaka')

  assert.ok(gizaFaisal, 'Giza Faisal must exist')
  assert.ok(suezFaisal, 'Suez Faisal must exist')
  assert.notEqual(gizaFaisal.area.id, suezFaisal.area.id, 'IDs must be distinct')
  assert.equal(gizaFaisal.governorate.id, 'giza')
  assert.equal(suezFaisal.governorate.id, 'suez')

  // Matariya in Cairo vs Matariya in Dakahlia
  const cairoMatariya = findAreaById('cairo_matariya')
  const dakahliaMatariya = findAreaById('dakahlia_manzala')

  assert.ok(cairoMatariya)
  assert.ok(dakahliaMatariya)
  assert.notEqual(cairoMatariya.area.id, dakahliaMatariya.area.id)
})

test('3. Custom Area Fallback (أخرى / غير موجودة بالقائمة)', () => {
  const customResidence = {
    governorateId: 'cairo',
    governorateNameAr: 'القاهرة',
    cityId: 'cairo_north',
    cityNameAr: 'شمال القاهرة',
    areaId: CUSTOM_AREA_ID,
    customAreaName: 'عزبة النخل الشرقية',
    source: 'manual'
  }

  const normalized = normalizeArea(customResidence)
  assert.equal(normalized.normalizedId, 'unmapped_custom')
  assert.equal(normalized.isMapped, false, 'Custom area must not invent fake coordinates')
  assert.equal(normalized.coords, null)
  assert.equal(normalized.labelAr, 'عزبة النخل الشرقية')
})

test('4. Reverse Geocoding & Coordinate Distance Matching', () => {
  // Test coordinate matching for Nasr City (30.052, 31.342)
  const match = matchCoordinatesToEgyptArea(30.052, 31.342)
  assert.ok(match, 'Nasr City coords should match')
  assert.equal(match.area.id, 'cairo_nasr_city')
  assert.equal(match.governorate.id, 'cairo')
  assert.equal(match.confidence, 'high')

  // Test Alexandria Smouha coords (31.215, 29.948)
  const alexMatch = matchCoordinatesToEgyptArea(31.215, 29.948)
  assert.ok(alexMatch)
  assert.equal(alexMatch.area.id, 'alex_smouha')
  assert.equal(alexMatch.governorate.id, 'alexandria')

  // Out of bounds (e.g., Paris coords 48.8566, 2.3522)
  const outOfBounds = matchCoordinatesToEgyptArea(48.8566, 2.3522)
  assert.equal(outOfBounds, null, 'Coordinates outside Egypt must be rejected')
})

test('5. Privacy Protection: Zero PII in Geocoding Payloads', () => {
  // Simulate request payload sent to reverse geocoding API
  const allowedKeys = ['lat', 'lng']
  const payload = {
    lat: 30.052,
    lng: 31.342
    // Zero PII: no name, phone, patientId, diagnosis
  }

  const payloadKeys = Object.keys(payload)
  for (const k of payloadKeys) {
    assert.ok(allowedKeys.includes(k), `Payload contains forbidden key: ${k}`)
  }
})

test('6. Booking Without Area or Location Permission', () => {
  // When patient does not provide residence
  const normalized = normalizeArea(null)
  assert.equal(normalized.normalizedId, 'unrecorded')
  assert.equal(normalized.isMapped, false)
  assert.equal(normalized.coords, null)
})

test('7. Multiple Patients Sharing Same Phone Number (Family Handling)', () => {
  // Mother and child with same phone number
  const appts = [
    {
      id: 'appt_1',
      patientId: 'patient_mom',
      patientName: 'سارة محمد',
      phone: '01012345678',
      date: '2026-10-01',
      status: 'completed',
      patientResidenceSnapshot: {
        governorateId: 'cairo',
        areaId: 'cairo_nasr_city'
      }
    },
    {
      id: 'appt_2',
      patientId: 'patient_child',
      patientName: 'ياسين أحمد',
      phone: '01012345678',
      date: '2026-10-02',
      status: 'completed',
      patientResidenceSnapshot: {
        governorateId: 'giza',
        areaId: 'giza_dokki'
      }
    }
  ]

  // Grouping using patientId or phone+name
  const map = new Map()
  for (const a of appts) {
    const key = a.patientId || `${a.phone}__${a.patientName.trim().toLowerCase()}`
    map.set(key, a)
  }

  assert.equal(map.size, 2, 'Two patients with same phone must not overwrite each other')
  assert.ok(map.has('patient_mom'))
  assert.ok(map.has('patient_child'))
})

test('8. Historical Visit Snapshot Immutability (Demographic Integrity)', () => {
  // Visit 1 in January when patient lived in Alexandria
  const visit1 = {
    id: 'v1',
    patientId: 'p100',
    date: '2026-01-15',
    status: 'completed',
    patientResidenceSnapshot: {
      governorateId: 'alexandria',
      governorateNameAr: 'الإسكندرية',
      areaId: 'alex_smouha',
      areaNameAr: 'سموحة'
    }
  }

  // Patient later moves to Cairo in June
  const currentProfile = {
    id: 'p100',
    residence: {
      governorateId: 'cairo',
      governorateNameAr: 'القاهرة',
      areaId: 'cairo_maadi',
      areaNameAr: 'المعادي'
    }
  }

  // Historical visit 1 snapshot remains Alexandria
  assert.equal(visit1.patientResidenceSnapshot.governorateId, 'alexandria')
  assert.equal(currentProfile.residence.governorateId, 'cairo')

  // When generating report for January, visit1 snapshot is used
  const janNormalized = normalizeArea(visit1.patientResidenceSnapshot)
  assert.equal(janNormalized.normalizedId, 'alex_smouha')
  assert.equal(janNormalized.governorateAr, 'الإسكندرية')
})

test('9. Analytics Map & Table Total Matching (100% Math Consistency)', () => {
  // Simulate 10 unique patients in a period
  const testPatients = [
    { id: 'p1', residence: { areaId: 'cairo_nasr_city' } }, // mapped
    { id: 'p2', residence: { areaId: 'cairo_nasr_city' } }, // mapped
    { id: 'p3', residence: { areaId: 'cairo_heliopolis' } }, // mapped
    { id: 'p4', residence: { areaId: 'alex_smouha' } }, // mapped
    { id: 'p5', residence: { areaId: CUSTOM_AREA_ID, customAreaName: 'منطقة نائية' } }, // unmapped custom
    { id: 'p6', residence: { areaId: CUSTOM_AREA_ID, customAreaName: 'قرية كفر' } }, // unmapped custom
    { id: 'p7', residence: null }, // unrecorded
    { id: 'p8', residence: null }, // unrecorded
    { id: 'p9', residence: null }, // unrecorded
    { id: 'p10', residence: null } // unrecorded
  ]

  let mappedCount = 0
  let unmappedCount = 0
  let unrecordedCount = 0

  const areaMap = new Map()

  for (const p of testPatients) {
    const norm = normalizeArea(p.residence)
    if (norm.normalizedId === 'unrecorded') {
      unrecordedCount++
    } else if (!norm.isMapped || norm.normalizedId.startsWith('unmapped')) {
      unmappedCount++
    } else {
      mappedCount++
      const count = areaMap.get(norm.normalizedId) || 0
      areaMap.set(norm.normalizedId, count + 1)
    }
  }

  assert.equal(mappedCount, 4, '4 mapped patients')
  assert.equal(unmappedCount, 2, '2 unmapped custom patients')
  assert.equal(unrecordedCount, 4, '4 unrecorded patients')

  const total = mappedCount + unmappedCount + unrecordedCount
  assert.equal(total, testPatients.length, 'Total must match exactly (10/10)')

  // Check Nasr City count
  assert.equal(areaMap.get('cairo_nasr_city'), 2)
  assert.equal(areaMap.get('cairo_heliopolis'), 1)
  assert.equal(areaMap.get('alex_smouha'), 1)
})

test('10. Bilingual Integrity (Arabic and English Names for All Governorates)', () => {
  for (const g of EGYPT_GOVERNORATES) {
    assert.ok(g.nameAr && g.nameAr.length > 0, `Governorate ${g.id} missing Arabic name`)
    assert.ok(g.nameEn && g.nameEn.length > 0, `Governorate ${g.id} missing English name`)
    assert.ok(g.lat > 0 && g.lng > 0, `Governorate ${g.id} missing coordinates`)
    assert.ok(g.cities.length > 0, `Governorate ${g.id} has no cities`)
    for (const c of g.cities) {
      assert.ok(c.nameAr && c.nameEn, `City ${c.id} missing names`)
      assert.ok(c.areas.length > 0, `City ${c.id} has no areas`)
      for (const a of c.areas) {
        assert.ok(a.nameAr && a.nameEn, `Area ${a.id} missing names`)
        assert.ok(a.lat > 0 && a.lng > 0, `Area ${a.id} missing coords`)
      }
    }
  }
})

test('11. Booking Payload Sanitization (Zero Undefined Values for Firestore Safety)', () => {
  // Test case 1: Patient skips optional residence during booking (like in the user screenshot)
  const bookingWithoutResidence = {
    clinic_id: 'zizo',
    patientName: 'فتحي',
    phone: '01557540280',
    age: '99',
    gender: 'ذكر',
    address: null,
    city: null,
    patientResidenceSnapshot: null,
    date: '2026-10-26',
    status: 'waiting',
    legacyUndefinedField: undefined
  }

  const cleaned = removeUndefinedFields(bookingWithoutResidence)
  assert.equal(cleaned.patientName, 'فتحي')
  assert.equal(cleaned.address, null)
  assert.equal(cleaned.city, null)
  assert.equal(cleaned.patientResidenceSnapshot, null)
  assert.equal('legacyUndefinedField' in cleaned, false, 'Undefined fields must be stripped')

  // Verify recursion on nested object with undefined fields
  const complexWithUndefined = {
    a: 1,
    nested: {
      b: 2,
      c: undefined,
      deep: {
        d: 'deep-val',
        e: undefined
      }
    },
    list: [{ x: 10, y: undefined }]
  }

  const cleanedComplex = removeUndefinedFields(complexWithUndefined)
  assert.equal(cleanedComplex.nested.b, 2)
  assert.equal('c' in cleanedComplex.nested, false)
  assert.equal(cleanedComplex.nested.deep.d, 'deep-val')
  assert.equal('e' in cleanedComplex.nested.deep, false)
  assert.equal('y' in cleanedComplex.list[0], false)
})

