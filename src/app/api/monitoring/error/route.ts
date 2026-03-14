// Trackino – Monitoring: příjem klientských chyb z ErrorBoundary
// POST /api/monitoring/error
// Ukládá chyby do trackino_metrics, jednoduché in-memory rate limiting per IP.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// ─── In-memory rate limiting (bez Upstash aby nevznikla závislost) ───────────
// Max 5 chyb za 60 sekund z jedné IP

const IP_WINDOW_MS = 60_000;
const IP_MAX_ERRORS = 5;

interface RateLimitEntry { count: number; windowStart: number }
const rateLimitMap = new Map<string, RateLimitEntry>();

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now - entry.windowStart > IP_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return false;
  }

  if (entry.count >= IP_MAX_ERRORS) return true;

  entry.count++;
  return false;
}

// Občas pročistit mapu (maximálně 1× za minutu)
let lastCleanup = 0;
function maybeCleanup(): void {
  const now = Date.now();
  if (now - lastCleanup < IP_WINDOW_MS) return;
  lastCleanup = now;
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now - entry.windowStart > IP_WINDOW_MS * 2) {
      rateLimitMap.delete(ip);
    }
  }
}

// ─── POST handler ─────────────────────────────────────────────────────────────

interface ErrorPayload {
  message?: string;
  stack?: string;
  moduleName?: string;
  componentStack?: string;
  url?: string;
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  maybeCleanup();

  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  let payload: ErrorPayload = {};
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const message = String(payload.message ?? '').slice(0, 500);
  if (!message) {
    return NextResponse.json({ error: 'message required' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    await supabase.from('trackino_metrics').insert({
      metric_name: 'client_error',
      metric_value: 1,
      metric_unit: 'errors',
      tags: {
        message,
        module: payload.moduleName ?? null,
        url: payload.url ?? null,
        // Stack trace zkrácen na 1000 znaků
        stack: payload.stack ? String(payload.stack).slice(0, 1000) : null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[Monitoring] Nelze uložit klientskou chybu:', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
