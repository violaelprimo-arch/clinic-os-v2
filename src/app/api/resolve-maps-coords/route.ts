import { NextRequest, NextResponse } from 'next/server'
import { extractCoordsFromLink } from '@/lib/mapsHelper'

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
    const directCoords = extractCoordsFromLink(urlParam)
    if (directCoords) {
      return NextResponse.json({
        success: true,
        source: 'direct_url',
        lat: directCoords.lat,
        lng: directCoords.lng
      })
    }

    // 2. If it's a short link (e.g. maps.app.goo.gl, goo.gl), follow redirect
    try {
      const response = await fetch(urlParam, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      })

      const finalUrl = response.url
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
