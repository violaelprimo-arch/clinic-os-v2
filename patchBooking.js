const fs = require('fs');
let content = fs.readFileSync('src/components/clinic/BookingForm.tsx', 'utf8');

// Imports
content = content.replace('import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from \'@/components/ui/select\'', 'import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from \'@/components/ui/select\'\nimport { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"');

// State
content = content.replace('const [isBooking, setIsBooking] = useState(false)', 'const [isBooking, setIsBooking] = useState(false)\n  const [paymentMethod, setPaymentMethod] = useState(\'cash\')\n  const [transferNumber, setTransferNumber] = useState(\'\')');

// Booking Logic
const newBookingPayload = `
      const serviceDetail = services.find(s => s.id === selectedService)
      
      let payStatus = 'pending'
      if (paymentMethod === 'wallet' || paymentMethod === 'instapay') payStatus = 'paid'

      const newAppt = {
        clinic_id: clinic.id || clinic.slug,
        patientName: name,
        phone,
        serviceId: selectedService,
        serviceName: serviceDetail?.name || 'كشف',
        servicePrice: serviceDetail?.price || 0,
        date: selectedDate,
        queue_number: queueNumber,
        status: 'waiting',
        paymentMethod,
        paymentStatus: payStatus,
        transferNumber: paymentMethod === 'wallet' ? transferNumber : '',
        createdAt: new Date().toISOString()
      }
      const docRef = await addDoc(collection(db, 'appointments'), newAppt)
`;

content = content.replace(/const docRef = await addDoc\(collection\(db, 'appointments'\), \{[\s\S]*?createdAt: new Date\(\)\.toISOString\(\)\n      \}\)/, newBookingPayload);

// UI Addition
const paymentUI = `
          {/* Payment Section */}
          {clinic.onlinePaymentEnabled && (
            <div className="space-y-4 pt-4 border-t">
              <Label className="text-lg font-bold">طريقة الدفع</Label>
              <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Label className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer">
                  <RadioGroupItem value="cash" className="sr-only" />
                  <span className="font-bold">نقدي في العيادة</span>
                </Label>
                
                {clinic.walletNumber && (
                  <Label className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer">
                    <RadioGroupItem value="wallet" className="sr-only" />
                    <span className="font-bold text-center">محفظة إلكترونية<br/>(فودافون كاش)</span>
                  </Label>
                )}

                {clinic.instapayHandle && (
                  <Label className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer">
                    <RadioGroupItem value="instapay" className="sr-only" />
                    <span className="font-bold text-center">انستاباي<br/>(InstaPay)</span>
                  </Label>
                )}
              </RadioGroup>

              {paymentMethod === 'wallet' && (
                <div className="bg-blue-50 p-4 rounded-xl space-y-3">
                  <p className="font-bold text-blue-800">برجاء التحويل على رقم المحفظة التالي: <span className="text-xl" dir="ltr">{clinic.walletNumber}</span></p>
                  <div className="space-y-2">
                    <Label>رقم الموبايل الذي تم التحويل منه</Label>
                    <Input value={transferNumber} onChange={e => setTransferNumber(e.target.value)} required placeholder="01xxxxxxxxx" dir="ltr" className="bg-white" />
                  </div>
                </div>
              )}

              {paymentMethod === 'instapay' && (
                <div className="bg-purple-50 p-4 rounded-xl">
                  <p className="font-bold text-purple-800">برجاء التحويل على حساب انستاباي التالي: <span className="text-xl" dir="ltr">{clinic.instapayHandle}</span></p>
                  <p className="text-sm mt-2 text-purple-600">سيتم مراجعة الدفع وتأكيد حجزك فور وصول التحويل.</p>
                </div>
              )}
            </div>
          )}
`;

content = content.replace('        </CardContent>\n        <CardFooter>', paymentUI + '\n        </CardContent>\n        <CardFooter>');

fs.writeFileSync('src/components/clinic/BookingForm.tsx', content);
console.log('Successfully updated BookingForm.tsx');
