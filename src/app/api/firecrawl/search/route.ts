// Trackino – Firecrawl Search API endpoint
// Serverová route – API klíč je bezpečně na serveru, nikdy v prohlížeči.
// Prohledává web pomocí Firecrawl API a vrací výsledky s obsahem stránek.

import type { NextRequest } from 'next/server';

interface FirecrawlSearchResult {
  url: string;
  title?: string;
  description?: string;
  markdown?: string;
}

interface FirecrawlSearchResponse {
  success: boolean;
  data?: FirecrawlSearchResult[];
  error?: string;
}

export interface SearchResult {
  url: string;
  title: string;
  description: string;
  markdown: string;
}

export interface SearchResponse {
  results: SearchResult[];
  query: string;
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: 'Firecrawl API klíč není nastaven. Přidejte FIRECRAWL_API_KEY do proměnných prostředí.' },
        { status: 503 }
      );
    }

    const body = (await req.json()) as { query?: string; limit?: number };
    const { query, limit = 5 } = body;

    if (!query || typeof query !== 'string' || !query.trim()) {
      return Response.json({ error: 'Chybí parametr query.' }, { status: 400 });
    }

    const safeLimit = Math.min(Math.max(1, limit), 10); // max 10 výsledků

    const firecrawlRes = await fetch('https://api.firecrawl.dev/v2/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query: query.trim(),
        limit: safeLimit,
        scrapeOptions: {
          formats: ['markdown'],
        },
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

    const data = (await firecrawlRes.json()) as FirecrawlSearchResponse;

    if (!data.success || !data.data) {
      return Response.json({ error: data.error ?? 'Vyhledávání se nezdařilo.' }, { status: 422 });
    }

    const results: SearchResult[] = data.data.map(r => ({
      url: r.url,
      title: r.title ?? r.url,
      description: r.description ?? '',
      markdown: r.markdown ?? '',
    }));

    const response: SearchResponse = {
      results,
      query: query.trim(),
    };

    return Response.json(response);

  } catch (err) {
    console.error('[firecrawl/search] Chyba:', err);
    return Response.json(
      { error: 'Interní chyba serveru při vyhledávání.' },
      { status: 500 }
    );
  }
}
