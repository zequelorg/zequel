'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, Eye, GitBranch } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sampleTraceGraph } from '@/lib/research/graph-fixture'
import { GraphCanvas } from './graph-canvas'
import { GraphSidebar } from './graph-sidebar'

/**
 * The Research codebase trace graph.
 *
 * Consumes a `TraceGraph` (see lib/research/graph-types.ts) and renders it as
 * an interactive reference graph: one root symbol, its callers/callees fanned
 * out around it, connected by curved trace lines. Currently reads from a
 * fixture built by hand from a real trace in this repository — see
 * lib/research/graph-fixture.ts for why, and what replaces it.
 */
export function GraphView() {
  const graph = sampleTraceGraph
  const [visibleIds, setVisibleIds] = useState<Set<string>>(
    () => new Set(graph.nodes.map((n) => n.id))
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [onlyFlagged, setOnlyFlagged] = useState(false)

  const effectiveVisible = useMemo(() => {
    if (!onlyFlagged) return visibleIds
    return new Set(
      [...visibleIds].filter((id) => {
        const n = graph.nodes.find((x) => x.id === id)
        return n ? n.severity !== 'none' : false
      })
    )
  }, [visibleIds, onlyFlagged, graph.nodes])

  const toggleNode = (id: string) => {
    setVisibleIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const flaggedCount = graph.nodes.filter((n) => n.severity !== 'none').length

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-2">
        <div className="flex items-center gap-2">
          <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-foreground">
            Reference Trace
          </span>
          <span className="font-mono text-[10px] text-muted-foreground/60">
            {graph.nodes.length} related symbols
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setOnlyFlagged((v) => !v)}
            className={cn(
              'flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors',
              onlyFlagged
                ? 'border-destructive/40 bg-destructive/10 text-destructive'
                : 'border-border text-muted-foreground hover:text-foreground'
            )}
            title="Show only flagged symbols"
          >
            <AlertTriangle className="h-3 w-3" />
            Flagged ({flaggedCount})
          </button>
          <button
            onClick={() => setVisibleIds(new Set(graph.nodes.map((n) => n.id)))}
            className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
            title="Show all symbols"
          >
            <Eye className="h-3 w-3" />
            Show All
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        <GraphSidebar
          graph={graph}
          visibleIds={visibleIds}
          onToggleNode={toggleNode}
          selectedId={selectedId}
          onSelectNode={setSelectedId}
          onNewTrace={() => {
            setSelectedId(null)
            setVisibleIds(new Set(graph.nodes.map((n) => n.id)))
          }}
        />
        <div className="min-w-0 flex-1">
          <GraphCanvas
            graph={graph}
            visibleIds={effectiveVisible}
            selectedId={selectedId}
            onSelectNode={setSelectedId}
          />
        </div>
      </div>
    </div>
  )
}
