'use client'

import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@zequel/ui/components/resizable'
import { CodingActivityBar } from './coding-activity-bar'
import { CodingFilesPanel } from './coding-files-panel'
import { CodingSearchPanel } from './coding-search-panel'
import { CodingGitPanel } from './coding-git-panel'
import { CodingAssistantPanel } from './coding-assistant-panel'
import { CodingToolbar } from './coding-toolbar'
import { CodingCenter } from './coding-center'
import { CodingBottomDock } from './coding-bottom-dock'
import { CodingStatusBar } from './coding-status-bar'
import { useCodingIdeStore } from '@/lib/coding/coding-ide-store'
import { useWorkspaceStore } from '@/lib/store'
import type { Profile } from '@zequel/types'

interface CodingWorkspaceProps {
  userEmail?: string
  profile?: Profile | null
}

/**
 * Real IDE Layout for Zequel Coding Mode
 *
 * ┌────────────────────────── Toolbar ──────────────────────────┐
 * │ [ActBar] │ [Primary Sidebar] │ [Editor / Split] │ [Status] │
 * │          │ Explorer / Search │                  │          │
 * │          │ Git / Assistant   ├──────────────────┤          │
 * │          │                   │ Bottom Dock      │          │
 * └──────────┴──────────────────┴──────────────────┴──────────┘
 */
export function CodingWorkspace({ userEmail, profile }: CodingWorkspaceProps) {
  const { setPendingCodingAction } = useWorkspaceStore()
  const {
    activeActivityTab,
    sidebarOpen,
    bottomDockOpen,
    setBottomDockOpen,
  } = useCodingIdeStore()

  const renderSidebarContent = () => {
    switch (activeActivityTab) {
      case 'explorer':
        return <CodingFilesPanel hideHeader userEmail={userEmail} profile={profile} />
      case 'search':
        return <CodingSearchPanel />
      case 'git':
        return <CodingGitPanel />
      case 'assistant':
        return <CodingAssistantPanel />
      case 'settings':
        return (
          <div className="p-4 font-mono text-xs text-muted-foreground">
            Workspace Settings & Configurations
          </div>
        )
      default:
        return <CodingFilesPanel hideHeader userEmail={userEmail} profile={profile} />
    }
  }

  return (
    <div className="flex h-svh w-full flex-col bg-background select-none overflow-hidden">
      {/* Top Bar */}
      <CodingToolbar userEmail={userEmail} profile={profile} />

      {/* Main Workspace Surface */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Far Left: Activity Bar */}
        <CodingActivityBar />

        {/* Resizable Work Area */}
        <div className="min-w-0 flex-1">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            {/* Primary Sidebar */}
            {sidebarOpen && (
              <>
                <ResizablePanel defaultSize={20} minSize={14} maxSize={35}>
                  {renderSidebarContent()}
                </ResizablePanel>
                <ResizableHandle />
              </>
            )}

            {/* Center Area (Editor / Preview / Split + Bottom Dock) */}
            <ResizablePanel defaultSize={sidebarOpen ? 80 : 100} minSize={40}>
              <ResizablePanelGroup direction="vertical" className="h-full">
                {/* Editor / Preview Area */}
                <ResizablePanel defaultSize={bottomDockOpen ? 65 : 100} minSize={20}>
                  <CodingCenter onAction={setPendingCodingAction} />
                </ResizablePanel>

                {/* Bottom Dock (Terminal, Problems, Output, Preview) */}
                {bottomDockOpen && (
                  <>
                    <ResizableHandle />
                    <ResizablePanel defaultSize={35} minSize={15}>
                      <CodingBottomDock onClose={() => setBottomDockOpen(false)} />
                    </ResizablePanel>
                  </>
                )}
              </ResizablePanelGroup>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>

      {/* IDE Status Bar */}
      <CodingStatusBar />
    </div>
  )
}
