import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Yalla Clinic OS — يلا كلينيك | نظام إدارة العيادات والمراكز الطبية',
  description: 'معاينة التصميم التفاعلي المتكامل لمنظومة يلا كلينيك',
}

export default function PreviewPage() {
  return (
    <main className="fixed inset-0 w-screen h-screen overflow-hidden bg-background">
      <iframe
        src="/yalla_clinic_os.html"
        className="w-full h-full border-0"
        title="Yalla Clinic OS — يلا كلينيك"
      />
    </main>
  )
}
