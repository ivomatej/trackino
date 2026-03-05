'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { WorkspaceProvider, useWorkspace } from '@/contexts/WorkspaceContext';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase';

interface BookmarkFolder {
  id: string; workspace_id: string; parent_id: string | null;
  name: string; owner_id: string; is_shared: boolean; created_at: string;
}
interface FolderShare { id: string; folder_id: string; user_id: string | null; }
interface Bookmark {
  id: string; workspace_id: string; folder_id: string | null;
  title: string; url: string; description: string; is_shared: boolean;
  created_by: string; created_at: string; updated_at: string;
}
interface BookmarkComment { id: string; bookmark_id: string; user_id: string; content: string; created_at: string; }
// Fix #1: add avatar_color to Member interface
interface Member { user_id: string; display_name: string; email: string; avatar_color: string; }

const MAX_DEPTH = 5;

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function getDomain(url: string) {
  try { return new URL(url).origin; } catch { return url; }
}

function getFaviconUrl(url: string) {
  try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`; } catch { return ''; }
}

// ─── Folder Tree ────────────────────────────────────────────────────────────
function FolderTree({
  folders, selectedId, expanded, onSelect, onToggle, onAddSub, onEdit, onDelete, onShare, userId, depth = 0, parentId = null,
}: {
  folders: BookmarkFolder[]; selectedId: string | null; expanded: Set<string>;
  onSelect: (id: string | null) => void; onToggle: (id: string) => void;
  onAddSub: (parentId: string, depth: number) => void;
  onEdit: (f: BookmarkFolder) => void; onDelete: (f: BookmarkFolder) => void;
  onShare: (f: BookmarkFolder) => void; userId: string; depth?: number; parentId?: string | null;
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
        const isOwner = folder.owner_id === userId;
        return (
          <div key={folder.id}>
            <div className="group/folder flex items-center gap-1 py-1 px-1 rounded-lg cursor-pointer transition-colors"
              style={{ paddingLeft: `${depth * 14 + 4}px`, background: isSelected ? 'var(--bg-active)' : 'transparent' }}
              onClick={() => onSelect(folder.id)}>
              <button type="button" onClick={e => { e.stopPropagation(); if (hasChildren) onToggle(folder.id); }}
                className="w-4 h-4 flex-shrink-0 flex items-center justify-center"
                style={{ color: 'var(--text-muted)', opacity: hasChildren ? 1 : 0 }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                  {isExpanded ? <path d="M2 3l3 4 3-4H2z"/> : <path d="M3 2l4 3-4 3V2z"/>}
                </svg>
              </button>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                style={{ color: folder.is_shared ? 'var(--primary)' : 'var(--text-muted)', flexShrink: 0 }}>
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
              <span className="flex-1 text-xs truncate" style={{ color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                {folder.name}
              </span>
              {/* Mobil: ⋮ dropdown (fixed position = neklipuje se kontejnerem) */}
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
                          style={{ color: 'var(--danger)' }}
                          onClick={e => { e.stopPropagation(); setOpenMenu(null); onDelete(folder); }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M9 6V4h6v2"/></svg>
                          Smazat
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
              {/* Desktop: ikonky na hover */}
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
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bg-hover)]" style={{ color: 'var(--danger)' }}>
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
                userId={userId} depth={depth + 1} parentId={folder.id} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
function BookmarksContent() {
  const { user } = useAuth();
  const { currentWorkspace, hasModule } = useWorkspace();
  const router = useRouter();

  const [folders, setFolders] = useState<BookmarkFolder[]>([]);
  const [folderShares, setFolderShares] = useState<FolderShare[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [comments, setComments] = useState<BookmarkComment[]>([]);
  const [likes, setLikes] = useState<Record<string, string[]>>({});
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [members, setMembers] = useState<Member[]>([]);

  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [showFavorites, setShowFavorites] = useState(false);
  // Fix #3: new showShared state for virtual "Sdílené záložky" folder
  const [showShared, setShowShared] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showFolderPanel, setShowFolderPanel] = useState(false);

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
  // Fix #3: editingComment state for inline comment editing
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

    // Fetch profiles for bookmark creators not in workspace members (e.g., master admin)
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
  useEffect(() => {
    if (currentWorkspace && !hasModule('bookmarks')) router.push('/');
  }, [currentWorkspace, hasModule, router]);

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

  // Fix #12: deleteComment and updateComment functions
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

  // ── Filtered ──────────────────────────────────────────────────────────────
  // Fix #4: add showShared case before selectedFolder
  const filtered = bookmarks
    .filter(b => {
      if (showFavorites) return favorites.has(b.id);
      if (showShared) return b.is_shared;
      if (selectedFolder) return b.folder_id === selectedFolder;
      return true;
    })
    .filter(b => !searchQ || b.title.toLowerCase().includes(searchQ.toLowerCase()) || b.url.toLowerCase().includes(searchQ.toLowerCase()) || b.description.toLowerCase().includes(searchQ.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'likes') return (likes[b.id]?.length ?? 0) - (likes[a.id]?.length ?? 0);
      if (sortBy === 'title') return a.title.localeCompare(b.title, 'cs');
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const getMember = (uid: string) => members.find(m => m.user_id === uid);
  const toggle = (id: string) => setExpanded(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });

  if (!currentWorkspace) return null;

  return (
    <DashboardLayout>
      <h1 className="text-xl font-bold mb-3 flex-shrink-0" style={{ color: 'var(--text-primary)' }}>Záložky</h1>
      <div className="flex flex-col md:flex-row gap-5 flex-1 min-h-0">

        {/* ── Left Panel ── */}
        {/* Fix #5: w-56 → w-72 */}
        <div className="md:w-72 flex-shrink-0 flex flex-col gap-3">
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
          <div className={`p-3 rounded-xl border md:flex md:flex-col overflow-y-auto flex-1${showFolderPanel ? ' flex flex-col' : ' hidden'}`} style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            {/* Fix #6: "Všechny záložky" resets showShared too */}
            <button onClick={() => { setSelectedFolder(null); setShowFavorites(false); setShowShared(false); }}
              className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors mb-1"
              style={{ background: !selectedFolder && !showFavorites && !showShared ? 'var(--bg-active)' : 'transparent', color: 'var(--text-primary)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
              Všechny záložky
            </button>

            {/* Fix #6: "Sdílené záložky" virtual folder button */}
            {bookmarks.some(b => b.is_shared) && (
              <button onClick={() => { setShowShared(true); setSelectedFolder(null); setShowFavorites(false); }}
                className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors mb-1"
                style={{ background: showShared ? 'var(--bg-active)' : 'transparent', color: 'var(--primary)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                Sdílené záložky
              </button>
            )}

            {favorites.size > 0 && (
              <button onClick={() => { setShowFavorites(true); setSelectedFolder(null); setShowShared(false); }}
                className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors mb-2"
                style={{ background: showFavorites ? 'var(--bg-active)' : 'transparent', color: '#f59e0b' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                Oblíbené ({favorites.size})
              </button>
            )}
            <div className="border-b mb-2" style={{ borderColor: 'var(--border)' }} />
            <div className="flex items-center justify-between mb-1 px-1">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Složky</span>
              <button onClick={() => openFolderModal()} title="Nová složka"
                className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bg-hover)] transition-colors"
                style={{ color: 'var(--primary)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
            </div>
            {/* Fix #6: onSelect also resets showShared and showFavorites */}
            <FolderTree folders={folders} selectedId={selectedFolder} expanded={expanded}
              onSelect={id => { setSelectedFolder(id); setShowFavorites(false); setShowShared(false); }}
              onToggle={toggle} onAddSub={(pid) => openFolderModal(pid)}
              onEdit={f => openFolderModal(null, f)} onDelete={deleteFolder}
              onShare={openShare} userId={userId} />
          </div>
        </div>

        {/* ── Right Panel ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Hledat záložky…"
              className="px-3 py-2 rounded-lg border text-base sm:text-sm flex-1 min-w-[160px] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }} />
            {/* Fix #9: sort select with custom arrow */}
            <div className="relative flex-shrink-0">
              <select value={sortBy} onChange={e => setSortBy(e.target.value as 'date' | 'likes' | 'title')}
                className="appearance-none pr-8 px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}>
                <option value="date">Nejnovější</option>
                <option value="likes">Nejvíce liků</option>
                <option value="title">Název A–Z</option>
              </select>
              <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
            </div>
            <button onClick={() => openBmModal()}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white flex items-center gap-1.5"
              style={{ background: 'var(--primary)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Nová záložka
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2">
            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ color: 'var(--text-muted)' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                <p className="text-sm">Žádné záložky</p>
                <button onClick={() => openBmModal()} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--primary)' }}>Přidat první záložku</button>
              </div>
            )}
            {filtered.map(b => {
              const author = getMember(b.created_by);
              const myLike = (likes[b.id] ?? []).includes(userId);
              const likeCount = (likes[b.id] ?? []).length;
              const isFav = favorites.has(b.id);
              const isOwner = b.created_by === userId;
              const bComments = comments.filter(c => c.bookmark_id === b.id);
              const domain = getDomain(b.url);
              const favicon = getFaviconUrl(b.url);
              const isCommentsOpen = openComments === b.id;

              return (
                <div key={b.id} className="p-4 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                  <div className="flex items-start gap-3">
                    {/* Favicon */}
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border overflow-hidden"
                      style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
                      {favicon ? (
                        <img src={favicon} alt="" width={20} height={20} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)' }}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1.5 sm:gap-2">
                        <div className="flex-1 min-w-0">
                          {/* Název + popis na jednom řádku – název má prioritu, popis se ořízne */}
                          <div className="flex items-baseline gap-1.5 min-w-0">
                            <a href={b.url} target="_blank" rel="noopener noreferrer"
                              className="font-semibold text-sm hover:underline flex-shrink-0 max-w-full" style={{ color: 'var(--primary)' }}>
                              {b.title}
                            </a>
                            {b.description && (
                              <span className="text-xs truncate flex-1 min-w-0" style={{ color: 'var(--text-muted)' }}>
                                {b.description}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <a href={domain} target="_blank" rel="noopener noreferrer"
                              className="text-xs truncate hover:underline" style={{ color: 'var(--text-muted)' }}>
                              {domain.replace(/^https?:\/\/(www\.)?/, '')}
                            </a>
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>·</span>
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(b.created_at).toLocaleDateString('cs-CZ')}</span>
                            {author?.display_name && <>
                              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>·</span>
                              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{author.display_name}</span>
                            </>}
                            {b.is_shared && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'var(--primary)20', color: 'var(--primary)' }}>Sdílená</span>}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 flex-wrap sm:flex-shrink-0">
                          {/* Fix #11: Copy URL button before comments */}
                          <button onClick={() => { navigator.clipboard.writeText(b.url); }}
                            title="Kopírovat URL"
                            className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
                            style={{ color: 'var(--text-muted)', background: 'var(--bg-hover)' }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                          </button>
                          {/* Comments */}
                          <button onClick={() => { setOpenComments(isCommentsOpen ? null : b.id); setNewComment(''); setEditingComment(null); }}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors"
                            style={{ color: isCommentsOpen ? 'var(--primary)' : 'var(--text-muted)', background: isCommentsOpen ? 'var(--bg-active)' : 'var(--bg-hover)' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                            {bComments.length}
                          </button>
                          {/* Like */}
                          <button onClick={() => toggleLike(b.id)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors"
                            style={{ color: myLike ? 'var(--primary)' : 'var(--text-muted)', background: myLike ? 'var(--bg-active)' : 'var(--bg-hover)' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill={myLike ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                            {likeCount}
                          </button>
                          {/* Favorite */}
                          <button onClick={() => toggleFavorite(b.id)} title={isFav ? 'Odebrat z oblíbených' : 'Přidat do oblíbených'}
                            className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
                            style={{ color: isFav ? '#f59e0b' : 'var(--text-muted)', background: 'var(--bg-hover)' }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill={isFav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                          </button>
                          {/* Edit */}
                          {isOwner && (
                            <button onClick={() => openBmModal(b)} title="Upravit"
                              className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
                              style={{ color: 'var(--text-muted)', background: 'var(--bg-hover)' }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                          )}
                          {/* Delete – Fix #14: full trash icon with top path */}
                          {isOwner && (
                            <button onClick={() => deleteBm(b)} title="Smazat"
                              className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
                              style={{ color: 'var(--danger)', background: 'var(--bg-hover)' }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Fix #12: Comments panel – complete rework */}
                      {isCommentsOpen && (
                        <div className="mt-3 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                          {bComments.map(c => {
                            const cm = getMember(c.user_id);
                            const isMyComment = c.user_id === userId;
                            const isEditing = editingComment?.id === c.id;
                            return (
                              <div key={c.id} className="flex gap-2 mb-3">
                                {/* Avatar with member's avatar_color */}
                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                                  style={{ background: cm?.avatar_color ?? 'var(--primary)', fontSize: '10px' }}>
                                  {getInitials(cm?.display_name ?? '?')}
                                </div>
                                <div className="flex-1 min-w-0">
                                  {/* Author name + date on one line */}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{cm?.display_name ?? 'Uživatel'}</span>
                                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(c.created_at).toLocaleDateString('cs-CZ')}</span>
                                    {/* Edit/delete only for own comments */}
                                    {isMyComment && !isEditing && (
                                      <div className="flex items-center gap-1 ml-auto">
                                        <button onClick={() => setEditingComment({ id: c.id, content: c.content })}
                                          title="Upravit komentář"
                                          className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bg-hover)] transition-colors"
                                          style={{ color: 'var(--text-muted)' }}>
                                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                        </button>
                                        <button onClick={() => deleteComment(c.id)}
                                          title="Smazat komentář"
                                          className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bg-hover)] transition-colors"
                                          style={{ color: 'var(--danger)' }}>
                                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                            <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                                          </svg>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                  {/* Inline edit mode */}
                                  {isEditing ? (
                                    <div className="mt-1">
                                      <textarea
                                        value={editingComment.content}
                                        onChange={e => setEditingComment({ ...editingComment, content: e.target.value })}
                                        rows={2}
                                        className="w-full px-2 py-1.5 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)] resize-none"
                                        style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                                      />
                                      <div className="flex gap-1.5 mt-1">
                                        <button onClick={updateComment}
                                          className="px-3 py-1 rounded-lg text-xs font-medium text-white"
                                          style={{ background: 'var(--primary)' }}>
                                          Uložit
                                        </button>
                                        <button onClick={() => setEditingComment(null)}
                                          className="px-3 py-1 rounded-lg text-xs font-medium border"
                                          style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                                          Zrušit
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    /* Comment text below author line */
                                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{c.content}</p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          {/* Comment form with Cancel button */}
                          <div className="flex gap-2 mt-2">
                            <input value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Přidat komentář…"
                              onKeyDown={e => e.key === 'Enter' && addComment(b.id)}
                              className="flex-1 px-3 py-1.5 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                              style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }} />
                            <button onClick={() => addComment(b.id)} disabled={addingComment || !newComment.trim()}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50" style={{ background: 'var(--primary)' }}>Odeslat</button>
                            <button onClick={() => { setOpenComments(null); setNewComment(''); }}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium border"
                              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>Zrušit</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Folder Modal ── */}
      {folderModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setFolderModal({ open: false, parentId: null, editing: null })}>
          <div className="w-80 p-5 rounded-2xl border shadow-xl" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }} onClick={e => e.stopPropagation()}>
            <h2 className="font-semibold mb-4 text-sm" style={{ color: 'var(--text-primary)' }}>{folderModal.editing ? 'Přejmenovat složku' : 'Nová složka'}</h2>
            <input value={folderName} onChange={e => setFolderName(e.target.value)} placeholder="Název složky" autoFocus
              onKeyDown={e => e.key === 'Enter' && saveFolder()}
              className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }} />
            <div className="flex gap-2 mt-4">
              <button onClick={saveFolder} className="flex-1 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--primary)' }}>Uložit</button>
              <button onClick={() => setFolderModal({ open: false, parentId: null, editing: null })} className="flex-1 py-2 rounded-lg text-sm font-medium border" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>Zrušit</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Share Modal ── */}
      {shareModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShareModal({ open: false, folder: null })}>
          <div className="w-96 p-5 rounded-2xl border shadow-xl" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }} onClick={e => e.stopPropagation()}>
            <h2 className="font-semibold mb-1 text-sm" style={{ color: 'var(--text-primary)' }}>Sdílet složku „{shareModal.folder?.name}"</h2>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Určete, kdo může složku a její záložky vidět</p>
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
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isChecked ? 'var(--bg-active)' : 'transparent'; }}
                    >
                      <input type="checkbox" checked={isChecked}
                        onChange={e => setShareUserIds(prev => e.target.checked ? [...prev, m.user_id] : prev.filter(id => id !== m.user_id))}
                        className="accent-[var(--primary)] flex-shrink-0" />
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                        style={{ background: m.avatar_color ?? 'var(--primary)' }}>
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

      {/* ── Bookmark Modal ── */}
      {bmModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setBmModal({ open: false, editing: null })}>
          <div className="w-full max-w-lg p-5 rounded-2xl border shadow-xl" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }} onClick={e => e.stopPropagation()}>
            <h2 className="font-semibold mb-4 text-sm" style={{ color: 'var(--text-primary)' }}>{bmModal.editing ? 'Upravit záložku' : 'Nová záložka'}</h2>
            <div className="space-y-3">
              <input value={bmTitle} onChange={e => setBmTitle(e.target.value)} placeholder="Název záložky" autoFocus
                className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }} />
              <input value={bmUrl} onChange={e => setBmUrl(e.target.value)} placeholder="URL (např. https://example.com)"
                className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }} />
              {/* Fix #13: textarea rows from 2 to 4 */}
              <textarea value={bmDesc} onChange={e => setBmDesc(e.target.value)} placeholder="Popis (volitelné)" rows={4}
                className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }} />
              {/* Fix #13: folder select with custom arrow */}
              <div className="relative">
                <select value={bmFolderId ?? ''} onChange={e => setBmFolderId(e.target.value || null)}
                  className="appearance-none pr-8 w-full px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}>
                  <option value="">— Bez složky —</option>
                  {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
                <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={bmIsShared} onChange={e => setBmIsShared(e.target.checked)} className="accent-[var(--primary)]" />
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Sdílet s celým workspacem</span>
              </label>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={saveBm} disabled={bmSaving || !bmTitle.trim() || !bmUrl.trim()}
                className="flex-1 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: 'var(--primary)' }}>
                {bmSaving ? 'Ukládám…' : 'Uložit'}
              </button>
              <button onClick={() => setBmModal({ open: false, editing: null })}
                className="flex-1 py-2 rounded-lg text-sm font-medium border" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>Zrušit</button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function BookmarksPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!loading && !user) router.push('/login'); }, [loading, user, router]);
  if (loading || !user) return null;
  return <WorkspaceProvider><BookmarksContent /></WorkspaceProvider>;
}

export default BookmarksPage;
