import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@zequel/shared/supabase/server'
import { processAIRequest } from '@/lib/ai/model-service'
import { analyzePdfVisuals, hashContent } from '@/lib/documents/process-pdf'
import { loadOwnedDocument, updateDocumentRecord } from '@/lib/documents/document-record'

export const maxDuration = 300

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { documentId } = body as { documentId?: string }

    const authResult = await processAIRequest('extract', body, { skipValidation: true })
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.statusCode })
    }
    const { user } = authResult.data as { user: { id: string } }

    if (!documentId || typeof documentId !== 'string') {
      return NextResponse.json({ error: 'Missing documentId' }, { status: 400 })
    }

    const supabase = await createClient()
    const doc = await loadOwnedDocument(supabase, documentId, user.id)
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    if (!doc.file_path.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ success: true, visualStatus: 'not_applicable' })
    }
    if (doc.visual_status === 'complete') {
      return NextResponse.json({ success: true, cached: true, visualStatus: 'complete' })
    }

    const { data: fileData, error: downloadError } = await supabase.storage.from('documents').download(doc.file_path)
    if (downloadError || !fileData) {
      return NextResponse.json({ error: 'Failed to download file' }, { status: 500 })
    }
    const buffer = Buffer.from(await fileData.arrayBuffer())

    if (doc.content_hash && doc.content_hash !== hashContent(buffer)) {
      return NextResponse.json({ error: 'Document changed; re-run text extraction first.' }, { status: 409 })
    }

    await updateDocumentRecord(supabase, documentId, user.id, { visual_status: 'processing' })

    const lowTextPages = (doc.pages ?? [])
      .filter((p) => p.text.replace(/\s/g, '').length < 40)
      .map((p) => p.page)
    const result = await analyzePdfVisuals(buffer, doc.file_name, lowTextPages, doc.page_count)
    const hasText = !!doc.extracted_text?.trim()
    const hasOcr = result.status === 'complete' && !!result.analysis

    const finalStatus = hasText || hasOcr ? 'parsed' : 'error'
    await updateDocumentRecord(supabase, documentId, user.id, {
      visual_status: result.status,
      visual_analysis: result.status === 'complete' ? result.analysis || null : null,
      processing_error: result.status === 'complete' ? null : result.reason,
      status: finalStatus,
    })

    return NextResponse.json({
      success: result.status === 'complete',
      visualStatus: result.status,
      documentStatus: finalStatus,
      reason: result.status === 'complete' ? undefined : result.reason,
    })
  } catch (error) {
    console.error('[Zequel] Visual analysis route error:', error)
    return NextResponse.json({ error: 'Visual analysis failed' }, { status: 500 })
  }
}
