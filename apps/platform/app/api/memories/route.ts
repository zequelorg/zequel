import { createClient } from '@zequel/shared/supabase/server'

// GET /api/memories — list the current user's saved memories
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('memories')
    .select('id, content, source, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[Zequel] Memories GET error:', error.message)
    return Response.json({ error: 'Failed to load memories' }, { status: 500 })
  }

  return Response.json({ memories: data ?? [] })
}

// POST /api/memories — manually add a memory
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const content = typeof body.content === 'string' ? body.content.trim() : ''

  if (!content) {
    return Response.json({ error: 'Content is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('memories')
    .insert({ user_id: user.id, content: content.slice(0, 500), source: 'user' })
    .select('id, content, source, created_at')
    .single()

  if (error) {
    console.error('[Zequel] Memories POST error:', error.message)
    return Response.json({ error: 'Failed to save memory' }, { status: 500 })
  }

  return Response.json({ memory: data })
}

// DELETE /api/memories?id=xxx — delete one, or ?all=true — delete all
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const all = searchParams.get('all')

  let query = supabase.from('memories').delete().eq('user_id', user.id)

  if (all === 'true') {
    // delete all for the user (user_id filter already applied)
  } else if (id) {
    query = query.eq('id', id)
  } else {
    return Response.json({ error: 'Missing id or all parameter' }, { status: 400 })
  }

  const { error } = await query

  if (error) {
    console.error('[Zequel] Memories DELETE error:', error.message)
    return Response.json({ error: 'Failed to delete memory' }, { status: 500 })
  }

  return Response.json({ success: true })
}
