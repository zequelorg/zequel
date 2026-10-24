import { createClient } from '@zequel/shared/supabase/server'
import { redirect } from 'next/navigation'
import { SettingsClient } from './settings-client'

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch preferences and profile in parallel
  const [{ data: preferences }, { data: profile }] = await Promise.all([
    supabase.from('preferences').select('*').eq('user_id', user.id).single(),
    supabase.from('profiles').select('*').eq('id', user.id).single(),
  ])

  return (
    <SettingsClient
      userId={user.id}
      userEmail={user.email || ''}
      preferences={preferences}
      profile={profile}
    />
  )
}
