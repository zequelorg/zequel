'use client'

import { useCodingIdeStore, type BottomTab } from '@/lib/coding/coding-ide-store'
import { CodingTerminal } from './coding-terminal'
import { PreviewPanel } from './preview-panel'
import { cn } from '@/lib/utils'
import { Terminal, AlertCircle, MonitorPlay, ScrollText, X, ChevronDown, ChevronUp } from 'lucide-react'

interface BottomDockTabItem {
  id: BottomTab
  label: string
  icon: React.ReactNode
  badge?: number
}

export function CodingBottomDock({ onClose }: { onClose?: () => void }) {
  const { activeBottomTab, setActiveBottomTab, terminalLines } = useCodingIdeStore()

  const tabs: BottomDockTabItem[] = [
    { id: 'terminal', label: 'Terminal', icon: <Terminal className="h-3.5 w-3.5" /> },
    { id: 'problems', label: 'Problems', icon: <AlertCircle className="h-3.5 w-3.5" />, badge: 0 },
    { id: 'output', label: 'Output', icon: <ScrollText className="h-3.5 w-3.5" /> },
    { id: 'preview', label: 'Preview', icon: <MonitorPlay className="h-3.5 w-3.5" /> },
  ]

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Tab bar header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-background px-3">
        <div className="flex items-center gap-1">
          {tabs.map((tab) => {
            const isActive = activeBottomTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveBottomTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 border-b-2 px-3 py-2 font-mono text-[11px] uppercase tracking-wider transition-colors',
                  isActive
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span className="rounded bg-secondary px-1.5 py-0.2 text-[9px] text-muted-foreground">
                    {tab.badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {onClose && (
          <button
            onClick={onClose}
            title="Close Panel"
            className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Dock Content Surface */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {activeBottomTab === 'terminal' && <CodingTerminal onClose={onClose} />}
        {activeBottomTab === 'preview' && <PreviewPanel />}
        {activeBottomTab === 'problems' && (
          <div className="flex h-full items-center justify-center font-sans text-xs text-muted-foreground">
            No problems detected in workspace.
          </div>
        )}
        {activeBottomTab === 'output' && (
          <div className="flex h-full flex-col overflow-y-auto p-3 font-mono text-xs text-muted-foreground">
            {terminalLines.map((l) => (
              <div key={l.id} className="py-0.5">
                [{l.stream.toUpperCase()}] {l.text}
              </div>
            ))}
            {terminalLines.length === 0 && <div>No output logs yet.</div>}
          </div>
        )}
      </div>
    </div>
  )
}
