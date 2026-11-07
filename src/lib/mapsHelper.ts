/**
 * ClinicOS Maps & Location Helper
 * Accurately resolves clinic and branch coordinates, handles short links,
 * and filters out placeholder addresses so maps always show the real registered location.
 */

export interface LocationCoords {
  lat: number
  lng: number
}

export interface EffectiveLocation {
  lat: number | null
  lng: number | null
  address: string
  mapsLink: string
  directionsUrl: string
  isPreciseCoordinates: boolean
}

const PLACEHOLDER_WORDS = [
  'عندها',
  'الفرع الرئيسي',
  'مقر العيادة',
  'مقر العيادة الرئيسي',
  'العيادة',
  'فرع',
  'عنوان الفرع',
  'address',
  'main branch'
]

/**
 * Safely encodes image URLs that may contain non-ASCII/Arabic characters or spaces
 */
export function safeImageUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return ''
  const trimmed = url.trim()
  if (!trimmed) return ''
  try {
    return encodeURI(decodeURI(trimmed))
  } catch {
    return encodeURI(trimmed)
  }
}

/**
 * Sanitizes any address string by stripping out placeholder phrases like 'عندها' or '(عندها)'
 * and cleaning up stray punctuation and bullet points.
 */
export function sanitizeAddress(raw?: string | null): string {
  if (!raw) return ''
  const cleaned = raw
    .replace(/\(?\s*عندها\s*\)?/gi, '')
    .replace(/^[\s•\-\/]+|[\s•\-\/]+$/g, '')
    .trim()
  if (PLACEHOLDER_WORDS.some((p) => cleaned.toLowerCase() === p.toLowerCase())) {
    return ''
  }
  return cleaned
}

/**
 * Returns true if an address string is just a placeholder and should be ignored
 */
export function isPlaceholderAddress(address?: string | null): boolean {
  if (!address) return true
  const sanitized = sanitizeAddress(address)
  if (sanitized.length < 3) return true
  const trimmed = sanitized.toLowerCase()
  return PLACEHOLDER_WORDS.some((p) => trimmed === p.toLowerCase())
}

/**
 * Extracts coordinates from any Google Maps URL or raw coordinate string.
 * Supports standard URLs, short links destination paths, and Place embeds.
 */
export function extractCoordsFromLink(url?: string | null): LocationCoords | null {
  if (!url) return null
  const decoded = decodeURIComponent(url)

  // 1. @lat,lng format: e.g. /@30.1294522,31.2485622,17z
  const atMatch = decoded.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (atMatch) {
    const lat = parseFloat(atMatch[1])
    const lng = parseFloat(atMatch[2])
    if (isValidCoords(lat, lng)) return { lat, lng }
  }

  // 2. Protocol buffer format: !3dlat!4dlng (Google Maps Place marker)
  const protoMatch = decoded.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)
  if (protoMatch) {
    const lat = parseFloat(protoMatch[1])
    const lng = parseFloat(protoMatch[2])
    if (isValidCoords(lat, lng)) return { lat, lng }
  }

  // 3. Query param format: ?q=lat,lng or &destination=lat,lng or &ll=lat,lng or &center=lat,lng
  const qMatch = decoded.match(/[?&](?:q|query|destination|ll|center|saddr|daddr)=(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (qMatch) {
    const lat = parseFloat(qMatch[1])
    const lng = parseFloat(qMatch[2])
    if (isValidCoords(lat, lng)) return { lat, lng }
  }

  // 4. Direction path format: /dir//lat,lng or /dir/Current+Location/lat,lng
  const dirMatch = decoded.match(/\/dir\/.*?\/(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (dirMatch) {
    const lat = parseFloat(dirMatch[1])
    const lng = parseFloat(dirMatch[2])
    if (isValidCoords(lat, lng)) return { lat, lng }
  }

  // 5. Raw coordinate string: "30.1294522, 31.2485622" or "30.1294522 31.2485622"
  const rawMatch = decoded.trim().match(/^(-?\d+\.\d+)\s*[, ]\s*(-?\d+\.\d+)$/)
  if (rawMatch) {
    const lat = parseFloat(rawMatch[1])
    const lng = parseFloat(rawMatch[2])
    if (isValidCoords(lat, lng)) return { lat, lng }
  }

  return null
}

export function isValidCoords(lat: number, lng: number): boolean {
  return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

/**
 * Resolves the effective coordinates and human-readable address for a clinic/branch.
 * STRICT: Never guesses coordinates or injects Cairo defaults as real data.
 */
export function resolveEffectiveLocation(
  currentBranch?: any,
  clinic?: any
): EffectiveLocation {
  let lat: number | null = null
  let lng: number | null = null

  // Priority 1: Branch direct latitude & longitude
  if (currentBranch?.latitude !== undefined && currentBranch?.latitude !== null && currentBranch?.latitude !== '') {
    const bLat = typeof currentBranch.latitude === 'number' ? currentBranch.latitude : parseFloat(currentBranch.latitude)
    const bLng = typeof currentBranch.longitude === 'number' ? currentBranch.longitude : parseFloat(currentBranch.longitude)
    if (isValidCoords(bLat, bLng)) {
      lat = bLat
      lng = bLng
    }
  }

  // Priority 2: Extract from branch mapsLink
  if ((lat === null || lng === null) && currentBranch?.mapsLink) {
    const extracted = extractCoordsFromLink(currentBranch.mapsLink)
    if (extracted) {
      lat = extracted.lat
      lng = extracted.lng
    }
  }

  // Priority 3: Clinic direct latitude & longitude (only if this is the main branch or no branch selected)
  if ((lat === null || lng === null) && (currentBranch?.isMain || !currentBranch) && clinic?.latitude && clinic?.longitude) {
    const cLat = typeof clinic.latitude === 'number' ? clinic.latitude : parseFloat(clinic.latitude)
    const cLng = typeof clinic.longitude === 'number' ? clinic.longitude : parseFloat(clinic.longitude)
    if (isValidCoords(cLat, cLng)) {
      lat = cLat
      lng = cLng
    }
  }

  // Priority 4: Extract from clinic mapsLink (only if this is the main branch or no branch selected)
  if ((lat === null || lng === null) && (currentBranch?.isMain || !currentBranch) && clinic?.mapsLink) {
    const extracted = extractCoordsFromLink(clinic.mapsLink)
    if (extracted) {
      lat = extracted.lat
      lng = extracted.lng
    }
  }

  // Resolve best human-readable address: prioritize selected branch's verified address
  let address = ''
  const sanitizedBranchAddr = sanitizeAddress(currentBranch?.address)
  const sanitizedClinicAddr = sanitizeAddress(clinic?.clinicAddress || clinic?.address)
  const sanitizedBranchArea = sanitizeAddress(currentBranch?.area)

  if (sanitizedBranchAddr && !isPlaceholderAddress(sanitizedBranchAddr)) {
    address = sanitizedBranchAddr
  } else if (sanitizedClinicAddr && !isPlaceholderAddress(sanitizedClinicAddr)) {
    address = sanitizedClinicAddr
  } else if (sanitizedBranchArea && !isPlaceholderAddress(sanitizedBranchArea)) {
    address = sanitizedBranchArea
  } else if (currentBranch?.city || clinic?.city) {
    address = `${currentBranch?.city || clinic?.city} - مصر`
  } else {
    address = 'مقر العيادة'
  }

  address = sanitizeAddress(address) || 'مقر العيادة'

  // Build optimal verified links
  const isPrecise = lat !== null && lng !== null
  const mapsLink =
    currentBranch?.mapsLink ||
    clinic?.mapsLink ||
    (isPrecise
      ? `https://maps.google.com/?q=${lat},${lng}`
      : `https://maps.google.com/?q=${encodeURIComponent(address)}`)

  const directionsUrl = isPrecise
    ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`

  return {
    lat,
    lng,
    address,
    mapsLink,
    directionsUrl,
    isPreciseCoordinates: isPrecise
  }
}
