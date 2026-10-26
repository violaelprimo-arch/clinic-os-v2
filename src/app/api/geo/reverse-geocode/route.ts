import { NextRequest, NextResponse } from 'next/server'
import {
  matchCoordinatesToEgyptArea,
  EGYPT_GOVERNORATES,
  GovernorateItem,
  CityItem,
  AreaItem
} from '@/data/egyptGeographicData'

/**
 * Privacy-preserving reverse geocoding API route.
 * Accepts ONLY latitude and longitude numbers.
 * STRICTLY rejects any patient PII (name, phone, patientId, diagnosis).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { lat, lng } = body

    if (
      typeof lat !== 'number' ||
      typeof lng !== 'number' ||
      isNaN(lat) ||
      isNaN(lng)
    ) {
      return NextResponse.json(
        { success: false, message: 'Invalid coordinates provided' },
        { status: 400 }
      )
    }

    // Egypt geographic boundary filter
    // Latitude roughly 21.5°N - 32.5°N, Longitude roughly 24.5°E - 37.0°E
    if (lat < 21.0 || lat > 32.8 || lng < 24.0 || lng > 37.2) {
      return NextResponse.json({
        success: false,
        error: 'OUT_OF_BOUNDS',
        message: 'الموقع الحالي خارج نطاق جمهورية مصر العربية. يرجى اختيار منطقة السكن يدويًا من القوائم.'
      })
    }

    // Attempt Reverse Geocoding with standard timeout
    let externalAddress: any = null
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 2500) // 2.5s timeout

      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=ar`,
        {
          headers: {
            'User-Agent': 'YallaClinic-ClinicOS/2.0 (clinic-os@yalla-clinic.com)'
          },
          signal: controller.signal
        }
      )
      clearTimeout(timeoutId)
      if (res.ok) {
        const data = await res.json()
        externalAddress = data.address
      }
    } catch {
      // Gracefully fall back to local centroid distance matching
    }

    // Try to match based on external address fields if available
    let matchedFromAddress: {
      governorate: GovernorateItem
      city: CityItem
      area: AreaItem
    } | null = null

    if (externalAddress) {
      const state = (externalAddress.state || externalAddress.province || '').toLowerCase()
      const cityOrCounty = (
        externalAddress.city ||
        externalAddress.county ||
        externalAddress.town ||
        ''
      ).toLowerCase()
      const suburbOrNeighbourhood = (
        externalAddress.suburb ||
        externalAddress.neighbourhood ||
        externalAddress.quarter ||
        ''
      ).toLowerCase()

      // Find governorate
      const gov = EGYPT_GOVERNORATES.find(
        (g) =>
          state.includes(g.nameAr) ||
          g.nameAr.includes(state) ||
          state.includes(g.nameEn.toLowerCase())
      )

      if (gov) {
        // Find matching area inside governorate
        for (const c of gov.cities) {
          for (const a of c.areas) {
            const matchesArea =
              (suburbOrNeighbourhood &&
                (suburbOrNeighbourhood.includes(a.nameAr) ||
                  a.nameAr.includes(suburbOrNeighbourhood))) ||
              (cityOrCounty &&
                (cityOrCounty.includes(a.nameAr) || a.nameAr.includes(cityOrCounty))) ||
              (a.keywords &&
                a.keywords.some(
                  (kw) =>
                    suburbOrNeighbourhood.includes(kw.toLowerCase()) ||
                    cityOrCounty.includes(kw.toLowerCase())
                ))

            if (matchesArea) {
              matchedFromAddress = { governorate: gov, city: c, area: a }
              break
            }
          }
          if (matchedFromAddress) break
        }
      }
    }

    // If external address gave a solid match, return it
    if (matchedFromAddress) {
      return NextResponse.json({
        success: true,
        source: 'nominatim_matched',
        proposal: {
          governorateId: matchedFromAddress.governorate.id,
          governorateNameAr: matchedFromAddress.governorate.nameAr,
          governorateNameEn: matchedFromAddress.governorate.nameEn,
          cityId: matchedFromAddress.city.id,
          cityNameAr: matchedFromAddress.city.nameAr,
          cityNameEn: matchedFromAddress.city.nameEn,
          areaId: matchedFromAddress.area.id,
          areaNameAr: matchedFromAddress.area.nameAr,
          areaNameEn: matchedFromAddress.area.nameEn,
          confidence: 'high'
        }
      })
    }

    // Fall back to robust geographic centroid distance matching
    const fallbackMatch = matchCoordinatesToEgyptArea(lat, lng)
    if (!fallbackMatch) {
      return NextResponse.json({
        success: false,
        error: 'UNRESOLVED',
        message: 'تعذر تحديد المنطقة المقترحة بدقة من موقعك الحالي. يرجى اختيارها يدويًا.'
      })
    }

    return NextResponse.json({
      success: true,
      source: 'centroid_distance',
      proposal: {
        governorateId: fallbackMatch.governorate.id,
        governorateNameAr: fallbackMatch.governorate.nameAr,
        governorateNameEn: fallbackMatch.governorate.nameEn,
        cityId: fallbackMatch.city.id,
        cityNameAr: fallbackMatch.city.nameAr,
        cityNameEn: fallbackMatch.city.nameEn,
        areaId: fallbackMatch.area.id,
        areaNameAr: fallbackMatch.area.nameAr,
        areaNameEn: fallbackMatch.area.nameEn,
        confidence: fallbackMatch.confidence
      }
    })
  } catch (error) {
    console.error('Reverse geocode error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal error resolving location' },
      { status: 500 }
    )
  }
}
