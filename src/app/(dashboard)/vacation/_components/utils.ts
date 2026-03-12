import { supabase } from '@/lib/supabase';

export function calcWorkDays(start: string, end: string): number {
  const cur = new Date(start + 'T12:00:00');
  const end_ = new Date(end + 'T12:00:00');
  if (end_ < cur) return 0;
  let count = 0;
  while (cur <= end_) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export function formatDate(d: string): string {
  const [y, m, day] = d.split('-');
  return `${parseInt(day)}.${parseInt(m)}.${y}`;
}

export const inputCls = 'w-full px-3 py-2.5 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]';
export const inputStyle = { borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' };

export async function syncVacationToPlanner(
  startDate: string,
  endDate: string,
  userId: string,
  workspaceId: string
): Promise<void> {
  const { data: statuses } = await supabase
    .from('trackino_availability_statuses')
    .select('id, name')
    .eq('workspace_id', workspaceId);
  const vs = (statuses ?? []).find((s: { id: string; name: string }) =>
    s.name.trim().toLowerCase() === 'dovolená'
  );
  if (!vs) return;

  const dates: string[] = [];
  const cur = new Date(startDate + 'T12:00:00');
  const end = new Date(endDate + 'T12:00:00');
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  if (dates.length === 0) return;

  await supabase.from('trackino_availability').upsert(
    dates.map(date => ({
      workspace_id: workspaceId,
      user_id: userId,
      date,
      half: 'full',
      status_id: vs.id,
      note: '',
    })),
    { onConflict: 'workspace_id,user_id,date,half' }
  );
}

export async function removeVacationFromPlanner(
  startDate: string,
  endDate: string,
  userId: string,
  workspaceId: string
): Promise<void> {
  const { data: statuses } = await supabase
    .from('trackino_availability_statuses')
    .select('id, name')
    .eq('workspace_id', workspaceId);
  const vs = (statuses ?? []).find((s: { id: string; name: string }) =>
    s.name.trim().toLowerCase() === 'dovolená'
  );
  if (!vs) return;
  await supabase.from('trackino_availability')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('status_id', vs.id)
    .eq('half', 'full')
    .gte('date', startDate)
    .lte('date', endDate);
}
