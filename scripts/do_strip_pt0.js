const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/admin/prescriptions/page.tsx', 'utf8');

const targetStr = 'print:shadow-none print:border-none print:!px-8 print:!pb-8 print:!pt-0 print:!w-[210mm] print:!h-[297mm] print:!max-w-none print:!rounded-none print:m-0';
if (c.includes(targetStr)) {
  console.log('Target string found!');
  c = c.replace(targetStr, '');
  // add id="a4-print-sheet"
  c = c.replace(
    'className="medical-card bg-white p-6 sm:p-8 space-y-6 shadow-lg border border-[#E5EAF0] relative flex flex-col justify-between rounded-2xl aspect-[1/1.414] max-w-[800px] mx-auto "',
    'id="a4-print-sheet" className="medical-card bg-white p-6 sm:p-8 space-y-6 shadow-lg border border-[#E5EAF0] relative flex flex-col justify-between rounded-2xl aspect-[1/1.414] max-w-[800px] mx-auto"'
  );
  // add the print style
  const oldStyle = `<style dangerouslySetInnerHTML={{ __html: '@media print { * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }' }} />`;
  const newStyle = `<style dangerouslySetInnerHTML={{ __html: \`
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
          \` }} />`;
  if (c.includes(oldStyle)) {
    c = c.replace(oldStyle, newStyle);
    console.log('Style replaced successfully!');
  } else {
    console.log('oldStyle not found directly, replacing regex');
    c = c.replace(/<style dangerouslySetInnerHTML=\{\{ __html: '@media print.*?\}\} \/>/, newStyle);
  }
  fs.writeFileSync('src/app/clinic/[slug]/admin/prescriptions/page.tsx', c, 'utf8');
  console.log('Successfully written updated file!');
} else {
  console.log('Target string NOT found!');
}
