const fs = require('fs');

// 1. Remove from Doctor Settings
let doctorSettings = fs.readFileSync('src/app/clinic/[slug]/admin/settings/page.tsx', 'utf8');
doctorSettings = doctorSettings.replace(/\{\/\* AI Settings \*\/\}.*?\{\/\* Payment Settings \*\/\}/s, '{/* Payment Settings */}');
fs.writeFileSync('src/app/clinic/[slug]/admin/settings/page.tsx', doctorSettings);

// 2. Add Global API Key to Owner Dashboard
let ownerPage = fs.readFileSync('src/app/owner/page.tsx', 'utf8');
ownerPage = ownerPage.replace('const [editingId, setEditingId] = useState<string | null>(null)', 'const [editingId, setEditingId] = useState<string | null>(null)\n  const [globalApiKey, setGlobalApiKey] = useState(\'\')\n  const [isSavingGlobal, setIsSavingGlobal] = useState(false)');

const fetchGlobalConfig = `
    const fetchGlobal = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'system')));
        const configDoc = snap.docs.find(d => d.id === 'config');
        if (configDoc && configDoc.data().globalAiKey) {
          setGlobalApiKey(configDoc.data().globalAiKey);
        }
      } catch (err) {}
    }
    fetchGlobal();
`;
ownerPage = ownerPage.replace('const fetchClinics = async () => {', fetchGlobalConfig + '\n    const fetchClinics = async () => {');

const saveGlobalConfig = `
  const saveGlobalKey = async () => {
    setIsSavingGlobal(true);
    try {
      await updateDoc(doc(db, 'system', 'config'), { globalAiKey: globalApiKey });
      toast.success('تم حفظ مفتاح الذكاء الاصطناعي المركزي بنجاح!');
    } catch (err: any) {
      if (err.code === 'not-found') {
        // Create it if it doesn't exist
        await addDoc(collection(db, 'system'), { globalAiKey: globalApiKey }); // Wait, need precise ID 'config'
        // Let's use setDoc instead but we don't have it imported. We can just catch and alert for now, 
        // wait, we can just use the proper firebase method.
      }
      toast.error('حدث خطأ أثناء حفظ المفتاح المركزي');
    }
    setIsSavingGlobal(false);
  }
`;
// Let's modify imports in owner page to include setDoc
ownerPage = ownerPage.replace('addDoc, getDocs, deleteDoc, updateDoc, doc', 'addDoc, getDocs, deleteDoc, updateDoc, doc, setDoc');

const saveGlobalConfigBetter = `
  const saveGlobalKey = async () => {
    setIsSavingGlobal(true);
    try {
      await setDoc(doc(db, 'system', 'config'), { globalAiKey: globalApiKey }, { merge: true });
      toast.success('تم حفظ مفتاح الذكاء الاصطناعي المركزي بنجاح!');
    } catch (err) {
      toast.error('حدث خطأ أثناء حفظ المفتاح المركزي');
    }
    setIsSavingGlobal(false);
  }
`;
ownerPage = ownerPage.replace('const handleSave = async (e: React.FormEvent) => {', saveGlobalConfigBetter + '\n  const handleSave = async (e: React.FormEvent) => {');

const globalKeyUI = `
      <Card className="mb-8 border-t-4 border-t-purple-500 shadow-xl">
        <CardHeader className="bg-purple-50/50">
          <CardTitle className="text-xl text-purple-700">إعدادات النظام المركزية (Global AI)</CardTitle>
          <CardDescription>ضع هنا مفتاح Gemini API الخاص بك كمالك للمنصة. هذا المفتاح سيُشغل الذكاء الاصطناعي لجميع العيادات المشتركة.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6 flex gap-4">
          <div className="flex-1">
            <Input type="password" value={globalApiKey} onChange={e => setGlobalApiKey(e.target.value)} dir="ltr" className="text-right border-purple-200 focus:border-purple-500 font-mono" placeholder="AIzaSy..." />
          </div>
          <Button onClick={saveGlobalKey} disabled={isSavingGlobal} className="bg-purple-600 hover:bg-purple-700 w-32 font-bold">
            {isSavingGlobal ? 'جاري الحفظ...' : 'حفظ المفتاح'}
          </Button>
        </CardContent>
      </Card>
`;
ownerPage = ownerPage.replace('<div className="flex justify-between items-center mb-8">', globalKeyUI + '\n      <div className="flex justify-between items-center mb-8">');

// Remove per-clinic aiApiKey from UI in owner/page.tsx
ownerPage = ownerPage.replace('<div className="space-y-2"><Label>Gemini API Key</Label><Input type="password" value={aiApiKey} onChange={e => setAiApiKey(e.target.value)} dir="ltr" className="text-right" placeholder="AIzaSy..." /></div>', '');

fs.writeFileSync('src/app/owner/page.tsx', ownerPage);
console.log('Owner page patched');

// 3. Update API Routes to fetch global key instead of clinic payload key
const apiChat = fs.readFileSync('src/app/api/chat/route.ts', 'utf8');
const newApiChat = apiChat.replace('const { slug, newMessages, aiApiKey } = await request.json()', 
`const { slug, newMessages } = await request.json()
    // Fetch global key
    const adminDb = require('@/lib/firebase').db; // Wait, we can't use client db in route if it's admin, but we can if we export it or just use a standard fetch.
    // Let's use the provided firebase import, but wait, route.ts is edge? No, it's node. 
`);
// Wait, I can't easily fetch from firebase in standard Next.js route without proper imports.
// Let's check imports in route.ts
