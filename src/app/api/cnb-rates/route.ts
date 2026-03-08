import { NextResponse } from 'next/server';

/**
 * GET /api/cnb-rates
 * Stáhne aktuální kurzovní lístek ČNB a vrátí kurzy pro EUR a USD.
 * ČNB API: https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/denni_kurz.txt
 */
export async function GET() {
  try {
    const res = await fetch(
      'https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/denni_kurz.txt',
      { next: { revalidate: 3600 } } // cache 1 hodinu
    );

    if (!res.ok) {
      return NextResponse.json({ error: 'Nepodařilo se načíst kurzy z ČNB' }, { status: 502 });
    }

    const text = await res.text();
    const lines = text.split('\n');

    // Formát řádku: země|měna|množství|kód|kurz
    // Příklad: USA|dolar|1|USD|23,456
    const rates: Record<string, number> = { CZK: 1 };

    for (const line of lines) {
      const parts = line.split('|');
      if (parts.length >= 5) {
        const code = parts[3]?.trim();
        const amount = parseInt(parts[2]?.trim() ?? '1', 10);
        const rate = parseFloat((parts[4]?.trim() ?? '0').replace(',', '.'));
        if (code && !isNaN(rate) && !isNaN(amount) && amount > 0) {
          rates[code] = rate / amount;
        }
      }
    }

    return NextResponse.json({
      rates: {
        CZK: 1,
        EUR: rates['EUR'] ?? null,
        USD: rates['USD'] ?? null,
      },
      date: lines[0]?.trim() ?? '',
    });
  } catch {
    return NextResponse.json({ error: 'Chyba při načítání kurzů ČNB' }, { status: 500 });
  }
}
