const fs = require('fs');
let c = fs.readFileSync('src/components/clinic/PremiumLanding.tsx', 'utf8');

c = c.replace(
  /<div className="pt-3 border-t border-\[#E5EAF0\] flex items-center justify-between">/,
  `<div className="pt-3 border-t border-[#E5EAF0] flex items-center justify-between {clinic?.showPrices === false ? 'justify-end' : ''}">`
);

c = c.replace(
  /<div>\s*<span className="text-\[10px\] font-bold text-slate-400 block">التكلفة<\/span>\s*<span className="text-lg font-black text-\[#15B8A6\]">\s*\{service\.price\} <span className="text-xs font-bold text-slate-500">ج\.م<\/span>\s*<\/span>\s*<\/div>/,
  `{clinic?.showPrices !== false && (
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block">التكلفة</span>
                      <span className="text-lg font-black text-[#15B8A6]">
                        {service.price} <span className="text-xs font-bold text-slate-500">ج.م</span>
                      </span>
                    </div>
                  )}`
);

fs.writeFileSync('src/components/clinic/PremiumLanding.tsx', c);
console.log('Fixed prices on landing page!');
