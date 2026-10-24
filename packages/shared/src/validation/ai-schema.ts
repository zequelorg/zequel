import { z } from 'zod'

// Chat request validation
export const chatRequestSchema = z.object({
  conversation_id: z.string().uuid('Invalid conversation ID'),
  message: z.string().max(8000, 'Message too long (max 8000 chars)').optional().nullable(),
  document_id: z.string().uuid().nullable().optional(),
  document_ids: z.array(z.string().uuid()).max(10).optional(),
  images: z.array(z.string()).max(5, 'Max 5 images allowed').optional(),
  // full_content embeds compressed base64 image data URLs for DB persistence.
  // Allow headroom for up to 5 compressed images (client downscales each).
  full_content: z.string().max(8000000).optional(),
  regenerate: z.boolean().optional(),
})

// Query/Research request validation
export const queryRequestSchema = z.object({
  query: z.string().min(1, 'Query required').max(2000, 'Query too long (max 2000 chars)'),
  output_format: z.enum(['summarize', 'extract_claims', 'compare_methodology', 'identify_contradictions', 'define_key_terms', 'extract_research_gaps']),
  document_ids: z.array(z.string().uuid()).min(1, 'At least one document required').max(5, 'Max 5 documents'),
})

// Coding Mode chat request validation.
// Language is stored as free text (users are not limited to a fixed list), so
// we validate it as a bounded string rather than a strict enum.
const codingLanguageSchema = z.string().min(1).max(40)

export const codingChatRequestSchema = z.object({
  project_id: z.string().uuid('Invalid project ID'),
  message: z.string().max(8000, 'Message too long (max 8000 chars)').optional().nullable(),
  // The active file being worked on (drives the "current file" context)
  active_file_id: z.string().uuid().nullable().optional(),
  active_file_name: z.string().max(200).optional().nullable(),
  active_language: codingLanguageSchema.optional(),
  active_file_content: z.string().max(200000).optional().nullable(),
  // Lightweight listing of all project files (name + language + content)
  project_files: z
    .array(
      z.object({
        name: z.string().max(200),
        language: codingLanguageSchema,
        content: z.string().max(200000),
      })
    )
    .max(50)
    .optional(),
  // File paths the user explicitly attached so the AI focuses on them
  attached_files: z.array(z.string().max(200)).max(20).optional(),
  // Optional uploaded documents to use as requirements/context
  document_ids: z.array(z.string().uuid()).max(10).optional(),
  // Quick action id (explain, find_bugs, analyze_project, etc.) or null for free chat
  action: z
    .enum([
      'explain',
      'find_bugs',
      'refactor',
      'optimize',
      'document',
      'review',
      'generate_tests',
      'improve_performance',
      'analyze_project',
    ])
    .nullable()
    .optional(),
  // Whether the Socratic tutor (Learning Mode) prompt should be used
  learning_mode: z.boolean().optional(),
})

// Document extraction request validation
export const extractRequestSchema = z.object({
  documentId: z.string().uuid('Invalid document ID'),
  filePath: z.string().min(1, 'File path required'),
})

// Request types
export type RequestType = 'chat' | 'query' | 'extract'

// Generic validation function
export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data)
  if (!result.success) {
    const errors = result.error.errors.map(e => e.message).join(', ')
    return { success: false, error: errors }
  }
  return { success: true, data: result.data }
}
