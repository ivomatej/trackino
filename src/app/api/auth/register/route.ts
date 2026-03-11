// Trackino – Registrace API endpoint s rate limitingem
// Server-side route: kontroluje rate limit dle IP a pak volá Supabase signUp.

import { rateLimitRegister } from '@/lib/rate-limit';
import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  // Rate limiting dle IP adresy
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'anonymous';

  const { success } = await rateLimitRegister.limit(ip);
  if (!success) {
    return Response.json(
      { error: 'Příliš mnoho pokusů o registraci. Zkuste to za hodinu.' },
      { status: 429 }
    );
  }

  const body = (await req.json()) as {
    email?: string;
    password?: string;
    displayName?: string;
  };

  const { email, password, displayName } = body;

  if (!email || !password || !displayName) {
    return Response.json({ error: 'Chybí povinné parametry.' }, { status: 400 });
  }

  // Zavolej Supabase signup přes anon klient (stejný tok jako dříve)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return Response.json({ error: 'Supabase není nakonfigurován.' }, { status: 503 });
  }

  const supabase = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
    },
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ session: data.session, user: data.user });
}
