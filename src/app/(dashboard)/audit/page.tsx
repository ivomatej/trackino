'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { WorkspaceProvider, useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import type { AuditLogEntry, Profile } from '@/types/database';

const ACTION_LABELS: Record<string, string> = {
  'create_entry': 'Vytvořil záznam',
  'edit_entry': 'Upravil záznam',
  'delete_entry': 'Smazal záznam',
  'edit_entry_for_user': 'Upravil popis záznamu',
  'create_entry_for_user': 'Vytvořil záznam',
  'edit_note_for_user': 'Přidal poznámku k záznamu',
  'start_timer': 'Spustil timer',
  'stop_timer': 'Zastavil timer',
};

function AuditContent() {
  const { currentWorkspace, loading } = useWorkspace();
  const { canAccessAuditLog } = usePermissions();
  const [entries, setEntries] = useState<(AuditLogEntry & { actor_name?: string; target_name?: string })[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loadingData, setLoadingData] = useState(true);

  const fetchAuditLog = useCallback(async () => {
    if (!currentWorkspace) return;
    setLoadingData(true);

    const { data } = await supabase
      .from('trackino_audit_log')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .order('created_at', { ascending: false })
      .limit(100);

    const logEntries = (data ?? []) as AuditLogEntry[];
    setEntries(logEntries);

    // Načíst profily aktérů
    const userIds = [...new Set([
      ...logEntries.map(e => e.actor_user_id),
      ...logEntries.filter(e => e.target_user_id).map(e => e.target_user_id!),
    ])];

    if (userIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('trackino_profiles')
        .select('*')
        .in('id', userIds);

      const profileMap: Record<string, Profile> = {};
      (profilesData ?? []).forEach((p: Profile) => { profileMap[p.id] = p; });
      setProfiles(profileMap);
    }

    setLoadingData(false);
  }, [currentWorkspace]);

  useEffect(() => {
    if (currentWorkspace && canAccessAuditLog) fetchAuditLog();
  }, [currentWorkspace, canAccessAuditLog, fetchAuditLog]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-main)' }}>
        <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!canAccessAuditLog) {
    return (
      <DashboardLayout moduleName="Audit log">
        <div className="max-w-2xl">
          <h1 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Audit log</h1>
          <p style={{ color: 'var(--text-muted)' }}>Nemáte oprávnění k zobrazení audit logu.</p>
        </div>
      </DashboardLayout>
    );
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const fmtDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h} h ${m} min` : `${m} min`;
  };

  return (
    <DashboardLayout moduleName="Audit log">
      <div className="max-w-3xl">
        <div className="mb-6">
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Audit log</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Historie úprav záznamů provedených manažery a adminy
          </p>
        </div>

        {loadingData ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
            </svg>
            <p className="text-sm">Zatím žádné záznamy v audit logu.</p>
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            {entries.map((entry, idx) => {
              const actor = profiles[entry.actor_user_id];
              const target = entry.target_user_id ? profiles[entry.target_user_id] : null;
              const details = (entry.details ?? {}) as Record<string, string | number | boolean | null | undefined>;

              return (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 px-4 py-3.5"
                  style={{
                    borderBottom: idx < entries.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  {/* Avatar aktéra */}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-0.5"
                    style={{ background: actor?.avatar_color ?? 'var(--primary)' }}
                  >
                    {actor?.display_name?.charAt(0).toUpperCase() ?? '?'}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Hlavní řádek */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {actor?.display_name ?? 'Neznámý'}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {ACTION_LABELS[entry.action] ?? entry.action}
                      </span>
                      {target && (
                        <>
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>pro</span>
                          <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                            {target.display_name ?? target.email}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Detail záznamu */}
                    {(details.description || details.duration || details.start_time || details.date) && (
                      <div className="mt-1 flex items-center gap-2 flex-wrap">
                        {details.date && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                            {String(details.date)}
                          </span>
                        )}
                        {details.start_time && details.end_time && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                            {String(details.start_time)} – {String(details.end_time)}
                          </span>
                        )}
                        {typeof details.duration === 'number' && details.duration > 0 && (
                          <span className="text-[11px] font-medium px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-hover)', color: 'var(--primary)' }}>
                            {fmtDuration(details.duration as number)}
                          </span>
                        )}
                        {details.description && (
                          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                            „{String(details.description)}"
                          </span>
                        )}
                      </div>
                    )}

                    {/* Čas události */}
                    <div className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
                      {formatDate(entry.created_at)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function AuditPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  if (authLoading || !user) return null;

  return (
    <WorkspaceProvider>
      <AuditContent />
    </WorkspaceProvider>
  );
}

export default AuditPage;
