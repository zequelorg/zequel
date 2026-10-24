'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Separator } from '@zequel/ui/components/separator'
import { Button } from '@zequel/ui/components/button'
import { Avatar, AvatarFallback, AvatarImage } from '@zequel/ui/components/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@zequel/ui/components/dropdown-menu'
import { useWorkspaceStore } from '@/lib/store'
import { createClient } from '@zequel/shared/supabase/client'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { cn } from '@/lib/utils'
import {
  Loader2,
  Send,
  Plus,
  FileText,
  Pencil,
  Check,
  X,
  RotateCcw,
  Copy,
  Share2,
  MoreHorizontal,
  GitBranch,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  Camera,
  Download,
} from 'lucide-react'
import type { Conversation, Message, Document } from '@zequel/types'
import { mapMessageRow } from '@zequel/types'
import { UpgradeDialog, type RequiredPlan } from './upgrade-dialog'

interface AttachedFile {
  file: File
  preview?: string // data URL for images
}

export function StudyPanel() {
  const {
    conversations,
    activeConversationId,
    setActiveConversationId,
    addConversation,
    updateConversationTitle,
    messages,
    setMessages,
    addMessage,
    updateMessage,
    isStreaming,
    setIsStreaming,
    documents,
    addDocument,
    selectedDocumentIds,
  } = useWorkspaceStore()

  const [input, setInput] = useState('')
  const [streamingContent, setStreamingContent] = useState('')
  const [userAvatar, setUserAvatar] = useState<string | null>(null)
  const [userInitials, setUserInitials] = useState('U')
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [regeneratingMessageId, setRegeneratingMessageId] = useState<string | null>(null)
  const [editingImages, setEditingImages] = useState<string[]>([]) // Store images when editing
  const [upgrade, setUpgrade] = useState<{
    open: boolean
    plan?: RequiredPlan
    message?: string
  }>({ open: false })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const isFirstMessage = useRef(false)
  const shouldAutoScroll = useRef(true)

  // Throttled streaming buffer — accumulates text and renders at a smooth pace
  const streamBufferRef = useRef('')
  const displayedLengthRef = useRef(0)
  const renderTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startStreamRenderer = useCallback(() => {
    displayedLengthRef.current = 0
    streamBufferRef.current = ''
    setStreamingContent('')

    if (renderTimerRef.current) clearInterval(renderTimerRef.current)

    renderTimerRef.current = setInterval(() => {
      const buffer = streamBufferRef.current
      const currentLen = displayedLengthRef.current

      if (currentLen >= buffer.length) return // nothing new to show

      // Reveal characters in batches — bigger batch = faster appearance
      // Adaptive: short responses show char-by-char, long ones batch more
      const remaining = buffer.length - currentLen
      const batchSize = remaining > 200 ? Math.min(remaining, 12) : remaining > 50 ? 6 : 3

      const nextLen = Math.min(currentLen + batchSize, buffer.length)
      displayedLengthRef.current = nextLen
      setStreamingContent(buffer.substring(0, nextLen))
    }, 20) // 50fps render rate — smooth but not overwhelming
  }, [])

  const stopStreamRenderer = useCallback(() => {
    if (renderTimerRef.current) {
      clearInterval(renderTimerRef.current)
      renderTimerRef.current = null
    }
    // Show any remaining buffered content immediately
    if (streamBufferRef.current) {
      setStreamingContent(streamBufferRef.current)
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (renderTimerRef.current) clearInterval(renderTimerRef.current)
    }
  }, [])

  const activeConversation = conversations.find(
    (c) => c.id === activeConversationId
  )
  const selectedDoc = documents.find((d) =>
    selectedDocumentIds.includes(d.id)
  )

  // Load user avatar
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const email = user.email || ''
        setUserInitials(email.split('@')[0].substring(0, 2).toUpperCase())
        supabase
          .from('profiles')
          .select('avatar_url, full_name, display_name')
          .eq('id', user.id)
          .single()
          .then(({ data }) => {
            if (data?.avatar_url) setUserAvatar(data.avatar_url)
            if (data?.full_name) {
              setUserInitials(
                data.full_name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
              )
            } else if (data?.display_name) {
              setUserInitials(data.display_name.substring(0, 2).toUpperCase())
            }
          })
      }
    })
  }, [])

  // Smart auto-scroll
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    shouldAutoScroll.current = distFromBottom < 120
  }, [])

  const scrollToBottom = useCallback(() => {
    if (shouldAutoScroll.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingContent, scrollToBottom])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (el) {
      el.style.height = '24px'
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`
    }
  }, [input])

  const loadConversation = async (conv: Conversation) => {
    setActiveConversationId(conv.id)
    const supabase = createClient()
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true })
    setMessages((data || []).map(mapMessageRow))
    shouldAutoScroll.current = true
  }

  const startNewConversation = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('conversations')
      .insert({
        user_id: user.id,
        title: 'New conversation',
        document_id: selectedDocumentIds[0] || null,
      })
      .select()
      .single()

    if (error || !data) return
    addConversation(data as Conversation)
    setActiveConversationId(data.id)
    setMessages([])
    shouldAutoScroll.current = true
  }

  const refreshConversationTitle = async (convId: string) => {
    const supabase = createClient()
    const { data } = await supabase.from('conversations').select('title').eq('id', convId).single()
    if (data?.title) updateConversationTitle(convId, data.title)
  }

  const sendMessage = async (content: string, convId: string, isFirst: boolean, imageDataUrls?: string[], fullContent?: string, docIds?: string[]) => {
    setIsStreaming(true)
    startStreamRenderer()
    shouldAutoScroll.current = true

    try {
      const documentIds = docIds || selectedDocumentIds
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: convId,
          message: content,
          document_ids: documentIds.length > 0 ? documentIds : [],
          images: imageDataUrls || [],
          full_content: fullContent, // includes base64 images for persistence
        }),
      })

      if (!res.ok) {
        let serverMessage = ''
        let errData: { error?: string; upgradeRequired?: boolean; requiredPlan?: string } | null = null
        try {
          errData = await res.json()
          serverMessage = errData?.error || ''
        } catch {
          serverMessage = await res.text().catch(() => '')
        }
        // Feature gated by plan — show the upgrade notice modal instead of an error bubble.
        if (res.status === 403 && errData?.upgradeRequired) {
          stopStreamRenderer()
          setUpgrade({
            open: true,
            plan: (errData.requiredPlan as RequiredPlan) || 'premium_lite',
            message: errData.error,
          })
          return
        }
        throw new Error(serverMessage || `API error: ${res.status}`)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No stream')

      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              if (parsed.content) {
                // Push to buffer — the renderer interval picks it up smoothly
                streamBufferRef.current += parsed.content
              }
            } catch { /* skip */ }
          }
        }
      }

      // Stream finished — flush any remaining buffer
      stopStreamRenderer()

      const finalContent = streamBufferRef.current.trim()
      if (finalContent) {
        addMessage({
          id: crypto.randomUUID(),
          conversation_id: convId,
          role: 'assistant',
          content: finalContent,
          created_at: new Date().toISOString(),
        })
        if (isFirst) setTimeout(() => refreshConversationTitle(convId), 1500)
      }
    } catch (err) {
      stopStreamRenderer()
      const message =
        err instanceof Error && err.message && !err.message.startsWith('API error')
          ? err.message
          : 'An error occurred while processing your request. Please try again.'
      addMessage({
        id: crypto.randomUUID(),
        conversation_id: convId,
        role: 'assistant',
        content: message,
        created_at: new Date().toISOString(),
      })
    } finally {
      setIsStreaming(false)
      setStreamingContent('')
      streamBufferRef.current = ''
      displayedLengthRef.current = 0
    }
  }

  // Convert files to base64 data URLs for images
  const filesToDataUrls = async (files: AttachedFile[]): Promise<string[]> => {
    const urls: string[] = []
    for (const af of files) {
      if (af.file.type.startsWith('image/') && af.preview) {
        urls.push(af.preview)
      }
    }
    return urls
  }

  const handleSend = async () => {
    if ((!input.trim() && attachedFiles.length === 0) || isStreaming) return

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Upload any PDF files first and add them to selected documents
    const pdfFiles = attachedFiles.filter((af) => af.file.type === 'application/pdf')
    const uploadedDocIds: string[] = [...selectedDocumentIds]
    
    for (const pdfFile of pdfFiles) {
      try {
        const filePath = `${user.id}/${Date.now()}_${pdfFile.file.name}`
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, pdfFile.file)

        if (uploadError) continue

        const title = pdfFile.file.name.replace(/\.pdf$/i, '')
        const { data: docData, error: insertError } = await supabase
          .from('documents')
          .insert({
            user_id: user.id,
            title,
            file_name: pdfFile.file.name,
            file_path: filePath,
            file_size: pdfFile.file.size,
            page_count: 0,
            status: 'processing',
          })
          .select()
          .single()

        if (insertError || !docData) continue

        addDocument(docData as Document)
        uploadedDocIds.push(docData.id)

        // Extract text from PDF
        fetch('/api/extract-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: docData.id, filePath }),
        }).then(async (res) => {
          if (res.ok) {
            const result = await res.json()
            if (result.success) {
              const { updateDocument } = useWorkspaceStore.getState()
              updateDocument(docData.id, { status: 'parsed', page_count: result.pageCount || 0 })
            }
          }
        }).catch(() => {
          const { updateDocument } = useWorkspaceStore.getState()
          updateDocument(docData.id, { status: 'parsed' })
        })
      } catch {
        // Continue with other files
      }
    }

    let convId = activeConversationId

    if (!convId) {
      const { data, error } = await supabase
        .from('conversations')
        .insert({
          user_id: user.id,
          title: 'New conversation',
          document_id: uploadedDocIds[0] || null,
        })
        .select()
        .single()

      if (error || !data) return
      addConversation(data as Conversation)
      setActiveConversationId(data.id)
      convId = data.id
      isFirstMessage.current = true
    } else {
      isFirstMessage.current = messages.length === 0
    }

    if (!convId) return

    // Build message content with image references
    let messageContent = input.trim()
    const imageFiles = attachedFiles.filter((af) => af.file.type.startsWith('image/'))
    const imageNames = imageFiles.map((af) => af.file.name)
    if (imageNames.length > 0 && !messageContent) {
      messageContent = `[Attached: ${imageNames.join(', ')}]`
    }
    // Add PDF names to message if any (using special marker that we'll parse for UI)
    if (pdfFiles.length > 0) {
      const pdfNames = pdfFiles.map((af) => af.file.name).join('|||')
      messageContent = messageContent 
        ? `${messageContent}\n[DOCS:${pdfNames}]` 
        : `[DOCS:${pdfNames}]`
    }

    // Build user message with any attached image previews stored in content
    const imageDataUrls = await filesToDataUrls(attachedFiles)
    const userMsgContent = imageDataUrls.length > 0
      ? `${messageContent}\n\n${imageDataUrls.map((url, i) => `![image-${i}](${url})`).join('\n')}`
      : messageContent

    const userMsg: Message = {
      id: crypto.randomUUID(),
      conversation_id: convId,
      role: 'user',
      content: userMsgContent,
      created_at: new Date().toISOString(),
    }

    addMessage(userMsg)
    const content = messageContent
    const fullContentWithImages = userMsgContent // includes embedded base64 images
    setInput('')
    setAttachedFiles([])
    if (textareaRef.current) textareaRef.current.style.height = '24px'

    // Use uploadedDocIds which includes any newly uploaded PDFs
    await sendMessage(content, convId, isFirstMessage.current, imageDataUrls, fullContentWithImages, uploadedDocIds)
  }

  const handleRegenerate = async (messageIndex: number) => {
    if (isStreaming) return
    const lastUserMsg = messages.slice(0, messageIndex).reverse().find((m) => m.role === 'user')
    if (!lastUserMsg || !activeConversationId) return

    const msgToRegenerate = messages[messageIndex]
    
    // Delete all messages after this one (since regenerating from this point)
    const messagesToDelete = messages.slice(messageIndex + 1)
    if (messagesToDelete.length > 0) {
      const supabase = createClient()
      for (const msg of messagesToDelete) {
        await supabase.from('messages').delete().eq('id', msg.id)
      }
      setMessages(messages.slice(0, messageIndex + 1))
    }

    // Store current content as a version before regenerating
    // Create a copy to avoid mutating state directly
    const existingVersions = msgToRegenerate.versions ? [...msgToRegenerate.versions] : []
    
    // If this is first regeneration, save the original as version 0
    if (existingVersions.length === 0) {
      existingVersions.push({
        id: crypto.randomUUID(),
        content: msgToRegenerate.content,
        created_at: msgToRegenerate.created_at,
      })
    }

    // Generate new response
    setIsStreaming(true)
    setRegeneratingMessageId(msgToRegenerate.id)
    startStreamRenderer()
    shouldAutoScroll.current = true

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: activeConversationId,
          message: lastUserMsg.content,
          document_ids: selectedDocumentIds.length > 0 ? selectedDocumentIds : [],
          images: [],
          regenerate: true, // Flag to not save user message again
        }),
      })

      if (!res.ok) throw new Error('Failed to get response')

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No stream')

      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              if (parsed.content) {
                streamBufferRef.current += parsed.content
              }
            } catch { /* skip */ }
          }
        }
      }

      stopStreamRenderer()
      const newContent = streamBufferRef.current.trim()

      if (newContent && newContent !== msgToRegenerate.content) {
        // Add new version
        const newVersion = {
          id: crypto.randomUUID(),
          content: newContent,
          created_at: new Date().toISOString(),
        }
        const updatedVersions = [...existingVersions, newVersion]
        
        // Update message with new content and versions
        updateMessage(msgToRegenerate.id, {
          content: newContent,
          versions: updatedVersions,
          activeVersionIndex: updatedVersions.length - 1,
        })

        // Also update local messages state to ensure UI reflects change
        updateMessage(msgToRegenerate.id, {
          content: newContent,
          versions: updatedVersions,
          activeVersionIndex: updatedVersions.length - 1,
        })

        // Update in database (store latest content + full version history so
        // the version arrows survive a page reload)
        const supabase = createClient()
        await supabase
          .from('messages')
          .update({
            content: newContent,
            versions: updatedVersions,
            active_version_index: updatedVersions.length - 1,
          })
          .eq('id', msgToRegenerate.id)
      }
    } catch {
      setStreamingContent('')
      streamBufferRef.current = ''
    } finally {
      setIsStreaming(false)
      setRegeneratingMessageId(null)
      setStreamingContent('')
      streamBufferRef.current = ''
      displayedLengthRef.current = 0
    }
  }

  const handleVersionChange = (messageId: string, newIndex: number) => {
    const msg = messages.find((m) => m.id === messageId)
    if (!msg || !msg.versions || newIndex < 0 || newIndex >= msg.versions.length) return

    const newContent = msg.versions[newIndex].content
    updateMessage(messageId, {
      content: newContent,
      activeVersionIndex: newIndex,
    })

    // Update in database (persist both the displayed content and which
    // version is active so the selection is restored after a reload)
    const supabase = createClient()
    supabase
      .from('messages')
      .update({ content: newContent, active_version_index: newIndex })
      .eq('id', messageId)
      .then(() => {})
  }

  const handleBranchNewChat = async (messageIndex: number) => {
    if (isStreaming) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Get all messages up to and including this message
    const messagesToBranch = messages.slice(0, messageIndex + 1)
    if (messagesToBranch.length === 0) return

    // Create a new conversation
    const { data: newConv, error } = await supabase
      .from('conversations')
      .insert({
        user_id: user.id,
        title: `Branch from ${activeConversation?.title || 'conversation'}`,
        document_id: selectedDocumentIds[0] || null,
      })
      .select()
      .single()

    if (error || !newConv) return

    // Copy messages to new conversation
    for (const msg of messagesToBranch) {
      await supabase.from('messages').insert({
        conversation_id: newConv.id,
        role: msg.role,
        content: msg.content,
        created_at: new Date().toISOString(),
      })
    }

    // Add and switch to new conversation
    addConversation(newConv as Conversation)
    setActiveConversationId(newConv.id)
    
    // Load messages for the new conversation
    const { data: newMessages } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', newConv.id)
      .order('created_at', { ascending: true })
      setMessages((newMessages || []).map(mapMessageRow))
  }

  const handleEditMessage = async (messageIndex: number) => {
    if (isStreaming || !activeConversationId) return
    const msgToEdit = messages[messageIndex]
    if (msgToEdit.role !== 'user') return

    // Extract text and images separately (documents are preserved in content for context)
    const { text, images } = extractImagesAndDocs(msgToEdit.content)
    setInput(text)
    setEditingMessageId(msgToEdit.id)
    setEditingImages(images) // Store images to re-attach when sending

    // Focus the textarea
    setTimeout(() => textareaRef.current?.focus(), 100)
  }

  const handleSendEditedMessage = async () => {
    if (!editingMessageId || !activeConversationId || isStreaming) return

    const editIndex = messages.findIndex((m) => m.id === editingMessageId)
    if (editIndex === -1) return

    // Delete this message and all messages after it
    const messagesToDelete = messages.slice(editIndex)
    const supabase = createClient()

    for (const msg of messagesToDelete) {
      await supabase.from('messages').delete().eq('id', msg.id)
    }

    // Update local state
    setMessages(messages.slice(0, editIndex))
    
    // Store images before clearing state
    const imagesToReattach = [...editingImages]
    setEditingMessageId(null)
    setEditingImages([])

    // Build message content with preserved images
    let messageContent = input.trim()
    const userMsgContent = imagesToReattach.length > 0
      ? `${messageContent}\n\n${imagesToReattach.map((url, i) => `![image-${i}](${url})`).join('\n')}`
      : messageContent

    const userMsg: Message = {
      id: crypto.randomUUID(),
      conversation_id: activeConversationId,
      role: 'user',
      content: userMsgContent,
      created_at: new Date().toISOString(),
    }

    addMessage(userMsg)
    setInput('')
    setAttachedFiles([])
    if (textareaRef.current) textareaRef.current.style.height = '24px'

    // Send to API
    await sendMessage(messageContent, activeConversationId, false, imagesToReattach, userMsgContent)
  }

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const valid = files.filter((f) => {
      if (f.type.startsWith('video/')) return false
      if (f.size > 50 * 1024 * 1024) return false
      return true
    })

    for (const f of valid) {
      if (f.type.startsWith('image/')) {
        // Compress/downscale images before encoding. Camera photos can be
        // several megabytes; the raw base64 data URL would blow past the
        // request size limit and make uploads slow. Resizing to a max edge
        // also matches the optimal input size for vision models.
        compressImageToDataUrl(f)
          .then((preview) => {
            setAttachedFiles((prev) => [...prev, { file: f, preview }])
          })
          .catch(() => {
            // Fallback to the original file if compression fails
            const reader = new FileReader()
            reader.onload = () => {
              setAttachedFiles((prev) => [...prev, { file: f, preview: reader.result as string }])
            }
            reader.readAsDataURL(f)
          })
      } else {
        setAttachedFiles((prev) => [...prev, { file: f }])
      }
    }
    // Reset input so same file can be re-selected
    e.target.value = ''
  }, [])

  const removeFile = useCallback((index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const clearAllFiles = useCallback(() => {
    setAttachedFiles([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center gap-3 px-4">
        <div className="min-w-0 flex-1">
          {activeConversation ? (
            <EditableTitle
              title={activeConversation.title}
              onSave={(newTitle) => {
                updateConversationTitle(activeConversation.id, newTitle)
                const supabase = createClient()
                supabase.from('conversations').update({ title: newTitle }).eq('id', activeConversation.id).then(() => {})
              }}
            />
          ) : (
            <p className="truncate font-mono text-[11px] font-semibold uppercase tracking-wider text-foreground">
              Study Mode
            </p>
          )}
          {selectedDoc && (
            <p className="flex items-center gap-1 truncate font-mono text-[9px] text-muted-foreground">
              <FileText className="h-2.5 w-2.5 shrink-0" />
              {selectedDoc.title}
            </p>
          )}
        </div>
        <Button
          onClick={startNewConversation}
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 rounded-md border-border font-mono text-[10px] uppercase tracking-wider"
        >
          <Plus className="h-3 w-3" />
          New
        </Button>
      </div>
      <Separator className="shrink-0" />

      {/* Messages Area — the only scrollable region */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="mx-auto max-w-3xl px-3 py-4 md:px-6">
          {messages.length === 0 && !streamingContent && (
            <div className="flex flex-col items-center justify-center py-16 md:py-24">
              <p className="font-mono text-lg font-bold uppercase tracking-wider text-foreground">
                Zequel
              </p>
              <p className="mt-4 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                {activeConversationId ? 'Start the conversation' : 'Study Mode'}
              </p>
              <p className="mt-2 max-w-sm text-center font-sans text-xs leading-relaxed text-muted-foreground/60">
                {selectedDoc
                  ? `Ask questions about "${selectedDoc.title}", solve problems, or explore any topic.`
                  : 'Ask questions, solve math, write code, or explore any topic. Select a document for contextual analysis.'}
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              userAvatar={userAvatar}
              userInitials={userInitials}
              isRegenerating={regeneratingMessageId === msg.id}
              onRegenerate={
                msg.role === 'assistant' && !isStreaming ? () => handleRegenerate(i) : undefined
              }
              onEdit={
                msg.role === 'user' && !isStreaming ? () => handleEditMessage(i) : undefined
              }
              onVersionChange={
                msg.role === 'assistant' && msg.versions && msg.versions.length > 1
                  ? (newIndex: number) => handleVersionChange(msg.id, newIndex)
                  : undefined
              }
              onBranchNewChat={
                msg.role === 'assistant' && !isStreaming ? () => handleBranchNewChat(i) : undefined
              }
            />
          ))}

          {/* Streaming response — typing effect */}
          {isStreaming && streamingContent && (
            <div className="mb-6 flex gap-2.5">
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Zequel
                </p>
                <div className="prose-zequel">
                  <MarkdownRenderer content={streamingContent} />
                  <span className="ml-0.5 inline-block h-[18px] w-[2px] animate-pulse bg-foreground/70" />
                </div>
              </div>
            </div>
          )}

          {/* Thinking indicator - dots animation (only when not regenerating a specific message) */}
          {isStreaming && !streamingContent && !regeneratingMessageId && (
            <div className="mb-6 flex gap-2.5">
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Zequel
                </p>
                <div className="flex items-center gap-1 py-2">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-foreground/60" style={{ animationDelay: '0ms' }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-foreground/60" style={{ animationDelay: '150ms' }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-foreground/60" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area — pinned at bottom, never scrolls */}
      <div className="shrink-0 border-t border-border bg-background px-3 pb-[env(safe-area-inset-bottom)] md:px-6">
        {/* Editing indicator */}
        {editingMessageId && (
          <div className="flex items-center gap-2 px-1 pt-2">
            <Pencil className="h-3.5 w-3.5 text-primary" />
            <span className="font-mono text-[10px] uppercase tracking-wider text-primary">
              Editing message
            </span>
          </div>
        )}
        {/* Editing images preview */}
        {editingImages.length > 0 && editingMessageId && (
          <div className="flex flex-wrap items-center gap-2 px-1 pt-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Attached:
            </span>
            {editingImages.map((src, i) => (
              <div
                key={i}
                className="group relative flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-2 py-1.5"
              >
                <img
                  src={src}
                  alt={`Attached image ${i + 1}`}
                  className="h-10 w-10 rounded object-cover"
                />
                <button
                  onClick={() => setEditingImages(prev => prev.filter((_, idx) => idx !== i))}
                  className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-foreground text-background transition-opacity"
                  aria-label="Remove image"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        {/* Attached files preview */}
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-1 pt-2">
            {attachedFiles.length > 1 && (
              <button
                onClick={clearAllFiles}
                className="flex h-8 items-center gap-1 rounded-lg border border-border bg-secondary/50 px-2 font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-3 w-3" />
                Clear all
              </button>
            )}
            {attachedFiles.map((af, i) => (
              <div
                key={i}
                className="group relative flex items-center gap-1.5 rounded-lg border border-border bg-secondary/50 px-2 py-1.5"
              >
                {af.preview ? (
                  <img
                    src={af.preview}
                    alt={af.file.name}
                    className="h-10 w-10 rounded object-cover"
                  />
                ) : af.file.type.startsWith('image/') ? (
                  <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                {!af.preview && (
                  <span className="max-w-[100px] truncate font-mono text-[10px] text-foreground">
                    {af.file.name}
                  </span>
                )}
                <button
                  onClick={() => removeFile(i)}
                  className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-foreground text-background transition-opacity"
                  aria-label={`Remove ${af.file.name}`}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="mx-auto flex max-w-3xl items-end gap-2 py-2.5">
          <div className="flex min-h-[44px] flex-1 items-end rounded-xl border border-border bg-secondary/30 transition-colors focus-within:border-ring focus-within:ring-1 focus-within:ring-ring">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="mb-2.5 ml-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground/50 transition-colors hover:text-foreground"
                  aria-label="Add attachment"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[140px] border-border bg-background">
                <DropdownMenuItem 
                  className="gap-2 font-mono text-[11px] uppercase tracking-wider cursor-pointer"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <Camera className="h-3.5 w-3.5" />
                  Camera
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="gap-2 font-mono text-[11px] uppercase tracking-wider cursor-pointer"
                  onClick={() => imageInputRef.current?.click()}
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                  Photos
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="gap-2 font-mono text-[11px] uppercase tracking-wider cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FileText className="h-3.5 w-3.5" />
                  Files
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.ppt,.pptx"
              className="hidden"
              onChange={handleFileSelect}
            />
            <input
              ref={imageInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={handleFileSelect}
              onClick={(e) => {
                // Reset value to allow re-selecting the same file
                (e.target as HTMLInputElement).value = ''
              }}
            />
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message Zequel..."
              disabled={isStreaming}
              rows={1}
              className="max-h-[160px] min-h-[24px] flex-1 resize-none bg-transparent px-2 py-2.5 font-sans text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/40 focus:outline-none disabled:opacity-50"
              onKeyDown={() => {
                // Enter creates a new paragraph naturally — send via button only
              }}
            />
            <button
              onClick={editingMessageId ? handleSendEditedMessage : handleSend}
              disabled={(!input.trim() && attachedFiles.length === 0) || isStreaming}
              className="mb-2.5 mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-foreground text-background transition-opacity hover:opacity-80 disabled:opacity-20"
              aria-label={editingMessageId ? "Save edit" : "Send message"}
            >
              {isStreaming ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : editingMessageId ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </button>
            {editingMessageId && (
              <button
                onClick={() => { setEditingMessageId(null); setEditingImages([]); setInput('') }}
                className="mb-2.5 mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Cancel edit"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <UpgradeDialog
        open={upgrade.open}
        onOpenChange={(open) => setUpgrade((prev) => ({ ...prev, open }))}
        featureName="Multi-Document Analysis"
        requiredPlan={upgrade.plan}
        message={upgrade.message}
      />
    </div>
  )
}

/* Editable title component */
function EditableTitle({ title, onSave }: { title: string; onSave: (t: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setValue(title) }, [title])
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  const save = () => {
    const trimmed = value.trim()
    if (trimmed && trimmed !== title) onSave(trimmed)
    else setValue(title)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') { setValue(title); setEditing(false) }
          }}
          onBlur={save}
          className="min-w-0 flex-1 rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-foreground outline-none focus:ring-1 focus:ring-ring"
        />
        <button onMouseDown={(e) => { e.preventDefault(); save() }} className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground">
          <Check className="h-3 w-3" />
        </button>
        <button onMouseDown={(e) => { e.preventDefault(); setValue(title); setEditing(false) }} className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground">
          <X className="h-3 w-3" />
        </button>
      </div>
    )
  }

  return (
    <button onClick={() => setEditing(true)} className="group flex items-center gap-1.5 truncate">
      <span className="truncate font-mono text-[11px] font-semibold uppercase tracking-wider text-foreground">{title}</span>
      <Pencil className="h-2.5 w-2.5 shrink-0 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground" />
    </button>
  )
}

/* Compress and downscale an image file into a JPEG data URL.
   Camera photos are often several megabytes; encoding them raw as base64
   exceeds the request size limit and is slow to upload. We cap the longest
   edge at 1568px (a good size for vision models) and re-encode as JPEG. */
function compressImageToDataUrl(
  file: File,
  maxEdge = 1568,
  quality = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      let { width, height } = img
      if (width > maxEdge || height > maxEdge) {
        if (width >= height) {
          height = Math.round((height * maxEdge) / width)
          width = maxEdge
        } else {
          width = Math.round((width * maxEdge) / height)
          height = maxEdge
        }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas not supported'))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      try {
        resolve(canvas.toDataURL('image/jpeg', quality))
      } catch (err) {
        reject(err as Error)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Failed to load image'))
    }
    img.src = objectUrl
  })
}

/* Extract images and document references from message content (markdown image syntax and DOCS marker) */
function extractImagesAndDocs(content: string): { text: string; images: string[]; documents: string[] } {
  const imgRegex = /!\[image-\d+\]\((data:image\/[^)]+)\)/g
  const docRegex = /\[DOCS:([^\]]+)\]/g
  const images: string[] = []
  const documents: string[] = []
  let match
  while ((match = imgRegex.exec(content)) !== null) {
    images.push(match[1])
  }
  while ((match = docRegex.exec(content)) !== null) {
    // Documents are separated by |||
    const docs = match[1].split('|||').filter(Boolean)
    documents.push(...docs)
  }
  // Also handle legacy format [Documents: name.pdf]
  const legacyDocRegex = /\[Documents:\s*([^\]]+)\]/g
  while ((match = legacyDocRegex.exec(content)) !== null) {
    const docs = match[1].split(',').map(d => d.trim()).filter(Boolean)
    documents.push(...docs)
  }
  const text = content
    .replace(imgRegex, '')
    .replace(docRegex, '')
    .replace(legacyDocRegex, '')
    .trim()
  return { text, images, documents }
}

/* Chat message component */
function ChatMessage({
  message,
  userAvatar,
  userInitials,
  isRegenerating,
  onRegenerate,
  onEdit,
  onVersionChange,
  onBranchNewChat,
  onShare,
}: {
  message: Message
  userAvatar: string | null
  userInitials: string
  isRegenerating?: boolean
  onRegenerate?: () => void
  onEdit?: () => void
  onVersionChange?: (newIndex: number) => void
  onBranchNewChat?: () => void
  onShare?: () => void
}) {
  const hasVersions = message.versions && message.versions.length > 1
  const activeVersionIndex = message.activeVersionIndex ?? 0
  const totalVersions = message.versions?.length ?? 1
  const isUser = message.role === 'user'
  const [copied, setCopied] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartPos = useRef<{ x: number; y: number } | null>(null)

  const { text: displayText, images: userImages, documents: userDocuments } = isUser
    ? extractImagesAndDocs(message.content)
    : { text: message.content, images: [], documents: [] }

  const copyContent = () => {
    const textOnly = isUser ? displayText : message.content
    navigator.clipboard.writeText(textOnly).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
    setShowMenu(false)
  }

  const shareContent = async () => {
    const textOnly = isUser ? displayText : message.content
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Zequel Response',
          text: textOnly,
        })
      } catch {
        // User cancelled or share failed, fallback to copy
        await navigator.clipboard.writeText(textOnly)
      }
    } else {
      // Fallback to copy
      await navigator.clipboard.writeText(textOnly)
    }
    setShowMenu(false)
    if (onShare) onShare()
  }

  const exportAsPdf = async () => {
    if (isExportingPdf) return
    setIsExportingPdf(true)
    setPdfError(null)
    try {
      const firstLine = message.content.split('\n').find((line) => line.trim()) ?? ''
      const title = firstLine.replace(/[#*_`>\[\]]/g, '').trim().slice(0, 80) || 'Zequel Response'
      const response = await fetch('/api/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: message.content, title }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || 'PDF export failed')
      }
      const blob = await response.blob()
      const disposition = response.headers.get('Content-Disposition') ?? ''
      const fileName = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'zequel-response.pdf'
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : 'PDF export failed')
      setTimeout(() => setPdfError(null), 4000)
    } finally {
      setIsExportingPdf(false)
    }
  }

  // Long press detection — only for user messages, cancel if moved more than 10px
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isUser) return
    const touch = e.touches[0]
    touchStartPos.current = { x: touch.clientX, y: touch.clientY }
    longPressTimer.current = setTimeout(() => {
      setShowMenu(true)
    }, 500)
  }, [isUser])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!longPressTimer.current || !touchStartPos.current) return
    const touch = e.touches[0]
    const dx = Math.abs(touch.clientX - touchStartPos.current.x)
    const dy = Math.abs(touch.clientY - touchStartPos.current.y)
    // If moved more than 10px, cancel long press (user is scrolling)
    if (dx > 10 || dy > 10) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
      touchStartPos.current = null
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    touchStartPos.current = null
  }, [])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current)
    }
  }, [])

  if (isUser) {
    return (
      <div className="group/msg mb-4 flex justify-end">
        <div className="flex max-w-[85%] flex-row-reverse gap-2.5 md:max-w-[75%]">
          <Avatar className="mt-0.5 h-6 w-6 shrink-0 border border-border">
            {userAvatar && <AvatarImage src={userAvatar} alt="You" />}
            <AvatarFallback className="bg-secondary font-mono text-[8px] text-foreground">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <div className="relative">
            <div
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
              onContextMenu={(e) => { e.preventDefault(); setShowMenu(true) }}
              className="cursor-default select-text rounded-2xl rounded-tr-sm bg-foreground/10 px-3.5 py-2.5"
            >
              {userImages.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {userImages.map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      alt={`Attached image ${i + 1}`}
                      className="max-h-48 max-w-[200px] rounded-lg border border-border object-contain"
                    />
                  ))}
                </div>
              )}
              {userDocuments.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {userDocuments.map((docName, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 rounded-md bg-foreground/5 px-2 py-1"
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0 text-foreground/60" />
                      <span className="font-mono text-[11px] text-foreground/80">
                        {docName}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {displayText && (
                <p className="whitespace-pre-wrap break-words font-sans text-[14px] leading-[1.65] text-foreground">
                  {displayText}
                </p>
              )}
            </div>
            {/* User message menu - positioned absolutely */}
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full z-50 mt-1 min-w-[140px] rounded-md border border-border bg-background p-1 shadow-lg">
                  <button
                    onClick={copyContent}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 font-mono text-[11px] uppercase tracking-wider text-foreground hover:bg-secondary"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </button>
                  <button
                    onClick={shareContent}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 font-mono text-[11px] uppercase tracking-wider text-foreground hover:bg-secondary"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    Share
                  </button>
                  {onEdit && (
                    <button
                      onClick={() => { setShowMenu(false); onEdit() }}
                      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 font-mono text-[11px] uppercase tracking-wider text-foreground hover:bg-secondary"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // AI message — left-aligned with Zequel text only
  return (
    <div className="group/msg mb-6 flex gap-2.5">
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          Zequel
        </p>
        {isRegenerating ? (
          <div className="flex items-center gap-1 py-2">
            <span className="h-2 w-2 animate-bounce rounded-full bg-foreground/60" style={{ animationDelay: '0ms' }} />
            <span className="h-2 w-2 animate-bounce rounded-full bg-foreground/60" style={{ animationDelay: '150ms' }} />
            <span className="h-2 w-2 animate-bounce rounded-full bg-foreground/60" style={{ animationDelay: '300ms' }} />
          </div>
        ) : (
          <div className="prose-zequel">
            <MarkdownRenderer content={message.content} />
          </div>
        )}
        {/* Action icons row */}
        <div className="mt-2.5 flex items-center gap-0.5">
          {/* Version navigation — only shows if multiple versions exist, positioned at left edge */}
          {hasVersions && onVersionChange && (
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => onVersionChange(activeVersionIndex - 1)}
                disabled={activeVersionIndex === 0}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/40 transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground/40"
                title="Previous version"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="min-w-[32px] text-center font-mono text-[10px] text-muted-foreground">
                {activeVersionIndex + 1}/{totalVersions}
              </span>
              <button
                onClick={() => onVersionChange(activeVersionIndex + 1)}
                disabled={activeVersionIndex === totalVersions - 1}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/40 transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground/40"
                title="Next version"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {onRegenerate && (
            <button onClick={onRegenerate} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/40 transition-colors hover:bg-secondary hover:text-foreground" title="Regenerate">
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
          <button onClick={copyContent} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/40 transition-colors hover:bg-secondary hover:text-foreground" title="Copy">
            {copied ? <Check className="h-3.5 w-3.5 text-foreground" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <button onClick={shareContent} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/40 transition-colors hover:bg-secondary hover:text-foreground" title="Share">
            <Share2 className="h-3.5 w-3.5" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/40 transition-colors hover:bg-secondary hover:text-foreground" title="More">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[160px] border-border bg-background">
              <DropdownMenuItem 
                className="gap-2 font-mono text-[11px] uppercase tracking-wider cursor-pointer"
                onClick={onBranchNewChat}
              >
                <GitBranch className="h-3.5 w-3.5" />
                Branch in new chat
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="gap-2 font-mono text-[11px] uppercase tracking-wider cursor-pointer"
                onClick={exportAsPdf}
                disabled={isExportingPdf}
              >
                {isExportingPdf ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                {isExportingPdf ? 'Exporting…' : 'Export as PDF'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {isExportingPdf && (
            <span role="status" className="ml-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Generating PDF…
            </span>
          )}
          {pdfError && (
            <span role="alert" className="ml-1 font-sans text-[11px] text-destructive">
              {pdfError}
            </span>
          )}
        </div>
      </div>

    </div>
  )
}
