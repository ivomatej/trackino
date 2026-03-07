import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret, parseCronBody, saveCronResult } from '@/lib/cron-handler';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const maxDuration = 60;

/**
 * POST /api/cron/weekly-report
 * Generuje týdenní AI report odpracovaných hodin pro workspace.
 * Volá cron-job.org každé pondělí v 8:00.
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

  // Rozsah: posledních 7 dní
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekAgoIso = weekAgo.toISOString();
  const nowIso = now.toISOString();

  try {
    // Načteme time entries za poslední týden
    const { data: entries } = await supabase
      .from('trackino_time_entries')
      .select(`
        id, duration, start_time, end_time, description,
        user_id,
        trackino_profiles!inner(display_name),
        project_id, trackino_projects(name),
        category_id, trackino_categories(name)
      `)
      .eq('workspace_id', workspaceId)
      .eq('is_running', false)
      .gte('start_time', weekAgoIso)
      .lte('start_time', nowIso)
      .order('start_time', { ascending: false });

    if (!entries || entries.length === 0) {
      await saveCronResult(
        workspaceId,
        'weekly-report',
        'Týdenní report hodin',
        'Žádné záznamy za poslední týden.',
      );
      return NextResponse.json({ ok: true, message: 'Žádné záznamy' });
    }

    // Agregace per user
    const byUser: Record<string, { name: string; seconds: number; entries: number }> = {};
    for (const entry of entries) {
      const uid = entry.user_id as string;
      const name = (entry.trackino_profiles as { display_name?: string } | null)?.display_name ?? uid;
      if (!byUser[uid]) byUser[uid] = { name, seconds: 0, entries: 0 };
      byUser[uid].seconds += (entry.duration as number) ?? 0;
      byUser[uid].entries++;
    }

    const totalSeconds = Object.values(byUser).reduce((s, u) => s + u.seconds, 0);
    const totalHours = (totalSeconds / 3600).toFixed(1);

    // Textový přehled pro AI
    const userLines = Object.values(byUser)
      .sort((a, b) => b.seconds - a.seconds)
      .map(u => `- ${u.name}: ${(u.seconds / 3600).toFixed(1)} h (${u.entries} záznamů)`)
      .join('\n');

    const prompt = `Jsi asistent pro firemní reporting. Na základě dat vygeneruj stručný, přehledný týdenní report odpracovaných hodin v češtině. Bude zobrazen administrátorovi v systému.

Rozsah: ${weekAgo.toLocaleDateString('cs-CZ')} – ${now.toLocaleDateString('cs-CZ')}
Celkem odpracováno: ${totalHours} hodin

Přehled per uživatel:
${userLines}

Vygeneruj report v Markdown formátu: krátký úvod (1–2 věty), tabulka top 5 uživatelů, krátké shrnutí (2–3 věty) s postřehy.`;

    // Volání OpenAI
    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 600,
        temperature: 0.4,
      }),
    });

    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content ?? 'AI report není k dispozici.';

    const weekLabel = `${weekAgo.toLocaleDateString('cs-CZ')} – ${now.toLocaleDateString('cs-CZ')}`;
    await saveCronResult(
      workspaceId,
      'weekly-report',
      `Týdenní report hodin (${weekLabel})`,
      content,
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    await saveCronResult(
      workspaceId,
      'weekly-report',
      'Týdenní report – chyba',
      String(err),
      'error',
    );
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
