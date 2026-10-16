const fs = require('fs');
const path = require('path');

const targetArtifactPath = "C:\\Users\\El maher\\.gemini\\antigravity\\brain\\b464471d-9aec-490d-9a87-73b5907aed7b\\yalla_clinic_ultra_glass.html";
const targetPublicPath = "e:\\progict\\clinic-os-v2\\public\\preview.html";

const htmlContent = `<!DOCTYPE html>
<html lang="ar" dir="rtl" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Yalla Clinic OS — Ultra-Premium Glassmorphism & iOS Anti-Gravity Suite</title>
  <!-- Tailwind CSS per generative_ui standard -->
  <script src="https://www.gstatic.com/antigravity/web/dev/tailwindcss.min.js"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">

  <style>
    /* =========================================================================
       ULTRA-PREMIUM GLASSMORPHISM & COSMIC DESIGN TOKENS
       ========================================================================= */
    :root, [data-theme="dark"] {
      --bg-space: #030712;
      --bg-nebula-1: rgba(14, 165, 233, 0.14);
      --bg-nebula-2: rgba(139, 92, 246, 0.16);
      --bg-nebula-3: rgba(16, 185, 129, 0.12);

      --glass-surface: rgba(15, 23, 42, 0.65);
      --glass-surface-elevated: rgba(30, 41, 59, 0.75);
      --glass-card: rgba(255, 255, 255, 0.045);
      --glass-card-hover: rgba(255, 255, 255, 0.08);
      --glass-border: rgba(255, 255, 255, 0.12);
      --glass-border-strong: rgba(255, 255, 255, 0.22);
      --glass-specular: rgba(255, 255, 255, 0.35);

      --text-main: #F8FAFC;
      --text-muted: #94A3B8;
      --text-subtle: #64748B;

      --neon-cyan: #00F0FF;
      --neon-blue: #087CF4;
      --neon-emerald: #10B981;
      --neon-purple: #A855F7;
      --neon-amber: #F59E0B;
      --neon-rose: #F43F5E;

      --glow-cyan: 0 0 25px rgba(0, 240, 255, 0.35);
      --glow-blue: 0 0 25px rgba(8, 124, 244, 0.4);
      --glow-emerald: 0 0 25px rgba(16, 185, 129, 0.35);
    }

    [data-theme="light"] {
      --bg-space: #F0F6FC;
      --bg-nebula-1: rgba(56, 189, 248, 0.15);
      --bg-nebula-2: rgba(167, 139, 250, 0.15);
      --bg-nebula-3: rgba(52, 211, 153, 0.12);

      --glass-surface: rgba(255, 255, 255, 0.78);
      --glass-surface-elevated: rgba(255, 255, 255, 0.9);
      --glass-card: rgba(255, 255, 255, 0.65);
      --glass-card-hover: rgba(255, 255, 255, 0.85);
      --glass-border: rgba(148, 163, 184, 0.25);
      --glass-border-strong: rgba(8, 124, 244, 0.35);
      --glass-specular: rgba(255, 255, 255, 0.9);

      --text-main: #0B192C;
      --text-muted: #475569;
      --text-subtle: #94A3B8;

      --neon-cyan: #0284C7;
      --neon-blue: #087CF4;
      --neon-emerald: #059669;
      --neon-purple: #7C3AED;
      --neon-amber: #D97706;
      --neon-rose: #E11D48;

      --glow-cyan: 0 0 20px rgba(2, 132, 199, 0.25);
      --glow-blue: 0 0 20px rgba(8, 124, 244, 0.25);
      --glow-emerald: 0 0 20px rgba(5, 150, 105, 0.25);
    }

    * {
      box-sizing: border-box;
      transition: background-color 0.25s ease, border-color 0.25s ease, color 0.15s ease, box-shadow 0.25s ease;
    }

    html[dir="rtl"] body {
      font-family: 'Cairo', 'Inter', system-ui, -apple-system, sans-serif;
    }
    html[dir="ltr"] body {
      font-family: 'Inter', 'Cairo', system-ui, -apple-system, sans-serif;
    }

    body {
      background-color: var(--bg-space);
      color: var(--text-main);
      margin: 0;
      padding: 0;
      overflow-x: hidden;
      min-height: 100vh;
      position: relative;
    }

    /* Ambient Nebulas */
    .nebula-glow {
      position: fixed;
      border-radius: 9999px;
      pointer-events: none;
      filter: blur(110px);
      z-index: 0;
      opacity: 0.7;
      animation: nebulaPulse 12s ease-in-out infinite alternate;
    }
    @keyframes nebulaPulse {
      0% { transform: scale(1) translate(0, 0); opacity: 0.55; }
      50% { transform: scale(1.15) translate(20px, -15px); opacity: 0.8; }
      100% { transform: scale(1.05) translate(-15px, 25px); opacity: 0.65; }
    }

    /* Cosmic Anti-Gravity Canvas */
    #antiGravityCanvas {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 1;
    }

    /* =========================================================================
       GLASSMORPHISM CLASSES (FROSTED GLASS + SPECULAR HIGHLIGHTS)
       ========================================================================= */
    .glass-panel {
      background: var(--glass-card);
      backdrop-filter: blur(28px) saturate(190%);
      -webkit-backdrop-filter: blur(28px) saturate(190%);
      border: 1px solid var(--glass-border);
      border-radius: 24px;
      box-shadow: 0 16px 40px -10px rgba(0, 0, 0, 0.45), inset 0 1px 1px 0 var(--glass-specular);
      position: relative;
      overflow: hidden;
    }
    .glass-panel::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--glass-specular), transparent);
      opacity: 0.6;
      pointer-events: none;
    }
    .glass-panel:hover {
      border-color: var(--glass-border-strong);
      box-shadow: 0 24px 50px -10px rgba(0, 0, 0, 0.55), 0 0 25px rgba(0, 240, 255, 0.12), inset 0 1px 1px 0 var(--glass-specular);
    }

    .glass-panel-elevated {
      background: var(--glass-surface-elevated);
      backdrop-filter: blur(34px) saturate(200%);
      -webkit-backdrop-filter: blur(34px) saturate(200%);
      border: 1px solid var(--glass-border-strong);
      border-radius: 26px;
      box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.65), inset 0 1px 1px 0 var(--glass-specular);
    }

    /* Anti-Gravity Floating Suspensions */
    .float-suspension-1 {
      animation: floatSmooth 6s ease-in-out infinite;
    }
    .float-suspension-2 {
      animation: floatSmooth 7s ease-in-out 1.5s infinite;
    }
    .float-suspension-3 {
      animation: floatSmooth 8s ease-in-out 3s infinite;
    }
    @keyframes floatSmooth {
      0%, 100% { transform: translateY(0px) rotate(0deg); }
      50% { transform: translateY(-7px) rotate(0.25deg); }
    }

    /* iOS Squircle & Interactive Buttons */
    .ios-btn-primary {
      background: linear-gradient(135deg, #087CF4 0%, #00F0FF 100%);
      color: #FFFFFF;
      font-weight: 700;
      border: 1px solid rgba(255, 255, 255, 0.35);
      border-radius: 16px;
      box-shadow: 0 6px 20px rgba(8, 124, 244, 0.45), inset 0 1px 1px rgba(255, 255, 255, 0.6);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }
    .ios-btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 28px rgba(0, 240, 255, 0.55), inset 0 1px 1px rgba(255, 255, 255, 0.8);
      filter: brightness(1.08);
    }
    .ios-btn-primary:active {
      transform: scale(0.96);
    }

    .ios-btn-glass {
      background: rgba(255, 255, 255, 0.07);
      backdrop-filter: blur(16px);
      color: var(--text-main);
      font-weight: 600;
      border: 1px solid var(--glass-border);
      border-radius: 14px;
      box-shadow: inset 0 1px 0 var(--glass-specular);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }
    .ios-btn-glass:hover {
      background: rgba(255, 255, 255, 0.12);
      border-color: var(--neon-cyan);
      color: var(--neon-cyan);
      transform: translateY(-1px);
    }
    .ios-btn-glass:active {
      transform: scale(0.97);
    }

    /* iOS Segmented Pill Switcher */
    .ios-pill-active {
      background: linear-gradient(135deg, rgba(8, 124, 244, 0.25), rgba(0, 240, 255, 0.25));
      border: 1px solid var(--neon-cyan);
      color: var(--neon-cyan);
      box-shadow: 0 0 18px rgba(0, 240, 255, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.4);
    }

    /* Cybernetic Glowing Border Beam */
    .cyber-beam {
      position: relative;
    }
    .cyber-beam::after {
      content: '';
      position: absolute;
      inset: -1px;
      border-radius: inherit;
      padding: 1px;
      background: linear-gradient(135deg, #00F0FF, #087CF4, #A855F7, transparent, #10B981);
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      pointer-events: none;
      opacity: 0.85;
      animation: borderRotate 8s linear infinite;
    }
    @keyframes borderRotate {
      0% { filter: hue-rotate(0deg); }
      100% { filter: hue-rotate(360deg); }
    }

    /* Scrollbars */
    ::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    ::-webkit-scrollbar-track {
      background: transparent;
    }
    ::-webkit-scrollbar-thumb {
      background: var(--glass-border-strong);
      border-radius: 9999px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: var(--neon-cyan);
    }

    /* Mobile Frame */
    .iphone-frame {
      width: 380px;
      height: 780px;
      border-radius: 54px;
      border: 12px solid #1E293B;
      box-shadow: 0 35px 80px rgba(0, 0, 0, 0.7), 0 0 45px rgba(8, 124, 244, 0.25), inset 0 0 8px rgba(255, 255, 255, 0.3);
      position: relative;
      overflow: hidden;
      background: #030712;
      display: flex;
      flex-direction: column;
    }
    .dynamic-island {
      width: 110px;
      height: 30px;
      background: #000000;
      border-radius: 9999px;
      margin: 10px auto 4px auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 10px;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.8);
      z-index: 50;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      cursor: pointer;
    }
    .dynamic-island:hover {
      width: 210px;
      height: 36px;
    }

    /* Pulse Glow */
    .pulse-glow {
      animation: pulseGlow 2.5s infinite;
    }
    @keyframes pulseGlow {
      0%, 100% { opacity: 0.6; filter: drop-shadow(0 0 8px currentColor); }
      50% { opacity: 1; filter: drop-shadow(0 0 18px currentColor); }
    }
  </style>
</head>
<body class="relative flex flex-col min-h-screen">

  <!-- Nebula Background Glows -->
  <div class="nebula-glow w-[600px] h-[600px] -top-32 -start-32" style="background: radial-gradient(circle, var(--bg-nebula-1) 0%, transparent 70%);"></div>
  <div class="nebula-glow w-[700px] h-[700px] top-1/3 -end-48" style="background: radial-gradient(circle, var(--bg-nebula-2) 0%, transparent 70%); animation-delay: -4s;"></div>
  <div class="nebula-glow w-[550px] h-[550px] -bottom-32 start-1/4" style="background: radial-gradient(circle, var(--bg-nebula-3) 0%, transparent 70%); animation-delay: -8s;"></div>

  <!-- Cosmic Particle Canvas -->
  <canvas id="antiGravityCanvas"></canvas>

  <!-- =========================================================================
       TOP CONTROL CENTER (VIEW SWITCHER + LIVE CONTROLS)
       ========================================================================= -->
  <header class="sticky top-0 z-40 px-4 lg:px-8 py-3.5 border-b border-[var(--glass-border)]" style="background: var(--glass-surface); backdrop-filter: blur(28px);">
    <div class="max-w-[1720px] mx-auto flex flex-wrap items-center justify-between gap-4">
      
      <!-- Brand & Status Pill -->
      <div class="flex items-center gap-3">
        <div class="w-11 h-11 rounded-2xl flex items-center justify-center relative cyber-beam shadow-lg" style="background: linear-gradient(135deg, #087CF4, #00F0FF);">
          <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
            <circle cx="12" cy="12" r="9" stroke-width="1.6" stroke-dasharray="3 3"/>
          </svg>
        </div>
        <div>
          <div class="flex items-center gap-2">
            <span class="text-xl font-black tracking-tight" style="background: linear-gradient(135deg, var(--text-main), var(--neon-cyan)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">يلا كلينيك</span>
            <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full" style="background: rgba(0, 240, 255, 0.15); color: var(--neon-cyan); border: 1px solid rgba(0, 240, 255, 0.3);">iOS Ultra Glass</span>
          </div>
          <div class="flex items-center gap-2 text-xs" style="color: var(--text-muted);">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span>نظام التشغيل الطبي الذكي • متصل سحابياً</span>
          </div>
        </div>
      </div>

      <!-- Center Multi-Screen Switcher (8 Modules from image_0.png) -->
      <nav class="flex items-center gap-1.5 p-1.5 rounded-2xl border border-[var(--glass-border)]" style="background: rgba(255, 255, 255, 0.03);">
        <button type="button" onclick="switchView('dashboard')" id="btn-view-dashboard" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ios-pill-active flex items-center gap-1.5">
          <span>🎛️</span>
          <span class="nav-label" data-ar="لوحة العيادة" data-en="Dashboard">لوحة العيادة</span>
        </button>
        <button type="button" onclick="switchView('landing')" id="btn-view-landing" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ios-btn-glass flex items-center gap-1.5">
          <span>🏥</span>
          <span class="nav-label" data-ar="صفحة المرضى" data-en="Patient Portal">صفحة المرضى</span>
        </button>
        <button type="button" onclick="switchView('mobile')" id="btn-view-mobile" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ios-btn-glass flex items-center gap-1.5">
          <span>📱</span>
          <span class="nav-label" data-ar="محاكي الآيفون" data-en="iPhone Frame">محاكي الآيفون</span>
        </button>
        <button type="button" onclick="switchView('patient-emr')" id="btn-view-patient-emr" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ios-btn-glass flex items-center gap-1.5">
          <span>🩺</span>
          <span class="nav-label" data-ar="ملف المريض" data-en="Patient EMR">ملف المريض</span>
        </button>
        <button type="button" onclick="switchView('rx')" id="btn-view-rx" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ios-btn-glass flex items-center gap-1.5">
          <span>📄</span>
          <span class="nav-label" data-ar="الروشتة A4" data-en="Rx Prescription">الروشتة A4</span>
        </button>
        <button type="button" onclick="switchView('drugs')" id="btn-view-drugs" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ios-btn-glass flex items-center gap-1.5">
          <span>💊</span>
          <span class="nav-label" data-ar="دليل الأدوية" data-en="Drugs DB">دليل الأدوية</span>
        </button>
        <button type="button" onclick="switchView('finance')" id="btn-view-finance" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ios-btn-glass flex items-center gap-1.5">
          <span>📈</span>
          <span class="nav-label" data-ar="المالية والتقارير" data-en="Financial Suite">المالية والتقارير</span>
        </button>
        <button type="button" onclick="switchView('booking-modal')" id="btn-view-booking-modal" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ios-btn-glass flex items-center gap-1.5">
          <span>🗓️</span>
          <span class="nav-label" data-ar="حجز موعد" data-en="Booking Modal">حجز موعد</span>
        </button>
        <button type="button" onclick="switchView('collage')" id="btn-view-collage" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ios-btn-glass flex items-center gap-1.5" style="border-color: rgba(168, 85, 247, 0.4); color: var(--neon-purple);">
          <span>✨</span>
          <span class="nav-label" data-ar="عرض الكولاج الشامل" data-en="Full Mosaic Collage">عرض الكولاج الشامل</span>
        </button>
      </nav>

      <!-- Right Controls: Branch, Lang, Theme, Particles -->
      <div class="flex items-center gap-2.5">
        <!-- Branch Selector -->
        <div class="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border border-[var(--glass-border)]" style="background: rgba(255, 255, 255, 0.04);">
          <span class="w-2 h-2 rounded-full bg-cyan-400"></span>
          <span id="headerBranchName">الفرع الرئيسي</span>
        </div>

        <!-- Date Indicator -->
        <div class="hidden md:flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl" style="background: rgba(255, 255, 255, 0.03); color: var(--text-muted);">
          <span>📅</span>
          <span id="headerLiveDate">الثلاثاء 15 أكتوبر 2024</span>
        </div>

        <!-- Language Switcher -->
        <button type="button" onclick="toggleLanguage()" class="ios-btn-glass px-3 py-1.5 text-xs font-bold" title="تبديل اللغة / Toggle Language">
          <span id="langBtnText">EN</span>
        </button>

        <!-- Theme Switcher -->
        <button type="button" onclick="toggleTheme()" class="ios-btn-glass w-9 h-9 text-sm" title="الوضع الليلي / النهاري">
          <span id="themeBtnIcon">🌙</span>
        </button>

        <!-- Particles / Anti-Gravity Toggle -->
        <button type="button" onclick="toggleAntiGravity()" id="btn-particle-toggle" class="ios-btn-glass px-3 py-1.5 text-xs font-bold" title="تفعيل / تعطيل جزيئات الجاذبية">
          <span>✨</span>
          <span class="hidden sm:inline">Physics ON</span>
        </button>
      </div>

    </div>
  </header>

  <!-- =========================================================================
       MAIN VIEW CONTAINER (Dynamic Switcher)
       ========================================================================= -->
  <main class="relative z-10 flex-1 max-w-[1720px] w-full mx-auto p-4 lg:p-8">

    <!-- =======================================================================
         VIEW 1: DOCTOR & RECEPTION DASHBOARD (لوحة العيادة والطابور)
         ======================================================================= -->
    <div id="view-dashboard" class="view-screen space-y-6">

      <!-- Top Stats Hero Bar (24 appointments, 6 waiting, 15 exam, 4,650 revenue) -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <!-- KPI 1: Today Appointments -->
        <div class="glass-panel p-5 float-suspension-1 group">
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-bold uppercase tracking-wider" style="color: var(--text-muted);" data-ar="إجمالي حجوزات اليوم" data-en="Today Appointments">إجمالي حجوزات اليوم</span>
            <div class="w-10 h-10 rounded-2xl flex items-center justify-center" style="background: rgba(0, 240, 255, 0.15); color: var(--neon-cyan); border: 1px solid rgba(0, 240, 255, 0.3);">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
            </div>
          </div>
          <div class="flex items-baseline gap-3">
            <span class="text-4xl font-black tracking-tight" style="color: var(--neon-cyan);">24</span>
            <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">+18% نمو</span>
          </div>
          <p class="text-xs mt-2" style="color: var(--text-muted);" data-ar="موزعة على 3 فروع طبية" data-en="Across 3 clinic branches">موزعة على 3 فروع طبية</p>
        </div>

        <!-- KPI 2: Waiting -->
        <div class="glass-panel p-5 float-suspension-2 group">
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-bold uppercase tracking-wider" style="color: var(--text-muted);" data-ar="في صالة الانتظار" data-en="In Waiting Lounge">في صالة الانتظار</span>
            <div class="w-10 h-10 rounded-2xl flex items-center justify-center" style="background: rgba(245, 158, 11, 0.15); color: var(--neon-amber); border: 1px solid rgba(245, 158, 11, 0.3);">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
          </div>
          <div class="flex items-baseline gap-3">
            <span class="text-4xl font-black tracking-tight" style="color: var(--neon-amber);">6</span>
            <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">متوسط 14 د</span>
          </div>
          <p class="text-xs mt-2" style="color: var(--text-muted);" data-ar="جاهزون للدخول تباعاً" data-en="Ready for consultation">جاهزون للدخول تباعاً</p>
        </div>

        <!-- KPI 3: Completed Exam -->
        <div class="glass-panel p-5 float-suspension-3 group">
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-bold uppercase tracking-wider" style="color: var(--text-muted);" data-ar="تم الكشف والمغادرة" data-en="Completed Exams">تم الكشف والمغادرة</span>
            <div class="w-10 h-10 rounded-2xl flex items-center justify-center" style="background: rgba(16, 185, 129, 0.15); color: var(--neon-emerald); border: 1px solid rgba(16, 185, 129, 0.3);">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
          </div>
          <div class="flex items-baseline gap-3">
            <span class="text-4xl font-black tracking-tight" style="color: var(--neon-emerald);">15</span>
            <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">62.5% إنجاز</span>
          </div>
          <p class="text-xs mt-2" style="color: var(--text-muted);" data-ar="تم إصدار وتوثيق الروشتات" data-en="All Rx finalized">تم إصدار وتوثيق الروشتات</p>
        </div>

        <!-- KPI 4: Total Revenue -->
        <div class="glass-panel p-5 float-suspension-1 group">
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-bold uppercase tracking-wider" style="color: var(--text-muted);" data-ar="إجمالي مبيعات اليوم" data-en="Today Revenue">إجمالي مبيعات اليوم</span>
            <div class="w-10 h-10 rounded-2xl flex items-center justify-center" style="background: rgba(8, 124, 244, 0.15); color: var(--neon-blue); border: 1px solid rgba(8, 124, 244, 0.3);">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
          </div>
          <div class="flex items-baseline gap-2">
            <span class="text-4xl font-black tracking-tight" style="color: var(--text-main);">4,650</span>
            <span class="text-sm font-bold" style="color: var(--neon-cyan);">ج.م</span>
            <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 ms-auto">100% محصل</span>
          </div>
          <p class="text-xs mt-2" style="color: var(--text-muted);" data-ar="كاش + محافظ إلكترونية" data-en="Cash + E-Wallets">كاش + محافظ إلكترونية</p>
        </div>

      </div>

      <!-- Main Workspace: Left Side Sidebar + Turn Flow Cards + Table -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">

        <!-- Sidebar Navigation (Desktop) -->
        <aside class="lg:col-span-3 space-y-4">
          
          <!-- Doctor Profile Card -->
          <div class="glass-panel p-5 relative overflow-hidden">
            <div class="flex items-center gap-3.5 mb-4">
              <div class="relative">
                <img src="https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=160&auto=format&fit=crop&q=80" alt="Dr. Ahmed Abdelaziz" class="w-14 h-14 rounded-2xl object-cover border-2 border-cyan-400/50 shadow-md">
                <span class="absolute -bottom-1 -end-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-slate-900"></span>
              </div>
              <div>
                <h3 class="font-extrabold text-base leading-snug">د. أحمد عبد العزيز</h3>
                <p class="text-xs font-medium text-cyan-400">استشاري القلب والجهاز الهضمي</p>
                <div class="flex items-center gap-1.5 mt-1 text-[11px]" style="color: var(--text-muted);">
                  <span>🏥</span>
                  <span>الفرع الرئيسي • عيادة 1</span>
                </div>
              </div>
            </div>

            <!-- Doctor Quick Actions -->
            <div class="grid grid-cols-2 gap-2 pt-3 border-t border-[var(--glass-border)]">
              <button type="button" onclick="switchView('booking-modal')" class="ios-btn-glass py-2 text-xs font-bold w-full">
                <span>➕</span> <span>حجز موعد</span>
              </button>
              <button type="button" onclick="switchView('rx')" class="ios-btn-glass py-2 text-xs font-bold w-full">
                <span>✍️</span> <span>روشتة سريعة</span>
              </button>
            </div>
          </div>

          <!-- Navigation Links -->
          <div class="glass-panel p-3 space-y-1">
            <button type="button" onclick="switchView('dashboard')" class="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold ios-pill-active">
              <div class="flex items-center gap-2.5">
                <span>⚡</span>
                <span data-ar="طابور اليوم الحي" data-en="Today Live Queue">طابور اليوم الحي</span>
              </div>
              <span class="px-2 py-0.5 rounded-full text-[10px] bg-cyan-400/20 text-cyan-300">24</span>
            </button>
            <button type="button" onclick="switchView('landing')" class="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:bg-white/5 transition-all">
              <div class="flex items-center gap-2.5">
                <span>🏥</span>
                <span data-ar="صفحة العيادة والحجز" data-en="Public Clinic Page">صفحة العيادة والحجز</span>
              </div>
            </button>
            <button type="button" onclick="switchView('patient-emr')" class="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:bg-white/5 transition-all">
              <div class="flex items-center gap-2.5">
                <span>👥</span>
                <span data-ar="سجلات المرضى (EMR)" data-en="Patient EMR Records">سجلات المرضى (EMR)</span>
              </div>
              <span class="text-xs text-slate-500">1,240</span>
            </button>
            <button type="button" onclick="switchView('rx')" class="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:bg-white/5 transition-all">
              <div class="flex items-center gap-2.5">
                <span>📄</span>
                <span data-ar="الروشتات الطبية المعتمدة" data-en="Medical Prescriptions">الروشتات الطبية المعتمدة</span>
              </div>
            </button>
            <button type="button" onclick="switchView('drugs')" class="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:bg-white/5 transition-all">
              <div class="flex items-center gap-2.5">
                <span>💊</span>
                <span data-ar="دليل وقاعدة الأدوية" data-en="Egyptian Drug Directory">دليل وقاعدة الأدوية</span>
              </div>
              <span class="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300">محدث اليوم</span>
            </button>
            <button type="button" onclick="switchView('finance')" class="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:bg-white/5 transition-all">
              <div class="flex items-center gap-2.5">
                <span>💳</span>
                <span data-ar="الحسابات والتقارير المالية" data-en="Financial & Accounts">الحسابات والتقارير المالية</span>
              </div>
            </button>
          </div>

          <!-- Direct Support Button (WhatsApp) -->
          <div class="glass-panel p-4 text-center relative cyber-beam">
            <div class="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center bg-emerald-500/20 text-emerald-400">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/></svg>
            </div>
            <h4 class="font-bold text-xs">الدعم الفني المباشر</h4>
            <p class="text-[11px] text-slate-400 mb-3">متاح على مدار الساعة عبر الواتساب</p>
            <a href="https://wa.me/201551007018" target="_blank" class="ios-btn-primary w-full py-2 text-xs">
              <span>تواصل مع الإدارة الآن</span>
            </a>
          </div>

        </aside>

        <!-- Right Workspace (Current Patient, Next Patient, Donut, Queue Table) -->
        <section class="lg:col-span-9 space-y-6">

          <!-- Real-Time Queue Priority Cards (In-Room #6 & Next In Line #7) -->
          <div class="grid grid-cols-1 md:grid-cols-12 gap-5">
            
            <!-- Current Patient Card (محمد أحمد علي - رقم 6) -->
            <div class="md:col-span-5 glass-panel p-5 relative cyber-beam float-suspension-1">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping"></span>
                  <span class="text-xs font-black tracking-wide uppercase text-cyan-400" data-ar="المريض الحالي في العيادة" data-en="Current In-Room Patient">المريض الحالي في العيادة</span>
                </div>
                <span class="text-xs px-2.5 py-0.5 rounded-full font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">كشف عادي</span>
              </div>

              <div class="flex items-center gap-4 my-4">
                <!-- Huge Glowing Ticket Badge -->
                <div class="w-18 h-18 rounded-3xl flex flex-col items-center justify-center border-2 border-cyan-400 shadow-lg relative" style="background: linear-gradient(135deg, rgba(8, 124, 244, 0.3), rgba(0, 240, 255, 0.4)); box-shadow: 0 0 30px rgba(0, 240, 255, 0.4);">
                  <span class="text-xs font-semibold text-cyan-200">الدور</span>
                  <span class="text-4xl font-black text-white leading-none">6</span>
                </div>

                <!-- Patient Bio -->
                <div class="flex-1">
                  <h3 class="text-xl font-black">محمد أحمد علي</h3>
                  <p class="text-xs font-medium text-slate-300 mt-0.5">📞 01017320478</p>
                  <div class="flex items-center gap-2 mt-2 text-xs text-slate-400">
                    <span>السن: 28 سنة</span>
                    <span>•</span>
                    <span>التوقيت: 10:00 ص</span>
                  </div>
                </div>
              </div>

              <!-- Action Buttons -->
              <div class="flex items-center gap-2.5 pt-3 border-t border-[var(--glass-border)]">
                <button type="button" onclick="playChime(); showNotification('تم بدء الكشف الطبي للمريض محمد أحمد علي')" class="ios-btn-primary flex-1 py-2.5 text-xs font-extrabold">
                  <span>🩺</span> <span>بدء الكشف / تم</span>
                </button>
                <button type="button" onclick="switchView('patient-emr')" class="ios-btn-glass px-3.5 py-2.5 text-xs font-bold" title="عرض السجل الطبي">
                  <span>📂</span> <span>الملف الطبي</span>
                </button>
              </div>
            </div>

            <!-- Next Patient Card (سارة محمد - رقم 7) -->
            <div class="md:col-span-4 glass-panel p-5 float-suspension-2">
              <div class="flex items-center justify-between mb-3">
                <span class="text-xs font-black tracking-wide uppercase text-amber-400" data-ar="التالي في الدور" data-en="Next Patient in Line">التالي في الدور</span>
                <span class="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">متابعة دورية</span>
              </div>

              <div class="flex items-center gap-3.5 my-4">
                <div class="w-14 h-14 rounded-2xl flex flex-col items-center justify-center border border-amber-400/40" style="background: rgba(245, 158, 11, 0.15);">
                  <span class="text-[10px] font-semibold text-amber-300">الدور</span>
                  <span class="text-2xl font-black text-amber-400">7</span>
                </div>
                <div>
                  <h4 class="text-base font-extrabold">سارة محمد</h4>
                  <p class="text-xs font-medium text-slate-300 mt-0.5">📞 01090140422</p>
                  <p class="text-xs text-slate-400 mt-1">السن: 25 سنة • في الانتظار: 8 د</p>
                </div>
              </div>

              <div class="pt-3 border-t border-[var(--glass-border)]">
                <button type="button" onclick="playChime(); showNotification('تم استدعاء المريضة سارة محمد لغرفة الكشف')" class="ios-btn-glass w-full py-2.5 text-xs font-bold hover:border-amber-400 hover:text-amber-300">
                  <span>🔔</span> <span>استدعاء لغرفة الكشف</span>
                </button>
              </div>
            </div>

            <!-- Quick Analytics Donut Ring -->
            <div class="md:col-span-3 glass-panel p-5 flex flex-col items-center justify-center text-center">
              <span class="text-xs font-bold text-slate-400 mb-2">إحصائيات الإنجاز</span>
              
              <!-- SVG Donut Chart -->
              <div class="relative w-28 h-28 my-1">
                <svg class="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="transparent" stroke="rgba(255, 255, 255, 0.08)" stroke-width="12"></circle>
                  <!-- Completed (15 / 24 = 62.5%) -->
                  <circle cx="50" cy="50" r="40" fill="transparent" stroke="#10B981" stroke-width="12" stroke-dasharray="251.2" stroke-dashoffset="94.2" stroke-linecap="round" style="filter: drop-shadow(0 0 8px rgba(16, 185, 129, 0.6));"></circle>
                  <!-- Waiting (6 / 24 = 25%) -->
                  <circle cx="50" cy="50" r="40" fill="transparent" stroke="#F59E0B" stroke-width="12" stroke-dasharray="251.2" stroke-dashoffset="188.4" stroke-linecap="round" style="filter: drop-shadow(0 0 8px rgba(245, 158, 11, 0.6));"></circle>
                </svg>
                <div class="absolute inset-0 flex flex-col items-center justify-center">
                  <span class="text-2xl font-black text-white">24</span>
                  <span class="text-[10px] text-slate-400">إجمالي اليوم</span>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 text-[11px] text-slate-300">
                <div class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-400"></span> تم 15</div>
                <div class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-amber-400"></span> انتظار 6</div>
                <div class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-cyan-400"></span> حالي 1</div>
                <div class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-rose-400"></span> ملغي 2</div>
              </div>
            </div>

          </div>

          <!-- Queue Management Table -->
          <div class="glass-panel p-5 space-y-4">
            
            <!-- Table Header Controls & Filter Tabs -->
            <div class="flex flex-wrap items-center justify-between gap-4">
              
              <!-- Tab Pills -->
              <div class="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-white/5 border border-[var(--glass-border)]">
                <button type="button" class="px-3 py-1.5 rounded-xl text-xs font-bold ios-pill-active">جميع الحالات (24)</button>
                <button type="button" class="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white">في الانتظار (6)</button>
                <button type="button" class="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white">تم الكشف (15)</button>
                <button type="button" class="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white">ملغي (2)</button>
                <button type="button" class="px-3 py-1.5 rounded-xl text-xs font-bold text-rose-400 hover:text-white">تقرير عاجل (1)</button>
              </div>

              <!-- Search Bar -->
              <div class="relative w-full sm:w-64">
                <input type="text" placeholder="بحث باسم المريض أو الهاتف..." class="w-full px-3.5 py-2 ps-9 rounded-xl text-xs bg-white/5 border border-[var(--glass-border)] text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400">
                <span class="absolute top-2.5 start-3 text-slate-400 text-xs">🔍</span>
              </div>

            </div>

            <!-- The Queue Table -->
            <div class="overflow-x-auto">
              <table class="w-full text-xs text-start">
                <thead>
                  <tr class="border-b border-[var(--glass-border)] text-slate-400 font-semibold text-start">
                    <th class="py-3 px-3 text-start">#</th>
                    <th class="py-3 px-3 text-start">رقم الدور</th>
                    <th class="py-3 px-3 text-start">اسم المريض</th>
                    <th class="py-3 px-3 text-start">نوع الكشف</th>
                    <th class="py-3 px-3 text-start">الفرع</th>
                    <th class="py-3 px-3 text-start">توقيت الحجز</th>
                    <th class="py-3 px-3 text-start">الحالة</th>
                    <th class="py-3 px-3 text-end">الإجراءات</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/5 font-medium">
                  
                  <!-- Row 1: محمد أحمد علي -->
                  <tr class="hover:bg-white/5 transition-colors">
                    <td class="py-3.5 px-3 font-mono text-slate-400">1</td>
                    <td class="py-3.5 px-3">
                      <span class="w-7 h-7 rounded-xl flex items-center justify-center font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">6</span>
                    </td>
                    <td class="py-3.5 px-3">
                      <div class="font-extrabold text-white text-sm">محمد أحمد علي</div>
                      <div class="text-[11px] text-slate-400 font-mono">01017320478 • 28 سنة</div>
                    </td>
                    <td class="py-3.5 px-3">كشف عادي</td>
                    <td class="py-3.5 px-3 text-slate-300">الفرع الرئيسي</td>
                    <td class="py-3.5 px-3 font-mono">10:00 ص</td>
                    <td class="py-3.5 px-3">
                      <span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1.5 w-max">
                        <span class="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                        <span>قيد الكشف الآن</span>
                      </span>
                    </td>
                    <td class="py-3.5 px-3 text-end space-x-1.5 rtl:space-x-reverse">
                      <button type="button" onclick="switchView('rx')" class="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-cyan-400 font-semibold" title="روشتة">روشتة</button>
                      <button type="button" onclick="switchView('patient-emr')" class="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 font-semibold" title="الملف الطبي">الملف</button>
                    </td>
                  </tr>

                  <!-- Row 2: سارة محمد -->
                  <tr class="hover:bg-white/5 transition-colors">
                    <td class="py-3.5 px-3 font-mono text-slate-400">2</td>
                    <td class="py-3.5 px-3">
                      <span class="w-7 h-7 rounded-xl flex items-center justify-center font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">7</span>
                    </td>
                    <td class="py-3.5 px-3">
                      <div class="font-extrabold text-white text-sm">سارة محمد</div>
                      <div class="text-[11px] text-slate-400 font-mono">01090140422 • 25 سنة</div>
                    </td>
                    <td class="py-3.5 px-3">متابعة دورية</td>
                    <td class="py-3.5 px-3 text-slate-300">فرع مدينة نصر</td>
                    <td class="py-3.5 px-3 font-mono">10:30 ص</td>
                    <td class="py-3.5 px-3">
                      <span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 w-max">في الانتظار (التالي)</span>
                    </td>
                    <td class="py-3.5 px-3 text-end space-x-1.5 rtl:space-x-reverse">
                      <button type="button" onclick="showNotification('تم استدعاء سارة محمد')" class="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-semibold">استدعاء</button>
                      <button type="button" onclick="switchView('patient-emr')" class="px-2.5 py-1 rounded-lg bg-white/5 text-slate-300 font-semibold">الملف</button>
                    </td>
                  </tr>

                  <!-- Row 3: أحمد سمير -->
                  <tr class="hover:bg-white/5 transition-colors">
                    <td class="py-3.5 px-3 font-mono text-slate-400">3</td>
                    <td class="py-3.5 px-3">
                      <span class="w-7 h-7 rounded-xl flex items-center justify-center font-black bg-slate-700/50 text-slate-300 border border-slate-600">8</span>
                    </td>
                    <td class="py-3.5 px-3">
                      <div class="font-extrabold text-white text-sm">أحمد سمير</div>
                      <div class="text-[11px] text-slate-400 font-mono">01223948110 • 34 سنة</div>
                    </td>
                    <td class="py-3.5 px-3">استشارة طبية</td>
                    <td class="py-3.5 px-3 text-slate-300">الفرع الرئيسي</td>
                    <td class="py-3.5 px-3 font-mono">11:00 ص</td>
                    <td class="py-3.5 px-3">
                      <span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-500/20 text-slate-300 border border-slate-500/40 w-max">في الانتظار</span>
                    </td>
                    <td class="py-3.5 px-3 text-end space-x-1.5 rtl:space-x-reverse">
                      <button type="button" class="px-2.5 py-1 rounded-lg bg-white/5 text-slate-300 font-semibold">الملف</button>
                    </td>
                  </tr>

                  <!-- Row 4: منى فؤاد -->
                  <tr class="hover:bg-white/5 transition-colors">
                    <td class="py-3.5 px-3 font-mono text-slate-400">4</td>
                    <td class="py-3.5 px-3">
                      <span class="w-7 h-7 rounded-xl flex items-center justify-center font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">9</span>
                    </td>
                    <td class="py-3.5 px-3">
                      <div class="font-extrabold text-white text-sm">منى فؤاد</div>
                      <div class="text-[11px] text-slate-400 font-mono">01150293841 • 41 سنة</div>
                    </td>
                    <td class="py-3.5 px-3">كشف عاجل</td>
                    <td class="py-3.5 px-3 text-slate-300">الفرع الرئيسي</td>
                    <td class="py-3.5 px-3 font-mono">11:30 ص</td>
                    <td class="py-3.5 px-3">
                      <span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 w-max">غير مسدد (تأكيد)</span>
                    </td>
                    <td class="py-3.5 px-3 text-end space-x-1.5 rtl:space-x-reverse">
                      <button type="button" onclick="showNotification('تم تأكيد السداد وإدراج الدور')" class="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-semibold">تأكيد الدفع</button>
                    </td>
                  </tr>

                  <!-- Row 5: علي جميل -->
                  <tr class="hover:bg-white/5 transition-colors">
                    <td class="py-3.5 px-3 font-mono text-slate-400">5</td>
                    <td class="py-3.5 px-3">
                      <span class="w-7 h-7 rounded-xl flex items-center justify-center font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">5</span>
                    </td>
                    <td class="py-3.5 px-3">
                      <div class="font-extrabold text-white text-sm">علي جميل</div>
                      <div class="text-[11px] text-slate-400 font-mono">01099238475 • 52 سنة</div>
                    </td>
                    <td class="py-3.5 px-3">فحص دوري</td>
                    <td class="py-3.5 px-3 text-slate-300">فرع التجمع الخامس</td>
                    <td class="py-3.5 px-3 font-mono">09:30 ص</td>
                    <td class="py-3.5 px-3">
                      <span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 w-max">تم الكشف ✓</span>
                    </td>
                    <td class="py-3.5 px-3 text-end space-x-1.5 rtl:space-x-reverse">
                      <button type="button" onclick="switchView('rx')" class="px-2.5 py-1 rounded-lg bg-white/5 text-cyan-400 font-semibold">عرض الروشتة</button>
                    </td>
                  </tr>

                </tbody>
              </table>
            </div>

          </div>

        </section>

      </div>

    </div>

    <!-- =======================================================================
         VIEW 2: PUBLIC CLINIC LANDING PAGE (صفحة المرضى والحجز)
         ======================================================================= -->
    <div id="view-landing" class="view-screen hidden space-y-8">
      
      <!-- Hero Banner (Dr. Ahmed Abdelaziz) -->
      <div class="glass-panel p-8 md:p-12 relative overflow-hidden">
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          <div class="lg:col-span-7 space-y-4">
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 text-xs font-bold">
              <span>🌟</span> <span>رعاية صحية أفضل • طفرة أسوان الطبية</span>
            </div>
            <h1 class="text-3xl sm:text-5xl font-black leading-tight tracking-tight">
              احجز موعدك بكل سهولة في عيادة <span style="background: linear-gradient(135deg, #00F0FF, #087CF4); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">د. أحمد عبد العزيز</span>
            </h1>
            <p class="text-slate-300 text-sm sm:text-base leading-relaxed">
              استشاري القلب الباطني والجهاز الهضمي والمناظير • رعاية متكاملة متقدمة • اهتمام وعناية خاصة بكل مريض مع توفير طابور حجز ذكي لمعرفة دورك لحظة بلحظة دون أي انتظار.
            </p>
            <div class="flex flex-wrap items-center gap-4 pt-4">
              <button type="button" onclick="switchView('booking-modal')" class="ios-btn-primary px-7 py-3.5 text-sm font-extrabold shadow-lg">
                <span>📅</span> <span>احجز موعدك الآن</span>
              </button>
              <button type="button" onclick="switchView('dashboard')" class="ios-btn-glass px-6 py-3.5 text-sm font-bold">
                <span>⚡</span> <span>تتبع دورك في الطابور</span>
              </button>
            </div>
          </div>

          <!-- Doctor Portrait in Floating Glass Sphere -->
          <div class="lg:col-span-5 flex justify-center relative">
            <div class="relative w-72 h-72 sm:w-80 sm:h-80 rounded-full p-2 cyber-beam float-suspension-1" style="background: radial-gradient(circle, rgba(0, 240, 255, 0.2), transparent 70%);">
              <img src="https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=500&auto=format&fit=crop&q=80" alt="Doctor Portrait" class="w-full h-full rounded-full object-cover border-4 border-cyan-400/40 shadow-2xl">
              <!-- Floating Badge -->
              <div class="absolute -bottom-2 -start-2 px-4 py-2 rounded-2xl glass-panel-elevated text-xs font-black text-cyan-300 shadow-xl flex items-center gap-2">
                <span>🏆</span> <span>خبرة +10 سنوات معتمدة</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- 4 Value Props Glass Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="glass-panel p-5 text-center float-suspension-1">
          <div class="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center bg-cyan-500/20 text-cyan-400 text-2xl">🕒</div>
          <h4 class="font-extrabold text-sm mb-1">مواعيد مرنة</h4>
          <p class="text-xs text-slate-400">حجوزات طوال الأسبوع صباحاً ومساءً تناسب وقتك</p>
        </div>
        <div class="glass-panel p-5 text-center float-suspension-2">
          <div class="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center bg-blue-500/20 text-blue-400 text-2xl">📍</div>
          <h4 class="font-extrabold text-sm mb-1">عدة فروع</h4>
          <p class="text-xs text-slate-400">3 فروع طبية متكاملة لخدمتك في أقرب مكان</p>
        </div>
        <div class="glass-panel p-5 text-center float-suspension-3">
          <div class="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center bg-emerald-500/20 text-emerald-400 text-2xl">⚡</div>
          <h4 class="font-extrabold text-sm mb-1">خدمة سريعة</h4>
          <p class="text-xs text-slate-400">طابور ذكي وشاشات لحظية بدون أي انتظار مرهق</p>
        </div>
        <div class="glass-panel p-5 text-center float-suspension-1">
          <div class="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center bg-purple-500/20 text-purple-400 text-2xl">🔒</div>
          <h4 class="font-extrabold text-sm mb-1">بياناتك آمنة</h4>
          <p class="text-xs text-slate-400">ملف طبي إلكتروني مشفر وسري تماماً مدى الحياة</p>
        </div>
      </div>

      <!-- Branches Showcase (الفرع الرئيسي، فرع مدينة نصر، فرع التجمع الخامس) -->
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-xl font-black">فروع عيادة د. أحمد عبد العزيز</h3>
            <p class="text-xs text-slate-400">اختر الفرع الأنسب لك وتعرف على المواعيد</p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
          
          <!-- Branch 1: الفرع الرئيسي -->
          <div class="glass-panel overflow-hidden group">
            <div class="h-44 relative overflow-hidden">
              <img src="https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=600&auto=format&fit=crop&q=80" alt="Main Branch" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
              <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent"></div>
              <span class="absolute top-3 end-3 px-2.5 py-1 rounded-full text-xs font-bold bg-cyan-500 text-slate-950">الفرع الرئيسي</span>
            </div>
            <div class="p-5 space-y-3">
              <h4 class="font-extrabold text-base">الفرع الرئيسي (أسوان)</h4>
              <p class="text-xs text-slate-400 flex items-center gap-1.5">
                <span>📍</span> <span>شارع المعسكر القبلي - برج الأطباء - الدور 3</span>
              </p>
              <div class="text-xs text-cyan-400 font-semibold">مفتوح اليوم حتى 10:00 مساءً</div>
              <button type="button" onclick="switchView('booking-modal')" class="ios-btn-primary w-full py-2 text-xs">حجز في هذا الفرع</button>
            </div>
          </div>

          <!-- Branch 2: مدينة نصر -->
          <div class="glass-panel overflow-hidden group">
            <div class="h-44 relative overflow-hidden">
              <img src="https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=600&auto=format&fit=crop&q=80" alt="Nasr City Branch" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
              <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent"></div>
              <span class="absolute top-3 end-3 px-2.5 py-1 rounded-full text-xs font-bold bg-white/20 text-white backdrop-blur">فرع 2</span>
            </div>
            <div class="p-5 space-y-3">
              <h4 class="font-extrabold text-base">فرع مدينة نصر (القاهرة)</h4>
              <p class="text-xs text-slate-400 flex items-center gap-1.5">
                <span>📍</span> <span>بجوار المستشفى التخصصي - عمارات العبور</span>
              </p>
              <div class="text-xs text-cyan-400 font-semibold">مواعيد: الأحد والثلاثاء والخميس</div>
              <button type="button" onclick="switchView('booking-modal')" class="ios-btn-primary w-full py-2 text-xs">حجز في هذا الفرع</button>
            </div>
          </div>

          <!-- Branch 3: التجمع الخامس -->
          <div class="glass-panel overflow-hidden group">
            <div class="h-44 relative overflow-hidden">
              <img src="https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=600&auto=format&fit=crop&q=80" alt="New Cairo Branch" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
              <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent"></div>
              <span class="absolute top-3 end-3 px-2.5 py-1 rounded-full text-xs font-bold bg-white/20 text-white backdrop-blur">فرع 3</span>
            </div>
            <div class="p-5 space-y-3">
              <h4 class="font-extrabold text-base">فرع التجمع الخامس (القاهرة الجديدة)</h4>
              <p class="text-xs text-slate-400 flex items-center gap-1.5">
                <span>📍</span> <span>التجمع الأول - مول المركز الطبي الطبي - عيادة 204</span>
              </p>
              <div class="text-xs text-cyan-400 font-semibold">مواعيد: السبت والاثنين والأربعاء</div>
              <button type="button" onclick="switchView('booking-modal')" class="ios-btn-primary w-full py-2 text-xs">حجز في هذا الفرع</button>
            </div>
          </div>

        </div>
      </div>

    </div>

    <!-- =======================================================================
         VIEW 3: IPHONE 16 PRO MOBILE SIMULATOR (محاكي الآيفون التفاعلي)
         ======================================================================= -->
    <div id="view-mobile" class="view-screen hidden flex justify-center py-6">
      
      <div class="iphone-frame">
        
        <!-- Dynamic Island -->
        <div class="dynamic-island" onclick="showNotification('Dynamic Island: الكشف القادم يبدأ خلال 5 دقائق')">
          <div class="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></div>
          <span class="text-[10px] text-white font-mono">دورك #6</span>
          <div class="w-2.5 h-2.5 rounded-full bg-cyan-400"></div>
        </div>

        <!-- Mobile Screen Content -->
        <div class="p-4 flex-1 overflow-y-auto space-y-4">
          
          <!-- Mobile Header -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <img src="https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=80&auto=format&fit=crop&q=80" class="w-9 h-9 rounded-xl object-cover border border-cyan-400">
              <div>
                <h4 class="text-xs font-bold text-white leading-tight">د. أحمد عبد العزيز</h4>
                <p class="text-[10px] text-slate-400">الفرع الرئيسي • عيادة اليوم</p>
              </div>
            </div>
            <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
          </div>

          <!-- Mini 4 KPI Pills -->
          <div class="grid grid-cols-4 gap-1.5 text-center">
            <div class="p-2 rounded-xl bg-white/5 border border-white/10">
              <span class="text-[10px] text-slate-400 block">حجوزات</span>
              <span class="text-sm font-black text-cyan-400">24</span>
            </div>
            <div class="p-2 rounded-xl bg-white/5 border border-white/10">
              <span class="text-[10px] text-slate-400 block">انتظار</span>
              <span class="text-sm font-black text-amber-400">6</span>
            </div>
            <div class="p-2 rounded-xl bg-white/5 border border-white/10">
              <span class="text-[10px] text-slate-400 block">تم</span>
              <span class="text-sm font-black text-emerald-400">15</span>
            </div>
            <div class="p-2 rounded-xl bg-white/5 border border-white/10">
              <span class="text-[10px] text-slate-400 block">المبيعات</span>
              <span class="text-xs font-black text-white">4.6K</span>
            </div>
          </div>

          <!-- In-Room Active Patient -->
          <div class="glass-panel p-4 relative cyber-beam">
            <div class="flex items-center justify-between text-[11px] mb-2">
              <span class="text-cyan-400 font-bold">المريض الحالي</span>
              <span class="text-slate-400 font-mono">10:00 ص</span>
            </div>
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-300 border border-cyan-400 flex items-center justify-center font-black text-xl">
                6
              </div>
              <div>
                <h5 class="text-sm font-extrabold text-white">محمد أحمد علي</h5>
                <p class="text-[11px] text-slate-300">01017320478 • 28 سنة</p>
                <span class="text-[10px] px-2 py-0.5 rounded-full bg-cyan-400/20 text-cyan-300 inline-block mt-1">كشف عادي</span>
              </div>
            </div>
            <button type="button" onclick="showNotification('تم إنهاء كشف محمد أحمد علي')" class="ios-btn-primary w-full py-2 text-xs font-bold mt-3">
              بدء الكشف / تم
            </button>
          </div>

          <!-- Next in Queue -->
          <div class="glass-panel p-3.5 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-400/40 flex items-center justify-center font-black text-sm">
                7
              </div>
              <div>
                <h5 class="text-xs font-bold text-white">سارة محمد</h5>
                <p class="text-[10px] text-slate-400">01090140422 • متابعة دورية</p>
              </div>
            </div>
            <span class="text-xs text-amber-400 font-bold">التالي</span>
          </div>

        </div>

        <!-- Floating Glass iOS Dock -->
        <div class="p-3 bg-slate-950/80 backdrop-blur border-t border-white/10 flex items-center justify-around text-xs">
          <button type="button" onclick="switchView('dashboard')" class="text-cyan-400 flex flex-col items-center">
            <span>🏠</span> <span class="text-[9px]">الرئيسية</span>
          </button>
          <button type="button" onclick="switchView('dashboard')" class="text-slate-400 flex flex-col items-center">
            <span>⚡</span> <span class="text-[9px]">الدور</span>
          </button>
          <button type="button" onclick="switchView('patient-emr')" class="text-slate-400 flex flex-col items-center">
            <span>👥</span> <span class="text-[9px]">المرضى</span>
          </button>
          <button type="button" onclick="switchView('rx')" class="text-slate-400 flex flex-col items-center">
            <span>📄</span> <span class="text-[9px]">روشتة</span>
          </button>
        </div>

      </div>

    </div>

    <!-- =======================================================================
         VIEW 4: PATIENT EMR MEDICAL FILE (ملف المريض والبيانات الطبية)
         ======================================================================= -->
    <div id="view-patient-emr" class="view-screen hidden max-w-4xl mx-auto space-y-6">
      
      <div class="glass-panel p-6 space-y-6">
        
        <!-- Patient Header Strip -->
        <div class="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-[var(--glass-border)]">
          <div class="flex items-center gap-4">
            <div class="w-16 h-16 rounded-3xl bg-cyan-500/20 text-cyan-300 border-2 border-cyan-400/50 flex items-center justify-center font-black text-2xl shadow-lg">
              MA
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-xl font-black text-white">محمد أحمد علي</h2>
                <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">ملف رقم #1029</span>
              </div>
              <p class="text-xs text-slate-300 mt-1">📞 01017320478 • 28 سنة • فصيلة الدم O+ • آخر زيارة: 10 أكتوبر 2024</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button type="button" onclick="switchView('rx')" class="ios-btn-primary px-4 py-2 text-xs">
              <span>✍️</span> <span>إصدار روشتة جديدة</span>
            </button>
          </div>
        </div>

        <!-- EMR Tabs -->
        <div class="flex items-center gap-2 border-b border-[var(--glass-border)] pb-2 text-xs font-bold">
          <button type="button" class="px-4 py-2 rounded-xl ios-pill-active">البيانات السريرية</button>
          <button type="button" class="px-4 py-2 rounded-xl text-slate-400 hover:text-white">التاريخ المرضي</button>
          <button type="button" class="px-4 py-2 rounded-xl text-slate-400 hover:text-white">الأدوية السابقة</button>
          <button type="button" class="px-4 py-2 rounded-xl text-slate-400 hover:text-white">الزيارات السابقة (4)</button>
          <button type="button" class="px-4 py-2 rounded-xl text-slate-400 hover:text-white">التحاليل والأشعة</button>
        </div>

        <!-- Medical Condition Accordions -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          <div class="glass-panel p-4 space-y-2">
            <div class="flex items-center justify-between text-xs font-bold text-cyan-400">
              <span>🫀 التشخيص الحالي</span>
              <span class="text-slate-400 font-mono">15 أكتوبر 2024</span>
            </div>
            <h4 class="font-extrabold text-sm text-white">ارتفاع ضغط الدم الشرياني واضطراب هضمي</h4>
            <p class="text-xs text-slate-300 leading-relaxed">
              يعاني المريض من نوبات صداع متكررة مع تسارع طفيف في ضربات القلب وحرقة معدية بعد الوجبات الدسمة.
            </p>
          </div>

          <div class="glass-panel p-4 space-y-2">
            <div class="flex items-center justify-between text-xs font-bold text-amber-400">
              <span>⚠️ التحذيرات والحساسية</span>
              <span class="text-rose-400 font-mono">تنبيه حرج</span>
            </div>
            <div class="flex flex-wrap gap-2 pt-1">
              <span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">حساسية بنسلين (Penicillin Allergy)</span>
              <span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">تجنب مضادات الالتهاب اللاستيرويدية NSAIDs</span>
            </div>
          </div>

        </div>

        <!-- Prescribed Current Meds in EMR -->
        <div class="glass-panel p-5 space-y-3">
          <h4 class="font-black text-sm text-white flex items-center gap-2">
            <span>💊</span> <span>العلاج والبروتوكول الفعال حالياً</span>
          </h4>
          <div class="divide-y divide-white/5 text-xs">
            <div class="py-2.5 flex items-center justify-between">
              <div>
                <span class="font-extrabold text-white text-sm">Concor 40 mg (Concor Cor 2.5mg)</span>
                <p class="text-slate-400">قرص واحد يومياً في الصباح قبل الإفطار لضبط النبض والضغط</p>
              </div>
              <span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">نشط</span>
            </div>
            <div class="py-2.5 flex items-center justify-between">
              <div>
                <span class="font-extrabold text-white text-sm">Controloc 40 mg (Pantoprazole)</span>
                <p class="text-slate-400">قرص يومياً على الريق قبل الفطور بنصف ساعة لحماية المعدة</p>
              </div>
              <span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">نشط</span>
            </div>
          </div>
        </div>

      </div>

    </div>

    <!-- =======================================================================
         VIEW 5: OFFICIAL LUXURY PRESCRIPTION RX A4 (الروشتة الطبية)
         ======================================================================= -->
    <div id="view-rx" class="view-screen hidden max-w-3xl mx-auto space-y-6">
      
      <!-- Toolbar -->
      <div class="flex items-center justify-between gap-4">
        <div>
          <h3 class="font-black text-lg">الروشتة الطبية الإلكترونية الرسمية</h3>
          <p class="text-xs text-slate-400">نموذج فاخر مجهز للطباعة الفورية والمشاركة عبر واتساب</p>
        </div>
        <div class="flex items-center gap-2">
          <button type="button" onclick="window.print()" class="ios-btn-primary px-4 py-2 text-xs font-bold">
            <span>🖨️</span> <span>طباعة A4</span>
          </button>
          <a href="https://wa.me/201017320478" target="_blank" class="ios-btn-glass px-4 py-2 text-xs font-bold text-emerald-400">
            <span>💬</span> <span>إرسال لواتساب المريض</span>
          </a>
        </div>
      </div>

      <!-- A4 Sheet Container -->
      <div class="glass-panel p-8 md:p-12 relative overflow-hidden bg-slate-900/90 text-white border-2 border-cyan-400/30 shadow-2xl">
        
        <!-- Header: Doctor & Clinic Letterhead -->
        <div class="flex items-start justify-between border-b-2 border-cyan-400/40 pb-6 mb-6">
          <div class="space-y-1">
            <h2 class="text-2xl font-black text-white">د. أحمد عبد العزيز</h2>
            <p class="text-xs font-extrabold text-cyan-400">استشاري القلب الباطني والجهاز الهضمي والمناظير</p>
            <p class="text-[11px] text-slate-400">زميل الكلية الملكية للأطباء • عضو الجمعية الأوروبية لأمراض القلب</p>
          </div>
          <div class="text-end">
            <div class="text-xl font-black text-cyan-300">يلا كلينيك</div>
            <p class="text-[10px] text-slate-400">YALLA CLINIC MEDICAL SYSTEMS</p>
            <p class="text-[10px] font-mono text-cyan-400 mt-1">Rx-ID: #2024-88419</p>
          </div>
        </div>

        <!-- Patient Metadata Bar -->
        <div class="p-3.5 rounded-2xl bg-white/5 border border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-8">
          <div><span class="text-slate-400 block text-[10px]">اسم المريض:</span> <span class="font-bold">محمد أحمد علي</span></div>
          <div><span class="text-slate-400 block text-[10px]">السن:</span> <span class="font-bold">28 سنة</span></div>
          <div><span class="text-slate-400 block text-[10px]">التاريخ:</span> <span class="font-bold">15 أكتوبر 2024</span></div>
          <div><span class="text-slate-400 block text-[10px]">نوع الكشف:</span> <span class="font-bold text-cyan-300">كشف قلب وباطنة</span></div>
        </div>

        <!-- Rx Symbol & Medication Items -->
        <div class="space-y-6 min-h-[280px]">
          <div class="text-3xl font-black text-cyan-400 font-serif italic">℞</div>

          <!-- Medication 1 -->
          <div class="ps-6 border-s-2 border-cyan-400/50 space-y-1">
            <div class="flex items-center gap-2">
              <span class="font-black text-base text-white">1 - Concor 40 mg (Bisoprolol)</span>
              <span class="text-[10px] px-2 py-0.5 rounded bg-cyan-400/20 text-cyan-300">أقراص</span>
            </div>
            <p class="text-xs text-slate-300">قرص واحد يومياً قبل الإفطار صباحاً بانتظام</p>
          </div>

          <!-- Medication 2 -->
          <div class="ps-6 border-s-2 border-cyan-400/50 space-y-1">
            <div class="flex items-center gap-2">
              <span class="font-black text-base text-white">2 - Hibiotic 1g (Amoxicillin / Clavulanic Acid)</span>
              <span class="text-[10px] px-2 py-0.5 rounded bg-cyan-400/20 text-cyan-300">أقراص</span>
            </div>
            <p class="text-xs text-slate-300">قرص كل 12 ساعة بعد الأكل لمدة 8 أيام متواصلة</p>
          </div>
        </div>

        <!-- Footer: Doctor Signature & QR Verification -->
        <div class="pt-8 border-t border-white/10 flex items-end justify-between">
          <div class="space-y-1 text-[11px] text-slate-400">
            <p>📍 الفرع الرئيسي: شارع المعسكر القبلي - أسوان</p>
            <p>📞 هاتف العيادة والواتساب: 01002356579 • 01550700425</p>
            <p class="text-[10px] text-emerald-400">✓ روشتة إلكترونية مؤمنة ومعتمدة رقمياً</p>
          </div>
          
          <div class="text-center">
            <!-- Simulated Stamp & Signature -->
            <div class="w-28 h-12 border border-cyan-400/30 rounded-xl flex items-center justify-center text-xs font-serif italic text-cyan-300 rotate-[-4deg] mb-1">
              د. أحمد عبد العزيز
            </div>
            <span class="text-[10px] text-slate-400">توقيع واعتماد الطبيب</span>
          </div>
        </div>

      </div>

    </div>

    <!-- =======================================================================
         VIEW 6: EGYPTIAN DRUG DIRECTORY (دليل وقاعدة الأدوية)
         ======================================================================= -->
    <div id="view-drugs" class="view-screen hidden space-y-6">
      
      <div class="glass-panel p-6 space-y-6">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 class="text-xl font-black">دليل الأدوية والأسعار المصرية</h3>
            <p class="text-xs text-slate-400">قاعدة بيانات معتمدة بالمواد الفعالة والجرعات والأسعار الرسمية</p>
          </div>
          <div class="w-full sm:w-72 relative">
            <input type="text" placeholder="ابحث باسم الدواء التجاري أو العلمي..." class="w-full px-4 py-2.5 ps-9 rounded-xl text-xs bg-white/5 border border-[var(--glass-border)] text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400">
            <span class="absolute top-3 start-3 text-slate-400 text-xs">🔍</span>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <!-- Drug 1: Concor -->
          <div class="glass-panel p-4 space-y-2 hover:border-cyan-400 transition-all">
            <div class="flex items-center justify-between text-xs font-bold">
              <span class="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300">أدوية القلب</span>
              <span class="text-white font-mono font-bold">54.00 ج.م</span>
            </div>
            <h4 class="font-extrabold text-sm text-white">Concor 40 mg (5mg)</h4>
            <p class="text-xs text-slate-400 font-mono">Bisoprolol Fumarate</p>
            <p class="text-[11px] text-slate-300">شركة Merck • علبة 30 قرص</p>
            <button type="button" onclick="showNotification('تمت إضافة Concor للروشتة')" class="ios-btn-glass w-full py-1.5 text-xs font-bold mt-2">+ إضافة للروشتة</button>
          </div>

          <!-- Drug 2: Hibiotic -->
          <div class="glass-panel p-4 space-y-2 hover:border-cyan-400 transition-all">
            <div class="flex items-center justify-between text-xs font-bold">
              <span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">مضاد حيوي</span>
              <span class="text-white font-mono font-bold">115.00 ج.م</span>
            </div>
            <h4 class="font-extrabold text-sm text-white">Hibiotic 1 g</h4>
            <p class="text-xs text-slate-400 font-mono">Amoxicillin + Clavulanic Acid</p>
            <p class="text-[11px] text-slate-300">شركة Amoun • علبة 16 قرص</p>
            <button type="button" onclick="showNotification('تمت إضافة Hibiotic للروشتة')" class="ios-btn-glass w-full py-1.5 text-xs font-bold mt-2">+ إضافة للروشتة</button>
          </div>

          <!-- Drug 3: Cetal -->
          <div class="glass-panel p-4 space-y-2 hover:border-cyan-400 transition-all">
            <div class="flex items-center justify-between text-xs font-bold">
              <span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">مسكن وخافض</span>
              <span class="text-white font-mono font-bold">28.50 ج.م</span>
            </div>
            <h4 class="font-extrabold text-sm text-white">Cetal 500 mg</h4>
            <p class="text-xs text-slate-400 font-mono">Paracetamol</p>
            <p class="text-[11px] text-slate-300">شركة EIPICO • علبة 20 قرص</p>
            <button type="button" onclick="showNotification('تمت إضافة Cetal للروشتة')" class="ios-btn-glass w-full py-1.5 text-xs font-bold mt-2">+ إضافة للروشتة</button>
          </div>

          <!-- Drug 4: Capoten -->
          <div class="glass-panel p-4 space-y-2 hover:border-cyan-400 transition-all">
            <div class="flex items-center justify-between text-xs font-bold">
              <span class="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">ضغط الدم</span>
              <span class="text-white font-mono font-bold">42.00 ج.م</span>
            </div>
            <h4 class="font-extrabold text-sm text-white">Capoten 25 mg</h4>
            <p class="text-xs text-slate-400 font-mono">Captopril</p>
            <p class="text-[11px] text-slate-300">شركة Bristol-Myers Squibb</p>
            <button type="button" onclick="showNotification('تمت إضافة Capoten للروشتة')" class="ios-btn-glass w-full py-1.5 text-xs font-bold mt-2">+ إضافة للروشتة</button>
          </div>

        </div>
      </div>

    </div>

    <!-- =======================================================================
         VIEW 7: FINANCIAL ANALYTICS & SPLINE CHART (التقارير المالية)
         ======================================================================= -->
    <div id="view-finance" class="view-screen hidden space-y-6">
      
      <!-- Financial Top Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="glass-panel p-5">
          <span class="text-xs text-slate-400 font-semibold block mb-1">إجمالي الإيرادات الشهرية</span>
          <div class="flex items-baseline gap-2">
            <span class="text-3xl font-black text-cyan-400">64,230</span>
            <span class="text-xs text-slate-400 font-bold">ج.م</span>
          </div>
          <span class="text-xs text-emerald-400 font-semibold block mt-2">↑ +14.2% نمو سنوي</span>
        </div>
        <div class="glass-panel p-5">
          <span class="text-xs text-slate-400 font-semibold block mb-1">الزيارات المكتملة</span>
          <span class="text-3xl font-black text-white">242</span>
          <span class="text-xs text-slate-400 font-semibold block mt-2">خلال الشهر الحالي</span>
        </div>
        <div class="glass-panel p-5">
          <span class="text-xs text-slate-400 font-semibold block mb-1">إجمالي الكشوفات والاستشارات</span>
          <span class="text-3xl font-black text-white">223</span>
          <span class="text-xs text-slate-400 font-semibold block mt-2">معدل تحصيل 98%</span>
        </div>
        <div class="glass-panel p-5">
          <span class="text-xs text-slate-400 font-semibold block mb-1">صافي الأرباح التشغيلية</span>
          <div class="flex items-baseline gap-2">
            <span class="text-3xl font-black text-emerald-400">48,900</span>
            <span class="text-xs text-slate-400 font-bold">ج.م</span>
          </div>
          <span class="text-xs text-slate-400 font-semibold block mt-2">بعد خصم المصروفات</span>
        </div>
      </div>

      <!-- Glowing Spline Revenue Curve Chart -->
      <div class="glass-panel p-6 space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-base font-black">منحنى الإيرادات اليومية وتوزيع التحصيل</h3>
            <p class="text-xs text-slate-400">مخطط بياني بالمسارات المتوهجة للتدفقات النقدية</p>
          </div>
          <span class="px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">شهر أكتوبر 2024</span>
        </div>

        <!-- Liquid SVG Glowing Pathway Chart -->
        <div class="h-64 relative flex items-center justify-center">
          <svg class="w-full h-full overflow-visible" viewBox="0 0 800 240">
            <defs>
              <linearGradient id="neonGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#00F0FF" stop-opacity="0.5"/>
                <stop offset="100%" stop-color="#087CF4" stop-opacity="0.0"/>
              </linearGradient>
              <filter id="glowFilter" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="6" result="blur"/>
                <feComposite in="SourceGraphic" in2="blur" operator="over"/>
              </filter>
            </defs>

            <!-- Grid Lines -->
            <line x1="40" y1="40" x2="760" y2="40" stroke="rgba(255,255,255,0.06)" stroke-dasharray="4"/>
            <line x1="40" y1="100" x2="760" y2="100" stroke="rgba(255,255,255,0.06)" stroke-dasharray="4"/>
            <line x1="40" y1="160" x2="760" y2="160" stroke="rgba(255,255,255,0.06)" stroke-dasharray="4"/>
            <line x1="40" y1="220" x2="760" y2="220" stroke="rgba(255,255,255,0.1)"/>

            <!-- Area Fill -->
            <path d="M 40 220 C 140 180, 200 60, 320 80 C 440 100, 520 30, 640 50 C 700 60, 740 30, 760 40 L 760 220 L 40 220 Z" fill="url(#neonGradient)"/>

            <!-- Glowing Curve Stroke -->
            <path d="M 40 220 C 140 180, 200 60, 320 80 C 440 100, 520 30, 640 50 C 700 60, 740 30, 760 40" fill="none" stroke="#00F0FF" stroke-width="4" filter="url(#glowFilter)" stroke-linecap="round"/>

            <!-- Glowing Data Points -->
            <circle cx="320" cy="80" r="6" fill="#030712" stroke="#00F0FF" stroke-width="3" filter="url(#glowFilter)"/>
            <circle cx="640" cy="50" r="6" fill="#030712" stroke="#00F0FF" stroke-width="3" filter="url(#glowFilter)"/>
            <circle cx="760" cy="40" r="7" fill="#00F0FF" stroke="#FFFFFF" stroke-width="2" class="pulse-glow"/>
          </svg>
        </div>

        <div class="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-[var(--glass-border)] font-mono">
          <span>1 أكتوبر</span>
          <span>7 أكتوبر</span>
          <span>15 أكتوبر (اليوم: 4,650 ج.م)</span>
          <span>22 أكتوبر</span>
          <span>31 أكتوبر</span>
        </div>
      </div>

    </div>

    <!-- =======================================================================
         VIEW 8: INTERACTIVE BOOKING MODAL (نافذة الحجز التفاعلية)
         ======================================================================= -->
    <div id="view-booking-modal" class="view-screen hidden max-w-xl mx-auto space-y-6">
      
      <div class="glass-panel p-6 sm:p-8 space-y-6 cyber-beam">
        
        <div class="flex items-center justify-between pb-4 border-b border-[var(--glass-border)]">
          <div>
            <h3 class="text-xl font-black">حجز موعد كشف جديد</h3>
            <p class="text-xs text-slate-400">عيادة د. أحمد عبد العزيز - استشاري القلب والباطنة</p>
          </div>
          <button type="button" onclick="switchView('dashboard')" class="text-slate-400 hover:text-white text-lg">✕</button>
        </div>

        <!-- 3-Step Animated Stepper -->
        <div class="flex items-center justify-between relative">
          <div class="flex flex-col items-center gap-1 z-10">
            <span class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs bg-cyan-400 text-slate-950 font-bold">1</span>
            <span class="text-[11px] text-cyan-300 font-bold">البيانات</span>
          </div>
          <div class="flex-1 h-0.5 bg-cyan-400/40 mx-2"></div>
          <div class="flex flex-col items-center gap-1 z-10">
            <span class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs bg-white/10 text-white border border-white/20">2</span>
            <span class="text-[11px] text-slate-400">الخدمة</span>
          </div>
          <div class="flex-1 h-0.5 bg-white/10 mx-2"></div>
          <div class="flex flex-col items-center gap-1 z-10">
            <span class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs bg-white/10 text-white border border-white/20">3</span>
            <span class="text-[11px] text-slate-400">التأكيد</span>
          </div>
        </div>

        <!-- Step 1 Content: Branch & Personal Details -->
        <div class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-slate-300 mb-1.5">اختر الفرع الطبي *</label>
            <select class="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white/5 border border-[var(--glass-border)] text-white focus:outline-none focus:border-cyan-400">
              <option value="main" class="bg-slate-900">الفرع الرئيسي (أسوان - شارع المعسكر القبلي)</option>
              <option value="nasr" class="bg-slate-900">فرع مدينة نصر (القاهرة - بجوار المستشفى التخصصي)</option>
              <option value="cairo" class="bg-slate-900">فرع التجمع الخامس (القاهرة الجديدة)</option>
            </select>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-300 mb-1.5">اسم المريض ثلاثي *</label>
              <input type="text" placeholder="مثال: محمد أحمد علي" value="محمد أحمد علي" class="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white/5 border border-[var(--glass-border)] text-white focus:outline-none focus:border-cyan-400">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-300 mb-1.5">رقم الهاتف (واتساب) *</label>
              <input type="text" placeholder="01017320478" value="01017320478" class="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white/5 border border-[var(--glass-border)] text-white focus:outline-none focus:border-cyan-400">
            </div>
          </div>

          <!-- Consultation Service Selection -->
          <div>
            <label class="block text-xs font-bold text-slate-300 mb-2">نوع الكشف والخدمة *</label>
            <div class="grid grid-cols-3 gap-2 text-center text-xs">
              <div class="p-3 rounded-xl border border-cyan-400 bg-cyan-500/10 cursor-pointer font-bold text-cyan-300">
                <span>🩺</span> <span class="block mt-1">كشف عادي</span>
                <span class="text-[10px] text-slate-400">350 ج.م</span>
              </div>
              <div class="p-3 rounded-xl border border-white/10 bg-white/5 cursor-pointer text-slate-300 hover:border-cyan-400">
                <span>⚡</span> <span class="block mt-1">استشارة سريعة</span>
                <span class="text-[10px] text-slate-400">200 ج.م</span>
              </div>
              <div class="p-3 rounded-xl border border-white/10 bg-white/5 cursor-pointer text-slate-300 hover:border-cyan-400">
                <span>🏠</span> <span class="block mt-1">كشف منزلي</span>
                <span class="text-[10px] text-slate-400">800 ج.م</span>
              </div>
            </div>
          </div>

          <!-- Time Slots -->
          <div>
            <label class="block text-xs font-bold text-slate-300 mb-2">المواعيد المتاحة لليوم (الثلاثاء 15 أكتوبر) *</label>
            <div class="grid grid-cols-4 gap-2 text-xs font-mono font-bold text-center">
              <div class="py-2 rounded-xl bg-cyan-400 text-slate-950 shadow-md">10:00 ص</div>
              <div class="py-2 rounded-xl bg-white/5 text-slate-300 border border-white/10 hover:border-cyan-400 cursor-pointer">11:00 ص</div>
              <div class="py-2 rounded-xl bg-white/5 text-slate-300 border border-white/10 hover:border-cyan-400 cursor-pointer">12:00 م</div>
              <div class="py-2 rounded-xl bg-white/5 text-slate-300 border border-white/10 hover:border-cyan-400 cursor-pointer">01:00 م</div>
            </div>
          </div>

          <button type="button" onclick="playChime(); showNotification('تم تأكيد الحجز وإدراج المريض في الطابور برقم #6'); switchView('dashboard');" class="ios-btn-primary w-full py-3.5 text-xs font-extrabold shadow-xl mt-2">
            <span>تأكيد الحجز والحصول على رقم الدور ➔</span>
          </button>
        </div>

      </div>

    </div>

    <!-- =======================================================================
         VIEW 9: FULL MOSAIC COLLAGE (Exact image_0.png layout reconstructed!)
         ======================================================================= -->
    <div id="view-collage" class="view-screen hidden space-y-8">
      <div class="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-400/30 text-center text-xs text-cyan-300 font-bold mb-4">
        ✨ تم تجميع وعرض كافة وحدات نظام يلا كلينيك (Clinic OS) في واجهة موحدة تطابق تكوين image_0.png ولكن بفخامة الزجاج المتقدم (Glassmorphism) وعناصر Apple iOS.
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <!-- Landing Hero Left Preview (4 cols) -->
        <div class="xl:col-span-4 glass-panel p-6 space-y-4">
          <div class="text-xs font-bold text-cyan-400 uppercase">موقع العيادة الموجه للجمهور</div>
          <h3 class="text-xl font-black">احجز موعدك بكل سهولة في عيادة د. أحمد عبد العزيز</h3>
          <p class="text-xs text-slate-300">استشاري القلب الباطني والجهاز الهضمي والمناظير</p>
          <img src="https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&auto=format&fit=crop&q=80" class="w-full h-48 rounded-2xl object-cover border border-cyan-400/30">
          <button type="button" onclick="switchView('landing')" class="ios-btn-primary w-full py-2 text-xs font-bold">معاينة الصفحة كاملة</button>
        </div>

        <!-- Dashboard Center Preview (8 cols) -->
        <div class="xl:col-span-8 glass-panel p-6 space-y-4">
          <div class="flex items-center justify-between text-xs font-bold text-slate-400">
            <span>لوحة تحكم الطبيب والاستقبال الذكية</span>
            <span class="text-cyan-400">24 حجز • 6 بالانتظار • 4,650 ج.م</span>
          </div>
          <div class="p-4 rounded-2xl bg-white/5 border border-cyan-400/40 flex items-center justify-between">
            <div>
              <span class="text-[10px] text-cyan-400 font-bold">المريض الحالي #6</span>
              <h4 class="text-base font-black">محمد أحمد علي (28 سنة)</h4>
            </div>
            <button type="button" onclick="switchView('dashboard')" class="ios-btn-primary px-4 py-2 text-xs font-bold">فتح لوحة التحكم</button>
          </div>
        </div>
      </div>
    </div>

  </main>

  <!-- Interactive Toast Notification Center -->
  <div id="toastNotification" class="fixed bottom-6 end-6 z-50 glass-panel-elevated px-4 py-3 text-xs font-bold text-white border-cyan-400 shadow-2xl flex items-center gap-3 transition-all duration-300 opacity-0 translate-y-6 pointer-events-none">
    <span class="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping"></span>
    <span id="toastMessage">إشعار النظام</span>
  </div>

  <!-- =========================================================================
       AUDIO & INTERACTION SCRIPTS
       ========================================================================= -->
  <script>
    // Audio Synthesizer (Web Audio API) for Subtle Apple Clicks & Chimes
    let audioCtx = null;
    function playChime() {
      try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.12); // A5
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.25);
      } catch (e) {
        // Fallback silent
      }
    }

    // Toast Notification Dispatcher
    function showNotification(msg) {
      const toast = document.getElementById('toastNotification');
      const text = document.getElementById('toastMessage');
      if (toast && text) {
        text.innerText = msg;
        toast.classList.remove('opacity-0', 'translate-y-6', 'pointer-events-none');
        toast.classList.add('opacity-100', 'translate-y-0');
        setTimeout(() => {
          toast.classList.add('opacity-0', 'translate-y-6', 'pointer-events-none');
          toast.classList.remove('opacity-100', 'translate-y-0');
        }, 3200);
      }
    }

    // View Switcher (Handles all 8 screens)
    function switchView(viewId) {
      playChime();
      // Hide all view screens
      document.querySelectorAll('.view-screen').forEach(screen => {
        screen.classList.add('hidden');
      });

      // Show target screen
      const targetScreen = document.getElementById('view-' + viewId);
      if (targetScreen) {
        targetScreen.classList.remove('hidden');
      }

      // Update Nav Button Active States
      document.querySelectorAll('nav button').forEach(btn => {
        btn.classList.remove('ios-pill-active');
        btn.classList.add('ios-btn-glass');
      });

      const activeBtn = document.getElementById('btn-view-' + viewId);
      if (activeBtn) {
        activeBtn.classList.remove('ios-btn-glass');
        activeBtn.classList.add('ios-pill-active');
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Language Toggle (Arabic / English)
    let currentLang = 'ar';
    function toggleLanguage() {
      playChime();
      currentLang = currentLang === 'ar' ? 'en' : 'ar';
      const htmlEl = document.documentElement;
      const langBtn = document.getElementById('langBtnText');

      if (currentLang === 'en') {
        htmlEl.setAttribute('dir', 'ltr');
        htmlEl.setAttribute('lang', 'en');
        if (langBtn) langBtn.innerText = 'عربي';
        document.querySelectorAll('[data-en]').forEach(el => {
          el.innerText = el.getAttribute('data-en');
        });
      } else {
        htmlEl.setAttribute('dir', 'rtl');
        htmlEl.setAttribute('lang', 'ar');
        if (langBtn) langBtn.innerText = 'EN';
        document.querySelectorAll('[data-ar]').forEach(el => {
          el.innerText = el.getAttribute('data-ar');
        });
      }
    }

    // Theme Toggle (Dark Obsidian Glass vs Light Crystal Frost Glass)
    let currentTheme = 'dark';
    function toggleTheme() {
      playChime();
      currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', currentTheme);
      const icon = document.getElementById('themeBtnIcon');
      if (icon) icon.innerText = currentTheme === 'dark' ? '🌙' : '☀️';
    }

    // Anti-Gravity Particle Canvas Engine
    let particlesEnabled = true;
    function toggleAntiGravity() {
      playChime();
      particlesEnabled = !particlesEnabled;
      const canvas = document.getElementById('antiGravityCanvas');
      const btn = document.getElementById('btn-particle-toggle');
      if (canvas) canvas.style.display = particlesEnabled ? 'block' : 'none';
      if (btn) btn.querySelector('span:last-child').innerText = particlesEnabled ? 'Physics ON' : 'Physics OFF';
    }

    (function initParticleEngine() {
      const canvas = document.getElementById('antiGravityCanvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      let width = canvas.width = window.innerWidth;
      let height = canvas.height = window.innerHeight;

      window.addEventListener('resize', () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
      });

      const particleCount = 65;
      const particles = [];

      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          radius: Math.random() * 2.2 + 0.6,
          speedY: -(Math.random() * 0.45 + 0.15),
          speedX: (Math.random() - 0.5) * 0.25,
          alpha: Math.random() * 0.5 + 0.2,
          color: Math.random() > 0.5 ? '0, 240, 255' : '168, 85, 247'
        });
      }

      function render() {
        if (particlesEnabled) {
          ctx.clearRect(0, 0, width, height);

          for (let i = 0; i < particleCount; i++) {
            const p = particles[i];
            p.y += p.speedY;
            p.x += p.speedX;

            if (p.y < 0) {
              p.y = height + 10;
              p.x = Math.random() * width;
            }
            if (p.x < 0) p.x = width;
            if (p.x > width) p.x = 0;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(' + p.color + ', ' + p.alpha + ')';
            ctx.shadowBlur = 8;
            ctx.shadowColor = 'rgba(' + p.color + ', 0.8)';
            ctx.fill();
          }
        }
        requestAnimationFrame(render);
      }
      render();
    })();
  </script>
</body>
</html>`;

fs.writeFileSync(targetArtifactPath, htmlContent, 'utf8');
console.log("Successfully wrote artifact:", targetArtifactPath);

fs.writeFileSync(targetPublicPath, htmlContent, 'utf8');
console.log("Successfully wrote public preview:", targetPublicPath);
