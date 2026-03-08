import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const CNB_URL =
  'https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/denni_kurz.txt';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * GET /api/cnb-rates
 * Vrátí kurzy EUR a USD k CZK.
 * Lazy DB cache: kurzy se stáhnou z ČNB max jednou denně a uloží do trackino_exchange_rates.
 */
export async function GET() {
  try {
    const today = todayStr();
    const sb = getSupabaseAdmin();

    // 1. Zkusit cache v DB
    const { data: cached } = await sb
      .from('trackino_exchange_rates')
      .select('currency, rate')
      .eq('date', today)
      .in('currency', ['EUR', 'USD']);

    if (cached && cached.length >= 2) {
      const rates: Record<string, number | null> = { CZK: 1, EUR: null, USD: null };
      for (const r of cached) {
        rates[r.currency] = Number(r.rate);
      }
      return NextResponse.json({ rates, date: today, source: 'cache' });
    }

    // 2. Stáhnout z ČNB
    const res = await fetch(CNB_URL, { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json({ error: 'Nepodařilo se načíst kurzy z ČNB' }, { status: 502 });
    }

    const text = await res.text();
    const lines = text.split('\n');

    // Formát řádku: země|měna|množství|kód|kurz
    const parsed: Record<string, number> = {};
    for (const line of lines) {
      const parts = line.split('|');
      if (parts.length >= 5) {
        const code = parts[3]?.trim();
        const amount = parseInt(parts[2]?.trim() ?? '1', 10);
        const rate = parseFloat((parts[4]?.trim() ?? '0').replace(',', '.'));
        if (code && !isNaN(rate) && !isNaN(amount) && amount > 0) {
          parsed[code] = rate / amount;
        }
      }
    }

    // 3. Uložit EUR a USD do DB (upsert)
    const toInsert: { date: string; currency: string; rate: number }[] = [];
    for (const cur of ['EUR', 'USD'] as const) {
      if (parsed[cur]) {
        toInsert.push({ date: today, currency: cur, rate: parsed[cur] });
      }
    }

    if (toInsert.length > 0) {
      await sb
        .from('trackino_exchange_rates')
        .upsert(toInsert, { onConflict: 'date,currency' });
    }

    return NextResponse.json({
      rates: {
        CZK: 1,
        EUR: parsed['EUR'] ?? null,
        USD: parsed['USD'] ?? null,
      },
      date: today,
      source: 'cnb',
    });
  } catch {
    return NextResponse.json({ error: 'Chyba při načítání kurzů ČNB' }, { status: 500 });
  }
}
