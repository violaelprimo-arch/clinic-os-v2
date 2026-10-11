const fs = require('fs');
const f = 'src/app/owner/page.tsx';
let c = fs.readFileSync(f, 'utf8');

if (!c.includes('resetPasswordOtp')) {
  c = c.replace(
    /<div className="flex flex-col sm:flex-row gap-4">/,
    `{clinic.resetPasswordOtp && (
                      <div className="mb-4 p-4 rounded-2xl bg-amber-50 border border-amber-200">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className="w-5 h-5 text-amber-600" />
                          <h4 className="font-bold text-sm text-amber-800">طلب استعادة كلمة المرور</h4>
                        </div>
                        <p className="text-xs text-amber-700 mb-2">
                          لقد طلب طبيب العيادة تغيير كلمة المرور الخاصة به. يرجى تزويده بهذا الكود السري:
                        </p>
                        <div className="text-xl font-black text-amber-900 tracking-widest text-center py-2 bg-amber-100/50 rounded-lg">
                          {clinic.resetPasswordOtp}
                        </div>
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row gap-4">`
  );

  fs.writeFileSync(f, c);
  console.log('Owner page updated for OTP!');
} else {
  console.log('Already added.');
}
