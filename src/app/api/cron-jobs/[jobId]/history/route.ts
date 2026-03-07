import { NextRequest, NextResponse } from 'next/server';

const CRON_JOB_BASE = 'https://api.cron-job.org';

function cronHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.CRON_JOB_API_KEY}`,
  };
}

/**
 * GET /api/cron-jobs/[jobId]/history – historie spuštění jobu
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  const res = await fetch(`${CRON_JOB_BASE}/jobs/${jobId}/history`, {
    headers: cronHeaders(),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
