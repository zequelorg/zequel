import type { SupabaseClient } from '@supabase/supabase-js'

export interface PersonalizationPrefs {
  reference_saved_memories: boolean
  reference_chat_history: boolean
  nickname: string | null
  occupation: string | null
  about_you: string | null
}

/**
 * Fetch the user's personalization preferences and (optionally) saved memories,
 * then build a system-prompt context block. Returns null when there's nothing
 * meaningful to inject.
 */
export async function buildPersonalizationContext(
  supabase: SupabaseClient,
  userId: string
): Promise<{ context: string | null; prefs: PersonalizationPrefs | null }> {
  const { data: prefs } = await supabase
    .from('preferences')
    .select('reference_saved_memories, reference_chat_history, nickname, occupation, about_you')
    .eq('user_id', userId)
    .single()

  if (!prefs) return { context: null, prefs: null }

  const lines: string[] = []

  if (prefs.nickname) lines.push(`- Preferred name / nickname: ${prefs.nickname}`)
  if (prefs.occupation) lines.push(`- Occupation: ${prefs.occupation}`)
  if (prefs.about_you) lines.push(`- About them: ${prefs.about_you}`)

  // Saved memories (only when the toggle is on)
  if (prefs.reference_saved_memories) {
    const { data: memories } = await supabase
      .from('memories')
      .select('content')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (memories && memories.length > 0) {
      lines.push('')
      lines.push('Saved memories about this user (use them naturally when relevant):')
      for (const m of memories) {
        lines.push(`- ${m.content}`)
      }
    }
  }

  if (lines.length === 0) return { context: null, prefs }

  const context = `## About the User (Personalization)

The following details are known about the user. Use them to tailor your tone, examples, and depth. Address them by their preferred name when natural. Do not explicitly state that you are "using their personalization settings".

${lines.join('\n')}`

  return { context, prefs }
}

/**
 * Use a lightweight model call to extract any new, durable facts worth
 * remembering from the latest user message, then persist them as memories.
 * Skips trivial/transient content. Best-effort — never throws.
 */
export async function extractAndSaveMemories(
  supabase: SupabaseClient,
  userId: string,
  userMessage: string
): Promise<void> {
  try {
    if (!userMessage || userMessage.trim().length < 12) return
    if (!process.env.OPENROUTER_API_KEY) return

    // Avoid unbounded growth — cap stored memories per user
    const { count } = await supabase
      .from('memories')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
    if (count && count >= 200) return

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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
            content: `You extract durable personal facts worth remembering about a user from their message, to personalize future responses.

Return a JSON object: {"memories": string[]}.

Rules:
- Only include stable, useful facts: preferences, goals, background, field of study/work, recurring interests, constraints, or explicit "remember this" requests.
- Do NOT include questions, transient context, one-off task details, or anything sensitive (passwords, financial/medical specifics).
- Each memory must be a concise standalone statement (max ~120 chars), written in third person (e.g. "Prefers concise answers", "Is studying organic chemistry").
- If there is nothing worth remembering, return {"memories": []}.
- Return ONLY valid JSON, no prose.`,
          },
          { role: 'user', content: userMessage.slice(0, 4000) },
        ],
        temperature: 0.2,
        max_tokens: 300,
        response_format: { type: 'json_object' },
      }),
    })

    if (!res.ok) return

    const data = await res.json()
    const raw = data.choices?.[0]?.message?.content?.trim()
    if (!raw) return

    let parsed: { memories?: unknown }
    try {
      parsed = JSON.parse(raw)
    } catch {
      return
    }

    const candidates = Array.isArray(parsed.memories) ? parsed.memories : []
    const newMemories = candidates
      .filter((m): m is string => typeof m === 'string')
      .map((m) => m.trim())
      .filter((m) => m.length >= 4 && m.length <= 200)
      .slice(0, 5)

    if (newMemories.length === 0) return

    // Avoid storing duplicates of existing memories
    const { data: existing } = await supabase
      .from('memories')
      .select('content')
      .eq('user_id', userId)
      .limit(200)

    const existingSet = new Set((existing ?? []).map((e) => e.content.toLowerCase()))
    const rows = newMemories
      .filter((m) => !existingSet.has(m.toLowerCase()))
      .map((m) => ({ user_id: userId, content: m, source: 'ai' as const }))

    if (rows.length === 0) return

    await supabase.from('memories').insert(rows)
  } catch (err) {
    console.error('[Zequel] extractAndSaveMemories error:', err instanceof Error ? err.message : err)
  }
}
