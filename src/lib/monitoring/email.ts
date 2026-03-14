// Trackino – Monitoring: odesílání emailových alertů přes Resend API
// Vyžaduje: RESEND_API_KEY, ALERT_EMAIL v environment variables

export interface AlertEmailOptions {
  to: string;
  subject: string;
  metric: string;
  value: string;
  threshold: string;
  recommendation: string;
}

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.trackino.cz';
}

function getFromAddress(): string {
  // Resend vyžaduje doménu ověřenou ve vašem účtu.
  // Pokud nemáte vlastní doménu, použijte: onboarding@resend.dev (sandbox)
  return process.env.MONITORING_EMAIL_FROM ?? 'onboarding@resend.dev';
}

function nowCzech(): string {
  return new Date().toLocaleString('cs-CZ', { timeZone: 'Europe/Prague' });
}

// ─── Alert email ────────────────────────────────────────────────────────────

export async function sendAlertEmail(opts: AlertEmailOptions): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[Monitoring] RESEND_API_KEY není nastaven – email nebude odeslán');
    return;
  }

  const appUrl = getAppUrl();
  const now = nowCzech();

  const text = [
    'Ahoj,',
    '',
    'monitoring Trackino zaznamenal překročení prahové hodnoty:',
    '',
    `Metrika:    ${opts.metric}`,
    `Hodnota:    ${opts.value}`,
    `Threshold:  ${opts.threshold}`,
    `Čas:        ${now}`,
    '',
    'Doporučené kroky:',
    opts.recommendation,
    '',
    `Monitoring dashboard: ${appUrl}/monitoring`,
    '',
    'Toto je automatická zpráva systému Trackino.',
  ].join('\n');

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #111827;">
  <div style="border-bottom: 2px solid #6366f1; padding-bottom: 16px; margin-bottom: 24px;">
    <h1 style="margin: 0; font-size: 18px; color: #6366f1;">Trackino Monitoring</h1>
    <p style="margin: 4px 0 0; color: #6b7280; font-size: 13px;">Automatické upozornění</p>
  </div>
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
    <tr>
      <td style="padding: 8px 12px; color: #6b7280; white-space: nowrap; width: 120px;">Metrika</td>
      <td style="padding: 8px 12px; font-weight: 600;">${opts.metric}</td>
    </tr>
    <tr style="background: #fef9c3;">
      <td style="padding: 8px 12px; color: #6b7280;">Hodnota</td>
      <td style="padding: 8px 12px; font-weight: 700; color: #b45309;">${opts.value}</td>
    </tr>
    <tr>
      <td style="padding: 8px 12px; color: #6b7280;">Threshold</td>
      <td style="padding: 8px 12px;">${opts.threshold}</td>
    </tr>
    <tr style="background: #f9fafb;">
      <td style="padding: 8px 12px; color: #6b7280;">Čas</td>
      <td style="padding: 8px 12px;">${now}</td>
    </tr>
  </table>
  <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 14px; margin-bottom: 20px; font-size: 14px;">
    <strong style="color: #991b1b;">Doporučené kroky:</strong><br/>
    <span style="color: #374151;">${opts.recommendation}</span>
  </div>
  <a href="${appUrl}/monitoring" style="display: inline-block; background: #6366f1; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 600;">
    Otevřít Monitoring Dashboard
  </a>
  <p style="color: #9ca3af; font-size: 12px; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
    Toto je automatická zpráva systému Trackino. Alerty jsou odesílány max. 1× za 4 hodiny.
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
        from: getFromAddress(),
        to: [opts.to],
        subject: opts.subject,
        text,
        html,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('[Monitoring] Resend API chyba:', res.status, err);
    }
  } catch (err) {
    console.error('[Monitoring] Nelze odeslat alert email:', err);
  }
}

// ─── Týdenní report email ────────────────────────────────────────────────────

export interface WeeklyReportOptions {
  to: string;
  weekNumber: number;
  year: number;
  dbSizeMb: number;
  dbSizeChangeMb: number;
  avgResponseMs: number | null;
  errorCount: number;
  workspaceCount: number;
  userCount: number;
  topTables: Array<{ name: string; sizeMb: number; rowCount: number }>;
  unresolvedAlerts: number;
}

export async function sendWeeklyReport(opts: WeeklyReportOptions): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[Monitoring] RESEND_API_KEY není nastaven – weekly report nebude odeslán');
    return;
  }

  const appUrl = getAppUrl();
  const trend = opts.dbSizeChangeMb >= 0
    ? `+${opts.dbSizeChangeMb.toFixed(1)}`
    : opts.dbSizeChangeMb.toFixed(1);
  const pct = Math.round((opts.dbSizeMb / 500) * 100);

  const alertSection = opts.unresolvedAlerts > 0
    ? `⚠️  NEVYŘEŠENÉ ALERTY: ${opts.unresolvedAlerts}\nZkontroluj: ${appUrl}/monitoring`
    : '✅  Žádné aktivní alerty';

  const topTablesText = opts.topTables.slice(0, 3)
    .map(t => `  ${t.name}: ${t.sizeMb.toFixed(2)} MB (${t.rowCount.toLocaleString('cs')} řádků)`)
    .join('\n');

  const text = [
    `Týdenní přehled systému Trackino – týden ${opts.weekNumber}/${opts.year}`,
    '',
    '📊 DATABÁZE',
    `  Aktuální velikost: ${opts.dbSizeMb.toFixed(1)} MB (${trend} MB za týden)`,
    `  Využití limitu:    ${pct}% (Free tier 500 MB)`,
    '',
    '⚡ VÝKON',
    opts.avgResponseMs !== null
      ? `  Průměrný response time: ${opts.avgResponseMs} ms`
      : '  Průměrný response time: data nedostupná',
    `  Chyby celkem za týden:  ${opts.errorCount}`,
    '',
    '👥 UŽIVATELÉ',
    `  Aktivní workspace:  ${opts.workspaceCount}`,
    `  Celkem uživatelů:   ${opts.userCount}`,
    '',
    '📋 TOP 3 NEJVĚTŠÍ TABULKY',
    topTablesText || '  Data nedostupná',
    '',
    alertSection,
    '',
    `Monitoring dashboard: ${appUrl}/monitoring`,
    '',
    'Trackino – automatická zpráva, každé pondělí v 8:00',
  ].join('\n');

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: getFromAddress(),
        to: [opts.to],
        subject: `[Trackino] Týdenní přehled systému – týden ${opts.weekNumber}/${opts.year}`,
        text,
      }),
    });
  } catch (err) {
    console.error('[Monitoring] Weekly report email failed:', err);
  }
}
