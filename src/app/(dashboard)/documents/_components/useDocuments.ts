'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useRouter } from 'next/navigation';
import type { DocumentFolder, DocFolderShare, WorkspaceDocument } from '@/types/database';
import type { Member, DocForm, FolderModalState, ShareModalState } from './types';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from './types';

export function useDocuments() {
  const { user } = useAuth();
  const { currentWorkspace, currentMembership, hasModule, loading: wsLoading } = useWorkspace();
  const { isWorkspaceAdmin, isMasterAdmin } = usePermissions();
  const router = useRouter();

  const wsId = currentWorkspace?.id ?? '';
  const userId = user?.id ?? '';

  const canManage = useMemo(
    () => isMasterAdmin || isWorkspaceAdmin || (currentMembership?.can_manage_documents ?? false),
    [isMasterAdmin, isWorkspaceAdmin, currentMembership]
  );

  // ── State ──────────────────────────────────────────────────────────────────

  const [folders, setFolders] = useState<DocumentFolder[]>([]);
  const [folderShares, setFolderShares] = useState<DocFolderShare[]>([]);
  const [docs, setDocs] = useState<WorkspaceDocument[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [showFolderPanel, setShowFolderPanel] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [searchQ, setSearchQ] = useState('');

  // Folder modal
  const [folderModal, setFolderModal] = useState<FolderModalState>({
    open: false, parentId: null, editing: null, name: '', color: '#6366f1',
  });
  const [savingFolder, setSavingFolder] = useState(false);

  // Share modal
  const [shareModal, setShareModal] = useState<ShareModalState>({ open: false, folder: null });
  const [shareType, setShareType] = useState<'none' | 'workspace' | 'users'>('none');
  const [shareUserIds, setShareUserIds] = useState<string[]>([]);

  // Document modal
  const [docForm, setDocForm] = useState<DocForm>({
    open: false, mode: 'file', name: '', url: '', description: '', folder_id: null,
  });
  const [editingDoc, setEditingDoc] = useState<WorkspaceDocument | null>(null);
  const [savingDoc, setSavingDoc] = useState(false);
  const [deletingDoc, setDeletingDoc] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // ── Redirect ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!wsLoading && !hasModule('documents')) router.replace('/');
  }, [wsLoading, hasModule, router]);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    if (!wsId) return;
    setLoading(true);
    const [fRes, fsRes, dRes, mRes] = await Promise.all([
      supabase.from('trackino_document_folders').select('*').eq('workspace_id', wsId).order('sort_order').order('name'),
      supabase.from('trackino_document_folder_shares').select('*').eq('workspace_id', wsId),
      supabase.from('trackino_documents').select('*').eq('workspace_id', wsId).order('created_at', { ascending: false }),
      supabase.from('trackino_workspace_members').select('user_id').eq('workspace_id', wsId),
    ]);

    setFolders((fRes.data ?? []) as DocumentFolder[]);
    setFolderShares((fsRes.data ?? []) as DocFolderShare[]);
    setDocs((dRes.data ?? []) as WorkspaceDocument[]);

    const memberUserIds: string[] = (mRes.data ?? []).map((m: { user_id: string }) => m.user_id);
    if (memberUserIds.length > 0) {
      const { data: profData } = await supabase
        .from('trackino_profiles')
        .select('id, display_name, email, avatar_color')
        .in('id', memberUserIds);
      setMembers((profData ?? []).map((p: { id: string; display_name: string | null; email: string | null; avatar_color: string | null }) => ({
        user_id: p.id,
        display_name: p.display_name ?? p.id,
        email: p.email ?? '',
        avatar_color: p.avatar_color ?? 'var(--primary)',
      })));
    }
    setLoading(false);
  }, [wsId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Folder CRUD ────────────────────────────────────────────────────────────

  const openFolderModal = (parentId: string | null = null, editing: DocumentFolder | null = null) => {
    setFolderModal({ open: true, parentId, editing, name: editing?.name ?? '', color: editing?.color ?? '#6366f1' });
  };

  const saveFolder = async () => {
    if (!folderModal.name.trim() || !wsId) return;
    setSavingFolder(true);
    if (folderModal.editing) {
      await supabase.from('trackino_document_folders')
        .update({ name: folderModal.name.trim(), color: folderModal.color, updated_at: new Date().toISOString() })
        .eq('id', folderModal.editing.id);
    } else {
      await supabase.from('trackino_document_folders').insert({
        workspace_id: wsId,
        parent_id: folderModal.parentId,
        name: folderModal.name.trim(),
        color: folderModal.color,
        sort_order: folders.length,
        owner_id: userId,
        is_shared: false,
        created_by: userId,
      });
    }
    setSavingFolder(false);
    setFolderModal({ open: false, parentId: null, editing: null, name: '', color: '#6366f1' });
    fetchAll();
  };

  const deleteFolder = async (folder: DocumentFolder) => {
    if (!confirm(`Smazat složku „${folder.name}"? Dokumenty v ní zůstanou, ale nebudou přiřazeny žádné složce.`)) return;
    await supabase.from('trackino_documents').update({ folder_id: null }).eq('folder_id', folder.id);
    await supabase.from('trackino_document_folders').delete().eq('id', folder.id);
    if (selectedFolder === folder.id) setSelectedFolder(null);
    fetchAll();
  };

  // ── Share CRUD ─────────────────────────────────────────────────────────────

  const openShare = (folder: DocumentFolder) => {
    const existing = folderShares.filter(s => s.folder_id === folder.id);
    const hasWorkspace = existing.some(s => s.user_id === null);
    const hasUsers = existing.some(s => s.user_id !== null);
    setShareType(hasWorkspace ? 'workspace' : hasUsers ? 'users' : 'none');
    setShareUserIds(existing.filter(s => s.user_id !== null).map(s => s.user_id as string));
    setShareModal({ open: true, folder });
  };

  const saveShare = async () => {
    const folder = shareModal.folder!;
    await supabase.from('trackino_document_folder_shares').delete().eq('folder_id', folder.id);
    if (shareType === 'workspace') {
      await supabase.from('trackino_document_folder_shares').insert({ folder_id: folder.id, workspace_id: wsId, user_id: null, shared_by: userId });
      await supabase.from('trackino_document_folders').update({ is_shared: true }).eq('id', folder.id);
    } else if (shareUserIds.length > 0) {
      await supabase.from('trackino_document_folder_shares').insert(shareUserIds.map(uid => ({ folder_id: folder.id, workspace_id: wsId, user_id: uid, shared_by: userId })));
      await supabase.from('trackino_document_folders').update({ is_shared: true }).eq('id', folder.id);
    } else {
      await supabase.from('trackino_document_folders').update({ is_shared: false }).eq('id', folder.id);
    }
    setShareModal({ open: false, folder: null });
    fetchAll();
  };

  // ── Document CRUD ──────────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setUploadError('');
    if (!file) { setSelectedFile(null); return; }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setUploadError(`Soubor je příliš velký (max ${MAX_FILE_SIZE_MB} MB).`);
      setSelectedFile(null);
      return;
    }
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setUploadError('Nepodporovaný typ souboru.');
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
    if (!docForm.name) setDocForm(f => ({ ...f, name: file.name.replace(/\.[^.]+$/, '') }));
  };

  const openEditDoc = (doc: WorkspaceDocument) => {
    setEditingDoc(doc);
    setDocForm({ open: true, mode: doc.type as 'file' | 'link', name: doc.name, url: doc.url ?? '', description: doc.description ?? '', folder_id: doc.folder_id });
    setSelectedFile(null);
    setUploadError('');
  };

  const saveDocument = async () => {
    if (!wsId || !user) return;
    setSavingDoc(true);
    setUploadError('');
    try {
      if (editingDoc) {
        const updates: Record<string, unknown> = {
          name: docForm.name.trim() || editingDoc.name,
          description: docForm.description.trim(),
          folder_id: docForm.folder_id,
          updated_at: new Date().toISOString(),
        };
        if (editingDoc.type === 'link') {
          if (!docForm.url.trim()) { setUploadError('Zadejte URL adresu.'); setSavingDoc(false); return; }
          updates.url = docForm.url.trim();
          updates.name = docForm.name.trim() || docForm.url.trim();
        }
        await supabase.from('trackino_documents').update(updates).eq('id', editingDoc.id);
        setEditingDoc(null);
      } else if (docForm.mode === 'file') {
        if (!selectedFile) { setUploadError('Vyberte soubor.'); setSavingDoc(false); return; }
        const ext = selectedFile.name.split('.').pop() ?? '';
        const filePath = `${wsId}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('trackino-documents')
          .upload(filePath, selectedFile, { contentType: selectedFile.type });
        if (uploadErr) { setUploadError('Nahrání souboru selhalo: ' + uploadErr.message); setSavingDoc(false); return; }
        await supabase.from('trackino_documents').insert({
          workspace_id: wsId, folder_id: docForm.folder_id,
          name: docForm.name.trim() || selectedFile.name, type: 'file',
          file_path: filePath, file_size: selectedFile.size, file_mime: selectedFile.type,
          url: null, description: docForm.description.trim(), created_by: userId,
        });
      } else {
        if (!docForm.url.trim()) { setUploadError('Zadejte URL adresu.'); setSavingDoc(false); return; }
        await supabase.from('trackino_documents').insert({
          workspace_id: wsId, folder_id: docForm.folder_id,
          name: docForm.name.trim() || docForm.url, type: 'link',
          file_path: null, file_size: null, file_mime: null,
          url: docForm.url.trim(), description: docForm.description.trim(), created_by: userId,
        });
      }
      setDocForm({ open: false, mode: 'file', name: '', url: '', description: '', folder_id: null });
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchAll();
    } catch {
      setUploadError('Chyba při ukládání dokumentu.');
    } finally {
      setSavingDoc(false);
    }
  };

  const deleteDocument = async (doc: WorkspaceDocument) => {
    if (!confirm(`Smazat dokument „${doc.name}"?`)) return;
    setDeletingDoc(doc.id);
    if (doc.type === 'file' && doc.file_path) {
      await supabase.storage.from('trackino-documents').remove([doc.file_path]);
    }
    await supabase.from('trackino_documents').delete().eq('id', doc.id);
    setDocs(prev => prev.filter(d => d.id !== doc.id));
    setDeletingDoc(null);
  };

  const getFileUrl = async (doc: WorkspaceDocument) => {
    if (doc.type === 'link') { window.open(doc.url!, '_blank'); return; }
    if (!doc.file_path) return;
    const { data } = await supabase.storage.from('trackino-documents').createSignedUrl(doc.file_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  // ── Helpers ────────────────────────────────────────────────────────────────

  const toggle = (id: string) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const visibleDocs = useMemo(() => {
    const qLow = searchQ.trim().toLowerCase();
    const base = selectedFolder === null ? docs
      : selectedFolder === '__none__' ? docs.filter(d => !d.folder_id)
      : docs.filter(d => d.folder_id === selectedFolder);
    if (!qLow) return base;
    return base.filter(d => d.name.toLowerCase().includes(qLow) || d.description.toLowerCase().includes(qLow));
  }, [docs, selectedFolder, searchQ]);

  return {
    // Data
    folders, folderShares, docs, members, loading,
    // Selection
    selectedFolder, setSelectedFolder,
    showFolderPanel, setShowFolderPanel,
    expanded, toggle,
    searchQ, setSearchQ,
    visibleDocs,
    // Folder modal
    folderModal, setFolderModal,
    savingFolder,
    openFolderModal, saveFolder, deleteFolder,
    // Share modal
    shareModal, setShareModal,
    shareType, setShareType,
    shareUserIds, setShareUserIds,
    openShare, saveShare,
    // Doc modal
    docForm, setDocForm,
    editingDoc, setEditingDoc,
    savingDoc,
    deletingDoc,
    uploadError, setUploadError,
    fileInputRef,
    selectedFile, setSelectedFile,
    handleFileChange, openEditDoc, saveDocument, deleteDocument, getFileUrl,
    // Permissions
    canManage, userId,
  };
}
