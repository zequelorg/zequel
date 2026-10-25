import type { TraceGraph } from './graph-types'

// Placeholder data for the graph view, built before the real indexing engine
// (filesystem scanner → symbol index → reference analysis, see
// backend/internal/index/doc.go) exists. It is not invented filler: every
// node/edge below is a real reference relationship in this repository's Go
// backend as of the security/architecture review pass — traced by hand from
// backend/internal/server/server.go. It is a stand-in for what that engine
// will eventually compute automatically, using the exact data shape it will
// need to produce — so this component does not need to change when the real
// indexer is wired in, only the data source does.
export const sampleTraceGraph: TraceGraph = {
  root: {
    id: 'server-new',
    label: 'server.New()',
    path: 'backend/internal/server/server.go',
  },
  nodes: [
    {
      id: 'zequeld-main',
      label: 'main()',
      path: 'backend/cmd/zequeld/main.go',
      metricValue: 1,
      metricUnit: 'call site',
      direction: 'inflows',
      kind: 'calls',
      severity: 'none',
    },
    {
      id: 'backend-ts-startbackend',
      label: 'startBackend()',
      path: 'apps/desktop/electron/backend.ts',
      metricValue: 1,
      metricUnit: 'spawn site',
      direction: 'inflows',
      kind: 'calls',
      severity: 'none',
    },
    {
      id: 'require-host',
      label: 'requireHost()',
      path: 'backend/internal/server/auth.go',
      metricValue: 1,
      metricUnit: 'wrap',
      direction: 'outflows',
      kind: 'calls',
      severity: 'none',
    },
    {
      id: 'require-token',
      label: 'requireToken()',
      path: 'backend/internal/server/auth.go',
      metricValue: 1,
      metricUnit: 'wrap',
      direction: 'outflows',
      kind: 'calls',
      severity: 'none',
    },
    {
      id: 'routes-fn',
      label: 'routes()',
      path: 'backend/internal/server/server.go',
      metricValue: 1,
      metricUnit: 'route table',
      direction: 'outflows',
      kind: 'calls',
      severity: 'none',
    },
    {
      id: 'handle-health',
      label: 'handleHealth()',
      path: 'backend/internal/server/server.go',
      metricValue: 1,
      metricUnit: 'route',
      direction: 'outflows',
      kind: 'references',
      severity: 'none',
    },
    {
      id: 'server-test',
      label: 'server_test.go',
      path: 'backend/internal/server/server_test.go',
      metricValue: 8,
      metricUnit: 'tests',
      direction: 'inflows',
      kind: 'tests',
      severity: 'none',
    },
    {
      id: 'storage-pkg',
      label: 'internal/storage',
      path: 'backend/internal/storage/doc.go',
      metricValue: 0,
      metricUnit: 'callers',
      direction: 'outflows',
      kind: 'references',
      severity: 'info',
    },
    {
      id: 'no-restart-policy',
      label: 'No restart-on-crash policy',
      path: 'apps/desktop/electron/backend.ts',
      metricValue: 1,
      metricUnit: 'gap',
      direction: 'outflows',
      kind: 'references',
      severity: 'warning',
    },
  ],
  edges: [
    { id: 'e1', sourceId: 'zequeld-main', targetId: 'server-new', kind: 'calls', severity: 'none' },
    { id: 'e2', sourceId: 'backend-ts-startbackend', targetId: 'server-new', kind: 'calls', severity: 'none' },
    { id: 'e3', sourceId: 'server-new', targetId: 'require-host', kind: 'calls', severity: 'none' },
    { id: 'e4', sourceId: 'server-new', targetId: 'require-token', kind: 'calls', severity: 'none' },
    { id: 'e5', sourceId: 'server-new', targetId: 'routes-fn', kind: 'calls', severity: 'none' },
    { id: 'e6', sourceId: 'routes-fn', targetId: 'handle-health', kind: 'calls', severity: 'none' },
    { id: 'e7', sourceId: 'server-test', targetId: 'server-new', kind: 'tests', severity: 'none' },
    { id: 'e8', sourceId: 'server-new', targetId: 'storage-pkg', kind: 'references', severity: 'info' },
    { id: 'e9', sourceId: 'backend-ts-startbackend', targetId: 'no-restart-policy', kind: 'references', severity: 'warning' },
  ],
}
