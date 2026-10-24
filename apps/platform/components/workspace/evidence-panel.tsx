'use client'

import { Separator } from '@zequel/ui/components/separator'
import { useWorkspaceStore } from '@/lib/store'
import { X, BookOpen } from 'lucide-react'
import { Button } from '@zequel/ui/components/button'

export function EvidencePanel() {
  const { activeSource, setActiveSource, currentResult } = useWorkspaceStore()

  // Collect all sources from current result
  const allSources =
    currentResult?.blocks.flatMap((block) =>
      block.sources.map((s) => ({ ...s, blockTitle: block.title }))
    ) ?? []

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-foreground">
          Evidence
        </span>
        {activeSource && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={() => setActiveSource(null)}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
      <Separator />

      <div
        className="min-h-0 flex-1 overflow-y-auto"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="px-4 py-3">
          {/* Active source detail */}
          {activeSource ? (
            <div className="flex flex-col gap-4">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Source Document
                </span>
                <p className="mt-1 font-sans text-sm font-medium text-foreground">
                  {activeSource.document_title}
                </p>
              </div>
              <Separator />
              <div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Location
                </span>
                <p className="mt-1 font-mono text-xs text-foreground">
                  {'Page '}{activeSource.page}{' \u2014 '}{activeSource.section}
                </p>
              </div>
              <Separator />
              <div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Excerpt
                </span>
                <div className="mt-2 rounded-sm border-l-2 border-foreground pl-3">
                  <p className="font-sans text-sm leading-relaxed text-foreground">
                    {activeSource.excerpt}
                  </p>
                </div>
              </div>
            </div>
          ) : allSources.length > 0 ? (
            /* Source reference list */
            <div className="flex flex-col gap-0.5">
              <span className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Referenced Sources
              </span>
              {allSources.map((source, i) => (
                <button
                  key={i}
                  onClick={() => setActiveSource(source)}
                  className="flex items-start gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-secondary"
                >
                  <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 overflow-hidden">
                    <p className="truncate font-sans text-[13px] font-medium text-foreground">
                      {source.document_title}
                    </p>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {'Page '}{source.page}{' \u2014 '}{source.section}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            /* Empty state */
            <div className="py-16 text-center">
              <BookOpen className="mx-auto h-6 w-6 text-muted-foreground/50" />
              <p className="mt-3 font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
                Evidence Viewer
              </p>
              <p className="mt-2 font-sans text-xs text-muted-foreground/60">
                Click a source reference to view evidence context.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
