import { NextRequest, NextResponse } from 'next/server'
import { extractCoordsFromLink } from '@/lib/mapsHelper'

/**
 * Validates that a URL strictly belongs to legitimate Google Maps domains.
 * Prevents Server-Side Request Forgery (SSRF) against internal or malicious hosts.
 */
function isAllowedGoogleMapsUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl)
    const hostname = parsed.hostname.toLowerCase()
    
    // Allowed Google Maps hostnames
    const allowedHosts = [
      'maps.app.goo.gl',
      'goo.gl',
      'maps.google.com',
      'www.google.com',
      'google.com'
    ]

    const isMatch = allowedHosts.some(
      (h) => hostname === h || hostname.endsWith('.' + h)
    )

    if (!isMatch) return false

    // If host is google.com or www.google.com, ensure path is /maps
    if (hostname === 'google.com' || hostname === 'www.google.com') {
      return parsed.pathname.startsWith('/maps')
    }

    return true
  } catch {
    return false
  }
}

export async function GET(req: NextRequest) {
  const urlParam = req.nextUrl.searchParams.get('url')
  const addressParam = req.nextUrl.searchParams.get('address')

  if (!urlParam && !addressParam) {
    return NextResponse.json(
      { success: false, error: 'يرجى تقديم رابط خرائط جوجل أو العنوان للتحقق' },
      { status: 400 }
    )
  }

  // 1. If urlParam provided, validate against SSRF
  if (urlParam) {
    const trimmedUrl = urlParam.trim()

    // Validate the hostname before treating any URL as a real Maps source.
    // Raw coordinate pairs (without a URL) remain supported.
    if (/^https?:\/\//i.test(trimmedUrl) && !isAllowedGoogleMapsUrl(trimmedUrl)) {
      return NextResponse.json(
        { success: false, error: 'رابط الخرائط ليس من نطاق Google Maps المعتمد.' },
        { status: 400 }
      )
    }

    // First: Direct destination coordinate extraction without a network call
    const directCoords = extractCoordsFromLink(trimmedUrl)
    if (directCoords) {
      return NextResponse.json({
        success: true,
        source: 'direct_url',
        lat: directCoords.lat,
        lng: directCoords.lng,
        mapsLink: trimmedUrl
      })
    }

    // SSRF Check: strictly reject untrusted hosts
    if (!isAllowedGoogleMapsUrl(trimmedUrl)) {
      return NextResponse.json(
        {
          success: false,
          error: 'الرابط المقدم غير معتمد. يجب أن يكون رابطاً رسمياً لخرائط جوجل (maps.app.goo.gl أو google.com/maps).'
        },
        { status: 400 }
      )
    }

    // Resolve redirects one hop at a time. Never follow an arbitrary redirect
    // automatically, since it may point to an internal IP or an unrelated host.
    try {
      let nextUrl = trimmedUrl
      for (let hop = 0; hop < 5; hop++) {
        if (!isAllowedGoogleMapsUrl(nextUrl)) throw new Error('Untrusted Google Maps redirect')
        const response = await fetch(nextUrl, {
          method: 'GET',
          redirect: 'manual',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; YallaClinicLocationVerifier/1.0)',
            Accept: 'text/html'
          }
        })
        const location = response.headers.get('location')
        if (!location) {
          const direct = extractCoordsFromLink(response.url)
          if (direct) {
            return NextResponse.json({
              success: true, source: 'resolved_google_maps',
              lat: direct.lat, lng: direct.lng,
              finalUrl: response.url, mapsLink: trimmedUrl
            })
          }
          break
        }
        const target = new URL(location, nextUrl).href
        if (!isAllowedGoogleMapsUrl(target)) throw new Error('Unexpected redirect host')
        const coords = extractCoordsFromLink(target)
        if (coords) {
          return NextResponse.json({
            success: true, source: 'redirect_url',
            lat: coords.lat, lng: coords.lng,
            finalUrl: target, mapsLink: trimmedUrl
          })
        }
        nextUrl = target
      }
    } catch (e: any) {
      console.warn('Google Maps location resolution did not produce an exact pin:', e.message)
    }
  }

  // 3. Fallback: Geocode using Nominatim only with specific clean street/district query
  const rawQuery = addressParam || (urlParam && !urlParam.startsWith('http') ? urlParam : '')
  if (rawQuery && typeof rawQuery === 'string') {
    try {
      const cleanQuery = rawQuery
        .replace(/https?:\/\/[^\s]+/g, '')
        .replace(/[،,]/g, ' ')
        .trim()

      if (cleanQuery.length >= 4) {
        const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=eg&q=${encodeURIComponent(
          cleanQuery
        )}`
        const nomRes = await fetch(nomUrl, {
          headers: { 'User-Agent': 'ClinicOS/2.0 LocationResolver (support@yalla-clinic.com)' }
        })
        const data = await nomRes.json()
        if (Array.isArray(data) && data.length > 0 && data[0].lat && data[0].lon) {
          return NextResponse.json({
            success: true,
            source: 'nominatim_geocoding',
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
            displayName: data[0].display_name
          })
        }
      }
    } catch (e: any) {
      console.warn('Failed to geocode address:', e.message)
    }
  }

  return NextResponse.json(
    {
      success: false,
      message: 'تعذر استخراج الإحداثيات الدقيقة من الرابط أو العنوان المقدم. يرجى إدخال إحداثيات الفرع يدوياً أو استخدام رابط مباشر من خرائط جوجل.'
    },
    { status: 404 }
  )
}
