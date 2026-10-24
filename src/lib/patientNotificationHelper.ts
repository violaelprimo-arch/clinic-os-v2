/**
 * Helper to dispatch patient Web Push events seamlessly from client or server
 */

export interface PatientNotificationPayload {
  type:
    | 'booking_confirmed'
    | 'booking_cancelled'
    | 'booking_rescheduled'
    | 'approaching_turn'
    | 'turn_ready'
    | 'clinic_intake_paused'
    | 'clinic_intake_resumed'
    | 'payment_confirmed'
    | 'prescription_ready'
  appointmentId?: string
  clinicId: string
  branchId?: string
  clinicSlug?: string
  patientPhone?: string
  clinicName?: string
  queueNumber?: number | string
  aheadCount?: number
  eventId?: string
}

export async function triggerPatientEventPush(params: PatientNotificationPayload): Promise<boolean> {
  const clinicName = params.clinicName || 'العيادة'
  let title = 'تنبيه من العيادة'
  let body = 'لديك تحديث جديد بخصوص حجزك.'
  let url = params.appointmentId && params.clinicSlug
    ? `/clinic/${params.clinicSlug}/track/${params.appointmentId}`
    : '/'
  let ttl = 3600
  let urgency: 'low' | 'normal' | 'high' = 'normal'

  switch (params.type) {
    case 'booking_confirmed':
      title = `تأكيد حجزك - ${clinicName}`
      body = `تم تأكيد حجزك بنجاح! رقم دورك المعتمد #${params.queueNumber || ''}.`
      break

    case 'booking_cancelled':
      title = `تحديث بشأن حجزك - ${clinicName}`
      body = `تم إلغاء موعد الحجز رقم #${params.queueNumber || ''}. للاستفسار يرجى التواصل مع العيادة.`
      break

    case 'approaching_turn': {
      const ahead = params.aheadCount ?? 0
      ttl = 300
      urgency = 'high'
      if (ahead <= 1) {
        title = '⚡ أنت المريض التالي للدخول!'
        body = `متبقي مريض واحد فقط أمامك في ${clinicName}. يرجى التواجد أمام غرفة الكشف الآن.`
      } else if (ahead === 2) {
        title = 'تنبيه: اقترب دورك (متبقي دوران)'
        body = `متبقي مريضان فقط قبل دورك لدى ${clinicName}. يرجى التواجد بقاعة الانتظار.`
      } else {
        title = `تنبيه: اقترب دورك (متبقي ${ahead} أدوار)`
        body = `متبقي أمامك ${ahead} مرضى في انتظار الكشف لدى ${clinicName}. يرجى التواجد بالعيادة.`
      }
      break
    }

    case 'turn_ready':
      title = '🔔 دورك الآن للدخول!'
      body = `حان دورك الآن للدخول لمقابلة الطبيب مباشرة (#${params.queueNumber || ''}) لدى ${clinicName}.`
      ttl = 600
      urgency = 'high'
      break

    case 'clinic_intake_paused':
      title = `تنبيه: توقف مؤقت لاستقبال الحالات - ${clinicName}`
      body = `نلفت عنايتكم إلى توقف استقبال الحالات مؤقتاً بالعيادة اليوم. سنخطركم فور الاستئناف.`
      ttl = 7200
      break

    case 'clinic_intake_resumed':
      title = `استئناف استقبال الحالات - ${clinicName}`
      body = `تم استئناف استقبال الحالات وقائمة الانتظار بالعيادة. يرجى متابعة دورك.`
      ttl = 7200
      break

    case 'payment_confirmed':
      title = `تأكيد استلام الدفع - ${clinicName}`
      body = `تم تأكيد استلام الدفع بنجاح لحجزك رقم #${params.queueNumber || ''}.`
      break

    case 'prescription_ready':
      title = `روشتتك الطبية جاهزة - ${clinicName}`
      body = 'تم اعتماد الروشتة الطبية الخاصة بك من الطبيب. اضغط هنا لعرضها وتحميلها بأمان.'
      if (params.appointmentId && params.clinicSlug) {
        url = `/clinic/${params.clinicSlug}/prescription/${params.appointmentId}`
      }
      ttl = 86400
      break
  }

  const payload = {
    type: params.type,
    appointmentId: params.appointmentId,
    clinicId: params.clinicId,
    branchId: params.branchId,
    patientPhone: params.patientPhone,
    title,
    body,
    url,
    tag: `yalla-${params.type}-${params.appointmentId || 'general'}`,
    eventId: params.eventId || `evt_${params.type}_${params.appointmentId || Date.now()}`,
    ttl,
    urgency,
  }

  try {
    const res = await fetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    return !!data.success
  } catch (err) {
    console.warn('Could not dispatch push event via API:', err)
    return false
  }
}
