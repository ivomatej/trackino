'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/lib/supabase';
import type { BookmarkFolder, FolderShare, Bookmark, BookmarkComment, Member, BookmarkFilter } from './types';

export function useBookmarks() {
  const { user } = useAuth();
  const { currentWorkspace, hasModule } = useWorkspace();

  const [folders, setFolders] = useState<BookmarkFolder[]>([]);
  const [folderShares, setFolderShares] = useState<FolderShare[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [comments, setComments] = useState<BookmarkComment[]>([]);
  const [likes, setLikes] = useState<Record<string, string[]>>({});
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [members, setMembers] = useState<Member[]>([]);

  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [listFilter, setListFilter] = useState<BookmarkFilter>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showFolderPanel, setShowFolderPanel] = useState(false);
  const [authorSectionExpanded, setAuthorSectionExpanded] = useState(false);

  const [sortBy, setSortBy] = useState<'date' | 'likes' | 'title'>('date');
  const [searchQ, setSearchQ] = useState('');

  const [folderModal, setFolderModal] = useState<{ open: boolean; parentId: string | null; editing: BookmarkFolder | null }>({ open: false, parentId: null, editing: null });
  const [folderName, setFolderName] = useState('');
  const [shareModal, setShareModal] = useState<{ open: boolean; folder: BookmarkFolder | null }>({ open: false, folder: null });
  const [shareType, setShareType] = useState<'none' | 'workspace' | 'users'>('none');
  const [shareUserIds, setShareUserIds] = useState<string[]>([]);

  const [bmModal, setBmModal] = useState<{ open: boolean; editing: Bookmark | null }>({ open: false, editing: null });
  const [bmTitle, setBmTitle] = useState('');
  const [bmUrl, setBmUrl] = useState('');
  const [bmDesc, setBmDesc] = useState('');
  const [bmIsShared, setBmIsShared] = useState(false);
  const [bmFolderId, setBmFolderId] = useState<string | null>(null);
  const [bmSaving, setBmSaving] = useState(false);

  const [openComments, setOpenComments] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [addingComment, setAddingComment] = useState(false);
  const [editingComment, setEditingComment] = useState<{ id: string; content: string } | null>(null);

  const wsId = currentWorkspace?.id;
  const userId = user?.id ?? '';

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!wsId) return;
    const [fRes, fsRes, bRes, cRes, lRes, favRes, mRes] = await Promise.all([
      supabase.from('trackino_bookmark_folders').select('*').eq('workspace_id', wsId).order('name'),
      supabase.from('trackino_bookmark_folder_shares').select('*'),
      supabase.from('trackino_bookmarks').select('*').eq('workspace_id', wsId).order('created_at', { ascending: false }),
      supabase.from('trackino_bookmark_comments').select('*').order('created_at'),
      supabase.from('trackino_bookmark_likes').select('*'),
      supabase.from('trackino_bookmark_favorites').select('*').eq('user_id', userId),
      supabase.from('trackino_workspace_members').select('user_id').eq('workspace_id', wsId),
    ]);
    setFolders(fRes.data ?? []);
    setFolderShares(fsRes.data ?? []);

    const allBm: Bookmark[] = bRes.data ?? [];
    const sharedFolderIds = new Set(
      (fsRes.data ?? []).filter(s => s.user_id === null || s.user_id === userId).map(s => s.folder_id)
    );
    const visible = allBm.filter(b =>
      b.created_by === userId || b.is_shared || (b.folder_id && sharedFolderIds.has(b.folder_id))
    );
    setBookmarks(visible);
    setComments(cRes.data ?? []);

    const likesMap: Record<string, string[]> = {};
    for (const l of (lRes.data ?? [])) {
      if (!likesMap[l.bookmark_id]) likesMap[l.bookmark_id] = [];
      likesMap[l.bookmark_id].push(l.user_id);
    }
    setLikes(likesMap);
    setFavorites(new Set((favRes.data ?? []).map((f: { bookmark_id: string }) => f.bookmark_id)));

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

    const memberIds = new Set(ms.map((m: Member) => m.user_id));
    const allBookmarks: { created_by: string }[] = bRes.data ?? [];
    const creatorIds = [...new Set(allBookmarks.map(b => b.created_by))].filter(id => !memberIds.has(id));
    if (creatorIds.length > 0) {
      const { data: extraProfiles } = await supabase
        .from('trackino_profiles')
        .select('id, display_name, email, avatar_color')
        .in('id', creatorIds);
      for (const ep of (extraProfiles ?? [])) {
        ms.push({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          user_id: (ep as any).id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          display_name: (ep as any).display_name ?? (ep as any).id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          email: (ep as any).email ?? '',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          avatar_color: (ep as any).avatar_color ?? 'var(--primary)',
        });
      }
    }

    setMembers(ms);
  }, [wsId, userId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Folder CRUD ───────────────────────────────────────────────────────────
  const openFolderModal = (parentId: string | null = null, editing: BookmarkFolder | null = null) => {
    setFolderModal({ open: true, parentId, editing });
    setFolderName(editing?.name ?? '');
  };

  const saveFolder = async () => {
    if (!folderName.trim() || !wsId) return;
    if (folderModal.editing) {
      await supabase.from('trackino_bookmark_folders').update({ name: folderName.trim() }).eq('id', folderModal.editing.id);
    } else {
      await supabase.from('trackino_bookmark_folders').insert({
        workspace_id: wsId, parent_id: folderModal.parentId,
        name: folderName.trim(), owner_id: userId, is_shared: false,
      });
    }
    setFolderModal({ open: false, parentId: null, editing: null });
    fetchAll();
  };

  const deleteFolder = async (folder: BookmarkFolder) => {
    if (!confirm(`Smazat složku „${folder.name}"? Záložky v ní zůstanou bez složky.`)) return;
    await supabase.from('trackino_bookmark_folders').delete().eq('id', folder.id);
    if (selectedFolder === folder.id) setSelectedFolder(null);
    fetchAll();
  };

  // ── Sharing ───────────────────────────────────────────────────────────────
  const openShare = (folder: BookmarkFolder) => {
    const existing = folderShares.filter(s => s.folder_id === folder.id);
    const hasWorkspace = existing.some(s => s.user_id === null);
    const hasUsers = existing.some(s => s.user_id !== null);
    setShareType(hasWorkspace ? 'workspace' : hasUsers ? 'users' : 'none');
    setShareUserIds(existing.filter(s => s.user_id !== null).map(s => s.user_id as string));
    setShareModal({ open: true, folder });
  };

  const saveShare = async () => {
    const folder = shareModal.folder!;
    await supabase.from('trackino_bookmark_folder_shares').delete().eq('folder_id', folder.id);
    if (shareType === 'workspace') {
      await supabase.from('trackino_bookmark_folder_shares').insert({ folder_id: folder.id, user_id: null });
      await supabase.from('trackino_bookmark_folders').update({ is_shared: true }).eq('id', folder.id);
    } else if (shareUserIds.length > 0) {
      await supabase.from('trackino_bookmark_folder_shares').insert(shareUserIds.map(uid => ({ folder_id: folder.id, user_id: uid })));
      await supabase.from('trackino_bookmark_folders').update({ is_shared: true }).eq('id', folder.id);
    } else {
      await supabase.from('trackino_bookmark_folders').update({ is_shared: false }).eq('id', folder.id);
    }
    setShareModal({ open: false, folder: null });
    fetchAll();
  };

  // ── Bookmark CRUD ─────────────────────────────────────────────────────────
  const openBmModal = (editing: Bookmark | null = null) => {
    setBmTitle(editing?.title ?? '');
    setBmUrl(editing?.url ?? '');
    setBmDesc(editing?.description ?? '');
    setBmIsShared(editing?.is_shared ?? false);
    setBmFolderId(editing?.folder_id ?? selectedFolder);
    setBmModal({ open: true, editing });
  };

  const saveBm = async () => {
    if (!bmTitle.trim() || !bmUrl.trim() || !wsId) return;
    let url = bmUrl.trim();
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    setBmSaving(true);
    if (bmModal.editing) {
      await supabase.from('trackino_bookmarks').update({
        title: bmTitle.trim(), url, description: bmDesc, is_shared: bmIsShared,
        folder_id: bmFolderId, updated_at: new Date().toISOString(),
      }).eq('id', bmModal.editing.id);
    } else {
      await supabase.from('trackino_bookmarks').insert({
        workspace_id: wsId, folder_id: bmFolderId, title: bmTitle.trim(),
        url, description: bmDesc, is_shared: bmIsShared, created_by: userId,
      });
    }
    setBmSaving(false);
    setBmModal({ open: false, editing: null });
    fetchAll();
  };

  const deleteBm = async (b: Bookmark) => {
    if (!confirm(`Smazat záložku „${b.title}"?`)) return;
    await supabase.from('trackino_bookmarks').delete().eq('id', b.id);
    fetchAll();
  };

  // ── Likes & Favorites ─────────────────────────────────────────────────────
  const toggleLike = async (bId: string) => {
    const myLikes = likes[bId] ?? [];
    if (myLikes.includes(userId)) {
      await supabase.from('trackino_bookmark_likes').delete().eq('bookmark_id', bId).eq('user_id', userId);
    } else {
      await supabase.from('trackino_bookmark_likes').insert({ bookmark_id: bId, user_id: userId });
    }
    fetchAll();
  };

  const toggleFavorite = async (bId: string) => {
    if (favorites.has(bId)) {
      await supabase.from('trackino_bookmark_favorites').delete().eq('bookmark_id', bId).eq('user_id', userId);
    } else {
      await supabase.from('trackino_bookmark_favorites').insert({ bookmark_id: bId, user_id: userId });
    }
    fetchAll();
  };

  // ── Comments ──────────────────────────────────────────────────────────────
  const addComment = async (bId: string) => {
    if (!newComment.trim()) return;
    setAddingComment(true);
    await supabase.from('trackino_bookmark_comments').insert({ bookmark_id: bId, user_id: userId, content: newComment.trim() });
    setNewComment('');
    setAddingComment(false);
    fetchAll();
  };

  const deleteComment = async (commentId: string) => {
    await supabase.from('trackino_bookmark_comments').delete().eq('id', commentId);
    fetchAll();
  };

  const updateComment = async () => {
    if (!editingComment || !editingComment.content.trim()) return;
    await supabase.from('trackino_bookmark_comments').update({ content: editingComment.content.trim() }).eq('id', editingComment.id);
    setEditingComment(null);
    fetchAll();
  };

  // ── Computed ──────────────────────────────────────────────────────────────
  const qLow = searchQ.trim().toLowerCase();
  const filtered = (() => {
    if (listFilter?.type === 'recent') {
      return [...bookmarks]
        .filter(b => !qLow || b.title.toLowerCase().includes(qLow) || b.url.toLowerCase().includes(qLow) || b.description.toLowerCase().includes(qLow))
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 10);
    }
    return bookmarks
      .filter(b => {
        if (listFilter?.type === 'favorites') return favorites.has(b.id);
        if (listFilter?.type === 'shared') return b.is_shared;
        if (listFilter?.type === 'unfiled') return !b.folder_id;
        if (listFilter?.type === 'author') return b.created_by === listFilter.userId;
        if (selectedFolder) return b.folder_id === selectedFolder;
        return true;
      })
      .filter(b => !qLow || b.title.toLowerCase().includes(qLow) || b.url.toLowerCase().includes(qLow) || b.description.toLowerCase().includes(qLow))
      .sort((a, b) => {
        if (sortBy === 'likes') return (likes[b.id]?.length ?? 0) - (likes[a.id]?.length ?? 0);
        if (sortBy === 'title') return a.title.localeCompare(b.title, 'cs');
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  })();

  const getMember = (uid: string) => members.find(m => m.user_id === uid);
  const toggle = (id: string) => setExpanded(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });

  return {
    // Data
    folders, folderShares, bookmarks, comments, likes, favorites, members,
    // UI state
    selectedFolder, setSelectedFolder,
    listFilter, setListFilter,
    expanded, toggle,
    showFolderPanel, setShowFolderPanel,
    authorSectionExpanded, setAuthorSectionExpanded,
    sortBy, setSortBy,
    searchQ, setSearchQ,
    // Folder modal
    folderModal, setFolderModal, folderName, setFolderName,
    // Share modal
    shareModal, setShareModal, shareType, setShareType, shareUserIds, setShareUserIds,
    // Bookmark modal
    bmModal, setBmModal,
    bmTitle, setBmTitle,
    bmUrl, setBmUrl,
    bmDesc, setBmDesc,
    bmIsShared, setBmIsShared,
    bmFolderId, setBmFolderId,
    bmSaving,
    // Comments
    openComments, setOpenComments,
    newComment, setNewComment,
    addingComment,
    editingComment, setEditingComment,
    // Handlers
    openFolderModal, saveFolder, deleteFolder,
    openShare, saveShare,
    openBmModal, saveBm, deleteBm,
    toggleLike, toggleFavorite,
    addComment, deleteComment, updateComment,
    // Computed
    filtered, getMember,
    // Context
    currentWorkspace, hasModule, userId,
  };
}
