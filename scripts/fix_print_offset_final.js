const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/admin/prescriptions/page.tsx', 'utf8');

// Replace style and div opening
const oldStyleBlock = `{/* Print CSS Exact Colors */}
          <style dangerouslySetInnerHTML={{ __html: '@media print { * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }' }} />

          {/* Actual Sheet */}
          <div
            className="medical-card bg-white p-6 sm:p-8 space-y-6 shadow-lg border border-[#E5EAF0] relative flex flex-col justify-between rounded-2xl aspect-[1/1.414] max-w-[800px] mx-auto print:shadow-none print:border-none print:!px-8 print:!pb-8 print:!pt-0 print:!w-[210mm] print:!h-[297mm] print:!max-w-none print:!rounded-none print:m-0"`;

const newStyleBlock = `{/* Print CSS Exact Colors & Force Exact Top Offset */}
          <style dangerouslySetInnerHTML={{ __html: \`
            @media print {
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              #a4-print-sheet {
                padding-top: \${templateMode === 'custom' ? \`\${topOffset}%\` : '2rem'} !important;
                padding-left: 2rem !important;
                padding-right: 2rem !important;
                padding-bottom: 2rem !important;
                width: 210mm !important;
                height: 297mm !important;
                max-width: none !important;
                aspect-ratio: 1 / 1.414 !important;
                border: none !important;
                box-shadow: none !important;
                border-radius: 0 !important;
                margin: 0 !important;
              }
            }
          \` }} />

          {/* Actual Sheet */}
          <div
            id="a4-print-sheet"
            className="medical-card bg-white p-6 sm:p-8 space-y-6 shadow-lg border border-[#E5EAF0] relative flex flex-col justify-between rounded-2xl aspect-[1/1.414] max-w-[800px] mx-auto"`;

c = c.replace(oldStyleBlock, newStyleBlock);

fs.writeFileSync('src/app/clinic/[slug]/admin/prescriptions/page.tsx', c);
console.log('Fixed prescriptions page print CSS and removed print:!pt-0!');
