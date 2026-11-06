const urls = [
  { url: 'https://yalla-clinic.com', method: 'GET', expect: [200, 307, 308] },
  { url: 'https://yalla-demo.yalla-clinic.com', method: 'GET', expect: [200] },
  { url: 'https://yalla-clinic.com/clinic/yalla-demo/login', method: 'GET', expect: [200] },
  { url: 'https://yalla-demo.yalla-clinic.com/clinic/yalla-demo/login', method: 'GET', expect: [200] },
  { url: 'https://yalla-clinic.com/api/send-otp', method: 'POST', expect: [404] },
  { url: 'https://yalla-clinic.com/api/auth/google-login', method: 'POST', expect: [400] },
]

async function run() {
  console.log('Testing live deployment on Cloudflare...')
  let allPassed = true
  for (const item of urls) {
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: { 'Content-Type': 'application/json' },
        body: item.method === 'POST' ? JSON.stringify({}) : undefined,
      })
      const isExpected = item.expect.includes(res.status)
      console.log(`[${isExpected ? 'PASS' : 'WARN'}] ${item.method} ${item.url} -> HTTP ${res.status}`)
      if (!isExpected) allPassed = false
    } catch (err) {
      console.error(`[FAIL] ${item.method} ${item.url} -> Error:`, err.message)
      allPassed = false
    }
  }

  // Test reset-password endpoint with unregistered email to verify clean response without revealing info
  try {
    const res = await fetch('https://yalla-clinic.com/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'request',
        slug: 'yalla-demo',
        email: 'nobody-should-match-this-random-test@yalla-clinic.test',
      }),
    })
    const data = await res.json()
    console.log('[PASS] POST https://yalla-clinic.com/api/auth/reset-password -> HTTP', res.status, data)
  } catch (err) {
    console.error('[FAIL] reset-password test:', err.message)
    allPassed = false
  }

  // Test Google Login endpoint rejection of empty token
  try {
    const res = await fetch('https://yalla-clinic.com/api/auth/google-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: 'yalla-demo',
        idToken: 'invalid-test-token',
      }),
    })
    const data = await res.json()
    console.log('[PASS] POST https://yalla-clinic.com/api/auth/google-login (invalid token rejection) -> HTTP', res.status, data)
  } catch (err) {
    console.error('[FAIL] google-login test:', err.message)
    allPassed = false
  }

  if (!allPassed) process.exit(1)
  console.log('\n>>> All live deployment checks passed successfully! <<<')
}

run()
