import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/auth-crypto'

export const BASE_PLATFORM_DOMAINS = ['yalla-clinic.com', 'yalaa-clinic.com']

async function handleAdminAuth(req: NextRequest, targetClinicSlug: string, subdomain: string | null) {
  const sessionToken = req.cookies.get('clinic_session')?.value
  let isAuthorized = false

  if (sessionToken) {
    const verifyResult = await verifySessionToken(sessionToken)
    if (verifyResult.valid && verifyResult.payload) {
      const { role, slug } = verifyResult.payload
      if (role === 'owner') {
        isAuthorized = true
      } else if (role === 'doctor' || role === 'assistant') {
        if (!slug || slug === targetClinicSlug) {
          isAuthorized = true
        }
      }
    }
  }

  if (!isAuthorized) {
    const loginUrl = subdomain
      ? new URL('/login', req.url)
      : new URL(`/clinic/${targetClinicSlug}/login`, req.url)

    const response = NextResponse.redirect(loginUrl, 307)
    response.cookies.delete('clinic_session')
    return response
  }

  if (subdomain) {
    if (req.nextUrl.pathname.startsWith(`/clinic/${subdomain}`)) {
      return NextResponse.next()
    }
    const targetPath = req.nextUrl.pathname === '/' ? `/clinic/${subdomain}` : `/clinic/${subdomain}${req.nextUrl.pathname}`
    const rewriteUrl = new URL(targetPath, req.url)
    const response = NextResponse.rewrite(rewriteUrl)
    response.headers.set('x-clinic-slug', subdomain)
    return response
  }

  return NextResponse.next()
}

export function middleware(req: NextRequest) {
  const url = req.nextUrl
  const hostname = req.headers.get('host') || ''
  const pathname = url.pathname

  // 0. Immediately drop malicious vulnerability scanner probes without invoking Next.js SSR
  const lowerPath = pathname.toLowerCase()
  if (
    lowerPath.includes('wp-') ||
    lowerPath.includes('wlwmanifest') ||
    lowerPath.includes('xmlrpc') ||
    lowerPath.endsWith('.php') ||
    lowerPath.includes('service-account') ||
    lowerPath.includes('.env') ||
    lowerPath.includes('.git')
  ) {
    return new Response('Not Found', {
      status: 404,
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    })
  }

  // 1. Skip internal assets, static files, and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/landing-preview' ||
    pathname.includes('.') ||
    pathname.startsWith('/icons')
  ) {
    return NextResponse.next()
  }

  // 2. Extract subdomain
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

  // Determine effective clinic slug and admin route check (A01 - P0 Protection)
  let targetClinicSlug: string | null = null
  let isAdminRoute = false

  if (subdomain) {
    targetClinicSlug = subdomain
    if (pathname === '/admin' || pathname.startsWith('/admin/')) {
      isAdminRoute = true
    }
  }

  if (pathname.startsWith('/clinic/')) {
    const segments = pathname.split('/')
    targetClinicSlug = segments[2] || targetClinicSlug
    if (segments[3] === 'admin') {
      isAdminRoute = true
    }
  }

  // 4. SERVER-SIDE ENFORCEMENT FOR ADMIN ROUTES (A01 - P0)
  if (isAdminRoute && targetClinicSlug) {
    return handleAdminAuth(req, targetClinicSlug, subdomain)
  }

  // 5. Clinic Doctor Subdomain rewrite:
  if (subdomain) {
    if (pathname.startsWith(`/clinic/${subdomain}`)) {
      return NextResponse.next()
    }

    const targetPath = pathname === '/' ? `/clinic/${subdomain}` : `/clinic/${subdomain}${pathname}`
    const rewriteUrl = new URL(targetPath, req.url)

    const response = NextResponse.rewrite(rewriteUrl)
    response.headers.set('x-clinic-slug', subdomain)
    return response
  }

  // 6. Default: No subdomain
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
