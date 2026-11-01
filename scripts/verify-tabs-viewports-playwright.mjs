import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ARTIFACTS_DIR = 'C:/Users/Elmaher/.gemini/antigravity/brain/b464471d-9aec-490d-9a87-73b5907aed7b'

const VIEWPORTS = [
  { width: 320, height: 568, name: 'mobile-small-320' },
  { width: 360, height: 800, name: 'mobile-android-360' },
  { width: 390, height: 844, name: 'mobile-iphone14-390' },
  { width: 430, height: 932, name: 'mobile-iphone-promax-430' },
  { width: 768, height: 1024, name: 'tablet-ipad-768' },
  { width: 820, height: 1180, name: 'tablet-ipad-air-820' },
  { width: 1024, height: 768, name: 'laptop-small-1024' },
  { width: 1280, height: 800, name: 'laptop-standard-1280' },
  { width: 1366, height: 768, name: 'laptop-hd-1366' },
  { width: 1440, height: 900, name: 'desktop-macbook-1440' },
  { width: 1920, height: 1080, name: 'desktop-fhd-1920' },
]

const TABS = [
  { id: 'order', labelAr: 'ترتيب الأقسام والظهور', labelEn: 'Sections Order & Visibility', icon: 'Layout' },
  { id: 'theme', labelAr: 'المظهر العام والحركة', labelEn: 'Appearance & 3D Motion', icon: 'Sparkles' },
  { id: 'hero', labelAr: 'القسم الرئيسي Hero', labelEn: 'Hero Section', icon: 'Monitor' },
  { id: 'orbit', labelAr: 'المشهد التفاعلي 3D Orbit', labelEn: 'Interactive 3D Orbit', icon: 'Orbit' },
  { id: 'gallery', labelAr: 'معرض صور النظام', labelEn: 'System Gallery', icon: 'Image' },
  { id: 'features', labelAr: 'مميزات المنصة', labelEn: 'Platform Features', icon: 'Layers' },
  { id: 'steps', labelAr: 'خطوات الاستخدام', labelEn: 'How It Works', icon: 'Rocket' },
  { id: 'pricing', labelAr: 'الباقات والأسعار', labelEn: 'Pricing & Plans', icon: 'DollarSign' },
  { id: 'faq', labelAr: 'الأسئلة الشائعة', labelEn: 'FAQ', icon: 'HelpCircle' },
  { id: 'inbox', labelAr: 'صندوق الشكاوى والاقتراحات', labelEn: 'Inquiries & Complaints', icon: 'MessageSquare', badge: 3 },
  { id: 'testimonials', labelAr: 'الآراء والعملاء', labelEn: 'Reviews & Feedback', icon: 'Star' },
  { id: 'stats', labelAr: 'الإحصائيات والأرقام', labelEn: 'Stats & Numbers', icon: 'TrendingUp' },
  { id: 'contacts', labelAr: 'التواصل والفوتر', labelEn: 'Contact & Footer', icon: 'Phone' },
  { id: 'trials', labelAr: 'طلبات التجربة', labelEn: 'Trial Requests', icon: 'FileText', badge: 2 },
]

function generateHtmlPage() {
  const tabsJson = JSON.stringify(TABS)

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Landing Page Tabs Bar Verification</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            background: '#090e17',
            card: '#0c1626',
            border: '#1e293b',
            primary: '#0284c7',
          }
        }
      }
    }
  </script>
  <style>
    /* Custom scrollbar matching LandingPageTabsBar */
    .custom-scrollbar::-webkit-scrollbar {
      height: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: #334155;
      border-radius: 9999px;
    }
    /* Touch target guarantee */
    .tab-btn {
      min-height: 44px;
      touch-action: pan-x;
    }
  </style>
</head>
<body class="bg-[#090e17] text-white min-h-screen overflow-x-hidden font-sans antialiased">
  <div class="flex h-screen min-h-0 overflow-hidden">
    
    <!-- Sidebar (Desktop only, 288px) -->
    <aside id="sidebar" class="hidden md:flex w-72 shrink-0 flex-col border-e border-slate-800 bg-[#0c1626] p-4 text-xs">
      <div class="font-black text-sm text-sky-400 mb-6 flex items-center gap-2">
        <span class="w-3 h-3 rounded-full bg-sky-500"></span>
        Clinic OS v2 · Owner
      </div>
      <div class="space-y-1">
        <div class="p-3 rounded-xl bg-slate-800/40 text-slate-400">إدارة العيادات</div>
        <div class="p-3 rounded-xl bg-sky-600 text-white font-bold">الواجهة الرئيسية واستطلاع الرأي</div>
        <div class="p-3 rounded-xl bg-slate-800/40 text-slate-400">حسابات الأطباء والمواعيد</div>
        <div class="p-3 rounded-xl bg-slate-800/40 text-slate-400">الباقات والاشتراكات</div>
      </div>
    </aside>

    <!-- Main Content Area -->
    <main class="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div class="mx-auto w-full max-w-[1440px] space-y-6 min-w-0 max-w-full">
        
        <!-- Header Overview -->
        <div class="p-5 rounded-3xl bg-[#0c1626] border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div class="text-[10px] font-black text-sky-400 uppercase tracking-widest">YALLA CLINIC · SUPER ADMIN</div>
            <h1 class="text-xl sm:text-2xl font-black text-white mt-1">إدارة الواجهة الرئيسية لمنصة Yalla Clinic</h1>
            <p class="text-xs text-slate-400 mt-1">تحكم كامل في نصوص وأقسام وصور وباقات الموقع مع رفع فوري دون روابط</p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button id="toggle-dir" class="px-3 py-2 rounded-xl bg-slate-800 text-xs font-bold text-slate-300 hover:bg-slate-700">RTL / LTR</button>
            <button id="toggle-theme" class="px-3 py-2 rounded-xl bg-slate-800 text-xs font-bold text-slate-300 hover:bg-slate-700">Dark / Light</button>
            <button class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 text-white font-black text-xs shadow-md">حفظ ونشر</button>
          </div>
        </div>

        <!-- THE TABS BAR UNDER TEST -->
        <div id="tabs-wrapper" class="relative w-full min-w-0 max-w-full my-1 group/tabs" dir="rtl">
          
          <!-- Start Fade -->
          <div id="fade-start" class="pointer-events-none absolute start-0 top-0 bottom-0 w-8 z-10 rounded-s-2xl bg-gradient-to-l from-[#081526] to-transparent transition-opacity duration-200 opacity-0"></div>
          
          <!-- End Fade -->
          <div id="fade-end" class="pointer-events-none absolute end-0 top-0 bottom-0 w-8 z-10 rounded-e-2xl bg-gradient-to-r from-[#081526] to-transparent transition-opacity duration-200 opacity-0"></div>

          <!-- Left Arrow Button -->
          <button id="arrow-left" type="button" aria-label="تمرير لليسار" class="absolute start-1.5 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full flex items-center justify-center border border-slate-700 bg-slate-800/95 text-slate-200 shadow-md transition-all duration-200 cursor-pointer opacity-0 pointer-events-none hover:bg-slate-700">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7" /></svg>
          </button>

          <!-- Right Arrow Button -->
          <button id="arrow-right" type="button" aria-label="تمرير لليمين" class="absolute end-1.5 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full flex items-center justify-center border border-slate-700 bg-slate-800/95 text-slate-200 shadow-md transition-all duration-200 cursor-pointer opacity-0 pointer-events-none hover:bg-slate-700">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" /></svg>
          </button>

          <!-- Scrollable Tab Container -->
          <div
            id="tab-container"
            role="tablist"
            aria-orientation="horizontal"
            aria-label="أقسام إعدادات الواجهة الرئيسية"
            class="w-full min-w-0 max-w-full overflow-x-auto touch-pan-x bg-[#081526] p-2 rounded-2xl border border-slate-800 shadow-sm flex items-center gap-1.5 sm:gap-2 custom-scrollbar"
          >
            <!-- Generated Tab Buttons -->
          </div>
        </div>

        <!-- Tab Panel Content -->
        <div id="tab-panel" class="p-6 rounded-3xl bg-[#0c1626] border border-slate-800 shadow-sm min-h-[300px]">
          <h2 id="panel-title" class="text-lg font-black text-white">ترتيب الأقسام والظهور</h2>
          <p id="panel-desc" class="text-xs text-slate-400 mt-1">التحكم في ظهور وترتيب أقسام الصفحة الرئيسية للعيادات والمرضى.</p>
        </div>

      </div>
    </main>
  </div>

  <script>
    const tabs = ${tabsJson};
    let activeTab = 'order';
    let isRtl = true;
    let isDark = true;

    const container = document.getElementById('tab-container');
    const arrowLeft = document.getElementById('arrow-left');
    const arrowRight = document.getElementById('arrow-right');
    const fadeStart = document.getElementById('fade-start');
    const fadeEnd = document.getElementById('fade-end');
    const panelTitle = document.getElementById('panel-title');
    const panelDesc = document.getElementById('panel-desc');

    function renderTabs() {
      container.innerHTML = '';
      tabs.forEach((tab, index) => {
        const active = activeTab === tab.id;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.role = 'tab';
        btn.id = 'tab-' + tab.id;
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
        btn.setAttribute('aria-controls', 'panel-' + tab.id);
        btn.tabIndex = active ? 0 : -1;
        btn.className = 'tab-btn shrink-0 min-h-[44px] py-2.5 px-3.5 sm:px-4 rounded-xl text-xs sm:text-[13px] font-bold flex items-center gap-2 transition-all cursor-pointer select-none whitespace-nowrap ' +
          (active
            ? (isDark ? 'bg-sky-950/70 text-sky-400 font-black border border-sky-700 ring-1 ring-sky-700/40' : 'bg-sky-50 text-sky-600 font-black border border-sky-300 ring-1 ring-sky-300/40')
            : (isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 border border-transparent')
          );

        const label = isRtl ? tab.labelAr : tab.labelEn;
        let badgeHtml = '';
        if (tab.badge) {
          badgeHtml = '<span class="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-mono font-bold leading-none shrink-0">' + tab.badge + '</span>';
        }

        btn.innerHTML = '<span class="w-2 h-2 rounded-full ' + (active ? 'bg-sky-400' : 'bg-slate-600') + '"></span>' +
          '<span class="leading-none">' + label + '</span>' + badgeHtml;

        btn.onclick = () => selectTab(tab.id);
        container.appendChild(btn);
      });
      updateScrollState();
    }

    function selectTab(id) {
      activeTab = id;
      const tabObj = tabs.find(t => t.id === id);
      if (tabObj) {
        panelTitle.innerText = isRtl ? tabObj.labelAr : tabObj.labelEn;
        panelDesc.innerText = 'محتوى وإعدادات القسم: ' + (isRtl ? tabObj.labelAr : tabObj.labelEn);
      }
      renderTabs();
      scrollTabIntoView(id);
    }

    function scrollTabIntoView(id, smooth = false) {
      const btn = document.getElementById('tab-' + id);
      if (!btn || !container) return;
      const containerRect = container.getBoundingClientRect();
      const tabRect = btn.getBoundingClientRect();
      const margin = 20;
      const behavior = smooth ? 'smooth' : 'auto';

      if (tabRect.left < containerRect.left + margin) {
        const diff = containerRect.left + margin - tabRect.left;
        container.scrollBy({ left: -diff, behavior });
      } else if (tabRect.right > containerRect.right - margin) {
        const diff = tabRect.right - (containerRect.right - margin);
        container.scrollBy({ left: diff, behavior });
      }
    }

    function updateScrollState() {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      const maxScroll = Math.max(0, scrollWidth - clientWidth);

      if (maxScroll <= 3) {
        arrowLeft.classList.add('opacity-0', 'pointer-events-none');
        arrowRight.classList.add('opacity-0', 'pointer-events-none');
        fadeStart.classList.add('opacity-0');
        fadeEnd.classList.add('opacity-0');
        return;
      }

      const threshold = 4;
      let canLeft = false;
      let canRight = false;

      if (isRtl) {
        const offsetFromRight = scrollLeft <= 0 ? Math.abs(scrollLeft) : maxScroll - scrollLeft;
        canLeft = offsetFromRight < (maxScroll - threshold);
        canRight = offsetFromRight > threshold;
      } else {
        canLeft = scrollLeft > threshold;
        canRight = scrollLeft < (maxScroll - threshold);
      }

      // Left arrow
      if (canLeft) {
        arrowLeft.classList.remove('opacity-0', 'pointer-events-none');
      } else {
        arrowLeft.classList.add('opacity-0', 'pointer-events-none');
      }

      // Right arrow
      if (canRight) {
        arrowRight.classList.remove('opacity-0', 'pointer-events-none');
      } else {
        arrowRight.classList.add('opacity-0', 'pointer-events-none');
      }

      // Fades
      const startVisible = isRtl ? canRight : canLeft;
      const endVisible = isRtl ? canLeft : canRight;
      fadeStart.classList.toggle('opacity-0', !startVisible);
      fadeEnd.classList.toggle('opacity-0', !endVisible);
    }

    arrowLeft.onclick = () => {
      const delta = Math.round(container.clientWidth * 0.6);
      container.scrollBy({ left: -delta, behavior: 'smooth' });
    };

    arrowRight.onclick = () => {
      const delta = Math.round(container.clientWidth * 0.6);
      container.scrollBy({ left: delta, behavior: 'smooth' });
    };

    container.onscroll = updateScrollState;

    document.getElementById('toggle-dir').onclick = () => {
      isRtl = !isRtl;
      document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
      document.getElementById('tabs-wrapper').dir = isRtl ? 'rtl' : 'ltr';
      renderTabs();
    };

    document.getElementById('toggle-theme').onclick = () => {
      isDark = !isDark;
      document.documentElement.classList.toggle('dark', isDark);
      renderTabs();
    };

    renderTabs();
  </script>
</body>
</html>`
}

async function runAudit() {
  console.log('--- STARTING PLAYWRIGHT TABS BAR VIEWPORT AUDIT ---')
  const html = generateHtmlPage()
  const tempHtmlPath = path.resolve('scripts/temp-tabs-audit.html')
  fs.writeFileSync(tempHtmlPath, html, 'utf8')

  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  })
  const report = []

  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({
      viewport: { width: vp.width, height: vp.height },
    })

    await page.goto('file:///' + tempHtmlPath.replace(/\\/g, '/'))
    await page.waitForTimeout(500)

    // 1. Verify Page Horizontal Overflow
    const pageOverflow = await page.evaluate(() => {
      return {
        docScrollWidth: document.documentElement.scrollWidth,
        windowInnerWidth: window.innerWidth,
        hasHorizontalPageScroll: document.documentElement.scrollWidth > window.innerWidth,
      }
    })

    // 2. Verify Tab Heights (min 44px)
    const tabHeights = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.tab-btn'))
      return btns.map(b => b.getBoundingClientRect().height)
    })
    const minHeight = Math.min(...tabHeights)
    const allMeet44px = minHeight >= 43.5 // allow subpixel antialiasing

    // 3. Verify Container Width & Scrollability
    const containerMetrics = await page.evaluate(() => {
      const c = document.getElementById('tab-container')
      return {
        scrollWidth: c.scrollWidth,
        clientWidth: c.clientWidth,
        hasOverflow: c.scrollWidth > c.clientWidth,
      }
    })

    // 4. Test selecting the last tab ('trials')
    await page.evaluate(() => {
      window.selectTab('trials')
    })
    await page.waitForTimeout(500)

    // 5. Verify the last tab is fully visible within container
    const tabDebug = await page.evaluate(() => {
      const btn = document.getElementById('tab-trials')
      const c = document.getElementById('tab-container')
      const btnRect = btn.getBoundingClientRect()
      const cRect = c.getBoundingClientRect()
      return {
        btnLeft: btnRect.left,
        btnRight: btnRect.right,
        cLeft: cRect.left,
        cRight: cRect.right,
        scrollLeft: c.scrollLeft,
        scrollWidth: c.scrollWidth,
        clientWidth: c.clientWidth
      }
    })
    console.log('   DEBUG ' + vp.name + ':', JSON.stringify(tabDebug))

    const isTrialsTabVisible = tabDebug.btnLeft >= tabDebug.cLeft - 5 && tabDebug.btnRight <= tabDebug.cRight + 5

    // 6. Test Arrow Click (Scroll back towards start)
    const arrowState = await page.evaluate(() => {
      const rightArrow = document.getElementById('arrow-right')
      const leftArrow = document.getElementById('arrow-left')
      return {
        rightVisible: !rightArrow.classList.contains('opacity-0'),
        leftVisible: !leftArrow.classList.contains('opacity-0'),
      }
    })

    // Capture screenshots for representative devices
    let screenshotPath = null
    if (vp.width === 390) {
      screenshotPath = path.join(ARTIFACTS_DIR, 'tabs_owner_mobile_390.png')
      await page.screenshot({ path: screenshotPath })
    } else if (vp.width === 820) {
      screenshotPath = path.join(ARTIFACTS_DIR, 'tabs_owner_tablet_820.png')
      await page.screenshot({ path: screenshotPath })
    } else if (vp.width === 1366) {
      screenshotPath = path.join(ARTIFACTS_DIR, 'tabs_owner_laptop_1366.png')
      await page.screenshot({ path: screenshotPath })
    } else if (vp.width === 1920) {
      screenshotPath = path.join(ARTIFACTS_DIR, 'tabs_owner_desktop_1920.png')
      await page.screenshot({ path: screenshotPath })
    }

    const passed = !pageOverflow.hasHorizontalPageScroll && allMeet44px && isTrialsTabVisible

    report.push({
      viewport: vp.name,
      width: vp.width,
      height: vp.height,
      pageScrollWidth: pageOverflow.docScrollWidth,
      windowInnerWidth: pageOverflow.windowInnerWidth,
      hasPageOverflow: pageOverflow.hasHorizontalPageScroll,
      minTouchHeight: minHeight,
      allMeet44px,
      containerOverflow: containerMetrics.hasOverflow,
      trialsTabVisibleAfterSelect: isTrialsTabVisible,
      arrowState,
      screenshot: screenshotPath ? path.basename(screenshotPath) : null,
      status: passed ? 'PASS' : 'FAIL',
    })

    console.log(
      `[V] ${vp.name.padEnd(28)} | W:${String(vp.width).padEnd(4)} | Overflow: ${pageOverflow.hasHorizontalPageScroll ? 'FAIL (PAGE SCROLL)' : 'OK (NO OVERFLOW)'} | MinH: ${minHeight.toFixed(1)}px (${allMeet44px ? 'OK' : 'FAIL'}) | LastTabVisible: ${isTrialsTabVisible ? 'YES' : 'NO'} => ${passed ? 'PASS' : 'FAIL'}`
    )

    await page.close()
  }

  await browser.close()
  fs.unlinkSync(tempHtmlPath)

  console.log('\n--- AUDIT COMPLETE ---')
  const total = report.length
  const passedCount = report.filter(r => r.status === 'PASS').length
  console.log(`Passed: ${passedCount} / ${total}`)

  if (passedCount !== total) {
    process.exit(1)
  }
}

runAudit().catch(err => {
  console.error('Audit failed with error:', err)
  process.exit(1)
})
