// Trackino – Monitoring: prahové hodnoty pro alerty
// Snadno měnitelné konstanty. Změna zde se projeví v alertech i dashboardu.

// ─── Velikost databáze ─────────────────────────────────────────────────────
// Supabase Free tier = 500 MB, Pro tier = 8 192 MB
export const DB_SIZE_FREE_LIMIT_MB  = 500;
export const DB_SIZE_PRO_LIMIT_MB   = 8192;

export const DB_SIZE_WARNING_MB      = 400;   // 80 % Free tier (500 MB)
export const DB_SIZE_CRITICAL_MB     = 475;   // 95 % Free tier
export const DB_SIZE_PRO_WARNING_MB  = 6554;  // 80 % Pro tier

// ─── Response times (p95 za poslední 1 hodinu) ─────────────────────────────
export const RESPONSE_TIME_WARNING_MS  = 2000;  // 2 s – varování
export const RESPONSE_TIME_CRITICAL_MS = 5000;  // 5 s – kritické

// ─── Error rate (% chyb za poslední 1 hodinu) ──────────────────────────────
export const ERROR_RATE_WARNING_PCT  = 5;   // 5 %
export const ERROR_RATE_CRITICAL_PCT = 15;  // 15 %

// ─── Počet klientských chyb za hodinu ──────────────────────────────────────
export const ERROR_COUNT_CLIENT_WARNING  = 10;
export const ERROR_COUNT_CLIENT_CRITICAL = 50;

// ─── Anti-spam: minimální interval mezi stejnými alerty ────────────────────
export const ALERT_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hodiny

// ─── Sampling rate pro request metriky v middleware ────────────────────────
// 1.0 = 100 % požadavků (výchozí), snížit na 0.1 při vysokém traffic
export const METRICS_SAMPLE_RATE = 1.0;
