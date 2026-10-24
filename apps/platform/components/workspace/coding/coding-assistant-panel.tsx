'use client'

import { useEffect, useRef, useState } from 'react'
import { useWorkspaceStore } from '@/lib/store'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { UpgradeDialog, type RequiredPlan } from '../upgrade-dialog'
import { CODING_ACTIONS } from '@/lib/coding/prompts'
import { cn } from '@/lib/utils'
import { Button } from '@zequel/ui/components/button'
import { Switch } from '@zequel/ui/components/switch'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@zequel/ui/components/dropdown-menu'
import { Bot, Send, Loader2, FileText, Paperclip, FileCode2, X, GraduationCap } from 'lucide-react'
import { FileIcon } from './file-icon'
import type { CodingActionId, CodingMessage } from '@zequel/types'

export interface CodingAssistantHandle {
  runAction: (action: CodingActionId) => void
}

export function CodingAssistantPanel() {
  const {
    codingProject,
    codingFiles,
    codingFolders,
    activeCodingFileId,
    codingMessages,
    addCodingMessage,
    learningMode,
    setLearningMode,
    isCodingStreaming,
    setIsCodingStreaming,
    documents,
    pendingCodingAction,
    setPendingCodingAction,
  } = useWorkspaceStore()

  const [input, setInput] = useState('')
  const [streamingContent, setStreamingContent] = useState('')
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([])
  const [attachedFileIds, setAttachedFileIds] = useState<string[]>([])
  const [upgrade, setUpgrade] = useState<{ open: boolean; plan: RequiredPlan; message?: string }>({
    open: false,
    plan: 'premium_pro',
  })

  const scrollRef = useRef<HTMLDivElement>(null)
  const bufferRef = useRef('')
  // Coalesce token updates into one render per animation frame so the UI stays
  // responsive and the text streams in smoothly instead of in rough bursts.
  const rafRef = useRef<number | null>(null)

  const flushStreamingContent = () => {
    rafRef.current = null
    setStreamingContent(bufferRef.current)
  }

  const scheduleStreamingUpdate = () => {
    if (rafRef.current !== null) return
    rafRef.current = requestAnimationFrame(flushStreamingContent)
  }

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  useEffect(() => {
    // Use instant scrolling while tokens stream in (smooth scroll repeatedly
    // interrupts itself and looks janky); ease only on completed messages.
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: isCodingStreaming ? 'auto' : 'smooth',
    })
  }, [codingMessages, streamingContent, isCodingStreaming])

  // Consume a quick action queued from the editor toolbar (works across the
  // mobile tab switch because it lives in the store, not a transient event).
  useEffect(() => {
    if (pendingCodingAction && !isCodingStreaming && codingProject) {
      const action = pendingCodingAction
      setPendingCodingAction(null)
      void send(undefined, action)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCodingAction, isCodingStreaming, codingProject])

  // Builds the full slash-path of a file using the folder hierarchy, so the AI
  // understands where each file lives within the project.
  const filePath = (folderId: string | null, name: string): string => {
    const parts: string[] = [name]
    let current = folderId
    const guard = new Set<string>()
    while (current && !guard.has(current)) {
      guard.add(current)
      const folder = codingFolders.find((f) => f.id === current)
      if (!folder) break
      parts.unshift(folder.name)
      current = folder.parent_id
    }
    return parts.join('/')
  }

  const send = async (text?: string, action?: CodingActionId) => {
    if (!codingProject || isCodingStreaming) return
    const message = (text ?? input).trim()
    if (!message && !action) return

    // Optimistically render the user's turn.
    const attachedNames = codingFiles
      .filter((f) => attachedFileIds.includes(f.id))
      .map((f) => filePath(f.folder_id, f.name))
    const attachSuffix = attachedNames.length
      ? `\n\n${attachedNames.map((n) => `@${n}`).join(' ')}`
      : ''
    const userLabel = action
      ? `[Action] ${CODING_ACTIONS[action].label}${attachSuffix}`
      : `${message}${attachSuffix}`
    addCodingMessage({
      id: crypto.randomUUID(),
      project_id: codingProject.id,
      role: 'user',
      content: userLabel,
      created_at: new Date().toISOString(),
    })
    if (!action) setInput('')

    const activeFile = codingFiles.find((f) => f.id === activeCodingFileId)
    // Only send editable text files to the model. Uploaded binary assets
    // (images, etc.) have no useful text content, so we send a short
    // placeholder noting they exist instead of empty bodies.
    const projectFiles = codingFiles.map((f) => ({
      name: filePath(f.folder_id, f.name),
      language: f.language,
      content:
        f.kind === 'upload'
          ? `[uploaded ${f.mime_type || 'binary'} asset - not shown]`
          : f.content,
    }))

    // Files the user explicitly attached for this turn so the AI focuses on them.
    const attachedFiles = codingFiles
      .filter((f) => attachedFileIds.includes(f.id))
      .map((f) => filePath(f.folder_id, f.name))

    setIsCodingStreaming(true)
    setStreamingContent('')
    bufferRef.current = ''

    try {
      const res = await fetch('/api/coding/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: codingProject.id,
          message: action ? undefined : message,
          active_file_id: activeFile?.id ?? null,
          active_file_name: activeFile ? filePath(activeFile.folder_id, activeFile.name) : null,
          active_language: activeFile?.language,
          active_file_content: activeFile?.content ?? null,
          project_files: projectFiles,
          attached_files: attachedFiles,
          document_ids: selectedDocIds,
          action: action ?? null,
          learning_mode: learningMode,
        }),
      })

      if (!res.ok) {
        let errData: { error?: string; upgradeRequired?: boolean; requiredPlan?: string } | null = null
        try {
          errData = await res.json()
        } catch {
          /* ignore */
        }
        if (res.status === 403 && errData?.upgradeRequired) {
          setUpgrade({
            open: true,
            plan: (errData.requiredPlan as RequiredPlan) || 'premium_pro',
            message: errData.error,
          })
          return
        }
        throw new Error(errData?.error || `API error: ${res.status}`)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No stream')
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              if (parsed.content) {
                bufferRef.current += parsed.content
                scheduleStreamingUpdate()
              }
            } catch {
              /* skip */
            }
          }
        }
      }

      const final = bufferRef.current.trim()
      if (final) {
        addCodingMessage({
          id: crypto.randomUUID(),
          project_id: codingProject.id,
          role: 'assistant',
          content: final,
          created_at: new Date().toISOString(),
        })
      }
    } catch (err) {
      addCodingMessage({
        id: crypto.randomUUID(),
        project_id: codingProject.id,
        role: 'assistant',
        content:
          err instanceof Error && err.message && !err.message.startsWith('API error')
            ? err.message
            : 'An error occurred while processing your request. Please try again.',
        created_at: new Date().toISOString(),
      })
    } finally {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      setIsCodingStreaming(false)
      setStreamingContent('')
      bufferRef.current = ''
      setAttachedFileIds([])
    }
  }

  const parsedDocs = documents.filter((d) => d.status === 'parsed')

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-2 px-4 py-3">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-foreground" />
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-foreground">
            Coding Assistant
          </span>
        </div>

        {/* Learning Mode toggle */}
        <label className="flex shrink-0 cursor-pointer items-center gap-2">
          <GraduationCap
            className={cn(
              'h-3.5 w-3.5',
              learningMode ? 'text-foreground' : 'text-muted-foreground'
            )}
          />
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Learning Mode
          </span>
          <Switch checked={learningMode} onCheckedChange={setLearningMode} />
        </label>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto border-t border-border px-4 py-4">
        {codingMessages.length === 0 && !streamingContent ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-5">
            {codingMessages.map((msg: CodingMessage) => (
              <MessageBubble key={msg.id} role={msg.role} content={msg.content} />
            ))}
            {streamingContent && <MessageBubble role="assistant" content={streamingContent} />}
            {isCodingStreaming && !streamingContent && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span className="font-sans text-xs">Thinking...</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-border p-3">
        {/* Attach context: project files + parsed documents */}
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground">
                <FileCode2 className="h-3 w-3" />
                Files
                {attachedFileIds.length > 0 && (
                  <span className="rounded bg-foreground px-1 text-background">
                    {attachedFileIds.length}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-72 w-64 overflow-y-auto">
              <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-wider">
                Attach project files
              </DropdownMenuLabel>
              {codingFiles.length === 0 ? (
                <div className="px-2 py-1.5 font-sans text-xs text-muted-foreground">
                  No files yet
                </div>
              ) : (
                codingFiles.map((file) => (
                  <DropdownMenuCheckboxItem
                    key={file.id}
                    checked={attachedFileIds.includes(file.id)}
                    onCheckedChange={(checked) =>
                      setAttachedFileIds((prev) =>
                        checked ? [...prev, file.id] : prev.filter((id) => id !== file.id)
                      )
                    }
                    className="gap-2 font-sans text-xs"
                  >
                    <FileIcon fileName={file.name} size={14} />
                    <span className="truncate">{filePath(file.folder_id, file.name)}</span>
                  </DropdownMenuCheckboxItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {parsedDocs.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground">
                  <Paperclip className="h-3 w-3" />
                  Docs
                  {selectedDocIds.length > 0 && (
                    <span className="rounded bg-foreground px-1 text-background">
                      {selectedDocIds.length}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-60">
                <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-wider">
                  Attach as context
                </DropdownMenuLabel>
                {parsedDocs.map((doc) => (
                  <DropdownMenuCheckboxItem
                    key={doc.id}
                    checked={selectedDocIds.includes(doc.id)}
                    onCheckedChange={(checked) =>
                      setSelectedDocIds((prev) =>
                        checked ? [...prev, doc.id] : prev.filter((id) => id !== doc.id)
                      )
                    }
                    className="gap-2 font-sans text-xs"
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{doc.title}</span>
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Attached file chips */}
          {attachedFileIds.map((id) => {
            const file = codingFiles.find((f) => f.id === id)
            if (!file) return null
            return (
              <span
                key={id}
                className="flex items-center gap-1 rounded border border-border bg-secondary/40 px-1.5 py-0.5 font-mono text-[10px] text-foreground"
              >
                <FileIcon fileName={file.name} size={12} />
                <span className="max-w-[120px] truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => setAttachedFileIds((prev) => prev.filter((x) => x !== id))}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )
          })}
        </div>

        <div className="flex items-end gap-2 rounded-lg border border-border bg-secondary/30 p-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send()
              }
            }}
            placeholder={
              learningMode
                ? 'Ask for a hint or explain a concept...'
                : 'Ask about your code, request changes...'
            }
            rows={1}
            disabled={isCodingStreaming}
            className="max-h-32 min-h-[36px] flex-1 resize-none bg-transparent px-1 py-1.5 font-sans text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
          />
          <Button
            onClick={() => void send()}
            disabled={isCodingStreaming || !input.trim()}
            size="icon"
            className="h-8 w-8 shrink-0 rounded-md bg-foreground text-background hover:bg-foreground/90"
            aria-label="Send message"
          >
            {isCodingStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <UpgradeDialog
        open={upgrade.open}
        onOpenChange={(open) => setUpgrade((u) => ({ ...u, open }))}
        featureName="Coding Mode"
        requiredPlan={upgrade.plan}
        message={upgrade.message}
      />
    </div>
  )
}

function MessageBubble({ role, content }: { role: string; content: string }) {
  const isUser = role === 'user'
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[92%] rounded-lg px-3 py-2',
          isUser
            ? 'bg-secondary font-sans text-sm text-foreground'
            : 'w-full bg-transparent'
        )}
      >
        {isUser ? (
          <span className="whitespace-pre-wrap break-words">{content}</span>
        ) : (
          <MarkdownRenderer content={content} />
        )}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border">
        <Bot className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="max-w-[240px]">
        <p className="font-sans text-sm font-medium text-foreground">
          Your AI coding companion
        </p>
        <p className="mt-1 font-sans text-xs leading-relaxed text-muted-foreground">
          Ask questions about your code, use the quick actions above the editor, or enable Learning
          Mode to get guided hints instead of full answers.
        </p>
      </div>
    </div>
  )
}
