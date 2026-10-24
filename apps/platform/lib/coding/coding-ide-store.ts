import { create } from 'zustand'
import {
  createCodingRuntime,
  type CodingRuntime,
  type PreviewInfo,
  type RuntimeStatus,
} from './runtime'

// Activity Bar tabs
export type ActivityTab = 'explorer' | 'search' | 'git' | 'assistant' | 'settings'

// Bottom Dock tabs
export type BottomTab = 'terminal' | 'problems' | 'output' | 'preview'

// Which surface the center area shows.
export type CodingViewMode = 'editor' | 'split' | 'preview'

// Preview viewport presets.
export type PreviewViewport = 'desktop' | 'tablet' | 'mobile'

// High-level run state driven by the toolbar Run/Stop actions.
export type RunState = 'idle' | 'starting' | 'running' | 'error'

// Global editor autosave status, surfaced in the toolbar.
export type SaveState = 'idle' | 'saving' | 'saved'

// A single rendered terminal line. `stream` controls its styling.
export interface TerminalLine {
  id: string
  stream: 'input' | 'stdout' | 'stderr' | 'system'
  text: string
}

interface CodingIdeState {
  // Single runtime instance the whole IDE talks to (never a provider SDK directly).
  runtime: CodingRuntime
  runtimeStatus: RuntimeStatus
  setRuntimeStatus: (status: RuntimeStatus) => void

  // Activity Bar & Sidebar state
  activeActivityTab: ActivityTab
  setActiveActivityTab: (tab: ActivityTab) => void
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void

  // Bottom Dock state
  activeBottomTab: BottomTab
  setActiveBottomTab: (tab: BottomTab) => void
  bottomDockOpen: boolean
  setBottomDockOpen: (open: boolean) => void
  toggleBottomDock: () => void

  // Center view + panel visibility
  viewMode: CodingViewMode
  setViewMode: (mode: CodingViewMode) => void
  terminalOpen: boolean
  setTerminalOpen: (open: boolean) => void
  toggleTerminal: () => void
  assistantOpen: boolean
  setAssistantOpen: (open: boolean) => void
  toggleAssistant: () => void

  // Preview
  preview: PreviewInfo
  setPreview: (preview: PreviewInfo) => void
  previewViewport: PreviewViewport
  setPreviewViewport: (viewport: PreviewViewport) => void

  // Run lifecycle
  runState: RunState
  setRunState: (state: RunState) => void

  // Editor autosave status (set by the editor panel, shown in the toolbar).
  saveState: SaveState
  setSaveState: (state: SaveState) => void

  // Editor cursor position for status bar
  cursorPosition: { line: number; col: number }
  setCursorPosition: (pos: { line: number; col: number }) => void

  // Terminal output buffer (the terminal UI renders these lines).
  terminalLines: TerminalLine[]
  appendTerminalLine: (line: Omit<TerminalLine, 'id'>) => void
  clearTerminal: () => void

  // Text to seed the assistant composer with (e.g. "Explain this error").
  // The assistant panel consumes and clears it. Enables cross-panel education
  // flows without a backend change.
  assistantPrefill: string | null
  setAssistantPrefill: (text: string | null) => void
}

const INITIAL_PREVIEW: PreviewInfo = {
  status: 'stopped',
  url: null,
  port: 3000,
}

export const useCodingIdeStore = create<CodingIdeState>((set) => ({
  runtime: createCodingRuntime(),
  runtimeStatus: 'disconnected',
  setRuntimeStatus: (runtimeStatus) => set({ runtimeStatus }),

  activeActivityTab: 'explorer',
  setActiveActivityTab: (tab) =>
    set((s) => {
      if (s.activeActivityTab === tab && s.sidebarOpen) {
        return { sidebarOpen: false }
      }
      return { activeActivityTab: tab, sidebarOpen: true }
    }),
  sidebarOpen: true,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  activeBottomTab: 'terminal',
  setActiveBottomTab: (tab) =>
    set((s) => {
      if (s.activeBottomTab === tab && s.bottomDockOpen) {
        return { bottomDockOpen: false }
      }
      return { activeBottomTab: tab, bottomDockOpen: true }
    }),
  bottomDockOpen: true,
  setBottomDockOpen: (bottomDockOpen) => set({ bottomDockOpen }),
  toggleBottomDock: () => set((s) => ({ bottomDockOpen: !s.bottomDockOpen })),

  viewMode: 'editor',
  setViewMode: (viewMode) => set({ viewMode }),
  terminalOpen: true,
  setTerminalOpen: (terminalOpen) => set({ terminalOpen, bottomDockOpen: terminalOpen }),
  toggleTerminal: () => set((s) => ({ terminalOpen: !s.terminalOpen, bottomDockOpen: !s.terminalOpen })),
  assistantOpen: false,
  setAssistantOpen: (assistantOpen) => set({ assistantOpen }),
  toggleAssistant: () => set((s) => ({ assistantOpen: !s.assistantOpen })),

  preview: INITIAL_PREVIEW,
  setPreview: (preview) => set({ preview }),
  previewViewport: 'desktop',
  setPreviewViewport: (previewViewport) => set({ previewViewport }),

  runState: 'idle',
  setRunState: (runState) => set({ runState }),

  saveState: 'idle',
  setSaveState: (saveState) => set({ saveState }),

  cursorPosition: { line: 1, col: 1 },
  setCursorPosition: (cursorPosition) => set({ cursorPosition }),

  terminalLines: [],
  appendTerminalLine: (line) =>
    set((s) => ({
      terminalLines: [...s.terminalLines, { ...line, id: crypto.randomUUID() }],
    })),
  clearTerminal: () => set({ terminalLines: [] }),

  assistantPrefill: null,
  setAssistantPrefill: (assistantPrefill) => set({ assistantPrefill }),
}))
