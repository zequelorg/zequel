import { useState } from 'react'
import type { DirectoryEntry } from '../electron/ipc-contract'

interface FileTreeProps {
  rootEntries: DirectoryEntry[]
  onOpenFile: (relativePath: string) => void
}

export function FileTree({ rootEntries, onOpenFile }: FileTreeProps) {
  return (
    <ul className="file-tree">
      {rootEntries.map((entry) => (
        <TreeNode key={entry.name} entry={entry} relativePath={entry.name} onOpenFile={onOpenFile} />
      ))}
    </ul>
  )
}

function TreeNode({
  entry,
  relativePath,
  onOpenFile,
}: {
  entry: DirectoryEntry
  relativePath: string
  onOpenFile: (relativePath: string) => void
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

  return (
    <li>
      <button className="tree-row" onClick={() => void toggle()}>
        <span className="tree-icon">{entry.isDirectory ? (expanded ? '▾' : '▸') : '·'}</span>
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
            />
          ))}
        </ul>
      )}
    </li>
  )
}
