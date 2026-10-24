'use client'

import dynamic from 'next/dynamic'
import useSWR from 'swr'
import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@zequel/ui/components/dialog'
import { Button } from '@zequel/ui/components/button'
import { Badge } from '@zequel/ui/components/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@zequel/ui/components/tabs'
import { FileText, Copy, Check, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react'
import { createClient } from '@zequel/shared/supabase/client'
import type { Document } from '@zequel/types'
import { MarkdownRenderer } from '@/components/markdown-renderer'

const PdfPageViewer = dynamic(() => import('./pdf-page-viewer').then((m) => m.PdfPageViewer), {
  ssr: false,
  loading: () => (
    <p className="py-12 text-center font-mono text-[11px] text-muted-foreground">Loading viewer...</p>
  ),
})

interface DocumentViewerProps {
  document: Document | null
  isOpen: boolean
  onClose: () => void
  extractedText: string | null
  isLoading?: boolean
}

interface DocumentDetails {
  signedUrl: string | null
  visualStatus: string | null
  visualAnalysis: string | null
  processingError: string | null
}

const SIGNED_URL_TTL_SECONDS = 60 * 30

async function fetchDocumentDetails([, id, filePath]: [string, string, string]): Promise<DocumentDetails> {
  const supabase = createClient()
  const signed = filePath.toLowerCase().endsWith('.pdf')
    ? await supabase.storage.from('documents').createSignedUrl(filePath, SIGNED_URL_TTL_SECONDS)
    : { data: null }

  const full = await supabase
    .from('documents')
    .select('visual_status, visual_analysis, processing_error')
    .eq('id', id)
    .maybeSingle()

  if (!full.error) {
    return {
      signedUrl: signed.data?.signedUrl ?? null,
      visualStatus: full.data?.visual_status ?? null,
      visualAnalysis: full.data?.visual_analysis ?? null,
      processingError: full.data?.processing_error ?? null,
    }
  }

  // Keep original-document preview working while migration 002 is being applied.
  return {
    signedUrl: signed.data?.signedUrl ?? null,
    visualStatus: null,
    visualAnalysis: null,
    processingError: null,
  }
}

const VISUAL_STATUS_COPY: Record<string, string> = {
  pending: 'Visual analysis has not run for this document yet.',
  processing: 'Visual content is being analyzed.',
  skipped: 'Visual analysis was skipped.',
  failed: 'Visual analysis failed.',
  not_applicable: 'Visual analysis applies to PDF documents only.',
}

function StatusBadge({ status }: { status: Document['status'] }) {
  if (status === 'parsed') {
    return (
      <Badge variant="outline" className="gap-1 border-green-200 bg-green-500/10 font-mono text-[10px] uppercase tracking-wider text-green-700">
        <CheckCircle2 className="h-3 w-3" />
        Parsed
      </Badge>
    )
  }
  if (status === 'processing') {
    return (
      <Badge variant="outline" className="gap-1 border-yellow-200 bg-yellow-500/10 font-mono text-[10px] uppercase tracking-wider text-yellow-700">
        <Loader2 className="h-3 w-3 animate-spin" />
        Processing
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="gap-1 border-red-200 bg-red-500/10 font-mono text-[10px] uppercase tracking-wider text-red-700">
      <AlertTriangle className="h-3 w-3" />
      Error
    </Badge>
  )
}

function EmptyNote({ children, tone = 'muted' }: { children: React.ReactNode; tone?: 'muted' | 'error' }) {
  return (
    <p className={`py-8 text-center font-mono text-[11px] ${tone === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
      {children}
    </p>
  )
}

export function DocumentViewer({ document, isOpen, onClose, extractedText, isLoading }: DocumentViewerProps) {
  const [copied, setCopied] = useState(false)
  const { data: details, isLoading: isLoadingDetails } = useSWR(
    isOpen && document ? ['document-details', document.id, document.file_path] : null,
    fetchDocumentDetails,
    { revalidateOnFocus: false },
  )

  const handleCopyText = () => {
    if (!extractedText) return
    navigator.clipboard.writeText(extractedText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!document) return null

  const isPdf = document.file_path?.toLowerCase().endsWith('.pdf')
  const visualStatus = details?.visualStatus ?? 'pending'

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex h-[88vh] max-w-4xl flex-col gap-0 overflow-hidden border-border bg-background p-0">
        <DialogTitle className="sr-only">{document.title}</DialogTitle>
        <DialogDescription className="sr-only">Original pages and extracted content of {document.file_name}</DialogDescription>

        <div className="flex shrink-0 items-center gap-3 border-b border-border px-6 py-4 pr-12">
          <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-sans text-sm font-semibold text-foreground">{document.title}</h2>
            <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
              {document.page_count > 0 ? `${document.page_count} pages` : 'N/A'} • {document.file_name}
            </p>
          </div>
          <StatusBadge status={document.status} />
        </div>

        <Tabs defaultValue={isPdf ? 'original' : 'text'} className="flex min-h-0 flex-1 flex-col gap-0">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-2">
            <TabsList className="h-8">
              {isPdf && (
                <TabsTrigger value="original" className="font-mono text-[10px] uppercase tracking-wider">
                  Original
                </TabsTrigger>
              )}
              <TabsTrigger value="text" className="font-mono text-[10px] uppercase tracking-wider">
                Text
              </TabsTrigger>
              {isPdf && (
                <TabsTrigger value="visual" className="font-mono text-[10px] uppercase tracking-wider">
                  Visuals
                </TabsTrigger>
              )}
            </TabsList>
            {extractedText && (
              <Button size="sm" variant="outline" className="h-7 gap-2 font-mono text-[11px] uppercase tracking-wider" onClick={handleCopyText}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy Text'}
              </Button>
            )}
          </div>

          {isPdf && (
            <TabsContent value="original" className="m-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
              {isLoadingDetails ? (
                <EmptyNote>Preparing document...</EmptyNote>
              ) : details?.signedUrl ? (
                <PdfPageViewer url={details.signedUrl} />
              ) : (
                <EmptyNote tone="error">The original file could not be loaded.</EmptyNote>
              )}
            </TabsContent>
          )}

          <TabsContent value="text" className="m-0 min-h-0 flex-1 overflow-y-auto px-6 py-4 data-[state=inactive]:hidden">
            {isLoading ? (
              <EmptyNote>Loading document content...</EmptyNote>
            ) : extractedText ? (
              <div className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-foreground">
                {extractedText}
              </div>
            ) : document.status === 'processing' ? (
              <EmptyNote>Document is being processed...</EmptyNote>
            ) : document.status === 'parsed' ? (
              <EmptyNote>No machine-readable text. See the Visuals tab for OCR output.</EmptyNote>
            ) : (
              <EmptyNote tone="error">Failed to parse document</EmptyNote>
            )}
          </TabsContent>

          {isPdf && (
            <TabsContent value="visual" className="m-0 min-h-0 flex-1 overflow-y-auto px-6 py-4 data-[state=inactive]:hidden">
              {isLoadingDetails ? (
                <EmptyNote>Loading visual analysis...</EmptyNote>
              ) : visualStatus === 'complete' ? (
                details?.visualAnalysis ? (
                  <MarkdownRenderer content={details.visualAnalysis} />
                ) : (
                  <EmptyNote>Analysis complete: no images, charts, tables or diagrams were found.</EmptyNote>
                )
              ) : (
                <EmptyNote tone={visualStatus === 'failed' ? 'error' : 'muted'}>
                  {VISUAL_STATUS_COPY[visualStatus] ?? VISUAL_STATUS_COPY.pending}
                  {details?.processingError ? ` ${details.processingError}` : ''}
                </EmptyNote>
              )}
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
