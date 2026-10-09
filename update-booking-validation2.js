const fs = require('fs');
let c = fs.readFileSync('src/components/clinic/BookingForm.tsx', 'utf8');

const sIdx = c.indexOf('const handleNextStep1 = () => {');
const eIdx = c.indexOf('// Step 2 Validation');

if(sIdx !== -1 && eIdx !== -1) {
  const newHandle = `const handleNextStep1 = () => {
    if (!name.trim()) return toast.error('يرجى إدخال اسم المريض')
    if (!phone.trim() || phone.length < 10) return toast.error('يرجى إدخال رقم هاتف صحيح')
    
    if (selectedDate && clinic?.weeklySchedule) {
      const d = new Date(selectedDate);
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = days[d.getDay()];
      const daySched = clinic.weeklySchedule.find((s: any) => s.id === dayName);
      if (daySched && !daySched.isOpen) {
        return toast.error(\`عذراً، العيادة لا تعمل يوم \${daySched.day}\`);
      }
    }
    
    setStep(2)
  }

  `;
  c = c.substring(0, sIdx) + newHandle + c.substring(eIdx);
  fs.writeFileSync('src/components/clinic/BookingForm.tsx', c);
  console.log('done');
}
