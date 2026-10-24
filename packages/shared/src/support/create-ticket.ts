import { createServiceClient, canCreateServiceClient } from '../supabase/service'

export type SupportSource =
  | 'support_email'
  | 'information_request'
  | 'bug_report'
  | 'contact_form'

export interface CreateSupportTicketInput {
  /** Where the ticket originated. Drives the Support Center source filter. */
  source: SupportSource
  /** Owning user id. Null for anonymous submissions (e.g. website contact form). */
  userId?: string | null
  userEmail: string
  userName?: string | null
  subject: string
  /** Full message body from the user. Becomes the first timeline entry. */
  body: string
  /** Optional bug context captured automatically from the platform. */
  bug?: {
    browser?: string | null
    device?: string | null
    os?: string | null
    pageUrl?: string | null
    screenshot?: string | null
    description?: string | null
  }
}

/**
 * Creates a support ticket (and its initial user message) in the unified
 * `support_tickets` / `support_messages` tables that power the admin Support
 * Center. Every inbound channel — in-app bug reports, the website contact form,
 * info requests and support emails — funnels through here so admins see a
 * single inbox.
 *
 * Uses the service-role client because submitters are often anonymous or the
 * insert touches columns RLS would otherwise restrict. Returns the new ticket
 * id, or throws if the database is unreachable.
 */
export async function createSupportTicket(
  input: CreateSupportTicketInput,
): Promise<{ ticketId: string; ref: string | null }> {
  if (!canCreateServiceClient()) {
    throw new Error('SUPPORT_SERVICE_UNAVAILABLE')
  }

  const supabase = createServiceClient()

  // A short, single-line preview for the ticket list.
  const preview = input.body.replace(/\s+/g, ' ').trim().slice(0, 160)

  const { data: ticket, error: ticketError } = await supabase
    .from('support_tickets')
    .insert({
      source: input.source,
      user_id: input.userId ?? null,
      user_email: input.userEmail,
      user_name: input.userName ?? null,
      subject: input.subject,
      preview,
      status: 'open',
      bug_browser: input.bug?.browser ?? null,
      bug_device: input.bug?.device ?? null,
      bug_os: input.bug?.os ?? null,
      bug_page_url: input.bug?.pageUrl ?? null,
      bug_screenshot: input.bug?.screenshot ?? null,
      bug_description: input.bug?.description ?? null,
    })
    .select('id, ref')
    .single()

  if (ticketError || !ticket) {
    throw new Error(ticketError?.message || 'SUPPORT_TICKET_INSERT_FAILED')
  }

  // The opening message from the user. The DB trigger bumps the ticket's
  // activity timestamps automatically.
  const { error: messageError } = await supabase.from('support_messages').insert({
    ticket_id: ticket.id,
    kind: 'user',
    author: input.userName || input.userEmail,
    body: input.body,
  })

  if (messageError) {
    // The ticket exists; surface the issue but don't lose the ticket.
    console.error('[Zequel] Support message insert error:', messageError.message)
  }

  return { ticketId: ticket.id, ref: ticket.ref ?? null }
}

export interface InboundEmailInput {
  /** Sender email address (the user). */
  fromEmail: string
  /** Sender display name, if the email provided one. */
  fromName?: string | null
  /** Email subject line (may contain a "[ZQ-1234]" ticket ref). */
  subject: string
  /** Plain-text (or stripped) body of the email. */
  body: string
  /** Address the email was sent to, e.g. support@zequel.xyz. */
  toEmail?: string | null
}

/**
 * Extract a Zequel ticket ref (e.g. "ZQ-4821") from an email subject so replies
 * thread onto the original ticket. Returns null when no ref is present.
 */
export function parseTicketRef(subject: string | null | undefined): string | null {
  if (!subject) return null
  const match = subject.match(/ZQ-\d{4,}/i)
  return match ? match[0].toUpperCase() : null
}

/**
 * Ingest an inbound support email. If the subject carries a known ticket ref,
 * the email is appended to that ticket as a new user message (and the ticket is
 * reopened). Otherwise a brand-new `support_email` ticket is created. This is
 * what powers email -> Support Center and admin <-> user email threading.
 */
export async function ingestInboundEmail(
  input: InboundEmailInput,
): Promise<{ ticketId: string; ref: string | null; threaded: boolean }> {
  if (!canCreateServiceClient()) {
    throw new Error('SUPPORT_SERVICE_UNAVAILABLE')
  }

  const supabase = createServiceClient()
  const ref = parseTicketRef(input.subject)

  // Try to thread onto an existing ticket when we recognise the ref.
  if (ref) {
    const { data: existing } = await supabase
      .from('support_tickets')
      .select('id, ref')
      .eq('ref', ref)
      .maybeSingle()

    if (existing) {
      const { error: msgError } = await supabase.from('support_messages').insert({
        ticket_id: existing.id,
        kind: 'user',
        author: input.fromName || input.fromEmail,
        body: input.body,
        email_from: input.fromEmail,
        email_to: input.toEmail ?? null,
        email_subject: input.subject,
      })
      if (msgError) {
        throw new Error(msgError.message)
      }

      // A user reply reopens a resolved/closed ticket and flags it for staff.
      await supabase
        .from('support_tickets')
        .update({ status: 'open' })
        .eq('id', existing.id)

      return { ticketId: existing.id, ref: existing.ref ?? ref, threaded: true }
    }
  }

  // No matching ticket -> create a fresh support_email ticket.
  const created = await createSupportTicket({
    source: 'support_email',
    userEmail: input.fromEmail,
    userName: input.fromName ?? null,
    subject: input.subject || '(no subject)',
    body: input.body,
  })

  return { ...created, threaded: false }
}
