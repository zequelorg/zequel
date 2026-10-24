import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'
import { IPC } from './ipc-contract'

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
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
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
