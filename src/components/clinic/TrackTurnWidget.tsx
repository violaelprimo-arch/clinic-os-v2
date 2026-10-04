'use client'

import { useState } from 'react'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Activity, Search, Info } from 'lucide-react'

export function TrackTurnWidget({ clinicId }: { clinicId: string }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    found: boolean
    message?: string
    myTurn?: number
    currentTurn?: number
    status?: string
    remaining?: number
  } | null>(null)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchTerm.trim()) return

    setLoading(true)
    setResult(null)
    
    try {
      const today = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]
      const q = query(
        collection(db, 'appointments'),
        where('clinic_id', '==', clinicId),
        where('date', '==', today)
      )
      
      const snap = await getDocs(q)
      let allAppts = snap.docs.map(d => ({ id: d.id, ...d.data() } as any))
      
      // Filter out urgent so they are invisible to the normal sequence tracker
      allAppts = allAppts.filter(a => a.serviceType !== 'urgent')

      // Sort by queue number
      allAppts.sort((a, b) => a.queue_number - b.queue_number)
      
      // Find current turn (first waiting normal/consult)
      const waitingAppts = allAppts.filter(a => a.status === 'waiting')
      const currentTurn = waitingAppts.length > 0 ? waitingAppts[0].queue_number : 0
      
      // Find my turn
      const myAppt = allAppts.find(a => 
        a.phone === searchTerm || 
        a.patientName.includes(searchTerm)
      )

      if (!myAppt) {
        setResult({ found: false, message: 'لم يتم العثور على حجز بهذا الرقم أو الاسم اليوم.' })
      } else {
        if (myAppt.status === 'completed') {
          setResult({ 
            found: true, 
            status: 'completed', 
            myTurn: myAppt.queue_number,
            message: 'تم الكشف بالفعل، شكراً لزيارتك!' 
          })
        } else if (myAppt.status === 'waiting') {
          const remaining = myAppt.queue_number - currentTurn
          setResult({ 
            found: true, 
            status: 'waiting',
            myTurn: myAppt.queue_number,
            currentTurn,
            remaining: remaining > 0 ? remaining : 0,
            message: remaining === 0 ? 'دورك الآن! تفضل بالدخول' : `باقي ${remaining} أدوار`
          })
        }
      }

    } catch (err) {
      console.error(err)
      setResult({ found: false, message: 'حدث خطأ أثناء البحث' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="shadow-2xl border-t-4 border-t-blue-500 backdrop-blur-sm bg-white/90 w-full max-w-lg mx-auto mt-8">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold flex justify-center items-center gap-2">
          <Activity className="text-blue-500 w-6 h-6" /> متابعة الدور
        </CardTitle>
        <CardDescription>أدخل رقم الهاتف أو الاسم لمعرفة دورك الحالي</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSearch} className="flex gap-2 mb-6">
          <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white shrink-0">
            {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Search className="w-5 h-5" />}
          </Button>
          <Input 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="رقم الموبايل أو الاسم..."
            className="text-right flex-1"
            dir="rtl"
          />
        </form>

        {result && (
          <div className={`p-4 rounded-xl border ${result.found ? (result.status === 'waiting' && result.remaining === 0 ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200') : 'bg-red-50 border-red-200'}`}>
            {!result.found ? (
              <p className="text-red-600 font-bold text-center flex items-center justify-center gap-2">
                <Info className="w-5 h-5" /> {result.message}
              </p>
            ) : (
              <div className="text-center space-y-4">
                <div className="flex justify-between items-center bg-white p-3 rounded-lg shadow-sm">
                  <div className="text-slate-500 font-bold">دورك</div>
                  <div className="text-3xl font-black text-blue-600">{result.myTurn}</div>
                </div>
                {result.status === 'waiting' && result.remaining !== undefined && result.remaining > 0 && (
                  <div className="flex justify-between items-center bg-white p-3 rounded-lg shadow-sm">
                    <div className="text-slate-500 font-bold">الدور الحالي (بِالداخل)</div>
                    <div className="text-2xl font-black text-slate-800">{result.currentTurn}</div>
                  </div>
                )}
                <div className={`text-lg font-bold p-2 rounded-lg ${result.status === 'waiting' && result.remaining === 0 ? 'bg-green-500 text-white animate-pulse' : 'text-blue-800'}`}>
                  {result.message}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
