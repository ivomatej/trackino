import React from 'react';
import type {
  SubscriptionStatus,
  SubscriptionType,
  SubscriptionFrequency,
  SubscriptionPriority,
  SubscriptionCurrency,
} from '@/types/database';

export const STATUS_CONFIG: Record<SubscriptionStatus, { label: string; color: string }> = {
  active: { label: 'Aktivní', color: '#22c55e' },
  paused: { label: 'Pozastaveno', color: '#f59e0b' },
  cancelled: { label: 'Zrušeno', color: '#ef4444' },
  trial: { label: 'Zkušební', color: '#3b82f6' },
  pending_approval: { label: 'Ke schválení', color: '#8b5cf6' },
};

export const TYPE_LABELS: Record<SubscriptionType, string> = {
  saas: 'SaaS',
  hosting: 'Hosting',
  license: 'Licence',
  domain: 'Doména',
  other: 'Jiné',
};

export const FREQUENCY_LABELS: Record<SubscriptionFrequency, string> = {
  monthly: 'Měsíčně',
  quarterly: 'Čtvrtletně',
  yearly: 'Ročně',
  biennial: 'Dvouletně',
  one_time: 'Jednorázově',
};

export const PRIORITY_CONFIG: Record<SubscriptionPriority, { label: string; color: string }> = {
  high: { label: 'Vysoká', color: '#ef4444' },
  medium: { label: 'Střední', color: '#f59e0b' },
  low: { label: 'Nízká', color: '#22c55e' },
};

export const CATEGORY_COLORS = [
  '#6366f1', '#3b82f6', '#0ea5e9', '#14b8a6', '#22c55e',
  '#84cc16', '#eab308', '#f59e0b', '#ef4444', '#ec4899',
  '#8b5cf6', '#64748b',
];

export const CURRENCIES: SubscriptionCurrency[] = ['CZK', 'EUR', 'USD'];

export const ICONS = {
  plus: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  edit: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>,
  trash: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>,
  search: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  link: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  star: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  starEmpty: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  chevronDown: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
};

export const inputCls = 'w-full px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]';
export const inputStyle: React.CSSProperties = { borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' };
export const btnPrimary = 'px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors';
