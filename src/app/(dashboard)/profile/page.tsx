'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import DashboardLayout from '@/components/DashboardLayout';
import { WorkspaceProvider } from '@/contexts/WorkspaceContext';
import { useTheme } from '@/components/ThemeProvider';
import { normalizePhone } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import QRCode from 'qrcode';
import type { Profile } from '@/types/database';

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'Trackino';

const AVATAR_COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
  '#0891b2', '#be185d', '#4f46e5', '#059669', '#d97706',
  '#7c3aed', '#db2777', '#0d9488', '#ea580c', '#4338ca',
];

// ─── MFA komponenta ────────────────────────────────────────────
type MfaStep = 'idle' | 'enroll_qr' | 'enroll_verify' | 'recovery_show' | 'active' | 'unenroll_confirm';

function MfaSection({ mfaSetupRequired }: { mfaSetupRequired: boolean }) {
  const { user } = useAuth();
  const [step, setStep] = useState<MfaStep>('idle');
  const [loading, setLoading] = useState(true);
  const [factorId, setFactorId] = useState('');
  const [qrUri, setQrUri] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [savedConfirm, setSavedConfirm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const checkMfaStatus = useCallback(async () => {
    setLoading(true);
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const verified = factors?.totp?.find(f => f.status === 'verified');
    setStep(verified ? 'active' : 'idle');
    if (verified) setFactorId(verified.id);
    setLoading(false);
  }, []);

  useEffect(() => { checkMfaStatus(); }, [checkMfaStatus]);

  const startEnroll = async () => {
    setError('');
    setActionLoading(true);
    const { data, error: err } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
    if (err || !data) { setError(err?.message ?? 'Chyba enrollmentu'); setActionLoading(false); return; }
    setFactorId(data.id);
    const secret = data.totp.secret;
    const email = user?.email ?? '';
    const otpauthUri = `otpauth://totp/${encodeURIComponent(APP_NAME)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(APP_NAME)}`;
    const qrDataUri = await QRCode.toDataURL(otpauthUri, { width: 200, margin: 1 });
    setQrUri(qrDataUri);
    setSecret(secret);
    setCode('');
    setStep('enroll_qr');
    setActionLoading(false);
  };

  const verifyEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setActionLoading(true);
    const { error: err } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\s/g, '') });
    if (err) { setError('Neplatný kód. Zkuste znovu.'); setActionLoading(false); return; }

    // Vygeneruj recovery kódy
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/mfa/recovery-codes/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
    });
    if (res.ok) {
      const data = await res.json();
      setRecoveryCodes(data.codes ?? []);
    }
    setStep('recovery_show');
    setActionLoading(false);
  };

  const finishEnroll = async () => {
    if (!savedConfirm) return;
    await checkMfaStatus();
    showToast('MFA bylo úspěšně aktivováno!');
  };

  const regenerateCodes = async () => {
    setActionLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/mfa/recovery-codes/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
    });
    if (res.ok) {
      const data = await res.json();
      setRecoveryCodes(data.codes ?? []);
      setStep('recovery_show');
      setSavedConfirm(false);
    }
    setActionLoading(false);
  };

  const downloadCodes = () => {
    const text = `Trackino – záchranné kódy MFA\nVygenerováno: ${new Date().toLocaleString('cs-CZ')}\n\n${recoveryCodes.join('\n')}\n\nKaždý kód lze použít pouze jednou.`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'trackino-mfa-recovery-codes.txt'; a.click();
    URL.revokeObjectURL(url);
  };

  const unenroll = async () => {
    setActionLoading(true);
    const { error: err } = await supabase.auth.mfa.unenroll({ factorId });
    if (err) { setError(err.message); setActionLoading(false); return; }
    // Smaž recovery kódy
    const { data: { session } } = await supabase.auth.getSession();
    await fetch('/api/mfa/recovery-codes/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
    });
    setStep('idle');
    setFactorId('');
    setActionLoading(false);
    showToast('MFA bylo deaktivováno.');
  };

  const inputCls = 'w-full px-3 py-2.5 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]';
  const inputStyle = { borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' };

  if (loading) {
    return (
      <div className="rounded-xl border p-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Načítám stav MFA...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border p-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      {/* Toast */}
      {toast && (
        <div className="mb-4 p-3 rounded-lg text-sm font-medium" style={{ background: 'var(--success)', color: '#fff' }}>
          {toast}
        </div>
      )}

      {/* Banner – vynucení workspace MFA */}
      {mfaSetupRequired && step === 'idle' && (
        <div className="mb-4 p-3 rounded-lg border flex items-start gap-2.5" style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-sm" style={{ color: '#92400e' }}>
            Váš workspace vyžaduje dvoufaktorové ověření. Prosím aktivujte MFA níže.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Dvoufaktorové ověření</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Zvyšte bezpečnost svého účtu pomocí TOTP aplikace</p>
        </div>
        {step === 'active' && (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: '#dcfce7', color: '#166534' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            MFA aktivní
          </span>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: '#fee2e2', color: '#dc2626' }}>
          {error}
        </div>
      )}

      {/* ── Stav: MFA není aktivní ── */}
      {step === 'idle' && (
        <button
          onClick={startEnroll}
          disabled={actionLoading}
          className="px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
          style={{ background: 'var(--primary)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--primary)'}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="11" width="14" height="10" rx="2" ry="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          {actionLoading ? 'Načítám...' : 'Zapnout MFA'}
        </button>
      )}

      {/* ── Stav: QR kód ── */}
      {step === 'enroll_qr' && (
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            1. Otevřete svou autentizační aplikaci (Google Authenticator, Microsoft Authenticator, Authy…)
            a naskenujte QR kód, nebo zadejte kód ručně.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            {qrUri && (
              <div className="p-3 rounded-xl border flex-shrink-0" style={{ background: '#fff', borderColor: 'var(--border)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrUri} alt="TOTP QR kód" width={160} height={160} />
              </div>
            )}
            <div className="flex-1">
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Ruční kód</p>
              <code
                className="block px-3 py-2 rounded-lg border text-xs font-mono break-all select-all"
                style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              >
                {secret}
              </code>
            </div>
          </div>
          <button
            onClick={() => setStep('enroll_verify')}
            className="px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors flex items-center gap-2"
            style={{ background: 'var(--primary)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--primary)'}
          >
            Pokračovat
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Stav: Ověření kódu ── */}
      {step === 'enroll_verify' && (
        <form onSubmit={verifyEnroll} className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            2. Zadejte 6místný kód z autentizační aplikace pro ověření nastavení.
          </p>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Ověřovací kód
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="123456"
              autoFocus
              className={inputCls + ' text-center text-2xl font-mono tracking-widest'}
              style={inputStyle}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setStep('enroll_qr'); setError(''); }}
              className="px-4 py-2 rounded-lg border text-sm font-medium"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              Zpět
            </button>
            <button
              type="submit"
              disabled={actionLoading || code.length < 6}
              className="flex-1 px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
              style={{ background: 'var(--primary)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--primary)'}
            >
              {actionLoading ? 'Ověřuji...' : 'Ověřit a aktivovat'}
            </button>
          </div>
        </form>
      )}

      {/* ── Stav: Recovery kódy ── */}
      {step === 'recovery_show' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border" style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
            <div className="flex items-center gap-2 mb-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="text-sm font-semibold" style={{ color: '#92400e' }}>
                Uložte si tyto záchranné kódy na bezpečné místo. Zobrazí se pouze jednou.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {recoveryCodes.map((c, i) => (
                <code key={i} className="px-2 py-1.5 rounded-lg text-xs font-mono text-center" style={{ background: '#fef3c7', color: '#92400e' }}>
                  {c}
                </code>
              ))}
            </div>
            <button
              onClick={downloadCodes}
              className="mt-3 flex items-center gap-1.5 text-xs font-medium transition-colors"
              style={{ color: '#92400e' }}
              onMouseEnter={e => e.currentTarget.style.color = '#78350f'}
              onMouseLeave={e => e.currentTarget.style.color = '#92400e'}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Stáhnout jako .txt
            </button>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={savedConfirm}
              onChange={e => setSavedConfirm(e.target.checked)}
              className="w-4 h-4 flex-shrink-0 accent-[var(--primary)]"
            />
            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Uložil jsem si záchranné kódy</span>
          </label>

          <button
            onClick={finishEnroll}
            disabled={!savedConfirm || actionLoading}
            className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50 transition-colors"
            style={{ background: 'var(--primary)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--primary)'}
          >
            Dokončit
          </button>
        </div>
      )}

      {/* ── Stav: MFA aktivní ── */}
      {step === 'active' && (
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={regenerateCodes}
            disabled={actionLoading}
            className="px-4 py-2 rounded-lg border text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--bg-hover)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-3.63" />
            </svg>
            {actionLoading ? 'Generuji...' : 'Regenerovat záchranné kódy'}
          </button>
          <button
            onClick={() => { setStep('unenroll_confirm'); setError(''); }}
            className="px-4 py-2 rounded-lg border text-sm font-medium transition-colors flex items-center gap-2"
            style={{ borderColor: 'var(--danger)', color: 'var(--danger)', background: 'transparent' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--danger-light)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="11" width="14" height="10" rx="2" ry="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0" />
              <line x1="12" y1="15" x2="12" y2="17" />
            </svg>
            Vypnout MFA
          </button>
        </div>
      )}

      {/* ── Stav: Potvrzení deaktivace ── */}
      {step === 'unenroll_confirm' && (
        <div className="space-y-3">
          <div className="p-3 rounded-lg border" style={{ background: '#fee2e2', borderColor: '#fca5a5' }}>
            <p className="text-sm font-semibold mb-0.5" style={{ color: '#991b1b' }}>Opravdu chcete vypnout MFA?</p>
            <p className="text-xs" style={{ color: '#b91c1c' }}>Váš účet bude méně chráněn. Recovery kódy budou smazány.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setStep('active')}
              className="flex-1 px-4 py-2 rounded-lg border text-sm font-medium"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              Zrušit
            </button>
            <button
              onClick={unenroll}
              disabled={actionLoading}
              className="flex-1 px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
              style={{ background: 'var(--danger)' }}
            >
              {actionLoading ? 'Deaktivuji...' : 'Vypnout MFA'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Hlavní komponenta profilu ─────────────────────────────────
function ProfileContent() {
  const { user, profile, updateProfile } = useAuth();
  const { isWorkspaceAdmin } = usePermissions();
  const { theme, setTheme } = useTheme();
  const searchParams = useSearchParams();
  const mfaSetupRequired = searchParams.get('mfa_setup') === 'required';

  const [displayName, setDisplayName] = useState('');
  const [displayNickname, setDisplayNickname] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [position, setPosition] = useState('');
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [timerAlwaysVisible, setTimerAlwaysVisible] = useState(false);
  const [timerBottomMobile, setTimerBottomMobile] = useState(false);
  const [birthDate, setBirthDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? '');
      setDisplayNickname(profile.display_nickname?.trim()
        ? profile.display_nickname
        : (profile.display_name?.split(' ')[0] ?? ''));
      setEmail(profile.email ?? '');
      setPhone(profile.phone ?? '');
      setPosition(profile.position ?? '');
      setAvatarColor(profile.avatar_color ?? AVATAR_COLORS[0]);
      setTimerAlwaysVisible(profile.timer_always_visible ?? false);
      setTimerBottomMobile(profile.timer_bottom_mobile ?? false);
      setBirthDate(profile.birth_date ?? '');
    }
  }, [profile]);

  const canEditPosition = isWorkspaceAdmin || (profile?.is_master_admin ?? false);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const updates: Partial<Profile> = {
      display_name: displayName.trim(),
      display_nickname: displayNickname.trim().slice(0, 30),
      email: email.trim(),
      phone: normalizePhone(phone),
      avatar_color: avatarColor,
      timer_always_visible: timerAlwaysVisible,
      timer_bottom_mobile: timerBottomMobile,
      birth_date: birthDate || null,
    };
    if (canEditPosition) {
      updates.position = position.trim();
    }
    await updateProfile(updates);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const initials = displayName
    ? displayName.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : (profile?.email?.charAt(0).toUpperCase() ?? '?');

  const inputCls = 'w-full px-3 py-2.5 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]';
  const inputStyle = { borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' };

  return (
    <DashboardLayout moduleName="Profil">
      <div className="max-w-2xl">
        <div className="mb-6">
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Detailní nastavení</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Správa vašich osobních údajů a nastavení aplikace
          </p>
        </div>

        <div className="space-y-5">
          {/* ── Profil ── */}
          <div className="rounded-xl border p-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-semibold mb-5" style={{ color: 'var(--text-primary)' }}>Profil</h2>

            {/* Avatar preview + barva */}
            <div className="flex items-center gap-5 mb-6">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold flex-shrink-0 transition-colors"
                style={{ background: avatarColor }}
              >
                {initials}
              </div>
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Barva avataru</p>
                <div className="flex flex-wrap gap-2">
                  {AVATAR_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setAvatarColor(color)}
                      className="w-6 h-6 rounded-full transition-all flex-shrink-0"
                      style={{
                        background: color,
                        outline: avatarColor === color ? '2px solid #000' : 'none',
                        outlineOffset: '2px',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Zobrazované jméno
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Jan Novák"
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Jak tě má aplikace oslovovat
                  <span className="ml-1.5 font-normal" style={{ color: 'var(--text-muted)' }}>
                    ({displayNickname.length}/30)
                  </span>
                </label>
                <input
                  type="text"
                  value={displayNickname}
                  onChange={(e) => setDisplayNickname(e.target.value.slice(0, 30))}
                  placeholder="Např. Honzo, Petro, Davide…"
                  maxLength={30}
                  className={inputCls}
                  style={inputStyle}
                />
                <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
                  Zobrazuje se v úvodním pozdravení na stránce Přehled
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  E-mail
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jan@firma.cz"
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Telefonní číslo
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+420 123 456 789"
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Pozice
                  {!canEditPosition && (
                    <span className="ml-1.5 font-normal text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      (nastavuje admin)
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder="např. Grafik, Frontend developer"
                  disabled={!canEditPosition}
                  className={inputCls + ' disabled:opacity-60 disabled:cursor-not-allowed'}
                  style={{
                    ...inputStyle,
                    background: !canEditPosition ? 'var(--bg-hover)' : 'var(--bg-hover)',
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Datum narození
                  <span className="ml-1.5 font-normal text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    (zobrazuje se v Narozeninách v kalendáři)
                  </span>
                </label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* ── Dvoufaktorové ověření (MFA) ── */}
          <MfaSection mfaSetupRequired={mfaSetupRequired} />

          {/* ── Vzhled ── */}
          <div className="rounded-xl border p-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Barevný režim</h2>
            <div className="flex gap-3">
              {(['light', 'dark', 'system'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-sm font-medium transition-all border"
                  style={{
                    background: theme === t ? 'var(--primary)' : 'var(--bg-hover)',
                    color: theme === t ? 'white' : 'var(--text-secondary)',
                    borderColor: theme === t ? 'var(--primary)' : 'var(--border)',
                  }}
                >
                  <span>{t === 'light' ? '☀️' : t === 'dark' ? '🌙' : '🖥️'}</span>
                  {t === 'light' ? 'Světlý' : t === 'dark' ? 'Tmavý' : 'Auto'}
                </button>
              ))}
            </div>
          </div>

          {/* ── Zobrazení aplikace ── */}
          <div className="rounded-xl border p-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Zobrazení aplikace</h2>
            <div className="space-y-3">
              <label
                className="flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors"
                style={{ background: timerAlwaysVisible ? 'var(--bg-active)' : 'var(--bg-hover)', border: `1px solid ${timerAlwaysVisible ? 'var(--primary)' : 'var(--border)'}` }}
              >
                <input
                  type="checkbox"
                  checked={timerAlwaysVisible}
                  onChange={(e) => setTimerAlwaysVisible(e.target.checked)}
                  className="mt-0.5 flex-shrink-0 w-4 h-4 accent-[var(--primary)]"
                />
                <div>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    Zobrazovat Měřič v záhlaví na všech stránkách
                  </span>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Ve výchozím nastavení je Měřič viditelný pouze na stránce Měřič. Zapnutím se zobrazí trvale v horním záhlaví.
                  </p>
                </div>
              </label>

              <label
                className="flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors"
                style={{ background: timerBottomMobile ? 'var(--bg-active)' : 'var(--bg-hover)', border: `1px solid ${timerBottomMobile ? 'var(--primary)' : 'var(--border)'}` }}
              >
                <input
                  type="checkbox"
                  checked={timerBottomMobile}
                  onChange={(e) => setTimerBottomMobile(e.target.checked)}
                  className="mt-0.5 flex-shrink-0 w-4 h-4 accent-[var(--primary)]"
                />
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      Měřič u spodní hrany obrazovky
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                      pouze mobil
                    </span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Na mobilních zařízeních se Měřič přesune ze záhlaví ke spodní hraně obrazovky pro pohodlnější ovládání.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* ── Info o účtu ── */}
          <div className="rounded-xl border p-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Informace o účtu</h2>
            <div className="space-y-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              <div className="flex gap-2">
                <span className="font-medium w-24 flex-shrink-0">ID uživatele</span>
                <span className="font-mono truncate" style={{ color: 'var(--text-secondary)' }}>{user?.id ?? '–'}</span>
              </div>
              <div className="flex gap-2">
                <span className="font-medium w-24 flex-shrink-0">Auth e-mail</span>
                <span style={{ color: 'var(--text-secondary)' }}>{user?.email ?? '–'}</span>
              </div>
              {profile?.is_master_admin && (
                <div className="flex gap-2">
                  <span className="font-medium w-24 flex-shrink-0">Oprávnění</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ background: '#fef3c7', color: '#92400e' }}>
                    Master Admin
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── Tlačítko uložit ── */}
          <div className="flex justify-end">
            <button
              onClick={save}
              disabled={saving}
              className="px-6 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50 transition-all"
              style={{ background: saved ? 'var(--success)' : 'var(--primary)' }}
            >
              {saving ? 'Ukládám...' : saved ? '✓ Uloženo' : 'Uložit změny'}
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function ProfilePage() {
  return (
    <WorkspaceProvider>
      <Suspense>
        <ProfileContent />
      </Suspense>
    </WorkspaceProvider>
  );
}
