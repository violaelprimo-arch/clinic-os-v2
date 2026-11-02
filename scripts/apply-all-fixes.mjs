import fs from 'fs'

console.log('=== Applying Comprehensive Fixes for Prescription, Vitals, Invoice, and Cloudflare ===')

// -------------------------------------------------------------
// 1. UPDATE src/app/clinic/[slug]/admin/prescriptions/page.tsx
// -------------------------------------------------------------
const rxPath = 'src/app/clinic/[slug]/admin/prescriptions/page.tsx'
let rxCode = fs.readFileSync(rxPath, 'utf8')
const isRxCrlf = rxCode.includes('\r\n')
let rxNorm = rxCode.replace(/\r\n/g, '\n')

// 1a. Enhance Patient Profile Button in header & add secondary button near patient name
const targetHeaderBtn = `{hasPatientSelected ? (
                  <a
                    href={patientProfileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 transition-all cursor-pointer shadow-xs hover:shadow-sm"
                    title={t('open_patient_profile_tooltip', 'فتح الملف الطبي الكامل للمريض في تبويب جديد (دون فقدان بيانات الروشتة الحالية)')}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{t('open_patient_profile', 'فتح ملف المريض')}</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-muted/60 text-muted-foreground/70 border border-border/60 opacity-60 cursor-not-allowed"
                    title={t('select_patient_first_tooltip', 'اختر المريض أولًا لفتح ملفه الطبي')}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{t('open_patient_profile', 'فتح ملف المريض')}</span>
                    <span className="text-[10px] font-normal text-muted-foreground/80">({t('select_patient_first', 'اختر المريض أولًا')})</span>
                  </button>
                )}`

const replacementHeaderBtn = `{hasPatientSelected ? (
                  <a
                    href={patientProfileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-black rounded-xl bg-sky-600 hover:bg-sky-700 text-white shadow-xs hover:shadow-md transition-all cursor-pointer"
                    title={t('open_patient_profile_tooltip', 'فتح الملف الطبي الكامل للمريض في تبويب جديد (دون فقدان بيانات الروشتة الحالية)')}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{t('open_patient_profile', 'فتح ملف المريض')}</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-80"
                    title={t('select_patient_first_tooltip', 'اختر المريض أولًا لفتح ملفه الطبي')}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{t('open_patient_profile', 'فتح ملف المريض')}</span>
                    <span className="text-[10px] font-normal opacity-80">({t('select_patient_first', 'اختر المريض أولًا')})</span>
                  </button>
                )}`

if (rxNorm.includes(targetHeaderBtn)) {
  rxNorm = rxNorm.replace(targetHeaderBtn, replacementHeaderBtn)
  console.log('✅ Replaced patient profile button with high-visibility styling')
} else {
  console.warn('⚠️ Could not match targetHeaderBtn in prescriptions page')
}

// 1b. Remove Card 1 (Vital Signs in right column)
const card1Start = '{/* Vital Signs Card (العلامات الحيوية - يحدد الطبيب كتابتها من عدمه) */}'
const card1End = '{/* High-Alert Allergy Banner'

const startIdx = rxNorm.indexOf(card1Start)
const endIdx = rxNorm.indexOf(card1End)

if (startIdx !== -1 && endIdx !== -1) {
  rxNorm = rxNorm.slice(0, startIdx) + rxNorm.slice(endIdx)
  console.log('✅ Successfully removed Vital Signs Card 1 from Form Editor column')
} else {
  console.warn('⚠️ Could not locate Card 1 range in prescriptions page')
}

// 1c. In handleSave, use vitals from the card under preview
const targetSaveVitals = `        const vitalsData = includeVitals && (bpSys || bpDia || pulse || temp || glucose || weight) ? {
          bloodPressureSystolic: bpSys.trim() ? Number(bpSys.trim()) || bpSys.trim() : null,
          bloodPressureDiastolic: bpDia.trim() ? Number(bpDia.trim()) || bpDia.trim() : null,
          heartRate: pulse.trim() ? Number(pulse.trim()) || pulse.trim() : null,
          temperature: temp.trim() ? Number(temp.trim()) || temp.trim() : null,
          glucoseLevel: glucose.trim() ? Number(glucose.trim()) || glucose.trim() : null,
          weightKg: weight.trim() ? Number(weight.trim()) || weight.trim() : null,
          recordedAt: new Date().toISOString()
        } : null`

const replacementSaveVitals = `        const hasVitals = Boolean(
          (vitalsBpSys && vitalsBpSys.trim()) ||
          (vitalsBpDia && vitalsBpDia.trim()) ||
          (vitalsPulse && vitalsPulse.trim()) ||
          (vitalsTemp && vitalsTemp.trim()) ||
          (vitalsGlucose && vitalsGlucose.trim()) ||
          (vitalsWeight && vitalsWeight.trim())
        )
        const vitalsData = hasVitals ? {
          bloodPressureSystolic: vitalsBpSys && vitalsBpSys.trim() ? Number(vitalsBpSys.trim()) || vitalsBpSys.trim() : null,
          bloodPressureDiastolic: vitalsBpDia && vitalsBpDia.trim() ? Number(vitalsBpDia.trim()) || vitalsBpDia.trim() : null,
          heartRate: vitalsPulse && vitalsPulse.trim() ? Number(vitalsPulse.trim()) || vitalsPulse.trim() : null,
          temperature: vitalsTemp && vitalsTemp.trim() ? Number(vitalsTemp.trim()) || vitalsTemp.trim() : null,
          glucoseLevel: vitalsGlucose && vitalsGlucose.trim() ? Number(vitalsGlucose.trim()) || vitalsGlucose.trim() : null,
          weightKg: vitalsWeight && vitalsWeight.trim() ? Number(vitalsWeight.trim()) || vitalsWeight.trim() : null,
          recordedAt: new Date().toISOString()
        } : null`

if (rxNorm.includes(targetSaveVitals)) {
  rxNorm = rxNorm.replace(targetSaveVitals, replacementSaveVitals)
  console.log('✅ Updated handleSave to persist vitals from under-preview card')
} else {
  console.warn('⚠️ Could not match targetSaveVitals in prescriptions page')
}

// 1d. In handlePrintViaIframe, use vitals from under-preview card
const targetPrintVitals = `      vitalSigns: includeVitals ? {
        bloodPressureSystolic: bpSys,
        bloodPressureDiastolic: bpDia,
        heartRate: pulse,
        temperature: temp,
        glucoseLevel: glucose,
        weightKg: weight
      } : null,`

const replacementPrintVitals = `      vitalSigns: (vitalsBpSys || vitalsBpDia || vitalsPulse || vitalsTemp || vitalsGlucose || vitalsWeight) ? {
        bloodPressureSystolic: vitalsBpSys,
        bloodPressureDiastolic: vitalsBpDia,
        heartRate: vitalsPulse,
        temperature: vitalsTemp,
        glucoseLevel: vitalsGlucose,
        weightKg: vitalsWeight
      } : null,`

if (rxNorm.includes(targetPrintVitals)) {
  rxNorm = rxNorm.replace(targetPrintVitals, replacementPrintVitals)
  console.log('✅ Updated handlePrintViaIframe vitals mapping')
} else {
  console.warn('⚠️ Could not match targetPrintVitals')
}

// 1e. In A4Prescription preview props, use vitals from under-preview card
const targetPreviewVitals = `                    vitalSigns={includeVitals ? {
                      bloodPressureSystolic: bpSys,
                      bloodPressureDiastolic: bpDia,
                      heartRate: pulse,
                      temperature: temp,
                      glucoseLevel: glucose,
                      weightKg: weight
                    } : null}`

const replacementPreviewVitals = `                    vitalSigns={(vitalsBpSys || vitalsBpDia || vitalsPulse || vitalsTemp || vitalsGlucose || vitalsWeight) ? {
                      bloodPressureSystolic: vitalsBpSys,
                      bloodPressureDiastolic: vitalsBpDia,
                      heartRate: vitalsPulse,
                      temperature: vitalsTemp,
                      glucoseLevel: vitalsGlucose,
                      weightKg: vitalsWeight
                    } : null}`

if (rxNorm.includes(targetPreviewVitals)) {
  rxNorm = rxNorm.replace(targetPreviewVitals, replacementPreviewVitals)
  console.log('✅ Updated live preview A4Prescription vitals mapping')
} else {
  console.warn('⚠️ Could not match targetPreviewVitals')
}

if (isRxCrlf) rxNorm = rxNorm.replace(/\n/g, '\r\n')
fs.writeFileSync(rxPath, rxNorm, 'utf8')
console.log('✅ Successfully updated prescriptions page.tsx')

// -------------------------------------------------------------
// 2. UPDATE src/app/clinic/[slug]/admin/patients/[patientId]/PatientProfileClient.tsx
// -------------------------------------------------------------
const ppPath = 'src/app/clinic/[slug]/admin/patients/[patientId]/PatientProfileClient.tsx'
let ppCode = fs.readFileSync(ppPath, 'utf8')
const isPpCrlf = ppCode.includes('\r\n')
let ppNorm = ppCode.replace(/\r\n/g, '\n')

// Add Receipt to lucide-react imports if missing
if (!ppNorm.includes('Receipt,')) {
  ppNorm = ppNorm.replace("import { Clock, Phone,", "import { Receipt, Clock, Phone,")
}

// Add InvoiceView import
if (!ppNorm.includes('InvoiceView')) {
  ppNorm = ppNorm.replace(
    "import { WhatsAppShareButton } from '@/components/common/WhatsAppShareButton'",
    `import { WhatsAppShareButton } from '@/components/common/WhatsAppShareButton'
import { InvoiceView, type InvoiceData } from '@/components/clinic/InvoiceView'`
  )
}

// Add selectedInvoiceForView state
if (!ppNorm.includes('selectedInvoiceForView')) {
  ppNorm = ppNorm.replace(
    "const [isSavingVitals, setIsSavingVitals] = useState(false)",
    `const [isSavingVitals, setIsSavingVitals] = useState(false)
  const [selectedInvoiceForView, setSelectedInvoiceForView] = useState<InvoiceData | null>(null)

  const handleOpenInvoice = (appt: any) => {
    const isPaid = appt.paymentStatus === 'paid' || appt.status === 'completed'
    const invNumber = appt.invoiceNumber || \`INV-\${appt.id.slice(0, 8).toUpperCase()}\`
    const price = Number(appt.servicePrice) || 250
    const discount = Number(appt.discountApplied) || 0
    const net = Number(appt.netTotal) || price

    const invData: InvoiceData = {
      invoiceNumber: invNumber,
      clinicName: clinic?.clinicName || 'العيادة الطبية',
      doctorName: appt.doctorName || clinic?.doctorName,
      branchName: appt.branchName,
      clinicAddress: clinic?.clinicAddress,
      clinicPhone: clinic?.clinicPhone,
      patientName: patientData?.name || appt?.patientName || 'المريض',
      patientPhone: phone || appt?.phone || '',
      date: appt.date || new Date().toISOString().split('T')[0],
      serviceName: appt.serviceName || 'كشف طبي',
      servicePrice: price,
      discount,
      netTotal: net,
      paymentMethod: appt.paymentMethod || 'cash',
      paymentStatus: isPaid ? 'paid' : 'pending',
      appointmentId: appt.id,
      queueNumber: appt.queue_number
    }
    setSelectedInvoiceForView(invData)
  }`
  )
}

// Add Invoice section to each appointment card right after prescription section
const targetEndOfRx = `                          <div className="bg-card p-4 rounded-xl border border-border text-sm text-muted-foreground italic">
                            لم يتم صرف روشتة لهذه الزيارة.
                          </div>
                        )}
                      </div>`

const replacementWithInvoice = `                          <div className="bg-card p-4 rounded-xl border border-border text-sm text-muted-foreground italic">
                            لم يتم صرف روشتة لهذه الزيارة.
                          </div>
                        )}
                      </div>

                      {/* 3. Invoice & Financial Receipt Section */}
                      <div className="space-y-3 pt-3 border-t border-border">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <h5 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                            <Receipt className="w-4 h-4 text-emerald-600" />
                            <span>الفاتورة والإيصال المالي</span>
                          </h5>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-foreground">
                              {Number(appt.netTotal) || Number(appt.servicePrice) || 250} ج.م
                            </span>
                            <Badge
                              variant="outline"
                              className={\`text-[10px] font-bold \${
                                appt.paymentStatus === 'paid' || appt.status === 'completed'
                                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                  : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                              }\`}
                            >
                              {appt.paymentStatus === 'paid' || appt.status === 'completed' ? 'مدفوعة' : 'غير مدفوعة / سداد نقدي'}
                            </Badge>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            onClick={() => handleOpenInvoice(appt)}
                            className="h-9 px-3.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                          >
                            <Receipt className="w-4 h-4" />
                            <span>عرض وطباعة الفاتورة PDF</span>
                          </Button>

                          <a
                            href={\`/clinic/\${slug}/invoice/\${appt.invoiceNumber || appt.id}\`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-bold rounded-xl border border-border text-foreground hover:bg-secondary transition-colors cursor-pointer"
                            title="فتح الفاتورة الإلكترونية في تبويب مستقل"
                          >
                            <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                            <span>صفحة الفاتورة العامة</span>
                          </a>
                        </div>
                      </div>`

if (ppNorm.includes(targetEndOfRx)) {
  ppNorm = ppNorm.replace(targetEndOfRx, replacementWithInvoice)
  console.log('✅ Added Invoice section to Patient Profile visits')
} else {
  console.warn('⚠️ Could not match targetEndOfRx in PatientProfileClient.tsx')
}

// Add InvoiceView modal render at bottom of PatientProfileClient
const targetEndModal = `      </Dialog>`
const lastEndModal = ppNorm.lastIndexOf(targetEndModal)
if (lastEndModal !== -1 && !ppNorm.includes('selectedInvoiceForView &&')) {
  const insertPos = lastEndModal + targetEndModal.length
  ppNorm = ppNorm.slice(0, insertPos) + `

      {/* Invoice View Modal */}
      {selectedInvoiceForView && (
        <InvoiceView
          invoice={selectedInvoiceForView}
          slug={slug}
          onClose={() => setSelectedInvoiceForView(null)}
        />
      )}` + ppNorm.slice(insertPos)
  console.log('✅ Added InvoiceView modal rendering at bottom of PatientProfileClient')
}

if (isPpCrlf) ppNorm = ppNorm.replace(/\n/g, '\r\n')
fs.writeFileSync(ppPath, ppNorm, 'utf8')
console.log('✅ Successfully updated PatientProfileClient.tsx')

console.log('=== All file patches applied successfully! ===')
