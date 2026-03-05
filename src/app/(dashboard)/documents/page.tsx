'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace, WorkspaceProvider } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import DashboardLayout from '@/components/DashboardLayout';
import { useRouter } from 'next/navigation';
import type { DocumentFolder, WorkspaceDocument } from '@/types/database';

// ─── Typy ─────────────────────────────────────────────────────────────────────

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

// ─── Interní komponenta ───────────────────────────────────────────────────────

function DocumentsContent() {
  const { user } = useAuth();
  const { currentWorkspace, currentMembership, hasModule, loading: wsLoading } = useWorkspace();
  const { isWorkspaceAdmin, isMasterAdmin } = usePermissions();
  const router = useRouter();

  const canManage = useMemo(
    () => isMasterAdmin || isWorkspaceAdmin || (currentMembership?.can_manage_documents ?? false),
    [isMasterAdmin, isWorkspaceAdmin, currentMembership]
  );

  const [folders, setFolders] = useState<DocumentFolder[]>([]);
  const [docs, setDocs] = useState<WorkspaceDocument[]>([]);
  const [loading, setLoading] = useState(true);

  // Aktuálně vybraná složka (null = vše)
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [showFolderPanel, setShowFolderPanel] = useState(false);

  // Modál pro složku
  const [folderModal, setFolderModal] = useState<{ open: boolean; id: string | null; name: string; color: string }>({
    open: false, id: null, name: '', color: '#6366f1',
  });
  const [savingFolder, setSavingFolder] = useState(false);
  const [deletingFolder, setDeletingFolder] = useState<string | null>(null);

  // Modál pro přidání dokumentu
  type DocForm = { open: boolean; mode: 'file' | 'link'; name: string; url: string; description: string; folder_id: string | null };
  const [docForm, setDocForm] = useState<DocForm>({
    open: false, mode: 'file', name: '', url: '', description: '', folder_id: null,
  });
  const [savingDoc, setSavingDoc] = useState(false);
  const [deletingDoc, setDeletingDoc] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Redirect pokud modul není dostupný
  useEffect(() => {
    if (!wsLoading && !hasModule('documents')) router.replace('/');
  }, [wsLoading, hasModule, router]);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!currentWorkspace) { setLoading(false); return; }
    setLoading(true);
    const [fRes, dRes] = await Promise.all([
      supabase.from('trackino_document_folders').select('*').eq('workspace_id', currentWorkspace.id).order('sort_order').order('name'),
      supabase.from('trackino_documents').select('*').eq('workspace_id', currentWorkspace.id).order('created_at', { ascending: false }),
    ]);
    setFolders((fRes.data ?? []) as DocumentFolder[]);
    setDocs((dRes.data ?? []) as WorkspaceDocument[]);
    setLoading(false);
  }, [currentWorkspace]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Složky – uložení ───────────────────────────────────────────────────────

  const saveFolder = async () => {
    if (!currentWorkspace || !folderModal.name.trim()) return;
    setSavingFolder(true);
    if (folderModal.id) {
      await supabase.from('trackino_document_folders')
        .update({ name: folderModal.name.trim(), color: folderModal.color, updated_at: new Date().toISOString() })
        .eq('id', folderModal.id);
    } else {
      await supabase.from('trackino_document_folders').insert({
        workspace_id: currentWorkspace.id,
        name: folderModal.name.trim(),
        color: folderModal.color,
        sort_order: folders.length,
        created_by: user!.id,
      });
    }
    setSavingFolder(false);
    setFolderModal({ open: false, id: null, name: '', color: '#6366f1' });
    fetchData();
  };

  const deleteFolder = async (id: string) => {
    if (!confirm('Smazat složku? Dokumenty ve složce zůstanou, ale nebudou přiřazeny žádné složce.')) return;
    setDeletingFolder(id);
    // Odebrat folder_id z dokumentů
    await supabase.from('trackino_documents').update({ folder_id: null }).eq('folder_id', id);
    await supabase.from('trackino_document_folders').delete().eq('id', id);
    if (selectedFolder === id) setSelectedFolder(null);
    setDeletingFolder(null);
    fetchData();
  };

  // ── Dokumenty – přidání ───────────────────────────────────────────────────

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

  const saveDocument = async () => {
    if (!currentWorkspace || !user) return;
    setSavingDoc(true);
    setUploadError('');

    try {
      if (docForm.mode === 'file') {
        if (!selectedFile) { setUploadError('Vyberte soubor.'); setSavingDoc(false); return; }
        const ext = selectedFile.name.split('.').pop() ?? '';
        const filePath = `${currentWorkspace.id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('trackino-documents')
          .upload(filePath, selectedFile, { contentType: selectedFile.type });

        if (uploadErr) { setUploadError('Nahrání souboru selhalo: ' + uploadErr.message); setSavingDoc(false); return; }

        await supabase.from('trackino_documents').insert({
          workspace_id: currentWorkspace.id,
          folder_id: docForm.folder_id,
          name: docForm.name.trim() || selectedFile.name,
          type: 'file',
          file_path: filePath,
          file_size: selectedFile.size,
          file_mime: selectedFile.type,
          url: null,
          description: docForm.description.trim(),
          created_by: user.id,
        });
      } else {
        if (!docForm.url.trim()) { setUploadError('Zadejte URL adresu.'); setSavingDoc(false); return; }
        await supabase.from('trackino_documents').insert({
          workspace_id: currentWorkspace.id,
          folder_id: docForm.folder_id,
          name: docForm.name.trim() || docForm.url,
          type: 'link',
          file_path: null,
          file_size: null,
          file_mime: null,
          url: docForm.url.trim(),
          description: docForm.description.trim(),
          created_by: user.id,
        });
      }

      setDocForm({ open: false, mode: 'file', name: '', url: '', description: '', folder_id: null });
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchData();
    } catch (err) {
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

  // ── Filtrované dokumenty ───────────────────────────────────────────────────

  const visibleDocs = useMemo(() => {
    if (selectedFolder === null) return docs;
    if (selectedFolder === '__none__') return docs.filter(d => !d.folder_id);
    return docs.filter(d => d.folder_id === selectedFolder);
  }, [docs, selectedFolder]);

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  const inputCls = 'w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]';
  const inputStyle = { borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        {/* Záhlaví */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="min-w-0">
            <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Dokumenty</h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Firemní dokumenty, soubory a užitečné odkazy na jednom místě
            </p>
          </div>
          {canManage && (
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => setFolderModal({ open: true, id: null, name: '', color: '#6366f1' })}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  <line x1="12" y1="11" x2="12" y2="17" /><line x1="9" y1="14" x2="15" y2="14" />
                </svg>
                Složka
              </button>
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

        {/* Mobile toggle for folder panel */}
        <div className="md:hidden mb-3">
          <button
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border w-full"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            onClick={() => setShowFolderPanel(p => !p)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            Složky
            <svg className="ml-auto" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: showFolderPanel ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </div>

        <div className="flex gap-5">
          {/* ── Levý panel: složky ─────────────────────────────────────────── */}
          <div className={`md:w-48 flex-shrink-0${showFolderPanel ? '' : ' hidden md:block'}`}>
            <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Složky</div>
            <div className="space-y-0.5">
              {/* Vše */}
              <button
                onClick={() => setSelectedFolder(null)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors"
                style={{
                  background: selectedFolder === null ? 'var(--bg-active)' : 'transparent',
                  color: selectedFolder === null ? 'var(--primary)' : 'var(--text-secondary)',
                }}
                onMouseEnter={e => { if (selectedFolder !== null) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { if (selectedFolder !== null) e.currentTarget.style.background = 'transparent'; }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                <span className="flex-1 truncate">Vše</span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{docs.length}</span>
              </button>

              {/* Bez složky */}
              {docs.some(d => !d.folder_id) && (
                <button
                  onClick={() => setSelectedFolder('__none__')}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors"
                  style={{
                    background: selectedFolder === '__none__' ? 'var(--bg-active)' : 'transparent',
                    color: selectedFolder === '__none__' ? 'var(--primary)' : 'var(--text-secondary)',
                  }}
                  onMouseEnter={e => { if (selectedFolder !== '__none__') e.currentTarget.style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={e => { if (selectedFolder !== '__none__') e.currentTarget.style.background = 'transparent'; }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="6" width="20" height="14" rx="2" />
                    <line x1="8" y1="2" x2="8" y2="6" /><line x1="16" y1="2" x2="16" y2="6" />
                  </svg>
                  <span className="flex-1 truncate">Bez složky</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{docs.filter(d => !d.folder_id).length}</span>
                </button>
              )}

              {/* Složky */}
              {folders.map(folder => {
                const count = docs.filter(d => d.folder_id === folder.id).length;
                const isActive = selectedFolder === folder.id;
                return (
                  <div key={folder.id} className="group/folder relative">
                    <button
                      onClick={() => setSelectedFolder(folder.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors"
                      style={{
                        background: isActive ? 'var(--bg-active)' : 'transparent',
                        color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                      }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={folder.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                      </svg>
                      <span className="flex-1 truncate">{folder.name}</span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{count}</span>
                    </button>
                    {/* Akce složky */}
                    {canManage && (
                      <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover/folder:flex gap-0.5">
                        <button
                          onClick={() => setFolderModal({ open: true, id: folder.id, name: folder.name, color: folder.color })}
                          className="p-1 rounded"
                          style={{ color: 'var(--text-muted)' }}
                          title="Přejmenovat"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => deleteFolder(folder.id)}
                          disabled={deletingFolder === folder.id}
                          className="p-1 rounded disabled:opacity-50"
                          style={{ color: 'var(--text-muted)' }}
                          title="Smazat"
                          onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Pravý panel: dokumenty ──────────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            {visibleDocs.length === 0 ? (
              <div className="rounded-xl border p-10 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  {selectedFolder === null ? 'Zatím žádné dokumenty.' : 'V této složce nejsou žádné dokumenty.'}
                </p>
                {canManage && (
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
                      {/* Ikona */}
                      <div className="flex-shrink-0 mt-0.5">
                        {doc.type === 'link' ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                          </svg>
                        ) : getFileIcon(doc.file_mime)}
                      </div>

                      {/* Obsah */}
                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() => getFileUrl(doc)}
                          className="text-sm font-medium hover:underline text-left"
                          style={{ color: 'var(--text-primary)' }}
                        >
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

                      {/* Akce */}
                      <div className="flex-shrink-0 flex gap-1 opacity-0 group-hover/doc:opacity-100 transition-opacity">
                        <button
                          onClick={() => getFileUrl(doc)}
                          className="p-1.5 rounded"
                          style={{ color: 'var(--text-muted)' }}
                          title={doc.type === 'link' ? 'Otevřít odkaz' : 'Otevřít soubor'}
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                          </svg>
                        </button>
                        {canManage && (
                          <button
                            onClick={() => deleteDocument(doc)}
                            disabled={deletingDoc === doc.id}
                            className="p-1.5 rounded disabled:opacity-50"
                            style={{ color: 'var(--text-muted)' }}
                            title="Smazat"
                            onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
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
      </div>

      {/* ── Modal: Složka ── */}
      {folderModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-2xl shadow-xl p-6 w-full max-w-sm" style={{ background: 'var(--bg-card)' }}>
            <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              {folderModal.id ? 'Upravit složku' : 'Nová složka'}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Název</label>
                <input
                  type="text"
                  value={folderModal.name}
                  onChange={e => setFolderModal(f => ({ ...f, name: e.target.value }))}
                  className={inputCls}
                  style={inputStyle}
                  placeholder="Název složky"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Barva</label>
                <div className="flex gap-2 flex-wrap">
                  {['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6b7280'].map(c => (
                    <button
                      key={c}
                      onClick={() => setFolderModal(f => ({ ...f, color: c }))}
                      className="w-7 h-7 rounded-full border-2 transition-transform"
                      style={{
                        background: c,
                        borderColor: folderModal.color === c ? 'var(--text-primary)' : 'transparent',
                        transform: folderModal.color === c ? 'scale(1.15)' : 'none',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button
                onClick={() => setFolderModal({ open: false, id: null, name: '', color: '#6366f1' })}
                className="px-4 py-2 rounded-lg text-sm border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              >Zrušit</button>
              <button
                onClick={saveFolder}
                disabled={savingFolder || !folderModal.name.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ background: 'var(--primary)' }}
              >{savingFolder ? 'Ukládám...' : 'Uložit'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Přidat dokument ── */}
      {docForm.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-2xl shadow-xl p-6 w-full max-w-md" style={{ background: 'var(--bg-card)' }}>
            <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Přidat dokument</h2>

            {/* Přepínač soubor / odkaz */}
            <div className="flex rounded-lg border overflow-hidden mb-4" style={{ borderColor: 'var(--border)' }}>
              {(['file', 'link'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => { setDocForm(f => ({ ...f, mode })); setUploadError(''); setSelectedFile(null); }}
                  className="flex-1 py-2 text-sm font-medium transition-colors"
                  style={{
                    background: docForm.mode === mode ? 'var(--primary)' : 'var(--bg-hover)',
                    color: docForm.mode === mode ? 'white' : 'var(--text-secondary)',
                  }}
                >
                  {mode === 'file' ? 'Soubor' : 'Odkaz (URL)'}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {docForm.mode === 'file' ? (
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Soubor <span style={{ color: 'var(--text-muted)' }}>(max {MAX_FILE_SIZE_MB} MB)</span>
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ALLOWED_MIME_TYPES.join(',')}
                    onChange={handleFileChange}
                    className="w-full text-sm"
                    style={{ color: 'var(--text-secondary)' }}
                  />
                  {selectedFile && (
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      {selectedFile.name} · {fmtSize(selectedFile.size)}
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>URL adresa</label>
                  <input
                    type="url"
                    value={docForm.url}
                    onChange={e => setDocForm(f => ({ ...f, url: e.target.value }))}
                    className={inputCls}
                    style={inputStyle}
                    placeholder="https://..."
                    autoFocus
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Název</label>
                <input
                  type="text"
                  value={docForm.name}
                  onChange={e => setDocForm(f => ({ ...f, name: e.target.value }))}
                  className={inputCls}
                  style={inputStyle}
                  placeholder="Název dokumentu"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Popis (volitelný)</label>
                <input
                  type="text"
                  value={docForm.description}
                  onChange={e => setDocForm(f => ({ ...f, description: e.target.value }))}
                  className={inputCls}
                  style={inputStyle}
                  placeholder="Krátký popis..."
                />
              </div>

              {folders.length > 0 && (
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Složka</label>
                  <div className="relative">
                    <select
                      value={docForm.folder_id ?? ''}
                      onChange={e => setDocForm(f => ({ ...f, folder_id: e.target.value || null }))}
                      className={inputCls + ' appearance-none pr-9'}
                      style={inputStyle}
                    >
                      <option value="">Bez složky</option>
                      {folders.map(fl => <option key={fl.id} value={fl.id}>{fl.name}</option>)}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3" style={{ color: 'var(--text-muted)' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                    </div>
                  </div>
                </div>
              )}

              {uploadError && (
                <p className="text-xs" style={{ color: '#ef4444' }}>{uploadError}</p>
              )}
            </div>

            <div className="flex gap-2 justify-end mt-5">
              <button
                onClick={() => { setDocForm({ open: false, mode: 'file', name: '', url: '', description: '', folder_id: null }); setSelectedFile(null); setUploadError(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                className="px-4 py-2 rounded-lg text-sm border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              >Zrušit</button>
              <button
                onClick={saveDocument}
                disabled={savingDoc}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ background: 'var(--primary)' }}
              >{savingDoc ? 'Ukládám...' : 'Přidat'}</button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

// ─── Outer page component ────────────────────────────────────────────────────

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
