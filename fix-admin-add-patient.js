const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/admin/patients/page.tsx', 'utf8');

c = c.replace(
  "const [newPhone, setNewPhone] = useState('')",
  "const [newPhone, setNewPhone] = useState('')\n  const [newDob, setNewDob] = useState('')\n  const [newAge, setNewAge] = useState('')"
);

const effectReplace = `  const handleAgeChange = (val: string) => {
    setNewAge(val)
    if (val) {
      const year = new Date().getFullYear() - parseInt(val)
      setNewDob(year + '-01-01')
    } else {
      setNewDob('')
    }
  }

  const handleDobChange = (val: string) => {
    setNewDob(val)
    if (val) {
      const birthYear = new Date(val).getFullYear()
      const currentYear = new Date().getFullYear()
      setNewAge((currentYear - birthYear).toString())
    } else {
      setNewAge('')
    }
  }
`;

c = c.replace("  // Pagination", effectReplace + "\n  // Pagination");

const uiFind = `              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">رقم الهاتف (واتساب)</Label>
                <Input
                  value={newPhone}
                  onChange={e => setNewPhone(e.target.value)}
                  placeholder="01xxxxxxxxx"
                  className="h-10 text-sm font-mono text-right rounded-xl"
                  dir="ltr"
                  required
                />
              </div>`;

const uiReplace = `              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">رقم الهاتف (واتساب)</Label>
                <Input
                  value={newPhone}
                  onChange={e => setNewPhone(e.target.value)}
                  placeholder="01xxxxxxxxx"
                  className="h-10 text-sm font-mono text-right rounded-xl"
                  dir="ltr"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600">تاريخ الميلاد</Label>
                  <Input
                    type="date"
                    value={newDob}
                    onChange={e => handleDobChange(e.target.value)}
                    className="h-10 text-sm rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600">العمر</Label>
                  <Input
                    type="number"
                    value={newAge}
                    onChange={e => handleAgeChange(e.target.value)}
                    placeholder="25"
                    className="h-10 text-sm rounded-xl"
                  />
                </div>
              </div>`;

c = c.replace(uiFind, uiReplace);

c = c.replace(
  "patientName: newName.trim(),",
  "patientName: newName.trim(),\n        age: newAge || null,\n        dob: newDob || null,"
);

fs.writeFileSync('src/app/clinic/[slug]/admin/patients/page.tsx', c);
