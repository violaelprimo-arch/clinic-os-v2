'use client'

import { use, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, doc, updateDoc, onSnapshot } from 'firebase/firestore'
import { Receipt, CheckCircle, Clock, Search, ArrowUpDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function AccountsPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug
  const [clinicId, setClinicId] = useState<string>('')
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  const [search, setSearch] = useState('')
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'queue_number', direction: 'asc' })

  const getLocalDate = () => new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]
  
  const [fromDate, setFromDate] = useState(getLocalDate())
  const [toDate, setToDate] = useState(getLocalDate())

  useEffect(() => {
    let unsubscribe: any;
    const fetchData = async () => {
      setLoading(true)
      try {
        const cQ = query(collection(db, 'clinics'), where('slug', '==', slug))
        const cSnap = await getDocs(cQ)
        if (cSnap.empty) return
        const cId = cSnap.docs[0].id
        setClinicId(cId)

        // Query by clinic_id and filter dates locally to avoid composite index error
        const q = query(
          collection(db, 'appointments'),
          where('clinic_id', '==', cId)
        )
        
        unsubscribe = onSnapshot(q, (snap) => {
          const appts = snap.docs
            .map(d => ({ id: d.id, ...d.data() } as any))
            .filter(d => d.date >= fromDate && d.date <= toDate)
          
          setAppointments(appts)
          setLoading(false)
        }, (err) => {
          console.error(err)
          toast.error('حدث خطأ أثناء تحميل الحسابات')
          setLoading(false)
        })

      } catch (err) {
        toast.error('حدث خطأ أثناء تحميل العيادة')
        setLoading(false)
      }
    }
    
    fetchData()
    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [slug, fromDate, toDate])

  const confirmPayment = async (id: string) => {
    try {
      await updateDoc(doc(db, 'appointments', id), {
        paymentStatus: 'paid'
      })
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, paymentStatus: 'paid' } : a))
      toast.success('تم تأكيد الدفع وتحويله للتقارير المالية')
    } catch (err) {
      toast.error('حدث خطأ أثناء تأكيد الدفع')
    }
  }

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  const sortedAndFiltered = appointments
    .filter(a => a.patientName?.includes(search) || a.phone?.includes(search) || a.transferNumber?.includes(search))
    .sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1
      if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })

  const totalExpected = appointments.reduce((sum, a) => sum + (a.servicePrice || 0), 0)
  const totalCollected = appointments.filter(a => a.paymentStatus === 'paid').reduce((sum, a) => sum + (a.servicePrice || 0), 0)

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
            <Receipt className="w-8 h-8" /> إدارة الحسابات
          </h1>
          <p className="text-slate-500 mt-2">تأكيد الدفعات ومراجعة الإيرادات وتصفية حسب التاريخ</p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
          <div className="space-y-1">
            <Label className="text-slate-500 font-bold">من تاريخ</Label>
            <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="h-12 bg-slate-50 w-full md:w-48" />
          </div>
          <div className="space-y-1">
            <Label className="text-slate-500 font-bold">إلى تاريخ</Label>
            <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="h-12 bg-slate-50 w-full md:w-48" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-gradient-to-l from-green-500 to-emerald-600 text-white shadow-lg">
          <CardContent className="p-6">
            <h3 className="text-lg font-bold opacity-90 mb-1">تم تحصيله (مؤكد)</h3>
            <p className="text-4xl font-black">{totalCollected} ج.م</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-t-4 border-t-amber-500 shadow-lg">
          <CardContent className="p-6">
            <h3 className="text-lg font-bold text-slate-600 mb-1">إجمالي اليوم (المتوقع)</h3>
            <p className="text-4xl font-black text-amber-600">{totalExpected} ج.م</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-xl border-t-4 border-t-primary">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
            <div>
              <CardTitle>كشف الحسابات</CardTitle>
              <CardDescription>اضغط على عناوين الأعمدة لترتيب البيانات</CardDescription>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute right-3 top-3 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="بحث بالاسم أو الرقم..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pr-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('queue_number')}>
                    <div className="flex items-center gap-1">الدور <ArrowUpDown className="w-3 h-3"/></div>
                  </th>
                  <th className="p-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('patientName')}>
                    <div className="flex items-center gap-1">المريض <ArrowUpDown className="w-3 h-3"/></div>
                  </th>
                  <th className="p-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('servicePrice')}>
                    <div className="flex items-center gap-1">المبلغ <ArrowUpDown className="w-3 h-3"/></div>
                  </th>
                  <th className="p-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('paymentMethod')}>
                    <div className="flex items-center gap-1">طريقة الدفع <ArrowUpDown className="w-3 h-3"/></div>
                  </th>
                  <th className="p-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('paymentStatus')}>
                    <div className="flex items-center gap-1">الحالة <ArrowUpDown className="w-3 h-3"/></div>
                  </th>
                  <th className="p-4">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-500">جاري التحميل...</td></tr>
                ) : sortedAndFiltered.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-500">لا توجد كشوفات لليوم حتى الآن.</td></tr>
                ) : (
                  sortedAndFiltered.map(appt => (
                    <tr key={appt.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-black text-primary text-lg">{appt.queue_number}</td>
                      <td className="p-4">
                        <div className="font-bold text-slate-900">{appt.patientName}</div>
                        <div className="text-xs text-slate-500" dir="ltr">{appt.phone}</div>
                      </td>
                      <td className="p-4 font-bold text-slate-700">{appt.servicePrice} ج.م</td>
                      <td className="p-4">
                        {appt.paymentMethod === 'cash' ? (
                          <Badge variant="outline" className="bg-slate-50">نقدي بالعيادة</Badge>
                        ) : (
                          <div className="flex flex-col gap-1 items-start">
                            <Badge variant="secondary" className="bg-purple-50 text-purple-700">
                              {appt.paymentMethod === 'wallet' ? 'فودافون كاش' : 'انستاباي'}
                            </Badge>
                            {appt.transferNumber && <span className="text-xs text-slate-400 font-mono" dir="ltr">{appt.transferNumber}</span>}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        {appt.paymentStatus === 'paid' ? (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none flex items-center gap-1 w-fit">
                            <CheckCircle className="w-3 h-3" /> تم الدفع
                          </Badge>
                        ) : appt.paymentStatus === 'review' ? (
                          <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50 flex items-center gap-1 w-fit">
                            <Clock className="w-3 h-3" /> قيد المراجعة
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-slate-300 text-slate-600 bg-slate-50 flex items-center gap-1 w-fit">
                            <Clock className="w-3 h-3" /> لم يتم الدفع
                          </Badge>
                        )}
                      </td>
                      <td className="p-4">
                        {appt.paymentStatus !== 'paid' && (
                          <Button 
                            size="sm" 
                            className="bg-primary hover:bg-primary/90 text-white font-bold"
                            onClick={() => confirmPayment(appt.id)}
                          >
                            تأكيد الدفع
                          </Button>
                        )}
                      </td>
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
