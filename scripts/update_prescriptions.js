const fs = require('fs');
const f = 'src/app/clinic/[slug]/admin/prescriptions/page.tsx';
let c = fs.readFileSync(f, 'utf8');

c = c.replace(
  /createdAt: new Date\(\)\.toISOString\(\)\s*\}\)\s*\}\s*toast\.success\('[^']+'\)/,
  `createdAt: new Date().toISOString()
        })
      }
      
      const apptId = searchParams?.get('appointmentId')
      if (apptId) {
        await updateDoc(doc(db, 'appointments', apptId), {
          diagnosis: diagnosis || '',
          drugs: drugs.filter(d => d.name.trim() !== '')
        })
      }

      toast.success('تم حفظ الروشتة بنجاح وتحديث بيانات الزيارة')`
);

fs.writeFileSync(f, c);
console.log('Prescriptions updated!');
