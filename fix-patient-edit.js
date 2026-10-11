const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/patient/page.tsx', 'utf8');

if (!c.includes('isEditingProfile')) {
  // Add edit profile state
  c = c.replace(
    "const [clinic, setClinic] = useState<any>(null)",
    "const [clinic, setClinic] = useState<any>(null)\n  const [isEditingProfile, setIsEditingProfile] = useState(false)\n  const [editAge, setEditAge] = useState('')\n  const [editName, setEditName] = useState('')"
  );
  
  // Add handleEditProfile
  const logicFind = `// If user has a cookie or we pass it via query (simplified for demo, typically Auth is used)`;
  const logicReplace = `
  const handleEditProfile = async (e: any) => {
    e.preventDefault();
    if (!patientData) return;
    try {
      const q = query(collection(db, 'appointments'), where('phone', '==', patientData.phone), where('clinic_id', '==', patientData.clinic_id));
      const snap = await getDocs(q);
      snap.docs.forEach(async (d) => {
        await updateDoc(doc(db, 'appointments', d.id), {
          patientName: editName || patientData.name,
          age: editAge || null
        });
      });
      setPatientData({ ...patientData, name: editName || patientData.name });
      setIsEditingProfile(false);
      toast.success('تم تحديث البيانات بنجاح');
    } catch (error) {
      toast.error('حدث خطأ أثناء التحديث');
    }
  }

  // If user has a cookie or we pass it via query (simplified for demo, typically Auth is used)`;
  c = c.replace(logicFind, logicReplace);

  // Add the Edit button and Modal
  const uiFind = `            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
              يمكنك متابعة رقم دورك اللحظي في العيادة، ومراجعة سجل زياراتك الطبية والروشتات السابقة المصروفة لك.
            </p>
          </div>
          
          <div className="relative z-10 shrink-0">`;
          
  const uiReplace = `            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
              يمكنك متابعة رقم دورك اللحظي في العيادة، ومراجعة سجل زياراتك الطبية والروشتات السابقة المصروفة لك.
            </p>
            <Button 
              variant="outline" 
              onClick={() => { setEditName(patientData.name); setIsEditingProfile(true); }}
              className="mt-3 bg-white/10 border-white/20 text-white hover:bg-white/20 h-8 text-xs rounded-lg"
            >
              تعديل بياناتي
            </Button>

            <Dialog open={isEditingProfile} onOpenChange={setIsEditingProfile}>
              <DialogContent className="sm:max-w-md" dir="rtl">
                <DialogHeader>
                  <DialogTitle>تعديل بياناتي الشخصية</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleEditProfile} className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-600">الاسم</Label>
                    <input 
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-[#E5EAF0] text-sm"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-600">العمر</Label>
                    <input 
                      type="number"
                      value={editAge}
                      onChange={e => setEditAge(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-[#E5EAF0] text-sm"
                    />
                  </div>
                  <Button type="submit" className="w-full h-10 bg-[#15B8A6] hover:bg-[#0D9488] text-white rounded-xl text-xs font-bold">
                    حفظ التعديلات
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

          </div>
          
          <div className="relative z-10 shrink-0">`;
          
  c = c.replace(uiFind, uiReplace);

  fs.writeFileSync('src/app/clinic/[slug]/patient/page.tsx', c);
}
