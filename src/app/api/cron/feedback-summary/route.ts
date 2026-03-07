import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret, parseCronBody, saveCronResult } from '@/lib/cron-handler';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const maxDuration = 60;

/**
 * POST /api/cron/feedback-summary
 * AI shrnutí anonymních připomínek za poslední týden.
 * Volá cron-job.org každý pátek v 16:00.
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

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  try {
    const { data: feedbacks } = await supabase
      .from('trackino_feedback')
      .select('id, message, is_resolved, created_at')
      .eq('workspace_id', workspaceId)
      .gte('created_at', weekAgo.toISOString())
      .order('created_at', { ascending: false });

    const weekLabel = `${weekAgo.toLocaleDateString('cs-CZ')} – ${now.toLocaleDateString('cs-CZ')}`;

    if (!feedbacks || feedbacks.length === 0) {
      await saveCronResult(
        workspaceId,
        'feedback-summary',
        `Shrnutí feedbacku (${weekLabel})`,
        `Žádné připomínky za období ${weekLabel}.`,
      );
      return NextResponse.json({ ok: true });
    }

    const unresolvedCount = feedbacks.filter(f => !f.is_resolved).length;
    const resolvedCount = feedbacks.filter(f => f.is_resolved).length;

    const feedbackTexts = feedbacks
      .map((f, i) => `${i + 1}. ${f.message}`)
      .join('\n');

    const prompt = `Jsi asistent pro analýzu anonymní zpětné vazby zaměstnanců. Analyzuj tyto připomínky a vytvoř strukturovaný report v češtině pro management.

Připomínky (${feedbacks.length} celkem, ${unresolvedCount} nevyřízených, ${resolvedCount} vyřízených):
${feedbackTexts}

Vygeneruj Markdown report s:
1. Krátkým úvodem (1 věta)
2. Hlavními tématy/kategoriemi připomínek (bullet list)
3. Doporučeními pro management (2–3 body)
4. Celkovým hodnocením nálady (Pozitivní/Neutrální/Negativní + krátké zdůvodnění)

Zachovej anonymitu – neodkazuj na konkrétní osoby.`;

    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 700,
        temperature: 0.3,
      }),
    });

    const aiData = await aiRes.json();
    const aiContent = aiData.choices?.[0]?.message?.content ?? 'AI shrnutí není k dispozici.';

    await saveCronResult(
      workspaceId,
      'feedback-summary',
      `Shrnutí feedbacku – AI (${weekLabel})`,
      aiContent,
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    await saveCronResult(
      workspaceId,
      'feedback-summary',
      'Shrnutí feedbacku – chyba',
      String(err),
      'error',
    );
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
