import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Eye, GitBranch, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TraceGraph } from '@/lib/research/graph-types'
import type { IndexStats, ResearchSymbol } from '../../../electron/ipc-contract'
import { GraphCanvas } from './graph-canvas'
import { GraphSidebar } from './graph-sidebar'

type Phase = 'idle' | 'indexing' | 'ready' | 'error'

function symbolLabel(s: ResearchSymbol): string {
  const parent = s.parent ? s.parent.slice(s.parent.lastIndexOf('::') + 2) + '.' : ''
  return `${parent}${s.name}  ·  ${s.kind}  ·  ${s.path}`
}

/**
 * The Research codebase trace graph, backed by the Go indexer.
 *
 * Flow: (re)index the open project in the backend → list its symbols → trace
 * the chosen root symbol → render the returned `TraceGraph`. Contract roots
 * show contract-level relationships (inheritance, calls rolled up from member
 * functions, typed state variables); function roots show function-level
 * calls. Indexing re-runs each time this view opens, so edits saved in the
 * editor are picked up (there is no filesystem watcher yet).
 */
export function GraphView({ projectRoot }: { projectRoot: string | null }) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [symbols, setSymbols] = useState<ResearchSymbol[]>([])
  const [stats, setStats] = useState<IndexStats | null>(null)
  const [rootId, setRootId] = useState('')
  const [depth, setDepth] = useState(1)
  const [graph, setGraph] = useState<TraceGraph | null>(null)

  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [onlyFlagged, setOnlyFlagged] = useState(false)

  const indexRun = useRef(0)

  const runIndex = useCallback(async () => {
    if (!projectRoot) return
    const run = ++indexRun.current
    setPhase('indexing')
    setError(null)
    try {
      const status = await window.zequel.research.index()
      const syms = await window.zequel.research.symbols('')
      if (run !== indexRun.current) return // a newer run superseded this one
      setStats(status.stats ?? null)
      setSymbols(syms)
      setRootId((prev) =>
        syms.some((s) => s.id === prev) ? prev : (syms.find((s) => s.kind !== 'function') ?? syms[0])?.id ?? ''
      )
      setPhase('ready')
    } catch (err) {
      if (run !== indexRun.current) return
      setError(err instanceof Error ? err.message : 'Indexing failed')
      setPhase('error')
    }
  }, [projectRoot])

  useEffect(() => {
    void runIndex()
  }, [runIndex])

  useEffect(() => {
    if (phase !== 'ready' || !rootId) {
      setGraph(null)
      return
    }
    let cancelled = false
    window.zequel.research
      .trace(rootId, depth)
      .then((g) => {
        if (cancelled) return
        setGraph(g)
        setSelectedId(null)
        setVisibleIds(new Set(g.nodes.map((n) => n.id)))
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Trace failed')
        setPhase('error')
      })
    return () => {
      cancelled = true
    }
  }, [phase, rootId, depth])

  const effectiveVisible = useMemo(() => {
    if (!graph || !onlyFlagged) return visibleIds
    return new Set(
      [...visibleIds].filter((id) => {
        const n = graph.nodes.find((x) => x.id === id)
        return n ? n.severity !== 'none' : false
      })
    )
  }, [graph, visibleIds, onlyFlagged])

  const toggleNode = (id: string) => {
    setVisibleIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const flaggedCount = graph ? graph.nodes.filter((n) => n.severity !== 'none').length : 0

  let emptyMessage: string | null = null
  if (!projectRoot) emptyMessage = 'Open a project folder in Explorer to analyze it.'
  else if (phase === 'indexing' || phase === 'idle') emptyMessage = 'Indexing project…'
  else if (phase === 'error') emptyMessage = error ?? 'Something went wrong.'
  else if (symbols.length === 0)
    emptyMessage =
      'No Solidity contracts found. lib/, node_modules/ and build output folders are skipped.'
  else if (!graph) emptyMessage = 'Tracing…'
  else if (graph.nodes.length === 0)
    emptyMessage = null // a valid root with no relationships still renders its canvas

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <GitBranch className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-foreground">
            Reference Trace
          </span>
          {symbols.length > 0 && (
            <select
              value={rootId}
              onChange={(e) => setRootId(e.target.value)}
              className="max-w-[420px] truncate rounded-md border border-border bg-background px-2 py-1 font-mono text-[11px] text-foreground"
              title="Root symbol"
            >
              {symbols.map((s) => (
                <option key={s.id} value={s.id}>
                  {symbolLabel(s)}
                </option>
              ))}
            </select>
          )}
          {stats && (
            <span className="hidden font-mono text-[10px] text-muted-foreground/60 md:inline">
              {stats.files} files · {stats.symbols} symbols · {stats.findings} findings
              {stats.truncated ? ' · truncated' : ''}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <label className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Depth
            <select
              value={depth}
              onChange={(e) => setDepth(Number(e.target.value))}
              className="rounded-md border border-border bg-background px-1.5 py-1 text-foreground"
            >
              {[1, 2, 3].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => setOnlyFlagged((v) => !v)}
            className={cn(
              'flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors',
              onlyFlagged
                ? 'border-destructive/40 bg-destructive/10 text-destructive'
                : 'border-border text-muted-foreground hover:text-foreground'
            )}
            title="Show only symbols with heuristic findings"
          >
            <AlertTriangle className="h-3 w-3" />
            Flagged ({flaggedCount})
          </button>
          <button
            onClick={() => graph && setVisibleIds(new Set(graph.nodes.map((n) => n.id)))}
            className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
            title="Show all symbols"
          >
            <Eye className="h-3 w-3" />
            Show All
          </button>
          <button
            onClick={() => void runIndex()}
            disabled={!projectRoot || phase === 'indexing'}
            className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
            title="Re-index the project"
          >
            <RefreshCw className={cn('h-3 w-3', phase === 'indexing' && 'animate-spin')} />
            Re-index
          </button>
        </div>
      </div>

      {emptyMessage || !graph ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center font-mono text-[11px] text-muted-foreground">
          {emptyMessage ?? ''}
        </div>
      ) : (
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
      )}
    </div>
  )
}
