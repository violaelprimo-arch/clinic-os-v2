import { NextRequest, NextResponse } from 'next/server'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { verifySessionToken } from '@/lib/auth-crypto'

const AR_DAYS_MAP: Record<string, string> = {
  Saturday: 'السبت',
  Sunday: 'الأحد',
  Monday: 'الاثنين',
  Tuesday: 'الثلاثاء',
  Wednesday: 'الأربعاء',
  Thursday: 'الخميس',
  Friday: 'الجمعة'
}

const WEEK_DAY_KEYS = [
  'Saturday',
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday'
]

/**
 * Normalizes date to YYYY-MM-DD and resolves day of week in Africa/Cairo timezone
 */
function toCairoDateInfo(dateInput?: string | Date | number): { dateStr: string; dayKey: string; arDay: string } {
  if (!dateInput) {
    const now = new Date()
    const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(now)
    const dayKey = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Cairo', weekday: 'long' }).format(now)
    return { dateStr, dayKey, arDay: AR_DAYS_MAP[dayKey] || dayKey }
  }

  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
    const [y, m, d] = dateInput.trim().split('-').map(Number)
    // Construct UTC anchor for consistent day of week
    const anchor = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
    const dayKey = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Cairo', weekday: 'long' }).format(anchor)
    return { dateStr: dateInput.trim(), dayKey, arDay: AR_DAYS_MAP[dayKey] || dayKey }
  }

  const d = new Date(dateInput)
  if (isNaN(d.getTime())) {
    const fallback = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date())
    const dayKey = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Cairo', weekday: 'long' }).format(new Date())
    return { dateStr: fallback, dayKey, arDay: AR_DAYS_MAP[dayKey] || dayKey }
  }

  const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(d)
  const dayKey = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Cairo', weekday: 'long' }).format(d)
  return { dateStr, dayKey, arDay: AR_DAYS_MAP[dayKey] || dayKey }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const sessionToken =
      req.cookies.get('clinic_session')?.value ||
      req.headers.get('Authorization')?.replace('Bearer ', '')

    if (!sessionToken) {
      return NextResponse.json({ error: 'غير مصرح بالوصول — يرجى تسجيل الدخول' }, { status: 401 })
    }

    const session = await verifySessionToken(sessionToken)
    if (!session.valid || !session.payload) {
      return NextResponse.json({ error: 'جلسة الدخول غير صالحة أو منتهية' }, { status: 401 })
    }

    let clinicDoc = null
    let clinicId = slug

    try {
      const cQ = query(collection(db, 'clinics'), where('slug', '==', slug))
      const cSnap = await getDocs(cQ)
      if (!cSnap.empty) {
        clinicDoc = cSnap.docs[0]
        clinicId = clinicDoc.id
      }
    } catch (e) {
      console.warn('Finance clinic lookup fallback:', e)
    }

    const { searchParams } = new URL(req.url)
    const fromDate = searchParams.get('from')
    const toDate = searchParams.get('to')
    const branchId = searchParams.get('branchId')

    // Query appointments for clinic (both clinicId and clinic_id)
    let allDocs: any[] = []
    try {
      const apptsQ1 = query(collection(db, 'appointments'), where('clinic_id', '==', clinicId))
      const apptsQ2 = query(collection(db, 'appointments'), where('clinicId', '==', clinicId))
      const [snap1, snap2] = await Promise.all([getDocs(apptsQ1), getDocs(apptsQ2)])

      const map = new Map<string, any>()
      snap1.docs.forEach((d) => map.set(d.id, { id: d.id, ...d.data() }))
      snap2.docs.forEach((d) => map.set(d.id, { id: d.id, ...d.data() }))
      allDocs = Array.from(map.values())
    } catch (dbErr) {
      console.error('Failed to query appointments from Firestore:', dbErr)
      return NextResponse.json(
        { error: 'فشل في قراءة بيانات الحجوزات المالية من قاعدة البيانات.' },
        { status: 500 }
      )
    }

    // Filter by branch first
    const branchFiltered = allDocs.filter((item) => {
      if (!branchId || branchId === 'all') return true
      const bId = item.branch_id || item.branchId
      if (bId) return bId === branchId
      return branchId === 'main'
    })

    // Filter by date range (in Cairo timezone context)
    const filtered = branchFiltered.filter((item) => {
      if (item.status === 'cancelled') return false
      const salesDateInfo = toCairoDateInfo(item.date || item.createdAt)
      const itemDate = salesDateInfo.dateStr
      if (fromDate && itemDate < fromDate) return false
      if (toDate && itemDate > toDate) return false
      return true
    })

    let totalRevenue = 0
    let collected = 0
    let due = 0
    let totalDiscounts = 0

    const paymentMethodsMap: Record<string, { amount: number; count: number }> = {
      cash: { amount: 0, count: 0 },
      instapay: { amount: 0, count: 0 },
      wallet: { amount: 0, count: 0 },
      card: { amount: 0, count: 0 },
      other: { amount: 0, count: 0 }
    }

    const servicesMap: Record<string, { count: number; total: number }> = {}

    // Initialize weekly aggregation with 0 for all 7 days
    const weeklyMap: Record<string, { revenue: number; collected: number; count: number }> = {}
    WEEK_DAY_KEYS.forEach((k) => {
      weeklyMap[k] = { revenue: 0, collected: 0, count: 0 }
    })

    // Timeline map keyed by YYYY-MM-DD
    const timelineMap: Record<
      string,
      { date: string; day: string; weekday: string; revenue: number; collected: number; count: number }
    > = {}

    const formattedAppointments = filtered.map((appt) => {
      const origPrice = Number(appt.originalPrice || appt.servicePrice) || 0
      const price = Number(appt.servicePrice) || origPrice
      const disc = Number(appt.discountApplied ?? appt.discount?.amount ?? 0) || (origPrice > price ? origPrice - price : 0)

      // Strict accounting rule:
      // Completion (status === 'completed') does NOT mean paid.
      // Pending transfers do NOT enter collected.
      // ONLY paymentStatus === 'paid' is counted as collected.
      const isPaid = appt.paymentStatus === 'paid'

      const effectiveCollected = isPaid ? (Number(appt.collectedAmount ?? price) || price) : 0

      totalRevenue += origPrice
      totalDiscounts += disc

      if (isPaid) {
        collected += effectiveCollected
      } else {
        due += (origPrice - disc)
      }

      // Categorize payment method
      const rawMethod = String(appt.paymentMethod || 'cash').trim().toLowerCase()
      let normMethod = 'other'
      if (rawMethod === 'cash' || rawMethod === 'كاش') normMethod = 'cash'
      else if (rawMethod === 'instapay' || rawMethod === 'انستاباي' || rawMethod === 'إنستاباي') normMethod = 'instapay'
      else if (rawMethod === 'wallet' || rawMethod === 'محفظة' || rawMethod === 'فودافون كاش') normMethod = 'wallet'
      else if (rawMethod === 'card' || rawMethod === 'credit' || rawMethod === 'visa' || rawMethod === 'فيزا') normMethod = 'card'

      if (isPaid) {
        paymentMethodsMap[normMethod].amount += effectiveCollected
        paymentMethodsMap[normMethod].count += 1
      }

      // Services aggregation
      const sName = String(appt.serviceName || 'كشف عيادة').trim()
      if (!servicesMap[sName]) {
        servicesMap[sName] = { count: 0, total: 0 }
      }
      servicesMap[sName].count += 1
      servicesMap[sName].total += origPrice

      // Date Resolution in Cairo Timezone
      // For Sales: based on appointment date
      const salesDateInfo = toCairoDateInfo(appt.date || appt.createdAt)
      const dayKey = salesDateInfo.dayKey
      const dateStr = salesDateInfo.dateStr

      // Weekly bucket aggregation
      if (weeklyMap[dayKey]) {
        weeklyMap[dayKey].revenue += origPrice
        weeklyMap[dayKey].count += 1
        if (isPaid) {
          weeklyMap[dayKey].collected += effectiveCollected
        }
      }

      // Timeline bucket aggregation
      if (!timelineMap[dateStr]) {
        const [y, m, d] = dateStr.split('-')
        timelineMap[dateStr] = {
          date: dateStr,
          day: `${salesDateInfo.arDay} ${d}/${m}`,
          weekday: salesDateInfo.arDay,
          revenue: 0,
          collected: 0,
          count: 0
        }
      }
      timelineMap[dateStr].revenue += origPrice
      timelineMap[dateStr].count += 1
      if (isPaid) {
        timelineMap[dateStr].collected += effectiveCollected
      }

      return {
        ...appt,
        id: appt.id,
        netPrice: price,
        originalPrice: origPrice,
        discountAmount: disc,
        isPaid
      }
    })

    // Format weekly output array (always 7 days: Saturday to Friday)
    const weekly = WEEK_DAY_KEYS.map((k) => ({
      key: k,
      day: AR_DAYS_MAP[k] || k,
      enDay: k,
      revenue: weeklyMap[k].revenue,
      collected: weeklyMap[k].collected,
      count: weeklyMap[k].count
    }))

    // Format timeline output array (chronologically sorted)
    const timeline = Object.keys(timelineMap)
      .sort()
      .map((dateKey) => ({
        key: dateKey,
        date: timelineMap[dateKey].date,
        day: timelineMap[dateKey].day,
        weekday: timelineMap[dateKey].weekday,
        revenue: timelineMap[dateKey].revenue,
        collected: timelineMap[dateKey].collected,
        count: timelineMap[dateKey].count
      }))

    // Format services list with exact percentages
    const totalAppointments = filtered.length || 1
    const services = Object.entries(servicesMap)
      .map(([name, data]) => ({
        name,
        count: data.count,
        total: data.total,
        pct: Math.round((data.count / totalAppointments) * 100)
      }))
      .sort((a, b) => b.total - a.total)

    // Format payments breakdown list
    const totalPaid = collected || 1
    const payments = [
      {
        id: 'cash',
        name: 'كاش بالعيادة',
        amount: paymentMethodsMap.cash.amount,
        count: paymentMethodsMap.cash.count,
        pct: Math.round((paymentMethodsMap.cash.amount / totalPaid) * 100),
        color: 'bg-emerald-500'
      },
      {
        id: 'instapay',
        name: 'إنستاباي (InstaPay)',
        amount: paymentMethodsMap.instapay.amount,
        count: paymentMethodsMap.instapay.count,
        pct: Math.round((paymentMethodsMap.instapay.amount / totalPaid) * 100),
        color: 'bg-purple-600'
      },
      {
        id: 'wallet',
        name: 'محافظ إلكترونية',
        amount: paymentMethodsMap.wallet.amount,
        count: paymentMethodsMap.wallet.count,
        pct: Math.round((paymentMethodsMap.wallet.amount / totalPaid) * 100),
        color: 'bg-amber-500'
      },
      {
        id: 'card',
        name: 'بطاقة بنكية',
        amount: paymentMethodsMap.card.amount,
        count: paymentMethodsMap.card.count,
        pct: Math.round((paymentMethodsMap.card.amount / totalPaid) * 100),
        color: 'bg-blue-600'
      },
      {
        id: 'other',
        name: 'طرق دفع أخرى',
        amount: paymentMethodsMap.other.amount,
        count: paymentMethodsMap.other.count,
        pct: Math.round((paymentMethodsMap.other.amount / totalPaid) * 100),
        color: 'bg-slate-500'
      }
    ].filter((p) => p.amount > 0 || p.count > 0)

    return NextResponse.json({
      success: true,
      summary: {
        totalRevenue,
        collected,
        due,
        totalDiscounts,
        cash: paymentMethodsMap.cash.amount,
        instapay: paymentMethodsMap.instapay.amount,
        wallet: paymentMethodsMap.wallet.amount,
        card: paymentMethodsMap.card.amount,
        other: paymentMethodsMap.other.amount,
        appointmentsCount: filtered.length,
        services,
        payments,
        weekly,
        timeline
      },
      appointments: formattedAppointments
    })
  } catch (err: any) {
    console.error('Error in finance GET:', err)
    return NextResponse.json(
      { error: 'فشل في استخراج التقرير المالي: ' + (err.message || '') },
      { status: 500 }
    )
  }
}
