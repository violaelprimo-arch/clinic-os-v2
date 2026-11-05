/**
 * Centralized, Robust URL Builders for Yalla Clinic Tenants.
 * Ensures consistent, canonical, and leak-free URLs across:
 * - Public Doctor / Clinic Website & Booking
 * - Live Queue Tracking
 * - Protected Patient Medical Records Portal
 * - Protected Doctor / Assistant Admin Dashboard
 * - Waiting Room TV
 */

export const BASE_PLATFORM_DOMAIN = 'yalla-clinic.com'

export interface ClinicUrlOptions {
  /** If true, returns absolute https://{slug}.yalla-clinic.com URL regardless of current window */
  canonical?: boolean
  /** Optional custom domain registered for the clinic */
  customDomain?: string
  /** Subdomain / path override */
  baseUrl?: string
}

/**
 * Determines whether the current client-side browser is already running
 * directly inside the clinic's dedicated subdomain or custom domain.
 */
export function isRunningOnClinicDomain(slug: string, customDomain?: string): boolean {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname.toLowerCase()
  if (customDomain && host === customDomain.toLowerCase()) return true
  if (host === `${slug.toLowerCase()}.${BASE_PLATFORM_DOMAIN}`) return true
  if (host === `${slug.toLowerCase()}.localhost`) return true
  return false
}

/**
 * Resolves the canonical base origin for a clinic:
 * e.g. https://clinic-mvved5s8.yalla-clinic.com
 */
export function getClinicBaseOrigin(slug: string, customDomain?: string): string {
  if (customDomain && customDomain.trim()) {
    return `https://${customDomain.trim()}`
  }
  return `https://${slug}.${BASE_PLATFORM_DOMAIN}`
}

/**
 * 1. Public Doctor / Clinic Website & Booking URL.
 * The primary public landing page where patients learn about the doctor,
 * choose services, and book appointments.
 */
export function getClinicWebsiteUrl(
  slug: string,
  options: ClinicUrlOptions = {}
): string {
  if (!slug) return '/'
  
  if (options.canonical || typeof window === 'undefined') {
    return `${getClinicBaseOrigin(slug, options.customDomain)}/`
  }

  // If already on the clinic's subdomain or custom domain: root path '/'
  if (isRunningOnClinicDomain(slug, options.customDomain)) {
    return '/'
  }

  // If on platform domain (e.g. yalla-clinic.com or owner dashboard):
  // Return canonical subdomain URL so copying or opening directs to the clinic's dedicated site
  return `${getClinicBaseOrigin(slug, options.customDomain)}/`
}

/**
 * 2. Public Live Queue Tracking URL.
 * Patients open this to check their turn, tickets, and estimated wait.
 */
export function getClinicTrackUrl(
  slug: string,
  phone?: string,
  options: ClinicUrlOptions & { appointmentId?: string } = {}
): string {
  if (!slug) return '/track'

  const queryPart = phone ? `?phone=${encodeURIComponent(phone.trim().replace(/\s+/g, ''))}` : ''
  const path = options.appointmentId ? `/track/${encodeURIComponent(options.appointmentId)}` : `/track${queryPart}`

  if (options.canonical || typeof window === 'undefined') {
    return `${getClinicBaseOrigin(slug, options.customDomain)}${path}`
  }

  // If already on clinic subdomain
  if (isRunningOnClinicDomain(slug, options.customDomain)) {
    return path
  }

  // From platform domain or owner dashboard: use canonical subdomain
  return `${getClinicBaseOrigin(slug, options.customDomain)}${path}`
}

/**
 * 3. Protected Patient Medical Records Portal URL (/patient).
 * Requires authenticated patient session for viewing prescriptions, lab results, and history.
 */
export function getClinicPatientPortalUrl(
  slug: string,
  options: ClinicUrlOptions = {}
): string {
  if (!slug) return '/patient'

  if (options.canonical || typeof window === 'undefined') {
    return `${getClinicBaseOrigin(slug, options.customDomain)}/patient`
  }

  if (isRunningOnClinicDomain(slug, options.customDomain)) {
    return '/patient'
  }

  return `${getClinicBaseOrigin(slug, options.customDomain)}/patient`
}

/**
 * 4. Protected Doctor & Receptionist Admin Dashboard URL (/admin).
 */
export function getClinicAdminUrl(
  slug: string,
  options: ClinicUrlOptions = {}
): string {
  if (!slug) return '/admin'

  if (options.canonical || typeof window === 'undefined') {
    return `${getClinicBaseOrigin(slug, options.customDomain)}/admin`
  }

  if (isRunningOnClinicDomain(slug, options.customDomain)) {
    return '/admin'
  }

  return `${getClinicBaseOrigin(slug, options.customDomain)}/admin`
}

/**
 * 5. Waiting Room TV Display URL (/tv).
 */
export function getClinicTvUrl(
  slug: string,
  options: ClinicUrlOptions = {}
): string {
  if (!slug) return '/tv'

  if (options.canonical || typeof window === 'undefined') {
    return `${getClinicBaseOrigin(slug, options.customDomain)}/tv`
  }

  if (isRunningOnClinicDomain(slug, options.customDomain)) {
    return '/tv'
  }

  return `${getClinicBaseOrigin(slug, options.customDomain)}/tv`
}

/**
 * 6. Doctor / Staff Login URL (/login).
 */
export function getClinicLoginUrl(
  slug: string,
  options: ClinicUrlOptions = {}
): string {
  if (!slug) return '/login'

  if (options.canonical || typeof window === 'undefined') {
    return `${getClinicBaseOrigin(slug, options.customDomain)}/login`
  }

  if (isRunningOnClinicDomain(slug, options.customDomain)) {
    return '/login'
  }

  return `${getClinicBaseOrigin(slug, options.customDomain)}/login`
}
