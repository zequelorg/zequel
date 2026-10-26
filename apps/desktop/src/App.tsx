import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DirectoryEntry } from '../electron/ipc-contract'
import { FileTree } from './FileTree'
import { ActivityBar, type ActivityView } from './components/ActivityBar'
import { TabBar } from './components/TabBar'
import { StatusBar } from './components/StatusBar'
import { CommandPalette } from './components/CommandPalette'
import { CodeEditor, type CursorPosition } from './components/CodeEditor'
import { GraphView } from './components/research/graph-view'
import { languageFromPath } from './lib/coding-language'

const SIDEBAR_MIN_WIDTH = 170
const SIDEBAR_MAX_WIDTH = 480
const SIDEBAR_DEFAULT_WIDTH = 240
// Matches .activity-bar's fixed width in index.css — the sidebar's drag
// handle measures from the window edge (clientX), but the sidebar itself
// starts after the Activity Bar, so that offset has to be subtracted to get
// the sidebar's own width rather than "distance from the window edge."
const ACTIVITY_BAR_WIDTH = 48

interface OpenFile {
  path: string
  content: string
  savedContent: string
}

/**
 * Zequel Desktop's shell, laid out against VS Code as a design benchmark —
 * not a clone: a fixed Activity Bar (view switcher) on the far left, a
 * resizable-width-free Side Bar (the file tree) next to it, a Tab Bar above
 * the editor for multiple open files, and a Status Bar fixed to the bottom
 * of the whole window. The visual language (density, the muted status bar,
 * color-coded file-type icons) borrows VS Code's restraint; nothing here is
 * a pixel-for-pixel copy of its icons or exact layout.
 *
 * Real, working: open a folder, browse it, open several files as tabs,
 * switch between them, edit and save each independently (dirty-tracked per
 * tab), and the Research trace graph as a second full-pane view switched to
 * from the Activity Bar.
 *
 * Also, this pass: Quick Open (Cmd/Ctrl+P — a real recursive project file
 * list from the main process, fuzzy-filtered, arrow keys + Enter to open —
 * see CommandPalette.tsx), Cmd/Ctrl+W to close the active tab, and a
 * draggable sidebar width (VS Code's resizable Side Bar, same idea).
 *
 * Still not here (tracked honestly in docs/STATUS.md): the integrated
 * terminal, git panel, search panel, AI assistant panel, and any AI provider
 * calls at all. This is the editor and file browser, not yet the full IDE.
 */
export function App() {
  const [view, setView] = useState<ActivityView>('explorer')
  const [projectRoot, setProjectRoot] = useState<string | null>(null)
  const [rootEntries, setRootEntries] = useState<DirectoryEntry[]>([])
  const [allFiles, setAllFiles] = useState<string[]>([])
  const [paletteOpen, setPaletteOpen] = useState(false)

  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH)
  const resizingRef = useRef(false)

  const [openFiles, setOpenFiles] = useState<Map<string, OpenFile>>(new Map())
  const [activePath, setActivePath] = useState<string | null>(null)
  const [cursor, setCursor] = useState<CursorPosition | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeFile = activePath ? openFiles.get(activePath) ?? null : null
  const isDirty = activeFile ? activeFile.content !== activeFile.savedContent : false

  const tabs = useMemo(
    () =>
      [...openFiles.values()].map((f) => ({
        path: f.path,
        isDirty: f.content !== f.savedContent,
      })),
    [openFiles]
  )

  const handleOpenFolder = useCallback(async () => {
    setError(null)
    try {
      const picked = await window.zequel.project.openFolderDialog()
      if (!picked) return
      const entries = await window.zequel.project.readDirectory('.')
      setProjectRoot(picked)
      setRootEntries(entries)
      setOpenFiles(new Map())
      setActivePath(null)
      setView('explorer')
      // Snapshot the project's file list for Quick Open. Deliberately a
      // snapshot, not a live watch — no filesystem watcher exists yet (see
      // CommandPalette.tsx's doc comment and docs/STATUS.md).
      try {
        const files = await window.zequel.project.listFiles()
        setAllFiles(files)
      } catch {
        setAllFiles([]) // Quick Open degrades to "no files" rather than throwing
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open folder')
    }
  }, [])

  const handleOpenFile = useCallback(
    async (relativePath: string) => {
      setError(null)
      if (openFiles.has(relativePath)) {
        setActivePath(relativePath)
        return
      }
      try {
        const content = await window.zequel.project.readFile(relativePath)
        setOpenFiles((prev) => {
          const next = new Map(prev)
          next.set(relativePath, { path: relativePath, content, savedContent: content })
          return next
        })
        setActivePath(relativePath)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to open file')
      }
    },
    [openFiles]
  )

  const handleCloseTab = useCallback(
    (path: string) => {
      setOpenFiles((prev) => {
        const next = new Map(prev)
        next.delete(path)
        if (activePath === path) {
          const remaining = [...next.keys()]
          setActivePath(remaining.length > 0 ? remaining[remaining.length - 1] : null)
        }
        return next
      })
    },
    [activePath]
  )

  const handleChangeContent = useCallback(
    (value: string) => {
      if (!activePath) return
      setOpenFiles((prev) => {
        const current = prev.get(activePath)
        if (!current) return prev
        const next = new Map(prev)
        next.set(activePath, { ...current, content: value })
        return next
      })
    },
    [activePath]
  )

  const handleSave = useCallback(async () => {
    if (!activePath || !activeFile || saving) return
    setSaving(true)
    setError(null)
    try {
      await window.zequel.project.writeFile(activePath, activeFile.content)
      setOpenFiles((prev) => {
        const current = prev.get(activePath)
        if (!current) return prev
        const next = new Map(prev)
        next.set(activePath, { ...current, savedContent: current.content })
        return next
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save file')
    } finally {
      setSaving(false)
    }
  }, [activePath, activeFile, saving])

  // Ctrl/Cmd+S saves the active tab, Ctrl/Cmd+P opens Quick Open, Ctrl/Cmd+W
  // closes the active tab — all instead of whatever the OS/browser default
  // for that chord would otherwise be (save dialog, print dialog, window
  // close).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()
      if (mod && key === 's') {
        e.preventDefault()
        void handleSave()
      } else if (mod && key === 'p') {
        e.preventDefault()
        setPaletteOpen(true)
      } else if (mod && key === 'w') {
        e.preventDefault()
        if (activePath) handleCloseTab(activePath)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleSave, activePath, handleCloseTab])

  // Sidebar resize drag — mousedown on the handle starts tracking, mousemove
  // on the window updates width while dragging (not just while over the
  // handle, so a fast drag that outruns the cursor doesn't drop the resize),
  // mouseup anywhere ends it.
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return
      const next = Math.min(
        SIDEBAR_MAX_WIDTH,
        Math.max(SIDEBAR_MIN_WIDTH, e.clientX - ACTIVITY_BAR_WIDTH)
      )
      setSidebarWidth(next)
    }
    const onMouseUp = () => {
      resizingRef.current = false
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="app-title">Zequel</span>
        <button className="open-folder-btn" onClick={() => void handleOpenFolder()}>
          Open Folder
        </button>
        {projectRoot && <span className="project-root">{projectRoot}</span>}
      </header>

      {error && <div className="error-banner">{error}</div>}

      <div className="app-body">
        <ActivityBar active={view} onChange={setView} />

        {view === 'research' ? (
          <GraphView projectRoot={projectRoot} />
        ) : (
          <>
            <aside className="sidebar" style={{ width: sidebarWidth }}>
              <p className="sidebar-heading">Explorer</p>
              {projectRoot ? (
                <FileTree
                  rootEntries={rootEntries}
                  onOpenFile={(p) => void handleOpenFile(p)}
                  activePath={activePath}
                />
              ) : (
                <p className="empty-state">Open a folder to get started.</p>
              )}
            </aside>
            <div
              className="sidebar-resize-handle"
              onMouseDown={() => {
                resizingRef.current = true
              }}
            />
            <main className="editor-area">
              {activeFile ? (
                <>
                  <TabBar
                    tabs={tabs}
                    activePath={activePath}
                    onSelect={setActivePath}
                    onClose={handleCloseTab}
                  />
                  <div className="editor-toolbar">
                    <button
                      className="editor-save-btn"
                      onClick={() => void handleSave()}
                      disabled={!isDirty || saving}
                    >
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                  <div className="editor-body">
                    <CodeEditor
                      key={activeFile.path}
                      value={activeFile.content}
                      language={languageFromPath(activeFile.path)}
                      onChange={handleChangeContent}
                      onCursorChange={setCursor}
                    />
                  </div>
                </>
              ) : (
                <p className="empty-state">No file open.</p>
              )}
            </main>
          </>
        )}
      </div>

      <StatusBar
        activePath={activePath}
        language={activeFile ? languageFromPath(activeFile.path) : null}
        cursor={activeFile ? cursor : null}
      />

      <CommandPalette
        open={paletteOpen}
        files={allFiles}
        onSelect={(p) => void handleOpenFile(p)}
        onClose={() => setPaletteOpen(false)}
      />
    </div>
  )
}
