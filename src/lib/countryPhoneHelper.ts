/**
 * Comprehensive Country & International Phone Formatting Helper
 * Standardizes phone numbers to E.164 and Meta WhatsApp Cloud API formats.
 */

export interface CountryInfo {
  code: string // ISO 3166-1 alpha-2 (e.g. 'EG', 'SA')
  nameAr: string // Arabic name
  nameEn: string // English name
  dialCode: string // Dial code with plus (e.g. '+20', '+966')
  flag: string // Flag emoji
  placeholder: string // Local phone placeholder
  example: string
  minLength: number // Expected min local length
  maxLength: number // Expected max local length
  priority?: number
}

export const COUNTRIES: CountryInfo[] = [
  // Arab Countries (Top Priority)
  {
    code: 'EG',
    nameAr: 'مصر',
    nameEn: 'Egypt',
    dialCode: '+20',
    flag: '🇪🇬',
    placeholder: '01012345678',
    example: '01012345678',
    minLength: 10,
    maxLength: 11,
    priority: 1
  },
  {
    code: 'SA',
    nameAr: 'المملكة العربية السعودية',
    nameEn: 'Saudi Arabia',
    dialCode: '+966',
    flag: '🇸🇦',
    placeholder: '0501234567',
    example: '0501234567',
    minLength: 9,
    maxLength: 10,
    priority: 2
  },
  {
    code: 'AE',
    nameAr: 'الإمارات العربية المتحدة',
    nameEn: 'United Arab Emirates',
    dialCode: '+971',
    flag: '🇦🇪',
    placeholder: '0501234567',
    example: '0501234567',
    minLength: 9,
    maxLength: 10,
    priority: 3
  },
  {
    code: 'KW',
    nameAr: 'الكويت',
    nameEn: 'Kuwait',
    dialCode: '+965',
    flag: '🇰🇼',
    placeholder: '91234567',
    example: '91234567',
    minLength: 8,
    maxLength: 8,
    priority: 4
  },
  {
    code: 'QA',
    nameAr: 'قطر',
    nameEn: 'Qatar',
    dialCode: '+974',
    flag: '🇶🇦',
    placeholder: '55123456',
    example: '55123456',
    minLength: 8,
    maxLength: 8,
    priority: 5
  },
  {
    code: 'OM',
    nameAr: 'سلطنة عُمان',
    nameEn: 'Oman',
    dialCode: '+968',
    flag: '🇴🇲',
    placeholder: '91234567',
    example: '91234567',
    minLength: 8,
    maxLength: 8,
    priority: 6
  },
  {
    code: 'BH',
    nameAr: 'البحرين',
    nameEn: 'Bahrain',
    dialCode: '+973',
    flag: '🇧🇭',
    placeholder: '39123456',
    example: '39123456',
    minLength: 8,
    maxLength: 8,
    priority: 7
  },
  {
    code: 'JO',
    nameAr: 'الأردن',
    nameEn: 'Jordan',
    dialCode: '+962',
    flag: '🇯🇴',
    placeholder: '0791234567',
    example: '0791234567',
    minLength: 9,
    maxLength: 10,
    priority: 8
  },
  {
    code: 'IQ',
    nameAr: 'العراق',
    nameEn: 'Iraq',
    dialCode: '+964',
    flag: '🇮🇶',
    placeholder: '07701234567',
    example: '07701234567',
    minLength: 10,
    maxLength: 11,
    priority: 9
  },
  {
    code: 'PS',
    nameAr: 'فلسطين',
    nameEn: 'Palestine',
    dialCode: '+970',
    flag: '🇵🇸',
    placeholder: '0599123456',
    example: '0599123456',
    minLength: 9,
    maxLength: 10,
    priority: 10
  },
  {
    code: 'LB',
    nameAr: 'لبنان',
    nameEn: 'Lebanon',
    dialCode: '+961',
    flag: '🇱🇧',
    placeholder: '03123456',
    example: '03123456',
    minLength: 7,
    maxLength: 8,
    priority: 11
  },
  {
    code: 'SY',
    nameAr: 'سوريا',
    nameEn: 'Syria',
    dialCode: '+963',
    flag: '🇸🇾',
    placeholder: '0933123456',
    example: '0933123456',
    minLength: 9,
    maxLength: 10,
    priority: 12
  },
  {
    code: 'YE',
    nameAr: 'اليمن',
    nameEn: 'Yemen',
    dialCode: '+967',
    flag: '🇾🇪',
    placeholder: '771234567',
    example: '771234567',
    minLength: 9,
    maxLength: 9,
    priority: 13
  },
  {
    code: 'LY',
    nameAr: 'ليبيا',
    nameEn: 'Libya',
    dialCode: '+218',
    flag: '🇱🇾',
    placeholder: '0911234567',
    example: '0911234567',
    minLength: 9,
    maxLength: 10,
    priority: 14
  },
  {
    code: 'SD',
    nameAr: 'السودان',
    nameEn: 'Sudan',
    dialCode: '+249',
    flag: '🇸🇩',
    placeholder: '0911234567',
    example: '0911234567',
    minLength: 9,
    maxLength: 10,
    priority: 15
  },
  {
    code: 'TN',
    nameAr: 'تونس',
    nameEn: 'Tunisia',
    dialCode: '+216',
    flag: '🇹🇳',
    placeholder: '20123456',
    example: '20123456',
    minLength: 8,
    maxLength: 8,
    priority: 16
  },
  {
    code: 'DZ',
    nameAr: 'الجزائر',
    nameEn: 'Algeria',
    dialCode: '+213',
    flag: '🇩🇿',
    placeholder: '0551234567',
    example: '0551234567',
    minLength: 9,
    maxLength: 10,
    priority: 17
  },
  {
    code: 'MA',
    nameAr: 'المغرب',
    nameEn: 'Morocco',
    dialCode: '+212',
    flag: '🇲🇦',
    placeholder: '0612345678',
    example: '0612345678',
    minLength: 9,
    maxLength: 10,
    priority: 18
  },

  // Popular International Countries
  {
    code: 'TR',
    nameAr: 'تركيا',
    nameEn: 'Turkey',
    dialCode: '+90',
    flag: '🇹🇷',
    placeholder: '05321234567',
    example: '05321234567',
    minLength: 10,
    maxLength: 11,
    priority: 19
  },
  {
    code: 'GB',
    nameAr: 'المملكة المتحدة',
    nameEn: 'United Kingdom',
    dialCode: '+44',
    flag: '🇬🇧',
    placeholder: '07911123456',
    example: '07911123456',
    minLength: 10,
    maxLength: 11,
    priority: 20
  },
  {
    code: 'US',
    nameAr: 'الولايات المتحدة / كندا',
    nameEn: 'United States / Canada',
    dialCode: '+1',
    flag: '🇺🇸',
    placeholder: '2025550123',
    example: '2025550123',
    minLength: 10,
    maxLength: 10,
    priority: 21
  },
  {
    code: 'DE',
    nameAr: 'ألمانيا',
    nameEn: 'Germany',
    dialCode: '+49',
    flag: '🇩🇪',
    placeholder: '015112345678',
    example: '015112345678',
    minLength: 10,
    maxLength: 11,
    priority: 22
  },
  {
    code: 'FR',
    nameAr: 'فرنسا',
    nameEn: 'France',
    dialCode: '+33',
    flag: '🇫🇷',
    placeholder: '0612345678',
    example: '0612345678',
    minLength: 9,
    maxLength: 10,
    priority: 23
  },
  {
    code: 'IT',
    nameAr: 'إيطاليا',
    nameEn: 'Italy',
    dialCode: '+39',
    flag: '🇮🇹',
    placeholder: '3201234567',
    example: '3201234567',
    minLength: 9,
    maxLength: 10,
    priority: 24
  }
]

export const DEFAULT_COUNTRY = COUNTRIES[0] // Egypt

/**
 * Replaces Arabic & Persian numerals with standard ASCII 0-9
 */
export function normalizePhoneDigits(input: string): string {
  if (!input) return ''
  let cleaned = String(input)
  const arDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']
  const faDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']
  for (let i = 0; i < 10; i++) {
    cleaned = cleaned.replace(new RegExp(arDigits[i], 'g'), String(i))
    cleaned = cleaned.replace(new RegExp(faDigits[i], 'g'), String(i))
  }
  return cleaned
}

/**
 * Finds country by its dial code or ISO code
 */
export function getCountryByDialCode(dialCode: string): CountryInfo {
  const cleanDial = dialCode.startsWith('+') ? dialCode : `+${dialCode}`
  return COUNTRIES.find((c) => c.dialCode === cleanDial) || DEFAULT_COUNTRY
}

export function getCountryByCode(code: string): CountryInfo {
  return COUNTRIES.find((c) => c.code.toUpperCase() === code.toUpperCase()) || DEFAULT_COUNTRY
}

/**
 * Detects country and local digits from any stored phone number string
 * e.g. "+966501234567" -> { country: SA, localNumber: "0501234567", fullNumber: "+966501234567" }
 * e.g. "01012345678" -> { country: EG, localNumber: "01012345678", fullNumber: "+201012345678" }
 */
export function parsePhoneAndCountry(rawPhone: string): {
  country: CountryInfo
  localNumber: string
  fullNumber: string
} {
  const normalized = normalizePhoneDigits(rawPhone).trim()
  if (!normalized) {
    return {
      country: DEFAULT_COUNTRY,
      localNumber: '',
      fullNumber: ''
    }
  }

  // Handle leading 00 -> +
  let clean = normalized
  if (clean.startsWith('00')) {
    clean = '+' + clean.substring(2)
  }

  // If starts with +, try matching dialCode from longest to shortest (e.g. +966, +971, +20, +1)
  if (clean.startsWith('+')) {
    const sortedCountries = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length)
    for (const country of sortedCountries) {
      if (clean.startsWith(country.dialCode)) {
        const withoutDial = clean.substring(country.dialCode.length)
        const shouldHaveLeadingZero = country.placeholder.startsWith('0')
        const local = shouldHaveLeadingZero && !withoutDial.startsWith('0') && withoutDial.length > 0
          ? `0${withoutDial}`
          : withoutDial
        return {
          country,
          localNumber: local,
          fullNumber: clean
        }
      }
    }
  }

  // If already starts with dial code without + (e.g. "2010..." or "96650...")
  const sortedCountries = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length)
  for (const country of sortedCountries) {
    const rawDial = country.dialCode.replace('+', '')
    if (clean.startsWith(rawDial) && clean.length > rawDial.length + 6) {
      const withoutDial = clean.substring(rawDial.length)
      const shouldHaveLeadingZero = country.placeholder.startsWith('0')
      const local = shouldHaveLeadingZero && !withoutDial.startsWith('0') && withoutDial.length > 0
        ? `0${withoutDial}`
        : withoutDial
      return {
        country,
        localNumber: local,
        fullNumber: `+${rawDial}${withoutDial}`
      }
    }
  }

  // Default to Egypt
  const withoutZero = clean.replace(/^0+/, '')
  const local = clean.startsWith('0') ? clean : (clean.length > 0 ? `0${clean}` : '')
  return {
    country: DEFAULT_COUNTRY,
    localNumber: clean,
    fullNumber: withoutZero ? `+20${withoutZero}` : ''
  }
}

/**
 * Validates phone number according to country rules.
 * Supports:
 * - Local numbers with or without leading zero (e.g. "01121320507" or "1121320507")
 * - International numbers with plus (e.g. "+201121320507")
 * - International numbers with 00 (e.g. "00201121320507")
 * - International numbers without plus (e.g. "201121320507")
 */
export function validatePhoneNumber(phone: string, country: CountryInfo = DEFAULT_COUNTRY): boolean {
  if (!phone) return false
  const normalized = normalizePhoneDigits(phone).trim()
  if (!normalized) return false

  // 1. Determine effective country and extract local digits
  let activeCountry = country || DEFAULT_COUNTRY
  let clean = normalized

  // Handle leading 00 as international +
  if (clean.startsWith('00')) {
    clean = '+' + clean.substring(2)
  }

  // If the phone explicitly starts with +, identify country by dial code
  if (clean.startsWith('+')) {
    const sortedCountries = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length)
    for (const c of sortedCountries) {
      if (clean.startsWith(c.dialCode)) {
        activeCountry = c
        clean = clean.substring(c.dialCode.length)
        break
      }
    }
  } else {
    // If it doesn't start with +, check if it starts with the active country's dial code without plus
    // e.g. "201012345678" or "966501234567"
    const dialDigits = (activeCountry.dialCode || '').replace(/[^0-9]/g, '')
    const digitsOnly = clean.replace(/[^0-9]/g, '')
    if (dialDigits && digitsOnly.startsWith(dialDigits) && digitsOnly.length > dialDigits.length + 6) {
      clean = digitsOnly.substring(dialDigits.length)
    }
  }

  // Extract clean digits of the local number
  const localDigits = clean.replace(/[^0-9]/g, '')
  if (!localDigits) return false

  // Normalize local number with leading zero for standard checks
  const localWithZero = localDigits.startsWith('0') ? localDigits : `0${localDigits}`
  const localWithoutZero = localDigits.replace(/^0+/, '')

  // Egypt validation
  if (activeCountry.code === 'EG') {
    // Local: 010, 011, 012, 015 followed by 8 digits (total 11 digits with 0, 10 without 0)
    return /^01[0125][0-9]{8}$/.test(localWithZero)
  }

  // Saudi Arabia validation
  if (activeCountry.code === 'SA') {
    // 05xxxxxxxx (10 digits with 0) or 5xxxxxxxx (9 digits)
    return /^05[0-9]{8}$/.test(localWithZero)
  }

  // UAE validation
  if (activeCountry.code === 'AE') {
    // 05xxxxxxxx (10 digits with 0) or 5xxxxxxxx (9 digits)
    return /^05[0-9]{8}$/.test(localWithZero)
  }

  // Kuwait validation
  if (activeCountry.code === 'KW') {
    // 8 digits starting with 5, 6, 9
    return /^[569][0-9]{7}$/.test(localWithoutZero)
  }

  // Qatar validation
  if (activeCountry.code === 'QA') {
    // 8 digits starting with 3, 5, 6, 7
    return /^[3567][0-9]{7}$/.test(localWithoutZero)
  }

  // Bahrain validation
  if (activeCountry.code === 'BH') {
    // 8 digits starting with 3 or 6
    return /^[36][0-9]{7}$/.test(localWithoutZero)
  }

  // Oman validation
  if (activeCountry.code === 'OM') {
    // 8 digits starting with 7 or 9
    return /^[79][0-9]{7}$/.test(localWithoutZero)
  }

  // Jordan validation
  if (activeCountry.code === 'JO') {
    // 077, 078, 079 (10 digits with 0, 9 without)
    return /^07[789][0-9]{7}$/.test(localWithZero)
  }

  // Iraq validation
  if (activeCountry.code === 'IQ') {
    // 075, 077, 078, 079 (11 digits with 0, 10 without)
    return /^07[5789][0-9]{8}$/.test(localWithZero)
  }

  // Palestine validation
  if (activeCountry.code === 'PS') {
    // 059, 056 (10 digits with 0, 9 without)
    return /^05[69][0-9]{7}$/.test(localWithZero)
  }

  // Lebanon validation
  if (activeCountry.code === 'LB') {
    // 03, 70, 71, 76, 78, 79, 81 (8 digits with 0, 7 or 8 without)
    return /^0?(3[0-9]{6}|(70|71|76|78|79|81)[0-9]{6})$/.test(localWithZero)
  }

  // Generic fallback using country min/max length if available
  const min = Math.max(6, (activeCountry.minLength || 8) - 1)
  const max = (activeCountry.maxLength || 11) + 1
  return localDigits.length >= min && localDigits.length <= max
}

/**
 * Standardizes phone number to international E.164 (+<dialCode><number>)
 * e.g. ("01012345678", "+20") -> "+201012345678"
 * e.g. ("0501234567", "+966") -> "+966501234567"
 * e.g. ("+966501234567", "+20") -> "+966501234567" (retains existing country code)
 */
export function formatToE164(phone: string, countryDialCode = '+20'): string {
  const normalized = normalizePhoneDigits(phone).trim()
  if (!normalized) return ''

  // If already starts with + or 00
  let clean = normalized
  if (clean.startsWith('00')) {
    clean = '+' + clean.substring(2)
  }

  if (clean.startsWith('+')) {
    const digits = clean.replace(/[^0-9]/g, '')
    return `+${digits}`
  }

  const dialClean = countryDialCode.startsWith('+') ? countryDialCode : `+${countryDialCode}`
  const dialDigits = dialClean.replace(/[^0-9]/g, '')

  // If starts with dial digits already
  const digitsOnly = clean.replace(/[^0-9]/g, '')
  if (digitsOnly.startsWith(dialDigits) && digitsOnly.length > dialDigits.length + 6) {
    return `+${digitsOnly}`
  }

  // Strip leading zero for international format
  const localDigits = digitsOnly.replace(/^0+/, '')
  if (!localDigits) {
    return digitsOnly ? `+${dialDigits}` : ''
  }
  return `+${dialDigits}${localDigits}`
}

/**
 * Normalizes phone number strictly for WhatsApp Click-to-Chat and Meta WhatsApp Cloud API.
 * Requirements: Digits only, NO '+' symbol, NO spaces, prefixed with country dial code.
 * e.g. "+201012345678" -> "201012345678"
 * e.g. "0501234567" with SA (+966) -> "966501234567"
 * e.g. "01012345678" with default EG -> "201012345678"
 */
export function cleanPhoneForWhatsApp(phone: string, defaultDialCode = '+20'): string {
  const normalized = normalizePhoneDigits(phone).trim()
  if (!normalized) return ''

  // If contains international indicator
  if (normalized.startsWith('+') || normalized.startsWith('00')) {
    return normalized.replace(/[^0-9]/g, '').replace(/^00/, '')
  }

  // Check if it already matches any country dial code (e.g. 96650..., 97150..., 201...)
  const sorted = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length)
  const digitsOnly = normalized.replace(/[^0-9]/g, '')

  for (const c of sorted) {
    const dialDigits = c.dialCode.replace('+', '')
    if (digitsOnly.startsWith(dialDigits) && digitsOnly.length > dialDigits.length + 6) {
      return digitsOnly
    }
  }

  // If starts with 0 and no dial code was present: strip 0 and attach defaultDialCode
  const dialDigits = defaultDialCode.replace(/[^0-9]/g, '')
  const withoutLeadingZero = digitsOnly.replace(/^0+/, '')
  return `${dialDigits}${withoutLeadingZero}`
}

/**
 * Returns all potential database search variants for a given phone number.
 * Ensures backward compatibility with legacy numbers stored as local format (010xxx),
 * international with plus (+2010xxx), without plus (2010xxx), or without leading zeros (10xxx).
 */
export function getPhoneSearchVariants(phone: string): string[] {
  const normalized = normalizePhoneDigits(phone).trim()
  if (!normalized) return []

  const parsed = parsePhoneAndCountry(normalized)
  const variants = new Set<string>()

  // 1. Raw trimmed
  variants.add(normalized)

  // 2. Full E.164 with plus e.g. +201012345678
  if (parsed.fullNumber) {
    variants.add(parsed.fullNumber)
    // 3. E.164 without plus e.g. 201012345678
    variants.add(parsed.fullNumber.replace(/^\+/, ''))
  }

  // 4. Local with leading zero e.g. 01012345678
  if (parsed.localNumber) {
    variants.add(parsed.localNumber)
    // 5. Local without leading zero e.g. 1012345678
    variants.add(parsed.localNumber.replace(/^0+/, ''))
  }

  // 6. Digits only
  const digitsOnly = normalized.replace(/[^0-9]/g, '')
  if (digitsOnly) {
    variants.add(digitsOnly)
  }

  return Array.from(variants).filter((v) => v && v.length >= 7)
}
