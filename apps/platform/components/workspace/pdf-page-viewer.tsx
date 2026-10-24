'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { Button } from '@zequel/ui/components/button'
import { ChevronLeft, ChevronRight, Loader2, Minus, Plus, Maximize2 } from 'lucide-react'

interface PdfPageViewerProps {
  url: string
}

const MIN_SCALE = 0.5
const MAX_SCALE = 3
const SCALE_STEP = 0.25

async function loadPdfJs() {
  const pdfjs = await import('pdfjs-dist')
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
  }
  return pdfjs
}

function PdfPage({
  pdf,
  pageNumber,
  scale,
  onVisible,
}: {
  pdf: PDFDocumentProxy
  pageNumber: number
  scale: number
  onVisible: (page: number) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isNear, setIsNear] = useState(pageNumber <= 2)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  const [renderFailed, setRenderFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    pdf.getPage(pageNumber).then((page) => {
      if (cancelled) return
      const viewport = page.getViewport({ scale })
      setSize({ width: viewport.width, height: viewport.height })
    })
    return () => {
      cancelled = true
    }
  }, [pdf, pageNumber, scale])

  useEffect(() => {
    const node = containerRef.current
    if (!node) return
    const nearObserver = new IntersectionObserver(([entry]) => setIsNear(entry.isIntersecting), {
      rootMargin: '800px 0px',
    })
    const visibleObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onVisible(pageNumber)
      },
      { threshold: 0.5 },
    )
    nearObserver.observe(node)
    visibleObserver.observe(node)
    return () => {
      nearObserver.disconnect()
      visibleObserver.disconnect()
    }
  }, [pageNumber, onVisible])

  useEffect(() => {
    if (!isNear || !canvasRef.current) return
    let task: RenderTask | null = null
    let cancelled = false
    const canvas = canvasRef.current

    setRenderFailed(false)
    pdf
      .getPage(pageNumber)
      .then((page) => {
        if (cancelled) return
        const ratio = window.devicePixelRatio || 1
        const viewport = page.getViewport({ scale })
        canvas.width = Math.floor(viewport.width * ratio)
        canvas.height = Math.floor(viewport.height * ratio)
        canvas.style.width = `${viewport.width}px`
        canvas.style.height = `${viewport.height}px`
        const context = canvas.getContext('2d')
        if (!context) {
          setRenderFailed(true)
          return
        }
        task = page.render({
          canvasContext: context,
          viewport,
          transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined,
        })
        task.promise.catch((err: unknown) => {
          // Cancelling a render (scroll away, unmount, rescale) is expected — ignore it.
          if (cancelled || (err as { name?: string })?.name === 'RenderingCancelledException') return
          console.error(`[Zequel] Failed to render PDF page ${pageNumber}:`, err)
          setRenderFailed(true)
        })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        console.error(`[Zequel] Failed to load PDF page ${pageNumber}:`, err)
        setRenderFailed(true)
      })

    return () => {
      cancelled = true
      task?.cancel()
      if (!isNear) canvas.width = 0
    }
  }, [pdf, pageNumber, scale, isNear])

  return (
    <div
      ref={containerRef}
      data-page={pageNumber}
      className="relative mx-auto bg-card shadow-sm ring-1 ring-border"
      style={size ? { width: size.width, height: size.height } : { width: 600 * scale, height: 800 * scale }}
      aria-label={`Page ${pageNumber}`}
      role="img"
    >
      {renderFailed ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-4 text-center">
          <p className="font-mono text-[11px] text-destructive">Page {pageNumber} could not be rendered.</p>
          <p className="font-mono text-[10px] text-muted-foreground">The page may be corrupted or unsupported.</p>
        </div>
      ) : (
        isNear && <canvas ref={canvasRef} className="block" />
      )}
    </div>
  )
}

export function PdfPageViewer({ url }: PdfPageViewerProps) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scale, setScale] = useState(1)
  const [currentPage, setCurrentPage] = useState(1)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    let loaded: PDFDocumentProxy | null = null
    setPdf(null)
    setError(null)

    loadPdfJs()
      .then((pdfjs) => pdfjs.getDocument({ url, disableAutoFetch: true, disableStream: false }).promise)
      .then((doc) => {
        loaded = doc
        if (cancelled) {
          doc.destroy()
          return
        }
        setPdf(doc)
        setCurrentPage(1)
        const width = scrollRef.current?.clientWidth ?? 0
        doc.getPage(1).then((page) => {
          const natural = page.getViewport({ scale: 1 }).width
          if (width && natural && !cancelled) {
            setScale(Math.min(1.5, Math.max(MIN_SCALE, (width - 48) / natural)))
          }
        })
      })
      .catch((err) => {
        console.error('[Zequel] PDF preview failed:', err)
        if (!cancelled) setError('The original PDF could not be displayed.')
      })

    return () => {
      cancelled = true
      loaded?.destroy()
    }
  }, [url])

  const goToPage = useCallback((page: number) => {
    const target = scrollRef.current?.querySelector<HTMLElement>(`[data-page="${page}"]`)
    target?.scrollIntoView({ block: 'start' })
    setCurrentPage(page)
  }, [])

  const fitWidth = useCallback(async () => {
    if (!pdf || !scrollRef.current) return
    const page = await pdf.getPage(currentPage)
    const natural = page.getViewport({ scale: 1 }).width
    setScale(Math.min(MAX_SCALE, Math.max(MIN_SCALE, (scrollRef.current.clientWidth - 48) / natural)))
  }, [pdf, currentPage])

  const pageCount = pdf?.numPages ?? 0

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-2">
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => goToPage(Math.max(1, currentPage - 1))}
            disabled={!pdf || currentPage <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <label className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
            <span className="sr-only">Current page</span>
            <input
              type="number"
              min={1}
              max={pageCount || 1}
              value={currentPage}
              disabled={!pdf}
              onChange={(e) => {
                const page = Number(e.target.value)
                if (page >= 1 && page <= pageCount) goToPage(page)
              }}
              className="h-7 w-12 rounded-md border border-border bg-background text-center text-foreground"
            />
            <span>/ {pageCount || '–'}</span>
          </label>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => goToPage(Math.min(pageCount, currentPage + 1))}
            disabled={!pdf || currentPage >= pageCount}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => setScale((s) => Math.max(MIN_SCALE, s - SCALE_STEP))}
            disabled={!pdf || scale <= MIN_SCALE}
            aria-label="Zoom out"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="w-12 text-center font-mono text-[11px] text-muted-foreground" aria-live="polite">
            {Math.round(scale * 100)}%
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => setScale((s) => Math.min(MAX_SCALE, s + SCALE_STEP))}
            disabled={!pdf || scale >= MAX_SCALE}
            aria-label="Zoom in"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={fitWidth} disabled={!pdf} aria-label="Fit to width">
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto bg-muted/40" style={{ WebkitOverflowScrolling: 'touch' }}>
        {error ? (
          <p className="py-12 text-center font-mono text-[11px] text-destructive">{error}</p>
        ) : !pdf ? (
          <div className="flex items-center justify-center gap-2 py-12 font-mono text-[11px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading original document...
          </div>
        ) : (
          <div className="flex w-max min-w-full flex-col items-center gap-4 p-6">
            {Array.from({ length: pageCount }, (_, i) => (
              <PdfPage key={i + 1} pdf={pdf} pageNumber={i + 1} scale={scale} onVisible={setCurrentPage} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
