'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { CronJob, CronHistoryItem, CronTemplate, CronSchedule } from '../types';
import { CRON_TEMPLATES } from '../constants';

interface Props {
  workspaceId: string;
  onMessage: (msg: string) => void;
}

export default function TabAutomation({ workspaceId, onMessage }: Props) {
  const [automationJobs, setAutomationJobs] = useState<CronJob[]>([]);
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoCreating, setAutoCreating] = useState(false);
  const [autoHistoryJobId, setAutoHistoryJobId] = useState<number | null>(null);
  const [autoHistory, setAutoHistory] = useState<CronHistoryItem[]>([]);
  const [autoHistoryLoading, setAutoHistoryLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [autoResults, setAutoResults] = useState<{ id: string; title: string; content: string; status: string; created_at: string }[]>([]);
  const [autoResultsLoading, setAutoResultsLoading] = useState(false);
  const [expandedResult, setExpandedResult] = useState<string | null>(null);
  const [editingJob, setEditingJob] = useState<CronJob | null>(null);
  const [editTime, setEditTime] = useState('08:00');
  const [editWdays, setEditWdays] = useState<number[]>([-1]);
  const [editMdays, setEditMdays] = useState<number[]>([-1]);
  const [editTimezone, setEditTimezone] = useState('Europe/Prague');
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    fetchAutomationJobs();
    fetchAutoResults(workspaceId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  async function fetchAutomationJobs() {
    setAutoLoading(true);
    try {
      const res = await fetch('/api/cron-jobs');
      if (res.ok) {
        const data = await res.json();
        setAutomationJobs((data.jobs ?? []) as CronJob[]);
      }
    } catch { /* ignore */ }
    setAutoLoading(false);
  }

  async function fetchAutoResults(wsId: string) {
    setAutoResultsLoading(true);
    try {
      const { data } = await supabase
        .from('trackino_cron_results')
        .select('id, title, content, status, created_at')
        .eq('workspace_id', wsId)
        .order('created_at', { ascending: false })
        .limit(20);
      setAutoResults((data ?? []) as { id: string; title: string; content: string; status: string; created_at: string }[]);
    } catch { /* tabulka ještě neexistuje */ }
    setAutoResultsLoading(false);
  }

  async function createCronJob(template: CronTemplate) {
    setAutoCreating(true);
    try {
      const body = {
        title: template.title,
        url: template.url,
        enabled: true,
        schedule: template.schedule,
        extendedData: {
          body: JSON.stringify({ workspace_id: workspaceId }),
        },
      };
      const res = await fetch('/api/cron-jobs', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.ok) {
        setShowCreateModal(false);
        setSelectedTemplate(null);
        await fetchAutomationJobs();
        onMessage('Automatizace přidána.');
        setTimeout(() => onMessage(''), 3000);
      } else {
        const err = await res.json();
        onMessage('Chyba: ' + (err.error ?? JSON.stringify(err)));
        setTimeout(() => onMessage(''), 5000);
      }
    } catch (e) {
      onMessage('Chyba při vytváření: ' + String(e));
      setTimeout(() => onMessage(''), 5000);
    }
    setAutoCreating(false);
  }

  async function toggleCronJob(jobId: number, enabled: boolean) {
    setAutomationJobs(prev => prev.map(j => j.jobId === jobId ? { ...j, enabled } : j));
    const res = await fetch(`/api/cron-jobs/${jobId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    if (!res.ok) {
      setAutomationJobs(prev => prev.map(j => j.jobId === jobId ? { ...j, enabled: !enabled } : j));
    }
  }

  async function deleteCronJob(jobId: number) {
    if (!confirm('Opravdu smazat tuto automatizaci?')) return;
    const res = await fetch(`/api/cron-jobs/${jobId}`, { method: 'DELETE' });
    if (res.ok) {
      setAutomationJobs(prev => prev.filter(j => j.jobId !== jobId));
      if (autoHistoryJobId === jobId) setAutoHistoryJobId(null);
    }
  }

  async function fetchJobHistory(jobId: number) {
    if (autoHistoryJobId === jobId) {
      setAutoHistoryJobId(null);
      return;
    }
    setAutoHistoryJobId(jobId);
    setAutoHistoryLoading(true);
    setAutoHistory([]);
    try {
      const res = await fetch(`/api/cron-jobs/${jobId}/history`);
      if (res.ok) {
        const data = await res.json();
        setAutoHistory((data.history ?? []) as CronHistoryItem[]);
      }
    } catch { /* ignore */ }
    setAutoHistoryLoading(false);
  }

  function openEditJob(job: CronJob) {
    setEditingJob(job);
    const h = String(job.schedule.hours?.[0] ?? 8).padStart(2, '0');
    const m = String(job.schedule.minutes?.[0] ?? 0).padStart(2, '0');
    setEditTime(`${h}:${m}`);
    setEditWdays(job.schedule.wdays ?? [-1]);
    setEditMdays(job.schedule.mdays ?? [-1]);
    setEditTimezone(job.schedule.timezone ?? 'Europe/Prague');
  }

  async function saveJobEdit() {
    if (!editingJob) return;
    setEditSaving(true);
    const [tH, tM] = editTime.split(':');
    const schedule: CronSchedule = {
      timezone: editTimezone,
      hours: [parseInt(tH ?? '8', 10)],
      minutes: [parseInt(tM ?? '0', 10)],
      wdays: editWdays,
      mdays: editMdays,
      months: editingJob.schedule.months ?? [-1],
      expiresAt: 0,
    };
    const res = await fetch(`/api/cron-jobs/${editingJob.jobId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schedule }),
    });
    if (res.ok) {
      setAutomationJobs(prev => prev.map(j =>
        j.jobId === editingJob.jobId ? { ...j, schedule } : j,
      ));
      setEditingJob(null);
      onMessage('Automatizace aktualizována.');
      setTimeout(() => onMessage(''), 3000);
    } else {
      const err = await res.json();
      onMessage('Chyba při ukládání: ' + (err.error ?? JSON.stringify(err)));
      setTimeout(() => onMessage(''), 5000);
    }
    setEditSaving(false);
  }

  return (
    <>
      <div className="space-y-5">
        {/* Header s tlačítkem přidat */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Automatizace</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Naplánované úlohy spouštěné přes cron-job.org. Výsledky jsou ukládány níže.</p>
          </div>
          <button
            onClick={() => { setShowCreateModal(true); setSelectedTemplate(null); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: 'var(--primary)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Přidat automatizaci
          </button>
        </div>

        {/* Seznam aktivních jobů */}
        <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          {autoLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-5 h-5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : automationJobs.length === 0 ? (
            <div className="py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              Žádné aktivní automatizace. Přidejte první kliknutím na tlačítko výše.
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {automationJobs.map(job => {
                const isHistoryOpen = autoHistoryJobId === job.jobId;
                const tmpl = CRON_TEMPLATES.find(t => job.url.includes(t.id));
                return (
                  <div key={job.jobId}>
                    <div className="flex items-center gap-3 px-4 py-3">
                      {/* Enabled toggle */}
                      <button
                        onClick={() => toggleCronJob(job.jobId, !job.enabled)}
                        className="flex-shrink-0 relative inline-flex items-center w-9 h-5 rounded-full transition-colors"
                        style={{ background: job.enabled ? 'var(--primary)' : 'var(--border)' }}
                        title={job.enabled ? 'Zapnuto – kliknutím vypnout' : 'Vypnuto – kliknutím zapnout'}
                      >
                        <span
                          className="absolute w-4 h-4 rounded-full bg-white transition-transform top-0.5 left-0.5"
                          style={{ transform: job.enabled ? 'translateX(16px)' : 'translateX(0)' }}
                        />
                      </button>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{job.title || tmpl?.title || '—'}</div>
                        <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                          {tmpl?.scheduleLabel ?? '—'} · <span className="font-mono">{job.url}</span>
                        </div>
                      </div>

                      {/* Akce */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => fetchJobHistory(job.jobId)}
                          title="Historie spuštění"
                          className="p-1.5 rounded-lg transition-colors hover:opacity-70"
                          style={{ color: isHistoryOpen ? 'var(--primary)' : 'var(--text-muted)' }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        </button>
                        <button
                          onClick={() => openEditJob(job)}
                          title="Upravit rozvrh"
                          className="p-1.5 rounded-lg transition-colors hover:opacity-70"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button
                          onClick={() => deleteCronJob(job.jobId)}
                          title="Smazat automatizaci"
                          className="p-1.5 rounded-lg transition-colors hover:opacity-70"
                          style={{ color: '#ef4444' }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        </button>
                      </div>
                    </div>

                    {/* Historie panel */}
                    {isHistoryOpen && (
                      <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
                        <p className="text-xs font-semibold py-2" style={{ color: 'var(--text-secondary)' }}>Posledních 10 spuštění</p>
                        {autoHistoryLoading ? (
                          <div className="flex justify-center py-4">
                            <div className="w-4 h-4 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
                          </div>
                        ) : autoHistory.length === 0 ? (
                          <p className="text-xs py-2" style={{ color: 'var(--text-muted)' }}>Žádná spuštění zatím.</p>
                        ) : (
                          <div className="space-y-1">
                            {autoHistory.slice(0, 10).map(h => {
                              const date = new Date(h.date * 1000).toLocaleString('cs-CZ');
                              const ok = h.httpStatus >= 200 && h.httpStatus < 300;
                              return (
                                <div key={h.historyId} className="flex items-center gap-2 text-xs">
                                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ok ? 'bg-green-500' : 'bg-red-500'}`} />
                                  <span style={{ color: 'var(--text-secondary)' }}>{date}</span>
                                  <span style={{ color: ok ? 'var(--text-muted)' : '#ef4444' }}>HTTP {h.httpStatus}</span>
                                  <span style={{ color: 'var(--text-muted)' }}>{(h.duration / 1000).toFixed(1)} s</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Výsledky automatizací */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Výsledky automatizací</h3>
            <button
              onClick={() => fetchAutoResults(workspaceId)}
              className="text-xs px-2 py-1 rounded-lg border"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            >
              Obnovit
            </button>
          </div>
          {autoResultsLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : autoResults.length === 0 ? (
            <div className="p-4 rounded-xl border text-sm text-center" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)', color: 'var(--text-muted)' }}>
              Zatím žádné výsledky. Výsledky se zobrazí po prvním spuštění automatizací.
            </div>
          ) : (
            <div className="space-y-2">
              {autoResults.map(r => {
                const isExpanded = expandedResult === r.id;
                const date = new Date(r.created_at).toLocaleString('cs-CZ');
                const isError = r.status === 'error';
                return (
                  <div key={r.id} className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: isError ? '#ef444466' : 'var(--border)' }}>
                    <button
                      onClick={() => setExpandedResult(isExpanded ? null : r.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left"
                    >
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isError ? 'bg-red-500' : 'bg-green-500'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{r.title}</div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{date}</div>
                      </div>
                      <svg
                        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        style={{ color: 'var(--text-muted)', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                      >
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--border)' }}>
                        <div
                          className="mt-3 text-xs whitespace-pre-wrap leading-relaxed"
                          style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}
                        >
                          {r.content}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* MODAL: Úprava rozvrhu automatizace */}
      {editingJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-md rounded-2xl shadow-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Upravit rozvrh</h2>
              <button onClick={() => setEditingJob(null)} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              <div>
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Automatizace</p>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{editingJob.title}</p>
              </div>

              <div>
                <label className="text-xs font-medium block mb-2" style={{ color: 'var(--text-secondary)' }}>Čas spuštění</label>
                <input
                  type="time"
                  value={editTime}
                  onChange={e => setEditTime(e.target.value)}
                  className="rounded-lg px-3 py-2 text-sm border text-base sm:text-sm"
                  style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </div>

              <div>
                <label className="text-xs font-medium block mb-2" style={{ color: 'var(--text-secondary)' }}>Den v týdnu (prázdné = každý den)</label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'Po', val: 1 }, { label: 'Út', val: 2 }, { label: 'St', val: 3 },
                    { label: 'Čt', val: 4 }, { label: 'Pá', val: 5 }, { label: 'So', val: 6 }, { label: 'Ne', val: 0 },
                  ].map(day => {
                    const isEvery = editWdays.includes(-1);
                    const isSelected = isEvery ? false : editWdays.includes(day.val);
                    return (
                      <button
                        key={day.val}
                        type="button"
                        onClick={() => {
                          if (isEvery) {
                            setEditWdays([day.val]);
                          } else if (isSelected) {
                            const next = editWdays.filter(w => w !== day.val);
                            setEditWdays(next.length === 0 ? [-1] : next);
                          } else {
                            setEditWdays([...editWdays, day.val]);
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                        style={{
                          background: isSelected ? 'var(--primary)' : 'var(--bg-hover)',
                          borderColor: isSelected ? 'var(--primary)' : 'var(--border)',
                          color: isSelected ? 'white' : 'var(--text-secondary)',
                        }}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setEditWdays([-1])}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                    style={{
                      background: editWdays.includes(-1) ? 'var(--primary)' : 'var(--bg-hover)',
                      borderColor: editWdays.includes(-1) ? 'var(--primary)' : 'var(--border)',
                      color: editWdays.includes(-1) ? 'white' : 'var(--text-secondary)',
                    }}
                  >
                    Každý den
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium block mb-2" style={{ color: 'var(--text-secondary)' }}>Časové pásmo</label>
                <div className="select-wrapper">
                  <select
                    value={editTimezone}
                    onChange={e => setEditTimezone(e.target.value)}
                    className="rounded-lg px-3 py-2 text-sm border text-base sm:text-sm"
                    style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  >
                    <option value="Europe/Prague">Europe/Prague (výchozí)</option>
                    <option value="Europe/London">Europe/London</option>
                    <option value="Europe/Berlin">Europe/Berlin</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
              <button
                onClick={() => setEditingJob(null)}
                className="px-4 py-2 rounded-xl text-sm border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              >
                Zrušit
              </button>
              <button
                onClick={saveJobEdit}
                disabled={editSaving}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60"
                style={{ background: 'var(--primary)' }}
              >
                {editSaving ? 'Ukládám...' : 'Uložit rozvrh'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Vytvoření automatizace */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-lg rounded-2xl shadow-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Přidat automatizaci</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="px-6 py-4 space-y-2 max-h-[60vh] overflow-y-auto">
              <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>Vyberte šablonu automatizace. Po potvrzení bude job zaregistrován na cron-job.org.</p>
              {CRON_TEMPLATES.map(tmpl => (
                <button
                  key={tmpl.id}
                  onClick={() => setSelectedTemplate(tmpl.id)}
                  className="w-full text-left px-4 py-3 rounded-xl border transition-colors"
                  style={{
                    borderColor: selectedTemplate === tmpl.id ? 'var(--primary)' : 'var(--border)',
                    background: selectedTemplate === tmpl.id ? 'color-mix(in srgb, var(--primary) 8%, var(--bg-hover))' : 'var(--bg-hover)',
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{tmpl.title}</div>
                    <div className="text-xs flex-shrink-0 px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>{tmpl.scheduleLabel}</div>
                  </div>
                  <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{tmpl.description}</div>
                </button>
              ))}
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-lg text-sm border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
              >
                Zrušit
              </button>
              <button
                onClick={() => {
                  const tmpl = CRON_TEMPLATES.find(t => t.id === selectedTemplate);
                  if (tmpl) createCronJob(tmpl);
                }}
                disabled={!selectedTemplate || autoCreating}
                className="px-5 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ background: 'var(--primary)' }}
              >
                {autoCreating ? 'Registruji...' : 'Přidat'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
