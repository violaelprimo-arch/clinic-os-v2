const fs = require('fs');
const f = 'src/app/clinic/[slug]/login/page.tsx';
let c = fs.readFileSync(f, 'utf8');

if (!c.includes('isResetMode')) {
  c = c.replace(
    /const \[isLoading, setIsLoading\] = useState\(false\)/,
    `const [isLoading, setIsLoading] = useState(false)
  const [isResetMode, setIsResetMode] = useState(false)
  const [resetOtpSent, setResetOtpSent] = useState(false)
  const [resetOtp, setResetOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')`
  );

  c = c.replace(
    /import \{ collection, query, where, getDocs \} from 'firebase\/firestore'/,
    `import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore'`
  );

  // Add the reset handler function
  c = c.replace(
    /const handleLogin = async/,
    `const handleForgotPassword = async () => {
    if (!email.trim()) {
      return setError('يرجى إدخال البريد الإلكتروني أولاً');
    }
    setIsLoading(true);
    try {
      const q = query(collection(db, 'clinics'), where('slug', '==', slug));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const cDoc = snapshot.docs[0];
        const data = cDoc.data();
        if (data.doctorEmail === email.trim()) {
          const otp = Math.floor(100000 + Math.random() * 900000).toString();
          await updateDoc(doc(db, 'clinics', cDoc.id), {
            resetPasswordOtp: otp,
            resetPasswordRequestedAt: new Date().toISOString()
          });
          setResetOtpSent(true);
          toast.success('تم إرسال كود استعادة كلمة المرور لمالك المنصة بنجاح.');
        } else {
          setError('البريد الإلكتروني غير مسجل.');
        }
      }
    } catch (err) {
      setError('حدث خطأ أثناء طلب استعادة كلمة المرور.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetOtp.trim() || !newPassword.trim()) {
      return setError('يرجى إدخال الكود وكلمة المرور الجديدة');
    }
    setIsLoading(true);
    try {
      const q = query(collection(db, 'clinics'), where('slug', '==', slug));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const cDoc = snapshot.docs[0];
        const data = cDoc.data();
        if (data.resetPasswordOtp === resetOtp) {
          await updateDoc(doc(db, 'clinics', cDoc.id), {
            doctorPassword: newPassword,
            resetPasswordOtp: null,
            resetPasswordRequestedAt: null
          });
          toast.success('تم تغيير كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول.');
          setIsResetMode(false);
          setResetOtpSent(false);
          setPassword(newPassword);
        } else {
          setError('الكود غير صحيح.');
        }
      }
    } catch (err) {
      setError('حدث خطأ أثناء تغيير كلمة المرور.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async`
  );

  // Add the reset UI inside the form
  c = c.replace(
    /\{error && \(/,
    `{isResetMode ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">البريد الإلكتروني (للتأكيد)</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 text-sm bg-slate-50 border-slate-200"
                  dir="ltr"
                  disabled={resetOtpSent}
                />
              </div>
              
              {!resetOtpSent ? (
                <Button onClick={handleForgotPassword} disabled={isLoading} className="w-full h-12 bg-[#15B8A6] hover:bg-[#0D9488] text-white font-bold rounded-xl shadow-lg">
                  {isLoading ? 'جاري الإرسال...' : 'طلب كود الاستعادة (يُرسل للمالك)'}
                </Button>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-600">كود OTP (من المالك)</Label>
                    <Input
                      type="text"
                      value={resetOtp}
                      onChange={(e) => setResetOtp(e.target.value)}
                      className="h-12 text-sm text-center tracking-widest font-mono"
                      dir="ltr"
                      placeholder="123456"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-600">كلمة المرور الجديدة</Label>
                    <PasswordInput
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="h-12 text-sm"
                      dir="ltr"
                    />
                  </div>
                  <Button onClick={handleResetPassword} disabled={isLoading} className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg">
                    {isLoading ? 'جاري الحفظ...' : 'تأكيد وتغيير كلمة المرور'}
                  </Button>
                </>
              )}
              
              <div className="text-center">
                <button type="button" onClick={() => setIsResetMode(false)} className="text-xs font-bold text-slate-500 hover:text-slate-800">
                  العودة لتسجيل الدخول
                </button>
              </div>
            </div>
          ) : (
            <>
              {error && (`
  );

  // Close the <> wrapper before the "ليس لديك حساب؟" section
  c = c.replace(
    /<div className="pt-4 border-t border-\[#E5EAF0\] text-center">/,
    `            </>
          )}

          <div className="pt-4 border-t border-[#E5EAF0] text-center">`
  );

  // Add the "Forgot Password" link inside the normal login form
  c = c.replace(
    /<PasswordInput\s*value=\{password\}\s*onChange=\{\(e\) => setPassword\(e.target.value\)\}\s*className="h-12 text-sm"\s*dir="ltr"\s*\/>/,
    `<PasswordInput
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 text-sm"
                  dir="ltr"
                />
                <div className="flex justify-end mt-1">
                  <button type="button" onClick={() => setIsResetMode(true)} className="text-[11px] font-bold text-[#15B8A6] hover:underline">
                    نسيت كلمة المرور؟
                  </button>
                </div>`
  );

  // Remove the old {error && ( as it was duplicated or messed up? Wait, let's fix it if it's there.
  // My replace logic was `{error && (` -> `{isResetMode ? (...) : (<>{error && (`
  // Which means it correctly wraps the original form inside `<>`.
  
  fs.writeFileSync(f, c);
  console.log('Login OTP logic added!');
} else {
  console.log('Already added.');
}
