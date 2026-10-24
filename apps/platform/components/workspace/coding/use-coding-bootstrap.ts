'use client'

import { useCallback, useEffect, useRef } from 'react'
import { createClient } from '@zequel/shared/supabase/client'
import { useWorkspaceStore } from '@/lib/store'
import { getLanguageMeta } from '@/lib/coding/languages'
import type {
  CodingFile,
  CodingFolder,
  CodingProject,
  CodingMessage,
} from '@zequel/types'

/**
 * Loads the contents (folders, files, chat history) of a single project into
 * the store and marks it active. Reused both on first boot and when the user
 * switches projects from the project picker.
 */
export function useLoadCodingProject() {
  const {
    setCodingProject,
    setCodingFolders,
    setCodingFiles,
    setActiveCodingFileId,
    setCodingMessages,
  } = useWorkspaceStore()

  return useCallback(
    async (project: CodingProject) => {
      const supabase = createClient()
      setCodingProject(project)

      const [{ data: folders }, { data: files }, { data: messages }] =
        await Promise.all([
          supabase
            .from('coding_folders')
            .select('*')
            .eq('project_id', project.id)
            .order('created_at', { ascending: true }),
          supabase
            .from('coding_files')
            .select('*')
            .eq('project_id', project.id)
            .order('created_at', { ascending: true }),
          supabase
            .from('coding_messages')
            .select('*')
            .eq('project_id', project.id)
            .order('created_at', { ascending: true }),
        ])

      setCodingFolders((folders as CodingFolder[]) ?? [])
      const fileList = (files as CodingFile[]) ?? []
      setCodingFiles(fileList)
      // Prefer a root-level file as the initial selection.
      const firstRoot = fileList.find((f) => !f.folder_id) ?? fileList[0]
      setActiveCodingFileId(firstRoot ? firstRoot.id : null)
      setCodingMessages((messages as CodingMessage[]) ?? [])
    },
    [
      setCodingProject,
      setCodingFolders,
      setCodingFiles,
      setActiveCodingFileId,
      setCodingMessages,
    ]
  )
}

/**
 * Loads (or lazily creates) the user's coding projects the first time Coding
 * Mode is opened, then hydrates the most recent project's contents into the
 * store. Subsequent mode switches reuse what's already loaded.
 */
export function useCodingBootstrap(active: boolean) {
  const { codingProject, setCodingProjects, addCodingFile } =
    useWorkspaceStore()
  const loadProject = useLoadCodingProject()

  const loadingRef = useRef(false)

  useEffect(() => {
    if (!active || codingProject || loadingRef.current) return
    loadingRef.current = true

    const load = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        loadingRef.current = false
        return
      }

      // Load all projects (a project behaves like a repo).
      const { data: projectRows } = await supabase
        .from('coding_projects')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })

      let projects = (projectRows as CodingProject[]) ?? []

      // Bootstrap a starter project + file for brand-new users.
      if (projects.length === 0) {
        const { data: created } = await supabase
          .from('coding_projects')
          .insert({ user_id: user.id, name: 'My First Project' })
          .select()
          .single()
        const project = created as CodingProject | undefined
        if (!project) {
          loadingRef.current = false
          return
        }
        projects = [project]

        const meta = getLanguageMeta('javascript')
        const { data: file } = await supabase
          .from('coding_files')
          .insert({
            project_id: project.id,
            user_id: user.id,
            folder_id: null,
            name: `main.${meta.extension}`,
            language: meta.id,
            content: meta.starter,
          })
          .select()
          .single()
        if (file) addCodingFile(file as CodingFile)
      }

      setCodingProjects(projects)
      await loadProject(projects[0])
      loadingRef.current = false
    }

    void load()
  }, [active, codingProject, setCodingProjects, addCodingFile, loadProject])
}
