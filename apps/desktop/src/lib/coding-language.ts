// Minimal language-detection helper for the desktop editor. Ported logic
// (extension → language mapping) from the old web app's richer
// lib/coding/languages.ts, trimmed to just what CodeEditor.tsx needs since
// that file's other concerns (upload previews, run commands) weren't ported.
export type CodingLanguage =
  | 'javascript'
  | 'jsx'
  | 'typescript'
  | 'tsx'
  | 'json'
  | 'python'
  | 'html'
  | 'xml'
  | 'css'
  | 'scss'
  | 'java'
  | 'kotlin'
  | 'cpp'
  | 'c'
  | 'csharp'
  | 'go'
  | 'rust'
  | 'swift'
  | 'dart'
  | 'sql'
  | 'plaintext'
  | 'markdown'

const EXTENSION_MAP: Record<string, CodingLanguage> = {
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'jsx',
  ts: 'typescript',
  mts: 'typescript',
  tsx: 'tsx',
  json: 'json',
  py: 'python',
  html: 'html',
  htm: 'html',
  xml: 'xml',
  css: 'css',
  scss: 'scss',
  java: 'java',
  kt: 'kotlin',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  h: 'c',
  hpp: 'cpp',
  c: 'c',
  cs: 'csharp',
  go: 'go',
  rs: 'rust',
  swift: 'swift',
  dart: 'dart',
  sql: 'sql',
  md: 'markdown',
  markdown: 'markdown',
}

export function languageFromPath(path: string): CodingLanguage {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  return EXTENSION_MAP[ext] ?? 'plaintext'
}
