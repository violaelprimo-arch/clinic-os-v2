import { NextRequest, NextResponse } from 'next/server'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { verifySessionToken } from '@/lib/auth-crypto'

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

    const cQ = query(collection(db, 'clinics'), where('slug', '==', slug))
    const cSnap = await getDocs(cQ)
    if (cSnap.empty) {
      return NextResponse.json({ error: 'العيادة غير موجودة' }, { status: 404 })
    }

    const cDoc = cSnap.docs[0]
    const clinicId = cDoc.id

    const { searchParams } = new URL(req.url)
    const fromDate = searchParams.get('from')
    const toDate = searchParams.get('to')
    const branchId = searchParams.get('branchId')

    // Query appointments for clinic
    const apptsQ = query(
      collection(db, 'appointments'),
      where('clinic_id', '==', clinicId)
    )
    const snap = await getDocs(apptsQ)

    const allAppts = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any))

    // Filter by date range (in Cairo timezone context)
    const filteredByDate = allAppts.filter((item) => {
      if (item.status === 'cancelled') return false
      const itemDate = item.date || (item.createdAt ? item.createdAt.split('T')[0] : '')
      if (!itemDate) return false
      if (fromDate && itemDate < fromDate) return false
      if (toDate && itemDate > toDate) return false
      return true
    })

    // Filter by branch
    const filtered = filteredByDate.filter((item) => {
      if (!branchId || branchId === 'all') return true
      const bId = item.branch_id || item.branchId
      if (bId) return bId === branchId
      return branchId === 'main'
    })

    let totalRevenue = 0
    let cash = 0
    let wallet = 0
    let instapay = 0
    let collected = 0
    let due = 0
    let totalDiscounts = 0

    const servicesMap: Record<string, { count: number; total: number }> = {}
    const dailyMap: Record<string, { revenue: number; collected: number; count: number }> = {}

    filtered.forEach((appt) => {
      const price = Number(appt.servicePrice) || 0
      const discount = Number(appt.discountApplied) || 0
      const method = (appt.paymentMethod || 'cash').toLowerCase()
      const isPaid = appt.paymentStatus === 'paid' || appt.status === 'completed'

      totalRevenue += price
      totalDiscounts += discount

      if (isPaid) {
        collected += price
        if (method === 'instapay') {
          instapay += price
        } else if (method === 'wallet') {
          wallet += price
        } else {
          cash += price
        }
      } else {
        due += price
      }

      // Services breakdown
      const sName = appt.serviceName || 'كشف عيادة'
      if (!servicesMap[sName]) {
        servicesMap[sName] = { count: 0, total: 0 }
      }
      servicesMap[sName].count += 1
      servicesMap[sName].total += price

      // Daily timeline
      const d = appt.date || (appt.createdAt ? appt.createdAt.split('T')[0] : '')
      if (d) {
        if (!dailyMap[d]) {
          dailyMap[d] = { revenue: 0, collected: 0, count: 0 }
        }
        dailyMap[d].revenue += price
        if (isPaid) dailyMap[d].collected += price
        dailyMap[d].count += 1
      }
    })

    const servicesList = Object.entries(servicesMap).map(([name, data]) => ({
      name,
      count: data.count,
      total: data.total
    }))

    const timeline = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date,
        revenue: data.revenue,
        collected: data.collected,
        count: data.count
      }))

    return NextResponse.json({
      success: true,
      summary: {
        totalRevenue,
        collected,
        due,
        cash,
        wallet,
        instapay,
        totalDiscounts,
        appointmentsCount: filtered.length,
        services: servicesList,
        timeline
      }
    })
  } catch (err: any) {
    console.error('Error in finance GET:', err)
    return NextResponse.json(
      { error: 'فشل في استخراج التقرير المالي: ' + (err.message || '') },
      { status: 500 }
    )
  }
}
