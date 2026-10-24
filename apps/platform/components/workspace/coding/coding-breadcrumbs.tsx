'use client'

import { useWorkspaceStore } from '@/lib/store'
import { FileIcon } from './file-icon'
import { ChevronRight, Folder, Code, Braces } from 'lucide-react'

export function CodingBreadcrumbs() {
  const { codingProject, codingFolders, codingFiles, activeCodingFileId } = useWorkspaceStore()

  const activeFile = codingFiles.find((f) => f.id === activeCodingFileId)

  if (!activeFile) return null

  // Build breadcrumb segments
  const segments: { id: string; name: string; kind: 'project' | 'folder' | 'file' }[] = []

  if (codingProject) {
    segments.push({ id: codingProject.id, name: codingProject.name, kind: 'project' })
  }

  let currentFolderId = activeFile.folder_id
  const folderStack: { id: string; name: string }[] = []
  const visited = new Set<string>()

  while (currentFolderId && !visited.has(currentFolderId)) {
    visited.add(currentFolderId)
    const folder = codingFolders.find((f) => f.id === currentFolderId)
    if (!folder) break
    folderStack.unshift({ id: folder.id, name: folder.name })
    currentFolderId = folder.parent_id
  }

  folderStack.forEach((f) => {
    segments.push({ id: f.id, name: f.name, kind: 'folder' })
  })

  segments.push({ id: activeFile.id, name: activeFile.name, kind: 'file' })

  // Infer class / function symbols from active file content for richer IDE breadcrumbs
  const symbols: string[] = []
  if (activeFile.content) {
    const classMatch = activeFile.content.match(/class\s+([A-Za-z0-9_$]+)/)
    if (classMatch?.[1]) symbols.push(classMatch[1])
    const funcMatch = activeFile.content.match(/(?:function|const|let|var)\s+([A-Za-z0-9_$]+)\s*=?\s*(?:function|\([^)]*\)\s*=>)/)
    if (funcMatch?.[1]) symbols.push(funcMatch[1])
  }

  return (
    <div className="flex shrink-0 items-center gap-1.5 border-b border-border bg-background px-4 py-1.5 font-mono text-[11px] text-muted-foreground select-none overflow-x-auto">
      {segments.map((seg, idx) => (
        <div key={seg.id} className="flex items-center gap-1.5 shrink-0">
          {idx > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/50" />}
          {seg.kind === 'folder' && <Folder className="h-3.5 w-3.5 text-muted-foreground" />}
          {seg.kind === 'file' && <FileIcon fileName={seg.name} size={14} />}
          <span
            className={
              seg.kind === 'file'
                ? 'font-medium text-foreground'
                : 'hover:text-foreground cursor-pointer'
            }
          >
            {seg.name}
          </span>
        </div>
      ))}

      {symbols.map((sym, i) => (
        <div key={i} className="flex items-center gap-1.5 shrink-0">
          <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
          {i === 0 ? <Braces className="h-3.5 w-3.5 text-amber-500" /> : <Code className="h-3.5 w-3.5 text-purple-400" />}
          <span className="text-foreground/90 font-medium">{sym}</span>
        </div>
      ))}
    </div>
  )
}
