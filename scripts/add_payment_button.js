const fs = require('fs');
let c = fs.readFileSync('src/components/clinic/AdminDashboard.tsx', 'utf8');

c = c.replace(
  /\{\/\* WhatsApp alert button \*\/\}/,
  `{/* Quick Confirm Payment */}
                            {b.paymentStatus !== 'paid' && b.status !== 'completed' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleConfirmPaymentOnly(b)}
                                className="h-8 px-2.5 text-xs font-bold text-amber-600 border-amber-200 hover:bg-amber-50 rounded-xl"
                                title="تأكيد الدفع"
                                disabled={isProcessing}
                              >
                                <DollarSign className="w-4 h-4 ml-1" />
                                تأكيد الدفع
                              </Button>
                            )}
                            
                            {/* WhatsApp alert button */}`
);

fs.writeFileSync('src/components/clinic/AdminDashboard.tsx', c);
console.log('Added payment button to list!');
