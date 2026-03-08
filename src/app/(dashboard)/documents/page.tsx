'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace, WorkspaceProvider } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import DashboardLayout from '@/components/DashboardLayout';
import { useRouter } from 'next/navigation';
import type { DocumentFolder, DocFolderShare, WorkspaceDocument } from '@/types/database';

// ─── Local types ──────────────────────────────────────────────────────────────

interface Member { user_id: string; display_name: string; email: string; avatar_color: string; }

const MAX_DEPTH = 5;

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/zip',
];

const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function getFileIcon(mime: string | null): React.ReactElement {
  const color = mime?.startsWith('image/') ? '#10b981'
    : mime === 'application/pdf' ? '#ef4444'
    : mime?.includes('word') ? '#3b82f6'
    : mime?.includes('excel') || mime?.includes('sheet') || mime?.includes('csv') ? '#16a34a'
    : mime?.includes('powerpoint') || mime?.includes('presentation') ? '#f97316'
    : '#6b7280';
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

// ─── FolderTree ───────────────────────────────────────────────────────────────

function FolderTree({
  folders, selectedId, expanded, onSelect, onToggle, onAddSub, onEdit, onDelete, onShare,
  userId, canManage, items, depth = 0, parentId = null,
}: {
  folders: DocumentFolder[]; selectedId: string | null; expanded: Set<string>;
  onSelect: (id: string | null) => void; onToggle: (id: string) => void;
  onAddSub: (parentId: string, depth: number) => void;
  onEdit: (f: DocumentFolder) => void; onDelete: (f: DocumentFolder) => void;
  onShare: (f: DocumentFolder) => void;
  userId: string; canManage: boolean;
  items: { folder_id: string | null }[];
  depth?: number; parentId?: string | null;
}) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const children = folders.filter(f => f.parent_id === parentId);
  if (children.length === 0) return null;
  return (
    <div>
      {children.map(folder => {
        const hasChildren = folders.some(f => f.parent_id === folder.id);
        const isExpanded = expanded.has(folder.id);
        const isSelected = selectedId === folder.id;
        const isOwner = folder.owner_id === userId || canManage;
        const itemCount = items.filter(d => d.folder_id === folder.id).length;
        return (
          <div key={folder.id}>
            <div className="group/folder flex items-center gap-1 py-1 px-1 rounded-lg cursor-pointer transition-colors"
              style={{ paddingLeft: `${depth * 14 + 4}px`, background: isSelected ? 'var(--bg-active)' : 'transparent' }}
              onClick={() => onSelect(folder.id)}>
              {/* Expand/collapse arrow */}
              <button type="button" onClick={e => { e.stopPropagation(); if (hasChildren) onToggle(folder.id); }}
                className="w-4 h-4 flex-shrink-0 flex items-center justify-center"
                style={{ color: 'var(--text-muted)', opacity: hasChildren ? 1 : 0 }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                  {isExpanded ? <path d="M2 3l3 4 3-4H2z"/> : <path d="M3 2l4 3-4 3V2z"/>}
                </svg>
              </button>
              {/* Folder icon */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={folder.is_shared ? 'var(--primary)' : folder.color} strokeWidth="2"
                style={{ flexShrink: 0 }}>
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
              <span className="flex-1 text-xs truncate" style={{ color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                {folder.name}
              </span>
              {itemCount > 0 && (
                <span className="text-[10px] px-1.5 py-0 rounded-full flex-shrink-0 mr-1" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>{itemCount}</span>
              )}
              {/* Mobile: ⋮ dropdown */}
              <div className="sm:hidden flex-shrink-0" onClick={e => e.stopPropagation()}>
                <button type="button"
                  onClick={e => {
                    e.stopPropagation();
                    if (openMenu === folder.id) { setOpenMenu(null); setMenuPos(null); }
                    else {
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                      setOpenMenu(folder.id);
                    }
                  }}
                  className="w-7 h-7 flex items-center justify-center rounded-md transition-colors"
                  style={{ color: 'var(--text-muted)', background: openMenu === folder.id ? 'var(--bg-hover)' : 'transparent' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
                </button>
                {openMenu === folder.id && menuPos && (
                  <div className="fixed z-[9999] rounded-lg border shadow-lg py-1 min-w-[160px]"
                    style={{ top: menuPos.top, right: menuPos.right, background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                    {depth < MAX_DEPTH - 1 && (
                      <button type="button"
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-[var(--bg-hover)]"
                        style={{ color: 'var(--text-secondary)' }}
                        onClick={e => { e.stopPropagation(); setOpenMenu(null); onAddSub(folder.id, depth + 1); }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Přidat podsložku
                      </button>
                    )}
                    {isOwner && (
                      <>
                        <button type="button"
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-[var(--bg-hover)]"
                          style={{ color: folder.is_shared ? 'var(--primary)' : 'var(--text-secondary)' }}
                          onClick={e => { e.stopPropagation(); setOpenMenu(null); onShare(folder); }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                          Sdílet
                        </button>
                        <button type="button"
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-[var(--bg-hover)]"
                          style={{ color: 'var(--text-secondary)' }}
                          onClick={e => { e.stopPropagation(); setOpenMenu(null); onEdit(folder); }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          Přejmenovat
                        </button>
                        <button type="button"
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-[var(--bg-hover)]"
                          style={{ color: '#ef4444' }}
                          onClick={e => { e.stopPropagation(); setOpenMenu(null); onDelete(folder); }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M9 6V4h6v2"/></svg>
                          Smazat
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
              {/* Desktop: hover icons */}
              <div className="hidden sm:flex sm:opacity-0 sm:group-hover/folder:opacity-100 items-center gap-0.5 flex-shrink-0 transition-opacity">
                {depth < MAX_DEPTH - 1 && (
                  <button type="button" title="Přidat podsložku" onClick={e => { e.stopPropagation(); onAddSub(folder.id, depth + 1); }}
                    className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </button>
                )}
                {isOwner && (
                  <>
                    <button type="button" title="Sdílet" onClick={e => { e.stopPropagation(); onShare(folder); }}
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bg-hover)]"
                      style={{ color: folder.is_shared ? 'var(--primary)' : 'var(--text-muted)' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                    </button>
                    <button type="button" title="Přejmenovat" onClick={e => { e.stopPropagation(); onEdit(folder); }}
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button type="button" title="Smazat" onClick={e => { e.stopPropagation(); onDelete(folder); }}
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bg-hover)]" style={{ color: '#ef4444' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                      </svg>
                    </button>
                  </>
                )}
              </div>
            </div>
            {isExpanded && (
              <FolderTree folders={folders} selectedId={selectedId} expanded={expanded}
                onSelect={onSelect} onToggle={onToggle} onAddSub={onAddSub}
                onEdit={onEdit} onDelete={onDelete} onShare={onShare}
                userId={userId} canManage={canManage} items={items} depth={depth + 1} parentId={folder.id} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

function DocumentsContent() {
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
  const [folderModal, setFolderModal] = useState<{ open: boolean; parentId: string | null; editing: DocumentFolder | null; name: string; color: string }>({
    open: false, parentId: null, editing: null, name: '', color: '#6366f1',
  });
  const [savingFolder, setSavingFolder] = useState(false);

  // Share modal
  const [shareModal, setShareModal] = useState<{ open: boolean; folder: DocumentFolder | null }>({ open: false, folder: null });
  const [shareType, setShareType] = useState<'none' | 'workspace' | 'users'>('none');
  const [shareUserIds, setShareUserIds] = useState<string[]>([]);

  // Document modal
  type DocForm = { open: boolean; mode: 'file' | 'link'; name: string; url: string; description: string; folder_id: string | null };
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

    // Fetch member profiles
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
    setDocForm({ open: true, mode: doc.type, name: doc.name, url: doc.url ?? '', description: doc.description ?? '', folder_id: doc.folder_id });
    setSelectedFile(null);
    setUploadError('');
  };

  const saveDocument = async () => {
    if (!wsId || !user) return;
    setSavingDoc(true);
    setUploadError('');
    try {
      if (editingDoc) {
        // Editace existujícího dokumentu
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

  const toggle = (id: string) => setExpanded(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });

  const visibleDocs = useMemo(() => {
    const qLow = searchQ.trim().toLowerCase();
    const base = selectedFolder === null ? docs
      : selectedFolder === '__none__' ? docs.filter(d => !d.folder_id)
      : docs.filter(d => d.folder_id === selectedFolder);
    if (!qLow) return base;
    return base.filter(d => d.name.toLowerCase().includes(qLow) || d.description.toLowerCase().includes(qLow));
  }, [docs, selectedFolder, searchQ]);

  const inputCls = 'w-full px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]';
  const inputStyle = { borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <h1 className="text-xl font-bold mb-3 flex-shrink-0" style={{ color: 'var(--text-primary)' }}>Dokumenty</h1>

      <div className="flex flex-col md:flex-row gap-5 flex-1 min-h-0">

        {/* ── Left panel ── */}
        <div className="md:w-64 flex-shrink-0 flex flex-col gap-2">
          {/* Mobile toggle */}
          <button
            className="md:hidden flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            onClick={() => setShowFolderPanel(p => !p)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            Složky
            <svg className="ml-auto" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: showFolderPanel ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}><polyline points="6 9 12 15 18 9"/></svg>
          </button>

          <div className={`rounded-xl border md:flex md:flex-col overflow-y-auto flex-1${showFolderPanel ? ' flex flex-col' : ' hidden'}`} style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            {/* Search */}
            <div className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Hledat dokumenty…"
                className="w-full px-3 py-1.5 rounded-lg border text-base sm:text-sm focus:outline-none"
                style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
            </div>

            <div className="p-2 flex flex-col gap-0.5">
              {/* Vše */}
              {(() => { const active = selectedFolder === null; return (
                <button onClick={() => setSelectedFolder(null)}
                  className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: active ? 'var(--bg-active)' : 'transparent', color: 'var(--text-primary)' }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                  Všechny dokumenty
                  <span className="ml-auto text-[10px]" style={{ color: 'var(--text-muted)' }}>{docs.length}</span>
                </button>
              ); })()}

              {/* Bez složky */}
              {docs.some(d => !d.folder_id) && (() => { const active = selectedFolder === '__none__'; return (
                <button onClick={() => setSelectedFolder('__none__')}
                  className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: active ? 'var(--bg-active)' : 'transparent', color: 'var(--text-secondary)' }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  Nezařazené
                  <span className="ml-auto text-[10px]" style={{ color: 'var(--text-muted)' }}>{docs.filter(d => !d.folder_id).length}</span>
                </button>
              ); })()}

              {/* Složky */}
              {folders.length > 0 && (
                <>
                  <div className="border-t mt-1 pt-1" style={{ borderColor: 'var(--border)' }} />
                  <div className="flex items-center justify-between px-2 py-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Složky</span>
                    {canManage && (
                      <button onClick={() => openFolderModal()} title="Nová složka"
                        className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bg-hover)] transition-colors"
                        style={{ color: 'var(--primary)' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      </button>
                    )}
                  </div>
                  <FolderTree
                    folders={folders} selectedId={selectedFolder} expanded={expanded}
                    onSelect={id => setSelectedFolder(id)} onToggle={toggle}
                    onAddSub={pid => openFolderModal(pid)} onEdit={f => openFolderModal(null, f)}
                    onDelete={deleteFolder} onShare={openShare}
                    userId={userId} canManage={canManage} items={docs} />
                </>
              )}

              {/* Nová složka tlačítko (pokud žádné složky neexistují) */}
              {folders.length === 0 && canManage && (
                <>
                  <div className="border-t mt-1 pt-1" style={{ borderColor: 'var(--border)' }} />
                  <button onClick={() => openFolderModal()}
                    className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Nová složka
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {/* Toolbar */}
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-sm flex-1 min-w-0 truncate" style={{ color: 'var(--text-muted)' }}>
              Firemní dokumenty, soubory a útilečné odkazy
            </p>
            {canManage && (
              <div className="flex gap-2 flex-shrink-0">
                {folders.length > 0 && (
                  <button
                    onClick={() => openFolderModal()}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                      <line x1="12" y1="11" x2="12" y2="17" /><line x1="9" y1="14" x2="15" y2="14" />
                    </svg>
                    Složka
                  </button>
                )}
                <button
                  onClick={() => setDocForm({ open: true, mode: 'file', name: '', url: '', description: '', folder_id: selectedFolder && selectedFolder !== '__none__' ? selectedFolder : null })}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
                  style={{ background: 'var(--primary)' }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Přidat
                </button>
              </div>
            )}
          </div>

          {/* Document list */}
          {visibleDocs.length === 0 ? (
            <div className="rounded-xl border p-10 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {searchQ ? 'Žádné výsledky hledání.' : selectedFolder === null ? 'Zatím žádné dokumenty.' : 'V této složce nejsou žádné dokumenty.'}
              </p>
              {canManage && !searchQ && (
                <button
                  onClick={() => setDocForm({ open: true, mode: 'file', name: '', url: '', description: '', folder_id: selectedFolder && selectedFolder !== '__none__' ? selectedFolder : null })}
                  className="mt-4 px-4 py-2 rounded-lg text-sm font-medium text-white"
                  style={{ background: 'var(--primary)' }}
                >
                  Přidat dokument
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {visibleDocs.map(doc => {
                const folder = doc.folder_id ? folders.find(f => f.id === doc.folder_id) : null;
                return (
                  <div key={doc.id} className="rounded-xl border p-4 flex items-start gap-3 group/doc" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                    <div className="flex-shrink-0 mt-0.5">
                      {doc.type === 'link' ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                        </svg>
                      ) : getFileIcon(doc.file_mime)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <button onClick={() => getFileUrl(doc)} className="text-sm font-medium hover:underline text-left" style={{ color: 'var(--text-primary)' }}>
                        {doc.name}
                      </button>
                      {doc.description && (
                        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{doc.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1">
                        {folder && (
                          <span className="text-xs flex items-center gap-1" style={{ color: folder.color }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                            </svg>
                            {folder.name}
                          </span>
                        )}
                        {doc.file_size && (
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{fmtSize(doc.file_size)}</span>
                        )}
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {new Date(doc.created_at).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                    <div className="flex-shrink-0 flex gap-1 opacity-0 group-hover/doc:opacity-100 transition-opacity">
                      <button onClick={() => getFileUrl(doc)} className="p-1.5 rounded" style={{ color: 'var(--text-muted)' }} title={doc.type === 'link' ? 'Otevřít odkaz' : 'Otevřít soubor'}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                      </button>
                      {canManage && (
                        <button onClick={() => openEditDoc(doc)} className="p-1.5 rounded" style={{ color: 'var(--text-muted)' }} title="Upravit"
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                      )}
                      {canManage && (
                        <button onClick={() => deleteDocument(doc)} disabled={deletingDoc === doc.id}
                          className="p-1.5 rounded disabled:opacity-50" style={{ color: 'var(--text-muted)' }} title="Smazat"
                          onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                            <path d="M10 11v6M14 11v6"/>
                            <path d="M9 6V4h6v2"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Modal: Složka ── */}
      {folderModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setFolderModal(f => ({ ...f, open: false }))}>
          <div className="rounded-xl shadow-xl border p-6 w-full max-w-sm" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }} onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              {folderModal.editing ? 'Upravit složku' : folderModal.parentId ? 'Nová podsložka' : 'Nová složka'}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Název</label>
                <input type="text" value={folderModal.name}
                  onChange={e => setFolderModal(f => ({ ...f, name: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && saveFolder()}
                  className={inputCls} style={inputStyle} placeholder="Název složky" autoFocus />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Barva</label>
                <div className="flex gap-2 flex-wrap">
                  {['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6b7280'].map(c => (
                    <button key={c} onClick={() => setFolderModal(f => ({ ...f, color: c }))}
                      className="w-7 h-7 rounded-full border-2 transition-transform"
                      style={{ background: c, borderColor: folderModal.color === c ? 'var(--text-primary)' : 'transparent', transform: folderModal.color === c ? 'scale(1.15)' : 'none' }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button onClick={() => setFolderModal(f => ({ ...f, open: false }))}
                className="px-4 py-2 rounded-lg text-sm border" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>Zrušit</button>
              <button onClick={saveFolder} disabled={savingFolder || !folderModal.name.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: 'var(--primary)' }}>
                {savingFolder ? 'Ukládám…' : 'Uložit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Sdílet složku ── */}
      {shareModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShareModal({ open: false, folder: null })}>
          <div className="w-96 p-5 rounded-2xl border shadow-xl" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }} onClick={e => e.stopPropagation()}>
            <h2 className="font-semibold mb-1 text-sm" style={{ color: 'var(--text-primary)' }}>Sdílet složku „{shareModal.folder?.name}"</h2>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Určete, kdo může složku a její dokumenty vidět</p>
            <div className="space-y-2 mb-4">
              {([
                { id: 'none', label: 'Nesdílet s nikým', desc: 'Složka zůstane soukromá' },
                { id: 'workspace', label: 'Celý workspace', desc: 'Vidí všichni členové' },
                { id: 'users', label: 'Konkrétní uživatelé', desc: 'Vybraní členové' },
              ] as const).map(t => (
                <label key={t.id} className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer"
                  style={{ borderColor: shareType === t.id ? 'var(--primary)' : 'var(--border)', background: shareType === t.id ? 'var(--bg-active)' : 'transparent' }}>
                  <input type="radio" checked={shareType === t.id} onChange={() => setShareType(t.id)} className="accent-[var(--primary)]" />
                  <div>
                    <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t.label}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{t.desc}</div>
                  </div>
                </label>
              ))}
            </div>
            {shareType === 'users' && (
              <div className="mb-4 max-h-48 overflow-y-auto space-y-1 rounded-xl border p-2" style={{ borderColor: 'var(--border)' }}>
                {members.filter(m => m.user_id !== userId).length === 0 && (
                  <p className="text-xs px-2 py-1" style={{ color: 'var(--text-muted)' }}>Žádní další členové workspace</p>
                )}
                {members.filter(m => m.user_id !== userId).map(m => {
                  const isChecked = shareUserIds.includes(m.user_id);
                  return (
                    <label key={m.user_id}
                      className="flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer transition-colors"
                      style={{ background: isChecked ? 'var(--bg-active)' : 'transparent' }}
                      onMouseEnter={e => { if (!isChecked) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isChecked ? 'var(--bg-active)' : 'transparent'; }}>
                      <input type="checkbox" checked={isChecked}
                        onChange={e => setShareUserIds(prev => e.target.checked ? [...prev, m.user_id] : prev.filter(id => id !== m.user_id))}
                        className="accent-[var(--primary)] flex-shrink-0" />
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                        style={{ background: m.avatar_color }}>
                        {getInitials(m.display_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{m.display_name}</div>
                        <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{m.email}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={saveShare} className="flex-1 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--primary)' }}>Uložit</button>
              <button onClick={() => setShareModal({ open: false, folder: null })} className="flex-1 py-2 rounded-lg text-sm font-medium border" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>Zrušit</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Přidat / Upravit dokument ── */}
      {docForm.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => { setDocForm(f => ({ ...f, open: false })); setEditingDoc(null); setSelectedFile(null); setUploadError(''); }}>
          <div className="rounded-xl shadow-xl border p-6 w-full max-w-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }} onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>{editingDoc ? 'Upravit dokument' : 'Přidat dokument'}</h2>
            {!editingDoc && (
              <div className="flex rounded-lg border overflow-hidden mb-4" style={{ borderColor: 'var(--border)' }}>
                {(['file', 'link'] as const).map(mode => (
                  <button key={mode} onClick={() => { setDocForm(f => ({ ...f, mode })); setUploadError(''); setSelectedFile(null); }}
                    className="flex-1 py-2 text-sm font-medium transition-colors"
                    style={{ background: docForm.mode === mode ? 'var(--primary)' : 'var(--bg-hover)', color: docForm.mode === mode ? 'white' : 'var(--text-secondary)' }}>
                    {mode === 'file' ? 'Soubor' : 'Odkaz (URL)'}
                  </button>
                ))}
              </div>
            )}
            <div className="space-y-3">
              {!editingDoc && docForm.mode === 'file' ? (
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Soubor <span style={{ color: 'var(--text-muted)' }}>(max {MAX_FILE_SIZE_MB} MB)</span>
                  </label>
                  <input ref={fileInputRef} type="file" accept={ALLOWED_MIME_TYPES.join(',')} onChange={handleFileChange}
                    className="w-full text-sm" style={{ color: 'var(--text-secondary)' }} />
                  {selectedFile && (
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{selectedFile.name} · {fmtSize(selectedFile.size)}</p>
                  )}
                </div>
              ) : (!editingDoc || editingDoc.type === 'link') && docForm.mode === 'link' ? (
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>URL adresa</label>
                  <input type="url" value={docForm.url} onChange={e => setDocForm(f => ({ ...f, url: e.target.value }))}
                    className={inputCls} style={inputStyle} placeholder="https://…" autoFocus={!editingDoc} />
                </div>
              ) : null}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Název</label>
                <input type="text" value={docForm.name} onChange={e => setDocForm(f => ({ ...f, name: e.target.value }))}
                  className={inputCls} style={inputStyle} placeholder="Název dokumentu" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Popis (volitelný)</label>
                <input type="text" value={docForm.description} onChange={e => setDocForm(f => ({ ...f, description: e.target.value }))}
                  className={inputCls} style={inputStyle} placeholder="Krátký popis…" />
              </div>
              {folders.length > 0 && (
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Složka</label>
                  <div className="relative">
                    <select value={docForm.folder_id ?? ''} onChange={e => setDocForm(f => ({ ...f, folder_id: e.target.value || null }))}
                      className={inputCls + ' appearance-none pr-8'} style={inputStyle}>
                      <option value="">Bez složky</option>
                      {folders.map(fl => <option key={fl.id} value={fl.id}>{fl.name}</option>)}
                    </select>
                    <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--text-muted)' }}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>
              )}
              {uploadError && <p className="text-xs" style={{ color: '#ef4444' }}>{uploadError}</p>}
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button onClick={() => { setDocForm({ open: false, mode: 'file', name: '', url: '', description: '', folder_id: null }); setEditingDoc(null); setSelectedFile(null); setUploadError(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                className="px-4 py-2 rounded-lg text-sm border" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>Zrušit</button>
              <button onClick={saveDocument} disabled={savingDoc}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: 'var(--primary)' }}>
                {savingDoc ? 'Ukládám…' : editingDoc ? 'Uložit' : 'Přidat'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

// ─── Outer page component ─────────────────────────────────────────────────────

export default function DocumentsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, user, router]);

  if (authLoading || !user) return null;

  return (
    <WorkspaceProvider>
      <DocumentsContent />
    </WorkspaceProvider>
  );
}
