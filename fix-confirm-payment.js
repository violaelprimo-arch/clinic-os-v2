const fs = require('fs');
let c = fs.readFileSync('src/components/clinic/AdminDashboard.tsx', 'utf8');

const confirmLogic = `
  const handleConfirmPayment = async (patient: any) => {
    try {
      await updateDoc(doc(db, 'appointments', patient.id), {
        paymentStatus: 'paid'
      });
      toast.success('تم تأكيد دفع المريض ' + patient.patientName);
    } catch (e) {
      toast.error('حدث خطأ');
    }
  }
`;

if (!c.includes('handleConfirmPayment')) {
  c = c.replace(
    "const handleStartVisit = async (patient: any) => {",
    confirmLogic + "\n  const handleStartVisit = async (patient: any) => {"
  );
}

const findUI = `<Button 
                            onClick={() => handleStartVisit(b)}
                            disabled={isProcessing}
                            className="bg-[#15B8A6] hover:bg-[#0D9488] text-white text-xs h-8"
                          >
                            الدخول للكشف
                          </Button>`;
                          
const replaceUI = `<div className="flex flex-col gap-2">
                          {b.paymentStatus !== 'paid' && b.status !== 'completed' && (
                            <Button 
                              onClick={() => handleConfirmPayment(b)}
                              disabled={isProcessing}
                              variant="outline"
                              className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 text-xs h-8"
                            >
                              تأكيد الدفع
                            </Button>
                          )}
                          <Button 
                            onClick={() => handleStartVisit(b)}
                            disabled={isProcessing}
                            className="bg-[#15B8A6] hover:bg-[#0D9488] text-white text-xs h-8"
                          >
                            الدخول للكشف
                          </Button>
                          </div>`;

c = c.replace(findUI, replaceUI);

fs.writeFileSync('src/components/clinic/AdminDashboard.tsx', c);
