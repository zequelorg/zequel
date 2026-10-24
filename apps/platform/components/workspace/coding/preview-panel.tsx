'use client'

import { useState } from 'react'
import { useCodingIdeStore, type PreviewViewport } from '@/lib/coding/coding-ide-store'
import { cn } from '@/lib/utils'
import {
  RotateCw,
  ExternalLink,
  Monitor,
  Tablet,
  Smartphone,
  Loader2,
  AlertTriangle,
  MonitorPlay,
  Sparkles,
} from 'lucide-react'

const VIEWPORTS: {
  id: PreviewViewport
  icon: React.ReactNode
  label: string
  width: number | null
}[] = [
  { id: 'desktop', icon: <Monitor className="h-3.5 w-3.5" />, label: 'Desktop', width: null },
  { id: 'tablet', icon: <Tablet className="h-3.5 w-3.5" />, label: 'Tablet', width: 768 },
  { id: 'mobile', icon: <Smartphone className="h-3.5 w-3.5" />, label: 'Mobile', width: 390 },
]

/**
 * Application preview surface. Designed around a future sandbox-provided URL:
 * the backend boots the dev server and returns a public preview URL, which we
 * render in an isolated iframe. Until then it shows honest stopped/error state.
 */
export function PreviewPanel() {
  const { preview, previewViewport, setPreviewViewport, setAssistantPrefill, setAssistantOpen } =
    useCodingIdeStore()
  const [refreshKey, setRefreshKey] = useState(0)

  const viewport = VIEWPORTS.find((v) => v.id === previewViewport) ?? VIEWPORTS[0]
  const isRunning = preview.status === 'running' && Boolean(preview.url)

  const explainError = () => {
    if (!preview.error) return
    setAssistantPrefill(
      `The preview failed to start. Explain what this means and how I could fix it:\n\n${preview.error}`
    )
    setAssistantOpen(true)
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Preview toolbar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          disabled={!isRunning}
          title="Refresh preview"
          aria-label="Refresh preview"
          className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RotateCw className="h-3.5 w-3.5" />
        </button>

        {/* URL bar */}
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-secondary/40 px-2.5 py-1">
          <span
            className={cn(
              'h-1.5 w-1.5 shrink-0 rounded-full',
              isRunning ? 'bg-foreground' : 'bg-muted-foreground/40'
            )}
          />
          <span className="truncate font-mono text-[11px] text-muted-foreground">
            {preview.url ?? 'No preview URL — start the dev server to generate one'}
          </span>
        </div>

        {/* Viewport selector */}
        <div className="hidden items-center rounded-md border border-border bg-secondary/50 p-0.5 sm:flex">
          {VIEWPORTS.map((v) => (
            <button
              key={v.id}
              onClick={() => setPreviewViewport(v.id)}
              aria-label={`${v.label} viewport`}
              title={v.label}
              className={cn(
                'flex items-center justify-center rounded-[5px] px-2 py-1 transition-colors',
                previewViewport === v.id
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {v.icon}
            </button>
          ))}
        </div>

        <a
          href={isRunning ? (preview.url as string) : undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={!isRunning}
          title="Open in new tab"
          className={cn(
            'rounded p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
            !isRunning && 'pointer-events-none opacity-40'
          )}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* Preview surface */}
      <div className="min-h-0 flex-1 overflow-auto bg-secondary/20 p-3">
        {preview.status === 'running' && preview.url ? (
          <div
            className="mx-auto h-full overflow-hidden rounded-md border border-border bg-white shadow-sm"
            style={{ width: viewport.width ? `${viewport.width}px` : '100%', maxWidth: '100%' }}
          >
            <iframe
              key={refreshKey}
              src={preview.url}
              title="Application preview"
              className="h-full w-full"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          </div>
        ) : preview.status === 'starting' ? (
          <StateMessage
            icon={<Loader2 className="h-5 w-5 animate-spin" />}
            title="Starting development server"
            body="Waiting for the sandbox to boot the dev server and return a preview URL."
          />
        ) : preview.status === 'error' ? (
          <StateMessage
            icon={<AlertTriangle className="h-5 w-5" />}
            title="Preview unavailable"
            body={preview.error ?? 'The development server could not be started.'}
            action={
              <button
                onClick={explainError}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Explain error
              </button>
            }
          />
        ) : (
          <StateMessage
            icon={<MonitorPlay className="h-5 w-5" />}
            title="Preview not running"
            body="Press Run to start the development server. Once Coding Mode is connected to an isolated sandbox, the sandbox boots your app and returns a live preview URL rendered here."
          />
        )}
      </div>
    </div>
  )
}

function StateMessage({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode
  title: string
  body: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex max-w-sm flex-col items-center text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-muted-foreground">
          {icon}
        </div>
        <p className="mt-3 font-sans text-sm font-medium text-foreground">{title}</p>
        <p className="mt-1 font-sans text-xs leading-relaxed text-muted-foreground">{body}</p>
        {action}
      </div>
    </div>
  )
}
