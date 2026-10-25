import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type DirectoryEntry, type BackendHealth } from './ipc-contract'

// This is the entire API surface exposed to the renderer. The renderer has
// no access to `ipcRenderer`, `require`, or any other Node.js capability —
// only these specific, named, typed methods. If the renderer is ever
// compromised (e.g. via a dependency or a rendered AI response containing
// script), this is the complete list of what it could possibly do to the
// user's machine. Keep it that way: do not add a generic "invoke" passthrough
// here, ever.
const zequelBridge = {
  app: {
    getVersion: (): Promise<string> => ipcRenderer.invoke(IPC.APP_GET_VERSION),
  },
  project: {
    // Opens the native folder picker. Returns the chosen absolute path, or
    // null if the user cancelled. This is the ONLY way a project root is
    // ever set — the renderer cannot open an arbitrary path itself.
    openFolderDialog: (): Promise<string | null> =>
      ipcRenderer.invoke(IPC.PROJECT_OPEN_FOLDER_DIALOG),
    // All paths below are relative to whatever folder openFolderDialog()
    // returned. The main process re-validates every one of them against that
    // root before touching the filesystem (see assertWithinProjectRoot in
    // main.ts) — this preload layer does not and should not duplicate that
    // check, since the real guarantee has to live on the privileged side.
    readDirectory: (relativePath: string): Promise<DirectoryEntry[]> =>
      ipcRenderer.invoke(IPC.PROJECT_READ_DIRECTORY, relativePath),
    readFile: (relativePath: string): Promise<string> =>
      ipcRenderer.invoke(IPC.PROJECT_READ_FILE, relativePath),
    writeFile: (relativePath: string, content: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.PROJECT_WRITE_FILE, relativePath, content),
    // Recursive file listing for Quick Open (Cmd/Ctrl+P) — relative paths
    // only, already filtered to skip node_modules/.git/dist/etc and capped
    // at 5000 results on the main-process side (see main.ts). Returns []
    // if no project is open.
    listFiles: (): Promise<string[]> => ipcRenderer.invoke(IPC.PROJECT_LIST_FILES),
  },
  backend: {
    // Proxies to the Go backend's GET /v1/health. The renderer never sees the
    // backend's port or auth token — only this one specific, named result.
    health: (): Promise<BackendHealth> => ipcRenderer.invoke(IPC.BACKEND_HEALTH),
  },
}

export type ZequelBridge = typeof zequelBridge

contextBridge.exposeInMainWorld('zequel', zequelBridge)
