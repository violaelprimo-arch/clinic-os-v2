const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/admin/finance/page.tsx', 'utf8');
const i = c.indexOf('// Mock Chart Data');
if (i !== -1) {
  console.log(c.substring(i, i + 800));
} else {
  console.log("No mock chart data found.");
  // try looking for BarChart or data=
  console.log(c.substring(c.indexOf('BarChart'), c.indexOf('BarChart') + 800));
}
