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

    // First: Direct coordinate extraction without making any network call
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

    // 2. Safely resolve short redirect URL (e.g. maps.app.goo.gl)
    try {
      const response = await fetch(trimmedUrl, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      })

      const finalUrl = response.url
      if (finalUrl) {
        const finalCoords = extractCoordsFromLink(finalUrl)
        if (finalCoords) {
          return NextResponse.json({
            success: true,
            source: 'redirect_url',
            lat: finalCoords.lat,
            lng: finalCoords.lng,
            finalUrl,
            mapsLink: trimmedUrl
          })
        }
      }
    } catch (e: any) {
      console.warn('Failed to safely resolve redirect for maps URL:', e.message)
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
