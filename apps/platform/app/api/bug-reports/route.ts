import { NextResponse } from 'next/server'
import { createClient } from '@zequel/shared/supabase/server'
import { createSupportTicket } from '@zequel/shared/support/create-ticket'

/**
 * Submits a bug report from the signed-in user. The report is stored in the
 * shared `bug_reports` table with the user's id, email and name so admins can
 * see exactly who reported it and review it in the admin dashboard.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const subject = typeof body?.subject === 'string' ? body.subject.trim() : ''
    const description = typeof body?.description === 'string' ? body.description.trim() : ''
    const pageUrl = typeof body?.pageUrl === 'string' ? body.pageUrl.slice(0, 500) : null

    if (!subject || subject.length < 3) {
      return NextResponse.json({ error: 'Please enter a short subject.' }, { status: 400 })
    }
    if (!description || description.length < 10) {
      return NextResponse.json(
        { error: 'Please describe the issue in a little more detail.' },
        { status: 400 }
      )
    }
    if (subject.length > 150) {
      return NextResponse.json({ error: 'Subject is too long.' }, { status: 400 })
    }
    if (description.length > 5000) {
      return NextResponse.json({ error: 'Description is too long.' }, { status: 400 })
    }

    // Pull the user's display name so admins see who reported the issue.
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, display_name, username')
      .eq('id', user.id)
      .maybeSingle()

    const userName =
      profile?.full_name || profile?.display_name || profile?.username || null

    const { error: insertError } = await supabase.from('bug_reports').insert({
      user_id: user.id,
      user_email: user.email,
      user_name: userName,
      subject,
      description,
      page_url: pageUrl,
      user_agent: request.headers.get('user-agent')?.slice(0, 500) ?? null,
    })

    if (insertError) {
      console.error('[Zequel] Bug report insert error:', insertError)
      return NextResponse.json({ error: 'Failed to submit bug report' }, { status: 500 })
    }

    // Also create a unified support ticket so the report appears in the admin
    // Support Center. Best-effort: a failure here must not fail the submission.
    try {
      await createSupportTicket({
        source: 'bug_report',
        userId: user.id,
        userEmail: user.email ?? '',
        userName,
        subject,
        body: description,
        bug: {
          pageUrl,
          description,
        },
      })
    } catch (ticketError) {
      console.error('[Zequel] Bug report -> support ticket failed:', ticketError)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Zequel] Bug report error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to submit bug report' },
      { status: 500 }
    )
  }
}
