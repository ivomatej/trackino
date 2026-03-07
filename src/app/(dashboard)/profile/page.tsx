'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import DashboardLayout from '@/components/DashboardLayout';
import { WorkspaceProvider } from '@/contexts/WorkspaceContext';
import { useTheme } from '@/components/ThemeProvider';
import { normalizePhone } from '@/lib/utils';
import type { Profile } from '@/types/database';

const AVATAR_COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
  '#0891b2', '#be185d', '#4f46e5', '#059669', '#d97706',
  '#7c3aed', '#db2777', '#0d9488', '#ea580c', '#4338ca',
];

function ProfileContent() {
  const { user, profile, updateProfile } = useAuth();
  const { isWorkspaceAdmin } = usePermissions();
  const { theme, setTheme } = useTheme();

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
    <DashboardLayout>
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
      <ProfileContent />
    </WorkspaceProvider>
  );
}
