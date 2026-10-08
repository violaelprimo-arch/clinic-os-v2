const fs = require('fs');

let c = fs.readFileSync('src/components/clinic/BookingForm.tsx', 'utf8');

const uiFind = `{/* Estimation Details Grid */}
        <div className="grid grid-cols-2 gap-3 text-right">
          <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E5EAF0] space-y-1">
            <span className="text-[11px] font-bold text-slate-400">موعدك المتوقع</span>
            <p className="text-sm font-black text-[#182230]">08:35 م</p>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E5EAF0] space-y-1">
            <span className="text-[11px] font-bold text-slate-400">وقت الانتظار المتوقع</span>
            <p className="text-sm font-black text-[#15B8A6]">حوالي 42 دقيقة</p>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold flex items-center justify-center gap-2">
          <Users className="w-4 h-4 text-amber-600" />
          <span>يوجد {successInfo.aheadCount || 3} مرضى قبلك في الدور</span>
        </div>`;

const uiReplace = `{/* Dynamic Queue Logic */}
        <div className="grid grid-cols-2 gap-3 text-right">
          <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E5EAF0] space-y-1">
            <span className="text-[11px] font-bold text-slate-400">موعدك المتوقع</span>
            <p className="text-sm font-black text-[#182230]">
              {formatEstimatedTime(calculateWaitTime(successInfo.aheadCount, 15))}
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E5EAF0] space-y-1">
            <span className="text-[11px] font-bold text-slate-400">وقت الانتظار المتوقع</span>
            <p className="text-sm font-black text-[#15B8A6]">
              {formatWaitDuration(calculateWaitTime(successInfo.aheadCount, 15))}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-right mt-3">
          <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E5EAF0] space-y-1">
            <span className="text-[11px] font-bold text-slate-400">رقم الكشف الجاري حالياً</span>
            <p className="text-sm font-black text-[#182230]">{successInfo.inProgress}</p>
          </div>
          <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E5EAF0] space-y-1">
            <span className="text-[11px] font-bold text-slate-400">نوع الكشف</span>
            <p className="text-sm font-black text-[#182230]">{successInfo.service?.name}</p>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold flex items-center justify-center gap-2">
          <Users className="w-4 h-4 text-amber-600" />
          <span>يوجد {successInfo.aheadCount} مرضى قبلك في الدور</span>
        </div>`;

c = c.replace(uiFind, uiReplace);

fs.writeFileSync('src/components/clinic/BookingForm.tsx', c);
