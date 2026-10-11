const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/patient/login/page.tsx', 'utf8');

c = c.replace(/const \[password, setPassword\] = useState\(''\)/g, '');
c = c.replace(/password/g, 'phone'); // we will just match phone

// Actually let's rewrite the logic instead of blind replacing.
const logicFind = `
      if (isRegistering) {
        if (!name || !phone || !password) {
          toast.error('يرجى ملء كافة الحقول')
          setIsLoading(false)
          return
        }
        const userQ = query(collection(db, 'users'), where('phone', '==', phone), where('role', '==', 'patient'))
        const userSnap = await getDocs(userQ)
        if (!userSnap.empty) {
          toast.error('رقم الهاتف مسجل مسبقاً، يرجى تسجيل الدخول')
          setIsLoading(false)
          return
        }
        await addDoc(collection(db, 'users'), {
          name, phone, password, role: 'patient', clinic_id: clinicId, createdAt: new Date().toISOString()
        })
        toast.success('تم إنشاء حسابك بنجاح!')
        router.push(\`/clinic/\${slug}/patient?phone=\${phone}\`)
      } else {
        if (!phone || !password) {
          toast.error('يرجى إدخال رقم الهاتف وكلمة المرور')
          setIsLoading(false)
          return
        }
        const userQ = query(collection(db, 'users'), where('phone', '==', phone), where('password', '==', password), where('role', '==', 'patient'), where('clinic_id', '==', clinicId))
        const userSnap = await getDocs(userQ)
        if (userSnap.empty) {
          toast.error('بيانات الدخول غير صحيحة')
          setIsLoading(false)
          return
        }
        toast.success('تم تسجيل الدخول بنجاح')
        router.push(\`/clinic/\${slug}/patient?phone=\${phone}\`)
      }`;

const logicReplace = `
      // Phone only login/register
      if (!phone) {
        toast.error('يرجى إدخال رقم الهاتف')
        setIsLoading(false)
        return
      }

      // We just use phone to lookup appointments directly
      const q = query(collection(db, 'appointments'), where('clinic_id', '==', clinicId), where('phone', '==', phone))
      const snap = await getDocs(q)
      
      if (snap.empty && !isRegistering) {
        toast.error('لم نجد أي سجلات طبية بهذا الرقم، يرجى حجز كشف أولاً أو التسجيل')
        setIsLoading(false)
        return
      }

      toast.success('تم تسجيل الدخول بنجاح')
      router.push(\`/clinic/\${slug}/patient?phone=\${phone}\`)
`;

c = c.replace(logicFind, logicReplace);

const uiFind1 = `<div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-600">كلمة المرور</Label>
                    <div className="relative">
                      <Lock className="absolute right-3 top-3.5 h-4 w-4 text-slate-400" />
                      <PasswordInput
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="pl-3 pr-9 h-11 text-sm rounded-xl font-sans"
                        dir="ltr"
                      />
                    </div>
                  </div>`;
c = c.replace(uiFind1, ''); // remove it

fs.writeFileSync('src/app/clinic/[slug]/patient/login/page.tsx', c);
