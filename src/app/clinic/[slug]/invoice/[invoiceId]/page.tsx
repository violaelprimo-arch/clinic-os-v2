'use client'

import { use, useEffect, useState } from 'react'
import { notFound } from 'next/navigation'
import { db } from '@/lib/firebase'
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import {
  Receipt, ArrowRight, AlertCircle, Loader2, Calendar, User, Phone, CheckCircle2
} from 'lucide-react'
import Link from 'next/link'
import { ClinicLogo } from '@/components/clinic/ClinicLogo'
import { InvoiceView, InvoiceData } from '@/components/clinic/InvoiceView'
import { LanguageToggle } from '@/components/common/LanguageToggle'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { useLanguage } from '@/context/LanguageContext'
import { formatCairo12Hour } from '@/lib/queue-calculator'

export default function PublicInvoicePage({
  params
}: {
  params: Promise<{ slug: string; invoiceId: string }>
}) {
  const resolvedParams = use(params)
  const { slug, invoiceId } = resolvedParams
  const { t, isRtl, dir, language } = useLanguage()

  const [clinic, setClinic] = useState<any>(null)
  const [invoice, setInvoice] = useState<InvoiceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [isNotFound, setIsNotFound] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Fetch Clinic
        const qClinic = query(collection(db, 'clinics'), where('slug', '==', slug))
        const cSnap = await getDocs(qClinic)
        let clinicData: any = null
        if (!cSnap.empty) {
          clinicData = { id: cSnap.docs[0].id, ...cSnap.docs[0].data() }
          setClinic(clinicData)
        } else {
          setIsNotFound(true)
          notFound()
          return
        }

        // 2. Fetch Invoice / Appointment Record
        let apptData: any = null
        const decodedInvoiceId = decodeURIComponent(invoiceId)

        // Try direct document ID
        try {
          const directDoc = await getDoc(doc(db, 'appointments', decodedInvoiceId))
          if (directDoc.exists()) {
            const raw = { id: directDoc.id, ...directDoc.data() } as any
            if (raw.clinic_id !== clinicData.id) {
              setIsNotFound(true)
              notFound()
              return
            }
            apptData = raw
          }
        } catch (err: any) {
          if (err?.digest?.includes('NEXT_NOT_FOUND') || err?.message?.includes('NEXT_NOT_FOUND')) {
            throw err
          }
        }

        // Try querying by invoiceNumber
        if (!apptData && clinicData) {
          const qInvoice = query(
            collection(db, 'appointments'),
            where('clinic_id', '==', clinicData.id),
            where('invoiceNumber', '==', decodedInvoiceId)
          )
          const snapInvoice = await getDocs(qInvoice)
          if (!snapInvoice.empty) {
            apptData = { id: snapInvoice.docs[0].id, ...snapInvoice.docs[0].data() }
          }
        }

        // Try fallback: match prefix or suffix
        if (!apptData && clinicData) {
          const rawId = decodedInvoiceId.replace(/^INV-/, '')
          const qAll = query(
            collection(db, 'appointments'),
            where('clinic_id', '==', clinicData.id)
          )
          const snapAll = await getDocs(qAll)
          for (const d of snapAll.docs) {
            const data = d.data()
            if (
              d.id === rawId ||
              d.id.startsWith(rawId) ||
              data.invoiceNumber === decodedInvoiceId ||
              (data.invoiceNumber && data.invoiceNumber.includes(rawId))
            ) {
              apptData = { id: d.id, ...data }
              break
            }
          }
        }

        if (apptData) {
          // Strictly eliminate IDOR: verify apptData.clinic_id === clinicData.id
          if (apptData.clinic_id !== clinicData.id) {
            setIsNotFound(true)
            notFound()
            return
          }

          const isPaid = apptData.payment_status === 'paid' || apptData.paymentStatus === 'paid'
          const origPrice = Number(apptData.servicePrice || 0) + (Number(apptData.discountApplied) || 0)
          const disc = Number(apptData.discountApplied) || 0
          const net = Number(apptData.servicePrice) || 0

          setInvoice({
            invoiceNumber: apptData.invoiceNumber || decodedInvoiceId || `INV-${apptData.id.slice(0, 8)}`,
            clinicName: clinicData?.clinicName || 'العيادة الطبية',
            doctorName: clinicData?.doctorName,
            branchName: apptData.branchName,
            clinicAddress: clinicData?.clinicAddress,
            clinicPhone: clinicData?.clinicPhone,
            patientName: apptData.patientName || 'المريض',
            patientPhone: apptData.phone || '',
            date: apptData.date || new Date().toISOString().split('T')[0],
            cairoTime: apptData.time || formatCairo12Hour(new Date(apptData.createdAt || Date.now())),
            serviceName: apptData.serviceName || 'كشف واستشارة طبية',
            servicePrice: origPrice > 0 ? origPrice : net,
            discount: disc,
            netTotal: net,
            paymentMethod: apptData.paymentMethod || 'cash',
            paymentStatus: isPaid ? 'paid' : 'pending',
            transferNumber: apptData.transferNumber,
            appointmentId: apptData.id,
            queueNumber: apptData.queue_number
          })
        }
      } catch (err: any) {
        if (err?.digest?.includes('NEXT_NOT_FOUND') || err?.message?.includes('NEXT_NOT_FOUND')) {
          setIsNotFound(true)
          return
        }
        console.error('Error fetching public invoice:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [slug, invoiceId])

  if (isNotFound) {
    notFound()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4" dir={dir}>
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-xs font-bold text-muted-foreground">
            {t('loading_invoice_data', isRtl ? 'جاري تحميل بيانات الفاتورة الإلكترونية...' : 'Loading electronic invoice...')}
          </p>
        </div>
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4" dir={dir}>
        <div className="max-w-md w-full bg-card border border-border rounded-3xl p-6 text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-black">
            {t('invoice_not_found', isRtl ? 'عفواً، الفاتورة غير متوفرة' : 'Invoice Not Found')}
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t('invoice_not_found_desc', isRtl ? 'لم نتمكن من العثور على الفاتورة المطلوبة، يرجى التأكد من صحة الرابط أو مراجعة إدارة العيادة.' : 'We could not find the requested invoice. Please verify the URL or contact clinic reception.')}
          </p>
          <div className="pt-2">
            <Link href={`/clinic/${slug}`}>
              <Button variant="outline" className="h-9 text-xs rounded-xl">
                <ArrowRight className={`w-3.5 h-3.5 ${isRtl ? 'ml-1.5' : 'mr-1.5'}`} />
                {t('back_to_clinic', isRtl ? 'العودة لصفحة العيادة' : 'Back to Clinic')}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-foreground flex flex-col justify-between py-6 px-4 sm:px-6" dir={dir}>
      {/* Top Navbar */}
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between pb-6 border-b border-border/60">
        <div className="flex items-center gap-3">
          {clinic?.logoUrl ? (
            <img
              src={clinic.logoUrl}
              alt={clinic?.clinicName || 'Clinic'}
              className="w-10 h-10 rounded-xl object-contain border border-border"
            />
          ) : (
            <ClinicLogo size="md" variant="auto" />
          )}
          <div>
            <h1 className="text-sm font-black text-foreground">
              {clinic?.clinicName || (isRtl ? 'العيادة الطبية' : 'Medical Clinic')}
            </h1>
            <p className="text-[11px] text-muted-foreground">
              {isRtl ? 'الفاتورة الإلكترونية المعتمدة' : 'Official Electronic Invoice'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LanguageToggle />
          <Link href={`/clinic/${slug}`}>
            <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs rounded-xl border-border">
              {isRtl ? 'العيادة' : 'Clinic'}
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Invoice Container */}
      <main className="max-w-4xl w-full mx-auto my-6 bg-card border border-border rounded-3xl p-4 sm:p-8 shadow-xl">
        <InvoiceView
          invoice={invoice}
          isPatientView={true}
          slug={slug}
        />
      </main>

      {/* Standardized Copyright Footer */}
      <footer className="max-w-4xl w-full mx-auto text-center text-xs text-muted-foreground pt-4 border-t border-border/60">
        <p>
          {language === 'en'
            ? 'All rights reserved YallaCodeX 2026'
            : 'جميع الحقوق محفوظة YallaCodeX 2026'}
        </p>
      </footer>
    </div>
  )
}
