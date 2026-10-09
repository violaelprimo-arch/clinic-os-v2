const fs = require('fs');
let c = fs.readFileSync('src/components/clinic/BookingForm.tsx', 'utf8');

const oldHandle = `const handleNextStep1 = () => {
    if (!name.trim()) return toast.error('يرجى إدخال اسم المريض')
    if (!phone.trim() || phone.length < 10) return toast.error('يرجى إدخال رقم هاتف صحيح')
    setStep(2)
  }`;

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
    } else if (selectedDate && clinic?.workingDays && clinic.workingDays.length > 0) {
      // Fallback for old workingDays array
      const d = new Date(selectedDate);
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      if (!clinic.workingDays.includes(days[d.getDay()])) {
        return toast.error('عذراً، العيادة لا تعمل في هذا اليوم');
      }
    }
    
    setStep(2)
  }`;

c = c.replace(oldHandle, newHandle);
fs.writeFileSync('src/components/clinic/BookingForm.tsx', c);
