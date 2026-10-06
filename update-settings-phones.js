const fs = require('fs');
let content = fs.readFileSync('src/app/clinic/[slug]/admin/settings/page.tsx', 'utf8');

// Update handleSave to use phones array instead of clinicPhone single var
content = content.replace(
  "clinicPhone: clinicPhone || '',",
  "clinicPhone: phones[0] || '',"
);
content = content.replace(
  "clinicPhones: clinicPhone ? [clinicPhone] : phones.filter(p => typeof p === 'string' && p.trim() !== ''),",
  "clinicPhones: phones.filter(p => typeof p === 'string' && p.trim() !== ''),"
);

// Update Live Preview to pass clinicPhones
content = content.replace(
  "clinicPhone: clinicPhone || '01000000000',",
  "clinicPhone: phones[0] || '01000000000',\n                    clinicPhones: phones.filter(p => p.trim() !== ''),"
);

// Replace single Input with dynamic list of phones
const phonesUI = `<div className="space-y-1.5 col-span-2">
                <Label className="text-xs font-bold text-slate-600">أرقام هواتف العيادة (للحجز والواتساب)</Label>
                <div className="space-y-2">
                  {phones.map((p, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        value={p}
                        onChange={e => {
                          const newPhones = [...phones]
                          newPhones[idx] = e.target.value
                          setPhones(newPhones)
                        }}
                        placeholder="01012345678"
                        className="h-10 text-xs rounded-xl font-mono text-right"
                        dir="ltr"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setPhones(phones.filter((_, i) => i !== idx))}
                        className="text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    onClick={() => setPhones([...phones, ''])}
                    className="w-full border-dashed h-10 text-xs font-bold text-[#15B8A6] border-teal-200 hover:bg-teal-50"
                  >
                    <Plus className="w-4 h-4 ml-2" /> إضافة رقم آخر
                  </Button>
                </div>
              </div>`;

content = content.replace(
  /<div className="space-y-1\.5">\s*<Label className="text-xs font-bold text-slate-600">رقم هاتف العيادة \(للحجز والواتساب\)<\/Label>\s*<Input\s*value=\{clinicPhone\}\s*onChange=\{e => setClinicPhone\(e\.target\.value\)\}\s*placeholder="01012345678"\s*className="h-10 text-xs rounded-xl font-mono text-right"\s*dir="ltr"\s*\/>\s*<\/div>/,
  phonesUI
);

// Need to make sure Trash2 and Plus are imported.
content = content.replace(
  "import { MessageCircle } from 'lucide-react'",
  "import { MessageCircle, Plus, Trash2 } from 'lucide-react'"
);

fs.writeFileSync('src/app/clinic/[slug]/admin/settings/page.tsx', content);
