import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Cesty které nevyžadují přihlášení ani MFA
const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/invite',
  '/kb/',
];

const AUTH_API_PREFIX = '/api/auth';
const API_PREFIX = '/api/';

function isPublicPath(pathname: string): boolean {
  if (pathname.startsWith(AUTH_API_PREFIX)) return true;
  if (pathname.startsWith(API_PREFIX)) return true;
  return PUBLIC_PATHS.some(p => pathname.startsWith(p));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Vždy propustit public cesty
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Získej access token z cookie (Supabase ukládá session do cookies v SSR)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // Vytvoř klienta s cookie access tokenem
  const authHeader = request.cookies.get('sb-access-token')?.value;
  const refreshToken = request.cookies.get('sb-refresh-token')?.value;

  // Pokud není access token, není třeba kontrolovat MFA
  if (!authHeader && !refreshToken) {
    return NextResponse.next();
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: authHeader ? { Authorization: `Bearer ${authHeader}` } : {},
      },
    });

    // Pokud máme access token, nastav session
    if (authHeader && refreshToken) {
      await supabase.auth.setSession({
        access_token: authHeader,
        refresh_token: refreshToken,
      });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.next();
    }

    // Přeskočit profil stránku (kde se MFA nastavuje) a static assety
    if (pathname === '/profile' || pathname.startsWith('/_next') || pathname.startsWith('/static')) {
      return NextResponse.next();
    }

    // Zkontroluj AAL úroveň
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (aalData?.nextLevel === 'aal2' && aalData.nextLevel !== aalData.currentLevel) {
      // Uživatel má MFA nastaveno, ale ještě ho neověřil v této session
      // Přesměruj na přihlašovací stránku (MFA verify krok se zobrazí tam)
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      return NextResponse.redirect(loginUrl);
    }

    // Zkontroluj, zda workspace vyžaduje MFA a uživatel ho nemá nastaveno
    // Tuto kontrolu provádíme jen pokud je user na aal1 a workspace má mfa_required
    if (aalData?.currentLevel === 'aal1') {
      // Načti profil uživatele - kontrola is_master_admin
      const { data: profile } = await supabase
        .from('trackino_profiles')
        .select('is_master_admin')
        .eq('id', user.id)
        .single();

      // Master admini jsou vyjmuti
      if (profile?.is_master_admin) {
        return NextResponse.next();
      }

      // Načti workspace membership pro aktuálního uživatele
      const { data: memberships } = await supabase
        .from('trackino_workspace_members')
        .select('workspace_id, role')
        .eq('user_id', user.id)
        .eq('approved', true);

      if (memberships && memberships.length > 0) {
        const workspaceIds = memberships.map(m => m.workspace_id);

        // Zkontroluj zda některý workspace vyžaduje MFA
        const { data: workspaces } = await supabase
          .from('trackino_workspaces')
          .select('id, mfa_required')
          .in('id', workspaceIds)
          .eq('mfa_required', true);

        if (workspaces && workspaces.length > 0) {
          // Workspace vyžaduje MFA - zkontroluj zda uživatel má TOTP faktor
          const { data: factors } = await supabase.auth.mfa.listFactors();
          const hasVerifiedTotp = factors?.totp?.some(f => f.status === 'verified');

          if (!hasVerifiedTotp) {
            // Uživatel nemá MFA nastaveno a workspace to vyžaduje
            // Přesměruj na profil k nastavení MFA
            const profileUrl = request.nextUrl.clone();
            profileUrl.pathname = '/profile';
            profileUrl.search = '?mfa_setup=required';
            return NextResponse.redirect(profileUrl);
          }
        }
      }
    }

    return NextResponse.next();
  } catch {
    // Při chybě propustit (nechceme blokovat přístup kvůli chybě middleware)
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    /*
     * Aplikuj middleware na všechny cesty kromě:
     * - _next/static (statické soubory)
     * - _next/image (optimalizace obrázků)
     * - favicon.ico
     * - soubory s příponami (js, css, png, ...)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
};
