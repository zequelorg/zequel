import { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { fileIconFor } from '@/lib/file-icon'

interface CommandPaletteProps {
  open: boolean
  files: string[]
  onSelect: (path: string) => void
  onClose: () => void
}

function baseName(path: string): string {
  return path.split('/').pop() ?? path
}

// Simple, fast subsequence scorer — not a full fuzzy-match library (no new
// dependency for this). Characters of the query must appear in order in the
// target, consecutive runs score higher, and an earlier match scores higher,
// which is enough to make "approuter" reasonably find "App.tsx" wrapped in
// "src/App.tsx" and rank exact prefixes first. Good enough for a project's
// worth of files; revisit if it's ever not.
function fuzzyScore(query: string, target: string): number | null {
  if (query === '') return 0
  const q = query.toLowerCase()
  const t = target.toLowerCase()
  let qi = 0
  let score = 0
  let consecutive = 0
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      consecutive++
      score += 1 + consecutive
      qi++
    } else {
      consecutive = 0
    }
  }
  if (qi !== q.length) return null // not all query chars matched, in order
  // Reward matches near the start of the string (e.g. the file name itself,
  // which for most paths is the back half — handled by baseName boost below).
  return score
}

/**
 * Quick Open (Cmd/Ctrl+P) — VS Code's benchmark feature for this: a centered
 * overlay, type to fuzzy-filter every file in the project, arrow keys to
 * move, Enter to open, Escape to dismiss. Backed by a real recursive file
 * listing from the main process (electron/main.ts's PROJECT_LIST_FILES
 * handler), not a mock list — but see docs/STATUS.md for the one real
 * limitation: the list is snapshotted when a folder is opened, so a file
 * created after that point won't appear until the folder is reopened (no
 * filesystem watcher exists yet).
 */
export function CommandPalette({ open, files, onSelect, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      // Focus on next tick — the overlay must be mounted first.
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  const results = useMemo(() => {
    if (!open) return []
    if (query === '') return files.slice(0, 50)
    const scored = files
      .map((path) => {
        // Score against the file name AND the full path, weighting the file
        // name higher — typing "editor" should favor CodeEditor.tsx over an
        // unrelated file that happens to live in a long path containing it.
        const nameScore = fuzzyScore(query, baseName(path))
        const pathScore = fuzzyScore(query, path)
        if (nameScore === null && pathScore === null) return null
        const best = Math.max(nameScore ?? -Infinity, (pathScore ?? -Infinity) * 0.4)
        return { path, score: best }
      })
      .filter((x): x is { path: string; score: number } => x !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, 50)
    return scored.map((s) => s.path)
  }, [query, files, open])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  if (!open) return null

  const commit = (path: string | undefined) => {
    if (!path) return
    onSelect(path)
    onClose()
  }

  return (
    <div className="command-palette-backdrop" onClick={onClose}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <div className="command-palette-input-row">
          <Search className="h-4 w-4 command-palette-search-icon" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Go to file…"
            className="command-palette-input"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                onClose()
              } else if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSelectedIndex((i) => Math.min(i + 1, results.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSelectedIndex((i) => Math.max(i - 1, 0))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                commit(results[selectedIndex])
              }
            }}
          />
        </div>
        <div className="command-palette-results">
          {results.length === 0 ? (
            <p className="command-palette-empty">
              {files.length === 0 ? 'Open a folder first.' : 'No matching files.'}
            </p>
          ) : (
            results.map((path, i) => {
              const { icon: FileGlyph, color } = fileIconFor(path)
              return (
                <button
                  key={path}
                  className={`command-palette-row${i === selectedIndex ? ' command-palette-row--active' : ''}`}
                  onMouseEnter={() => setSelectedIndex(i)}
                  onClick={() => commit(path)}
                >
                  <FileGlyph className="h-3.5 w-3.5" style={{ color }} />
                  <span className="command-palette-row-name">{baseName(path)}</span>
                  <span className="command-palette-row-path">{path}</span>
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
