const fs = require('fs');
let content = fs.readFileSync('src/app/clinic/[slug]/admin/prescriptions/page.tsx', 'utf8');

content = content.replace("import { Star } from 'lucide-react'", "import { Star, Settings2, ShieldCheck, Pill } from 'lucide-react'\nimport { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'");

content = content.replace("const [favoriteDrugs, setFavoriteDrugs] = useState<string[]>([])", "const [favoriteDrugs, setFavoriteDrugs] = useState<string[]>([])\n  const [customDrugs, setCustomDrugs] = useState<string[]>([])\n  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false)");

content = content.replace("setFavoriteDrugs(c.data().favoriteDrugs)", "setFavoriteDrugs(c.data().favoriteDrugs)\n          }\n          if (c.data().customDrugs) {\n            setCustomDrugs(c.data().customDrugs)");

const addCustomLogic = `
  const addCustomDrug = async (drugName: string) => {
    if (!clinicId || !drugName.trim()) return;
    const newCustom = [...new Set([...customDrugs, drugName])];
    const newFavs = [...new Set([...favoriteDrugs, drugName])];
    setCustomDrugs(newCustom);
    setFavoriteDrugs(newFavs);
    try {
      await updateDoc(doc(db, 'clinics', clinicId), { customDrugs: newCustom, favoriteDrugs: newFavs });
      toast.success('تمت إضافة الدواء لقاعدة البيانات والمفضلة');
      
      const emptyDrug = drugs.find(d => !d.name)
      if (emptyDrug) updateDrug(emptyDrug.id, 'name', drugName)
      else setDrugs([...drugs, { id: Date.now(), name: drugName, dosage: '', duration: '' }])
      
      setDrugSearch('');
    } catch (err) {
      toast.error('حدث خطأ أثناء الإضافة');
    }
  }
`;
content = content.replace("const handlePrint = () => {", addCustomLogic + "\n  const handlePrint = () => {");

const searchUIReplacement = `
              {/* Quick Add */}
              <div className="flex gap-2 relative">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input 
                    placeholder="ابحث عن الدواء في قاعدة البيانات (أكثر من 300 دواء)..." 
                    value={drugSearch}
                    onChange={e => setDrugSearch(e.target.value)}
                    className="pr-10 bg-slate-50 border-primary/20 focus:border-primary h-12 text-lg font-bold"
                  />
                  {drugSearch && (
                    <div className="absolute w-full mt-1 bg-white border shadow-2xl rounded-xl overflow-hidden z-50 max-h-72 overflow-y-auto">
                      {(() => {
                        const searchList = [...new Set([...favoriteDrugs, ...customDrugs, ...EGYPTIAN_DRUGS])];
                        const filtered = searchList.filter(d => d.toLowerCase().includes(drugSearch.toLowerCase())).slice(0, 50);
                        const exactMatch = searchList.find(d => d.toLowerCase() === drugSearch.toLowerCase());
                        
                        return (
                          <>
                            {filtered.map(drug => {
                              const isFav = favoriteDrugs.includes(drug);
                              return (
                                <div 
                                  key={drug} 
                                  className="p-3 hover:bg-slate-50 cursor-pointer text-sm font-bold border-b last:border-none flex justify-between items-center"
                                  onClick={() => {
                                    const emptyDrug = drugs.find(d => !d.name)
                                    if (emptyDrug) updateDrug(emptyDrug.id, 'name', drug)
                                    else setDrugs([...drugs, { id: Date.now(), name: drug, dosage: '', duration: '' }])
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
                            {!exactMatch && (
                              <div className="p-3 bg-slate-50 border-t flex justify-between items-center">
                                <span className="text-sm font-bold text-slate-500">غير موجود في القاعدة؟</span>
                                <Button size="sm" onClick={() => addCustomDrug(drugSearch)} className="h-8">
                                  <Plus className="w-4 h-4 ml-1" /> إضافة "{drugSearch}"
                                </Button>
                              </div>
                            )}
                          </>
                        )
                      })()}
                    </div>
                  )}
                </div>

                {/* Manage Favorites Dialog */}
                <Dialog open={isFavoritesOpen} onOpenChange={setIsFavoritesOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="h-12 border-primary/20 text-primary hover:bg-primary/5 px-6">
                      <Star className="w-5 h-5 ml-2 fill-primary" /> مفضلتي
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-xl" dir="rtl">
                    <DialogHeader>
                      <DialogTitle className="text-xl flex items-center gap-2 text-primary">
                        <Star className="w-6 h-6 fill-primary" /> إدارة الأدوية المفضلة
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 my-4 max-h-96 overflow-y-auto px-2">
                      {favoriteDrugs.length === 0 ? (
                        <p className="text-center text-slate-500 py-8">لا توجد أدوية مفضلة حتى الآن. يمكنك إضافة الأدوية بالضغط على النجمة بجوار أي دواء أثناء البحث.</p>
                      ) : (
                        <div className="grid grid-cols-1 gap-2">
                          {favoriteDrugs.map(drug => (
                            <div key={drug} className="flex justify-between items-center p-3 border rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
                              <span className="font-bold text-primary" dir="ltr">{drug}</span>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 w-8"
                                onClick={(e) => toggleFavorite(e, drug)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
`;

// Replace the entire Quick Add block
content = content.replace(/\{\/\* Quick Add \*\/\}\s*<div className="relative">[\s\S]*?\{\/\* Drugs List \*\/\}/, searchUIReplacement + "\n\n              {/* Drugs List */}");

fs.writeFileSync('src/app/clinic/[slug]/admin/prescriptions/page.tsx', content);
console.log('Successfully patched UI!');
