const fs = require('fs');
let content = fs.readFileSync('src/app/clinic/[slug]/admin/prescriptions/page.tsx', 'utf8');

const newFetch = `
  useEffect(() => {
    const fetchClinic = async () => {
      const q = query(collection(db, 'clinics'), where('slug', '==', slug))
      const snapshot = await getDocs(q)
      if (!snapshot.empty) {
        const cDoc = snapshot.docs[0];
        const data = cDoc.data();
        setClinic({ id: cDoc.id, ...data });
        setClinicId(cDoc.id);
        if (data.favoriteDrugs) setFavoriteDrugs(data.favoriteDrugs);
        if (data.customDrugs) setCustomDrugs(data.customDrugs);
      }
    }
    fetchClinic()
  }, [slug])
`;

content = content.replace(/useEffect\(\(\) => \{[\s\S]*?fetchClinic\(\)\n  \}, \[slug\]\)/, newFetch);

fs.writeFileSync('src/app/clinic/[slug]/admin/prescriptions/page.tsx', content);
console.log('Fixed useEffect');
