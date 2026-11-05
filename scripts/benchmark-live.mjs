import https from 'https';

const urls = [
  { name: 'Landing (Root)', url: 'https://yalla-clinic.com/' },
  { name: 'Public Clinic Landing', url: 'https://yalla-clinic.com/clinic/yalla-demo' },
  { name: 'Live Track Queue', url: 'https://yalla-clinic.com/clinic/yalla-demo/track' },
  { name: 'Admin Settings', url: 'https://yalla-clinic.com/clinic/yalla-demo/admin/settings' },
  { name: 'Admin Finance', url: 'https://yalla-clinic.com/clinic/yalla-demo/admin/finance' },
  { name: 'API Branches', url: 'https://yalla-clinic.com/api/clinic/yalla-demo/branches' },
  { name: 'API Queue', url: 'https://yalla-clinic.com/api/clinic/yalla-demo/queue' },
];

async function measure(item) {
  return new Promise((resolve) => {
    const start = performance.now();
    let ttfb = 0;
    const req = https.get(item.url, { timeout: 10000 }, (res) => {
      ttfb = performance.now() - start;
      let bytes = 0;
      res.on('data', (chunk) => {
        bytes += chunk.length;
      });
      res.on('end', () => {
        const total = performance.now() - start;
        resolve({
          name: item.name,
          status: res.statusCode,
          ttfb: Math.round(ttfb),
          total: Math.round(total),
          sizeKb: Math.round((bytes / 1024) * 10) / 10,
          cacheControl: res.headers['cache-control'] || 'none',
          cfRay: res.headers['cf-ray'] ? 'yes' : 'no'
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        name: item.name,
        error: err.message,
        ttfb: 0,
        total: 0,
        sizeKb: 0
      });
    });
  });
}

async function run() {
  console.log('--- PRODUCTION BENCHMARK (LIVE CLOUDFLARE) ---');
  for (const item of urls) {
    const res = await measure(item);
    console.log(JSON.stringify(res));
  }
}

run();
