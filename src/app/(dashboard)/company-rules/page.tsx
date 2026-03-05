'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace, WorkspaceProvider } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

const PAGE_SLUG = 'company-rules';

const DEFAULT_CONTENT = `
<h2>Firemní pravidla</h2>
<p>Zde správce workspace může zapsat firemní pravidla, interní směrnice a důležité informace pro celý tým.</p>
<p><em>Obsah upraví správce (Admin/Owner) kliknutím na tlačítko Upravit.</em></p>
`;

// ─── Interní komponenta ───────────────────────────────────────────────────────

function CompanyRulesContent() {
  const { user } = useAuth();
  const { currentWorkspace, hasModule, loading: wsLoading } = useWorkspace();
  const { isWorkspaceAdmin, isMasterAdmin } = usePermissions();
  const router = useRouter();

  const canEdit = isMasterAdmin || isWorkspaceAdmin;

  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!wsLoading && !hasModule('company_rules')) router.replace('/');
  }, [wsLoading, hasModule, router]);

  const fetchContent = useCallback(async () => {
    if (!currentWorkspace) { setLoading(false); return; }
    const { data } = await supabase
      .from('trackino_workspace_pages')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .eq('slug', PAGE_SLUG)
      .single();

    setContent(data?.content?.trim() ? data.content : DEFAULT_CONTENT);
    setLoading(false);
  }, [currentWorkspace]);

  useEffect(() => { fetchContent(); }, [fetchContent]);

  const startEditing = () => {
    setEditing(true);
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = content;
        editorRef.current.focus();
      }
    }, 0);
  };

  const saveContent = async () => {
    if (!user || !currentWorkspace) return;
    setSaving(true);
    const newContent = editorRef.current?.innerHTML ?? '';

    const { data: existing } = await supabase
      .from('trackino_workspace_pages')
      .select('id')
      .eq('workspace_id', currentWorkspace.id)
      .eq('slug', PAGE_SLUG)
      .single();

    if (existing?.id) {
      await supabase.from('trackino_workspace_pages').update({
        content: newContent,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      }).eq('id', existing.id);
    } else {
      await supabase.from('trackino_workspace_pages').insert({
        workspace_id: currentWorkspace.id,
        slug: PAGE_SLUG,
        content: newContent,
        updated_by: user.id,
      });
    }

    setContent(newContent);
    setSaving(false);
    setEditing(false);
  };

  const execCmd = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
  };

  const insertLink = () => {
    const url = prompt('URL odkazu:');
    if (url) execCmd('createLink', url);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl">
        {/* Záhlaví */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="min-w-0">
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Firemní pravidla</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Interní směrnice a pravidla pro celý tým
            </p>
          </div>
          {canEdit && (
            <div className="flex gap-2 flex-shrink-0">
              {editing ? (
                <>
                  <button
                    onClick={() => setEditing(false)}
                    className="px-3 py-1.5 rounded-lg border text-sm"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                  >
                    Zrušit
                  </button>
                  <button
                    onClick={saveContent}
                    disabled={saving}
                    className="px-4 py-1.5 rounded-lg text-white text-sm font-medium disabled:opacity-50"
                    style={{ background: 'var(--primary)' }}
                  >
                    {saving ? 'Ukládám...' : 'Uložit'}
                  </button>
                </>
              ) : (
                <button
                  onClick={startEditing}
                  className="px-3 py-1.5 rounded-lg border text-sm flex items-center gap-1.5"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Upravit
                </button>
              )}
            </div>
          )}
        </div>

        <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          {/* Toolbar editoru */}
          {editing && (
            <div className="px-3 py-2 border-b flex flex-wrap gap-1" style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
              <button onMouseDown={e => { e.preventDefault(); execCmd('formatBlock', 'h2'); }} className="px-2 py-1 rounded text-xs font-bold" style={{ color: 'var(--text-secondary)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--border)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')} title="Nadpis H2">H2</button>
              <button onMouseDown={e => { e.preventDefault(); execCmd('formatBlock', 'h3'); }} className="px-2 py-1 rounded text-xs font-semibold" style={{ color: 'var(--text-secondary)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--border)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')} title="Podnadpis H3">H3</button>
              <button onMouseDown={e => { e.preventDefault(); execCmd('formatBlock', 'p'); }} className="px-2 py-1 rounded text-xs" style={{ color: 'var(--text-secondary)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--border)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')} title="Normální text">¶</button>
              <div className="w-px mx-1 self-stretch" style={{ background: 'var(--border)' }} />
              {[
                { cmd: 'bold', label: <strong>B</strong>, title: 'Tučné (Ctrl+B)' },
                { cmd: 'italic', label: <em>I</em>, title: 'Kurzíva (Ctrl+I)' },
                { cmd: 'underline', label: <u>U</u>, title: 'Podtržení (Ctrl+U)' },
              ].map(btn => (
                <button
                  key={btn.cmd}
                  onMouseDown={e => { e.preventDefault(); execCmd(btn.cmd); }}
                  className="px-2 py-1 rounded text-sm font-medium"
                  style={{ color: 'var(--text-secondary)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--border)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  title={btn.title}
                >
                  {btn.label}
                </button>
              ))}
              <div className="w-px mx-1 self-stretch" style={{ background: 'var(--border)' }} />
              <button onMouseDown={e => { e.preventDefault(); execCmd('insertUnorderedList'); }} className="px-2 py-1 rounded text-xs" style={{ color: 'var(--text-secondary)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--border)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')} title="Odrážky">• Seznam</button>
              <button onMouseDown={e => { e.preventDefault(); execCmd('insertOrderedList'); }} className="px-2 py-1 rounded text-xs" style={{ color: 'var(--text-secondary)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--border)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')} title="Číselný seznam">1. Seznam</button>
              <button onMouseDown={e => { e.preventDefault(); insertLink(); }} className="px-2 py-1 rounded text-xs" style={{ color: 'var(--text-secondary)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--border)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')} title="Odkaz">🔗 Odkaz</button>
            </div>
          )}

          {/* Obsah */}
          <div
            ref={editorRef}
            contentEditable={editing}
            suppressContentEditableWarning
            dangerouslySetInnerHTML={!editing ? { __html: content } : undefined}
            className="prose prose-sm max-w-none p-6 focus:outline-none"
            style={{
              color: 'var(--text-primary)',
              minHeight: editing ? '400px' : 'auto',
              cursor: editing ? 'text' : 'default',
            }}
          />
        </div>

        {!editing && canEdit && (
          <p className="mt-3 text-xs text-right" style={{ color: 'var(--text-muted)' }}>
            Klikněte Upravit pro editaci obsahu.
          </p>
        )}
      </div>

      <style>{`
        .prose h2 { font-size: 1.25rem; font-weight: 700; margin: 1.5rem 0 0.5rem; color: var(--text-primary); }
        .prose h3 { font-size: 1rem; font-weight: 600; margin: 1.25rem 0 0.4rem; color: var(--text-primary); }
        .prose p { margin: 0.5rem 0; color: var(--text-secondary); line-height: 1.6; }
        .prose ul { margin: 0.5rem 0 0.5rem 1.5rem; list-style-type: disc; }
        .prose ol { margin: 0.5rem 0 0.5rem 1.5rem; list-style-type: decimal; }
        .prose li { margin: 0.2rem 0; color: var(--text-secondary); }
        .prose a { color: var(--primary); text-decoration: underline; }
        .prose strong { font-weight: 600; }
        .prose em { font-style: italic; }
        [contenteditable]:focus { outline: none; }
      `}</style>
    </DashboardLayout>
  );
}

// ─── Outer page component ────────────────────────────────────────────────────

export default function CompanyRulesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, user, router]);

  if (authLoading || !user) return null;

  return (
    <WorkspaceProvider>
      <CompanyRulesContent />
    </WorkspaceProvider>
  );
}
