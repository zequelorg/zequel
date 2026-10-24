'use client'

import { useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTheme } from 'next-themes'
import { createClient } from '@zequel/shared/supabase/client'
import { ZequelLogo } from '@zequel/ui/components/zequel-logo'
import { OtpVerify } from '@/components/otp-verify'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@zequel/ui/components/input-otp'
import { SessionsPanel } from '@/components/settings/sessions-panel'
import { SubscriptionPanel } from '@/components/settings/subscription-panel'
import { MemoriesDialog, type Memory } from '@/components/settings/memories-dialog'
import { Avatar, AvatarImage, AvatarFallback } from '@zequel/ui/components/avatar'
import { Separator } from '@zequel/ui/components/separator'
import { Button } from '@zequel/ui/components/button'
import { Input } from '@zequel/ui/components/input'
import { Textarea } from '@zequel/ui/components/textarea'
import { Switch } from '@zequel/ui/components/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@zequel/ui/components/select'
import { OUTPUT_FORMAT_LABELS } from '@zequel/types'
import type { OutputFormat, UserPreferences, Profile } from '@zequel/types'
import {
  ArrowLeft,
  Camera,
  User,
  Shield,
  FileOutput,
  CreditCard,
  Languages,
  LifeBuoy,
  HelpCircle,
  SlidersHorizontal,
  Bug,
  Download,
  Trash2,
  ScrollText,
  Globe,
  BookOpen,
  ExternalLink,
  ChevronRight,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@zequel/ui/components/dialog'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface SettingsClientProps {
  userId: string
  userEmail: string
  preferences: UserPreferences | null
  profile: Profile | null
}

const CATEGORIES = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'account', label: 'Account', icon: Shield },
  { id: 'subscription', label: 'Subscription', icon: CreditCard },
  { id: 'preferences', label: 'Preferences', icon: SlidersHorizontal },
  { id: 'output', label: 'Output', icon: FileOutput },
  { id: 'help', label: 'Help', icon: HelpCircle },
] as const

type Category = (typeof CATEGORIES)[number]['id']

const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/
const NAME_REGEX = /^[a-zA-Z0-9 ]*$/

export function SettingsClient({ userId, userEmail, preferences, profile }: SettingsClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { theme, setTheme } = useTheme()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const tabParam = searchParams.get('tab')
  const initialCategory: Category = CATEGORIES.some((c) => c.id === tabParam)
    ? (tabParam as Category)
    : 'profile'
  const [activeCategory, setActiveCategory] = useState<Category>(initialCategory)

  // Profile state
  const [username, setUsername] = useState(profile?.username || '')
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '')
  const [usernameError, setUsernameError] = useState('')
  const [nameError, setNameError] = useState('')
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)

  // Password change state
  const [passwordStep, setPasswordStep] = useState<'idle' | 'otp_sent' | 'otp_verify' | 'new_password'>('idle')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [isSendingOtp, setIsSendingOtp] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  // Preferences state
  const [defaultFormat, setDefaultFormat] = useState<OutputFormat>(
    preferences?.default_output_format || 'summarize'
  )
  const [autoCitation, setAutoCitation] = useState(preferences?.auto_citation ?? true)

  // Language (persisted to the preferences table)
  const [language, setLanguage] = useState(preferences?.language || 'en')

  // Export data flow
  const [isExporting, setIsExporting] = useState(false)
  const [exportMessage, setExportMessage] = useState('')

  // Report a bug flow (submitted to the admin dashboard)
  const [bugOpen, setBugOpen] = useState(false)
  const [bugSubject, setBugSubject] = useState('')
  const [bugDescription, setBugDescription] = useState('')
  const [isSubmittingBug, setIsSubmittingBug] = useState(false)
  const [bugError, setBugError] = useState('')
  const [bugSuccess, setBugSuccess] = useState('')

  // Delete account flow: idle -> sending OTP -> verify -> deleting
  const [deleteStep, setDeleteStep] = useState<'idle' | 'confirm' | 'otp_verify'>('idle')
  const [isSendingDeleteOtp, setIsSendingDeleteOtp] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [deleteCode, setDeleteCode] = useState('')

  // Personalization / memory state — persisted to the `preferences` table
  const [referenceMemories, setReferenceMemories] = useState(
    preferences?.reference_saved_memories ?? true
  )
  const [referenceHistory, setReferenceHistory] = useState(
    preferences?.reference_chat_history ?? true
  )
  const [nickname, setNickname] = useState(preferences?.nickname || '')
  const [occupation, setOccupation] = useState(preferences?.occupation || '')
  const [aboutYou, setAboutYou] = useState(preferences?.about_you || '')

  // Manage memories dialog — loaded from /api/memories
  const [memoriesOpen, setMemoriesOpen] = useState(false)
  const [memories, setMemories] = useState<Memory[]>([])
  const [memoriesLoading, setMemoriesLoading] = useState(false)

  const openMemories = async () => {
    setMemoriesOpen(true)
    setMemoriesLoading(true)
    try {
      const res = await fetch('/api/memories')
      const data = await res.json()
      if (res.ok) {
        setMemories((data.memories || []).map((m: { id: string; content: string }) => ({ id: m.id, content: m.content })))
      }
    } catch (err) {
      console.error('[Zequel] Failed to load memories:', err)
    } finally {
      setMemoriesLoading(false)
    }
  }

  const deleteMemory = async (id: string) => {
    setMemories((prev) => prev.filter((m) => m.id !== id))
    try {
      await fetch(`/api/memories?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    } catch (err) {
      console.error('[Zequel] Failed to delete memory:', err)
    }
  }

  const deleteAllMemories = async () => {
    setMemories([])
    try {
      await fetch('/api/memories?all=true', { method: 'DELETE' })
    } catch (err) {
      console.error('[Zequel] Failed to delete all memories:', err)
    }
  }

  const [isSaving, setIsSaving] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  const validateUsername = (value: string) => {
    if (value && !USERNAME_REGEX.test(value)) { setUsernameError('Only letters, numbers, and underscores'); return false }
    if (value && value.length < 3) { setUsernameError('Minimum 3 characters'); return false }
    setUsernameError('')
    return true
  }

  const validateName = (value: string) => {
    if (value && !NAME_REGEX.test(value)) { setNameError('No symbols allowed'); return false }
    setNameError('')
    return true
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return
    if (file.size > 2 * 1024 * 1024) return
    setIsUploadingAvatar(true)
    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const filePath = `${userId}/avatar.${ext}`
    const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true })
    if (!uploadError) {
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath)
      const newUrl = `${urlData.publicUrl}?t=${Date.now()}`
      setAvatarUrl(newUrl)
      await supabase.from('profiles').update({ avatar_url: newUrl }).eq('id', userId)
    }
    setIsUploadingAvatar(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Change password flow: send OTP -> verify -> set new password
  const handleStartPasswordChange = async () => {
    setPasswordError('')
    setPasswordSuccess('')
    setIsSendingOtp(true)
    try {
      const res = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, purpose: 'change_password' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send code')
      setPasswordStep('otp_verify')
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to send code')
    } finally {
      setIsSendingOtp(false)
    }
  }

  const handlePasswordOtpVerified = () => {
    setPasswordStep('new_password')
  }

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    if (newPassword.length < 6) { setPasswordError('Password must be at least 6 characters'); return }
    if (newPassword !== confirmNewPassword) { setPasswordError('Passwords do not match'); return }
    setIsChangingPassword(true)
    try {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) throw updateError
      setPasswordSuccess('Password updated successfully')
      setPasswordStep('idle')
      setNewPassword('')
      setConfirmNewPassword('')
      setTimeout(() => setPasswordSuccess(''), 4000)
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to update password')
    } finally {
      setIsChangingPassword(false)
    }
  }

  const handleSave = async () => {
    const usernameValid = validateUsername(username)
    const nameValid = validateName(fullName)
    if (!usernameValid || !nameValid) return
    setIsSaving(true)
    setSaveMessage('')
    try {
      const supabase = createClient()
      
      // Update profile with avatar_url
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          username: username || null, 
          full_name: fullName || null,
          avatar_url: avatarUrl || null
        })
        .eq('id', userId)
      
      if (profileError) {
        if (profileError.message.includes('duplicate') || profileError.message.includes('unique')) {
          setUsernameError('Username already taken')
          throw new Error('Username already taken')
        }
        if (profileError.message.includes('username_format')) {
          setUsernameError('Only letters, numbers, and underscores')
          throw profileError
        }
        if (profileError.message.includes('name_format')) {
          setNameError('No symbols allowed')
          throw profileError
        }
        throw profileError
      }

      // Update preferences
      const { error: prefError } = await supabase
        .from('preferences')
        .update({
          theme: theme as 'light' | 'dark',
          language: language || 'en',
          default_output_format: defaultFormat,
          auto_citation: autoCitation,
          reference_saved_memories: referenceMemories,
          reference_chat_history: referenceHistory,
          nickname: nickname.trim() || null,
          occupation: occupation.trim() || null,
          about_you: aboutYou.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)

      if (prefError) throw prefError

      setIsSaving(false)
      setSaveMessage('Saved')
      setTimeout(() => setSaveMessage(''), 2000)
    } catch (err) {
      setIsSaving(false)
      console.error('[Zequel] Save error:', err)
      if (!usernameError && !nameError) {
        setSaveMessage('Error saving changes')
      }
    }
  }

  const handleSignOut = async () => {
    setIsSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Export data: emails the user a JSON copy of their data
  const handleExportData = async () => {
    setIsExporting(true)
    setExportMessage('')
    try {
      const res = await fetch('/api/account/export', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to export data')
      setExportMessage(`A copy has been emailed to ${userEmail}`)
      setTimeout(() => setExportMessage(''), 6000)
    } catch (err) {
      setExportMessage(err instanceof Error ? err.message : 'Failed to export data')
    } finally {
      setIsExporting(false)
    }
  }

  // Report a bug: opens an in-app form and submits to the admin dashboard
  const handleSubmitBug = async () => {
    setBugError('')
    if (bugSubject.trim().length < 3) {
      setBugError('Please enter a short subject.')
      return
    }
    if (bugDescription.trim().length < 10) {
      setBugError('Please describe the issue in a little more detail.')
      return
    }
    setIsSubmittingBug(true)
    try {
      const res = await fetch('/api/bug-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: bugSubject.trim(),
          description: bugDescription.trim(),
          pageUrl: typeof window !== 'undefined' ? window.location.href : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to submit bug report')
      setBugSuccess('Thanks! Your report has been sent to our team.')
      setBugSubject('')
      setBugDescription('')
      setTimeout(() => {
        setBugOpen(false)
        setBugSuccess('')
      }, 1800)
    } catch (err) {
      setBugError(err instanceof Error ? err.message : 'Failed to submit bug report')
    } finally {
      setIsSubmittingBug(false)
    }
  }

  const toggleBugForm = () => {
    setBugError('')
    setBugSuccess('')
    setBugOpen((prev) => {
      // When closing, clear the form fields so it opens fresh next time.
      if (prev) {
        setBugSubject('')
        setBugDescription('')
      }
      return !prev
    })
  }

  // Delete account: send OTP -> verify -> delete
  const handleStartDelete = async () => {
    setDeleteError('')
    setIsSendingDeleteOtp(true)
    try {
      const res = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, purpose: 'delete_account' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send code')
      setDeleteStep('otp_verify')
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to send code')
    } finally {
      setIsSendingDeleteOtp(false)
    }
  }

  const handleConfirmDelete = async (code: string) => {
    setDeleteError('')
    setIsDeleting(true)
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete account')
      // Account gone — send them to signup/home
      router.push('/login')
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete account')
      setIsDeleting(false)
    }
  }

  const cancelDelete = () => {
    setDeleteStep('idle')
    setDeleteError('')
    setDeleteCode('')
  }

  const displayInitials = (() => {
    const name = fullName || profile?.display_name || userEmail || 'U'
    return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  })()

  return (
    <div className="flex h-svh flex-col bg-background">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-4 border-b border-border px-6 py-4">
        <Link href="/workspace">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <ZequelLogo />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-6 py-8">
        <h1 className="font-mono text-sm font-semibold uppercase tracking-wider text-foreground">Settings</h1>

        {/* Category Navigation */}
        <div className="mt-6 flex gap-1 rounded-lg border border-border bg-secondary/30 p-1">
          {CATEGORIES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveCategory(id)}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2.5 font-mono text-[11px] uppercase tracking-wider transition-all',
                activeCategory === id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Content area */}
        <div className="mt-8">
          {/* ========== PROFILE ========== */}
          {activeCategory === 'profile' && (
            <div className="flex flex-col gap-6">
              <SectionHeader title="Profile" description="Your public identity on Zequel." />

              {/* Avatar */}
              <div className="flex items-center gap-5">
                <button type="button" onClick={() => fileInputRef.current?.click()} className="group relative shrink-0" disabled={isUploadingAvatar}>
                  <Avatar className="h-20 w-20">
                    {avatarUrl ? <AvatarImage src={avatarUrl} alt="Profile" /> : null}
                    <AvatarFallback className="bg-secondary font-mono text-base text-foreground">{displayInitials}</AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-foreground/0 transition-colors group-hover:bg-foreground/10">
                    <Camera className="h-5 w-5 text-foreground opacity-0 transition-opacity group-hover:opacity-70" />
                  </div>
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    {isUploadingAvatar ? 'Uploading...' : 'Click to change photo'}
                  </span>
                  <span className="font-mono text-[10px] tracking-wider text-muted-foreground/50">JPG, PNG. Max 2MB.</span>
                </div>
              </div>

              <Separator />

              {/* Username */}
              <FieldRow label="Username" error={usernameError}>
                <Input
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); validateUsername(e.target.value) }}
                  placeholder="your_username"
                  className="h-9 w-full max-w-xs rounded-md border-border bg-background font-mono text-sm text-foreground placeholder:text-muted-foreground/40"
                />
              </FieldRow>

              <Separator />

              {/* Full Name */}
              <FieldRow label="Name" error={nameError}>
                <Input
                  value={fullName}
                  onChange={(e) => { setFullName(e.target.value); validateName(e.target.value) }}
                  placeholder="Your Name"
                  className="h-9 w-full max-w-xs rounded-md border-border bg-background font-sans text-sm text-foreground placeholder:text-muted-foreground/40"
                />
              </FieldRow>

              <Separator />

              <div className="flex items-center gap-3">
                <Button onClick={handleSave} disabled={isSaving} className="h-9 rounded-md bg-foreground px-6 font-mono text-xs uppercase tracking-wider text-background hover:bg-foreground/90">
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
                {saveMessage && <span className="font-mono text-[11px] text-muted-foreground">{saveMessage}</span>}
              </div>
            </div>
          )}

          {/* ========== ACCOUNT ========== */}
          {activeCategory === 'account' && (
            <div className="flex flex-col gap-6">
              <SectionHeader title="Account" description="Manage your email, password, and session." />

              {/* Email */}
              <FieldRow label="Email">
                <span className="font-sans text-sm text-foreground">{userEmail}</span>
              </FieldRow>

              <Separator />

              {/* Change Password */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Password</p>
                    <p className="mt-0.5 font-sans text-[12px] text-muted-foreground/70">Change your account password via email verification.</p>
                  </div>
                  {passwordStep === 'idle' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleStartPasswordChange}
                      disabled={isSendingOtp}
                      className="h-8 rounded-md border-border font-mono text-[11px] uppercase tracking-wider"
                    >
                      {isSendingOtp ? 'Sending...' : 'Change'}
                    </Button>
                  )}
                </div>

                {passwordSuccess && (
                  <p className="rounded-md bg-secondary/50 px-3 py-2 font-mono text-[11px] text-foreground">{passwordSuccess}</p>
                )}

                {passwordStep === 'otp_verify' && (
                  <div className="rounded-lg border border-border bg-secondary/20 p-5">
                    <OtpVerify
                      email={userEmail}
                      purpose="change_password"
                      onVerified={handlePasswordOtpVerified}
                      onBack={() => { setPasswordStep('idle'); setPasswordError('') }}
                    />
                  </div>
                )}

                {passwordStep === 'new_password' && (
                  <form onSubmit={handleSetNewPassword} className="flex flex-col gap-3 rounded-lg border border-border bg-secondary/20 p-5">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Set New Password</p>
                    <Input
                      type="password"
                      placeholder="New password (min 6 chars)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      className="h-9 rounded-md border-border bg-background font-sans text-sm text-foreground placeholder:text-muted-foreground/40"
                      autoComplete="new-password"
                    />
                    <Input
                      type="password"
                      placeholder="Confirm new password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      required
                      className="h-9 rounded-md border-border bg-background font-sans text-sm text-foreground placeholder:text-muted-foreground/40"
                      autoComplete="new-password"
                    />
                    {passwordError && <p className="font-mono text-[10px] text-confidence-low">{passwordError}</p>}
                    <div className="flex items-center gap-2 pt-1">
                      <Button type="submit" disabled={isChangingPassword} className="h-8 rounded-md bg-foreground font-mono text-[11px] uppercase tracking-wider text-background hover:bg-foreground/90">
                        {isChangingPassword ? 'Updating...' : 'Update Password'}
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => { setPasswordStep('idle'); setNewPassword(''); setConfirmNewPassword(''); setPasswordError('') }} className="h-8 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}
              </div>

              <Separator />

              {/* Sign Out */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Sign Out</p>
                  <p className="mt-0.5 font-sans text-[12px] text-muted-foreground/70">Sign out of your current session.</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleSignOut} disabled={isSigningOut} className="h-8 rounded-md border-border font-mono text-[11px] uppercase tracking-wider text-foreground hover:bg-secondary">
                  {isSigningOut ? 'Signing out...' : 'Sign Out'}
                </Button>
              </div>

              <Separator />

              {/* ----- Data ----- */}
              <div className="flex flex-col gap-4">
                <div>
                  <p className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground">Data</p>
                  <p className="mt-1 font-sans text-[13px] leading-relaxed text-muted-foreground">
                    Export a copy of your data or permanently delete your account.
                  </p>
                </div>

                {/* Export */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Export Data</p>
                      <p className="mt-0.5 font-sans text-[12px] text-muted-foreground/70">Email yourself a JSON copy of your data.</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportData}
                    disabled={isExporting}
                    className="h-8 shrink-0 rounded-md border-border font-mono text-[11px] uppercase tracking-wider text-foreground hover:bg-secondary"
                  >
                    {isExporting ? 'Sending...' : 'Export'}
                  </Button>
                </div>
                {exportMessage && (
                  <p className="rounded-md bg-secondary/50 px-3 py-2 font-mono text-[11px] text-foreground">{exportMessage}</p>
                )}

                {/* Delete Account */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Trash2 className="h-4 w-4 shrink-0 text-confidence-low" />
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-wider text-confidence-low">Delete Account</p>
                      <p className="mt-0.5 font-sans text-[12px] text-muted-foreground/70">Permanently remove your account and all data.</p>
                    </div>
                  </div>
                  {deleteStep === 'idle' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteStep('confirm')}
                      className="h-8 shrink-0 rounded-md border-confidence-low/40 font-mono text-[11px] uppercase tracking-wider text-confidence-low hover:bg-confidence-low/10"
                    >
                      Delete
                    </Button>
                  )}
                </div>

                {/* Step 1: confirmation warning */}
                {deleteStep === 'confirm' && (
                  <div className="flex flex-col gap-3 rounded-lg border border-confidence-low/30 bg-confidence-low/5 p-5">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-confidence-low">Confirm Deletion</p>
                    <p className="font-sans text-[13px] leading-relaxed text-foreground">
                      This action is permanent. All your documents, conversations, research, and memories will be erased
                      and cannot be recovered. We&apos;ll email a verification code to{' '}
                      <span className="font-medium">{userEmail}</span> to confirm.
                    </p>
                    {deleteError && <p className="font-mono text-[10px] text-confidence-low">{deleteError}</p>}
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        onClick={handleStartDelete}
                        disabled={isSendingDeleteOtp}
                        className="h-8 rounded-md bg-confidence-low font-mono text-[11px] uppercase tracking-wider text-background hover:bg-confidence-low/90"
                      >
                        {isSendingDeleteOtp ? 'Sending Code...' : 'Send Code'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={cancelDelete}
                        className="h-8 font-mono text-[11px] uppercase tracking-wider text-muted-foreground"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {/* Step 2: OTP verification + final delete */}
                {deleteStep === 'otp_verify' && (
                  <div className="flex flex-col gap-5 rounded-lg border border-confidence-low/30 bg-confidence-low/5 p-5">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-confidence-low">Verify Deletion</p>
                      <p className="mt-2 font-sans text-sm text-muted-foreground">
                        {'Enter the 6-digit code sent to '}
                        <span className="font-medium text-foreground">{userEmail}</span>
                      </p>
                    </div>
                    <div className="flex justify-center">
                      <InputOTP maxLength={6} value={deleteCode} onChange={setDeleteCode}>
                        <InputOTPGroup>
                          {[0, 1, 2, 3, 4, 5].map((i) => (
                            <InputOTPSlot
                              key={i}
                              index={i}
                              className="h-12 w-11 border-border bg-background font-mono text-lg font-bold text-foreground"
                            />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    {deleteError && <p className="text-center font-mono text-[11px] text-confidence-low">{deleteError}</p>}
                    <Button
                      onClick={() => handleConfirmDelete(deleteCode)}
                      disabled={isDeleting || deleteCode.length !== 6}
                      className="h-10 w-full rounded-md bg-confidence-low font-mono text-xs uppercase tracking-wider text-background hover:bg-confidence-low/90 disabled:opacity-40"
                    >
                      {isDeleting ? 'Deleting Account...' : 'Permanently Delete Account'}
                    </Button>
                    <button
                      type="button"
                      onClick={cancelDelete}
                      className="font-mono text-[11px] text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              <Separator />

              {/* Active Sessions */}
              <SessionsPanel />
            </div>
          )}

          {/* ========== SUBSCRIPTION ========== */}
          {activeCategory === 'subscription' && (
            <SubscriptionPanel userId={userId} />
          )}

          {/* ========== PREFERENCES ========== */}
          {activeCategory === 'preferences' && (
            <div className="flex flex-col gap-6">
              <SectionHeader title="Preferences" description="Customize the appearance and language of your workspace." />

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Appearance</p>
                  <p className="mt-0.5 font-sans text-[12px] text-muted-foreground/70">Switch between light and dark mode.</p>
                </div>
                <div className="flex gap-1 rounded-lg border border-border bg-secondary/30 p-1">
                  {['light', 'dark'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTheme(t)}
                      className={cn(
                        'rounded-md px-4 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-all',
                        theme === t
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Languages className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Language</p>
                    <p className="mt-0.5 font-sans text-[12px] text-muted-foreground/70">Choose your preferred interface language.</p>
                  </div>
                </div>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="h-9 w-44 rounded-md border-border font-mono text-[11px] uppercase tracking-wider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover text-popover-foreground">
                    <SelectItem value="en" className="font-mono text-[11px] uppercase tracking-wider">English</SelectItem>
                    <SelectItem value="es" className="font-mono text-[11px] uppercase tracking-wider">Español</SelectItem>
                    <SelectItem value="fr" className="font-mono text-[11px] uppercase tracking-wider">Français</SelectItem>
                    <SelectItem value="de" className="font-mono text-[11px] uppercase tracking-wider">Deutsch</SelectItem>
                    <SelectItem value="pt" className="font-mono text-[11px] uppercase tracking-wider">Português</SelectItem>
                    <SelectItem value="ar" className="font-mono text-[11px] uppercase tracking-wider">العربية</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="flex items-center gap-3">
                <Button onClick={handleSave} disabled={isSaving} className="h-9 rounded-md bg-foreground px-6 font-mono text-xs uppercase tracking-wider text-background hover:bg-foreground/90">
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
                {saveMessage && <span className="font-mono text-[11px] text-muted-foreground">{saveMessage}</span>}
              </div>
            </div>
          )}

          {/* ========== OUTPUT ========== */}
          {activeCategory === 'output' && (
            <div className="flex flex-col gap-6">
              <SectionHeader title="Output" description="Configure how Zequel generates and formats responses." />

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Default Format</p>
                  <p className="mt-0.5 font-sans text-[12px] text-muted-foreground/70">Choose the default output format for new queries.</p>
                </div>
                <Select value={defaultFormat} onValueChange={(v) => setDefaultFormat(v as OutputFormat)}>
                  <SelectTrigger className="h-9 w-48 rounded-md border-border font-mono text-[11px] uppercase tracking-wider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover text-popover-foreground">
                    {Object.entries(OUTPUT_FORMAT_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key} className="font-mono text-[11px] uppercase tracking-wider">{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Auto-Citation</p>
                  <p className="mt-0.5 font-sans text-[12px] text-muted-foreground/70">Automatically include source citations in output.</p>
                </div>
                <Switch checked={autoCitation} onCheckedChange={setAutoCitation} />
              </div>

              <Separator />

              {/* ----- Personalization / Memory ----- */}
              <div>
                <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground">Personalization</h3>
                <p className="mt-1 font-sans text-[13px] leading-relaxed text-muted-foreground">
                  Help Zequel tailor responses to you. These details are kept in mind across conversations.
                </p>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-muted/30 p-4">
                <div className="flex flex-col gap-0.5">
                  <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Manage Memories</p>
                  <p className="mt-0.5 font-sans text-[12px] text-muted-foreground/70">View and delete what Zequel has remembered about you.</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={openMemories}
                  className="h-9 shrink-0 rounded-md font-mono text-[11px] uppercase tracking-wider"
                >
                  Manage
                </Button>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Reference Saved Memories</p>
                  <p className="mt-0.5 font-sans text-[12px] text-muted-foreground/70">Lets Zequel save and use memories when responding.</p>
                </div>
                <Switch checked={referenceMemories} onCheckedChange={setReferenceMemories} />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Reference Chat History</p>
                  <p className="mt-0.5 font-sans text-[12px] text-muted-foreground/70">Lets Zequel reference recent conversations when responding.</p>
                </div>
                <Switch checked={referenceHistory} onCheckedChange={setReferenceHistory} />
              </div>

              <Separator />

              <div className="flex flex-col gap-2">
                <label htmlFor="nickname" className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Your Nickname</label>
                <Input
                  id="nickname"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  maxLength={50}
                  placeholder="What should Zequel call you?"
                  className="h-9 rounded-md border-border font-sans text-sm"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="occupation" className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Your Occupation</label>
                <Input
                  id="occupation"
                  value={occupation}
                  onChange={(e) => setOccupation(e.target.value)}
                  maxLength={100}
                  placeholder="e.g. Student, Researcher, Engineer"
                  className="h-9 rounded-md border-border font-sans text-sm"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="about-you" className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">More About You</label>
                <textarea
                  id="about-you"
                  value={aboutYou}
                  onChange={(e) => setAboutYou(e.target.value)}
                  maxLength={1500}
                  rows={4}
                  placeholder="Interests, values, or preferences to keep in mind"
                  className="flex w-full resize-y rounded-md border border-border bg-transparent px-3 py-2 font-sans text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <span className="self-end font-mono text-[10px] text-muted-foreground/50">{aboutYou.length}/1500</span>
              </div>

              <Separator />

              <div className="flex items-center gap-3">
                <Button onClick={handleSave} disabled={isSaving} className="h-9 rounded-md bg-foreground px-6 font-mono text-xs uppercase tracking-wider text-background hover:bg-foreground/90">
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
                {saveMessage && <span className="font-mono text-[11px] text-muted-foreground">{saveMessage}</span>}
              </div>
            </div>
          )}

          {/* ========== HELP ========== */}
          {activeCategory === 'help' && (
            <div className="flex flex-col gap-8">
              {/* ----- Support ----- */}
              <div className="flex flex-col gap-2">
                <SectionHeader title="Support" description="Get help and share feedback." />
                <div className="flex flex-col overflow-hidden rounded-lg border border-border">
                  <MoreRow
                    icon={LifeBuoy}
                    label="Help Center"
                    description="Browse guides and FAQs."
                    href="https://zequel.xyz/help"
                    external
                  />
                  <Separator />
                  <MoreRow
                    icon={Bug}
                    label="Report a Bug"
                    description="Let us know what went wrong."
                    onClick={toggleBugForm}
                  />
                </div>
              </div>

              {/* ----- Resources ----- */}
              <div className="flex flex-col gap-2">
                <SectionHeader title="Resources" description="Links and reference material." />
                <div className="flex flex-col overflow-hidden rounded-lg border border-border">
                  <MoreRow
                    icon={Globe}
                    label="Website"
                    description="Visit the Zequel website."
                    href="https://zequel.xyz"
                    external
                  />
                  <Separator />
                  <MoreRow
                    icon={BookOpen}
                    label="Documentation"
                    description="Read the product documentation."
                    href="https://zequel.xyz/docs"
                    external
                  />
                </div>
              </div>

              {/* ----- Legal ----- */}
              <div className="flex flex-col gap-2">
                <SectionHeader title="Legal" description="Policies and agreements." />
                <div className="flex flex-col overflow-hidden rounded-lg border border-border">
                  <MoreRow
                    icon={ScrollText}
                    label="Terms of Use"
                    description="Review our terms of service."
                    href="https://zequel.xyz/terms"
                    external
                  />
                  <Separator />
                  <MoreRow
                    icon={Shield}
                    label="Privacy Policy"
                    description="Learn how we handle your data."
                    href="https://zequel.xyz/privacy"
                    external
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-16 pb-8 text-center">
          <span className="font-mono text-[10px] tracking-wider text-muted-foreground/40">Absalex Labs</span>
        </div>
        </div>
      </div>

      <MemoriesDialog
        open={memoriesOpen}
        onOpenChange={setMemoriesOpen}
        memories={memories}
        loading={memoriesLoading}
        onDelete={deleteMemory}
        onDeleteAll={deleteAllMemories}
      />

      {/* Report a bug modal -> submitted to the admin dashboard */}
      <Dialog open={bugOpen} onOpenChange={(open) => (open ? setBugOpen(true) : toggleBugForm())}>
        <DialogContent className="max-w-lg border-border bg-background">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm uppercase tracking-wider">Report a Bug</DialogTitle>
            <DialogDescription className="font-sans text-[13px] leading-relaxed text-muted-foreground">
              {'Tell us what went wrong. This is sent to our team along with your account details ('}
              <span className="font-medium text-foreground">{userEmail}</span>
              {') so we can follow up.'}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="bug-subject" className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Subject
              </label>
              <Input
                id="bug-subject"
                value={bugSubject}
                onChange={(e) => setBugSubject(e.target.value)}
                placeholder="Brief summary of the issue"
                maxLength={150}
                disabled={isSubmittingBug || !!bugSuccess}
                className="h-9 rounded-md border-border bg-background font-sans text-sm"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="bug-description" className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Description
              </label>
              <Textarea
                id="bug-description"
                value={bugDescription}
                onChange={(e) => setBugDescription(e.target.value)}
                placeholder="What happened? What did you expect to happen? Steps to reproduce?"
                maxLength={5000}
                rows={5}
                disabled={isSubmittingBug || !!bugSuccess}
                className="resize-none rounded-md border-border bg-background font-sans text-sm leading-relaxed"
              />
            </div>

            {bugError && <p className="font-mono text-[10px] text-confidence-low">{bugError}</p>}
            {bugSuccess && (
              <p className="rounded-md bg-secondary/60 px-3 py-2 font-mono text-[11px] text-foreground">{bugSuccess}</p>
            )}

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={toggleBugForm}
                disabled={isSubmittingBug}
                className="h-9 font-mono text-xs uppercase tracking-wider text-muted-foreground"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitBug}
                disabled={isSubmittingBug || !!bugSuccess}
                className="h-9 rounded-md bg-foreground px-6 font-mono text-xs uppercase tracking-wider text-background hover:bg-foreground/90"
              >
                {isSubmittingBug ? 'Sending...' : 'Send Report'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-2">
      <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground">{title}</h2>
      <p className="mt-1 font-sans text-[13px] leading-relaxed text-muted-foreground">{description}</p>
    </div>
  )
}

function FieldRow({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
        {error && <span className="font-mono text-[10px] text-confidence-low">{error}</span>}
      </div>
      {children}
    </div>
  )
}

function MoreRow({
  icon: Icon,
  label,
  description,
  href,
  external = false,
  destructive = false,
  onClick,
  active = false,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  description: string
  href?: string
  external?: boolean
  destructive?: boolean
  onClick?: () => void
  active?: boolean
}) {
  const content = (
    <>
      <div className="flex items-center gap-3">
        <Icon
          className={cn(
            'h-4 w-4 shrink-0',
            destructive ? 'text-confidence-low' : 'text-muted-foreground'
          )}
        />
        <div>
          <p
            className={cn(
              'font-mono text-[11px] uppercase tracking-wider',
              destructive ? 'text-confidence-low' : 'text-foreground'
            )}
          >
            {label}
          </p>
          <p className="mt-0.5 font-sans text-[12px] text-muted-foreground/70">{description}</p>
        </div>
      </div>
      {external ? (
        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-foreground" />
      ) : (
        <ChevronRight
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground/50 transition-all group-hover:text-foreground',
            active && 'rotate-90 text-foreground'
          )}
        />
      )}
    </>
  )

  const className =
    'group flex w-full items-center justify-between gap-4 bg-background px-4 py-3.5 text-left transition-colors hover:bg-secondary/40'

  if (href) {
    const isMailto = href.startsWith('mailto:')
    return (
      <a
        href={href}
        target={isMailto ? undefined : '_blank'}
        rel={isMailto ? undefined : 'noopener noreferrer'}
        className={className}
      >
        {content}
      </a>
    )
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  )
}
