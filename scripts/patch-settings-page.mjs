import fs from 'fs';

const path = 'src/app/clinic/[slug]/admin/settings/page.tsx';
let code = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

const target = `          latitude: latitude ? parseFloat(latitude) : undefined,
          longitude: longitude ? parseFloat(longitude) : undefined,
          phone: phones[0] || ''
        }
      )`;

const replacement = `          latitude: latitude ? parseFloat(latitude) : undefined,
          longitude: longitude ? parseFloat(longitude) : undefined,
          phone: phones[0] || '',
          maxDailyBookings: Number(maxDailyBookings) || 0
        }
      )`;

if (!code.includes(target)) {
  console.error('Target not found in settings/page.tsx');
  process.exit(1);
}

code = code.replace(target, replacement);
fs.writeFileSync(path, code, 'utf8');
console.log('Successfully updated settings/page.tsx with maxDailyBookings sync');
