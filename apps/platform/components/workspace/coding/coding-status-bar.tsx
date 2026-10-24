'use client'

import { useWorkspaceStore } from '@/lib/store'
import { useCodingIdeStore } from '@/lib/coding/coding-ide-store'
import { getLanguageMeta } from '@/lib/coding/languages'
import { GitBranch, AlertCircle, CheckCircle2, Terminal, Radio } from 'lucide-react'
import { cn } from '@/lib/utils'

export function CodingStatusBar() {
  const { codingFiles, activeCodingFileId } = useWorkspaceStore()
  const { runtimeStatus, cursorPosition, bottomDockOpen, toggleBottomDock } = useCodingIdeStore()

  const activeFile = codingFiles.find((f) => f.id === activeCodingFileId)

  return (
    <div className="flex h-6 shrink-0 items-center justify-between border-t border-border bg-background px-3 font-mono text-[10px] text-muted-foreground select-none">
      {/* Left side: Branch, Problems status, Runtime indicator */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 hover:text-foreground cursor-pointer">
          <GitBranch className="h-3 w-3" />
          <span>main</span>
        </div>

        <div className="flex items-center gap-1.5 hover:text-foreground cursor-pointer">
          <AlertCircle className="h-3 w-3 text-muted-foreground" />
          <span>0</span>
          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
          <span>0</span>
        </div>

        <button
          onClick={toggleBottomDock}
          className={cn(
            'flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-secondary hover:text-foreground',
            bottomDockOpen && 'bg-secondary text-foreground'
          )}
        >
          <Terminal className="h-3 w-3" />
          <span>Terminal</span>
        </button>
      </div>

      {/* Right side: Line/Col, 2 Spaces, UTF-8, LF, Language, Runtime */}
      <div className="flex items-center gap-3">
        {activeFile && (
          <>
            <div>
              Line:{cursorPosition.line} Col:{cursorPosition.col}
            </div>
            <div>2 Spaces</div>
            <div>UTF-8</div>
            <div>LF</div>
            <div className="hover:text-foreground cursor-pointer">
              {getLanguageMeta(activeFile.language).label}
            </div>
          </>
        )}

        <div className="flex items-center gap-1">
          <Radio
            className={cn(
              'h-3 w-3',
              runtimeStatus === 'ready' ? 'text-emerald-500 animate-pulse' : 'text-muted-foreground'
            )}
          />
          <span>{runtimeStatus === 'ready' ? 'Sandbox Connected' : 'Sandbox'}</span>
        </div>
      </div>
    </div>
  )
}
