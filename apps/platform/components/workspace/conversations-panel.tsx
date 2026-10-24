'use client'

import { useState, useRef, useEffect } from 'react'
import { Separator } from '@zequel/ui/components/separator'
import { Button } from '@zequel/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@zequel/ui/components/dropdown-menu'
import { useWorkspaceStore } from '@/lib/store'
import { createClient } from '@zequel/shared/supabase/client'
import { cn } from '@/lib/utils'
import {
  Plus,
  MessageSquare,
  Trash2,
  FileText,
  Pencil,
  MoreVertical,
  Check,
  X,
  GitBranch,
} from 'lucide-react'
import type { Conversation } from '@zequel/types'
import { mapMessageRow } from '@zequel/types'

export function ConversationsPanel() {
  const {
    conversations,
    activeConversationId,
    setActiveConversationId,
    addConversation,
    removeConversation,
    updateConversationTitle,
    setMessages,
    selectedDocumentIds,
  } = useWorkspaceStore()

  const loadConversation = async (conv: Conversation) => {
    setActiveConversationId(conv.id)
    const supabase = createClient()
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true })
    setMessages((data || []).map(mapMessageRow))
  }

  const startNewConversation = async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('conversations')
      .insert({
        user_id: user.id,
        title: 'New conversation',
        document_id: selectedDocumentIds[0] || null,
      })
      .select()
      .single()

    if (error || !data) return

    addConversation(data as Conversation)
    setActiveConversationId(data.id)
    setMessages([])
  }

  const deleteConversation = async (id: string) => {
    const supabase = createClient()
    await supabase.from('conversations').delete().eq('id', id)
    removeConversation(id)
  }

  const handleRename = async (id: string, newTitle: string) => {
    updateConversationTitle(id, newTitle)
    const supabase = createClient()
    await supabase
      .from('conversations')
      .update({ title: newTitle })
      .eq('id', id)
  }

  const grouped = groupConversations(conversations)

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 px-4 py-3">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-foreground">
          Recent Chats
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {conversations.length}
        </span>
        <div className="flex-1" />
        <Button
          onClick={startNewConversation}
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 rounded-md border-border font-mono text-[10px] uppercase tracking-wider"
        >
          <Plus className="h-3 w-3" />
          New
        </Button>
      </div>
      <Separator className="shrink-0" />

      {/* Conversation List */}
      <div
        className="min-h-0 flex-1 overflow-y-auto"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-16">
            <MessageSquare className="h-5 w-5 text-muted-foreground/40" />
            <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              No conversations yet
            </p>
            <p className="mt-1 text-center font-sans text-xs text-muted-foreground/60">
              Start a new conversation in Study Mode.
            </p>
          </div>
        ) : (
          <div className="px-3 py-2">
            {grouped.map((group) => (
              <div key={group.label} className="mb-3">
                <p className="mb-1.5 px-1 font-mono text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                  {group.label}
                </p>
                {group.items.map((conv) => (
                  <ConversationRow
                    key={conv.id}
                    conversation={conv}
                    isActive={conv.id === activeConversationId}
                    onClick={() => loadConversation(conv)}
                    onDelete={() => deleteConversation(conv.id)}
                    onRename={(newTitle) => handleRename(conv.id, newTitle)}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ConversationRow({
  conversation,
  isActive,
  onClick,
  onDelete,
  onRename,
}: {
  conversation: Conversation
  isActive: boolean
  onClick: () => void
  onDelete: () => void
  onRename: (title: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(conversation.title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setEditValue(conversation.title)
  }, [conversation.title])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const save = () => {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== conversation.title) {
      onRename(trimmed)
    } else {
      setEditValue(conversation.title)
    }
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="mb-0.5 flex items-center gap-1 rounded-md bg-secondary/50 px-2 py-2">
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') {
              setEditValue(conversation.title)
              setEditing(false)
            }
          }}
          onBlur={save}
          className="min-w-0 flex-1 bg-transparent font-sans text-sm text-foreground outline-none"
        />
        <button
          onMouseDown={(e) => {
            e.preventDefault()
            save()
          }}
          className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"
        >
          <Check className="h-3 w-3" />
        </button>
        <button
          onMouseDown={(e) => {
            e.preventDefault()
            setEditValue(conversation.title)
            setEditing(false)
          }}
          className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'group mb-0.5 flex w-full items-start gap-2 rounded-md px-2 py-2 transition-colors',
        isActive
          ? 'bg-secondary text-foreground'
          : 'text-foreground/80 hover:bg-secondary/50'
      )}
    >
      {/* Clickable main area */}
      <button
        onClick={onClick}
        className="flex min-w-0 flex-1 items-start gap-2 text-left"
      >
        {conversation.title.startsWith('Branch from') ? (
          <GitBranch className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-sans text-sm font-medium">
            {conversation.title}
          </p>
          <div className="mt-0.5 flex items-center gap-2">
            {conversation.document_id && (
              <span className="flex items-center gap-0.5 font-mono text-[9px] text-muted-foreground">
                <FileText className="h-2.5 w-2.5" />
                Doc
              </span>
            )}
            <span className="font-mono text-[9px] text-muted-foreground/60">
              {new Date(conversation.updated_at).toLocaleDateString(
                undefined,
                { month: 'short', day: 'numeric' }
              )}
            </span>
          </div>
        </div>
      </button>

      {/* Always-visible 3-dot menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:text-foreground focus-visible:text-foreground data-[state=open]:text-foreground"
            aria-label={`Options for ${conversation.title}`}
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="min-w-[140px] border-border bg-background"
        >
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation()
              setEditValue(conversation.title)
              setEditing(true)
            }}
            className="gap-2 font-mono text-[11px] uppercase tracking-wider text-foreground focus:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="gap-2 font-mono text-[11px] uppercase tracking-wider text-destructive focus:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function groupConversations(conversations: Conversation[]) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const weekAgo = new Date(today.getTime() - 7 * 86400000)

  const groups: { label: string; items: Conversation[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'This Week', items: [] },
    { label: 'Older', items: [] },
  ]

  for (const conv of conversations) {
    const d = new Date(conv.updated_at)
    if (d >= today) {
      groups[0].items.push(conv)
    } else if (d >= yesterday) {
      groups[1].items.push(conv)
    } else if (d >= weekAgo) {
      groups[2].items.push(conv)
    } else {
      groups[3].items.push(conv)
    }
  }

  return groups.filter((g) => g.items.length > 0)
}
