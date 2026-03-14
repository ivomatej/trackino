// Trackino – Monitoring: logika alertů
// Kontrola thresholdů, ukládání do DB, anti-spam ochrana, odesílání emailů.

import { getSupabaseAdmin } from '../supabase-admin';
import { sendAlertEmail } from './email';
import {
  DB_SIZE_WARNING_MB,
  DB_SIZE_CRITICAL_MB,
  ERROR_RATE_WARNING_PCT,
  ERROR_RATE_CRITICAL_PCT,
  ERROR_COUNT_CLIENT_WARNING,
  ERROR_COUNT_CLIENT_CRITICAL,
  ALERT_COOLDOWN_MS,
} from './thresholds';

type Severity = 'info' | 'warning' | 'critical';

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getAlertEmail(): Promise<string> {
  const envEmail = process.env.ALERT_EMAIL;
  if (envEmail) return envEmail;
  // Fallback: email prvního master admina z DB
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('trackino_profiles')
    .select('email')
    .eq('is_master_admin', true)
    .limit(1)
    .single();
  return data?.email ?? '';
}

async function wasAlertRecentlySent(alertType: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const cooldownTime = new Date(Date.now() - ALERT_COOLDOWN_MS).toISOString();
  const { data } = await supabase
    .from('trackino_monitoring_alerts')
    .select('id')
    .eq('alert_type', alertType)
    .gt('created_at', cooldownTime)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

async function saveAlert(
  alertType: string,
  severity: Severity,
  message: string,
  metricValue: number,
  thresholdValue: number,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  await supabase.from('trackino_monitoring_alerts').insert({
    alert_type: alertType,
    severity,
    message,
    metric_value: metricValue,
    threshold_value: thresholdValue,
  });
}

export async function resolveAlerts(alertTypes: string[]): Promise<void> {
  const supabase = getSupabaseAdmin();
  await supabase
    .from('trackino_monitoring_alerts')
    .update({ resolved_at: new Date().toISOString() })
    .in('alert_type', alertTypes)
    .is('resolved_at', null);
}

// ─── DB Size check ───────────────────────────────────────────────────────────

export async function checkDbSizeAlert(sizeMb: number): Promise<void> {
  const isCritical = sizeMb >= DB_SIZE_CRITICAL_MB;
  const isWarning = sizeMb >= DB_SIZE_WARNING_MB;

  if (!isWarning) {
    // Pod thresholdem – vyřešit aktivní alerty
    await resolveAlerts(['db_size_warning', 'db_size_critical']);
    return;
  }

  const alertType = isCritical ? 'db_size_critical' : 'db_size_warning';
  const severity: Severity = isCritical ? 'critical' : 'warning';
  const threshold = isCritical ? DB_SIZE_CRITICAL_MB : DB_SIZE_WARNING_MB;
  const pct = Math.round((sizeMb / 500) * 100);
  const label = isCritical ? '🔴 KRITICKÉ' : '⚠️ VAROVÁNÍ';
  const message = `Velikost DB dosáhla ${sizeMb.toFixed(1)} MB (${pct} % limitu 500 MB Free tier)`;

  if (await wasAlertRecentlySent(alertType)) return;

  await saveAlert(alertType, severity, message, sizeMb, threshold);

  const email = await getAlertEmail();
  if (email) {
    await sendAlertEmail({
      to: email,
      subject: `[Trackino] ${label}: Velikost DB dosáhla ${pct} % limitu`,
      metric: 'Velikost databáze',
      value: `${sizeMb.toFixed(1)} MB (${pct} % limitu 500 MB)`,
      threshold: `${threshold} MB (${isCritical ? 'kritické' : 'varování'})`,
      recommendation: isCritical
        ? 'OKAMŽITĚ upgraduj Supabase plán nebo archivuj stará data! Při překročení 500 MB aplikace přestane přijímat nová data.'
        : 'Zkontroluj growth rate v monitoring dashboardu a zvaž upgrade Supabase plánu nebo archivaci starých záznamů.',
    });
  }
}

// ─── Error rate check ────────────────────────────────────────────────────────

export async function checkErrorRateAlert(
  errorRate: number,
  clientErrorCount: number,
): Promise<void> {
  // Error rate %
  const isRateCritical = errorRate >= ERROR_RATE_CRITICAL_PCT;
  const isRateWarning = errorRate >= ERROR_RATE_WARNING_PCT;

  if (!isRateWarning) {
    await resolveAlerts(['error_rate_warning', 'error_rate_critical']);
  } else {
    const alertType = isRateCritical ? 'error_rate_critical' : 'error_rate_warning';
    const severity: Severity = isRateCritical ? 'critical' : 'warning';
    const threshold = isRateCritical ? ERROR_RATE_CRITICAL_PCT : ERROR_RATE_WARNING_PCT;

    if (!(await wasAlertRecentlySent(alertType))) {
      const message = `Error rate dosáhl ${errorRate.toFixed(1)} % za poslední hodinu`;
      await saveAlert(alertType, severity, message, errorRate, threshold);

      const email = await getAlertEmail();
      if (email) {
        await sendAlertEmail({
          to: email,
          subject: `[Trackino] ${isRateCritical ? '🔴 KRITICKÉ' : '⚠️ VAROVÁNÍ'}: Error rate ${errorRate.toFixed(1)} %`,
          metric: 'Error rate (klientské chyby)',
          value: `${errorRate.toFixed(1)} % chyb za poslední hodinu`,
          threshold: `${threshold} % (${isRateCritical ? 'kritické' : 'varování'})`,
          recommendation: 'Zkontroluj logy klientských chyb v monitoring dashboardu a Supabase logs.',
        });
      }
    }
  }

  // Absolutní počet klientských chyb
  const is5xxCritical = clientErrorCount >= ERROR_COUNT_CLIENT_CRITICAL;
  const is5xxWarning = clientErrorCount >= ERROR_COUNT_CLIENT_WARNING;

  if (!is5xxWarning) {
    await resolveAlerts(['client_error_warning', 'client_error_critical']);
  } else {
    const alertType5xx = is5xxCritical ? 'client_error_critical' : 'client_error_warning';
    if (!(await wasAlertRecentlySent(alertType5xx))) {
      const message = `${clientErrorCount} klientských chyb za poslední hodinu`;
      await saveAlert(
        alertType5xx,
        is5xxCritical ? 'critical' : 'warning',
        message,
        clientErrorCount,
        is5xxCritical ? ERROR_COUNT_CLIENT_CRITICAL : ERROR_COUNT_CLIENT_WARNING,
      );
    }
  }
}
