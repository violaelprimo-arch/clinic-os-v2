import { NextRequest, NextResponse } from 'next/server'
import { extractCoordsFromLink } from '@/lib/mapsHelper'

const GOOGLE_MAPS_HOSTS = new Set([
  'maps.app.goo.gl', 'goo.gl', 'maps.google.com', 'www.google.com',
  'google.com', 'maps.google.co.uk', 'www.google.co.uk',
])

function approvedMapsUrl(raw: string): URL | null {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        !GOOGLE_MAPS_HOSTS.has(url.hostname.toLowerCase())) return null
    return url
  } catch { return null }
}

export async function GET(req: NextRequest) {
  const urlParam = req.nextUrl.searchParams.get('url')
  const addressParam = req.nextUrl.searchParams.get('address')

  if (!urlParam && !addressParam) {
    return NextResponse.json(
      { error: 'Please provide either url or address parameter' },
      { status: 400 }
    )
  }

  // 1. Try direct coordinate extraction from urlParam
  if (urlParam) {
    if (!approvedMapsUrl(urlParam)) {
      return NextResponse.json({ success: false, error: 'Only HTTPS Google Maps links are supported' }, { status: 400 })
    }
    const directCoords = extractCoordsFromLink(urlParam)
    if (directCoords) {
      return NextResponse.json({
        success: true,
        source: 'direct_url',
        lat: directCoords.lat,
        lng: directCoords.lng
      })
    }

    // 2. Follow redirects without allowing arbitrary external/localhost targets.
    try {
      let target = approvedMapsUrl(urlParam)!
      for (let i = 0; i < 6; i++) {
        const response = await fetch(target.toString(), {
          method: 'GET',
          redirect: 'manual',
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; YallaClinicMapResolver/1.0)' },
          signal: AbortSignal.timeout(5000),
        })
        const redirect = response.headers.get('location')
        if (!redirect || response.status < 300 || response.status >= 400) break
        const next = approvedMapsUrl(new URL(redirect, target).toString())
        if (!next) break
        target = next
      }
      const finalUrl = target.toString()
      const finalCoords = extractCoordsFromLink(finalUrl)
      if (finalCoords) {
        return NextResponse.json({
          success: true,
          source: 'redirect_url',
          lat: finalCoords.lat,
          lng: finalCoords.lng,
          finalUrl
        })
      }
    } catch (e: any) {
      console.warn('Failed to resolve redirect for maps URL:', e.message)
    }
  }

  // 3. Fallback: Geocode using Nominatim if addressParam or query in urlParam
  const searchQuery = addressParam || urlParam
  if (searchQuery && typeof searchQuery === 'string') {
    try {
      const cleanQuery = searchQuery
        .replace(/https?:\/\/[^\s]+/g, '')
        .trim()

      if (cleanQuery.length >= 3) {
        const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=eg&q=${encodeURIComponent(
          cleanQuery
        )}`
        const nomRes = await fetch(nomUrl, {
          headers: { 'User-Agent': 'ClinicOS/2.0 LocationResolver' }
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
    { success: false, message: 'Could not resolve exact coordinates' },
    { status: 404 }
  )
}
