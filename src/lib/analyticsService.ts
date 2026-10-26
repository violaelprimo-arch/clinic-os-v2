/**
 * ClinicOS Analytics & Statistics Engine
 * Comprehensive, production-grade statistical calculation engine
 * for clinical, operational, demographic, and financial clinic data.
 */

export interface DateRange {
  from: string // YYYY-MM-DD
  to: string   // YYYY-MM-DD
}

export interface PeriodComparison {
  currentPeriod: DateRange
  previousPeriod: DateRange
}

export interface MetricDelta {
  current: number
  previous: number
  diff: number
  percentage: number | null // null when previous is 0 and no valid ratio exists
  isIncrease: boolean
  isNeutral: boolean
  formattedDelta: string
}

// ============================================================================
// 1. TIMEZONE & DATE RANGE HELPERS (Africa/Cairo default)
// ============================================================================

export const CLINIC_TIMEZONE = 'Africa/Cairo'

/**
 * Returns current date string formatted as YYYY-MM-DD in Cairo timezone
 */
export function getCairoDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: CLINIC_TIMEZONE }).format(date)
}

/**
 * Computes exact start and end dates for standard presets
 */
export function getPresetDateRange(
  preset: 'today' | 'week' | 'month' | 'year' | 'custom',
  customRange?: Partial<DateRange>
): DateRange {
  const now = new Date()
  const todayStr = getCairoDateString(now)

  if (preset === 'today') {
    return { from: todayStr, to: todayStr }
  }

  if (preset === 'week') {
    const d = new Date(now)
    d.setDate(d.getDate() - 6) // Last 7 days including today
    return { from: getCairoDateString(d), to: todayStr }
  }

  if (preset === 'month') {
    const d = new Date(now)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    return { from: `${year}-${month}-01`, to: todayStr }
  }

  if (preset === 'year') {
    const year = now.getFullYear()
    return { from: `${year}-01-01`, to: todayStr }
  }

  // Custom range fallback
  return {
    from: customRange?.from || todayStr,
    to: customRange?.to || todayStr
  }
}

/**
 * Computes the exact preceding period of identical duration.
 * E.g., if current period is 2026-10-01 to 2026-10-15 (15 days),
 * previous period is 2026-09-16 to 2026-09-30 (15 days).
 */
export function computePreviousPeriod(currentRange: DateRange): DateRange {
  const [fYear, fMonth, fDay] = currentRange.from.split('-').map(Number)
  const [tYear, tMonth, tDay] = currentRange.to.split('-').map(Number)

  const fromDate = new Date(fYear, fMonth - 1, fDay)
  const toDate = new Date(tYear, tMonth - 1, tDay)

  const daySpan = Math.max(1, Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1)

  const prevTo = new Date(fromDate)
  prevTo.setDate(prevTo.getDate() - 1)

  const prevFrom = new Date(prevTo)
  prevFrom.setDate(prevFrom.getDate() - (daySpan - 1))

  return {
    from: getCairoDateString(prevFrom),
    to: getCairoDateString(prevTo)
  }
}

/**
 * Safely computes percentage delta between two values, handling 0 cleanly.
 */
export function calculateDelta(current: number, previous: number): MetricDelta {
  const diff = current - previous
  if (previous === 0) {
    if (current === 0) {
      return {
        current,
        previous,
        diff: 0,
        percentage: 0,
        isIncrease: false,
        isNeutral: true,
        formattedDelta: '0%'
      }
    }
    // Started from zero: display clean "+100%" or new indicator without Infinity
    return {
      current,
      previous,
      diff,
      percentage: 100,
      isIncrease: current > 0,
      isNeutral: false,
      formattedDelta: current > 0 ? '+100%' : '-100%'
    }
  }

  const rawPercent = Math.round((diff / previous) * 1000) / 10 // 1 decimal place
  const formattedDelta = rawPercent > 0 ? `+${rawPercent}%` : `${rawPercent}%`

  return {
    current,
    previous,
    diff,
    percentage: rawPercent,
    isIncrease: diff > 0,
    isNeutral: diff === 0,
    formattedDelta
  }
}

// ============================================================================
// 2. EGYPTIAN GEOGRAPHIC NORMALIZATION & COORDINATES
// ============================================================================

export interface AreaCoordinate {
  id: string
  nameAr: string
  nameEn: string
  governorateAr: string
  lat: number
  lng: number
  keywords: string[]
}

export const EGYPT_AREAS_COORDINATES: AreaCoordinate[] = [
  // Cairo & Major Neighborhoods
  {
    id: 'cairo-nasr-city',
    nameAr: 'مدينة نصر',
    nameEn: 'Nasr City',
    governorateAr: 'القاهرة',
    lat: 30.052,
    lng: 31.342,
    keywords: ['مدينة نصر', 'نصر', 'nasr city', 'حي العاشر', 'مكرم عبيد', 'عباس العقاد', 'السراج']
  },
  {
    id: 'cairo-heliopolis',
    nameAr: 'مصر الجديدة',
    nameEn: 'Heliopolis',
    governorateAr: 'القاهرة',
    lat: 30.088,
    lng: 31.328,
    keywords: ['مصر الجديدة', 'هيليوبوليس', 'heliopolis', 'الكوربة', 'روكسي', 'الميرغني']
  },
  {
    id: 'cairo-maadi',
    nameAr: 'المعادي',
    nameEn: 'Maadi',
    governorateAr: 'القاهرة',
    lat: 29.959,
    lng: 31.258,
    keywords: ['المعادي', 'معادي', 'maadi', 'دجلة', 'زهراء المعادي', 'البساتين']
  },
  {
    id: 'cairo-new-cairo',
    nameAr: 'القاهرة الجديدة (التجمع)',
    nameEn: 'New Cairo',
    governorateAr: 'القاهرة',
    lat: 30.012,
    lng: 31.491,
    keywords: ['التجمع', 'القاهرة الجديدة', 'new cairo', 'التجمع الخامس', 'التجمع الاول', 'الرحاب', 'مدينتي', 'الشروق']
  },
  {
    id: 'cairo-shubra',
    nameAr: 'شبرا',
    nameEn: 'Shubra',
    governorateAr: 'القاهرة',
    lat: 30.083,
    lng: 31.248,
    keywords: ['شبرا', 'shubra', 'شبرا مصر', 'شبرا الخيمة', 'الساحل', 'روض الفرج']
  },
  {
    id: 'cairo-downtown',
    nameAr: 'وسط البلد',
    nameEn: 'Downtown Cairo',
    governorateAr: 'القاهرة',
    lat: 30.044,
    lng: 31.235,
    keywords: ['وسط البلد', 'التحرير', 'عابدين', 'الزمالك', 'قصر النيل', 'باب اللوق']
  },
  {
    id: 'cairo-general',
    nameAr: 'القاهرة (عام)',
    nameEn: 'Cairo',
    governorateAr: 'القاهرة',
    lat: 30.044,
    lng: 31.235,
    keywords: ['القاهرة', 'cairo', 'عين شمس', 'الزيتون', 'المطرية', 'حدائق القبة', 'المرج', 'حلوان']
  },

  // Giza & Neighborhoods
  {
    id: 'giza-dokki-mohandessin',
    nameAr: 'الدقي والمهندسين',
    nameEn: 'Dokki & Mohandessin',
    governorateAr: 'الجيزة',
    lat: 30.048,
    lng: 31.206,
    keywords: ['الدقي', 'المهندسين', 'dokki', 'mohandessin', 'ميدان لبنان', 'جامعة الدول', 'البطل احمد عبد العزيز', 'العجوزة']
  },
  {
    id: 'giza-haram-faisal',
    nameAr: 'الهرم وفيصل',
    nameEn: 'Haram & Faisal',
    governorateAr: 'الجيزة',
    lat: 29.997,
    lng: 31.148,
    keywords: ['الهرم', 'فيصل', 'haram', 'faisal', 'العريش', 'الطالبية', 'المريوطية', 'الرماية']
  },
  {
    id: 'giza-october',
    nameAr: '6 أكتوبر',
    nameEn: '6th of October',
    governorateAr: 'الجيزة',
    lat: 29.972,
    lng: 30.942,
    keywords: ['6 اكتوبر', 'أكتوبر', 'october', 'الحصري', 'حدائق اكتوبر', 'غرب سوميد']
  },
  {
    id: 'giza-zayed',
    nameAr: 'الشيخ زايد',
    nameEn: 'Sheikh Zayed',
    governorateAr: 'الجيزة',
    lat: 30.055,
    lng: 30.985,
    keywords: ['الشيخ زايد', 'زايد', 'sheikh zayed', 'هايبر وان']
  },
  {
    id: 'giza-general',
    nameAr: 'الجيزة (عام)',
    nameEn: 'Giza',
    governorateAr: 'الجيزة',
    lat: 30.013,
    lng: 31.208,
    keywords: ['الجيزة', 'giza', 'العمرانية', 'بولاق الدكرور', 'الوراق', 'إمبابة']
  },

  // Alexandria & Coast
  {
    id: 'alex-general',
    nameAr: 'الإسكندرية',
    nameEn: 'Alexandria',
    governorateAr: 'الإسكندرية',
    lat: 31.200,
    lng: 29.918,
    keywords: ['الإسكندرية', 'الاسكندرية', 'alexandria', 'سموحة', 'سيدي جابر', 'محرم بك', 'لوران', 'ميامي', 'المنتزه', 'العجمي']
  },

  // Delta Governorates
  {
    id: 'dakahlia-mansoura',
    nameAr: 'المنصورة (الدقهلية)',
    nameEn: 'Mansoura',
    governorateAr: 'الدقهلية',
    lat: 31.040,
    lng: 31.378,
    keywords: ['المنصورة', 'الدقهلية', 'mansoura', 'ميت غمر', 'السنبلاوين', 'بلقاس', 'طلخا']
  },
  {
    id: 'gharbia-tanta',
    nameAr: 'طنطا (الغربية)',
    nameEn: 'Tanta',
    governorateAr: 'الغربية',
    lat: 30.786,
    lng: 31.000,
    keywords: ['طنطا', 'الغربية', 'tanta', 'المحلة', 'المحلة الكبرى', 'كفر الزيات', 'زفتى']
  },
  {
    id: 'sharqia-zagazig',
    nameAr: 'الزقازيق (الشرقية)',
    nameEn: 'Zagazig',
    governorateAr: 'الشرقية',
    lat: 30.587,
    lng: 31.502,
    keywords: ['الزقازيق', 'الشرقية', 'zagazig', 'العاشر من رمضان', 'بلبيس', 'منيا القمح', 'فاقوس']
  },
  {
    id: 'qalyubia-banha',
    nameAr: 'بنها (القليوبية)',
    nameEn: 'Banha',
    governorateAr: 'القليوبية',
    lat: 30.466,
    lng: 31.185,
    keywords: ['بنها', 'القليوبية', 'banha', 'قليوب', 'طوخ', 'العبور', 'الخانكة']
  },
  {
    id: 'monufia-shibin',
    nameAr: 'شبين الكوم (المنوفية)',
    nameEn: 'Shibin El Kom',
    governorateAr: 'المنوفية',
    lat: 30.552,
    lng: 31.009,
    keywords: ['المنوفية', 'شبين الكوم', 'shibin', 'السادات', 'منوف', 'أشمون', 'قويسنا']
  },
  {
    id: 'beheira-damanhour',
    nameAr: 'دمنهور (البحيرة)',
    nameEn: 'Damanhour',
    governorateAr: 'البحيرة',
    lat: 31.042,
    lng: 30.470,
    keywords: ['البحيرة', 'دمنهور', 'damanhour', 'كفر الدوار', 'إيتاي البارود', 'رشيد']
  },
  {
    id: 'damietta',
    nameAr: 'دمياط',
    nameEn: 'Damietta',
    governorateAr: 'دمياط',
    lat: 31.417,
    lng: 31.814,
    keywords: ['دمياط', 'damietta', 'رأس البر', 'دمياط الجديدة']
  },
  {
    id: 'kafr-el-sheikh',
    nameAr: 'كفر الشيخ',
    nameEn: 'Kafr El Sheikh',
    governorateAr: 'كفر الشيخ',
    lat: 31.111,
    lng: 30.939,
    keywords: ['كفر الشيخ', 'kafr el sheikh', 'دسوق', 'بيلا', 'فوه']
  },

  // Canal Governorates
  {
    id: 'canal-ismailia',
    nameAr: 'الإسماعيلية',
    nameEn: 'Ismailia',
    governorateAr: 'الإسماعيلية',
    lat: 30.596,
    lng: 32.271,
    keywords: ['الإسماعيلية', 'الاسماعيلية', 'ismailia', 'فايد', 'القنطرة']
  },
  {
    id: 'canal-port-said',
    nameAr: 'بورسعيد',
    nameEn: 'Port Said',
    governorateAr: 'بورسعيد',
    lat: 31.265,
    lng: 32.301,
    keywords: ['بورسعيد', 'port said', 'بورفؤاد']
  },
  {
    id: 'canal-suez',
    nameAr: 'السويس',
    nameEn: 'Suez',
    governorateAr: 'السويس',
    lat: 29.966,
    lng: 32.549,
    keywords: ['السويس', 'suez', 'العين السخنة']
  },

  // Upper Egypt
  {
    id: 'fayoum',
    nameAr: 'الفيوم',
    nameEn: 'Fayoum',
    governorateAr: 'الفيوم',
    lat: 29.308,
    lng: 30.842,
    keywords: ['الفيوم', 'fayoum', 'سنورس', 'إبشواي']
  },
  {
    id: 'beni-suef',
    nameAr: 'بني سويف',
    nameEn: 'Beni Suef',
    governorateAr: 'بني سويف',
    lat: 29.066,
    lng: 31.099,
    keywords: ['بني سويف', 'beni suef', 'الواسطى', 'ببا']
  },
  {
    id: 'minya',
    nameAr: 'المنيا',
    nameEn: 'Minya',
    governorateAr: 'المنيا',
    lat: 28.087,
    lng: 30.761,
    keywords: ['المنيا', 'minya', 'ملوي', 'بني مزار', 'مغاغة', 'سمالوط']
  },
  {
    id: 'asyut',
    nameAr: 'أسيوط',
    nameEn: 'Asyut',
    governorateAr: 'أسيوط',
    lat: 27.180,
    lng: 31.183,
    keywords: ['أسيوط', 'اسيوط', 'asyut', 'ديروط', 'القوصية', 'منفلوط', 'أبوتيج']
  },
  {
    id: 'sohag',
    nameAr: 'سوهاج',
    nameEn: 'Sohag',
    governorateAr: 'سوهاج',
    lat: 26.556,
    lng: 31.694,
    keywords: ['سوهاج', 'sohag', 'طهطا', 'جرجا', 'المراغة', 'أخميم']
  },
  {
    id: 'qena-luxor',
    nameAr: 'قنا والأقصر',
    nameEn: 'Qena & Luxor',
    governorateAr: 'قنا',
    lat: 26.155,
    lng: 32.716,
    keywords: ['قنا', 'الأقصر', 'الاقصر', 'qena', 'luxor', 'نجع حمادي', 'دشنا', 'إسنا']
  },
  {
    id: 'aswan',
    nameAr: 'أسوان',
    nameEn: 'Aswan',
    governorateAr: 'أسوان',
    lat: 24.088,
    lng: 32.899,
    keywords: ['أسوان', 'اسوان', 'aswan', 'كوم أمبو', 'إدفو']
  }
]

/**
 * Normalizes any free-text address or area string to an authoritative Egyptian region
 */
export function normalizeArea(rawArea?: string | null): {
  normalizedId: string
  labelAr: string
  governorateAr: string
  isMapped: boolean
  coords: { lat: number; lng: number } | null
} {
  if (!rawArea || !rawArea.trim()) {
    return {
      normalizedId: 'unrecorded',
      labelAr: 'منطقة غير مسجلة',
      governorateAr: 'غير محدد',
      isMapped: false,
      coords: null
    }
  }

  const clean = rawArea.toLowerCase().replace(/[\u064B-\u0652]/g, '').trim()

  for (const region of EGYPT_AREAS_COORDINATES) {
    if (clean.includes(region.nameAr.toLowerCase())) {
      return {
        normalizedId: region.id,
        labelAr: region.nameAr,
        governorateAr: region.governorateAr,
        isMapped: true,
        coords: { lat: region.lat, lng: region.lng }
      }
    }
    for (const kw of region.keywords) {
      if (clean.includes(kw.toLowerCase())) {
        return {
          normalizedId: region.id,
          labelAr: region.nameAr,
          governorateAr: region.governorateAr,
          isMapped: true,
          coords: { lat: region.lat, lng: region.lng }
        }
      }
    }
  }

  // Known string but outside primary geocoded points
  return {
    normalizedId: 'unmapped',
    labelAr: rawArea.trim(),
    governorateAr: 'غير محدد على الخريطة',
    isMapped: false,
    coords: null
  }
}

// ============================================================================
// 3. AGE DISTRIBUTION & PEDIATRICS
// ============================================================================

export interface AgeCategory {
  id: string
  labelAr: string
  labelEn: string
  range: string
  count: number
  percentage: number
  color: string
}

export interface AgeAnalysisResult {
  meanAge: number | null
  medianAge: number | null
  validAgeCount: number
  missingAgeCount: number
  missingAgePercentage: number
  invalidAgeCount: number
  pediatricInfantsCount: number // < 1 year
  categories: AgeCategory[]
}

/**
 * Calculates patient age at a specific visit date from either DOB or recorded age.
 */
export function resolvePatientAgeAtDate(
  patient: { age?: any; dob?: string | null },
  visitDate: string
): { ageYears: number | null; isInfantMonths: boolean; isValid: boolean } {
  if (patient.dob) {
    const dobDate = new Date(patient.dob)
    const vDate = new Date(visitDate)
    if (!isNaN(dobDate.getTime()) && !isNaN(vDate.getTime())) {
      let years = vDate.getFullYear() - dobDate.getFullYear()
      const mDiff = vDate.getMonth() - dobDate.getMonth()
      if (mDiff < 0 || (mDiff === 0 && vDate.getDate() < dobDate.getDate())) {
        years--
      }
      if (years >= 0 && years <= 125) {
        return {
          ageYears: years,
          isInfantMonths: years === 0,
          isValid: true
        }
      }
    }
  }

  if (patient.age !== undefined && patient.age !== null && patient.age !== '') {
    const str = String(patient.age).trim().toLowerCase()
    // Support infants in months like "6 شهور" or "شهرين" or "3m"
    if (str.includes('شهر') || str.includes('شهور') || str.includes('أشهر') || str.includes('اشهر') || str.includes('month') || str.endsWith('m')) {
      let months = parseInt(str.replace(/[^0-9]/g, ''), 10)
      if (isNaN(months)) {
        if (str.includes('شهرين')) months = 2
        else if (str.includes('شهر')) months = 1
      }
      if (!isNaN(months) && months >= 0) {
        return { ageYears: Math.round((months / 12) * 10) / 10, isInfantMonths: true, isValid: true }
      }
    }

    const num = parseInt(str.replace(/[^0-9]/g, ''), 10)
    if (!isNaN(num)) {
      if (num >= 0 && num <= 125) {
        return { ageYears: num, isInfantMonths: num === 0, isValid: true }
      }
      return { ageYears: null, isInfantMonths: false, isValid: false }
    }
  }

  return { ageYears: null, isInfantMonths: false, isValid: false }
}

/**
 * Computes non-overlapping age distribution for distinct patients in period
 */
export function computeAgeDistribution(
  uniquePatients: Array<{ id: string; age?: any; dob?: string | null; firstVisitDate: string }>
): AgeAnalysisResult {
  const categoriesDefinition: Array<Omit<AgeCategory, 'count' | 'percentage'>> = [
    { id: 'pediatric', labelAr: 'أطفال ومراهقون (< 18 سنة)', labelEn: 'Children & Adolescents (< 18)', range: '0-17', color: '#00F0FF' },
    { id: 'youth', labelAr: 'شباب (18 - 29 سنة)', labelEn: 'Youth (18 - 29)', range: '18-29', color: '#087CF4' },
    { id: 'adults', labelAr: 'بالغون (30 - 49 سنة)', labelEn: 'Adults (30 - 49)', range: '30-49', color: '#8B5CF6' },
    { id: 'middle', labelAr: 'متوسطو العمر (50 - 64 سنة)', labelEn: 'Middle Aged (50 - 64)', range: '50-64', color: '#F59E0B' },
    { id: 'seniors', labelAr: 'كبار السن (65+ سنة)', labelEn: 'Seniors (65+)', range: '65+', color: '#10B981' }
  ]

  const counts: Record<string, number> = {
    pediatric: 0,
    youth: 0,
    adults: 0,
    middle: 0,
    seniors: 0
  }

  const validAges: number[] = []
  let missingCount = 0
  let invalidCount = 0
  let infantCount = 0

  for (const p of uniquePatients) {
    const { ageYears, isInfantMonths, isValid } = resolvePatientAgeAtDate(p, p.firstVisitDate)

    if (ageYears === null) {
      if (p.age !== undefined && p.age !== null && String(p.age).trim() !== '' && !isValid) {
        invalidCount++
      } else {
        missingCount++
      }
      continue
    }

    validAges.push(ageYears)
    if (isInfantMonths) infantCount++

    if (ageYears < 18) {
      counts.pediatric++
    } else if (ageYears <= 29) {
      counts.youth++
    } else if (ageYears <= 49) {
      counts.adults++
    } else if (ageYears <= 64) {
      counts.middle++
    } else {
      counts.seniors++
    }
  }

  const validCount = validAges.length
  const total = uniquePatients.length

  // Mean
  const meanAge = validCount > 0
    ? Math.round((validAges.reduce((sum, a) => sum + a, 0) / validCount) * 10) / 10
    : null

  // Median
  let medianAge: number | null = null
  if (validCount > 0) {
    const sorted = [...validAges].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    medianAge = sorted.length % 2 !== 0
      ? sorted[mid]
      : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10
  }

  const categories: AgeCategory[] = categoriesDefinition.map(c => {
    const cnt = counts[c.id] || 0
    const pct = validCount > 0 ? Math.round((cnt / validCount) * 1000) / 10 : 0
    return {
      ...c,
      count: cnt,
      percentage: pct
    }
  })

  return {
    meanAge,
    medianAge,
    validAgeCount: validCount,
    missingAgeCount: missingCount,
    missingAgePercentage: total > 0 ? Math.round((missingCount / total) * 1000) / 10 : 0,
    invalidAgeCount: invalidCount,
    pediatricInfantsCount: infantCount,
    categories
  }
}

// ============================================================================
// 4. DIAGNOSIS TRENDS & STANDARDIZATION
// ============================================================================

export interface DiagnosisItem {
  name: string
  normalizedKey: string
  patientCount: number
  percentage: number
  isConfirmed: boolean
  isUnclassified: boolean
}

/**
 * Standardizes common diagnostic synonyms in Arabic/English
 */
export function normalizeDiagnosis(raw?: string | null): { name: string; key: string; isUnclassified: boolean } {
  if (!raw || !raw.trim()) {
    return { name: 'غير مصنف / استشارة عامة', key: 'unclassified', isUnclassified: true }
  }

  const trimmed = raw.trim()
  const lower = trimmed.toLowerCase()

  // Hypertension
  if (lower.includes('hypertension') || lower.includes('ضغط دم') || lower.includes('ارتفاع ضغط')) {
    return { name: 'ارتفاع ضغط الدم (Hypertension)', key: 'hypertension', isUnclassified: false }
  }
  // Type 2 Diabetes
  if (lower.includes('diabetes') || lower.includes('سكر') || lower.includes('سكري')) {
    return { name: 'داء السكري (Diabetes Mellitus)', key: 'diabetes', isUnclassified: false }
  }
  // Upper Respiratory Tract Infection
  if (lower.includes('urti') || lower.includes('respiratory') || lower.includes('التهاب الحلق') || lower.includes('نزلة برد') || lower.includes('انفلونزا') || lower.includes('إنفلونزا')) {
    return { name: 'التهاب الجهاز التنفسي العلوي (URTI)', key: 'urti', isUnclassified: false }
  }
  // Gastritis / GERD
  if (lower.includes('gastritis') || lower.includes('gerd') || lower.includes('معدة') || lower.includes('ارتجاع')) {
    return { name: 'التهاب المعدة وارتجاع المريء (GERD / Gastritis)', key: 'gerd', isUnclassified: false }
  }
  // Bronchial Asthma
  if (lower.includes('asthma') || lower.includes('ربو') || lower.includes('حساسية صدر')) {
    return { name: 'الربو الشعبي وحساسية الصدر (Asthma)', key: 'asthma', isUnclassified: false }
  }
  // Osteoarthritis
  if (lower.includes('osteoarthritis') || lower.includes('خشونة') || lower.includes('مفاصل')) {
    return { name: 'خشونة والتهاب المفاصل (Osteoarthritis)', key: 'osteoarthritis', isUnclassified: false }
  }

  return { name: trimmed, key: lower, isUnclassified: false }
}

// ============================================================================
// 5. ATTENDANCE & NO-SHOW METRICS
// ============================================================================

export interface AttendanceMetrics {
  totalResolved: number
  totalUndecided: number
  completedCount: number
  cancelledCount: number
  noShowCount: number
  skippedCount: number
  attendanceRate: number // completed / totalResolved
  cancellationRate: number
  noShowRate: number
}

export function computeAttendanceMetrics(appointments: Array<{ status?: string; date?: string }>): AttendanceMetrics {
  let completed = 0
  let cancelled = 0
  let noShow = 0
  let skipped = 0
  let undecided = 0

  for (const a of appointments) {
    const st = a.status || 'waiting'
    if (st === 'completed') {
      completed++
    } else if (st === 'cancelled') {
      cancelled++
    } else if (st === 'no_show') {
      noShow++
    } else if (st === 'skipped') {
      skipped++
    } else {
      // Waiting or in progress = undecided / future
      undecided++
    }
  }

  const resolved = completed + cancelled + noShow + skipped

  return {
    totalResolved: resolved,
    totalUndecided: undecided,
    completedCount: completed,
    cancelledCount: cancelled,
    noShowCount: noShow,
    skippedCount: skipped,
    attendanceRate: resolved > 0 ? Math.round((completed / resolved) * 1000) / 10 : 0,
    cancellationRate: resolved > 0 ? Math.round((cancelled / resolved) * 1000) / 10 : 0,
    noShowRate: resolved > 0 ? Math.round((noShow / resolved) * 1000) / 10 : 0
  }
}

// ============================================================================
// 6. WAITING & CONSULTATION TIMING METRICS
// ============================================================================

export interface TimingMetrics {
  validWaitingCount: number
  meanWaitingMinutes: number | null
  medianWaitingMinutes: number | null
  validConsultationCount: number
  meanConsultationMinutes: number | null
  medianConsultationMinutes: number | null
  excludedWaitingOutliersCount: number
  excludedConsultationOutliersCount: number
}

export function computeTimingMetrics(
  visits: Array<{
    arrivedAt?: string | null
    createdAt?: string | null
    startedAt?: string | null
    completedAt?: string | null
    durationMinutes?: number | null
  }>
): TimingMetrics {
  const waitingMins: number[] = []
  const consultationMins: number[] = []
  let excludedWaiting = 0
  let excludedConsultation = 0

  for (const v of visits) {
    // Waiting Time: Arrival/Created to Started
    const checkInStr = v.arrivedAt || v.createdAt
    if (checkInStr && v.startedAt) {
      const startMs = new Date(v.startedAt).getTime()
      const inMs = new Date(checkInStr).getTime()
      if (!isNaN(startMs) && !isNaN(inMs)) {
        const diffMins = Math.round((startMs - inMs) / 60000)
        // Valid waiting: 0 to 480 mins (8 hours max realistic wait)
        if (diffMins >= 0 && diffMins <= 480) {
          waitingMins.push(diffMins)
        } else {
          excludedWaiting++
        }
      }
    }

    // Consultation Time: Started to Completed
    if (v.durationMinutes && v.durationMinutes > 0 && v.durationMinutes <= 240) {
      consultationMins.push(v.durationMinutes)
    } else if (v.startedAt && v.completedAt) {
      const startMs = new Date(v.startedAt).getTime()
      const endMs = new Date(v.completedAt).getTime()
      if (!isNaN(startMs) && !isNaN(endMs)) {
        const diffMins = Math.round((endMs - startMs) / 60000)
        // Valid consultation: 1 to 240 mins
        if (diffMins >= 1 && diffMins <= 240) {
          consultationMins.push(diffMins)
        } else {
          excludedConsultation++
        }
      }
    }
  }

  const calcMean = (arr: number[]) =>
    arr.length > 0 ? Math.round((arr.reduce((s, x) => s + x, 0) / arr.length) * 10) / 10 : null

  const calcMedian = (arr: number[]) => {
    if (arr.length === 0) return null
    const s = [...arr].sort((a, b) => a - b)
    const m = Math.floor(s.length / 2)
    return s.length % 2 !== 0 ? s[m] : Math.round(((s[m - 1] + s[m]) / 2) * 10) / 10
  }

  return {
    validWaitingCount: waitingMins.length,
    meanWaitingMinutes: calcMean(waitingMins),
    medianWaitingMinutes: calcMedian(waitingMins),
    validConsultationCount: consultationMins.length,
    meanConsultationMinutes: calcMean(consultationMins),
    medianConsultationMinutes: calcMedian(consultationMins),
    excludedWaitingOutliersCount: excludedWaiting,
    excludedConsultationOutliersCount: excludedConsultation
  }
}

// ============================================================================
// 7. PEAK TIMES HEATMAP
// ============================================================================

export interface HeatmapCell {
  dayIndex: number // 0 = Sat, 1 = Sun, ..., 6 = Fri
  dayLabelAr: string
  dayLabelEn: string
  hour: number // 9 to 22
  hourLabelAr: string
  count: number
  intensity: number // 0 to 1
}

export function computePeakTimesHeatmap(
  appointments: Array<{
    date?: string
    createdAt?: string
    startedAt?: string
    status?: string
  }>,
  mode: 'booked' | 'actual' = 'booked'
): { cells: HeatmapCell[]; maxDensity: number; peakCell: HeatmapCell | null } {
  const days = [
    { ar: 'السبت', en: 'Saturday' },
    { ar: 'الأحد', en: 'Sunday' },
    { ar: 'الاثنين', en: 'Monday' },
    { ar: 'الثلاثاء', en: 'Tuesday' },
    { ar: 'الأربعاء', en: 'Wednesday' },
    { ar: 'الخميس', en: 'Thursday' },
    { ar: 'الجمعة', en: 'Friday' }
  ]

  // Map JS getDay() [0=Sun..6=Sat] to Saturday-first index [0=Sat, 1=Sun, ..., 6=Fri]
  const jsDayToSatIndex = (jsDay: number) => (jsDay === 6 ? 0 : jsDay + 1)

  // Hours range: 9 AM to 10 PM (9 to 22)
  const grid: Record<string, number> = {}
  for (let d = 0; d < 7; d++) {
    for (let h = 9; h <= 22; h++) {
      grid[`${d}-${h}`] = 0
    }
  }

  for (const a of appointments) {
    if (mode === 'actual' && a.status !== 'completed' && a.status !== 'in_progress') {
      continue
    }

    const timestampStr = mode === 'actual' ? (a.startedAt || a.createdAt) : (a.createdAt || a.date)
    if (!timestampStr) continue

    const dObj = new Date(timestampStr)
    if (isNaN(dObj.getTime())) continue

    const satDayIdx = jsDayToSatIndex(dObj.getDay())
    const hour = dObj.getHours()

    if (hour >= 9 && hour <= 22) {
      grid[`${satDayIdx}-${hour}`] = (grid[`${satDayIdx}-${hour}`] || 0) + 1
    }
  }

  let maxCount = 0
  for (const val of Object.values(grid)) {
    if (val > maxCount) maxCount = val
  }

  const cells: HeatmapCell[] = []
  let peakCell: HeatmapCell | null = null

  for (let d = 0; d < 7; d++) {
    for (let h = 9; h <= 22; h++) {
      const count = grid[`${d}-${h}`] || 0
      const isPm = h >= 12
      const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
      const hourLabelAr = `${hour12}:00 ${isPm ? 'م' : 'ص'}`

      const cell: HeatmapCell = {
        dayIndex: d,
        dayLabelAr: days[d].ar,
        dayLabelEn: days[d].en,
        hour: h,
        hourLabelAr,
        count,
        intensity: maxCount > 0 ? count / maxCount : 0
      }
      cells.push(cell)

      if (!peakCell || count > peakCell.count) {
        peakCell = cell
      }
    }
  }

  return { cells, maxDensity: maxCount, peakCell: maxCount > 0 ? peakCell : null }
}

// ============================================================================
// 8. DATA COMPLETENESS AUDIT
// ============================================================================

export interface DataCompletenessReport {
  overallPercentage: number
  agePercentage: number
  regionPercentage: number
  diagnosisPercentage: number
  timingPercentage: number
  paymentPercentage: number
  incompletePatientsCount: number
  incompleteVisitsCount: number
}

export function computeDataCompleteness(
  uniquePatients: Array<{ id: string; name?: string; age?: any; dob?: string | null; address?: string; city?: string }>,
  completedVisits: Array<{ id: string; diagnosis?: string; startedAt?: string; completedAt?: string; paymentStatus?: string; paymentMethod?: string }>
): DataCompletenessReport {
  // 1. Patient Demographics Completeness
  let validAgeCount = 0
  let validRegionCount = 0

  for (const p of uniquePatients) {
    if (p.dob || (p.age !== undefined && p.age !== null && String(p.age).trim() !== '')) {
      validAgeCount++
    }
    const region = p.city || p.address
    if (region && region.trim().length > 2) {
      validRegionCount++
    }
  }

  const pTotal = Math.max(1, uniquePatients.length)
  const agePct = Math.round((validAgeCount / pTotal) * 100)
  const regionPct = Math.round((validRegionCount / pTotal) * 100)

  // 2. Visits Completeness
  let validDiagnosisCount = 0
  let validTimingCount = 0
  let validPaymentCount = 0

  for (const v of completedVisits) {
    if (v.diagnosis && v.diagnosis.trim().length > 1) {
      validDiagnosisCount++
    }
    if (v.startedAt && v.completedAt) {
      validTimingCount++
    }
    if (v.paymentStatus && v.paymentMethod) {
      validPaymentCount++
    }
  }

  const vTotal = Math.max(1, completedVisits.length)
  const diagPct = Math.round((validDiagnosisCount / vTotal) * 100)
  const timePct = Math.round((validTimingCount / vTotal) * 100)
  const payPct = Math.round((validPaymentCount / vTotal) * 100)

  const overall = Math.round((agePct + regionPct + diagPct + timePct + payPct) / 5)

  return {
    overallPercentage: overall,
    agePercentage: agePct,
    regionPercentage: regionPct,
    diagnosisPercentage: diagPct,
    timingPercentage: timePct,
    paymentPercentage: payPct,
    incompletePatientsCount: uniquePatients.length - Math.min(validAgeCount, validRegionCount),
    incompleteVisitsCount: completedVisits.length - Math.min(validDiagnosisCount, validTimingCount, validPaymentCount)
  }
}
