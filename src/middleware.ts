import { NextRequest, NextResponse } from 'next/server'

export const BASE_PLATFORM_DOMAINS = ['yalla-clinic.com', 'yalaa-clinic.com']

export function middleware(req: NextRequest) {
  const url = req.nextUrl
  const hostname = req.headers.get('host') || ''
  const pathname = url.pathname

  // 1. Skip internal assets, static files, and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') ||
    pathname.startsWith('/icons')
  ) {
    return NextResponse.next()
  }

  // 2. Extract subdomain
  // Matches:
  // - dr-ahmed.yalla-clinic.com -> dr-ahmed
  // - owner.yalla-clinic.com -> owner
  // - dr-ahmed.localhost:3000 -> dr-ahmed
  let subdomain: string | null = null
  const cleanHost = hostname.split(':')[0].toLowerCase()

  for (const domain of BASE_PLATFORM_DOMAINS) {
    if (cleanHost.endsWith(`.${domain}`)) {
      subdomain = cleanHost.replace(`.${domain}`, '')
      break
    }
  }

  if (!subdomain && cleanHost.endsWith('.localhost')) {
    subdomain = cleanHost.replace('.localhost', '')
  }

  // 3. Platform Owner Subdomain:
  // https://owner.yalla-clinic.com/ => /owner
  // https://admin.yalla-clinic.com/ => /owner
  if (subdomain === 'owner' || subdomain === 'admin') {
    if (pathname.startsWith('/owner')) {
      return NextResponse.next()
    }
    const targetPath = pathname === '/' ? '/owner' : `/owner${pathname}`
    const rewriteUrl = new URL(targetPath, req.url)
    return NextResponse.rewrite(rewriteUrl)
  }

  // Exclude other reserved non-tenant subdomains
  if (subdomain && ['www', 'api', 'app', 'mail', 'cname'].includes(subdomain)) {
    subdomain = null
  }

  // 4. Clinic Doctor Subdomain rewrite:
  // https://[slug].yalla-clinic.com/ => /clinic/[slug]
  // https://[slug].yalla-clinic.com/admin => /clinic/[slug]/admin
  // https://[slug].yalla-clinic.com/patient => /clinic/[slug]/patient
  // https://[slug].yalla-clinic.com/track/xyz => /clinic/[slug]/track/xyz
  // https://[slug].yalla-clinic.com/prescription/xyz => /clinic/[slug]/prescription/xyz
  if (subdomain) {
    // If the path already has /clinic/[subdomain], don't double rewrite
    if (pathname.startsWith(`/clinic/${subdomain}`)) {
      return NextResponse.next()
    }

    const targetPath = pathname === '/' ? `/clinic/${subdomain}` : `/clinic/${subdomain}${pathname}`
    const rewriteUrl = new URL(targetPath, req.url)

    const response = NextResponse.rewrite(rewriteUrl)
    response.headers.set('x-clinic-slug', subdomain)
    return response
  }

  // 5. Default: No subdomain
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
