export interface Profile {
  id: string
  display_name: string | null
  username: string | null
  full_name: string | null
  avatar_url: string | null
  created_at: string
}

export type DocumentStatus = 'processing' | 'parsed' | 'error'

export interface Document {
  id: string
  user_id: string
  title: string
  file_name: string
  file_path: string
  file_size: number
  page_count: number
  status: DocumentStatus
  extracted_text?: string | null
  created_at: string
  updated_at: string
}

export type OutputFormat =
  | 'summarize'
  | 'extract_claims'
  | 'compare_methodology'
  | 'identify_contradictions'
  | 'define_key_terms'
  | 'extract_research_gaps'

export interface UserPreferences {
  id: string
  user_id: string
  theme: 'light' | 'dark'
  language?: string | null
  default_output_format: OutputFormat
  auto_citation: boolean
  // Personalization / memory settings
  reference_saved_memories: boolean
  reference_chat_history: boolean
  nickname: string | null
  occupation: string | null
  about_you: string | null
}

export interface Memory {
  id: string
  user_id: string
  content: string
  source: 'ai' | 'user'
  created_at: string
}

export type BugReportStatus = 'open' | 'in_progress' | 'resolved' | 'closed'

export interface BugReport {
  id: string
  user_id: string
  user_email: string
  user_name: string | null
  subject: string
  description: string
  status: BugReportStatus
  page_url: string | null
  user_agent: string | null
  created_at: string
  updated_at: string
}

export type ConfidenceLevel = 'high' | 'medium' | 'low'
export type EvidenceStrength = 'strong' | 'moderate' | 'weak'

export interface SourceReference {
  document_id: string
  document_title: string
  page: number
  section: string
  excerpt: string
}

export interface OutputBlock {
  id: string
  type: 'section' | 'claim' | 'definition' | 'comparison' | 'gap'
  title: string
  content: string
  sources: SourceReference[]
  confidence: ConfidenceLevel
}

export interface QueryResult {
  id: string
  query: string
  output_format: OutputFormat
  blocks: OutputBlock[]
  confidence_level: ConfidenceLevel
  evidence_strength: EvidenceStrength
  document_coverage: number
  created_at: string
}

export interface QueryHistoryItem {
  id: string
  user_id: string
  query_text: string
  output_format: OutputFormat
  document_ids: string[]
  result: QueryResult
  created_at: string
}

export type WorkspaceMode = 'study' | 'research' | 'coding'

// ─── Coding Mode ────────────────────────────────────────────────────────────

// Languages Coding Mode understands. `language` is stored as free text in the
// DB (no constraint), so users are not limited to these — the union lists the
// well-known ids for editor support while still allowing any other string.
export type KnownCodingLanguage =
  | 'javascript'
  | 'typescript'
  | 'jsx'
  | 'tsx'
  | 'python'
  | 'html'
  | 'css'
  | 'scss'
  | 'java'
  | 'cpp'
  | 'c'
  | 'csharp'
  | 'go'
  | 'rust'
  | 'php'
  | 'ruby'
  | 'swift'
  | 'kotlin'
  | 'sql'
  | 'json'
  | 'yaml'
  | 'markdown'
  | 'shell'
  | 'dart'
  | 'r'
  | 'xml'
  | 'plaintext'

export type CodingLanguage = KnownCodingLanguage | (string & {})

// A file is either editable text/code or an uploaded binary asset (image, etc.)
export type CodingFileKind = 'text' | 'upload'

export interface CodingProject {
  id: string
  user_id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface CodingFolder {
  id: string
  project_id: string
  user_id: string
  parent_id: string | null
  name: string
  created_at: string
  updated_at: string
}

export interface CodingFile {
  id: string
  project_id: string
  user_id: string
  folder_id: string | null
  name: string
  language: CodingLanguage
  content: string
  // 'text' = editable code; 'upload' = binary asset stored in Supabase Storage
  kind: CodingFileKind
  storage_path: string | null
  mime_type: string | null
  created_at: string
  updated_at: string
}

export interface CodingMessage {
  id: string
  project_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
}

// Quick actions surfaced in the Coding Mode editor toolbar. The `id` is sent
// to the coding API to select the matching instruction template.
export type CodingActionId =
  | 'explain'
  | 'find_bugs'
  | 'refactor'
  | 'optimize'
  | 'document'
  | 'review'
  | 'generate_tests'
  | 'improve_performance'
  | 'analyze_project'

export interface Conversation {
  id: string
  user_id: string
  title: string
  document_id: string | null
  created_at: string
  updated_at: string
}

export interface MessageVersion {
  id: string
  content: string
  created_at: string
}

export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
  // For assistant messages: stores alternative versions when regenerated
  versions?: MessageVersion[]
  activeVersionIndex?: number
}

// Coerces a single raw version entry into a MessageVersion. Entries can come
// back as proper objects (JSONB) or as stringified JSON (legacy TEXT[] rows).
function normalizeVersion(raw: unknown): MessageVersion | null {
  let v = raw
  if (typeof v === 'string') {
    // Legacy TEXT[] rows stored each version as a JSON string. Try to parse;
    // if it's just a plain string, treat it as the content itself.
    try {
      v = JSON.parse(v)
    } catch {
      return { id: crypto.randomUUID(), content: v as string, created_at: new Date().toISOString() }
    }
  }
  if (v && typeof v === 'object') {
    const obj = v as Record<string, unknown>
    if (typeof obj.content === 'string') {
      return {
        id: typeof obj.id === 'string' ? obj.id : crypto.randomUUID(),
        content: obj.content,
        created_at: typeof obj.created_at === 'string' ? obj.created_at : new Date().toISOString(),
      }
    }
  }
  return null
}

// Normalizes a raw Supabase `messages` row into a Message. The DB column is
// `active_version_index` (snake_case) and `versions` is JSONB; this keeps the
// regenerate version arrows working after a page reload.
export function mapMessageRow(row: Record<string, unknown>): Message {
  let rawVersions = row.versions
  // A JSONB column can occasionally surface as a JSON string; parse it.
  if (typeof rawVersions === 'string') {
    try {
      rawVersions = JSON.parse(rawVersions)
    } catch {
      rawVersions = []
    }
  }
  const versions = Array.isArray(rawVersions)
    ? (rawVersions.map(normalizeVersion).filter(Boolean) as MessageVersion[])
    : []

  const rawIndex = (row.active_version_index as number | undefined) ?? 0
  // Clamp the active index so it always points at a real version.
  const activeVersionIndex =
    versions.length > 0 ? Math.min(Math.max(rawIndex, 0), versions.length - 1) : 0

  return {
    id: row.id as string,
    conversation_id: row.conversation_id as string,
    role: row.role as Message['role'],
    content: row.content as string,
    created_at: row.created_at as string,
    versions,
    activeVersionIndex,
  }
}

export const OUTPUT_FORMAT_LABELS: Record<OutputFormat, string> = {
  summarize: 'Summarize',
  extract_claims: 'Extract Claims',
  compare_methodology: 'Compare Methodology',
  identify_contradictions: 'Identify Contradictions',
  define_key_terms: 'Define Key Terms',
  extract_research_gaps: 'Extract Research Gaps',
}

// ── Website CMS contracts (shared by admin + website) ───────────────────────
export * from "./cms-types"
export * from "./cms-schema"
