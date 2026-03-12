'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/lib/supabase';
import { stripHtml } from './utils';
import type {
  PromptFolder, FolderShare, Prompt, PromptComment, Member, PromptFilter,
} from './types';

export function usePrompts() {
  const { user } = useAuth();
  const { currentWorkspace, hasModule } = useWorkspace();
  const router = useRouter();

  const [folders, setFolders] = useState<PromptFolder[]>([]);
  const [folderShares, setFolderShares] = useState<FolderShare[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [comments, setComments] = useState<PromptComment[]>([]);
  const [likes, setLikes] = useState<Record<string, string[]>>({});
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [members, setMembers] = useState<Member[]>([]);

  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [listFilter, setListFilter] = useState<PromptFilter>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showFolderPanel, setShowFolderPanel] = useState(false);
  const [authorSectionExpanded, setAuthorSectionExpanded] = useState(false);

  const [sortBy, setSortBy] = useState<'date' | 'likes' | 'title'>('date');
  const [searchQ, setSearchQ] = useState('');

  const [editingComment, setEditingComment] = useState<{ id: string; content: string } | null>(null);

  // Modals
  const [folderModal, setFolderModal] = useState<{ open: boolean; parentId: string | null; editing: PromptFolder | null }>({ open: false, parentId: null, editing: null });
  const [folderName, setFolderName] = useState('');
  const [shareModal, setShareModal] = useState<{ open: boolean; folder: PromptFolder | null }>({ open: false, folder: null });
  const [shareType, setShareType] = useState<'none' | 'workspace' | 'users'>('none');
  const [shareUserIds, setShareUserIds] = useState<string[]>([]);

  const [promptModal, setPromptModal] = useState<{ open: boolean; editing: Prompt | null }>({ open: false, editing: null });
  const [pmTitle, setPmTitle] = useState('');
  const [pmContent, setPmContent] = useState('');
  const [pmIsShared, setPmIsShared] = useState(false);
  const [pmFolderId, setPmFolderId] = useState<string | null>(null);
  const [pmSaving, setPmSaving] = useState(false);

  const [newComment, setNewComment] = useState('');
  const [addingComment, setAddingComment] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const wsId = currentWorkspace?.id;
  const userId = user?.id ?? '';

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!wsId) return;
    const [fRes, fsRes, pRes, cRes, lRes, favRes, mRes] = await Promise.all([
      supabase.from('trackino_prompt_folders').select('*').eq('workspace_id', wsId).order('name'),
      supabase.from('trackino_prompt_folder_shares').select('*'),
      supabase.from('trackino_prompts').select('*').eq('workspace_id', wsId).order('created_at', { ascending: false }),
      supabase.from('trackino_prompt_comments').select('*').order('created_at'),
      supabase.from('trackino_prompt_likes').select('*'),
      supabase.from('trackino_prompt_favorites').select('*').eq('user_id', userId),
      supabase.from('trackino_workspace_members').select('user_id').eq('workspace_id', wsId),
    ]);
    setFolders(fRes.data ?? []);
    setFolderShares(fsRes.data ?? []);

    // Filter prompts: show own + shared (folder shared or prompt.is_shared)
    const allPrompts: Prompt[] = pRes.data ?? [];
    const sharedFolderIds = new Set(
      (fsRes.data ?? [])
        .filter(s => s.user_id === null || s.user_id === userId)
        .map(s => s.folder_id)
    );
    const visible = allPrompts.filter(p =>
      p.created_by === userId ||
      p.is_shared ||
      (p.folder_id && sharedFolderIds.has(p.folder_id))
    );
    setPrompts(visible);
    setComments(cRes.data ?? []);

    const likesMap: Record<string, string[]> = {};
    for (const l of (lRes.data ?? [])) {
      if (!likesMap[l.prompt_id]) likesMap[l.prompt_id] = [];
      likesMap[l.prompt_id].push(l.user_id);
    }
    setLikes(likesMap);
    setFavorites(new Set((favRes.data ?? []).map((f: { prompt_id: string }) => f.prompt_id)));

    // Fetch profilů pro workspace members (spolehlivý dvou-krokový přístup)
    const memberUserIds: string[] = (mRes.data ?? []).map((m: { user_id: string }) => m.user_id);
    let memberProfiles: { id: string; display_name: string | null; email: string | null; avatar_color: string | null }[] = [];
    if (memberUserIds.length > 0) {
      const { data: profData } = await supabase
        .from('trackino_profiles')
        .select('id, display_name, email, avatar_color')
        .in('id', memberUserIds);
      memberProfiles = profData ?? [];
    }
    const ms: Member[] = memberUserIds.map((uid: string) => {
      const prof = memberProfiles.find(p => p.id === uid);
      return {
        user_id: uid,
        display_name: prof?.display_name ?? uid,
        email: prof?.email ?? '',
        avatar_color: prof?.avatar_color ?? 'var(--primary)',
      };
    });
    // Fetch profiles for prompt creators not in workspace members (e.g., master admin)
    const memberIds = new Set(ms.map(m => m.user_id));
    const creatorIds = [...new Set((pRes.data ?? []).map((p: { created_by: string }) => p.created_by))].filter(id => !memberIds.has(id));
    if (creatorIds.length > 0) {
      const { data: extraProfiles } = await supabase
        .from('trackino_profiles')
        .select('id, display_name, email, avatar_color')
        .in('id', creatorIds);
      for (const ep of (extraProfiles ?? [])) {
        ms.push({
          user_id: ep.id,
          display_name: (ep as { id: string; display_name: string; email: string; avatar_color: string }).display_name ?? ep.id,
          email: (ep as { id: string; display_name: string; email: string; avatar_color: string }).email ?? '',
          avatar_color: (ep as { id: string; display_name: string; email: string; avatar_color: string }).avatar_color ?? 'var(--primary)',
        });
      }
    }
    setMembers(ms);
  }, [wsId, userId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Module guard ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (currentWorkspace && !hasModule('prompts')) router.push('/');
  }, [currentWorkspace, hasModule, router]);

  // ── Folder CRUD ───────────────────────────────────────────────────────────
  const openFolderModal = (parentId: string | null = null, editing: PromptFolder | null = null) => {
    setFolderModal({ open: true, parentId, editing });
    setFolderName(editing?.name ?? '');
  };

  const saveFolder = async () => {
    if (!folderName.trim() || !wsId) return;
    if (folderModal.editing) {
      await supabase.from('trackino_prompt_folders').update({ name: folderName.trim() }).eq('id', folderModal.editing.id);
    } else {
      await supabase.from('trackino_prompt_folders').insert({
        workspace_id: wsId, parent_id: folderModal.parentId,
        name: folderName.trim(), owner_id: userId, is_shared: false,
      });
    }
    setFolderModal({ open: false, parentId: null, editing: null });
    fetchAll();
  };

  const deleteFolder = async (folder: PromptFolder) => {
    if (!confirm(`Smazat složku „${folder.name}"? Prompty v ní zůstanou bez složky.`)) return;
    await supabase.from('trackino_prompt_folders').delete().eq('id', folder.id);
    if (selectedFolder === folder.id) setSelectedFolder(null);
    fetchAll();
  };

  // ── Sharing ───────────────────────────────────────────────────────────────
  const openShare = (folder: PromptFolder) => {
    const existing = folderShares.filter(s => s.folder_id === folder.id);
    const hasWorkspace = existing.some(s => s.user_id === null);
    const hasUsers = existing.some(s => s.user_id !== null);
    setShareType(hasWorkspace ? 'workspace' : hasUsers ? 'users' : 'none');
    setShareUserIds(existing.filter(s => s.user_id !== null).map(s => s.user_id as string));
    setShareModal({ open: true, folder });
  };

  const saveShare = async () => {
    const folder = shareModal.folder!;
    await supabase.from('trackino_prompt_folder_shares').delete().eq('folder_id', folder.id);
    if (shareType === 'workspace') {
      await supabase.from('trackino_prompt_folder_shares').insert({ folder_id: folder.id, user_id: null });
      await supabase.from('trackino_prompt_folders').update({ is_shared: true }).eq('id', folder.id);
    } else if (shareUserIds.length > 0) {
      await supabase.from('trackino_prompt_folder_shares').insert(shareUserIds.map(uid => ({ folder_id: folder.id, user_id: uid })));
      await supabase.from('trackino_prompt_folders').update({ is_shared: true }).eq('id', folder.id);
    } else {
      await supabase.from('trackino_prompt_folders').update({ is_shared: false }).eq('id', folder.id);
    }
    setShareModal({ open: false, folder: null });
    fetchAll();
  };

  // ── Prompt CRUD ───────────────────────────────────────────────────────────
  const openPromptModal = (editing: Prompt | null = null) => {
    setPmTitle(editing?.title ?? '');
    setPmContent(editing?.content ?? '');
    setPmIsShared(editing?.is_shared ?? false);
    setPmFolderId(editing?.folder_id ?? selectedFolder);
    setPromptModal({ open: true, editing });
  };

  const savePrompt = async () => {
    if (!pmTitle.trim() || !wsId) return;
    setPmSaving(true);
    if (promptModal.editing) {
      await supabase.from('trackino_prompts').update({
        title: pmTitle.trim(), content: pmContent, is_shared: pmIsShared,
        folder_id: pmFolderId, updated_at: new Date().toISOString(),
      }).eq('id', promptModal.editing.id);
    } else {
      await supabase.from('trackino_prompts').insert({
        workspace_id: wsId, folder_id: pmFolderId, title: pmTitle.trim(),
        content: pmContent, is_shared: pmIsShared, created_by: userId,
      });
    }
    setPmSaving(false);
    setPromptModal({ open: false, editing: null });
    fetchAll();
  };

  const deletePrompt = async (p: Prompt) => {
    if (!confirm(`Smazat prompt „${p.title}"?`)) return;
    await supabase.from('trackino_prompts').delete().eq('id', p.id);
    fetchAll();
  };

  // ── Likes & Favorites ─────────────────────────────────────────────────────
  const toggleLike = async (promptId: string) => {
    const myLikes = likes[promptId] ?? [];
    if (myLikes.includes(userId)) {
      await supabase.from('trackino_prompt_likes').delete().eq('prompt_id', promptId).eq('user_id', userId);
    } else {
      await supabase.from('trackino_prompt_likes').insert({ prompt_id: promptId, user_id: userId });
    }
    fetchAll();
  };

  const toggleFavorite = async (promptId: string) => {
    if (favorites.has(promptId)) {
      await supabase.from('trackino_prompt_favorites').delete().eq('prompt_id', promptId).eq('user_id', userId);
    } else {
      await supabase.from('trackino_prompt_favorites').insert({ prompt_id: promptId, user_id: userId });
    }
    fetchAll();
  };

  const addComment = async (promptId: string) => {
    if (!newComment.trim()) return;
    setAddingComment(true);
    await supabase.from('trackino_prompt_comments').insert({ prompt_id: promptId, user_id: userId, content: newComment.trim() });
    setNewComment('');
    setAddingComment(false);
    fetchAll();
  };

  const deleteComment = async (commentId: string) => {
    await supabase.from('trackino_prompt_comments').delete().eq('id', commentId);
    setComments(prev => prev.filter(c => c.id !== commentId));
  };

  const updateComment = async () => {
    if (!editingComment) return;
    await supabase.from('trackino_prompt_comments').update({ content: editingComment.content }).eq('id', editingComment.id);
    setComments(prev => prev.map(c => c.id === editingComment.id ? { ...c, content: editingComment.content } : c));
    setEditingComment(null);
  };

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key); setTimeout(() => setCopied(null), 1500);
  };

  // ── Filtered prompts ──────────────────────────────────────────────────────
  const qLow = searchQ.trim().toLowerCase();
  const filtered = (() => {
    if (listFilter?.type === 'recent') {
      return [...prompts]
        .filter(p => !qLow || p.title.toLowerCase().includes(qLow) || stripHtml(p.content).toLowerCase().includes(qLow))
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 10);
    }
    return prompts
      .filter(p => {
        if (listFilter?.type === 'favorites') return favorites.has(p.id);
        if (listFilter?.type === 'shared') return p.is_shared;
        if (listFilter?.type === 'unfiled') return !p.folder_id;
        if (listFilter?.type === 'author') return p.created_by === listFilter.userId;
        if (selectedFolder) return p.folder_id === selectedFolder;
        return true;
      })
      .filter(p => !qLow || p.title.toLowerCase().includes(qLow) || stripHtml(p.content).toLowerCase().includes(qLow))
      .sort((a, b) => {
        if (sortBy === 'likes') return (likes[b.id]?.length ?? 0) - (likes[a.id]?.length ?? 0);
        if (sortBy === 'title') return a.title.localeCompare(b.title, 'cs');
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  })();

  const getMember = (uid: string) => members.find(m => m.user_id === uid);

  const toggle = (id: string) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  return {
    // State
    folders, folderShares, prompts, comments, likes, favorites, members,
    selectedFolder, setSelectedFolder,
    listFilter, setListFilter,
    expanded, toggle,
    showFolderPanel, setShowFolderPanel,
    authorSectionExpanded, setAuthorSectionExpanded,
    sortBy, setSortBy,
    searchQ, setSearchQ,
    editingComment, setEditingComment,
    // Folder modal
    folderModal, setFolderModal,
    folderName, setFolderName,
    // Share modal
    shareModal, setShareModal,
    shareType, setShareType,
    shareUserIds, setShareUserIds,
    // Prompt modal
    promptModal, setPromptModal,
    pmTitle, setPmTitle,
    pmContent, setPmContent,
    pmIsShared, setPmIsShared,
    pmFolderId, setPmFolderId,
    pmSaving,
    // Comment state
    newComment, setNewComment,
    addingComment,
    copied,
    // Computed
    userId, wsId, filtered,
    // Functions
    fetchAll,
    openFolderModal, saveFolder, deleteFolder,
    openShare, saveShare,
    openPromptModal, savePrompt, deletePrompt,
    toggleLike, toggleFavorite,
    addComment, deleteComment, updateComment,
    copyText, getMember,
    // Workspace
    currentWorkspace,
  };
}
