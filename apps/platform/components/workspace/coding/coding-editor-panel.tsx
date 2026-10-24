'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@zequel/shared/supabase/client'
import { useWorkspaceStore } from '@/lib/store'
import { useCodingIdeStore } from '@/lib/coding/coding-ide-store'
import { CodeEditor } from './code-editor'
import { UploadPreview } from './upload-preview'
import { FileIcon } from './file-icon'
import { CodingBreadcrumbs } from './coding-breadcrumbs'
import { getLanguageMeta } from '@/lib/coding/languages'
import { CODING_ACTIONS } from '@/lib/coding/prompts'
import { cn } from '@/lib/utils'
import {
  FileCode2,
  Check,
  Loader2,
  ScanSearch,
  Bug,
  Wand2,
  Gauge,
  FileText,
  ClipboardCheck,
  FlaskConical,
  Zap,
  X,
} from 'lucide-react'
import type { CodingActionId, CodingFile } from '@zequel/types'

// Quick actions surfaced as toolbar buttons (analyze_project is shown separately).
const TOOLBAR_ACTIONS: { id: CodingActionId; icon: React.ReactNode }[] = [
  { id: 'explain', icon: <ScanSearch className="h-3.5 w-3.5" /> },
  { id: 'find_bugs', icon: <Bug className="h-3.5 w-3.5" /> },
  { id: 'refactor', icon: <Wand2 className="h-3.5 w-3.5" /> },
  { id: 'optimize', icon: <Gauge className="h-3.5 w-3.5" /> },
  { id: 'document', icon: <FileText className="h-3.5 w-3.5" /> },
  { id: 'review', icon: <ClipboardCheck className="h-3.5 w-3.5" /> },
  { id: 'generate_tests', icon: <FlaskConical className="h-3.5 w-3.5" /> },
  { id: 'improve_performance', icon: <Zap className="h-3.5 w-3.5" /> },
]

interface CodingEditorPanelProps {
  onAction: (action: CodingActionId) => void
}

export function CodingEditorPanel({ onAction }: CodingEditorPanelProps) {
  const {
    codingFiles,
    activeCodingFileId,
    setActiveCodingFileId,
    openCodingFileIds,
    closeCodingFile,
    updateCodingFile,
    isCodingStreaming,
  } = useWorkspaceStore()

  const activeFile = codingFiles.find((f) => f.id === activeCodingFileId) as
    | CodingFile
    | undefined

  // Files currently open as tabs, in open order, skipping any that were deleted.
  const openFiles = openCodingFileIds
    .map((id) => codingFiles.find((f) => f.id === id))
    .filter((f): f is CodingFile => Boolean(f))

  const isUpload = activeFile?.kind === 'upload'

  const { saveState, setSaveState } = useCodingIdeStore()
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced autosave to Supabase whenever the file content changes.
  const persist = (fileId: string, content: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveState('saving')
    saveTimer.current = setTimeout(async () => {
      const supabase = createClient()
      await supabase
        .from('coding_files')
        .update({ content, updated_at: new Date().toISOString() })
        .eq('id', fileId)
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 1500)
    }, 800)
  }

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [])

  const handleChange = (value: string) => {
    if (!activeFile) return
    updateCodingFile(activeFile.id, { content: value })
    persist(activeFile.id, value)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Open file tabs */}
      {openFiles.length > 0 && (
        <div className="flex shrink-0 items-center overflow-x-auto border-b border-border">
          {openFiles.map((file) => {
            const isActive = file.id === activeCodingFileId
            return (
              <div
                key={file.id}
                role="button"
                tabIndex={0}
                onClick={() => setActiveCodingFileId(file.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setActiveCodingFileId(file.id)
                  }
                }}
                onAuxClick={(e) => {
                  // Middle-click closes the tab.
                  if (e.button === 1) {
                    e.preventDefault()
                    closeCodingFile(file.id)
                  }
                }}
                className={cn(
                  'group flex shrink-0 cursor-pointer items-center gap-2 border-r border-border px-3 py-2 font-mono text-xs transition-colors',
                  isActive
                    ? 'bg-background text-foreground'
                    : 'bg-secondary/30 text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                )}
              >
                <FileIcon fileName={file.name} size={14} />
                <span className="max-w-[140px] truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    closeCodingFile(file.id)
                  }}
                  aria-label={`Close ${file.name}`}
                  className={cn(
                    'flex h-4 w-4 items-center justify-center rounded transition-colors hover:bg-secondary hover:text-foreground',
                    isActive ? 'opacity-70' : 'opacity-0 group-hover:opacity-70'
                  )}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Breadcrumbs bar */}
      <CodingBreadcrumbs />

      {/* Quick action toolbar */}
      <div className="flex shrink-0 items-center gap-1 overflow-x-auto px-4 pb-2">
        {TOOLBAR_ACTIONS.map(({ id, icon }) => (
          <button
            key={id}
            disabled={!activeFile || isUpload || isCodingStreaming}
            onClick={() => onAction(id)}
            title={CODING_ACTIONS[id].label}
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-secondary/40 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {icon}
            <span className="hidden sm:inline">{CODING_ACTIONS[id].label}</span>
          </button>
        ))}
        <button
          disabled={isCodingStreaming}
          onClick={() => onAction('analyze_project')}
          title={CODING_ACTIONS.analyze_project.label}
          className="ml-auto flex shrink-0 items-center gap-1.5 rounded-md bg-foreground px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-background transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ScanSearch className="h-3.5 w-3.5" />
          Analyze Project
        </button>
      </div>

      {/* Editor surface */}
      <div className="min-h-0 flex-1 overflow-hidden border-t border-border">
        {activeFile ? (
          isUpload ? (
            <UploadPreview key={activeFile.id} file={activeFile} />
          ) : (
            <CodeEditor
              key={activeFile.id}
              value={activeFile.content}
              language={activeFile.language}
              onChange={handleChange}
            />
          )
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="font-sans text-sm text-muted-foreground">
              Select or create a file to start coding.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
