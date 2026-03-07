import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret, parseCronBody, saveCronResult } from '@/lib/cron-handler';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const maxDuration = 30;

/**
 * POST /api/cron/kb-reviews-digest
 * Shrnutí revizí znalostní báze splatných v příštích 7 dnech.
 * Volá cron-job.org každé pondělí v 7:00.
 *
 * Body: { workspace_id: string }
 */
export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let workspaceId: string;
  try {
    ({ workspaceId } = await parseCronBody(request));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const nextWeekStr = nextWeek.toISOString().split('T')[0];

  try {
    // Revize splatné dnes a v příštích 7 dnech (nesplněné)
    const { data: upcoming } = await supabase
      .from('trackino_kb_reviews')
      .select(`
        id, review_date, note, is_done,
        assigned_to,
        trackino_profiles!trackino_kb_reviews_assigned_to_fkey(display_name),
        page_id,
        trackino_kb_pages(title)
      `)
      .eq('workspace_id', workspaceId)
      .eq('is_done', false)
      .gte('review_date', todayStr)
      .lte('review_date', nextWeekStr)
      .order('review_date', { ascending: true });

    // Revize po splatnosti (overdue)
    const { data: overdue } = await supabase
      .from('trackino_kb_reviews')
      .select(`
        id, review_date, note, is_done,
        assigned_to,
        trackino_profiles!trackino_kb_reviews_assigned_to_fkey(display_name),
        page_id,
        trackino_kb_pages(title)
      `)
      .eq('workspace_id', workspaceId)
      .eq('is_done', false)
      .lt('review_date', todayStr)
      .order('review_date', { ascending: true });

    const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('cs-CZ');

    let content = '';

    if (overdue && overdue.length > 0) {
      const lines = overdue.map(r => {
        const person = (r.trackino_profiles as { display_name?: string } | null)?.display_name ?? '—';
        const page = (r.trackino_kb_pages as { title?: string } | null)?.title ?? r.page_id;
        return `- ❗ **${page}** – přiřazeno: ${person}, splatnost: ${fmtDate(r.review_date as string)}${r.note ? ` – _${r.note}_` : ''}`;
      });
      content += `## Po splatnosti (${overdue.length})\n\n${lines.join('\n')}\n\n`;
    }

    if (upcoming && upcoming.length > 0) {
      const lines = upcoming.map(r => {
        const person = (r.trackino_profiles as { display_name?: string } | null)?.display_name ?? '—';
        const page = (r.trackino_kb_pages as { title?: string } | null)?.title ?? r.page_id;
        return `- 📅 **${page}** – přiřazeno: ${person}, splatnost: ${fmtDate(r.review_date as string)}${r.note ? ` – _${r.note}_` : ''}`;
      });
      content += `## Nadcházející revize (${upcoming.length})\n\n${lines.join('\n')}\n`;
    }

    if (!content) {
      content = `✅ Žádné nevyřízené revize v znalostní bázi pro období ${fmtDate(todayStr)} – ${fmtDate(nextWeekStr)}.`;
    }

    await saveCronResult(
      workspaceId,
      'kb-reviews-digest',
      `Digest revizí KB (${fmtDate(todayStr)} – ${fmtDate(nextWeekStr)})`,
      content,
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    await saveCronResult(
      workspaceId,
      'kb-reviews-digest',
      'Digest revizí KB – chyba',
      String(err),
      'error',
    );
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
