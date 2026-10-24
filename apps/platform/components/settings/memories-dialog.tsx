'use client'

import { useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@zequel/ui/components/dialog'
import { Input } from '@zequel/ui/components/input'
import { Button } from '@zequel/ui/components/button'
import { ScrollArea } from '@zequel/ui/components/scroll-area'
import { Search, Trash2, Brain } from 'lucide-react'

export interface Memory {
  id: string
  content: string
}

interface MemoriesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  memories: Memory[]
  loading?: boolean
  onDelete?: (id: string) => void
  onDeleteAll?: () => void
}

export function MemoriesDialog({
  open,
  onOpenChange,
  memories,
  loading = false,
  onDelete,
  onDeleteAll,
}: MemoriesDialogProps) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return memories
    return memories.filter((m) => m.content.toLowerCase().includes(q))
  }, [memories, query])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="font-mono text-sm font-semibold uppercase tracking-wider">
            Saved Memories
          </DialogTitle>
          <DialogDescription className="font-sans text-[13px] leading-relaxed text-muted-foreground">
            Details Zequel has remembered to personalize your responses.
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="px-6 pt-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search memories"
              className="h-9 rounded-md border-border pl-9 font-sans text-sm"
            />
          </div>
        </div>

        {/* List */}
        <ScrollArea className="flex-1 px-6 py-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <p className="font-sans text-[13px] text-muted-foreground">Loading memories...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted/30">
                <Brain className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="font-sans text-[13px] text-muted-foreground">
                {memories.length === 0
                  ? 'No memories saved yet. As you chat, Zequel will remember useful details here.'
                  : 'No memories match your search.'}
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {filtered.map((memory) => (
                <li
                  key={memory.id}
                  className="group flex items-start justify-between gap-3 rounded-md border border-border bg-muted/30 p-3"
                >
                  <p className="font-sans text-[13px] leading-relaxed text-foreground">{memory.content}</p>
                  <button
                    type="button"
                    onClick={() => onDelete?.(memory.id)}
                    aria-label="Delete memory"
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>

        {/* Footer */}
        {memories.length > 0 && (
          <div className="border-t border-border px-6 py-3">
            <Button
              type="button"
              variant="ghost"
              onClick={onDeleteAll}
              className="w-full font-mono text-[11px] uppercase tracking-wider text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              Delete All
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
