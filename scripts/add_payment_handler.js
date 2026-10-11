const fs = require('fs');
let c = fs.readFileSync('src/components/clinic/AdminDashboard.tsx', 'utf8');

c = c.replace(
  /const handleStartExam = async \(patient: any\) => \{/,
  `const handleConfirmPaymentOnly = async (patient: any) => {
    if (!patient || isProcessing) return;
    const confirmPayment = window.confirm(\`تأكيد استلام مبلغ \${patient.servicePrice || 0} ج.م من المريض \${patient.patientName}؟\`);
    if (!confirmPayment) return;
    
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, 'appointments', patient.id), {
        paymentStatus: 'paid'
      });
      toast.success(\`تم تأكيد الدفع للمريض \${patient.patientName}\`);
    } catch (err) {
      toast.error('حدث خطأ أثناء تأكيد الدفع.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartExam = async (patient: any) => {`
);

fs.writeFileSync('src/components/clinic/AdminDashboard.tsx', c);
console.log('Added handleConfirmPaymentOnly!');
