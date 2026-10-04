import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="text-center max-w-2xl space-y-6">
        <h1 className="text-5xl font-black text-primary">Clinic OS</h1>
        <p className="text-xl text-slate-600">
          النظام الأذكى لإدارة العيادات في العالم العربي.
        </p>
        <div className="pt-8 flex gap-4 justify-center">
          <Link href="/clinic/demo/login">
            <Button size="lg" className="h-14 px-8 text-lg font-bold">
              دخول كطبيب (تجربة)
            </Button>
          </Link>
          <Link href="/clinic/demo">
            <Button size="lg" variant="outline" className="h-14 px-8 text-lg font-bold">
              تجربة حجز مريض
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
