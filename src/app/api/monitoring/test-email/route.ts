// Trackino – Monitoring: testovací email
// POST /api/monitoring/test-email
// Odešle testovací email na ALERT_EMAIL (nebo master admin email) přes Resend API.

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

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'RESEND_API_KEY není nastaven v prostředí.' },
      { status: 400 },
    );
  }

  // Zjisti příjemce
  const alertEmailEnv = process.env.ALERT_EMAIL ?? '';
  let recipientEmail = alertEmailEnv;

  if (!recipientEmail) {
    try {
      const supabase = getSupabaseAdmin();
      const { data } = await supabase
        .from('trackino_profiles')
        .select('email')
        .eq('is_master_admin', true)
        .limit(1)
        .single();
      recipientEmail = data?.email ?? '';
    } catch {
      // Ignorovat
    }
  }

  if (!recipientEmail) {
    return NextResponse.json(
      { error: 'Žádný příjemce – nastavte ALERT_EMAIL nebo přihlaste se jako Master Admin.' },
      { status: 400 },
    );
  }

  const fromAddress = process.env.MONITORING_EMAIL_FROM ?? 'onboarding@resend.dev';
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.trackino.cz').replace(/\/$/, '');
  const now = new Date().toLocaleString('cs-CZ', { timeZone: 'Europe/Prague' });

  const text = [
    'Ahoj,',
    '',
    'toto je testovací email z Trackino Monitoring systému.',
    '',
    `Čas odeslání: ${now}`,
    `Příjemce: ${recipientEmail}`,
    `Odesílatel: ${fromAddress}`,
    '',
    'Pokud jste tento email obdrželi, Resend API je správně nakonfigurováno.',
    '',
    `Monitoring dashboard: ${appUrl}/monitoring`,
    '',
    'Toto je automatická zpráva systému Trackino.',
  ].join('\n');

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #111827;">
  <div style="border-bottom: 2px solid #6366f1; padding-bottom: 16px; margin-bottom: 24px;">
    <h1 style="margin: 0; font-size: 18px; color: #6366f1;">Trackino Monitoring</h1>
    <p style="margin: 4px 0 0; color: #6b7280; font-size: 13px;">Testovací email</p>
  </div>
  <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
    <p style="margin: 0; font-size: 15px; font-weight: 600; color: #166534;">
      Resend API je správně nakonfigurováno.
    </p>
    <p style="margin: 8px 0 0; font-size: 13px; color: #374151;">
      Emailové alerty a týdenní reporty budou odesílány na: <strong>${recipientEmail}</strong>
    </p>
  </div>
  <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px;">
    <tr style="background: #f9fafb;">
      <td style="padding: 8px 12px; color: #6b7280; width: 140px;">Čas odeslání</td>
      <td style="padding: 8px 12px;">${now}</td>
    </tr>
    <tr>
      <td style="padding: 8px 12px; color: #6b7280;">Příjemce</td>
      <td style="padding: 8px 12px;">${recipientEmail}</td>
    </tr>
    <tr style="background: #f9fafb;">
      <td style="padding: 8px 12px; color: #6b7280;">Odesílatel</td>
      <td style="padding: 8px 12px;">${fromAddress}</td>
    </tr>
  </table>
  <a href="${appUrl}/monitoring"
     style="display: inline-block; background: #6366f1; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 600;">
    Otevřít Monitoring Dashboard
  </a>
  <p style="color: #9ca3af; font-size: 12px; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
    Toto je automatická zpráva systému Trackino.
  </p>
</div>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [recipientEmail],
        subject: '[Trackino] Testovací email – Monitoring',
        text,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      // Speciální hlášení pro 403 – nejčastěji neověřená odesílatelská doména
      if (res.status === 403) {
        const domain = fromAddress.includes('@') ? fromAddress.split('@')[1] : fromAddress;
        return NextResponse.json(
          {
            error: `Odesílatelská doména "${domain}" není ověřena v Resend. Ověřte doménu na https://resend.com/domains, nebo nastavte MONITORING_EMAIL_FROM=onboarding@resend.dev pro testování.`,
          },
          { status: 502 },
        );
      }
      return NextResponse.json(
        { error: `Resend API vrátilo chybu ${res.status}: ${err}` },
        { status: 502 },
      );
    }

    const data = await res.json();
    return NextResponse.json({ ok: true, sentTo: recipientEmail, messageId: data.id });
  } catch (err) {
    return NextResponse.json(
      { error: `Síťová chyba při odesílání: ${err}` },
      { status: 500 },
    );
  }
}
