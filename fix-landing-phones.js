const fs = require('fs');
let content = fs.readFileSync('src/components/clinic/PremiumLanding.tsx', 'utf8');

const regex = /<div className="flex flex-wrap items-center gap-2">\s*<span className="font-mono text-sm font-black text-slate-800 dir-ltr bg-slate-50 px-3 py-1 rounded-xl border border-slate-200">[\s\S]*?<\/a>\s*<\/div>/g;

const replacement = `<div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3">
                    {(clinic?.clinicPhones?.length ? clinic.clinicPhones : [clinic?.clinicPhone || '01012345678']).map((phone: string, idx: number) => (
                      <div key={idx} className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-black text-slate-800 dir-ltr bg-slate-50 px-3 py-1 rounded-xl border border-slate-200">
                          {phone}
                        </span>
                        {phone && (
                          <a
                            href={\`https://wa.me/\${phone.replace(/[^0-9]/g, '').replace(/^0/, '20')}\`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-bold border border-emerald-200 transition-colors"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>واتساب</span>
                          </a>
                        )}
                        {phone && (
                          <a
                            href={\`tel:\${phone}\`}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold border border-blue-200 transition-colors"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>اتصال</span>
                          </a>
                        )}
                      </div>
                    ))}
                  </div>`;

content = content.replace(regex, replacement);

fs.writeFileSync('src/components/clinic/PremiumLanding.tsx', content);
