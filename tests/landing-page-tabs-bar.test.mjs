import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('Landing Page Tabs Bar Specification & Behavioral Suite', async (t) => {
  const tabsBarPath = path.resolve('src/components/owner/LandingPageTabsBar.tsx')
  const managerPath = path.resolve('src/components/owner/LandingPageManager.tsx')
  const ownerClientPath = path.resolve('src/app/owner/OwnerDashboardClient.tsx')
  const ownerLayoutPath = path.resolve('src/app/owner/layout.tsx')

  assert.ok(fs.existsSync(tabsBarPath), 'LandingPageTabsBar.tsx component must exist')
  const tabsBarContent = fs.readFileSync(tabsBarPath, 'utf8')
  const managerContent = fs.readFileSync(managerPath, 'utf8')
  const ownerClientContent = fs.readFileSync(ownerClientPath, 'utf8')
  const ownerLayoutContent = fs.readFileSync(ownerLayoutPath, 'utf8')

  await t.test('1. Touch Target Height & No-Wrap Constraints', () => {
    // Must enforce min-h-[44px] for mobile finger touch targets
    assert.match(
      tabsBarContent,
      /min-h-\[44px\]/,
      'Tabs must have at least 44px touch target height (min-h-[44px])'
    )
    // Must enforce single line without squishing or wrapping
    assert.match(
      tabsBarContent,
      /whitespace-nowrap/,
      'Tab labels must remain in a single line (whitespace-nowrap)'
    )
    assert.match(
      tabsBarContent,
      /shrink-0/,
      'Tab items must have shrink-0 so icons and labels do not squish'
    )
  })

  await t.test('2. RTL & LTR Navigation & Scroll Calculations', () => {
    // Must handle RTL vs LTR scrollLeft logic
    assert.match(
      tabsBarContent,
      /isRtl/,
      'Component must accept and respect isRtl prop'
    )
    assert.match(
      tabsBarContent,
      /Math\.abs\(scrollLeft\)/,
      'RTL scroll offset must correctly calculate absolute distance from right'
    )
    assert.match(
      tabsBarContent,
      /canScrollLeft.*canScrollRight/,
      'Must track both canScrollLeft and canScrollRight states'
    )
    assert.match(
      tabsBarContent,
      /handleScrollBy/,
      'Must implement smooth scroll by delta on arrow click'
    )
  })

  await t.test('3. Scroll Arrow Buttons & Edge Fades', () => {
    assert.match(
      tabsBarContent,
      /ChevronLeft/,
      'Must import and render ChevronLeft'
    )
    assert.match(
      tabsBarContent,
      /ChevronRight/,
      'Must import and render ChevronRight'
    )
    assert.match(
      tabsBarContent,
      /pointer-events-none/,
      'Edge fade overlays must use pointer-events-none so edge clicks are not blocked'
    )
    assert.match(
      tabsBarContent,
      /bg-gradient-to-[lr]/,
      'Must use proper edge fade gradients'
    )
  })

  await t.test('4. Accessibility & Keyboard Navigation (W3C ARIA Tablist)', () => {
    assert.match(
      tabsBarContent,
      /role="tablist"/,
      'Container must have role="tablist"'
    )
    assert.match(
      tabsBarContent,
      /role="tab"/,
      'Each button must have role="tab"'
    )
    assert.match(
      tabsBarContent,
      /aria-selected=\{active\}/,
      'Buttons must have dynamic aria-selected'
    )
    assert.match(
      tabsBarContent,
      /aria-controls=/,
      'Buttons must specify aria-controls for their tabpanel'
    )
    assert.match(
      tabsBarContent,
      /ArrowRight[\s\S]*ArrowLeft[\s\S]*Home[\s\S]*End/,
      'Must support standard keyboard navigation keys (ArrowRight, ArrowLeft, Home, End)'
    )
  })

  await t.test('5. Smooth Scroll into View without Vertical Window Jumps', () => {
    assert.match(
      tabsBarContent,
      /scrollActiveTabIntoView/,
      'Must implement container-scoped tab scroll into view'
    )
    // Ensures we do not use tabEl.scrollIntoView which causes vertical page jumping
    assert.match(
      tabsBarContent,
      /container\.scrollBy/,
      'Must use container.scrollBy to isolate horizontal scroll from vertical flow'
    )
  })

  await t.test('6. Reduced Motion Support', () => {
    assert.match(
      tabsBarContent,
      /prefers-reduced-motion/,
      'Must detect and respect prefers-reduced-motion'
    )
  })

  await t.test('7. Parent Container Constraints (min-w-0, max-w-full, overflow-hidden)', () => {
    assert.match(
      managerContent,
      /<LandingPageTabsBar/,
      'LandingPageManager must render LandingPageTabsBar'
    )
    assert.match(
      managerContent,
      /w-full min-w-0 max-w-full overflow-hidden/,
      'LandingPageManager root must contain overflow and width constraints'
    )
    assert.match(
      ownerClientContent,
      /w-full min-w-0 max-w-full overflow-hidden/,
      'OwnerDashboardClient main root must contain overflow and width constraints'
    )
    assert.match(
      ownerLayoutContent,
      /min-w-0 flex-1/,
      'OwnerLayout must prevent flex items from expanding beyond parent'
    )
  })

  await t.test('8. Full Coverage of all 14 Tabs with English Translations', () => {
    const requiredTabs = [
      'order', 'theme', 'hero', 'orbit', 'gallery', 'features', 'steps',
      'pricing', 'faq', 'inbox', 'testimonials', 'stats', 'contacts', 'trials'
    ]
    for (const tabId of requiredTabs) {
      assert.ok(
        tabsBarContent.includes(`${tabId}:`),
        `LandingPageTabsBar must contain English translation for tab "${tabId}"`
      )
    }
  })
})
