import fs from 'node:fs';
import path from 'node:path';

const projectRoot = 'e:\\progict\\clinic-os-v2';
const srcDir = path.join(projectRoot, 'src');

function getAllFiles(dir, extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs']) {
  let results = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const dirent of list) {
    const fullPath = path.join(dir, dirent.name);
    if (dirent.isDirectory()) {
      if (dirent.name === 'node_modules' || dirent.name === '.next' || dirent.name === '.git' || dirent.name === '.agents') {
        continue;
      }
      results = results.concat(getAllFiles(fullPath, extensions));
    } else if (extensions.some(ext => dirent.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

const allSrcFiles = getAllFiles(srcDir);
console.log(`Total source files scanned: ${allSrcFiles.length}`);

// Simpler regexes for imports and dynamic imports
const fromRegex = /(?:import|export)\s+.*?from\s+['"]([^'"]+)['"]/g;
const directImportRegex = /import\s+['"]([^'"]+)['"]/g;
const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

const brokenImports = [];
const importedSet = new Set();

function resolveImport(sourceFilePath, importPath) {
  if (importPath.startsWith('.')) {
    return path.resolve(path.dirname(sourceFilePath), importPath);
  }
  if (importPath.startsWith('@/')) {
    return path.resolve(srcDir, importPath.slice(2));
  }
  return null; // External package
}

function fileExistsWithExtension(resolvedPath) {
  const exts = ['', '.ts', '.tsx', '.js', '.jsx', '.json', '.mjs', '/index.ts', '/index.tsx', '/index.js'];
  for (const ext of exts) {
    const candidate = resolvedPath + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return false;
}

for (const file of allSrcFiles) {
  const content = fs.readFileSync(file, 'utf-8');
  const specifiers = [];
  let m;
  while ((m = fromRegex.exec(content)) !== null) specifiers.push(m[1]);
  while ((m = directImportRegex.exec(content)) !== null) specifiers.push(m[1]);
  while ((m = dynamicImportRegex.exec(content)) !== null) specifiers.push(m[1]);

  for (const spec of specifiers) {
    const resolved = resolveImport(file, spec);
    if (resolved) {
      const actualFile = fileExistsWithExtension(resolved);
      if (!actualFile) {
        brokenImports.push({
          sourceFile: path.relative(projectRoot, file),
          importSpecifier: spec,
          resolvedAttempt: path.relative(projectRoot, resolved)
        });
      } else {
        importedSet.add(path.normalize(actualFile));
      }
    }
  }
}

console.log(`\n--- BROKEN IMPORTS REPORT ---`);
console.log(`Total broken imports: ${brokenImports.length}`);
for (const b of brokenImports) {
  console.log(`File: ${b.sourceFile} -> Cannot resolve "${b.importSpecifier}" (tried ${b.resolvedAttempt})`);
}

// Find unused/orphan components
console.log(`\n--- ORPHAN / UNUSED COMPONENTS REPORT ---`);
const componentFiles = getAllFiles(path.join(srcDir, 'components'));
const unusedComponents = [];

for (const compFile of componentFiles) {
  const normPath = path.normalize(compFile);
  if (!importedSet.has(normPath)) {
    const baseName = path.basename(compFile, path.extname(compFile));
    let foundMention = false;
    for (const f of allSrcFiles) {
      if (f === compFile) continue;
      const cnt = fs.readFileSync(f, 'utf-8');
      if (cnt.includes(baseName)) {
        foundMention = true;
        break;
      }
    }
    if (!foundMention) {
      unusedComponents.push(path.relative(projectRoot, compFile));
    }
  }
}

console.log(`Unused / Unreferenced component files: ${unusedComponents.length}`);
for (const u of unusedComponents) {
  console.log(`- ${u}`);
}
