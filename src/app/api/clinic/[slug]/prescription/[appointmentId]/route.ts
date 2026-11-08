import { NextRequest, NextResponse } from 'next/server'
import { readDocument, queryDocuments } from '@/lib/server/firebase-rest'

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

    // 2. Fetch appointment
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

    return NextResponse.json({
      success: true,
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
