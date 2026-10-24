'use client'

import { useState } from 'react'
import { useWorkspaceStore } from '@/lib/store'
import { Input } from '@zequel/ui/components/input'
import { Button } from '@zequel/ui/components/button'
import { FileIcon } from './file-icon'
import { GitBranch, GitCommit, RefreshCw, Plus, Minus } from 'lucide-react'

export function CodingGitPanel() {
  const { codingFiles } = useWorkspaceStore()
  const [commitMessage, setCommitMessage] = useState('')
  const [isCommitting, setIsCommitting] = useState(false)
  const [stagedFiles, setStagedFiles] = useState<string[]>([])

  const unstagedFiles = codingFiles.filter((f) => !stagedFiles.includes(f.id))

  const handleStageAll = () => {
    setStagedFiles(codingFiles.map((f) => f.id))
  }

  const handleUnstageAll = () => {
    setStagedFiles([])
  }

  const handleCommit = () => {
    if (!commitMessage.trim()) return
    setIsCommitting(true)
    setTimeout(() => {
      setIsCommitting(false)
      setCommitMessage('')
      setStagedFiles([])
    }, 600)
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-foreground">
          Source Control
        </span>
        <div className="flex items-center gap-1">
          <button
            title="Refresh Status"
            className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 p-3">
        {/* Branch Info */}
        <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/30 px-2.5 py-1.5 font-mono text-xs">
          <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-foreground">main</span>
          <span className="ml-auto text-[10px] text-muted-foreground">Up to date</span>
        </div>

        {/* Commit Input */}
        <div className="flex flex-col gap-2">
          <Input
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder="Message (Ctrl+Enter to commit)"
            className="h-8 font-mono text-xs"
          />
          <Button
            onClick={handleCommit}
            disabled={isCommitting || !commitMessage.trim() || stagedFiles.length === 0}
            size="sm"
            className="h-8 bg-foreground font-mono text-[10px] uppercase tracking-wider text-background hover:bg-foreground/90 disabled:opacity-50"
          >
            <GitCommit className="mr-1.5 h-3.5 w-3.5" />
            {isCommitting ? 'Committing...' : 'Commit'}
          </Button>
        </div>
      </div>

      {/* Changes list */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {/* Staged Changes */}
        <div className="mb-4">
          <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <span>Staged Changes ({stagedFiles.length})</span>
            {stagedFiles.length > 0 && (
              <button onClick={handleUnstageAll} title="Unstage All" className="hover:text-foreground">
                <Minus className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="mt-1 flex flex-col gap-0.5">
            {stagedFiles.map((id) => {
              const file = codingFiles.find((f) => f.id === id)
              if (!file) return null
              return (
                <div key={id} className="flex items-center gap-2 rounded px-2 py-1 font-mono text-xs text-foreground hover:bg-secondary">
                  <FileIcon fileName={file.name} size={14} />
                  <span className="truncate">{file.name}</span>
                  <span className="ml-auto font-mono text-[10px] text-emerald-500">M</span>
                </div>
              )
            })}
            {stagedFiles.length === 0 && (
              <p className="py-2 font-sans text-xs text-muted-foreground">No staged changes.</p>
            )}
          </div>
        </div>

        {/* Unstaged Changes */}
        <div>
          <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <span>Changes ({unstagedFiles.length})</span>
            {unstagedFiles.length > 0 && (
              <button onClick={handleStageAll} title="Stage All" className="hover:text-foreground">
                <Plus className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="mt-1 flex flex-col gap-0.5">
            {unstagedFiles.map((file) => (
              <div
                key={file.id}
                onClick={() => setStagedFiles([...stagedFiles, file.id])}
                className="group flex cursor-pointer items-center gap-2 rounded px-2 py-1 font-mono text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <FileIcon fileName={file.name} size={14} />
                <span className="truncate">{file.name}</span>
                <span className="ml-auto font-mono text-[10px] text-amber-500">M</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
