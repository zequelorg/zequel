'use client'

import { useCodingIdeStore, type ActivityTab } from '@/lib/coding/coding-ide-store'
import { cn } from '@/lib/utils'
import {
  Files,
  Search,
  GitBranch,
  Bot,
  Settings,
} from 'lucide-react'

interface ActivityItem {
  id: ActivityTab
  label: string
  icon: React.ReactNode
}

const ITEMS: ActivityItem[] = [
  { id: 'explorer', label: 'Explorer', icon: <Files className="h-5 w-5" /> },
  { id: 'search', label: 'Search', icon: <Search className="h-5 w-5" /> },
  { id: 'git', label: 'Source Control', icon: <GitBranch className="h-5 w-5" /> },
  { id: 'assistant', label: 'Zequel AI', icon: <Bot className="h-5 w-5" /> },
]

export function CodingActivityBar() {
  const { activeActivityTab, setActiveActivityTab, sidebarOpen } = useCodingIdeStore()

  return (
    <div className="flex h-full w-12 shrink-0 flex-col justify-between border-r border-border bg-background py-2">
      <div className="flex flex-col items-center gap-1">
        {ITEMS.map((item) => {
          const isActive = activeActivityTab === item.id && sidebarOpen
          return (
            <button
              key={item.id}
              onClick={() => setActiveActivityTab(item.id)}
              title={item.label}
              aria-label={item.label}
              className={cn(
                'relative flex h-10 w-10 items-center justify-center rounded-md transition-colors',
                isActive
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
              )}
            >
              {item.icon}
              {isActive && (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-foreground" />
              )}
            </button>
          )
        })}
      </div>

      <div className="flex flex-col items-center gap-1">
        <button
          onClick={() => setActiveActivityTab('settings')}
          title="Settings"
          aria-label="Settings"
          className={cn(
            'relative flex h-10 w-10 items-center justify-center rounded-md transition-colors',
            activeActivityTab === 'settings' && sidebarOpen
              ? 'bg-secondary text-foreground'
              : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
          )}
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
