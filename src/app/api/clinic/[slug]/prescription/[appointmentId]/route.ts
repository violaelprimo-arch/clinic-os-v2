import { sendClinicDocument } from '@/lib/server/send-clinic-document'
import { NextRequest, NextResponse } from 'next/server'
import { readDocument, queryDocumentsByField, queryDocuments } from '@/lib/server/firebase-rest'
import { fetchBranchesForClinic } from '@/lib/server/clinic-branches'
import { prescriptionClinicDetails } from '@/lib/prescription-clinic'
import { authorizeRecordAccess, generateRecordShareToken, maskPhoneNumber } from '@/lib/server/record-access'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; appointmentId: string }> }
) {
  try {
    const { slug, appointmentId } = await params
    const decodedId = decodeURIComponent(appointmentId)

    // 1. Resolve clinic by slug
    const [clinic] = await queryDocumentsByField('clinics', 'slug', slug)
    if (!clinic) {
      return NextResponse.json({ error: 'العيادة غير موجودة' }, {
        status: 404,
        headers: {
          'Cache-Control': 'private, no-store',
          'X-Robots-Tag': 'noindex, nofollow'
        }
      })
    }

    // 2. Fetch appointment and prescription
    let appt: any = await readDocument(`appointments/${decodedId}`)
    let prescription: any = await readDocument(`prescriptions/rx-${decodedId}`)

    if (!prescription) {
      prescription = await readDocument(`prescriptions/${decodedId}`)
    }

    if (prescription && (prescription.clinic_id || prescription.clinicId) !== clinic.id) {
      prescription = null
    }

    if (!appt && prescription) {
      appt = {
        id: (prescription.appointment_id || decodedId) as string,
        clinic_id: prescription.clinic_id || prescription.clinicId,
        patientName: prescription.patientName,
        phone: prescription.patientPhone || prescription.phone,
        age: prescription.age,
        gender: prescription.gender,
        date: prescription.date,
        diagnosis: prescription.diagnosis,
        drugs: prescription.drugs,
        patientId: prescription.patientId
      }
    }

    if (!appt || (appt.clinic_id !== clinic.id && appt.clinicId !== clinic.id)) {
      return NextResponse.json({ error: 'الروشتة غير موجودة' }, {
        status: 404,
        headers: {
          'Cache-Control': 'private, no-store',
          'X-Robots-Tag': 'noindex, nofollow'
        }
      })
    }

    // 3. Strict Server-Side Authorization (Prevents IDOR & Public Access)
    const phoneVal = appt.phone || appt.patientPhone || prescription?.patientPhone
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
      if (authResult.error === 'VERIFICATION_REQUIRED') {
        return NextResponse.json({
          error: 'VERIFICATION_REQUIRED',
          requiresVerification: true,
          recordType: 'prescription',
          recordId: decodedId,
          maskedPhone: maskPhoneNumber(phoneVal),
          clinic: {
            id: clinic.id,
            slug: clinic.slug,
            clinicName: clinic.clinicName || clinic.name,
            doctorName: clinic.doctorName,
            doctorTitle: clinic.doctorTitle,
            specialty: clinic.specialty,
            logoUrl: clinic.logoUrl,
            primaryColor: clinic.primaryColor
          }
        }, {
          status: 401,
          headers: {
            'Cache-Control': 'private, no-store, must-revalidate',
            'X-Robots-Tag': 'noindex, nofollow, noarchive'
          }
        })
      }

      return NextResponse.json(
        { error: authResult.error || 'غير مصرح لك بعرض هذه الروشتة الطبية' },
        {
          status: authResult.status || 401,
          headers: {
            'Cache-Control': 'private, no-store, must-revalidate',
            'X-Robots-Tag': 'noindex, nofollow, noarchive'
          }
        }
      )
    }

    // 4. Generate permanent share token if clinic staff or owner is fetching
    let shareToken: string | undefined = undefined
    if ((prescription || appt.drugs?.length) &&
        (authResult.accessorRole === 'doctor' || authResult.accessorRole === 'assistant' || authResult.accessorRole === 'owner')) {
      shareToken = await generateRecordShareToken(clinic.id, decodedId, 'prescription')
    }

    const branchId = prescription?.branch_id || prescription?.branchId || appt.branch_id || appt.branchId
    const branchName = prescription?.branchName || appt.branchName
    const branches = branchId && branchId !== 'main'
      ? await readDocument(`branches/${branchId}`).then(branch =>
        branch && [clinic.id, slug].includes(String(branch.clinicId || branch.clinic_id)) ? [branch] : [],
      )
      : await fetchBranchesForClinic(String(clinic.id), slug, Boolean(branchName))
    const details = prescriptionClinicDetails({
      clinicName: clinic.clinicName as string,
      name: clinic.name as string,
      clinicAddress: clinic.clinicAddress as string,
      address: clinic.address as string,
      clinicPhone: clinic.clinicPhone as string,
      clinicPhones: clinic.clinicPhones as string[],
      phones: clinic.phones as string[],
    }, branches as Parameters<typeof prescriptionClinicDetails>[1], branchId, branchName)

    return NextResponse.json({
      success: true,
      accessorRole: authResult.accessorRole,
      shareToken,
      clinic: {
        id: clinic.id,
        slug: clinic.slug,
        ...details,
        doctorName: prescription?.doctorName || clinic.doctorName,
        doctorTitle: prescription?.doctorTitle || clinic.doctorTitle,
        certificationTitle: clinic.certificationTitle,
        certificationEntity: clinic.certificationEntity,
        specialty: clinic.specialty,
        logoUrl: clinic.logoUrl,
        thermalMonoLogoUrl: clinic.thermalMonoLogoUrl,
        primaryColor: clinic.primaryColor,
        secondaryColor: clinic.secondaryColor,
        reportHeaderNote: clinic.reportHeaderNote,
        address: details.clinicAddress,
      },
      appointment: {
        id: appt.id || decodedId,
        patientName: appt.patientName,
        phone: phoneVal,
        age: appt.age,
        gender: appt.gender,
        date: appt.date,
        time: appt.time,
        serviceName: appt.serviceName,
        queue_number: appt.queue_number,
        branchName: details.branchName,
        diagnosis: appt.diagnosis || prescription?.diagnosis,
        drugs: appt.drugs || prescription?.drugs || [],
        notes: authResult.accessorRole === 'guest_token' ? undefined : appt.notes || prescription?.notes
      },
      prescription: prescription ? {
        id: prescription.id || `rx-${decodedId}`,
        diagnosis: prescription.diagnosis,
        drugs: prescription.drugs || [],
        date: prescription.date || appt.date,
        doctorName: prescription.doctorName || clinic.doctorName,
        doctorTitle: prescription.doctorTitle || clinic.doctorTitle,
        instructions: prescription.instructions || prescription.notes,
        nextVisitDate: prescription.nextVisitDate,
        templateMode: prescription.templateMode || appt.prescription_templateMode || (clinic.prescriptionTemplateUrl ? 'custom' : 'standard'),
        primaryColor: prescription.primaryColor || clinic.primaryColor,
        secondaryColor: prescription.secondaryColor || clinic.secondaryColor,
        topOffset: prescription.topOffset || 25,
        pageSize: prescription.pageSize || 'a4',
        showHeaderFooter: prescription.showHeaderFooter !== false,
        printBackground: prescription.printBackground !== false,
        branchName: prescription.branchName || details.branchName || appt.branchName
      } : null
    }, {
      headers: {
        'Cache-Control': 'private, no-store, must-revalidate',
        'X-Robots-Tag': 'noindex, nofollow, noarchive'
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error fetching prescription' }, {
      status: 500,
      headers: {
        'Cache-Control': 'private, no-store',
        'X-Robots-Tag': 'noindex, nofollow'
      }
    })
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ slug:string; appointmentId:string }> }) {
  const params = await context.params
  return sendClinicDocument(req, params.slug, params.appointmentId, 'prescription', () => GET(req, context))
}
