import { useState } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import type { DirectoryEntry } from '../electron/ipc-contract'
import { fileIconFor, Folder, FolderOpen } from './lib/file-icon'

interface FileTreeProps {
  rootEntries: DirectoryEntry[]
  onOpenFile: (relativePath: string) => void
  activePath?: string | null
}

export function FileTree({ rootEntries, onOpenFile, activePath }: FileTreeProps) {
  return (
    <ul className="file-tree">
      {rootEntries.map((entry) => (
        <TreeNode
          key={entry.name}
          entry={entry}
          relativePath={entry.name}
          onOpenFile={onOpenFile}
          activePath={activePath}
        />
      ))}
    </ul>
  )
}

function TreeNode({
  entry,
  relativePath,
  onOpenFile,
  activePath,
}: {
  entry: DirectoryEntry
  relativePath: string
  onOpenFile: (relativePath: string) => void
  activePath?: string | null
}) {
  const [expanded, setExpanded] = useState(false)
  const [children, setChildren] = useState<DirectoryEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const toggle = async () => {
    if (!entry.isDirectory) {
      onOpenFile(relativePath)
      return
    }
    if (expanded) {
      setExpanded(false)
      return
    }
    setExpanded(true)
    if (children === null) {
      try {
        const result = await window.zequel.project.readDirectory(relativePath)
        setChildren(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to read directory')
      }
    }
  }

  const { icon: FileGlyph, color } = fileIconFor(entry.name)
  const isActive = !entry.isDirectory && activePath === relativePath

  return (
    <li>
      <button
        className={`tree-row${isActive ? ' tree-row--active' : ''}`}
        onClick={() => void toggle()}
      >
        <span className="tree-chevron">
          {entry.isDirectory ? (
            expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )
          ) : null}
        </span>
        <span className="tree-icon" style={{ color: entry.isDirectory ? '#79b8ff' : color }}>
          {entry.isDirectory ? (
            expanded ? (
              <FolderOpen className="h-3.5 w-3.5" />
            ) : (
              <Folder className="h-3.5 w-3.5" />
            )
          ) : (
            <FileGlyph className="h-3.5 w-3.5" />
          )}
        </span>
        <span className="tree-label">{entry.name}</span>
      </button>
      {entry.isDirectory && expanded && (
        <ul className="file-tree nested">
          {error && <li className="tree-error">{error}</li>}
          {children?.map((child) => (
            <TreeNode
              key={child.name}
              entry={child}
              relativePath={`${relativePath}/${child.name}`}
              onOpenFile={onOpenFile}
              activePath={activePath}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
