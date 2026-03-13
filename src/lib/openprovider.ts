// Trackino – Openprovider API klient
// Server-side only – nikdy neimportovat na klientovi (bez 'use client')
// Token se cachuje v paměti procesu (Next.js server instance)

let cachedToken: string | null = null;
let tokenExpiry: number = 0;

function getBaseUrl(): string {
  return process.env.OPENPROVIDER_BASE_URL ?? 'https://api.openprovider.eu/v1beta';
}

/**
 * Získá platný Bearer token – buď z cache nebo zavolá /auth/login.
 * Cache vyprší 1 hodinu před skutečnou expirací (bezpečnostní marže).
 */
async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const res = await fetch(`${getBaseUrl()}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: process.env.OPENPROVIDER_USERNAME,
      password: process.env.OPENPROVIDER_PASSWORD,
    }),
  });

  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(`Openprovider login selhal: ${data.desc ?? 'neznámá chyba'}`);
  }

  cachedToken = data.data.token as string;
  // Token platí ~48h, cachujeme 47h (bezpečnostní marže)
  tokenExpiry = Date.now() + 47 * 60 * 60 * 1000;
  return cachedToken;
}

/**
 * Provedl autorizovaný HTTP požadavek na Openprovider API.
 * Při odpovědi 401 automaticky obnoví token a zopakuje požadavek.
 */
export async function openproviderFetch(
  path: string,
  options?: RequestInit,
): Promise<Response> {
  const baseUrl = getBaseUrl();

  const doFetch = (token: string) =>
    fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options?.headers,
      },
    });

  const token = await getToken();
  const res = await doFetch(token);

  // Auto-refresh při expiraci tokenu
  if (res.status === 401) {
    cachedToken = null;
    tokenExpiry = 0;
    const newToken = await getToken();
    return doFetch(newToken);
  }

  return res;
}

/**
 * Ověří dostupnost Openprovider přihlašovacích údajů z prostředí.
 * Vrátí false pokud chybí env proměnné.
 */
export function hasOpenproviderCredentials(): boolean {
  return Boolean(
    process.env.OPENPROVIDER_USERNAME && process.env.OPENPROVIDER_PASSWORD,
  );
}

/**
 * Parsuje jméno domény z Openprovider formátu ({ name, extension }) na string.
 */
export function formatDomainName(domain: { name?: string; extension?: string } | null | undefined): string {
  if (!domain) return '';
  return `${domain.name ?? ''}.${domain.extension ?? ''}`;
}
