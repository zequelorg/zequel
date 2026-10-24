import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface OwnedDocument {
  id: string
  title: string
  file_name: string
  file_path: string
  page_count: number
  status: string
  extracted_text: string | null
  content_hash?: string | null
  visual_status?: string | null
  pages?: { page: number; text: string }[] | null
}

const BASE_COLUMNS = ['extracted_text', 'page_count', 'status'] as const
const UNDEFINED_COLUMN = '42703'

function isMissingColumn(error: { code?: string; message?: string } | null): boolean {
  return !!error && (error.code === UNDEFINED_COLUMN || error.code === 'PGRST204' || /column/i.test(error.message ?? ''))
}

export async function loadOwnedDocument(
  supabase: SupabaseClient,
  documentId: string,
  userId: string,
): Promise<OwnedDocument | null> {
  const full = await supabase
    .from('documents')
    .select('id, title, file_name, file_path, page_count, status, extracted_text, content_hash, visual_status, pages')
    .eq('id', documentId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!isMissingColumn(full.error)) return (full.data as OwnedDocument | null) ?? null

  const base = await supabase
    .from('documents')
    .select('id, title, file_name, file_path, page_count, status, extracted_text')
    .eq('id', documentId)
    .eq('user_id', userId)
    .maybeSingle()
  return (base.data as OwnedDocument | null) ?? null
}

/**
 * Writes processing results. Falls back to the original columns when
 * migration 002 has not been applied yet, so uploads keep working.
 */
export async function updateDocumentRecord(
  supabase: SupabaseClient,
  documentId: string,
  userId: string,
  values: Record<string, unknown>,
): Promise<boolean> {
  const { error } = await supabase.from('documents').update(values).eq('id', documentId).eq('user_id', userId)
  if (!error) return true
  if (!isMissingColumn(error)) {
    console.error('[Zequel] Document update failed:', error.message)
    return false
  }

  const baseValues = Object.fromEntries(
    Object.entries(values).filter(([key]) => (BASE_COLUMNS as readonly string[]).includes(key)),
  )
  if (!Object.keys(baseValues).length) return false
  const retry = await supabase.from('documents').update(baseValues).eq('id', documentId).eq('user_id', userId)
  return !retry.error
}
