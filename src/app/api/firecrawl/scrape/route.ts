// Trackino – Firecrawl Scrape API endpoint
// Serverová route – API klíč je bezpečně na serveru, nikdy v prohlížeči.
// Převádí URL na čistý Markdown pomocí Firecrawl API.

import { rateLimitFirecrawl } from '@/lib/rate-limit';
import type { NextRequest } from 'next/server';

interface FirecrawlScrapeResponse {
  success: boolean;
  data?: {
    markdown?: string;
    metadata?: {
      title?: string;
      description?: string;
      sourceURL?: string;
      statusCode?: number;
    };
  };
  error?: string;
}

export interface ScrapeResponse {
  markdown: string;
  title?: string;
  description?: string;
  url: string;
}

export async function POST(req: NextRequest) {
  try {
    // Rate limiting dle IP adresy (max 10 požadavků/min)
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-real-ip') ??
      'anonymous';
    const { success } = await rateLimitFirecrawl.limit(ip);
    if (!success) {
      return Response.json(
        { error: 'Příliš mnoho požadavků. Zkuste to za chvíli.' },
        { status: 429 }
      );
    }

    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: 'Firecrawl API klíč není nastaven. Přidejte FIRECRAWL_API_KEY do proměnných prostředí.' },
        { status: 503 }
      );
    }

    const body = (await req.json()) as { url?: string };
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return Response.json({ error: 'Chybí parametr url.' }, { status: 400 });
    }

    // Validace URL
    try {
      new URL(url);
    } catch {
      return Response.json({ error: 'Neplatná URL adresa.' }, { status: 400 });
    }

    const firecrawlRes = await fetch('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        maxAge: 86400, // cache 24h
      }),
    });

    if (!firecrawlRes.ok) {
      const errText = await firecrawlRes.text();
      let errMsg = `Firecrawl API chyba (HTTP ${firecrawlRes.status})`;
      try {
        const errJson = JSON.parse(errText) as { error?: string };
        if (errJson?.error) errMsg = errJson.error;
      } catch { /* ponech obecnou zprávu */ }
      return Response.json({ error: errMsg }, { status: firecrawlRes.status });
    }

    const data = (await firecrawlRes.json()) as FirecrawlScrapeResponse;

    if (!data.success || !data.data) {
      return Response.json({ error: data.error ?? 'Stránku se nepodařilo načíst.' }, { status: 422 });
    }

    const result: ScrapeResponse = {
      markdown: data.data.markdown ?? '',
      title: data.data.metadata?.title,
      description: data.data.metadata?.description,
      url,
    };

    return Response.json(result);

  } catch (err) {
    console.error('[firecrawl/scrape] Chyba:', err);
    return Response.json(
      { error: 'Interní chyba serveru při scrapování stránky.' },
      { status: 500 }
    );
  }
}
