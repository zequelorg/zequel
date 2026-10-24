import { useCallback, useState } from 'react'
import type { DirectoryEntry } from '../electron/ipc-contract'
import { FileTree } from './FileTree'

/**
 * First vertical slice of Zequel Desktop.
 *
 * This is deliberately small: open a real local folder through the OS
 * dialog, list its contents, and open a file's real contents — all through
 * the IPC bridge in preload.ts, nothing mocked. Coding Mode's actual editor,
 * terminal, and file-explorer UI (already built in apps/platform during the
 * web-app phase of this project) get ported in on top of this foundation
 * next; this file is intentionally not trying to be that yet.
 */
export function App() {
  const [projectRoot, setProjectRoot] = useState<string | null>(null)
  const [rootEntries, setRootEntries] = useState<DirectoryEntry[]>([])
  const [openFilePath, setOpenFilePath] = useState<string | null>(null)
  const [openFileContent, setOpenFileContent] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open file')
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
              <div className="editor-tab">{openFilePath}</div>
              <pre className="file-contents">{openFileContent}</pre>
            </>
          ) : (
            <p className="empty-state">No file open.</p>
          )}
        </main>
      </div>
    </div>
  )
}
