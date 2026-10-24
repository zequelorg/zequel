// Every privileged operation the renderer can trigger has a named channel
// here. There is no generic/catch-all IPC channel in this app — adding a new
// capability means adding a named entry here, a handler in main.ts, and a
// typed method on the bridge in preload.ts. This file is imported by both, so
// the two can never drift out of sync.
export const IPC = {
  APP_GET_VERSION: 'app:get-version',
  PROJECT_OPEN_FOLDER_DIALOG: 'project:open-folder-dialog',
  PROJECT_READ_DIRECTORY: 'project:read-directory',
  PROJECT_READ_FILE: 'project:read-file',
  PROJECT_WRITE_FILE: 'project:write-file',
  BACKEND_HEALTH: 'backend:health',
} as const

export interface BackendHealth {
  status: string
  version: string
}

export interface DirectoryEntry {
  name: string
  isDirectory: boolean
}
