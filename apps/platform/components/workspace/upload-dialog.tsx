'use client'

import { useState, useCallback, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@zequel/ui/components/dialog'
import { Button } from '@zequel/ui/components/button'
import { Progress } from '@zequel/ui/components/progress'
import { createClient } from '@zequel/shared/supabase/client'
import { useWorkspaceStore } from '@/lib/store'
import type { Document } from '@zequel/types'
import { Upload, FileText, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
}

type ProcessingStage = 'idle' | 'uploading' | 'extracting' | 'analyzing' | 'complete' | 'failed'

const STAGE_LABELS: Record<ProcessingStage, string> = {
  idle: '',
  uploading: 'Uploading',
  extracting: 'Extracting text',
  analyzing: 'Analyzing visual content',
  complete: 'Processing complete',
  failed: 'Processing failed',
}

export function UploadDialog({ open, onOpenChange, userId }: UploadDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [stage, setStage] = useState<ProcessingStage>('idle')
  const [visualWarning, setVisualWarning] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { addDocument } = useWorkspaceStore()

  const ALLOWED_TYPES = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/webp',
    'text/plain',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ]

  const handleFile = (f: File) => {
    setError(null)
    if (!ALLOWED_TYPES.includes(f.type) && !f.type.startsWith('image/')) {
      setError('Unsupported file type. Upload PDFs, images, or documents.')
      return
    }
    if (f.type.startsWith('video/')) {
      setError('Video files are not supported.')
      return
    }
    if (f.size > 50 * 1024 * 1024) {
      setError('File must be under 50MB.')
      return
    }
    setFile(f)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [])

  const handleUpload = async () => {
    if (!file) return
    setIsUploading(true)
    setProgress(10)
    setError(null)
    setVisualWarning(null)
    setStage('uploading')
    let hadVisualWarning = false

    const supabase = createClient()

    try {
      const filePath = `${userId}/${Date.now()}_${file.name}`

      setProgress(30)
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      setProgress(70)

      // Insert document metadata
      const title = file.name.replace(/\.pdf$/i, '')
      const { data, error: insertError } = await supabase
        .from('documents')
        .insert({
          user_id: userId,
          title,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          page_count: 0,
          status: 'processing' as const,
        })
        .select()
        .single()

      if (insertError) throw insertError

      setProgress(80)
      addDocument(data as Document)

      const { updateDocument } = useWorkspaceStore.getState()

      if (file.type === 'application/pdf') {
        setStage('extracting')
        setProgress(85)
        const extractRes = await fetch('/api/extract-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: data.id }),
        })
        const extractResult = await extractRes.json().catch(() => ({}))
        if (!extractRes.ok || !extractResult.success) {
          updateDocument(data.id, { status: 'error' })
          throw new Error(extractResult.error || 'Text extraction failed.')
        }
        updateDocument(data.id, {
          status: extractResult.needsOcr ? 'processing' : 'parsed',
          page_count: extractResult.pageCount || 0,
        })

        if (extractResult.visualStatus !== 'complete') {
          setStage('analyzing')
          setProgress(92)
          const visualRes = await fetch('/api/extract-text/visual', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ documentId: data.id }),
          })
          const visualResult = await visualRes.json().catch(() => ({}))
          if (visualResult.documentStatus) updateDocument(data.id, { status: visualResult.documentStatus })
          if (!visualRes.ok || !visualResult.success) {
            hadVisualWarning = true
            setVisualWarning(
              visualResult.reason || visualResult.error || 'Visual analysis did not complete. Text is still available.',
            )
          }
        }
      } else {
        updateDocument(data.id, { status: 'parsed' })
      }

      setStage('complete')
      setProgress(100)

      // Reset and close
      setTimeout(() => {
        setFile(null)
        setProgress(0)
        setStage('idle')
        setVisualWarning(null)
        setIsUploading(false)
        onOpenChange(false)
      }, hadVisualWarning ? 3500 : 600)
    } catch (err: unknown) {
      setStage('failed')
      setError(err instanceof Error ? err.message : 'Upload failed.')
      setIsUploading(false)
      setProgress(0)
    }
  }

  const reset = () => {
    setFile(null)
    setError(null)
    setProgress(0)
    setStage('idle')
    setVisualWarning(null)
    setIsUploading(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!isUploading) {
          reset()
          onOpenChange(v)
        }
      }}
    >
      <DialogContent className="border-border bg-background sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm font-semibold uppercase tracking-wider text-foreground">
            Upload Document
          </DialogTitle>
        </DialogHeader>

        {!file ? (
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragOver(true)
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-6 py-12 transition-colors',
              isDragOver
                ? 'border-foreground bg-secondary'
                : 'border-border hover:border-foreground/40'
            )}
            role="button"
            tabIndex={0}
            aria-label="Upload PDF document"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                inputRef.current?.click()
              }
            }}
          >
            <Upload className="h-6 w-6 text-muted-foreground" />
            <p className="mt-3 font-mono text-xs text-muted-foreground">
              Drop file or click to browse
            </p>
            <p className="mt-1 font-mono text-[10px] text-muted-foreground/60">
              PDF, images, docs — Max 50MB
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
              }}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-md border border-border px-3 py-2.5">
              <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-sans text-sm font-medium text-foreground" title={file.name}>
                  {file.name.length > 30 ? `${file.name.slice(0, 20)}...${file.name.slice(-7)}` : file.name}
                </p>
                <p className="font-mono text-[10px] text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              {!isUploading && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation()
                    reset()
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>

            {isUploading && (
              <div className="flex flex-col gap-1.5">
                <Progress value={progress} className="h-1" />
                <p className="font-mono text-[10px] text-muted-foreground" role="status" aria-live="polite">
                  {STAGE_LABELS[stage]}
                  {stage !== 'complete' && stage !== 'failed' ? '...' : ''}
                </p>
                {visualWarning && (
                  <p className="font-mono text-[10px] text-muted-foreground">
                    Visual analysis not completed: {visualWarning}
                  </p>
                )}
              </div>
            )}

            {!isUploading && stage === 'failed' && (
              <p className="font-mono text-[10px] text-destructive" role="status">
                {STAGE_LABELS.failed}
              </p>
            )}

            {error && (
              <p className="font-mono text-xs text-destructive-foreground">
                {error}
              </p>
            )}

            {!isUploading && (
              <Button
                onClick={handleUpload}
                className="h-9 w-full rounded-md bg-foreground font-mono text-xs font-medium uppercase tracking-wider text-background hover:bg-foreground/90"
              >
                Upload
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
