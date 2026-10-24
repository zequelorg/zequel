import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@zequel/shared/supabase/server'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

/**
 * Gathers all of the signed-in user's data and emails them a JSON copy.
 * Scoped strictly to the authenticated user's own rows.
 */
export async function POST() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Collect every table the user owns. RLS keeps these scoped to the user.
    const [
      { data: profile },
      { data: preferences },
      { data: documents },
      { data: conversations },
      { data: queries },
      { data: memories },
      { data: subscription },
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('preferences').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('documents').select('*').eq('user_id', user.id),
      supabase.from('conversations').select('*').eq('user_id', user.id),
      supabase.from('queries').select('*').eq('user_id', user.id),
      supabase.from('memories').select('*').eq('user_id', user.id),
      supabase.from('subscriptions').select('*').eq('user_id', user.id).maybeSingle(),
    ])

    // Messages are scoped via the user's conversations (RLS allows reading them).
    const conversationIds = (conversations ?? []).map((c: { id: string }) => c.id)
    let messages: unknown[] = []
    if (conversationIds.length > 0) {
      const { data: messageRows } = await supabase
        .from('messages')
        .select('*')
        .in('conversation_id', conversationIds)
      messages = messageRows ?? []
    }

    const exportPayload = {
      exported_at: new Date().toISOString(),
      account: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
      },
      profile: profile ?? null,
      preferences: preferences ?? null,
      subscription: subscription ?? null,
      documents: documents ?? [],
      conversations: conversations ?? [],
      messages: messages,
      queries: queries ?? [],
      memories: memories ?? [],
    }

    const json = JSON.stringify(exportPayload, null, 2)
    const base64 = Buffer.from(json, 'utf-8').toString('base64')
    const dateStamp = new Date().toISOString().slice(0, 10)

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'Email service is not configured' }, { status: 500 })
    }

    const counts = {
      documents: exportPayload.documents.length,
      conversations: exportPayload.conversations.length,
      messages: exportPayload.messages.length,
      queries: exportPayload.queries.length,
      memories: exportPayload.memories.length,
    }

    const { error: sendError } = await getResend().emails.send({
      from: 'Zequel <noreply@zequel.xyz>',
      to: user.email!,
      subject: 'Your Zequel data export',
      html: exportEmailHtml(counts),
      attachments: [
        {
          filename: `zequel-data-export-${dateStamp}.json`,
          content: base64,
        },
      ],
    })

    if (sendError) {
      console.error('[Zequel] Export email send error:', sendError)
      return NextResponse.json({ error: 'Failed to send export email' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Zequel] Export data error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to export data' },
      { status: 500 }
    )
  }
}

function exportEmailHtml(counts: Record<string, number>) {
  const rows = Object.entries(counts)
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#444444;text-transform:capitalize;">${label}</td><td style="padding:6px 0;text-align:right;font-family:'Courier New',Courier,monospace;font-size:13px;font-weight:700;color:#000000;">${value}</td></tr>`
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Zequel Data Export</title></head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:'Courier New',Courier,monospace;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:40px 0;">
    <tr><td align="center">
      <table role="presentation" width="460" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border:1px solid #e5e5e5;">
        <tr><td style="padding:32px 40px 24px 40px;border-bottom:1px solid #e5e5e5;">
          <span style="font-size:18px;font-weight:700;letter-spacing:6px;color:#000000;text-transform:uppercase;">ZEQUEL</span>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <p style="margin:0 0 8px 0;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#999999;">Data Export</p>
          <p style="margin:0 0 24px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#444444;">
            A copy of your Zequel data is attached as a JSON file. It includes the following:
          </p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e5e5;">
            ${rows}
          </table>
          <p style="margin:28px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#999999;">
            If you did not request this export, please secure your account immediately.
          </p>
        </td></tr>
        <tr><td style="padding:20px 40px;border-top:1px solid #e5e5e5;">
          <p style="margin:0;font-size:10px;letter-spacing:2px;color:#999999;text-transform:uppercase;">Absalex Labs</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
