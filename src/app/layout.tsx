import type { Metadata } from "next"
import { Cairo } from "next/font/google"
import "./globals.css"
import { Toaster } from 'sonner'
import { PwaRegistrar } from '@/components/pwa/PwaRegistrar'

const cairo = Cairo({ subsets: ["arabic", "latin"] })

export const metadata: Metadata = {
  title: "Clinic OS V2 - نظام العيادات الذكي",
  description: "أقوى نظام إدارة العيادات وحجز المواعيد والروشتات الطبية",
  manifest: "/manifest.json",
  themeColor: "#15B8A6",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Clinic OS"
  },
  icons: {
    icon: "/icons/icon-192.svg",
    apple: "/icons/icon-192.svg"
  }
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#15B8A6"
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
      </head>
      <body className={cairo.className} suppressHydrationWarning>
        <PwaRegistrar />
        {children}
        <Toaster position="top-center" dir="rtl" />
      </body>
    </html>
  )
}
