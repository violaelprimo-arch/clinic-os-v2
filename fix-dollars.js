const fs = require('fs');
let c = fs.readFileSync('src/app/api/sync-daily-prices/route.ts', 'utf8');

c = c.replace(/\\\$/g, '$');

fs.writeFileSync('src/app/api/sync-daily-prices/route.ts', c);
