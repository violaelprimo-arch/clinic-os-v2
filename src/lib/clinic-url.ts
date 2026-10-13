/**
 * Clinic URL and Subdomain Helper for yalla-clinic.com
 */

export const BASE_PLATFORM_DOMAIN = 'yalla-clinic.com'

/**
 * Returns the canonical public URL for a clinic subdomain on yalla-clinic.com.
 * E.g.:
 *   getClinicUrl('dr-ahmed') => 'https://dr-ahmed.yalla-clinic.com'
 *   getClinicUrl('dr-ahmed', '/track/xyz') => 'https://dr-ahmed.yalla-clinic.com/track/xyz'
 *   getClinicUrl('dr-ahmed', '/prescription/xyz') => 'https://dr-ahmed.yalla-clinic.com/prescription/xyz'
 */
export function getClinicUrl(slug: string, path: string = ''): string {
  if (!slug) return `https://${BASE_PLATFORM_DOMAIN}`
  
  const cleanPath = path ? (path.startsWith('/') ? path : `/${path}`) : ''

  // If in browser, inspect current environment
  if (typeof window !== 'undefined') {
    const host = window.location.host.toLowerCase()
    
    // If currently on local development
    if (host.includes('localhost')) {
      const port = window.location.port ? `:${window.location.port}` : ''
      return `${window.location.protocol}//${slug}.localhost${port}${cleanPath}`
    }

    // If currently on Cloudflare workers.dev preview
    if (host.includes('workers.dev')) {
      // In workers.dev subdomains aren't automatically wildcard-routed by default without custom zone,
      // but the shared link to patients is ALWAYS the official doctor link:
      return `https://${slug}.${BASE_PLATFORM_DOMAIN}${cleanPath}`
    }
  }

  // Canonical production URL
  return `https://${slug}.${BASE_PLATFORM_DOMAIN}${cleanPath}`
}

/**
 * Returns formatted display domain (e.g. "dr-ahmed.yalla-clinic.com")
 */
export function getClinicDisplayDomain(slug: string): string {
  if (!slug) return `اسم-الدكتور.${BASE_PLATFORM_DOMAIN}`
  return `${slug}.${BASE_PLATFORM_DOMAIN}`
}
