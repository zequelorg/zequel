// Data model for the Research codebase trace graph.
//
// This is deliberately the same shape a real project-indexing engine would
// produce (backend/internal/index, once it has any logic in it — see
// /docs/STATUS.md): a root symbol, a set of related nodes reached by
// following references in one direction or the other, and the edges
// connecting them. The graph view consumes only this shape — it does not
// know or care whether the data came from a live indexer or a fixture,
// which is what lets the rendering layer be built and reviewed before the
// indexing engine is.

export type TraceDirection = 'inflows' | 'outflows'

// What kind of relationship an edge represents. Kept small and specific
// rather than a free-text label, so the UI can render each kind consistently
// (color, icon, line style) and so a future indexer has a fixed contract to
// emit against.
export type TraceEdgeKind =
  | 'calls' // root/node calls a function in the target
  | 'imports' // root/node imports the target module
  | 'extends' // type/class relationship
  | 'references' // reads a type, constant, or value from the target
  | 'tests' // target is a test that exercises the root/node

export type TraceNodeSeverity = 'none' | 'info' | 'warning' | 'critical'

export interface TraceNode {
  id: string
  // Short label shown on the node card, e.g. a function or file name.
  label: string
  // Secondary line — usually the file path or module the symbol lives in.
  path: string
  // The metric shown prominently on the card. For a call graph this is
  // typically a reference count; it is intentionally a plain number + unit
  // rather than a currency amount.
  metricValue: number
  metricUnit: string
  direction: TraceDirection
  kind: TraceEdgeKind
  severity: TraceNodeSeverity
}

export interface TraceRoot {
  id: string
  label: string
  path: string
}

export interface TraceEdge {
  id: string
  sourceId: string
  targetId: string
  kind: TraceEdgeKind
  severity: TraceNodeSeverity
}

export interface TraceGraph {
  root: TraceRoot
  nodes: TraceNode[]
  edges: TraceEdge[]
}
