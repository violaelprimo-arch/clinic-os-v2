const urls = [
  'https://yalla-clinic.com',
  'https://zizo.yalla-clinic.com/clinic/zizo/tv'
];

for (const url of urls) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    console.log(`${url} -> HTTP ${res.status}`);
  } catch (err) {
    console.error(`${url} error:`, err.message);
  }
}
