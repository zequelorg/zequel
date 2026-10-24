'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@zequel/shared/supabase/client'
import { Loader2, Download, FileText, AlertCircle } from 'lucide-react'
import { Button } from '@zequel/ui/components/button'
import type { CodingFile } from '@zequel/types'

const UPLOAD_BUCKET = 'coding-files'

/**
 * Read-only viewer for uploaded assets. Images render inline; everything else
 * gets a download link. URLs are short-lived signed links from the private
 * bucket, so each file generates its own.
 */
export function UploadPreview({ file }: { file: CodingFile }) {
  const [url, setUrl] = useState<string | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    setUrl(null)

    const run = async () => {
      if (!file.storage_path) {
        if (!cancelled) setStatus('error')
        return
      }
      const supabase = createClient()
      const { data, error } = await supabase.storage
        .from(UPLOAD_BUCKET)
        .createSignedUrl(file.storage_path, 60 * 60)
      if (cancelled) return
      if (error || !data?.signedUrl) {
        setStatus('error')
        return
      }
      setUrl(data.signedUrl)
      setStatus('ready')
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [file.storage_path])

  const mime = file.mime_type ?? ''
  const isImage = mime.startsWith('image/')
  const isPdf = mime === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  const isVideo = mime.startsWith('video/')
  const isAudio = mime.startsWith('audio/')

  if (status === 'loading') {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (status === 'error' || !url) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
        <AlertCircle className="h-6 w-6 text-muted-foreground" />
        <p className="font-sans text-sm text-muted-foreground">
          Could not load this file.
        </p>
      </div>
    )
  }

  // PDFs and images open directly in the editor surface (full height).
  if (isPdf) {
    return (
      <div className="flex h-full flex-col">
        <iframe
          src={url}
          title={file.name}
          className="min-h-0 w-full flex-1 border-0 bg-background"
        />
      </div>
    )
  }

  if (isImage) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 overflow-auto bg-secondary/20 p-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url || '/placeholder.svg'}
          alt={file.name}
          className="max-h-full max-w-full rounded-md border border-border object-contain"
        />
        <a href={url} download={file.name} target="_blank" rel="noreferrer">
          <Button variant="outline" size="sm" className="gap-2 font-mono text-xs">
            <Download className="h-3.5 w-3.5" />
            Download
          </Button>
        </a>
      </div>
    )
  }

  if (isVideo) {
    return (
      <div className="flex h-full items-center justify-center bg-secondary/20 p-6">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video src={url} controls className="max-h-full max-w-full rounded-md border border-border" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 overflow-auto p-6">
      {isAudio ? (
        <audio src={url} controls className="w-full max-w-md" />
      ) : (
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <FileText className="h-10 w-10" />
          <span className="font-mono text-xs">{mime || 'file'}</span>
        </div>
      )}
      <a href={url} download={file.name} target="_blank" rel="noreferrer">
        <Button variant="outline" size="sm" className="gap-2 font-mono text-xs">
          <Download className="h-3.5 w-3.5" />
          Download
        </Button>
      </a>
    </div>
  )
}
