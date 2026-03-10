'use client';
// ─── Calendar Module – EventFormModal ────────────────────────────────────────
// Přesunuto z page.tsx (ř. 4956–5329)

import { useCalendarContext } from '../CalendarContext';
import { DEFAULT_COLORS } from '../utils';
import { RECURRENCE_OPTIONS } from '../recurrenceUtils';

export default function EventFormModal() {
  const {
    showEventForm, setShowEventForm,
    editingEvent,
    eventForm, setEventForm,
    calendars,
    eventAttendees,
    workspaceMembers,
    attendeeSearch, setAttendeeSearch,
    showAttendeeDropdown, setShowAttendeeDropdown,
    savingEvent, deletingEventId,
    saveEvent, deleteEvent,
  } = useCalendarContext();

  if (!showEventForm) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className="w-full max-w-md rounded-xl shadow-xl border overflow-y-auto overflow-x-hidden"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', maxHeight: '90vh', transform: 'translateZ(0)' }}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              {editingEvent ? 'Upravit událost' : 'Nová událost'}
            </h2>
            <button onClick={() => setShowEventForm(false)} className="p-1 rounded" style={{ color: 'var(--text-muted)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            {/* Název */}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Název *</label>
              <input
                type="text"
                value={eventForm.title}
                onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Název události"
                className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                autoFocus
              />
            </div>

            {/* Kalendář */}
            {calendars.length > 1 && (
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Kalendář</label>
                <div className="relative">
                  <select
                    value={eventForm.calendar_id}
                    onChange={e => setEventForm(f => ({ ...f, calendar_id: e.target.value }))}
                    className="w-full appearance-none px-3 py-2 pr-8 rounded-lg border text-base sm:text-sm"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                  >
                    {calendars.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--text-muted)' }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>
            )}

            {/* Datum Od / Do */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="min-w-0">
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Od *</label>
                <input
                  type="date"
                  value={eventForm.start_date}
                  onChange={e => setEventForm(f => ({ ...f, start_date: e.target.value, end_date: f.end_date < e.target.value ? e.target.value : f.end_date }))}
                  className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)', maxWidth: '100%' }}
                />
              </div>
              <div className="min-w-0">
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Do</label>
                <input
                  type="date"
                  value={eventForm.end_date}
                  min={eventForm.start_date}
                  onChange={e => setEventForm(f => ({ ...f, end_date: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)', maxWidth: '100%' }}
                />
              </div>
            </div>

            {/* Celý den */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="cal_is_all_day"
                checked={eventForm.is_all_day}
                onChange={e => setEventForm(f => ({ ...f, is_all_day: e.target.checked }))}
                className="w-4 h-4 rounded cursor-pointer"
                style={{ accentColor: 'var(--primary)' }}
              />
              <label htmlFor="cal_is_all_day" className="text-sm cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                Celý den
              </label>
            </div>

            {/* Časy */}
            {!eventForm.is_all_day && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Čas začátku</label>
                  <input
                    type="time"
                    value={eventForm.start_time}
                    onChange={e => setEventForm(f => ({ ...f, start_time: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)', maxWidth: '100%' }}
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Čas konce</label>
                  <input
                    type="time"
                    value={eventForm.end_time}
                    onChange={e => setEventForm(f => ({ ...f, end_time: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)', maxWidth: '100%' }}
                  />
                </div>
              </div>
            )}

            {/* Opakování */}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Opakování</label>
              <div className="relative">
                <select
                  value={eventForm.recurrence_type}
                  onChange={e => setEventForm(f => ({
                    ...f,
                    recurrence_type: e.target.value,
                    recurrence_day: e.target.value === 'monthly_on_day' ? (f.recurrence_day ?? 1) : null,
                  }))}
                  className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm appearance-none pr-8"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                >
                  {RECURRENCE_OPTIONS.map((opt, i) =>
                    opt.separator
                      ? <option key={`sep-${i}`} disabled>──────────</option>
                      : <option key={opt.value} value={opt.value}>{opt.label}</option>
                  )}
                </select>
                <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
              {eventForm.recurrence_type === 'monthly_on_day' && (
                <div className="mt-2">
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Den v měsíci</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={eventForm.recurrence_day ?? 1}
                    onChange={e => setEventForm(f => ({ ...f, recurrence_day: Math.max(1, Math.min(31, parseInt(e.target.value) || 1)) }))}
                    className="w-24 px-3 py-2 rounded-lg border text-base sm:text-sm"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                  />
                </div>
              )}
            </div>

            {/* Místo */}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Místo</label>
              <input
                type="text"
                value={eventForm.location}
                onChange={e => setEventForm(f => ({ ...f, location: e.target.value }))}
                placeholder="Adresa nebo název místa"
                className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
              />
            </div>

            {/* Účastníci */}
            {workspaceMembers.length > 0 && (
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Účastníci</label>
                {/* Tagy + vyhledávání */}
                <div
                  className="min-h-[38px] px-2 py-1.5 rounded-lg border flex flex-wrap gap-1 items-center cursor-text"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}
                  onClick={() => setShowAttendeeDropdown(true)}
                >
                  {eventForm.attendee_ids.map(uid => {
                    const member = workspaceMembers.find(m => m.user_id === uid);
                    if (!member) return null;
                    return (
                      <span
                        key={uid}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white flex-shrink-0"
                        style={{ background: member.avatar_color }}
                      >
                        {member.display_name}
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setEventForm(f => ({ ...f, attendee_ids: f.attendee_ids.filter(id => id !== uid) }));
                          }}
                          className="ml-0.5 hover:opacity-70"
                        >
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </span>
                    );
                  })}
                  <input
                    type="text"
                    value={attendeeSearch}
                    onChange={e => { setAttendeeSearch(e.target.value); setShowAttendeeDropdown(true); }}
                    onFocus={() => setShowAttendeeDropdown(true)}
                    onBlur={() => setTimeout(() => setShowAttendeeDropdown(false), 150)}
                    placeholder={eventForm.attendee_ids.length === 0 ? 'Přidat účastníka...' : ''}
                    className="flex-1 min-w-[80px] bg-transparent text-base sm:text-sm outline-none"
                    style={{ color: 'var(--text-primary)' }}
                  />
                </div>
                {/* Dropdown */}
                {showAttendeeDropdown && (
                  <div className="relative z-10">
                    <div
                      className="absolute left-0 right-0 rounded-lg border shadow-lg overflow-y-auto"
                      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', maxHeight: 180, top: 2 }}
                    >
                      {workspaceMembers
                        .filter(m => !eventForm.attendee_ids.includes(m.user_id) && m.display_name.toLowerCase().includes(attendeeSearch.toLowerCase()))
                        .map(m => (
                          <button
                            key={m.user_id}
                            onMouseDown={() => {
                              setEventForm(f => ({ ...f, attendee_ids: [...f.attendee_ids, m.user_id] }));
                              setAttendeeSearch('');
                              setShowAttendeeDropdown(false);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors"
                            style={{ color: 'var(--text-primary)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0" style={{ background: m.avatar_color }}>
                              {m.display_name.slice(0, 1).toUpperCase()}
                            </span>
                            {m.display_name}
                          </button>
                        ))}
                      {workspaceMembers.filter(m => !eventForm.attendee_ids.includes(m.user_id) && m.display_name.toLowerCase().includes(attendeeSearch.toLowerCase())).length === 0 && (
                        <div className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>Žádní účastníci nenalezeni</div>
                      )}
                    </div>
                  </div>
                )}
                {/* RSVP stav účastníků (při editaci) */}
                {editingEvent && (eventAttendees[editingEvent.id]?.length ?? 0) > 0 && (
                  <div className="mt-2 space-y-1 px-1">
                    <p className="text-[10px] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Stav pozvání:</p>
                    {eventAttendees[editingEvent.id].map(att => {
                      const member = workspaceMembers.find(m => m.user_id === att.user_id);
                      return (
                        <div key={att.id} className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                          <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0" style={{ background: member?.avatar_color ?? '#6b7280' }}>
                            {(member?.display_name ?? '?').slice(0, 1).toUpperCase()}
                          </span>
                          <span className="flex-1 truncate">{member?.display_name ?? 'Uživatel'}</span>
                          {att.status === 'accepted' && <span className="font-medium" style={{ color: '#22c55e' }}>✓ Přijato</span>}
                          {att.status === 'declined' && <span className="font-medium" style={{ color: '#ef4444' }}>✗ Odmítnuto</span>}
                          {att.status === 'maybe' && <span className="font-medium" style={{ color: '#f59e0b' }}>~ Nezávazně</span>}
                          {att.status === 'pending' && <span style={{ color: 'var(--text-muted)' }}>? Čeká</span>}
                          {att.status === 'updated' && <span style={{ color: '#f59e0b' }}>! Změna čeká</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* URL */}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>URL</label>
              <input
                type="url"
                value={eventForm.url}
                onChange={e => setEventForm(f => ({ ...f, url: e.target.value }))}
                placeholder="https://..."
                className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
              />
            </div>

            {/* Upozornění */}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Upozornění</label>
              <div className="relative">
                <select
                  value={eventForm.reminder_minutes === null ? '' : String(eventForm.reminder_minutes)}
                  onChange={e => setEventForm(f => ({ ...f, reminder_minutes: e.target.value === '' ? null : parseInt(e.target.value) }))}
                  className="w-full appearance-none px-3 py-2 pr-8 rounded-lg border text-base sm:text-sm"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                >
                  <option value="">Bez upozornění</option>
                  <option value="5">5 minut před</option>
                  <option value="15">15 minut před</option>
                  <option value="30">30 minut před</option>
                  <option value="60">1 hodinu před</option>
                  <option value="1440">1 den před</option>
                </select>
                <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--text-muted)' }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>

            {/* Poznámka */}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Poznámka</label>
              <textarea
                value={eventForm.description}
                onChange={e => setEventForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Volitelná poznámka..."
                rows={2}
                className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm resize-none"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
              />
            </div>

            {/* Barva */}
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Barva</label>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setEventForm(f => ({ ...f, color: '' }))}
                  className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold"
                  style={{ borderColor: !eventForm.color ? 'var(--primary)' : 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg-hover)' }}
                  title="Barva dle kalendáře"
                >
                  ○
                </button>
                {DEFAULT_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setEventForm(f => ({ ...f, color: c }))}
                    className="w-6 h-6 rounded-full transition-all"
                    style={{
                      background: c,
                      boxShadow: eventForm.color === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : 'none',
                      transform: eventForm.color === c ? 'scale(1.15)' : 'scale(1)',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-6">
            {editingEvent ? (
              <button
                onClick={async () => {
                  if (confirm('Opravdu smazat tuto událost?')) {
                    await deleteEvent(editingEvent.id);
                  }
                }}
                disabled={deletingEventId === editingEvent.id}
                className="px-3 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
                style={{ color: '#ef4444' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#fee2e244')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                Smazat
              </button>
            ) : <div />}
            <div className="flex gap-2">
              <button
                onClick={() => setShowEventForm(false)}
                className="px-4 py-2 rounded-lg text-sm border transition-colors"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              >
                Zrušit
              </button>
              <button
                onClick={saveEvent}
                disabled={savingEvent || !eventForm.title.trim() || !eventForm.start_date}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-50"
                style={{ background: 'var(--primary)' }}
              >
                {savingEvent ? 'Ukládám...' : editingEvent ? 'Uložit' : 'Přidat'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
