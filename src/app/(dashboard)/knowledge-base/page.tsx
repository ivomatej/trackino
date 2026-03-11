'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace, WorkspaceProvider } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase';
import type { KbFolder, KbFolderShare, KbPage, KbVersion, KbComment, KbReview, KbAccess, KbPageStatus } from '@/types/database';

// ── Subcomponents ─────────────────────────────────────────────────────────────
import KbSidebar from './_components/KbSidebar';
import KbWelcomeScreen from './_components/KbWelcomeScreen';
import KbPageDetail from './_components/KbPageDetail';
import KbModals from './_components/KbModals';
import PageListView from './_components/PageListView';
import type { KbMember, ListFilter, PageTab } from './_components/types';
import { STATUS_CONFIG, TEMPLATES } from './_components/types';
import { getDepth, slugify, generatePublicToken } from './_components/utils';

// ── Main Component ────────────────────────────────────────────────────────────

function KnowledgeBaseContent() {
  const { user } = useAuth();
  const { currentWorkspace, loading: wsLoading, hasModule } = useWorkspace();
  const { isWorkspaceAdmin, isMasterAdmin } = usePermissions();
  const router = useRouter();

  // ── State ──────────────────────────────────────────────────────────────────
  const [folders, setFolders] = useState<KbFolder[]>([]);
  const [pages, setPages] = useState<KbPage[]>([]);
  const [selectedPage, setSelectedPage] = useState<KbPage | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editStatus, setEditStatus] = useState<KbPageStatus>('active');
  const [editRestricted, setEditRestricted] = useState(false);
  const [editFolderId, setEditFolderId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copiedPage, setCopiedPage] = useState(false);
  const [copiedPublicUrl, setCopiedPublicUrl] = useState(false);
  const [publishingPage, setPublishingPage] = useState(false);

  const [search, setSearch] = useState('');
  const [members, setMembers] = useState<KbMember[]>([]);

  const [comments, setComments] = useState<KbComment[]>([]);
  const [versions, setVersions] = useState<KbVersion[]>([]);
  const [reviews, setReviews] = useState<KbReview[]>([]);
  const [allReviews, setAllReviews] = useState<Pick<KbReview, 'page_id' | 'review_date' | 'is_done'>[]>([]);
  const [access, setAccess] = useState<KbAccess[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const [activeTab, setActiveTab] = useState<PageTab>('comments');
  const [newComment, setNewComment] = useState('');
  const [editingComment, setEditingComment] = useState<{ id: string; content: string } | null>(null);
  const [savingComment, setSavingComment] = useState(false);

  const [leftOpen, setLeftOpen] = useState(false);
  const [listFilter, setListFilter] = useState<ListFilter | null>(null);
  const [statusSectionExpanded, setStatusSectionExpanded] = useState(false);
  const [mentionSectionExpanded, setMentionSectionExpanded] = useState(false);

  // Folder modal
  const [folderModal, setFolderModal] = useState<{ mode: 'add' | 'edit'; parentId: string | null; depth: number; target: KbFolder | null; name: string } | null>(null);

  // Share modal
  const [folderShares, setFolderShares] = useState<KbFolderShare[]>([]);
  const [shareModal, setShareModal] = useState<{ open: boolean; folder: KbFolder | null }>({ open: false, folder: null });
  const [shareType, setShareType] = useState<'none' | 'workspace' | 'users'>('none');
  const [shareUserIds, setShareUserIds] = useState<string[]>([]);

  // Template modal
  const [templateModal, setTemplateModal] = useState<{ folderId: string | null } | null>(null);

  // Review modal
  const [reviewModal, setReviewModal] = useState(false);
  const [reviewForm, setReviewForm] = useState({ assigned_to: '', review_date: '', note: '' });
  const [savingReview, setSavingReview] = useState(false);

  const canAdmin = isMasterAdmin || isWorkspaceAdmin;

  // ── Guard ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!wsLoading && !hasModule('knowledge_base')) router.replace('/');
  }, [wsLoading, hasModule, router]);

  // ── Fetch data ─────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    if (!currentWorkspace || !user) return;
    const wid = currentWorkspace.id;

    const [{ data: fData }, { data: pData }, { data: memData }, { data: favData }, { data: revData }, { data: sharesData }] = await Promise.all([
      supabase.from('trackino_kb_folders').select('*').eq('workspace_id', wid).order('name'),
      supabase.from('trackino_kb_pages').select('*').eq('workspace_id', wid).order('updated_at', { ascending: false }),
      supabase.from('trackino_workspace_members').select('user_id').eq('workspace_id', wid).eq('approved', true),
      supabase.from('trackino_kb_favorites').select('page_id').eq('user_id', user.id),
      supabase.from('trackino_kb_reviews').select('page_id,review_date,is_done').eq('workspace_id', wid),
      supabase.from('trackino_kb_folder_shares').select('*').eq('workspace_id', wid),
    ]);

    setFolderShares((sharesData ?? []) as KbFolderShare[]);
    setFolders((fData ?? []) as KbFolder[]);
    setPages((pData ?? []) as KbPage[]);
    setFavorites(new Set((favData ?? []).map((f: { page_id: string }) => f.page_id)));
    setAllReviews((revData ?? []) as Pick<KbReview, 'page_id' | 'review_date' | 'is_done'>[]);

    const uids = ((memData ?? []) as { user_id: string }[]).map(m => m.user_id);
    if (uids.length > 0) {
      const { data: profiles } = await supabase.from('trackino_profiles').select('id,display_name,avatar_color,email').in('id', uids).order('display_name');
      setMembers(((profiles ?? []) as { id: string; display_name: string; avatar_color: string; email?: string }[]).map(p => ({ user_id: p.id, display_name: p.display_name, avatar_color: p.avatar_color, email: p.email })));
    }
  }, [currentWorkspace?.id, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const fetchPageDetail = useCallback(async (pageId: string) => {
    if (!currentWorkspace) return;
    const [{ data: p }, { data: c }, { data: v }, { data: r }, { data: a }] = await Promise.all([
      supabase.from('trackino_kb_pages').select('*').eq('id', pageId).single(),
      supabase.from('trackino_kb_comments').select('*').eq('page_id', pageId).order('created_at'),
      supabase.from('trackino_kb_versions').select('*').eq('page_id', pageId).order('created_at', { ascending: false }).limit(20),
      supabase.from('trackino_kb_reviews').select('*').eq('page_id', pageId).order('review_date'),
      supabase.from('trackino_kb_access').select('*').eq('page_id', pageId),
    ]);
    if (p) setSelectedPage(p as KbPage);
    setComments((c ?? []) as KbComment[]);
    setVersions((v ?? []) as KbVersion[]);
    setReviews((r ?? []) as KbReview[]);
    setAccess((a ?? []) as KbAccess[]);
  }, [currentWorkspace?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Page selection ─────────────────────────────────────────────────────────

  const selectPage = (id: string) => {
    setEditing(false);
    setSelectedPage(null);
    setComments([]); setVersions([]); setReviews([]); setAccess([]);
    setActiveTab('comments');
    fetchPageDetail(id);
  };

  const backToList = () => {
    setSelectedPage(null);
    setEditing(false);
    setComments([]); setVersions([]); setReviews([]); setAccess([]);
  };

  // ── Can edit check ─────────────────────────────────────────────────────────

  const canEditPage = (page: KbPage) => {
    if (!user) return false;
    if (canAdmin) return true;
    if (!page.is_restricted) return true;
    return access.some(a => a.user_id === user.id && a.can_edit);
  };

  // ── Save page ──────────────────────────────────────────────────────────────

  const startEdit = (page: KbPage) => {
    setEditTitle(page.title);
    setEditContent(page.content);
    setEditStatus(page.status);
    setEditRestricted(page.is_restricted);
    setEditFolderId(page.folder_id);
    setEditing(true);
  };

  const savePage = async () => {
    if (!user || !currentWorkspace || !selectedPage) return;
    setSaving(true);
    const now = new Date().toISOString();
    const payload = { title: editTitle.trim() || 'Bez názvu', content: editContent, tasks: [] as { id: string; text: string; checked: boolean }[], status: editStatus, is_restricted: editRestricted, folder_id: editFolderId, updated_by: user.id, updated_at: now };

    if (selectedPage.id.startsWith('__new__')) {
      const { data: np } = await supabase.from('trackino_kb_pages').insert({
        workspace_id: currentWorkspace.id,
        ...payload, created_by: user.id,
      }).select().single();
      if (np) {
        await supabase.from('trackino_kb_versions').insert({ page_id: (np as KbPage).id, workspace_id: currentWorkspace.id, content: editContent, title: payload.title, edited_by: user.id });
        await fetchAll();
        selectPage((np as KbPage).id);
      }
    } else {
      await supabase.from('trackino_kb_pages').update(payload).eq('id', selectedPage.id);
      await supabase.from('trackino_kb_versions').insert({ page_id: selectedPage.id, workspace_id: currentWorkspace.id, content: editContent, title: payload.title, edited_by: user.id });
      await fetchAll();
      await fetchPageDetail(selectedPage.id);
      setEditing(false);
    }
    setSaving(false);
  };

  const cancelEdit = () => {
    if (selectedPage?.id.startsWith('__new__')) {
      setSelectedPage(null); setEditing(false);
    } else {
      setEditing(false);
    }
  };

  // ── Delete page ────────────────────────────────────────────────────────────

  const deletePage = async (id: string) => {
    if (!confirm('Smazat tuto stránku? Akce je nevratná.')) return;
    await supabase.from('trackino_kb_pages').delete().eq('id', id);
    setSelectedPage(null); setEditing(false);
    await fetchAll();
  };

  // ── Publish / Unpublish ───────────────────────────────────────────────────

  const getPublicUrl = (page: KbPage) => {
    if (!page.public_token) return '';
    const slug = slugify(page.title);
    return `${window.location.origin}/kb/${slug}/${page.public_token}`;
  };

  const togglePublish = async (page: KbPage) => {
    if (page.id.startsWith('__new__')) return;
    setPublishingPage(true);
    if (page.public_token) {
      await supabase.from('trackino_kb_pages').update({ public_token: null }).eq('id', page.id);
      setSelectedPage(prev => prev ? { ...prev, public_token: null } : prev);
      setPages(prev => prev.map(p => p.id === page.id ? { ...p, public_token: null } : p));
    } else {
      const token = generatePublicToken();
      await supabase.from('trackino_kb_pages').update({ public_token: token }).eq('id', page.id);
      setSelectedPage(prev => prev ? { ...prev, public_token: token } : prev);
      setPages(prev => prev.map(p => p.id === page.id ? { ...p, public_token: token } : p));
    }
    setPublishingPage(false);
  };

  const copyPublicUrl = (page: KbPage) => {
    const url = getPublicUrl(page);
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedPublicUrl(true);
    setTimeout(() => setCopiedPublicUrl(false), 2000);
  };

  // ── New page ───────────────────────────────────────────────────────────────

  const openNewPage = (folderId?: string | null) => {
    const fid = folderId !== undefined ? folderId : (listFilter?.type === 'folder' ? listFilter.folderId : null);
    setTemplateModal({ folderId: fid });
  };

  const createPageFromTemplate = (template: typeof TEMPLATES[0], folderId: string | null) => {
    setTemplateModal(null);
    const fake: KbPage = {
      id: '__new__', workspace_id: currentWorkspace?.id ?? '', folder_id: folderId,
      title: template.title === 'Prázdná stránka' ? 'Nová stránka' : template.title,
      content: template.content, tasks: [], status: 'draft', tags: [], is_restricted: false, public_token: null,
      created_by: user?.id ?? '', updated_by: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    setSelectedPage(fake);
    setEditing(true);
    setEditTitle(fake.title);
    setEditContent(fake.content);
    setEditStatus('draft');
    setEditRestricted(false);
    setComments([]); setVersions([]); setReviews([]); setAccess([]);
  };

  // ── Checklist toggle (silent save) ────────────────────────────────────────

  const handleChecklistToggle = async (html: string) => {
    if (!selectedPage || selectedPage.id.startsWith('__new__') || !canEditPage(selectedPage)) return;
    setSelectedPage(prev => prev ? { ...prev, content: html } : prev);
    setPages(prev => prev.map(p => p.id === selectedPage.id ? { ...p, content: html } : p));
    await supabase.from('trackino_kb_pages').update({ content: html, updated_by: user?.id, updated_at: new Date().toISOString() }).eq('id', selectedPage.id);
  };

  // ── Favorite toggle ───────────────────────────────────────────────────────

  const toggleFavorite = async (pageId: string) => {
    if (!user) return;
    if (favorites.has(pageId)) {
      await supabase.from('trackino_kb_favorites').delete().eq('page_id', pageId).eq('user_id', user.id);
      setFavorites(prev => { const n = new Set(prev); n.delete(pageId); return n; });
    } else {
      await supabase.from('trackino_kb_favorites').insert({ page_id: pageId, user_id: user.id });
      setFavorites(prev => new Set([...prev, pageId]));
    }
  };

  // ── Comments ──────────────────────────────────────────────────────────────

  const addComment = async () => {
    if (!user || !selectedPage || !newComment.trim() || selectedPage.id.startsWith('__new__')) return;
    setSavingComment(true);
    const { data: c } = await supabase.from('trackino_kb_comments').insert({
      page_id: selectedPage.id, workspace_id: currentWorkspace?.id, user_id: user.id, content: newComment.trim(),
    }).select().single();
    if (c) setComments(prev => [...prev, c as KbComment]);
    setNewComment('');
    setSavingComment(false);
  };

  const updateComment = async () => {
    if (!editingComment || !editingComment.content.trim()) return;
    await supabase.from('trackino_kb_comments').update({ content: editingComment.content, updated_at: new Date().toISOString() }).eq('id', editingComment.id);
    setComments(prev => prev.map(c => c.id === editingComment.id ? { ...c, content: editingComment.content } : c));
    setEditingComment(null);
  };

  const deleteComment = async (id: string) => {
    await supabase.from('trackino_kb_comments').delete().eq('id', id);
    setComments(prev => prev.filter(c => c.id !== id));
  };

  // ── Version revert ────────────────────────────────────────────────────────

  const revertToVersion = async (v: KbVersion) => {
    if (!confirm('Obnovit tuto verzi? Aktuální obsah bude nahrazen.')) return;
    if (!selectedPage || !user) return;
    const now = new Date().toISOString();
    await supabase.from('trackino_kb_pages').update({ title: v.title, content: v.content, updated_by: user.id, updated_at: now }).eq('id', selectedPage.id);
    await supabase.from('trackino_kb_versions').insert({ page_id: selectedPage.id, workspace_id: currentWorkspace?.id ?? '', content: v.content, title: v.title, edited_by: user.id });
    await fetchPageDetail(selectedPage.id);
    await fetchAll();
  };

  // ── Reviews ───────────────────────────────────────────────────────────────

  const addReview = async () => {
    if (!reviewForm.assigned_to || !reviewForm.review_date || !selectedPage || !user || !currentWorkspace) return;
    setSavingReview(true);
    const { data: r } = await supabase.from('trackino_kb_reviews').insert({
      workspace_id: currentWorkspace.id, page_id: selectedPage.id.startsWith('__new__') ? null : selectedPage.id,
      assigned_to: reviewForm.assigned_to, review_date: reviewForm.review_date,
      note: reviewForm.note, created_by: user.id,
    }).select().single();
    if (r) setReviews(prev => [...prev, r as KbReview]);
    setReviewModal(false);
    setReviewForm({ assigned_to: '', review_date: '', note: '' });
    setSavingReview(false);
  };

  const toggleReviewDone = async (id: string, done: boolean) => {
    await supabase.from('trackino_kb_reviews').update({ is_done: done }).eq('id', id);
    setReviews(prev => prev.map(r => r.id === id ? { ...r, is_done: done } : r));
  };

  const deleteReview = async (id: string) => {
    await supabase.from('trackino_kb_reviews').delete().eq('id', id);
    setReviews(prev => prev.filter(r => r.id !== id));
  };

  // ── Access (per-page rights) ───────────────────────────────────────────────

  const toggleUserAccess = async (userId: string, canEdit: boolean) => {
    if (!selectedPage || !currentWorkspace) return;
    const existing = access.find(a => a.user_id === userId);
    if (existing) {
      if (canEdit) {
        setAccess(prev => prev.map(a => a.id === existing.id ? { ...a, can_edit: true } : a));
        await supabase.from('trackino_kb_access').update({ can_edit: true }).eq('id', existing.id);
      } else {
        setAccess(prev => prev.filter(a => a.id !== existing.id));
        await supabase.from('trackino_kb_access').delete().eq('id', existing.id);
      }
    } else if (canEdit) {
      const tempId = `temp-${userId}`;
      const tempAccess: KbAccess = { id: tempId, workspace_id: currentWorkspace.id, page_id: selectedPage.id, user_id: userId, can_edit: true, created_at: new Date().toISOString() };
      setAccess(prev => [...prev, tempAccess]);
      const { data: na } = await supabase.from('trackino_kb_access').insert({
        workspace_id: currentWorkspace.id, page_id: selectedPage.id, user_id: userId, can_edit: true,
      }).select().single();
      if (na) setAccess(prev => prev.map(a => a.id === tempId ? na as KbAccess : a));
    }
  };

  // ── Restricted toggle (from Access tab, non-edit mode) ────────────────────

  const onRestrictedToggle = async (newVal: boolean) => {
    if (!selectedPage) return;
    await supabase.from('trackino_kb_pages').update({ is_restricted: newVal }).eq('id', selectedPage.id);
    setSelectedPage(prev => prev ? { ...prev, is_restricted: newVal } : prev);
    setPages(prev => prev.map(p => p.id === selectedPage.id ? { ...p, is_restricted: newVal } : p));
  };

  // ── Folders ───────────────────────────────────────────────────────────────

  const saveFolder = async () => {
    if (!folderModal || !folderModal.name.trim() || !user || !currentWorkspace) return;
    if (folderModal.mode === 'add') {
      const { data: f } = await supabase.from('trackino_kb_folders').insert({
        workspace_id: currentWorkspace.id, parent_id: folderModal.parentId,
        name: folderModal.name.trim(), owner_id: user.id,
      }).select().single();
      if (f) {
        setFolders(prev => [...prev, f as KbFolder].sort((a, b) => a.name.localeCompare(b.name)));
        setExpanded(prev => new Set([...prev, (f as KbFolder).id]));
      }
    } else if (folderModal.target) {
      await supabase.from('trackino_kb_folders').update({ name: folderModal.name.trim(), updated_at: new Date().toISOString() }).eq('id', folderModal.target.id);
      setFolders(prev => prev.map(f => f.id === folderModal.target!.id ? { ...f, name: folderModal.name.trim() } : f));
    }
    setFolderModal(null);
  };

  const deleteFolder = async (folder: KbFolder) => {
    if (!confirm(`Smazat složku "${folder.name}" a přesunout stránky do kořenové úrovně?`)) return;
    await supabase.from('trackino_kb_folders').delete().eq('id', folder.id);
    await fetchAll();
  };

  const openShare = (folder: KbFolder) => {
    const existing = folderShares.filter(s => s.folder_id === folder.id);
    const wsShare = existing.find(s => s.user_id === null);
    if (wsShare) { setShareType('workspace'); setShareUserIds([]); }
    else if (existing.length > 0) { setShareType('users'); setShareUserIds(existing.map(s => s.user_id!)); }
    else { setShareType('none'); setShareUserIds([]); }
    setShareModal({ open: true, folder });
  };

  const saveShare = async () => {
    if (!currentWorkspace || !shareModal.folder || !user) return;
    const fid = shareModal.folder.id;
    await supabase.from('trackino_kb_folder_shares').delete().eq('folder_id', fid);
    if (shareType === 'workspace') {
      await supabase.from('trackino_kb_folder_shares').insert({ folder_id: fid, workspace_id: currentWorkspace.id, user_id: null, shared_by: user.id });
    } else if (shareType === 'users' && shareUserIds.length > 0) {
      await supabase.from('trackino_kb_folder_shares').insert(shareUserIds.map(uid => ({ folder_id: fid, workspace_id: currentWorkspace.id, user_id: uid, shared_by: user.id })));
    }
    const isNowShared = shareType !== 'none';
    await supabase.from('trackino_kb_folders').update({ is_shared: isNowShared }).eq('id', fid);
    setFolders(prev => prev.map(f => f.id === fid ? { ...f, is_shared: isNowShared } : f));
    await fetchAll();
    setShareModal({ open: false, folder: null });
  };

  // ── Copy page content ─────────────────────────────────────────────────────

  const copyPageContent = () => {
    if (!selectedPage?.content) return;
    const div = document.createElement('div');
    div.innerHTML = selectedPage.content;
    const text = div.textContent ?? div.innerText ?? '';
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedPage(true);
    setTimeout(() => setCopiedPage(false), 2000);
  };

  // ── Filtered pages (search + listFilter) ──────────────────────────────────

  const filteredPages = (() => {
    const q = search.trim().toLowerCase();
    if (q) {
      return pages.filter(pg =>
        pg.title.toLowerCase().includes(q) ||
        pg.content.toLowerCase().includes(q)
      );
    }
    if (!listFilter) return pages;
    switch (listFilter.type) {
      case 'all': return pages;
      case 'favorites': return pages.filter(p => favorites.has(p.id));
      case 'recent': return [...pages].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 30);
      case 'unfiled': return pages.filter(p => !p.folder_id);
      case 'status': return pages.filter(p => p.status === listFilter.value);
      case 'mention': return pages.filter(p => p.content.includes(`data-user-id="${listFilter.userId}"`));
      case 'folder': return pages.filter(p => p.folder_id === listFilter.folderId);
      default: return pages;
    }
  })();

  const filterLabel = (() => {
    const q = search.trim();
    if (q) return `Hledání: „${q}"`;
    if (!listFilter) return '';
    switch (listFilter.type) {
      case 'all': return 'Všechny stránky';
      case 'favorites': return 'Oblíbené stránky';
      case 'recent': return 'Naposledy upravené';
      case 'unfiled': return 'Nezařazené stránky';
      case 'status': return STATUS_CONFIG[listFilter.value].label;
      case 'mention': return `Zmínky: ${members.find(m => m.user_id === listFilter.userId)?.display_name ?? ''}`;
      case 'folder': return folders.find(f => f.id === listFilter.folderId)?.name ?? 'Složka';
    }
  })();

  const filterIcon = (() => {
    const q = search.trim();
    if (q) return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
    if (!listFilter) return null;
    switch (listFilter.type) {
      case 'all': return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)' }}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg>;
      case 'favorites': return <svg width="18" height="18" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
      case 'recent': return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)' }}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
      case 'unfiled': return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)' }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
      case 'status': return <div className="w-3 h-3 rounded-full" style={{ background: STATUS_CONFIG[listFilter.value].color }} />;
      case 'mention': return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)' }}><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/></svg>;
      case 'folder': return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--primary)' }}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>;
      default: return null;
    }
  })();

  const showList = !!(search.trim() || listFilter !== null) && !selectedPage;
  const showWelcome = !search.trim() && listFilter === null && !selectedPage;

  // ── Render ────────────────────────────────────────────────────────────────

  if (wsLoading) return (
    <DashboardLayout>
      <div className="flex items-center justify-center h-40">
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <div className="flex h-full gap-0 -m-4 lg:-m-6" style={{ minHeight: 'calc(100vh - var(--topbar-height))' }}>

        {/* Mobile overlay */}
        {leftOpen && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setLeftOpen(false)} />}

        {/* LEFT PANEL */}
        <KbSidebar
          leftOpen={leftOpen}
          setLeftOpen={setLeftOpen}
          folders={folders}
          pages={pages}
          members={members}
          favorites={favorites}
          search={search}
          setSearch={(v) => {
            setSearch(v);
            if (v.trim()) { setListFilter(null); setSelectedPage(null); }
          }}
          listFilter={listFilter}
          setListFilter={setListFilter}
          setSelectedPage={() => setSelectedPage(null)}
          statusSectionExpanded={statusSectionExpanded}
          setStatusSectionExpanded={(v) => setStatusSectionExpanded(v)}
          mentionSectionExpanded={mentionSectionExpanded}
          setMentionSectionExpanded={(v) => setMentionSectionExpanded(v)}
          expanded={expanded}
          setExpanded={setExpanded}
          onAddFolder={() => setFolderModal({ mode: 'add', parentId: null, depth: 0, target: null, name: '' })}
          onAddSub={(pid, d) => setFolderModal({ mode: 'add', parentId: pid, depth: d, target: null, name: '' })}
          onEditFolder={f => setFolderModal({ mode: 'edit', parentId: f.parent_id, depth: getDepth(f, folders), target: f, name: f.name })}
          onDeleteFolder={deleteFolder}
          onShareFolder={openShare}
          userId={user?.id ?? ''}
          onNewPage={() => { openNewPage(); setLeftOpen(false); }}
        />

        {/* MAIN CONTENT */}
        {/* Mobile toggle */}
        <button type="button" onClick={() => setLeftOpen(true)}
          className="lg:hidden fixed bottom-6 left-4 z-20 w-10 h-10 flex items-center justify-center rounded-full shadow-lg"
          style={{ background: 'var(--primary)', color: '#fff' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        </button>

        <div className="flex-1 flex flex-col overflow-hidden">
          {showWelcome && (
            <KbWelcomeScreen
              pages={pages}
              folders={folders}
              onSelectPage={selectPage}
              onNewPage={openNewPage}
            />
          )}

          {showList && (
            <PageListView
              pages={filteredPages}
              folders={folders}
              members={members}
              favorites={favorites}
              allReviews={allReviews}
              filterLabel={filterLabel ?? ''}
              filterIcon={filterIcon}
              onSelectPage={selectPage}
              onNewPage={openNewPage}
            />
          )}

          {selectedPage && (
            <KbPageDetail
              selectedPage={selectedPage}
              editing={editing}
              editTitle={editTitle}
              setEditTitle={setEditTitle}
              editContent={editContent}
              setEditContent={setEditContent}
              editStatus={editStatus}
              setEditStatus={setEditStatus}
              editFolderId={editFolderId}
              setEditFolderId={setEditFolderId}
              editRestricted={editRestricted}
              setEditRestricted={setEditRestricted}
              saving={saving}
              copiedPage={copiedPage}
              copiedPublicUrl={copiedPublicUrl}
              publishingPage={publishingPage}
              listFilter={listFilter}
              search={search}
              backToList={backToList}
              startEdit={startEdit}
              savePage={savePage}
              cancelEdit={cancelEdit}
              deletePage={deletePage}
              copyPageContent={copyPageContent}
              togglePublish={togglePublish}
              toggleFavorite={toggleFavorite}
              copyPublicUrl={copyPublicUrl}
              getPublicUrl={getPublicUrl}
              handleChecklistToggle={handleChecklistToggle}
              canEditPage={canEditPage}
              canAdmin={canAdmin}
              folders={folders}
              members={members}
              favorites={favorites}
              pages={pages}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              comments={comments}
              versions={versions}
              reviews={reviews}
              access={access}
              newComment={newComment}
              setNewComment={setNewComment}
              addComment={addComment}
              savingComment={savingComment}
              editingComment={editingComment}
              setEditingComment={setEditingComment}
              updateComment={updateComment}
              deleteComment={deleteComment}
              revertToVersion={revertToVersion}
              toggleReviewDone={toggleReviewDone}
              deleteReview={deleteReview}
              openReviewModal={() => setReviewModal(true)}
              toggleUserAccess={toggleUserAccess}
              setSelectedPage={setSelectedPage}
              setPages={setPages}
              userId={user?.id}
              userDisplayName={members.find(m => m.user_id === user?.id)?.display_name}
              onRestrictedToggle={onRestrictedToggle}
              onSelectPage={selectPage}
            />
          )}
        </div>
      </div>

      {/* MODALS */}
      <KbModals
        folderModal={folderModal}
        setFolderModal={setFolderModal}
        saveFolder={saveFolder}
        shareModal={shareModal}
        setShareModal={setShareModal}
        shareType={shareType}
        setShareType={setShareType}
        shareUserIds={shareUserIds}
        setShareUserIds={setShareUserIds}
        saveShare={saveShare}
        templateModal={templateModal}
        setTemplateModal={setTemplateModal}
        createPageFromTemplate={createPageFromTemplate}
        reviewModal={reviewModal}
        setReviewModal={setReviewModal}
        reviewForm={reviewForm}
        setReviewForm={setReviewForm}
        addReview={addReview}
        savingReview={savingReview}
        members={members}
        userId={user?.id}
      />
    </DashboardLayout>
  );
}

export default function KnowledgeBasePage() {
  return (
    <WorkspaceProvider>
      <KnowledgeBaseContent />
    </WorkspaceProvider>
  );
}
