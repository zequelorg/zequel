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
  PROJECT_LIST_FILES: 'project:list-files',
  BACKEND_HEALTH: 'backend:health',
  RESEARCH_INDEX: 'research:index',
  RESEARCH_SYMBOLS: 'research:symbols',
  RESEARCH_TRACE: 'research:trace',
  RESEARCH_FINDINGS: 'research:findings',
} as const

export interface BackendHealth {
  status: string
  version: string
}

export interface DirectoryEntry {
  name: string
  isDirectory: boolean
}

// ─── Research (mirrors the Go backend's JSON; see backend/api/API.md) ────────
// These shapes are duplicated structurally in src/lib/research/graph-types.ts;
// a mismatch is caught by tsc where the bridge result is assigned to it.

export interface IndexStats {
  files: number
  symbols: number
  edges: number
  findings: number
  languages: Record<string, number>
  truncated: boolean
}

export interface IndexStatus {
  state: 'no_project' | 'not_indexed' | 'ready'
  root?: string
  frameworks: string[]
  stats?: IndexStats
}

export interface ResearchSymbol {
  id: string
  name: string
  kind: 'contract' | 'interface' | 'library' | 'function' | 'modifier' | 'event' | 'variable' | 'external'
  parent?: string
  path: string
  line: number
  arity: number
  visibility?: string
  mutability?: string
  language: string
}

export interface ResearchFinding {
  symbolId: string
  path: string
  line: number
  severity: 'info' | 'warning' | 'critical'
  rule: string
  message: string
}

export interface ResearchTraceGraph {
  root: { id: string; label: string; path: string }
  nodes: Array<{
    id: string
    label: string
    path: string
    metricValue: number
    metricUnit: string
    direction: 'inflows' | 'outflows'
    kind: 'calls' | 'imports' | 'extends' | 'references' | 'tests'
    severity: 'none' | 'info' | 'warning' | 'critical'
  }>
  edges: Array<{
    id: string
    sourceId: string
    targetId: string
    kind: 'calls' | 'imports' | 'extends' | 'references' | 'tests'
    severity: 'none' | 'info' | 'warning' | 'critical'
  }>
}
