'use client'

import { useMemo, useState } from 'react'
import { Search, X, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TraceDirection, TraceGraph, TraceNode } from '@/lib/research/graph-types'

interface GraphSidebarProps {
  graph: TraceGraph
  visibleIds: Set<string>
  onToggleNode: (id: string) => void
  selectedId: string | null
  onSelectNode: (id: string | null) => void
  onNewTrace: () => void
}

function severityDotClass(sev: TraceNode['severity']): string {
  switch (sev) {
    case 'critical':
      return 'bg-destructive'
    case 'warning':
      return 'bg-[var(--code-number)]'
    case 'info':
      return 'bg-[var(--code-type)]'
    default:
      return 'bg-muted-foreground/50'
  }
}

export function GraphSidebar({
  graph,
  visibleIds,
  onToggleNode,
  selectedId,
  onSelectNode,
  onNewTrace,
}: GraphSidebarProps) {
  const [direction, setDirection] = useState<TraceDirection>('outflows')
  const [filter, setFilter] = useState('')

  const nodes = useMemo(
    () =>
      graph.nodes
        .filter((n) => n.direction === direction)
        .filter((n) => n.label.toLowerCase().includes(filter.toLowerCase())),
    [graph.nodes, direction, filter]
  )

  const inflowCount = graph.nodes.filter((n) => n.direction === 'inflows').length
  const outflowCount = graph.nodes.filter((n) => n.direction === 'outflows').length

  return (
    <div className="flex h-full w-72 shrink-0 flex-col border-r border-border bg-background">
      {/* Root / viewing header */}
      <div className="shrink-0 border-b border-border px-4 py-3">
        <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Viewing</p>
        <p className="mt-0.5 truncate font-mono text-[13px] font-semibold text-foreground">
          {graph.root.label}
        </p>
        <p className="truncate font-mono text-[10px] text-muted-foreground/70">{graph.root.path}</p>
      </div>

      {/* Search */}
      <div className="shrink-0 border-b border-border px-3 py-2.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter related symbols…"
            className="h-8 w-full rounded-md border border-border bg-secondary/40 pl-8 pr-3 font-mono text-[11px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {/* Section label */}
      <div className="shrink-0 px-4 pb-2 pt-3">
        <p className="font-mono text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          Toggle Visible Nodes
        </p>
      </div>

      {/* Inflow / outflow tabs */}
      <div className="mx-3 mb-2 flex shrink-0 rounded-md bg-secondary/50 p-0.5">
        <button
          onClick={() => setDirection('inflows')}
          className={cn(
            'flex-1 rounded px-2 py-1.5 font-mono text-[10px] font-medium uppercase tracking-wider transition-colors',
            direction === 'inflows'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Inflows ({inflowCount})
        </button>
        <button
          onClick={() => setDirection('outflows')}
          className={cn(
            'flex-1 rounded px-2 py-1.5 font-mono text-[10px] font-medium uppercase tracking-wider transition-colors',
            direction === 'outflows'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Outflows ({outflowCount})
        </button>
      </div>

      {/* Node list */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {nodes.length === 0 ? (
          <p className="px-2 py-6 text-center font-mono text-[10px] text-muted-foreground/60">
            No {direction} match this filter.
          </p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {nodes.map((n) => {
              const visible = visibleIds.has(n.id)
              const selected = selectedId === n.id
              return (
                <button
                  key={n.id}
                  onClick={() => onSelectNode(selected ? null : n.id)}
                  className={cn(
                    'group flex items-center justify-between gap-2 rounded-md px-2 py-2 text-left transition-colors',
                    selected ? 'bg-secondary' : 'hover:bg-secondary/60'
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[11px] font-medium text-foreground">
                      {n.label}
                    </p>
                    <p className="truncate font-mono text-[9.5px] text-muted-foreground/70">
                      {n.metricValue} {n.metricUnit} · {n.kind}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className={cn('h-1.5 w-1.5 rounded-full', severityDotClass(n.severity))} />
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation()
                        onToggleNode(n.id)
                      }}
                      className={cn(
                        'flex h-5 w-5 items-center justify-center rounded transition-colors',
                        visible
                          ? 'text-destructive hover:bg-destructive/10'
                          : 'text-muted-foreground/40 hover:bg-secondary hover:text-foreground'
                      )}
                      title={visible ? 'Hide node' : 'Show node'}
                    >
                      {visible ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* New trace */}
      <div className="shrink-0 border-t border-border p-3">
        <button
          onClick={onNewTrace}
          className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-foreground font-mono text-[11px] font-medium uppercase tracking-wider text-background transition-colors hover:bg-foreground/90"
        >
          <Plus className="h-3.5 w-3.5" />
          New Trace
        </button>
      </div>
    </div>
  )
}
