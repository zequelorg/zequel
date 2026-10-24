'use client'

import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@zequel/ui/components/resizable'
import { Sheet, SheetContent, SheetTitle } from '@zequel/ui/components/sheet'
import { CodingEditorPanel } from './coding-editor-panel'
import { PreviewPanel } from './preview-panel'
import { CodingTerminal } from './coding-terminal'
import { ViewSwitch } from './coding-toolbar'
import { useCodingIdeStore } from '@/lib/coding/coding-ide-store'
import { cn } from '@/lib/utils'
import type { CodingActionId } from '@zequel/types'
import { TerminalSquare } from 'lucide-react'

interface CodingCenterProps {
  onAction: (action: CodingActionId) => void
  // Compact header with view switch + terminal, used on mobile where there is
  // no desktop toolbar.
  mobile?: boolean
}

/**
 * The center surface. Renders the editor, the preview, or a split of both based
 * on the shared IDE view mode. On mobile it also owns a compact control row and
 * a bottom terminal sheet, since the desktop toolbar isn't present there.
 */
export function CodingCenter({ onAction, mobile = false }: CodingCenterProps) {
  const { viewMode, terminalOpen, setTerminalOpen } = useCodingIdeStore()

  const surface =
    viewMode === 'preview' ? (
      <PreviewPanel />
    ) : viewMode === 'split' ? (
      <ResizablePanelGroup direction="horizontal" className="h-full">
        <ResizablePanel defaultSize={50} minSize={30}>
          <CodingEditorPanel onAction={onAction} />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={50} minSize={30}>
          <PreviewPanel />
        </ResizablePanel>
      </ResizablePanelGroup>
    ) : (
      <CodingEditorPanel onAction={onAction} />
    )

  if (!mobile) return surface

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
        <ViewSwitch compact />
        <button
          onClick={() => setTerminalOpen(true)}
          className={cn(
            'flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors',
            terminalOpen
              ? 'bg-secondary text-foreground'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
          )}
        >
          <TerminalSquare className="h-3.5 w-3.5" />
          Terminal
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">{surface}</div>

      <Sheet open={terminalOpen} onOpenChange={setTerminalOpen}>
        <SheetContent side="bottom" className="h-[65svh] border-border p-0">
          <SheetTitle className="sr-only">Terminal</SheetTitle>
          <CodingTerminal onClose={() => setTerminalOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  )
}
