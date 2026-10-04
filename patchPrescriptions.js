const fs = require('fs');
let content = fs.readFileSync('src/app/clinic/[slug]/admin/prescriptions/page.tsx', 'utf8');

// 1. Import Egyptian Drugs and Star icon
content = content.replace("import { useSearchParams } from 'next/navigation'", "import { useSearchParams } from 'next/navigation'\nimport { EGYPTIAN_DRUGS } from '@/lib/egyptian-drugs'\nimport { doc, updateDoc } from 'firebase/firestore'\nimport { Star } from 'lucide-react'");

// 2. Add State for favorites and clinicId
content = content.replace("const [drugSearch, setDrugSearch] = useState('')", "const [drugSearch, setDrugSearch] = useState('')\n  const [favoriteDrugs, setFavoriteDrugs] = useState<string[]>([])\n  const [clinicId, setClinicId] = useState<string | null>(null)");

// Remove old commonDrugs state
content = content.replace(/const \[commonDrugs\] = useState\(\[\s*'[^\]]+\]\)/, '');

// 3. Load favorites inside useEffect
const fetchLogic = `
        if (!snapshot.empty) {
          const c = snapshot.docs[0]
          setClinic(c.data())
          setClinicId(c.id)
          if (c.data().favoriteDrugs) {
            setFavoriteDrugs(c.data().favoriteDrugs)
          }
        }
`;
content = content.replace(/if \(!snapshot\.empty\) \{\s*setClinic\(snapshot\.docs\[0\]\.data\(\)\)\s*\}/, fetchLogic);

// 4. Implement toggleFavorite function
const toggleFavorite = `
  const toggleFavorite = async (e: React.MouseEvent, drugName: string) => {
    e.stopPropagation();
    if (!clinicId) return;
    let newFavs = [...favoriteDrugs];
    if (newFavs.includes(drugName)) {
      newFavs = newFavs.filter(d => d !== drugName);
    } else {
      newFavs.push(drugName);
    }
    setFavoriteDrugs(newFavs);
    try {
      await updateDoc(doc(db, 'clinics', clinicId), { favoriteDrugs: newFavs });
      toast.success(newFavs.includes(drugName) ? 'تم الإضافة للمفضلة' : 'تم الإزالة من المفضلة');
    } catch (err) {
      toast.error('حدث خطأ أثناء حفظ المفضلة');
    }
  }

  const handlePrint = () => {
`;
content = content.replace('  const handlePrint = () => {', toggleFavorite);

// 5. Update Search UI
const searchUI = `
                {drugSearch && (
                  <div className="absolute w-full mt-1 bg-white border shadow-2xl rounded-xl overflow-hidden z-50 max-h-64 overflow-y-auto">
                    {[...new Set([...favoriteDrugs, ...EGYPTIAN_DRUGS])]
                      .filter(d => d.toLowerCase().includes(drugSearch.toLowerCase()))
                      .slice(0, 50) // Limit to 50 results for performance
                      .map(drug => {
                        const isFav = favoriteDrugs.includes(drug);
                        return (
                          <div 
                            key={drug} 
                            className="p-3 hover:bg-slate-50 cursor-pointer text-sm font-bold border-b last:border-none flex justify-between items-center"
                            onClick={() => {
                              const emptyDrug = drugs.find(d => !d.name)
                              if (emptyDrug) {
                                updateDrug(emptyDrug.id, 'name', drug)
                              } else {
                                setDrugs([...drugs, { id: Date.now(), name: drug, dosage: '', duration: '' }])
                              }
                              setDrugSearch('')
                            }}
                          >
                            <span dir="ltr" className={isFav ? 'text-primary' : 'text-slate-700'}>{drug}</span>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className={\`h-8 w-8 rounded-full \${isFav ? 'text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50' : 'text-slate-300 hover:text-yellow-500 hover:bg-yellow-50'}\`}
                              onClick={(e) => toggleFavorite(e, drug)}
                            >
                              <Star className={\`w-4 h-4 \${isFav ? 'fill-current' : ''}\`} />
                            </Button>
                          </div>
                        )
                    })}
                  </div>
                )}
`;

content = content.replace(/\{drugSearch && \([\s\S]*?\)\}/, searchUI);

fs.writeFileSync('src/app/clinic/[slug]/admin/prescriptions/page.tsx', content);
console.log('Successfully patched prescriptions/page.tsx');
