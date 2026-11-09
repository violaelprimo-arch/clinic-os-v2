'use client'

import { use, useEffect, useState } from 'react'
import { notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Receipt, ArrowRight, AlertCircle, Loader2, Calendar, User, Phone, CheckCircle2, ShieldAlert, LogIn
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
  const [isUnauthorized, setIsUnauthorized] = useState(false)
  const [authErrorMessage, setAuthErrorMessage] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const decodedInvoiceId = decodeURIComponent(invoiceId)
        const searchParams = new URLSearchParams(window.location.search)
        const token = searchParams.get('token') || ''
        const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : ''

        // 1. Fetch via authorized server API
        const apiRes = await fetch(`/api/clinic/${slug}/invoice/${encodeURIComponent(decodedInvoiceId)}${tokenQuery}`)
        
        if (apiRes.status === 401 || apiRes.status === 403) {
          const errData = await apiRes.json().catch(() => ({}))
          setIsUnauthorized(true)
          setAuthErrorMessage(errData.error || (isRtl ? 'هذا السجل الطبي محمي. يرجى تسجيل الدخول أو استخدام رابط المشاركة المعتمد.' : 'This medical record is protected. Please log in or use an authorized share link.'))
          setLoading(false)
          return
        }

        if (apiRes.status === 404) {
          setIsNotFound(true)
          setLoading(false)
          return
        }

        if (apiRes.ok) {
          const apiData = await apiRes.json()
          if (apiData.success && apiData.invoice) {
            setClinic(apiData.clinic)
            const raw = apiData.invoice
            const isPaid = raw.paymentStatus === 'paid'
            const origPrice = Number(raw.servicePrice || 0) + (Number(raw.discount) || 0)
            const disc = Number(raw.discount) || 0
            const net = Number(raw.paidAmount !== undefined ? raw.paidAmount : raw.servicePrice) || 0

            setInvoice({
              invoiceNumber: raw.id || decodedInvoiceId,
              clinicName: apiData.clinic?.clinicName || 'العيادة الطبية',
              doctorName: apiData.clinic?.doctorName,
              branchName: raw.branchName,
              clinicAddress: apiData.clinic?.address,
              clinicPhone: apiData.clinic?.clinicPhone,
              patientName: raw.patientName || 'المريض',
              patientPhone: raw.phone || '',
              date: raw.date || new Date().toISOString().split('T')[0],
              cairoTime: raw.time || formatCairo12Hour(new Date(raw.createdAt || Date.now())),
              serviceName: raw.serviceName || 'كشف واستشارة طبية',
              servicePrice: origPrice > 0 ? origPrice : net,
              discount: disc,
              netTotal: net,
              paymentMethod: raw.paymentMethod || 'cash',
              paymentStatus: isPaid ? 'paid' : 'pending',
              appointmentId: raw.id,
              queueNumber: raw.queueNumber
            })
            setLoading(false)
            return
          }
        }

        setIsNotFound(true)
      } catch (err: any) {
        console.error('Error fetching invoice:', err)
        setIsNotFound(true)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [slug, invoiceId, isRtl])

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

  if (isUnauthorized) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4" dir={dir}>
        <div className="max-w-md w-full bg-card border border-border rounded-3xl p-6 text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-base font-black">
            {isRtl ? 'سجل محمي ومقيد الصلاحية' : 'Protected Medical Record'}
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {authErrorMessage}
          </p>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
            <Link href={`/clinic/${slug}/login`} className="w-full sm:w-auto">
              <Button className="w-full h-9 text-xs rounded-xl font-bold">
                <LogIn className={`w-3.5 h-3.5 ${isRtl ? 'ml-1.5' : 'mr-1.5'}`} />
                {isRtl ? 'دخول العيادة' : 'Clinic Login'}
              </Button>
            </Link>
            <Link href={`/clinic/${slug}`} className="w-full sm:w-auto">
              <Button variant="outline" className="w-full h-9 text-xs rounded-xl">
                <ArrowRight className={`w-3.5 h-3.5 ${isRtl ? 'ml-1.5' : 'mr-1.5'}`} />
                {t('back_to_clinic', isRtl ? 'العودة لصفحة العيادة' : 'Back to Clinic')}
              </Button>
            </Link>
          </div>
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
              alt={clinic?.clinicName || clinic?.name || 'Clinic Logo'}
              className="w-10 h-10 rounded-xl object-contain border border-border/60 bg-white p-1"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black text-sm">
              <Receipt className="w-5 h-5" />
            </div>
          )}
          <div>
            <h1 className="font-bold text-sm tracking-tight text-foreground">
              {clinic?.clinicName || clinic?.name || 'العيادة الطبية'}
            </h1>
            <p className="text-[11px] text-muted-foreground">
              {clinic?.doctorName ? `د. ${clinic.doctorName}` : 'منصة يلا كلينك للعيادات'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
          <Link href={`/clinic/${slug}`}>
            <Button variant="outline" size="sm" className="h-8 text-xs font-medium rounded-xl">
              <ArrowRight className={`w-3 h-3 ${isRtl ? 'ml-1' : 'mr-1'}`} />
              {t('back_to_clinic', isRtl ? 'العيادة' : 'Clinic')}
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl w-full mx-auto py-8">
        <InvoiceView
          invoice={invoice}
          slug={slug}
          isPatientView={true}
        />
      </main>

      {/* Footer */}
      <footer className="max-w-4xl w-full mx-auto pt-6 border-t border-border/60 text-center text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-3">
        <p>
          {t('all_rights_reserved', isRtl ? 'جميع الحقوق محفوظة' : 'All rights reserved')} © {new Date().getFullYear()} {clinic?.clinicName || 'يلا كلينك'}
        </p>
        <p className="text-[11px]">
          {isRtl ? 'فاتورة إلكترونية معتمدة' : 'Official Electronic Receipt'}
        </p>
      </footer>
    </div>
  )
}
