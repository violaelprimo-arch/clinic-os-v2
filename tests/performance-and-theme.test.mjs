import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

test('1. Next.js config contains asset and API no-store caching headers', async () => {
  const nextConfigPath = path.resolve('D:/progect/clinic-os-v2/next.config.ts');
  const content = fs.readFileSync(nextConfigPath, 'utf8');

  assert.ok(content.includes('public, max-age=86400'), 'Brand assets have public caching');
  assert.ok(content.includes('no-store, no-cache, must-revalidate, private'), 'API medical routes strictly non-cached');
  assert.ok(content.includes('turbopack'), 'Turbopack alias maintained');
});

test('2. Layout head script eliminates FOUC with prefers-color-scheme fallback', async () => {
  const layoutPath = path.resolve('D:/progect/clinic-os-v2/src/app/layout.tsx');
  const content = fs.readFileSync(layoutPath, 'utf8');

  assert.ok(content.includes('prefers-color-scheme: dark'), 'Layout checks prefers-color-scheme in head script');
  assert.ok(content.includes('clinic_os_theme'), 'Layout checks localStorage theme');
  assert.ok(content.includes('document.documentElement.classList.add(\'dark\')'), 'Applies dark class before DOM paint');
  assert.ok(content.includes('adjustFontFallback: true'), 'Font fallback layout shift reduction enabled');
});

test('3. PremiumLanding dynamically lazy loads BookingModal and PatientLiveTurn', async () => {
  const landingPath = path.resolve('D:/progect/clinic-os-v2/src/components/clinic/PremiumLanding.tsx');
  const content = fs.readFileSync(landingPath, 'utf8');

  assert.ok(content.includes("const BookingModal = dynamic("), 'BookingModal is loaded dynamically');
  assert.ok(content.includes("const PatientLiveTurn = dynamic("), 'PatientLiveTurn is loaded dynamically');
  assert.ok(content.includes("preloadBookingModal"), 'Preload booking modal helper present');
  assert.ok(content.includes("fetchPriority=\"high\""), 'Hero image has high fetch priority for LCP');
  assert.ok(content.includes("loading=\"lazy\""), 'Branch below-the-fold images use lazy loading');
});

test('4. Branch Service provides 30s in-memory cache and invalidation', async () => {
  const branchServicePath = path.resolve('D:/progect/clinic-os-v2/src/lib/branchService.ts');
  const content = fs.readFileSync(branchServicePath, 'utf8');

  assert.ok(content.includes('branchesMemoryCache'), 'In-memory cache Map present');
  assert.ok(content.includes('invalidateBranchesCache'), 'Cache invalidation function exported');
  assert.ok(content.includes('cached.expiresAt > now'), 'Cache expiration checking present');
});

test('5. ThemeContext handles reduced-motion and system scheme changes', async () => {
  const themeContextPath = path.resolve('D:/progect/clinic-os-v2/src/context/ThemeContext.tsx');
  const content = fs.readFileSync(themeContextPath, 'utf8');

  assert.ok(content.includes('prefers-reduced-motion: reduce'), 'Checks reduced motion preference');
  assert.ok(content.includes('prefers-color-scheme: dark'), 'Listens to system theme media query');
  assert.ok(content.includes('localStorage.setItem(\'clinic_os_theme\''), 'Persists user choice to localStorage');
  assert.ok(content.includes('THEME_CHANGE'), 'Broadcasting THEME_CHANGE to iframes');
});

test('6. Global CSS defines lightweight surface transitions and eliminates heavy global selectors', async () => {
  const cssPath = path.resolve('D:/progect/clinic-os-v2/src/app/globals.css');
  const content = fs.readFileSync(cssPath, 'utf8');

  assert.ok(content.includes('background-color 150ms ease, color 150ms ease'), 'Body has targeted 150ms color transition');
  assert.ok(!content.includes('div,\ninput,\ntextarea'), 'No heavy universal div transition selectors causing lag');
  assert.ok(content.includes('prefers-reduced-motion: reduce'), 'prefers-reduced-motion override present in CSS');
  assert.ok(content.includes('--card-elevated'), 'Theme tokens include card elevation');
});

test('7. ThemeToggle is present across all core portals and workflows', async () => {
  const doctorLayoutPath = path.resolve('D:/progect/clinic-os-v2/src/app/clinic/[slug]/admin/layout.tsx');
  const ownerLayoutPath = path.resolve('D:/progect/clinic-os-v2/src/app/owner/layout.tsx');
  const patientPath = path.resolve('D:/progect/clinic-os-v2/src/app/clinic/[slug]/patient/page.tsx');
  const patientLoginPath = path.resolve('D:/progect/clinic-os-v2/src/app/clinic/[slug]/patient/login/page.tsx');
  const trackPath = path.resolve('D:/progect/clinic-os-v2/src/app/clinic/[slug]/track/page.tsx');
  const landingPath = path.resolve('D:/progect/clinic-os-v2/src/components/clinic/PremiumLanding.tsx');

  assert.ok(fs.readFileSync(doctorLayoutPath, 'utf8').includes('<ThemeToggle'), 'Doctor layout has ThemeToggle');
  assert.ok(fs.readFileSync(ownerLayoutPath, 'utf8').includes('<ThemeToggle'), 'Owner layout has ThemeToggle');
  assert.ok(fs.readFileSync(patientPath, 'utf8').includes('<ThemeToggle'), 'Patient portal has ThemeToggle');
  assert.ok(fs.readFileSync(patientLoginPath, 'utf8').includes('<ThemeToggle'), 'Patient login has ThemeToggle');
  assert.ok(fs.readFileSync(trackPath, 'utf8').includes('<ThemeToggle'), 'Track queue has ThemeToggle');
  assert.ok(fs.readFileSync(landingPath, 'utf8').includes('<ThemeToggle'), 'Landing page has ThemeToggle');
});

test('8. Settings page synchronizes theme to preview iframe via postMessage', async () => {
  const settingsPath = path.resolve('D:/progect/clinic-os-v2/src/app/clinic/[slug]/admin/settings/page.tsx');
  const clinicPagePath = path.resolve('D:/progect/clinic-os-v2/src/app/clinic/[slug]/page.tsx');

  const settingsContent = fs.readFileSync(settingsPath, 'utf8');
  const clinicContent = fs.readFileSync(clinicPagePath, 'utf8');

  assert.ok(settingsContent.includes("type: 'THEME_CHANGE'"), 'Settings posts THEME_CHANGE to iframe');
  assert.ok(clinicContent.includes("event.data?.type === 'THEME_CHANGE'"), 'Clinic page receives THEME_CHANGE');
});
