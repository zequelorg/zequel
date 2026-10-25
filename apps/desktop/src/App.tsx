import { useCallback, useEffect, useState } from 'react'
import type { DirectoryEntry } from '../electron/ipc-contract'
import { FileTree } from './FileTree'
import { BackendStatus } from './BackendStatus'
import { CodeEditor } from './components/CodeEditor'
import { GraphView } from './components/research/graph-view'
import { languageFromPath } from './lib/coding-language'

type Mode = 'coding' | 'research'

/**
 * Zequel Desktop's shell.
 *
 * Coding mode: open a real local folder through the OS dialog, browse it,
 * open and edit a real file through the themed CodeMirror editor (ported
 * from the old web app, now deleted — see CodeEditor.tsx), and save it back
 * to disk through the IPC bridge. Nothing here is mocked.
 *
 * Research mode: the trace-graph view, currently reading from a hand-traced
 * fixture of this repo's own Go backend rather than a live indexer — see
 * lib/research/graph-fixture.ts and docs/STATUS.md for exactly what that
 * means and what's still planned.
 *
 * Still not ported from the old web app (tracked honestly in
 * docs/STATUS.md, not silently dropped): the integrated terminal, git
 * panel, search panel, and AI assistant panel. This is Coding Mode's editor
 * and file browser, not yet the full IDE.
 */
export function App() {
  const [mode, setMode] = useState<Mode>('coding')
  const [projectRoot, setProjectRoot] = useState<string | null>(null)
  const [rootEntries, setRootEntries] = useState<DirectoryEntry[]>([])
  const [openFilePath, setOpenFilePath] = useState<string | null>(null)
  const [openFileContent, setOpenFileContent] = useState<string>('')
  const [savedContent, setSavedContent] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isDirty = openFilePath !== null && openFileContent !== savedContent

  const handleOpenFolder = useCallback(async () => {
    setError(null)
    try {
      const picked = await window.zequel.project.openFolderDialog()
      if (!picked) return
      const entries = await window.zequel.project.readDirectory('.')
      setProjectRoot(picked)
      setRootEntries(entries)
      setOpenFilePath(null)
      setOpenFileContent('')
      setSavedContent('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open folder')
    }
  }, [])

  const handleOpenFile = useCallback(async (relativePath: string) => {
    setError(null)
    try {
      const content = await window.zequel.project.readFile(relativePath)
      setOpenFilePath(relativePath)
      setOpenFileContent(content)
      setSavedContent(content)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open file')
    }
  }, [])

  const handleSave = useCallback(async () => {
    if (!openFilePath || saving) return
    setSaving(true)
    setError(null)
    try {
      await window.zequel.project.writeFile(openFilePath, openFileContent)
      setSavedContent(openFileContent)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save file')
    } finally {
      setSaving(false)
    }
  }, [openFilePath, openFileContent, saving])

  // Ctrl/Cmd+S saves the open file instead of triggering the browser/OS
  // save dialog. Electron's renderer is a real web page, so this has to be
  // handled explicitly.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isSaveChord = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's'
      if (!isSaveChord) return
      e.preventDefault()
      void handleSave()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleSave])

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="app-title">Zequel</span>
        <button className="open-folder-btn" onClick={() => void handleOpenFolder()}>
          Open Folder
        </button>
        {projectRoot && <span className="project-root">{projectRoot}</span>}
        <span className="header-spacer" />
        <div className="mode-switcher">
          <button
            className={`mode-switcher-btn${mode === 'coding' ? ' active' : ''}`}
            onClick={() => setMode('coding')}
          >
            Coding
          </button>
          <button
            className={`mode-switcher-btn${mode === 'research' ? ' active' : ''}`}
            onClick={() => setMode('research')}
          >
            Research
          </button>
        </div>
        <BackendStatus />
      </header>

      {error && <div className="error-banner">{error}</div>}

      {mode === 'research' ? (
        <div className="app-body">
          <GraphView />
        </div>
      ) : (
        <div className="app-body">
          <aside className="sidebar">
            {projectRoot ? (
              <FileTree rootEntries={rootEntries} onOpenFile={(p) => void handleOpenFile(p)} />
            ) : (
              <p className="empty-state">Open a folder to get started.</p>
            )}
          </aside>
          <main className="editor-area">
            {openFilePath ? (
              <>
                <div className="editor-tab">
                  <span>
                    {openFilePath}
                    {isDirty && <span className="editor-dirty-dot"> ●</span>}
                  </span>
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
                    value={openFileContent}
                    language={languageFromPath(openFilePath)}
                    onChange={setOpenFileContent}
                  />
                </div>
              </>
            ) : (
              <p className="empty-state">No file open.</p>
            )}
          </main>
        </div>
      )}
    </div>
  )
}
