import 'server-only'
import { createHash } from 'node:crypto'

export interface PdfPage {
  page: number
  text: string
}

export interface PdfTextExtraction {
  pages: PdfPage[]
  pageCount: number
  text: string
  lowTextPages: number[]
}

interface TextItem {
  str: string
  transform: number[]
  height?: number
}

interface PageData {
  pageIndex: number
  getTextContent: (options: Record<string, boolean>) => Promise<{ items: TextItem[] }>
}

const LOW_TEXT_THRESHOLD = 40
const HEADING_SCALE = 1.25
const VISUAL_ANALYSIS_MAX_BYTES = 20 * 1024 * 1024
const VISUAL_MODEL = 'google/gemini-2.5-flash'

export function hashContent(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

function fontSize(item: TextItem): number {
  return Math.abs(item.transform[3] || item.height || 0)
}

function renderPageText(items: TextItem[]): string {
  const lines: { text: string; size: number }[] = []
  let lastY: number | undefined
  for (const item of items) {
    const y = item.transform[5]
    const size = fontSize(item)
    if (lastY === undefined || Math.abs(y - lastY) < 1) {
      const current = lines[lines.length - 1]
      if (current) {
        current.text += item.str
        current.size = Math.max(current.size, size)
      } else {
        lines.push({ text: item.str, size })
      }
    } else {
      lines.push({ text: item.str, size })
    }
    lastY = y
  }

  const sizes = lines.filter((line) => line.text.trim()).map((line) => line.size).sort((a, b) => a - b)
  const bodySize = sizes[Math.floor(sizes.length / 2)] || 0

  return lines
    .map(({ text, size }) => {
      const trimmed = text.trim()
      const looksLikeHeading =
        bodySize > 0 && size >= bodySize * HEADING_SCALE && trimmed.length > 0 && trimmed.length < 120
      return looksLikeHeading ? `## ${trimmed}` : text.trimEnd()
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function extractPdfText(buffer: Buffer): Promise<PdfTextExtraction> {
  const pdfParse = (await import('pdf-parse')).default
  const pages: PdfPage[] = []

  const parsed = await pdfParse(buffer, {
    pagerender: async (pageData: PageData) => {
      const content = await pageData.getTextContent({
        normalizeWhitespace: false,
        disableCombineTextItems: false,
      })
      const text = renderPageText(content.items)
      pages.push({ page: pageData.pageIndex + 1, text })
      return text
    },
  })

  pages.sort((a, b) => a.page - b.page)
  const lowTextPages = pages.filter((p) => p.text.replace(/\s/g, '').length < LOW_TEXT_THRESHOLD).map((p) => p.page)
  const text = pages
    .filter((p) => p.text)
    .map((p) => `[Page ${p.page}]\n${p.text}`)
    .join('\n\n')

  return { pages, pageCount: parsed.numpages || pages.length, text, lowTextPages }
}

export type VisualAnalysisResult =
  | { status: 'complete'; analysis: string }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; reason: string }

function buildVisualPrompt(lowTextPages: number[], pageCount: number): string {
  const ocrInstruction = lowTextPages.length
    ? `Pages ${lowTextPages.join(', ')} contain little or no machine-readable text and are likely scanned. For those pages, transcribe all legible text verbatim (OCR) under a "Transcription" subheading.`
    : 'All pages contain machine-readable text; do not re-transcribe body text.'

  return [
    `You are analyzing a ${pageCount}-page PDF so another assistant can answer questions about it.`,
    'Describe every visual element: images, photos, charts, graphs, diagrams, figures, equations rendered as images, and tables.',
    'For charts and graphs, report the chart type, axes, units, series, notable values, and the trend or conclusion shown.',
    'For tables, reproduce them as Markdown tables.',
    'For diagrams, explain components and how they connect.',
    'Link each visual to the surrounding text it illustrates (captions, figure numbers, nearby headings).',
    ocrInstruction,
    'Organise the output strictly by page using headings of the form "### [Page N]". Skip pages with no visual content and no transcription.',
    'If nothing visual exists in the document, reply exactly: NO_VISUAL_CONTENT',
  ].join('\n')
}

export async function analyzePdfVisuals(
  buffer: Buffer,
  fileName: string,
  lowTextPages: number[],
  pageCount: number,
): Promise<VisualAnalysisResult> {
  if (buffer.byteLength > VISUAL_ANALYSIS_MAX_BYTES) {
    return { status: 'skipped', reason: 'File is larger than 20MB, so visual analysis was skipped.' }
  }

  try {
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) return { status: 'failed', reason: 'Visual analysis is not configured on this deployment.' }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://zequel.xyz',
        'X-Title': 'Zequel Research System',
      },
      body: JSON.stringify({
        model: VISUAL_MODEL,
        temperature: 0.1,
        max_tokens: 16000,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: buildVisualPrompt(lowTextPages, pageCount) },
            {
              type: 'file',
              file: {
                filename: fileName || 'document.pdf',
                file_data: `data:application/pdf;base64,${buffer.toString('base64')}`,
              },
            },
          ],
        }],
      }),
      signal: AbortSignal.timeout(240_000),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Zequel] OpenRouter visual analysis failed:', response.status, errorText.slice(0, 500))
      return { status: 'failed', reason: 'The visual analysis service rejected this document.' }
    }

    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
    const analysis = payload.choices?.[0]?.message?.content?.trim() ?? ''
    if (!analysis) return { status: 'failed', reason: 'The vision model returned no output.' }
    if (analysis === 'NO_VISUAL_CONTENT') {
      return { status: 'complete', analysis: '' }
    }
    return { status: 'complete', analysis }
  } catch (error) {
    console.error('[Zequel] Visual analysis error:', error)
    return { status: 'failed', reason: 'Visual analysis timed out or failed.' }
  }
}

export function buildDocumentContext(doc: {
  title: string
  extracted_text?: string | null
  visual_analysis?: string | null
}): string | null {
  const parts: string[] = []
  if (doc.extracted_text) parts.push(`[Extracted text]\n${doc.extracted_text}`)
  if (doc.visual_analysis) parts.push(`[Visual content and OCR, by page]\n${doc.visual_analysis}`)
  return parts.length ? `[Document: ${doc.title}]\n${parts.join('\n\n')}` : null
}
