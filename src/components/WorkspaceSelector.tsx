'use client';

import { useState } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { isMasterAdmin } from '@/lib/permissions';

export default function WorkspaceSelector() {
  const { workspaces, selectWorkspace, createWorkspace, loading } = useWorkspace();
  const { profile } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const canCreate = isMasterAdmin(profile);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setCreating(true);
    setError('');
    const { error } = await createWorkspace(newName.trim());
    if (error) {
      setError(error);
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-main)' }}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p style={{ color: 'var(--text-secondary)' }}>Načítání...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg-main)' }}>
      <div className="w-full max-w-[440px]">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--primary)] mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Trackino</h1>
          <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>Vyberte pracovní prostor</p>
        </div>

        {/* Seznam workspaces */}
        {workspaces.length > 0 && (
          <div className="rounded-xl border p-2 mb-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => selectWorkspace(ws)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors"
                style={{ color: 'var(--text-primary)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                  style={{ background: 'var(--primary)' }}
                >
                  {ws.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-medium">{ws.name}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>/{ws.slug}</div>
                </div>
                <svg className="ml-auto" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)' }}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            ))}
          </div>
        )}

        {/* Vytvoření nového workspace – jen Master Admin */}
        {canCreate && (
          <>
            {!showCreate ? (
              <button
                onClick={() => setShowCreate(true)}
                className="w-full py-3 rounded-xl border-2 border-dashed text-sm font-medium transition-colors"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--primary)';
                  e.currentTarget.style.color = 'var(--primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
              >
                + Vytvořit nový pracovní prostor
              </button>
            ) : (
              <form onSubmit={handleCreate} className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                {error && (
                  <div className="mb-3 p-3 rounded-lg text-sm" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}>
                    {error}
                  </div>
                )}
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  Název pracovního prostoru
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="např. Four Crowns"
                  autoFocus
                  className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-shadow mb-3"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowCreate(false); setNewName(''); setError(''); }}
                    className="flex-1 py-2 rounded-lg border text-sm font-medium transition-colors"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                  >
                    Zrušit
                  </button>
                  <button
                    type="submit"
                    disabled={creating || !newName.trim()}
                    className="flex-1 py-2 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50"
                    style={{ background: 'var(--primary)' }}
                  >
                    {creating ? 'Vytvářím...' : 'Vytvořit'}
                  </button>
                </div>
              </form>
            )}
          </>
        )}

        {/* Pokud uživatel nemá žádný workspace a nemůže vytvořit */}
        {workspaces.length === 0 && !canCreate && (
          <div className="text-center py-8">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Nejste členem žádného pracovního prostoru. Kontaktujte administrátora.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
