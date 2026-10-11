const fs = require('fs');
const f = 'src/app/clinic/[slug]/admin/settings/page.tsx';
let c = fs.readFileSync(f, 'utf8');

if (!c.includes("id: 'security'")) {
  c = c.replace(
    /const baseTabs = \[/,
    `const baseTabs = [
    { id: 'security', label: 'الأمان والحساب', icon: Lock },`
  );

  c = c.replace(
    /const tabs = aiLockedByOwner/,
    `const tabs = aiLockedByOwner`
  );

  // Add the state for new credentials
  c = c.replace(
    /const \[supportNumbers, setSupportNumbers\] = useState<any\[\]>\(\[\]\)/,
    `const [supportNumbers, setSupportNumbers] = useState<any[]>([]);
  const [newDoctorEmail, setNewDoctorEmail] = useState('');
  const [newDoctorPassword, setNewDoctorPassword] = useState('');
  const [currentRole, setCurrentRole] = useState('');`
  );

  // Add fetching current role
  c = c.replace(
    /const fetchSupport = async \(\) => \{/,
    `setCurrentRole(localStorage.getItem('clinic_role') || 'doctor');
    const fetchSupport = async () => {`
  );

  // Add rendering for security tab
  c = c.replace(
    /\{\/\* TAB 1: Profile & Visual Identity \*\/\}/,
    `{/* TAB SECURITY */}
      {activeTab === 'security' && currentRole === 'doctor' && (
        <div className="medical-card p-6 max-w-2xl space-y-5">
          <div className="pb-3 border-b border-[#E5EAF0]">
            <h3 className="font-bold text-sm text-[#182230]">إعدادات حساب الطبيب</h3>
            <p className="text-xs text-slate-400">يمكنك هنا تغيير البريد الإلكتروني وكلمة المرور الخاصة بك. هذه البيانات لا تظهر لمالك المنصة.</p>
          </div>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">البريد الإلكتروني الجديد</Label>
              <Input
                type="email"
                value={newDoctorEmail}
                onChange={e => setNewDoctorEmail(e.target.value)}
                placeholder="doctor@clinic.com"
                className="h-10 text-xs rounded-xl text-left"
                dir="ltr"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">كلمة المرور الجديدة</Label>
              <Input
                type="password"
                value={newDoctorPassword}
                onChange={e => setNewDoctorPassword(e.target.value)}
                placeholder="••••••••"
                className="h-10 text-xs rounded-xl text-left"
                dir="ltr"
              />
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold rounded-xl">
              تنبيه: سيتم تسجيل خروجك بعد الحفظ وستحتاج لتسجيل الدخول بالبيانات الجديدة.
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: Profile & Visual Identity */}`
  );

  // Add imports
  c = c.replace(
    /Users, Clock, Printer, ShieldCheck, Settings,/,
    `Users, Clock, Printer, ShieldCheck, Settings, Lock,`
  );

  // Add saving logic to handleSave
  c = c.replace(
    /showPrices,/,
    `showPrices,
        ...(newDoctorEmail ? { doctorEmail: newDoctorEmail } : {}),
        ...(newDoctorPassword ? { doctorPassword: newDoctorPassword } : {}),`
  );

  // Add redirect after saving logic if password was changed
  c = c.replace(
    /toast\.success\('تم حفظ كافة إعدادات العيادة بنجاح وتطبيقها فورياً'\)/,
    `toast.success('تم حفظ كافة إعدادات العيادة بنجاح وتطبيقها فورياً');
      if (newDoctorEmail || newDoctorPassword) {
        toast.info('تم تغيير بيانات الدخول، يرجى تسجيل الدخول مجدداً.');
        setTimeout(() => {
          localStorage.removeItem('clinic_role');
          window.location.href = \`/clinic/\${slug}/login\`;
        }, 2000);
      }`
  );
  
  // Hide security tab from tabs if role is not doctor
  c = c.replace(
    /\{tabs\.map\(\(tab\) => \{/,
    `{tabs.filter(t => t.id !== 'security' || currentRole === 'doctor').map((tab) => {`
  );

  fs.writeFileSync(f, c);
  console.log('Settings Security Tab added!');
} else {
  console.log('Already added.');
}
