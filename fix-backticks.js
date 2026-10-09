const fs = require('fs');
let c = fs.readFileSync('src/app/api/sync-daily-prices/route.ts', 'utf8');

c = c.replace(/\\`https/g, '`https');
c = c.replace(/''}\\`/g, "''}`");
c = c.replace(/com\\\$\\{href\\}/g, 'com${href}');
c = c.replace(/com\\\$\\{href\\}\\`/g, 'com${href}`');
c = c.replace(/href}\\`/g, "href}`");

fs.writeFileSync('src/app/api/sync-daily-prices/route.ts', c);
