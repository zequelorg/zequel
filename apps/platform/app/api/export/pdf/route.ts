import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@zequel/shared/supabase/server'
import { renderResponseHtml } from '@/lib/pdf/render-response-html'
import { htmlToPdf } from '@/lib/pdf/generate-pdf'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_CONTENT_BYTES = 400_000
const WINDOW_MS = 60_000
const MAX_EXPORTS_PER_WINDOW = 10
const recentExports = new Map<string, number[]>()

const bodySchema = z.object({
  content: z.string().min(1).max(MAX_CONTENT_BYTES),
  title: z.string().max(120).optional(),
})

function isRateLimited(userId: string): boolean {
  const now = Date.now()
  const timestamps = (recentExports.get(userId) ?? []).filter((t) => now - t < WINDOW_MS)
  if (timestamps.length >= MAX_EXPORTS_PER_WINDOW) {
    recentExports.set(userId, timestamps)
    return true
  }
  timestamps.push(now)
  recentExports.set(userId, timestamps)
  return false
}

function toFileName(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `${slug || 'zequel-response'}.pdf`
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (isRateLimited(user.id)) {
    return NextResponse.json({ error: 'Too many exports. Please wait a minute.' }, { status: 429 })
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid export request' }, { status: 400 })
  }

  const title = parsed.data.title?.trim() || 'Zequel Response'

  try {
    const html = await renderResponseHtml({ markdown: parsed.data.content, title })
    const pdf = await htmlToPdf(html)
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${toFileName(title)}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[export/pdf] generation failed:', error)
    return NextResponse.json(
      { error: 'PDF generation failed. Please try again.', code: 'PDF_RENDER_FAILED' },
      { status: 500 },
    )
  }
}
