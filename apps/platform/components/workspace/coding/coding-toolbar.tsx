'use client'

import { createClient } from '@zequel/shared/supabase/client'
import { useWorkspaceStore } from '@/lib/store'
import { useCodingIdeStore, type CodingViewMode } from '@/lib/coding/coding-ide-store'
import { useLoadCodingProject } from './use-coding-bootstrap'
import { ModeSwitcher } from '../mode-switcher'
import { ThemeToggle } from '@zequel/ui/components/theme-toggle'
import { Avatar, AvatarImage, AvatarFallback } from '@zequel/ui/components/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@zequel/ui/components/dropdown-menu'
import { useToast } from '@zequel/ui/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { CodingProject, Profile } from '@zequel/types'
import {
  Play,
  Square,
  Code2,
  Columns2,
  MonitorPlay,
  TerminalSquare,
  Bot,
  GitBranch,
  ChevronDown,
  Plus,
  Check,
  Settings,
  Loader2,
  FolderGit2,
} from 'lucide-react'
import Link from 'next/link'

const VIEW_OPTIONS: { id: CodingViewMode; icon: React.ReactNode; label: string }[] = [
  { id: 'editor', icon: <Code2 className="h-3.5 w-3.5" />, label: 'Editor' },
  { id: 'split', icon: <Columns2 className="h-3.5 w-3.5" />, label: 'Split' },
  { id: 'preview', icon: <MonitorPlay className="h-3.5 w-3.5" />, label: 'Preview' },
]

/** Segmented Editor / Split / Preview switch. Shared by the toolbar and mobile. */
export function ViewSwitch({ compact = false }: { compact?: boolean }) {
  const { viewMode, setViewMode } = useCodingIdeStore()
  const options = compact ? VIEW_OPTIONS.filter((o) => o.id !== 'split') : VIEW_OPTIONS
  return (
    <div className="flex items-center rounded-md border border-border bg-secondary/50 p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => setViewMode(o.id)}
          aria-pressed={viewMode === o.id}
          title={o.label}
          className={cn(
            'flex items-center gap-1.5 rounded-[5px] px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors',
            viewMode === o.id
              ? 'bg-foreground text-background'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {o.icon}
          {!compact && <span className="hidden md:inline">{o.label}</span>}
        </button>
      ))}
    </div>
  )
}

function getDisplayName(profile?: Profile | null, userEmail?: string) {
  if (profile?.full_name) return profile.full_name
  if (profile?.display_name) return profile.display_name
  if (profile?.username) return `@${profile.username}`
  return userEmail || 'Account'
}

function getInitials(profile?: Profile | null, userEmail?: string) {
  const name = profile?.full_name || profile?.display_name || userEmail || 'U'
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

interface CodingToolbarProps {
  userEmail?: string
  profile?: Profile | null
}

export function CodingToolbar({ userEmail, profile }: CodingToolbarProps) {
  const { codingProject, codingProjects, setCodingProjects } = useWorkspaceStore()
  const {
    runtime,
    runtimeStatus,
    runState,
    setRunState,
    preview,
    setPreview,
    setViewMode,
    terminalOpen,
    toggleTerminal,
    setTerminalOpen,
    assistantOpen,
    toggleAssistant,
    saveState,
    appendTerminalLine,
  } = useCodingIdeStore()
  const loadProject = useLoadCodingProject()
  const { toast } = useToast()

  const isBusy = runState === 'starting'
  const isRunning = runState === 'running'

  const handleRun = async () => {
    setRunState('starting')
    setPreview({ ...preview, status: 'starting' })
    setTerminalOpen(true)
    appendTerminalLine({ stream: 'input', text: `pnpm dev --port ${preview.port}` })
    appendTerminalLine({ stream: 'system', text: 'Starting development server…' })

    const info = await runtime.startServer(preview.port)
    setPreview(info)

    if (info.status === 'running' && info.url) {
      setRunState('running')
      setViewMode('preview')
    } else {
      setRunState('error')
      appendTerminalLine({
        stream: 'stderr',
        text: info.error ?? 'Failed to start the development server.',
      })
    }
  }

  const handleStop = async () => {
    await runtime.stopServer()
    setRunState('idle')
    setPreview({ status: 'stopped', url: null, port: preview.port })
    appendTerminalLine({ stream: 'system', text: 'Development server stopped.' })
  }

  const handleSwitchProject = async (project: CodingProject) => {
    if (project.id === codingProject?.id) return
    await loadProject(project)
  }

  const handleCreateProject = async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const { data, error } = await supabase
      .from('coding_projects')
      .insert({ user_id: user.id, name: 'New Project' })
      .select()
      .single()
    if (error || !data) {
      toast({ title: 'Could not create project', variant: 'destructive' })
      return
    }
    const project = data as CodingProject
    setCodingProjects([project, ...codingProjects])
    await loadProject(project)
    toast({ title: 'Project created' })
  }

  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-background px-3">
      {/* Left — brand + project + status */}
      <span className="hidden shrink-0 font-mono text-xs font-semibold text-foreground lg:inline">
        Zequel
      </span>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex min-w-0 items-center gap-1.5 rounded-md border border-border px-2 py-1 text-foreground transition-colors hover:bg-secondary">
            <FolderGit2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="max-w-[10rem] truncate font-sans text-xs font-medium">
              {codingProject?.name ?? 'No project'}
            </span>
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60">
          <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Projects
          </DropdownMenuLabel>
          {codingProjects.map((p) => (
            <DropdownMenuItem
              key={p.id}
              onClick={() => handleSwitchProject(p)}
              className="flex items-center justify-between gap-2"
            >
              <span className="truncate">{p.name}</span>
              {p.id === codingProject?.id && <Check className="h-3.5 w-3.5 shrink-0" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleCreateProject}>
            <Plus className="mr-2 h-3.5 w-3.5" />
            New project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Branch / status — architectural (no fake git functionality) */}
      <div className="hidden items-center gap-1.5 text-muted-foreground xl:flex">
        <GitBranch className="h-3.5 w-3.5" />
        <span className="font-mono text-[11px]">main</span>
        <span
          className={cn(
            'ml-1 h-1.5 w-1.5 rounded-full',
            runtimeStatus === 'ready' ? 'bg-foreground' : 'bg-muted-foreground/40'
          )}
          title={runtimeStatus === 'ready' ? 'Sandbox connected' : 'Sandbox not connected'}
        />
      </div>

      {/* Save status */}
      <span className="hidden font-mono text-[10px] uppercase tracking-wider text-muted-foreground lg:inline">
        {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : ''}
      </span>

      {/* Center — view switch */}
      <div className="mx-auto">
        <ViewSwitch />
      </div>

      {/* Right — run + panel toggles */}
      <div className="flex shrink-0 items-center gap-1.5">
        {isRunning || isBusy ? (
          <button
            onClick={handleStop}
            disabled={isBusy}
            className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-foreground transition-colors hover:bg-secondary disabled:opacity-60"
          >
            {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
            {isBusy ? 'Starting' : 'Stop'}
          </button>
        ) : (
          <button
            onClick={handleRun}
            className="flex items-center gap-1.5 rounded-md bg-foreground px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-background transition-opacity hover:opacity-90"
          >
            <Play className="h-3.5 w-3.5" />
            Run
          </button>
        )}

        <ToolbarToggle
          active={false}
          onClick={() => setViewMode('preview')}
          title="Open preview"
        >
          <MonitorPlay className="h-4 w-4" />
        </ToolbarToggle>
        <ToolbarToggle
          active={terminalOpen}
          onClick={toggleTerminal}
          title="Toggle terminal"
        >
          <TerminalSquare className="h-4 w-4" />
        </ToolbarToggle>
        <ToolbarToggle
          active={assistantOpen}
          onClick={toggleAssistant}
          title="Toggle Zequel AI"
        >
          <Bot className="h-4 w-4" />
        </ToolbarToggle>

        <div className="mx-0.5 hidden h-5 w-px bg-border sm:block" />

        <div className="hidden sm:block">
          <ModeSwitcher compact />
        </div>

        {/* Settings / runtime info */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="Coding settings"
            >
              <Settings className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Runtime
            </DropdownMenuLabel>
            <div className="px-2 pb-1.5 text-xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Adapter</span>
                <span className="font-mono">{runtime.kind}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Status</span>
                <span className="font-mono">{runtimeStatus}</span>
              </div>
              <p className="mt-2 leading-relaxed">
                Connect an isolated sandbox to run commands, start servers,
                and open live previews.
              </p>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <ThemeToggle />

        <Link href="/settings" className="shrink-0">
          <Avatar className="h-7 w-7">
            {profile?.avatar_url ? (
              <AvatarImage src={profile.avatar_url} alt={getDisplayName(profile, userEmail)} />
            ) : null}
            <AvatarFallback className="bg-secondary font-mono text-[9px] text-foreground">
              {getInitials(profile, userEmail)}
            </AvatarFallback>
          </Avatar>
        </Link>
      </div>
    </div>
  )
}

function ToolbarToggle({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={cn(
        'rounded-md p-1.5 transition-colors',
        active
          ? 'bg-secondary text-foreground'
          : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
      )}
    >
      {children}
    </button>
  )
}
