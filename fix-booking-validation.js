const fs = require('fs');
let c = fs.readFileSync('src/components/clinic/BookingForm.tsx', 'utf8');

const logicFind = `  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsBooking(true)`;
    
const logicReplace = `  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate Working Hours
    if (clinic?.workingDays && clinic.workingDays.length > 0) {
      const dayName = new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long' });
      if (!clinic.workingDays.includes(dayName)) {
        toast.error('عفواً، العيادة مغلقة في هذا اليوم. يرجى اختيار يوم عمل آخر.');
        return;
      }
    }

    if (clinic?.workingHoursStart && clinic?.workingHoursEnd) {
      // If booking for today, check time
      const todayStr = new Date().toISOString().split('T')[0];
      if (selectedDate === todayStr) {
        const now = new Date();
        const start = new Date(\`\${todayStr}T\${clinic.workingHoursStart}\`);
        const end = new Date(\`\${todayStr}T\${clinic.workingHoursEnd}\`);
        
        // Handle next day end time (e.g. 09:00 to 02:00 AM)
        if (end < start) end.setDate(end.getDate() + 1);

        if (now < start || now > end) {
          toast.error(\`عفواً، مواعيد عمل العيادة اليوم من \${clinic.workingHoursStart} إلى \${clinic.workingHoursEnd}\`);
          return;
        }
      }
    }

    setIsBooking(true)`;

c = c.replace(logicFind, logicReplace);

fs.writeFileSync('src/components/clinic/BookingForm.tsx', c);
