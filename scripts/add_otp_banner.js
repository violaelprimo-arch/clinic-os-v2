const fs = require('fs');
let c = fs.readFileSync('src/app/owner/page.tsx', 'utf8');

const target = `{/* 2. KPI Metrics Cards */}`;
const banner = `{/* Active Password Reset OTPs Notification Banner */}
      {clinics.some(c => c.resetPasswordOtp) && (
        <div className="bg-amber-50 border-2 border-amber-300 p-4 rounded-2xl flex flex-col gap-3 shadow-sm">
          <div className="flex items-center gap-2 text-amber-900 font-black text-sm">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>تنبيه: يوجد طلب استعادة كلمة مرور معلق من أحد الأطباء (OTP):</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {clinics.filter(c => c.resetPasswordOtp).map(c => (
              <div key={c.id} className="bg-white border border-amber-200 p-3.5 rounded-xl flex items-center justify-between shadow-xs">
                <div>
                  <h4 className="font-bold text-xs text-slate-900">{c.clinicName}</h4>
                  <p className="text-[11px] text-slate-600 font-medium">{c.doctorName ? \`د. \${c.doctorName}\` : 'طبيب العيادة'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-black tracking-widest text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 font-mono">
                    {c.resetPasswordOtp}
                  </span>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-8 px-2.5 text-xs font-bold border-amber-300 text-amber-900 hover:bg-amber-100 rounded-lg cursor-pointer"
                    onClick={() => {
                      navigator.clipboard.writeText(c.resetPasswordOtp);
                      toast.success('تم نسخ رمز التحقق بنجاح!');
                    }}
                  >
                    نسخ الكود
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. KPI Metrics Cards */}`;

c = c.replace(target, banner);

fs.writeFileSync('src/app/owner/page.tsx', c);
console.log('Added prominent OTP banner to owner dashboard!');
