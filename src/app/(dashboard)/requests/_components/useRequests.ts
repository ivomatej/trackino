'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useRouter } from 'next/navigation';
import type { RequestType, Profile } from '@/types/database';
import type { RequestWithProfile, ActiveTab } from './types';

export interface UseRequestsReturn {
  myRequests: RequestWithProfile[];
  pendingRequests: RequestWithProfile[];
  archivedRequests: RequestWithProfile[];
  loading: boolean;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  showForm: boolean;
  setShowForm: (v: boolean) => void;
  saving: boolean;
  formType: RequestType;
  setFormType: (t: RequestType) => void;
  formTitle: string;
  setFormTitle: (v: string) => void;
  formNote: string;
  setFormNote: (v: string) => void;
  rejectModal: { id: string; note: string } | null;
  setRejectModal: (v: { id: string; note: string } | null) => void;
  rejecting: boolean;
  approving: string | null;
  showGuide: boolean;
  setShowGuide: (fn: (prev: boolean) => boolean) => void;
  canProcessRequests: boolean;
  submitRequest: () => Promise<void>;
  approveRequest: (req: RequestWithProfile) => Promise<void>;
  rejectRequest: () => Promise<void>;
  deleteRequest: (id: string) => Promise<void>;
}

export function useRequests(): UseRequestsReturn {
  const { user } = useAuth();
  const { currentWorkspace, currentMembership, hasModule, loading: wsLoading } = useWorkspace();
  const { isWorkspaceAdmin, isManager, isMasterAdmin } = usePermissions();
  const router = useRouter();

  const [myRequests, setMyRequests] = useState<RequestWithProfile[]>([]);
  const [pendingRequests, setPendingRequests] = useState<RequestWithProfile[]>([]);
  const [archivedRequests, setArchivedRequests] = useState<RequestWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('mine');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form
  const [formType, setFormType] = useState<RequestType>('hardware');
  const [formTitle, setFormTitle] = useState('');
  const [formNote, setFormNote] = useState('');

  // Reject modal
  const [rejectModal, setRejectModal] = useState<{ id: string; note: string } | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);

  // Průvodce kategoriemi – rozbalení
  const [showGuide, setShowGuide] = useState(false);

  // Oprávnění – kdo může zpracovávat žádosti
  const canProcessRequests = useMemo(
    () => isWorkspaceAdmin || isManager || isMasterAdmin || (currentMembership?.can_process_requests ?? false),
    [isWorkspaceAdmin, isManager, isMasterAdmin, currentMembership]
  );

  // Redirect pokud modul není dostupný
  useEffect(() => {
    if (!wsLoading && !hasModule('requests')) router.replace('/');
  }, [wsLoading, hasModule, router]);

  // ── Fetch dat ──────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!user || !currentWorkspace) return;
    setLoading(true);

    // Moje žádosti
    const { data: myData } = await supabase
      .from('trackino_requests')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    const myReqs = (myData ?? []) as RequestWithProfile[];

    // Profily reviewerů
    const reviewerIds = [...new Set(myReqs.filter(r => r.reviewed_by).map(r => r.reviewed_by!))];
    if (reviewerIds.length > 0) {
      const { data: profData } = await supabase
        .from('trackino_profiles')
        .select('id, display_name, avatar_color')
        .in('id', reviewerIds);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const profMap = Object.fromEntries((profData ?? []).map((p: any) => [p.id, p as Profile]));
      myReqs.forEach(r => { if (r.reviewed_by) r.reviewerProfile = profMap[r.reviewed_by]; });
    }
    setMyRequests(myReqs);

    // Čekající žádosti ostatních (pro reviewery) + archiv
    if (canProcessRequests) {
      const { data: pendData } = await supabase
        .from('trackino_requests')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('status', 'pending')
        .neq('user_id', user.id)
        .order('created_at', { ascending: false });

      const pendReqs = (pendData ?? []) as RequestWithProfile[];

      if (pendReqs.length > 0) {
        const userIds = [...new Set(pendReqs.map(r => r.user_id))];
        const { data: profData } = await supabase
          .from('trackino_profiles')
          .select('id, display_name, avatar_color')
          .in('id', userIds);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const profMap = Object.fromEntries((profData ?? []).map((p: any) => [p.id, p as Profile]));
        pendReqs.forEach(r => { r.profile = profMap[r.user_id]; });
      }
      setPendingRequests(pendReqs);

      // Archiv – všechny schválené/zamítnuté v celém workspace
      const { data: archData } = await supabase
        .from('trackino_requests')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .in('status', ['approved', 'rejected'])
        .order('reviewed_at', { ascending: false });

      const archReqs = (archData ?? []) as RequestWithProfile[];

      if (archReqs.length > 0) {
        const allIds = [...new Set([
          ...archReqs.map(r => r.user_id),
          ...archReqs.filter(r => r.reviewed_by).map(r => r.reviewed_by!),
        ])];
        const { data: archProfData } = await supabase
          .from('trackino_profiles')
          .select('id, display_name, avatar_color')
          .in('id', allIds);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const archProfMap = Object.fromEntries((archProfData ?? []).map((p: any) => [p.id, p as Profile]));
        archReqs.forEach(r => {
          r.profile = archProfMap[r.user_id];
          if (r.reviewed_by) r.reviewerProfile = archProfMap[r.reviewed_by];
        });
      }
      setArchivedRequests(archReqs);
    }

    setLoading(false);
  }, [user, currentWorkspace, canProcessRequests]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Akce ──────────────────────────────────────────────────────────────────

  const submitRequest = async () => {
    if (!user || !currentWorkspace) return;
    if (!formTitle.trim()) return;

    setSaving(true);
    await supabase.from('trackino_requests').insert({
      workspace_id: currentWorkspace.id,
      user_id: user.id,
      type: formType,
      title: formTitle.trim(),
      note: formNote.trim(),
      status: 'pending',
    });
    setSaving(false);
    setShowForm(false);
    setFormTitle('');
    setFormNote('');
    setFormType('hardware');
    fetchData();
  };

  const approveRequest = async (req: RequestWithProfile) => {
    if (!user || !currentWorkspace) return;
    setApproving(req.id);
    await supabase.from('trackino_requests').update({
      status: 'approved',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      reviewer_note: '',
    }).eq('id', req.id);
    setApproving(null);
    fetchData();
  };

  const rejectRequest = async () => {
    if (!rejectModal || !user) return;
    setRejecting(true);
    await supabase.from('trackino_requests').update({
      status: 'rejected',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      reviewer_note: rejectModal.note,
    }).eq('id', rejectModal.id);
    setRejecting(false);
    setRejectModal(null);
    fetchData();
  };

  const deleteRequest = async (id: string) => {
    if (!confirm('Opravdu smazat tuto žádost?')) return;
    await supabase.from('trackino_requests').delete().eq('id', id);
    fetchData();
  };

  return {
    myRequests,
    pendingRequests,
    archivedRequests,
    loading,
    activeTab,
    setActiveTab,
    showForm,
    setShowForm,
    saving,
    formType,
    setFormType,
    formTitle,
    setFormTitle,
    formNote,
    setFormNote,
    rejectModal,
    setRejectModal,
    rejecting,
    approving,
    showGuide,
    setShowGuide,
    canProcessRequests,
    submitRequest,
    approveRequest,
    rejectRequest,
    deleteRequest,
  };
}
