'use client'

import { useIsMobile } from '@zequel/ui/hooks/use-mobile'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@zequel/ui/components/resizable'
import { DocumentPanel } from './document-panel'
import { ResearchPanel } from './research-panel'
import { StudyPanel } from './study-panel'
import { EvidencePanel } from './evidence-panel'
import { ConversationsPanel } from './conversations-panel'
import { CodingFilesPanel } from './coding/coding-files-panel'
import { CodingAssistantPanel } from './coding/coding-assistant-panel'
import { CodingCenter } from './coding/coding-center'
import { CodingWorkspace } from './coding/coding-workspace'
import { useCodingBootstrap } from './coding/use-coding-bootstrap'
import { ModeSwitcher } from './mode-switcher'
import { useWorkspaceStore } from '@/lib/store'
import { ThemeToggle } from '@zequel/ui/components/theme-toggle'
import { Avatar, AvatarImage, AvatarFallback } from '@zequel/ui/components/avatar'
import { Separator } from '@zequel/ui/components/separator'
import { cn } from '@/lib/utils'
import type { Profile, CodingActionId } from '@zequel/types'
import {
  FileText,
  Search,
  BookOpen,
  GraduationCap,
  MessageSquare,
  Code2,
  Bot,
} from 'lucide-react'
import Link from 'next/link'

interface WorkspaceShellProps {
  onUploadClick: () => void
  userEmail?: string
  profile?: Profile | null
}

export function WorkspaceShell({
  onUploadClick,
  userEmail,
  profile,
}: WorkspaceShellProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <MobileWorkspace
        onUploadClick={onUploadClick}
        userEmail={userEmail}
        profile={profile}
      />
    )
  }

  return (
    <DesktopWorkspace
      onUploadClick={onUploadClick}
      userEmail={userEmail}
      profile={profile}
    />
  )
}

function DesktopWorkspace({
  onUploadClick,
  userEmail,
  profile,
}: WorkspaceShellProps) {
  const { mode, setPendingCodingAction } = useWorkspaceStore()

  // Bootstrap the coding project/files/messages the first time Coding Mode opens.
  useCodingBootstrap(mode === 'coding')

  // Coding Mode is a full IDE: toolbar + files / editor+preview / assistant with
  // an integrated terminal, all driven by the CodingRuntime abstraction.
  if (mode === 'coding') {
    return <CodingWorkspace userEmail={userEmail} profile={profile} />
  }

  return (
    <div className="h-svh w-full bg-background">
      <ResizablePanelGroup direction="horizontal" className="h-full">
        {/* Left Panel — Documents (study / research). Coding Mode uses its own
            IDE layout via the early return above. */}
        <ResizablePanel defaultSize={22} minSize={16} maxSize={30}>
          <DocumentPanel
            onUploadClick={onUploadClick}
            userEmail={userEmail}
            profile={profile}
          />
        </ResizablePanel>

        <ResizableHandle />

        {/* Center Panel — Study, Research, or Coding editor (56%) */}
        <ResizablePanel defaultSize={56} minSize={40}>
          <div className="flex h-full flex-col overflow-hidden">
            {/* Mode Switcher Bar — centered */}
            <div className="flex shrink-0 items-center justify-center px-4 py-2.5">
              <ModeSwitcher />
            </div>
            <Separator className="shrink-0" />
            {/* Panel Content */}
            <div className="min-h-0 flex-1 overflow-hidden">
              {mode === 'study' && <StudyPanel />}
              {mode === 'research' && <ResearchPanel />}
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle />

        {/* Right Panel — Conversations (study), Evidence (research), Assistant (coding) */}
        <ResizablePanel defaultSize={22} minSize={16} maxSize={30}>
          <div className="h-full overflow-hidden">
            {mode === 'study' && <ConversationsPanel />}
            {mode === 'research' && <EvidencePanel />}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
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
  const name =
    profile?.full_name || profile?.display_name || userEmail || 'U'
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function MobileWorkspace({
  onUploadClick,
  userEmail,
  profile,
}: WorkspaceShellProps) {
  const { activeMobileTab, setActiveMobileTab, mode, setPendingCodingAction } =
    useWorkspaceStore()

  // Bootstrap coding data on mobile too.
  useCodingBootstrap(mode === 'coding')

  // On mobile, running a quick action also jumps to the Assistant tab so the
  // user sees the streamed response (the assistant panel isn't mounted while
  // the editor tab is active).
  const handleMobileAction = (action: CodingActionId) => {
    setPendingCodingAction(action)
    setActiveMobileTab('evidence')
  }

  return (
    <div className="flex h-svh w-full flex-col bg-background">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <span className="shrink-0 font-mono text-xs font-semibold text-foreground">
          Zequel
        </span>
        <div className="flex min-w-0 items-center gap-1.5">
          <ModeSwitcher compact />
          <ThemeToggle />
          <Link href="/settings" className="shrink-0">
            <Avatar className="h-7 w-7">
              {profile?.avatar_url ? (
                <AvatarImage
                  src={profile.avatar_url}
                  alt={getDisplayName(profile, userEmail)}
                />
              ) : null}
              <AvatarFallback className="bg-secondary font-mono text-[9px] text-foreground">
                {getInitials(profile, userEmail)}
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>
      <Separator />

      {/* Content Area */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          {activeMobileTab === 'documents' &&
            (mode === 'coding' ? (
              <CodingFilesPanel hideHeader userEmail={userEmail} profile={profile} />
            ) : (
              <DocumentPanel
                onUploadClick={onUploadClick}
                userEmail={userEmail}
                profile={profile}
                hideHeader
              />
            ))}
          {activeMobileTab === 'research' &&
            (mode === 'study' ? (
              <StudyPanel />
            ) : mode === 'research' ? (
              <ResearchPanel />
            ) : (
              <CodingCenter onAction={handleMobileAction} mobile />
            ))}
          {activeMobileTab === 'evidence' &&
            (mode === 'study' ? (
              <ConversationsPanel />
            ) : mode === 'research' ? (
              <EvidencePanel />
            ) : (
              <CodingAssistantPanel />
            ))}
        </div>
      </div>

      {/* Bottom Tab Navigation */}
      <Separator />
      <nav className="flex items-center bg-background" role="tablist">
        <MobileTab
          icon={<FileText className="h-4 w-4" />}
          label={mode === 'coding' ? 'Files' : 'Documents'}
          isActive={activeMobileTab === 'documents'}
          onClick={() => setActiveMobileTab('documents')}
        />
        <MobileTab
          icon={
            mode === 'study' ? (
              <GraduationCap className="h-4 w-4" />
            ) : mode === 'research' ? (
              <Search className="h-4 w-4" />
            ) : (
              <Code2 className="h-4 w-4" />
            )
          }
          label={
            mode === 'study' ? 'Study' : mode === 'research' ? 'Research' : 'Editor'
          }
          isActive={activeMobileTab === 'research'}
          onClick={() => setActiveMobileTab('research')}
        />
        <MobileTab
          icon={
            mode === 'study' ? (
              <MessageSquare className="h-4 w-4" />
            ) : mode === 'research' ? (
              <BookOpen className="h-4 w-4" />
            ) : (
              <Bot className="h-4 w-4" />
            )
          }
          label={
            mode === 'study' ? 'Chats' : mode === 'research' ? 'Evidence' : 'Assistant'
          }
          isActive={activeMobileTab === 'evidence'}
          onClick={() => setActiveMobileTab('evidence')}
        />
      </nav>
    </div>
  )
}

function MobileTab({
  icon,
  label,
  isActive,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      role="tab"
      aria-selected={isActive}
      onClick={onClick}
      className={cn(
        'flex flex-1 flex-col items-center gap-0.5 py-2.5 transition-colors',
        isActive ? 'text-foreground' : 'text-muted-foreground'
      )}
    >
      {icon}
      <span className="font-mono text-[9px] uppercase tracking-wider">
        {label}
      </span>
    </button>
  )
}
