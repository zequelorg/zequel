import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ResearchFinding } from '../../electron/ipc-contract'

type Phase = 'idle' | 'loading' | 'ready' | 'error'
type Severity = ResearchFinding['severity']

const RANK: Record<Severity, number> = { critical: 3, warning: 2, info: 1 }
const MIN_OPTIONS: Array<{ label: string; min: number }> = [
  { label: 'All', min: 1 },
  { label: 'Warnings +', min: 2 },
  { label: 'Critical', min: 3 },
]

function dotClass(sev: Severity): string {
  switch (sev) {
    case 'critical':
      return 'bg-destructive'
    case 'warning':
      return 'bg-[var(--code-number)]'
    default:
      return 'bg-[var(--code-type)]'
  }
}

// "src/Vault.sol::Vault.withdraw/1" -> "Vault.withdraw"
function symbolName(symbolId: string): string {
  const afterPath = symbolId.slice(symbolId.lastIndexOf('::') + 2)
  return afterPath.replace(/\/\d+(@\d+)?$/, '')
}

interface FindingsPanelProps {
  projectRoot: string | null
  // Bumped by the parent after each save; the panel re-indexes (debounced).
  refreshToken: number
  onOpen: (path: string, line: number) => void
}

/**
 * Lists the indexer's heuristic findings grouped by file. Clicking a row opens
 * the file and jumps to the line. Findings are leads for a human reviewer —
 * the panel says so, because a list of red dots reads like a verdict.
 */
export function FindingsPanel({ projectRoot, refreshToken, onOpen }: FindingsPanelProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [findings, setFindings] = useState<ResearchFinding[]>([])
  const [minRank, setMinRank] = useState(1)
  const runRef = useRef(0)

  const load = useCallback(async () => {
    if (!projectRoot) return
    const run = ++runRef.current
    setPhase('loading')
    setError(null)
    try {
      await window.zequel.research.index()
      const list = await window.zequel.research.findings()
      if (run !== runRef.current) return
      setFindings(list)
      setPhase('ready')
    } catch (err) {
      if (run !== runRef.current) return
      setError(err instanceof Error ? err.message : 'Failed to load findings')
      setPhase('error')
    }
  }, [projectRoot])

  useEffect(() => {
    const timer = setTimeout(() => void load(), refreshToken === 0 ? 0 : 400)
    return () => clearTimeout(timer)
  }, [load, refreshToken])

  const counts = useMemo(() => {
    const c: Record<Severity, number> = { critical: 0, warning: 0, info: 0 }
    for (const f of findings) c[f.severity]++
    return c
  }, [findings])

  const groups = useMemo(() => {
    const visible = findings
      .filter((f) => RANK[f.severity] >= minRank)
      .sort(
        (a, b) =>
          RANK[b.severity] - RANK[a.severity] || a.path.localeCompare(b.path) || a.line - b.line
      )
    const byPath = new Map<string, ResearchFinding[]>()
    for (const f of visible) {
      const list = byPath.get(f.path)
      if (list) list.push(f)
      else byPath.set(f.path, [f])
    }
    return [...byPath.entries()]
  }, [findings, minRank])

  if (!projectRoot) return <p className="empty-state">Open a folder to scan it.</p>

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 px-3 pb-2">
        <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
          <span>{counts.critical} crit</span>
          <span>{counts.warning} warn</span>
          <span>{counts.info} info</span>
        </div>
        <button
          onClick={() => void load()}
          disabled={phase === 'loading'}
          className="rounded-md border border-border p-1 text-muted-foreground hover:text-foreground disabled:opacity-40"
          title="Re-scan project"
        >
          <RefreshCw className={cn('h-3 w-3', phase === 'loading' && 'animate-spin')} />
        </button>
      </div>

      <div className="flex gap-1 px-3 pb-2">
        {MIN_OPTIONS.map((o) => (
          <button
            key={o.label}
            onClick={() => setMinRank(o.min)}
            className={cn(
              'rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider',
              minRank === o.min
                ? 'border-foreground/40 text-foreground'
                : 'border-border text-muted-foreground hover:text-foreground'
            )}
          >
            {o.label}
          </button>
        ))}
      </div>

      <p className="px-3 pb-2 text-[10px] leading-snug text-muted-foreground/70">
        Heuristic leads for review, not verdicts. Each needs a human read of the code.
      </p>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {phase === 'error' && <p className="px-3 text-[11px] text-destructive">{error}</p>}
        {phase === 'loading' && findings.length === 0 && (
          <p className="px-3 text-[11px] text-muted-foreground">Scanning…</p>
        )}
        {phase === 'ready' && groups.length === 0 && (
          <p className="px-3 text-[11px] text-muted-foreground">
            {findings.length === 0
              ? 'No findings. That means these heuristics matched nothing, not that the code is safe.'
              : 'No findings at this severity.'}
          </p>
        )}
        {groups.map(([path, items]) => (
          <div key={path} className="pb-2">
            <p className="truncate px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {path}
            </p>
            {items.map((f, i) => (
              <button
                key={`${f.line}-${f.rule}-${i}`}
                onClick={() => onOpen(f.path, f.line)}
                className="flex w-full items-start gap-2 px-3 py-1.5 text-left hover:bg-muted/40"
              >
                <span className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', dotClass(f.severity))} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-[11px] text-foreground">
                    {f.rule}
                    <span className="text-muted-foreground">
                      {' '}
                      · {symbolName(f.symbolId)} · L{f.line}
                    </span>
                  </span>
                  <span className="block text-[11px] leading-snug text-muted-foreground">
                    {f.message}
                  </span>
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
