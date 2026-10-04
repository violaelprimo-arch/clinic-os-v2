import type { Metadata } from "next"
import { Cairo } from "next/font/google"
import "./globals.css"
import { Toaster } from 'sonner'

const cairo = Cairo({ subsets: ["arabic", "latin"] })

export const metadata: Metadata = {
  title: "Clinic OS V2 - نظام العيادات الذكي",
  description: "أقوى نظام إدارة العيادات وحجز المواعيد",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={cairo.className} suppressHydrationWarning>
        {children}
        <Toaster position="top-center" dir="rtl" />
      </body>
    </html>
  )
}
