import { NextRequest, NextResponse } from 'next/server'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { verifySessionToken } from '@/lib/auth-crypto'
import { getPhoneSearchVariants, normalizePhoneDigits } from '@/lib/countryPhoneHelper'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const resolvedParams = await params
    const slug = resolvedParams.slug

    // 1. Authenticate user
    const sessionToken =
      req.cookies.get('clinic_session')?.value ||
      req.headers.get('Authorization')?.replace('Bearer ', '')

    if (!sessionToken) {
      return NextResponse.json({ error: 'غير مصرح بالوصول' }, { status: 401 })
    }

    const session = await verifySessionToken(sessionToken)
    if (!session.valid || !session.payload) {
      return NextResponse.json({ error: 'جلسة الدخول منتهية أو غير صحيحة' }, { status: 401 })
    }

    // 2. Resolve clinic
    const cQ = query(collection(db, 'clinics'), where('slug', '==', slug))
    const cSnap = await getDocs(cQ)
    if (cSnap.empty) {
      return NextResponse.json({ error: 'العيادة غير موجودة' }, { status: 404 })
    }

    const clinicDoc = cSnap.docs[0]
    const clinicId = clinicDoc.id

    // Verify session belongs to this clinic
    if (session.payload.clinicId && session.payload.clinicId !== clinicId && session.payload.clinicId !== slug) {
      return NextResponse.json({ error: 'غير مصرح لك بالوصول لبيانات هذه العيادة' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const phoneInput = searchParams.get('phone') || ''
    const generalQuery = searchParams.get('q') || ''

    const phoneVariants = phoneInput ? getPhoneSearchVariants(phoneInput) : []
    const normalizedDigits = phoneInput ? normalizePhoneDigits(phoneInput).replace(/[^0-9]/g, '') : ''

    // Map to group distinct patients by (phone + lowerCaseName) so family members are preserved separately
    const patientMap = new Map<string, {
      name: string
      phone: string
      age?: string | null
      gender?: string | null
      dob?: string | null
      residence?: any
      lastVisit?: string | null
      visitsCount: number
      lastService?: string
    }>()

    // 3. Query appointments collection
    const apptQ = query(collection(db, 'appointments'), where('clinic_id', '==', clinicId))
    const apptSnap = await getDocs(apptQ)

    for (const docSnap of apptSnap.docs) {
      const d = docSnap.data()
      if (!d.patientName || !d.phone) continue

      const dPhoneNorm = normalizePhoneDigits(String(d.phone)).replace(/[^0-9]/g, '')
      let isMatch = false

      if (phoneInput) {
        if (dPhoneNorm === normalizedDigits || phoneVariants.includes(String(d.phone).trim())) {
          isMatch = true
        } else if (normalizedDigits.length >= 7 && dPhoneNorm.endsWith(normalizedDigits.slice(-7))) {
          isMatch = true
        }
      } else if (generalQuery) {
        const qLower = generalQuery.trim().toLowerCase()
        if (
          String(d.patientName).toLowerCase().includes(qLower) ||
          dPhoneNorm.includes(qLower.replace(/[^0-9]/g, ''))
        ) {
          isMatch = true
        }
      } else {
        // No filter, take first 50
        isMatch = true
      }

      if (isMatch) {
        const cleanName = String(d.patientName).trim()
        const key = `${dPhoneNorm}__${cleanName.toLowerCase()}`

        if (!patientMap.has(key)) {
          patientMap.set(key, {
            name: cleanName,
            phone: String(d.phone).trim(),
            age: d.age ? String(d.age) : null,
            gender: d.gender || null,
            dob: d.dob || d.birthDate || null,
            residence: d.patientResidenceSnapshot || d.residence || null,
            lastVisit: d.date || null,
            visitsCount: 1,
            lastService: d.serviceName || null
          })
        } else {
          const existing = patientMap.get(key)!
          existing.visitsCount += 1
          if (d.age && !existing.age) existing.age = String(d.age)
          if (d.gender && !existing.gender) existing.gender = d.gender
          if ((d.dob || d.birthDate) && !existing.dob) existing.dob = d.dob || d.birthDate
          if ((d.patientResidenceSnapshot || d.residence) && !existing.residence) {
            existing.residence = d.patientResidenceSnapshot || d.residence
          }
          if (d.date && (!existing.lastVisit || new Date(d.date) > new Date(existing.lastVisit))) {
            existing.lastVisit = d.date
            existing.lastService = d.serviceName || existing.lastService
          }
        }
      }
    }

    // 4. Query patient_accounts collection as well
    try {
      const accQ = query(collection(db, 'patient_accounts'), where('clinic_id', '==', clinicId))
      const accSnap = await getDocs(accQ)

      for (const docSnap of accSnap.docs) {
        const d = docSnap.data()
        if (!d.name || !d.phone) continue

        const dPhoneNorm = normalizePhoneDigits(String(d.phone)).replace(/[^0-9]/g, '')
        let isMatch = false

        if (phoneInput) {
          if (dPhoneNorm === normalizedDigits || phoneVariants.includes(String(d.phone).trim())) {
            isMatch = true
          } else if (normalizedDigits.length >= 7 && dPhoneNorm.endsWith(normalizedDigits.slice(-7))) {
            isMatch = true
          }
        } else if (generalQuery) {
          const qLower = generalQuery.trim().toLowerCase()
          if (
            String(d.name).toLowerCase().includes(qLower) ||
            dPhoneNorm.includes(qLower.replace(/[^0-9]/g, ''))
          ) {
            isMatch = true
          }
        }

        if (isMatch) {
          const cleanName = String(d.name).trim()
          const key = `${dPhoneNorm}__${cleanName.toLowerCase()}`

          if (!patientMap.has(key)) {
            patientMap.set(key, {
              name: cleanName,
              phone: String(d.phone).trim(),
              age: d.age ? String(d.age) : null,
              gender: d.gender || null,
              dob: d.dob || d.birthDate || null,
              residence: d.residence || null,
              lastVisit: null,
              visitsCount: 1,
              lastService: undefined
            })
          }
        }
      }
    } catch (e) {
      console.warn('patient_accounts search warning:', e)
    }

    const patients = Array.from(patientMap.values()).sort((a, b) => {
      if (a.lastVisit && b.lastVisit) {
        return new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime()
      }
      return b.visitsCount - a.visitsCount
    })

    return NextResponse.json({
      success: true,
      count: patients.length,
      patients: patients.slice(0, 20)
    })
  } catch (error: any) {
    console.error('Patient search API error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء البحث عن المرضى' },
      { status: 500 }
    )
  }
}
