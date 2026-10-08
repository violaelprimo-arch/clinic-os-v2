const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/admin/patients/page.tsx', 'utf8');

c = c.replace(
  "import { collection, query, where, getDocs, addDoc } from 'firebase/firestore'",
  "import { collection, query, where, getDocs, addDoc, onSnapshot } from 'firebase/firestore'"
);

const fetchFind = `const fetchPatients = async () => {
      try {
        const clinicQ = query(collection(db, 'clinics'), where('slug', '==', slug))
        const clinicSnap = await getDocs(clinicQ)
        if (clinicSnap.empty) return
        const cId = clinicSnap.docs[0].id
        setClinicId(cId)

        // Fetch all appointments for this clinic
        const apptQ = query(collection(db, 'appointments'), where('clinic_id', '==', cId))
        const apptSnap = await getDocs(apptQ)
        
        // Group by phone to get unique patients
        const pMap = new Map()
        apptSnap.docs.forEach(doc => {
          const d = doc.data()
          if (!d.phone) return
          if (!pMap.has(d.phone)) {
            pMap.set(d.phone, {
              id: doc.id,
              name: d.patientName,
              phone: d.phone,
              visits: 1,
              lastVisit: d.date,
              status: 'active'
            })
          } else {
            const existing = pMap.get(d.phone)
            existing.visits += 1
            if (new Date(d.date) > new Date(existing.lastVisit)) {
              existing.lastVisit = d.date
              existing.name = d.patientName // keep latest name
            }
          }
        })
        
        setPatients(Array.from(pMap.values()))
      } catch (error) {
        console.error("Error fetching patients:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchPatients()`;

const fetchReplace = `
    let unsubAppts: any = null;
    const fetchPatients = async () => {
      try {
        const clinicQ = query(collection(db, 'clinics'), where('slug', '==', slug))
        const clinicSnap = await getDocs(clinicQ)
        if (clinicSnap.empty) return
        const cId = clinicSnap.docs[0].id
        setClinicId(cId)

        // Realtime Fetch all appointments for this clinic
        const apptQ = query(collection(db, 'appointments'), where('clinic_id', '==', cId))
        unsubAppts = onSnapshot(apptQ, (apptSnap) => {
          const pMap = new Map()
          apptSnap.docs.forEach(doc => {
            const d = doc.data()
            if (!d.phone) return
            if (!pMap.has(d.phone)) {
              pMap.set(d.phone, {
                id: doc.id,
                name: d.patientName,
                phone: d.phone,
                visits: 1,
                lastVisit: d.date,
                status: 'active'
              })
            } else {
              const existing = pMap.get(d.phone)
              existing.visits += 1
              if (new Date(d.date) > new Date(existing.lastVisit)) {
                existing.lastVisit = d.date
                existing.name = d.patientName // keep latest name
              }
            }
          })
          setPatients(Array.from(pMap.values()))
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
`;

c = c.replace(fetchFind, fetchReplace);
fs.writeFileSync('src/app/clinic/[slug]/admin/patients/page.tsx', c);
