import assert from 'node:assert/strict'
import { test } from 'node:test'
import { extractCoordsFromLink, resolveEffectiveLocation } from '../src/lib/mapsHelper.ts'
import { NextRequest } from 'next/server.js'
import { GET as resolveMaps } from '../src/app/api/resolve-maps-coords/route.ts'

test('selected Google Maps place pin takes priority over the camera center', () => {
  const url = 'https://www.google.com/maps/place/Clinic/@30.1294,31.2485,17z/data=!4m6!3m5!1sxyz!8m2!3d30.132241!4d31.251739'
  assert.deepEqual(extractCoordsFromLink(url), { lat: 30.132241, lng: 31.251739 })
})

test('an explicitly saved place link overrides stale coordinates', () => {
  const clinic = {
    latitude: 30.1294, longitude: 31.2485,
    mapsLink: 'https://www.google.com/maps/place/Clinic/@30.1294,31.2485,17z/data=!3d30.132241!4d31.251739',
    clinicAddress: 'المكان الدقيق',
  }
  const resolved = resolveEffectiveLocation({}, clinic)
  assert.deepEqual({ lat: resolved.lat, lng: resolved.lng }, { lat: 30.132241, lng: 31.251739 })
  assert.equal(resolved.mapsLink, clinic.mapsLink)
})

test('malformed pasted links do not crash settings', () => {
  assert.equal(extractCoordsFromLink('%invalid'), null)
})

test('the maps resolver refuses arbitrary URLs to prevent server-side requests', async () => {
  const unsafe = new NextRequest('https://example.test/api/resolve-maps-coords?url=' + encodeURIComponent('http://127.0.0.1:8787/private'))
  assert.equal((await resolveMaps(unsafe)).status, 400)
})

test('a Google Maps short link resolves to the actual place pin', async () => {
  const previousFetch = globalThis.fetch
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(options.redirect, 'manual')
      if (String(url) === 'https://maps.app.goo.gl/example') {
        return new Response(null, { status: 302, headers: { location:
          'https://www.google.com/maps/place/Clinic/@30.1294,31.2485,17z/data=!3d30.132241!4d31.251739' } })
      }
      return Response.json({})
    }
    const req = new NextRequest('https://clinic.example.test/api/resolve-maps-coords?url=https%3A%2F%2Fmaps.app.goo.gl%2Fexample')
    const res = await resolveMaps(req)
    assert.equal(res.status, 200)
    const data = await res.json()
    assert.deepEqual([data.lat, data.lng], [30.132241, 31.251739])
  } finally { globalThis.fetch = previousFetch }
})
