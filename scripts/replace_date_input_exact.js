const fs = require('fs');
let c = fs.readFileSync('src/components/clinic/BookingForm.tsx', 'utf8');

// Regex replace the date input div
const regex = /<div className="space-y-1\.5">\s*<Label[^>]*>.*?<\/Label>\s*<Input\s*type="date"[\s\S]*?\/>\s*<\/div>/;

const replacement = `<div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#15B8A6]" />
                يوم الحجز (المواعيد المتاحة)
              </Label>
              {selectedDate && (
                <span className="text-[11px] font-bold text-[#15B8A6]">
                  {availableDays.find(d => d.iso === selectedDate)?.label} ({availableDays.find(d => d.iso === selectedDate)?.formattedDate})
                </span>
              )}
            </div>

            {availableDays.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {availableDays.map((d) => {
                  const isSelected = selectedDate === d.iso
                  return (
                    <button
                      key={d.iso}
                      type="button"
                      onClick={() => setSelectedDate(d.iso)}
                      className={\`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 \${
                        isSelected
                          ? 'bg-[#15B8A6] text-white border-[#15B8A6] shadow-md shadow-[#15B8A6]/20 ring-2 ring-[#15B8A6]/30'
                          : 'bg-white text-slate-700 border-[#E5EAF0] hover:border-[#15B8A6] hover:bg-teal-50/20'
                      }\`}
                    >
                      <span className={\`text-xs font-black \${isSelected ? 'text-white' : 'text-[#182230]'}\`}>
                        {d.label}
                      </span>
                      <span className={\`text-[10px] font-bold \${isSelected ? 'text-white/90' : 'text-slate-400 font-mono'}\`}>
                        {d.formattedDate}
                      </span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center text-xs text-amber-800 font-bold">
                لا توجد مواعيد متاحة للحجز حالياً. يرجى التواصل مع إدارة العيادة.
              </div>
            )}
          </div>`;

if (regex.test(c)) {
  c = c.replace(regex, replacement);
  fs.writeFileSync('src/components/clinic/BookingForm.tsx', c, 'utf8');
  console.log('Successfully replaced date input in BookingForm.tsx!');
} else {
  console.error('Date input regex did not match!');
}
