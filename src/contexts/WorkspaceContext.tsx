'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import type { Workspace, WorkspaceMember, UserRole } from '@/types/database';

interface WorkspaceContextType {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  currentMembership: WorkspaceMember | null;
  loading: boolean;
  selectWorkspace: (workspace: Workspace) => void;
  createWorkspace: (name: string) => Promise<{ error: string | null }>;
  userRole: UserRole | null;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

const WORKSPACE_STORAGE_KEY = 'trackino_workspace_id';

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [currentMembership, setCurrentMembership] = useState<WorkspaceMember | null>(null);
  const [loading, setLoading] = useState(true);

  // Načtení workspaces uživatele
  async function fetchWorkspaces() {
    if (!user) {
      setWorkspaces([]);
      setCurrentWorkspace(null);
      setCurrentMembership(null);
      setLoading(false);
      return;
    }

    try {
      const { data: members } = await supabase
        .from('trackino_workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id);

      if (!members || members.length === 0) {
        setWorkspaces([]);
        setCurrentWorkspace(null);
        setLoading(false);
        return;
      }

      const workspaceIds = members.map(m => m.workspace_id);
      const { data: workspaceData } = await supabase
        .from('trackino_workspaces')
        .select('*')
        .in('id', workspaceIds)
        .order('name');

      const ws = (workspaceData ?? []) as Workspace[];
      setWorkspaces(ws);

      // Obnovit poslední vybraný workspace
      const savedId = localStorage.getItem(WORKSPACE_STORAGE_KEY);
      const saved = ws.find(w => w.id === savedId);

      if (saved) {
        await selectWorkspaceInternal(saved);
      } else if (ws.length === 1) {
        await selectWorkspaceInternal(ws[0]);
      }
    } catch (err) {
      console.warn('Chyba při načítání workspaces:', err);
    }

    setLoading(false);
  }

  async function selectWorkspaceInternal(workspace: Workspace) {
    setCurrentWorkspace(workspace);
    localStorage.setItem(WORKSPACE_STORAGE_KEY, workspace.id);

    if (user) {
      try {
        const { data } = await supabase
          .from('trackino_workspace_members')
          .select('*')
          .eq('workspace_id', workspace.id)
          .eq('user_id', user.id)
          .single();

        setCurrentMembership(data as WorkspaceMember | null);
      } catch (err) {
        console.warn('Chyba při načítání členství:', err);
      }
    }
  }

  const selectWorkspace = (workspace: Workspace) => {
    selectWorkspaceInternal(workspace);
  };

  const createWorkspace = async (name: string) => {
    if (!user) return { error: 'Nepřihlášený uživatel' };

    try {
      const slug = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      // Vytvořit workspace
      const { data: ws, error: wsError } = await supabase
        .from('trackino_workspaces')
        .insert({ name, slug, created_by: user.id })
        .select()
        .single();

      if (wsError) return { error: wsError.message };

      // Přidat tvůrce jako owner
      const { error: memberError } = await supabase
        .from('trackino_workspace_members')
        .insert({
          workspace_id: ws.id,
          user_id: user.id,
          role: 'owner' as UserRole,
        });

      if (memberError) return { error: memberError.message };

      // Načtení dat a výběr workspace
      await fetchWorkspaces();
      await selectWorkspaceInternal(ws as Workspace);

      return { error: null };
    } catch (err) {
      console.error('Chyba při vytváření workspace:', err);
      return { error: 'Nepodařilo se vytvořit pracovní prostor. Zkuste to znovu.' };
    }
  };

  useEffect(() => {
    fetchWorkspaces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        currentWorkspace,
        currentMembership,
        loading,
        selectWorkspace,
        createWorkspace,
        userRole: currentMembership?.role ?? null,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
