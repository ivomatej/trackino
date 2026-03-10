'use client';
// ─── Calendar Module – CalendarSidebarOther ───────────────────────────────────
// Sekce AUTOMATICKY, SDÍLENÉ KALENDÁŘE, DALŠÍ KALENDÁŘE a tlačítko Nastavení.

import { useCalendarContext } from '../CalendarContext';
import { DEFAULT_COLORS } from '../utils';

export default function CalendarSidebarOther() {
  const {
    autoExpanded, setAutoExpanded,
    sharedCalExpanded, setSharedCalExpanded,
    otherExpanded, setOtherExpanded,
    showVacation, setShowVacation,
    vacationColor, setVacationColor,
    showImportantDays, setShowImportantDays,
    importantDaysColor, setImportantDaysColor,
    sharedWithMe,
    updateSharePref,
    showHolidays, setShowHolidays,
    holidayColor, setHolidayColor,
    showNamedays, setShowNamedays,
    namedayColor, setNamedayColor,
    showBirthdays, setShowBirthdays,
    birthdayColor, setBirthdayColor,
    canViewBirthdays,
    calViewStart, calViewEnd,
    setCalSettingsForm, setShowCalSettings,
  } = useCalendarContext();

  return (
    <>
      {/* ── AUTOMATICKY ─────────────────────────────────────────────────────── */}
      <div className="mb-3">
        <div className="mb-2">
          <button
            onClick={() => setAutoExpanded(!autoExpanded)}
            className="flex items-center gap-1 text-[10px] font-semibold tracking-wider"
            style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            AUTOMATICKY
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transform: autoExpanded ? 'none' : 'rotate(-90deg)', transition: 'transform 0.15s', flexShrink: 0 }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        </div>
        {autoExpanded && (
          <>
            {/* Dovolená */}
            <div className="flex items-center gap-1.5 py-0.5 group/vacrow">
              <button
                role="checkbox"
                aria-checked={showVacation}
                onClick={() => { const v = !showVacation; localStorage.setItem('trackino_cal_vacation', v ? '1' : '0'); setShowVacation(v); }}
                className="w-3.5 h-3.5 rounded flex-shrink-0 flex items-center justify-center border-[1.5px] transition-colors cursor-pointer"
                style={{ background: showVacation ? vacationColor : 'transparent', borderColor: vacationColor }}
              >
                {showVacation && (
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </button>
              <span className="text-xs flex-1" style={{ color: 'var(--text-secondary)' }}>Dovolená</span>
              <div className="relative opacity-0 group-hover/vacrow:opacity-100 transition-opacity flex-shrink-0 group/vacdot">
                <button className="w-3 h-3 rounded-full border border-transparent hover:border-white/30 transition-all" style={{ background: vacationColor }} title="Změnit barvu" />
                <div className="absolute right-0 top-5 z-20 hidden group-hover/vacdot:flex flex-wrap gap-1 p-2 rounded-lg border shadow-xl" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', width: 112 }}>
                  {DEFAULT_COLORS.map(c => (
                    <button key={c} onClick={() => { setVacationColor(c); localStorage.setItem('trackino_cal_vacation_color', c); }} className="w-4 h-4 rounded-full transition-all" style={{ background: c, boxShadow: vacationColor === c ? `0 0 0 1.5px white, 0 0 0 3px ${c}` : 'none' }} />
                  ))}
                  <button onClick={() => { setVacationColor('#0ea5e9'); localStorage.setItem('trackino_cal_vacation_color', '#0ea5e9'); }} className="w-4 h-4 rounded-full border flex items-center justify-center text-[8px]" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg-hover)' }} title="Výchozí barva">○</button>
                </div>
              </div>
            </div>
            {/* Důležité dny */}
            <div className="flex items-center gap-1.5 py-0.5 group/idaysrow">
              <button
                role="checkbox"
                aria-checked={showImportantDays}
                onClick={() => { const v = !showImportantDays; localStorage.setItem('trackino_cal_important_days', v ? '1' : '0'); setShowImportantDays(v); }}
                className="w-3.5 h-3.5 rounded flex-shrink-0 flex items-center justify-center border-[1.5px] transition-colors cursor-pointer"
                style={{ background: showImportantDays ? (importantDaysColor ?? '#f59e0b') : 'transparent', borderColor: importantDaysColor ?? '#f59e0b' }}
              >
                {showImportantDays && (
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </button>
              <span className="text-xs flex-1" style={{ color: 'var(--text-secondary)' }}>Důležité dny</span>
              <div className="relative opacity-0 group-hover/idaysrow:opacity-100 transition-opacity flex-shrink-0 group/idaysdot">
                <button className="w-3 h-3 rounded-full border border-transparent hover:border-white/30 transition-all" style={{ background: importantDaysColor ?? 'linear-gradient(135deg, #f59e0b, #8b5cf6)' }} title="Změnit barvu (přebije individuální barvy)" />
                <div className="absolute right-0 top-5 z-20 hidden group-hover/idaysdot:flex flex-wrap gap-1 p-2 rounded-lg border shadow-xl" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', width: 112 }}>
                  {DEFAULT_COLORS.map(c => (
                    <button key={c} onClick={() => { setImportantDaysColor(c); localStorage.setItem('trackino_cal_important_days_color', c); }} className="w-4 h-4 rounded-full transition-all" style={{ background: c, boxShadow: importantDaysColor === c ? `0 0 0 1.5px white, 0 0 0 3px ${c}` : 'none' }} />
                  ))}
                  <button onClick={() => { setImportantDaysColor(null); localStorage.setItem('trackino_cal_important_days_color', 'null'); }} className="w-4 h-4 rounded-full border flex items-center justify-center text-[8px]" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg-hover)' }} title="Individuální barvy">○</button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── SDÍLENÉ KALENDÁŘE ────────────────────────────────────────────────── */}
      {sharedWithMe.length > 0 && (
        <div className="mb-3">
          <div className="mb-2">
            <button
              onClick={() => setSharedCalExpanded(!sharedCalExpanded)}
              className="flex items-center gap-1 text-[10px] font-semibold tracking-wider"
              style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              SDÍLENÉ KALENDÁŘE
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transform: sharedCalExpanded ? 'none' : 'rotate(-90deg)', transition: 'transform 0.15s', flexShrink: 0 }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
          </div>
          {sharedCalExpanded && sharedWithMe.map(shared => (
            <div key={shared.share_id} className="flex items-center gap-1.5 py-0.5 group/shared">
              <button
                role="checkbox"
                aria-checked={shared.is_enabled}
                onClick={() => updateSharePref(shared.calendar_id, { is_enabled: !shared.is_enabled })}
                className="w-3.5 h-3.5 rounded flex-shrink-0 flex items-center justify-center border-[1.5px] transition-colors cursor-pointer"
                style={{
                  background: shared.is_enabled ? (shared.color_override ?? shared.base_color) : 'transparent',
                  borderColor: shared.color_override ?? shared.base_color,
                }}
              >
                {shared.is_enabled && (
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </button>
              <div className="flex-1 min-w-0">
                <span className="text-xs block truncate" style={{ color: 'var(--text-primary)' }}>{shared.name}</span>
                <span className="text-[10px] block truncate" style={{ color: 'var(--text-muted)' }}>{shared.owner_name}</span>
              </div>
              <div className="relative opacity-0 group-hover/shared:opacity-100 transition-opacity flex-shrink-0 group/colorpick">
                <button className="w-3 h-3 rounded-full border border-transparent hover:border-white/30 transition-all" style={{ background: shared.color_override ?? shared.base_color }} title="Změnit barvu" />
                <div className="absolute right-0 top-5 z-20 hidden group-hover/colorpick:flex flex-wrap gap-1 p-2 rounded-lg border shadow-xl" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', width: 112 }}>
                  {DEFAULT_COLORS.map(c => (
                    <button key={c} onClick={() => updateSharePref(shared.calendar_id, { color_override: c })} className="w-4 h-4 rounded-full transition-all" style={{ background: c, boxShadow: (shared.color_override ?? shared.base_color) === c ? `0 0 0 1.5px white, 0 0 0 3px ${c}` : 'none' }} />
                  ))}
                  <button onClick={() => updateSharePref(shared.calendar_id, { color_override: null })} className="w-4 h-4 rounded-full border flex items-center justify-center text-[8px]" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg-hover)' }} title="Výchozí barva">○</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── DALŠÍ KALENDÁŘE ─────────────────────────────────────────────────── */}
      <div className="mb-3">
        <div className="mb-2">
          <button
            onClick={() => setOtherExpanded(!otherExpanded)}
            className="flex items-center gap-1 text-[10px] font-semibold tracking-wider"
            style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            DALŠÍ KALENDÁŘE
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transform: otherExpanded ? 'none' : 'rotate(-90deg)', transition: 'transform 0.15s', flexShrink: 0 }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        </div>
        {otherExpanded && (
          <>
            {/* Státní svátky */}
            <div className="flex items-center gap-1.5 py-0.5 group/holrow">
              <button role="checkbox" aria-checked={showHolidays}
                onClick={() => { const v = !showHolidays; localStorage.setItem('trackino_cal_holidays', v ? '1' : '0'); setShowHolidays(v); }}
                className="w-3.5 h-3.5 rounded flex-shrink-0 flex items-center justify-center border-[1.5px] transition-colors cursor-pointer"
                style={{ background: showHolidays ? holidayColor : 'transparent', borderColor: holidayColor }}
              >
                {showHolidays && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
              </button>
              <span className="text-xs flex-1" style={{ color: 'var(--text-secondary)' }}>Státní svátky</span>
              <div className="relative opacity-0 group-hover/holrow:opacity-100 transition-opacity flex-shrink-0 group/holdot">
                <button className="w-3 h-3 rounded-full border border-transparent hover:border-white/30 transition-all" style={{ background: holidayColor }} title="Změnit barvu" />
                <div className="absolute right-0 top-5 z-20 hidden group-hover/holdot:flex flex-wrap gap-1 p-2 rounded-lg border shadow-xl" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', width: 112 }}>
                  {DEFAULT_COLORS.map(c => (<button key={c} onClick={() => { setHolidayColor(c); localStorage.setItem('trackino_cal_holiday_color', c); }} className="w-4 h-4 rounded-full transition-all" style={{ background: c, boxShadow: holidayColor === c ? `0 0 0 1.5px white, 0 0 0 3px ${c}` : 'none' }} />))}
                  <button onClick={() => { setHolidayColor('#ef4444'); localStorage.setItem('trackino_cal_holiday_color', '#ef4444'); }} className="w-4 h-4 rounded-full border flex items-center justify-center text-[8px]" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg-hover)' }} title="Výchozí barva">○</button>
                </div>
              </div>
            </div>
            {/* Jmeniny */}
            <div className="flex items-center gap-1.5 py-0.5 group/ndrow">
              <button role="checkbox" aria-checked={showNamedays}
                onClick={() => { const v = !showNamedays; localStorage.setItem('trackino_cal_namedays', v ? '1' : '0'); setShowNamedays(v); }}
                className="w-3.5 h-3.5 rounded flex-shrink-0 flex items-center justify-center border-[1.5px] transition-colors cursor-pointer"
                style={{ background: showNamedays ? namedayColor : 'transparent', borderColor: namedayColor }}
              >
                {showNamedays && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
              </button>
              <span className="text-xs flex-1" style={{ color: 'var(--text-secondary)' }}>Jmeniny</span>
              <div className="relative opacity-0 group-hover/ndrow:opacity-100 transition-opacity flex-shrink-0 group/nddot">
                <button className="w-3 h-3 rounded-full border border-transparent hover:border-white/30 transition-all" style={{ background: namedayColor }} title="Změnit barvu" />
                <div className="absolute right-0 top-5 z-20 hidden group-hover/nddot:flex flex-wrap gap-1 p-2 rounded-lg border shadow-xl" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', width: 112 }}>
                  {DEFAULT_COLORS.map(c => (<button key={c} onClick={() => { setNamedayColor(c); localStorage.setItem('trackino_cal_nameday_color', c); }} className="w-4 h-4 rounded-full transition-all" style={{ background: c, boxShadow: namedayColor === c ? `0 0 0 1.5px white, 0 0 0 3px ${c}` : 'none' }} />))}
                  <button onClick={() => { setNamedayColor('#7c3aed'); localStorage.setItem('trackino_cal_nameday_color', '#7c3aed'); }} className="w-4 h-4 rounded-full border flex items-center justify-center text-[8px]" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg-hover)' }} title="Výchozí barva">○</button>
                </div>
              </div>
            </div>
            {/* Narozeniny */}
            {canViewBirthdays && (
              <div className="flex items-center gap-1.5 py-0.5 group/bdrow">
                <button role="checkbox" aria-checked={showBirthdays}
                  onClick={() => { const v = !showBirthdays; localStorage.setItem('trackino_cal_birthdays', v ? '1' : '0'); setShowBirthdays(v); }}
                  className="w-3.5 h-3.5 rounded flex-shrink-0 flex items-center justify-center border-[1.5px] transition-colors cursor-pointer"
                  style={{ background: showBirthdays ? birthdayColor : 'transparent', borderColor: birthdayColor }}
                >
                  {showBirthdays && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                </button>
                <span className="text-xs flex-1" style={{ color: 'var(--text-secondary)' }}>Narozeniny</span>
                <div className="relative opacity-0 group-hover/bdrow:opacity-100 transition-opacity flex-shrink-0 group/bddot">
                  <button className="w-3 h-3 rounded-full border border-transparent hover:border-white/30 transition-all" style={{ background: birthdayColor }} title="Změnit barvu" />
                  <div className="absolute right-0 top-5 z-20 hidden group-hover/bddot:flex flex-wrap gap-1 p-2 rounded-lg border shadow-xl" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', width: 112 }}>
                    {DEFAULT_COLORS.map(c => (<button key={c} onClick={() => { setBirthdayColor(c); localStorage.setItem('trackino_cal_birthday_color', c); }} className="w-4 h-4 rounded-full transition-all" style={{ background: c, boxShadow: birthdayColor === c ? `0 0 0 1.5px white, 0 0 0 3px ${c}` : 'none' }} />))}
                    <button onClick={() => { setBirthdayColor('#ec4899'); localStorage.setItem('trackino_cal_birthday_color', '#ec4899'); }} className="w-4 h-4 rounded-full border flex items-center justify-center text-[8px]" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg-hover)' }} title="Výchozí barva">○</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Nastavení kalendáře ────────────────────────────────────────────── */}
      <div className="border-t pt-3 pb-4" style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={() => { setCalSettingsForm({ viewStart: calViewStart, viewEnd: calViewEnd }); setShowCalSettings(true); }}
          className="flex items-center gap-2 w-full py-1 px-1 text-xs transition-colors rounded"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          Nastavení kalendáře
        </button>
      </div>
    </>
  );
}
