// Trackino – Monitoring: stav konfigurace
// GET /api/monitoring/settings
// Vrátí stav RESEND_API_KEY, cron-job.org API klíče, email příjemce alertů.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  const monitoringSecret = process.env.MONITORING_SECRET;
  const cronSecret = process.env.CRON_SECRET;
  if (monitoringSecret && token === monitoringSecret) return true;
  if (cronSecret && token === cronSecret) return true;
  return false;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // RESEND
  const resendConfigured = !!(process.env.RESEND_API_KEY);
  const resendFrom = process.env.MONITORING_EMAIL_FROM ?? 'onboarding@resend.dev';

  // cron-job.org
  const cronJobApiConfigured = !!(process.env.CRON_JOB_API_KEY);

  // CRON_SECRET
  const cronSecretConfigured = !!(process.env.CRON_SECRET);

  // Alert email
  const alertEmailEnv = process.env.ALERT_EMAIL ?? '';
  let alertEmail = alertEmailEnv;
  let alertEmailSource: 'env' | 'master_admin' | 'none' = alertEmailEnv ? 'env' : 'none';

  if (!alertEmail) {
    try {
      const supabase = getSupabaseAdmin();
      const { data } = await supabase
        .from('trackino_profiles')
        .select('email')
        .eq('is_master_admin', true)
        .limit(1)
        .single();
      if (data?.email) {
        alertEmail = data.email;
        alertEmailSource = 'master_admin';
      }
    } catch {
      // Ignorovat chybu DB – email zůstane prázdný
    }
  }

  // APP_URL pro sestavení cron URL
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');

  return NextResponse.json({
    resendConfigured,
    resendFrom,
    cronJobApiConfigured,
    cronSecretConfigured,
    alertEmail,
    alertEmailSource,
    appUrl,
  });
}
