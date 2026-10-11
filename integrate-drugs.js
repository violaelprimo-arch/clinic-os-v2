const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/admin/prescriptions/page.tsx', 'utf8');

// Replace import
c = c.replace(
  `import { EGYPTIAN_DRUGS, STRUCTURED_DRUGS } from '@/lib/egyptian-drugs'`,
  `import { EGYPTIAN_DRUGS, STRUCTURED_DRUGS } from '@/lib/egyptian-drugs'
import { useEgyptianDrugs } from '@/hooks/useEgyptianDrugs'`
);

// Inject hook inside component
const compStart = c.indexOf('const [drugs, setDrugs]');
c = c.slice(0, compStart) + `const { drugs: apiDrugs, loading: apiDrugsLoading } = useEgyptianDrugs()\n  ` + c.slice(compStart);

// Replace filteredSearchDrugs logic
const oldSearch = `const filteredSearchDrugs = useMemo(() => {
    if (!drugSearch.trim()) return []
    const queryTerm = drugSearch.toLowerCase()
    return EGYPTIAN_DRUGS.filter(d => d.toLowerCase().includes(queryTerm)).slice(0, 8)
  }, [drugSearch])`;

const newSearch = `const filteredSearchDrugs = useMemo(() => {
    if (!drugSearch.trim()) return []
    const queryTerm = drugSearch.toLowerCase()
    
    // Combine local favorite DB and huge API DB
    const apiNames = apiDrugs.map(d => d.commercial_name_en || d.commercial_name_ar)
    const combined = Array.from(new Set([...EGYPTIAN_DRUGS, ...apiNames]))
    
    return combined.filter(d => d && d.toLowerCase().includes(queryTerm)).slice(0, 15)
  }, [drugSearch, apiDrugs])`;

c = c.replace(oldSearch, newSearch);

fs.writeFileSync('src/app/clinic/[slug]/admin/prescriptions/page.tsx', c);
