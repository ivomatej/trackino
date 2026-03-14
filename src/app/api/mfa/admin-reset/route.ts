import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  try {
    const { targetUserId, workspaceId } = await req.json() as { targetUserId?: string; workspaceId?: string };
    if (!targetUserId || !workspaceId) return NextResponse.json({ error: 'Chybí parametry' }, { status: 400 });

    // Ověř volajícího
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    );
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Ověř, že je admin nebo master admin daného workspace
    const { data: profile } = await supabase
      .from('trackino_profiles')
      .select('is_master_admin')
      .eq('id', user.id)
      .single();

    const { data: membership } = await supabase
      .from('trackino_workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    const isMaster = profile?.is_master_admin === true;
    const isAdmin = membership?.role === 'owner' || membership?.role === 'admin';
    if (!isMaster && !isAdmin) return NextResponse.json({ error: 'Nedostatečná oprávnění' }, { status: 403 });

    // Načti jméno cílového uživatele pro audit log
    const { data: targetProfile } = await supabase
      .from('trackino_profiles')
      .select('display_name')
      .eq('id', targetUserId)
      .single();
    const targetName = targetProfile?.display_name ?? targetUserId;

    // Smaž TOTP faktory přes admin API
    const adminClient = getSupabaseAdmin();
    const { data: factorsData } = await adminClient.auth.admin.mfa.listFactors({ userId: targetUserId });
    const totpFactors = (factorsData?.factors ?? []).filter(f => f.factor_type === 'totp');
    for (const factor of totpFactors) {
      await adminClient.auth.admin.mfa.deleteFactor({ userId: targetUserId, id: factor.id });
    }

    // Smaž recovery kódy z DB
    await adminClient
      .from('trackino_mfa_recovery_codes')
      .delete()
      .eq('user_id', targetUserId);

    // Audit log (tarif Max)
    const { data: ws } = await adminClient
      .from('trackino_workspaces')
      .select('tariff')
      .eq('id', workspaceId)
      .single();
    if (ws?.tariff === 'max') {
      await adminClient.from('trackino_audit_log').insert({
        workspace_id: workspaceId,
        actor_user_id: user.id,
        action: 'mfa_admin_reset',
        entity_type: 'user',
        details: { target_user_id: targetUserId, target_name: targetName },
      });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
