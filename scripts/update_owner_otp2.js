const fs = require('fs');
const f = 'src/app/owner/page.tsx';
let c = fs.readFileSync(f, 'utf8');

if (!c.includes('c.resetPasswordOtp')) {
  c = c.replace(
    /<h4 className="font-black text-sm text-\[#182230\]">\{c\.clinicName\}<\/h4>/,
    `<h4 className="font-black text-sm text-[#182230]">{c.clinicName}</h4>
                                {c.resetPasswordOtp && (
                                  <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                    <div>
                                      <span className="text-[10px] font-bold text-amber-800 block">طلب استعادة كلمة المرور:</span>
                                      <span className="text-xs font-black text-amber-900 tracking-widest">{c.resetPasswordOtp}</span>
                                    </div>
                                  </div>
                                )}`
  );
  
  c = c.replace(
    /import \{ ClinicLogo \} from '@\/components\/clinic\/ClinicLogo'/,
    `import { ClinicLogo } from '@/components/clinic/ClinicLogo'
import { AlertCircle } from 'lucide-react'`
  );

  fs.writeFileSync(f, c);
  console.log('Owner table updated for OTP!');
} else {
  console.log('Already added.');
}
