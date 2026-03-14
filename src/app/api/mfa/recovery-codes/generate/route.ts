import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

function genCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${seg()}-${seg()}-${seg()}`;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Vygeneruj 8 recovery kódů
    const plainCodes = Array.from({ length: 8 }, genCode);
    const hashes = await Promise.all(plainCodes.map(c => bcrypt.hash(c, 10)));

    // Smaž staré kódy a vlož nové
    await supabase.from('trackino_mfa_recovery_codes').delete().eq('user_id', user.id);
    const rows = hashes.map(code_hash => ({ user_id: user.id, code_hash }));
    const { error: insertErr } = await supabase.from('trackino_mfa_recovery_codes').insert(rows);
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

    return NextResponse.json({ codes: plainCodes });
  } catch (e) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
