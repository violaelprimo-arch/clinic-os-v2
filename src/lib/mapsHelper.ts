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
  'العيادة',
  'فرع',
  'عنوان الفرع',
  'address',
  'main branch'
]

/**
 * Returns true if an address string is just a placeholder and should be ignored
 */
export function isPlaceholderAddress(address?: string | null): boolean {
  if (!address) return true
  const trimmed = address.trim().toLowerCase()
  if (trimmed.length < 3) return true
  return PLACEHOLDER_WORDS.some((p) => trimmed === p.toLowerCase())
}

/**
 * Extracts coordinates from any Google Maps URL or raw coordinate string
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

  // 2. Protocol buffer format: !3dlat!4dlng
  const protoMatch = decoded.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)
  if (protoMatch) {
    const lat = parseFloat(protoMatch[1])
    const lng = parseFloat(protoMatch[2])
    if (isValidCoords(lat, lng)) return { lat, lng }
  }

  // 3. Query param format: ?q=lat,lng or &destination=lat,lng
  const qMatch = decoded.match(/[?&](?:q|query|destination|ll|center)=(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (qMatch) {
    const lat = parseFloat(qMatch[1])
    const lng = parseFloat(qMatch[2])
    if (isValidCoords(lat, lng)) return { lat, lng }
  }

  // 4. Direction path format: /dir//lat,lng
  const dirMatch = decoded.match(/\/dir\/.*?\/(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (dirMatch) {
    const lat = parseFloat(dirMatch[1])
    const lng = parseFloat(dirMatch[2])
    if (isValidCoords(lat, lng)) return { lat, lng }
  }

  // 5. Raw coordinate string: "30.1294522, 31.2485622"
  const rawMatch = decoded.trim().match(/^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/)
  if (rawMatch) {
    const lat = parseFloat(rawMatch[1])
    const lng = parseFloat(rawMatch[2])
    if (isValidCoords(lat, lng)) return { lat, lng }
  }

  return null
}

function isValidCoords(lat: number, lng: number): boolean {
  return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

/**
 * Resolves the effective coordinates and human-readable address for a clinic/branch
 */
export function resolveEffectiveLocation(
  currentBranch?: any,
  clinic?: any
): EffectiveLocation {
  let lat: number | null = null
  let lng: number | null = null

  // Priority 1: Branch direct latitude & longitude
  if (currentBranch?.latitude && currentBranch?.longitude) {
    const bLat = parseFloat(currentBranch.latitude)
    const bLng = parseFloat(currentBranch.longitude)
    if (isValidCoords(bLat, bLng)) {
      lat = bLat
      lng = bLng
    }
  }

  // Priority 2: Clinic direct latitude & longitude
  if ((lat === null || lng === null) && clinic?.latitude && clinic?.longitude) {
    const cLat = parseFloat(clinic.latitude)
    const cLng = parseFloat(clinic.longitude)
    if (isValidCoords(cLat, cLng)) {
      lat = cLat
      lng = cLng
    }
  }

  // Priority 3: Extract from branch mapsLink
  if ((lat === null || lng === null) && currentBranch?.mapsLink) {
    const extracted = extractCoordsFromLink(currentBranch.mapsLink)
    if (extracted) {
      lat = extracted.lat
      lng = extracted.lng
    }
  }

  // Priority 4: Extract from clinic mapsLink
  if ((lat === null || lng === null) && clinic?.mapsLink) {
    const extracted = extractCoordsFromLink(clinic.mapsLink)
    if (extracted) {
      lat = extracted.lat
      lng = extracted.lng
    }
  }

  // Resolve best human-readable address
  let address = ''
  if (currentBranch?.address && !isPlaceholderAddress(currentBranch.address)) {
    address = currentBranch.address.trim()
  } else if (clinic?.clinicAddress && !isPlaceholderAddress(clinic.clinicAddress)) {
    address = clinic.clinicAddress.trim()
  } else if (currentBranch?.area && !isPlaceholderAddress(currentBranch.area)) {
    address = `${currentBranch.area}${currentBranch?.city ? ` - ${currentBranch.city}` : ''}`
  } else if (clinic?.city) {
    address = `${clinic.city} - مصر`
  } else {
    address = 'مقر العيادة الرئيسي'
  }

  // Build optimal links
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
