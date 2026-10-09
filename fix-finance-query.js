const fs = require('fs');

const fFile = 'src/app/clinic/[slug]/admin/finance/page.tsx';
let c = fs.readFileSync(fFile, 'utf8');

const oldQuery = `      const q = query(
        collection(db, 'appointments'),
        where('clinic_id', '==', cId),
        where('date', '>=', fromDate),
        where('date', '<=', toDate)
      )
      const snapshot = await getDocs(q)`;

const newQuery = `      const q = query(
        collection(db, 'appointments'),
        where('clinic_id', '==', cId)
      )
      const snapshot = await getDocs(q)
      
      const allAppts = snapshot.docs.filter(d => {
        const date = d.data().date;
        if (!date) return false;
        return date >= fromDate && date <= toDate;
      })`;

c = c.replace(oldQuery, newQuery);

// Replace snapshot.docs.map with allAppts.map
c = c.replace(`const appts = snapshot.docs.map(d => {`, `const appts = allAppts.map(d => {`);

// Ensure we print the error if it fails
c = c.replace(`catch (err) {`, `catch (err) {
      console.error(err)`);

fs.writeFileSync(fFile, c);
