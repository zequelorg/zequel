import { create } from 'zustand'
import type {
  Document,
  QueryResult,
  QueryHistoryItem,
  SourceReference,
  WorkspaceMode,
  Conversation,
  Message,
  CodingProject,
  CodingFolder,
  CodingFile,
  CodingMessage,
  CodingActionId,
} from '@zequel/types'

interface WorkspaceState {
  // Mode
  mode: WorkspaceMode
  setMode: (mode: WorkspaceMode) => void

  // Documents
  documents: Document[]
  selectedDocumentIds: string[]
  setDocuments: (docs: Document[]) => void
  addDocument: (doc: Document) => void
  updateDocument: (id: string, updates: Partial<Document>) => void
  removeDocument: (id: string) => void
  toggleDocumentSelection: (id: string) => void
  selectDocument: (id: string) => void
  clearSelection: () => void

  // Query results (research mode)
  currentResult: QueryResult | null
  setCurrentResult: (result: QueryResult | null) => void
  isQuerying: boolean
  setIsQuerying: (v: boolean) => void

  // Query history (research mode)
  queryHistory: QueryHistoryItem[]
  setQueryHistory: (items: QueryHistoryItem[]) => void
  addQueryToHistory: (item: QueryHistoryItem) => void
  removeQueryFromHistory: (id: string) => void

  // Conversations (study mode)
  conversations: Conversation[]
  setConversations: (convs: Conversation[]) => void
  addConversation: (conv: Conversation) => void
  removeConversation: (id: string) => void
  updateConversationTitle: (id: string, title: string) => void

  activeConversationId: string | null
  setActiveConversationId: (id: string | null) => void

  messages: Message[]
  setMessages: (msgs: Message[]) => void
  addMessage: (msg: Message) => void
  updateMessage: (id: string, updates: Partial<Message>) => void

  isStreaming: boolean
  setIsStreaming: (v: boolean) => void

  // Evidence focus
  activeSource: SourceReference | null
  setActiveSource: (source: SourceReference | null) => void

  // Mobile panels
  activeMobileTab: 'documents' | 'research' | 'evidence'
  setActiveMobileTab: (tab: 'documents' | 'research' | 'evidence') => void

  // ─── Coding Mode ──────────────────────────────────────────────────────────
  // Projects (a project behaves like a repo)
  codingProjects: CodingProject[]
  setCodingProjects: (projects: CodingProject[]) => void
  addCodingProject: (project: CodingProject) => void
  updateCodingProject: (id: string, updates: Partial<CodingProject>) => void
  removeCodingProject: (id: string) => void

  codingProject: CodingProject | null
  setCodingProject: (project: CodingProject | null) => void

  // Folders (nestable within a project)
  codingFolders: CodingFolder[]
  setCodingFolders: (folders: CodingFolder[]) => void
  addCodingFolder: (folder: CodingFolder) => void
  updateCodingFolder: (id: string, updates: Partial<CodingFolder>) => void
  removeCodingFolder: (id: string) => void

  expandedFolderIds: string[]
  toggleFolderExpanded: (id: string) => void
  setFolderExpanded: (id: string, expanded: boolean) => void

  codingFiles: CodingFile[]
  setCodingFiles: (files: CodingFile[]) => void
  addCodingFile: (file: CodingFile) => void
  updateCodingFile: (id: string, updates: Partial<CodingFile>) => void
  removeCodingFile: (id: string) => void

  activeCodingFileId: string | null
  setActiveCodingFileId: (id: string | null) => void

  // Open editor tabs (file ids in the order they were opened).
  openCodingFileIds: string[]
  closeCodingFile: (id: string) => void

  codingMessages: CodingMessage[]
  setCodingMessages: (msgs: CodingMessage[]) => void
  addCodingMessage: (msg: CodingMessage) => void

  isCodingStreaming: boolean
  setIsCodingStreaming: (v: boolean) => void

  learningMode: boolean
  setLearningMode: (v: boolean) => void

  // A quick action queued from the editor toolbar. The assistant panel consumes
  // it once mounted — this survives the mobile tab switch where the assistant
  // is not rendered at dispatch time.
  pendingCodingAction: CodingActionId | null
  setPendingCodingAction: (action: CodingActionId | null) => void
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  mode: 'study',
  setMode: (mode) => set({ mode }),

  documents: [],
  selectedDocumentIds: [],
  setDocuments: (docs) => set({ documents: docs }),
  addDocument: (doc) =>
    set((state) => ({ documents: [doc, ...state.documents] })),
  updateDocument: (id, updates) =>
    set((state) => ({
      documents: state.documents.map((d) =>
        d.id === id ? { ...d, ...updates } : d
      ),
    })),
  removeDocument: (id) =>
    set((state) => ({
      documents: state.documents.filter((d) => d.id !== id),
      selectedDocumentIds: state.selectedDocumentIds.filter((sid) => sid !== id),
    })),
  toggleDocumentSelection: (id) =>
    set((state) => ({
      // Allow multiple document selection with toggle behavior
      selectedDocumentIds: state.selectedDocumentIds.includes(id)
        ? state.selectedDocumentIds.filter((sid) => sid !== id)
        : [...state.selectedDocumentIds, id],
    })),
  selectDocument: (id) => set({ selectedDocumentIds: [id] }),
  clearSelection: () => set({ selectedDocumentIds: [] }),

  currentResult: null,
  setCurrentResult: (result) => set({ currentResult: result }),
  isQuerying: false,
  setIsQuerying: (v) => set({ isQuerying: v }),

  queryHistory: [],
  setQueryHistory: (items) => set({ queryHistory: items }),
  addQueryToHistory: (item) =>
    set((state) => ({ queryHistory: [item, ...state.queryHistory] })),
  removeQueryFromHistory: (id) =>
    set((state) => ({
      queryHistory: state.queryHistory.filter((q) => q.id !== id),
    })),

  conversations: [],
  setConversations: (convs) => set({ conversations: convs }),
  addConversation: (conv) =>
    set((state) => ({ conversations: [conv, ...state.conversations] })),
  removeConversation: (id) =>
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== id),
      activeConversationId:
        state.activeConversationId === id ? null : state.activeConversationId,
      messages: state.activeConversationId === id ? [] : state.messages,
    })),
  updateConversationTitle: (id, title) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, title } : c
      ),
    })),

  activeConversationId: null,
  setActiveConversationId: (id) => set({ activeConversationId: id }),

  messages: [],
  setMessages: (msgs) => set({ messages: msgs }),
  addMessage: (msg) =>
    set((state) => ({ messages: [...state.messages, msg] })),
  updateMessage: (id, updates) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, ...updates } : m
      ),
    })),

  isStreaming: false,
  setIsStreaming: (v) => set({ isStreaming: v }),

  activeSource: null,
  setActiveSource: (source) => set({ activeSource: source }),

  activeMobileTab: 'research',
  setActiveMobileTab: (tab) => set({ activeMobileTab: tab }),

  // ─── Coding Mode ──────────────────────────────────────────────────────────
  codingProjects: [],
  setCodingProjects: (projects) => set({ codingProjects: projects }),
  addCodingProject: (project) =>
    set((state) => ({ codingProjects: [project, ...state.codingProjects] })),
  updateCodingProject: (id, updates) =>
    set((state) => ({
      codingProjects: state.codingProjects.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
      codingProject:
        state.codingProject?.id === id
          ? { ...state.codingProject, ...updates }
          : state.codingProject,
    })),
  removeCodingProject: (id) =>
    set((state) => ({
      codingProjects: state.codingProjects.filter((p) => p.id !== id),
    })),

  codingProject: null,
  setCodingProject: (project) => set({ codingProject: project }),

  codingFolders: [],
  setCodingFolders: (folders) => set({ codingFolders: folders }),
  addCodingFolder: (folder) =>
    set((state) => ({
      codingFolders: [...state.codingFolders, folder],
      expandedFolderIds: folder.parent_id
        ? Array.from(new Set([...state.expandedFolderIds, folder.parent_id]))
        : state.expandedFolderIds,
    })),
  updateCodingFolder: (id, updates) =>
    set((state) => ({
      codingFolders: state.codingFolders.map((f) =>
        f.id === id ? { ...f, ...updates } : f
      ),
    })),
  removeCodingFolder: (id) =>
    set((state) => {
      // Cascade delete: collect this folder and all descendants.
      const toRemove = new Set<string>([id])
      let changed = true
      while (changed) {
        changed = false
        for (const f of state.codingFolders) {
          if (f.parent_id && toRemove.has(f.parent_id) && !toRemove.has(f.id)) {
            toRemove.add(f.id)
            changed = true
          }
        }
      }
      const removedFileActive = state.codingFiles.some(
        (f) => f.id === state.activeCodingFileId && f.folder_id && toRemove.has(f.folder_id)
      )
      const removedFileIds = new Set(
        state.codingFiles
          .filter((f) => f.folder_id && toRemove.has(f.folder_id))
          .map((f) => f.id)
      )
      return {
        codingFolders: state.codingFolders.filter((f) => !toRemove.has(f.id)),
        codingFiles: state.codingFiles.filter(
          (f) => !(f.folder_id && toRemove.has(f.folder_id))
        ),
        openCodingFileIds: state.openCodingFileIds.filter((fid) => !removedFileIds.has(fid)),
        activeCodingFileId: removedFileActive ? null : state.activeCodingFileId,
      }
    }),

  expandedFolderIds: [],
  toggleFolderExpanded: (id) =>
    set((state) => ({
      expandedFolderIds: state.expandedFolderIds.includes(id)
        ? state.expandedFolderIds.filter((fid) => fid !== id)
        : [...state.expandedFolderIds, id],
    })),
  setFolderExpanded: (id, expanded) =>
    set((state) => ({
      expandedFolderIds: expanded
        ? Array.from(new Set([...state.expandedFolderIds, id]))
        : state.expandedFolderIds.filter((fid) => fid !== id),
    })),

  codingFiles: [],
  setCodingFiles: (files) => set({ codingFiles: files }),
  addCodingFile: (file) =>
    set((state) => ({
      codingFiles: [...state.codingFiles, file],
      expandedFolderIds: file.folder_id
        ? Array.from(new Set([...state.expandedFolderIds, file.folder_id]))
        : state.expandedFolderIds,
    })),
  updateCodingFile: (id, updates) =>
    set((state) => ({
      codingFiles: state.codingFiles.map((f) =>
        f.id === id ? { ...f, ...updates } : f
      ),
    })),
  removeCodingFile: (id) =>
    set((state) => ({
      codingFiles: state.codingFiles.filter((f) => f.id !== id),
      openCodingFileIds: state.openCodingFileIds.filter((fid) => fid !== id),
      activeCodingFileId:
        state.activeCodingFileId === id ? null : state.activeCodingFileId,
    })),

  activeCodingFileId: null,
  setActiveCodingFileId: (id) =>
    set((state) => ({
      activeCodingFileId: id,
      // Opening a file adds it to the tab strip if not already present.
      openCodingFileIds:
        id && !state.openCodingFileIds.includes(id)
          ? [...state.openCodingFileIds, id]
          : state.openCodingFileIds,
    })),

  openCodingFileIds: [],
  closeCodingFile: (id) =>
    set((state) => {
      const remaining = state.openCodingFileIds.filter((fid) => fid !== id)
      let nextActive = state.activeCodingFileId
      if (state.activeCodingFileId === id) {
        // Focus the neighbouring tab (prefer the one to the left).
        const idx = state.openCodingFileIds.indexOf(id)
        nextActive = remaining[idx - 1] ?? remaining[idx] ?? remaining[remaining.length - 1] ?? null
      }
      return { openCodingFileIds: remaining, activeCodingFileId: nextActive }
    }),

  codingMessages: [],
  setCodingMessages: (msgs) => set({ codingMessages: msgs }),
  addCodingMessage: (msg) =>
    set((state) => ({ codingMessages: [...state.codingMessages, msg] })),

  isCodingStreaming: false,
  setIsCodingStreaming: (v) => set({ isCodingStreaming: v }),

  learningMode: false,
  setLearningMode: (v) => set({ learningMode: v }),

  pendingCodingAction: null,
  setPendingCodingAction: (action) => set({ pendingCodingAction: action }),
}))
