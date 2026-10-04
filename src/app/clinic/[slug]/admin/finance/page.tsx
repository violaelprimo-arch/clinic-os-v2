'use client'

import { use, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Printer, TrendingUp, Users, Wallet, CreditCard, Banknote } from 'lucide-react'
import { toast } from 'sonner'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'

export default function FinancePage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug
  const getLocalDate = () => new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]
  const [fromDate, setFromDate] = useState(getLocalDate())
  const [toDate, setToDate] = useState(getLocalDate())
  const [report, setReport] = useState<any[]>([])
  
  const [totals, setTotals] = useState({ 
    revenue: 0, 
    patients: 0, 
    cash: 0, 
    wallet: 0, 
    instapay: 0 
  })
  const [isLoading, setIsLoading] = useState(false)
  const [clinicId, setClinicId] = useState<string>('')

  const generateReport = async () => {
    setIsLoading(true)
    try {
      // Get clinic ID
      const cQ = query(collection(db, 'clinics'), where('slug', '==', slug))
      const cSnap = await getDocs(cQ)
      if (cSnap.empty) {
        setIsLoading(false)
        return toast.error('العيادة غير موجودة')
      }
      const cId = cSnap.docs[0].id
      setClinicId(cId)

      // Fetch Appointments (Query by clinic_id, filter dates locally to avoid composite index requirement)
      const q = query(
        collection(db, 'appointments'),
        where('clinic_id', '==', cId)
      )
      const snapshot = await getDocs(q)
      
      let rev = 0
      let csh = 0
      let wllt = 0
      let inst = 0
      const appts = snapshot.docs
        .map(d => {
          const data = d.data()
          return { id: d.id, ...data } as any
        })
        .filter(d => d.date >= fromDate && d.date <= toDate && d.paymentStatus === 'paid')

      appts.forEach(data => {
        const price = data.servicePrice || 0
        rev += price
        
        if (data.paymentMethod === 'wallet') wllt += price
        else if (data.paymentMethod === 'instapay') inst += price
        else csh += price
      })

      setReport(appts)
      setTotals({ revenue: rev, patients: appts.length, cash: csh, wallet: wllt, instapay: inst })
      toast.success('تم إنشاء التقرير המالي بنجاح')
    } catch (err) {
      toast.error('حدث خطأ أثناء تحميل التقرير')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto" dir="rtl">
      <div className="flex justify-between items-center print:hidden">
        <div>
          <h1 className="text-3xl font-bold text-primary">التقارير المالية</h1>
          <p className="text-slate-500">متابعة إيرادات العيادة وحجم العمليات</p>
        </div>
        <Button variant="outline" onClick={() => window.print()} className="font-bold">
          <Printer className="w-4 h-4 ml-2" /> طباعة التقرير
        </Button>
      </div>

      <Card className="print:hidden shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 space-y-2 w-full">
              <Label className="font-bold">من تاريخ</Label>
              <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
            </div>
            <div className="flex-1 space-y-2 w-full">
              <Label className="font-bold">إلى تاريخ</Label>
              <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
            </div>
            <Button onClick={generateReport} disabled={isLoading} className="w-full md:w-auto px-8 font-bold">
              {isLoading ? 'جاري التحميل...' : 'عرض التقرير'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-4 gap-4">
        <Card className="bg-primary text-primary-foreground shadow-lg">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-primary-foreground/80 font-semibold mb-1">إجمالي الإيرادات</p>
                <h3 className="text-3xl font-black">{totals.revenue} ج.م</h3>
              </div>
              <TrendingUp className="w-8 h-8 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-t-4 border-t-green-500">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-500 font-semibold mb-1">نقدي (كاش بالعيادة)</p>
                <h3 className="text-2xl font-black text-slate-800">{totals.cash} ج.م</h3>
              </div>
              <Banknote className="w-6 h-6 text-green-500 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-t-4 border-t-blue-500">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-500 font-semibold mb-1">فودافون كاش</p>
                <h3 className="text-2xl font-black text-slate-800">{totals.wallet} ج.م</h3>
              </div>
              <Wallet className="w-6 h-6 text-blue-500 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-t-4 border-t-purple-500">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-500 font-semibold mb-1">انستاباي</p>
                <h3 className="text-2xl font-black text-slate-800">{totals.instapay} ج.م</h3>
              </div>
              <CreditCard className="w-6 h-6 text-purple-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>تفاصيل الزيارات المكتملة</CardTitle>
          <CardDescription>عرض تفصيلي لجميع الحجوزات وإيراداتها في الفترة المحددة</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-slate-50 text-slate-500 border-b">
                <tr>
                  <th className="py-3 px-4 font-bold">المريض</th>
                  <th className="py-3 px-4 font-bold">التاريخ</th>
                  <th className="py-3 px-4 font-bold">الخدمة</th>
                  <th className="py-3 px-4 font-bold">المبلغ</th>
                  <th className="py-3 px-4 font-bold">طريقة الدفع</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {report.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-bold text-slate-800">{item.patientName}</td>
                    <td className="py-3 px-4 text-slate-600 dir-ltr text-right">{item.date}</td>
                    <td className="py-3 px-4 text-slate-600">{item.serviceName}</td>
                    <td className="py-3 px-4 font-bold text-green-600">{item.servicePrice} ج.م</td>
                    <td className="py-3 px-4">
                      {item.paymentMethod === 'wallet' ? (
                        <span className="text-blue-600 font-semibold text-xs bg-blue-50 px-2 py-1 rounded">فودافون كاش ({item.transferNumber})</span>
                      ) : item.paymentMethod === 'instapay' ? (
                        <span className="text-purple-600 font-semibold text-xs bg-purple-50 px-2 py-1 rounded">انستاباي</span>
                      ) : (
                        <span className="text-green-600 font-semibold text-xs bg-green-50 px-2 py-1 rounded">كاش بالعيادة</span>
                      )}
                    </td>
                  </tr>
                ))}
                {report.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">لا توجد بيانات للفترة المحددة</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
