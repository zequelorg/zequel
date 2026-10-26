import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'
import {
  IPC,
  type BackendHealth,
  type IndexStatus,
  type ResearchSymbol,
  type ResearchFinding,
  type ResearchTraceGraph,
} from './ipc-contract'
import { startBackend, stopBackend, backendFetch } from './backend'

// ─── Project root authorization ─────────────────────────────────────────────
//
// The renderer never gets raw filesystem access. It can ask the user to pick
// a folder (via the native dialog, which the user explicitly drives), and
// after that it may only read/write paths inside that one folder. Every
// filesystem IPC handler below re-validates the requested path against this
// boundary — the renderer cannot escape it by sending `../../etc/passwd` or
// an absolute path elsewhere, even if the renderer were compromised.
let openProjectRoot: string | null = null

function assertWithinProjectRoot(targetPath: string): string {
  if (!openProjectRoot) {
    throw new Error('No project is open.')
  }
  const resolved = path.resolve(openProjectRoot, targetPath)
  const root = path.resolve(openProjectRoot)
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error('Path is outside the open project and was refused.')
  }
  return resolved
}

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    show: false,
    backgroundColor: '#000000',
    webPreferences: {
      // The three settings below are the whole security model of this app.
      // Do not change any of them without updating docs/SECURITY.md and
      // re-reviewing every preload exposure in preload.ts.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())

  // Any attempt to open a new window (e.g. target="_blank") or navigate to an
  // external origin is sent to the user's real browser instead, never loaded
  // inside the app's own privileged window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const isDev = !app.isPackaged
    const devServer = process.env.ZEQUEL_DESKTOP_DEV_SERVER_URL
    const allowed = isDev && devServer && url.startsWith(devServer)
    if (!allowed) {
      event.preventDefault()
      void shell.openExternal(url)
    }
  })

  const devServerUrl = process.env.ZEQUEL_DESKTOP_DEV_SERVER_URL
  if (!app.isPackaged && devServerUrl) {
    void mainWindow.loadURL(devServerUrl)
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  // Backend startup failure (e.g. binary not built yet — see
  // backend/README.md) does not crash the app: the renderer's health check
  // will simply report "not connected" instead of silently pretending to work.
  startBackend().catch((err) => {
    console.error('[backend] failed to start:', err)
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', async (event) => {
  event.preventDefault()
  await stopBackend()
  app.exit()
})

// ─── IPC handlers ────────────────────────────────────────────────────────────
// Each handler corresponds 1:1 to a method on the typed preload bridge
// (see ipc-contract.ts and preload.ts). There is no generic "invoke anything"
// channel — every privileged operation the renderer can trigger is named and
// implemented individually here.

ipcMain.handle(IPC.APP_GET_VERSION, () => app.getVersion())

ipcMain.handle(IPC.PROJECT_OPEN_FOLDER_DIALOG, async () => {
  if (!mainWindow) return null
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  openProjectRoot = result.filePaths[0]
  // Tell the backend which folder to index. The root comes from the native
  // dialog above, never from the renderer. A failure here (backend not built
  // or not running) must not block opening the folder for editing.
  try {
    await backendFetch('/v1/project/open', {
      method: 'POST',
      body: JSON.stringify({ root: openProjectRoot }),
    })
  } catch (err) {
    console.error('[backend] could not register project root:', err)
  }
  return openProjectRoot
})

ipcMain.handle(IPC.PROJECT_READ_DIRECTORY, async (_event, relativePath: string) => {
  const target = assertWithinProjectRoot(relativePath)
  const entries = await fs.readdir(target, { withFileTypes: true })
  return entries
    .map((e) => ({
      name: e.name,
      isDirectory: e.isDirectory(),
    }))
    .sort((a, b) => Number(b.isDirectory) - Number(a.isDirectory) || a.name.localeCompare(b.name))
})

ipcMain.handle(IPC.PROJECT_READ_FILE, async (_event, relativePath: string) => {
  const target = assertWithinProjectRoot(relativePath)
  const stat = await fs.stat(target)
  // A simple, honest guardrail rather than a silent truncation: reject files
  // too large to be a source file we'd want to open in the editor. The limit
  // is generous (5 MB) and intentionally visible to the caller as an error,
  // not a partial read presented as a complete file.
  if (stat.size > 5 * 1024 * 1024) {
    throw new Error('File is larger than 5 MB and was not opened.')
  }
  return fs.readFile(target, 'utf-8')
})

ipcMain.handle(
  IPC.PROJECT_WRITE_FILE,
  async (_event, relativePath: string, content: string) => {
    const target = assertWithinProjectRoot(relativePath)
    await fs.writeFile(target, content, 'utf-8')
    return true
  }
)

ipcMain.handle(IPC.BACKEND_HEALTH, async (): Promise<BackendHealth> => {
  return (await backendFetch('/v1/health')) as BackendHealth
})

// ─── Research (thin, validated proxies to the Go backend) ───────────────────

ipcMain.handle(IPC.RESEARCH_INDEX, async (): Promise<IndexStatus> => {
  return (await backendFetch('/v1/index/start', { method: 'POST' })) as IndexStatus
})

ipcMain.handle(IPC.RESEARCH_SYMBOLS, async (_event, query: unknown): Promise<ResearchSymbol[]> => {
  const params = new URLSearchParams({
    q: typeof query === 'string' ? query.slice(0, 200) : '',
    kinds: 'contract,interface,library,function',
    limit: '500',
  })
  const res = (await backendFetch(`/v1/research/symbols?${params}`)) as { symbols: ResearchSymbol[] }
  return res.symbols
})

ipcMain.handle(
  IPC.RESEARCH_TRACE,
  async (_event, rootId: unknown, depth: unknown): Promise<ResearchTraceGraph> => {
    if (typeof rootId !== 'string' || rootId.length === 0 || rootId.length > 1000) {
      throw new Error('A symbol id is required.')
    }
    const d = typeof depth === 'number' && Number.isFinite(depth) ? Math.trunc(depth) : 1
    const params = new URLSearchParams({ root: rootId, depth: String(d) })
    return (await backendFetch(`/v1/research/trace?${params}`)) as ResearchTraceGraph
  }
)

ipcMain.handle(IPC.RESEARCH_FINDINGS, async (): Promise<ResearchFinding[]> => {
  const res = (await backendFetch('/v1/research/findings')) as { findings: ResearchFinding[] }
  return res.findings
})

// Directories never worth walking into for a "quick open" file list — not a
// configurable ignore system yet (no .gitignore parsing), just the obvious,
// near-universal noise. Revisit once backend/internal/index exists and can
// do this properly.
const LIST_FILES_IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'dist-electron',
  'release',
  'bin',
  '.next',
  '.turbo',
  'target',
  '__pycache__',
  '.venv',
  'venv',
])
const LIST_FILES_MAX_RESULTS = 5000

ipcMain.handle(IPC.PROJECT_LIST_FILES, async (): Promise<string[]> => {
  if (!openProjectRoot) return []
  const root = openProjectRoot
  const results: string[] = []

  async function walk(dir: string, relDir: string): Promise<void> {
    if (results.length >= LIST_FILES_MAX_RESULTS) return
    let entries: import('node:fs').Dirent[]
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return // unreadable directory (permissions, symlink loop) — skip it
    }
    for (const entry of entries) {
      if (results.length >= LIST_FILES_MAX_RESULTS) return
      if (entry.name.startsWith('.') && entry.name !== '.github') continue
      const rel = relDir ? `${relDir}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        if (LIST_FILES_IGNORED_DIRS.has(entry.name)) continue
        await walk(path.join(dir, entry.name), rel)
      } else {
        results.push(rel)
      }
    }
  }

  await walk(root, '')
  return results
})
