import { createClient } from '@zequel/shared/supabase/server'
import { redirect } from 'next/navigation'
import { WorkspaceClient } from './workspace-client'

export default async function WorkspacePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [
    { data: documents },
    { data: profile },
    { data: queryHistory },
    { data: conversations },
  ] = await Promise.all([
    supabase
      .from('documents')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase
      .from('queries')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(50),
  ])

  return (
    <WorkspaceClient
      userId={user.id}
      userEmail={user.email || ''}
      initialDocuments={documents || []}
      profile={profile}
      initialHistory={queryHistory || []}
      initialConversations={conversations || []}
    />
  )
}
