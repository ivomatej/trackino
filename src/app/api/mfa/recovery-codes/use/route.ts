import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json() as { code?: string };
    if (!code?.trim()) return NextResponse.json({ error: 'Chybí kód' }, { status: 400 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Načti nepoužité kódy uživatele
    const { data: rows } = await supabase
      .from('trackino_mfa_recovery_codes')
      .select('id, code_hash')
      .eq('user_id', user.id)
      .is('used_at', null);

    if (!rows?.length) return NextResponse.json({ error: 'Žádné záchranné kódy' }, { status: 401 });

    // Najdi matching kód
    const normalized = code.trim().toUpperCase();
    let matchId: string | null = null;
    for (const row of rows) {
      const ok = await bcrypt.compare(normalized, row.code_hash);
      if (ok) { matchId = row.id; break; }
    }

    if (!matchId) return NextResponse.json({ error: 'Neplatný záchranný kód' }, { status: 401 });

    // Označ jako použitý
    await supabase
      .from('trackino_mfa_recovery_codes')
      .update({ used_at: new Date().toISOString() })
      .eq('id', matchId);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
