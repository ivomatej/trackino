// Lokální typy pro dashboard (Přehled)

export interface NotificationItem {
  id: string;
  type: 'vacation' | 'request' | 'feedback' | 'invoice' | 'calendar_invite' | 'kb_review';
  title: string;
  date: string;
  href: string;
}

export interface WeekDayData {
  day: string;
  hours: number;
  isToday: boolean;
}

export const CZECH_SHORT_DAYS = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];
