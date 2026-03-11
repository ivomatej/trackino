// Lokální typy pro modul Plánovač

export interface StripItem {
  id: string;
  title: string;
  color: string;
  startCol: number; // 0–6 v aktuálním týdnu
  endCol: number;   // 0–6 v aktuálním týdnu
}

export interface MemberRow {
  userId: string;
  displayName: string;
  avatarColor: string;
  isPinned: boolean;
  isSelf: boolean;
}

export type Half = 'am' | 'pm' | 'full';
export type CellKey = string; // `${userId}|${dateStr}|${half}`
export type DayKey = string;  // `${userId}|${dateStr}`

export interface CellData {
  statusId: string | null;
  note: string;
}

export interface EditingCell {
  userId: string;
  date: string;
  half: Half;
}
