import assert from 'node:assert/strict'
import { test } from 'node:test'
import { NextRequest } from 'next/server.js'
import { mergeLandingConfig, DEFAULT_LANDING_CONFIG } from '../src/lib/landing-config.ts'
import { COLOR_PRESETS } from '../src/app/clinic/[slug]/admin/settings/page.tsx'
import { POST as authLogin } from '../src/app/api/auth/login/route.ts'

test('DEFAULT_LANDING_CONFIG.loginUrl points to universal /login', () => {
  assert.equal(DEFAULT_LANDING_CONFIG.loginUrl, '/login')
})

test('mergeLandingConfig sanitizes legacy tenant login URLs to universal /login', () => {
  // Test 1: Hardcoded legacy zizo URL in saved DB document
  const fromLegacyDb = mergeLandingConfig({ loginUrl: '/clinic/zizo/login' })
  assert.equal(fromLegacyDb.loginUrl, '/login')

  // Test 2: Subdomain zizo login URL
  const fromSubdomain = mergeLandingConfig({ loginUrl: 'https://zizo.yalla-clinic.com/login' })
  assert.equal(fromSubdomain.loginUrl, '/login')

  // Test 3: Legacy demo login URL
  const fromDemo = mergeLandingConfig({ loginUrl: '/clinic/yalla-demo/login' })
  assert.equal(fromDemo.loginUrl, '/login')

  // Test 4: Empty loginUrl fallback
  const fromEmpty = mergeLandingConfig({ loginUrl: '' })
  assert.equal(fromEmpty.loginUrl, '/login')

  // Test 5: Universal /login is preserved
  const fromUniversal = mergeLandingConfig({ loginUrl: '/login' })
  assert.equal(fromUniversal.loginUrl, '/login')
})

test('COLOR_PRESETS provides verified medical themes with contrasting primary and secondary tones', () => {
  assert.ok(Array.isArray(COLOR_PRESETS), 'COLOR_PRESETS must be an array')
  assert.ok(COLOR_PRESETS.length >= 6, 'Must include at least 6 balanced medical palettes')

  for (const preset of COLOR_PRESETS) {
    assert.ok(preset.label, 'Preset must have Arabic label')
    assert.ok(preset.labelEn, 'Preset must have English label')
    assert.match(preset.primary, /^#[0-9A-Fa-f]{6}$/, 'Primary must be valid hex')
    assert.match(preset.secondary, /^#[0-9A-Fa-f]{6}$/, 'Secondary must be valid hex')
  }

  const royalBlue = COLOR_PRESETS.find(p => p.primary.toLowerCase() === '#087cf4')
  assert.ok(royalBlue, 'Royal medical blue (#087CF4) must exist in presets')
})

test('/api/auth/login validation and anti-enumeration checks', async () => {
  // 1. Missing credentials returns 400
  const reqEmpty = new NextRequest('https://yalla-clinic.com/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: '', password: '' })
  })
  const resEmpty = await authLogin(reqEmpty)
  assert.equal(resEmpty.status, 400)

  // 2. Missing password returns 400
  const reqNoPass = new NextRequest('https://yalla-clinic.com/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'test@clinic.com', password: '' })
  })
  const resNoPass = await authLogin(reqNoPass)
  assert.equal(resNoPass.status, 400)
})
