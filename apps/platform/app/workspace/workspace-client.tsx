'use client'

import { useEffect, useState } from 'react'
import { WorkspaceShell } from '@/components/workspace/workspace-shell'
import { UploadDialog } from '@/components/workspace/upload-dialog'
import { Toaster } from '@zequel/ui/components/toaster'
import { useWorkspaceStore } from '@/lib/store'
import type { Document, Profile, QueryHistoryItem, Conversation } from '@zequel/types'

interface WorkspaceClientProps {
  userId: string
  userEmail: string
  initialDocuments: Document[]
  profile: Profile | null
  initialHistory: QueryHistoryItem[]
  initialConversations: Conversation[]
}

export function WorkspaceClient({
  userId,
  userEmail,
  initialDocuments,
  profile,
  initialHistory,
  initialConversations,
}: WorkspaceClientProps) {
  const { setDocuments, setQueryHistory, setConversations } =
    useWorkspaceStore()
  const [uploadOpen, setUploadOpen] = useState(false)

  useEffect(() => {
    setDocuments(initialDocuments)
  }, [initialDocuments, setDocuments])

  useEffect(() => {
    setQueryHistory(initialHistory)
  }, [initialHistory, setQueryHistory])

  useEffect(() => {
    setConversations(initialConversations)
  }, [initialConversations, setConversations])

  return (
    <>
      <WorkspaceShell
        onUploadClick={() => setUploadOpen(true)}
        userEmail={userEmail}
        profile={profile}
      />
      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        userId={userId}
      />
      <Toaster />
    </>
  )
}
