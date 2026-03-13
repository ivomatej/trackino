'use client';

import { type NotificationItem } from './types';

interface NotificationsPanelProps {
  notifications: NotificationItem[];
}

export function NotificationsPanel({ notifications }: NotificationsPanelProps) {
  if (notifications.length === 0) return null;

  return (
    <div
      className="rounded-xl border p-5"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-center gap-2 mb-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          K vyřízení
        </h2>
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
          style={{ background: 'var(--primary)', color: 'white' }}
        >
          {notifications.length}
        </span>
      </div>
      <div className="space-y-1 max-h-[172px] overflow-y-auto">
        {notifications.map(n => {
          const icon = n.type === 'vacation' ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
          ) : n.type === 'request' ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
          ) : n.type === 'feedback' ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
          ) : n.type === 'calendar_invite' ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
          ) : n.type === 'kb_review' ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><polyline points="9 11 12 14 22 4"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>
          );

          const typeColor = n.type === 'vacation' ? '#10b981' : n.type === 'request' ? '#6366f1' : n.type === 'feedback' ? '#f59e0b' : n.type === 'calendar_invite' ? '#8b5cf6' : n.type === 'kb_review' ? '#0ea5e9' : '#3b82f6';
          const typeLabel = n.type === 'vacation' ? 'Dovolená' : n.type === 'request' ? 'Žádost' : n.type === 'feedback' ? 'Připomínka' : n.type === 'calendar_invite' ? 'Pozvánka' : n.type === 'kb_review' ? 'KB Revize' : 'Faktura';

          const dateStr = new Date(n.date).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' });
          const timeStr = new Date(n.date).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });

          return (
            <a
              key={n.id}
              href={n.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <span
                className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: typeColor + '18', color: typeColor }}
              >
                {icon}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                  {n.title}
                </div>
                <div className="text-[10px] flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                  <span className="font-medium" style={{ color: typeColor }}>{typeLabel}</span>
                  <span>·</span>
                  <span>{dateStr}, {timeStr}</span>
                </div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" className="flex-shrink-0 opacity-40">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </a>
          );
        })}
      </div>
    </div>
  );
}
