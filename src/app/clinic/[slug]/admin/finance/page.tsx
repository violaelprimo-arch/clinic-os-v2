'use client'

import { use, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Printer, TrendingUp, Users } from 'lucide-react'
import { toast } from 'sonner'

export default function FinancePage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug
  const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0])
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0])
  const [report, setReport] = useState<any[]>([])
  const [totals, setTotals] = useState({ revenue: 0, patients: 0 })
  const [isLoading, setIsLoading] = useState(false)

  const generateReport = async () => {
    setIsLoading(true)
    setTimeout(() => {
      setReport([])
      setTotals({ revenue: 0, patients: 0 })
      setIsLoading(false)
      toast.success('تم إنشاء التقرير المالي بنجاح')
    }, 1000)
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary">التقارير المالية</h1>
          <p className="text-gray-500">استخراج تقرير بالأرباح وعدد الكشوفات</p>
        </div>
        <Button variant="outline" className="print:hidden" onClick={() => window.print()}>
          <Printer className="w-5 h-5 ml-2" />
          طباعة التقرير
        </Button>
      </div>

      <Card className="print:hidden">
        <CardContent className="pt-6 flex flex-col md:flex-row gap-4 items-end">
          <div className="space-y-2 w-full">
            <label className="text-sm font-semibold">من تاريخ</label>
            <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div className="space-y-2 w-full">
            <label className="text-sm font-semibold">إلى تاريخ</label>
            <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          <Button onClick={generateReport} disabled={isLoading} className="w-full md:w-auto h-10 px-8">
            توليد
          </Button>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="bg-primary text-primary-foreground">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-primary-foreground/80 font-medium">إجمالي الإيرادات</p>
              <h3 className="text-4xl font-black mt-2">{totals.revenue} ج.م</h3>
            </div>
            <TrendingUp className="w-12 h-12 opacity-50" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-gray-500 font-medium">عدد الحالات المنجزة</p>
              <h3 className="text-4xl font-black mt-2 text-slate-800">{totals.patients} مريض</h3>
            </div>
            <Users className="w-12 h-12 text-slate-200" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>سجل الكشوفات</CardTitle>
          <CardDescription>الفترة من {fromDate} إلى {toDate}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="p-4 rounded-r-lg">التاريخ</th>
                  <th className="p-4">نوع الخدمة</th>
                  <th className="p-4 rounded-l-lg">القيمة (ج.م)</th>
                </tr>
              </thead>
              <tbody>
                {report.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-gray-500">لا توجد بيانات مالية في هذه الفترة.</td>
                  </tr>
                ) : (
                  report.map((item, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="p-4 font-medium">{item.date}</td>
                      <td className="p-4">{item.service}</td>
                      <td className="p-4 font-bold text-green-600">{item.price}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
