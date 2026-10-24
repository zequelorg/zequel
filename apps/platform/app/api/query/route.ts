import { NextResponse } from 'next/server'
import { createClient } from '@zequel/shared/supabase/server'
import { processAIRequest, executeAICall, createAIResponse } from '@/lib/ai/model-service'
import type { SystemSettings } from '@zequel/shared/settings/system-settings'

const BASE_INSTRUCTIONS = `You are Zequel, an advanced research analysis engine by Absalex Labs. You produce exhaustive, publication-quality structured analysis.

Critical rules:
- Every block's "content" must be 150-400 words of dense, professional academic writing. Never produce short or superficial content.
- Always include verbatim quoted excerpts from the source text in every source reference.
- Assign confidence levels based on evidence quality: "high" = directly supported with quotes, "medium" = inferrable, "low" = speculative.
- Return ONLY a JSON object. No markdown fences, no commentary outside the JSON.`

const SCHEMA_SHAPE = `{
  "blocks": [
    {
      "type": "section" | "claim" | "definition" | "comparison" | "gap",
      "title": "string",
      "content": "string — 150-400 words of detailed analytical writing",
      "sources": [{ "page": number, "section": "string", "excerpt": "string — verbatim quote from text" }],
      "confidence": "high" | "medium" | "low"
    }
  ],
  "confidence_level": "high" | "medium" | "low",
  "evidence_strength": "strong" | "moderate" | "weak"
}`

const SYSTEM_PROMPTS: Record<string, string> = {
  summarize: `${BASE_INSTRUCTIONS}\n\nTask: Produce a comprehensive analytical summary.\n\nGenerate 5-8 blocks of type "section" covering:\n1. Abstract Overview\n2. Theoretical Framework\n3. Methodology\n4. Key Findings\n5. Discussion & Implications\n6. Limitations\n7. Future Directions\n8. Critical Assessment\n\nReturn JSON matching: ${SCHEMA_SHAPE}`,
  extract_claims: `${BASE_INSTRUCTIONS}\n\nTask: Extract and evaluate all significant factual claims.\n\nGenerate 6-10 blocks of type "claim".\n\nReturn JSON matching: ${SCHEMA_SHAPE}`,
  compare_methodology: `${BASE_INSTRUCTIONS}\n\nTask: Provide deep methodological analysis.\n\nGenerate 5-8 blocks of type "comparison".\n\nReturn JSON matching: ${SCHEMA_SHAPE}`,
  identify_contradictions: `${BASE_INSTRUCTIONS}\n\nTask: Identify contradictions and inconsistencies.\n\nGenerate 4-7 blocks of type "claim".\n\nReturn JSON matching: ${SCHEMA_SHAPE}`,
  define_key_terms: `${BASE_INSTRUCTIONS}\n\nTask: Extract and define key technical terms.\n\nGenerate 6-12 blocks of type "definition".\n\nReturn JSON matching: ${SCHEMA_SHAPE}`,
  extract_research_gaps: `${BASE_INSTRUCTIONS}\n\nTask: Identify research gaps and opportunities.\n\nGenerate 5-8 blocks of type "gap".\n\nReturn JSON matching: ${SCHEMA_SHAPE}`,
}

export async function POST(request: Request) {
  try {
    // Check if required environment variables are configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error('[Zequel] Query API: Supabase not configured')
      return NextResponse.json({
        error: 'Database not configured',
        details: 'Supabase environment variables are missing'
      }, { status: 503 })
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[Zequel] Query API: Supabase service role key not configured')
      return NextResponse.json({
        error: 'Database service not configured',
        details: 'SUPABASE_SERVICE_ROLE_KEY environment variable is missing'
      }, { status: 503 })
    }

    if (!process.env.OPENROUTER_API_KEY) {
      console.error('[Zequel] Query API: OpenRouter API key not configured')
      return NextResponse.json({
        error: 'AI service not configured',
        details: 'OPENROUTER_API_KEY environment variable is missing'
      }, { status: 503 })
    }

    const body = await request.json()
    const { query, output_format, document_ids } = body

    // Process through security layer
    const authResult = await processAIRequest('query', body)
    if (!authResult.success) {
      console.error('[Zequel] Query API auth failed:', authResult.error)
      return NextResponse.json({ 
        error: authResult.error,
        details: 'Authentication or rate limit check failed'
      }, { status: authResult.statusCode || 401 })
    }

    const { user, subscription, startTime, settings } = authResult.data as {
      user: { id: string }
      subscription: { plan: 'free' | 'premium_lite' | 'premium_pro' }
      startTime: number
      settings: SystemSettings
    }

    const supabase = await createClient()

    // Fetch documents
    const { data: documents } = await supabase
      .from('documents')
      .select('id, title, file_name, file_path, extracted_text')
      .in('id', document_ids)

    const systemPrompt = SYSTEM_PROMPTS[output_format] || SYSTEM_PROMPTS.summarize

    // Build document text
    let docBlock = ''
    for (const doc of documents || []) {
      let text = doc.extracted_text

      if (!text && doc.file_path) {
        try {
          const { data: fileData } = await supabase.storage.from('documents').download(doc.file_path)
          if (fileData) {
            const pdfParse = (await import('pdf-parse')).default
            const buffer = Buffer.from(await fileData.arrayBuffer())
            const parsed = await pdfParse(buffer)
            text = parsed.text?.trim() || null
            if (text) {
              await supabase.from('documents').update({
                extracted_text: text,
                page_count: parsed.numpages || 0,
                status: 'parsed',
              }).eq('id', doc.id)
            }
          }
        } catch (e) {
          console.error('Extraction failed for', doc.title, e)
        }
      }

      if (text) {
        const truncated = text.length > 60000 ? text.substring(0, 60000) + '\n\n[Document truncated]' : text
        docBlock += `\n---BEGIN DOCUMENT: "${doc.title}"---\n${truncated}\n---END DOCUMENT---\n`
      } else {
        docBlock += `\nDocument: "${doc.title}" (${doc.file_name}) -- text extraction failed\n`
      }
    }

    const userMessage = `Research Query: "${query}"\n\n${docBlock}\n\nAnalyze comprehensively. Return ONLY the JSON object.`

    // Execute AI call through secure service (using system settings)
    // Research mode; escalates to multi-document analysis with 2+ documents.
    const aiResult = await executeAICall(
      user.id,
      'query',
      {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        stream: false,
        documentCount: document_ids.length,
      },
      subscription.plan,
      startTime,
      settings
    )

    if (!aiResult.success) {
      console.error('[Zequel] Query API AI call failed:', aiResult.error)
      const aiData = aiResult.data as { upgradeRequired?: boolean; requiredPlan?: string } | undefined
      return NextResponse.json({
        error: aiResult.error,
        details: 'AI processing failed - check OpenRouter API key and model availability',
        upgradeRequired: aiData?.upgradeRequired ?? false,
        requiredPlan: aiData?.requiredPlan,
      }, { status: aiResult.statusCode || 502 })
    }

    const aiResponse = aiResult.data as { choices?: Array<{ message?: { content?: string } }> }
    const rawContent = aiResponse.choices?.[0]?.message?.content || ''

    let parsed: { blocks: Record<string, unknown>[]; confidence_level?: string; evidence_strength?: string }
    try {
      const cleaned = rawContent.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
      parsed = JSON.parse(cleaned)
    } catch {
      console.error('Failed to parse AI response:', rawContent.substring(0, 500))
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 502 })
    }

    const blocks = (parsed.blocks || []).map((block: Record<string, unknown>) => ({
      id: crypto.randomUUID(),
      type: block.type || 'section',
      title: block.title || 'Untitled',
      content: block.content || '',
      sources: ((block.sources as Array<Record<string, unknown>>) || []).map((s) => ({
        document_id: document_ids[0],
        document_title: documents?.[0]?.title || 'Document',
        page: s.page || 1,
        section: s.section || 'Section 1',
        excerpt: s.excerpt || '',
      })),
      confidence: block.confidence || 'medium',
    }))

    const result = {
      id: crypto.randomUUID(),
      query,
      output_format,
      blocks,
      confidence_level: parsed.confidence_level || 'medium',
      evidence_strength: parsed.evidence_strength || 'moderate',
      document_coverage: document_ids.length,
      created_at: new Date().toISOString(),
    }

    await supabase.from('queries').insert({
      user_id: user.id,
      query_text: query,
      output_format,
      document_ids,
      result,
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error('Query route error:', err)
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined 
    }, { status: 500 })
  }
}
