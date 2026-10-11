const fs = require('fs');
const filePath = 'src/app/clinic/[slug]/admin/drugs/page.tsx';
let c = fs.readFileSync(filePath, 'utf8');

// 1. Add lucide icons
if (!c.includes('CloudDownload')) {
  c = c.replace(/ChevronRight/g, 'ChevronRight, CloudDownload, RefreshCw');
}

// 2. Add state and function
const functionToAdd = `
  const [isUpdating, setIsUpdating] = useState(false)

  const handleUpdateFromAPI = async () => {
    setIsUpdating(true)
    const tid = toast.loading('جاري استيراد وتحديث قاعدة بيانات الأدوية من السيرفر المركزي...')
    try {
      const res = await fetch('https://raw.githubusercontent.com/karem505/egyptian-drug-database/main/data/egyptian-drugs.json')
      if (!res.ok) throw new Error('فشل الاتصال بقاعدة البيانات')
      const data = await res.json()
      
      const mappedDrugs = data.map((d: any) => ({
        id: Math.random().toString(36).substr(2, 9),
        name: d.commercial_name_en || d.commercial_name_ar,
        activeIngredient: d.scientific_name || 'غير محدد',
        company: d.manufacturer || 'مجهول',
        form: d.route === 'ORAL' ? 'أقراص' : d.route === 'INJECTION' || d.route === 'INTRAMUSCULAR' || d.route === 'INTRAVENOUS' ? 'حقن' : 'أخرى',
        price: d.price_egp || 0
      }))

      const newDrugs = [...drugs]
      let added = 0
      mappedDrugs.forEach((md: any) => {
        if (!newDrugs.find(nd => nd.name.toLowerCase() === md.name.toLowerCase())) {
          newDrugs.push(md)
          added++
        }
      })
      
      setDrugs(newDrugs)
      toast.success(\`تم التحديث بنجاح! تم إضافة \${added} صنف دوائي جديد للقاعدة.\`, { id: tid })
    } catch (e: any) {
      toast.error(e.message || 'حدث خطأ أثناء التحديث', { id: tid })
    } finally {
      setIsUpdating(false)
    }
  }
`;

const stateIndex = c.indexOf('const [search, setSearch] = useState');
c = c.slice(0, stateIndex) + functionToAdd + '\n  ' + c.slice(stateIndex);

// 3. Add button in UI
const targetUi = `<Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>`;
const wrapperUi = `<div className="flex gap-2">
          <Button 
            onClick={handleUpdateFromAPI} 
            disabled={isUpdating}
            className="h-10 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-500/20"
          >
            {isUpdating ? <RefreshCw className="w-4 h-4 ml-1.5 animate-spin" /> : <CloudDownload className="w-4 h-4 ml-1.5" />}
            تحديث الأدوية
          </Button>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>`;

c = c.replace(targetUi, wrapperUi);

// Close the wrapper div after the Dialog closing tag
const dialogEnd = `</Dialog>`;
c = c.replace(`</DialogContent>\n          </Dialog>`, `</DialogContent>\n          </Dialog>\n        </div>`);

fs.writeFileSync(filePath, c);
