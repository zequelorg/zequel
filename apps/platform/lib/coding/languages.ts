import type { CodingLanguage } from '@zequel/types'

export interface LanguageMeta {
  id: CodingLanguage
  // Human-readable display name
  label: string
  // Short tag rendered inside the branded file icon (e.g. "TS", "PY")
  short: string
  // Accent color for the branded icon badge (kept subtle to match the brand)
  color: string
  // Default file extension (without the dot)
  extension: string
  // Additional extensions that map to this language
  aliases?: string[]
  // Starter content shown when a new file of this language is created
  starter: string
}

// Single source of truth for the languages Coding Mode understands. `language`
// is stored as free text in the DB (no constraint), so users are NOT limited to
// this list — unknown languages still work, they just fall back to a generic
// icon and plain-text editing. Add entries freely.
export const CODING_LANGUAGES: LanguageMeta[] = [
  { id: 'javascript', label: 'JavaScript', short: 'JS', color: '#e8b923', extension: 'js', aliases: ['mjs', 'cjs'], starter: `// JavaScript\nfunction greet(name) {\n  return \`Hello, \${name}!\`\n}\n\nconsole.log(greet('Zequel'))\n` },
  { id: 'typescript', label: 'TypeScript', short: 'TS', color: '#3178c6', extension: 'ts', aliases: ['mts', 'cts'], starter: `// TypeScript\nfunction greet(name: string): string {\n  return \`Hello, \${name}!\`\n}\n\nconsole.log(greet('Zequel'))\n` },
  { id: 'jsx', label: 'React JSX', short: 'JSX', color: '#61dafb', extension: 'jsx', starter: `export default function App() {\n  return <h1>Hello, Zequel!</h1>\n}\n` },
  { id: 'tsx', label: 'React TSX', short: 'TSX', color: '#61dafb', extension: 'tsx', starter: `export default function App() {\n  return <h1>Hello, Zequel!</h1>\n}\n` },
  { id: 'python', label: 'Python', short: 'PY', color: '#4584b6', extension: 'py', aliases: ['pyw'], starter: `# Python\ndef greet(name: str) -> str:\n    return f"Hello, {name}!"\n\n\nprint(greet("Zequel"))\n` },
  { id: 'html', label: 'HTML', short: '<>', color: '#e34c26', extension: 'html', aliases: ['htm'], starter: `<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <title>Document</title>\n  </head>\n  <body>\n    <h1>Hello, Zequel!</h1>\n  </body>\n</html>\n` },
  { id: 'css', label: 'CSS', short: 'CSS', color: '#2965f1', extension: 'css', starter: `/* CSS */\nbody {\n  font-family: system-ui, sans-serif;\n  margin: 0;\n  padding: 2rem;\n}\n` },
  { id: 'scss', label: 'SCSS', short: 'SASS', color: '#cd6799', extension: 'scss', aliases: ['sass'], starter: `/* SCSS */\n$brand: #111;\n\nbody {\n  color: $brand;\n}\n` },
  { id: 'java', label: 'Java', short: 'JAVA', color: '#e76f00', extension: 'java', starter: `// Java\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, Zequel!");\n    }\n}\n` },
  { id: 'cpp', label: 'C++', short: 'C++', color: '#00599c', extension: 'cpp', aliases: ['cc', 'cxx', 'hpp', 'hh'], starter: `// C++\n#include <iostream>\n\nint main() {\n    std::cout << "Hello, Zequel!" << std::endl;\n    return 0;\n}\n` },
  { id: 'c', label: 'C', short: 'C', color: '#5c6bc0', extension: 'c', aliases: ['h'], starter: `// C\n#include <stdio.h>\n\nint main() {\n    printf("Hello, Zequel!\\n");\n    return 0;\n}\n` },
  { id: 'csharp', label: 'C#', short: 'C#', color: '#68217a', extension: 'cs', starter: `// C#\nusing System;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine("Hello, Zequel!");\n    }\n}\n` },
  { id: 'go', label: 'Go', short: 'GO', color: '#00add8', extension: 'go', starter: `package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, Zequel!")\n}\n` },
  { id: 'rust', label: 'Rust', short: 'RS', color: '#dea584', extension: 'rs', starter: `fn main() {\n    println!("Hello, Zequel!");\n}\n` },
  { id: 'php', label: 'PHP', short: 'PHP', color: '#777bb4', extension: 'php', starter: `<?php\necho "Hello, Zequel!";\n` },
  { id: 'ruby', label: 'Ruby', short: 'RB', color: '#cc342d', extension: 'rb', starter: `# Ruby\nputs "Hello, Zequel!"\n` },
  { id: 'swift', label: 'Swift', short: 'SW', color: '#f05138', extension: 'swift', starter: `// Swift\nprint("Hello, Zequel!")\n` },
  { id: 'kotlin', label: 'Kotlin', short: 'KT', color: '#7f52ff', extension: 'kt', aliases: ['kts'], starter: `fun main() {\n    println("Hello, Zequel!")\n}\n` },
  { id: 'sql', label: 'SQL', short: 'SQL', color: '#336791', extension: 'sql', starter: `-- SQL\nSELECT 'Hello, Zequel!' AS greeting;\n` },
  { id: 'json', label: 'JSON', short: 'JSON', color: '#cbcb41', extension: 'json', starter: `{\n  "greeting": "Hello, Zequel!"\n}\n` },
  { id: 'yaml', label: 'YAML', short: 'YML', color: '#cb171e', extension: 'yaml', aliases: ['yml'], starter: `greeting: Hello, Zequel!\n` },
  { id: 'markdown', label: 'Markdown', short: 'MD', color: '#519aba', extension: 'md', aliases: ['mdx'], starter: `# Hello, Zequel!\n\nStart writing...\n` },
  { id: 'shell', label: 'Shell', short: 'SH', color: '#89e051', extension: 'sh', aliases: ['bash', 'zsh'], starter: `#!/usr/bin/env bash\necho "Hello, Zequel!"\n` },
  { id: 'dart', label: 'Dart', short: 'DART', color: '#0175c2', extension: 'dart', starter: `void main() {\n  print('Hello, Zequel!');\n}\n` },
  { id: 'r', label: 'R', short: 'R', color: '#198ce7', extension: 'r', starter: `# R\nprint("Hello, Zequel!")\n` },
  { id: 'xml', label: 'XML', short: 'XML', color: '#e37933', extension: 'xml', starter: `<?xml version="1.0" encoding="UTF-8"?>\n<greeting>Hello, Zequel!</greeting>\n` },
  { id: 'plaintext', label: 'Plain Text', short: 'TXT', color: '#8a8a8a', extension: 'txt', aliases: ['text', 'log'], starter: `` },
]

export const LANGUAGE_MAP: Record<string, LanguageMeta> = CODING_LANGUAGES.reduce(
  (acc, lang) => {
    acc[lang.id] = lang
    return acc
  },
  {} as Record<string, LanguageMeta>
)

const PLAIN = LANGUAGE_MAP.plaintext

const BY_EXT = new Map<string, LanguageMeta>()
for (const lang of CODING_LANGUAGES) {
  if (!BY_EXT.has(lang.extension)) BY_EXT.set(lang.extension, lang)
  for (const alias of lang.aliases ?? []) {
    if (!BY_EXT.has(alias)) BY_EXT.set(alias, lang)
  }
}

export function getLanguageMeta(id?: CodingLanguage | null): LanguageMeta {
  if (!id) return PLAIN
  return LANGUAGE_MAP[id] ?? { ...PLAIN, id, label: id, short: id.slice(0, 4).toUpperCase() }
}

// Infer a language from a file name extension. Falls back to plain text.
export function languageFromFileName(name: string): CodingLanguage {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return BY_EXT.get(ext)?.id ?? 'plaintext'
}

// Ensure a filename has an extension appropriate for its language.
export function ensureExtension(name: string, languageId: CodingLanguage): string {
  const trimmed = name.trim()
  const meta = getLanguageMeta(languageId)
  if (!trimmed) return `untitled.${meta.extension}`
  if (trimmed.includes('.')) return trimmed
  return `${trimmed}.${meta.extension}`
}
