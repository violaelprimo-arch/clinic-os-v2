const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/admin/patients/[patientId]/page.tsx', 'utf8');

if (!c.includes('A4Prescription')) {
  c = c.replace(
    "import { toast } from 'sonner'",
    "import { toast } from 'sonner'\nimport { A4Prescription } from '@/components/clinic/A4Prescription'"
  );
  
  // We need clinic data too! Let's fetch it or just pass null. Wait, clinic is needed for the header!
  // I'll fetch clinic data in PatientProfilePage
  const fetchFind = `const unsub = onSnapshot(qAppt, (snap) => {`;
  const fetchReplace = `
    const fetchClinic = async () => {
      const q = query(collection(db, 'clinics'), where('slug', '==', slug));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setClinic({ id: snap.docs[0].id, ...snap.docs[0].data() });
      }
    };
    fetchClinic();
    
    const unsub = onSnapshot(qAppt, (snap) => {`;
    
  c = c.replace(fetchFind, fetchReplace);
  c = c.replace(
    "const [tempDiagnosis, setTempDiagnosis] = useState('')",
    "const [tempDiagnosis, setTempDiagnosis] = useState('')\n  const [clinic, setClinic] = useState<any>(null)"
  );

  const rxUIFind = `{appt.drugs && appt.drugs.length > 0 ? (
                          <div className="bg-white rounded-xl border border-indigo-100 overflow-hidden">
                            <div className="grid grid-cols-12 bg-indigo-50/50 p-3 text-xs font-bold text-indigo-900 border-b border-indigo-100">
                              <div className="col-span-4">الدواء</div>
                              <div className="col-span-3">الجرعة</div>
                              <div className="col-span-5">التعليمات</div>
                            </div>
                            <div className="divide-y divide-[#E5EAF0]">
                              {appt.drugs.map((d: any, idx: number) => (
                                <div key={idx} className="grid grid-cols-12 p-3 text-sm">
                                  <div className="col-span-4 font-bold text-slate-800" dir="ltr" style={{ textAlign: 'right' }}>{d.name}</div>
                                  <div className="col-span-3 text-slate-600 font-medium">{d.dosage}</div>
                                  <div className="col-span-5 text-slate-500">{d.notes}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (`;
                        
  const rxUIReplace = `{appt.drugs && appt.drugs.length > 0 ? (
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
                        ) : (`;

  c = c.replace(rxUIFind, rxUIReplace);
  
  fs.writeFileSync('src/app/clinic/[slug]/admin/patients/[patientId]/page.tsx', c);
}
