import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'
const root = fileURLToPath(new URL('../', import.meta.url))
export async function resolve(specifier, context, next) {
  if (specifier === 'server-only')
    return { url: 'data:text/javascript,export{}', shortCircuit: true }
  if (specifier === 'next/server') return next('next/server.js', context)
  if (specifier.startsWith('@/'))
    specifier = pathToFileURL(path.join(root, 'src', specifier.slice(2))).href
  if (specifier.startsWith('.') || specifier.startsWith('file:')) {
    const url = new URL(specifier, context.parentURL)
    if (!path.extname(url.pathname)) {
      for (const extension of ['.ts', '.tsx', '.js']) {
        try {
          await fs.access(fileURLToPath(url) + extension)
          return { url: url.href + extension, shortCircuit: true }
        } catch {}
      }
    }
  }
  return next(specifier, context)
}
export async function load(url, context, next) {
  if (
    url.startsWith('file:') &&
    /\.tsx?$/.test(url) &&
    !url.includes('/node_modules/')
  )
    return {
      format: 'module',
      shortCircuit: true,
      source: ts.transpileModule(await fs.readFile(new URL(url), 'utf8'), {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          jsx: ts.JsxEmit.ReactJSX,
        },
      }).outputText,
    }
  return next(url, context)
}
