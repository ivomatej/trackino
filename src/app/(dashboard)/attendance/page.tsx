'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { WorkspaceProvider, useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import DashboardLayout from '@/components/DashboardLayout';
import WorkspaceSelector from '@/components/WorkspaceSelector';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import type { TimeEntry } from '@/types/database';
import { getWorkspaceToday } from '@/lib/utils';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay(); // 0=Sun, 1=Mon...
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d: Date, n: number): Date {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date;
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatHM(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

function formatWeekLabel(start: Date): string {
  const end = addDays(start, 6);
  const fmtDay = (d: Date) =>
    d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' });
  const fmtFull = (d: Date) =>
    d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
  return `${fmtDay(start)} – ${fmtFull(end)}`;
}

const DAY_LABELS_SHORT = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];

// ─── Types ───────────────────────────────────────────────────────────────────

interface MemberRow {
  userId: string;
  displayName: string;
  avatarColor: string;
  initials: string;
}

// ─── Main content ────────────────────────────────────────────────────────────

function AttendanceContent() {
  const { user } = useAuth();
  const { currentWorkspace, loading, managerAssignments, isManagerOf } = useWorkspace();
  const { isWorkspaceAdmin, isMasterAdmin, isManager } = usePermissions();

  const canAdmin = isWorkspaceAdmin || isMasterAdmin;

  // Dnešní datum v timezone workspace (YYYY-MM-DD)
  const workspaceTodayStr = getWorkspaceToday(currentWorkspace?.timezone ?? 'Europe/Prague');
  const isToday = (d: Date) => toDateStr(d) === workspaceTodayStr;

  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [rowOrder, setRowOrder] = useState<string[]>([]);
  const [hoursMap, setHoursMap] = useState<Record<string, Record<string, number>>>({});
  const [loadingData, setLoadingData] = useState(true);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEndStr = toDateStr(addDays(weekStart, 6)) + 'T23:59:59';
  const weekStartStr = toDateStr(weekStart) + 'T00:00:00';

  // ─── Load visible members ─────────────────────────────────────────────────

  const fetchMembers = useCallback(async () => {
    if (!currentWorkspace || !user) return;

    const { data: memberData } = await supabase
      .from('trackino_workspace_members')
      .select('user_id, role')
      .eq('workspace_id', currentWorkspace.id)
      .eq('approved', true);

    const allMembers = memberData ?? [];

    // Determine visible user IDs
    let visibleUserIds: string[];
    if (canAdmin) {
      visibleUserIds = allMembers.map((m: { user_id: string; role: string }) => m.user_id);
    } else if (isManager) {
      const subordinateIds = managerAssignments.map(a => a.member_user_id);
      visibleUserIds = Array.from(new Set([user.id, ...subordinateIds]));
    } else {
      visibleUserIds = [user.id];
    }

    // Fetch profiles
    const { data: profiles } = await supabase
      .from('trackino_profiles')
      .select('id, display_name, avatar_color')
      .in('id', visibleUserIds);

    const profileMap: Record<string, { display_name: string; avatar_color: string }> = {};
    (profiles ?? []).forEach((p: { id: string; display_name: string; avatar_color: string }) => {
      profileMap[p.id] = p;
    });

    const rows: MemberRow[] = visibleUserIds
      .filter(uid => profileMap[uid])
      .map(uid => {
        const p = profileMap[uid];
        const name = p.display_name || '?';
        return {
          userId: uid,
          displayName: name,
          avatarColor: p.avatar_color || '#6366f1',
          initials: name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2),
        };
      });

    setMembers(rows);

    // Restore or init row order from localStorage
    const storageKey = `trackino_attendance_order_${currentWorkspace.id}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const savedOrder: string[] = JSON.parse(saved);
        // Keep saved order but add new users at the end, remove users no longer visible
        const validIds = new Set(rows.map(r => r.userId));
        const filtered = savedOrder.filter(id => validIds.has(id));
        const newIds = rows.map(r => r.userId).filter(id => !filtered.includes(id));
        setRowOrder([...filtered, ...newIds]);
      } catch {
        setRowOrder(rows.map(r => r.userId));
      }
    } else {
      setRowOrder(rows.map(r => r.userId));
    }

    return visibleUserIds;
  }, [currentWorkspace, user, canAdmin, isManager, managerAssignments]);

  // ─── Load time entries ────────────────────────────────────────────────────

  const fetchEntries = useCallback(async (visibleUserIds: string[]) => {
    if (!currentWorkspace || visibleUserIds.length === 0) return;

    const { data } = await supabase
      .from('trackino_time_entries')
      .select('user_id, start_time, duration')
      .eq('workspace_id', currentWorkspace.id)
      .eq('is_running', false)
      .gte('start_time', weekStartStr)
      .lte('start_time', weekEndStr)
      .in('user_id', visibleUserIds);

    const map: Record<string, Record<string, number>> = {};
    (data ?? []).forEach((e: Pick<TimeEntry, 'user_id' | 'start_time' | 'duration'>) => {
      const dateStr = e.start_time.slice(0, 10);
      if (!map[e.user_id]) map[e.user_id] = {};
      map[e.user_id][dateStr] = (map[e.user_id][dateStr] ?? 0) + (e.duration ?? 0);
    });

    setHoursMap(map);
  }, [currentWorkspace, weekStartStr, weekEndStr]);

  // ─── Combined fetch ───────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoadingData(true);
    const ids = await fetchMembers();
    if (ids && ids.length > 0) await fetchEntries(ids);
    setLoadingData(false);
  }, [fetchMembers, fetchEntries]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ─── Row reorder ──────────────────────────────────────────────────────────

  const moveRow = (userId: string, dir: 'up' | 'down') => {
    setRowOrder(prev => {
      const idx = prev.indexOf(userId);
      if (idx === -1) return prev;
      const next = [...prev];
      const swap = dir === 'up' ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      if (currentWorkspace) {
        localStorage.setItem(`trackino_attendance_order_${currentWorkspace.id}`, JSON.stringify(next));
      }
      return next;
    });
  };

  // ─── Computed ─────────────────────────────────────────────────────────────

  const orderedMembers = rowOrder
    .map(uid => members.find(m => m.userId === uid))
    .filter(Boolean) as MemberRow[];

  const dayTotals: Record<string, number> = {};
  weekDays.forEach(day => {
    const ds = toDateStr(day);
    dayTotals[ds] = orderedMembers.reduce((sum, m) => sum + (hoursMap[m.userId]?.[ds] ?? 0), 0);
  });
  const grandTotal = Object.values(dayTotals).reduce((a, b) => a + b, 0);

  const isWeekend = (d: Date) => {
    const day = d.getDay();
    return day === 0 || day === 6;
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-main)' }}>
        <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!currentWorkspace) return <WorkspaceSelector />;

  const cellW = 'minWidth: 90px';

  return (
    <DashboardLayout>
      <div style={{ maxWidth: '100%' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Přehled hodin</h1>
          {/* Week navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekStart(w => addDays(w, -7))}
              className="px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--bg-card)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-card)'; }}
            >
              ← Předchozí
            </button>
            <button
              onClick={() => setWeekStart(getMonday(new Date(workspaceTodayStr + 'T12:00:00')))}
              className="px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--bg-card)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-card)'; }}
            >
              Dnes
            </button>
            <button
              onClick={() => setWeekStart(w => addDays(w, 7))}
              className="px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--bg-card)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-card)'; }}
            >
              Další →
            </button>
          </div>
        </div>

        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
          Týden: {formatWeekLabel(weekStart)}
        </p>

        {loadingData ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-12 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Žádní viditelní členové.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <table className="w-full border-collapse" style={{ minWidth: 780 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  {/* Reorder buttons + name column */}
                  <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)', minWidth: 160 }}>
                    Člen
                  </th>
                  {/* Day columns */}
                  {weekDays.map((day, i) => (
                    <th
                      key={i}
                      className="px-3 py-3 text-center text-xs font-semibold"
                      style={{
                        color: isToday(day) ? 'var(--primary)' : isWeekend(day) ? 'var(--text-muted)' : 'var(--text-secondary)',
                        background: isWeekend(day) ? 'var(--bg-hover)' : 'transparent',
                        minWidth: 90,
                      }}
                    >
                      <div>{DAY_LABELS_SHORT[i]}</div>
                      <div className="font-normal mt-0.5" style={{ fontSize: 10 }}>
                        {day.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' })}
                      </div>
                    </th>
                  ))}
                  {/* Weekly total */}
                  <th className="px-3 py-3 text-center text-xs font-semibold" style={{ color: 'var(--text-muted)', minWidth: 72 }}>
                    Celkem
                  </th>
                </tr>
              </thead>
              <tbody>
                {orderedMembers.map((member, rowIdx) => {
                  const userTotal = weekDays.reduce(
                    (sum, day) => sum + (hoursMap[member.userId]?.[toDateStr(day)] ?? 0),
                    0
                  );
                  return (
                    <tr
                      key={member.userId}
                      style={{ borderBottom: '1px solid var(--border)' }}
                    >
                      {/* Member name + reorder buttons */}
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          {/* Up/Down arrows */}
                          <div className="flex flex-col gap-0.5">
                            <button
                              onClick={() => moveRow(member.userId, 'up')}
                              disabled={rowIdx === 0}
                              className="p-0.5 rounded transition-colors disabled:opacity-20"
                              style={{ color: 'var(--text-muted)' }}
                              onMouseEnter={e => { if (rowIdx > 0) e.currentTarget.style.color = 'var(--primary)'; }}
                              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                              title="Přesunout nahoru"
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="18 15 12 9 6 15" />
                              </svg>
                            </button>
                            <button
                              onClick={() => moveRow(member.userId, 'down')}
                              disabled={rowIdx === orderedMembers.length - 1}
                              className="p-0.5 rounded transition-colors disabled:opacity-20"
                              style={{ color: 'var(--text-muted)' }}
                              onMouseEnter={e => { if (rowIdx < orderedMembers.length - 1) e.currentTarget.style.color = 'var(--primary)'; }}
                              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                              title="Přesunout dolů"
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="6 9 12 15 18 9" />
                              </svg>
                            </button>
                          </div>
                          {/* Avatar */}
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                            style={{ background: member.avatarColor }}
                          >
                            {member.initials}
                          </div>
                          {/* Name */}
                          <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)', maxWidth: 100 }}>
                            {member.displayName}
                          </span>
                        </div>
                      </td>

                      {/* Day cells */}
                      {weekDays.map((day, di) => {
                        const ds = toDateStr(day);
                        const secs = hoursMap[member.userId]?.[ds] ?? 0;
                        return (
                          <td
                            key={di}
                            className="px-2 py-2 text-center"
                            style={{
                              background: isWeekend(day) ? 'var(--bg-hover)' : 'transparent',
                            }}
                          >
                            {secs > 0 ? (
                              <span
                                className="inline-block px-2 py-1 rounded-md text-xs font-semibold"
                                style={{
                                  background: member.avatarColor + '1f',
                                  color: member.avatarColor,
                                  minWidth: 48,
                                }}
                              >
                                {formatHM(secs)}
                              </span>
                            ) : (
                              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>–</span>
                            )}
                          </td>
                        );
                      })}

                      {/* Weekly total */}
                      <td className="px-3 py-2 text-center">
                        {userTotal > 0 ? (
                          <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {formatHM(userTotal)}
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>–</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {/* Summary row */}
                {orderedMembers.length > 1 && (
                  <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg-hover)' }}>
                    <td className="px-4 py-2.5">
                      <span className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>Σ Celkem</span>
                    </td>
                    {weekDays.map((day, di) => {
                      const ds = toDateStr(day);
                      const total = dayTotals[ds] ?? 0;
                      return (
                        <td key={di} className="px-2 py-2.5 text-center">
                          {total > 0 ? (
                            <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                              {formatHM(total)}
                            </span>
                          ) : (
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>–</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2.5 text-center">
                      <span className="text-xs font-bold" style={{ color: 'var(--primary)' }}>
                        {grandTotal > 0 ? formatHM(grandTotal) : '–'}
                      </span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

// ─── Page wrapper ─────────────────────────────────────────────────────────────

function AttendancePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);
  if (authLoading || !user) return null;
  return <WorkspaceProvider><AttendanceContent /></WorkspaceProvider>;
}

export default AttendancePage;
