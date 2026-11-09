import { NextRequest, NextResponse } from 'next/server'
import { readDocument, queryDocuments } from '@/lib/server/firebase-rest'
import { authorizeRecordAccess, generateRecordShareToken } from '@/lib/server/record-access'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; invoiceId: string }> }
) {
  try {
    const { slug, invoiceId } = await params
    const decodedInvoiceId = decodeURIComponent(invoiceId)

    // 1. Resolve clinic by slug
    const allClinics = await queryDocuments('clinics')
    const clinic = allClinics.find((c: any) => c.slug === slug)
    if (!clinic) {
      return NextResponse.json({ error: 'العيادة غير موجودة' }, { status: 404 })
    }

    // 2. Fetch appointment / invoice record
    let appt: any = await readDocument(`appointments/${decodedInvoiceId}`)
    
    // Fallback: If not found by direct ID, try querying by invoiceNumber
    if (!appt) {
      const clinicAppts = await queryDocuments('appointments')
      appt = clinicAppts.find(
        (a: any) =>
          (a.clinic_id === clinic.id || a.clinicId === clinic.id) &&
          (a.invoiceNumber === decodedInvoiceId || a.id === decodedInvoiceId)
      )
    }

    if (!appt || (appt.clinic_id !== clinic.id && appt.clinicId !== clinic.id)) {
      return NextResponse.json({ error: 'الفاتورة غير موجودة' }, { status: 404 })
    }

    // 3. Strict Server-Side Authorization (Prevents IDOR & Public Access)
    const authResult = await authorizeRecordAccess(req, {
      clinicId: String(clinic.id),
      clinicSlug: String(clinic.slug || slug),
      recordId: decodedInvoiceId,
      recordType: 'invoice',
      recordPhone: appt.phone ? String(appt.phone) : undefined,
      recordPatientId: (appt.patientId || appt.patient_id) ? String(appt.patientId || appt.patient_id) : undefined
    })

    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error || 'غير مصرح لك بعرض هذه الفاتورة' },
        { status: authResult.status || 401 }
      )
    }

    // 4. Generate a share token if clinic staff or owner is fetching
    let shareToken: string | undefined = undefined
    if (authResult.accessorRole === 'doctor' || authResult.accessorRole === 'assistant' || authResult.accessorRole === 'owner') {
      shareToken = await generateRecordShareToken(clinic.id, decodedInvoiceId, 'invoice')
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
        specialty: clinic.specialty,
        logoUrl: clinic.logoUrl,
        primaryColor: clinic.primaryColor,
        secondaryColor: clinic.secondaryColor,
        receiptHeaderNote: clinic.receiptHeaderNote,
        receiptFooterNote: clinic.receiptFooterNote,
        clinicPhone: clinic.clinicPhone,
        doctorPhone: clinic.doctorPhone,
        address: clinic.address || clinic.clinicAddress,
      },
      invoice: {
        id: appt.id || decodedInvoiceId,
        patientName: appt.patientName,
        phone: appt.phone,
        date: appt.date,
        time: appt.time,
        serviceName: appt.serviceName || 'كشف عيادة',
        servicePrice: appt.servicePrice || 0,
        paidAmount: appt.paidAmount !== undefined ? appt.paidAmount : (appt.servicePrice || 0),
        discount: appt.discount || 0,
        paymentMethod: appt.paymentMethod || 'cash',
        paymentStatus: appt.paymentStatus || 'paid',
        queueNumber: appt.queue_number,
        branchName: appt.branchName || 'الفرع الرئيسي',
        createdAt: appt.createdAt || appt.date
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error fetching invoice' }, { status: 500 })
  }
}
