import { NextRequest, NextResponse } from 'next/server';

const CRON_JOB_BASE = 'https://api.cron-job.org';

function cronHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.CRON_JOB_API_KEY}`,
  };
}

/**
 * GET /api/cron-jobs – seznam aktivních cron jobů
 */
export async function GET() {
  const res = await fetch(`${CRON_JOB_BASE}/jobs`, {
    headers: cronHeaders(),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

/**
 * PUT /api/cron-jobs – vytvoření nového cron jobu
 * Body: {
 *   title: string,
 *   url: string,          // URL akce (např. /api/cron/weekly-report)
 *   schedule: {...},      // cron-job.org schedule objekt
 *   extendedData?: {...}, // requestBody atd.
 *   enabled?: boolean,
 * }
 *
 * Server-side injekce CRON_SECRET do requestBody.headers.
 */
export async function PUT(request: NextRequest) {
  const body = await request.json();

  // Zajistíme absolutní URL pro cron-job.org (odstraníme trailing slash z appUrl)
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const rawUrl: string = body.url ?? '';
  const fullUrl = rawUrl.startsWith('http') ? rawUrl : `${appUrl}${rawUrl}`;

  // Inject CRON_SECRET do HTTP hlavičky cron-job.org requestu (extendedData)
  const existingHeaders: Record<string, string> = body.extendedData?.headers ?? {};
  const extendedData = {
    ...(body.extendedData ?? {}),
    headers: {
      ...existingHeaders,
      'x-cron-secret': process.env.CRON_SECRET ?? '',
    },
    method: 'POST',
    body: body.extendedData?.body ?? '',
  };

  const cronPayload = {
    job: {
      url: fullUrl,
      title: body.title ?? '',
      enabled: body.enabled ?? true,
      saveResponses: true,
      schedule: body.schedule,
      extendedData,
    },
  };

  const res = await fetch(`${CRON_JOB_BASE}/jobs`, {
    method: 'PUT',
    headers: cronHeaders(),
    body: JSON.stringify(cronPayload),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
