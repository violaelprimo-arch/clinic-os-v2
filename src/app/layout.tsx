import type { Metadata, Viewport } from "next"
import { Cairo, Inter } from "next/font/google"
import "./globals.css"
import { Toaster } from 'sonner'
import { PwaRegistrar } from '@/components/pwa/PwaRegistrar'
import { ThemeProvider } from '@/context/ThemeContext'
import { LanguageProvider } from '@/context/LanguageContext'

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-cairo",
  display: "swap"
})

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap"
})

export const metadata: Metadata = {
  title: "Yalla Clinic - نظام العيادات الذكي",
  description: "أقوى نظام إدارة العيادات وحجز المواعيد والروشتات الطبية",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Yalla Clinic"
  },
  icons: {
    icon: [
      { url: "/brand/yalla-clinic/app-icon.png" },
      { url: "/yalla-clinic-icon.png" },
      { url: "/favicon.png" }
    ],
    shortcut: "/brand/yalla-clinic/app-icon.png",
    apple: "/brand/yalla-clinic/app-icon.png"
  }
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#087CF4"
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/yalla-clinic-icon.png" type="image/png" />
        <link rel="shortcut icon" href="/yalla-clinic-icon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/yalla-clinic-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var t = localStorage.getItem('clinic_os_theme');
                  if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('dark');
                    document.documentElement.style.colorScheme = 'dark';
                  } else {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.style.colorScheme = 'light';
                  }
                  var l = localStorage.getItem('clinic_os_lang');
                  if (l === 'en') {
                    document.documentElement.lang = 'en';
                    document.documentElement.dir = 'ltr';
                  } else {
                    document.documentElement.lang = 'ar';
                    document.documentElement.dir = 'rtl';
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={`${cairo.variable} ${inter.variable} ${cairo.className} antialiased`} suppressHydrationWarning>
        <ThemeProvider>
          <LanguageProvider>
            <PwaRegistrar />
            {children}
            <Toaster position="top-center" />
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
