import { createClient } from '@zequel/shared/supabase/server'
import { processAIRequest, executeAICall, logStreamCompletion } from '@/lib/ai/model-service'
import { estimateTokens } from '@/lib/logging/ai-logger'
import { buildPersonalizationContext, extractAndSaveMemories } from '@/lib/ai/personalization'
import type { SystemSettings } from '@zequel/shared/settings/system-settings'
import { buildDocumentContext, extractPdfText } from '@/lib/documents/process-pdf'
import { updateDocumentRecord } from '@/lib/documents/document-record'

const STUDY_SYSTEM_PROMPT = `You are Zequel, a world-class AI research assistant and study companion created by Absalex Labs. You possess extraordinary intelligence, depth of knowledge, and analytical capability rivaling the best human experts in every field.

CORE IDENTITY & INTELLIGENCE:
- You reason like a Nobel laureate, explain like a legendary professor, and write with the clarity of the world's best communicators.
- You think step-by-step through complex problems, considering multiple angles before answering.
- You are intellectually honest — you clearly distinguish between established facts, well-supported theories, and educated speculation.
- When you're uncertain, you say so explicitly and explain why, rather than guessing.
- You proactively identify errors in the user's reasoning or assumptions and correct them diplomatically.

PROBLEM SOLVING:
- For math/physics/engineering: Show COMPLETE step-by-step solutions. Number every step. Explain the reasoning behind each step. Verify your answer at the end.
- For code: Write production-quality, well-commented, complete code. Always specify the language. Include error handling. Explain design decisions.
- For analysis: Structure your analysis with clear sections. Use evidence. Consider counterarguments. Draw specific conclusions.
- For research: Cite relevant theories, studies, or frameworks. Distinguish between correlation and causation. Note limitations.

ADAPTIVE RESPONSE LENGTH:
- Quick factual question ("What is X?", "How many...") → 1-3 precise sentences. No over-explanation.
- Explanation request ("explain", "how does", "why") → Thorough structured explanation with examples.
- Problem solving (math, code, physics) → Full step-by-step working with verification.
- Document analysis → Detailed analysis with direct quotes, section references, and citations from the provided text.
- Creative/writing requests → Rich, well-crafted output matching the requested style.
- Match the user's depth — casual question = friendly concise answer, deep question = comprehensive deep answer.

FORMATTING:
- Use markdown naturally and consistently:
  - **bold** for key terms and emphasis
  - ## headers to organize long answers into sections
  - \`code\` for technical terms, file names, commands
  - > blockquotes for direct quotations from documents
- Math: Use LaTeX with $...$ inline and $$...$$ for display equations. Always render equations completely and correctly.
- Code: ALWAYS specify language in fences (\`\`\`python, \`\`\`javascript, \`\`\`rust etc). Include helpful comments. Make code complete, runnable, and production-quality.
- Tables: Use markdown tables for comparisons, data summaries, or structured information.
- Lists: Numbered lists for sequential steps, bullet points for unordered collections.

IMAGE ANALYSIS:
When the user sends an image, you MUST:
- Describe what you see in detail — objects, text, colors, layout, context
- If it contains text/code/math, extract and interpret it accurately
- If it's a screenshot, identify the application, UI elements, and any errors
- If it's a diagram/chart, explain the data, trends, and relationships shown
- If asked specific questions about the image, focus your analysis on those aspects
- Be specific and precise — mention positions (top-left, center, etc.), colors, sizes

DOCUMENT ANALYSIS:
When the user has a document loaded, you have the FULL TEXT in context. You MUST:
- Quote directly using > blockquotes when referencing specific passages
- Reference specific sections, chapters, pages, or paragraph numbers
- Compare the document's claims with broader knowledge when relevant
- Identify key themes, arguments, evidence, and conclusions
- If asked "what does the document say about X", search the provided text thoroughly before answering

CAPABILITIES (you excel at ALL of these):
- Mathematics (all levels: arithmetic to graduate-level pure math, statistics, probability)
- Physics, Chemistry, Biology, Engineering
- Computer Science & Programming (any language, algorithms, system design, debugging)
- Cryptocurrency, blockchain, DeFi, Web3 analysis
- Research methodology, academic writing, literature review
- Data analysis, visualization concepts, machine learning
- History, Philosophy, Social Sciences, Economics
- Creative writing, editing, summarization
- Language translation and linguistic analysis
- Any academic or professional discipline

PERSONALITY:
- Warm but intellectually rigorous — never robotic, never sloppy
- Confident and decisive in your answers. Present strong opinions backed by evidence.
- Proactive — suggest follow-up questions, deeper explorations, or related topics the user might find valuable
- Never say "I'm just an AI" or apologize unnecessarily
- If the user makes a mistake, correct it clearly and kindly
- Show genuine intellectual curiosity about the topics discussed`

type ContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }

export async function POST(request: Request) {
  try {
    // Check if required environment variables are configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error('[Zequel] Chat API: Supabase not configured')
      return new Response(JSON.stringify({
        error: 'Database not configured',
        details: 'Supabase environment variables are missing'
      }), { status: 503, headers: { 'Content-Type': 'application/json' } })
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[Zequel] Chat API: Supabase service role key not configured')
      return new Response(JSON.stringify({
        error: 'Database service not configured',
        details: 'SUPABASE_SERVICE_ROLE_KEY environment variable is missing'
      }), { status: 503, headers: { 'Content-Type': 'application/json' } })
    }

    if (!process.env.OPENROUTER_API_KEY) {
      console.error('[Zequel] Chat API: OpenRouter API key not configured')
      return new Response(JSON.stringify({
        error: 'AI service not configured',
        details: 'OPENROUTER_API_KEY environment variable is missing'
      }), { status: 503, headers: { 'Content-Type': 'application/json' } })
    }

    const body = await request.json()
    const { conversation_id, message, document_id, document_ids, images, full_content, regenerate } = body

    // 1. Process through security layer (auth, validation, rate limit, subscription)
    const authResult = await processAIRequest('chat', body)
    if (!authResult.success) {
      console.error('[Zequel] Chat API auth failed:', authResult.error)
      return new Response(JSON.stringify({
        error: authResult.error,
        statusCode: authResult.statusCode
      }), { status: authResult.statusCode || 401, headers: { 'Content-Type': 'application/json' } })
    }

    const { user, subscription, startTime, settings } = authResult.data as {
      user: { id: string }
      subscription: { plan: 'free' | 'premium_lite' | 'premium_pro' }
      startTime: number
      settings: SystemSettings
    }

    const supabase = await createClient()

    // Personalization: load user preferences + saved memories and build context
    const { context: personalizationContext, prefs: personalizationPrefs } =
      await buildPersonalizationContext(supabase, user.id)
    const referenceChatHistory = personalizationPrefs?.reference_chat_history ?? true
    const referenceSavedMemories = personalizationPrefs?.reference_saved_memories ?? true

    // Save user message to DB (skip if regenerating)
    if (!regenerate) {
      const storedContent = full_content || message || '[Image]'
      await supabase.from('messages').insert({
        conversation_id,
        role: 'user',
        content: storedContent,
      })

      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversation_id)

      // Personalization: extract & save durable memories from the user's message
      // (only when the user has memory-saving enabled). Best-effort, fire-and-forget.
      if (referenceSavedMemories && message && typeof message === 'string') {
        void extractAndSaveMemories(supabase, user.id, message)
      }
    }

    // Fetch document text if selected (support both single and multiple documents)
    let documentText: string | null = null
    let documentTitle: string | null = null
    const docsToFetch = document_ids && document_ids.length > 0 ? document_ids : (document_id ? [document_id] : [])

    if (docsToFetch.length > 0) {
      const withVisuals = await supabase
        .from('documents')
        .select('id, title, file_name, file_path, extracted_text, visual_analysis')
        .in('id', docsToFetch)
        .eq('user_id', user.id)
      const { data: docs } = withVisuals.error
        ? await supabase
            .from('documents')
            .select('id, title, file_name, file_path, extracted_text')
            .in('id', docsToFetch)
            .eq('user_id', user.id)
        : withVisuals

      if (docs && docs.length > 0) {
        const docTexts: string[] = []
        const docTitles: string[] = []

        for (const doc of docs as Array<{
          id: string
          title: string
          file_path: string | null
          extracted_text: string | null
          visual_analysis?: string | null
        }>) {
          docTitles.push(doc.title)
          let text = doc.extracted_text

          if (!text && doc.file_path?.toLowerCase().endsWith('.pdf')) {
            try {
              const { data: fileData } = await supabase.storage.from('documents').download(doc.file_path)
              if (fileData) {
                const extraction = await extractPdfText(Buffer.from(await fileData.arrayBuffer()))
                text = extraction.text || null
                if (text) {
                  await updateDocumentRecord(supabase, doc.id, user.id, {
                    extracted_text: text,
                    page_count: extraction.pageCount,
                    pages: extraction.pages,
                    status: 'parsed',
                  })
                }
              }
            } catch (extractErr) {
              console.error('[Zequel] On-the-fly PDF extraction failed:', extractErr)
            }
          }

          const context = buildDocumentContext({ ...doc, extracted_text: text })
          if (context) docTexts.push(context)
        }

        documentTitle = docTitles.join(', ')
        documentText = docTexts.join('\n\n---\n\n')
      }
    }

    // Fetch conversation history
    const { data: history } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: true })
      .limit(40)

    // Build messages array
    const chatMessages: Array<{ role: string; content: string | ContentPart[] }> = [
      { role: 'system', content: STUDY_SYSTEM_PROMPT },
    ]

    // Inject personalization context (nickname, occupation, about, saved memories)
    if (personalizationContext) {
      chatMessages.push({ role: 'system', content: personalizationContext })
    }

    if (documentTitle && documentText) {
      const truncated = documentText.length > 80000
        ? documentText.substring(0, 80000) + '\n\n[Document truncated due to length]'
        : documentText
      chatMessages.push({
        role: 'system',
        content: `The user is studying the following document titled "${documentTitle}". Its extracted text is marked with [Page N] references, and a separate section describes visual content (figures, charts, tables, diagrams) and OCR of scanned pages, also by page:\n\n---BEGIN DOCUMENT---\n${truncated}\n---END DOCUMENT---\n\nUse both the text and the visual descriptions. Cite pages as (p. N) using the [Page N] markers. If the answer depends on a visual that is not described, say so rather than guessing.`,
      })
    } else if (documentTitle) {
      chatMessages.push({
        role: 'system',
        content: `The user has selected a document titled "${documentTitle}" but its text has not been extracted yet. Acknowledge this when asked about the document.`,
      })
    }

    if (referenceChatHistory && history && history.length > 0) {
      for (const msg of history) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          chatMessages.push({ role: msg.role, content: msg.content })
        }
      }
    } else if (!referenceChatHistory) {
      // Chat-history referencing disabled: only include the most recent user turn
      const lastUser = history && history.length > 0
        ? [...history].reverse().find((m) => m.role === 'user')
        : null
      if (lastUser) {
        chatMessages.push({ role: 'user', content: lastUser.content })
      }
    }

    // Handle multimodal messages
    const hasImages = images && Array.isArray(images) && images.length > 0
    if (hasImages) {
      const parts: ContentPart[] = []
      if (message) {
        parts.push({ type: 'text', text: message })
      }
      for (const imgUrl of images) {
        parts.push({ type: 'image_url', image_url: { url: imgUrl } })
      }
      const lastIdx = chatMessages.length - 1
      if (chatMessages[lastIdx]?.role === 'user') {
        chatMessages[lastIdx] = { role: 'user', content: parts }
      } else {
        chatMessages.push({ role: 'user', content: parts })
      }
    }

    // 2. Execute AI call through secure service (using system settings)
    // documentCount drives feature detection: 2+ docs = multi-document analysis
    const aiResult = await executeAICall(
      user.id,
      'chat',
      { messages: chatMessages, stream: true, hasImages, documentCount: docsToFetch.length },
      subscription.plan,
      startTime,
      settings
    )

    if (!aiResult.success || !aiResult.stream) {
      console.error('[Zequel] Chat API AI call failed:', aiResult.error)
      const aiData = aiResult.data as { upgradeRequired?: boolean; requiredPlan?: string } | undefined
      return new Response(JSON.stringify({
        error: aiResult.error || 'AI processing failed',
        details: 'Check OpenRouter API key and model availability',
        statusCode: aiResult.statusCode || 502,
        upgradeRequired: aiData?.upgradeRequired ?? false,
        requiredPlan: aiData?.requiredPlan,
      }), { status: aiResult.statusCode || 502, headers: { 'Content-Type': 'application/json' } })
    }

    const { model, inputTokens } = aiResult.data as { model: string; inputTokens: number }
    const reader = (aiResult.stream as ReadableStream).getReader()
    const decoder = new TextDecoder()
    let fullContent = ''

    const stream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split('\n')

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim()
                if (data === '[DONE]') {
                  if (fullContent.trim() && !regenerate) {
                    // Only insert new message if NOT regenerating
                    await supabase.from('messages').insert({
                      conversation_id,
                      role: 'assistant',
                      content: fullContent.trim(),
                    })

                    // Log completion
                    await logStreamCompletion(
                      user.id,
                      'chat',
                      model,
                      inputTokens,
                      estimateTokens(fullContent),
                      startTime
                    )

                    // Generate title for new conversations (skip on regeneration)
                    if (!regenerate) {
                      const { count } = await supabase
                        .from('messages')
                        .select('*', { count: 'exact', head: true })
                        .eq('conversation_id', conversation_id)

                      if (count && count <= 3) {
                      try {
                        const titleRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
                          },
                          body: JSON.stringify({
                            model: 'openai/gpt-5-nano',
                            messages: [
                              {
                                role: 'system',
                                content: 'Generate a short conversation title (3-6 words max) that captures the topic. Return ONLY the title, no quotes.',
                              },
                              { role: 'user', content: message || 'Image analysis' },
                            ],
                            temperature: 0.3,
                            max_tokens: 30,
                          }),
                        })
                        if (titleRes.ok) {
                          const titleData = await titleRes.json()
                          const generatedTitle =
                            titleData.choices?.[0]?.message?.content?.trim()?.replace(/^["']|["']$/g, '')?.substring(0, 60) || (message || 'Image analysis').substring(0, 40)
                          await supabase.from('conversations').update({ title: generatedTitle }).eq('id', conversation_id)
                        }
                      } catch {
                        const fallback = (message || 'Image analysis').length > 40 ? (message || '').substring(0, 37) + '...' : (message || 'Image analysis')
                        await supabase.from('conversations').update({ title: fallback }).eq('id', conversation_id)
                      }
                      }
                    }
                  }
                  controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
                  controller.close()
                  return
                }

                try {
                  const parsed = JSON.parse(data)
                  const content = parsed.choices?.[0]?.delta?.content || ''
                  if (content) {
                    fullContent += content
                    controller.enqueue(
                      new TextEncoder().encode(`data: ${JSON.stringify({ content })}\n\n`)
                    )
                  }
                } catch { /* skip */ }
              }
            }
          }

          if (fullContent.trim() && !regenerate) {
            await supabase.from('messages').insert({
              conversation_id,
              role: 'assistant',
              content: fullContent.trim(),
            })
          }
          controller.close()
        } catch (err) {
          console.error('[Zequel] Chat stream error:', err)
          const errorMessage = err instanceof Error ? err.message : 'Stream processing failed'
          await logStreamCompletion(user.id, 'chat', model, inputTokens, 0, startTime, 'error', errorMessage)
          controller.error(new Error(errorMessage))
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('[Zequel] Chat API error:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to process chat request',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
