-- ============================================================================
-- Zequel Coding Mode — Database Schema
-- ============================================================================
-- This script is SEPARATE from init.sql and contains everything required for
-- Coding Mode: projects (repos), nestable folders, files, and assistant chat
-- history. Every table is scoped per-user via Row Level Security
-- (auth.uid() = user_id).
--
-- Safe to run multiple times (idempotent): uses IF NOT EXISTS / DROP POLICY IF
-- EXISTS guards throughout.
-- ============================================================================

create extension if not exists "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. Projects (each project behaves like a repository)
-- ----------------------------------------------------------------------------
create table if not exists public.coding_projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Untitled Project',
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists coding_projects_user_id_idx on public.coding_projects(user_id);

alter table public.coding_projects enable row level security;

drop policy if exists "coding_projects_select_own" on public.coding_projects;
create policy "coding_projects_select_own" on public.coding_projects
  for select using (auth.uid() = user_id);
drop policy if exists "coding_projects_insert_own" on public.coding_projects;
create policy "coding_projects_insert_own" on public.coding_projects
  for insert with check (auth.uid() = user_id);
drop policy if exists "coding_projects_update_own" on public.coding_projects;
create policy "coding_projects_update_own" on public.coding_projects
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "coding_projects_delete_own" on public.coding_projects;
create policy "coding_projects_delete_own" on public.coding_projects
  for delete using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 2. Folders (nestable within a project via self-referencing parent_id)
-- ----------------------------------------------------------------------------
create table if not exists public.coding_folders (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.coding_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.coding_folders(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists coding_folders_project_id_idx on public.coding_folders(project_id);
create index if not exists coding_folders_parent_id_idx on public.coding_folders(parent_id);
create index if not exists coding_folders_user_id_idx on public.coding_folders(user_id);

alter table public.coding_folders enable row level security;

drop policy if exists "coding_folders_select_own" on public.coding_folders;
create policy "coding_folders_select_own" on public.coding_folders
  for select using (auth.uid() = user_id);
drop policy if exists "coding_folders_insert_own" on public.coding_folders;
create policy "coding_folders_insert_own" on public.coding_folders
  for insert with check (auth.uid() = user_id);
drop policy if exists "coding_folders_update_own" on public.coding_folders;
create policy "coding_folders_update_own" on public.coding_folders
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "coding_folders_delete_own" on public.coding_folders;
create policy "coding_folders_delete_own" on public.coding_folders
  for delete using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 3. Files (live in a folder, or at project root when folder_id is null)
-- ----------------------------------------------------------------------------
create table if not exists public.coding_files (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.coding_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  language text not null default 'javascript',
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- folder_id added separately so the column exists on pre-hierarchy databases too.
alter table public.coding_files
  add column if not exists folder_id uuid references public.coding_folders(id) on delete cascade;

-- Upload support: a file is either editable text ('text') or an uploaded binary
-- asset ('upload', e.g. an image) stored in the 'coding-files' storage bucket.
alter table public.coding_files
  add column if not exists kind text not null default 'text',
  add column if not exists storage_path text,
  add column if not exists mime_type text;

create index if not exists coding_files_project_id_idx on public.coding_files(project_id);
create index if not exists coding_files_user_id_idx on public.coding_files(user_id);
create index if not exists coding_files_folder_id_idx on public.coding_files(folder_id);

alter table public.coding_files enable row level security;

drop policy if exists "coding_files_select_own" on public.coding_files;
create policy "coding_files_select_own" on public.coding_files
  for select using (auth.uid() = user_id);
drop policy if exists "coding_files_insert_own" on public.coding_files;
create policy "coding_files_insert_own" on public.coding_files
  for insert with check (auth.uid() = user_id);
drop policy if exists "coding_files_update_own" on public.coding_files;
create policy "coding_files_update_own" on public.coding_files
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "coding_files_delete_own" on public.coding_files;
create policy "coding_files_delete_own" on public.coding_files
  for delete using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 4. Assistant chat history (AI Coding Assistant messages per project)
-- ----------------------------------------------------------------------------
create table if not exists public.coding_messages (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.coding_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists coding_messages_project_id_idx on public.coding_messages(project_id);
create index if not exists coding_messages_user_id_idx on public.coding_messages(user_id);

alter table public.coding_messages enable row level security;

drop policy if exists "coding_messages_select_own" on public.coding_messages;
create policy "coding_messages_select_own" on public.coding_messages
  for select using (auth.uid() = user_id);
drop policy if exists "coding_messages_insert_own" on public.coding_messages;
create policy "coding_messages_insert_own" on public.coding_messages
  for insert with check (auth.uid() = user_id);
drop policy if exists "coding_messages_delete_own" on public.coding_messages;
create policy "coding_messages_delete_own" on public.coding_messages
  for delete using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 5. Storage bucket for uploaded coding assets (images, pdfs, etc.)
--    Objects are namespaced by user id: "<auth.uid()>/<project_id>/<file>".
--    RLS ensures each user can only touch objects under their own prefix.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('coding-files', 'coding-files', false)
on conflict (id) do nothing;

drop policy if exists "coding_files_storage_select_own" on storage.objects;
create policy "coding_files_storage_select_own" on storage.objects
  for select using (
    bucket_id = 'coding-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "coding_files_storage_insert_own" on storage.objects;
create policy "coding_files_storage_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'coding-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "coding_files_storage_update_own" on storage.objects;
create policy "coding_files_storage_update_own" on storage.objects
  for update using (
    bucket_id = 'coding-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "coding_files_storage_delete_own" on storage.objects;
create policy "coding_files_storage_delete_own" on storage.objects
  for delete using (
    bucket_id = 'coding-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
