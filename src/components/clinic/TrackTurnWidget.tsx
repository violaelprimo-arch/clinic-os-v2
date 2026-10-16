'use client'

import { useState } from 'react'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Activity, Search, Info } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'

export function TrackTurnWidget({ clinicId }: { clinicId: string }) {
  const { t, isRtl, dir } = useLanguage()
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
        setResult({
          found: false,
          message: isRtl ? 'لم يتم العثور على حجز بهذا الرقم أو الاسم اليوم.' : 'No appointment found with this phone or name today.'
        })
      } else {
        if (myAppt.status === 'completed') {
          setResult({ 
            found: true, 
            status: 'completed', 
            myTurn: myAppt.queue_number,
            message: isRtl ? 'تم الكشف بالفعل، شكراً لزيارتك!' : 'Exam completed already. Thank you for visiting!' 
          })
        } else if (myAppt.status === 'waiting') {
          const remaining = myAppt.queue_number - currentTurn
          setResult({ 
            found: true, 
            status: 'waiting',
            myTurn: myAppt.queue_number,
            currentTurn,
            remaining: remaining > 0 ? remaining : 0,
            message: remaining === 0
              ? (isRtl ? 'دورك الآن! تفضل بالدخول' : 'It is your turn now! Please enter.')
              : (isRtl ? `باقي ${remaining} أدوار` : `${remaining} turn(s) ahead`)
          })
        }
      }

    } catch (err) {
      console.error(err)
      setResult({
        found: false,
        message: isRtl ? 'حدث خطأ أثناء البحث' : 'An error occurred during search'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card dir={dir} className="shadow-2xl border-t-4 border-t-primary backdrop-blur-sm bg-card text-card-foreground w-full max-w-lg mx-auto mt-8 border-border">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold flex justify-center items-center gap-2">
          <Activity className="text-primary w-6 h-6" /> {t('track_turn_title', isRtl ? 'متابعة الدور' : 'Track Turn')}
        </CardTitle>
        <CardDescription>
          {t('track_turn_desc', isRtl ? 'أدخل رقم الهاتف أو الاسم لمعرفة دورك الحالي' : 'Enter phone number or name to find your current turn')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSearch} className="flex gap-2 mb-6">
          <Input 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder={isRtl ? 'رقم الموبايل أو الاسم...' : 'Phone number or patient name...'}
            className={`${isRtl ? 'text-right' : 'text-left'} flex-1`}
          />
          <Button type="submit" disabled={loading} className="yalla-gradient-btn text-white shrink-0">
            {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Search className="w-5 h-5" />}
          </Button>
        </form>

        {result && (
          <div className={`p-4 rounded-xl border ${result.found ? (result.status === 'waiting' && result.remaining === 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300' : 'bg-primary/10 border-primary/20 text-primary') : 'bg-destructive/10 border-destructive/20'}`}>
            {!result.found ? (
              <p className="text-destructive font-bold text-center flex items-center justify-center gap-2 text-xs">
                <Info className="w-5 h-5" /> {result.message}
              </p>
            ) : (
              <div className="text-center space-y-4">
                <div className="flex justify-between items-center bg-card p-3 rounded-lg shadow-sm border border-border">
                  <div className="text-muted-foreground font-bold text-xs">{isRtl ? 'دورك' : 'Your Turn'}</div>
                  <div className="text-3xl font-black text-primary font-mono">#{result.myTurn}</div>
                </div>
                {result.status === 'waiting' && result.remaining !== undefined && result.remaining > 0 && (
                  <div className="flex justify-between items-center bg-card p-3 rounded-lg shadow-sm border border-border">
                    <div className="text-muted-foreground font-bold text-xs">{isRtl ? 'الدور الحالي (بِالداخل)' : 'Current Turn (Inside)'}</div>
                    <div className="text-2xl font-black text-foreground font-mono">#{result.currentTurn}</div>
                  </div>
                )}
                <div className={`text-base font-bold p-2.5 rounded-xl ${result.status === 'waiting' && result.remaining === 0 ? 'bg-emerald-500 text-white animate-pulse' : 'text-primary'}`}>
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
