import { NextRequest, NextResponse } from 'next/server'
import { readDocument, queryDocuments, queryDocumentsByField } from '@/lib/server/firebase-rest'
import { createSessionToken, verifySessionToken, hashPassword, verifyPassword } from '@/lib/auth-crypto'
import { sendWhatsAppNotification } from '@/lib/whatsapp'

function normalizePhone(raw?: string): string {
  if (!raw) return ''
  let clean = String(raw).replace(/\D/g, '')
  if (clean.startsWith('20') && clean.length > 10) {
    clean = clean.slice(2)
  }
  if (!clean.startsWith('0') && clean.length === 10) {
    clean = '0' + clean
  }
  return clean
}

export function maskPhoneNumber(phone?: string): string {
  if (!phone) return ''
  const clean = normalizePhone(phone)
  if (clean.length < 7) return clean
  const prefix = clean.slice(0, 3)
  const suffix = clean.slice(-4)
  return `${prefix}****${suffix}`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { action, slug, recordId, recordType, phone, code, challengeToken } = body

    if (!slug || !recordId || !recordType || !['prescription', 'invoice'].includes(recordType)) {
      return NextResponse.json({ error: 'بيانات الطلب غير مكتملة' }, { status: 400 })
    }

    const decodedId = decodeURIComponent(recordId)

    // 1. Resolve clinic
    const allClinics = await queryDocuments('clinics')
    const clinic = allClinics.find((c: any) => c.slug === slug)
    if (!clinic) {
      return NextResponse.json({ error: 'العيادة غير موجودة' }, { status: 404 })
    }

    // 2. Resolve target record
    let recordPhone = ''
    let recordPatientName = 'المريض'
    let recordPatientId = ''

    if (recordType === 'prescription') {
      let appt: any = await readDocument(`appointments/${decodedId}`)
      let prescription: any = await readDocument(`prescriptions/rx-${decodedId}`)
      if (!prescription) {
        prescription = await readDocument(`prescriptions/${decodedId}`)
      }
      if (!appt && prescription) {
        appt = {
          id: (prescription.appointment_id || decodedId) as string,
          clinic_id: prescription.clinic_id,
          phone: prescription.patientPhone || prescription.phone,
          patientName: prescription.patientName,
          patientId: prescription.patientId
        }
      }

      if (!appt || (appt.clinic_id !== clinic.id && appt.clinicId !== clinic.id)) {
        return NextResponse.json({ error: 'الروشتة غير موجودة' }, { status: 404 })
      }

      recordPhone = appt.phone || prescription?.patientPhone || ''
      recordPatientName = prescription?.patientName || appt.patientName || 'المريض'
      recordPatientId = appt.patientId || appt.patient_id || prescription?.patientId || ''
    } else {
      // Invoice
      let appt: any = await readDocument(`appointments/${decodedId}`)
      if (!appt) {
        const clinicAppts = await queryDocuments('appointments')
        appt = clinicAppts.find(
          (a: any) =>
            (a.clinic_id === clinic.id || a.clinicId === clinic.id) &&
            (a.invoiceNumber === decodedId || a.id === decodedId)
        )
      }

      if (!appt || (appt.clinic_id !== clinic.id && appt.clinicId !== clinic.id)) {
        return NextResponse.json({ error: 'الفاتورة غير موجودة' }, { status: 404 })
      }

      recordPhone = appt.phone || ''
      recordPatientName = appt.patientName || 'المريض'
      recordPatientId = appt.patientId || appt.patient_id || ''
    }

    const normalizedRecordPhone = normalizePhone(recordPhone)
    if (!normalizedRecordPhone) {
      return NextResponse.json({ error: 'لا يوجد رقم هاتف مسجل لهذا السجل الطبي، يرجى التواصل مع العيادة' }, { status: 400 })
    }

    // -------------------------------------------------------------
    // ACTION: REQUEST OTP
    // -------------------------------------------------------------
    if (action === 'request-otp') {
      if (!phone) {
        return NextResponse.json({ error: 'يرجى إدخال رقم الهاتف المسجل لتأكيد الهوية' }, { status: 400 })
      }

      const inputPhone = normalizePhone(phone)
      if (inputPhone !== normalizedRecordPhone) {
        return NextResponse.json({
          error: 'رقم الهاتف المدخل غير مطابق للرقم المسجل بالسجل الطبي'
        }, { status: 400 })
      }

      // Generate 6-digit OTP
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString()
      const hashedOtp = await hashPassword(otpCode)
      const expiresAt = Date.now() + 10 * 60 * 1000 // 10 minutes

      // Sign challenge token (stateless & tamper-proof)
      const challengeToken = await createSessionToken({
        role: 'otp_challenge',
        clinicId: clinic.id,
        slug,
        recordId: decodedId,
        recordType,
        phone: normalizedRecordPhone,
        hashedOtp,
        expiresAt
      })

      // Attempt sending OTP via Meta WhatsApp Cloud API if configured
      let whatsappSent = false
      const docName = clinic.doctorName ? `د. ${clinic.doctorName}` : clinic.clinicName || 'العيادة'
      const recordTitle = recordType === 'prescription' ? 'الروشتة الطبية' : 'الفاتورة الإلكترونية'
      const whatsappMsg = `مرحباً بك في ${clinic.clinicName || 'Yalla Clinic'}.\nرمز التحقق الخاص بك لفتح ${recordTitle} هو: *${otpCode}*\nصلاحية الرمز 10 دقائق. يُرجى عدم مشاركته مع أي شخص.`

      try {
        const sendResult = await sendWhatsAppNotification({
          clinicId: String(clinic.id || ''),
          to: String(normalizedRecordPhone || ''),
          appointmentId: String(decodedId || ''),
          patientName: String(recordPatientName || 'المريض'),
          clinicName: String(clinic.clinicName || clinic.name || 'Yalla Clinic'),
          type: 'PRESCRIPTION_READY',
          data: {
            message: whatsappMsg,
            otp: otpCode,
            recordTitle
          },
          idempotencyKey: `otp_${decodedId}_${otpCode}_${Date.now()}`
        })
        whatsappSent = sendResult.success
      } catch (err) {
        console.warn('WhatsApp OTP delivery error:', err)
      }

      const isDemo = slug === 'yalla-demo' || process.env.NODE_ENV !== 'production'

      return NextResponse.json({
        success: true,
        message: 'تم إرسال رمز التحقق إلى رقم هاتفك',
        maskedPhone: maskPhoneNumber(normalizedRecordPhone),
        challengeToken,
        // For demo clinics or test environments, surface demoCode for quick testing
        demoCode: isDemo || !whatsappSent ? otpCode : undefined
      }, {
        headers: {
          'Cache-Control': 'private, no-store',
          'X-Robots-Tag': 'noindex, nofollow'
        }
      })
    }

    // -------------------------------------------------------------
    // ACTION: VERIFY OTP
    // -------------------------------------------------------------
    if (action === 'verify-otp') {
      if (!code || !challengeToken) {
        return NextResponse.json({ error: 'يرجى إدخال رمز التحقق' }, { status: 400 })
      }

      const challengeSession = await verifySessionToken(challengeToken)
      if (!challengeSession.valid || !challengeSession.payload) {
        return NextResponse.json({ error: 'جلسة التحقق غير صالحة أو منتهية، يرجى طلب رمز جديد' }, { status: 400 })
      }

      const payload = challengeSession.payload
      if (
        payload.role !== 'otp_challenge' ||
        payload.clinicId !== clinic.id ||
        payload.recordId !== decodedId ||
        payload.recordType !== recordType
      ) {
        return NextResponse.json({ error: 'رمز التحقق غير متطابق مع هذا السجل الطبي' }, { status: 400 })
      }

      if (Date.now() > Number(payload.expiresAt || 0)) {
        return NextResponse.json({ error: 'انتهت صلاحية رمز التحقق، يرجى طلب رمز جديد' }, { status: 400 })
      }

      const isValidCode = await verifyPassword(String(code).trim(), String(payload.hashedOtp))
      if (!isValidCode) {
        return NextResponse.json({ error: 'رمز التحقق غير صحيح، يرجى التأكد وإعادة المحاولة' }, { status: 400 })
      }

      // Success: Issue trusted patient session cookie (valid 30 days)
      const patientToken = await createSessionToken({
        role: 'patient',
        name: recordPatientName,
        phone: payload.phone,
        clinicId: clinic.id,
        slug,
        patientId: recordPatientId || decodedId
      })

      const response = NextResponse.json({
        success: true,
        message: 'تم تأكيد الهوية بنجاح',
        token: patientToken
      }, {
        headers: {
          'Cache-Control': 'private, no-store',
          'X-Robots-Tag': 'noindex, nofollow'
        }
      })

      // Set HttpOnly Secure patient_session cookie
      response.cookies.set('patient_session', patientToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60 // 30 days
      })

      return response
    }

    return NextResponse.json({ error: 'إجراء غير مدعوم' }, { status: 400 })
  } catch (error: any) {
    console.error('record-otp error:', error)
    return NextResponse.json({ error: error.message || 'خطأ في معالجة التحقق' }, { status: 500 })
  }
}
