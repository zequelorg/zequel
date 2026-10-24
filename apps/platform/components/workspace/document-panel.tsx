'use client'

import { useState } from 'react'
import { Separator } from '@zequel/ui/components/separator'
import { ZequelLogo } from '@zequel/ui/components/zequel-logo'
import { ThemeToggle } from '@zequel/ui/components/theme-toggle'
import { Avatar, AvatarImage, AvatarFallback } from '@zequel/ui/components/avatar'
import { Button } from '@zequel/ui/components/button'
import { DocumentViewer } from './document-viewer'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@zequel/ui/components/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@zequel/ui/components/dropdown-menu'
import { createClient } from '@zequel/shared/supabase/client'
import { useWorkspaceStore } from '@/lib/store'
import type { Document, Profile } from '@zequel/types'
import { Upload, FileText, Check, Settings, MoreVertical, Trash2, Eye } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface DocumentPanelProps {
  onUploadClick: () => void
  userEmail?: string
  profile?: Profile | null
  hideHeader?: boolean
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

export function DocumentPanel({ onUploadClick, userEmail, profile, hideHeader }: DocumentPanelProps) {
  const {
    documents,
    selectedDocumentIds,
    toggleDocumentSelection,
    removeDocument,
  } = useWorkspaceStore()

  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [viewingDocument, setViewingDocument] = useState<Document | null>(null)
  const [viewerText, setViewerText] = useState<string | null>(null)
  const [isLoadingText, setIsLoadingText] = useState(false)

  const handleViewDocument = async (doc: Document) => {
    setViewingDocument(doc)
    setViewerText(null)
    setIsLoadingText(true)

    try {
      const supabase = createClient()
      const { data: docData, error } = await supabase
        .from('documents')
        .select('extracted_text')
        .eq('id', doc.id)
        .single()

      if (error) {
        console.error('[Zequel] Failed to fetch document text:', error)
      } else if (docData?.extracted_text) {
        setViewerText(docData.extracted_text)
      }
    } catch (err) {
      console.error('[Zequel] Error loading document:', err)
    } finally {
      setIsLoadingText(false)
    }
  }

  const handleDeleteDocument = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)

    try {
      const supabase = createClient()

      // Delete from storage bucket
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([deleteTarget.file_path])

      if (storageError) {
        console.error('[Zequel] Storage delete error:', storageError)
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', deleteTarget.id)

      if (dbError) {
        console.error('[Zequel] DB delete error:', dbError)
      }

      // Remove from local store regardless
      removeDocument(deleteTarget.id)
    } catch (err) {
      console.error('[Zequel] Delete error:', err)
    } finally {
      setDeleteTarget(null)
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {!hideHeader && (
        <>
          <div className="flex items-center justify-between px-4 py-3">
            <ZequelLogo />
            <ThemeToggle />
          </div>
          <Separator />
        </>
      )}

      <div className="px-4 py-3">
        <Button
          onClick={onUploadClick}
          variant="outline"
          className="h-9 w-full justify-start gap-2 rounded-md border-border font-mono text-xs uppercase tracking-wider text-foreground"
        >
          <Upload className="h-3.5 w-3.5" />
          Upload Document
        </Button>
      </div>
      <Separator />

      <div
        className="min-h-0 flex-1 overflow-y-auto"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="px-2 py-2">
          {documents.length === 0 ? (
            <div className="px-2 py-8 text-center">
              <FileText className="mx-auto h-6 w-6 text-muted-foreground/50" />
              <p className="mt-3 font-mono text-[11px] text-muted-foreground">
                No documents uploaded
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {documents.map((doc) => (
                <DocumentItem
                  key={doc.id}
                  document={doc}
                  isSelected={selectedDocumentIds.includes(doc.id)}
                  onToggle={() => toggleDocumentSelection(doc.id)}
                  onDelete={() => setDeleteTarget(doc)}
                  onView={() => handleViewDocument(doc)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {!hideHeader && (
        <>
          <Separator />
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <Avatar className="h-6 w-6 shrink-0">
                {profile?.avatar_url ? (
                  <AvatarImage src={profile.avatar_url} alt={getDisplayName(profile, userEmail)} />
                ) : null}
                <AvatarFallback className="bg-secondary font-mono text-[9px] text-foreground">
                  {getInitials(profile, userEmail)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate font-mono text-[11px] text-muted-foreground">
                {getDisplayName(profile, userEmail)}
              </span>
            </div>
            <Link href="/settings">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
              >
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </>
      )}

      {/* Document Viewer Dialog */}
      <DocumentViewer
        document={viewingDocument}
        isOpen={!!viewingDocument}
        onClose={() => {
          setViewingDocument(null)
          setViewerText(null)
        }}
        extractedText={viewerText}
        isLoading={isLoadingText}
      />

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent className="border-border bg-background">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-mono text-sm font-semibold uppercase tracking-wider text-foreground">
              Delete Document
            </AlertDialogTitle>
            <AlertDialogDescription className="font-sans text-sm text-muted-foreground">
              {'This will permanently delete '}
              <span className="font-medium text-foreground">{deleteTarget?.title}</span>
              {' and remove it from storage. This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isDeleting}
              className="h-8 rounded-md border-border font-mono text-xs uppercase tracking-wider"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDocument}
              disabled={isDeleting}
              className="h-8 rounded-md bg-foreground font-mono text-xs uppercase tracking-wider text-background hover:bg-foreground/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function DocumentItem({
  document,
  isSelected,
  onToggle,
  onDelete,
  onView,
}: {
  document: Document
  isSelected: boolean
  onToggle: () => void
  onDelete: () => void
  onView: () => void
}) {
  const statusLabel =
    document.status === 'parsed'
      ? 'Parsed'
      : document.status === 'processing'
        ? 'Processing'
        : 'Error'

  return (
    <div
      className={cn(
        'group flex w-full items-start gap-2 rounded-md px-2 py-2 transition-colors cursor-pointer',
        isSelected
          ? 'bg-secondary text-foreground'
          : 'text-foreground hover:bg-secondary/50'
      )}
      onClick={onToggle}
    >
      <div className="flex flex-1 items-start gap-3 text-left min-w-0">
        <div
          className={cn(
            'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border',
            isSelected
              ? 'border-foreground bg-foreground'
              : 'border-border'
          )}
        >
          {isSelected && <Check className="h-2.5 w-2.5 text-background" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-sans text-[13px] font-medium leading-tight" title={document.title}>
            {document.title.length > 25 ? `${document.title.slice(0, 22)}...` : document.title}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span className="font-mono text-[10px] text-muted-foreground">
              {document.page_count > 0 ? `${document.page_count} pages` : '--'}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">
              {statusLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Three-dot menu — always visible */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            onClick={(e) => e.stopPropagation()}
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:text-foreground focus-visible:text-foreground data-[state=open]:text-foreground"
            aria-label={`Options for ${document.title}`}
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[160px] border-border bg-background">
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation()
              onView()
            }}
            className="gap-2 font-mono text-[11px] uppercase tracking-wider text-foreground"
            aria-label="View parsed text"
          >
            <Eye className="h-3.5 w-3.5" />
            Parsed
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="gap-2 font-mono text-[11px] uppercase tracking-wider text-destructive focus:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
