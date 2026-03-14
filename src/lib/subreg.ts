// Trackino – Subreg.cz SOAP API klient
// Dokumentace: https://subreg.cz/wsdl
// Endpoint produkce: https://soap.subreg.cz/cmd.php
// Autentizace: Login → ssid (session token, cachujeme 20 minut)
// ⚠️  Server-side only – nikdy neimportovat na klientovi

const SUBREG_ENDPOINT = 'https://soap.subreg.cz/cmd.php';

// ─── ssid cache (per Node.js process) ────────────────────────────────────────
let _cachedSsid: string | null = null;
let _ssidExpiry = 0;
const SSID_TTL_MS = 20 * 60 * 1000; // 20 minut

// ─── XML helpers ──────────────────────────────────────────────────────────────
function escXml(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Extrahuje hodnotu prvního XML tagu s daným názvem (case-insensitive, ignoruje atributy) */
function extractXmlTag(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = xml.match(re);
  return m ? m[1].trim() : null;
}

function buildSoapXml(command: string, data: Record<string, string>): string {
  const fields = Object.entries(data)
    .map(([k, v]) => `<${k}>${escXml(v)}</${k}>`)
    .join('');
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="http://soap.subreg.cz/soap">` +
    `<SOAP-ENV:Body><ns1:${command}><data>${fields}</data></ns1:${command}></SOAP-ENV:Body>` +
    `</SOAP-ENV:Envelope>`
  );
}

async function subregFetch(command: string, data: Record<string, string>): Promise<string> {
  const body = buildSoapXml(command, data);
  const res = await fetch(SUBREG_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': `"${command}"`,
    },
    body,
    signal: AbortSignal.timeout(10000),
  });
  return res.text();
}

// ─── Veřejné utility funkce ──────────────────────────────────────────────────

/** Vrátí true pokud jsou env vars SUBREG_LOGIN + SUBREG_PASSWORD nastaveny */
export function hasSubregCredentials(): boolean {
  return !!(process.env.SUBREG_LOGIN && process.env.SUBREG_PASSWORD);
}

/** Reset ssid cache – volat při chybě autentizace (expired ssid) */
export function resetSubregSsid(): void {
  _cachedSsid = null;
  _ssidExpiry = 0;
}

/**
 * Přihlásí se k Subreg a vrátí ssid (session token).
 * Token je cachován po dobu 20 minut v paměti serverového procesu.
 */
export async function getSubregSsid(): Promise<string | null> {
  // Vrátit z cache pokud platný
  if (_cachedSsid && Date.now() < _ssidExpiry) return _cachedSsid;

  const login = process.env.SUBREG_LOGIN;
  const password = process.env.SUBREG_PASSWORD;
  if (!login || !password) return null;

  try {
    const xml = await subregFetch('Login', { login, password });
    const status = extractXmlTag(xml, 'status');
    if (status !== 'ok') {
      console.error('[subreg] Login failed, status:', status);
      return null;
    }
    const ssid = extractXmlTag(xml, 'ssid');
    if (!ssid) {
      console.error('[subreg] No ssid in Login response');
      return null;
    }
    _cachedSsid = ssid;
    _ssidExpiry = Date.now() + SSID_TTL_MS;
    return ssid;
  } catch (err) {
    console.error('[subreg] Login error:', err);
    return null;
  }
}

export type SubregAvailability = 'free' | 'active' | 'error' | 'unknown';

/**
 * Zjistí dostupnost domény přes Subreg Check_Domain příkaz.
 * avail=1 → 'free', avail=0 → 'active', jinak 'unknown', chyba → 'error'
 *
 * @param name      část před tečkou (např. "example")
 * @param extension TLD bez tečky (např. "cz")
 */
export async function subregCheckDomain(
  name: string,
  extension: string,
): Promise<SubregAvailability> {
  const ssid = await getSubregSsid();
  if (!ssid) return 'error';

  const domain = `${name}.${extension}`;
  try {
    const xml = await subregFetch('Check_Domain', { ssid, domain });
    const status = extractXmlTag(xml, 'status');
    if (status !== 'ok') {
      // Exspirovaný nebo neplatný ssid → reset pro příští volání
      resetSubregSsid();
      return 'error';
    }
    const avail = extractXmlTag(xml, 'avail');
    if (avail === '1') return 'free';
    if (avail === '0') return 'active';
    return 'unknown';
  } catch (err) {
    console.error(`[subreg] Check_Domain error for ${domain}:`, err);
    return 'error';
  }
}
