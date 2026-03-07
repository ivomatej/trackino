import { getSupabaseAdmin } from './supabase-admin';

/**
 * Ověří X-Cron-Secret hlavičku v příchozím požadavku od cron-job.org.
 */
export function verifyCronSecret(request: Request): boolean {
  const secret = request.headers.get('x-cron-secret');
  return secret === process.env.CRON_SECRET;
}

/**
 * Uloží výsledek cron akce do trackino_cron_results.
 */
export async function saveCronResult(
  workspaceId: string,
  actionId: string,
  title: string,
  content: string,
  status: 'success' | 'error' = 'success',
) {
  const supabase = getSupabaseAdmin();
  await supabase.from('trackino_cron_results').insert({
    workspace_id: workspaceId,
    action_id: actionId,
    title,
    content,
    status,
    created_at: new Date().toISOString(),
  });
}

/**
 * Parsuje workspace_id + volitelné parametry z těla požadavku.
 * Vyhodí chybu pokud workspace_id chybí.
 */
export async function parseCronBody(request: Request): Promise<{
  workspaceId: string;
  params: Record<string, unknown>;
}> {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // prázdné tělo
  }
  const workspaceId = body.workspace_id as string | undefined;
  if (!workspaceId) {
    throw new Error('Chybí workspace_id v těle požadavku');
  }
  return { workspaceId, params: body };
}
