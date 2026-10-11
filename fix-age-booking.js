const fs = require('fs');

let c = fs.readFileSync('src/components/clinic/BookingForm.tsx', 'utf8');

// 1. Add dob state
c = c.replace(
  "const [age, setAge] = useState('')",
  "const [age, setAge] = useState('')\n  const [dob, setDob] = useState('')"
);

// 2. Add handlers
const effectReplace = `  const handleAgeChange = (val: string) => {
    setAge(val)
    if (val) {
      const year = new Date().getFullYear() - parseInt(val)
      setDob(year + '-01-01')
    } else {
      setDob('')
    }
  }

  const handleDobChange = (val: string) => {
    setDob(val)
    if (val) {
      const birthYear = new Date(val).getFullYear()
      const currentYear = new Date().getFullYear()
      setAge((currentYear - birthYear).toString())
    } else {
      setAge('')
    }
  }
`;

c = c.replace("  // Available services fallback", effectReplace + "\n  // Available services fallback");

// 3. Update the UI
const uiFind = `<div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">السن (اختياري)</Label>
            <Input
              value={age}
              onChange={e => setAge(e.target.value)}
              placeholder="25"
              type="number"
              className="h-12 text-sm rounded-xl bg-[#F6F8FB] border-[#E5EAF0] focus:bg-white"
            />
          </div>`;

const uiReplace = `<div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">تاريخ الميلاد</Label>
              <Input
                type="date"
                value={dob}
                onChange={e => handleDobChange(e.target.value)}
                className="h-12 text-sm rounded-xl bg-[#F6F8FB] border-[#E5EAF0] focus:bg-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">العمر</Label>
              <Input
                value={age}
                onChange={e => handleAgeChange(e.target.value)}
                placeholder="25"
                type="number"
                className="h-12 text-sm rounded-xl bg-[#F6F8FB] border-[#E5EAF0] focus:bg-white"
              />
            </div>
          </div>`;

c = c.replace(uiFind, uiReplace);

// 4. Also update DB save object
c = c.replace("age: age || null,", "age: age || null, dob: dob || null,");

fs.writeFileSync('src/components/clinic/BookingForm.tsx', c);
