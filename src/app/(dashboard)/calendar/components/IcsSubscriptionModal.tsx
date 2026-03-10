'use client';
// ─── Calendar Module – IcsSubscriptionModal ───────────────────────────────────
// Přesunuto z page.tsx (ř. 5332–5543)

import { useCalendarContext } from '../CalendarContext';
import { DEFAULT_COLORS } from '../utils';

export default function IcsSubscriptionModal() {
  const {
    showSubForm, setShowSubForm,
    editingSub, setEditingSub,
    subForm, setSubForm,
    subUrlError, setSubUrlError,
    savingSub, saveSubscription, deleteSubscription,
    showIcsGuide, setShowIcsGuide,
  } = useCalendarContext();

  if (!showSubForm) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md rounded-xl shadow-xl border p-6 overflow-y-auto" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', maxHeight: '88vh' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            {editingSub ? 'Upravit ICS kalendář' : 'Přidat ICS kalendář'}
          </h2>
          <button onClick={() => { setShowSubForm(false); setEditingSub(null); }} className="p-1 rounded" style={{ color: 'var(--text-muted)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Průvodce napojením Google / Microsoft / Apple / Wedos kalendáře */}
        <div className="mb-4 rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={() => setShowIcsGuide(!showIcsGuide)}
            className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium transition-colors"
            style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-active)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
          >
            <div className="flex items-center gap-2">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              Jak získat ICS odkaz? (Google, Outlook, Apple)
            </div>
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: showIcsGuide ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {showIcsGuide && (
            <div className="divide-y text-xs overflow-y-auto" style={{ borderColor: 'var(--border)', maxHeight: 320 }}>
              {/* Google Kalendář */}
              <div className="px-3 py-3" style={{ background: 'var(--bg-card)' }}>
                <div className="flex items-center gap-1.5 font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  Google Kalendář
                </div>
                <ol className="space-y-1 list-decimal list-inside" style={{ color: 'var(--text-secondary)' }}>
                  <li>Otevři <span className="font-medium">calendar.google.com</span></li>
                  <li>Klikni na ⚙️ vpravo nahoře → <span className="font-medium">Nastavení</span></li>
                  <li>V levém panelu klikni na název svého kalendáře</li>
                  <li>Sjeď dolů na sekci <span className="font-medium">„Integrace kalendáře"</span></li>
                  <li>Zkopíruj <span className="font-medium">„Tajná adresa ve formátu iCal"</span> <span style={{ color: 'var(--text-muted)' }}>(soukromý) nebo „Veřejná adresa ve formátu iCal" (veřejný)</span></li>
                </ol>
                <div className="mt-2 px-2 py-1.5 rounded font-mono text-[10px] break-all" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
                  https://calendar.google.com/calendar/ical/…/basic.ics
                </div>
              </div>

              {/* Microsoft Outlook */}
              <div className="px-3 py-3" style={{ background: 'var(--bg-card)' }}>
                <div className="flex items-center gap-1.5 font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2"/><polyline points="8 21 12 17 16 21"/><line x1="12" y1="17" x2="12" y2="3"/>
                  </svg>
                  Microsoft Outlook
                </div>
                <ol className="space-y-1 list-decimal list-inside" style={{ color: 'var(--text-secondary)' }}>
                  <li>Přejdi na <span className="font-medium">outlook.live.com</span> → Kalendář</li>
                  <li>Klikni na ⚙️ → <span className="font-medium">„Zobrazit všechna nastavení Outlooku"</span></li>
                  <li>Přejdi do <span className="font-medium">Kalendář → Sdílené kalendáře</span></li>
                  <li>V sekci <span className="font-medium">„Publikovat kalendář"</span> zvol kalendář a nastav <span className="font-medium">„Může zobrazovat všechny podrobnosti"</span></li>
                  <li>Klikni na <span className="font-medium">Publikovat</span> a zkopíruj <span className="font-medium">ICS odkaz</span></li>
                </ol>
                <div className="mt-2 px-2 py-1.5 rounded font-mono text-[10px] break-all" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
                  https://outlook.live.com/owa/calendar/…/calendar.ics
                </div>
              </div>

              {/* Apple Kalendář */}
              <div className="px-3 py-3" style={{ background: 'var(--bg-card)' }}>
                <div className="flex items-center gap-1.5 font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06z"/><path d="M10 2c1 .5 2 2 2 5"/>
                  </svg>
                  Apple Kalendář (iCloud)
                </div>
                <ol className="space-y-1 list-decimal list-inside" style={{ color: 'var(--text-secondary)' }}>
                  <li>Otevři <span className="font-medium">icloud.com/calendar</span></li>
                  <li>Klikni na ikonu sdílení (☁️) vedle názvu kalendáře v levém panelu</li>
                  <li>Zaškrtni <span className="font-medium">„Veřejný kalendář"</span></li>
                  <li>Zkopíruj zobrazený ICS odkaz</li>
                </ol>
              </div>

              {/* Wedos / Roundcube */}
              <div className="px-3 py-3" style={{ background: 'var(--bg-card)' }}>
                <div className="flex items-center gap-1.5 font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="8 2 8 6"/><polyline points="16 2 16 6"/><line x1="2" y1="10" x2="22" y2="10"/><line x1="7" y1="14" x2="9" y2="14"/><line x1="12" y1="14" x2="14" y2="14"/>
                  </svg>
                  Wedos / Roundcube webmail
                </div>
                <p className="mb-2" style={{ color: 'var(--text-muted)' }}>
                  Wedos používá webmail Roundcube s pluginem Kalendář, který ICS export podporuje.
                </p>
                <ol className="space-y-1 list-decimal list-inside" style={{ color: 'var(--text-secondary)' }}>
                  <li>Přihlas se do webmailu: <span className="font-medium">webmail.wedos.com</span></li>
                  <li>Klikni na <span className="font-medium">Kalendář</span> v horním menu</li>
                  <li>V levém panelu klikni pravým tlačítkem na název kalendáře</li>
                  <li>Zvolte <span className="font-medium">„Sdílet / Exportovat"</span> nebo <span className="font-medium">„Vlastnosti"</span></li>
                  <li>Zkopíruj ICS odkaz (URL zakončené <span className="font-mono">.ics</span>)</li>
                </ol>
                <div className="mt-2 p-2 rounded text-[10px]" style={{ background: '#fef3c7', color: '#92400e' }}>
                  💡 Pokud tvůj webmail ICS URL přímo nenabízí, zkus v nastavení kalendáře hledat „CalDAV", „Sdílet" nebo „Publikovat".
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Název *</label>
            <input
              type="text"
              value={subForm.name}
              onChange={e => setSubForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Např. Firemní kalendář"
              className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>ICS URL *</label>
            <input
              type="url"
              value={subForm.url}
              onChange={e => { setSubForm(f => ({ ...f, url: e.target.value })); setSubUrlError(''); }}
              placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
              className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm"
              style={{ borderColor: subUrlError ? '#ef4444' : 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
            />
            {subUrlError ? (
              <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{subUrlError}</p>
            ) : (
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Odkaz na ICS/iCal soubor (Google, Outlook, Apple, ...)</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Barva</label>
            <div className="flex items-center gap-2 flex-wrap">
              {DEFAULT_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setSubForm(f => ({ ...f, color: c }))}
                  className="w-6 h-6 rounded-full transition-all"
                  style={{
                    background: c,
                    boxShadow: subForm.color === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : 'none',
                    transform: subForm.color === c ? 'scale(1.15)' : 'scale(1)',
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-6">
          {editingSub ? (
            <button
              onClick={async () => {
                if (confirm(`Odebrat odběr „${editingSub.name}"?`)) {
                  await deleteSubscription(editingSub.id);
                  setShowSubForm(false);
                  setEditingSub(null);
                }
              }}
              className="px-3 py-2 rounded-lg text-sm transition-colors"
              style={{ color: '#ef4444' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#fee2e244')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              Odebrat
            </button>
          ) : <div />}
          <div className="flex gap-2">
            <button
              onClick={() => { setShowSubForm(false); setEditingSub(null); }}
              className="px-4 py-2 rounded-lg text-sm border"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              Zrušit
            </button>
            <button
              onClick={saveSubscription}
              disabled={savingSub || !subForm.name.trim() || !subForm.url.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
              style={{ background: 'var(--primary)' }}
            >
              {savingSub ? 'Ukládám...' : editingSub ? 'Uložit' : 'Přidat'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
