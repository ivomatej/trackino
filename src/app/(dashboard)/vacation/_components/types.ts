import type { VacationEntry, Profile } from '@/types/database';

// Dovolená delší než tento počet pracovních dnů vyžaduje schválení nadřízeného.
export const APPROVAL_THRESHOLD = 3;

export interface VacationEntryWithProfile extends VacationEntry {
  profile?: Profile;
  reviewerProfile?: Profile;
}

export type ActiveTab = 'records' | 'requests' | 'archive';
