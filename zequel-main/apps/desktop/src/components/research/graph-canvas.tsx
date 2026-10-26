import { useMemo, useRef, useState, useCallback } from 'react'
import { ZoomIn, ZoomOut, Maximize2, Move } from 'lucide-react'
import type { TraceGraph, TraceNode } from '@/lib/research/graph-types'

interface LaidOutNode extends TraceNode {
  x: number
  y: number
}

const NODE_W = 184
const NODE_H = 46
const ROOT_W = 220
const ROOT_H = 56

// Places inflow nodes on the left half of an ellipse and outflow nodes on the
// right half, spaced evenly by angle. This mirrors the reference layout: one
// root, many related nodes fanned out around it, connected by curved lines
// rather than a strict tree — appropriate for a reference graph where a
// symbol can have many unrelated callers/callees at the same "distance".
function layoutNodes(graph: TraceGraph, width: number, height: number): LaidOutNode[] {
  const cx = width / 2
  const cy = height / 2
  const inflow = graph.nodes.filter((n) => n.direction === 'inflows')
  const outflow = graph.nodes.filter((n) => n.direction === 'outflows')

  const radiusX = Math.max(width * 0.36, 260)
  const radiusY = Math.max(height * 0.38, 200)

  const place = (list: TraceNode[], side: -1 | 1): LaidOutNode[] =>
    list.map((n, i) => {
      const spread = list.length <= 1 ? 0 : i / (list.length - 1) - 0.5 // -0.5..0.5
      const angle = spread * Math.PI * 0.85 // fan within ~153°
      const x = cx + side * radiusX * Math.cos(angle * 0.6 + (side === 1 ? 0 : Math.PI))
      const y = cy + radiusY * Math.sin(angle)
      return { ...n, x, y }
    })

  return [...place(inflow, -1), ...place(outflow, 1)]
}

function severityColor(sev: TraceNode['severity']): string {
  switch (sev) {
    case 'critical':
      return 'var(--destructive)'
    case 'warning':
      return 'var(--code-number)'
    case 'info':
      return 'var(--code-type)'
    default:
      return 'var(--muted-foreground)'
  }
}

function edgePath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = (x2 - x1) * 0.5
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
}

interface GraphCanvasProps {
  graph: TraceGraph
  visibleIds: Set<string>
  selectedId: string | null
  onSelectNode: (id: string | null) => void
}

export function GraphCanvas({ graph, visibleIds, selectedId, onSelectNode }: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)

  const width = 1400
  const height = 900

  const laidOut = useMemo(() => layoutNodes(graph, width, height), [graph])
  const visibleNodes = laidOut.filter((n) => visibleIds.has(n.id))
  const visibleNodeIds = new Set(visibleNodes.map((n) => n.id))

  const edges = graph.edges.filter(
    (e) =>
      (e.sourceId === graph.root.id && visibleNodeIds.has(e.targetId)) ||
      (e.targetId === graph.root.id && visibleNodeIds.has(e.sourceId))
  )

  const zoom = useCallback((delta: number) => {
    setTransform((t) => ({ ...t, scale: Math.min(2.5, Math.max(0.4, t.scale + delta)) }))
  }, [])

  const resetView = useCallback(() => setTransform({ x: 0, y: 0, scale: 1 }), [])

  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: transform.x, origY: transform.y }
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    setTransform((t) => ({ ...t, x: dragRef.current!.origX + dx, y: dragRef.current!.origY + dy }))
  }
  const onPointerUp = () => {
    dragRef.current = null
  }
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    zoom(e.deltaY < 0 ? 0.1 : -0.1)
  }

  const rootX = width / 2
  const rootY = height / 2

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-[var(--code-bg)]"
      onWheel={onWheel}
    >
      {/* Faint dot-grid backdrop, same convention as the reference layout */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: 'radial-gradient(var(--code-fg) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      />

      <svg
        className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.scale})`}>
          {/* Edges */}
          {edges.map((e) => {
            const isOutflow = e.sourceId === graph.root.id
            const other = laidOut.find((n) => n.id === (isOutflow ? e.targetId : e.sourceId))
            if (!other) return null
            const [x1, y1] = isOutflow ? [rootX, rootY] : [other.x, other.y]
            const [x2, y2] = isOutflow ? [other.x, other.y] : [rootX, rootY]
            const highlighted = selectedId === other.id
            const stroke = e.severity !== 'none' ? severityColor(e.severity) : 'var(--border)'
            return (
              <path
                key={e.id}
                d={edgePath(x1, y1, x2, y2)}
                fill="none"
                stroke={stroke}
                strokeWidth={highlighted ? 2 : 1}
                opacity={highlighted ? 0.9 : e.severity !== 'none' ? 0.55 : 0.35}
              />
            )
          })}

          {/* Root node */}
          <g
            transform={`translate(${rootX - ROOT_W / 2} ${rootY - ROOT_H / 2})`}
            onClick={() => onSelectNode(null)}
            className="cursor-pointer"
          >
            <rect
              width={ROOT_W}
              height={ROOT_H}
              rx={8}
              fill="var(--secondary)"
              stroke="var(--foreground)"
              strokeWidth={1.5}
            />
            <text x={14} y={24} fill="var(--foreground)" fontSize={13} fontWeight={600} fontFamily="monospace">
              {graph.root.label}
            </text>
            <text x={14} y={41} fill="var(--muted-foreground)" fontSize={10} fontFamily="monospace">
              {graph.root.path}
            </text>
          </g>

          {/* Related nodes */}
          {visibleNodes.map((n) => {
            const selected = selectedId === n.id
            return (
              <g
                key={n.id}
                transform={`translate(${n.x - NODE_W / 2} ${n.y - NODE_H / 2})`}
                onClick={(ev) => {
                  ev.stopPropagation()
                  onSelectNode(n.id)
                }}
                className="cursor-pointer"
              >
                <rect
                  width={NODE_W}
                  height={NODE_H}
                  rx={6}
                  fill="var(--card)"
                  stroke={selected ? 'var(--foreground)' : 'var(--border)'}
                  strokeWidth={selected ? 1.5 : 1}
                />
                <circle cx={NODE_W - 12} cy={12} r={3.5} fill={severityColor(n.severity)} />
                <text x={12} y={18} fill="var(--foreground)" fontSize={11.5} fontWeight={600} fontFamily="monospace">
                  {n.label.length > 24 ? n.label.slice(0, 23) + '…' : n.label}
                </text>
                <text x={12} y={32} fill="var(--muted-foreground)" fontSize={9.5} fontFamily="monospace">
                  {n.path.length > 28 ? '…' + n.path.slice(-27) : n.path}
                </text>
                <text x={12} y={43} fill="var(--muted-foreground)" fontSize={9} fontFamily="monospace">
                  {n.metricValue} {n.metricUnit}
                </text>
              </g>
            )
          })}
        </g>
      </svg>

      {/* Zoom / pan controls — right edge, matching the reference's vertical control cluster */}
      <div className="absolute right-3 top-3 flex flex-col gap-1 rounded-md border border-border bg-card/90 p-1 backdrop-blur-sm">
        <button
          onClick={() => zoom(0.15)}
          title="Zoom in"
          className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => zoom(-0.15)}
          title="Zoom out"
          className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={resetView}
          title="Reset view"
          className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
        <div className="flex h-7 w-7 items-center justify-center text-muted-foreground/50">
          <Move className="h-3.5 w-3.5" />
        </div>
      </div>

      <div className="absolute bottom-3 left-3 rounded-md border border-border bg-card/90 px-2.5 py-1 font-mono text-[10px] text-muted-foreground backdrop-blur-sm">
        {Math.round(transform.scale * 100)}%
      </div>
    </div>
  )
}
