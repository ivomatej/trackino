'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import type { Workspace, WorkspaceMember, UserRole, ManagerAssignment } from '@/types/database';

interface WorkspaceContextType {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  currentMembership: WorkspaceMember | null;
  loading: boolean;
  selectWorkspace: (workspace: Workspace) => void;
  createWorkspace: (name: string) => Promise<{ error: string | null }>;
  userRole: UserRole | null;
  /** Čeká uživatel na schválení adminem? */
  isPendingApproval: boolean;
  /** Manager assignments pro aktuální workspace (kde je current user managerem) */
  managerAssignments: ManagerAssignment[];
  /** Kontroluje, zda je aktuální uživatel managerem daného uživatele */
  isManagerOf: (userId: string) => boolean;
  /** Znovu načíst workspace data (po uložení nastavení apod.) */
  refreshWorkspace: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

const WORKSPACE_STORAGE_KEY = 'trackino_workspace_id';

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [currentMembership, setCurrentMembership] = useState<WorkspaceMember | null>(null);
  const [managerAssignments, setManagerAssignments] = useState<ManagerAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  // Načtení manager assignments pro aktuální workspace
  const fetchManagerAssignments = useCallback(async (workspaceId: string) => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('trackino_manager_assignments')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('manager_user_id', user.id);

      setManagerAssignments((data ?? []) as ManagerAssignment[]);
    } catch {
      setManagerAssignments([]);
    }
  }, [user]);

  // Připojení k workspace pomocí join kódu (z localStorage po registraci)
  async function tryJoinWorkspaceByCode(userId: string): Promise<boolean> {
    const pendingCode = localStorage.getItem('trackino_pending_join_code');
    if (!pendingCode) return false;

    // Vždy odstranit kód z localStorage (i při chybě)
    localStorage.removeItem('trackino_pending_join_code');

    try {
      const { data: ws } = await supabase
        .from('trackino_workspaces')
        .select('id, name')
        .eq('join_code', pendingCode.trim().toUpperCase())
        .single();

      if (!ws) {
        console.warn('Workspace s kódem nenalezen:', pendingCode);
        return false;
      }

      // Zkontrolovat, zda uživatel již není členem
      const { data: existing } = await supabase
        .from('trackino_workspace_members')
        .select('id')
        .eq('workspace_id', ws.id)
        .eq('user_id', userId)
        .single();

      if (!existing) {
        // Nový člen čeká na schválení adminem (approved = false)
        const { error: insertError } = await supabase.from('trackino_workspace_members').insert({
          workspace_id: ws.id,
          user_id: userId,
          role: 'member',
          approved: false,
        });

        if (insertError) {
          // Fallback: pokud sloupec approved ještě neexistuje v DB, přidat bez něj
          console.warn('Insert s approved selhal, zkouším bez něj:', insertError.message);
          const { error: fallbackError } = await supabase.from('trackino_workspace_members').insert({
            workspace_id: ws.id,
            user_id: userId,
            role: 'member',
          });
          if (fallbackError) {
            console.warn('Fallback insert také selhal:', fallbackError.message);
            return false;
          }
        }
      }

      return true;
    } catch (err) {
      console.warn('Chyba při připojení k workspace:', err);
      return false;
    }
  }

  // Načtení workspaces uživatele
  const fetchWorkspaces = useCallback(async () => {
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
        // Zkusit připojit k workspace pomocí čekajícího join kódu
        const joined = await tryJoinWorkspaceByCode(user.id);

        if (joined) {
          // Znovu načíst workspaces po úspěšném připojení
          const { data: newMembers } = await supabase
            .from('trackino_workspace_members')
            .select('workspace_id')
            .eq('user_id', user.id);

          if (newMembers && newMembers.length > 0) {
            const newIds = newMembers.map(m => m.workspace_id);
            const { data: wsData } = await supabase
              .from('trackino_workspaces')
              .select('*')
              .in('id', newIds)
              .order('name');

            const ws = (wsData ?? []) as Workspace[];
            setWorkspaces(ws);

            const savedId = localStorage.getItem(WORKSPACE_STORAGE_KEY);
            const saved = ws.find(w => w.id === savedId);
            if (saved) {
              await selectWorkspaceInternal(saved);
            } else if (ws.length === 1) {
              await selectWorkspaceInternal(ws[0]);
            }
            setLoading(false);
            return;
          }
        }

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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

      // Načíst manager assignments
      await fetchManagerAssignments(workspace.id);
    }
  }

  const selectWorkspace = (workspace: Workspace) => {
    selectWorkspaceInternal(workspace);
  };

  const refreshWorkspace = async () => {
    if (!currentWorkspace) return;
    try {
      const { data } = await supabase
        .from('trackino_workspaces')
        .select('*')
        .eq('id', currentWorkspace.id)
        .single();

      if (data) {
        setCurrentWorkspace(data as Workspace);
        // Aktualizovat i v seznamu
        setWorkspaces(prev => prev.map(w => w.id === data.id ? data as Workspace : w));
      }
    } catch {
      // ignorovat
    }
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

      // Vytvořit prázdný billing záznam
      await supabase
        .from('trackino_workspace_billing')
        .insert({ workspace_id: ws.id });

      // Načtení dat a výběr workspace
      await fetchWorkspaces();
      await selectWorkspaceInternal(ws as Workspace);

      return { error: null };
    } catch (err) {
      console.error('Chyba při vytváření workspace:', err);
      return { error: 'Nepodařilo se vytvořit pracovní prostor. Zkuste to znovu.' };
    }
  };

  const isManagerOf = useCallback((userId: string): boolean => {
    return managerAssignments.some(a => a.member_user_id === userId);
  }, [managerAssignments]);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

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
        isPendingApproval: currentMembership?.approved === false,
        managerAssignments,
        isManagerOf,
        refreshWorkspace,
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
