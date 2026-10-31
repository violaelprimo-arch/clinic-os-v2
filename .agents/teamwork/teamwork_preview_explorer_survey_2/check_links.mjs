import fs from 'node:fs';
import path from 'node:path';

const projectRoot = 'e:\\progict\\clinic-os-v2';
const appDir = path.join(projectRoot, 'src', 'app');

function getAllFiles(dir, extensions = ['.ts', '.tsx', '.js', '.jsx']) {
  let results = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const dirent of list) {
    const fullPath = path.join(dir, dirent.name);
    if (dirent.isDirectory()) {
      results = results.concat(getAllFiles(fullPath, extensions));
    } else if (extensions.some(ext => dirent.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

// Map all pages and route handlers
const pageFiles = getAllFiles(appDir).filter(f => f.endsWith('page.tsx') || f.endsWith('page.ts') || f.endsWith('route.ts'));
const existingRoutes = pageFiles.map(f => {
  let rel = path.relative(appDir, f).replace(/\\/g, '/');
  // strip page.tsx or route.ts
  rel = rel.replace(/\/(page|route)\.(tsx|ts)$/, '');
  if (rel === 'page.tsx' || rel === 'page.ts' || rel === 'route.ts') rel = '';
  return '/' + rel;
});

console.log(`Discovered ${existingRoutes.length} route endpoints in src/app:`);
existingRoutes.sort().forEach(r => console.log(`  ${r}`));

// Find all Link hrefs and router.push in all ts/tsx files
const allFiles = getAllFiles(path.join(projectRoot, 'src'));
const linkRegex = /href=['"`]([^'"`$]+)['"`]|router\.push\(['"`]([^'"`$]+)['"`]\)/g;
const staticLinks = new Set();

for (const f of allFiles) {
  const content = fs.readFileSync(f, 'utf-8');
  let m;
  while ((m = linkRegex.exec(content)) !== null) {
    const link = m[1] || m[2];
    if (link && link.startsWith('/') && !link.startsWith('//')) {
      staticLinks.add(link);
    }
  }
}

console.log(`\nDiscovered ${staticLinks.size} static internal link targets in codebase:`);
for (const link of Array.from(staticLinks).sort()) {
  // Check if link matches any existing route pattern
  // E.g. /clinic/zizo/admin/accounts matches /clinic/[slug]/admin/accounts
  const matched = existingRoutes.some(route => {
    // Convert route with [param] to regex
    const regexPattern = '^' + route
      .replace(/\[\.\.\.[\w]+\]/g, '.*')
      .replace(/\[[\w]+\]/g, '[^/]+') + '$';
    const rx = new RegExp(regexPattern);
    return rx.test(link.split('?')[0]);
  });
  if (!matched) {
    console.log(`  [POTENTIAL DEAD LINK]: ${link}`);
  } else {
    console.log(`  [VALID]: ${link}`);
  }
}
