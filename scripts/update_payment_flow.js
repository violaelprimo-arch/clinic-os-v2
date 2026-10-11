const fs = require('fs');

// 1. Update BookingForm.tsx
let booking = fs.readFileSync('src/components/clinic/BookingForm.tsx', 'utf8');

// A. Validation in handleBooking
const bookingValidationTarget = "setIsBooking(true)";
const bookingValidationReplacement = `if (paymentMethod !== 'cash' && !transferNumber.trim()) {
      return toast.error('يرجى كتابة رقم الهاتف أو المعاملة المحول منها لتأكيد الحجز');
    }
    setIsBooking(true)`;

if (booking.includes(bookingValidationTarget)) {
  booking = booking.replace(bookingValidationTarget, bookingValidationReplacement);
}

// B. Success toast
booking = booking.replace(
  "toast.success(`تم تسجيل حجزك بنجاح! دورك: ${myQueueNumber}`)",
  `toast.success(paymentMethod !== 'cash' ? \`تم تسجيل حجزك بنجاح! دورك: \${myQueueNumber} (سيتم تأكيد الدفع من إدارة العيادة)\` : \`تم تسجيل حجزك بنجاح! دورك: \${myQueueNumber}\`)`
);

// C. Replace paymentMethod !== 'cash' section
const oldPaymentDetail = `{paymentMethod !== 'cash' && (
            <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <Label className="text-xs font-bold text-slate-600">رقم المحفظة / المعاملة المحول منها</Label>
              <Input
                value={transferNumber}
                onChange={e => setTransferNumber(e.target.value)}
                placeholder="010xxxxxxxx"
                className="h-10 text-xs bg-white rounded-lg"
              />
            </div>
          )}`;

const newPaymentDetail = `{paymentMethod === 'instapay' && (
            <div className="p-4 rounded-2xl bg-teal-50/70 border-2 border-teal-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-teal-800">
                  <CreditCard className="w-4 h-4 text-[#15B8A6]" />
                  <span>بيانات التحويل عبر انستاباي (InstaPay):</span>
                </div>
                <Badge className="bg-[#15B8A6] text-white border-none font-bold text-[10px]">
                  تحويل فوري
                </Badge>
              </div>

              <div className="p-3 bg-white rounded-xl border border-teal-100 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-bold">حساب / عنوان انستاباي للطبيب:</span>
                  <span className="font-mono font-black text-sm text-[#182230] select-all bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200" dir="ltr">
                    {clinic.instapayHandle || clinic.doctorPhone || clinic.clinicPhone || 'يرجى التواصل مع العيادة'}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs pt-1.5 border-t border-slate-100">
                  <span className="text-slate-500 font-bold">المبلغ المطلوب تحويله:</span>
                  <span className="font-black text-base text-[#15B8A6]">
                    {selectedService.price} ج.م
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">رقم الهاتف أو المعاملة المحول منها (لتأكيد الدفع):</Label>
                <Input
                  value={transferNumber}
                  onChange={e => setTransferNumber(e.target.value)}
                  placeholder="مثال: 010xxxxxxxx أو اسم حساب انستاباي"
                  className="h-11 text-xs bg-white rounded-xl border-teal-200 focus:border-[#15B8A6]"
                  dir="ltr"
                  required
                />
              </div>

              <div className="p-2.5 bg-teal-100/60 rounded-xl text-[11px] text-teal-800 font-medium leading-relaxed">
                💡 سيتم تسجيل دورك فوراً ولن يتأثر بالدور، وسيتم تأكيد استلام الدفع من خلال إدارة العيادة.
              </div>
            </div>
          )}

          {paymentMethod === 'wallet' && (
            <div className="p-4 rounded-2xl bg-amber-50/70 border-2 border-amber-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                  <Wallet className="w-4 h-4 text-amber-600" />
                  <span>بيانات التحويل عبر المحفظة الإلكترونية (فودافون كاش وغيرها):</span>
                </div>
                <Badge className="bg-amber-600 text-white border-none font-bold text-[10px]">
                  محفظة ذكية
                </Badge>
              </div>

              <div className="p-3 bg-white rounded-xl border border-amber-100 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-bold">رقم محفظة الطبيب / العيادة:</span>
                  <span className="font-mono font-black text-sm text-[#182230] select-all bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200" dir="ltr">
                    {clinic.walletNumber || clinic.doctorPhone || clinic.clinicPhone || 'يرجى التواصل مع العيادة'}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs pt-1.5 border-t border-slate-100">
                  <span className="text-slate-500 font-bold">المبلغ المطلوب تحويله:</span>
                  <span className="font-black text-base text-[#15B8A6]">
                    {selectedService.price} ج.م
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">رقم المحفظة المحول منها (لتأكيد الدفع):</Label>
                <Input
                  value={transferNumber}
                  onChange={e => setTransferNumber(e.target.value)}
                  placeholder="مثال: 010xxxxxxxx"
                  className="h-11 text-xs bg-white rounded-xl border-amber-200 focus:border-[#15B8A6]"
                  dir="ltr"
                  required
                />
              </div>

              <div className="p-2.5 bg-amber-100/60 rounded-xl text-[11px] text-amber-900 font-medium leading-relaxed">
                💡 سيتم تسجيل دورك فوراً ولن يتأثر بالدور، وسيتم تأكيد استلام الدفع من خلال إدارة العيادة.
              </div>
            </div>
          )}`;

if (booking.includes(oldPaymentDetail)) {
  booking = booking.replace(oldPaymentDetail, newPaymentDetail);
  console.log('Replaced payment details in BookingForm.tsx directly!');
} else {
  // Regex fallback
  booking = booking.replace(
    /\{paymentMethod !== 'cash' && \([\s\S]*?رقم المحفظة \/ المعاملة المحول منها[\s\S]*?<\/div>\s*\)\}/,
    newPaymentDetail
  );
  console.log('Regex replaced payment details in BookingForm.tsx!');
}

// D. Add payment notice to success screen
const successTarget = `<div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold flex items-center justify-center gap-2">
          <Users className="w-4 h-4 text-amber-600" />
          <span>يوجد {successInfo.aheadCount} مرضى قبلك في الدور</span>
        </div>`;

const successAddition = successTarget + `

        {paymentMethod !== 'cash' && (
          <div className="p-3.5 rounded-2xl bg-teal-50 border border-teal-200 text-teal-900 text-xs text-right space-y-1">
            <div className="flex items-center gap-2 font-bold text-teal-800">
              <CheckCircle2 className="w-4 h-4 text-[#15B8A6]" />
              <span>تم تسجيل الحجز والدور بنجاح</span>
            </div>
            <p className="text-[11px] text-teal-700 leading-relaxed font-medium">
              سيتم تأكيد الدفع من خلال إدارة العيادة. رقم دورك في الكشف محفوظ بالكامل ولن يتأثر.
            </p>
          </div>
        )}`;

if (booking.includes(successTarget)) {
  booking = booking.replace(successTarget, successAddition);
  console.log('Added payment notice to success screen in BookingForm.tsx!');
}

fs.writeFileSync('src/components/clinic/BookingForm.tsx', booking, 'utf8');

// 2. Update AdminDashboard.tsx to show transfer badge
let admin = fs.readFileSync('src/components/clinic/AdminDashboard.tsx', 'utf8');
const adminTarget = `<div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                              <span className="font-mono text-slate-500">{b.phone}</span>
                              {b.createdAt && (
                                <span>{new Date(b.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                              )}
                            </div>`;

const adminReplacement = `<div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5 flex-wrap">
                              <span className="font-mono text-slate-500">{b.phone}</span>
                              {b.createdAt && (
                                <span>{new Date(b.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                              )}
                              {b.paymentMethod && b.paymentMethod !== 'cash' && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200 inline-flex items-center gap-1 font-mono">
                                  <span>{b.paymentMethod === 'instapay' ? 'انستاباي' : 'محفظة'}:</span>
                                  <span>{b.transferNumber || 'بانتظار التأكيد'}</span>
                                </span>
                              )}
                            </div>`;

if (admin.includes(adminTarget)) {
  admin = admin.replace(adminTarget, adminReplacement);
  fs.writeFileSync('src/components/clinic/AdminDashboard.tsx', admin, 'utf8');
  console.log('Successfully updated AdminDashboard.tsx with transfer details badge!');
} else {
  console.error('Target not found in AdminDashboard.tsx');
}
