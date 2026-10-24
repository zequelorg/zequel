import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@zequel/shared/supabase/server'
import { processAIRequest } from '@/lib/ai/model-service'
import { getSystemSettings, isFileUploadsEnabled, getMaxFileSize } from '@zequel/shared/settings/system-settings'
import { extractPdfText, hashContent } from '@/lib/documents/process-pdf'
import { loadOwnedDocument, updateDocumentRecord } from '@/lib/documents/document-record'

export const maxDuration = 60

const ALLOWED_EXTENSIONS = ['.pdf', '.txt', '.md']

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { documentId } = body as { documentId?: string }

    if (!(await isFileUploadsEnabled())) {
      return NextResponse.json(
        { error: 'File uploads are temporarily disabled. Please try again later.' },
        { status: 503 },
      )
    }

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
    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const ext = doc.file_path.substring(doc.file_path.lastIndexOf('.')).toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: 'File type not allowed. Only PDF, TXT, and MD files are supported.' },
        { status: 400 },
      )
    }

    const { data: fileData, error: downloadError } = await supabase.storage.from('documents').download(doc.file_path)
    if (downloadError || !fileData) {
      return NextResponse.json({ error: 'Failed to download file' }, { status: 500 })
    }

    if (fileData.size > (await getMaxFileSize())) {
      const settings = await getSystemSettings()
      return NextResponse.json(
        { error: `File too large. Maximum size is ${settings.max_file_size_mb}MB.` },
        { status: 400 },
      )
    }

    const buffer = Buffer.from(await fileData.arrayBuffer())
    const contentHash = hashContent(buffer)

    if (doc.content_hash === contentHash && doc.status === 'parsed') {
      return NextResponse.json({
        success: true,
        cached: true,
        pageCount: doc.page_count,
        textLength: doc.extracted_text?.length ?? 0,
        visualStatus: doc.visual_status ?? 'pending',
      })
    }

    const { data: duplicate } = await supabase
      .from('documents')
      .select('extracted_text, page_count, pages, visual_status, visual_analysis')
      .eq('user_id', user.id)
      .eq('content_hash', contentHash)
      .eq('status', 'parsed')
      .neq('id', documentId)
      .limit(1)
      .maybeSingle()

    if (duplicate) {
      await updateDocumentRecord(supabase, documentId, user.id, {
        extracted_text: duplicate.extracted_text,
        page_count: duplicate.page_count,
        status: 'parsed',
        content_hash: contentHash,
        pages: duplicate.pages,
        visual_status: duplicate.visual_status,
        visual_analysis: duplicate.visual_analysis,
        processing_error: null,
      })
      return NextResponse.json({
        success: true,
        cached: true,
        pageCount: duplicate.page_count,
        textLength: duplicate.extracted_text?.length ?? 0,
        visualStatus: duplicate.visual_status ?? 'pending',
      })
    }

    if (ext !== '.pdf') {
      const text = buffer.toString('utf8')
      await updateDocumentRecord(supabase, documentId, user.id, {
        extracted_text: text,
        page_count: 1,
        status: text ? 'parsed' : 'error',
        content_hash: contentHash,
        visual_status: 'not_applicable',
        processing_error: text ? null : 'The file is empty.',
      })
      return NextResponse.json({ success: !!text, pageCount: 1, textLength: text.length, visualStatus: 'not_applicable' })
    }

    const extraction = await extractPdfText(buffer)
    const needsOcr = extraction.lowTextPages.length === extraction.pageCount

    const saved = await updateDocumentRecord(supabase, documentId, user.id, {
      extracted_text: extraction.text || null,
      page_count: extraction.pageCount,
      status: needsOcr ? 'processing' : 'parsed',
      content_hash: contentHash,
      pages: extraction.pages,
      visual_status: 'pending',
      processing_error: null,
    })
    if (!saved) {
      return NextResponse.json({ error: 'Failed to update document' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      pageCount: extraction.pageCount,
      textLength: extraction.text.length,
      lowTextPages: extraction.lowTextPages,
      needsOcr,
      visualStatus: 'pending',
    })
  } catch (error) {
    console.error('[Zequel] Extract text error:', error)
    return NextResponse.json({ error: 'Failed to extract text' }, { status: 500 })
  }
}
