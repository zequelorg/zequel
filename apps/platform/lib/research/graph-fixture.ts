import type { TraceGraph } from './graph-types'

// Placeholder data for the graph view, built before the real indexing engine
// (filesystem scanner → symbol index → reference analysis, see the project
// spec) exists. It is not invented filler: every node/edge below is a real
// reference relationship in this repository as of the Coding Mode runtime
// work done earlier in this project, traced by hand from
// `apps/platform/lib/coding/runtime.ts`. It is a stand-in for what that
// engine will eventually compute automatically, using the exact data shape
// it will need to produce — so this component does not need to change when
// the real indexer is wired in, only the data source does.
export const sampleTraceGraph: TraceGraph = {
  root: {
    id: 'coding-runtime',
    label: 'CodingRuntime',
    path: 'apps/platform/lib/coding/runtime.ts',
  },
  nodes: [
    {
      id: 'not-connected-runtime',
      label: 'NotConnectedRuntime',
      path: 'lib/coding/runtime.ts',
      metricValue: 9,
      metricUnit: 'refs',
      direction: 'outflows',
      kind: 'extends',
      severity: 'none',
    },
    {
      id: 'to-runtime-project',
      label: 'toRuntimeProject()',
      path: 'lib/coding/runtime.ts',
      metricValue: 3,
      metricUnit: 'refs',
      direction: 'outflows',
      kind: 'calls',
      severity: 'none',
    },
    {
      id: 'coding-project-type',
      label: 'CodingProject',
      path: 'packages/types/src/index.ts',
      metricValue: 14,
      metricUnit: 'refs',
      direction: 'outflows',
      kind: 'references',
      severity: 'none',
    },
    {
      id: 'coding-ide-store',
      label: 'useCodingIdeStore',
      path: 'lib/coding/coding-ide-store.ts',
      metricValue: 11,
      metricUnit: 'refs',
      direction: 'inflows',
      kind: 'calls',
      severity: 'none',
    },
    {
      id: 'coding-terminal',
      label: 'CodingTerminal',
      path: 'components/workspace/coding/coding-terminal.tsx',
      metricValue: 4,
      metricUnit: 'refs',
      direction: 'inflows',
      kind: 'calls',
      severity: 'none',
    },
    {
      id: 'coding-toolbar',
      label: 'CodingToolbar',
      path: 'components/workspace/coding/coding-toolbar.tsx',
      metricValue: 2,
      metricUnit: 'refs',
      direction: 'inflows',
      kind: 'calls',
      severity: 'none',
    },
    {
      id: 'coding-status-bar',
      label: 'CodingStatusBar',
      path: 'components/workspace/coding/coding-status-bar.tsx',
      metricValue: 2,
      metricUnit: 'refs',
      direction: 'inflows',
      kind: 'references',
      severity: 'none',
    },
    {
      id: 'coding-workspace',
      label: 'CodingWorkspace',
      path: 'components/workspace/coding/coding-workspace.tsx',
      metricValue: 6,
      metricUnit: 'refs',
      direction: 'inflows',
      kind: 'calls',
      severity: 'none',
    },
    {
      id: 'daytona-sdk-removed',
      label: '@daytona/sdk (removed)',
      path: 'apps/platform/package.json',
      metricValue: 0,
      metricUnit: 'refs',
      direction: 'outflows',
      kind: 'imports',
      severity: 'warning',
    },
    {
      id: 'runtime-not-tested',
      label: 'No execution provider wired',
      path: 'lib/coding/runtime.ts',
      metricValue: 1,
      metricUnit: 'gap',
      direction: 'outflows',
      kind: 'references',
      severity: 'critical',
    },
  ],
  edges: [
    { id: 'e1', sourceId: 'coding-runtime', targetId: 'not-connected-runtime', kind: 'extends', severity: 'none' },
    { id: 'e2', sourceId: 'coding-runtime', targetId: 'to-runtime-project', kind: 'calls', severity: 'none' },
    { id: 'e3', sourceId: 'coding-runtime', targetId: 'coding-project-type', kind: 'references', severity: 'none' },
    { id: 'e4', sourceId: 'coding-ide-store', targetId: 'coding-runtime', kind: 'calls', severity: 'none' },
    { id: 'e5', sourceId: 'coding-terminal', targetId: 'coding-runtime', kind: 'calls', severity: 'none' },
    { id: 'e6', sourceId: 'coding-toolbar', targetId: 'coding-runtime', kind: 'calls', severity: 'none' },
    { id: 'e7', sourceId: 'coding-status-bar', targetId: 'coding-runtime', kind: 'references', severity: 'none' },
    { id: 'e8', sourceId: 'coding-workspace', targetId: 'coding-runtime', kind: 'calls', severity: 'none' },
    { id: 'e9', sourceId: 'coding-runtime', targetId: 'daytona-sdk-removed', kind: 'imports', severity: 'warning' },
    { id: 'e10', sourceId: 'coding-runtime', targetId: 'runtime-not-tested', kind: 'references', severity: 'critical' },
  ],
}
