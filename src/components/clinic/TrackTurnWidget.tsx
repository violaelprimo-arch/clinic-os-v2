'use client'

import { useState } from 'react'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Activity, Search, Info } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'
import { calculatePatientLivePosition } from '@/lib/queueCalculations'
import { getCairoDateString } from '@/lib/bookingCapacity'
import { getPhoneSearchVariants, normalizePhoneDigits } from '@/lib/countryPhoneHelper'

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
      const today = getCairoDateString()
      const q = query(
        collection(db, 'appointments'),
        where('clinic_id', '==', clinicId),
        where('date', '==', today)
      )
      
      const snap = await getDocs(q)
      const allAppts = snap.docs.map(d => ({ id: d.id, ...d.data() } as any))

      // Clean search query
      const cleanSearch = searchTerm.trim()
      const normalizedDigits = normalizePhoneDigits(cleanSearch).replace(/[^0-9]/g, '')
      const variants = getPhoneSearchVariants(cleanSearch)

      // Find target appointment
      const myAppt = allAppts.find(a => {
        if (!a.phone && !a.patientName) return false
        const aPhoneDigits = normalizePhoneDigits(String(a.phone || '')).replace(/[^0-9]/g, '')
        const matchesPhone = Boolean(
          (normalizedDigits.length >= 7 && aPhoneDigits.endsWith(normalizedDigits.slice(-7))) ||
          variants.includes(String(a.phone || '').trim())
        )
        const matchesName = String(a.patientName || '').toLowerCase().includes(cleanSearch.toLowerCase())
        return matchesPhone || matchesName
      })

      if (!myAppt) {
        setResult({
          found: false,
          message: isRtl ? 'لم يتم العثور على حجز بهذا الرقم أو الاسم اليوم.' : 'No appointment found with this phone or name today.'
        })
      } else {
        const livePos = calculatePatientLivePosition({
          targetAppointmentId: myAppt.id,
          targetAppointment: myAppt,
          allTodayAppointments: allAppts,
          isRtl
        })

        if (livePos.status === 'completed') {
          setResult({ 
            found: true, 
            status: 'completed', 
            myTurn: Number(myAppt.queue_number) || 1,
            message: isRtl ? 'تم الكشف بالفعل، شكراً لزيارتك!' : 'Exam completed already. Thank you for visiting!' 
          })
        } else {
          setResult({ 
            found: true, 
            status: livePos.isCurrentTurn ? 'in_progress' : 'waiting',
            myTurn: Number(myAppt.queue_number) || 1,
            currentTurn: Number(livePos.currentPatientExamining?.queueNumber) || 0,
            remaining: livePos.aheadCount,
            message: livePos.isCurrentTurn
              ? (isRtl ? 'دورك الآن! تفضل بالدخول لغرفة الكشف' : 'It is your turn now! Please enter.')
              : (isRtl
                ? `متبقي ${livePos.aheadCount} في قائمة الانتظار • موعد الدخول المتوقع: ${livePos.estimatedEntranceTime12H}`
                : `${livePos.aheadCount} patients ahead • Expected entry: ${livePos.estimatedEntranceTime12H}`)
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
