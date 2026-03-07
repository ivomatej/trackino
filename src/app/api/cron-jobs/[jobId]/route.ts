import { NextRequest, NextResponse } from 'next/server';

const CRON_JOB_BASE = 'https://api.cron-job.org';

function cronHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.CRON_JOB_API_KEY}`,
  };
}

/**
 * GET /api/cron-jobs/[jobId] – detail jobu
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  const res = await fetch(`${CRON_JOB_BASE}/jobs/${jobId}`, {
    headers: cronHeaders(),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

/**
 * PATCH /api/cron-jobs/[jobId] – aktualizace jobu (enable/disable, schedule...)
 * Body: { enabled?: boolean, ... }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  const body = await request.json();

  // Přeformátujeme na cron-job.org strukturu
  const cronPayload = {
    job: body,
  };

  const res = await fetch(`${CRON_JOB_BASE}/jobs/${jobId}`, {
    method: 'PATCH',
    headers: cronHeaders(),
    body: JSON.stringify(cronPayload),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

/**
 * DELETE /api/cron-jobs/[jobId] – smazání jobu
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  const res = await fetch(`${CRON_JOB_BASE}/jobs/${jobId}`, {
    method: 'DELETE',
    headers: cronHeaders(),
  });
  // DELETE vrací prázdné tělo
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return NextResponse.json({ ok: true }, { status: 200 });
  }
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
