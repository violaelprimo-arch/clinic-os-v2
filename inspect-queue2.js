const fs = require('fs');
let c = fs.readFileSync('src/components/clinic/AdminDashboard.tsx', 'utf8');
const i = c.indexOf('.sort(');
console.log(c.substring(Math.max(0, i - 1000), i + 1000));
