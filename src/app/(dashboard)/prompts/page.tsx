'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { WorkspaceProvider, useWorkspace } from '@/contexts/WorkspaceContext';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase';

interface PromptFolder {
  id: string; workspace_id: string; parent_id: string | null;
  name: string; owner_id: string; is_shared: boolean; created_at: string;
}
interface FolderShare { id: string; folder_id: string; user_id: string | null; }
interface Prompt {
  id: string; workspace_id: string; folder_id: string | null;
  title: string; content: string; is_shared: boolean;
  created_by: string; created_at: string; updated_at: string;
}
interface PromptComment { id: string; prompt_id: string; user_id: string; content: string; created_at: string; }
interface Member { user_id: string; display_name: string; email: string; avatar_color: string; }

const MAX_DEPTH = 5;

function getDepth(folder: PromptFolder, all: PromptFolder[]): number {
  let d = 0; let cur: PromptFolder | undefined = folder;
  while (cur?.parent_id) { cur = all.find(f => f.id === cur!.parent_id); d++; }
  return d;
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractCodeBlocks(html: string): string[] {
  const re = /<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi;
  const results: string[] = [];
  let m; while ((m = re.exec(html)) !== null) {
    results.push(m[1].replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"'));
  }
  return results;
}

// ─── Rich Text Editor ───────────────────────────────────────────────────────
function RichEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value;
  }, []);

  const cmd = (command: string, val?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, val);
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const insertCode = () => {
    ref.current?.focus();
    const sel = window.getSelection();
    const selected = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).toString() : '';
    document.execCommand('insertHTML', false,
      `<pre class="code-block" style="position:relative;background:var(--bg-hover);padding:12px 40px 12px 12px;border-radius:8px;font-family:monospace;font-size:13px;overflow-x:auto;margin:8px 0;border:1px solid var(--border)"><code>${selected || ''}</code></pre><p><br></p>`
    );
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const btn = (label: string, action: () => void, title?: string) => (
    <button type="button" title={title || label} onClick={action}
      className="px-2 py-1 rounded text-xs font-medium hover:bg-[var(--bg-active)] transition-colors"
      style={{ color: 'var(--text-secondary)' }}
    >{label}</button>
  );

  return (
    <div className="border rounded-xl overflow-hidden" style={{ borderColor: 'var(--border)' }}>
      <div className="flex flex-wrap gap-0.5 px-2 py-1.5 border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
        {btn('H2', () => cmd('formatBlock', 'h2'))}
        {btn('H3', () => cmd('formatBlock', 'h3'))}
        <span className="w-px mx-1 self-stretch" style={{ background: 'var(--border)' }} />
        {btn('B', () => cmd('bold'), 'Tučné')}
        {btn('I', () => cmd('italic'), 'Kurzíva')}
        {btn('U', () => cmd('underline'), 'Podtržení')}
        <span className="w-px mx-1 self-stretch" style={{ background: 'var(--border)' }} />
        {btn('• Seznam', () => cmd('insertUnorderedList'))}
        {btn('1. Seznam', () => cmd('insertOrderedList'))}
        <span className="w-px mx-1 self-stretch" style={{ background: 'var(--border)' }} />
        {btn('</> Kód', insertCode, 'Vložit blok kódu')}
      </div>
      <div ref={ref} contentEditable suppressContentEditableWarning
        onInput={() => { if (ref.current) onChange(ref.current.innerHTML); }}
        onClick={(e) => {
          const target = e.target as Element;
          const codeEl = target.closest('code');
          const preEl = target.closest('pre');

          // Kliknutí na copy ikonu (pravý horní roh pre bloku)
          if (preEl) {
            const rect = preEl.getBoundingClientRect();
            if (e.clientX > rect.right - 36 && e.clientY < rect.top + 32) {
              const code = preEl.querySelector('code')?.textContent ?? '';
              navigator.clipboard.writeText(code).catch(() => {});
              return;
            }
          }

        }}
        className="min-h-[200px] p-4 text-sm focus:outline-none prose-editor"
        style={{ color: 'var(--text-primary)', background: 'var(--bg-card)' }}
      />
      <style>{`
        .prose-editor h2{font-size:1.2em;font-weight:700;margin:12px 0 6px}
        .prose-editor h3{font-size:1.05em;font-weight:600;margin:10px 0 4px}
        .prose-editor ul{list-style:disc;padding-left:20px;margin:4px 0}
        .prose-editor ol{list-style:decimal;padding-left:20px;margin:4px 0}
        .prose-editor pre{position:relative;background:var(--bg-hover);padding:12px 40px 12px 12px;border-radius:8px;font-family:monospace;font-size:13px;overflow-x:auto;margin:8px 0;border:1px solid var(--border)}
        .prose-editor pre::after{content:"";position:absolute;top:8px;right:8px;width:20px;height:20px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='9' y='9' width='13' height='13' rx='2' ry='2'/%3E%3Cpath d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:center;cursor:pointer;opacity:0.5;transition:opacity 0.15s}
        .prose-editor pre:hover::after{opacity:1}
      `}</style>
    </div>
  );
}

// ─── Folder Tree ────────────────────────────────────────────────────────────
function FolderTree({
  folders, selectedId, expanded, onSelect, onToggle, onAddSub, onEdit, onDelete, onShare, userId, depth = 0, parentId = null,
}: {
  folders: PromptFolder[]; selectedId: string | null; expanded: Set<string>;
  onSelect: (id: string | null) => void; onToggle: (id: string) => void;
  onAddSub: (parentId: string, depth: number) => void;
  onEdit: (f: PromptFolder) => void; onDelete: (f: PromptFolder) => void;
  onShare: (f: PromptFolder) => void; userId: string; depth?: number; parentId?: string | null;
}) {
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
              onClick={() => onSelect(folder.id)}
            >
              <button type="button" onClick={e => { e.stopPropagation(); if (hasChildren) onToggle(folder.id); }}
                className="w-4 h-4 flex-shrink-0 flex items-center justify-center"
                style={{ color: 'var(--text-muted)', opacity: hasChildren ? 1 : 0 }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                  {isExpanded ? <path d="M2 3l3 4 3-4H2z"/> : <path d="M3 2l4 3-4 3V2z"/>}
                </svg>
              </button>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: folder.is_shared ? 'var(--primary)' : 'var(--text-muted)', flexShrink: 0 }}>
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
              <span className="flex-1 text-xs truncate" style={{ color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                {folder.name}
              </span>
              <div className="sm:opacity-0 sm:group-hover/folder:opacity-100 flex items-center gap-0.5 flex-shrink-0 transition-opacity">
                {depth < MAX_DEPTH - 1 && (
                  <button type="button" title="Přidat podsložku" onClick={e => { e.stopPropagation(); onAddSub(folder.id, depth + 1); }}
                    className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bg-hover)]"
                    style={{ color: 'var(--text-muted)' }}>
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
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bg-hover)]"
                      style={{ color: 'var(--text-muted)' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button type="button" title="Smazat" onClick={e => { e.stopPropagation(); onDelete(folder); }}
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bg-hover)]"
                      style={{ color: 'var(--danger)' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        <path d="M9 6V4h6v2"/>
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

// ─── Main Content ────────────────────────────────────────────────────────────
function PromptsContent() {
  const { user, profile } = useAuth();
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
  const [showFavorites, setShowFavorites] = useState(false);
  const [showShared, setShowShared] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showFolderPanel, setShowFolderPanel] = useState(false);

  const [sortBy, setSortBy] = useState<'date' | 'likes' | 'title'>('date');
  const [searchQ, setSearchQ] = useState('');

  const [editingComment, setEditingComment] = useState<{ id: string; content: string } | null>(null);

  // Modals
  const [folderModal, setFolderModal] = useState<{ open: boolean; parentId: string | null; editing: PromptFolder | null }>({ open: false, parentId: null, editing: null });
  const [folderName, setFolderName] = useState('');
  const [shareModal, setShareModal] = useState<{ open: boolean; folder: PromptFolder | null }>({ open: false, folder: null });
  const [shareType, setShareType] = useState<'workspace' | 'users'>('workspace');
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
    setShareType(hasWorkspace ? 'workspace' : 'users');
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
  const filtered = prompts
    .filter(p => {
      if (showFavorites) return favorites.has(p.id);
      if (showShared) return p.is_shared;
      if (selectedFolder) return p.folder_id === selectedFolder;
      return true;
    })
    .filter(p => !searchQ || p.title.toLowerCase().includes(searchQ.toLowerCase()) || stripHtml(p.content).toLowerCase().includes(searchQ.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'likes') return (likes[b.id]?.length ?? 0) - (likes[a.id]?.length ?? 0);
      if (sortBy === 'title') return a.title.localeCompare(b.title, 'cs');
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const getMember = (uid: string) => members.find(m => m.user_id === uid);

  const toggle = (id: string) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  if (!currentWorkspace) return null;

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row gap-5 md:h-[calc(100vh-80px)] min-h-0">

        {/* ── Left Panel ── */}
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
            {/* Všechny prompty */}
            <button onClick={() => { setSelectedFolder(null); setShowFavorites(false); setShowShared(false); }}
              className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors mb-1"
              style={{ background: !selectedFolder && !showFavorites && !showShared ? 'var(--bg-active)' : 'transparent', color: 'var(--text-primary)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              Všechny prompty
            </button>
            {/* Oblíbené */}
            {favorites.size > 0 && (
              <button onClick={() => { setShowFavorites(true); setSelectedFolder(null); setShowShared(false); }}
                className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors mb-1"
                style={{ background: showFavorites ? 'var(--bg-active)' : 'transparent', color: 'var(--warning, #f59e0b)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                Oblíbené ({favorites.size})
              </button>
            )}
            {/* Sdílené prompty */}
            {prompts.some(p => p.is_shared) && (
              <button
                onClick={() => { setSelectedFolder(null); setShowShared(true); setShowFavorites(false); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors mb-1"
                style={{ background: showShared ? 'var(--bg-active)' : 'transparent', color: showShared ? 'var(--primary)' : 'var(--text-secondary)' }}
                onMouseEnter={e => { if (!showShared) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { if (!showShared) e.currentTarget.style.background = 'transparent'; }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
                Sdílené prompty
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
            <FolderTree folders={folders} selectedId={selectedFolder} expanded={expanded}
              onSelect={id => { setSelectedFolder(id); setShowFavorites(false); setShowShared(false); }}
              onToggle={toggle} onAddSub={(pid, d) => openFolderModal(pid)}
              onEdit={f => openFolderModal(null, f)} onDelete={deleteFolder}
              onShare={openShare} userId={userId} />
          </div>
        </div>

        {/* ── Right Panel ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {/* Toolbar */}
          <div className="flex items-center gap-3 flex-wrap">
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Hledat prompty…"
              className="px-3 py-1.5 rounded-lg border text-sm flex-1 min-w-[160px] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }} />
            <div className="relative flex-shrink-0">
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as 'date' | 'likes' | 'title')}
                className="text-xs border rounded-lg pl-3 pr-8 py-1.5 appearance-none cursor-pointer"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-secondary)', outline: 'none' }}
              >
                <option value="date">Nejnovější</option>
                <option value="likes">Nejvíce liků</option>
                <option value="title">Název A–Z</option>
              </select>
              <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>
            </div>
            <button onClick={() => openPromptModal()}
              className="px-4 py-1.5 rounded-lg text-sm font-medium text-white flex items-center gap-1.5"
              style={{ background: 'var(--primary)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Nový prompt
            </button>
          </div>

          {/* Prompt list */}
          <div className="flex-1 overflow-y-auto space-y-2">
            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ color: 'var(--text-muted)' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                <p className="text-sm">Žádné prompty</p>
                <button onClick={() => openPromptModal()} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--primary)' }}>Přidat první prompt</button>
              </div>
            )}
            {filtered.map(p => {
              const author = getMember(p.created_by);
              const myLike = (likes[p.id] ?? []).includes(userId);
              const likeCount = (likes[p.id] ?? []).length;
              const isFav = favorites.has(p.id);
              const isOwner = p.created_by === userId;
              const codes = extractCodeBlocks(p.content);
              const promptComments = comments.filter(c => c.prompt_id === p.id);

              return (
                <div key={p.id} className="p-4 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white"
                      style={{ background: author?.avatar_color ?? 'var(--primary)' }}>
                      {getInitials(author?.display_name ?? '?')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-sm cursor-pointer hover:underline" style={{ color: 'var(--text-primary)' }}
                            onClick={() => openPromptModal(p)}>
                            {p.title}
                          </h3>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(p.created_at).toLocaleDateString('cs-CZ')}</span>
                            {p.is_shared && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'var(--primary)20', color: 'var(--primary)' }}>Sdílený</span>}
                            {promptComments.length > 0 && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>💬 {promptComments.length}</span>}
                          </div>
                        </div>
                        {/* Actions */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {/* Copy first code block */}
                          {codes.length > 0 && (
                            <button title="Kopírovat kód promptu" onClick={() => copyText(codes[0], `code-${p.id}`)}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors"
                              style={{ color: copied === `code-${p.id}` ? 'var(--success)' : 'var(--text-muted)', background: 'var(--bg-hover)' }}>
                              {copied === `code-${p.id}` ? '✓' : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>}
                              Kód
                            </button>
                          )}
                          {/* Like */}
                          <button onClick={() => toggleLike(p.id)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors"
                            style={{ color: myLike ? 'var(--primary)' : 'var(--text-muted)', background: myLike ? 'var(--bg-active)' : 'var(--bg-hover)' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill={myLike ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                            {likeCount}
                          </button>
                          {/* Favorite */}
                          <button onClick={() => toggleFavorite(p.id)} title={isFav ? 'Odebrat z oblíbených' : 'Přidat do oblíbených'}
                            className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
                            style={{ color: isFav ? '#f59e0b' : 'var(--text-muted)', background: 'var(--bg-hover)' }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill={isFav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                          </button>
                          {/* Edit */}
                          {isOwner && (
                            <button onClick={() => openPromptModal(p)} title="Upravit"
                              className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
                              style={{ color: 'var(--text-muted)', background: 'var(--bg-hover)' }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                          )}
                          {/* Delete */}
                          {isOwner && (
                            <button onClick={() => deletePrompt(p)} title="Smazat"
                              className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
                              style={{ color: 'var(--danger)', background: 'var(--bg-hover)' }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                <path d="M9 6V4h6v2"/>
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>

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
              className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
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
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Určete, kdo může složku a její obsah vidět</p>
            <div className="space-y-2 mb-4">
              {(['workspace', 'users'] as const).map(t => (
                <label key={t} className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer"
                  style={{ borderColor: shareType === t ? 'var(--primary)' : 'var(--border)', background: shareType === t ? 'var(--bg-active)' : 'transparent' }}>
                  <input type="radio" checked={shareType === t} onChange={() => setShareType(t)} className="accent-[var(--primary)]" />
                  <div>
                    <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t === 'workspace' ? 'Celý workspace' : 'Konkrétní uživatelé'}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{t === 'workspace' ? 'Vidí všichni členové' : 'Vybraní členové'}</div>
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

      {/* ── Prompt Modal ── */}
      {promptModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border shadow-xl" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="p-5">
              <h2 className="font-semibold mb-4 text-sm" style={{ color: 'var(--text-primary)' }}>{promptModal.editing ? 'Upravit prompt' : 'Nový prompt'}</h2>
              <div className="space-y-4">
                <input value={pmTitle} onChange={e => setPmTitle(e.target.value)} placeholder="Název promptu" autoFocus
                  className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }} />
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Složka</label>
                  <div className="relative">
                    <select value={pmFolderId ?? ''} onChange={e => setPmFolderId(e.target.value || null)}
                      className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none appearance-none pr-8"
                      style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}>
                      <option value="">— Bez složky —</option>
                      {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                    <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Obsah</label>
                  <RichEditor value={pmContent} onChange={setPmContent} />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={pmIsShared} onChange={e => setPmIsShared(e.target.checked)} className="accent-[var(--primary)]" />
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Sdílet s celým workspacem</span>
                </label>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={savePrompt} disabled={pmSaving || !pmTitle.trim()}
                  className="flex-1 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: 'var(--primary)' }}>
                  {pmSaving ? 'Ukládám…' : 'Uložit'}
                </button>
                <button onClick={() => setPromptModal({ open: false, editing: null })}
                  className="flex-1 py-2 rounded-lg text-sm font-medium border"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>Zrušit</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function PromptsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!loading && !user) router.push('/login'); }, [loading, user, router]);
  if (loading || !user) return null;
  return <WorkspaceProvider><PromptsContent /></WorkspaceProvider>;
}

export default PromptsPage;
