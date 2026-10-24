import { createClient } from '@zequel/shared/supabase/server'
import { processAIRequest, executeAICall, logStreamCompletion } from '@/lib/ai/model-service'
import { estimateTokens } from '@/lib/logging/ai-logger'
import { buildPersonalizationContext } from '@/lib/ai/personalization'
import { validateRequest, codingChatRequestSchema } from '@zequel/shared/validation/ai-schema'
import { getCodingSystemPrompt, getCodingAction } from '@/lib/coding/prompts'
import { getLanguageMeta } from '@/lib/coding/languages'
import type { SystemSettings } from '@zequel/shared/settings/system-settings'
import type { CodingLanguage } from '@zequel/types'

const MAX_FILE_CHARS = 24000
const MAX_TOTAL_PROJECT_CHARS = 60000
const MAX_DOC_CHARS = 40000

interface ProjectFileInput {
  name: string
  language: CodingLanguage
  content: string
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '\n\n[...truncated...]' : text
}

export async function POST(request: Request) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return new Response(
        JSON.stringify({ error: 'Database not configured' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      )
    }
    if (!process.env.OPENROUTER_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const body = await request.json()

    // Validate the coding-specific payload ourselves, then run the shared
    // security pipeline with validation skipped (it only knows chat/query).
    const validation = validateRequest(codingChatRequestSchema, body)
    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: (validation as { error: string }).error }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const {
      project_id,
      message,
      active_file_name,
      active_language,
      active_file_content,
      project_files,
      attached_files,
      document_ids,
      action,
      learning_mode,
    } = validation.data

    // Auth, rate limit, subscription, system settings (skip built-in validation)
    const authResult = await processAIRequest('chat', body, { skipValidation: true })
    if (!authResult.success) {
      return new Response(
        JSON.stringify({ error: authResult.error, statusCode: authResult.statusCode }),
        { status: authResult.statusCode || 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { user, subscription, startTime, settings } = authResult.data as {
      user: { id: string }
      subscription: { plan: 'free' | 'premium_lite' | 'premium_pro' }
      startTime: number
      settings: SystemSettings
    }

    const supabase = await createClient()

    // Resolve the effective user instruction: a quick action template or free text.
    const actionDef = action ? getCodingAction(action) : undefined
    const userInstruction = actionDef
      ? actionDef.instruction
      : (message || '').trim()

    if (!userInstruction) {
      return new Response(
        JSON.stringify({ error: 'Message or action required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Persist the user turn (store the human-readable label for actions).
    const storedUserContent = actionDef ? `[Action] ${actionDef.label}` : userInstruction
    await supabase.from('coding_messages').insert({
      project_id,
      user_id: user.id,
      role: 'user',
      content: storedUserContent,
    })
    await supabase
      .from('coding_projects')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', project_id)
      .eq('user_id', user.id)

    // ── Build the context messages ──────────────────────────────────────────
    const systemPrompt = getCodingSystemPrompt(Boolean(learning_mode))
    const chatMessages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt },
    ]

    // Personalization (nickname, occupation, saved memories)
    const { context: personalizationContext } = await buildPersonalizationContext(supabase, user.id)
    if (personalizationContext) {
      chatMessages.push({ role: 'system', content: personalizationContext })
    }

    // Project file listing + contents
    const files = (project_files as ProjectFileInput[] | undefined) ?? []
    if (files.length > 0) {
      const listing = files
        .map((f) => `- ${f.name} (${getLanguageMeta(f.language).label})`)
        .join('\n')

      let budget = MAX_TOTAL_PROJECT_CHARS
      const fileBlocks: string[] = []
      for (const f of files) {
        if (budget <= 0) break
        const slice = truncate(f.content, Math.min(MAX_FILE_CHARS, budget))
        budget -= slice.length
        fileBlocks.push(
          `[File: ${f.name} | ${getLanguageMeta(f.language).label}]\n\`\`\`${f.language}\n${slice}\n\`\`\``
        )
      }

      chatMessages.push({
        role: 'system',
        content: `The user's project contains these files:\n${listing}\n\n--- PROJECT FILE CONTENTS ---\n${fileBlocks.join('\n\n')}`,
      })
    }

    // Files the user explicitly attached for this turn — focus on these.
    const attached = (attached_files as string[] | undefined) ?? []
    if (attached.length > 0) {
      chatMessages.push({
        role: 'system',
        content: `The user explicitly attached these file(s) for this request. Focus your work on them and treat them as the primary subject:\n${attached
          .map((n) => `- ${n}`)
          .join('\n')}`,
      })
    }

    // Current file (the primary subject)
    if (active_file_name && typeof active_file_content === 'string') {
      const lang = (active_language as CodingLanguage) || 'javascript'
      chatMessages.push({
        role: 'system',
        content: `The CURRENT FILE the user is editing is "${active_file_name}" (${getLanguageMeta(lang).label}). Treat this as the primary subject:\n\n\`\`\`${lang}\n${truncate(active_file_content, MAX_FILE_CHARS)}\n\`\`\``,
      })
    }

    // Uploaded documents (assignments, requirements, papers)
    const docIds = (document_ids as string[] | undefined) ?? []
    if (docIds.length > 0) {
      const { data: docs } = await supabase
        .from('documents')
        .select('id, title, extracted_text')
        .in('id', docIds)
        .eq('user_id', user.id)

      if (docs && docs.length > 0) {
        const docBlocks = docs
          .filter((d) => d.extracted_text)
          .map((d) => `[Document: ${d.title}]\n${truncate(d.extracted_text as string, MAX_DOC_CHARS)}`)
        if (docBlocks.length > 0) {
          chatMessages.push({
            role: 'system',
            content: `The user attached the following document(s) as requirements/context. Use them as authoritative:\n\n---BEGIN DOCUMENTS---\n${docBlocks.join('\n\n---\n\n')}\n---END DOCUMENTS---`,
          })
        }
      }
    }

    // Recent conversation history for this project
    const { data: history } = await supabase
      .from('coding_messages')
      .select('role, content')
      .eq('project_id', project_id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(30)

    if (history && history.length > 0) {
      // Drop the just-inserted user turn (we add the real instruction below)
      const prior = history.slice(0, -1)
      for (const msg of prior) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          chatMessages.push({ role: msg.role, content: msg.content })
        }
      }
    }

    // The actual instruction for this turn
    chatMessages.push({ role: 'user', content: userInstruction })

    // ── Execute through the secure service with the coding feature gate ───────
    const aiResult = await executeAICall(
      user.id,
      'chat',
      { messages: chatMessages, stream: true, feature: 'coding' },
      subscription.plan,
      startTime,
      settings
    )

    if (!aiResult.success || !aiResult.stream) {
      const aiData = aiResult.data as { upgradeRequired?: boolean; requiredPlan?: string } | undefined
      return new Response(
        JSON.stringify({
          error: aiResult.error || 'AI processing failed',
          statusCode: aiResult.statusCode || 502,
          upgradeRequired: aiData?.upgradeRequired ?? false,
          requiredPlan: aiData?.requiredPlan,
        }),
        { status: aiResult.statusCode || 502, headers: { 'Content-Type': 'application/json' } }
      )
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
                  if (fullContent.trim()) {
                    await supabase.from('coding_messages').insert({
                      project_id,
                      user_id: user.id,
                      role: 'assistant',
                      content: fullContent.trim(),
                    })
                    await logStreamCompletion(
                      user.id,
                      'chat',
                      model,
                      inputTokens,
                      estimateTokens(fullContent),
                      startTime
                    )
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
                } catch {
                  /* skip */
                }
              }
            }
          }

          if (fullContent.trim()) {
            await supabase.from('coding_messages').insert({
              project_id,
              user_id: user.id,
              role: 'assistant',
              content: fullContent.trim(),
            })
          }
          controller.close()
        } catch (err) {
          console.error('[Zequel] Coding stream error:', err)
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
    console.error('[Zequel] Coding API error:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to process coding request',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
