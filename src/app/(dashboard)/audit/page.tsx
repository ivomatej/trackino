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
  'edit_entry_for_user': 'Upravil záznam pro uživatele',
  'create_entry_for_user': 'Vytvořil záznam pro uživatele',
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
      <DashboardLayout>
        <div className="max-w-2xl">
          <h1 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Audit log</h1>
          <p style={{ color: 'var(--text-muted)' }}>
            {currentWorkspace?.tariff !== 'max'
              ? 'Audit log je dostupný pouze u tarifu Max.'
              : 'Nemáte oprávnění k audit logu.'}
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl">
        <h1 className="text-xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>Audit log</h1>

        {loadingData ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
            <p className="text-sm">Zatím žádné záznamy v audit logu.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map(entry => {
              const actor = profiles[entry.actor_user_id];
              const target = entry.target_user_id ? profiles[entry.target_user_id] : null;

              return (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 px-4 py-3 rounded-lg border"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
                >
                  {/* Avatar */}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ background: actor?.avatar_color ?? 'var(--primary)' }}
                  >
                    {actor?.display_name?.charAt(0).toUpperCase() ?? '?'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {actor?.display_name ?? 'Neznámý'}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {ACTION_LABELS[entry.action] ?? entry.action}
                      </span>
                      {target && (
                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          → {target.display_name}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {formatDate(entry.created_at)} · {entry.entity_type}
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
