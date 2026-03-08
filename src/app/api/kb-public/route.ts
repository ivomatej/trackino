import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token || token.length < 8) {
    return NextResponse.json({ error: 'Neplatný odkaz' }, { status: 400 });
  }

  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from('trackino_kb_pages')
      .select('id, title, content, updated_at, workspace_id')
      .eq('public_token', token)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Stránka nenalezena nebo není veřejná' }, { status: 404 });
    }

    // Fetch workspace name for branding
    const { data: ws } = await sb
      .from('trackino_workspaces')
      .select('name')
      .eq('id', data.workspace_id)
      .single();

    return NextResponse.json({
      title: data.title,
      content: data.content,
      updated_at: data.updated_at,
      workspace_name: ws?.name ?? '',
    });
  } catch {
    return NextResponse.json({ error: 'Interní chyba' }, { status: 500 });
  }
}
