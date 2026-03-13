// Trackino – Openprovider debug endpoint (DOČASNÝ – smazat po diagnostice)
import { NextResponse } from 'next/server';
import { hasOpenproviderCredentials } from '@/lib/openprovider';

export async function GET() {
  const baseUrl = process.env.OPENPROVIDER_BASE_URL ?? 'https://api.openprovider.eu/v1beta';
  const username = process.env.OPENPROVIDER_USERNAME;
  const password = process.env.OPENPROVIDER_PASSWORD;

  if (!hasOpenproviderCredentials()) {
    return NextResponse.json({ error: 'Chybí env vars', hasUsername: !!username, hasPassword: !!password });
  }

  // 1. Pokus o přihlášení
  let loginData: Record<string, unknown>;
  try {
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    loginData = await loginRes.json() as Record<string, unknown>;
  } catch (err) {
    return NextResponse.json({ step: 'login', error: String(err) });
  }

  if ((loginData as { code?: number }).code !== 0) {
    return NextResponse.json({ step: 'login_failed', openprovider_response: loginData });
  }

  const token = (loginData as { data?: { token?: string } }).data?.token;

  // 2. Pokus o seznam domén
  let domainsData: Record<string, unknown>;
  try {
    const domainsRes = await fetch(`${baseUrl}/domains?limit=5&with_additional_data=0`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    domainsData = await domainsRes.json() as Record<string, unknown>;
  } catch (err) {
    return NextResponse.json({ step: 'domains', login: 'ok', error: String(err) });
  }

  return NextResponse.json({
    login: 'ok',
    token_preview: token ? token.slice(0, 20) + '...' : null,
    domains_response: domainsData,
  });
}
