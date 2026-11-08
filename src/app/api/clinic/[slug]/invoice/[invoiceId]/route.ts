import { NextRequest, NextResponse } from 'next/server'
import { readDocument, queryDocuments } from '@/lib/server/firebase-rest'

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

    // 2. Fetch appointment
    const appt = await readDocument(`appointments/${decodedInvoiceId}`)
    if (!appt || (appt.clinic_id !== clinic.id && appt.clinicId !== clinic.id)) {
      return NextResponse.json({ error: 'الفاتورة غير موجودة' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
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
