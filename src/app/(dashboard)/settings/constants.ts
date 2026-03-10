import type { CronTemplate } from './types';

export const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: 'Europe/Prague',        label: 'Praha / Bratislava (UTC+1/+2)' },
  { value: 'Europe/Warsaw',        label: 'Varšava (UTC+1/+2)' },
  { value: 'Europe/Berlin',        label: 'Berlín / Vídeň / Curych (UTC+1/+2)' },
  { value: 'Europe/Paris',         label: 'Paříž / Brusel (UTC+1/+2)' },
  { value: 'Europe/Rome',          label: 'Řím / Madrid (UTC+1/+2)' },
  { value: 'Europe/London',        label: 'Londýn (UTC+0/+1)' },
  { value: 'Europe/Lisbon',        label: 'Lisabon (UTC+0/+1)' },
  { value: 'Europe/Bucharest',     label: 'Bukurešť / Sofia (UTC+2/+3)' },
  { value: 'Europe/Helsinki',      label: 'Helsinky / Tallinn (UTC+2/+3)' },
  { value: 'Europe/Moscow',        label: 'Moskva (UTC+3)' },
  { value: 'UTC',                  label: 'UTC (±0)' },
  { value: 'America/New_York',     label: 'New York / Toronto (UTC-5/-4)' },
  { value: 'America/Chicago',      label: 'Chicago (UTC-6/-5)' },
  { value: 'America/Denver',       label: 'Denver (UTC-7/-6)' },
  { value: 'America/Los_Angeles',  label: 'Los Angeles / Vancouver (UTC-8/-7)' },
  { value: 'America/Sao_Paulo',    label: 'São Paulo (UTC-3/-2)' },
  { value: 'Africa/Cairo',         label: 'Káhira (UTC+2/+3)' },
  { value: 'Asia/Dubai',           label: 'Dubaj (UTC+4)' },
  { value: 'Asia/Kolkata',         label: 'Indie (UTC+5:30)' },
  { value: 'Asia/Bangkok',         label: 'Bangkok / Jakarta (UTC+7)' },
  { value: 'Asia/Singapore',       label: 'Singapur / Kuala Lumpur (UTC+8)' },
  { value: 'Asia/Shanghai',        label: 'Peking / Shanghai (UTC+8)' },
  { value: 'Asia/Tokyo',           label: 'Tokio / Soul (UTC+9)' },
  { value: 'Australia/Sydney',     label: 'Sydney (UTC+10/+11)' },
];

export const CRON_TEMPLATES: CronTemplate[] = [
  {
    id: 'weekly-report',
    title: 'Týdenní AI report hodin',
    description: 'Každé pondělí vygeneruje AI přehled odpracovaných hodin za minulý týden s komentářem.',
    url: '/api/cron/weekly-report',
    scheduleLabel: 'Každé pondělí v 8:00',
    schedule: { timezone: 'Europe/Prague', hours: [8], minutes: [0], wdays: [1], mdays: [-1], months: [-1], expiresAt: 0 },
  },
  {
    id: 'inactive-check',
    title: 'Kontrola neaktivních členů',
    description: 'Každé pondělí zkontroluje, kteří členové workspace nemají žádný záznam za posledních 14 dní.',
    url: '/api/cron/inactive-check',
    scheduleLabel: 'Každé pondělí v 8:30',
    schedule: { timezone: 'Europe/Prague', hours: [8], minutes: [30], wdays: [1], mdays: [-1], months: [-1], expiresAt: 0 },
  },
  {
    id: 'kb-reviews-digest',
    title: 'Digest revizí KB',
    description: 'Každé pondělí shrne revize znalostní báze splatné v příštích 7 dnech a po splatnosti.',
    url: '/api/cron/kb-reviews-digest',
    scheduleLabel: 'Každé pondělí v 7:00',
    schedule: { timezone: 'Europe/Prague', hours: [7], minutes: [0], wdays: [1], mdays: [-1], months: [-1], expiresAt: 0 },
  },
  {
    id: 'feedback-summary',
    title: 'Shrnutí feedbacku (AI)',
    description: 'Každý pátek AI shrne a kategorizuje anonymní připomínky odeslané za týden.',
    url: '/api/cron/feedback-summary',
    scheduleLabel: 'Každý pátek v 16:00',
    schedule: { timezone: 'Europe/Prague', hours: [16], minutes: [0], wdays: [5], mdays: [-1], months: [-1], expiresAt: 0 },
  },
  {
    id: 'vacation-report',
    title: 'Report dovolených',
    description: 'Každý 1. v měsíci vygeneruje přehled čerpání dovolené všech členů za aktuální rok.',
    url: '/api/cron/vacation-report',
    scheduleLabel: '1. každého měsíce v 7:00',
    schedule: { timezone: 'Europe/Prague', hours: [7], minutes: [0], wdays: [-1], mdays: [1], months: [-1], expiresAt: 0 },
  },
];

// Sdílené CSS konstanty pro formuláře
export const INPUT_CLS = 'w-full px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent';
export const SELECT_CLS = 'w-full px-3 py-2 pr-8 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent appearance-none cursor-pointer';
export const INPUT_STYLE = { borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' } as const;
export const LABEL_CLS = 'block text-xs font-medium mb-1';
