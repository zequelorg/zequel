'use client'

import { useWorkspaceStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import type { WorkspaceMode } from '@zequel/types'
import { GraduationCap, FlaskConical, Code2 } from 'lucide-react'

/* Mode Switcher — responsive: labels on desktop, icon-only on small screens */
export function ModeSwitcher({ compact = false }: { compact?: boolean }) {
  const { mode, setMode } = useWorkspaceStore()

  const modes: {
    id: WorkspaceMode
    label: string
    icon: React.ReactNode
  }[] = [
    { id: 'study', label: 'Study', icon: <GraduationCap className="h-3.5 w-3.5" /> },
    { id: 'research', label: 'Research', icon: <FlaskConical className="h-3.5 w-3.5" /> },
    { id: 'coding', label: 'Coding', icon: <Code2 className="h-3.5 w-3.5" /> },
  ]

  return (
    <div className="flex items-center rounded-md border border-border bg-secondary/50 p-0.5">
      {modes.map((m) => (
        <button
          key={m.id}
          onClick={() => setMode(m.id)}
          aria-label={m.label}
          className={cn(
            'flex items-center justify-center gap-1.5 rounded-[5px] py-1.5 font-mono text-[10px] uppercase tracking-wider transition-all',
            compact ? 'w-9' : 'w-16 sm:w-24',
            mode === m.id
              ? 'bg-foreground text-background shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {m.icon}
          {!compact && <span className="hidden sm:inline">{m.label}</span>}
        </button>
      ))}
    </div>
  )
}
