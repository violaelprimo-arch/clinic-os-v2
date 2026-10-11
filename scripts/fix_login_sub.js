const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/login/page.tsx', 'utf8');

if (!c.includes("searchParams = new URLSearchParams")) {
  c = c.replace(
    /const \[email, setEmail\] = useState\(''\)/,
    `const [email, setEmail] = useState('')
  
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    if (searchParams.get('error') === 'subscription_ended') {
      setError('تم انتهاء الاشتراك. يرجى التواصل مع الإدارة.');
    }
  }, [])`
  );
  
  c = c.replace(
    /if \(!snapshot\.empty\) \{\s*const clinicDoc = snapshot\.docs\[0\]\.data\(\)/,
    `if (!snapshot.empty) {
              const clinicDoc = snapshot.docs[0].data()
              if (clinicDoc.isActive === false || (clinicDoc.expirationDate && new Date(clinicDoc.expirationDate) < new Date())) {
                setError('تم انتهاء الاشتراك. يرجى التواصل مع الإدارة.')
                setIsLoading(false)
                return
              }`
  );
  
  fs.writeFileSync('src/app/clinic/[slug]/login/page.tsx', c);
  console.log('Fixed login subscription check!');
} else {
  console.log('Already fixed login.');
}
