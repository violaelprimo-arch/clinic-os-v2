const fs = require('fs');
let c = fs.readFileSync('src/components/clinic/AdminDashboard.tsx', 'utf8');

const target = `<div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                              <span className="font-mono text-slate-500">{b.phone}</span>
                              {b.createdAt && (
                                <span>{new Date(b.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                              )}
                            </div>`;

const replacement = `<div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 flex-wrap">
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

if (c.includes(target)) {
  c = c.replace(target, replacement);
  fs.writeFileSync('src/components/clinic/AdminDashboard.tsx', c, 'utf8');
  console.log('Direct string replace succeeded in AdminDashboard.tsx!');
} else {
  console.log('Direct string not found, trying CRLF normalization...');
  const normalizedC = c.replace(/\r\n/g, '\n');
  const normalizedTarget = target.replace(/\r\n/g, '\n');
  if (normalizedC.includes(normalizedTarget)) {
    const updated = normalizedC.replace(normalizedTarget, replacement);
    fs.writeFileSync('src/components/clinic/AdminDashboard.tsx', updated, 'utf8');
    console.log('Normalized replace succeeded in AdminDashboard.tsx!');
  } else {
    console.error('Target not found in AdminDashboard.tsx even with normalization!');
  }
}
