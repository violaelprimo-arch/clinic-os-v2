const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/admin/prescriptions/page.tsx', 'utf8');

// 1. Change topOffset default to 25 (%)
c = c.replace(
  /const \[topOffset, setTopOffset\] = useState<number>\(\d+\)/,
  'const [topOffset, setTopOffset] = useState<number>(25)'
);

// 2. Change slider to percentage
c = c.replace(
  /<input\s+type="range"\s+min="\d+"\s+max="\d+"\s+step="\d+"\s+value=\{topOffset\}\s+onChange=\{e => setTopOffset\(Number\(e\.target\.value\)\)\}\s+className="w-24 accent-\[#15B8A6\]"\s*\/>\s*<span className="font-mono text-\[11px\] text-\[#15B8A6\] font-bold">\{topOffset\}px<\/span>/,
  `<input
                      type="range"
                      min="5"
                      max="55"
                      step="1"
                      value={topOffset}
                      onChange={e => setTopOffset(Number(e.target.value))}
                      className="w-28 accent-[#15B8A6]"
                    />
                    <span className="font-mono text-[11px] text-[#15B8A6] font-bold">{topOffset}%</span>`
);

// 3. Update Actual Sheet container and style
c = c.replace(
  /className="medical-card bg-white p-6 sm:p-8 space-y-6 shadow-lg border border-\[#E5EAF0\] relative min-h-\[620px\] flex flex-col justify-between rounded-2xl print:shadow-none print:border-none print:\!px-8 print:\!pb-8 print:\!w-\[210mm\] print:\!h-\[297mm\] print:\!max-w-none print:\!rounded-none print:m-0"/,
  'className="medical-card bg-white p-6 sm:p-8 space-y-6 shadow-lg border border-[#E5EAF0] relative flex flex-col justify-between rounded-2xl aspect-[1/1.414] max-w-[800px] mx-auto print:shadow-none print:border-none print:!px-8 print:!pb-8 print:!pt-0 print:!w-[210mm] print:!h-[297mm] print:!max-w-none print:!rounded-none print:m-0"'
);

c = c.replace(
  /paddingTop: `\$\{topOffset\}px`,/,
  'paddingTop: `${topOffset}%`,'
);

// 4. Update Patient Meta Strip for clean transparent custom rendering
c = c.replace(
  /templateMode === 'custom'\s*\?\s*'bg-white\/85 backdrop-blur-2xs border border-slate-200\/80 px-3 shadow-2xs mt-1'\s*:\s*'bg-slate-50\/70 border-b border-slate-200 text-slate-700 px-3 mt-3'/,
  "templateMode === 'custom' ? 'bg-transparent text-slate-900 px-1 mt-1' : 'bg-slate-50/70 border-b border-slate-200 text-slate-700 px-3 mt-3'"
);

// Remove label texts in custom mode so they don't double print over template fields
c = c.replace(
  /<span className="text-slate-400">الاسم:<\/span>/g,
  "{templateMode === 'standard' && <span className=\"text-slate-400\">الاسم:</span>}"
);

c = c.replace(
  /<span className="text-slate-400">السن:<\/span>/g,
  "{templateMode === 'standard' && <span className=\"text-slate-400\">السن:</span>}"
);

c = c.replace(
  /<span className="text-slate-400">التاريخ:<\/span>/g,
  "{templateMode === 'standard' && <span className=\"text-slate-400\">التاريخ:</span>}"
);

fs.writeFileSync('src/app/clinic/[slug]/admin/prescriptions/page.tsx', c);
console.log('Successfully updated prescriptions/page.tsx!');
