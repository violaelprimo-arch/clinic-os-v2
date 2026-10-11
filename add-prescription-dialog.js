const fs = require('fs');

const pFile = 'src/app/clinic/[slug]/admin/patients/[patientId]/page.tsx';
let c = fs.readFileSync(pFile, 'utf8');

// Add Dialog imports
c = c.replace(
  `import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'`,
  `import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'\nimport { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'`
);

// Add WhatsApp icon import if not there
if(!c.includes('MessageCircle')) {
  c = c.replace(
    `Save } from 'lucide-react'`,
    `Save, MessageCircle } from 'lucide-react'`
  );
}

// Add Print function and WhatsApp function inside the component
const importsEnd = c.indexOf('export default function PatientProfilePage');
const componentStart = c.indexOf('{', importsEnd) + 1;

const printAndWhatsAppFuncs = `
  const handlePrint = () => {
    window.print()
  }

  const sendWhatsAppRx = (appt: any) => {
    if (!phone) return toast.error('يرجى إدخال رقم هاتف المريض')
    let formattedPhone = phone.replace(/[^0-9]/g, '')
    if (formattedPhone.startsWith('0')) formattedPhone = '2' + formattedPhone

    const drugsList = appt.drugs
      .filter((d: any) => d.name)
      .map((d: any, i: number) => \`\${i + 1}. \${d.name} (\${d.dosage} - \${d.duration})\`)
      .join('\\n')

    const message = encodeURIComponent(
      \`الروشتة الطبية الإلكترونية 📋\\nالعيادة: \${clinic?.clinicName || 'العيادة'}\\nالمريض: \${patientData?.name}\\nالتاريخ: \${appt.date}\\n\\nالعلاج المطلوب:\\n\${drugsList}\\n\\nنتمنى لك الشفاء العاجل!\`
    )
    window.open(\`https://wa.me/\${formattedPhone}?text=\${message}\`, '_blank')
  }
`;

c = c.slice(0, componentStart) + printAndWhatsAppFuncs + c.slice(componentStart);

// Replace the A4Prescription rendering block
const oldPrescriptionBlock = `{appt.drugs && appt.drugs.length > 0 ? (
                          <div className="bg-white rounded-xl border border-indigo-100 overflow-hidden p-4">
                            <A4Prescription 
                              clinic={clinic}
                              patientName={patientData.name}
                              age={patientData.age || patientData.dob}
                              date={appt.date}
                              diagnosis={appt.diagnosis}
                              drugs={appt.drugs}
                              templateMode={clinic?.prescriptionTemplateUrl ? 'custom' : 'standard'}
                              topOffset={180}
                            />
                          </div>
                        ) : (
                          <div className="bg-white p-4 rounded-xl border border-[#E5EAF0] text-sm text-slate-400 italic">
                            لم يتم صرف روشتة لهذه الزيارة.
                          </div>
                        )}`;

const newPrescriptionBlock = `{appt.drugs && appt.drugs.length > 0 ? (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" className="w-full h-12 bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100">
                                <FileText className="w-4 h-4 ml-2" />
                                عرض الروشتة وإرسالها
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                              <DialogHeader className="print:hidden">
                                <DialogTitle>الروشتة الطبية - {appt.date}</DialogTitle>
                              </DialogHeader>
                              <div className="flex flex-wrap gap-2 mb-4 print:hidden">
                                <Button onClick={handlePrint} className="bg-[#15B8A6] hover:bg-[#0D9488] text-white">
                                  <Printer className="w-4 h-4 ml-2" />
                                  طباعة الروشتة
                                </Button>
                                <Button onClick={() => sendWhatsAppRx(appt)} className="bg-[#25D366] hover:bg-[#128C7E] text-white">
                                  <MessageCircle className="w-4 h-4 ml-2" />
                                  إرسال واتساب
                                </Button>
                                <Link href={\`/clinic/\${slug}/admin/prescriptions?appointmentId=\${appt.id}&phone=\${phone}&patientName=\${patientData.name}&age=\${patientData.age || patientData.dob}\`}>
                                  <Button variant="outline">
                                    تعديل الروشتة
                                  </Button>
                                </Link>
                              </div>
                              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden print:border-0 print:m-0">
                                <A4Prescription 
                                  clinic={clinic}
                                  patientName={patientData.name}
                                  age={patientData.age || patientData.dob}
                                  date={appt.date}
                                  diagnosis={appt.diagnosis}
                                  drugs={appt.drugs}
                                  templateMode={clinic?.prescriptionTemplateUrl ? 'custom' : 'standard'}
                                  topOffset={180}
                                />
                              </div>
                            </DialogContent>
                          </Dialog>
                        ) : (
                          <div className="bg-white p-4 rounded-xl border border-[#E5EAF0] text-sm text-slate-400 italic">
                            لم يتم صرف روشتة لهذه الزيارة.
                          </div>
                        )}`;

c = c.replace(oldPrescriptionBlock, newPrescriptionBlock);

// Replace the FileText import
if(!c.includes('FileText')) {
  c = c.replace(
    `Save } from 'lucide-react'`,
    `Save, FileText } from 'lucide-react'`
  );
}

fs.writeFileSync(pFile, c);
