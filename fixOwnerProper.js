const fs = require('fs');

let content = fs.readFileSync('src/app/owner/page.tsx', 'utf8');

// Ensure setDoc is imported
if (!content.includes('setDoc')) {
  content = content.replace('addDoc, getDocs, deleteDoc, updateDoc, doc', 'addDoc, getDocs, deleteDoc, updateDoc, doc, setDoc');
}

// Ensure states exist
if (!content.includes('globalApiKey')) {
  content = content.replace('const [editingId, setEditingId] = useState<string | null>(null)', 'const [editingId, setEditingId] = useState<string | null>(null)\n  const [globalApiKey, setGlobalApiKey] = useState("")\n  const [isSavingGlobal, setIsSavingGlobal] = useState(false)');
}

// Add fetch function
const fetchCode = `
  useEffect(() => {
    const fetchGlobal = async () => {
      try {
        const snap = await getDocs(collection(db, 'system'));
        const configDoc = snap.docs.find(d => d.id === 'config');
        if (configDoc && configDoc.data().globalAiKey) {
          setGlobalApiKey(configDoc.data().globalAiKey);
        }
      } catch (err) {}
    }
    fetchGlobal();
`;
if (!content.includes('fetchGlobal')) {
  content = content.replace('useEffect(() => {', fetchCode + '\n  // ' );
}

// Add save function
const saveCode = `
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
if (!content.includes('saveGlobalKey')) {
  content = content.replace('const handleAddOrUpdateClinic = async', saveCode + '\n  const handleAddOrUpdateClinic = async');
}

// Add UI
const uiCode = `
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
if (!content.includes('إعدادات النظام المركزية')) {
  content = content.replace('<div className="space-y-8" dir="rtl">', '<div className="space-y-8" dir="rtl">\n' + uiCode);
}

fs.writeFileSync('src/app/owner/page.tsx', content);
console.log('Owner UI correctly patched!');
