const fs = require('fs');

let c = fs.readFileSync('src/app/clinic/[slug]/admin/patients/page.tsx', 'utf8');

const regex = /useEffect\(\(\) => \{[\s\S]*?setLoading\(false\)[\s\S]*?\}, \[slug\]\)/;
c = c.replace(regex, `useEffect(() => {
    let unsubAppts: any = null;
    const fetchPatients = async () => {
      try {
        const clinicQ = query(collection(db, 'clinics'), where('slug', '==', slug))
        const clinicSnap = await getDocs(clinicQ)
        if (clinicSnap.empty) return
        const cId = clinicSnap.docs[0].id
        setClinicId(cId)

        const apptQ = query(collection(db, 'appointments'), where('clinic_id', '==', cId))
        unsubAppts = onSnapshot(apptQ, (apptSnap) => {
          const pMap = new Map()
          apptSnap.docs.forEach(doc => {
            const d = doc.data()
            if (!d.phone) return
            if (!pMap.has(d.phone)) {
              pMap.set(d.phone, {
                id: d.phone,
                name: d.patientName,
                phone: d.phone,
                visitsCount: 1,
                lastVisit: d.date,
                lastService: d.serviceName || 'كشف',
                status: 'نشط'
              })
            } else {
              const existing = pMap.get(d.phone)
              existing.visitsCount += 1
              if (new Date(d.date) > new Date(existing.lastVisit)) {
                existing.lastVisit = d.date
                existing.name = d.patientName
              }
            }
          })
          setPatients(Array.from(pMap.values()).sort((a: any, b: any) => new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime()))
          setLoading(false)
        })
      } catch (error) {
        console.error("Error fetching patients:", error)
        setLoading(false)
      }
    }
    fetchPatients()

    return () => {
      if (unsubAppts) unsubAppts()
    }
  }, [slug])`);

fs.writeFileSync('src/app/clinic/[slug]/admin/patients/page.tsx', c);
