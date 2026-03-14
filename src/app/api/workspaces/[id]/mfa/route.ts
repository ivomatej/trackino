import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workspaceId } = await params;
    const { mfa_required } = await req.json() as { mfa_required?: boolean };
    if (typeof mfa_required !== 'boolean') {
      return NextResponse.json({ error: 'Chybí parametr mfa_required' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Ověř roli
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

    const { error: updateErr } = await supabase
      .from('trackino_workspaces')
      .update({ mfa_required })
      .eq('id', workspaceId);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
