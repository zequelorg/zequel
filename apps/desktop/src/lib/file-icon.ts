// Maps a file name to an icon + a distinct accent color, by extension.
// Deliberately not a pixel-for-pixel copy of VS Code's Seti/Material icon
// theme (different icon shapes, different exact colors) — VS Code is the
// design *benchmark* here (density, restraint, a color-coded file tree that
// makes scanning fast), not a skin to clone. Icons come from lucide-react,
// already a dependency; colors are a small, deliberate palette distinct
// enough per-language to scan quickly without being garish.
import {
  FileCode2,
  FileJson2,
  FileText,
  Braces,
  Palette,
  Database,
  Settings2,
  Image,
  File as FileIcon,
  Folder,
  FolderOpen,
  type LucideIcon,
} from 'lucide-react'

interface FileIconSpec {
  icon: LucideIcon
  color: string
}

const EXTENSION_ICON: Record<string, FileIconSpec> = {
  js: { icon: FileCode2, color: '#f0db4f' },
  mjs: { icon: FileCode2, color: '#f0db4f' },
  cjs: { icon: FileCode2, color: '#f0db4f' },
  jsx: { icon: FileCode2, color: '#61dafb' },
  ts: { icon: FileCode2, color: '#3b82f6' },
  mts: { icon: FileCode2, color: '#3b82f6' },
  tsx: { icon: FileCode2, color: '#3b82f6' },
  json: { icon: FileJson2, color: '#f0c674' },
  py: { icon: FileCode2, color: '#4b8bbe' },
  go: { icon: FileCode2, color: '#00add8' },
  rs: { icon: FileCode2, color: '#dea584' },
  java: { icon: FileCode2, color: '#e76f00' },
  kt: { icon: FileCode2, color: '#a97bff' },
  c: { icon: FileCode2, color: '#a8b9cc' },
  h: { icon: FileCode2, color: '#a8b9cc' },
  cpp: { icon: FileCode2, color: '#659ad2' },
  cc: { icon: FileCode2, color: '#659ad2' },
  cs: { icon: FileCode2, color: '#9b6bdf' },
  swift: { icon: FileCode2, color: '#f05138' },
  dart: { icon: FileCode2, color: '#13b9fd' },
  html: { icon: FileCode2, color: '#e34c26' },
  htm: { icon: FileCode2, color: '#e34c26' },
  xml: { icon: Braces, color: '#e34c26' },
  css: { icon: Palette, color: '#2965f1' },
  scss: { icon: Palette, color: '#cc6699' },
  sql: { icon: Database, color: '#dba12b' },
  md: { icon: FileText, color: '#9a9a9a' },
  markdown: { icon: FileText, color: '#9a9a9a' },
  yml: { icon: Settings2, color: '#a1b0c0' },
  yaml: { icon: Settings2, color: '#a1b0c0' },
  toml: { icon: Settings2, color: '#a1b0c0' },
  png: { icon: Image, color: '#9a9a9a' },
  jpg: { icon: Image, color: '#9a9a9a' },
  jpeg: { icon: Image, color: '#9a9a9a' },
  svg: { icon: Image, color: '#ffb13b' },
  gif: { icon: Image, color: '#9a9a9a' },
}

export function fileIconFor(name: string): FileIconSpec {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return EXTENSION_ICON[ext] ?? { icon: FileIcon, color: 'var(--muted-foreground)' }
}

export { Folder, FolderOpen }
