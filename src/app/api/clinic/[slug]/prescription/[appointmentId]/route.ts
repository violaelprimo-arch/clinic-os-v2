import { NextRequest, NextResponse } from 'next/server'
import { readDocument, queryDocuments } from '@/lib/server/firebase-rest'
import { authorizeRecordAccess, generateRecordShareToken } from '@/lib/server/record-access'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; appointmentId: string }> }
) {
  try {
    const { slug, appointmentId } = await params
    const decodedId = decodeURIComponent(appointmentId)

    // 1. Resolve clinic by slug
    const allClinics = await queryDocuments('clinics')
    const clinic = allClinics.find((c: any) => c.slug === slug)
    if (!clinic) {
      return NextResponse.json({ error: 'العيادة غير موجودة' }, { status: 404 })
    }

    // 2. Fetch appointment and prescription
    let appt: any = await readDocument(`appointments/${decodedId}`)
    let prescription: any = await readDocument(`prescriptions/rx-${decodedId}`)

    if (!prescription) {
      prescription = await readDocument(`prescriptions/${decodedId}`)
    }

    if (!appt && prescription) {
      appt = {
        id: (prescription.appointment_id || decodedId) as string,
        clinic_id: prescription.clinic_id,
        patientName: prescription.patientName,
        phone: prescription.patientPhone || prescription.phone,
        age: prescription.age,
        gender: prescription.gender,
        date: prescription.date,
        diagnosis: prescription.diagnosis,
        drugs: prescription.drugs
      }
    }

    if (!appt || (appt.clinic_id !== clinic.id && appt.clinicId !== clinic.id)) {
      return NextResponse.json({ error: 'الروشتة غير موجودة' }, { status: 404 })
    }

    // 3. Strict Server-Side Authorization (Prevents IDOR & Public Access)
    const phoneVal = appt.phone || prescription?.patientPhone
    const patientIdVal = appt.patientId || appt.patient_id || prescription?.patientId
    const authResult = await authorizeRecordAccess(req, {
      clinicId: String(clinic.id),
      clinicSlug: String(clinic.slug || slug),
      recordId: decodedId,
      recordType: 'prescription',
      recordPhone: phoneVal ? String(phoneVal) : undefined,
      recordPatientId: patientIdVal ? String(patientIdVal) : undefined
    })

    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error || 'غير مصرح لك بعرض هذه الروشتة الطبية' },
        { status: authResult.status || 401 }
      )
    }

    // 4. Generate a share token if clinic staff or owner is fetching
    let shareToken: string | undefined = undefined
    if (authResult.accessorRole === 'doctor' || authResult.accessorRole === 'assistant' || authResult.accessorRole === 'owner') {
      shareToken = await generateRecordShareToken(clinic.id, decodedId, 'prescription')
    }

    return NextResponse.json({
      success: true,
      accessorRole: authResult.accessorRole,
      shareToken,
      clinic: {
        id: clinic.id,
        slug: clinic.slug,
        clinicName: clinic.clinicName || clinic.name,
        doctorName: clinic.doctorName,
        doctorTitle: clinic.doctorTitle,
        specialty: clinic.specialty,
        logoUrl: clinic.logoUrl,
        thermalMonoLogoUrl: clinic.thermalMonoLogoUrl,
        primaryColor: clinic.primaryColor,
        secondaryColor: clinic.secondaryColor,
        reportHeaderNote: clinic.reportHeaderNote,
        clinicPhone: clinic.clinicPhone,
        doctorPhone: clinic.doctorPhone,
        address: clinic.address || clinic.clinicAddress,
      },
      appointment: {
        id: appt.id || decodedId,
        patientName: appt.patientName,
        phone: appt.phone,
        age: appt.age,
        gender: appt.gender,
        date: appt.date,
        time: appt.time,
        serviceName: appt.serviceName,
        queue_number: appt.queue_number,
        branchName: appt.branchName,
        diagnosis: appt.diagnosis || prescription?.diagnosis,
        drugs: appt.drugs || prescription?.drugs || [],
        notes: appt.notes || prescription?.notes
      },
      prescription: prescription ? {
        id: prescription.id || `rx-${decodedId}`,
        diagnosis: prescription.diagnosis,
        drugs: prescription.drugs || [],
        date: prescription.date || appt.date,
        doctorName: prescription.doctorName || clinic.doctorName,
        doctorTitle: prescription.doctorTitle || clinic.doctorTitle,
        instructions: prescription.instructions || prescription.notes,
        nextVisitDate: prescription.nextVisitDate
      } : null
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error fetching prescription' }, { status: 500 })
  }
}
