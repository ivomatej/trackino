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

  // 1. Login
  let token: string | null = null;
  try {
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const loginData = await loginRes.json() as { code: number; data?: { token?: string }; desc?: string };
    if (loginData.code !== 0) {
      return NextResponse.json({ step: 'login_failed', response: loginData });
    }
    token = loginData.data?.token ?? null;
  } catch (err) {
    return NextResponse.json({ step: 'login_error', error: String(err) });
  }

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // 2. Zkus různé variace GET /domains
  const variants: Record<string, unknown> = {};

  // Varianta A: bez parametrů
  try {
    const r = await fetch(`${baseUrl}/domains`, { headers });
    variants['a_no_params'] = await r.json();
  } catch (e) { variants['a_no_params'] = String(e); }

  // Varianta B: jen limit
  try {
    const r = await fetch(`${baseUrl}/domains?limit=5`, { headers });
    variants['b_limit_only'] = await r.json();
  } catch (e) { variants['b_limit_only'] = String(e); }

  // Varianta C: s offset
  try {
    const r = await fetch(`${baseUrl}/domains?limit=5&offset=0`, { headers });
    variants['c_limit_offset'] = await r.json();
  } catch (e) { variants['c_limit_offset'] = String(e); }

  // Varianta D: account info
  try {
    const r = await fetch(`${baseUrl}/customers/me`, { headers });
    variants['d_customers_me'] = await r.json();
  } catch (e) { variants['d_customers_me'] = String(e); }

  // Varianta E: resellers/me (pro info)
  try {
    const r = await fetch(`${baseUrl}/resellers/me`, { headers });
    variants['e_resellers_me'] = await r.json();
  } catch (e) { variants['e_resellers_me'] = String(e); }

  // Varianta F: kontrola dostupnosti domény
  try {
    const r = await fetch(`${baseUrl}/domains/check`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ domains: [{ name: 'test', extension: 'cz' }] }),
    });
    variants['f_domain_check'] = await r.json();
  } catch (e) { variants['f_domain_check'] = String(e); }

  return NextResponse.json({ login: 'ok', token_preview: token?.slice(0, 20) + '...', variants });
}
